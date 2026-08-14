import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Check, Loader2, ShieldAlert, X } from "lucide-react";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getAdminToken } from "@/lib/admin-session";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  open: "border-rose-400/25 bg-rose-400/10 text-rose-300",
  "under-review": "border-amber-400/25 bg-amber-400/10 text-amber-300",
  resolved: "border-lime-400/25 bg-lime-400/10 text-lime-300",
  dismissed: "border-white/15 bg-white/5 text-muted-foreground",
};

export default function AdminReports() {
  const token = getAdminToken() ?? "";
  const [status, setStatus] = useState<string>("open");
  const reports = useQuery(
    api.communityAdmin.adminReports,
    token ? { token, status } : "skip",
  );
  const resolve = useMutation(api.communityAdmin.adminResolveReport);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const act = async (id: string, fn: () => Promise<unknown>, success: string) => {
    setBusyId(id);
    try {
      await fn();
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Messages, users and communities reported by students. Review, moderate and resolve each report — every action is audit-logged."
      />

      <div className="flex flex-wrap gap-2">
        {["open", "under-review", "resolved", "dismissed"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm font-medium capitalize transition-colors",
              status === s
                ? "border-lime-400/40 bg-lime-400/12 text-lime-300"
                : "border-white/10 bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {reports === undefined ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading reports…
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="size-6" />}
          title={`No ${status} reports`}
          description="Reports submitted by students land here for review."
        />
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r._id} className="rounded-2xl border border-white/10 bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold capitalize">
                      {r.targetType} · {r.scope === "community" ? "Community" : "DM"}
                    </span>
                    <Badge className={cn("border", STATUS_STYLE[r.status])}>{r.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <b className="text-rose-300">{r.reason}</b>
                    {r.targetName ? ` — reported user: ${r.targetName}` : ""} · {r.context}
                    {r.messagePreview ? ` · “${r.messagePreview.slice(0, 120)}”` : ""}
                  </p>
                  {r.details && (
                    <p className="mt-1.5 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-xs text-muted-foreground">
                      {r.details}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground/70">
                    Reported by {r.reporterName} · {timeAgo(r.createdAt)}
                    {r.targetEmail ? ` · target email ${r.targetEmail}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:w-64">
                  <Input
                    value={note[r._id] ?? ""}
                    onChange={(e) => setNote((n) => ({ ...n, [r._id]: e.target.value }))}
                    placeholder="Moderator note…"
                    className="h-9 border-white/10 bg-black/20 text-xs"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 gap-1.5 bg-lime-400 text-black hover:bg-lime-300"
                      disabled={busyId === r._id}
                      onClick={() =>
                        void act(
                          r._id,
                          () =>
                            resolve({
                              token,
                              reportId: r._id as Id<"communicationReports">,
                              status: "resolved",
                              note: note[r._id] || undefined,
                            }),
                          "Report resolved",
                        )
                      }
                    >
                      {busyId === r._id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      Resolve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5 border-white/10 text-muted-foreground"
                      disabled={busyId === r._id}
                      onClick={() =>
                        void act(
                          r._id,
                          () =>
                            resolve({
                              token,
                              reportId: r._id as Id<"communicationReports">,
                              status: "dismissed",
                              note: note[r._id] || undefined,
                            }),
                          "Report dismissed",
                        )
                      }
                    >
                      <X className="size-3.5" /> Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Check,
  LifeBuoy,
  Loader2,
  Reply,
  ShieldAlert,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const SUPPORT_STATUS_STYLE: Record<string, string> = {
  open: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  responded: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  resolved: "border-lime-400/25 bg-lime-400/10 text-lime-300",
};

const SUPPORT_CATEGORY_LABEL: Record<string, string> = {
  bug: "🐛 Bug",
  feature: "💡 Feature request",
  account: "🔑 Account",
  content: "📚 Content",
  other: "✉️ Other",
};

export default function AdminReports() {
  const token = getAdminToken() ?? "";
  const [tab, setTab] = useState<"reports" | "support">("reports");
  const [status, setStatus] = useState<string>("open");
  const reports = useQuery(
    api.communityAdmin.adminReports,
    token ? { token, status } : "skip",
  );
  const resolve = useMutation(api.communityAdmin.adminResolveReport);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  // Tutor support
  const [supportStatus, setSupportStatus] = useState<string>("open");
  const support = useQuery(
    api.tutorSupport.adminSupportList,
    token ? { token, status: supportStatus as "open" | "responded" | "resolved" } : "skip",
  );
  const supportStats = useQuery(
    api.tutorSupport.adminSupportStats,
    token ? { token } : "skip",
  );
  const respond = useMutation(api.tutorSupport.adminSupportRespond);
  const [reply, setReply] = useState<Record<string, string>>({});
  const [busySupportId, setBusySupportId] = useState<string | null>(null);

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

  const actSupport = async (id: string, fn: () => Promise<unknown>, success: string) => {
    setBusySupportId(id);
    try {
      await fn();
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusySupportId(null);
    }
  };

  const tabs = (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => setTab("reports")}
        className={cn(
          "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
          tab === "reports"
            ? "border-lime-400/40 bg-lime-400/12 text-lime-300"
            : "border-white/10 bg-card text-muted-foreground hover:text-foreground",
        )}
      >
        Student reports
      </button>
      <button
        type="button"
        onClick={() => setTab("support")}
        className={cn(
          "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
          tab === "support"
            ? "border-lime-400/40 bg-lime-400/12 text-lime-300"
            : "border-white/10 bg-card text-muted-foreground hover:text-foreground",
        )}
      >
        Tutor support
        {(supportStats?.open ?? 0) > 0 && (
          <span className="ml-2 rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
            {supportStats?.open ?? 0}
          </span>
        )}
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & support"
        description="Student moderation reports and tutor messages to the admin team. Review, reply and resolve — every action is audit-logged."
      />

      {tabs}

      {tab === "reports" ? (
        <>
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
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {["open", "responded", "resolved"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSupportStatus(s)}
                className={cn(
                  "rounded-xl border px-4 py-2 text-sm font-medium capitalize transition-colors",
                  supportStatus === s
                    ? "border-lime-400/40 bg-lime-400/12 text-lime-300"
                    : "border-white/10 bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
            <p className="ml-auto text-xs text-muted-foreground">
              {supportStats?.total ?? 0} messages total
            </p>
          </div>

          {support === undefined ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading support messages…
            </div>
          ) : support.length === 0 ? (
            <EmptyState
              icon={<LifeBuoy className="size-6" />}
              title={`No ${supportStatus} messages`}
              description="Tutors report issues and message the admin team from their dashboard — replies land here."
            />
          ) : (
            <div className="space-y-3">
              {support.map((m) => (
                <div key={m._id} className="rounded-2xl border border-white/10 bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{m.subject}</span>
                        <Badge className={cn("border", SUPPORT_STATUS_STYLE[m.status])}>
                          {m.status}
                        </Badge>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {SUPPORT_CATEGORY_LABEL[m.category] ?? m.category}
                        </span>
                      </div>
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">
                        {m.body}
                      </p>
                      {m.adminNote && (
                        <div className="mt-2.5 rounded-xl border border-lime-400/20 bg-lime-400/8 px-3.5 py-2.5">
                          <p className="text-xs font-semibold text-lime-300">Your reply:</p>
                          <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground/90">
                            {m.adminNote}
                          </p>
                        </div>
                      )}
                      <p className="mt-1.5 text-[10px] text-muted-foreground/70">
                        {m.tutor?.name ?? "Tutor"} · {timeAgo(m.createdAt)}
                      </p>
                    </div>
                    <div className="flex w-full shrink-0 flex-col gap-2 sm:w-80">
                      <Textarea
                        value={reply[m._id] ?? ""}
                        onChange={(e) => setReply((n) => ({ ...n, [m._id]: e.target.value }))}
                        placeholder="Reply to the tutor…"
                        className="min-h-16 border-white/10 bg-black/20 text-xs"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 gap-1.5 bg-lime-400 text-black hover:bg-lime-300"
                          disabled={busySupportId === m._id || !(reply[m._id] ?? "").trim()}
                          onClick={() =>
                            void actSupport(
                              m._id,
                              () =>
                                respond({
                                  token,
                                  id: m._id as Id<"tutorSupportMessages">,
                                  note: (reply[m._id] ?? "").trim(),
                                  status: "responded",
                                }),
                              "Reply sent to the tutor",
                            )
                          }
                        >
                          {busySupportId === m._id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Reply className="size-3.5" />
                          )}
                          Reply
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1.5 border-white/10 text-muted-foreground"
                          disabled={busySupportId === m._id || !(reply[m._id] ?? "").trim()}
                          onClick={() =>
                            void actSupport(
                              m._id,
                              () =>
                                respond({
                                  token,
                                  id: m._id as Id<"tutorSupportMessages">,
                                  note: (reply[m._id] ?? "").trim(),
                                  status: "resolved",
                                }),
                              "Message resolved",
                            )
                          }
                        >
                          {busySupportId === m._id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Check className="size-3.5" />
                          )}
                          Reply &amp; resolve
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

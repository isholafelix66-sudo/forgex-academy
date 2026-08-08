import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Lock, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { Avatar } from "@/components/site/Avatar";
import { formatDate } from "@/lib/format";

export default function AdminAudit() {
  const logs = useQuery(api.admin.auditLogs);
  const lockAdmin = useMutation(api.admin.lockAdmin);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Audit log"
        description="Every admin action, review decision and course approval."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-rose-400/30 text-rose-300 hover:bg-rose-400/10"
            onClick={() => void lockAdmin()}
          >
            <Lock className="size-3.5" /> Lock admin access
          </Button>
        }
      />

      {logs === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-card p-10 text-center text-sm text-muted-foreground">
          No audit entries yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
          <div className="divide-y divide-white/5">
            {logs.map((l) => (
              <div key={l._id} className="flex items-center gap-4 px-5 py-3.5">
                <Avatar name={l.adminName} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{l.adminName}</span>{" "}
                    <span className="text-muted-foreground">→</span>{" "}
                    <span className="font-medium capitalize text-lime-300">{l.action}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.detail}
                    {l.tutorName ? ` · tutor: ${l.tutorName}` : ""}
                    {l.reason ? ` · ${l.reason}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(l.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ScrollText className="size-3.5 text-lime-300" />
        Locking admin access re-enables the password gate on the next visit.
      </p>
    </div>
  );
}

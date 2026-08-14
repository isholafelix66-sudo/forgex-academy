import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { getAdminToken } from "@/lib/admin-session";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

const ACTION_STYLE: Record<string, string> = {
  ADMIN_VIEW_CONVERSATION: "bg-white/5 text-muted-foreground",
  ADMIN_PLAYED_AUDIO: "bg-white/5 text-muted-foreground",
  ADMIN_REMOVED_MESSAGE: "bg-rose-400/10 text-rose-300",
  ADMIN_REMOVED_MEMBER: "bg-rose-400/10 text-rose-300",
  ADMIN_RESTRICTED_USER: "bg-amber-400/10 text-amber-300",
  ADMIN_LOCKED_CONVERSATION: "bg-amber-400/10 text-amber-300",
  ADMIN_LOCKED_COMMUNITY: "bg-amber-400/10 text-amber-300",
  ADMIN_ARCHIVED_COMMUNITY: "bg-amber-400/10 text-amber-300",
  ADMIN_WARNED_USER: "bg-amber-400/10 text-amber-300",
  ADMIN_SUSPENDED_USER: "bg-rose-400/10 text-rose-300",
  ADMIN_SENT_MODERATOR_MESSAGE: "bg-lime-400/10 text-lime-300",
  ADMIN_UNLOCKED_COMMUNITY: "bg-lime-400/10 text-lime-300",
  ADMIN_UNLOCKED_CONVERSATION: "bg-lime-400/10 text-lime-300",
  ADMIN_RESTORED_MEMBER: "bg-lime-400/10 text-lime-300",
  ADMIN_RESOLVED_REPORT: "bg-lime-400/10 text-lime-300",
  ADMIN_DISMISSED_REPORT: "bg-white/5 text-muted-foreground",
};

export default function AdminCommAudit() {
  const token = getAdminToken() ?? "";
  const [action, setAction] = useState<string>("");
  const rows = useQuery(
    api.communityAdmin.adminModerationAudit,
    token ? { token, action: action || undefined } : "skip",
  );

  const actions = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const r of rows ?? []) {
      if (!seen.has(r.action)) {
        seen.add(r.action);
        list.push(r.action);
      }
    }
    return list.sort();
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Every sensitive moderation action — viewing private DMs, playing voice messages, removing content, locking communities and more — is recorded here with a reason and timestamp."
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAction("")}
          className={cn(
            "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
            !action
              ? "border-lime-400/40 bg-lime-400/12 text-lime-300"
              : "border-white/10 bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          All actions
        </button>
        {actions.slice(0, 24).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAction(a)}
            className={cn(
              "rounded-xl border px-3 py-2 font-mono text-[11px] transition-colors",
              action === a
                ? "border-lime-400/40 bg-lime-400/12 text-lime-300"
                : "border-white/10 bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {a}
          </button>
        ))}
      </div>

      {rows === undefined ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading audit log…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="size-6" />}
          title="No audit entries yet"
          description="Moderation actions will appear here as they happen."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
          <div className="divide-y divide-white/8">
            {rows.map((r) => (
              <div key={r._id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                <span className="w-28 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {timeAgo(r.createdAt)}
                </span>
                <span
                  className={cn(
                    "w-fit shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold",
                    ACTION_STYLE[r.action] ?? "bg-white/5 text-muted-foreground",
                  )}
                >
                  {r.action}
                </span>
                <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                  <b className="text-foreground">{r.context || r.targetType || "—"}</b>
                  {r.userName ? ` · user: ${r.userName}` : ""}
                  {r.reason ? ` · “${r.reason}”` : ""}
                  <span className="block font-mono text-[10px] opacity-60">
                    target: {r.targetId ?? "—"}
                    {r.messageId ? ` · message: ${r.messageId}` : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, Lock, MessageCircle, Search, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/site/Avatar";
import { getAdminToken } from "@/lib/admin-session";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

export default function AdminDMs() {
  const token = getAdminToken() ?? "";
  const [query, setQuery] = useState("");
  const conversations = useQuery(
    api.communityAdmin.adminStudentConversations,
    token ? { token, search: query } : "skip",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Private DMs"
        description="Student-to-student conversations, reviewable for moderation. Opening a conversation is audit-logged (ADMIN_VIEW_CONVERSATION)."
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by student name or email…"
          className="border-white/10 bg-black/20 pl-9"
        />
      </div>

      {conversations === undefined ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading conversations…
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="size-6" />}
          title="No student conversations"
          description="Private DMs between students will appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
          {conversations.map((c, i) => (
            <div
              key={c._id}
              className={cn(
                "flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center",
                i > 0 && "border-t border-white/8",
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex -space-x-2 shrink-0">
                  {c.participants.map((p) => (
                    <Avatar key={p._id} name={p.name} image={p.image} className="size-9 ring-2 ring-card" />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">
                      {c.participants.map((p) => p.name).join(" ↔ ")}
                    </p>
                    {c.status === "locked" && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
                        <Lock className="size-3" /> Locked
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.lastMessage ?? "No messages"} · {c.messageCount} messages · {timeAgo(c.lastAt)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {c.openReports > 0 && (
                  <span className="flex items-center gap-1.5 rounded-full border border-rose-400/25 bg-rose-400/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                    <ShieldAlert className="size-3.5" /> {c.openReports} report{c.openReports > 1 ? "s" : ""}
                  </span>
                )}
                <Button variant="outline" size="sm" asChild className="border-lime-400/30 text-lime-300 hover:bg-lime-400/10">
                  <Link to={`/admin/communication/dms/${c._id}`}>Review</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

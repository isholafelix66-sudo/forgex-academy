import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, MessageSquare, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dash/PageHeader";
import { Avatar } from "@/components/site/Avatar";
import { getAdminToken } from "@/lib/admin-session";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

/**
 * Admin chat oversight — every conversation on the platform in one place.
 * Read-only: admins run password sessions without a user account, so they can
 * monitor chats but not participate in them.
 */
export default function AdminChat() {
  const token = getAdminToken() ?? "";
  const conversations = useQuery(
    api.admin.allConversations,
    token ? { token } : "skip",
  );
  const [threadId, setThreadId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const thread = useQuery(
    api.admin.conversationMessages,
    token && threadId ? { token, threadId } : "skip",
  );

  const filtered = conversations?.filter((c) =>
    c.participants.some(
      (p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.email ?? "").toLowerCase().includes(query.toLowerCase()),
    ),
  );
  const active = conversations?.find((c) => c.threadId === threadId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chat logs"
        description="Every conversation across the platform — read-only for admins."
      />

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* Conversation list */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="border-white/10 bg-black/20 pl-9"
            />
          </div>
          {conversations === undefined ? (
            <div className="h-64 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ) : (filtered?.length ?? 0) === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-card p-8 text-center text-sm text-muted-foreground">
              No conversations yet.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
              {filtered?.map((c) => (
                <button
                  key={c.threadId}
                  onClick={() => setThreadId(c.threadId)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-white/5 px-4 py-3.5 text-left transition-colors",
                    threadId === c.threadId ? "bg-lime-400/10" : "hover:bg-white/5",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {c.participants.map((p) => p.name).join(" ↔ ")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.lastMessage}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                      {c.messageCount} message{c.messageCount === 1 ? "" : "s"} ·{" "}
                      {timeAgo(c.lastAt)}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <span className="shrink-0 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      {c.unread} unread
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thread viewer (read-only) */}
        <div className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-card">
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center text-sm text-muted-foreground">
              <MessageSquare className="size-8 text-muted-foreground/40" />
              <p className="mt-3">Select a conversation to read it.</p>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5" /> Read-only monitoring
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-white/10 bg-black/20 px-5 py-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setThreadId(null)}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {active.participants.map((p) => p.name).join(" ↔ ")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {active.participants
                      .map((p) =>
                        `${p.role}${p.online ? " · online" : " · offline"}`,
                      )
                      .join("  ")}
                  </p>
                </div>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {(thread ?? []).map((m) => (
                  <div key={m._id} className="flex gap-2.5">
                    <Avatar
                      name={m.sender?.name ?? "?"}
                      image={m.sender?.image}
                      className="size-7"
                    />
                    <div className="min-w-0 max-w-[80%]">
                      <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-black/30 px-3.5 py-2 text-sm">
                        <p className="text-[10px] font-semibold text-lime-300">
                          {m.sender?.name}{" "}
                          <span className="text-muted-foreground">
                            · {m.sender?.role}
                          </span>
                        </p>
                        <p className="mt-1 whitespace-pre-line">{m.body}</p>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {timeAgo(m.createdAt)}
                        {m.readAt ? " · read" : ""}
                      </p>
                    </div>
                  </div>
                ))}
                {(thread ?? []).length === 0 && (
                  <p className="text-center text-sm text-muted-foreground">
                    No messages in this thread.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

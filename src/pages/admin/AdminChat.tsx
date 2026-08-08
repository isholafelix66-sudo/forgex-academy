import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  ArrowLeft,
  CornerDownRight,
  Loader2,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dash/PageHeader";
import { Avatar } from "@/components/site/Avatar";
import { getAdminToken } from "@/lib/admin-session";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

/**
 * Admin chat oversight — every conversation on the platform in one place.
 * Admins can read every thread and reply to any participant as “ForgeX Admin”.
 * Replies land in a dedicated admin↔user thread that the recipient sees in
 * their floating chat, with an in-app notification + email.
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

  const [replyToId, setReplyToId] = useState("");
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const sendReply = useMutation(api.admin.adminReply);

  const filtered = conversations?.filter((c) =>
    c.participants.some(
      (p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.email ?? "").toLowerCase().includes(query.toLowerCase()),
    ),
  );
  const active = conversations?.find((c) => c.threadId === threadId);
  const participants = active?.participants ?? [];

  // Default the reply target to whoever sent the last message in the thread.
  const lastMessageId = thread?.[thread.length - 1]?._id;
  useEffect(() => {
    setReplyText("");
    const last = thread?.[thread.length - 1];
    setReplyToId(last?.sender?._id ?? participants[0]?._id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, lastMessageId]);

  const handleSend = async () => {
    const body = replyText.trim();
    if (!body || !replyToId || !threadId) return;
    setSending(true);
    try {
      await sendReply({
        token,
        threadId,
        body,
        replyToUserId: replyToId as Id<"users">,
      });
      const name =
        participants.find((p) => p._id === replyToId)?.name ?? "the user";
      toast.success(`Reply sent to ${name} as ForgeX Admin`);
      setReplyText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send the reply.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chat logs"
        description="Monitor every conversation and reply to any user as ForgeX Admin."
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

        {/* Thread viewer + reply composer */}
        <div className="flex min-h-[460px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-card">
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center text-sm text-muted-foreground">
              <MessageSquare className="size-8 text-muted-foreground/40" />
              <p className="mt-3">Select a conversation to read it.</p>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5" /> Replies are sent as ForgeX
                Admin
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
                <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-1 text-[11px] font-semibold text-lime-300 sm:inline-flex">
                  <ShieldCheck className="size-3.5" /> Reply as ForgeX Admin
                </span>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {(thread ?? []).map((m) => {
                  const isAdmin = m.sender?.role === "admin";
                  return (
                    <div key={m._id} className="flex gap-2.5">
                      <Avatar
                        name={m.sender?.name ?? "?"}
                        image={m.sender?.image}
                        className="size-7"
                      />
                      <div className="min-w-0 max-w-[80%]">
                        <div
                          className={cn(
                            "rounded-2xl rounded-tl-sm border px-3.5 py-2 text-sm",
                            isAdmin
                              ? "border-lime-400/30 bg-lime-400/10"
                              : "border-white/10 bg-black/30",
                          )}
                        >
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
                  );
                })}
                {(thread ?? []).length === 0 && (
                  <p className="text-center text-sm text-muted-foreground">
                    No messages in this thread.
                  </p>
                )}
              </div>

              {/* Reply composer */}
              <div className="border-t border-white/10 bg-black/20 p-4">
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <CornerDownRight className="size-3.5 text-lime-300" />
                    Reply to
                  </label>
                  <select
                    value={replyToId}
                    onChange={(e) => setReplyToId(e.target.value)}
                    className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-lime-400/50"
                  >
                    {participants.map((p) => (
                      <option key={p._id} value={p._id} className="bg-card">
                        {p.name} ({p.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder="Write a reply… (Enter to send, Shift+Enter for a new line)"
                    rows={2}
                    className="min-h-[44px] flex-1 resize-none border-white/10 bg-black/30 focus:border-lime-400/50"
                  />
                  <Button
                    onClick={() => void handleSend()}
                    disabled={sending || !replyText.trim() || !replyToId}
                    className="shrink-0 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Send
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

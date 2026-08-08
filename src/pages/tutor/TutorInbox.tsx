import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Avatar } from "@/components/site/Avatar";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

export default function TutorInbox() {
  const { user } = useAuth();
  const conversations = useQuery(api.messages.myConversations);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const thread = useQuery(
    api.messages.threadMessages,
    threadId ? { threadId } : "skip",
  );
  const markThreadRead = useMutation(api.messages.markThreadRead);
  const sendMessage = useMutation(api.messages.sendMessage);

  useEffect(() => {
    if (threadId) void markThreadRead({ threadId });
  }, [threadId, markThreadRead, thread]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread?.length]);

  const active = conversations?.find((c) => c.threadId === threadId) ?? null;

  const send = async () => {
    if (!active || !body.trim()) return;
    setSending(true);
    try {
      await sendMessage({ receiverId: active.other!._id as never, body });
      setBody("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not send the message.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        description="Message with students about their courses and progress."
      />

      {conversations === undefined ? (
        <div className="h-64 animate-pulse rounded-2xl border border-white/8 bg-card" />
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="size-6" />}
          title="No conversations yet"
          description="Students can message you from your profile and course pages."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          {/* Conversation list */}
          <div className="h-fit overflow-hidden rounded-2xl border border-white/10 bg-card">
            {conversations.map((c) => (
              <button
                key={c.threadId}
                onClick={() => setThreadId(c.threadId)}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-white/5 px-4 py-3.5 text-left transition-colors",
                  c.threadId === threadId ? "bg-lime-400/10" : "hover:bg-white/5",
                )}
              >
                <Avatar name={c.other?.name ?? "?"} image={c.other?.image} className="size-9" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{c.other?.name}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(c.lastAt)}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{c.lastMessage}</p>
                </div>
                {c.unread > 0 && (
                  <span className="shrink-0 rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                    {c.unread}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Thread */}
          <div className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-card">
            {active ? (
              <>
                <div className="flex items-center gap-3 border-b border-white/10 bg-black/20 px-5 py-4">
                  <Avatar name={active.other?.name ?? "?"} image={active.other?.image} className="size-9" />
                  <div>
                    <p className="text-sm font-semibold">{active.other?.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{active.other?.role}</p>
                  </div>
                </div>
                <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
                  {(thread ?? []).map((m) => {
                    const mine = m.senderId === user?._id;
                    return (
                      <div key={m._id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                            mine
                              ? "rounded-br-md bg-lime-400 text-black"
                              : "rounded-bl-md border border-white/10 bg-black/30 text-foreground",
                          )}
                        >
                          <p className="whitespace-pre-line">{m.body}</p>
                          <p className={cn("mt-1 text-[10px]", mine ? "text-black/60" : "text-muted-foreground")}>
                            {timeAgo(m.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {(thread ?? []).length === 0 && (
                    <p className="text-center text-sm text-muted-foreground">Say hello 👋</p>
                  )}
                </div>
                <div className="border-t border-white/10 p-4">
                  <div className="flex gap-2">
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                      rows={2}
                      placeholder="Type a reply… (Enter to send)"
                      className="border-white/10 bg-black/20"
                    />
                    <Button
                      onClick={() => void send()}
                      disabled={sending || !body.trim()}
                      className="shrink-0 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                    >
                      {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-muted-foreground">
                Select a conversation to start chatting.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

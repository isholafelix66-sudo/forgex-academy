import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  Send,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Avatar } from "@/components/site/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useMessageSound } from "@/hooks/use-message-notifications";
import { getChatSoundEnabled, setChatSoundEnabled } from "@/lib/chat-sound";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

/**
 * WhatsApp-style floating chat for signed-in users. Mounted once in the app
 * shell so it floats over every dashboard page: green FAB with an unread
 * badge, a conversation list with online/offline presence dots, and a thread
 * view with message bubbles. Also runs the presence heartbeat that drives the
 * “online now / last seen” statuses everywhere.
 */
export function FloatingChat() {
  const { user } = useAuth();
  const conversations = useQuery(api.messages.myConversations);
  const heartbeat = useMutation(api.users.presenceHeartbeat);
  const sendMessage = useMutation(api.messages.sendMessage);
  const markRead = useMutation(api.messages.markThreadRead);

  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [soundOn, setSoundOn] = useState(() => getChatSoundEnabled());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Notification sound on new incoming messages.
  useMessageSound();

  // Presence heartbeat — keep us “online” while the app is open.
  useEffect(() => {
    void heartbeat();
    const iv = setInterval(() => void heartbeat(), 25_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void heartbeat();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [heartbeat]);

  const thread = useQuery(
    api.messages.threadMessages,
    threadId ? { threadId } : "skip",
  );

  useEffect(() => {
    if (threadId) void markRead({ threadId });
  }, [threadId, markRead, thread?.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread?.length, open]);

  const active = conversations?.find((c) => c.threadId === threadId) ?? null;
  const unreadTotal = conversations?.reduce((s, c) => s + c.unread, 0) ?? 0;

  const send = async () => {
    if (!active?.other || !body.trim()) return;
    setSending(true);
    try {
      await sendMessage({ receiverId: active.other._id, body });
      setBody("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not send the message.",
      );
    } finally {
      setSending(false);
    }
  };

  // Admin sessions have no user account — nothing to chat with.
  if (!user?._id) return null;

  return (
    <>
      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-24 right-4 z-50 flex h-[min(600px,calc(100dvh-7rem))] w-[calc(100vw-2rem)] max-w-[380px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-card shadow-2xl shadow-black/50 sm:right-6"
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-white/10 bg-gradient-to-r from-lime-400/15 to-transparent px-3.5 py-3">
              {threadId ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  onClick={() => setThreadId(null)}
                >
                  <ArrowLeft className="size-4" />
                </Button>
              ) : (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-lime-400/15 text-lime-300">
                  <MessageSquare className="size-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                {threadId && active ? (
                  <>
                    <p className="truncate text-sm font-semibold">
                      {active.other?.name}
                    </p>
                    <p
                      className={cn(
                        "flex items-center gap-1 text-[11px]",
                        active.otherOnline
                          ? "text-lime-300"
                          : "text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          active.otherOnline
                            ? "bg-emerald-400"
                            : "bg-zinc-600",
                        )}
                      />
                      {active.otherOnline
                        ? "online"
                        : active.otherLastSeen
                          ? `last seen ${timeAgo(active.otherLastSeen)}`
                          : "offline"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold">Messages</p>
                    <p className="text-[11px] text-muted-foreground">
                      {unreadTotal > 0
                        ? `${unreadTotal} unread`
                        : "ForgeX Chat"}
                    </p>
                  </>
                )}
              </div>
              <button
                onClick={() => {
                  const next = !soundOn;
                  setSoundOn(next);
                  setChatSoundEnabled(next);
                }}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-lime-300"
                title={soundOn ? "Mute message sounds" : "Enable message sounds"}
              >
                {soundOn ? (
                  <Volume2 className="size-4" />
                ) : (
                  <VolumeX className="size-4" />
                )}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/10"
                title="Close chat"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Thread view */}
            {threadId && active ? (
              <>
                <div
                  ref={scrollRef}
                  className="bg-grid flex-1 space-y-2.5 overflow-y-auto p-4"
                >
                  {(thread ?? []).map((m) => {
                    const mine = m.senderId === user._id;
                    return (
                      <div
                        key={m._id}
                        className={cn("flex", mine ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                            mine
                              ? "rounded-br-sm bg-lime-400 text-black"
                              : "rounded-bl-sm border border-white/10 bg-white/8 text-foreground",
                          )}
                        >
                          <p className="whitespace-pre-line">{m.body}</p>
                          <p
                            className={cn(
                              "mt-0.5 text-[10px]",
                              mine ? "text-black/60" : "text-muted-foreground",
                            )}
                          >
                            {timeAgo(m.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {(thread ?? []).length === 0 && (
                    <p className="pt-6 text-center text-xs text-muted-foreground">
                      Say hello 👋
                    </p>
                  )}
                </div>
                <div className="flex gap-2 border-t border-white/10 p-3">
                  <Input
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder="Type a message…"
                    className="border-white/10 bg-black/20"
                  />
                  <Button
                    onClick={() => void send()}
                    disabled={sending || !body.trim()}
                    size="icon"
                    className="shrink-0 bg-lime-400 text-black hover:bg-lime-300"
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </Button>
                </div>
              </>
            ) : (
              /* Conversation list */
              <div className="flex-1 overflow-y-auto">
                {conversations === undefined ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-14 animate-pulse rounded-xl bg-white/5"
                      />
                    ))}
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
                    <MessageSquare className="size-7 text-muted-foreground/40" />
                    <p className="text-sm font-medium">No conversations yet</p>
                    <p className="text-xs text-muted-foreground">
                      Message a tutor from their profile page to start chatting.
                    </p>
                  </div>
                ) : (
                  <div className="p-2">
                    {conversations.map((c) => (
                      <button
                        key={c.threadId}
                        onClick={() => setThreadId(c.threadId)}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white/5"
                      >
                        <div className="relative shrink-0">
                          <Avatar
                            name={c.other?.name ?? "?"}
                            image={c.other?.image}
                            className="size-11"
                          />
                          <span
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card",
                              c.otherOnline ? "bg-emerald-400" : "bg-zinc-600",
                            )}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold">
                              {c.other?.name}
                            </p>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {timeAgo(c.lastAt)}
                            </span>
                          </div>
                          <p
                            className={cn(
                              "truncate text-xs",
                              c.unread > 0
                                ? "font-medium text-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            {c.lastMessage}
                          </p>
                        </div>
                        {c.unread > 0 && (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-lime-400 text-[10px] font-bold text-black">
                            {c.unread}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating action button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-lime-400 text-black shadow-xl shadow-lime-400/25 transition-transform hover:scale-105 active:scale-95 sm:right-6"
        title={open ? "Close chat" : "Open chat"}
      >
        {open ? <X className="size-6" /> : <MessageSquare className="size-6" />}
        {!open && unreadTotal > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-background">
            {unreadTotal > 9 ? "9+" : unreadTotal}
          </span>
        )}
      </button>
    </>
  );
}

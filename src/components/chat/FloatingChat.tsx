import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  Search,
  Send,
  SquarePen,
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
import { OPEN_CHAT_EVENT } from "@/lib/chat-open";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

/**
 * WhatsApp-style floating chat, mounted globally. Signed-in users get a green
 * FAB with an unread badge; the panel shows conversations with online/offline
 * presence dots, a thread view with bubbles, and a “new chat” composer to
 * start a conversation with any user. Any page can call `openChatWith(userId)`
 * to open the panel focused on a specific person (tutor profiles, courses…).
 * Also runs the presence heartbeat that drives online/offline statuses.
 */
export function FloatingChat() {
  const { user } = useAuth();
  const signedIn = !!user?._id;
  const conversations = useQuery(
    api.messages.myConversations,
    signedIn ? {} : "skip",
  );
  const heartbeat = useMutation(api.users.presenceHeartbeat);
  const sendMessage = useMutation(api.messages.sendMessage);
  const markRead = useMutation(api.messages.markThreadRead);

  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [draftTo, setDraftTo] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [search, setSearch] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [soundOn, setSoundOn] = useState(() => getChatSoundEnabled());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Notification sound on new incoming messages.
  useMessageSound();

  // Latest conversations, readable from the event listener below.
  const convRef = useRef(conversations);
  convRef.current = conversations;

  const targetUser = useQuery(
    api.users.getPublicUser,
    draftTo ? { id: draftTo as never } : "skip",
  );
  const results = useQuery(
    api.users.searchUsers,
    composing && search.trim() ? { q: search } : "skip",
  );

  // Open the chat focused on a specific user (fired from anywhere in the app).
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ userId?: string }>).detail;
      const userId = detail?.userId;
      if (!userId) return;
      setOpen(true);
      setComposing(false);
      const existing = convRef.current?.find((c) => c.other?._id === userId);
      if (existing) {
        setThreadId(existing.threadId);
        setDraftTo(null);
      } else {
        setThreadId(null);
        setDraftTo(userId);
      }
    };
    window.addEventListener(OPEN_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpen);
  }, []);

  // Presence heartbeat — keep us “online” while the app is open. Only runs
  // for signed-in users (the component stays mounted for everyone, so this
  // guard is what stops signed-out visitors / admin sessions from calling it).
  useEffect(() => {
    if (!user?._id) return;
    const beat = () => void heartbeat();
    beat();
    const iv = setInterval(beat, 25_000);
    const onVis = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [heartbeat, user?._id]);

  const thread = useQuery(
    api.messages.threadMessages,
    threadId ? { threadId } : "skip",
  );

  useEffect(() => {
    if (threadId) void markRead({ threadId });
  }, [threadId, markRead, thread?.length]);

  // Once a draft conversation is created, switch to the real thread.
  useEffect(() => {
    if (!draftTo) return;
    const existing = conversations?.find((c) => c.other?._id === draftTo);
    if (existing) {
      setThreadId(existing.threadId);
      setDraftTo(null);
    }
  }, [draftTo, conversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread?.length, open]);

  const active = conversations?.find((c) => c.threadId === threadId) ?? null;
  const unreadTotal = conversations?.reduce((s, c) => s + c.unread, 0) ?? 0;
  const receiverId = threadId ? active?.other?._id : draftTo;

  const send = async () => {
    if (!receiverId || !body.trim()) return;
    setSending(true);
    try {
      await sendMessage({ receiverId: receiverId as never, body });
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

  const back = () => {
    if (composing) setComposing(false);
    else if (threadId) setThreadId(null);
    else if (draftTo) setDraftTo(null);
  };

  const inThread = !!threadId && !!active;
  const inDraft = !!draftTo && !inThread;

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
              {(composing || threadId || draftTo) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  onClick={back}
                >
                  <ArrowLeft className="size-4" />
                </Button>
              )}
              {!composing && !inThread && !inDraft && (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-lime-400/15 text-lime-300">
                  <MessageSquare className="size-4" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                {composing ? (
                  <>
                    <p className="text-sm font-semibold">New chat</p>
                    <p className="text-[11px] text-muted-foreground">
                      Find someone to message
                    </p>
                  </>
                ) : inThread ? (
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
                ) : inDraft ? (
                  <>
                    <p className="truncate text-sm font-semibold">
                      {targetUser?.name ?? "New chat"}
                    </p>
                    <p className="text-[11px] capitalize text-muted-foreground">
                      {targetUser?.role ?? "user"}
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
              {!composing && !inThread && !inDraft && (
                <button
                  onClick={() => setComposing(true)}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-lime-300"
                  title="Start a new conversation"
                >
                  <SquarePen className="size-4" />
                </button>
              )}
              <button
                onClick={() => {
                  const next = !soundOn;
                  setSoundOn(next);
                  setChatSoundEnabled(next);
                }}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-lime-300"
                title={
                  soundOn ? "Mute message sounds" : "Enable message sounds"
                }
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

            {/* Composer: search users */}
            {composing ? (
              <div className="flex-1 overflow-y-auto p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name…"
                    autoFocus
                    className="border-white/10 bg-black/20 pl-9"
                  />
                </div>
                <div className="mt-2">
                  {!search.trim() ? (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      Search for a tutor or student to start chatting.
                    </p>
                  ) : results === undefined ? (
                    <div className="space-y-2 p-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-12 animate-pulse rounded-xl bg-white/5"
                        />
                      ))}
                    </div>
                  ) : results.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      No one found — try a different name.
                    </p>
                  ) : (
                    results.map((r) => (
                      <button
                        key={r._id}
                        onClick={() => {
                          setDraftTo(r._id);
                          setComposing(false);
                          setSearch("");
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                      >
                        <div className="relative shrink-0">
                          <Avatar name={r.name} image={r.image} className="size-10" />
                          <span
                            className={cn(
                              "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card",
                              r.online ? "bg-emerald-400" : "bg-zinc-600",
                            )}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{r.name}</p>
                          <p className="truncate text-xs capitalize text-muted-foreground">
                            {r.role}
                            {r.headline ? ` · ${r.headline}` : ""}
                          </p>
                        </div>
                        <MessageSquare className="size-4 shrink-0 text-lime-300" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : inThread ? (
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
                        className={cn(
                          "flex",
                          mine ? "justify-end" : "justify-start",
                        )}
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
            ) : inDraft ? (
              <>
                <div className="bg-grid flex-1 overflow-y-auto p-4">
                  <div className="flex flex-col items-center gap-2 pt-10 text-center">
                    <Avatar
                      name={targetUser?.name ?? "?"}
                      image={targetUser?.image}
                      className="size-14"
                    />
                    <p className="mt-2 text-sm font-semibold">
                      {targetUser?.name ?? "…"}
                    </p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {targetUser?.role ?? "user"}
                    </p>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Say hello to start the conversation 👋
                    </p>
                  </div>
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
                    autoFocus
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
                      Message a tutor from their profile or course page, or tap
                      the ✏️ button to start a new chat.
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

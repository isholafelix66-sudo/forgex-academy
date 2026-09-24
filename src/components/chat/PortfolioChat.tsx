import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  Archive,
  Check,
  Inbox,
  Loader2,
  MessageSquare,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/site/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatComposer } from "@/components/chat/ChatComposer";
import type { ChatAttachment } from "@/lib/chat-media";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import {
  clearGuestChatToken,
  getGuestChatToken,
  setGuestChatToken,
} from "@/lib/portfolio-guest-chat";

/* ═══════════════════════════════════════════════════════════════════════════
   PORTFOLIO CHAT

   The SAME messaging experience as the ForgeX chat — ChatBubble for messages,
   the shared ChatComposer (text, photo, file, voice), identical loading and
   empty states, same lime-on-dark visual language — pointed at a portfolio
   instead of an Academy account.

   • PortfolioChatSheet  — what a visitor sees on a shared portfolio. No
     account required: they leave a name and a first message.
   • PortfolioInbox      — the portfolio owner's conversations, with replies.
   ═══════════════════════════════════════════════════════════════════════════ */

type GuestMessage = {
  _id: string;
  body: string;
  kind: string | null;
  storageId: string | null;
  url: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  duration: number | null;
  createdAt: number;
  readAt: number | null;
  from: "guest" | "owner";
};

function asChatMessage(m: GuestMessage) {
  return { ...m, senderId: m.from };
}

/* ── Guest: message a portfolio owner, signed out ──────────────────────── */

export function PortfolioChatSheet({
  open,
  onOpenChange,
  slug,
  ownerName,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  ownerName: string;
  className?: string;
}) {
  const [token, setToken] = useState<string | null>(() => getGuestChatToken(slug));

  useEffect(() => {
    setToken(getGuestChatToken(slug));
  }, [slug]);

  const thread = useQuery(
    api.portfolioMessages.guestThread,
    open && token ? { token } : "skip",
  );
  const startThread = useMutation(api.portfolioMessages.startThread);
  const guestSend = useMutation(api.portfolioMessages.guestSend);
  const guestMarkRead = useMutation(api.portfolioMessages.guestMarkRead);
  const uploadUrl = useMutation(api.portfolioMessages.guestUploadUrl);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && token) void guestMarkRead({ token });
  }, [open, token, guestMarkRead, thread?.messages.length]);

  // A stored token whose conversation no longer exists (cleared data, a
  // different deployment) → start fresh instead of showing an empty thread.
  useEffect(() => {
    if (open && token && thread === null) {
      clearGuestChatToken(slug);
      setToken(null);
    }
  }, [open, token, thread, slug]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread?.messages.length, open]);

  const begin = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await startThread({
        slug,
        name,
        email: email || undefined,
        body: firstMessage,
      });
      setGuestChatToken(slug, res.token);
      setToken(res.token);
      setFirstMessage("");
    } catch (err) {
      setError(friendlyError(err, "Couldn't send your message."));
    } finally {
      setBusy(false);
    }
  };

  const send = async (payload: { body: string; attachment?: ChatAttachment }) => {
    if (!token) return;
    await guestSend({
      token,
      body: payload.body,
      ...(payload.attachment
        ? {
            kind: payload.attachment.kind,
            storageId: payload.attachment.storageId as never,
            fileName: payload.attachment.fileName,
            fileSize: payload.attachment.fileSize,
            mimeType: payload.attachment.mimeType,
            duration: payload.attachment.duration,
          }
        : {}),
    });
  };

  const waiting = !!token && thread !== null && thread === undefined;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="pf-chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            key="pf-chat-panel"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-label={`Message ${ownerName}`}
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 flex h-[min(620px,88dvh)] flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-card shadow-2xl shadow-black/50 md:inset-x-auto md:bottom-6 md:right-6 md:h-[min(620px,80dvh)] md:w-[400px] md:rounded-3xl",
              className,
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-white/10 bg-gradient-to-r from-lime-400/15 to-transparent px-3.5 py-3">
              {token && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  onClick={() => {
                    clearGuestChatToken(slug);
                    setToken(null);
                  }}
                  title="Start over"
                >
                  <ArrowLeft className="size-4" />
                </Button>
              )}
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-lime-400/15 text-lime-300">
                <MessageSquare className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{ownerName}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {token ? "Portfolio conversation" : "No account needed"}
                </p>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/10"
                title="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {!token ? (
              /* First message — the only "sign up" is a display name. */
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div className="rounded-2xl border border-lime-400/20 bg-lime-400/5 p-3.5">
                  <p className="text-sm font-semibold">Message {ownerName}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    You don't need an account. Add your name and send your message —
                    they'll see it in their Portfolio inbox and can reply here.
                  </p>
                </div>

                <div>
                  <Label htmlFor="pf-chat-name" className="text-xs">
                    Your name
                  </Label>
                  <Input
                    id="pf-chat-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Amara Okafor"
                    className="mt-1.5 h-11 border-white/10 bg-black/20"
                    autoComplete="name"
                  />
                </div>

                <div>
                  <Label htmlFor="pf-chat-email" className="text-xs">
                    Email <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="pf-chat-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="So they can reply by email too"
                    className="mt-1.5 h-11 border-white/10 bg-black/20"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <Label htmlFor="pf-chat-message" className="text-xs">
                    Message
                  </Label>
                  <Textarea
                    id="pf-chat-message"
                    value={firstMessage}
                    onChange={(e) => setFirstMessage(e.target.value)}
                    placeholder="Hi! I loved your work on…"
                    rows={4}
                    className="mt-1.5 border-white/10 bg-black/20"
                  />
                </div>

                {error && (
                  <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-xs text-rose-200">
                    {error}
                  </p>
                )}

                <Button
                  onClick={() => void begin()}
                  disabled={busy || name.trim().length < 2 || firstMessage.trim().length === 0}
                  className="h-11 w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {busy ? "Sending…" : "Send message"}
                </Button>
                <p className="pb-1 text-center text-[11px] leading-relaxed text-muted-foreground">
                  Your name and message are shared only with this portfolio owner.
                </p>
              </div>
            ) : waiting ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div
                  ref={scrollRef}
                  className="bg-grid flex-1 space-y-2.5 overflow-y-auto p-4"
                >
                  {(thread?.messages ?? []).map((m) => (
                    <ChatBubble
                      key={m._id}
                      message={asChatMessage(m as GuestMessage)}
                      mine={m.from === "guest"}
                    />
                  ))}
                  {(thread?.messages ?? []).length === 0 && (
                    <p className="pt-6 text-center text-xs text-muted-foreground">
                      Say hello 👋
                    </p>
                  )}
                </div>
                <div className="border-t border-white/10 p-3 safe-area-bottom">
                  <ChatComposer
                    onSend={send}
                    placeholder="Write a reply…"
                    uploadUrlProvider={() => uploadUrl({ token })}
                  />
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Owner: the Portfolio inbox ────────────────────────────────────────── */

type OwnerThreadSummary = {
  _id: string;
  portfolioSlug: string;
  guestName: string;
  guestEmail: string | null;
  context: string | null;
  status: "open" | "archived" | "spam";
  lastMessageAt: number;
  lastMessagePreview: string;
  lastFrom: "guest" | "owner";
  unread: number;
  createdAt: number;
};

export function PortfolioInbox({ token }: { token: string }) {
  const threads = useQuery(api.portfolioMessages.ownerThreads, { token });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "archived">("all");

  const list = (threads ?? []).filter((t) =>
    filter === "all"
      ? t.status !== "spam"
      : filter === "open"
        ? t.status === "open"
        : t.status === "archived",
  );

  const active = activeId ?? list[0]?._id ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <div className="rounded-2xl border border-white/10 bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <p className="font-display flex items-center gap-2 text-sm font-semibold">
            <Inbox className="size-4 text-lime-300" />
            Conversations
          </p>
          <div className="flex rounded-full border border-white/10 bg-black/20 p-0.5">
            {(["all", "open", "archived"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors",
                  filter === f
                    ? "bg-lime-400 text-black"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[60dvh] overflow-y-auto p-2">
          {threads === undefined ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <MessageSquare className="mx-auto size-6 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">No messages yet</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Visitors who use the Message button on your public portfolio land
                here — no account needed on their side.
              </p>
            </div>
          ) : (
            list.map((t) => (
              <button
                key={t._id}
                onClick={() => setActiveId(t._id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
                  active === t._id ? "bg-white/8" : "hover:bg-white/5",
                )}
              >
                <Avatar name={t.guestName} className="size-11" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{t.guestName}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(t.lastMessageAt)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "truncate text-xs",
                      t.unread > 0
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {t.lastFrom === "owner" ? "You: " : ""}
                    {t.lastMessagePreview}
                  </p>
                </div>
                {t.unread > 0 && (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-lime-400 text-[10px] font-bold text-black">
                    {t.unread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {active ? (
        <PortfolioOwnerThread
          key={active}
          token={token}
          threadId={active}
          summary={(threads ?? []).find((t) => t._id === active) ?? null}
        />
      ) : (
        <div className="hidden items-center justify-center rounded-2xl border border-white/10 bg-card p-10 text-center lg:flex">
          <div>
            <MessageSquare className="mx-auto size-7 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium">Pick a conversation</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Replies you send appear instantly in the visitor's chat.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function PortfolioOwnerThread({
  token,
  threadId,
  summary,
}: {
  token: string;
  threadId: string;
  summary: OwnerThreadSummary | null;
}) {
  const thread = useQuery(api.portfolioMessages.ownerThread, {
    token,
    threadId: threadId as never,
  });
  const ownerSend = useMutation(api.portfolioMessages.ownerSend);
  const markRead = useMutation(api.portfolioMessages.ownerMarkRead);
  const setStatus = useMutation(api.portfolioMessages.ownerSetStatus);
  const removeThread = useMutation(api.portfolioMessages.ownerDeleteThread);
  const uploadUrl = useMutation(api.portfolioUploads.creatorUploadUrl);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    void markRead({ token, threadId: threadId as never });
  }, [token, threadId, markRead, thread?.messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread?.messages.length]);

  const send = async (payload: { body: string; attachment?: ChatAttachment }) => {
    await ownerSend({
      token,
      threadId: threadId as never,
      body: payload.body,
      ...(payload.attachment
        ? {
            kind: payload.attachment.kind,
            storageId: payload.attachment.storageId as never,
            fileName: payload.attachment.fileName,
            fileSize: payload.attachment.fileSize,
            mimeType: payload.attachment.mimeType,
            duration: payload.attachment.duration,
          }
        : {}),
    });
  };

  const status = thread?.status ?? summary?.status ?? "open";

  return (
    <div className="flex min-h-[60dvh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
        <Avatar name={thread?.guestName ?? summary?.guestName ?? "?"} className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {thread?.guestName ?? summary?.guestName ?? "Visitor"}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {thread?.guestEmail ?? summary?.guestEmail ?? "No email shared"}
            {(thread?.context ?? summary?.context)
              ? ` · re: ${thread?.context ?? summary?.context}`
              : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-white/15"
          onClick={() =>
            void setStatus({
              token,
              threadId: threadId as never,
              status: status === "archived" ? "open" : "archived",
            })
          }
        >
          {status === "archived" ? (
            <>
              <Check className="size-3.5" /> Reopen
            </>
          ) : (
            <>
              <Archive className="size-3.5" /> Archive
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-white/15 text-rose-300 hover:border-rose-400/40"
          onClick={() => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            void removeThread({ token, threadId: threadId as never });
          }}
        >
          <Trash2 className="size-3.5" />
          {confirmDelete ? "Sure?" : "Delete"}
        </Button>
      </div>

      <div ref={scrollRef} className="bg-grid flex-1 space-y-2.5 overflow-y-auto p-4">
        {thread === undefined ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          (thread?.messages ?? []).map((m) => (
            <ChatBubble
              key={m._id}
              message={asChatMessage(m as GuestMessage)}
              mine={m.from === "owner"}
            />
          ))
        )}
      </div>

      <div className="border-t border-white/10 p-3">
        <ChatComposer
          onSend={send}
          placeholder="Reply to this visitor…"
          uploadUrlProvider={() => uploadUrl({ token })}
        />
      </div>
    </div>
  );
}

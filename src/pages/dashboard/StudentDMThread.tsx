import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { ArrowLeft, Ban, Flag, Lock, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "@/components/site/Avatar";
import { ChatComposer } from "@/components/chat/ChatComposer";
import type { ChatAttachment } from "@/lib/chat-media";
import {
  MessageThread,
  ReportDialog,
  type ThreadMessage,
} from "@/components/community/MessageThread";

export default function StudentDMThread() {
  const { id } = useParams<{ id: string }>();
  const conversationId = id as Id<"studentConversations">;
  const { user } = useAuth();
  const myUserId = user?._id ?? "";

  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const thread = useQuery(api.community.studentConversationMessages, {
    conversationId,
    cursor,
  });
  const markRead = useMutation(api.community.markConversationRead);
  const sendMsg = useMutation(api.community.sendStudentMessage);
  const toggleReaction = useMutation(api.community.toggleStudentReaction);
  const editMsg = useMutation(api.community.editStudentMessage);
  const deleteMsg = useMutation(api.community.deleteStudentMessage);
  const report = useMutation(api.community.reportContent);
  const block = useMutation(api.community.blockUser);

  const [replyTo, setReplyTo] = useState<ThreadMessage | null>(null);
  const [reportTarget, setReportTarget] = useState<ThreadMessage | null>(null);
  const [reportUserOpen, setReportUserOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const [cache, setCache] = useState<Map<string, ThreadMessage>>(new Map());
  useEffect(() => {
    if (!thread) return;
    setCache((prev) => {
      const next = new Map(prev);
      for (const m of thread.messages) {
        next.set(m._id, m as unknown as ThreadMessage);
      }
      return next;
    });
  }, [thread]);
  const messages = useMemo(
    () => [...cache.values()].sort((a, b) => a.createdAt - b.createdAt),
    [cache],
  );

  // Mark the conversation read when messages arrive / change.
  useEffect(() => {
    if (thread && myUserId) {
      void markRead({ conversationId }).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.messages.length]);

  const convo = thread?.convo ?? null;
  const other = convo?.other ?? null;
  const locked = convo?.status === "locked";

  const handleSend = async (payload: { body: string; attachment?: ChatAttachment }) => {
    if (!other?._id) return;
    setSending(true);
    try {
      await sendMsg({
        receiverId: other._id as Id<"users">,
        body: payload.body || undefined,
        kind: payload.attachment?.kind as "image" | "file" | "voice" | undefined,
        storageId: payload.attachment?.storageId as Id<"_storage"> | undefined,
        url: undefined,
        fileName: payload.attachment?.fileName,
        fileSize: payload.attachment?.fileSize,
        mimeType: payload.attachment?.mimeType,
        duration: payload.attachment?.duration,
        replyToId: replyTo ? (replyTo._id as Id<"studentMessages">) : undefined,
      });
      setReplyTo(null);
    } finally {
      setSending(false);
    }
  };

  const handleReportMessage = async (reason: string, details: string) => {
    if (!reportTarget) return;
    await report({
      targetType: "message",
      scope: "dm",
      conversationId,
      messageId: reportTarget._id,
      targetUserId: reportTarget.senderId as Id<"users"> | undefined,
      reason,
      details,
    });
  };

  const handleReportUser = async (reason: string, details: string) => {
    if (!other?._id) return;
    await report({
      targetType: "user",
      scope: "dm",
      conversationId,
      targetUserId: other._id as Id<"users">,
      reason,
      details,
    });
  };

  if (!thread) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-sm text-muted-foreground">
        {thread === undefined ? "Loading conversation…" : "This conversation isn't available to you."}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-card px-4 py-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0 text-muted-foreground">
          <Link to="/dashboard/dms" title="Back to DMs">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="relative shrink-0">
          <Avatar name={other?.name ?? "?"} image={other?.image ?? null} className="size-11" />
          {other?.online && (
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-lime-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display truncate text-lg font-bold">{other?.name ?? "Student"}</h2>
            {locked && (
              <span className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                <Lock className="size-3" /> Locked
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {other?.online
              ? "Online now"
              : other
                ? "Student · private DM"
                : "Student"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          title="Report this student"
          onClick={() => setReportUserOpen(true)}
          className="shrink-0 text-muted-foreground hover:text-rose-300"
        >
          <Flag className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Block this student"
          onClick={() => {
            if (!other?._id) return;
            block({ userId: other._id as Id<"users"> })
              .then(() => toast.success("Student blocked. They can no longer message you."))
              .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't block."));
          }}
          className="shrink-0 text-muted-foreground hover:text-rose-300"
        >
          <Ban className="size-4" />
        </Button>
      </div>

      {locked && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-400/20 bg-amber-400/8 px-4 py-3 text-sm text-amber-200">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">This conversation was locked by a moderator.</p>
            <p className="text-xs text-amber-200/70">
              {convo?.lockedReason ? `Reason: ${convo.lockedReason}` : "No new messages can be sent."}
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-card">
        <MessageThread
          messages={messages}
          myUserId={myUserId}
          loading={thread === undefined}
          nextCursor={thread?.nextCursor ?? null}
          onLoadMore={() => {
            if (thread?.nextCursor) setCursor(thread.nextCursor);
          }}
          onReply={locked ? undefined : setReplyTo}
          onToggleReaction={
            locked
              ? undefined
              : (mid, emoji) =>
                  void toggleReaction({ messageId: mid as Id<"studentMessages">, emoji }).catch(
                    (err) => toast.error(err instanceof Error ? err.message : "Couldn't react."),
                  )
          }
          onEdit={
            locked
              ? undefined
              : (mid, body) => editMsg({ messageId: mid as Id<"studentMessages">, body })
          }
          onDelete={
            locked
              ? undefined
              : (mid) => deleteMsg({ messageId: mid as Id<"studentMessages"> })
          }
          onReport={setReportTarget}
        />
        <div className="border-t border-white/8 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {replyTo && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-lime-400/20 bg-lime-400/8 px-3 py-2 text-xs">
              <CornerDownRightIcon />
              <span className="min-w-0 flex-1 truncate text-lime-200">
                Replying to <b>{replyTo.sender.name}</b>: {replyTo.body.slice(0, 60) || "attachment"}
              </span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
          <ChatComposer
            onSend={handleSend}
            disabled={locked || sending}
            placeholder={locked ? "Locked by a moderator" : `Message ${other?.name ?? "student"}…`}
          />
        </div>
      </div>

      <ReportDialog
        open={!!reportTarget}
        onOpenChange={(o) => !o && setReportTarget(null)}
        onSubmit={handleReportMessage}
      />
      <ReportDialog
        open={reportUserOpen}
        onOpenChange={setReportUserOpen}
        onSubmit={handleReportUser}
      />
    </div>
  );
}

function CornerDownRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 text-lime-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 10 4 15 9 20" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </svg>
  );
}

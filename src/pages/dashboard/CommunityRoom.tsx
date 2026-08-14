import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { ArrowLeft, Lock, ShieldAlert, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "@/components/site/Avatar";
import { ChatComposer } from "@/components/chat/ChatComposer";
import type { ChatAttachment } from "@/lib/chat-media";
import {
  MessageThread,
  ReportDialog,
  type ThreadMessage,
} from "@/components/community/MessageThread";

export default function CommunityRoom() {
  const { id } = useParams<{ id: string }>();
  const communityId = id as Id<"courseCommunities">;
  const { user } = useAuth();
  const myUserId = user?._id ?? "";

  const sync = useMutation(api.community.syncMyCommunities);
  const detail = useQuery(api.community.communityDetail, { communityId });
  const members = useQuery(api.community.communityMembers, { communityId });
  const markRead = useMutation(api.community.markCommunityRead);
  const sendMsg = useMutation(api.community.sendCommunityMessage);
  const toggleReaction = useMutation(api.community.toggleCommunityReaction);
  const editMsg = useMutation(api.community.editCommunityMessage);
  const deleteMsg = useMutation(api.community.deleteCommunityMessage);
  const report = useMutation(api.community.reportContent);

  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const thread = useQuery(api.community.communityMessages, { communityId, cursor });
  const [showMembers, setShowMembers] = useState(false);
  const [replyTo, setReplyTo] = useState<ThreadMessage | null>(null);
  const [reportTarget, setReportTarget] = useState<ThreadMessage | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Ensure membership on first open (enrollment normally adds it already).
  useEffect(() => {
    if (myUserId) void sync().catch(() => undefined);
  }, [myUserId, sync]);

  // Accumulate paginated pages into a stable, ordered message list.
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

  // Mark the community read once messages arrive / change.
  useEffect(() => {
    if (thread && myUserId) {
      void markRead({ communityId }).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.messages.length]);

  const canPost =
    !!detail?.allowed &&
    detail.membership.status === "active" &&
    (detail.community.status === "active" ||
      (detail.community.status === "locked" && detail.membership.role !== "student"));

  const loadOlder = () => {
    if (thread?.nextCursor) setCursor(thread.nextCursor);
  };

  const handleSend = async (payload: { body: string; attachment?: ChatAttachment }) => {
    setSending(true);
    try {
      await sendMsg({
        communityId,
        body: payload.body || undefined,
        kind: payload.attachment?.kind as "image" | "file" | "voice" | undefined,
        storageId: payload.attachment?.storageId as Id<"_storage"> | undefined,
        url: undefined,
        fileName: payload.attachment?.fileName,
        fileSize: payload.attachment?.fileSize,
        mimeType: payload.attachment?.mimeType,
        duration: payload.attachment?.duration,
        replyToId: replyTo ? (replyTo._id as Id<"communityMessages">) : undefined,
      });
      setReplyTo(null);
    } finally {
      setSending(false);
    }
  };

  const handleReport = async (reason: string, details: string) => {
    if (!reportTarget) return;
    await report({
      targetType: "message",
      scope: "community",
      communityId,
      messageId: reportTarget._id,
      targetUserId: reportTarget.senderId as Id<"users"> | undefined,
      reason,
      details,
    });
  };

  if (!detail) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-sm text-muted-foreground">
        {detail === undefined ? "Loading community…" : "This community isn't available to you."}
      </div>
    );
  }

  const statusChip =
    detail.community.status === "active" ? (
      <Badge className="gap-1.5 border-lime-400/25 bg-lime-400/10 text-lime-300">
        <span className="size-1.5 animate-pulse rounded-full bg-lime-400" /> Community active
      </Badge>
    ) : detail.community.status === "locked" ? (
      <Badge className="gap-1.5 border-amber-400/25 bg-amber-400/10 text-amber-300">
        <Lock className="size-3" /> Locked
      </Badge>
    ) : (
      <Badge className="gap-1.5 border-white/15 bg-white/5 text-muted-foreground">
        <Lock className="size-3" /> Archived
      </Badge>
    );

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-card px-4 py-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0 text-muted-foreground">
          <Link to="/dashboard/communities" title="Back to communities">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display truncate text-lg font-bold">{detail.community.name}</h2>
            {statusChip}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {detail.course?.title ?? "Course community"} · {detail.memberCount} members
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMembers((s) => !s)}
          className="gap-2 border-white/10 text-muted-foreground"
        >
          <Users className="size-4" /> Members
        </Button>
      </div>

      {/* Locked/archived notice */}
      {detail.community.status !== "active" && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-400/20 bg-amber-400/8 px-4 py-3 text-sm text-amber-200">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {detail.community.status === "locked"
                ? "This community is temporarily locked."
                : "This community is archived and read-only."}
            </p>
            <p className="text-xs text-amber-200/70">
              {detail.community.status === "locked"
                ? detail.community.lockedReason
                  ? `Reason: ${detail.community.lockedReason}. `
                  : "" + "Only authorized tutors, moderators and administrators can post messages."
                : "The course has wrapped up — you can still read the history."}
            </p>
          </div>
        </div>
      )}

      {/* Removed notice */}
      {detail.membership.status === "removed" && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm text-rose-200">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">You've been removed from this community.</p>
            <p className="text-xs text-rose-200/70">
              {detail.removedReason
                ? `Reason: ${detail.removedReason}. `
                : ""}You can still enroll and continue learning — if you believe this is a mistake, contact support.
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Messages */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-white/10 bg-card">
          {!canPost && detail.membership.status !== "removed" && (
            <div className="flex items-center gap-2 border-b border-white/8 bg-black/20 px-4 py-2.5 text-xs text-muted-foreground">
              {detail.community.status === "locked"
                ? "🔒 This community is locked — you can read, but only staff can post."
                : detail.community.status === "archived"
                  ? "This community is archived — no new messages."
                  : "You can read this community, but posting is unavailable."}
            </div>
          )}
          <MessageThread
            messages={messages}
            myUserId={myUserId}
            loading={thread === undefined}
            nextCursor={thread?.nextCursor ?? null}
            onLoadMore={loadOlder}
            onReply={canPost ? setReplyTo : undefined}
            onToggleReaction={
              canPost
                ? (mid, emoji) =>
                    void toggleReaction({ messageId: mid as Id<"communityMessages">, emoji }).catch(
                      (err) => toast.error(err instanceof Error ? err.message : "Couldn't react."),
                    )
                : undefined
            }
            onEdit={
              canPost
                ? (mid, body) => editMsg({ messageId: mid as Id<"communityMessages">, body })
                : undefined
            }
            onDelete={
              canPost
                ? (mid) => deleteMsg({ messageId: mid as Id<"communityMessages"> })
                : undefined
            }
            onReport={setReportTarget}
          />
          <div className="border-t border-white/8 p-3">
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
              disabled={!canPost || sending}
              placeholder={
                canPost
                  ? "Write a message…"
                  : detail.community.status === "locked"
                    ? "Locked — read only"
                    : "Read only"
              }
            />
          </div>
        </div>

        {/* Members panel */}
        {showMembers && (
          <aside className="hidden w-64 shrink-0 flex-col rounded-2xl border border-white/10 bg-card lg:flex">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
              <p className="text-sm font-semibold">
                Members <span className="text-muted-foreground">({members?.length ?? 0})</span>
              </p>
              <button
                type="button"
                onClick={() => setShowMembers(false)}
                className="text-muted-foreground hover:text-foreground lg:hidden"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {members?.map((m) => (
                <div key={m._id} className="flex items-center gap-2.5 rounded-xl px-2 py-2">
                  <div className="relative">
                    <Avatar name={m.name} image={m.image} className="size-8" />
                    {m.online && (
                      <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-lime-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{m.name}</p>
                    <p className="text-[10px] capitalize text-muted-foreground">{m.role}</p>
                  </div>
                </div>
              ))}
              {members?.length === 0 && (
                <p className="p-4 text-center text-xs text-muted-foreground">No members yet.</p>
              )}
            </div>
          </aside>
        )}
      </div>

      <ReportDialog open={!!reportTarget} onOpenChange={(o) => !o && setReportTarget(null)} onSubmit={handleReport} />
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

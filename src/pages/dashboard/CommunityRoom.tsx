import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Lock,
  MessageSquareWarning,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "@/components/site/Avatar";
import { ChatComposer } from "@/components/chat/ChatComposer";
import type { ChatAttachment } from "@/lib/chat-media";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  MessageThread,
  ReportDialog,
  type ThreadMessage,
} from "@/components/community/MessageThread";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  moderator: "Moderator",
  tutor: "Tutor",
  student: "Student",
};

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
  const setStatus = useMutation(api.community.tutorSetCommunityStatus);
  const setMode = useMutation(api.community.tutorSetCommunityMessageMode);
  const removeMember = useMutation(api.community.tutorRemoveCommunityMember);

  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const thread = useQuery(api.community.communityMessages, { communityId, cursor });
  const [showMembers, setShowMembers] = useState(false);
  const [replyTo, setReplyTo] = useState<ThreadMessage | null>(null);
  const [reportTarget, setReportTarget] = useState<ThreadMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [lockReason, setLockReason] = useState("");
  const [lockBusy, setLockBusy] = useState(false);
  const [modeBusy, setModeBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ userId: string; name: string } | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

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

  const myRole = detail?.membership.role ?? "student";
  const isStaff = myRole === "tutor" || myRole === "admin" || myRole === "moderator";
  const viewerRole: "student" | "tutor" | "admin" =
    myRole === "admin" || myRole === "moderator" ? "admin" : myRole === "tutor" ? "tutor" : "student";
  const isLocked = detail?.community.status === "locked";
  const isArchived = detail?.community.status === "archived";
  const tutorsOnly = detail?.community.messageMode === "tutors_only";

  const canPost =
    !!detail?.allowed &&
    detail.membership.status === "active" &&
    (detail.community.status === "active" || (isLocked && isStaff)) &&
    (!tutorsOnly || isStaff);

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

  const confirmLock = async () => {
    setLockBusy(true);
    try {
      await setStatus({ communityId, status: "locked", reason: lockReason.trim() || undefined });
      toast.success("Community locked — only staff can post now.");
      setLockOpen(false);
      setLockReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't lock the community.");
    } finally {
      setLockBusy(false);
    }
  };

  const unlock = async () => {
    try {
      await setStatus({ communityId, status: "active" });
      toast.success("Community unlocked.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't unlock the community.");
    }
  };

  const toggleMode = async () => {
    if (modeBusy || isArchived) return;
    setModeBusy(true);
    try {
      const next = tutorsOnly ? "everyone" : "tutors_only";
      await setMode({ communityId, mode: next });
      toast.success(next === "tutors_only" ? "Tutors only — students can read but not post." : "Everyone can message again.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change the messaging mode.");
    } finally {
      setModeBusy(false);
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemoveBusy(true);
    try {
      await removeMember({
        communityId,
        userId: removeTarget.userId as Id<"users">,
        reason: undefined,
      });
      toast.success(`${removeTarget.name} was removed from this community.`);
      setRemoveTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove the member.");
    } finally {
      setRemoveBusy(false);
    }
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

        {/* Staff tools */}
        {isStaff && !isArchived && (
          <div className="flex items-center gap-2">
            <Button
              variant={tutorsOnly ? "secondary" : "outline"}
              size="sm"
              onClick={() => void toggleMode()}
              disabled={modeBusy}
              className="gap-2 border-white/10 text-xs"
              title={
                tutorsOnly
                  ? "Tutors only — switch back to everyone can message"
                  : "Everyone can message — switch to tutors only"
              }
            >
              {modeBusy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : tutorsOnly ? (
                <ShieldCheck className="size-3.5 text-lime-300" />
              ) : (
                <MessageSquareWarning className="size-3.5 text-lime-300" />
              )}
              <span className="hidden sm:inline">{tutorsOnly ? "Tutors only" : "Everyone can message"}</span>
            </Button>
            {isLocked ? (
              <Button variant="outline" size="sm" onClick={() => void unlock()} className="gap-2 border-white/10 text-xs">
                <Unlock className="size-3.5 text-lime-300" /> Unlock
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setLockOpen(true)} className="gap-2 border-white/10 text-xs">
                <Lock className="size-3.5 text-amber-300" /> Lock
              </Button>
            )}
          </div>
        )}

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
              {isLocked ? "This community is temporarily locked." : "This community is archived and read-only."}
            </p>
            <p className="text-xs text-amber-200/70">
              {isLocked
                ? detail.community.lockedReason
                  ? `Reason: ${detail.community.lockedReason}. `
                  : "" + "Only authorized tutors, moderators and administrators can post messages."
                : "The course has wrapped up — you can still read the history."}
            </p>
          </div>
        </div>
      )}

      {/* Tutors-only notice */}
      {tutorsOnly && detail.community.status === "active" && !isStaff && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-lime-400/20 bg-lime-400/8 px-4 py-3 text-sm text-lime-200">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold">Tutors-only mode</p>
            <p className="text-xs text-lime-200/70">Only community tutors can send messages right now. You can still read everything.</p>
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
              {detail.removedReason ? `Reason: ${detail.removedReason}. ` : ""}You can still enroll and continue learning — if you believe this is a mistake, contact support.
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Messages */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-white/10 bg-card">
          {!canPost && detail.membership.status !== "removed" && (
            <div className="flex items-center gap-2 border-b border-white/8 bg-black/20 px-4 py-2.5 text-xs text-muted-foreground">
              {isLocked
                ? "🔒 This community is locked — you can read, but only staff can post."
                : isArchived
                  ? "This community is archived — no new messages."
                  : tutorsOnly
                    ? "🔒 Only community tutors can send messages right now."
                    : "You can read this community, but posting is unavailable."}
            </div>
          )}
          <MessageThread
            messages={messages}
            myUserId={myUserId}
            viewerRole={viewerRole}
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
              disabled={!canPost || sending}
              placeholder={
                canPost
                  ? "Write a message…"
                  : isLocked
                    ? "Locked — read only"
                    : tutorsOnly
                      ? "Only community tutors can send messages right now."
                      : "Read only"
              }
            />
          </div>
        </div>

        {/* Members panel */}
        {showMembers && (
          <aside className="hidden w-72 shrink-0 flex-col rounded-2xl border border-white/10 bg-card lg:flex">
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
              {members?.map((m) => {
                const removable = m.userId !== myUserId && (viewerRole === "admin" || m.role === "student");
                return (
                  <div key={m._id} className="group flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-white/5">
                    <div className="relative">
                      <Avatar name={m.name} image={m.image} className="size-8" />
                      {m.online && (
                        <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-lime-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">
                        {m.name}
                        {m.userId === myUserId && <span className="ml-1 text-lime-300">(you)</span>}
                      </p>
                      <p className="flex items-center gap-1 text-[10px] capitalize text-muted-foreground">
                        {m.role === "admin" || m.role === "moderator" ? (
                          <ShieldCheck className="size-3 text-amber-300" />
                        ) : null}
                        {ROLE_LABEL[m.role] ?? m.role}
                      </p>
                    </div>
                    {isStaff && removable && (
                      <button
                        type="button"
                        title={`Remove ${m.name} from this community`}
                        onClick={() => setRemoveTarget({ userId: m.userId, name: m.name })}
                        className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-rose-400/10 hover:text-rose-300 group-hover:opacity-100"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
              {members?.length === 0 && (
                <p className="p-4 text-center text-xs text-muted-foreground">No members yet.</p>
              )}
            </div>
            {isStaff && (
              <p className="border-t border-white/8 px-4 py-2 text-[10px] text-muted-foreground">
                {viewerRole === "admin"
                  ? "You can remove any member. Removal never affects course enrollment."
                  : "As a community tutor you can remove students. Removal never affects course enrollment."}
              </p>
            )}
          </aside>
        )}
      </div>

      {/* Lock dialog */}
      <Dialog open={lockOpen} onOpenChange={(o) => !o && setLockOpen(false)}>
        <DialogContent className="max-w-md border-white/10 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="size-5 text-amber-300" /> Lock {detail.community.name}?
            </DialogTitle>
            <DialogDescription>
              Students will be able to read messages but won't be able to post. You and other
              community tutors can still communicate. This only affects this community.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={lockReason}
            onChange={(e) => setLockReason(e.target.value)}
            placeholder="Reason (e.g. Moderation / Temporary restriction) — optional"
            className="min-h-20 border-white/10 bg-black/20"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLockOpen(false)} disabled={lockBusy} className="border-white/10">
              Cancel
            </Button>
            <Button
              onClick={() => void confirmLock()}
              disabled={lockBusy}
              className="gap-2 bg-amber-400 text-black hover:bg-amber-300"
            >
              {lockBusy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
              Lock community
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove member dialog */}
      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title={`Remove ${removeTarget?.name ?? "this member"} from this community?`}
        description="They'll lose access to this community's chat and community-only content. Their course enrollment is NOT affected — they can still continue learning the course."
        confirmLabel="Remove"
        busy={removeBusy}
        onConfirm={() => void confirmRemove()}
      />

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

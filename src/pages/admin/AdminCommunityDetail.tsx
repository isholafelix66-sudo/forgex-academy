import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Archive,
  ArrowLeft,
  Loader2,
  Lock,
  MessageCircle,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  Unlock,
  UserCog,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/dash/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Avatar } from "@/components/site/Avatar";
import { getAdminToken } from "@/lib/admin-session";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { MessageThread, type ThreadMessage } from "@/components/community/MessageThread";

type Tab = "messages" | "members" | "controls";
const FILTERS = ["all", "text", "voice", "files", "images", "reported"] as const;

export default function AdminCommunityDetail() {
  const { id } = useParams<{ id: string }>();
  const communityId = id as Id<"courseCommunities">;
  const token = getAdminToken() ?? "";
  const [tab, setTab] = useState<Tab>("messages");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [memberSearch, setMemberSearch] = useState("");
  const [noticeText, setNoticeText] = useState("");
  const [sendingNotice, setSendingNotice] = useState(false);

  const detail = useQuery(
    api.communityAdmin.adminCommunityDetail,
    token ? { token, communityId } : "skip",
  );
  const thread = useQuery(
    api.communityAdmin.adminCommunityMessages,
    token ? { token, communityId, cursor, filter } : "skip",
  );
  const members = useQuery(
    api.communityAdmin.adminCommunityMembers,
    token ? { token, communityId, search: memberSearch } : "skip",
  );

  const setStatus = useMutation(api.communityAdmin.adminSetCommunityStatus);
  const removeMember = useMutation(api.communityAdmin.adminRemoveMember);
  const restoreMember = useMutation(api.communityAdmin.adminRestoreMember);
  const restrictMember = useMutation(api.communityAdmin.adminRestrictMember);
  const removeMessage = useMutation(api.communityAdmin.adminRemoveMessage);
  const sendNotice = useMutation(api.communityAdmin.adminSendCommunityNotice);
  const logAudio = useMutation(api.communityAdmin.adminLogAudioPlay);

  // Member action state (reason prompt)
  const [memberAction, setMemberAction] = useState<{
    kind: "remove" | "restrict";
    userId: string;
    name: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [confirmMsg, setConfirmMsg] = useState<ThreadMessage | null>(null);
  const [busy, setBusy] = useState(false);

  // Accumulate paginated messages
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
    () =>
      [...cache.values()]
        .sort((a, b) => a.createdAt - b.createdAt)
        .filter((m) => {
          if (filter === "all") return true;
          if (filter === "reported") return true;
          return (m.kind ?? "text") === filter || (filter === "files" && m.kind === "file");
        }),
    [cache, filter],
  );

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const handleNotice = async () => {
    if (!noticeText.trim()) return;
    setSendingNotice(true);
    try {
      await sendNotice({ token, communityId, body: noticeText.trim() });
      setNoticeText("");
      toast.success("Notice posted as 🛡️ ForgeX Admin");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post the notice.");
    } finally {
      setSendingNotice(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail?.community.name ?? "Community"}
        description={
          detail
            ? `${detail.course?.title ?? "Course"} · ${detail.memberCount} members · ${detail.messageCount} messages · ${detail.openReports} open reports`
            : "Loading…"
        }
        actions={
          <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground">
            <Link to="/admin/communication">
              <ArrowLeft className="size-4" /> All communities
            </Link>
          </Button>
        }
      />

      {detail && detail.community.status !== "active" && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-400/20 bg-amber-400/8 px-4 py-3 text-sm text-amber-200">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-semibold capitalize">Community {detail.community.status}.</p>
            <p className="text-xs text-amber-200/70">
              {detail.community.lockedReason ? `Reason: ${detail.community.lockedReason}` : "No reason recorded."}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "messages", label: "Message log", icon: <MessageCircle className="size-4" /> },
            { key: "members", label: "Members", icon: <Users className="size-4" /> },
            { key: "controls", label: "Community controls", icon: <UserCog className="size-4" /> },
          ] as { key: Tab; label: string; icon: React.ReactNode }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-lime-400/40 bg-lime-400/12 text-lime-300"
                : "border-white/10 bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      {tab === "messages" && (
        <div className="flex h-[65vh] flex-col rounded-2xl border border-white/10 bg-card">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-white/8 px-3 py-2.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFilter(f);
                  setCursor(undefined);
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-colors",
                  filter === f ? "bg-lime-400 text-black" : "bg-white/5 text-muted-foreground hover:text-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <MessageThread
            messages={messages}
            myUserId=""
            loading={thread === undefined}
            nextCursor={thread?.nextCursor ?? null}
            onLoadMore={() => {
              if (thread?.nextCursor) setCursor(thread.nextCursor);
            }}
            readOnly
            onVoicePlay={(m) => {
              void logAudio({
                token,
                scope: "community",
                communityId,
                messageId: m._id,
              }).catch(() => undefined);
            }}
            extraActions={(m) =>
              !m.deleted ? (
                <button
                  type="button"
                  onClick={() => setConfirmMsg(m)}
                  className="ml-1 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-rose-400/10 hover:text-rose-300"
                >
                  <Trash2 className="size-3" /> Remove
                </button>
              ) : undefined
            }
          />
        </div>
      )}

      {/* Members */}
      {tab === "members" && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search members…"
              className="border-white/10 bg-black/20 pl-9"
            />
          </div>
          <div className="space-y-2">
            {members?.map((m) => (
              <div
                key={m._id}
                className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-card p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="relative shrink-0">
                    <Avatar name={m.name} image={m.image} className="size-10" />
                    {m.online && (
                      <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-lime-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {m.name}{" "}
                      <span className="ml-1 rounded-full border border-white/10 bg-white/5 px-1.5 py-px text-[10px] font-semibold uppercase text-muted-foreground">
                        {m.role}
                      </span>
                      {m.suspended && (
                        <span className="ml-1 rounded-full border border-rose-400/25 bg-rose-400/10 px-1.5 py-px text-[10px] font-semibold uppercase text-rose-300">
                          suspended
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {m.email ?? "No email"} · joined {timeAgo(m.joinedAt)}
                      {m.removedAt ? ` · removed ${timeAgo(m.removedAt)}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      "border",
                      m.status === "active"
                        ? "border-lime-400/25 bg-lime-400/10 text-lime-300"
                        : m.status === "restricted"
                          ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
                          : "border-rose-400/25 bg-rose-400/10 text-rose-300",
                    )}
                  >
                    {m.status}
                  </Badge>
                  {m.status === "active" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/10 text-muted-foreground"
                        disabled={busy}
                        onClick={() => setMemberAction({ kind: "restrict", userId: m.userId, name: m.name })}
                      >
                        Restrict
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-rose-400/25 text-rose-300 hover:bg-rose-400/10"
                        disabled={busy}
                        onClick={() => setMemberAction({ kind: "remove", userId: m.userId, name: m.name })}
                      >
                        Remove
                      </Button>
                    </>
                  )}
                  {m.status !== "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-lime-400/30 text-lime-300"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => restoreMember({ token, communityId, userId: m.userId as Id<"users"> }),
                          `${m.name} restored`,
                        )
                      }
                    >
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {members?.length === 0 && (
              <p className="rounded-2xl border border-white/10 bg-card p-8 text-center text-sm text-muted-foreground">
                No members match your search.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      {tab === "controls" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-white/10 bg-card p-5">
            <h3 className="font-display text-base font-bold">Community status</h3>
            <p className="text-xs text-muted-foreground">
              Locked: students can read but only staff can post. Archived: read-only. Removing a
              student from a community never removes their course enrollment.
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "active", label: "Unlock (active)", icon: <Unlock className="size-4" /> },
                  { key: "locked", label: "Lock community", icon: <Lock className="size-4" /> },
                  { key: "archived", label: "Archive", icon: <Archive className="size-4" /> },
                ] as const
              ).map((s) => (
                <Button
                  key={s.key}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "gap-2 border-white/10",
                    detail?.community.status === s.key ? "border-lime-400/40 text-lime-300" : "text-muted-foreground",
                  )}
                  disabled={busy || detail?.community.status === s.key}
                  onClick={() =>
                    void run(
                      () =>
                        setStatus({
                          token,
                          communityId,
                          status: s.key,
                          reason:
                            s.key === "active" ? undefined : "Admin action (no reason given)",
                        }),
                      `Community ${s.key === "active" ? "unlocked" : s.key}`,
                    )
                  }
                >
                  {s.icon} {s.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/10 bg-card p-5">
            <h3 className="font-display text-base font-bold">Send moderator message</h3>
            <p className="text-xs text-muted-foreground">
              Posted directly in the community as <b className="text-amber-300">🛡️ ForgeX Admin</b> —
              never impersonating a student or tutor. Every message is audit-logged.
            </p>
            <Textarea
              value={noticeText}
              onChange={(e) => setNoticeText(e.target.value)}
              placeholder="Announcement, reminder or moderation note for this community…"
              className="min-h-28 border-white/10 bg-black/20"
            />
            <Button
              onClick={() => void handleNotice()}
              disabled={!noticeText.trim() || sendingNotice}
              className="gap-2 bg-lime-400 text-black hover:bg-lime-300"
            >
              {sendingNotice ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Post as ForgeX Admin
            </Button>
          </div>
        </div>
      )}

      {/* Member action dialog */}
      <Dialog
        open={!!memberAction}
        onOpenChange={(o) => !o && setMemberAction(null)}
      >
        <DialogContent className="max-w-md border-white/10 bg-card">
          <DialogHeader>
            <DialogTitle>
              {memberAction?.kind === "remove" ? "Remove member" : "Restrict member"}
            </DialogTitle>
            <DialogDescription>
              {memberAction?.kind === "remove"
                ? `Remove ${memberAction?.name} from this community? They can no longer post or read community content. Their course enrollment is untouched.`
                : `Restrict ${memberAction?.name} from posting in this community? They can still read.`}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (recorded in the audit log)"
            className="border-white/10 bg-black/20"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberAction(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              className={
                memberAction?.kind === "remove"
                  ? "gap-2 bg-rose-500 text-white hover:bg-rose-400"
                  : "gap-2 bg-amber-400 text-black hover:bg-amber-300"
              }
              disabled={!reason.trim() || busy}
              onClick={() => {
                if (!memberAction) return;
                const action = memberAction;
                setMemberAction(null);
                setReason("");
                if (action.kind === "remove") {
                  void run(
                    () =>
                      removeMember({
                        token,
                        communityId,
                        userId: action.userId as Id<"users">,
                        reason: reason.trim(),
                      }),
                    `${action.name} removed from the community`,
                  );
                } else {
                  void run(
                    () =>
                      restrictMember({
                        token,
                        communityId,
                        userId: action.userId as Id<"users">,
                        reason: reason.trim(),
                      }),
                    `${action.name} restricted`,
                  );
                }
              }}
            >
              {memberAction?.kind === "remove" ? <Trash2 className="size-4" /> : <UserCog className="size-4" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove message confirm */}
      <ConfirmDialog
        open={!!confirmMsg}
        onOpenChange={(o) => !o && setConfirmMsg(null)}
        title="Remove this message?"
        description="The message is soft-deleted: it disappears from the community for everyone, and the action is written to the audit log."
        confirmLabel="Remove message"
        busy={busy}
        onConfirm={() => {
          if (!confirmMsg) return;
          const m = confirmMsg;
          setConfirmMsg(null);
          void run(
            () =>
              removeMessage({
                token,
                scope: "community",
                communityId,
                messageId: m._id,
                reason: "Removed by moderator",
              }),
            "Message removed",
          );
        }}
      />
    </div>
  );
}

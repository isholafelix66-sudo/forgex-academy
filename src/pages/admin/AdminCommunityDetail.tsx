import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
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
  MessageSquareWarning,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
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
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editMode, setEditMode] = useState<"everyone" | "tutors_only">("everyone");
  const [editCohort, setEditCohort] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRules, setEditRules] = useState("");
  const [editImage, setEditImage] = useState("");
  const [editCapacity, setEditCapacity] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [capacityInput, setCapacityInput] = useState("");
  const [capacityBusy, setCapacityBusy] = useState(false);
  const [cohortOpen, setCohortOpen] = useState(false);
  const [cohortName, setCohortName] = useState("");
  const [cohortCapacity, setCohortCapacity] = useState("");
  const [cohortBusy, setCohortBusy] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{ userId: string; name: string } | null>(null);
  const [moveTargetId, setMoveTargetId] = useState("");
  const [moveBusy, setMoveBusy] = useState(false);

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
  const setMessageMode = useMutation(api.communityAdmin.adminSetCommunityMessageMode);
  const editCommunity = useMutation(api.communityAdmin.adminEditCommunity);
  const deleteCommunity = useMutation(api.communityAdmin.adminDeleteCommunity);
  const setMemberRole = useMutation(api.communityAdmin.adminSetMemberRole);
  const removeMember = useMutation(api.communityAdmin.adminRemoveMember);
  const restoreMember = useMutation(api.communityAdmin.adminRestoreMember);
  const restrictMember = useMutation(api.communityAdmin.adminRestrictMember);
  const removeMessage = useMutation(api.communityAdmin.adminRemoveMessage);
  const sendNotice = useMutation(api.communityAdmin.adminSendCommunityNotice);
  const logAudio = useMutation(api.communityAdmin.adminLogAudioPlay);
  const setCapacity = useMutation(api.communityAdmin.adminSetCommunityCapacity);
  const setEnrollment = useMutation(api.communityAdmin.adminSetCommunityEnrollment);
  const moveStudent = useMutation(api.communityAdmin.adminMoveStudent);
  const createCommunity = useMutation(api.communityAdmin.adminCreateCommunity);

  // Member action state (reason prompt)
  const [memberAction, setMemberAction] = useState<{
    kind: "remove" | "restrict";
    userId: string;
    name: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [confirmMsg, setConfirmMsg] = useState<ThreadMessage | null>(null);
  const [busy, setBusy] = useState(false);

  // Keep the capacity input in sync with the live community.
  useEffect(() => {
    if (detail) {
      setCapacityInput(detail.capacity.capacity ? String(detail.capacity.capacity) : "0");
    }
  }, [detail]);

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

  const saveCapacity = async () => {
    const n = Number(capacityInput);
    if (!Number.isInteger(n) || n < 0) {
      toast.error("Enter a valid student limit (0 = unlimited).");
      return;
    }
    setCapacityBusy(true);
    try {
      await setCapacity({ token, communityId, capacity: n });
      toast.success(n > 0 ? `Student limit set to ${n}.` : "Student limit removed — unlimited enrollment.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the student limit.");
    } finally {
      setCapacityBusy(false);
    }
  };

  const toggleEnrollment = async () => {
    setCapacityBusy(true);
    try {
      await setEnrollment({ token, communityId, closed: !detail?.capacity.closed });
      toast.success(detail?.capacity.closed ? "Enrollment reopened — new students can join again." : "Enrollment closed — new students can't join this community.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change enrollment.");
    } finally {
      setCapacityBusy(false);
    }
  };

  const saveCohort = async () => {
    if (!detail?.course) {
      toast.error("Course not found.");
      return;
    }
    const name = cohortName.trim();
    if (!name) {
      toast.error("Give the cohort a name.");
      return;
    }
    let capacity: number | undefined;
    if (cohortCapacity.trim()) {
      const n = Number(cohortCapacity);
      if (!Number.isInteger(n) || n < 0) {
        toast.error("Enter a valid student limit (0 = unlimited).");
        return;
      }
      capacity = n > 0 ? n : undefined;
    }
    setCohortBusy(true);
    try {
      const cid = await createCommunity({
        token,
        courseId: detail.course._id as Id<"courses">,
        name,
        studentCapacity: capacity,
        messageMode: "everyone",
      });
      toast.success("Cohort created — students can now be moved into it.");
      setCohortOpen(false);
      setCohortName("");
      setCohortCapacity("");
      navigate(`/admin/communication/communities/${cid}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the cohort.");
    } finally {
      setCohortBusy(false);
    }
  };

  const confirmMove = async () => {
    if (!moveTarget || !moveTargetId) return;
    setMoveBusy(true);
    try {
      await moveStudent({
        token,
        communityId,
        userId: moveTarget.userId as Id<"users">,
        targetCommunityId: moveTargetId as Id<"courseCommunities">,
      });
      toast.success(`${moveTarget.name} moved to the new cohort. Their account is unchanged.`);
      setMoveTarget(null);
      setMoveTargetId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't move the student.");
    } finally {
      setMoveBusy(false);
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

      {/* Student capacity & cohorts */}
      {detail && (
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display flex items-center gap-2 text-base font-bold">
                <Users className="size-4 text-lime-300" /> Student capacity
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {detail.capacity.capacity === null
                  ? "No student limit — unlimited enrollment."
                  : `${detail.capacity.studentCount} / ${detail.capacity.capacity} students · ${
                      detail.capacity.state === "closed"
                        ? "enrollment closed"
                        : detail.capacity.state === "full"
                          ? "🔴 full"
                          : `🟢 ${detail.capacity.spaces} space${detail.capacity.spaces === 1 ? "" : "s"} available`
                    }`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  value={capacityInput}
                  onChange={(e) => setCapacityInput(e.target.value)}
                  placeholder="0 = unlimited"
                  className="h-8 w-24 border-white/10 bg-black/20"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-lime-400/30 text-lime-300 hover:bg-lime-400/10"
                  onClick={() => void saveCapacity()}
                  disabled={capacityBusy}
                >
                  {capacityBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Users className="size-3.5" />}
                  Set limit
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-white/10"
                onClick={() => void toggleEnrollment()}
                disabled={capacityBusy}
              >
                {detail.capacity.closed ? <Unlock className="size-3.5 text-lime-300" /> : <Lock className="size-3.5 text-amber-300" />}
                {detail.capacity.closed ? "Reopen" : "Close enrollment"}
              </Button>
              <Button
                size="sm"
                className="gap-1.5 bg-lime-400 text-black hover:bg-lime-300"
                onClick={() => setCohortOpen(true)}
              >
                <Plus className="size-3.5" /> New cohort
              </Button>
            </div>
          </div>
          {detail.capacity.capacity !== null && (
            <div className="mt-3 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    detail.capacity.state === "full" ? "bg-rose-400" : "bg-lime-400",
                  )}
                  style={{ width: `${Math.min(100, (detail.capacity.studentCount / detail.capacity.capacity) * 100)}%` }}
                />
              </div>
              <span
                className={cn(
                  "text-[11px] font-bold uppercase tracking-wide",
                  detail.capacity.state === "closed"
                    ? "text-amber-300"
                    : detail.capacity.state === "full"
                      ? "text-rose-300"
                      : "text-lime-300",
                )}
              >
                {detail.capacity.state === "closed" ? "🔒 Closed" : detail.capacity.state === "full" ? "🔴 Full" : "🟢 Open"}
              </span>
            </div>
          )}
          {detail.capacity.capacity !== null && detail.capacity.spaces === 0 && detail.capacity.state !== "closed" && (
            <p className="mt-2 text-xs text-amber-300">
              This community is at capacity — create a new cohort and move students into it instead of growing this one further.
            </p>
          )}
          {detail.cohorts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cohorts of {detail.course?.title ?? "this course"}:</span>
              {detail.cohorts.map((c) => (
                <Link
                  key={c._id}
                  to={`/admin/communication/communities/${c._id}`}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
                >
                  <Users className="size-3" />
                  {c.name}
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      c.capacity.state === "closed"
                        ? "text-amber-300"
                        : c.capacity.state === "full"
                          ? "text-rose-300"
                          : "text-lime-300",
                    )}
                  >
                    {c.capacity.capacity === null ? "∞" : `${c.capacity.studentCount}/${c.capacity.capacity}`}
                  </span>
                </Link>
              ))}
            </div>
          )}
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
            showDeletedContent
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
                      <span
                        className={cn(
                          "ml-1 rounded-full border px-1.5 py-px text-[10px] font-semibold uppercase",
                          m.role === "admin"
                            ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                            : m.role === "tutor"
                              ? "border-lime-400/30 bg-lime-400/10 text-lime-300"
                              : "border-white/10 bg-white/5 text-muted-foreground",
                        )}
                      >
                        {m.role === "tutor" ? "Community tutor" : m.role}
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

                <div className="flex flex-wrap items-center gap-2">
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
                      {m.role !== "admin" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "gap-1.5",
                            m.role === "tutor"
                              ? "border-amber-400/25 text-amber-300 hover:bg-amber-400/10"
                              : "border-lime-400/30 text-lime-300 hover:bg-lime-400/10",
                          )}
                          disabled={busy}
                          onClick={() =>
                            void run(
                              () =>
                                setMemberRole({
                                  token,
                                  communityId,
                                  userId: m.userId as Id<"users">,
                                  role: m.role === "tutor" ? "student" : "tutor",
                                }),
                              m.role === "tutor"
                                ? `${m.name} demoted to student`
                                : `${m.name} is now a community tutor`,
                            )
                          }
                        >
                          {m.role === "tutor" ? (
                            <UserCog className="size-3.5" />
                          ) : (
                            <ShieldCheck className="size-3.5" />
                          )}
                          {m.role === "tutor" ? "Demote" : "Make tutor"}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-white/10 text-muted-foreground"
                        disabled={busy}
                        onClick={() => setMemberAction({ kind: "restrict", userId: m.userId, name: m.name })}
                      >
                        Restrict
                      </Button>
                      {m.role === "student" && detail && detail.cohorts.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-white/10 text-muted-foreground"
                          disabled={busy}
                          onClick={() => {
                            setMoveTarget({ userId: m.userId, name: m.name });
                            setMoveTargetId("");
                          }}
                        >
                          Move
                        </Button>
                      )}
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
            <h3 className="font-display flex items-center gap-2 text-base font-bold">
              <MessageSquareWarning className="size-4 text-lime-300" /> Messaging mode
            </h3>
            <p className="text-xs text-muted-foreground">
              <b className="text-lime-300">Everyone can message:</b> students and tutors can all post.
              <br />
              <b className="text-amber-300">Tutors only:</b> students can read but cannot send — they'll
              see “Only community tutors can send messages right now.”
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "everyone", label: "Everyone can message", icon: <MessageCircle className="size-4" /> },
                  { key: "tutors_only", label: "Tutors only", icon: <ShieldCheck className="size-4" /> },
                ] as const
              ).map((s) => (
                <Button
                  key={s.key}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "gap-2 border-white/10",
                    detail?.community.messageMode === s.key
                      ? "border-lime-400/40 text-lime-300"
                      : "text-muted-foreground",
                  )}
                  disabled={busy || detail?.community.messageMode === s.key}
                  onClick={() =>
                    void run(
                      () => setMessageMode({ token, communityId, mode: s.key }),
                      s.key === "tutors_only"
                        ? "Tutors only — students can read but not post."
                        : "Everyone can message again.",
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

          <div className="space-y-4 rounded-2xl border border-white/10 bg-card p-5">
            <h3 className="font-display text-base font-bold">Edit or delete community</h3>
            <p className="text-xs text-muted-foreground">
              Edit the community name and default messaging mode, or permanently delete the
              community (all members and messages are removed — course enrollment is untouched).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-white/10 text-muted-foreground"
                disabled={busy}
                onClick={() => {
                  setEditName(detail?.community.name ?? "");
                  setEditMode(detail?.community.messageMode ?? "everyone");
                  setEditCohort(detail?.community.cohortLabel ?? "");
                  setEditDescription(detail?.community.description ?? "");
                  setEditRules(detail?.community.rules ?? "");
                  setEditImage(detail?.community.image ?? "");
                  setEditCapacity(detail?.capacity.capacity ? String(detail.capacity.capacity) : "0");
                  setEditOpen(true);
                }}
              >
                <Pencil className="size-4" /> Edit community
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-rose-400/25 text-rose-300 hover:bg-rose-400/10"
                disabled={busy}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" /> Delete community
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit community dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => !o && setEditOpen(false)}>
        <DialogContent className="max-w-md border-white/10 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-5 text-lime-300" /> Edit community
            </DialogTitle>
            <DialogDescription>
              Change the community name and default messaging mode. Changes are logged in the
              audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Community name"
              className="border-white/10 bg-black/20"
            />
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "everyone", label: "Everyone can message" },
                  { key: "tutors_only", label: "Tutors only" },
                ] as const
              ).map((s) => (
                <Button
                  key={s.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "border-white/10",
                    editMode === s.key ? "border-lime-400/40 text-lime-300" : "text-muted-foreground",
                  )}
                  onClick={() => setEditMode(s.key)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cohort label</label>
                <Input
                  value={editCohort}
                  onChange={(e) => setEditCohort(e.target.value)}
                  placeholder="e.g. Cohort B"
                  className="border-white/10 bg-black/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Student limit (0 = unlimited)</label>
                <Input
                  type="number"
                  min={0}
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(e.target.value)}
                  className="border-white/10 bg-black/20"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <Input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="What this community/cohort is about"
                  className="border-white/10 bg-black/20"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Community rules</label>
                <Textarea
                  value={editRules}
                  onChange={(e) => setEditRules(e.target.value)}
                  rows={3}
                  placeholder="e.g. Be respectful, stay on topic"
                  className="border-white/10 bg-black/20"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Community image URL</label>
                <Input
                  value={editImage}
                  onChange={(e) => setEditImage(e.target.value)}
                  placeholder="https://…"
                  className="border-white/10 bg-black/20"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy} className="border-white/10">
              Cancel
            </Button>
            <Button
              className="gap-2 bg-lime-400 text-black hover:bg-lime-300"
              disabled={!editName.trim() || busy}
              onClick={() => {
                const capacity = editCapacity.trim() ? Number(editCapacity) : 0;
                if (editCapacity.trim() && (!Number.isInteger(capacity) || capacity < 0)) {
                  toast.error("Enter a valid student limit (0 = unlimited).");
                  return;
                }
                setEditOpen(false);
                void run(
                  () =>
                    editCommunity({
                      token,
                      communityId,
                      name: editName.trim(),
                      messageMode: editMode,
                      cohortLabel: editCohort.trim() || undefined,
                      description: editDescription.trim() || undefined,
                      rules: editRules.trim() || undefined,
                      image: editImage.trim() || undefined,
                      studentCapacity: capacity > 0 ? capacity : undefined,
                    }),
                  "Community updated",
                );
              }}
            >
              <Pencil className="size-4" /> Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move student to another cohort */}
      <Dialog open={!!moveTarget} onOpenChange={(o) => !o && setMoveTarget(null)}>
        <DialogContent className="max-w-md border-white/10 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-5 text-lime-300" /> Move {moveTarget?.name ?? "student"}
            </DialogTitle>
            <DialogDescription>
              Move this student to another cohort of the same course. Their ForgeX account, email
              and course progress are completely unchanged — only their community membership moves.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {detail && detail.cohorts.length === 0 ? (
              <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-muted-foreground">
                No other cohorts exist yet — create one with the "New cohort" button above, then move
                students into it.
              </p>
            ) : (
              (detail?.cohorts ?? []).map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => setMoveTargetId(c._id)}
                  disabled={c.capacity.state !== "open"}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                    moveTargetId === c._id
                      ? "border-lime-400/40 bg-lime-400/10 text-lime-200"
                      : c.capacity.state !== "open"
                        ? "cursor-not-allowed border-white/10 bg-black/20 opacity-50"
                        : "border-white/10 bg-black/20 text-foreground hover:border-lime-400/40"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.capacity.state === "closed"
                      ? "🔒 closed"
                      : c.capacity.state === "full"
                        ? "🔴 full"
                        : c.capacity.capacity === null
                          ? "unlimited"
                          : `${c.capacity.spaces} spaces`}
                  </span>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTarget(null)} disabled={moveBusy} className="border-white/10">
              Cancel
            </Button>
            <Button
              onClick={() => void confirmMove()}
              disabled={!moveTargetId || moveBusy}
              className="gap-2 bg-lime-400 text-black hover:bg-lime-300"
            >
              {moveBusy ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
              Move student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create new cohort dialog */}
      <Dialog open={cohortOpen} onOpenChange={(o) => !o && setCohortOpen(false)}>
        <DialogContent className="max-w-md border-white/10 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-lime-300" /> New cohort
            </DialogTitle>
            <DialogDescription>
              Create a separate community for the same course (e.g. "NUD 417 — Cohort B") with its own
              members, messages and settings. Students can then be moved into it from the members tab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Cohort name *</label>
              <Input
                value={cohortName}
                onChange={(e) => setCohortName(e.target.value)}
                placeholder={`${detail?.course?.title ?? "Course"} — Cohort B`}
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Student limit (optional, 0 = unlimited)</label>
              <Input
                type="number"
                min={0}
                value={cohortCapacity}
                onChange={(e) => setCohortCapacity(e.target.value)}
                placeholder="e.g. 50"
                className="border-white/10 bg-black/20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCohortOpen(false)} disabled={cohortBusy} className="border-white/10">
              Cancel
            </Button>
            <Button
              onClick={() => void saveCohort()}
              disabled={cohortBusy || !cohortName.trim()}
              className="gap-2 bg-lime-400 text-black hover:bg-lime-300"
            >
              {cohortBusy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create cohort
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete community confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(o) => !o && setDeleteOpen(false)}
        title={`Delete ${detail?.community.name ?? "this community"}?`}
        description="This permanently removes the community, every member record and every message. The course itself and student enrollments are NOT affected. This cannot be undone."
        confirmLabel="Delete community"
        busy={busy}
        onConfirm={() => {
          setDeleteOpen(false);
          void run(
            () => deleteCommunity({ token, communityId }),
            "Community deleted",
          ).then(() => navigate("/admin/communication"));
        }}
      />

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

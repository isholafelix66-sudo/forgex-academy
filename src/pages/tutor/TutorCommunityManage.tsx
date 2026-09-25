import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Archive,
  ArrowLeft,
  BookOpen,
  Check,
  Flag,
  Loader2,
  Lock,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings2,
  ShieldAlert,
  Trash2,
  Unlock,
  UserMinus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Avatar } from "@/components/site/Avatar";
import { ChatComposer, type ComposerMember } from "@/components/chat/ChatComposer";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

type Tab = "overview" | "students" | "cohorts" | "messages";

const STATUS_STYLE: Record<string, string> = {
  active: "border-lime-400/25 bg-lime-400/10 text-lime-300",
  locked: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  archived: "border-white/15 bg-white/5 text-muted-foreground",
};

export default function TutorCommunityManage() {
  const { id } = useParams<{ id: string }>();
  const communityId = id as Id<"courseCommunities">;
  const { user } = useAuth();
  const myUserId = user?._id ?? "";

  const detail = useQuery(api.community.tutorCommunityDetail, { communityId });
  const members = useQuery(api.community.communityMembers, { communityId });
  const thread = useQuery(api.community.communityMessages, { communityId });
  const sync = useMutation(api.community.syncMyCommunities);

  const setStatus = useMutation(api.community.tutorSetCommunityStatus);
  const setMode = useMutation(api.community.tutorSetCommunityMessageMode);
  const setCapacity = useMutation(api.community.tutorSetCommunityCapacity);
  const setEnrollment = useMutation(api.community.tutorSetCommunityEnrollment);
  const createCohort = useMutation(api.community.tutorCreateCohort);
  const removeMember = useMutation(api.community.tutorRemoveCommunityMember);
  const setMemberStatus = useMutation(api.community.tutorSetCommunityMemberStatus);
  const moveStudent = useMutation(api.community.tutorMoveStudentToCohort);
  const updateCommunity = useMutation(api.community.tutorUpdateCommunity);
  const archiveCommunity = useMutation(api.community.tutorArchiveCommunity);
  const sendMsg = useMutation(api.community.sendCommunityMessage);
  const setPin = useMutation(api.community.setPinnedCommunityMessage);
  const deleteMsg = useMutation(api.community.deleteCommunityMessage);

  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState<string | null>(null);
  const [capacityInput, setCapacityInput] = useState("");
  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCohort, setEditCohort] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRules, setEditRules] = useState("");
  const [cohortOpen, setCohortOpen] = useState(false);
  const [cohortName, setCohortName] = useState("");
  const [cohortLabel, setCohortLabel] = useState("");
  const [cohortCapacity, setCohortCapacity] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ userId: string; name: string } | null>(null);
  const [moveTo, setMoveTo] = useState<string>("");
  const [announcement, setAnnouncement] = useState(false);

  // Ensure the tutor is a member of this cohort so chat reads/writes work
  // even when they deep-linked straight into the management page.
  useEffect(() => {
    if (user?._id) void sync().catch(() => undefined);
  }, [user?._id, sync]);

  // Keep the edit dialog in sync when the detail loads.
  useEffect(() => {
    const c = detail?.community;
    if (c && !editOpen) {
      setEditName(c.name);
      setEditCohort(c.cohortLabel ?? "");
      setEditDescription(c.description ?? "");
      setEditRules(c.rules ?? "");
      setCapacityInput(c.studentCapacity ? String(c.studentCapacity) : "");
    }
  }, [detail?.community, editOpen]);

  const composerMembers: ComposerMember[] = useMemo(
    () =>
      (members ?? [])
        .filter((m) => m.status === "active" && m.userId !== myUserId)
        .map((m) => ({ userId: m.userId, name: m.name, image: m.image })),
    [members, myUserId],
  );

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = detail?.students ?? [];
    if (!q) return rows;
    return rows.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q),
    );
  }, [detail?.students, search]);

  const run = async (key: string, fn: () => Promise<unknown>, success?: string) => {
    setBusy(key);
    try {
      await fn();
      if (success) toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  if (detail === undefined) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading community…
      </div>
    );
  }

  // No staff access — not a community of a course this tutor teaches.
  if (detail === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Community not found" description="You can only manage communities of courses you teach." />
        <EmptyState
          icon={<ShieldAlert className="size-6" />}
          title="No access to this community"
          description="This community doesn't exist, or it belongs to a course you don't teach. Communities are scoped to the tutor assigned to the course."
          action={
            <Link
              to="/academy/tutor/communities"
              className="inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-300"
            >
              <ArrowLeft className="size-4" /> Back to Course Communities
            </Link>
          }
        />
      </div>
    );
  }

  // After the guards above, detail is non-null — safe to read these now.
  const community = detail.community;
  const course = detail.course;
  const stats = detail.stats;

  const isArchived = community.status === "archived";
  const isLocked = community.status === "locked";

  const saveCapacity = () => {
    const n = capacityInput.trim() === "" ? 0 : Number(capacityInput);
    if (!Number.isInteger(n) || n < 0 || n > 100_000) {
      toast.error("Enter a valid student limit (0 = unlimited).");
      return;
    }
    void run("capacity", () => setCapacity({ communityId, capacity: n }), "Student limit updated.");
  };

  const saveEdit = () => {
    void run(
      "edit",
      () =>
        updateCommunity({
          communityId,
          name: editName,
          cohortLabel: editCohort,
          description: editDescription,
          rules: editRules,
        }),
      "Community settings saved.",
    ).then(() => setEditOpen(false));
  };

  const createCohortSubmit = () => {
    const n = cohortCapacity.trim() === "" ? undefined : Number(cohortCapacity);
    if (n !== undefined && (!Number.isInteger(n) || n < 0 || n > 100_000)) {
      toast.error("Enter a valid student limit (0 = unlimited).");
      return;
    }
    void run(
      "create-cohort",
      () =>
        createCohort({
          communityId,
          name: cohortName.trim(),
          cohortLabel: cohortLabel.trim() || undefined,
          studentCapacity: n && n > 0 ? n : undefined,
          messageMode: "everyone",
        }),
      "Cohort created.",
    ).then(() => {
      setCohortOpen(false);
      setCohortName("");
      setCohortLabel("");
      setCohortCapacity("");
    });
  };

  const sendMessage = async (payload: { body: string; mentionIds?: string[]; mentionEveryone?: boolean }) => {
    await sendMsg({
      communityId,
      body: payload.body,
      kind: "text",
      mentionIds: payload.mentionIds as Id<"users">[] | undefined,
      mentionEveryone: payload.mentionEveryone,
      isAnnouncement: announcement,
    });
  };

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/academy/tutor/communities"
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
        >
          <ArrowLeft className="size-4" /> Course Communities
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="font-display truncate text-xl font-bold sm:text-2xl">{community.name}</h2>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <BookOpen className="size-3.5" /> {course?.title ?? "Course community"}
            {community.cohortLabel && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-semibold">
                Cohort · {community.cohortLabel}
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-white/10"
          onClick={() => setEditOpen(true)}
        >
          <Settings2 className="size-3.5" /> Edit community
        </Button>
        {detail.cohorts.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-rose-400/30 text-rose-300 hover:bg-rose-400/10"
            onClick={() => setConfirmArchive(true)}
          >
            <Archive className="size-3.5" /> Archive cohort
          </Button>
        )}
      </div>

      {/* Community controls */}
      <section className="rounded-2xl border border-white/10 bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  STATUS_STYLE[community.status] ?? "",
                )}
              >
                {isLocked && <Lock className="size-3" />}
                {isArchived ? "Archived · read-only" : community.status}
              </span>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  community.messageMode === "tutors_only"
                    ? "border-lime-400/25 bg-lime-400/10 text-lime-300"
                    : "border-white/10 bg-white/5 text-muted-foreground",
                )}
              >
                {community.messageMode === "tutors_only" ? "Tutors only" : "Everyone can message"}
              </span>
              {detail.capacity.capacity !== null && (
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    detail.capacity.state === "closed"
                      ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
                      : detail.capacity.state === "full"
                        ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
                        : "border-lime-400/25 bg-lime-400/10 text-lime-300",
                  )}
                >
                  {detail.capacity.studentCount}/{detail.capacity.capacity} students
                  {detail.capacity.state === "full" && " · 🔒 full"}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {detail.capacity.capacity === null
                ? "No student limit — unlimited enrollment."
                : detail.capacity.state === "closed"
                  ? "Enrollment is manually closed."
                  : detail.capacity.state === "full"
                    ? "At capacity — create a new cohort and move students into it."
                    : `${detail.capacity.spaces} space${detail.capacity.spaces === 1 ? "" : "s"} available.`}
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
                onClick={saveCapacity}
                disabled={busy === "capacity" || isArchived}
              >
                {busy === "capacity" ? <Loader2 className="size-3.5 animate-spin" /> : <Users className="size-3.5" />}
                Set limit
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-white/10"
              onClick={() =>
                void run(
                  "enrollment",
                  () => setEnrollment({ communityId, closed: !detail.capacity.closed }),
                  detail.capacity.closed ? "Enrollment reopened." : "Enrollment closed.",
                )
              }
              disabled={busy === "enrollment" || isArchived}
            >
              {busy === "enrollment" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : detail.capacity.closed ? (
                <Unlock className="size-3.5 text-lime-300" />
              ) : (
                <Lock className="size-3.5 text-amber-300" />
              )}
              {detail.capacity.closed ? "Reopen" : "Close enrollment"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-white/10"
              onClick={() =>
                void run(
                  "status",
                  () => setStatus({ communityId, status: isLocked ? "active" : "locked" }),
                  isLocked ? "Community unlocked." : "Community locked — students can no longer post.",
                )
              }
              disabled={busy === "status" || isArchived}
            >
              {busy === "status" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : isLocked ? (
                <Unlock className="size-3.5 text-lime-300" />
              ) : (
                <Lock className="size-3.5 text-amber-300" />
              )}
              {isLocked ? "Unlock" : "Lock"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-white/10"
              onClick={() =>
                void run(
                  "mode",
                  () =>
                    setMode({
                      communityId,
                      mode: community.messageMode === "tutors_only" ? "everyone" : "tutors_only",
                    }),
                  community.messageMode === "tutors_only"
                    ? "Everyone can message now."
                    : "Tutors-only mode on — students can read but not post.",
                )
              }
              disabled={busy === "mode" || isArchived}
            >
              {busy === "mode" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : community.messageMode === "tutors_only" ? (
                <MessageCircle className="size-3.5 text-lime-300" />
              ) : (
                <MessageSquare className="size-3.5 text-amber-300" />
              )}
              {community.messageMode === "tutors_only" ? "Everyone can message" : "Tutors only"}
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={<Users className="size-4" />} label="Students" value={String(stats?.studentCount ?? 0)} />
        <StatTile icon={<MessageSquare className="size-4" />} label="Messages" value={String(stats?.messageCount ?? 0)} />
        <StatTile icon={<Pin className="size-4" />} label="Pinned" value={String(stats?.pinnedCount ?? 0)} />
        <StatTile icon={<Megaphone className="size-4" />} label="Announcements" value={String(stats?.announcementCount ?? 0)} />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: "overview", label: "Overview", icon: <BookOpen className="size-4" /> },
            { key: "students", label: "Students", icon: <Users className="size-4" /> },
            { key: "cohorts", label: "Cohorts", icon: <Flag className="size-4" /> },
            { key: "messages", label: "Messages", icon: <MessageSquare className="size-4" /> },
          ] as { key: Tab; label: string; icon: ReactNode }[]
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
            {t.key === "students" && (detail.students.length > 0 && (
              <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] font-bold">{detail.students.length}</span>
            ))}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-2xl border border-white/10 bg-card">
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="font-display text-sm font-semibold">Recent activity</h3>
            </div>
            {detail.activity.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No messages yet — post the first announcement to get the conversation started.
              </p>
            ) : (
              <div className="divide-y divide-white/5">
                {detail.activity.map((a) => (
                  <div key={a._id} className="flex items-start gap-3 px-5 py-3.5">
                    <span
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                        a.isAnnouncement ? "bg-lime-400/15 text-lime-300" : "bg-white/5 text-muted-foreground",
                      )}
                    >
                      {a.isAnnouncement ? <Megaphone className="size-3.5" /> : <MessageSquare className="size-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        <span className="font-semibold">{a.senderName}</span>
                        {a.isAnnouncement && (
                          <span className="ml-2 rounded-full bg-lime-400/12 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-lime-300">
                            Announcement
                          </span>
                        )}
                        {a.pinned && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300">
                            <Pin className="size-2.5" /> Pinned
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{a.body}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-card">
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="font-display text-sm font-semibold">Cohorts of {course?.title ?? "this course"}</h3>
            </div>
            <div className="space-y-2 p-4">
              <Link
                to={`/tutor/communities/${community._id}`}
                className="flex items-center gap-2 rounded-xl border border-lime-400/25 bg-lime-400/8 px-3 py-2.5 text-sm font-medium text-lime-300"
              >
                <Flag className="size-3.5" />
                <span className="min-w-0 flex-1 truncate">{community.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {detail.capacity.studentCount}/{detail.capacity.capacity ?? "∞"}
                </span>
              </Link>
              {detail.cohorts.map((c) => (
                <Link
                  key={c._id}
                  to={`/tutor/communities/${c._id}`}
                  className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2.5 text-sm transition-colors hover:border-lime-400/40"
                >
                  <Flag className="size-3.5 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {c.capacity.studentCount}/{c.capacity.capacity ?? "∞"}
                  </span>
                </Link>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 border-white/10"
                onClick={() => setCohortOpen(true)}
              >
                <Plus className="size-3.5" /> New cohort
              </Button>
            </div>
          </section>
        </div>
      )}

      {/* Students */}
      {tab === "students" && (
        <section className="rounded-2xl border border-white/10 bg-card">
          <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center">
            <h3 className="font-display flex-1 text-sm font-semibold">
              Students <span className="text-muted-foreground">· {detail.students.length}</span>
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students…"
                className="border-white/10 bg-black/20 pl-9"
              />
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              {detail.students.length === 0
                ? "No students enrolled in this community yet — they're added automatically when they enroll in the course."
                : "No students match your search."}
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredStudents.map((s) => (
                <div key={s.membershipId} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={s.name} image={s.image} className="size-9 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 truncate text-sm font-semibold">
                        {s.name}
                        {s.online && (
                          <span className="size-1.5 rounded-full bg-lime-400" title="Online now" />
                        )}
                        {s.status !== "active" && (
                          <span
                            className={cn(
                              "rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                              s.status === "restricted"
                                ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
                                : "border-rose-400/25 bg-rose-400/10 text-rose-300",
                            )}
                          >
                            {s.status}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.email ?? "No email"} · joined {timeAgo(s.joinedAt)}
                      </p>
                    </div>
                    <div className="w-28 shrink-0">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Progress</span>
                        <span className="font-semibold text-lime-300">{s.progress}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8">
                        <div className="h-full rounded-full bg-lime-400" style={{ width: `${s.progress}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 lg:shrink-0">
                    {detail.cohorts.length > 0 && s.status === "active" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-white/10"
                        disabled={busy !== null}
                        onClick={() => {
                          setMoveTarget({ userId: s.userId, name: s.name });
                          setMoveTo("");
                        }}
                      >
                        <Flag className="size-3.5" /> Move
                      </Button>
                    )}
                    {s.status === "restricted" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-lime-400/30 text-lime-300 hover:bg-lime-400/10"
                        disabled={busy !== null}
                        onClick={() =>
                          void run(
                            `restrict-${s.userId}`,
                            () => setMemberStatus({ communityId, userId: s.userId, restricted: false }),
                            `${s.name} can post again.`,
                          )
                        }
                      >
                        <Unlock className="size-3.5" /> Restore
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-amber-400/30 text-amber-300 hover:bg-amber-400/10"
                        disabled={busy !== null}
                        onClick={() =>
                          void run(
                            `restrict-${s.userId}`,
                            () => setMemberStatus({ communityId, userId: s.userId, restricted: true }),
                            `${s.name} can no longer post.`,
                          )
                        }
                      >
                        <ShieldAlert className="size-3.5" /> Restrict
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-rose-400/30 text-rose-300 hover:bg-rose-400/10"
                      disabled={busy !== null}
                      onClick={() => setConfirmRemove(s.userId)}
                    >
                      <UserMinus className="size-3.5" /> Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Cohorts */}
      {tab === "cohorts" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold">Cohorts of {course?.title ?? "this course"}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Each cohort has separate members, messages and settings. Move students between them as the class grows.
              </p>
            </div>
            <Button className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300" onClick={() => setCohortOpen(true)}>
              <Plus className="size-4" /> New cohort
            </Button>
          </div>

          {detail.cohorts.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-card p-8 text-center">
              <EmptyState
                icon={<Flag className="size-6" />}
                title="This is the only cohort"
                description="When a community gets crowded, create another cohort and move students into it — the course stays the same, the conversations stay separate."
              />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {detail.cohorts.map((c) => (
                <div key={c._id} className="flex flex-col rounded-2xl border border-white/10 bg-card p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-display truncate text-sm font-bold">{c.name}</h4>
                      {c.cohortLabel && (
                        <span className="mt-1 inline-block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {c.cohortLabel}
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        STATUS_STYLE[c.status] ?? "",
                      )}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    <span className="font-semibold tabular-nums text-foreground">
                      {c.capacity.studentCount}/{c.capacity.capacity ?? "∞"}
                    </span>{" "}
                    students
                    {c.capacity.capacity !== null && (
                      <span className="ml-1">
                        · {c.capacity.state === "closed" ? "enrollment closed" : c.capacity.state === "full" ? "full" : `${c.capacity.spaces} space${c.capacity.spaces === 1 ? "" : "s"} left`}
                      </span>
                    )}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-white/10"
                      disabled={busy !== null || c.status === "archived"}
                      onClick={() =>
                        void run(
                          `enroll-${c._id}`,
                          () => setEnrollment({ communityId: c._id, closed: !c.capacity.closed }),
                          c.capacity.closed ? `${c.name} enrollment reopened.` : `${c.name} enrollment closed.`,
                        )
                      }
                    >
                      {c.capacity.closed ? <Unlock className="size-3.5 text-lime-300" /> : <Lock className="size-3.5 text-amber-300" />}
                      {c.capacity.closed ? "Reopen" : "Close enrollment"}
                    </Button>
                    {detail.students.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-white/10"
                        disabled={busy !== null}
                        onClick={() => {
                          setMoveTarget({ userId: "", name: `into ${c.name}` });
                          setMoveTo(c._id);
                        }}
                      >
                        <Users className="size-3.5" /> Move students here
                      </Button>
                    )}
                    <Link
                      to={`/tutor/communities/${c._id}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
                    >
                      <Settings2 className="size-3.5" /> Manage
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Messages */}
      {tab === "messages" && (
        <section className="flex h-[70vh] flex-col rounded-2xl border border-white/10 bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-4 py-3">
            <MessageSquare className="size-4 text-lime-300" />
            <h3 className="font-display text-sm font-semibold">Community messages</h3>
            {isLocked && (
              <span className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                <Lock className="size-3" /> Locked — students can't post
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Megaphone className="size-3.5 text-lime-300" /> Toggle below sends announcements
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {(thread?.messages ?? []).length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No messages yet — write the first one, or post an announcement to reach everyone.
              </p>
            ) : (
              (thread?.messages ?? []).map((m) => (
                <MessageRow
                  key={m._id}
                  message={m}
                  canDelete={m.mine || m.sender?.communityRole === "student"}
                  onPin={() => void run(`pin-${m._id}`, () => setPin({ messageId: m._id, pinned: !m.pinned }))}
                  onDelete={() =>
                    void run(
                      `del-${m._id}`,
                      () => deleteMsg({ messageId: m._id }),
                      "Message deleted.",
                    )
                  }
                  pinBusy={busy === `pin-${m._id}`}
                  delBusy={busy === `del-${m._id}`}
                />
              ))
            )}
          </div>

          <div className="border-t border-white/8 bg-black/20 p-3">
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAnnouncement((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
                  announcement
                    ? "border-lime-400/40 bg-lime-400/12 text-lime-300"
                    : "border-white/10 text-muted-foreground hover:text-foreground",
                )}
              >
                <Megaphone className="size-3" /> Announcement
              </button>
              {announcement && (
                <p className="text-[11px] text-muted-foreground">
                  Posts as an official announcement — students see it highlighted.
                </p>
              )}
            </div>
            <ChatComposer
              onSend={sendMessage}
              members={composerMembers}
              canMentionEveryone
              placeholder="Message the community… (or @mention students)"
              disabled={isArchived}
            />
          </div>
        </section>
      )}

      {/* Edit community dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => !o && setEditOpen(false)}>
        <DialogContent className="max-w-lg border-white/10 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="size-5 text-lime-300" /> Edit community
            </DialogTitle>
            <DialogDescription>Rename this community/cohort and update its description and rules.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Community name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="border-white/10 bg-black/20" />
            </div>
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
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Community rules</label>
              <Textarea
                value={editRules}
                onChange={(e) => setEditRules(e.target.value)}
                rows={2}
                className="border-white/10 bg-black/20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy === "edit"} className="border-white/10">
              Cancel
            </Button>
            <Button
              onClick={() => void saveEdit()}
              disabled={busy === "edit" || !editName.trim()}
              className="gap-2 bg-lime-400 text-black hover:bg-lime-300"
            >
              {busy === "edit" ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New cohort dialog */}
      <Dialog open={cohortOpen} onOpenChange={(o) => !o && setCohortOpen(false)}>
        <DialogContent className="max-w-lg border-white/10 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-lime-300" /> New cohort for {course?.title ?? "this course"}
            </DialogTitle>
            <DialogDescription>
              Creates a separate community with its own members, messages and settings. The course stays the same.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Cohort name</label>
              <Input
                value={cohortName}
                onChange={(e) => setCohortName(e.target.value)}
                placeholder={`${course?.title ?? "Course"} — Cohort B`}
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Cohort label</label>
                <Input
                  value={cohortLabel}
                  onChange={(e) => setCohortLabel(e.target.value)}
                  placeholder="e.g. Cohort B"
                  className="border-white/10 bg-black/20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Student limit (0 = unlimited)</label>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCohortOpen(false)} disabled={busy === "create-cohort"} className="border-white/10">
              Cancel
            </Button>
            <Button
              onClick={() => void createCohortSubmit()}
              disabled={busy === "create-cohort" || !cohortName.trim()}
              className="gap-2 bg-lime-400 text-black hover:bg-lime-300"
            >
              {busy === "create-cohort" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create cohort
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move student dialog */}
      <Dialog open={moveTarget !== null} onOpenChange={(o) => !o && setMoveTarget(null)}>
        <DialogContent className="max-w-md border-white/10 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="size-5 text-lime-300" /> Move to another cohort
            </DialogTitle>
            <DialogDescription>
              {moveTarget?.userId
                ? `Move ${moveTarget.name} to another cohort of ${course?.title ?? "this course"}.`
                : "Choose a student to move into this cohort."}
            </DialogDescription>
          </DialogHeader>
          {moveTarget?.userId ? (
            <Select value={moveTo || undefined} onValueChange={setMoveTo}>
              <SelectTrigger className="border-white/10 bg-black/20">
                <SelectValue placeholder="Choose a cohort…" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-card">
                {detail.cohorts.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                    {c.capacity.capacity !== null ? ` (${c.capacity.studentCount}/${c.capacity.capacity})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-1.5">
              {detail.students
                .filter((s) => s.status === "active")
                .map((s) => (
                  <button
                    key={s.membershipId}
                    type="button"
                    onClick={() => {
                      setMoveTarget({ userId: s.userId, name: s.name });
                      setMoveTo(moveTarget?.name ? moveTo : "");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                  >
                    <Avatar name={s.name} image={s.image} className="size-7 text-xs" />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{s.progress}%</span>
                  </button>
                ))}
              {detail.students.filter((s) => s.status === "active").length === 0 && (
                <p className="p-4 text-center text-xs text-muted-foreground">No active students to move.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTarget(null)} disabled={busy === "move"} className="border-white/10">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!moveTarget?.userId || !moveTo) return;
                void run(
                  "move",
                  () => moveStudent({ fromCommunityId: communityId, toCommunityId: moveTo as Id<"courseCommunities">, userId: moveTarget.userId as Id<"users"> }),
                  `${moveTarget.name} moved to the new cohort.`,
                ).then(() => setMoveTarget(null));
              }}
              disabled={busy === "move" || !moveTarget?.userId || !moveTo}
              className="gap-2 bg-lime-400 text-black hover:bg-lime-300"
            >
              {busy === "move" ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
              Move student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive confirmation */}
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive this cohort?"
        description="Archiving makes the community read-only — students can still read messages, but nobody can post. You can manage it again from the admin dashboard."
        confirmLabel="Archive cohort"
        onConfirm={() =>
          void run("archive", () => archiveCommunity({ communityId }), "Cohort archived.").then(() =>
            setConfirmArchive(false),
          )
        }
      />

      {/* Remove student confirmation */}
      <ConfirmDialog
        open={confirmRemove !== null}
        onOpenChange={(o) => !o && setConfirmRemove(null)}
        title="Remove this student?"
        description="The student is removed from this community only — their course enrollment is never touched, and they can be re-added later."
        confirmLabel="Remove student"
        onConfirm={() => {
          if (!confirmRemove) return;
          const s = detail.students.find((x) => x.userId === confirmRemove);
          void run(
            `remove-${confirmRemove}`,
            () => removeMember({ communityId, userId: confirmRemove as Id<"users"> }),
            s ? `${s.name} removed from the community.` : "Student removed.",
          ).then(() => setConfirmRemove(null));
        }}
      />
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="flex size-7 items-center justify-center rounded-lg bg-white/5">{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="font-display mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function MessageRow({
  message,
  canDelete,
  onPin,
  onDelete,
  pinBusy,
  delBusy,
}: {
  message: {
    _id: string;
    body: string;
    kind?: string | null;
    isAnnouncement?: boolean;
    pinned?: boolean;
    deleted?: boolean;
    createdAt: number;
    sender: { name: string; image: string | null; communityRole?: string | null };
  };
  canDelete: boolean;
  onPin: () => void;
  onDelete: () => void;
  pinBusy: boolean;
  delBusy: boolean;
}) {
  return (
    <div className={cn("flex items-start gap-2.5", message.isAnnouncement && "rounded-2xl border border-lime-400/20 bg-lime-400/5 p-2")}>
      <Avatar name={message.sender.name} image={message.sender.image} className="mt-0.5 size-7 shrink-0 text-xs" />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "rounded-2xl rounded-tl-sm border px-3.5 py-2 text-sm",
            message.isAnnouncement
              ? "border-lime-400/25 bg-lime-400/10"
              : message.sender.communityRole === "tutor" || message.sender.communityRole === "admin"
                ? "border-white/10 bg-black/30"
                : "border-white/10 bg-black/20",
          )}
        >
          <p className="text-[10px] font-semibold text-lime-300">
            {message.sender.name}
            {message.isAnnouncement && (
              <span className="ml-1.5 rounded bg-lime-400/15 px-1 py-px text-[9px] font-bold uppercase tracking-wide">
                📢 Announcement
              </span>
            )}
          </p>
          {message.deleted ? (
            <p className="mt-1 italic text-muted-foreground">This message was deleted.</p>
          ) : message.kind === "image" || message.kind === "file" || message.kind === "voice" ? (
            <p className="mt-1 text-muted-foreground">
              {message.kind === "voice" ? "🎤 Voice message" : message.kind === "image" ? "📷 Photo" : "📎 File"}
            </p>
          ) : (
            message.body && <p className="mt-1 whitespace-pre-line">{message.body}</p>
          )}
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(message.createdAt)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onPin}
          disabled={pinBusy}
          className={cn(
            "flex size-7 items-center justify-center rounded-lg border transition-colors",
            message.pinned
              ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
              : "border-white/10 text-muted-foreground hover:text-amber-300",
          )}
          title={message.pinned ? "Unpin" : "Pin"}
        >
          {pinBusy ? <Loader2 className="size-3.5 animate-spin" /> : message.pinned ? <Pin className="size-3.5" /> : <PinOff className="size-3.5" />}
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={delBusy}
            className="flex size-7 items-center justify-center rounded-lg border border-white/10 text-muted-foreground transition-colors hover:border-rose-400/30 hover:text-rose-300"
            title="Delete message"
          >
            {delBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import {
  ArrowLeft,
  BarChart3,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  FileText,
  FolderOpen,
  Loader2,
  Lock,
  Megaphone,
  MessageSquareWarning,
  Mic,
  Pin,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useAuth } from "@/hooks/use-auth";
import { Avatar } from "@/components/site/Avatar";
import {
  ChatComposer,
  type ComposerMember,
  type ComposerPayload,
} from "@/components/chat/ChatComposer";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  MessageThread,
  ReportDialog,
  type PollView,
  type ThreadMessage,
  type ThreadMember,
} from "@/components/community/MessageThread";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  moderator: "Moderator",
  tutor: "Tutor",
  student: "Student",
};

type PanelId = "search" | "pinned" | "resources" | "saved" | "discussions" | null;

type ResourceItem = {
  _id: string;
  kind: "image" | "file" | "voice";
  url: string;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  duration: number | null;
  senderName: string;
  createdAt: number;
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
  const setPin = useMutation(api.community.setPinnedCommunityMessage);
  const setAnswer = useMutation(api.community.setTutorAnswer);
  const setDiscussion = useMutation(api.community.setDiscussion);
  const createPoll = useMutation(api.community.createCommunityPoll);
  const votePoll = useMutation(api.community.voteCommunityPoll);
  const closePoll = useMutation(api.community.closeCommunityPoll);
  const saveMsg = useMutation(api.community.saveCommunityMessage);
  const unsaveMsg = useMutation(api.community.unsaveCommunityMessage);
  const setTyping = useMutation(api.community.setCommunityTyping);
  const setCapacity = useMutation(api.community.tutorSetCommunityCapacity);
  const setEnrollment = useMutation(api.community.tutorSetCommunityEnrollment);
  const createCohort = useMutation(api.community.tutorCreateCohort);
  const navigate = useNavigate();

  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const thread = useQuery(api.community.communityMessages, { communityId, cursor });
  const pinned = useQuery(api.community.communityPinnedMessages, { communityId });
  const pollsQ = useQuery(api.community.communityPolls, { communityId });
  const discussions = useQuery(api.community.communityDiscussions, { communityId });
  const saved = useQuery(api.community.mySavedCommunityMessages, { communityId });
  const resources = useQuery(api.community.communityResources, { communityId });
  const typingQ = useQuery(api.community.communityTyping, { communityId });

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
  const [capacityOpen, setCapacityOpen] = useState(false);
  const [capacityInput, setCapacityInput] = useState("");
  const [capacityBusy, setCapacityBusy] = useState(false);
  const [cohortOpen, setCohortOpen] = useState(false);
  const [cohortName, setCohortName] = useState("");
  const [cohortCapacity, setCohortCapacity] = useState("");
  const [cohortBusy, setCohortBusy] = useState(false);

  // Upgrade panels + discussion view + jump-to-message.
  const [panel, setPanel] = useState<PanelId>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchKind, setSearchKind] = useState<string>("all");
  const [discussionView, setDiscussionView] = useState<string | null>(null);
  const [focusMessageId, setFocusMessageId] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [announceText, setAnnounceText] = useState("");
  const [announceBusy, setAnnounceBusy] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollForm, setPollForm] = useState({
    question: "",
    options: ["", ""],
    multiple: false,
    anonymous: false,
    closesAt: "",
  });
  const [pollBusy, setPollBusy] = useState(false);

  // Typing indicator — local clock filters stale heartbeat rows.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNowTick(Date.now()), 1500);
    return () => clearInterval(iv);
  }, []);
  const typingUsers = useMemo(
    () =>
      (typingQ ?? []).filter((t) => nowTick - t.typingAt < 4000),
    [typingQ, nowTick],
  );
  const typingLabel = useMemo(() => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0].name} is typing…`;
    if (typingUsers.length === 2)
      return `${typingUsers[0].name} and ${typingUsers[1].name} are typing…`;
    return `${typingUsers.length} people are typing…`;
  }, [typingUsers]);
  const typingSentRef = useRef(0);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markReadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueMarkRead = () => {
    if (markReadTimer.current) clearTimeout(markReadTimer.current);
    markReadTimer.current = setTimeout(() => {
      void markRead({ communityId }).catch(() => undefined);
    }, 900);
  };

  // Ensure membership on first open (enrollment normally adds it already).
  useEffect(() => {
    if (myUserId) void sync().catch(() => undefined);
  }, [myUserId, sync]);

  // Clear typing state when leaving the room.
  useEffect(
    () => () => {
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      if (markReadTimer.current) clearTimeout(markReadTimer.current);
      if (myUserId) void setTyping({ communityId, typing: false }).catch(() => undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myUserId, communityId],
  );

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

  // Jump-to-message: load a window of context around the target, then focus.
  const around = useQuery(
    api.community.messagesAround,
    pendingFocus && !discussionView ? { communityId, messageId: pendingFocus as Id<"communityMessages"> } : "skip",
  );
  useEffect(() => {
    if (!around || !pendingFocus) return;
    setCache((prev) => {
      const next = new Map(prev);
      for (const m of around.messages) {
        next.set(m._id, m as unknown as ThreadMessage);
      }
      return next;
    });
    if (around.targetId) {
      setFocusMessageId(around.targetId);
    }
    setPendingFocus(null);
  }, [around, pendingFocus]);

  const handleJump = (messageId: string) => {
    setPanel(null);
    setDiscussionView(null);
    // Already in the loaded window → scroll straight away.
    if (cache.has(messageId)) {
      setFocusMessageId(messageId);
      return;
    }
    setPendingFocus(messageId);
  };

  // Discussion thread view.
  const discussionMessages = useQuery(
    api.community.discussionMessages,
    discussionView ? { communityId, discussionId: discussionView as Id<"communityMessages"> } : "skip",
  );
  const [discussionCache, setDiscussionCache] = useState<Map<string, ThreadMessage>>(new Map());
  useEffect(() => {
    if (!discussionMessages) return;
    setDiscussionCache((prev) => {
      const next = new Map(prev);
      for (const m of discussionMessages) {
        next.set(m._id, m as unknown as ThreadMessage);
      }
      return next;
    });
  }, [discussionMessages]);
  const discussionThread = useMemo(
    () => [...discussionCache.values()].sort((a, b) => a.createdAt - b.createdAt),
    [discussionCache],
  );

  // Discussion reply counts for the main feed.
  const discussionCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of discussions ?? []) map[d._id] = d.replyCount;
    return map;
  }, [discussions]);

  // Search results (only fetched while the search panel is open).
  const searchResults = useQuery(
    api.community.searchCommunityMessages,
    panel === "search" && searchQ.trim().length >= 1 ? { communityId, q: searchQ } : "skip",
  );
  const filteredResults = useMemo(() => {
    const rows = searchResults ?? [];
    if (searchKind === "all") return rows;
    if (searchKind === "announcement") return rows.filter((r) => r.isAnnouncement);
    if (searchKind === "text") return rows.filter((r) => !r.kind);
    return rows.filter((r) => r.kind === searchKind);
  }, [searchResults, searchKind]);

  // Saved ids + poll map for the thread.
  const savedIds = useMemo(() => (saved ?? []).map((s) => s._id as string), [saved]);
  const pollMap = useMemo(() => {
    const map: Record<string, PollView> = {};
    for (const p of pollsQ ?? []) map[p.messageId] = p;
    return map;
  }, [pollsQ]);

  const myRole = detail?.membership.role ?? "student";
  const isStaff = myRole === "tutor" || myRole === "admin" || myRole === "moderator";
  const cap = detail?.capacity;

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

  const myLastRead =
    members?.find((m) => m.userId === myUserId)?.lastReadAt ?? 0;

  const loadOlder = () => {
    if (thread?.nextCursor) setCursor(thread.nextCursor);
  };

  const handleSend = async (payload: ComposerPayload, opts?: { isAnnouncement?: boolean }) => {
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
        mentionIds: payload.mentionIds as Id<"users">[] | undefined,
        mentionEveryone: payload.mentionEveryone,
        isAnnouncement: opts?.isAnnouncement,
        discussionId: discussionView
          ? (discussionView as Id<"communityMessages">)
          : undefined,
      });
      setReplyTo(null);
      setAnnounceOpen(false);
      setAnnounceText("");
      queueMarkRead();
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

  const openCapacityDialog = () => {
    setCapacityInput(cap?.capacity ? String(cap.capacity) : "0");
    setCapacityOpen(true);
  };

  const saveCapacity = async () => {
    const n = Number(capacityInput);
    if (!Number.isInteger(n) || n < 0) {
      toast.error("Enter a valid student limit (0 = unlimited).");
      return;
    }
    setCapacityBusy(true);
    try {
      await setCapacity({ communityId, capacity: n });
      toast.success(n > 0 ? `Student limit set to ${n}.` : "Student limit removed — unlimited enrollment.");
      setCapacityOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the student limit.");
    } finally {
      setCapacityBusy(false);
    }
  };

  const toggleEnrollment = async () => {
    setCapacityBusy(true);
    try {
      await setEnrollment({ communityId, closed: !cap?.closed });
      toast.success(cap?.closed ? "Enrollment reopened — new students can join again." : "Enrollment closed — new students can't join this community.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change enrollment.");
    } finally {
      setCapacityBusy(false);
    }
  };

  const saveCohort = async () => {
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
      const id = await createCohort({ communityId, name, studentCapacity: capacity });
      toast.success("Cohort created — students can be moved into it from the admin panel.");
      setCohortOpen(false);
      setCohortName("");
      setCohortCapacity("");
      navigate(`/dashboard/communities/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the cohort.");
    } finally {
      setCohortBusy(false);
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

  // --- upgrade handlers -----------------------------------------------------

  const togglePin = async (messageId: string) => {
    const isPinned = (pinned ?? []).some((p) => p._id === messageId);
    await setPin({ messageId: messageId as Id<"communityMessages">, pinned: !isPinned });
  };

  const toggleSave = async (messageId: string) => {
    const isSaved = savedIds.includes(messageId);
    if (isSaved) {
      await unsaveMsg({ messageId: messageId as Id<"communityMessages"> });
    } else {
      await saveMsg({ messageId: messageId as Id<"communityMessages"> });
    }
  };

  const submitAnnouncement = async () => {
    if (!announceText.trim() || announceBusy) return;
    setAnnounceBusy(true);
    try {
      await handleSend({ body: announceText.trim() }, { isAnnouncement: true });
      toast.success("Announcement posted to the community.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post the announcement.");
    } finally {
      setAnnounceBusy(false);
    }
  };

  const updatePollOption = (i: number, value: string) => {
    setPollForm((f) => {
      const options = [...f.options];
      options[i] = value;
      return { ...f, options };
    });
  };

  const submitPoll = async () => {
    if (pollBusy) return;
    const question = pollForm.question.trim();
    const options = pollForm.options.map((o) => o.trim()).filter(Boolean);
    if (!question) {
      toast.error("Poll needs a question.");
      return;
    }
    if (options.length < 2) {
      toast.error("Add at least two options.");
      return;
    }
    setPollBusy(true);
    try {
      await createPoll({
        communityId,
        question,
        options,
        multiple: pollForm.multiple,
        anonymous: pollForm.anonymous,
        closesAt: pollForm.closesAt ? new Date(pollForm.closesAt).getTime() : undefined,
      });
      toast.success("Poll posted to the community.");
      setPollOpen(false);
      setPollForm({ question: "", options: ["", ""], multiple: false, anonymous: false, closesAt: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the poll.");
    } finally {
      setPollBusy(false);
    }
  };

  const handleBodyChange = (body: string) => {
    const now = Date.now();
    if (!body.trim()) {
      void setTyping({ communityId, typing: false }).catch(() => undefined);
      typingSentRef.current = 0;
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      return;
    }
    // Heartbeat at most every 1.2s while typing; auto-clear 3s after stop.
    if (now - typingSentRef.current > 1200) {
      typingSentRef.current = now;
      void setTyping({ communityId, typing: true }).catch(() => undefined);
    }
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(() => {
      void setTyping({ communityId, typing: false }).catch(() => undefined);
    }, 3000);
  };

  const announcementsInFeed = useMemo(
    () => messages.filter((m) => m.isAnnouncement && !m.deleted),
    [messages],
  );

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

  const activePanel = (id: Exclude<PanelId, null>) => (panel === id ? "bg-lime-400 text-black hover:bg-lime-300" : "border-white/10 text-muted-foreground hover:border-lime-400/40 hover:text-lime-300");

  const panelBtn = (id: Exclude<PanelId, null>, icon: React.ReactNode, label: string, count?: number) => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        if (panel === id) {
          setPanel(null);
        } else {
          setPanel(id);
          setDiscussionView(null);
        }
      }}
      className={cn("gap-1.5 border text-xs", activePanel(id))}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-black/20 px-1.5 text-[10px] font-bold tabular-nums">
          {count}
        </span>
      )}
    </Button>
  );

  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[30rem] flex-col gap-4 overflow-hidden md:h-[calc(100dvh-7.5rem)]">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-card px-4 py-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0 text-muted-foreground">
          <Link to="/academy/dashboard/communities" title="Back to communities">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display truncate text-lg font-bold">{detail.community.name}</h2>
            {statusChip}
            {cap && cap.capacity !== null && cap.state !== "open" && (
              <Badge
                className={cn(
                  "gap-1.5",
                  cap.state === "closed"
                    ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
                    : "border-rose-400/25 bg-rose-400/10 text-rose-300",
                )}
              >
                {cap.state === "closed" ? (
                  <>
                    <Lock className="size-3" /> Enrollment closed
                  </>
                ) : (
                  <>
                    <span className="size-1.5 rounded-full bg-rose-400" /> Community full
                  </>
                )}
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {detail.course?.title ?? "Course community"} · {detail.memberCount} members
            {cap && cap.capacity !== null && ` · ${cap.studentCount}/${cap.capacity} students`}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCohortOpen(true)}
              className="gap-2 border-white/10 text-xs"
              title="Create another cohort for this course"
            >
              <Plus className="size-3.5 text-lime-300" /> Cohort
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openCapacityDialog}
              className="gap-2 border-white/10 text-xs"
              title="Student capacity & cohorts"
            >
              <Users className="size-3.5 text-lime-300" />
              {cap && cap.capacity !== null ? `${cap.studentCount}/${cap.capacity}` : "Capacity"}
            </Button>
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

      {/* Mode banner */}
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-card px-4 py-2 text-xs">
        {tutorsOnly ? (
          <span className="flex items-center gap-1.5 font-semibold text-amber-300">
            <Lock className="size-3.5" /> Tutors only — students can read, staff can post.
          </span>
        ) : (
          <span className="flex items-center gap-1.5 font-semibold text-lime-300">
            <span className="size-2 rounded-full bg-lime-400" /> Everyone can message.
          </span>
        )}
        <span className="ml-auto hidden text-muted-foreground sm:inline">
          {isLocked ? "Locked" : "Active"} · {detail.community.messageMode === "tutors_only" ? "read-only for students" : "open to all members"}
        </span>
      </div>

      {/* Capacity banner — students see the enrollment status of this cohort */}
      {cap && cap.capacity !== null && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl border px-4 py-2 text-xs",
            cap.state === "closed"
              ? "border-amber-400/20 bg-amber-400/8 text-amber-200"
              : cap.state === "full"
                ? "border-rose-400/20 bg-rose-400/8 text-rose-200"
                : "border-lime-400/20 bg-lime-400/8 text-lime-200",
          )}
        >
          {cap.state === "closed" ? (
            <span className="flex items-center gap-1.5 font-semibold">
              <Lock className="size-3.5" /> Enrollment closed — this cohort isn't taking new students.
            </span>
          ) : cap.state === "full" ? (
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="size-1.5 rounded-full bg-rose-400" /> This community is currently full ({cap.studentCount}/{cap.capacity}).
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="size-1.5 rounded-full bg-lime-400" /> {cap.spaces} space{cap.spaces === 1 ? "" : "s"} available · {cap.studentCount}/{cap.capacity} students.
            </span>
          )}
        </div>
      )}

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

      {/* Toolbar — search, pinned, resources, saved, discussions + staff actions */}
      <div className="flex flex-wrap items-center gap-2">
        {panelBtn("search", <Search className="size-3.5" />, "Search")}
        {panelBtn("pinned", <Pin className="size-3.5" />, "Pinned", pinned?.length ?? 0)}
        {panelBtn("resources", <FolderOpen className="size-3.5" />, "Resources", resources?.length ?? 0)}
        {panelBtn("saved", <Bookmark className="size-3.5" />, "Saved", saved?.length ?? 0)}
        {panelBtn("discussions", <MessageSquareWarning className="size-3.5" />, "Discussions", discussions?.length ?? 0)}
        {announcementsInFeed.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleJump(announcementsInFeed[0]._id)}
            className="gap-1.5 border-amber-400/25 text-xs text-amber-300 hover:border-amber-400/40 hover:bg-amber-400/10"
          >
            <Megaphone className="size-3.5" />
            <span className="hidden sm:inline">Announcements</span>
            <span className="rounded-full bg-black/20 px-1.5 text-[10px] font-bold tabular-nums">
              {announcementsInFeed.length}
            </span>
          </Button>
        )}
        {isStaff && !isArchived && (
          <>
            <Button
              size="sm"
              onClick={() => setAnnounceOpen(true)}
              className="gap-1.5 bg-amber-400 text-xs text-black hover:bg-amber-300"
            >
              <Megaphone className="size-3.5" /> Announce
            </Button>
            <Button
              size="sm"
              onClick={() => setPollOpen(true)}
              className="gap-1.5 bg-lime-400 text-xs text-black hover:bg-lime-300"
            >
              <BarChart3 className="size-3.5" /> Poll
            </Button>
          </>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {pollsQ?.filter((p) => !p.closed).length ?? 0} active poll
          {(pollsQ?.filter((p) => !p.closed).length ?? 0) === 1 ? "" : "s"} ·{" "}
          {(discussions ?? []).reduce((s, d) => s + d.replyCount, 0)} discussion replies
        </span>
      </div>

      {/* Active panel */}
      {panel === "search" && (
        <div className="rounded-2xl border border-white/10 bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search messages in this community…"
              autoFocus
              className="max-w-sm border-white/10 bg-black/20"
            />
            <div className="flex flex-wrap gap-1">
              {["all", "text", "image", "file", "voice", "announcement"].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSearchKind(k)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                    searchKind === k
                      ? "border-lime-400/50 bg-lime-400/15 text-lime-300"
                      : "border-white/10 text-muted-foreground hover:border-lime-400/30",
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
            {searchQ.trim().length >= 1 && filteredResults.length === 0 && (
              <p className="py-3 text-center text-xs text-muted-foreground">
                {searchResults === undefined ? "Searching…" : "No messages match."}
              </p>
            )}
            {filteredResults.map((r) => (
              <button
                key={r._id}
                type="button"
                onClick={() => handleJump(r._id)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2 text-left transition-colors hover:border-lime-400/25 hover:bg-lime-400/5"
              >
                <Avatar name={r.sender.name} image={r.sender.image} className="size-8 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold">{r.sender.name}</span>
                    {r.isAnnouncement && <Megaphone className="size-3 shrink-0 text-amber-300" />}
                    {r.isDiscussion && <span className="text-[10px] text-lime-300">📚</span>}
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()} {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.kind === "image" ? "📷 Photo" : r.kind === "voice" ? "🎤 Voice message" : r.kind === "file" ? `📎 ${r.fileName ?? "File"}` : r.body.slice(0, 120)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {panel === "pinned" && (
        <div className="rounded-2xl border border-white/10 bg-card p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-lime-300">
            <Pin className="size-3.5" /> Pinned messages
          </p>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {(pinned ?? []).length === 0 && (
              <p className="py-3 text-center text-xs text-muted-foreground">
                Nothing pinned yet — tutors and admins can pin important messages.
              </p>
            )}
            {(pinned ?? []).map((p) => (
              <button
                key={p._id}
                type="button"
                onClick={() => handleJump(p._id)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-lime-400/5"
              >
                <Avatar name={p.sender.name} image={p.sender.image} className="size-7 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{p.sender.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.kind === "image" ? "📷 Photo" : p.kind === "voice" ? "🎤 Voice" : p.kind === "file" ? `📎 ${p.fileName ?? "File"}` : p.body.slice(0, 140)}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {panel === "resources" && <ResourcesPanel resources={resources ?? []} onJump={handleJump} />}

      {panel === "saved" && (
        <div className="rounded-2xl border border-white/10 bg-card p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-lime-300">
            <Bookmark className="size-3.5" /> Saved messages
          </p>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {(saved ?? []).length === 0 && (
              <p className="py-3 text-center text-xs text-muted-foreground">
                Nothing saved yet — bookmark important messages from the message actions.
              </p>
            )}
            {(saved ?? []).map((s) => (
              <div key={s._id} className="group flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-white/5">
                <button
                  type="button"
                  onClick={() => handleJump(s._id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <Avatar name={s.sender.name} image={s.sender.image} className="size-7 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{s.sender.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.kind === "image" ? "📷 Photo" : s.kind === "voice" ? "🎤 Voice" : s.kind === "file" ? `📎 ${s.fileName ?? "File"}` : s.body.slice(0, 140)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    unsaveMsg({ messageId: s._id as Id<"communityMessages"> })
                      .then(() => toast.success("Removed from saved messages"))
                      .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't unsave."))
                  }
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-rose-400/10 hover:text-rose-300"
                  title="Unsave"
                >
                  <BookmarkCheck className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {panel === "discussions" && (
        <div className="rounded-2xl border border-white/10 bg-card p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-lime-300">
            📚 Learning discussions
          </p>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {(discussions ?? []).length === 0 && (
              <p className="py-3 text-center text-xs text-muted-foreground">
                No discussions yet — tutors can turn a question into a focused learning thread.
              </p>
            )}
            {(discussions ?? []).map((d) => (
              <button
                key={d._id}
                type="button"
                onClick={() => {
                  setPanel(null);
                  setDiscussionView(d._id);
                  setDiscussionCache(new Map());
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-lime-400/5"
              >
                <Avatar name={d.sender.name} image={d.sender.image} className="size-7 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">
                    {d.sender.name}
                    {d.tutorAnswer && <span className="ml-1.5 rounded bg-lime-400 px-1 text-[9px] font-bold text-black">✓ ANSWER</span>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{d.body.slice(0, 140)}</span>
                </span>
                <span className="shrink-0 rounded-full border border-lime-400/25 bg-lime-400/10 px-2 py-0.5 text-[10px] font-semibold text-lime-300">
                  💬 {d.replyCount}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-4">
        {/* Messages */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-card">
          {discussionView ? (
            <div className="flex items-center gap-2 border-b border-white/8 bg-lime-400/8 px-3 py-2 text-xs">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDiscussionView(null);
                  setDiscussionCache(new Map());
                }}
                className="gap-1.5 text-muted-foreground hover:text-lime-300"
              >
                <ChevronLeft className="size-3.5" /> Back to community
              </Button>
              <span className="font-semibold text-lime-300">📚 Discussion</span>
              <span className="truncate text-muted-foreground">
                {discussionThread[0]?.body.slice(0, 90) ?? "Loading…"}
              </span>
            </div>
          ) : null}

          {!discussionView && !canPost && detail.membership.status !== "removed" && (
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

          {discussionView ? (
            <MessageThread
              messages={discussionThread}
              myUserId={myUserId}
              viewerRole={viewerRole}
              loading={discussionMessages === undefined}
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
              members={(members ?? []) as ThreadMember[]}
              savedIds={savedIds}
              onSaveMessage={(mid) => toggleSave(mid)}
              onTogglePin={isStaff ? (mid) => togglePin(mid) : undefined}
              onSetTutorAnswer={isStaff ? (mid, on) => setAnswer({ messageId: mid as Id<"communityMessages">, on }) : undefined}
              onToggleDiscussion={isStaff ? (mid, on) => setDiscussion({ messageId: mid as Id<"communityMessages">, on }) : undefined}
              onReachedBottom={queueMarkRead}
            />
          ) : (
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
              members={(members ?? []) as ThreadMember[]}
              polls={pollMap}
              onVotePoll={
                canPost
                  ? (pollId, idxs) => votePoll({ pollId: pollId as Id<"communityPolls">, optionIndexes: idxs })
                  : undefined
              }
              onClosePoll={isStaff ? (pollId) => closePoll({ pollId: pollId as Id<"communityPolls"> }) : undefined}
              savedIds={savedIds}
              onSaveMessage={(mid) => toggleSave(mid)}
              onTogglePin={isStaff ? (mid) => togglePin(mid) : undefined}
              onSetTutorAnswer={isStaff ? (mid, on) => setAnswer({ messageId: mid as Id<"communityMessages">, on }) : undefined}
              onToggleDiscussion={isStaff ? (mid, on) => setDiscussion({ messageId: mid as Id<"communityMessages">, on }) : undefined}
              onOpenDiscussion={(rootId) => {
                setPanel(null);
                setDiscussionView(rootId);
                setDiscussionCache(new Map());
              }}
              discussionCounts={discussionCounts}
              lastReadAt={members !== undefined ? myLastRead : undefined}
              focusMessageId={focusMessageId}
              onReachedBottom={queueMarkRead}
            />
          )}

          <div className="border-t border-white/8 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {typingLabel && (
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="flex gap-0.5">
                  <span className="size-1 animate-bounce rounded-full bg-lime-400 [animation-delay:-0.3s]" />
                  <span className="size-1 animate-bounce rounded-full bg-lime-400 [animation-delay:-0.15s]" />
                  <span className="size-1 animate-bounce rounded-full bg-lime-400" />
                </span>
                {typingLabel}
              </p>
            )}
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
              onSend={(payload) => handleSend(payload)}
              disabled={!canPost || sending}
              members={(members ?? []) as ComposerMember[]}
              canMentionEveryone={isStaff}
              onBodyChange={handleBodyChange}
              placeholder={
                canPost
                  ? discussionView
                    ? "Reply in the discussion…"
                    : replyTo
                      ? `Reply to ${replyTo.sender.name}…`
                      : "Write a message…"
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
                        {m.online ? (
                          <span className="text-lime-300"> · online</span>
                        ) : (
                          <span> · active {m.lastReadAt ? timeAgoLabel(m.lastReadAt) : "recently"}</span>
                        )}
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

      {/* Announcement dialog */}
      <Dialog open={announceOpen} onOpenChange={(o) => !o && setAnnounceOpen(false)}>
        <DialogContent className="max-w-md border-white/10 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="size-5 text-amber-300" /> New announcement
            </DialogTitle>
            <DialogDescription>
              Post an official announcement to the whole community. It appears
              highlighted so nobody misses it.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={announceText}
            onChange={(e) => setAnnounceText(e.target.value)}
            placeholder="Write the announcement…"
            rows={4}
            className="border-white/10 bg-black/20"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnounceOpen(false)} disabled={announceBusy} className="border-white/10">
              Cancel
            </Button>
            <Button
              onClick={() => void submitAnnouncement()}
              disabled={!announceText.trim() || announceBusy || sending}
              className="gap-2 bg-amber-400 text-black hover:bg-amber-300"
            >
              {announceBusy ? <Loader2 className="size-4 animate-spin" /> : <Megaphone className="size-4" />}
              Post announcement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Poll dialog */}
      <Dialog open={pollOpen} onOpenChange={(o) => !o && setPollOpen(false)}>
        <DialogContent className="max-w-md border-white/10 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="size-5 text-lime-300" /> Create a poll
            </DialogTitle>
            <DialogDescription>
              Ask the community a question and collect live results. Students
              vote straight from the chat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={pollForm.question}
              onChange={(e) => setPollForm((f) => ({ ...f, question: e.target.value }))}
              placeholder="Poll question…"
              className="border-white/10 bg-black/20"
            />
            <div className="space-y-2">
              {pollForm.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => updatePollOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="border-white/10 bg-black/20"
                  />
                  {pollForm.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPollForm((f) => ({
                          ...f,
                          options: f.options.filter((_, j) => j !== i),
                        }))
                      }
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-rose-400/10 hover:text-rose-300"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              {pollForm.options.length < 6 && (
                <button
                  type="button"
                  onClick={() => setPollForm((f) => ({ ...f, options: [...f.options, ""] }))}
                  className="text-xs font-medium text-lime-300 hover:underline"
                >
                  + Add option
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <button
                type="button"
                onClick={() => setPollForm((f) => ({ ...f, multiple: !f.multiple }))}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-medium transition-colors",
                  pollForm.multiple
                    ? "border-lime-400/50 bg-lime-400/15 text-lime-300"
                    : "border-white/10 text-muted-foreground",
                )}
              >
                {pollForm.multiple ? "✓" : "○"} Multiple answers
              </button>
              <button
                type="button"
                onClick={() => setPollForm((f) => ({ ...f, anonymous: !f.anonymous }))}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-medium transition-colors",
                  pollForm.anonymous
                    ? "border-lime-400/50 bg-lime-400/15 text-lime-300"
                    : "border-white/10 text-muted-foreground",
                )}
              >
                {pollForm.anonymous ? "✓" : "○"} Anonymous voting
              </button>
              <label className="flex items-center gap-2 text-muted-foreground">
                Closes
                <input
                  type="datetime-local"
                  value={pollForm.closesAt}
                  onChange={(e) => setPollForm((f) => ({ ...f, closesAt: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-xs text-foreground [color-scheme:dark]"
                />
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPollOpen(false)} disabled={pollBusy} className="border-white/10">
              Cancel
            </Button>
            <Button
              onClick={() => void submitPoll()}
              disabled={pollBusy}
              className="gap-2 bg-lime-400 text-black hover:bg-lime-300"
            >
              {pollBusy ? <Loader2 className="size-4 animate-spin" /> : <BarChart3 className="size-4" />}
              Post poll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Capacity & cohort management dialog */}
      <Dialog open={capacityOpen} onOpenChange={(o) => !o && setCapacityOpen(false)}>
        <DialogContent className="max-w-md border-white/10 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-5 text-lime-300" /> Student capacity
            </DialogTitle>
            <DialogDescription>
              Set how many students this community can hold. Spaces free up automatically when
              students leave or are moved — a full community can always be reopened or expanded.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {cap && cap.capacity !== null && (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">
                    {cap.studentCount} / {cap.capacity} students
                  </span>
                  <span
                    className={cn(
                      "font-semibold uppercase tracking-wide",
                      cap.state === "closed"
                        ? "text-amber-300"
                        : cap.state === "full"
                          ? "text-rose-300"
                          : "text-lime-300",
                    )}
                  >
                    {cap.state === "closed" ? "🔒 Closed" : cap.state === "full" ? "🔴 Full" : `🟢 ${cap.spaces} spaces`}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      cap.state === "full" ? "bg-rose-400" : "bg-lime-400",
                    )}
                    style={{ width: `${Math.min(100, (cap.studentCount / cap.capacity) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Student limit (0 = unlimited)</label>
              <Input
                type="number"
                min={0}
                value={capacityInput}
                onChange={(e) => setCapacityInput(e.target.value)}
                placeholder="e.g. 50"
                className="border-white/10 bg-black/20"
              />
            </div>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void toggleEnrollment()}
              disabled={capacityBusy}
              className="gap-2 border-white/10"
            >
              {cap?.closed ? <Unlock className="size-4 text-lime-300" /> : <Lock className="size-4 text-amber-300" />}
              {cap?.closed ? "Reopen enrollment" : "Close enrollment"}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCapacityOpen(false)} disabled={capacityBusy} className="border-white/10">
                Cancel
              </Button>
              <Button
                onClick={() => void saveCapacity()}
                disabled={capacityBusy}
                className="gap-2 bg-lime-400 text-black hover:bg-lime-300"
              >
                {capacityBusy ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}
                Save capacity
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create new cohort dialog */}
      <Dialog open={cohortOpen} onOpenChange={(o) => !o && setCohortOpen(false)}>
        <DialogContent className="max-w-md border-white/10 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-lime-300" /> Create another cohort
            </DialogTitle>
            <DialogDescription>
              When this community is full or too crowded, create a separate cohort for the same
              course. Cohorts have their own members, messages and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Cohort name *</label>
              <Input
                value={cohortName}
                onChange={(e) => setCohortName(e.target.value)}
                placeholder={`${detail.course?.title ?? "Course"} — Cohort B`}
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
            {cap && cap.capacity !== null && cap.state !== "closed" && cap.spaces === 0 && (
              <p className="text-xs text-amber-300">This community is full — consider creating a new cohort for incoming students.</p>
            )}
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

/** Resource Hub — attachments grouped by type, no scrolling through history. */
function ResourcesPanel({
  resources,
  onJump,
}: {
  resources: ResourceItem[];
  onJump: (messageId: string) => void;
}) {
  const [tab, setTab] = useState<"images" | "pdfs" | "documents" | "voice">("images");
  const images = resources.filter((r) => r.kind === "image");
  const pdfs = resources.filter(
    (r) => r.kind === "file" && (r.mimeType?.includes("pdf") || r.fileName?.toLowerCase().endsWith(".pdf")),
  );
  const documents = resources.filter(
    (r) => r.kind === "file" && !(r.mimeType?.includes("pdf") || r.fileName?.toLowerCase().endsWith(".pdf")),
  );
  const voices = resources.filter((r) => r.kind === "voice");

  const tabs: { id: typeof tab; label: string; count: number }[] = [
    { id: "images", label: "Images", count: images.length },
    { id: "pdfs", label: "PDFs", count: pdfs.length },
    { id: "documents", label: "Documents", count: documents.length },
    { id: "voice", label: "Voice", count: voices.length },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-card p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-lime-300">
        <FolderOpen className="size-3.5" /> Resource Hub
      </p>
      <div className="mb-2 flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
              tab === t.id
                ? "border-lime-400/50 bg-lime-400/15 text-lime-300"
                : "border-white/10 text-muted-foreground hover:border-lime-400/30",
            )}
          >
            {t.label}
            <span className="ml-1 tabular-nums opacity-70">{t.count}</span>
          </button>
        ))}
      </div>
      <div className="max-h-44 overflow-y-auto">
        {tab === "images" && (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {images.map((img) => (
              <button
                key={img._id}
                type="button"
                onClick={() => onJump(img._id)}
                className="group relative aspect-square overflow-hidden rounded-xl border border-white/10"
                title={`${img.senderName} · ${new Date(img.createdAt).toLocaleDateString()}`}
              >
                <img src={img.url} alt={img.fileName ?? "Photo"} loading="lazy" className="size-full object-cover transition-transform group-hover:scale-105" />
              </button>
            ))}
            {images.length === 0 && <p className="col-span-full py-3 text-center text-xs text-muted-foreground">No images shared yet.</p>}
          </div>
        )}
        {tab === "pdfs" && (
          <div className="space-y-1">
            {pdfs.map((f) => (
              <FileRow key={f._id} item={f} onJump={onJump} />
            ))}
            {pdfs.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">No PDFs shared yet.</p>}
          </div>
        )}
        {tab === "documents" && (
          <div className="space-y-1">
            {documents.map((f) => (
              <FileRow key={f._id} item={f} onJump={onJump} />
            ))}
            {documents.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">No documents shared yet.</p>}
          </div>
        )}
        {tab === "voice" && (
          <div className="space-y-1">
            {voices.map((v) => (
              <div key={v._id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-white/5">
                <button type="button" onClick={() => onJump(v._id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <Mic className="size-4 shrink-0 text-lime-300" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{v.senderName}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      🎤 Voice · {new Date(v.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                </button>
                {v.url && (
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-white/10 hover:text-lime-300"
                    title="Open audio"
                  >
                    <DownloadIcon />
                  </a>
                )}
              </div>
            ))}
            {voices.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">No voice notes shared yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function FileRow({ item, onJump }: { item: ResourceItem; onJump: (messageId: string) => void }) {
  const isPdf = item.mimeType?.includes("pdf") || item.fileName?.toLowerCase().endsWith(".pdf");
  return (
    <div className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-white/5">
      <button type="button" onClick={() => onJump(item._id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            isPdf ? "bg-rose-400/15 text-rose-300" : "bg-lime-400/15 text-lime-300",
          )}
        >
          <FileText className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">{item.fileName ?? "File"}</span>
          <span className="block text-[11px] text-muted-foreground">
            {item.senderName} · {item.fileSize ? formatBytesLabel(item.fileSize) : ""} · {new Date(item.createdAt).toLocaleDateString()}
          </span>
        </span>
      </button>
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-white/10 hover:text-lime-300"
          title={isPdf ? "Open PDF" : "Open file"}
        >
          <DownloadIcon />
        </a>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function formatBytesLabel(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function timeAgoLabel(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function CornerDownRightIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 text-lime-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 10 4 15 9 20" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </svg>
  );
}

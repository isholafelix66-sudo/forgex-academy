import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { toast } from "sonner";
import {
  BarChart3,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  CornerDownRight,
  Download,
  Flag,
  Loader2,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  ShieldAlert,
  SmilePlus,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { senderBubbleClass, senderNameClass } from "@/lib/sender-colors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/site/Avatar";
import { SafeImage } from "@/components/site/SafeImage";
import { ChatAttachmentView } from "@/components/chat/ChatBubble";

export type ThreadMessage = {
  _id: string;
  senderId: string | null;
  senderKind: string;
  sender: {
    _id: string | null;
    name: string;
    image: string | null;
    role: string;
    /** Role inside the community/room (backend-resolved) — drives role-aware UI. */
    communityRole?: string | null;
    isStaff: boolean;
  };
  body: string;
  kind: string | null;
  storageId: string | null;
  url: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  duration: number | null;
  replyToId: string | null;
  replyTo: { _id: string; body: string; senderName: string } | null;
  discussionId: string | null;
  isDiscussion: boolean;
  isAnnouncement: boolean;
  pinned: boolean;
  tutorAnswer: boolean;
  pollId: string | null;
  mentions: string[];
  reactions: { emoji: string; count: number; userIds: string[] }[];
  deleted: boolean;
  deletedBy: string | null;
  deletedById: string | null;
  deletedByName: string | null;
  deletedAt: number | null;
  editedAt: number | null;
  createdAt: number;
  mine: boolean;
};

/** Community poll as returned by `community.communityPolls`. */
export type PollView = {
  _id: string;
  messageId: string;
  question: string;
  options: string[];
  voteCounts: number[];
  totalVotes: number;
  closed: boolean;
  closesAt: number | null;
  multiple: boolean;
  anonymous: boolean;
  createdBy: string;
  createdAt: number;
  myVotes: number[];
};

export type ThreadMember = {
  userId: string;
  name: string;
  image: string | null;
  /** Last time this member read the community — drives read receipts. */
  lastReadAt: number | null;
};

const EMOJIS = ["❤️", "👍", "😂", "🔥", "👏", "😮", "😢", "🙏"];
const REPORT_REASONS = [
  "Fraud",
  "Scam",
  "Harassment",
  "Spam",
  "Impersonation",
  "Inappropriate content",
  "Suspicious activity",
  "Other",
];

export const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  tutor: { label: "Tutor", className: "bg-lime-400/15 text-lime-300 border border-lime-400/25" },
  admin: { label: "Admin", className: "bg-amber-400/15 text-amber-300 border border-amber-400/25" },
  moderator: { label: "Moderator", className: "bg-amber-400/15 text-amber-300 border border-amber-400/25" },
  system: { label: "System", className: "bg-white/10 text-muted-foreground border border-white/10" },
};

/**
 * Mirror of the backend deletion rules (backend is authoritative — this only
 * drives which affordances the UI shows):
 *   - own message → always deletable
 *   - admin viewer → any message
 *   - community tutor → student messages only (never admin or fellow tutors)
 */
export function canDeleteMessage(message: ThreadMessage, viewerRole: "student" | "tutor" | "admin") {
  if (message.deleted) return false;
  if (message.mine) return true;
  if (viewerRole === "admin") return true;
  if (viewerRole === "tutor") {
    const senderRole = message.sender.communityRole ?? message.sender.role;
    return message.senderKind === "user" && senderRole === "student";
  }
  return false;
}

const isStaffRole = (viewerRole: "student" | "tutor" | "admin") => viewerRole !== "student";

/** Highlight @mentions in a message body (matches community member names). */
export function MentionedText({
  text,
  members,
}: {
  text: string;
  members?: ThreadMember[];
}) {
  const parts = useMemo(() => {
    const known = new Map<string, string>();
    for (const m of members ?? []) known.set(m.name.toLowerCase(), m.name);
    const tokens = text.split(/(@[^\s@]+)/g);
    return tokens.map((tok, i) => {
      if (!tok.startsWith("@") || tok.length < 2) return tok;
      const name = tok.slice(1).toLowerCase();
      const display = name === "everyone" ? "everyone" : known.get(name);
      if (!display) return tok;
      return (
        <span
          key={i}
          className={cn(
            "rounded-md px-0.5 font-semibold",
            name === "everyone"
              ? "bg-amber-400/20 text-amber-300"
              : "bg-lime-400/20 text-lime-300",
          )}
        >
          @{display}
        </span>
      );
    });
  }, [text, members]);
  return <>{parts}</>;
}

/** Report dialog used from message + user action menus. */
export function ReportDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string, details: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    onOpenChange(false);
    setReason("");
    setDetails("");
  };

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    try {
      await onSubmit(reason, details);
      toast.success("Report submitted — our moderation team will review it.");
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit the report.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md border-white/10 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-300" /> Report content
          </DialogTitle>
          <DialogDescription>
            Reports go straight to the ForgeX moderation team. Please pick the
            closest reason — details help us review faster.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="border-white/10 bg-black/20">
              <SelectValue placeholder="Choose a reason" />
            </SelectTrigger>
            <SelectContent>
              {REPORT_REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Anything else we should know? (optional)"
            className="min-h-24 border-white/10 bg-black/20"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={!reason || busy}
            className="gap-2 bg-lime-400 text-black hover:bg-lime-300"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Interactive poll card attached to a poll message. */
export function PollCard({
  poll,
  myUserId,
  isStaff,
  onVote,
  onClose,
}: {
  poll: PollView;
  myUserId: string;
  isStaff: boolean;
  onVote?: (pollId: string, optionIndexes: number[]) => Promise<unknown>;
  onClose?: (pollId: string) => void;
}) {
  const [picking, setPicking] = useState<number[]>(poll.myVotes);
  const [busy, setBusy] = useState(false);
  const [voted, setVoted] = useState(poll.myVotes.length > 0);
  const closed = poll.closed || (poll.closesAt !== null && poll.closesAt <= Date.now());
  const canVote = !!onVote && !voted && !closed;

  const toggle = (i: number) => {
    if (voted || closed) return;
    setPicking((prev) =>
      poll.multiple
        ? prev.includes(i)
          ? prev.filter((x) => x !== i)
          : [...prev, i]
        : prev.includes(i)
          ? []
          : [i],
    );
  };

  const submit = async () => {
    if (!picking.length || busy || !onVote) return;
    setBusy(true);
    try {
      await onVote(poll._id, picking);
      setVoted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't record your vote.");
    } finally {
      setBusy(false);
    }
  };

  const maxVotes = Math.max(...poll.voteCounts, 1);
  const showResults = voted || closed;

  return (
    <div className="mt-2 w-full max-w-sm rounded-2xl border border-lime-400/25 bg-black/20 p-3">
      <div className="mb-2 flex items-center gap-2">
        <BarChart3 className="size-4 shrink-0 text-lime-300" />
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{poll.question}</p>
      </div>
      <div className="space-y-1.5">
        {poll.options.map((opt, i) => {
          const count = poll.voteCounts[i] ?? 0;
          const pct = poll.totalVotes ? Math.round((count / poll.totalVotes) * 100) : 0;
          const picked = poll.myVotes.includes(i) || picking.includes(i);
          return (
            <button
              key={i}
              type="button"
              disabled={!canVote}
              onClick={() => toggle(i)}
              className={cn(
                "relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-xs transition-colors",
                picked
                  ? "border-lime-400/60 bg-lime-400/15"
                  : "border-white/10 bg-black/20 hover:border-lime-400/30",
                (voted || closed) && "cursor-default",
              )}
            >
              {showResults && (
                <span
                  className="absolute inset-y-0 left-0 bg-lime-400/15 transition-all"
                  style={{ width: `${pct}%` }}
                />
              )}
              <span className="relative flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{opt}</span>
                {showResults ? (
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {pct}%{picked ? <span className="ml-1 text-lime-300">✓</span> : null}
                  </span>
                ) : (
                  picked && <span className="shrink-0 text-lime-300">✓</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span>
          {poll.totalVotes} vote{poll.totalVotes === 1 ? "" : "s"}
          {poll.anonymous && " · anonymous"}
          {poll.multiple && " · multiple answers"}
          {poll.closesAt !== null && !closed && (
            <span> · closes {timeAgo(poll.closesAt)}</span>
          )}
          {closed && <span> · closed</span>}
        </span>
        <span className="flex items-center gap-1.5">
          {isStaff && !closed && onClose && (
            <button
              type="button"
              onClick={() => onClose(poll._id)}
              className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-amber-300 hover:bg-amber-400/10"
            >
              Close poll
            </button>
          )}
          {canVote && (
            <button
              type="button"
              disabled={busy || !picking.length}
              onClick={() => void submit()}
              className="rounded-md bg-lime-400 px-2 py-0.5 font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
            >
              {busy ? "Voting…" : "Vote"}
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

/** Shared action list used by both the desktop popover and the mobile sheet. */
function ActionList({
  message,
  viewerRole,
  readOnly,
  onReply,
  onToggleReaction,
  onEditRequest,
  onDelete,
  onReport,
  onTogglePin,
  onSetTutorAnswer,
  onToggleDiscussion,
  onSaveMessage,
  extraActions,
  onClose,
}: {
  message: ThreadMessage;
  viewerRole: "student" | "tutor" | "admin";
  readOnly?: boolean;
  onReply?: (m: ThreadMessage) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onEditRequest?: () => void;
  onDelete?: (messageId: string) => Promise<unknown>;
  onReport?: (m: ThreadMessage) => void;
  onTogglePin?: (messageId: string) => Promise<unknown>;
  onSetTutorAnswer?: (messageId: string, on: boolean) => Promise<unknown>;
  onToggleDiscussion?: (messageId: string, on: boolean) => Promise<unknown>;
  onSaveMessage?: (messageId: string) => Promise<unknown>;
  extraActions?: (m: ThreadMessage) => ReactNode;
  onClose: () => void;
}) {
  const deleted = message.deleted;
  const canDelete = canDeleteMessage(message, viewerRole);
  const canInteract = !readOnly && !deleted;
  const staff = isStaffRole(viewerRole);

  const copyBody = async () => {
    try {
      await navigator.clipboard.writeText(message.body);
      toast.success("Message copied");
    } catch {
      toast.error("Couldn't copy the message.");
    }
    onClose();
  };

  const run = async (p: Promise<unknown>, ok: string) => {
    try {
      await p;
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    }
    onClose();
  };

  const item =
    (icon: ReactNode, label: string, onClick: () => void, danger = false) =>
    (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
          danger
            ? "text-rose-300 hover:bg-rose-400/10"
            : "text-foreground hover:bg-white/10",
        )}
      >
        <span className={cn("shrink-0", danger ? "text-rose-300" : "text-muted-foreground")}>
          {icon}
        </span>
        {label}
      </button>
    );

  return (
    <div className="w-full">
      {canInteract && onToggleReaction && (
        <div className="mb-1 flex items-center justify-between gap-1 rounded-2xl border border-white/10 bg-black/20 px-2 py-2">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onToggleReaction(message._id, e);
                onClose();
              }}
              className="rounded-xl px-1 py-0.5 text-xl transition-transform hover:scale-125"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {canInteract && onReply && item(<CornerDownRight className="size-4" />, "Reply", () => {
        onReply(message);
        onClose();
      })}

      {message.body && item(<Copy className="size-4" />, "Copy", () => void copyBody())}

      {canInteract && message.mine && onEditRequest && item(<Pencil className="size-4" />, "Edit", () => {
        onEditRequest();
        onClose();
      })}

      {canInteract && onSaveMessage && item(
        <Bookmark className="size-4" />,
        "Save message",
        () => void run(onSaveMessage(message._id), "Message saved"),
      )}

      {canInteract && onTogglePin && staff && item(
        message.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />,
        message.pinned ? "Unpin" : "Pin message",
        () => void run(onTogglePin(message._id), message.pinned ? "Unpinned" : "Pinned"),
      )}

      {canInteract && onSetTutorAnswer && staff && item(
        <Check className="size-4" />,
        message.tutorAnswer ? "Remove tutor answer" : "Mark as tutor answer",
        () => void run(onSetTutorAnswer(message._id, !message.tutorAnswer), message.tutorAnswer ? "Tutor answer removed" : "Marked as tutor answer"),
      )}

      {canInteract && onToggleDiscussion && staff && item(
        <CornerDownRight className="size-4" />,
        message.isDiscussion ? "Close discussion" : "Start discussion",
        () => void run(onToggleDiscussion(message._id, !message.isDiscussion), message.isDiscussion ? "Discussion closed" : "Discussion started"),
      )}

      {canInteract && onDelete && canDelete && item(<Trash2 className="size-4" />, "Delete", () => {
        onDelete(message._id)
          .then(() => toast.success("Message deleted"))
          .catch((err) =>
            toast.error(err instanceof Error ? err.message : "Couldn't delete the message."),
          );
        onClose();
      }, true)}

      {canInteract && onReport && item(<Flag className="size-4" />, "Report", () => {
        onReport(message);
        onClose();
      })}

      {extraActions && (
        <div
          onClick={() => onClose()}
          className="mt-1 border-t border-white/8 pt-1"
        >
          {extraActions(message)}
        </div>
      )}
    </div>
  );
}

/** One message bubble with its action row (reply / react / edit / delete / report). */
function MessageBubble({
  message,
  myUserId,
  viewerRole = "student",
  showDeletedContent = false,
  onReply,
  onToggleReaction,
  onEdit,
  onDelete,
  onReport,
  onVoicePlay,
  extraActions,
  readOnly,
  members,
  poll,
  onVotePoll,
  onClosePoll,
  savedIds,
  onSaveMessage,
  onTogglePin,
  onSetTutorAnswer,
  onToggleDiscussion,
  onOpenDiscussion,
  discussionCounts,
  readReceipts,
  onImageClick,
}: {
  message: ThreadMessage;
  myUserId: string;
  /** Viewer's community role — controls who gets the delete affordance.
   *  The backend still enforces every rule; this only drives the UI. */
  viewerRole?: "student" | "tutor" | "admin";
  /** Admin moderation view: reveal the original content of deleted messages
   *  (students/tutors only ever see the placeholder). */
  showDeletedContent?: boolean;
  onReply?: (m: ThreadMessage) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onEdit?: (messageId: string, body: string) => Promise<unknown>;
  onDelete?: (messageId: string) => Promise<unknown>;
  onReport?: (m: ThreadMessage) => void;
  onVoicePlay?: (m: ThreadMessage) => void;
  extraActions?: (m: ThreadMessage) => ReactNode;
  readOnly?: boolean;
  members?: ThreadMember[];
  poll?: PollView;
  onVotePoll?: (pollId: string, optionIndexes: number[]) => Promise<unknown>;
  onClosePoll?: (pollId: string) => void;
  savedIds?: string[];
  onSaveMessage?: (messageId: string) => Promise<unknown>;
  onTogglePin?: (messageId: string) => Promise<unknown>;
  onSetTutorAnswer?: (messageId: string, on: boolean) => Promise<unknown>;
  onToggleDiscussion?: (messageId: string, on: boolean) => Promise<unknown>;
  onOpenDiscussion?: (messageId: string) => void;
  discussionCounts?: Record<string, number>;
  readReceipts?: { userId: string; lastReadAt: number }[];
  onImageClick?: (m: ThreadMessage) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [reactPopover, setReactPopover] = useState<string | null>(null);
  // Tap / long-press action menu. `null` = closed. Position is the anchor for
  // the desktop popover; `fromTouch` switches to the bottom-sheet layout.
  const [actionMenu, setActionMenu] = useState<{
    x: number;
    y: number;
    fromTouch: boolean;
  } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  // The synthetic mousedown a touch release fires would immediately close the
  // menu a long-press just opened — swallow exactly one outside-click.
  const ignoreNextOutside = useRef(false);
  const isCoarsePointer = useRef(
    typeof window !== "undefined" &&
      (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 640),
  ).current;

  useEffect(() => {
    if (!pickerOpen && !menuOpen && !actionMenu && !reactPopover) return;
    const onClick = (e: MouseEvent) => {
      if (
        pickerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node) ||
        actionRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      if (ignoreNextOutside.current) {
        ignoreNextOutside.current = false;
        return;
      }
      setPickerOpen(false);
      setMenuOpen(false);
      setActionMenu(null);
      setReactPopover(null);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [pickerOpen, menuOpen, actionMenu, reactPopover]);

  // Close the action menu on Escape and when the thread scrolls.
  useEffect(() => {
    if (!actionMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActionMenu(null);
    };
    const onScroll = () => setActionMenu(null);
    document.addEventListener("keydown", onKey);
    document.addEventListener("forgex-chat-scroll", onScroll);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("forgex-chat-scroll", onScroll);
    };
  }, [actionMenu]);

  // Clear any pending long-press timer on unmount.
  useEffect(() => () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  const isAdminPost = message.senderKind === "admin" || message.sender.role === "admin";
  const showRole = message.sender.isStaff && !isAdminPost;
  const hasAttachment =
    message.kind === "image" || message.kind === "file" || message.kind === "voice";
  const canDelete = canDeleteMessage(message, viewerRole);
  const voicePlayable = onVoicePlay && message.kind === "voice" && (!message.deleted || showDeletedContent);
  const saved = savedIds?.includes(message._id) ?? false;
  const discussionReplies = discussionCounts?.[message._id] ?? 0;
  const staff = isStaffRole(viewerRole);

  const openMenu = (x: number, y: number, fromTouch: boolean) => {
    setPickerOpen(false);
    setMenuOpen(false);
    setReactPopover(null);
    setActionMenu({ x, y, fromTouch });
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (message.deleted) return;
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    if ((e.target as HTMLElement).closest("a,button,[data-menu-skip]")) return;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      suppressClick.current = true;
      ignoreNextOutside.current = true;
      openMenu(e.clientX, e.clientY, true);
      // Safety net: clear the flags even if the browser never fires the
      // synthetic mousedown / click after the touch gesture (e.g. the finger
      // was released off the bubble).
      setTimeout(() => {
        suppressClick.current = false;
        ignoreNextOutside.current = false;
      }, 700);
    }, 450);
  };

  const onPointerUp = () => clearLongPress();
  const onPointerCancel = () => clearLongPress();

  const onBubbleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (message.deleted) {
      if (voicePlayable) onVoicePlay(message);
      return;
    }
    // A long-press already opened the menu — swallow the click it leaves behind.
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if ((e.target as HTMLElement).closest("a,button,[data-menu-skip]")) return;
    // Voice keeps its tap-to-play behaviour (the menu is reachable via long-press).
    if (onVoicePlay && message.kind === "voice") {
      onVoicePlay(message);
      return;
    }
    openMenu(e.clientX, e.clientY, isCoarsePointer);
  };

  const onBubbleContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (message.deleted) return;
    if ((e.target as HTMLElement).closest("a,button,[data-menu-skip]")) return;
    e.preventDefault();
    openMenu(e.clientX, e.clientY, isCoarsePointer);
  };

  const saveEdit = async () => {
    if (!editText.trim() || editBusy) return;
    setEditBusy(true);
    try {
      await onEdit?.(message._id, editText.trim());
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't edit the message.");
    } finally {
      setEditBusy(false);
    }
  };

  // Read receipts for my messages: active readers whose last read time is at
  // or after this message was created (excluding myself).
  const readCount =
    message.mine && readReceipts
      ? readReceipts.filter(
          (r) => r.userId !== myUserId && r.lastReadAt >= message.createdAt,
        ).length
      : 0;

  const toggleSave = async () => {
    if (!onSaveMessage || message.deleted || readOnly) return;
    try {
      await onSaveMessage(message._id);
      toast.success(saved ? "Removed from saved messages" : "Message saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update saved messages.");
    }
  };

  const ownMessage =
    message.mine && !isAdminPost && !message.isAnnouncement;

  return (
    <div
      className={cn(
        "group flex gap-2.5 px-1",
        ownMessage && "flex-row-reverse",
      )}
    >
      {/* Sender avatar */}
      <div className="w-9 shrink-0">
        {isAdminPost ? (
          <span className="flex size-9 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300">
            <ShieldAlert className="size-4" />
          </span>
        ) : (
          <Avatar name={message.sender.name} image={message.sender.image} className="size-9" />
        )}
      </div>

      <div className={cn("min-w-0 flex-1", ownMessage && "flex flex-col items-end")}>
        {/* Sender name + role + time */}
        <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            className={cn(
              "text-sm font-semibold",
              isAdminPost
                ? "text-amber-300"
                : message.mine
                  ? "text-lime-300"
                  : senderNameClass(message.senderId ?? message.sender._id),
            )}
          >
            {isAdminPost ? "🛡️ ForgeX Admin" : message.sender.name}
          </span>
          {showRole && (
            <span
              className={cn(
                "rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
                ROLE_BADGE[message.sender.role]?.className ?? ROLE_BADGE.system.className,
              )}
            >
              {ROLE_BADGE[message.sender.role]?.label ?? message.sender.role}
            </span>
          )}
          {message.pinned && !message.deleted && (
            <span className="flex items-center gap-1 rounded-full border border-lime-400/25 bg-lime-400/10 px-1.5 py-px text-[10px] font-semibold text-lime-300">
              <Pin className="size-2.5" /> Pinned
            </span>
          )}
          {message.mine && <span className="text-[10px] font-medium text-muted-foreground">You</span>}
          <span className="text-[10px] text-muted-foreground">{timeAgo(message.createdAt)}</span>
          {!readOnly && !message.deleted && onSaveMessage && (
            <button
              type="button"
              onClick={() => void toggleSave()}
              title={saved ? "Unsave message" : "Save message"}
              className={cn(
                "flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[11px] font-medium transition-colors",
                saved
                  ? "text-lime-300"
                  : "text-muted-foreground opacity-0 hover:bg-white/10 group-hover:opacity-100",
              )}
            >
              {saved ? <BookmarkCheck className="size-3" /> : <Bookmark className="size-3" />}
            </button>
          )}
          {extraActions?.(message)}
        </div>

        {/* Bubble — tap (or long-press on touch) opens the message actions */}
        <div
          onClick={onBubbleClick}
          onContextMenu={onBubbleContextMenu}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className={cn(
            voicePlayable ? "cursor-pointer" : undefined,
            "inline-block max-w-full select-none touch-manipulation rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
            ownMessage
              ? "rounded-br-sm bg-lime-400 text-black"
              : message.isAnnouncement
                ? "rounded-tl-sm border border-amber-400/35 bg-amber-400/10 text-amber-50"
                : isAdminPost
                  ? "rounded-tl-sm border border-amber-400/25 bg-amber-400/8 text-amber-50"
                  : cn(
                      "rounded-tl-sm border",
                      senderBubbleClass(message.senderId ?? message.sender._id),
                    ),
          )}
        >
          {message.deleted ? (
            showDeletedContent ? (
              <>
                <span className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-rose-300">
                  <Trash2 className="size-3" />
                  Deleted
                  {message.deletedByName
                    ? ` by ${message.deletedByName}`
                    : message.deletedBy === "admin"
                      ? " by ForgeX Admin"
                      : ""}
                  {message.deletedAt ? ` · ${timeAgo(message.deletedAt)}` : ""}
                </span>
                {hasAttachment && (
                  <ChatAttachmentView
                    attachment={{ ...message, senderId: message.senderId ?? undefined }}
                    mine={false}
                  />
                )}
                {message.body ? (
                  <p className="whitespace-pre-line">{message.body}</p>
                ) : null}
                {message.editedAt && (
                  <span className="mt-0.5 block text-[10px] italic opacity-60">edited</span>
                )}
              </>
            ) : (
              <p className="text-xs italic opacity-70">This message was deleted.</p>
            )
          ) : (
            <>
              {message.isAnnouncement && (
                <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  <Megaphone className="size-3" /> Announcement
                </span>
              )}
              {message.isDiscussion && (
                <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-lime-300">
                  📚 Discussion
                </span>
              )}
              {message.tutorAnswer && (
                <span className="mb-1 flex w-fit items-center gap-1 rounded-full bg-lime-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                  <Check className="size-3" /> Tutor answer
                </span>
              )}
              {message.replyTo && (
                <button
                  type="button"
                  onClick={() => {
                    document
                      .getElementById(`msg-${message.replyTo?._id}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className={cn(
                    "mb-1.5 flex max-w-[320px] items-center gap-1.5 rounded-lg px-2 py-1 text-left text-xs",
                    message.mine && !isAdminPost && !message.isAnnouncement
                      ? "bg-black/10 text-black/80"
                      : "bg-black/20 text-muted-foreground",
                  )}
                >
                  <CornerDownRight className="size-3 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{message.replyTo.senderName}</span>
                    <span className="block truncate opacity-80">{message.replyTo.body}</span>
                  </span>
                </button>
              )}
              {hasAttachment && (
                <ChatAttachmentView
                  attachment={{ ...message, senderId: message.senderId ?? undefined }}
                  mine={message.mine && !isAdminPost && !message.isAnnouncement}
                  onImageClick={
                    message.kind === "image" && onImageClick
                      ? () => onImageClick(message)
                      : undefined
                  }
                />
              )}
              {message.body ? (
                <p className={cn("whitespace-pre-line", hasAttachment && "mt-1.5")}>
                  <MentionedText text={message.body} members={members} />
                </p>
              ) : null}
              {message.editedAt && !message.deleted && (
                <span className="mt-0.5 block text-[10px] italic opacity-60">edited</span>
              )}
              {/* Poll card */}
              {poll && (
                <PollCard
                  poll={poll}
                  myUserId={myUserId}
                  isStaff={staff}
                  onVote={onVotePoll}
                  onClose={onClosePoll}
                />
              )}
              {/* Discussion replies chip */}
              {message.isDiscussion && discussionReplies > 0 && onOpenDiscussion && (
                <button
                  type="button"
                  onClick={() => onOpenDiscussion(message._id)}
                  className="mt-1.5 flex items-center gap-1.5 rounded-full border border-lime-400/25 bg-lime-400/10 px-2.5 py-1 text-[11px] font-semibold text-lime-300 transition-colors hover:bg-lime-400/20"
                >
                  💬 {discussionReplies} repl{discussionReplies === 1 ? "y" : "ies"} — open discussion
                </button>
              )}
            </>
          )}
        </div>

        {/* Reactions */}
        {message.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((r) => (
              <div key={r.emoji} className="relative" data-menu-skip>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => onToggleReaction?.(message._id, r.emoji)}
                  onMouseEnter={() => setReactPopover(r.emoji)}
                  onMouseLeave={() => setReactPopover(null)}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                    r.userIds.includes(myUserId)
                      ? "border-lime-400/50 bg-lime-400/15 text-lime-200"
                      : "border-white/10 bg-white/5 text-muted-foreground hover:border-lime-400/30",
                  )}
                >
                  <span>{r.emoji}</span>
                  <span className="tabular-nums">{r.count}</span>
                </button>
                {reactPopover === r.emoji && members && r.userIds.length > 0 && (
                  <div className="absolute bottom-full left-0 z-30 mb-1 w-max max-w-[220px] rounded-xl border border-white/10 bg-popover px-2.5 py-1.5 text-[11px] shadow-xl">
                    <p className="font-medium text-foreground">
                      {r.userIds
                        .map(
                          (uid) =>
                            members.find((m) => m.userId === uid)?.name ?? "Former member",
                        )
                        .join(", ")}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Read receipts for my messages */}
        {readCount > 0 && (
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="text-[10px]">✓✓</span> Read by {readCount}
          </p>
        )}

        {/* Action row (desktop hover) */}
        {!readOnly && !message.deleted && (
          <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            {onReply && (
              <button
                type="button"
                onClick={() => onReply(message)}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-white/10 hover:text-lime-300"
              >
                <CornerDownRight className="size-3" /> Reply
              </button>
            )}
            {onToggleReaction && (
              <div className="relative" ref={pickerRef}>
                <button
                  type="button"
                  onClick={() => setPickerOpen((o) => !o)}
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-white/10 hover:text-lime-300"
                >
                  <SmilePlus className="size-3" /> React
                </button>
                {pickerOpen && (
                  <div className="absolute bottom-full left-0 z-20 mb-1 flex items-center gap-1 rounded-xl border border-white/10 bg-popover p-1.5 shadow-xl">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => {
                          onToggleReaction(message._id, e);
                          setPickerOpen(false);
                        }}
                        className="rounded-lg p-1 text-base transition-transform hover:scale-125"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {onReport && (
              <button
                type="button"
                onClick={() => onReport(message)}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-rose-400/10 hover:text-rose-300"
              >
                <Flag className="size-3" /> Report
              </button>
            )}
            {onDelete && canDelete && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-white/10 hover:text-lime-300"
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
                {menuOpen && (
                  <div className="absolute bottom-full right-0 z-20 mb-1 w-32 overflow-hidden rounded-xl border border-white/10 bg-popover p-1 shadow-xl">
                    {message.mine && onEdit && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditText(message.body);
                          setEditing(true);
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-white/10"
                      >
                        <Pencil className="size-3.5" /> Edit
                      </button>
                    )}
                    {canDelete && onDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete(message._id)
                            .then(() => toast.success("Message deleted"))
                            .catch((err) =>
                              toast.error(err instanceof Error ? err.message : "Couldn't delete the message."),
                            );
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-400/10"
                      >
                        <Trash2 className="size-3.5" /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Inline edit */}
        {editing && (
          <div className="mt-1.5 flex max-w-md items-center gap-2">
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              autoFocus
              className="border-white/10 bg-black/20"
            />
            <Button size="icon" className="shrink-0 bg-lime-400 text-black hover:bg-lime-300" onClick={() => void saveEdit()} disabled={editBusy}>
              {editBusy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            </Button>
          </div>
        )}
      </div>

      {/* Tap / long-press message actions */}
      {actionMenu && (
        <MessageActions
          ref={actionRef}
          message={message}
          viewerRole={viewerRole}
          position={actionMenu}
          readOnly={readOnly}
          onReply={onReply}
          onToggleReaction={onToggleReaction}
          onEditRequest={() => {
            setEditText(message.body);
            setEditing(true);
          }}
          onDelete={onDelete}
          onReport={onReport}
          onTogglePin={onTogglePin}
          onSetTutorAnswer={onSetTutorAnswer}
          onToggleDiscussion={onToggleDiscussion}
          onSaveMessage={onSaveMessage}
          extraActions={extraActions}
          onClose={() => setActionMenu(null)}
        />
      )}
    </div>
  );
}

/** Fixed-position menu: bottom sheet on touch/small screens, popover on desktop. */
const MessageActions = ({
  ref,
  message,
  viewerRole,
  position,
  readOnly,
  onReply,
  onToggleReaction,
  onEditRequest,
  onDelete,
  onReport,
  onTogglePin,
  onSetTutorAnswer,
  onToggleDiscussion,
  onSaveMessage,
  extraActions,
  onClose,
}: {
  ref: RefObject<HTMLDivElement | null>;
  message: ThreadMessage;
  viewerRole: "student" | "tutor" | "admin";
  position: { x: number; y: number; fromTouch: boolean };
  readOnly?: boolean;
  onReply?: (m: ThreadMessage) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onEditRequest?: () => void;
  onDelete?: (messageId: string) => Promise<unknown>;
  onReport?: (m: ThreadMessage) => void;
  onTogglePin?: (messageId: string) => Promise<unknown>;
  onSetTutorAnswer?: (messageId: string, on: boolean) => Promise<unknown>;
  onToggleDiscussion?: (messageId: string, on: boolean) => Promise<unknown>;
  onSaveMessage?: (messageId: string) => Promise<unknown>;
  extraActions?: (m: ThreadMessage) => ReactNode;
  onClose: () => void;
}) => {
  const isSheet =
    position.fromTouch ||
    (typeof window !== "undefined" && window.innerWidth < 640);

  const list = (
    <ActionList
      message={message}
      viewerRole={viewerRole}
      readOnly={readOnly}
      onReply={onReply}
      onToggleReaction={onToggleReaction}
      onEditRequest={onEditRequest}
      onDelete={onDelete}
      onReport={onReport}
      onTogglePin={onTogglePin}
      onSetTutorAnswer={onSetTutorAnswer}
      onToggleDiscussion={onToggleDiscussion}
      onSaveMessage={onSaveMessage}
      extraActions={extraActions}
      onClose={onClose}
    />
  );

  if (isSheet) {
    return (
      <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
        {/* Backdrop — tap outside to close */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
        <div
          ref={ref}
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-3xl border-t border-white/10 bg-card p-3 shadow-2xl shadow-black/60 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        >
          {/* Grab handle */}
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15" />
          <div className="mb-2 flex items-center gap-2.5 border-b border-white/8 pb-2">
            <Avatar name={message.sender.name} image={message.sender.image} className="size-8" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {message.senderKind === "admin" ? "🛡️ ForgeX Admin" : message.sender.name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {timeAgo(message.createdAt)}
                {message.body ? ` · ${message.body.slice(0, 40)}${message.body.length > 40 ? "…" : ""}` : message.kind === "voice" ? " · Voice message" : message.kind === "image" ? " · Photo" : " · Attachment"}
              </p>
            </div>
          </div>
          {list}
        </div>
      </div>
    );
  }

  // Desktop popover — anchored near the tap/click point, flipped when it would
  // overflow the viewport. Position is fixed so the scroll container can't cut it.
  const MENU_W = 236;
  const MENU_H = 420;
  const pad = 10;
  const left = Math.max(pad, Math.min(position.x - MENU_W / 2, window.innerWidth - MENU_W - pad));
  const top =
    position.y + MENU_H + pad > window.innerHeight - pad
      ? Math.max(pad, position.y - MENU_H - pad)
      : position.y + 4;
  return (
    <div
      ref={ref}
      className="fixed z-[70] overflow-hidden rounded-2xl border border-white/10 bg-card p-1.5 shadow-2xl shadow-black/60"
      style={{ left, top, width: MENU_W }}
    >
      {list}
    </div>
  );
};

/** Full-screen image viewer with prev/next navigation. */
function ImageLightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: ThreadMessage[];
  index: number;
  onClose: () => void;
  onNavigate: (next: number) => void;
}) {
  const current = images[index];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && images.length > 1) onNavigate((index - 1 + images.length) % images.length);
      if (e.key === "ArrowRight" && images.length > 1) onNavigate((index + 1) % images.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, images.length, onClose, onNavigate]);

  if (!current?.url) return null;
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/95" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between gap-2 p-3 sm:p-4">
        <p className="truncate text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{current.sender.name}</span>
          {current.fileName ? ` · ${current.fileName}` : ""} · {timeAgo(current.createdAt)}
        </p>
        <div className="flex items-center gap-2">
          {current.url && (
            <a
              href={current.url}
              target="_blank"
              rel="noopener noreferrer"
              download={current.fileName ?? undefined}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium hover:bg-white/10"
            >
              <Download className="size-3.5" /> Download
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {images.length > 1 && (
          <button
            type="button"
            onClick={() => onNavigate((index - 1 + images.length) % images.length)}
            className="absolute left-2 z-10 rounded-full border border-white/10 bg-black/60 p-2.5 text-foreground hover:bg-black/80 sm:left-4"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}
        <SafeImage
          src={current.url}
          alt={current.fileName ?? "Photo"}
          className="max-h-full max-w-full rounded-xl object-contain"
        />
        {images.length > 1 && (
          <button
            type="button"
            onClick={() => onNavigate((index + 1) % images.length)}
            className="absolute right-2 z-10 rounded-full border border-white/10 bg-black/60 p-2.5 text-foreground hover:bg-black/80 sm:right-4"
          >
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>
      {images.length > 1 && (
        <p className="pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground">
          {index + 1} / {images.length}
        </p>
      )}
    </div>
  );
}

/**
 * A scrollable message thread shared by course communities and student DMs.
 * `messages` should be ordered oldest → newest. Pass `onVoicePlay` to log
 * audio playback (admin moderation), `readOnly` for the admin view (no
 * reply/react/edit affordances beyond report-adjacent actions).
 *
 * Messages are directly interactive: tap (desktop click), long-press (touch)
 * or right-click opens the message actions — no floating button required.
 */
export function MessageThread({
  messages,
  myUserId,
  viewerRole = "student",
  showDeletedContent = false,
  loading,
  nextCursor,
  onLoadMore,
  onReply,
  onToggleReaction,
  onEdit,
  onDelete,
  onReport,
  onVoicePlay,
  extraActions,
  readOnly,
  members,
  polls,
  onVotePoll,
  onClosePoll,
  savedIds,
  onSaveMessage,
  onTogglePin,
  onSetTutorAnswer,
  onToggleDiscussion,
  onOpenDiscussion,
  discussionCounts,
  lastReadAt,
  focusMessageId,
  onReachedBottom,
  onJumpTo,
}: {
  messages: ThreadMessage[];
  myUserId: string;
  viewerRole?: "student" | "tutor" | "admin";
  /** Admin moderation view: reveal the original content of deleted messages. */
  showDeletedContent?: boolean;
  loading?: boolean;
  nextCursor?: number | null;
  onLoadMore?: () => void;
  onReply?: (m: ThreadMessage) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onEdit?: (messageId: string, body: string) => Promise<unknown>;
  onDelete?: (messageId: string) => Promise<unknown>;
  onReport?: (m: ThreadMessage) => void;
  onVoicePlay?: (m: ThreadMessage) => void;
  extraActions?: (m: ThreadMessage) => ReactNode;
  readOnly?: boolean;
  members?: ThreadMember[];
  polls?: Record<string, PollView>;
  onVotePoll?: (pollId: string, optionIndexes: number[]) => Promise<unknown>;
  onClosePoll?: (pollId: string) => void;
  savedIds?: string[];
  onSaveMessage?: (messageId: string) => Promise<unknown>;
  onTogglePin?: (messageId: string) => Promise<unknown>;
  onSetTutorAnswer?: (messageId: string, on: boolean) => Promise<unknown>;
  onToggleDiscussion?: (messageId: string, on: boolean) => Promise<unknown>;
  onOpenDiscussion?: (messageId: string) => void;
  discussionCounts?: Record<string, number>;
  /** My last-read timestamp — drives the “new messages” divider. */
  lastReadAt?: number;
  /** When set, scroll to + highlight this message (search / saved / pinned). */
  focusMessageId?: string | null;
  /** Fired when the user scrolls to the very bottom (mark-as-read trigger). */
  onReachedBottom?: () => void;
  /** Open the conversation at a message (used by unread-banner “jump”). */
  onJumpTo?: (messageId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const reachedBottomRef = useRef(false);
  // Mark-as-read only happens after the user actually scrolls — the
  // programmatic scrolls on mount / new messages must not count.
  const userScrolled = useRef(false);
  const didInitialJump = useRef(false);

  const imageMessages = useMemo(
    () => messages.filter((m) => m.kind === "image" && m.url && !m.deleted),
    [messages],
  );

  // Unread split: everything after my last read (excluding my own posts).
  // `undefined` means the read state hasn't loaded yet — no divider, no jump.
  const firstUnreadIndex = useMemo(() => {
    if (lastReadAt === undefined) return -1;
    return messages.findIndex(
      (m) => m.createdAt > lastReadAt && !m.mine && !m.deleted,
    );
  }, [messages, lastReadAt]);
  const unreadCount =
    firstUnreadIndex === -1
      ? 0
      : messages.filter(
          (m, i) => i >= firstUnreadIndex && !m.mine && !m.deleted,
        ).length;

  // Track scroll position: stick to bottom when already at the bottom, and
  // let open action menus know the thread moved (they close themselves).
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (atBottom && userScrolled.current) {
      if (!reachedBottomRef.current) {
        reachedBottomRef.current = true;
        onReachedBottom?.();
      }
    } else if (!atBottom) {
      reachedBottomRef.current = false;
    }
    document.dispatchEvent(new Event("forgex-chat-scroll"));
  };

  // Open the conversation at the first unread message (never marks read —
  // that only happens once the user scrolls to the bottom).
  useEffect(() => {
    if (didInitialJump.current || messages.length === 0) return;
    if (lastReadAt !== undefined && firstUnreadIndex !== -1) {
      didInitialJump.current = true;
      stickToBottom.current = false;
      const id = messages[firstUnreadIndex]._id;
      requestAnimationFrame(() => {
        document
          .getElementById(`msg-${id}`)
          ?.scrollIntoView({ behavior: "auto", block: "center" });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Re-validate the stick flag after the previous page is prepended (load more).
  useEffect(() => {
    stickToBottom.current = true;
  }, [nextCursor]);

  // Jump to a specific message (search / saved / pinned / reply target).
  useEffect(() => {
    if (!focusMessageId) return;
    const el = document.getElementById(`msg-${focusMessageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlashId(focusMessageId);
      const t = window.setTimeout(() => setFlashId(null), 2200);
      return () => window.clearTimeout(t);
    }
  }, [focusMessageId]);

  const jumpToId = (id: string) => {
    onJumpTo?.(id);
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlashId(id);
      const t = window.setTimeout(() => setFlashId(null), 2200);
      return () => window.clearTimeout(t);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onWheel={() => {
          userScrolled.current = true;
        }}
        onTouchMove={() => {
          userScrolled.current = true;
        }}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-4"
      >
        {nextCursor && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLoadMore}
              disabled={loading}
              className="gap-1.5 text-muted-foreground hover:text-lime-300"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronDown className="size-3.5 rotate-180" />}
              Load earlier messages
            </Button>
          </div>
        )}
        {messages.map((m, i) => {
          const isFirstUnread = i === firstUnreadIndex;
          const highlighted = flashId === m._id;
          return (
            <div key={m._id} id={`msg-${m._id}`}>
              {isFirstUnread && (
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-px flex-1 border-t border-dashed border-lime-400/40" />
                  <span className="flex items-center gap-2 rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-[11px] font-semibold text-lime-300">
                    {unreadCount > 0 ? `${unreadCount} new message${unreadCount === 1 ? "" : "s"}` : "NEW MESSAGES"}
                    {unreadCount > 0 && onJumpTo && (
                      <button
                        type="button"
                        onClick={() => jumpToId(m._id)}
                        className="text-[10px] font-bold underline-offset-2 hover:underline"
                      >
                        Jump to first
                      </button>
                    )}
                  </span>
                  <span className="h-px flex-1 border-t border-dashed border-lime-400/40" />
                </div>
              )}
              <div
                className={cn(
                  "rounded-xl transition-shadow",
                  highlighted && "shadow-[0_0_0_2px_rgba(163,230,53,0.8)]",
                )}
              >
                <MessageBubble
                  message={m}
                  myUserId={myUserId}
                  viewerRole={viewerRole}
                  showDeletedContent={showDeletedContent}
                  onReply={readOnly ? undefined : onReply}
                  onToggleReaction={readOnly ? undefined : onToggleReaction}
                  onEdit={readOnly ? undefined : onEdit}
                  onDelete={readOnly ? undefined : onDelete}
                  onReport={readOnly ? undefined : onReport}
                  onVoicePlay={readOnly ? wrapPlay : undefined}
                  extraActions={extraActions}
                  readOnly={readOnly}
                  members={members}
                  poll={m.pollId ? polls?.[m.pollId] : undefined}
                  onVotePoll={onVotePoll}
                  onClosePoll={onClosePoll}
                  savedIds={savedIds}
                  onSaveMessage={readOnly ? undefined : onSaveMessage}
                  onTogglePin={onTogglePin}
                  onSetTutorAnswer={onSetTutorAnswer}
                  onToggleDiscussion={onToggleDiscussion}
                  onOpenDiscussion={onOpenDiscussion}
                  discussionCounts={discussionCounts}
                  readReceipts={members
                    ?.filter((m) => m.lastReadAt !== null)
                    .map((m) => ({ userId: m.userId, lastReadAt: m.lastReadAt as number }))}
                  onImageClick={
                    imageMessages.length
                      ? (img) => setLightbox(imageMessages.indexOf(img))
                      : undefined
                  }
                />
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex justify-center py-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {messages.length === 0 && !loading && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet — start the conversation below.
          </p>
        )}
      </div>

      {lightbox !== null && imageMessages[lightbox] && (
        <ImageLightbox
          images={imageMessages}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNavigate={setLightbox}
        />
      )}
    </div>
  );

  function wrapPlay(m: ThreadMessage) {
    onVoicePlay?.(m);
  }
}

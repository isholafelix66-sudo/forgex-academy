import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  CornerDownRight,
  Flag,
  Loader2,
  MoreHorizontal,
  Pencil,
  ShieldAlert,
  SmilePlus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
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
  reactions: { emoji: string; count: number; userIds: string[] }[];
  deleted: boolean;
  deletedBy: string | null;
  editedAt: number | null;
  createdAt: number;
  mine: boolean;
};

const EMOJIS = ["👍", "❤️", "😂", "🔥", "👏", "🎉"];
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

/** One message bubble with its action row (reply / react / edit / delete / report). */
function MessageBubble({
  message,
  myUserId,
  onReply,
  onToggleReaction,
  onEdit,
  onDelete,
  onReport,
  onVoicePlay,
  extraActions,
  readOnly,
}: {
  message: ThreadMessage;
  myUserId: string;
  onReply?: (m: ThreadMessage) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onEdit?: (messageId: string, body: string) => Promise<unknown>;
  onDelete?: (messageId: string) => Promise<unknown>;
  onReport?: (m: ThreadMessage) => void;
  onVoicePlay?: (m: ThreadMessage) => void;
  extraActions?: (m: ThreadMessage) => ReactNode;
  readOnly?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen && !menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (
        pickerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setPickerOpen(false);
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [pickerOpen, menuOpen]);

  const isAdminPost = message.senderKind === "admin" || message.sender.role === "admin";
  const showRole = message.sender.isStaff && !isAdminPost;
  const hasAttachment =
    message.kind === "image" || message.kind === "file" || message.kind === "voice";

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

  return (
    <div className="group flex gap-2.5 px-1">
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

      <div className="min-w-0 flex-1">
        {/* Sender name + role + time */}
        <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            className={cn(
              "text-sm font-semibold",
              isAdminPost ? "text-amber-300" : message.mine ? "text-lime-300" : "text-foreground",
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
          {message.mine && <span className="text-[10px] font-medium text-muted-foreground">You</span>}
          <span className="text-[10px] text-muted-foreground">{timeAgo(message.createdAt)}</span>
          {extraActions?.(message)}
        </div>

        {/* Bubble */}
        <div
          onClick={
            onVoicePlay && message.kind === "voice" && !message.deleted
              ? () => onVoicePlay(message)
              : undefined
          }
          className={cn(
            onVoicePlay && message.kind === "voice" && !message.deleted
              ? "cursor-pointer"
              : undefined,
            "inline-block max-w-full rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
            message.mine && !isAdminPost
              ? "rounded-bl-sm bg-lime-400 text-black"
              : isAdminPost
                ? "rounded-tl-sm border border-amber-400/25 bg-amber-400/8 text-amber-50"
                : "rounded-tl-sm border border-white/10 bg-white/6 text-foreground",
          )}
        >
          {message.deleted ? (
            <p className="text-xs italic opacity-70">
              {message.deletedBy === "admin" ? "Message removed by a moderator" : "Message deleted"}
            </p>
          ) : (
            <>
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
                    message.mine && !isAdminPost
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
                  mine={message.mine && !isAdminPost}
                />
              )}
              {message.body ? (
                <p className={cn("whitespace-pre-line", hasAttachment && "mt-1.5")}>{message.body}</p>
              ) : null}
              {message.editedAt && !message.deleted && (
                <span className="mt-0.5 block text-[10px] italic opacity-60">edited</span>
              )}
            </>
          )}
        </div>

        {/* Reactions */}
        {message.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                disabled={readOnly}
                onClick={() => onToggleReaction?.(message._id, r.emoji)}
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
            ))}
          </div>
        )}

        {/* Action row */}
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
            {(message.mine || (onEdit && message.mine)) && (
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
                    {message.mine && onDelete && (
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
    </div>
  );
}

/**
 * A scrollable message thread shared by course communities and student DMs.
 * `messages` should be ordered oldest → newest. Pass `onVoicePlay` to log
 * audio playback (admin moderation), `readOnly` for the admin view (no
 * reply/react/edit affordances beyond report-adjacent actions).
 */
export function MessageThread({
  messages,
  myUserId,
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
}: {
  messages: ThreadMessage[];
  myUserId: string;
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
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  // Track scroll position: stick to bottom when already at the bottom.
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Re-validate the stick flag after the previous page is prepended (load more).
  useEffect(() => {
    stickToBottom.current = true;
  }, [nextCursor]);

  const wrapPlay = (m: ThreadMessage) => {
    onVoicePlay?.(m);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={onScroll}
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
        {messages.map((m) => (
          <div key={m._id} id={`msg-${m._id}`}>
            <MessageBubble
              message={m}
              myUserId={myUserId}
              onReply={readOnly ? undefined : onReply}
              onToggleReaction={readOnly ? undefined : onToggleReaction}
              onEdit={readOnly ? undefined : onEdit}
              onDelete={readOnly ? undefined : onDelete}
              onReport={readOnly ? undefined : onReport}
              onVoicePlay={readOnly ? wrapPlay : undefined}
              extraActions={extraActions}
              readOnly={readOnly}
            />
          </div>
        ))}
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
    </div>
  );
}

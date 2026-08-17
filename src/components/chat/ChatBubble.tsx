import { Download, FileText, ImageOff, Mic, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { formatBytes } from "@/lib/media";
import { formatVoiceDuration } from "@/lib/chat-media";
import { SafeImage } from "@/components/site/SafeImage";
import { senderBubbleClass } from "@/lib/sender-colors";
import { VoicePlayer } from "./VoicePlayer";

/** Shape of a message row as returned by the messages queries. */
export type ChatMessageView = {
  _id: string;
  body: string;
  kind?: string | null;
  storageId?: string | null;
  url?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  duration?: number | null;
  createdAt: number;
  senderId?: string;
  readAt?: number | null;
};

/** Cached check: can this browser decode webm audio at all? iOS Safari cannot. */
let webmAudioSupport: boolean | null = null;
function canPlayWebmAudio(): boolean {
  if (webmAudioSupport === null) {
    try {
      const probe = document.createElement("audio");
      webmAudioSupport =
        probe.canPlayType("audio/webm;codecs=opus") !== "" ||
        probe.canPlayType("audio/webm") !== "";
    } catch {
      webmAudioSupport = false;
    }
  }
  return webmAudioSupport;
}

/**
 * Renders one attachment (image / file / voice) — exported so the admin chat
 * log can show the same content without re-implementing it.
 */
export function ChatAttachmentView({
  attachment,
  mine,
  onImageClick,
}: {
  attachment: ChatMessageView;
  mine?: boolean;
  /** When provided, clicking the image opens a full-screen viewer instead of a new tab. */
  onImageClick?: () => void;
}) {
  const url = attachment.url ?? "";

  if (attachment.kind === "image") {
    if (!url) return null;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onImageClick ? (e) => { e.preventDefault(); e.stopPropagation(); onImageClick(); } : undefined}
        className="block"
        title="Open photo"
      >
        <SafeImage
          src={url}
          alt={attachment.fileName ?? "Photo"}
          loading="lazy"
          decoding="async"
          className="max-h-72 w-full max-w-[280px] rounded-xl object-cover"
          fallback={
            <span className="flex max-h-72 w-full max-w-[280px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-8 text-xs text-muted-foreground">
              <ImageOff className="size-4" /> Photo unavailable
            </span>
          }
        />
      </a>
    );
  }

  if (attachment.kind === "voice") {
    // WebM/Opus notes can't be decoded by iOS Safari — offer a download
    // instead of a player that would never start. Everything else (including
    // a missing URL, which the player re-resolves from storage) goes to the
    // custom VoicePlayer.
    const webmOnly = attachment.mimeType?.includes("webm") ?? false;
    const playable = !webmOnly || canPlayWebmAudio();
    return (
      <div className="flex items-center gap-2.5 py-0.5">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            mine ? "bg-black/10 text-black" : "bg-lime-400/15 text-lime-300",
          )}
        >
          <Mic className="size-4" />
        </span>
        {playable ? (
          <VoicePlayer
            url={attachment.url}
            storageId={attachment.storageId}
            mimeType={attachment.mimeType}
            mine={mine}
            recordedDuration={attachment.duration}
          />
        ) : url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
              mine
                ? "border-black/10 bg-black/10 hover:bg-black/15"
                : "border-white/10 bg-black/20 hover:border-lime-400/40",
            )}
            title="Download voice note"
          >
            <Download className="size-4" />
            <span className="text-xs">Voice note (download)</span>
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">Audio unavailable</span>
        )}
      </div>
    );
  }

  // File
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
        mine
          ? "border-black/10 bg-black/10 hover:bg-black/15"
          : "border-white/10 bg-black/20 hover:border-lime-400/40",
      )}
      title="Open file"
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          mine ? "bg-black/10 text-black" : "bg-lime-400/15 text-lime-300",
        )}
      >
        <FileText className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block max-w-[180px] truncate text-sm font-medium">
          {attachment.fileName || "File"}
        </span>
        <span
          className={cn(
            "block text-[11px]",
            mine ? "text-black/60" : "text-muted-foreground",
          )}
        >
          {formatBytes(attachment.fileSize ?? undefined)}
        </span>
      </span>
    </a>
  );
}

/** A single chat bubble: optional attachment + text + timestamp. */
export function ChatBubble({
  message,
  mine,
}: {
  message: ChatMessageView;
  mine: boolean;
}) {
  const hasAttachment =
    message.kind === "image" || message.kind === "file" || message.kind === "voice";

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
          mine
            ? "rounded-br-sm bg-lime-400 text-black"
            : cn("rounded-bl-sm border", senderBubbleClass(message.senderId)),
        )}
      >
        {hasAttachment && <ChatAttachmentView attachment={message} mine={mine} />}
        {message.body ? (
          <p className={cn("whitespace-pre-line", hasAttachment && "mt-1.5")}>
            {message.body}
          </p>
        ) : null}
        <div
          className={cn(
            "mt-0.5 flex items-center gap-1.5 text-[10px]",
            mine ? "text-black/60" : "text-muted-foreground",
          )}
        >
          {message.kind === "voice" && (
            <span className="inline-flex items-center gap-1">
              <Play className="size-2.5" />
              {formatVoiceDuration(message.duration) || "Voice"}
            </span>
          )}
          {message.kind === "image" && <span>📷</span>}
          {timeAgo(message.createdAt)}
        </div>
      </div>
    </div>
  );
}


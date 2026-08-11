import { Download, FileText, Mic, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { formatBytes } from "@/lib/media";
import { formatVoiceDuration } from "@/lib/chat-media";

/** Shape of a message row as returned by the messages queries. */
export type ChatMessageView = {
  _id: string;
  body: string;
  kind?: string | null;
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
}: {
  attachment: ChatMessageView;
  mine?: boolean;
}) {
  const url = attachment.url;
  if (!url) return null;

  if (attachment.kind === "image") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
        title="Open photo"
      >
        <img
          src={url}
          alt={attachment.fileName ?? "Photo"}
          loading="lazy"
          decoding="async"
          className="max-h-72 w-full max-w-[280px] rounded-xl object-cover"
        />
      </a>
    );
  }

  if (attachment.kind === "voice") {
    // Legacy notes recorded as webm/opus can't be decoded by iOS Safari —
    // offer a download instead of a broken player. New recordings are WAV
    // and play on every device.
    const webmOnly =
      attachment.mimeType?.includes("webm") ?? false;
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
          <audio
            controls
            preload="metadata"
            src={url}
            className="h-9 w-48 max-w-[200px] sm:w-56"
          />
        ) : (
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
        )}
      </div>
    );
  }

  // File
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
            : "rounded-bl-sm border border-white/10 bg-white/8 text-foreground",
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


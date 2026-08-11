import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  Check,
  ImagePlus,
  Loader2,
  Mic,
  Paperclip,
  Send,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatVoiceDuration,
  uploadChatFile,
  type ChatAttachment,
} from "@/lib/chat-media";
import {
  startVoiceRecording,
  voiceFileExtension,
  type VoiceRecording,
} from "@/lib/voice-recorder";

const VOICE_MAX_SECONDS = 60;

/**
 * Shared chat composer: text input with Enter-to-send, photo + file attach
 * buttons (uploads to Convex storage, then sends the message), and a voice
 * recorder (MediaRecorder → storage → voice message).
 *
 * `onSend` receives the final payload and must resolve only when the message
 * is sent — on error it should throw so the composer keeps the draft and
 * surfaces the error.
 */
export function ChatComposer({
  onSend,
  disabled,
  placeholder = "Type a message…",
  autoFocus,
}: {
  onSend: (payload: { body: string; attachment?: ChatAttachment }) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);

  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  // Visible upload states: "uploading" → "done" (or an error toast on
  // failure). Makes it obvious the file is being transferred rather than
  // silently stuck.
  const [uploadState, setUploadState] = useState<{
    phase: "uploading" | "done";
    label: string;
  } | null>(null);

  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const voiceHandleRef = useRef<VoiceRecording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordSecondsRef = useRef(0);

  const endRecordingSession = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    voiceHandleRef.current = null;
    recordSecondsRef.current = 0;
    setRecording(false);
    setRecordSeconds(0);
  };

  // Never leave the mic on if the composer unmounts mid-recording.
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      try {
        voiceHandleRef.current?.cancel();
      } catch {
        /* already stopped */
      }
      voiceHandleRef.current = null;
    },
    [],
  );

  const startRecording = async () => {
    if (busy || disabled) return;
    try {
      const handle = await startVoiceRecording();
      voiceHandleRef.current = handle;
      recordSecondsRef.current = 0;
      setRecordSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        const next = recordSecondsRef.current + 1;
        recordSecondsRef.current = next;
        setRecordSeconds(next);
        if (next >= VOICE_MAX_SECONDS) void finishRecording();
      }, 1000);
    } catch (err) {
      // The recorder throws friendly, already-translated errors (mic
      // denied / no mic / busy mic / unsupported browser…).
      toast.error(
        err instanceof Error
          ? err.message
          : "Voice recording isn't available in this browser.",
      );
    }
  };

  const cancelRecording = () => {
    try {
      voiceHandleRef.current?.cancel();
    } catch {
      /* already stopped */
    }
    endRecordingSession();
  };

  const finishRecording = async () => {
    const handle = voiceHandleRef.current;
    if (!handle || busy) return;
    setBusy(true);
    setUploadState({ phase: "uploading", label: "voice message" });
    try {
      const { blob, mime, seconds } = await handle.stop();
      endRecordingSession();
      const ext = voiceFileExtension(mime);
      const file = new File([blob], `voice-${Date.now()}.${ext}`, {
        type: mime,
      });
      const attachment = await uploadChatFile(
        file,
        "voice",
        () => generateUploadUrl(),
        seconds,
      );
      await onSend({ body: "", attachment });
      setUploadState({ phase: "done", label: "voice message" });
      window.setTimeout(() => setUploadState(null), 1500);
    } catch (err) {
      setUploadState(null);
      toast.error(
        err instanceof Error ? err.message : "Could not send the voice message.",
      );
    } finally {
      setBusy(false);
    }
  };

  const sendAttachment = async (
    file: File,
    kind: "image" | "file",
  ) => {
    if (busy || disabled) return;
    setBusy(true);
    setUploadState({ phase: "uploading", label: file.name });
    try {
      const actualKind: "image" | "file" =
        kind === "image" && file.type.startsWith("image/") ? "image" : "file";
      const attachment = await uploadChatFile(
        file,
        actualKind,
        () => generateUploadUrl(),
      );
      await onSend({ body: "", attachment });
      setUploadState({ phase: "done", label: file.name });
      window.setTimeout(() => setUploadState(null), 1500);
    } catch (err) {
      setUploadState(null);
      toast.error(
        err instanceof Error ? err.message : "Could not send the attachment.",
      );
    } finally {
      setBusy(false);
    }
  };

  const sendText = async () => {
    const text = body.trim();
    if (!text || busy || disabled) return;
    setBusy(true);
    try {
      await onSend({ body: text });
      setBody("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not send the message.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {uploadState && (
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium",
            uploadState.phase === "done"
              ? "bg-lime-400/10 text-lime-300"
              : "bg-white/5 text-muted-foreground",
          )}
        >
          {uploadState.phase === "uploading" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Check className="size-3" />
          )}
          {uploadState.phase === "uploading"
            ? `Uploading ${uploadState.label}…`
            : `Uploaded ${uploadState.label} — sent`}
        </div>
      )}
      <div className="flex items-center gap-1.5">
      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void sendAttachment(file, "image");
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void sendAttachment(file, "file");
          e.target.value = "";
        }}
      />

      {recording ? (
        <>
          <span className="flex shrink-0 items-center gap-1.5 px-1 text-xs font-semibold text-rose-300">
            <span className="size-2 animate-pulse rounded-full bg-rose-400" />
            {formatVoiceDuration(recordSeconds) || "0:00"}
          </span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={cancelRecording}
            disabled={busy}
            className="text-muted-foreground"
            title="Cancel recording"
          >
            <X className="size-4" />
          </Button>
          <Button
            size="icon"
            onClick={() => void finishRecording()}
            disabled={busy}
            className="shrink-0 bg-rose-500 text-white hover:bg-rose-400"
            title="Send voice message"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Square className="size-4" />
            )}
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => imageRef.current?.click()}
            disabled={busy || disabled}
            className="shrink-0 text-muted-foreground"
            title="Send a photo"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileRef.current?.click()}
            disabled={busy || disabled}
            className="shrink-0 text-muted-foreground"
            title="Send a file"
          >
            <Paperclip className="size-4" />
          </Button>
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendText();
              }
            }}
            placeholder={placeholder}
            autoFocus={autoFocus}
            disabled={disabled}
            className="border-white/10 bg-black/20"
          />
          {body.trim() ? (
            <Button
              size="icon"
              onClick={() => void sendText()}
              disabled={busy}
              className="shrink-0 bg-lime-400 text-black hover:bg-lime-300"
              title="Send message"
            >
              <Send className="size-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void startRecording()}
              disabled={busy || disabled}
              className="shrink-0 text-lime-300"
              title="Record a voice message"
            >
              <Mic className="size-4" />
            </Button>
          )}
        </>
      )}
      </div>
    </div>
  );
}

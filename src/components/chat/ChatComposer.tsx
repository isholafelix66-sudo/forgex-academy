import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
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
import {
  formatVoiceDuration,
  uploadChatFile,
  type ChatAttachment,
} from "@/lib/chat-media";

const VOICE_MAX_SECONDS = 60;

/** Best audio mime type this browser can record (Safari → mp4/aac, the rest
 *  → webm/opus). Fallback to the browser default when nothing matches. */
function pickRecordingMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m));
}

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

  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordSecondsRef = useRef(0);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const cleanupRecorder = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopTracks();
    recorderRef.current = null;
    chunksRef.current = [];
    recordSecondsRef.current = 0;
    setRecording(false);
    setRecordSeconds(0);
  };

  // Never leave the mic on if the composer unmounts mid-recording.
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current) {
        try {
          recorderRef.current.onstop = null;
          recorderRef.current.stop();
        } catch {
          /* already stopped */
        }
      }
      stopTracks();
    },
    [],
  );

  const startRecording = async () => {
    if (busy || disabled) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickRecordingMime();
      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorderRef.current = recorder;
      chunksRef.current = chunks;
      streamRef.current = stream;
      recorder.start();
      recordSecondsRef.current = 0;
      setRecordSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        const next = recordSecondsRef.current + 1;
        recordSecondsRef.current = next;
        setRecordSeconds(next);
        if (next >= VOICE_MAX_SECONDS) void finishRecording();
      }, 1000);
    } catch {
      toast.error(
        "Microphone access was denied — allow the mic in your browser settings.",
      );
    }
  };

  const stopRecorder = () =>
    new Promise<{ blob: Blob; mime: string; seconds: number }>(
      (resolve, reject) => {
        const recorder = recorderRef.current;
        if (!recorder) {
          reject(new Error("No active recording."));
          return;
        }
        recorder.onstop = () => {
          const mime = recorder.mimeType || "audio/webm";
          const blob = new Blob(chunksRef.current, { type: mime });
          const seconds = recordSecondsRef.current;
          cleanupRecorder();
          resolve({ blob, mime, seconds });
        };
        try {
          recorder.stop();
        } catch (err) {
          cleanupRecorder();
          reject(err);
        }
      },
    );

  const cancelRecording = () => {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        /* already stopped */
      }
    }
    cleanupRecorder();
  };

  const finishRecording = async () => {
    if (!recorderRef.current || busy) return;
    setBusy(true);
    try {
      const { blob, mime, seconds } = await stopRecorder();
      const ext = mime.includes("mp4")
        ? "m4a"
        : mime.includes("ogg")
          ? "ogg"
          : "webm";
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
    } catch (err) {
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
    try {
      const actualKind: "image" | "file" =
        kind === "image" && file.type.startsWith("image/") ? "image" : "file";
      const attachment = await uploadChatFile(
        file,
        actualKind,
        () => generateUploadUrl(),
      );
      await onSend({ body: "", attachment });
    } catch (err) {
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
  );
}

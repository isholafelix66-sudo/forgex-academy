import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  AtSign,
  Check,
  FileText,
  ImagePlus,
  Loader2,
  Mic,
  Paperclip,
  Send,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/media";
import { friendlyError } from "@/lib/errors";
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
import { Avatar } from "@/components/site/Avatar";

const VOICE_MAX_SECONDS = 60;

export type ComposerMember = {
  userId: string;
  name: string;
  image: string | null;
};

export type ComposerPayload = {
  body: string;
  attachment?: ChatAttachment;
  /** Resolved @mention user ids (validated server-side). */
  mentionIds?: string[];
  /** The message contains @everyone (staff only, enforced server-side). */
  mentionEveryone?: boolean;
};

/**
 * Shared chat composer: text input with Enter-to-send, photo + file attach
 * buttons (upload to Convex storage, then send), voice recorder, and an
 * optional @mention autocomplete when `members` is provided.
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
  members,
  canMentionEveryone,
  onBodyChange,
}: {
  onSend: (payload: ComposerPayload) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** Community members — enables @mention autocomplete. */
  members?: ComposerMember[];
  /** Show the @everyone option (community tutors/admins only). */
  canMentionEveryone?: boolean;
  /** Fired on every body change (typing indicator). */
  onBodyChange?: (body: string) => void;
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

  // Staged attachment — picked but not yet sent (preview before sending).
  const [pending, setPending] = useState<{
    file: File;
    kind: "image" | "file";
    previewUrl: string | null;
  } | null>(null);

  // @mention autocomplete state.
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);

  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const voiceHandleRef = useRef<VoiceRecording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordSecondsRef = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const mentionOptions = useMemo(() => {
    const q = mentionQuery.toLowerCase();
    const filtered = (members ?? []).filter(
      (m) => !q || m.name.toLowerCase().includes(q),
    );
    if (canMentionEveryone) {
      return [
        ...(q === "" || "everyone".includes(q) ? [{ userId: "everyone", name: "everyone", image: null as string | null }] : []),
        ...filtered,
      ];
    }
    return filtered;
  }, [members, mentionQuery, canMentionEveryone]);

  useEffect(() => setMentionIndex(0), [mentionQuery]);

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
        () => generateUploadUrl({}),
        seconds,
      );
      await onSend({ body: "", attachment });
      setUploadState({ phase: "done", label: "voice message" });
      window.setTimeout(() => setUploadState(null), 1500);
    } catch (err) {
      setUploadState(null);
      toast.error(
        friendlyError(err, "Could not send the voice message."),
      );
    } finally {
      setBusy(false);
    }
  };

  const pickAttachment = (file: File, kind: "image" | "file") => {
    if (busy || disabled) return;
    const actualKind: "image" | "file" =
      kind === "image" && file.type.startsWith("image/") ? "image" : "file";
    let previewUrl: string | null = null;
    if (actualKind === "image") {
      try {
        previewUrl = URL.createObjectURL(file);
      } catch {
        previewUrl = null;
      }
    }
    setPending({ file, kind: actualKind, previewUrl });
  };

  const cancelPending = () => {
    if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
  };

  const sendPendingAttachment = async () => {
    if (!pending || busy || disabled) return;
    setBusy(true);
    setUploadState({ phase: "uploading", label: pending.file.name });
    try {
      const attachment = await uploadChatFile(
        pending.file,
        pending.kind,
        () => generateUploadUrl({}),
      );
      await onSend({ body: "", attachment });
      if (pending.previewUrl) URL.revokeObjectURL(pending.previewUrl);
      setPending(null);
      setUploadState({ phase: "done", label: pending.file.name });
      window.setTimeout(() => setUploadState(null), 1500);
    } catch (err) {
      setUploadState(null);
      toast.error(
        friendlyError(err, "Could not send the attachment."),
      );
    } finally {
      setBusy(false);
    }
  };

  /** Resolve @mention tokens in the body against the member list. */
  const resolveMentions = (text: string) => {
    const mentionIds: string[] = [];
    let mentionEveryone = false;
    if (!members || !members.length) return { mentionIds: undefined, mentionEveryone: undefined };
    const lower = text.toLowerCase();
    if (/\B@everyone\b/i.test(text)) mentionEveryone = true;
    const nameMap = new Map<string, string>();
    for (const m of members) nameMap.set(m.name.toLowerCase(), m.userId);
    for (const tok of text.split(/\s+/)) {
      if (!tok.startsWith("@") || tok.length < 2) continue;
      const name = tok.slice(1).replace(/[^\p{L}\p{N}_.'-]/gu, "").toLowerCase();
      const id = nameMap.get(name);
      if (id && !mentionIds.includes(id)) mentionIds.push(id);
    }
    return {
      mentionIds: mentionIds.length ? mentionIds : undefined,
      mentionEveryone: mentionEveryone ? true : undefined,
    };
  };

  const sendText = async () => {
    const text = body.trim();
    if (!text || busy || disabled) return;
    setBusy(true);
    try {
      await onSend({
        body: text,
        ...resolveMentions(text),
      });
      setBody("");
      onBodyChange?.("");
      inputRef.current?.focus();
    } catch (err) {
      toast.error(
        friendlyError(err, "Could not send the message."),
      );
    } finally {
      setBusy(false);
    }
  };

  const handleBodyChange = (value: string) => {
    setBody(value);
    onBodyChange?.(value);
    // Detect a trailing @token to open the mention picker.
    const beforeCursor = value;
    const atIdx = beforeCursor.lastIndexOf("@");
    if (atIdx !== -1) {
      const before = beforeCursor.slice(0, atIdx);
      const sinceWhitespace = before.search(/\s$/);
      if (sinceWhitespace === -1 || atIdx > sinceWhitespace) {
        const query = beforeCursor.slice(atIdx + 1);
        if (!query.includes(" ") && !query.includes("\n")) {
          setMentionQuery(query);
          setMentionStart(atIdx);
          setMentionOpen(true);
          return;
        }
      }
    }
    setMentionOpen(false);
  };

  const insertMention = (m: { userId: string; name: string }) => {
    const next = body.slice(0, mentionStart) + `@${m.name} ` + body.slice(mentionStart + mentionQuery.length + 1);
    setBody(next);
    onBodyChange?.(next);
    setMentionOpen(false);
    inputRef.current?.focus();
  };

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen && mentionOptions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionOptions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionOptions.length) % mentionOptions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionOptions[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        setMentionOpen(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendText();
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

      {/* Staged attachment preview */}
      {pending && (
        <div className="flex items-center gap-2.5 rounded-xl border border-lime-400/25 bg-lime-400/8 px-3 py-2">
          {pending.kind === "image" && pending.previewUrl ? (
            <img
              src={pending.previewUrl}
              alt="Attachment preview"
              className="size-12 rounded-lg object-cover"
            />
          ) : (
            <span className="flex size-12 items-center justify-center rounded-lg bg-black/20 text-lime-300">
              <FileText className="size-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{pending.file.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatBytes(pending.file.size)} · ready to send
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={cancelPending}
            disabled={busy}
            className="shrink-0 text-muted-foreground"
            title="Remove attachment"
          >
            <X className="size-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => void sendPendingAttachment()}
            disabled={busy}
            className="shrink-0 gap-1.5 bg-lime-400 text-black hover:bg-lime-300"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Send
          </Button>
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
            if (file) pickAttachment(file, "image");
            e.target.value = "";
          }}
        />
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) pickAttachment(file, "file");
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
            <div className="relative min-w-0 flex-1">
              <Textarea
                ref={inputRef}
                value={body}
                onChange={(e) => handleBodyChange(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={placeholder}
                autoFocus={autoFocus}
                disabled={disabled}
                rows={1}
                className="min-h-10 max-h-28 resize-none border-white/10 bg-black/20 py-2.5"
              />
              {mentionOpen && mentionOptions.length > 0 && (
                <div className="absolute bottom-full left-0 z-30 mb-1 w-64 overflow-hidden rounded-xl border border-white/10 bg-popover shadow-2xl shadow-black/50">
                  <p className="flex items-center gap-1.5 border-b border-white/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <AtSign className="size-3" /> Mention a member
                  </p>
                  <div className="max-h-52 overflow-y-auto p-1">
                    {mentionOptions.map((m, i) => (
                      <button
                        key={m.userId}
                        type="button"
                        onMouseEnter={() => setMentionIndex(i)}
                        onClick={() => insertMention(m)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm",
                          i === mentionIndex ? "bg-lime-400/10" : "hover:bg-white/5",
                        )}
                      >
                        {m.userId === "everyone" ? (
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
                            <AtSign className="size-3.5" />
                          </span>
                        ) : (
                          <Avatar name={m.name} image={m.image} className="size-6" />
                        )}
                        <span className="truncate font-medium">
                          @{m.name}
                          {m.userId === "everyone" && (
                            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                              Tutors only
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
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

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AlertTriangle,
  Download,
  Loader2,
  Pause,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatVoiceDuration } from "@/lib/chat-media";

const SPEEDS = [1, 1.5, 2, 0.5] as const;

function fmt(sec: number) {
  return formatVoiceDuration(Math.max(0, Math.floor(sec))) || "0:00";
}

/**
 * Custom ForgeX voice-message player.
 *
 * Features: play/pause (with retry after a failure), draggable progress bar,
 * current + total duration, playback speed (1× → 1.5× → 2× → 0.5×), and the
 * recording duration as the fallback total until the file's metadata loads.
 * When the stored URL is missing it re-resolves it from Convex storage, and
 * a genuinely broken file offers an “open the audio instead” link.
 */
export function VoicePlayer({
  url,
  storageId,
  mimeType,
  mine,
  recordedDuration,
}: {
  url?: string | null;
  storageId?: string | null;
  mimeType?: string | null;
  mine?: boolean;
  recordedDuration?: number | null;
}) {
  // If the stored URL is missing, re-resolve it from Convex storage so the
  // note stays playable even when the stored URL is stale.
  const reResolved = useQuery(
    api.storage.getStorageUrl,
    !url && storageId ? { storageId: storageId as Id<"_storage"> } : "skip",
  );
  const src = url || reResolved || "";

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "playing" | "error"
  >("idle");
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);

  useEffect(() => {
    if (!src) return;
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onMeta = () =>
      setTotal(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onTime = () => setCurrent(audio.currentTime || 0);
    const onPlay = () => setStatus("playing");
    const onPause = () => setStatus((s) => (s === "playing" ? "idle" : s));
    const onEnded = () => {
      setStatus("idle");
      setCurrent(0);
      try {
        audio.currentTime = 0;
      } catch {
        /* ignore */
      }
    };
    const onError = () => {
      setStatus("error");
      setCurrent(0);
    };

    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("playing", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.src = src;
    setStatus("idle");
    setCurrent(0);
    setTotal(0);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("playing", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeAttribute("src");
      try {
        audio.load(); // abort any in-flight fetch
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    };
  }, [src]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (status === "playing") {
      audio.pause();
      return;
    }
    setStatus("loading");
    try {
      await audio.play();
      setStatus("playing");
    } catch (err) {
      // NotAllowedError = the browser wants another user gesture (iOS
      // autoplay policy) — the next tap retries, don't mark the file broken.
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "AbortError") {
        setStatus("idle");
      } else {
        setStatus("error");
      }
    }
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  };

  // Recording duration (from the message) is the fallback total until the
  // file's metadata loads.
  const duration = total || recordedDuration || 0;

  if (!src) {
    return (
      <div className="flex items-center gap-2 py-0.5 text-xs text-muted-foreground">
        <AlertTriangle className="size-3.5" />
        Audio unavailable
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 py-1">
      <button
        type="button"
        onClick={() => void toggle()}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95",
          mine ? "bg-black/10 text-black" : "bg-lime-400/15 text-lime-300",
        )}
        aria-label={status === "playing" ? "Pause" : "Play"}
        title={status === "playing" ? "Pause" : "Play"}
      >
        {status === "loading" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : status === "playing" ? (
          <Pause className="size-4" />
        ) : (
          <Play className="ml-0.5 size-4" />
        )}
      </button>

      {status === "error" ? (
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex w-fit items-center gap-1.5 text-xs font-medium underline-offset-2 hover:underline",
              mine ? "text-black/70" : "text-lime-300",
            )}
          >
            <Download className="size-3.5" />
            Can&rsquo;t play here — open the audio instead
          </a>
          <span
            className={cn(
              "text-[10px]",
              mine ? "text-black/50" : "text-muted-foreground",
            )}
          >
            Tap play to try again
          </span>
        </div>
      ) : (
        <div className="min-w-0 flex-1 space-y-0.5">
          <input
            type="range"
            min={0}
            max={Math.max(0.1, duration)}
            step={0.1}
            value={Math.min(current, duration || current)}
            onChange={(e) => {
              const audio = audioRef.current;
              if (!audio) return;
              const t = parseFloat(e.target.value);
              try {
                audio.currentTime = t;
              } catch {
                /* seek not supported */
              }
              setCurrent(t);
            }}
            className={cn(
              "w-full cursor-pointer",
              mine ? "accent-lime-700" : "accent-lime-400",
            )}
            aria-label="Seek"
          />
          <div className="flex items-center justify-between text-[10px] tabular-nums">
            <span
              className={mine ? "text-black/60" : "text-muted-foreground"}
            >
              {fmt(current)} / {fmt(duration)}
            </span>
            <button
              type="button"
              onClick={cycleSpeed}
              className={cn(
                "rounded-full px-1.5 py-0.5 font-semibold transition-colors",
                mine
                  ? "text-black/70 hover:bg-black/10"
                  : "text-lime-300 hover:bg-white/10",
              )}
              title="Playback speed"
            >
              {SPEEDS[speedIdx]}×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

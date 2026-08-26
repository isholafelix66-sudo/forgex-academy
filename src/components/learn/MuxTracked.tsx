import { useEffect, useRef } from "react";
import MuxPlayer from "@mux/mux-player-react";

/**
 * Mux-backed lesson player with heartbeat-based watch tracking.
 *
 * Kept in its own module so the ~1MB @mux/mux-player-react chunk
 * (media-chrome, hls.js, mux elements) only loads when a Mux-backed
 * lesson actually plays — VideoPlayer pulls it in lazily.
 *
 * Emits:
 * - onHeartbeat(currentTime, duration, playing) — every ~12s during playback
 * - onPause(currentTime, duration) — when the student pauses
 * - onEnded(currentTime, duration) — when the video ends
 * - onLoadedMetadata(duration) — when video duration is known
 */
export function MuxTracked({
  playbackId,
  title,
  emit,
  resumePosition,
  onHeartbeat,
  onPause,
  onEnded,
  onLoadedMetadata,
}: {
  playbackId: string;
  title: string;
  /** Saved resume position in seconds. */
  resumePosition?: number;
  /** Percentage + position progress (0–100, currentTime, duration) for instant UI updates. */
  emit: (pct: number, currentTime: number, duration: number) => void;
  /** Heartbeat: fires with current position and duration every ~12s while playing. */
  onHeartbeat?: (currentTime: number, duration: number, playing: boolean) => void;
  /** Fires when the student pauses. */
  onPause?: (currentTime: number, duration: number) => void;
  /** Fires when the video reaches the end. */
  onEnded?: (currentTime: number, duration: number) => void;
  /** Fires when video metadata loads (duration becomes available). */
  onLoadedMetadata?: (duration: number) => void;
}) {
  const ref = useRef<any>(null);
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const heartbeatRef = useRef(onHeartbeat);
  heartbeatRef.current = onHeartbeat;
  const onPauseRef = useRef(onPause);
  onPauseRef.current = onPause;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const onMetaRef = useRef(onLoadedMetadata);
  onMetaRef.current = onLoadedMetadata;
  const resumeRef = useRef(resumePosition);
  resumeRef.current = resumePosition;

  useEffect(() => {
    const el = ref.current as any;
    if (!el) return;

    // --- timeupdate → percentage + position (for instant UI) + heartbeat ---
    let lastHeartbeat = 0;
    const HEARTBEAT_INTERVAL_MS = 12_000;

    const onTime = () => {
      try {
        const ct = el.currentTime;
        const dur = el.duration;
        if (!dur || dur <= 0) return;

        // Percentage + position callback for instant UI updates
        emitRef.current((ct / dur) * 100, ct, dur);

        // Heartbeat every ~12s while playing
        const now = Date.now();
        if (
          now - lastHeartbeat >= HEARTBEAT_INTERVAL_MS &&
          !el.paused &&
          heartbeatRef.current
        ) {
          lastHeartbeat = now;
          heartbeatRef.current(ct, dur, true);
        }
      } catch {
        // ignore
      }
    };

    const onPause = () => {
      try {
        const ct = el.currentTime ?? 0;
        const dur = el.duration ?? 0;
        // Fire a final heartbeat when pausing so the server gets the position
        if (heartbeatRef.current && dur > 0) {
          heartbeatRef.current(ct, dur, false);
        }
        if (onPauseRef.current && dur > 0) {
          onPauseRef.current(ct, dur);
        }
      } catch {
        // ignore
      }
    };

    const onPlay = () => {
      lastHeartbeat = 0; // Reset so next heartbeat fires quickly
    };

    const onVideoEnded = () => {
      try {
        const ct = el.currentTime ?? 0;
        const dur = el.duration ?? 0;
        if (heartbeatRef.current && dur > 0) {
          heartbeatRef.current(ct, dur, false);
        }
        if (onEndedRef.current && dur > 0) {
          onEndedRef.current(ct, dur);
        }
      } catch {
        // ignore
      }
    };

    const onMeta = () => {
      try {
        const dur = el.duration;
        if (dur > 0) {
          // Resume from saved position if available
          const rp = resumeRef.current;
          if (rp && rp > 2 && rp < dur - 2) {
            el.currentTime = rp;
          }
          if (onMetaRef.current) onMetaRef.current(dur);
        }
      } catch {
        // ignore
      }
    };

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("pause", onPause);
    el.addEventListener("play", onPlay);
    el.addEventListener("ended", onVideoEnded);
    el.addEventListener("loadedmetadata", onMeta);

    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("ended", onVideoEnded);
      el.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
      <MuxPlayer
        ref={ref}
        playbackId={playbackId}
        streamType="on-demand"
        accentColor="#a3e635"
        metadata={{
          video_title: title,
          player_name: "ForgeX Academy",
        }}
        className="size-full"
      />
    </div>
  );
}

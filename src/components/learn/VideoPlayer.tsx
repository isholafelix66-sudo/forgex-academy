import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { PlayCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { loadYouTubeApi, YT_STATE, type YTPlayer } from "@/lib/youtubeApi";

// @mux/mux-player-react is ~1MB — loaded only when a Mux-backed lesson plays.
const MuxTracked = lazy(() => import("./MuxTracked").then((m) => ({ default: m.MuxTracked })));

export function youtubeId(url: string): string | null {
  const m =
    url.match(/youtu\.be\/([\w-]+)/) ||
    url.match(
      /(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)([\w-]+)/,
    );
  return m ? m[1] : null;
}

export function vimeoId(url: string): string | null {
  const m = url.match(/(?:vimeo\.com\/)(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

export function loomId(url: string): string | null {
  const m = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
  return m ? m[1] : null;
}

/**
 * YouTube lesson player built on the official YouTube IFrame Player API.
 *
 * The plain-iframe approach can't report playback position to the parent
 * frame, so lessons never earned watch credit. This player creates a real
 * `YT.Player`, polls `getCurrentTime()/getDuration()` once a second while
 * playing, and feeds the exact same progress/position callbacks the Mux and
 * native players use — so YouTube lessons flow into the shared
 * `lms.watchHeartbeat` / `lms.saveWatchPosition` backend unchanged.
 *
 * Emits:
 * - emit(pct, currentTime, duration) — every ~1s while playing
 * - onHeartbeat(currentTime, duration, playing) — on pause/end
 * - onSavePosition(currentTime, duration) — on pause/end/unmount
 * - onDurationReady(duration) — when duration becomes known
 * - onPlay / onPlayerPause — playback state mirrors for the parent
 */
function YouTubeTracked({
  id,
  title,
  resumePosition,
  emit,
  onHeartbeat,
  onSavePosition,
  onDurationReady,
  onPlay,
  onPlayerPause,
}: {
  id: string;
  title?: string;
  /** Saved playback position in seconds — player seeks here on ready. */
  resumePosition?: number;
  /** Percentage + position (0–100, currentTime, duration) for instant UI updates. */
  emit: (pct: number, currentTime: number, duration: number) => void;
  /** Heartbeat: current position/duration + playing flag (pause/end only). */
  onHeartbeat?: (currentTime: number, duration: number, playing: boolean) => void;
  /** Fires on pause/end/unmount to persist the resume position. */
  onSavePosition?: (positionSeconds: number, durationSeconds: number) => void;
  /** Fires when the video duration becomes known. */
  onDurationReady?: (duration: number) => void;
  /** Fires when the player starts playing. */
  onPlay?: () => void;
  /** Fires when the player pauses or ends. */
  onPlayerPause?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const emitRef = useRef(emit);
  emitRef.current = emit;
  const hbRef = useRef(onHeartbeat);
  hbRef.current = onHeartbeat;
  const saveRef = useRef(onSavePosition);
  saveRef.current = onSavePosition;
  const durationReadyRef = useRef(onDurationReady);
  durationReadyRef.current = onDurationReady;
  const playRef = useRef(onPlay);
  playRef.current = onPlay;
  const playerPauseRef = useRef(onPlayerPause);
  playerPauseRef.current = onPlayerPause;
  const resumeRef = useRef(resumePosition);
  resumeRef.current = resumePosition;
  /** Latest known position — persisted on unmount if no pause event fired. */
  const lastPosRef = useRef<{ ct: number; dur: number }>({ ct: 0, dur: 0 });

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    const el = hostRef.current;
    if (!el) return;

    const safeDur = (p: YTPlayer) => {
      const d = p.getDuration();
      return typeof d === "number" && Number.isFinite(d) && d > 0 ? d : 0;
    };
    const safeTime = (p: YTPlayer) => {
      const t = p.getCurrentTime();
      return typeof t === "number" && Number.isFinite(t) && t > 0 ? t : 0;
    };
    const tick = (p: YTPlayer) => {
      const dur = safeDur(p);
      if (dur <= 0) return;
      const ct = Math.min(dur, safeTime(p));
      lastPosRef.current = { ct, dur };
      emitRef.current((ct / dur) * 100, ct, dur);
    };

    (async () => {
      try {
        const YT = await loadYouTubeApi();
        if (cancelled || !hostRef.current) return;
        const player = new YT.Player(hostRef.current, {
          videoId: id,
          width: "100%",
          height: "100%",
          playerVars: {
            rel: 0,
            playsinline: 1,
            modestbranding: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              playerRef.current = e.target;
              const dur = safeDur(e.target);
              if (dur > 0) {
                if (durationReadyRef.current) durationReadyRef.current(dur);
                // Resume from the saved position (skip if already near the end).
                const rp = resumeRef.current;
                if (rp && rp > 2 && rp < dur - 2) {
                  try {
                    e.target.seekTo(rp, true);
                  } catch {
                    // seekTo before playback can throw in rare cases — ignore
                  }
                }
                lastPosRef.current = { ct: Math.min(dur, Math.max(0, rp ?? 0)), dur };
              }
            },
            onStateChange: (e) => {
              if (cancelled) return;
              const p = e.target;
              if (e.data === YT_STATE.PLAYING || e.data === YT_STATE.BUFFERING) {
                if (e.data === YT_STATE.PLAYING) {
                  if (playRef.current) playRef.current();
                  if (!poll) {
                    tick(p);
                    poll = setInterval(() => tick(p), 1000);
                  }
                }
              } else if (e.data === YT_STATE.PAUSED) {
                if (poll) {
                  clearInterval(poll);
                  poll = null;
                }
                if (playerPauseRef.current) playerPauseRef.current();
                const dur = safeDur(p);
                if (dur > 0) {
                  const ct = Math.min(dur, safeTime(p));
                  lastPosRef.current = { ct, dur };
                  emitRef.current((ct / dur) * 100, ct, dur);
                  if (hbRef.current) hbRef.current(ct, dur, false);
                  if (saveRef.current) saveRef.current(ct, dur);
                }
              } else if (e.data === YT_STATE.ENDED) {
                if (poll) {
                  clearInterval(poll);
                  poll = null;
                }
                const dur = safeDur(p);
                if (dur > 0) {
                  lastPosRef.current = { ct: dur, dur };
                  emitRef.current(100, dur, dur);
                  // Report the final span as playback so the server can credit
                  // the tail (short videos would otherwise stall just under the
                  // threshold), then persist the end position.
                  if (hbRef.current) hbRef.current(dur, dur, true);
                  if (playerPauseRef.current) playerPauseRef.current();
                  if (saveRef.current) saveRef.current(dur, dur);
                }
              }
            },
            onPlaybackRateChange: () => {
              // Playback continues; the poll keeps emitting current time.
            },
            onError: () => {
              if (!cancelled) setFailed(true);
            },
          },
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      // Persist the latest position when the student leaves without pausing.
      const { ct, dur } = lastPosRef.current;
      if (dur > 0 && saveRef.current) saveRef.current(ct, dur);
      try {
        playerRef.current?.destroy();
      } catch {
        // already destroyed
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, attempt]);

  if (failed) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/60 text-center">
        <TriangleAlert className="size-8 text-amber-300/80" />
        <div>
          <p className="text-sm font-medium">This video couldn&rsquo;t load</p>
          <p className="mt-1 text-xs text-muted-foreground">
            YouTube may be blocked on this network or the video is unavailable.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setAttempt((a) => a + 1);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-lime-400 px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-lime-300"
        >
          <RefreshCw className="size-3.5" /> Retry playback
        </button>
      </div>
    );
  }

  return <div ref={hostRef} aria-label={title ?? "Lesson video"} className="size-full" />;
}

export function VideoPlayer({
  url,
  type,
  title,
  muxPlaybackId,
  image,
  resumePosition,
  onProgress,
  onHeartbeat,
  onPause,
  onSavePosition,
  onDurationReady,
  onPlay,
  onPlayerPause,
}: {
  url?: string | null;
  type?: string | null;
  title?: string;
  /** Mux asset playback ID — streams via the Mux player when present. */
  muxPlaybackId?: string | null;
  /** Lesson cover image (Cloudinary) shown when the lesson has no video. */
  image?: string | null;
  /** Saved playback position in seconds — player seeks here on mount. */
  resumePosition?: number;
  /** Emits watch progress (0–100, best value so far) + position for instant UI updates. */
  onProgress?: (percent: number, currentTime: number, duration: number) => void;
  /** Heartbeat: fires with current position and duration every ~12s while playing. */
  onHeartbeat?: (currentTime: number, duration: number, playing: boolean) => void;
  /** Fires when the student pauses or navigates away. */
  onPause?: (currentTime: number, duration: number) => void;
  /** Fires on pause/unload to save resume position. */
  onSavePosition?: (positionSeconds: number, durationSeconds: number) => void;
  /** Fires when the video duration becomes known. */
  onDurationReady?: (duration: number) => void;
  /** Fires when the player starts playing. */
  onPlay?: () => void;
  /** Fires when the player pauses. */
  onPlayerPause?: () => void;
}) {
  // Only ever report the highest percent seen — the server stores the max.
  const bestRef = useRef(0);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const emit = (pct: number, currentTime: number, duration: number) => {
    if (!onProgressRef.current) return;
    const rounded = Math.round(pct);
    if (rounded > bestRef.current) {
      bestRef.current = rounded;
      onProgressRef.current(rounded, currentTime, duration);
    }
  };

  const hbRef = useRef(onHeartbeat);
  hbRef.current = onHeartbeat;
  const pauseRef = useRef(onPause);
  pauseRef.current = onPause;
  const saveRef = useRef(onSavePosition);
  saveRef.current = onSavePosition;
  const durationReadyRef = useRef(onDurationReady);
  durationReadyRef.current = onDurationReady;
  const playRef = useRef(onPlay);
  playRef.current = onPlay;
  const playerPauseRef = useRef(onPlayerPause);
  playerPauseRef.current = onPlayerPause;

  // Seeded lessons that deliberately have no recording yet carry the
  // "planned-recording" sentinel — render an honest coming-soon state
  // instead of attempting playback of a non-existent URL.
  if (url === "planned-recording") {
    return (
      <div className="flex aspect-video w-full max-w-full flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-6 text-center">
        <PlayCircle className="size-10 text-lime-400/70" />
        <p className="text-sm font-semibold text-white">Video coming soon</p>
        <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
          This lesson is planned as a video recording. Follow the notes,
          transcript and resources below and complete the practical task to
          keep building.
        </p>
      </div>
    );
  }

  // Recognized embed URLs (YouTube / Vimeo / Loom) always win — a stale Mux
  // playback ID must never shadow the video URL a tutor actually saved.
  const yt = url ? youtubeId(url) : null;
  if (yt) {
    return (
      <div className="aspect-video w-full max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
        <YouTubeTracked
          id={yt}
          title={title}
          resumePosition={resumePosition}
          emit={emit}
          onHeartbeat={hbRef.current}
          onSavePosition={saveRef.current}
          onDurationReady={durationReadyRef.current}
          onPlay={playRef.current}
          onPlayerPause={playerPauseRef.current}
        />
      </div>
    );
  }

  const vimeo = url ? vimeoId(url) : null;
  if (vimeo) {
    return (
      <VimeoTracked
        vimeo={vimeo}
        title={title ?? "Lesson video"}
        emit={emit}
        onHeartbeat={hbRef.current}
        onSavePosition={saveRef.current}
        onDurationReady={durationReadyRef.current}
        onPlay={playRef.current}
        onPlayerPause={playerPauseRef.current}
      />
    );
  }

  const loom = url ? loomId(url) : null;
  if (loom) {
    return (
      <div className="aspect-video w-full max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
        <iframe
          src={`https://www.loom.com/embed/${loom}`}
          title={title ?? "Lesson video"}
          allow="autoplay; fullscreen"
          allowFullScreen
          className="block size-full border-0"
        />
      </div>
    );
  }

  if (muxPlaybackId) {
    return (
      <Suspense
        fallback={
          <div className="flex aspect-video w-full max-w-full items-center justify-center rounded-2xl border border-white/10 bg-black/40">
            <div className="size-8 animate-spin rounded-full border-2 border-lime-400/30 border-t-lime-400" />
          </div>
        }
      >
        <MuxTracked
          playbackId={muxPlaybackId}
          title={title ?? "Lesson video"}
          emit={emit}
          resumePosition={resumePosition}
          onHeartbeat={hbRef.current}
          onPause={pauseRef.current}
          onLoadedMetadata={(dur) => {
            if (durationReadyRef.current) durationReadyRef.current(dur);
            if (saveRef.current) saveRef.current(0, dur);
          }}
        />
      </Suspense>
    );
  }

  if (!url) {
    if (image) {
      return (
        <div className="aspect-video w-full max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
          <img
            src={image}
            alt={title ?? "Lesson image"}
            className="size-full object-cover"
          />
        </div>
      );
    }
    return (
      <div className="flex aspect-video w-full max-w-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/40 text-center">
        <PlayCircle className="size-10 text-lime-400/70" />
        <p className="text-sm text-muted-foreground">
          No video for this lesson — follow the notes and resources below.
        </p>
      </div>
    );
  }

  return (
    <NativeVideo
      url={url}
      poster={image ?? undefined}
      title={title ?? "Lesson video"}
      emit={emit}
      resumePosition={resumePosition}
      onHeartbeat={hbRef.current}
      onSavePosition={saveRef.current}
      onDurationReady={durationReadyRef.current}
      onPlay={playRef.current}
      onPlayerPause={playerPauseRef.current}
    />
  );
}

/**
 * Native <video> for direct MP4 links: metadata-only preload (never downloads
 * the whole file until play), a poster when the lesson has a cover, and a
 * friendly error state with retry instead of a frozen/broken player.
 */
function NativeVideo({
  url,
  poster,
  title,
  emit,
  resumePosition,
  onHeartbeat,
  onSavePosition,
  onDurationReady,
  onPlay,
  onPlayerPause,
}: {
  url: string;
  poster?: string;
  title: string;
  emit: (pct: number, currentTime: number, duration: number) => void;
  resumePosition?: number;
  onHeartbeat?: (currentTime: number, duration: number, playing: boolean) => void;
  onSavePosition?: (positionSeconds: number, durationSeconds: number) => void;
  onDurationReady?: (duration: number) => void;
  onPlay?: () => void;
  onPlayerPause?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const hbRef = useRef(onHeartbeat);
  hbRef.current = onHeartbeat;
  const saveRef = useRef(onSavePosition);
  saveRef.current = onSavePosition;
  const durationReadyRef = useRef(onDurationReady);
  durationReadyRef.current = onDurationReady;
  const playRef = useRef(onPlay);
  playRef.current = onPlay;
  const playerPauseRef = useRef(onPlayerPause);
  playerPauseRef.current = onPlayerPause;
  const lastHbRef = useRef(0);

  if (failed) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/60 text-center">
        <TriangleAlert className="size-8 text-amber-300/80" />
        <div>
          <p className="text-sm font-medium">This video couldn&rsquo;t load</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Check your connection and try again.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setAttempt((a) => a + 1);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-lime-400 px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-lime-300"
        >
          <RefreshCw className="size-3.5" /> Retry playback
        </button>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
      <video
        key={attempt}
        controls
        src={url}
        poster={poster}
        preload="metadata"
        playsInline
        title={title}
        className="block size-full border-0"
        onError={() => setFailed(true)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration > 0) {
            emit((v.currentTime / v.duration) * 100, v.currentTime, v.duration);
            // Heartbeat every ~12s while playing
            const now = Date.now();
            if (now - lastHbRef.current >= 12_000 && !v.paused && hbRef.current) {
              lastHbRef.current = now;
              hbRef.current(v.currentTime, v.duration, true);
            }
          }
        }}
        onPlay={(e) => {
          if (playRef.current) playRef.current();
          const v = e.currentTarget;
          if (v.duration > 0 && hbRef.current) {
            lastHbRef.current = Date.now();
            hbRef.current(v.currentTime, v.duration, true);
          }
        }}
        onPause={(e) => {
          if (playerPauseRef.current) playerPauseRef.current();
          const v = e.currentTarget;
          if (v.duration > 0 && hbRef.current) {
            hbRef.current(v.currentTime, v.duration, false);
          }
          if (saveRef.current && v.duration > 0) {
            saveRef.current(v.currentTime, v.duration);
          }
        }}
        onEnded={(e) => {
          const v = e.currentTarget;
          if (v.duration > 0 && hbRef.current) {
            hbRef.current(v.currentTime, v.duration, false);
          }
        }}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.duration > 0) {
            if (durationReadyRef.current) durationReadyRef.current(v.duration);
            // Resume from saved position (skip if already near the end)
            if (resumePosition && resumePosition > 2 && resumePosition < v.duration - 2) {
              v.currentTime = resumePosition;
            }
            if (saveRef.current) saveRef.current(v.currentTime, v.duration);
          }
        }}
      >
        Your browser doesn&apos;t support video playback.
      </video>
    </div>
  );
}

function VimeoTracked({
  vimeo,
  title,
  emit,
  onHeartbeat,
  onSavePosition,
  onDurationReady,
  onPlay,
  onPlayerPause,
}: {
  vimeo: string;
  title: string;
  emit: (pct: number, currentTime: number, duration: number) => void;
  onHeartbeat?: (currentTime: number, duration: number, playing: boolean) => void;
  onSavePosition?: (positionSeconds: number, durationSeconds: number) => void;
  onDurationReady?: (duration: number) => void;
  onPlay?: () => void;
  onPlayerPause?: () => void;
}) {
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const hbRef = useRef(onHeartbeat);
  hbRef.current = onHeartbeat;
  const saveRef = useRef(onSavePosition);
  saveRef.current = onSavePosition;
  const durationReadyRef = useRef(onDurationReady);
  durationReadyRef.current = onDurationReady;
  const playRef = useRef(onPlay);
  playRef.current = onPlay;
  const playerPauseRef = useRef(onPlayerPause);
  playerPauseRef.current = onPlayerPause;
  const lastHbRef = useRef(0);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== "https://player.vimeo.com") return;
      const d = e.data as {
        event?: string;
        data?: { seconds?: number; duration?: number };
      };
      if (
        d?.event === "timeupdate" &&
        d.data?.duration &&
        d.data.duration > 0
      ) {
        const ct = d.data.seconds ?? 0;
        const dur = d.data.duration;
        emitRef.current((ct / dur) * 100, ct, dur);
        if (durationReadyRef.current) durationReadyRef.current(dur);
        const now = Date.now();
        if (now - lastHbRef.current >= 12_000 && hbRef.current) {
          lastHbRef.current = now;
          hbRef.current(ct, dur, true);
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <div className="aspect-video w-full max-w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
      <iframe
        src={`https://player.vimeo.com/video/${vimeo}`}
        title={title}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        className="block size-full border-0"
      />
    </div>
  );
}

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { PlayCircle, RefreshCw, TriangleAlert } from "lucide-react";

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
 * YouTube via a plain <iframe> embed — no IFrame API script required, so it
 * plays even under strict CSPs (`frame-src` allows youtube.com). Progress is
 * tracked from the player's `infoDelivery` postMessage events, which the
 * embed sends to the parent frame on its own.
 */
function YouTubeEmbed({
  id,
  title,
  resumePosition,
  onEmit,
  onHeartbeat,
}: {
  id: string;
  title?: string;
  resumePosition?: number;
  onEmit: (pct: number, currentTime: number, duration: number) => void;
  onHeartbeat?: (currentTime: number, duration: number, playing: boolean) => void;
}) {
  const emitRef = useRef(onEmit);
  emitRef.current = onEmit;
  const hbRef = useRef(onHeartbeat);
  hbRef.current = onHeartbeat;

  useEffect(() => {
    let lastHb = 0;
    const handler = (e: MessageEvent) => {
      if (
        e.origin !== "https://www.youtube.com" &&
        e.origin !== "https://www.youtube-nocookie.com"
      ) {
        return;
      }
      const d = e.data as {
        event?: string;
        info?: { currentTime?: number; duration?: number };
      };
      if (
        d?.event === "infoDelivery" &&
        typeof d.info?.currentTime === "number" &&
        typeof d.info?.duration === "number" &&
        d.info.duration > 0
      ) {
        const ct = d.info.currentTime;
        const dur = d.info.duration;
        emitRef.current((ct / dur) * 100, ct, dur);
        // Heartbeat every ~12s
        const now = Date.now();
        if (now - lastHb >= 12_000 && hbRef.current) {
          lastHb = now;
          hbRef.current(ct, dur, true);
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  return (
    <iframe
      src={`https://www.youtube.com/embed/${id}?rel=0&playsinline=1${resumePosition && resumePosition > 2 ? `&start=${Math.floor(resumePosition)}` : ""}`}
      title={title ?? "Lesson video"}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
      allowFullScreen
      className="size-full"
    />
  );
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
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-6 text-center">
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
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
        <YouTubeEmbed id={yt} title={title} resumePosition={resumePosition} onEmit={emit} onHeartbeat={hbRef.current} />
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
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
        <iframe
          src={`https://www.loom.com/embed/${loom}`}
          title={title ?? "Lesson video"}
          allow="autoplay; fullscreen"
          allowFullScreen
          className="size-full"
        />
      </div>
    );
  }

  if (muxPlaybackId) {
    return (
      <Suspense
        fallback={
          <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-white/10 bg-black/40">
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
        <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
          <img
            src={image}
            alt={title ?? "Lesson image"}
            className="size-full object-cover"
          />
        </div>
      );
    }
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/40 text-center">
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
    <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
      <video
        key={attempt}
        controls
        src={url}
        poster={poster}
        preload="metadata"
        playsInline
        title={title}
        className="size-full"
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
    <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
      <iframe
        src={`https://player.vimeo.com/video/${vimeo}`}
        title={title}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        className="size-full"
      />
    </div>
  );
}

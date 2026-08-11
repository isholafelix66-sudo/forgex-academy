import { useEffect, useRef, useState } from "react";
import { PlayCircle, RefreshCw, TriangleAlert } from "lucide-react";
import MuxPlayer from "@mux/mux-player-react";

export function youtubeId(url: string): string | null {
  const m =
    url.match(/youtu\.be\/([\w-]+)/) ||
    url.match(/youtube\.com\/watch\?v=([\w-]+)/) ||
    url.match(/youtube\.com\/embed\/([\w-]+)/);
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

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement,
        opts: Record<string, unknown>,
      ) => unknown;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** YouTube player driven by the official IFrame API so we can poll progress. */
function YouTubeWithProgress({
  id,
  title,
  onEmit,
}: {
  id: string;
  title?: string;
  onEmit: (pct: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const emitRef = useRef(onEmit);
  emitRef.current = onEmit;

  useEffect(() => {
    let player: any = null;
    let interval: number | null = null;
    let destroyed = false;

    const poll = () => {
      if (!player) return;
      try {
        const d = player.getDuration();
        if (d > 0) emitRef.current((player.getCurrentTime() / d) * 100);
      } catch {
        // player mid-teardown — ignore
      }
    };

    const load = () => {
      if (destroyed || !containerRef.current || !window.YT?.Player) return;
      player = new window.YT.Player(containerRef.current, {
        videoId: id,
        playerVars: { rel: 0 },
        events: {
          onStateChange: (e: { data: number }) => {
            if (e.data === 1 && interval === null) {
              interval = window.setInterval(poll, 500);
            } else if (e.data !== 1 && interval !== null) {
              window.clearInterval(interval);
              interval = null;
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      load();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        load();
      };
      if (!document.getElementById("yt-iframe-api")) {
        const tag = document.createElement("script");
        tag.id = "yt-iframe-api";
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
    }

    return () => {
      destroyed = true;
      if (interval !== null) window.clearInterval(interval);
    };
  }, [id]);

  return <div ref={containerRef} className="size-full" />;
}

export function VideoPlayer({
  url,
  type,
  title,
  muxPlaybackId,
  image,
  onProgress,
}: {
  url?: string | null;
  type?: string | null;
  title?: string;
  /** Mux asset playback ID — streams via the Mux player when present. */
  muxPlaybackId?: string | null;
  /** Lesson cover image (Cloudinary) shown when the lesson has no video. */
  image?: string | null;
  /** Emits watch progress (0–100, best value so far) for the quiz gate. */
  onProgress?: (percent: number) => void;
}) {
  // Only ever report the highest percent seen — the server stores the max.
  const bestRef = useRef(0);
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const emit = (pct: number) => {
    if (!onProgressRef.current) return;
    const rounded = Math.round(pct);
    if (rounded > bestRef.current) {
      bestRef.current = rounded;
      onProgressRef.current(rounded);
    }
  };

  if (muxPlaybackId) {
    return (
      <MuxTracked playbackId={muxPlaybackId} title={title ?? "Lesson video"} emit={emit} />
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

  const yt = youtubeId(url);
  if (yt) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
        <YouTubeWithProgress id={yt} title={title} onEmit={emit} />
      </div>
    );
  }

  const vimeo = vimeoId(url);
  if (vimeo) {
    return (
      <VimeoTracked vimeo={vimeo} title={title ?? "Lesson video"} emit={emit} />
    );
  }

  const loom = loomId(url);
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

  return <NativeVideo url={url} poster={image ?? undefined} title={title ?? "Lesson video"} emit={emit} />;
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
}: {
  url: string;
  poster?: string;
  title: string;
  emit: (pct: number) => void;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

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
          if (v.duration > 0) emit((v.currentTime / v.duration) * 100);
        }}
      >
        Your browser doesn't support video playback.
      </video>
    </div>
  );
}

function MuxTracked({
  playbackId,
  title,
  emit,
}: {
  playbackId: string;
  title: string;
  emit: (pct: number) => void;
}) {
  const ref = useRef<any>(null);
  const emitRef = useRef(emit);
  emitRef.current = emit;

  useEffect(() => {
    const el = ref.current as any;
    if (!el) return;
    const onTime = () => {
      try {
        if (el.duration > 0) emitRef.current((el.currentTime / el.duration) * 100);
      } catch {
        // ignore
      }
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
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

function VimeoTracked({
  vimeo,
  title,
  emit,
}: {
  vimeo: string;
  title: string;
  emit: (pct: number) => void;
}) {
  const emitRef = useRef(emit);
  emitRef.current = emit;

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
        emitRef.current(((d.data.seconds ?? 0) / d.data.duration) * 100);
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

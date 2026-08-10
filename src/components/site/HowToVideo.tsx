import { useState } from "react";
import { useInView } from "react-intersection-observer";
import { Clapperboard, Play } from "lucide-react";
import MuxPlayer from "@mux/mux-player-react";
import { cn } from "@/lib/utils";
import { loomId, vimeoId, youtubeId } from "@/components/learn/VideoPlayer";
import { ForgeXMotionVideo } from "@/components/site/ForgeXMotionVideo";
import type { TutorialVideoConfig } from "@/lib/tutorial-video";

/** Embedded player for the url / mux modes (autoplay after the click-through). */
function Player({
  config,
  title,
}: {
  config: Extract<TutorialVideoConfig, { mode: "url" } | { mode: "mux" }>;
  title: string;
}) {
  if (config.mode === "mux") {
    return (
      <MuxPlayer
        playbackId={config.playbackId}
        streamType="on-demand"
        accentColor="#a3e635"
        autoPlay
        metadata={{ video_title: title, player_name: "ForgeX Academy" }}
        className="size-full"
      />
    );
  }

  const url = config.url;
  const yt = youtubeId(url);
  if (yt) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${yt}?autoplay=1&rel=0`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        className="size-full"
      />
    );
  }
  const vimeo = vimeoId(url);
  if (vimeo) {
    return (
      <iframe
        src={`https://player.vimeo.com/video/${vimeo}?autoplay=1`}
        title={title}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        loading="lazy"
        className="size-full"
      />
    );
  }
  const loom = loomId(url);
  if (loom) {
    return (
      <iframe
        src={`https://www.loom.com/embed/${loom}?autoplay=1`}
        title={title}
        allow="autoplay; fullscreen"
        allowFullScreen
        loading="lazy"
        className="size-full"
      />
    );
  }
  return (
    <video src={url} controls autoPlay playsInline preload="none" className="size-full">
      Your browser doesn't support video playback.
    </video>
  );
}

/**
 * “How ForgeX Academy works” tour player for the landing page.
 *
 * Three modes (configured by admins in Admin → Website & branding):
 *   • motion — built-in animated motion film (no upload needed)
 *   • url    — YouTube / Vimeo / Loom / MP4 link
 *   • mux    — a video uploaded via Mux
 *
 * Performance-first: the real player is only mounted when the section scrolls
 * near the viewport AND the visitor clicks play — the landing page pays zero
 * loading cost for a video that may never be watched.
 */
export function HowToVideo({
  config,
  title = "How ForgeX Academy works",
}: {
  config: TutorialVideoConfig | null;
  title?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: "400px 0px",
  });

  if (!config) {
    // Even when unconfigured, show a visible placeholder so the section is
    // never blank — admins see a hint, visitors see nothing interactive.
    return (
      <div ref={ref} className="mx-auto max-w-5xl">
        <div className="relative flex aspect-video w-full items-center justify-center gap-3 overflow-hidden rounded-3xl border border-dashed border-white/10 bg-black/20 text-center">
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
            aria-hidden
          />
          <Clapperboard className="size-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground/60">
            Tutorial video not configured
          </p>
          <p className="text-xs text-muted-foreground/40">
            Set it up in Admin → Website &amp; branding
          </p>
        </div>
      </div>
    );
  }
  const effectiveTitle = config.title ?? title;
  const isMotion = config.mode === "motion";
  const showPlayer = playing && inView;

  return (
    <div ref={ref} className="group relative mx-auto max-w-5xl">
      {/* The motion film's scenes are taller than 16:9 allows on phones — a
          portrait-ish frame on small screens keeps every scene fully visible;
          real videos stay 16:9. */}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl shadow-black/60",
          isMotion ? "aspect-[3/4] sm:aspect-video" : "aspect-video",
        )}
      >
        {/* ambient lime glow — hidden on mobile: full-width blur is GPU-heavy */}
        <div
          className="pointer-events-none absolute -inset-10 hidden bg-lime-400/10 blur-3xl md:block"
          aria-hidden
        />

        {showPlayer ? (
          config.mode === "motion" ? (
            <ForgeXMotionVideo title={effectiveTitle} />
          ) : (
            <Player config={config} title={effectiveTitle} />
          )
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[radial-gradient(ellipse_at_center,rgba(163,230,53,0.14),transparent_62%)] outline-none transition-colors duration-300 hover:bg-lime-400/[0.04] focus-visible:ring-2 focus-visible:ring-lime-400/60"
            aria-label={`Play ${effectiveTitle}`}
          >
            {/* subtle blueprint grid */}
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
                backgroundSize: "44px 44px",
              }}
              aria-hidden
            />
            <span className="relative flex size-20 items-center justify-center rounded-full bg-lime-400 text-black shadow-[0_0_0_12px_rgba(163,230,53,0.14),0_0_40px_rgba(163,230,53,0.45)] transition-transform duration-300 group-hover:scale-110 sm:size-24">
              <Play className="ml-1 size-9 fill-black sm:size-10" />
            </span>
            <span className="relative inline-flex items-center gap-2 rounded-full border border-lime-400/30 bg-black/60 px-4 py-1.5 text-sm font-semibold text-lime-200 backdrop-blur">
              {config.mode === "motion" ? (
                <Clapperboard className="size-3.5 fill-lime-300 text-lime-300" />
              ) : (
                <Play className="size-3.5 fill-lime-300" />
              )}
              {effectiveTitle}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

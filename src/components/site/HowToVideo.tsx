import { useState } from "react";
import { useInView } from "react-intersection-observer";
import { Play } from "lucide-react";
import { loomId, vimeoId, youtubeId } from "@/components/learn/VideoPlayer";

function Player({ url, title }: { url: string; title: string }) {
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
    <video
      src={url}
      controls
      autoPlay
      playsInline
      preload="none"
      className="size-full"
    >
      Your browser doesn't support video playback.
    </video>
  );
}

/**
 * “How ForgeX Academy works” tour player for the landing page.
 *
 * Performance-first: the real player (iframe / <video>) is only mounted when
 * the section scrolls near the viewport AND the visitor clicks play — so the
 * landing page pays zero loading cost for a video that may never be watched.
 */
export function HowToVideo({
  url,
  title = "How ForgeX Academy works",
}: {
  url?: string | null;
  title?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: "400px 0px",
  });

  if (!url) return null;
  const showPlayer = playing && inView;

  return (
    <div ref={ref} className="group relative mx-auto max-w-5xl">
      <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl shadow-black/60">
        {/* ambient lime glow */}
        <div
          className="pointer-events-none absolute -inset-10 bg-lime-400/10 blur-3xl"
          aria-hidden
        />

        {showPlayer ? (
          <Player url={url} title={title} />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[radial-gradient(ellipse_at_center,rgba(163,230,53,0.14),transparent_62%)] outline-none transition-colors duration-300 hover:bg-lime-400/[0.04] focus-visible:ring-2 focus-visible:ring-lime-400/60"
            aria-label={`Play ${title}`}
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
              <Play className="size-3.5 fill-lime-300" />
              {title}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

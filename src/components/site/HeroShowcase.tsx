import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SafeImage } from "./SafeImage";
import { cn } from "@/lib/utils";
import type { PortfolioSlide } from "@/lib/portfolio-slides";

/**
 * HeroShowcase — the image slideshow on the Home page.
 *
 * Deliberately restrained and website-like: a crossfading image stack with
 * subtle scale, progress dots, and hover arrows on pointer devices. Every
 * slide is rendered up front so switching never flashes or re-lays out.
 *
 * Interaction model:
 *   - autoplay every `intervalMs`, paused on hover / focus / touch and while
 *     the tab is hidden (honours prefers-reduced-motion by never autoplaying)
 *   - dots jump straight to a slide
 *   - swipe (touch) and arrow-key left/right navigate
 *
 * Fully fluid: the frame uses aspect-ratio + max-width so it resizes with the
 * viewport instead of holding a fixed width.
 */
export function HeroShowcase({
  slides,
  intervalMs = 6000,
  className,
  ariaLabel = "Showcase",
}: {
  slides: PortfolioSlide[];
  intervalMs?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  // Autoplay — skipped entirely when the visitor prefers reduced motion.
  useEffect(() => {
    if (count <= 1 || paused) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setIndex((i) => (i + 1) % count);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [count, paused, intervalMs]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") go(index - 1);
    if (e.key === "ArrowRight") go(index + 1);
  };

  return (
    <div
      className={cn("w-full", className)}
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <div
        className="group relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 sm:rounded-3xl"
        onTouchStart={(e) => {
          setPaused(true);
          touchStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          setPaused(false);
          if (start === null) return;
          const end = e.changedTouches[0]?.clientX ?? start;
          const delta = end - start;
          if (Math.abs(delta) < 45) return;
          go(delta < 0 ? index + 1 : index - 1);
        }}
      >
        {/* Slide stack — all slides rendered, crossfade between them. */}
        <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
          {slides.map((slide, i) => {
            const active = i === index;
            return (
              <a
                key={slide.id}
                href={slide.href || undefined}
                target={slide.href ? "_blank" : undefined}
                rel={slide.href ? "noopener noreferrer" : undefined}
                aria-hidden={!active}
                tabIndex={active && slide.href ? 0 : -1}
                className={cn(
                  "absolute inset-0 block transition-opacity duration-700 ease-out",
                  active ? "opacity-100" : "pointer-events-none opacity-0",
                )}
              >
                <SafeImage
                  src={slide.image}
                  alt={slide.alt}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className={cn(
                    "size-full object-cover transition-transform duration-[7000ms] ease-out",
                    active ? "scale-100" : "scale-105",
                  )}
                  fallback={
                    <div className="size-full bg-gradient-to-br from-lime-400/20 via-black to-black" />
                  }
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent"
                />
                {slide.caption && (
                  <span className="absolute bottom-4 left-4 right-16 line-clamp-2 font-display text-sm font-bold tracking-tight text-white drop-shadow sm:bottom-5 sm:left-5 sm:text-base">
                    {slide.caption}
                  </span>
                )}
              </a>
            );
          })}

          {/* Hover arrows — pointer devices only, never on touch */}
          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label="Previous slide"
                className="absolute left-3 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white opacity-0 backdrop-blur transition-all hover:border-lime-400/50 hover:text-lime-300 focus-visible:opacity-100 group-hover:opacity-100 sm:flex"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label="Next slide"
                className="absolute right-3 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white opacity-0 backdrop-blur transition-all hover:border-lime-400/50 hover:text-lime-300 focus-visible:opacity-100 group-hover:opacity-100 sm:flex"
              >
                <ChevronRight className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress dots — the reference's pill/line indicator */}
      {count > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === index
                  ? "w-8 bg-lime-400"
                  : "w-4 bg-white/25 hover:bg-white/45",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

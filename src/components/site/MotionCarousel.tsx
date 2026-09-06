import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   MotionCarousel — premium, restrained carousel for the homepage sections.

   Motion model:
   - Scrolling stays NATIVE (CSS scroll-snap): real touch momentum, no JS
     drag loop fighting the browser. The JS layer only observes scroll to
     derive the active card and calls scrollTo() for autoplay/dots.
   - Active emphasis: the card nearest the viewport center eases to
     scale(1) / full opacity while neighbours ease to scale(0.96) / 88%
     opacity — a soft "focus" transition (450ms ease-out), never bouncy.
   - Autoplay: advances one card every `autoplayMs`, loops to the start,
     pauses for any user interaction (touch, pointer-down, wheel, keyboard,
     card hover/focus) and resumes `resumeMs` after the last interaction.
     It also pauses while the tab is hidden or the carousel is off-screen,
     and never runs on md+ where the row renders as a static grid.
   - All motion is disabled for prefers-reduced-motion (static scroller).
   --------------------------------------------------------------------------- */

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function MotionCarousel<T>({
  items,
  getKey,
  renderItem,
  itemClassName,
  scrollerClassName,
  ariaLabel,
  autoplayMs = 5500,
  resumeMs = 3000,
  className,
  showDots = true,
}: {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T, active: boolean) => ReactNode;
  /** Width classes for the mobile card (peek effect). */
  itemClassName: string;
  /** Extra classes for the scroller row, e.g. md+ grid columns. */
  scrollerClassName?: string;
  ariaLabel: string;
  autoplayMs?: number;
  resumeMs?: number;
  className?: string;
  showDots?: boolean;
}) {
  const reduce = useReducedMotion();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [isCarouselMode, setIsCarouselMode] = useState(false);
  const pausedRef = useRef(false); // user is interacting right now
  const resumeTimer = useRef<number | null>(null);

  /* ── Active card = the child whose center is nearest the scroller center ── */
  const updateActive = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    const children = Array.from(el.children) as HTMLElement[];
    let best = 0;
    let bestDist = Infinity;
    children.forEach((child, i) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const dist = Math.abs(childCenter - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setActive((prev) => (prev === best ? prev : best));
  }, []);

  /* Carousel mode = the row actually overflows (mobile). On md+ the row is a
     grid: no scale/opacity emphasis, no autoplay, no dots. */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const check = () =>
      setIsCarouselMode(el.scrollWidth > el.clientWidth + 24);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => updateActive();
    el.addEventListener("scroll", onScroll, { passive: true });
    updateActive();
    return () => el.removeEventListener("scroll", onScroll);
  }, [updateActive]);

  const scrollToIndex = useCallback(
    (index: number, smooth = true) => {
      const el = scrollerRef.current;
      if (!el) return;
      const children = Array.from(el.children) as HTMLElement[];
      const child = children[index];
      if (!child) return;
      el.scrollTo({
        left: child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2,
        behavior: smooth && !reduce ? "smooth" : "auto",
      });
      // Lower the momentum snap threshold so the next card becomes the
      // snap target soon after our programmatic scroll lands (mobile).        // snap to the nearest card when a programmatic scroll has finished
        setTimeout(() => {
          try {
            el.style.setProperty(
              "scrollSnapStop",
              "always" as const,
              "style" as any as string,
            );
          } catch {}
        }, 600);
    },
    [reduce],
  );

  /* ── Interaction tracking: pause immediately, resume after inactivity ── */
  const markInteraction = useCallback(() => {
    pausedRef.current = true;
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
  }, []);

  const scheduleResume = useCallback(() => {
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => {
      pausedRef.current = false;
    }, resumeMs);
  }, [resumeMs]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const opts = { passive: true } as const;
    const onStart = () => markInteraction();
    const onEnd = () => scheduleResume();
    const onWheel = () => {
      markInteraction();
      scheduleResume();
    };
    const onFocusIn = () => markInteraction();
    const onFocusOut = () => scheduleResume();
    const onEnter = () => markInteraction(); // desktop hover on a card
    const onLeave = () => scheduleResume();

    el.addEventListener("touchstart", onStart, opts);
    el.addEventListener("touchend", onEnd, opts);
    el.addEventListener("pointerdown", onStart, opts);
    el.addEventListener("pointerup", onEnd, opts);
    el.addEventListener("wheel", onWheel, opts);
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    el.addEventListener("mouseenter", onEnter, opts);
    el.addEventListener("mouseleave", onLeave, opts);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("pointerdown", onStart);
      el.removeEventListener("pointerup", onEnd);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [markInteraction, scheduleResume]);

  /* ── Autoplay loop — gentle advance, seamless loop, never while paused ── */
  useEffect(() => {
    if (reduce || !isCarouselMode || items.length < 2) return;
    const mq = window.matchMedia("(min-width: 768px)");
    if (mq.matches) return; // grid mode — no autoplay
    let onScreen = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
      },
      { threshold: 0.4 },
    );
    if (scrollerRef.current) io.observe(scrollerRef.current);

    const id = window.setInterval(() => {
      if (
        document.hidden ||
        !onScreen ||
        pausedRef.current ||
        document.activeElement?.getAttribute("data-carousel-focus") === "true"
      )
        return;
      const el = scrollerRef.current;
      if (!el || el.scrollWidth <= el.clientWidth + 24) return;
      const next = active + 1 >= items.length ? 0 : active + 1;
      scrollToIndex(next);
    }, autoplayMs);

    return () => {
      window.clearInterval(id);
      io.disconnect();
    };
  }, [active, items.length, autoplayMs, isCarouselMode, reduce, scrollToIndex]);

  useEffect(
    () => () => {
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    },
    [],
  );

  const emphasis = isCarouselMode && !reduce;

  return (
    <div className={className}>
      <div
        ref={scrollerRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={ariaLabel}
        className={cn(
          "no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-1 [scroll-padding-inline:1rem] sm:gap-4 md:mx-0 md:grid md:snap-none md:overflow-visible md:px-0",
          scrollerClassName,
        )}
      >
        {items.map((it, i) => {
          const isActive = i === active;
          return (
            <motion.div
              key={getKey(it)}
              data-carousel-focus={isActive ? "true" : undefined}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className={cn("shrink-0 snap-start", itemClassName)}
            >
              {/* Emphasis layer lives on a separate element so the tap
                  micro-interaction (framer transform) and the scroll-driven
                  focus scale (inline transform) never fight over the same
                  style property. */}
              <div
                className="h-full"
                style={
                  emphasis
                    ? {
                        transform: `scale(${isActive ? 1 : 0.96})`,
                        opacity: isActive ? 1 : 0.88,
                        transition: `transform 450ms ${EASE}, opacity 450ms ${EASE}`,
                        willChange: "transform, opacity",
                      }
                    : undefined
                }
              >
                {renderItem(it, isActive)}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pagination dots — clickable, animated active state */}
      {showDots && isCarouselMode && items.length > 1 && !reduce && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {items.map((it, i) => (
            <button
              key={getKey(it)}
              aria-label={`Go to item ${i + 1} of ${items.length}`}
              aria-current={i === active}
              onClick={() => {
                markInteraction();
                scrollToIndex(i);
                scheduleResume();
              }}
              className="p-1"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-all duration-300",
                  i === active
                    ? "w-5 bg-lime-400 shadow-[0_0_8px_rgba(166,255,0,0.5)]"
                    : "w-1.5 bg-white/20 hover:bg-white/35",
                )}
                style={{ transitionTimingFunction: EASE }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

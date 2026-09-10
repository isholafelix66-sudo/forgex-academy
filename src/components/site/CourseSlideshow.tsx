import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "@/lib/lucide";
import { cn } from "@/lib/utils";
import { CourseCard, type CourseCardData } from "@/components/site/CourseCard";

/* ---------------------------------------------------------------------------
   CourseSlideshow — premium desktop showcase for the admin-curated courses.

   Desktop behaviour (md+, where this component is rendered):
   - Slides of up to 4 course cards (3 on small tablets) fill the row.
   - Prev/next chevrons + clickable pagination dots show the active slide.
   - Gentle autoplay (6s) with seamless looping, paused while the user
     hovers/focuses/interacts, while the tab is hidden, while the section is
     off-screen, and for `prefers-reduced-motion` users.
   - Staggered card entrance on the first view; soft lift/glow on hover.

   Mobile/tablet (< md) renders the native swipe carousel instead — this
   component is not mounted there, so neither layout can disturb the other.
   --------------------------------------------------------------------------- */

const EASE = [0.22, 1, 0.36, 1] as const;

function useSlidesPerPage() {
  const [perSlide, setPerSlide] = useState(4);
  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      setPerSlide(w >= 1280 ? 4 : 3);
    };
    compute();
    window.addEventListener("resize", compute, { passive: true });
    return () => window.removeEventListener("resize", compute);
  }, []);
  return perSlide;
}

export function CourseSlideshow({ courses }: { courses: CourseCardData[] }) {
  const reduce = useReducedMotion();
  const perSlide = useSlidesPerPage();
  const pageCount = Math.ceil(courses.length / perSlide);

  const slides: CourseCardData[][] = [];
  for (let i = 0; i < courses.length; i += perSlide) {
    slides.push(courses.slice(i, i + perSlide));
  }

  const [page, setPage] = useState(0);
  const pausedRef = useRef(false);
  const resumeTimer = useRef<number | null>(null);
  const hoverRef = useRef(false);
  const regionRef = useRef<HTMLDivElement>(null);

  // Keep the active page valid when the layout resizes (e.g. 3 ↔ 4 cards).
  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(pageCount - 1, 0)));
  }, [pageCount]);

  const markInteraction = useCallback(() => {
    pausedRef.current = true;
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
  }, []);

  const scheduleResume = useCallback(
    (ms = 4000) => {
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
      resumeTimer.current = window.setTimeout(() => {
        pausedRef.current = false;
      }, ms);
    },
    [],
  );

  useEffect(
    () => () => {
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    },
    [],
  );

  const go = useCallback(
    (next: number) => {
      const count = pageCount;
      if (count < 2) return;
      setPage(((next % count) + count) % count);
    },
    [pageCount],
  );

  /* Autoplay — only when there is something to slide to. */
  useEffect(() => {
    if (reduce || pageCount < 2) return;
    let onScreen = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
      },
      { threshold: 0.35 },
    );
    if (regionRef.current) io.observe(regionRef.current);

    const id = window.setInterval(() => {
      if (document.hidden || !onScreen || pausedRef.current || hoverRef.current)
        return;
      setPage((p) => (p + 1) % pageCount);
    }, 6000);

    return () => {
      window.clearInterval(id);
      io.disconnect();
    };
  }, [pageCount, reduce]);

  if (courses.length === 0) return null;

  return (
    <div
      ref={regionRef}
      className="relative"
      onMouseEnter={() => {
        hoverRef.current = true;
        markInteraction();
      }}
      onMouseLeave={() => {
        hoverRef.current = false;
        scheduleResume();
      }}
    >
      {/* Slide viewport — overflow hidden keeps every card inside the grid. */}
      <div className="overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={`${page}-${perSlide}`}
            initial={reduce ? false : { opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, x: -40 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4"
          >
            {slides[page]?.map((c, i) => (
              <motion.div
                key={c._id}
                initial={
                  reduce
                    ? false
                    : { opacity: 0, y: 22, scale: 0.97 }
                }
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.07,
                  ease: EASE,
                }}
                whileHover={reduce ? undefined : { y: -5, scale: 1.015 }}
                style={{
                  transformPerspective: 900,
                  transformOrigin: "center",
                  transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                }}
                className="group/card h-full"
              >
                <div className="relative h-full rounded-2xl transition-shadow duration-300 group-hover/card:shadow-[0_20px_45px_-18px_rgba(166,255,0,0.28)]">
                  <CourseCard course={c} className="h-full" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Prev / next — premium circular controls, vertically centered. */}
      {pageCount > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous courses"
            onClick={() => {
              markInteraction();
              go(page - 1);
              scheduleResume();
            }}
            className="absolute -left-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-[#111311]/90 text-foreground shadow-lg shadow-black/30 backdrop-blur-xl transition-all hover:border-lime-400/50 hover:text-lime-300 lg:-left-5"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Next courses"
            onClick={() => {
              markInteraction();
              go(page + 1);
              scheduleResume();
            }}
            className="absolute -right-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-[#111311]/90 text-foreground shadow-lg shadow-black/30 backdrop-blur-xl transition-all hover:border-lime-400/50 hover:text-lime-300 lg:-right-5"
          >
            <ChevronRight className="size-5" />
          </button>
        </>
      )}

      {/* Pagination dots — the active slide is clearly emphasised. */}
      {pageCount > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1} of ${pageCount}`}
              aria-current={i === page}
              onClick={() => {
                markInteraction();
                setPage(i);
                scheduleResume();
              }}
              className="p-1"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-all duration-300",
                  i === page
                    ? "w-7 bg-lime-400 shadow-[0_0_10px_rgba(166,255,0,0.55)]"
                    : "w-2 bg-white/20 hover:bg-white/40",
                )}
                style={{ transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)" }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

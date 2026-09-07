import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  GraduationCap,
  Map,
  Play,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "@/components/site/SectionHeading";
import { CourseCard } from "@/components/site/CourseCard";
import { MotionCarousel } from "@/components/site/MotionCarousel";
import { ForgeXMotionVideo } from "@/components/site/ForgeXMotionVideo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════
   HERO SLIDESHOW — mobile-first, human visuals, no robot imagery.
   Auto-advances every 5s, pauses on touch/pointer interaction and resumes
   3s after the last interaction. Dots sit BELOW the card, never over it.
   ═══════════════════════════════════════════════════════════════════════ */

type HeroSlide = {
  tag: string;
  headline: string;
  support: string;
  ctaLabel: string;
  ctaTo: string;
  src: string;
  alt: string;
};

const HERO_SLIDES: HeroSlide[] = [
  {
    tag: "Learn",
    headline: "Learn Skills That Matter.",
    support: "Build practical skills for the real world.",
    ctaLabel: "Start Learning",
    ctaTo: "/courses",
    src: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80",
    alt: "Young people learning and building digital skills together",
  },
  {
    tag: "Career Roadmap",
    headline: "Find Your Career Path.",
    support: "Discover where your skills can take you.",
    ctaLabel: "Explore Roadmap",
    ctaTo: "/roadmap",
    src: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=1200&q=80",
    alt: "A young professional moving ahead on a clear career path",
  },
  {
    tag: "Build",
    headline: "Build. Practice. Grow.",
    support: "Turn knowledge into real experience.",
    ctaLabel: "Start Building",
    ctaTo: "/courses",
    src: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&q=80",
    alt: "A person building a real project on a laptop",
  },
  {
    tag: "Opportunities",
    headline: "Turn Skills Into Opportunities.",
    support: "Connect your learning to your future.",
    ctaLabel: "Explore Opportunities",
    ctaTo: "/dashboard",
    src: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80",
    alt: "Students collaborating on career opportunities",
  },
];

const HERO_INTERVAL_MS = 5000;
const HERO_RESUME_MS = 3000;

function HeroSlideshow() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const resumeTimer = useRef<number | null>(null);

  const pause = useCallback(() => {
    pausedRef.current = true;
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
  }, []);

  const scheduleResume = useCallback(() => {
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => {
      pausedRef.current = false;
    }, HERO_RESUME_MS);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const opts = { passive: true } as const;
    const onStart = () => pause();
    const onEnd = () => scheduleResume();
    el.addEventListener("pointerdown", onStart, opts);
    el.addEventListener("pointerup", onEnd, opts);
    el.addEventListener("touchstart", onStart, opts);
    el.addEventListener("touchend", onEnd, opts);
    el.addEventListener("wheel", () => {
      pause();
      scheduleResume();
    }, opts);
    el.addEventListener("focusin", onStart);
    el.addEventListener("focusout", onEnd);
    return () => {
      el.removeEventListener("pointerdown", onStart);
      el.removeEventListener("pointerup", onEnd);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("focusin", onStart);
      el.removeEventListener("focusout", onEnd);
    };
  }, [pause, scheduleResume]);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      if (document.hidden || pausedRef.current) return;
      setActive((prev) => (prev + 1) % HERO_SLIDES.length);
    }, HERO_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  useEffect(
    () => () => {
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    },
    [],
  );

  const slide = HERO_SLIDES[active];

  return (
    <div ref={wrapRef} className="group">
      {/* Brand tagline — compact, exactly as requested */}
      <h1 className="font-display text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
        Discover. Express.{" "}
        <span className="text-gradient">Build.</span>
      </h1>

      {/* Slide card — full-width on mobile, wider on desktop */}
      <div className="relative mt-5 w-full overflow-hidden rounded-2xl ring-1 ring-white/10 sm:mt-6 lg:mx-auto lg:max-w-5xl">
        <div className="relative aspect-[4/3] w-full bg-[#05070a] sm:aspect-[16/9]">
          {HERO_SLIDES.map((s, i) => (
            <motion.div
              key={s.tag}
              initial={false}
              animate={{ opacity: i === active ? 1 : 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0"
              aria-hidden={i !== active}
            >
              <img
                src={s.src}
                alt={s.alt}
                width={1200}
                height={800}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 z-10 p-5 sm:p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-lime-300">
                  {s.tag}
                </p>
                <h2 className="font-display mt-2 max-w-md text-2xl font-bold leading-tight text-white sm:text-4xl">
                  {s.headline}
                </h2>
                <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-white/80 sm:text-sm">
                  {s.support}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTAs — one equal-height row, arrows inside, never clipped */}
      <div className="mt-4 flex w-full items-center gap-3 sm:mx-auto sm:w-auto sm:min-w-[460px] sm:gap-4">
        <Button
          asChild
          className="h-12 flex-1 bg-lime-400 text-sm font-semibold text-black hover:bg-lime-300 glow-lime-soft sm:max-w-[220px]"
        >
          <Link to={slide.ctaTo} onClick={pause}>
            {slide.ctaLabel}
            <ArrowRight className="ml-1.5 size-4 shrink-0" />
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-12 flex-1 border-white/15 text-sm font-medium hover:border-lime-400/40 hover:text-lime-300 sm:max-w-[220px]"
        >
          <Link to="/roadmap" onClick={pause}>
            Explore Roadmaps
          </Link>
        </Button>
      </div>

      {/* Pagination dots — dedicated row BELOW the buttons, never overlapping */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {HERO_SLIDES.map((s, i) => (
          <button
            key={s.tag}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === active}
            onClick={() => {
              pause();
              setActive(i);
              scheduleResume();
            }}
            className="p-1"
          >
            <span
              className={cn(
                "block h-1.5 rounded-full transition-all duration-500",
                i === active
                  ? "w-6 bg-lime-400 shadow-[0_0_10px_rgba(166,255,0,0.6)]"
                  : "w-1.5 bg-white/25 hover:bg-white/45",
              )}
              style={{ transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
            />
          </button>
        ))}
      </div>

      {/* Benefits — compact row beneath the hero */}
      <ul className="mx-auto mt-5 flex max-w-md flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:max-w-2xl">
        {[
          "Free to start",
          "Verifiable certificates",
          "Learn at your pace",
        ].map((b) => (
          <li key={b} className="flex items-center gap-1.5">
            <span className="flex size-4.5 items-center justify-center rounded-full bg-lime-400/15 text-lime-300">
              <Check className="size-3" strokeWidth={3} />
            </span>
            <span className="text-[13px] text-muted-foreground">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════ */

const VALUE_PROPS = [
  { icon: Map, title: "Structured", sub: "learning paths" },
  { icon: GraduationCap, title: "Expert", sub: "tutors" },
  { icon: ShieldCheck, title: "Verified", sub: "certificates" },
];

export default function Landing() {
  const featured = useQuery(api.public.featuredCourses);
  const categories = useQuery(api.public.categoriesList);
  const stats = useQuery(api.public.stats);
  const continueLearning = useQuery(api.public.myContinueLearning);
  const prompts = useQuery(api.prompts.listFeatured);

  const current = continueLearning?.[0];
  const promptTeasers = prompts?.slice(0, 3);

  return (
    <PageShell>
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 sm:pt-14">
        <HeroSlideshow />
      </section>

      {/* ── CONTINUE LEARNING — only when the signed-in student has real progress ── */}
      {current && (
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
          <Reveal>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold sm:text-xl">
                Continue learning
              </h2>
              <Link
                to="/dashboard/my-courses"
                className="inline-flex items-center gap-1 text-sm font-medium text-lime-300 hover:underline"
              >
                My courses <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <Link
              to={`/courses/${current.course.slug}`}
              className="card-lift mt-4 flex items-center gap-4 rounded-2xl border border-white/10 bg-card p-4"
            >
              <div className="relative hidden h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-lime-400/25 to-emerald-500/10 sm:block">
                {current.course.image ? (
                  <img
                    src={current.course.image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-2xl">
                    {current.course.icon ?? "📘"}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-semibold">
                  {current.course.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {current.completedLessons}/{current.totalLessons} lessons ·{" "}
                  {current.progress}% complete
                </p>
                <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-lime-400"
                    style={{ width: `${current.progress}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-lime-400 px-4 py-2 text-xs font-bold text-black">
                Continue
              </span>
            </Link>
          </Reveal>
        </section>
      )}

      {/* ── VALUE PROPS — compact, three-up ──────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <Reveal>
          <div className="grid grid-cols-3 gap-3">
            {VALUE_PROPS.map((v) => (
              <div
                key={v.title}
                className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-card px-3 py-5 text-center"
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                  <v.icon className="size-4.5" />
                </span>
                <p className="text-[13px] font-semibold leading-tight">
                  {v.title}
                  <span className="block font-normal text-muted-foreground">
                    {v.sub}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── EXPLORE COURSES — real data, motion carousel on mobile ───── */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <SectionHeading
            align="left"
            eyebrow="Course catalog"
            title="Explore courses"
            description="Build skills in the areas that matter."
            className="flex-1"
          />
          <Link
            to="/courses"
            className="mb-1 hidden shrink-0 items-center gap-1 text-sm font-medium text-lime-300 hover:underline sm:inline-flex"
          >
            View all <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="mt-6">
          {featured === undefined ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-72 animate-pulse rounded-2xl border border-white/8 bg-card"
                />
              ))}
            </div>
          ) : featured.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                New courses are being prepared — check back soon.
              </p>
            </div>
          ) : (
            <>
              <MotionCarousel
                items={featured}
                getKey={(c) => c._id}
                ariaLabel="Featured courses"
                itemClassName="w-[78vw] max-w-[300px] sm:w-[320px]"
                scrollerClassName="md:grid-cols-3"
                renderItem={(c) => <CourseCard course={c} className="h-full" />}
              />
              <Link
                to="/courses"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-lime-300 hover:underline sm:hidden"
              >
                View all courses <ArrowRight className="size-3.5" />
              </Link>
            </>
          )}
        </div>
      </section>

      {/* ── CATEGORIES — real pills, horizontal scroll ───────────────── */}
      {categories && categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
          <SectionHeading align="left" eyebrow="Browse" title="Categories" />
          <Reveal delay={0.05} className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
            {categories.map((c) => (
              <Link
                key={c._id}
                to={`/courses?category=${c.slug}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
              >
                <span aria-hidden>{c.icon}</span>
                {c.name}
              </Link>
            ))}
          </Reveal>
        </section>
      )}

      {/* ── STATS — compact, real numbers ────────────────────────────── */}
      {stats && (
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
          <Reveal>
            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-card p-6 text-center sm:p-8">
              {[
                { value: `${stats.courses}+`, label: "Courses" },
                { value: `${stats.tutors}`, label: "Expert tutors" },
                { value: `${stats.certificates}`, label: "Certificates" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="font-display text-2xl font-bold text-gradient sm:text-3xl">
                    {s.value}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      {/* ── WATCH THE TOUR — existing real motion film ───────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <SectionHeading
          align="left"
          eyebrow="Watch the tour"
          title="ForgeX in two minutes"
        />
        <Reveal delay={0.05} className="mt-6">
          <div className="mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-2xl border border-white/10 sm:aspect-video sm:max-w-3xl">
            <ForgeXMotionVideo />
          </div>
        </Reveal>
      </section>

      {/* ── PROMPT LIBRARY + AI HUB — real content teasers ───────────── */}
      {promptTeasers && promptTeasers.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <SectionHeading
              align="left"
              eyebrow="ForgeX Prompt Library"
              title="Prompts that work"
              className="flex-1"
            />
            <Link
              to="/prompts"
              className="mb-1 hidden shrink-0 items-center gap-1 text-sm font-medium text-lime-300 hover:underline sm:inline-flex"
            >
              Explore useful prompts <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {promptTeasers.map((p) => (
              <Reveal key={p._id}>
                <Link
                  to={`/prompts/${p.slug}`}
                  className="card-lift flex h-full flex-col rounded-2xl border border-white/10 bg-card p-4 transition-colors hover:border-lime-400/35"
                >
                  <span className="w-fit rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {p.categoryName}
                  </span>
                  <h3 className="font-display mt-3 line-clamp-2 text-sm font-semibold leading-snug">
                    {p.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {p.description}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-medium text-lime-300">
                    View prompt <ArrowRight className="size-3" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ── AI HUB LINK ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <Reveal>
          <Link
            to="/ai-hub"
            className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-card p-5 transition-colors hover:border-lime-400/35"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
              <Sparkles className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-display block text-sm font-semibold group-hover:text-lime-300 sm:text-base">
                Visit the AI Hub
              </span>
              <span className="text-xs text-muted-foreground sm:text-sm">
                Curated AI tools, tutorials and setup guides.
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-lime-300" />
          </Link>
        </Reveal>
      </section>
    </PageShell>
  );
}


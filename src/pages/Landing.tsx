import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  UserCheck,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "@/components/site/SectionHeading";
import { CourseCard, type CourseCardData } from "@/components/site/CourseCard";
import { MotionCarousel } from "@/components/site/MotionCarousel";
import { CourseSlideshow } from "@/components/site/CourseSlideshow";
import { ForgeXMotionVideo } from "@/components/site/ForgeXMotionVideo";
import { CategoryIcon } from "@/components/site/CategoryIcon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { courseCoverFor } from "@/lib/course-covers";
import {
  normalizeHeroSlides,
  type HeroSlide,
} from "@/lib/hero-slides";

/* ═══════════════════════════════════════════════════════════════════════
   HERO SLIDESHOW — mobile-first, human visuals, no robot imagery.
   Auto-advances every 5s, pauses on touch/pointer interaction and resumes
   3s after the last interaction. Dots sit BELOW the card, never over it.
   ═══════════════════════════════════════════════════════════════════════ */

const HERO_INTERVAL_MS = 5000;
const HERO_RESUME_MS = 3000;

/**
 * A hero photo that never leaves a slide blank: if the primary URL fails to
 * load (flaky network, regional CDN hiccup), it silently swaps to a verified
 * fallback image, and only gives up (showing the branded gradient) if both
 * fail. All slides render eagerly so the next image is always ready before
 * the slideshow advances.
 */
function HeroImage({
  src,
  fallbackSrc,
  alt,
}: {
  src: string;
  fallbackSrc?: string;
  alt: string;
}) {
  const [current, setCurrent] = useState(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrent(src);
    setFailed(false);
  }, [src, fallbackSrc]);

  if (failed) return null;

  return (
    <img
      src={current}
      alt={alt}
      width={1200}
      height={800}
      loading="eager"
      decoding="async"
      onError={() => {
        if (fallbackSrc && current !== fallbackSrc) setCurrent(fallbackSrc);
        else setFailed(true);
      }}
      className="relative h-full w-full object-cover"
    />
  );
}

function HeroSlideshow() {
  // Admin-managed slides (Admin → Website & branding → Hero slideshow).
  // While loading or when nothing is stored, `normalizeHeroSlides` renders
  // the built-in defaults — the hero is never blank.
  const stored = useQuery(api.public.siteContent, { key: "heroSlides" });
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const resumeTimer = useRef<number | null>(null);

  const slides = useMemo(() => normalizeHeroSlides(stored), [stored]);

  // Warm the browser image cache for every slide (and its fallback) as soon
  // as the hero mounts, so each slide's photo is always ready the moment it
  // becomes active — no blank/gradient placeholder on the first rotation.
  useEffect(() => {
    for (const s of slides) {
      const img = new Image();
      img.src = s.src;
      if (s.fallbackSrc) {
        const fb = new Image();
        fb.src = s.fallbackSrc;
      }
    }
  }, [slides]);

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
    if (reduce || slides.length <= 1) return;
    const id = window.setInterval(() => {
      if (document.hidden || pausedRef.current) return;
      setActive((prev) => (prev + 1) % slides.length);
    }, HERO_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [reduce, slides.length]);

  useEffect(
    () => () => {
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    },
    [],
  );

  return (
    <div ref={wrapRef} className="group">
      {/* Brand tagline — compact, exactly as requested */}
      <h1 className="font-display text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
        Discover. Express.{" "}
        <span className="text-gradient">Build.</span>
      </h1>

      {/* Slide card — full-width on mobile, wider + centered on desktop */}
      <div className="relative mt-5 w-full overflow-hidden rounded-2xl ring-1 ring-white/10 sm:mt-6 lg:mx-auto lg:max-w-5xl">
        <div className="relative aspect-[4/3] w-full bg-[#05070a] sm:aspect-[16/9]">
          {slides.map((s, i) => (
            <motion.div
              key={`${s.tag}-${i}`}
              initial={false}
              animate={{ opacity: i === active ? 1 : 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "absolute inset-0",
                i === active ? "pointer-events-auto" : "pointer-events-none",
              )}
              aria-hidden={i !== active}
              inert={i !== active ? true : undefined}
            >
              {/* Branded placeholder while the photo streams in — never a blank box */}
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-br from-[#10150e] via-[#0a0d0a] to-[#1a2410]"
              />
              <HeroImage src={s.src} fallbackSrc={s.fallbackSrc} alt={s.alt} />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
              {/* Desktop: hero text + CTAs are one centered, bottom-anchored block. Mobile/tablet stay left-aligned as before. */}
              <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col p-5 sm:p-7 lg:items-center lg:pb-8 lg:text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-lime-300">
                  {s.tag}
                </p>
                <h2 className="font-display mt-2 max-w-md text-2xl font-bold leading-tight text-white sm:text-4xl lg:max-w-2xl">
                  {s.headline}
                </h2>
                <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-white/80 sm:text-sm lg:max-w-xl">
                  {s.support}
                </p>
                {/* CTAs — DESKTOP ONLY (lg+): dedicated buttons inside the
                    hero card, centered directly beneath the text. Mobile and
                    tablet read the slide text without buttons; they reach
                    courses via the nav. */}
                <div className="mt-5 hidden items-center gap-4 lg:flex">
                  <Button
                    asChild
                    className="h-12 bg-lime-400 text-sm font-semibold text-black hover:bg-lime-300 glow-lime-soft"
                  >
                    <Link to={s.ctaTo} onClick={pause}>
                      {s.ctaLabel}
                      <ArrowRight className="ml-1.5 size-4 shrink-0" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="h-12 border-white/15 text-sm font-medium hover:border-lime-400/40 hover:text-lime-300"
                  >
                    <Link to="/roadmap" onClick={pause}>
                      Explore Roadmaps
                    </Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Pagination dots — dedicated row BELOW the card, never overlapping */}
      <div className="mt-4 flex items-center justify-center gap-2">
        {slides.map((s, i) => (
          <button
            key={`dot-${s.tag}-${i}`}
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
   CATEGORY MARQUEE — infinite auto-scrolling pill track.
   The row is duplicated exactly once and the track translates by -50%, so
   the loop point is invisible. Hover (desktop) or touch (mobile) pauses the
   drift; reduced-motion users get a plain horizontal scroll instead.
   ═══════════════════════════════════════════════════════════════════════ */

type MarqueeCategory = {
  _id: string;
  slug: string;
  name: string;
  icon?: string | null;
  color?: string | null;
};

function CategoryMarquee({ categories }: { categories: MarqueeCategory[] }) {
  const [paused, setPaused] = useState(false);
  // ~2.4s per category keeps the drift calm but alive; clamp so tiny lists
  // don't crawl across the screen.
  const duration = Math.max(18, categories.length * 2.4);
  const track = [...categories, ...categories];

  return (
    <div
      className="mt-5 overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 16px, black calc(100% - 16px), transparent)",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div
        className="animate-marquee flex w-max flex-nowrap whitespace-nowrap"
        style={{
          animationDuration: `${duration}s`,
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        {track.map((c, i) => (
          <Link
            key={`${c._id}-${i}`}
            to={`/courses?category=${c.slug}`}
            className="group mr-2 inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-lime-400/40 hover:text-lime-300"
          >
            <CategoryIcon
              name={c.icon}
              color={c.color}
              className="size-4 shrink-0 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110"
            />
            {c.name}
          </Link>
        ))}
      </div>
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

/** Cover for the "Continue learning" card that never shows a broken image:
 *  if the stored course photo fails to load it swaps to the curated cover,
 *  and finally to the course's emoji icon. */
function ContinueCover({
  image,
  slug,
  icon,
}: {
  image?: string | null;
  slug: string;
  icon?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const effective = failed ? (courseCoverFor(slug) ?? null) : (image ?? null);
  return effective ? (
    <img
      src={effective}
      alt=""
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
    />
  ) : (
    <span className="flex h-full w-full items-center justify-center text-2xl">
      {icon ?? "📘"}
    </span>
  );
}

export default function Landing() {
  const reduce = useReducedMotion();
  const { user } = useAuth();
  const displayName =
    (user?.name ?? "").trim() || (user?.email ?? "").split("@")[0] || "there";
  // Admin-curated slideshows with SEPARATE desktop and mobile selections.
  const featured = useQuery(api.public.featuredCourseSlideshows);
  const desktopList = featured?.desktop ?? [];
  const mobileList = featured?.mobile ?? [];
  const categories = useQuery(api.public.categoriesList);
  const stats = useQuery(api.public.stats);
  const continueLearning = useQuery(api.public.myContinueLearning);
  const prompts = useQuery(api.prompts.listFeatured);

  const current = continueLearning?.[0];
  const personalizedHeadline = current
    ? `Pick up where ${displayName} left off`
    : `Hello, ${displayName}!`;
  const personalizedSupport = current
    ? `${displayName}, your learning streak is ready to grow.`
    : `ForgeX is built for ${displayName} — learn, build and earn. Ready when you are.`;
  const promptTeasers = prompts?.slice(0, 3);

  return (
    <PageShell>
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 sm:pt-14">
        <HeroSlideshow />
        <div className="mt-4 text-center">
          <p className="text-sm font-medium text-lime-300">
            {personalizedHeadline}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {personalizedSupport}
          </p>
        </div>
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
                <ContinueCover
                  image={current.course.image}
                  slug={current.course.slug}
                  icon={current.course.icon}
                />
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
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-72 animate-pulse rounded-2xl border border-white/8 bg-card"
                />
              ))}
            </div>
          ) : desktopList.length === 0 && mobileList.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">
                New courses are being prepared — check back soon.
              </p>
            </div>
          ) : (
            <>
              {/* MOBILE/TABLET — native swipe carousel fed by the admin's
                  MOBILE selection (mirrors the desktop selection when no
                  separate mobile list was saved). */}
              <div className="md:hidden">
                {mobileList.length > 0 && (
                  <>
                    <MotionCarousel
                      items={mobileList}
                      getKey={(c) => c._id}
                      ariaLabel="Featured courses"
                      itemClassName="w-[78vw] max-w-[300px] sm:w-[320px]"
                      renderItem={(c) => <CourseCard course={c} className="h-full" />}
                    />
                    <Link
                      to="/courses"
                      className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-lime-300 hover:underline"
                    >
                      View all courses <ArrowRight className="size-3.5" />
                    </Link>
                  </>
                )}
              </div>

              {/* DESKTOP (md+) — premium admin-curated slideshow fed by the
                  admin's DESKTOP selection: pages of course cards with
                  prev/next, autoplay and active dots. Separate renderer so
                  the mobile carousel is untouched. */}
              <div className="hidden md:block">
                {desktopList.length > 0 && (
                  <CourseSlideshow courses={desktopList} />
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── CATEGORIES — infinite auto-scrolling marquee, pauses on hover/touch ── */}
      {categories && categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
          <SectionHeading align="left" eyebrow="Browse" title="Categories" />
          {reduce ? (
            <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
              {categories.map((c) => (
                <Link
                  key={c._id}
                  to={`/courses?category=${c.slug}`}
                  className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
                >
                  <CategoryIcon name={c.icon} color={c.color} className="size-4 shrink-0" />
                  {c.name}
                </Link>
              ))}
            </div>
          ) : (
            <CategoryMarquee categories={categories} />
          )}
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
          <div className="mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 sm:aspect-[16/11] sm:max-w-3xl">
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


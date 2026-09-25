import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Map as MapIcon,
  Megaphone,
  PlayCircle,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Avatar } from "@/components/site/Avatar";
import { SafeImage } from "@/components/site/SafeImage";
import { Stat } from "@/components/site/Stat";
import { CourseSlideshow } from "@/components/site/CourseSlideshow";
import { MotionCarousel } from "@/components/site/MotionCarousel";
import { CourseCard } from "@/components/site/CourseCard";
import { TutorCard } from "@/components/site/TutorCard";
import { HowToVideo } from "@/components/site/HowToVideo";
import { HeroRobot } from "@/components/site/HeroRobot";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { normalizeHeroSlides, type HeroSlide } from "@/lib/hero-slides";
import { parseTutorialVideo } from "@/lib/tutorial-video";

/* --------------------------------------------------------------------------- */
/*  Defaults — used only when the admin has not published custom homepage copy */
/* --------------------------------------------------------------------------- */

const DEFAULT_HERO_TITLE = "Learn. Build. Succeed.";
const DEFAULT_HERO_SUBTITLE =
  "Practical, industry-relevant learning that prepares you for real-world opportunities — structured roadmaps, verified tutors, and certificates that mean something.";

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/* --------------------------------------------------------------------------- */
/*  Hero rotator — the admin-curated slides behind the hero copy               */
/* --------------------------------------------------------------------------- */

function HeroSlides({
  slides,
  robotSrc,
}: {
  slides: HeroSlide[];
  robotSrc?: string;
}) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const count = slides.length;

  useEffect(() => {
    if (count <= 1 || reduce) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setIndex((i) => (i + 1) % count);
    }, 6500);
    return () => window.clearInterval(id);
  }, [count, reduce]);

  if (count === 0) return null;
  const active = slides[index];

  return (
    <div className="relative">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40 sm:aspect-[16/11]">
        <AnimatePresence initial={false}>
          <motion.div
            key={active.src + index}
            initial={reduce ? false : { opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <SafeImage
              src={active.src}
              alt={active.alt}
              loading={index === 0 ? "eager" : "lazy"}
              className="size-full object-cover"
              fallback={
                <div className="size-full bg-gradient-to-br from-lime-400/25 via-black to-black" />
              }
            />
          </motion.div>
        </AnimatePresence>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
        />

        {/* Active slide copy + its own CTA */}
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <motion.div
            key={active.tag + index}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/30 bg-black/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-lime-300 backdrop-blur">
              <Sparkles className="size-3" />
              {active.tag}
            </span>
            <p className="font-display mt-3 max-w-md text-lg font-bold leading-snug text-white drop-shadow sm:text-xl">
              {active.headline}
            </p>
            {active.support && (
              <p className="mt-1 max-w-md text-sm text-white/70">{active.support}</p>
            )}
            <Link
              to={active.ctaTo}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-lime-300 transition-colors hover:text-lime-200"
            >
              {active.ctaLabel}
              <ArrowRight className="size-4" />
            </Link>
          </motion.div>
        </div>
      </div>

      {/* The official mascot floats over the hero visual */}
      {robotSrc && (
        <div className="pointer-events-none absolute -right-2 -top-8 hidden w-32 sm:block lg:w-40">
          <HeroRobot imageSrc={robotSrc} />
        </div>
      )}

      {/* Slide indicators */}
      {count > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.src + i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === index ? "w-8 bg-lime-400" : "w-4 bg-white/25 hover:bg-white/45",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------- */
/*  Homepage                                                                   */
/* --------------------------------------------------------------------------- */

export default function AcademyHome() {
  const { isAuthenticated } = useAuth();
  const content = useQuery(api.public.siteContentAll);
  const slideshows = useQuery(api.public.featuredCourseSlideshows);
  const tutors = useQuery(api.public.popularTutors);
  const roadmaps = useQuery(api.public.roadmapsAll);
  const announcements = useQuery(api.public.announcementsList);
  const updates = useQuery(api.public.updatesList);
  const stories = useQuery(api.stories.featuredStories);
  const stats = useQuery(api.public.stats);
  const continueLearning = useQuery(
    api.public.myContinueLearning,
    isAuthenticated ? {} : "skip",
  );

  const heroTitle = str(content?.heroTitle) ?? DEFAULT_HERO_TITLE;
  const heroSubtitle = str(content?.heroSubtitle) ?? DEFAULT_HERO_SUBTITLE;
  const robotSrc = str(content?.heroImage) ?? undefined;
  const heroSlides = useMemo(
    () => normalizeHeroSlides(content?.heroSlides),
    [content?.heroSlides],
  );
  const tutorialVideo = useMemo(
    () => parseTutorialVideo(content?.tutorialVideo),
    [content?.tutorialVideo],
  );

  const desktopCourses = slideshows?.desktop ?? [];
  const mobileCourses = slideshows?.mobile ?? desktopCourses;

  const featuredRoadmaps = (roadmaps ?? []).slice(0, 3);
  const topTutors = (tutors ?? []).slice(0, 4);
  const homeStories = (stories ?? []).slice(0, 3);
  const recentUpdates = (updates ?? []).slice(0, 3);
  const latestAnnouncement = (announcements ?? [])[0] ?? null;
  const continueCourse = continueLearning?.[0]?.course ?? null;

  return (
    <div className="relative overflow-x-clip">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[min(90%,56rem)] -translate-x-1/2 rounded-full bg-lime-400/10 blur-[130px]"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-16 lg:grid-cols-[1.02fr_1fr] lg:gap-14 lg:pt-20">
          <div className="min-w-0">
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-2 rounded-full border border-lime-400/25 bg-lime-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-lime-300"
            >
              <GraduationCap className="size-3.5" />
              ForgeX Academy
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
              className="font-display mt-5 text-[2.6rem] font-extrabold leading-[1.03] tracking-tight sm:text-5xl lg:text-6xl"
            >
              {heroTitle}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              {heroSubtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.18 }}
              className="mt-7 flex flex-wrap items-center gap-3"
            >
              <Link to="/academy/courses">
                <Button
                  size="lg"
                  className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300 glow-lime-soft"
                >
                  <BookOpen className="size-4" />
                  Explore courses
                </Button>
              </Link>
              <Link to="/academy/login?mode=signup">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 border-white/15 hover:border-lime-400/40 hover:text-lime-300"
                >
                  Join ForgeX free
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </motion.div>

            {/* Continue learning — signed-in students only */}
            {continueCourse && (
              <Reveal className="mt-6">
                <Link
                  to={`/academy/learn/${continueCourse.slug}`}
                  className="group inline-flex max-w-full items-center gap-3 rounded-2xl border border-lime-400/25 bg-lime-400/5 p-3 pr-4 transition-colors hover:border-lime-400/45"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400/15 text-lime-300">
                    <PlayCircle className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold uppercase tracking-widest text-lime-400/80">
                      Continue learning
                    </span>
                    <span className="block truncate text-sm font-medium">
                      {continueCourse.title}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-lime-300 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Reveal>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0 w-full"
          >
            <HeroSlides slides={heroSlides} robotSrc={robotSrc} />
          </motion.div>
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      {stats && (
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
          <div className="grid gap-6 rounded-3xl border border-white/10 bg-card p-8 sm:grid-cols-2 lg:grid-cols-4">
            <Stat value={`${stats.courses}`} label="Courses published" />
            <Stat value={`${stats.tutors}`} label="Verified tutors" delay={0.05} />
            <Stat value={`${stats.students}`} label="Learners" delay={0.1} />
            <Stat value={`${stats.certificates}`} label="Certificates issued" delay={0.15} />
          </div>
        </section>
      )}

      {/* ── Featured courses ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            align="left"
            eyebrow="Featured courses"
            title="Start with what moves you"
            description="Hand-picked, project-driven courses across design, development, data, business and marketing."
          />
          <Link
            to="/academy/courses"
            className="group inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-lime-300 transition-colors hover:text-lime-200"
          >
            Browse all courses
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="mt-8">
          {desktopCourses.length === 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-80 animate-pulse rounded-2xl border border-white/8 bg-card"
                />
              ))}
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <CourseSlideshow courses={desktopCourses} />
              </div>
              <div className="md:hidden">
                <MotionCarousel
                  items={mobileCourses}
                  getKey={(c) => c._id}
                  ariaLabel="Featured courses"
                  itemClassName="w-[78%] max-w-xs"
                  renderItem={(c) => <CourseCard course={c} className="h-full" />}
                />
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Tutorial video ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
        <SectionHeading
          eyebrow="ForgeX in two minutes"
          title="See how ForgeX Academy works"
          description="A quick tour of the roadmaps, the classroom, and how your progress turns into certificates."
        />
        <div className="mt-8">
          <HowToVideo config={tutorialVideo} />
        </div>
      </section>

      {/* ── Popular tutors ───────────────────────────────────────────────── */}
      {topTutors.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading
              align="left"
              eyebrow="Popular tutors"
              title="Learn from people who build"
              description="Verified, reviewed and rated by the students they teach."
            />
            <Link
              to="/academy/tutors"
              className="group inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-lime-300 transition-colors hover:text-lime-200"
            >
              All tutors
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {topTutors.map((t, i) => (
              <Reveal key={t._id} delay={i * 0.05}>
                <TutorCard tutor={t} className="h-full" />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ── Learning roadmap preview ─────────────────────────────────────── */}
      {featuredRoadmaps.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
          <SectionHeading
            eyebrow="Learning roadmaps"
            title="Follow a path, not a playlist"
            description="Each roadmap takes you from beginner to certified — levels unlock as you complete the courses inside them."
          />
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {featuredRoadmaps.map((rm, ri) => (
              <Reveal key={rm._id} delay={ri * 0.06}>
                <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-card p-6">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
                    <MapIcon className="size-6" />
                  </span>
                  <h3 className="font-display mt-5 text-lg font-bold">{rm.name}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{rm.tagline}</p>
                  <ol className="mt-5 space-y-2.5">
                    {rm.levels.slice(0, 5).map((level, li) => (
                      <li key={level._id} className="flex items-center gap-3 text-sm">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-lime-400/12 text-xs font-bold text-lime-300">
                          {li + 1}
                        </span>
                        <span className="truncate text-muted-foreground">{level.title}</span>
                      </li>
                    ))}
                  </ol>
                  <Link
                    to="/academy/roadmap"
                    className="group mt-6 inline-flex items-center gap-2 text-sm font-semibold text-lime-300 transition-colors hover:text-lime-200"
                  >
                    View roadmap
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ── Student testimonials ─────────────────────────────────────────── */}
      {homeStories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
          <SectionHeading
            eyebrow="Student stories"
            title="Real learners, real progress"
            description="What people have gone on to build with the skills they learned here."
          />
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {homeStories.map((s, i) => (
              <Reveal key={s._id} delay={i * 0.06}>
                <figure className="flex h-full flex-col rounded-3xl border border-white/10 bg-card p-6">
                  <div className="flex gap-0.5 text-lime-400">
                    {Array.from({ length: 5 }).map((_, k) => (
                      <Star key={k} className="size-3.5 fill-current" />
                    ))}
                  </div>
                  <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                    “{s.story}”
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-3 border-t border-white/8 pt-4">
                    <Avatar name={s.name} image={s.photoUrl} className="size-10" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.course}</p>
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              to="/academy/showcase"
              className="group inline-flex items-center gap-2 text-sm font-semibold text-lime-300 transition-colors hover:text-lime-200"
            >
              Read more stories
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>
      )}

      {/* ── Announcements + upcoming updates ─────────────────────────────── */}
      {(latestAnnouncement || recentUpdates.length > 0) && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="grid gap-6 lg:grid-cols-2">
            {latestAnnouncement && (
              <Reveal>
                <div className="flex h-full flex-col rounded-3xl border border-lime-400/20 bg-gradient-to-br from-lime-400/10 via-card to-transparent p-7">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
                    <Megaphone className="size-5" />
                  </span>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-lime-400/80">
                    Latest announcement · {timeAgo(latestAnnouncement.createdAt)}
                  </p>
                  <h3 className="font-display mt-2 text-xl font-bold">
                    {latestAnnouncement.title}
                  </h3>
                  <p className="mt-2 line-clamp-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {latestAnnouncement.body}
                  </p>
                  <Link
                    to="/academy/updates"
                    className="group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-lime-300 transition-colors hover:text-lime-200"
                  >
                    All announcements
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </Reveal>
            )}

            {recentUpdates.length > 0 && (
              <Reveal delay={0.06}>
                <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-card p-7">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
                      <CalendarDays className="size-5" />
                    </span>
                    <h3 className="font-display text-lg font-bold">Upcoming updates</h3>
                  </div>
                  <ul className="mt-5 flex-1 space-y-4">
                    {recentUpdates.map((u) => (
                      <li key={u._id} className="flex items-start gap-3">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-lime-400" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{u.title}</p>
                          {u.body && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {u.body}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/academy/updates"
                    className="group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-lime-300 transition-colors hover:text-lime-200"
                  >
                    See what's next
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </Reveal>
            )}
          </div>
        </section>
      )}

      {/* ── Closing call to action ───────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-lime-400/20 bg-gradient-to-br from-lime-400/12 via-card to-emerald-500/5 p-9 text-center sm:p-14">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-lime-400/12 blur-[100px]"
            />
            <span className="relative mx-auto flex size-14 items-center justify-center rounded-2xl border border-lime-400/25 bg-lime-400/10 text-lime-300">
              <Award className="size-7" />
            </span>
            <h2 className="font-display relative mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
              Build skills that turn into opportunities
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Join ForgeX Academy free. Learn at your own pace, complete a
              roadmap, and earn a certificate you can actually share.
            </p>
            <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link to="/academy/login?mode=signup">
                <Button
                  size="lg"
                  className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300 glow-lime-soft"
                >
                  <Users className="size-4" />
                  Create your free account
                </Button>
              </Link>
              <Link to="/academy/courses">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/15 hover:border-lime-400/40 hover:text-lime-300"
                >
                  Browse courses
                </Button>
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

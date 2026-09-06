import { useEffect } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  Award,
  BarChart3,
  Bot,
  Brain,
  Briefcase,
  CheckCircle2,
  Code2,
  Database,
  ExternalLink,
  Globe,
  Layers,
  Map,
  Megaphone,
  Palette,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { CourseCard } from "@/components/site/CourseCard";
import { TutorCard } from "@/components/site/TutorCard";
import { HowToVideo } from "@/components/site/HowToVideo";
import { parseTutorialVideo } from "@/lib/tutorial-video";
import { Avatar } from "@/components/site/Avatar";
import { AnimatedCta } from "@/components/site/AnimatedCta";
import { CoverArt } from "@/components/site/CoverArt";
import { HeroRobot } from "@/components/site/HeroRobot";
import { cn } from "@/lib/utils";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};
const item = {
  hidden: { opacity: 0, y: 26 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/* ── Category pills: map each category's stored lucide icon name to the
      curated barrel (fallback: Sparkles). Names come from the admin
      catalog — nothing is invented here. ─────────────────────────────── */
const CATEGORY_ICONS: Record<string, typeof Sparkles> = {
  Palette,
  Code2,
  Database,
  Brain,
  BarChart3,
  Megaphone,
  Briefcase,
  Globe,
  Layers,
  Sparkles,
};

function CategoryIcon({ name }: { name: string }) {
  const Icon = CATEGORY_ICONS[name] ?? Sparkles;
  return <Icon className="size-3.5" />;
}

/* ── Compact mobile-first section heading (left-aligned, tight). ─────── */
function SectionHead({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={cn("flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lime-300">
            {eyebrow}
          </p>
        )}
        <h2 className="font-display mt-1 text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl lg:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </Reveal>
  );
}

/* Mobile: horizontal snap carousel · md+: the original grid layouts. */
const SCROLL_ROW =
  "no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-1 sm:gap-4 md:mx-0 md:grid md:snap-none md:overflow-visible md:px-0";

export default function Landing() {
  const seed = useMutation(api.seed.ensureSeedData);
  const content = useQuery(api.public.siteContentAll);
  const featuredCourses = useQuery(api.public.featuredCourses);
  const popularCourses = useQuery(api.public.coursesList, { sort: "popular" });
  const featuredTutors = useQuery(api.public.featuredTutors);
  const categories = useQuery(api.public.categoriesList);
  const stats = useQuery(api.public.stats);
  const featuredStories = useQuery(api.stories.featuredStories);
  const featuredAi = useQuery(api.aiResources.listFeatured);
  const featuredPrompts = useQuery(api.prompts.listFeatured);
  const continueLearning = useQuery(api.public.myContinueLearning);

  useEffect(() => {
    void seed({ force: false }).catch(() => {});
  }, [seed]);

  const hero = content?.hero as
    | {
        badge?: string;
        title?: string;
        subtitle?: string;
        primaryCta?: { label: string; link: string };
        secondaryCta?: { label: string; link: string };
      }
    | undefined;
  const upcoming = (content?.upcoming ?? []) as Array<{
    name: string;
    description: string;
    eta: string;
  }>;
  const tutorialVideo = parseTutorialVideo(content?.tutorialVideo);

  /* Featured (admin-curated) courses first; fall back to the most popular
     real courses so discovery is never empty. Same data, same backend. */
  const courseCarousel =
    featuredCourses && featuredCourses.length > 0
      ? featuredCourses
      : (popularCourses ?? []).slice(0, 6);

  const continueRow = continueLearning?.[0] ?? null;

  return (
    <PageShell>
      {/* ─────────────────────────────────────────────────── Hero (compact) */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pb-6 pt-5 sm:px-6 sm:pb-10 sm:pt-10 lg:pb-16 lg:pt-16">
          <div className="flex items-center gap-2 sm:gap-4 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="min-w-0 flex-1 text-left"
            >
              <motion.div variants={item}>
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-[11px] font-semibold text-lime-300 sm:px-4 sm:py-1.5 sm:text-xs">
                  <Sparkles className="size-3 shrink-0" />
                  <span className="truncate">
                    {hero?.badge ?? "The learning platform of ForgeX Network"}
                  </span>
                </span>
              </motion.div>

              <motion.h1
                variants={item}
                className="font-display mt-3 text-[1.75rem] font-bold leading-[1.08] tracking-tight sm:text-5xl lg:mt-6 lg:text-6xl xl:text-7xl"
              >
                Discover. <span className="text-gradient">Express.</span> Build.
              </motion.h1>

              <motion.p
                variants={item}
                className="mt-2.5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:mt-4 sm:text-base lg:text-lg"
              >
                {hero?.subtitle ??
                  "Turn curiosity into career-ready skills. Learn through structured roadmaps, hands-on projects, expert tutors, and verifiable certificates."}
              </motion.p>

              <motion.div
                variants={item}
                className="mt-4 flex flex-wrap gap-2.5 sm:mt-6 sm:gap-3 lg:flex-nowrap"
              >
                <span data-hero-cta className="min-w-[150px] flex-1 sm:flex-none">
                  <AnimatedCta
                    to={hero?.primaryCta?.link ?? "/courses"}
                    className="w-full justify-center px-4 sm:w-auto sm:px-5"
                  >
                    {hero?.primaryCta?.label ?? "Start learning free"}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </AnimatedCta>
                </span>
                <span data-hero-cta className="min-w-[150px] flex-1 sm:flex-none">
                  <AnimatedCta
                    to={hero?.secondaryCta?.link ?? "/roadmap"}
                    variant="outline"
                    className="w-full justify-center px-4 sm:w-auto sm:px-5"
                  >
                    <Map className="size-4" />
                    {hero?.secondaryCta?.label ?? "Explore roadmaps"}
                  </AnimatedCta>
                </span>
              </motion.div>

              <motion.div
                variants={item}
                className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:mt-6 sm:gap-x-6 sm:text-sm"
              >
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-lime-400" /> Free to start
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Award className="size-3.5 text-lime-400" /> Verifiable certificates
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-3.5 text-lime-400" /> Learn at your pace
                </span>
              </motion.div>
            </motion.div>

            {/* Mascot — compact on mobile (top-right of the hero), full size on desktop */}
            <motion.div
              variants={item}
              className="w-[31%] max-w-[148px] shrink-0 sm:max-w-[180px] lg:w-auto lg:max-w-none"
            >
              <HeroRobot
                imageSrc={
                  typeof content?.heroImage === "string" && content.heroImage.trim()
                    ? content.heroImage
                    : undefined
                }
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ────────────────────────────── Continue learning (real user data only) */}
      {continueRow && (
        <section className="mx-auto max-w-7xl px-4 pb-5 sm:px-6 sm:pb-8">
          <Reveal>
            <div className="rounded-2xl border border-white/10 bg-card p-3 shadow-lg shadow-black/20 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-lime-300">
                  <Sparkles className="size-3" /> Continue learning
                </span>
                <Link
                  to="/dashboard/my-courses"
                  className="text-xs font-semibold text-lime-300 hover:underline"
                >
                  My courses →
                </Link>
              </div>
              <Link
                to={`/learn/${continueRow.course.slug}`}
                className="group mt-2.5 flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 p-2.5 transition-colors hover:border-lime-400/30 sm:p-3"
              >
                <CoverArt
                  gradient={continueRow.course.gradient}
                  icon={continueRow.course.icon}
                  image={continueRow.course.image}
                  className="h-14 w-14 shrink-0 rounded-xl border-0 sm:h-16 sm:w-16"
                  iconClassName="text-2xl"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold transition-colors group-hover:text-lime-300 sm:text-base">
                    {continueRow.course.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {continueRow.totalLessons > 0 &&
                      `${continueRow.completedLessons}/${continueRow.totalLessons} lessons · `}
                    {continueRow.progress}% complete
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-lime-400 transition-[width]"
                      style={{ width: `${Math.min(100, Math.max(0, continueRow.progress))}%` }}
                    />
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-lime-400/40 bg-lime-400/10 px-3 py-1.5 text-xs font-semibold text-lime-300 transition-colors group-hover:bg-lime-400/20">
                  Continue <ArrowRight className="size-3.5" />
                </span>
              </Link>
            </div>
          </Reveal>
        </section>
      )}

      {/* ─────────────────────────────────────── Value proposition (compact) */}
      <section className="mx-auto max-w-7xl px-4 pb-5 sm:px-6 sm:pb-8">
        <Reveal>
          <div className="grid grid-cols-3 divide-x divide-white/8 rounded-2xl border border-white/10 bg-card/70 py-3.5 sm:py-5">
            {[
              { icon: Layers, top: "Structured", bottom: "learning paths" },
              { icon: Users, top: "Expert", bottom: "tutors" },
              { icon: ShieldCheck, top: "Verified", bottom: "certificates" },
            ].map((v) => (
              <div
                key={v.top}
                className="flex flex-col items-center gap-1.5 px-1.5 text-center sm:flex-row sm:justify-center sm:gap-2.5 sm:px-3 sm:text-left"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-lime-400/12 text-lime-300 sm:size-9">
                  <v.icon className="size-4" />
                </span>
                <p className="text-[11px] font-medium leading-tight text-muted-foreground sm:text-sm">
                  {v.top}
                  <br className="sm:hidden" />{" "}
                  <span className="sm:hidden">{v.bottom}</span>
                  <span className="hidden sm:inline">{v.bottom}</span>
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ────────────────────────────────────── Explore courses (carousel) */}
      {courseCarousel.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-7 sm:px-6 sm:pb-12">
          <SectionHead
            eyebrow="Featured courses"
            title="Explore courses"
            description="Build skills in the areas that matter."
            action={
              <Link
                to="/courses"
                className="inline-flex items-center gap-1 text-xs font-semibold text-lime-300 hover:underline sm:text-sm"
              >
                View all <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <div className={cn(SCROLL_ROW, "mt-4 md:mt-6 md:grid-cols-2 lg:grid-cols-3")}>
            {courseCarousel.map((c, i) => (
              <Reveal
                key={c._id}
                delay={(i % 3) * 0.07}
                className="w-[272px] shrink-0 snap-start sm:w-[300px] md:w-auto"
              >
                <CourseCard course={c} className="h-full" />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ──────────────────────────────────── Categories (scrolling pills) */}
      {categories && categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-7 sm:px-6 sm:pb-12">
          <SectionHead
            title="What do you want to learn?"
            action={
              <Link
                to="/courses"
                className="inline-flex items-center gap-1 text-xs font-semibold text-lime-300 hover:underline sm:text-sm"
              >
                View all <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <Reveal className="no-scrollbar -mx-4 mt-3.5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mt-4 sm:flex-wrap sm:mx-0 sm:px-0">
            {categories.map((c) => (
              <Link
                key={c._id}
                to={`/courses?category=${c.slug}`}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
              >
                <span className="text-lime-300">
                  <CategoryIcon name={c.icon} />
                </span>
                {c.name}
              </Link>
            ))}
          </Reveal>
        </section>
      )}

      {/* ─────────────────────────────────────── Statistics (compact strip) */}
      {(() => {
        if (!stats || (stats.courses ?? 0) <= 0) return null;
        const cells: Array<{ value: string; label: string }> = [
          { value: `${stats.courses}+`, label: "Courses" },
          ...(stats.tutors > 0
            ? [{ value: `${stats.tutors}`, label: "Expert tutors" }]
            : []),
          ...(stats.certificates > 0
            ? [{ value: `${stats.certificates}`, label: "Certificates" }]
            : []),
        ];
        return (
          <section className="mx-auto max-w-7xl px-4 pb-7 sm:px-6 sm:pb-12">
            <Reveal>
              <div
                className={cn(
                  "grid divide-x divide-white/8 rounded-2xl border border-white/10 bg-card/70 py-4 sm:py-6",
                  cells.length === 3 ? "grid-cols-3" : "grid-cols-2",
                )}
              >
                {cells.map((c) => (
                  <div key={c.label} className="text-center">
                    <div className="font-display text-2xl font-bold tracking-tight text-gradient sm:text-4xl">
                      {c.value}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground sm:text-sm">
                      {c.label}
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </section>
        );
      })()}

      {/* ───────────────────────────────────────────── Watch the tour */}
      {tutorialVideo && (
        <section className="mx-auto max-w-7xl px-4 pb-7 sm:px-6 sm:pb-12">
          <SectionHead
            eyebrow="Watch the tour"
            title="ForgeX in two minutes"
            description="See how students learn, earn certificates and grow — and how tutors build courses, grade work and stay connected with their class."
          />
          <Reveal className="mt-4 sm:mt-6">
            <HowToVideo config={tutorialVideo} title="How ForgeX Academy works" />
          </Reveal>
        </section>
      )}

      {/* ───────────────────────────── Featured tutors (admin-controlled) */}
      {featuredTutors && featuredTutors.length > 0 && (
        <section className="border-y border-white/8 bg-black/30 py-7 sm:py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHead
              eyebrow="Featured tutors"
              title="Learn from people who do the work"
              action={
                <Link
                  to="/tutors"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-lime-300 hover:underline sm:text-sm"
                >
                  View all <ArrowRight className="size-3.5" />
                </Link>
              }
            />
            <div className={cn(SCROLL_ROW, "mt-4 md:mt-6 md:grid-cols-2 lg:grid-cols-4")}>
              {featuredTutors.slice(0, 4).map((t, i) => (
                <Reveal
                  key={t._id}
                  delay={(i % 4) * 0.06}
                  className="w-[228px] shrink-0 snap-start md:w-auto"
                >
                  <TutorCard tutor={t} className="h-full" />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────── Student stories (if any) */}
      {featuredStories && featuredStories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-12">
          <SectionHead
            eyebrow="Student stories"
            title="Skills that turned into opportunities"
          />
          <div className={cn(SCROLL_ROW, "mt-4 md:mt-6 md:grid-cols-2")}>
            {featuredStories.slice(0, 4).map((s, i) => (
              <Reveal
                key={s._id}
                delay={(i % 2) * 0.07}
                className="w-[280px] shrink-0 snap-start sm:w-[320px] md:w-auto"
              >
                <figure className="flex h-full flex-col rounded-2xl border border-white/10 bg-card p-4 transition-colors hover:border-lime-400/30 sm:p-5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={s.name} image={s.photoUrl ?? undefined} className="size-9" />
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-semibold">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.course}</p>
                    </div>
                  </div>
                  <blockquote className="mt-3 line-clamp-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                    &ldquo;{s.story}&rdquo;
                  </blockquote>
                </figure>
              </Reveal>
            ))}
            <Reveal className="w-[280px] shrink-0 snap-start sm:w-[320px] md:hidden">
              <Link
                to="/stories"
                className="flex h-full min-h-[120px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 p-4 text-sm font-semibold text-lime-300"
              >
                Share your story <ArrowRight className="size-4" />
              </Link>
            </Reveal>
          </div>
        </section>
      )}

      {/* ─────────────────────────────── Future of ForgeX (compact) */}
      {upcoming.length > 0 && (
        <section className="border-y border-white/8 bg-black/30 py-7 sm:py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <Reveal className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                <Sparkles className="size-3 text-lime-300" /> Coming soon
              </span>
              <h2 className="font-display mt-3 text-xl font-bold tracking-tight sm:text-3xl">
                The Future of <span className="text-gradient">ForgeX</span>
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground sm:text-base">
                <strong className="text-foreground">Opportunity Hub</strong> — scholarships,
                mentorship, placements, jobs and more are coming together in one opportunity
                ecosystem.
              </p>
              <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
                {["Scholarships", "Mentorship", "Placements", "Jobs"].map((label) => (
                  <span
                    key={label}
                    className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────── AI Hub preview */}
      {featuredAi && featuredAi.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-12">
          <SectionHead
            eyebrow="ForgeX AI Hub"
            title="AI resources, verified and curated"
            description="Free and freemium AI tools, tutorials and setup guides — hand-picked by the ForgeX team."
          />
          <div className={cn(SCROLL_ROW, "mt-4 md:mt-6 md:grid-cols-2 lg:grid-cols-3")}>
            {featuredAi.slice(0, 3).map((r, i) => (
              <Reveal
                key={r._id}
                delay={(i % 3) * 0.07}
                className="w-[272px] shrink-0 snap-start sm:w-[300px] md:w-auto"
              >
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex h-full flex-col rounded-2xl border border-white/10 bg-card p-4 transition-colors hover:border-lime-400/30 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-lime-400/25 to-emerald-500/10 ring-1 ring-white/10 sm:size-12">
                      {r.thumbnailUrl ? (
                        <img src={r.thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
                      ) : (
                        <Bot className="size-5 text-lime-300" />
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 text-[10px] font-bold text-lime-300">
                      <Star className="size-2.5 fill-lime-400" /> Featured
                    </span>
                  </div>
                  <h3 className="font-display mt-3 text-sm font-bold leading-snug group-hover:text-lime-300 sm:text-base">
                    {r.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {r.description}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-lime-300">
                    Open resource <ExternalLink className="size-3.5" />
                  </span>
                </a>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-5 flex flex-wrap items-center gap-3">
            <AnimatedCta to="/ai-hub">
              Explore the AI Hub
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </AnimatedCta>
            <AnimatedCta to="/auth?mode=signup" variant="outline">
              <Sparkles className="size-4" /> Join ForgeX free
            </AnimatedCta>
          </Reveal>
        </section>
      )}

      {/* ───────────────────────────────────── Prompt Library preview */}
      {featuredPrompts && featuredPrompts.length > 0 && (
        <section className="border-y border-white/8 bg-black/30 py-7 sm:py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHead
              eyebrow="ForgeX Prompt Library"
              title="Copy-ready prompts for design & creative work"
              description="High-quality AI prompts for students, designers, freelancers and founders."
              action={
                <Link
                  to="/prompts"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-lime-300 hover:underline sm:text-sm"
                >
                  Explore <ArrowRight className="size-3.5" />
                </Link>
              }
            />
            <div className={cn(SCROLL_ROW, "mt-4 md:mt-6 md:grid-cols-2 lg:grid-cols-3")}>
              {featuredPrompts.slice(0, 3).map((p, i) => (
                <Reveal
                  key={p._id}
                  delay={(i % 3) * 0.07}
                  className="w-[272px] shrink-0 snap-start sm:w-[300px] md:w-auto"
                >
                  <Link
                    to={`/prompts/${p.slug}`}
                    className="group flex h-full flex-col rounded-2xl border border-white/10 bg-card p-4 transition-colors hover:border-lime-400/30 sm:p-5"
                  >
                    <h3 className="font-display text-sm font-bold leading-snug group-hover:text-lime-300 sm:text-base">
                      {p.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {p.description}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-lime-300">
                      View prompt <ArrowRight className="size-3.5" />
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
            <Reveal className="mt-5 flex flex-wrap items-center gap-3">
              <AnimatedCta to="/prompts">
                Explore the Prompt Library
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </AnimatedCta>
              <AnimatedCta to="/ai-hub" variant="outline">
                <Bot className="size-4" /> Visit the AI Hub
              </AnimatedCta>
            </Reveal>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────── Final CTA */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-14">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-lime-400/25 bg-gradient-to-br from-lime-400/12 via-card to-card p-6 text-center sm:p-12">
            <div className="absolute -top-20 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-lime-400/15 blur-3xl" />
            <h2 className="font-display relative mx-auto max-w-2xl text-2xl font-bold tracking-tight sm:text-4xl">
              Your skills deserve <span className="text-gradient">proof</span>.
            </h2>
            <p className="relative mx-auto mt-2.5 max-w-xl text-sm text-muted-foreground sm:text-base">
              Join ForgeX Academy free, complete a course, and earn a verifiable certificate
              that recruiters can check in seconds.
            </p>
            <div className="relative mt-5 flex flex-wrap items-center justify-center gap-3">
              <AnimatedCta to="/auth?mode=signup">
                Create your free account <ArrowRight className="size-4" />
              </AnimatedCta>
              <AnimatedCta to="/courses" variant="outline">
                Browse courses
              </AnimatedCta>
            </div>
          </div>
        </Reveal>
      </section>
    </PageShell>
  );
}

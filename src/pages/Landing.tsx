import { useEffect } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  Award,
  Bell,
  Bot,
  Braces,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Map,
  Megaphone,
  MessageCircleHeart,
  PlayCircle,
  Rocket,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Stat } from "@/components/site/Stat";
import { CourseCard } from "@/components/site/CourseCard";
import { TutorCard } from "@/components/site/TutorCard";
import { HowToVideo } from "@/components/site/HowToVideo";
import { parseTutorialVideo } from "@/lib/tutorial-video";
import { Avatar } from "@/components/site/Avatar";
import { AnimatedCta } from "@/components/site/AnimatedCta";
import { timeAgo } from "@/lib/format";

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

import { HeroRobot } from "@/components/site/HeroRobot";
export default function Landing() {
  const seed = useMutation(api.seed.ensureSeedData);
  const content = useQuery(api.public.siteContentAll);
  const courses = useQuery(api.public.featuredCourses);
  const tutors = useQuery(api.public.popularTutors);
  const categories = useQuery(api.public.categoriesList);
  const roadmaps = useQuery(api.public.roadmapsAll);
  const announcements = useQuery(api.public.announcementsList);
  const updates = useQuery(api.public.updatesList);
  const stats = useQuery(api.public.stats);
  const featuredStories = useQuery(api.stories.featuredStories);
  const featuredAi = useQuery(api.aiResources.listFeatured);
  const featuredPrompts = useQuery(api.prompts.listFeatured);

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
  const testimonials = (content?.testimonials ?? []) as Array<{
    name: string;
    role: string;
    quote: string;
    initials?: string;
  }>;
  const upcoming = (content?.upcoming ?? []) as Array<{
    name: string;
    description: string;
    eta: string;
  }>;
  const tutorialVideo = parseTutorialVideo(content?.tutorialVideo);

  const featuredRoadmap = roadmaps?.find((r) => r.featured) ?? roadmaps?.[0];

  return (
    <PageShell>
      {/* ------------------------------------------------ Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
            {/* Left — headline, supporting copy, CTAs */}
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="flex flex-col items-center text-center lg:items-start lg:text-left"
            >
              <motion.div variants={item}>
                <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/30 bg-lime-400/10 px-4 py-1.5 text-xs font-semibold text-lime-300">
                  <Sparkles className="size-3.5" />
                  {hero?.badge ?? "The learning platform of ForgeX Network"}
                </span>
              </motion.div>

              <motion.h1
                variants={item}
                className="font-display mt-6 max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl"
              >
                Discover. <span className="text-gradient">Express.</span> Build.
              </motion.h1>

              <motion.p
                variants={item}
                className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground"
              >
                {hero?.subtitle ??
                  "ForgeX Academy turns curiosity into career-ready skills — structured roadmaps, hands-on projects, expert tutors and verifiable certificates. Free to start, forever useful."}
              </motion.p>

              <motion.div variants={item} className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                {/* data-hero-cta lets the robot subtly watch these buttons —
                    purely visual, never intercepting clicks or navigation. */}
                <span data-hero-cta>
                  <AnimatedCta to={hero?.primaryCta?.link ?? "/courses"}>
                    {hero?.primaryCta?.label ?? "Start learning free"}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </AnimatedCta>
                </span>
                <span data-hero-cta>
                  <AnimatedCta to={hero?.secondaryCta?.link ?? "/roadmap"} variant="outline">
                    <Map className="size-4" />
                    {hero?.secondaryCta?.label ?? "Explore roadmaps"}
                  </AnimatedCta>
                </span>
              </motion.div>

              <motion.div
                variants={item}
                className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground lg:justify-start"
              >
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-lime-400" /> Free to start
                </span>
                <span className="inline-flex items-center gap-2">
                  <Award className="size-4 text-lime-400" /> Verifiable certificates
                </span>
                <span className="inline-flex items-center gap-2">
                  <Users className="size-4 text-lime-400" /> Learn at your pace
                </span>
              </motion.div>
            </motion.div>

            {/* Right — the ForgeX robot mascot, floating in the environment */}
            <HeroRobot
              imageSrc={
                typeof content?.heroImage === "string" && content.heroImage.trim()
                  ? content.heroImage
                  : undefined
              }
            />
          </div>

          {/* Stats */}
          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-8 rounded-3xl border border-white/10 bg-card/60 p-8 backdrop-blur sm:grid-cols-4">
            <Stat value={`${stats?.courses ?? "—"}+`} label="Courses" />
            <Stat value={`${stats?.students ?? "—"}+`} label="Students" delay={0.05} />
            <Stat value={`${stats?.tutors ?? "—"}`} label="Expert tutors" delay={0.1} />
            <Stat value={`${stats?.certificates ?? "—"}`} label="Certificates" delay={0.15} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Categories marquee */}
      {categories && categories.length > 0 && (
        <section className="border-y border-white/8 bg-black/30 py-5">
          <div className="relative overflow-hidden mask-fade-y">
            <div className="flex w-max animate-marquee gap-3">
              {[...categories, ...categories].map((c, i) => (
                <Link
                  key={`${c._id}-${i}`}
                  to={`/courses?category=${c.slug}`}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
                >
                  <span className="text-lime-300">✦</span> {c.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ How-it-works video */}
      {tutorialVideo && (
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <SectionHeading
            eyebrow="Watch the tour"
            title="ForgeX in two minutes"
            description="See how students learn, earn certificates and grow — and how tutors build courses, grade work and stay connected with their class."
          />
          <Reveal className="mt-12">
            <HowToVideo config={tutorialVideo} title="How ForgeX Academy works" />
          </Reveal>
        </section>
      )}

      {/* ------------------------------------------------ Featured courses */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <SectionHeading
          eyebrow="Featured courses"
          title="Start with the courses students love"
          description="Hands-on, project-driven courses taught by verified industry tutors. Every course is free to start."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses?.map((c, i) => (
            <Reveal key={c._id} delay={(i % 3) * 0.07}>
              <CourseCard course={c} />
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10 flex justify-center">
          <AnimatedCta to="/courses" variant="outline">
            Browse all courses <ArrowRight className="size-4" />
          </AnimatedCta>
        </Reveal>
      </section>

      {/* ------------------------------------------------ Popular tutors */}
      {tutors && tutors.length > 0 && (
        <section className="border-y border-white/8 bg-black/30 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Popular tutors"
              title="Learn from people who do the work"
              description="Every tutor on ForgeX Academy is verified and actively practicing their craft."
            />
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {tutors.map((t, i) => (
                <Reveal key={t._id} delay={(i % 4) * 0.06}>
                  <TutorCard tutor={t} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ Roadmap preview */}
      {featuredRoadmap && (
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="grid items-center gap-14 lg:grid-cols-2">
            <SectionHeading
              align="left"
              eyebrow="Learning roadmaps"
              title={`Follow a path, not a playlist`}
              description={`${featuredRoadmap.name} takes you from first principles to a verified certificate. Each level unlocks after you complete the previous one — progress you can see and show.`}
            />
            <Reveal>
              <div className="relative rounded-3xl border border-white/10 bg-card p-6">
                <div className="absolute -right-3 -top-3 flex size-12 items-center justify-center rounded-2xl bg-lime-400 text-black shadow-lg">
                  <Map className="size-6" />
                </div>
                {featuredRoadmap.levels.map((lvl, i) => (
                  <div key={lvl._id} className="relative flex gap-4">
                    {i < featuredRoadmap.levels.length - 1 && (
                      <span className="absolute left-[17px] top-9 h-full w-px bg-gradient-to-b from-lime-400/60 to-white/10" />
                    )}
                    <div className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border border-lime-400/40 bg-lime-400/15 font-display text-sm font-bold text-lime-300">
                      {i + 1}
                    </div>
                    <div className="pb-7">
                      <h4 className="font-display text-base font-semibold">{lvl.title}</h4>
                      <p className="mt-0.5 text-sm text-muted-foreground">{lvl.description}</p>
                      {lvl.courses.length > 0 && (
                        <Link
                          to={`/courses/${lvl.courses[0].slug}`}
                          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-lime-300 hover:underline"
                        >
                          <PlayCircle className="size-3.5" />
                          {lvl.courses.length} course{lvl.courses.length > 1 ? "s" : ""} in this level
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
                <Link to="/roadmap" className="mt-2 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium transition-colors hover:border-lime-400/40 hover:text-lime-300">
                  See all roadmaps <ArrowRight className="size-4" />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ Testimonials */}
      {testimonials.length > 0 && (
        <section className="border-y border-white/8 bg-black/30 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Student stories"
              title="Skills that turned into opportunities"
            />
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {testimonials.map((t, i) => (
                <Reveal key={t.name} delay={(i % 2) * 0.07}>
                  <figure className="h-full rounded-2xl border border-white/10 bg-card p-6">
                    <div className="flex gap-1 text-amber-400">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star key={s} className="size-4 fill-amber-400" />
                      ))}
                    </div>
                    <blockquote className="mt-4 text-base leading-relaxed text-foreground/90">
                      “{t.quote}”
                    </blockquote>
                    <figcaption className="mt-5 flex items-center gap-3">
                      <Avatar name={t.name} className="size-10" />
                      <div>
                        <p className="text-sm font-semibold">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.role}</p>
                      </div>
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ Announcements + updates */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Announcements"
              title="Latest from the Academy"
            />
            <div className="mt-8 space-y-4">
              {announcements?.slice(0, 3).map((a, i) => (
                <Reveal key={a._id} delay={i * 0.05}>
                  <Link
                    to="/updates"
                    className="flex gap-4 rounded-2xl border border-white/10 bg-card p-5 transition-colors hover:border-lime-400/30"
                  >
                    <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                      {a.category === "Event" ? <Megaphone className="size-5" /> : a.category === "Competition" ? <Rocket className="size-5" /> : <Bell className="size-5" />}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-lime-400/80">
                          {a.category}
                        </span>
                        {a.pinned && <span className="rounded-full bg-lime-400/15 px-2 py-0.5 text-[10px] font-semibold text-lime-300">PINNED</span>}
                        <span className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</span>
                      </div>
                      <h3 className="mt-1 font-display text-base font-semibold">{a.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.body}</p>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>

          <div>
            <SectionHeading
              align="left"
              eyebrow="Upcoming updates"
              title="What's happening next"
            />
            <div className="mt-8 space-y-4">
              {updates?.slice(0, 3).map((u, i) => (
                <Reveal key={u._id} delay={i * 0.05}>
                  <div className="flex gap-4 rounded-2xl border border-white/10 bg-card p-5">
                    <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-lime-300">
                      <Sparkles className="size-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold uppercase tracking-wider text-lime-400/80">
                          {u.type.replace("-", " ")}
                        </span>
                        <span className="text-muted-foreground">{timeAgo(u.date)}</span>
                      </div>
                      <h3 className="mt-1 font-display text-base font-semibold">{u.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{u.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ AI Hub */}
      {featuredAi && featuredAi.length > 0 && (
        <section className="border-y border-white/8 bg-black/30 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="ForgeX AI Hub"
              title="AI resources, verified and curated"
              description="Free and freemium AI tools, tutorials and setup guides — hand-picked by the ForgeX team so you can learn to build with AI without the guesswork."
            />
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredAi.slice(0, 6).map((r, i) => (
                <Reveal key={r._id} delay={(i % 3) * 0.07}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex h-full flex-col rounded-2xl border border-white/10 bg-card p-6 transition-colors hover:border-lime-400/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex size-12 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-lime-400/25 to-emerald-500/10 ring-1 ring-white/10">
                        {r.thumbnailUrl ? (
                          <img src={r.thumbnailUrl} alt="" className="size-full object-cover" loading="lazy" />
                        ) : (
                          <Bot className="size-5 text-lime-300" />
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 text-[10px] font-bold text-lime-300">
                        <Star className="size-2.5 fill-lime-400" /> Featured
                      </span>
                    </div>
                    <h3 className="font-display mt-4 text-base font-bold leading-snug group-hover:text-lime-300">
                      {r.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {r.description}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {r.category}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-lime-300">
                        Open resource <ExternalLink className="size-3.5" />
                      </span>
                    </div>
                  </a>
                </Reveal>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <AnimatedCta to="/ai-hub">
                Explore the AI Hub
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </AnimatedCta>
              <AnimatedCta to="/auth?mode=signup" variant="outline">
                <Sparkles className="size-4" /> Join ForgeX free
              </AnimatedCta>
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ Prompt Library */}
      {featuredPrompts && featuredPrompts.length > 0 && (
        <section className="border-y border-white/8 bg-black/30 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="ForgeX Prompt Library"
              title="Copy-ready prompts for design & creative work"
              description="High-quality AI prompts for students, designers, freelancers and founders — organized by category, with a built-in builder that turns your inputs into a finished prompt in seconds."
            />
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredPrompts.slice(0, 6).map((p, i) => (
                <Reveal key={p._id} delay={(i % 3) * 0.07}>
                  <Link
                    to={`/prompts/${p.slug}`}
                    className="group flex h-full flex-col rounded-2xl border border-white/10 bg-card p-6 transition-colors hover:border-lime-400/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-lime-400/25 to-emerald-500/10 text-lime-300">
                        <Braces className="size-5" />
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 text-[10px] font-bold text-lime-300">
                        <Star className="size-2.5 fill-lime-400" /> Featured
                      </span>
                    </div>
                    <h3 className="font-display mt-4 text-base font-bold leading-snug group-hover:text-lime-300">
                      {p.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {p.description}
                    </p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {p.categoryName}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-lime-300">
                        View prompt <ArrowRight className="size-3.5" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <AnimatedCta to="/prompts">
                Explore the Prompt Library
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </AnimatedCta>
              <AnimatedCta to="/ai-hub" variant="outline">
                <Bot className="size-4" /> Visit the AI Hub
              </AnimatedCta>
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ Community stories */}
      {featuredStories && featuredStories.length > 0 && (
        <section className="border-y border-white/8 bg-black/30 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="ForgeX Community"
              title="Stories from the ForgeX community"
              description="Real students, real growth — selected by the ForgeX team and shared with permission."
            />
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredStories.slice(0, 6).map((s, i) => (
                <Reveal key={s._id} delay={(i % 3) * 0.07}>
                  <figure className="flex h-full flex-col rounded-2xl border border-white/10 bg-card p-6 transition-colors hover:border-lime-400/30">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} image={s.photoUrl} className="size-11" />
                      <div className="min-w-0">
                        <p className="truncate font-display text-sm font-semibold">{s.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{s.course}</p>
                      </div>
                    </div>
                    <blockquote className="mt-4 line-clamp-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                      “{s.story}”
                    </blockquote>
                  </figure>
                </Reveal>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <AnimatedCta to="/stories">
                Share your story
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </AnimatedCta>
              <AnimatedCta to="/stories" variant="outline">
                <MessageCircleHeart className="size-4" /> Read more stories
              </AnimatedCta>
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ Upcoming ForgeX Network */}
      {upcoming.length > 0 && (
        <section className="border-t border-white/8 bg-black/30 py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="ForgeX Network"
              title="Coming soon — the full network"
              description="ForgeX Academy is the first module of ForgeX Network. These opportunity modules are in development."
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {upcoming.map((u, i) => (
                <Reveal key={u.name} delay={(i % 4) * 0.05}>
                  <div className="group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-card p-5 transition-colors hover:border-lime-400/30">
                    <div className="flex items-center justify-between">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                        <Rocket className="size-4" />
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {u.eta}
                      </span>
                    </div>
                    <h3 className="mt-3 font-display text-sm font-semibold">{u.name}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {u.description}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------ CTA */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-lime-400/25 bg-gradient-to-br from-lime-400/12 via-card to-card p-10 text-center sm:p-16">
            <div className="absolute -top-20 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-lime-400/15 blur-3xl" />
            <h2 className="font-display relative mx-auto max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
              Your skills deserve <span className="text-gradient">proof</span>.
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-base text-muted-foreground">
              Join ForgeX Academy free, complete a course, and earn a verifiable
              certificate that recruiters can check in seconds.
            </p>
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
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

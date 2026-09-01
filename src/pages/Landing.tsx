import { useEffect } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Map,
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
  const featuredTutors = useQuery(api.public.featuredTutors);
  const categories = useQuery(api.public.categoriesList);
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
  const upcoming = (content?.upcoming ?? []) as Array<{
    name: string;
    description: string;
    eta: string;
  }>;
  const tutorialVideo = parseTutorialVideo(content?.tutorialVideo);

  return (
    <PageShell>
      {/* ─────────────────────────────────────────────────── Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
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
                className="font-display mt-8 max-w-4xl text-[2.5rem] font-bold leading-[1.08] tracking-tight sm:mt-10 sm:text-6xl lg:text-7xl"
              >
                Discover. <span className="text-gradient">Express.</span> Build.
              </motion.h1>

              <motion.p
                variants={item}
                className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg"
              >
                {hero?.subtitle ??
                  "Turn curiosity into career-ready skills. Learn through structured roadmaps, hands-on projects, expert tutors, and verifiable certificates."}
              </motion.p>

              <motion.div variants={item} className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
                <span data-hero-cta className="w-full sm:w-auto">
                  <AnimatedCta to={hero?.primaryCta?.link ?? "/courses"} className="w-full justify-center sm:w-auto">
                    {hero?.primaryCta?.label ?? "Start learning free"}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </AnimatedCta>
                </span>
                <span data-hero-cta className="w-full sm:w-auto">
                  <AnimatedCta to={hero?.secondaryCta?.link ?? "/roadmap"} variant="outline" className="w-full justify-center sm:w-auto">
                    <Map className="size-4" />
                    {hero?.secondaryCta?.label ?? "Explore roadmaps"}
                  </AnimatedCta>
                </span>
              </motion.div>

              <motion.div
                variants={item}
                className="mt-8 grid max-w-xs grid-cols-2 gap-x-6 gap-y-3 text-sm text-muted-foreground sm:mt-10 sm:max-w-none sm:flex sm:flex-wrap sm:justify-center lg:justify-start"
              >
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-lime-400" /> Free to start
                </span>
                <span className="inline-flex items-center gap-2">
                  <Award className="size-4 text-lime-400" /> Verifiable certificates
                </span>
                <span className="col-span-2 inline-flex items-center justify-center gap-2 sm:col-span-1 sm:justify-start">
                  <Users className="size-4 text-lime-400" /> Learn at your pace
                </span>
              </motion.div>
            </motion.div>

            <HeroRobot
              imageSrc={
                typeof content?.heroImage === "string" && content.heroImage.trim()
                  ? content.heroImage
                  : undefined
              }
            />
          </div>

          {/* Stats — only show if meaningful */}
          {stats && (stats.courses ?? 0) > 0 && (
            <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-8 rounded-3xl border border-white/10 bg-card/60 p-8 backdrop-blur sm:grid-cols-4">
              <Stat value={`${stats.courses}+`} label="Courses" />
              {(stats.students ?? 0) >= 5 && (
                <Stat value={`${stats.students}+`} label="Students" delay={0.05} />
              )}
              {(stats.tutors ?? 0) > 0 && (
                <Stat value={`${stats.tutors}`} label="Expert tutors" delay={0.1} />
              )}
              {(stats.certificates ?? 0) > 0 && (
                <Stat value={`${stats.certificates}`} label="Certificates" delay={0.15} />
              )}
            </div>
          )}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────── Category bar */}
      {categories && categories.length > 0 && (
        <section className="border-y border-white/8 bg-black/30 py-4">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {categories.slice(0, 6).map((c) => (
                <Link
                  key={c._id}
                  to={`/courses?category=${c.slug}`}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
                >
                  <span className="text-lime-300">✦</span> {c.name}
                </Link>
              ))}
              <Link
                to="/courses"
                className="text-xs font-medium text-lime-300 hover:underline"
              >
                View all →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────── How-it-works video */}
      {tutorialVideo && (
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
          <SectionHeading
            eyebrow="Watch the tour"
            title="ForgeX in two minutes"
            description="See how students learn, earn certificates and grow — and how tutors build courses, grade work and stay connected with their class."
          />
          <Reveal className="mt-10">
            <HowToVideo config={tutorialVideo} title="How ForgeX Academy works" />
          </Reveal>
        </section>
      )}

      {/* ─────────────────────────────────────────────────── Featured courses (max 3) */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading
          eyebrow="Featured courses"
          title="Start with the courses students love"
          description="Hands-on, project-driven courses taught by verified industry tutors. Every course is free to start."
        />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses?.slice(0, 3).map((c, i) => (
            <Reveal key={c._id} delay={(i % 3) * 0.07}>
              <CourseCard course={c} />
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-8 flex justify-center">
          <AnimatedCta to="/courses" variant="outline">
            Browse all courses <ArrowRight className="size-4" />
          </AnimatedCta>
        </Reveal>
      </section>

      {/* ─────────────────────────────────────────────────── Featured Tutors (admin-controlled) */}
      {featuredTutors && featuredTutors.length > 0 && (
        <section className="border-y border-white/8 bg-black/30 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Featured tutors"
              title="Learn from people who do the work"
              description="Learn from experienced people who practice what they teach."
            />
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {featuredTutors.slice(0, 4).map((t, i) => (
                <Reveal key={t._id} delay={(i % 4) * 0.06}>
                  <TutorCard tutor={t} />
                </Reveal>
              ))}
            </div>
            <Reveal className="mt-8 flex justify-center">
              <AnimatedCta to="/tutors" variant="outline">
                View all tutors <ArrowRight className="size-4" />
              </AnimatedCta>
            </Reveal>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────── From Learning to Opportunity */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/25 bg-lime-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-lime-300">
            From learning to opportunity
          </span>
          <h2 className="font-display mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
            From Learning to <span className="text-gradient">Opportunity</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            ForgeX Academy helps you turn knowledge into practical skills through structured learning, real projects and verifiable achievements.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: BookOpen, title: "Learn", desc: "Structured learning paths" },
            { icon: Rocket, title: "Build", desc: "Hands-on real projects" },
            { icon: Award, title: "Prove", desc: "Verifiable certificates" },
            { icon: Users, title: "Connect", desc: "Access to future opportunities through the ForgeX ecosystem" },
          ].map((b, i) => (
            <Reveal key={b.title} delay={i * 0.06}>
              <div className="rounded-2xl border border-white/10 bg-card p-6 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-lime-400/12 text-lime-300">
                  <b.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-display text-base font-semibold">{b.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{b.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────── Conditional Testimonials */}
      {featuredStories && featuredStories.length > 0 && (
        <section className="border-y border-white/8 bg-black/30 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="Student stories"
              title="Skills that turned into opportunities"
            />
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {featuredStories.slice(0, 4).map((s, i) => (
                <Reveal key={s._id} delay={(i % 2) * 0.07}>
                  <figure className="flex h-full flex-col rounded-2xl border border-white/10 bg-card p-6 transition-colors hover:border-lime-400/30">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} image={s.photoUrl ?? undefined} className="size-11" />
                      <div className="min-w-0">
                        <p className="truncate font-display text-sm font-semibold">{s.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{s.course}</p>
                      </div>
                    </div>
                    <blockquote className="mt-4 line-clamp-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                      &ldquo;{s.story}&rdquo;
                    </blockquote>
                  </figure>
                </Reveal>
              ))}
            </div>
            <Reveal className="mt-8 flex justify-center">
              <AnimatedCta to="/stories" variant="outline">
                Share your story <ArrowRight className="size-4" />
              </AnimatedCta>
            </Reveal>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────── Future of ForgeX (compact) */}
      {upcoming.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <Sparkles className="size-3.5 text-lime-300" /> Coming soon
            </span>
            <h2 className="font-display mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
              The Future of <span className="text-gradient">ForgeX</span>
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              <strong className="text-foreground">Opportunity Hub</strong> — scholarships, mentorship, placements, jobs and more are coming together in one opportunity ecosystem.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {["Scholarships", "Mentorship", "Placements", "Jobs"].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                  {label}
                </span>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      {/* ─────────────────────────────────────────────────── AI Hub preview */}
      {featuredAi && featuredAi.length > 0 && (
        <section className="border-y border-white/8 bg-black/30 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="ForgeX AI Hub"
              title="AI resources, verified and curated"
              description="Free and freemium AI tools, tutorials and setup guides — hand-picked by the ForgeX team."
            />
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredAi.slice(0, 3).map((r, i) => (
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
                    <p className="mt-1.5 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {r.description}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-lime-300">
                      Open resource <ExternalLink className="size-3.5" />
                    </span>
                  </a>
                </Reveal>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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

      {/* ─────────────────────────────────────────────────── Prompt Library preview */}
      {featuredPrompts && featuredPrompts.length > 0 && (
        <section className="border-y border-white/8 bg-black/30 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading
              eyebrow="ForgeX Prompt Library"
              title="Copy-ready prompts for design & creative work"
              description="High-quality AI prompts for students, designers, freelancers and founders."
            />
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredPrompts.slice(0, 3).map((p, i) => (
                <Reveal key={p._id} delay={(i % 3) * 0.07}>
                  <Link
                    to={`/prompts/${p.slug}`}
                    className="group flex h-full flex-col rounded-2xl border border-white/10 bg-card p-6 transition-colors hover:border-lime-400/30"
                  >
                    <h3 className="font-display text-base font-bold leading-snug group-hover:text-lime-300">
                      {p.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {p.description}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-lime-300">
                      View prompt <ArrowRight className="size-3.5" />
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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

      {/* ─────────────────────────────────────────────────── Final CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24">
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

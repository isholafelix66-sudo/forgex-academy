import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Briefcase,
  Compass,
  FolderKanban,
  Globe,
  GraduationCap,
  Link2,
  Lock,
  Palette,
  Share2,
  Sparkles,
  User,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/site/Avatar";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "@/components/site/SectionHeading";
import { HeroShowcase } from "@/components/site/HeroShowcase";
import { SharePortfolioButton } from "@/components/site/SharePortfolioButton";
import { WorkCard } from "@/components/site/WorkCard";
import { cn } from "@/lib/utils";
import { useBranding } from "@/lib/branding";
import {
  DEFAULT_PORTFOLIO_SLIDES,
  normalizePortfolioSlides,
  PORTFOLIO_SLIDES_KEY,
} from "@/lib/portfolio-slides";

/* ─────────────────────────────────────────────────────────────────────────── */

const STEPS = [
  {
    icon: User,
    title: "Build your portfolio",
    body: "Add your about, skills, experience, education, services and the projects you're proud of. Guided sections, no blank page.",
  },
  {
    icon: Palette,
    title: "Make it yours",
    body: "Pick a template and an accent colour. Your portfolio becomes a real website — not a profile buried in an app.",
  },
  {
    icon: Share2,
    title: "Share one link",
    body: "Publish it and share a single URL anywhere — your CV, your bio, your applications, your DMs.",
  },
];

const SECTIONS_INCLUDED = [
  { icon: User, label: "About Me", body: "Tell your story in your own voice." },
  { icon: FolderKanban, label: "Projects", body: "Show the work, with images and live links." },
  { icon: Sparkles, label: "Skills", body: "What you're good at, at a glance." },
  { icon: Briefcase, label: "Experience", body: "Roles, internships and freelance work." },
  { icon: GraduationCap, label: "Education", body: "Schools, courses and qualifications." },
  { icon: Wrench, label: "Services", body: "What you offer — and what it costs." },
  { icon: Link2, label: "Social Links", body: "GitHub, LinkedIn, Behance, X, your site." },
  { icon: Globe, label: "Your own URL", body: "/p/your-name — memorable and yours." },
];

const TEMPLATES = [
  { key: "carbon", label: "Carbon", accent: "#a3e635", bg: "#070906" },
  { key: "aurora", label: "Aurora", accent: "#a78bfa", bg: "#080a14" },
  { key: "paper", label: "Paper", accent: "#65a30d", bg: "#f7f6f2" },
];

export default function Landing() {
  const branding = useBranding();
  const featured = useQuery(api.projects.exploreProjects, { limit: 24 });
  const storedSlides = useQuery(api.portfolioAdmin.publicContent, {
    key: PORTFOLIO_SLIDES_KEY,
  });

  const slides = normalizePortfolioSlides(
    storedSlides === undefined || storedSlides === null
      ? DEFAULT_PORTFOLIO_SLIDES
      : storedSlides,
  );

  const work = featured ?? [];
  const featuredWork = work.filter((p) => p.featured).slice(0, 2);
  const topWork = (featuredWork.length > 0 ? featuredWork : work).slice(0, 2);
  const recentWork = work.filter((p) => !topWork.includes(p)).slice(0, 6);
  const chips = ["Web", "Design", "Video", "Branding"];

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
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-[2.75rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.25rem] xl:text-[4.75rem]"
            >
              Great Work.
              <br />
              <span className="text-lime-400">Builds Brands.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Discover creative talent, explore real work, and turn great
              projects into professional portfolios.
            </motion.p>

            {/* One subtle, responsive explore action. The primary actions —
                Share Portfolio Link and Sign In — live in the header, so the
                hero never stacks buttons awkwardly on mobile. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="mt-7"
            >
              <Link
                to="/portfolio/explore"
                className="group inline-flex items-center gap-2 text-sm font-semibold text-lime-300 transition-colors hover:text-lime-200"
              >
                Explore portfolios
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 min-w-0 w-full lg:mt-0"
          >
            <HeroShowcase slides={slides} ariaLabel="Portfolio showcase" />
          </motion.div>
        </div>
      </section>

      {/* ── Category chips + Featured work ───────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Link
            to="/portfolio/explore"
            className="shrink-0 rounded-full bg-lime-400 px-5 py-2.5 text-xs font-bold text-black transition-colors hover:bg-lime-300"
          >
            All
          </Link>
          {chips.map((c) => (
            <Link
              key={c}
              to={`/portfolio/explore?category=${encodeURIComponent(c)}`}
              className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground"
            >
              {c}
            </Link>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3 sm:mt-10">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Featured Projects
          </h2>
          <Link
            to="/portfolio/explore"
            aria-label="See all projects"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
          >
            <ArrowRight className="size-4" />
          </Link>
        </div>

        {featured === undefined ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-3xl border border-white/10 bg-card sm:h-40"
              />
            ))}
          </div>
        ) : topWork.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {topWork.map((p, i) => (
              <WorkCard key={p._id} project={p} eager={i === 0} />
            ))}
          </div>
        ) : (
          <EmptyWork />
        )}

        {/* Recent work */}
        {recentWork.length > 0 && (
          <>
            <div className="mt-10 flex items-center justify-between gap-3 sm:mt-12">
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Recent Projects
              </h2>
              <Link
                to="/portfolio/explore"
                aria-label="See all recent projects"
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
              >
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {recentWork.map((p, i) => (
                <WorkCard key={p._id} project={p} delay={(i % 2) * 0.05} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="border-y border-white/8 bg-black/20">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading
            eyebrow="How it works"
            title="From blank page to a link you're proud of"
            description="Three steps. No design agency, no developer, no hosting to figure out."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3 lg:gap-6">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.07} className="h-full">
                <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-card p-6">
                  <div className="flex items-center gap-3">
                    <span className="font-display text-xs font-bold text-lime-400/70">
                      0{i + 1}
                    </span>
                    <span className="flex size-10 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                      <s.icon className="size-5" />
                    </span>
                  </div>
                  <h3 className="font-display mt-4 text-lg font-bold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {s.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Everything included ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading
          eyebrow="Everything included"
          title="A complete portfolio, not a profile card"
          description="Every section a professional website needs — editable in minutes, responsive by default."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS_INCLUDED.map((s, i) => (
            <Reveal key={s.label} delay={(i % 4) * 0.05} className="h-full">
              <div className="h-full rounded-2xl border border-white/10 bg-card p-5 transition-colors hover:border-lime-400/30">
                <span className="flex size-10 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                  <s.icon className="size-5" />
                </span>
                <h3 className="font-display mt-4 text-base font-semibold">
                  {s.label}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Templates ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
        <SectionHeading
          align="left"
          eyebrow="Templates"
          title="Pick a look, then make it unmistakably yours"
        />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t, i) => (
            <Reveal key={t.key} delay={i * 0.06}>
              <div
                className="overflow-hidden rounded-3xl border border-white/10 transition-transform hover:-translate-y-1"
                style={{ background: t.bg }}
              >
                <div className="p-5">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-full"
                      style={{ background: t.accent }}
                    />
                    <span className="text-xs font-semibold tracking-wide text-white/70">
                      {t.label}
                    </span>
                  </div>
                  <div className="mt-4 h-1.5 w-24 rounded-full" style={{ background: t.accent }} />
                  <div className="mt-3 space-y-2">
                    {["About", "Projects", "Skills"].map((x) => (
                      <div key={x} className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-white/30" />
                        <span className="text-[11px] text-white/45">{x}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  className="h-16 border-t"
                  style={{
                    borderColor: "rgba(255,255,255,0.08)",
                    background: `linear-gradient(135deg, ${t.accent}33, transparent)`,
                  }}
                />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Creators ─────────────────────────────────────────────────────── */}
      {(topWork.length > 0) && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
          <SectionHeading
            align="left"
            eyebrow="Creators on the network"
            title="Real people. Real skills. Real work."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {work.slice(0, 3).map((c, i) => (
              <Reveal key={c._id} delay={i * 0.05} className="h-full">
                <Link
                  to={`/p/${c.owner.slug}`}
                  className="group flex h-full items-center gap-3 rounded-3xl border border-white/10 bg-card p-5 transition-colors hover:border-lime-400/35"
                >
                  <Avatar name={c.owner.displayName} image={c.owner.avatarUrl} className="size-14" />
                  <div className="min-w-0 flex-1">
                    <p className="font-display truncate text-base font-semibold">
                      {c.owner.displayName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.owner.headline || branding.productLabel}
                    </p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-lime-300" />
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ── Ecosystem ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
        <SectionHeading
          eyebrow={branding.name}
          title="Built for people whose work speaks"
          description="Designers, developers, writers, agencies, students — anyone who needs a serious home for their work without building a website from scratch."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              icon: User,
              title: "A profile that reads like a site",
              body: "Your name, story, skills and experience presented like a professional website — not a card inside an app.",
            },
            {
              icon: FolderKanban,
              title: "Work that takes centre stage",
              body: "Image-led project pages with summaries, tags and live links, featured front and centre.",
            },
            {
              icon: Share2,
              title: "One link, everywhere",
              body: "A single memorable URL for your CV, bio and DMs — copy it once, share it anywhere.",
            },
          ].map((c) => (
            <Reveal key={c.title} className="h-full">
              <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-card p-6">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
                  <c.icon className="size-5" />
                </span>
                <h3 className="font-display mt-5 text-xl font-bold">{c.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {c.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-lime-400/20 bg-gradient-to-br from-lime-400/10 via-card to-transparent p-8 text-center sm:p-12 lg:p-16">
            <h2 className="font-display mx-auto max-w-2xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
              Your portfolio is one link away
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Create your account, build your portfolio, and share a single
              professional link anywhere — visitors never need one.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/portfolio/auth">
                <Button
                  size="lg"
                  className="h-12 gap-2 rounded-full bg-lime-400 px-7 font-bold text-black hover:bg-lime-300"
                >
                  Start building <ArrowRight className="size-4" />
                </Button>
              </Link>
              <SharePortfolioButton className="h-12 px-6 text-sm" />
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function EmptyWork() {
  return (
    <div className="mt-5 rounded-3xl border border-white/10 bg-card p-10 text-center sm:p-12">
      <Sparkles className="mx-auto size-9 text-lime-300/70" />
      <h3 className="font-display mt-4 text-lg font-semibold">
        No work is public yet
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Publish a project and make it discoverable — the first featured work
        shows up right here.
      </p>
      <Link to="/portfolio/explore" className="mt-6 inline-block">
        <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
          Explore portfolios <ArrowRight className="size-4" />
        </Button>
      </Link>
    </div>
  );
}

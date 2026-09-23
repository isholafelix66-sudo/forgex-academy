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
  const stats = useQuery(api.projects.projectsStats);
  const featured = useQuery(api.projects.exploreProjects, { limit: 24 });
  const categories = useQuery(api.projects.exploreCategories);
  const creators = useQuery(api.projects.featuredPortfolios, { limit: 3 });
  const flags = useQuery(api.projects.featureFlags);
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
  const chips = (categories ?? []).slice(0, 5);

  // The ecosystem strip mirrors the feature flags — Portfolio is live, the
  // other two products stay locked until an admin flips them.
  const products =
    flags ??
    ([
      { key: "projects", label: "Portfolio", state: "active", tagline: "" },
      { key: "academy", label: "Academy", state: "locked", tagline: "" },
      { key: "opportunity-hub", label: "Opportunity Hub", state: "locked", tagline: "" },
    ] as { key: string; label: string; state: string; tagline: string }[]);

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
              className="font-display text-4xl font-extrabold leading-[1.03] tracking-tight sm:text-5xl lg:text-6xl xl:text-[4.25rem]"
            >
              Great Work
              <br />
              <span className="text-lime-400">Builds Brands.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Discover creative talent, explore amazing projects, and build
              what&apos;s next — on {branding.name}, where every creator turns
              their work into a professional website.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.16 }}
              className="mt-7 flex flex-wrap items-center gap-3"
            >
              <Link to="/explore">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 gap-2 rounded-full border-lime-400/50 bg-lime-400/10 px-6 font-bold text-lime-300 hover:border-lime-400 hover:bg-lime-400 hover:text-black"
                >
                  Explore Portfolio <ArrowRight className="size-4" />
                </Button>
              </Link>

              {/* The only two other public actions: share the portfolio link,
                  or sign in to the Portfolio's own management area. */}
              <SharePortfolioButton className="h-12 px-5 text-sm" />
              <Link
                to="/portfolio/signin"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-semibold text-muted-foreground transition-colors hover:border-white/30 hover:text-foreground"
              >
                Sign In
              </Link>
            </motion.div>

            {stats && (
              <motion.dl
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.24 }}
                className="mt-9 flex flex-wrap gap-x-8 gap-y-4 sm:gap-x-10"
              >
                {[
                  { label: "Portfolios published", value: stats.portfolios },
                  { label: "Projects showcased", value: stats.projects },
                  { label: "Creators", value: stats.creators },
                ].map((s) => (
                  <div key={s.label}>
                    <dt className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {s.label}
                    </dt>
                    <dd className="font-display mt-1 text-2xl font-extrabold text-lime-400">
                      {s.value}
                    </dd>
                  </div>
                ))}
              </motion.dl>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0 w-full"
          >
            <HeroShowcase slides={slides} ariaLabel="Portfolio showcase" />
          </motion.div>
        </div>
      </section>

      {/* ── Category chips + Featured work ───────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Link
            to="/explore"
            className="shrink-0 rounded-full bg-lime-400 px-5 py-2.5 text-xs font-bold text-black transition-colors hover:bg-lime-300"
          >
            All
          </Link>
          {chips.map((c) => (
            <Link
              key={c.name}
              to={`/explore?category=${encodeURIComponent(c.name)}`}
              className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground"
            >
              {c.name}
            </Link>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3 sm:mt-10">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Featured Projects
          </h2>
          <Link
            to="/explore"
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
                to="/explore"
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
      {(creators?.length ?? 0) > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
          <SectionHeading
            align="left"
            eyebrow="Creators on the network"
            title="Real people. Real skills. Real work."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {creators!.map((c, i) => (
              <Reveal key={c._id} delay={i * 0.05} className="h-full">
                <Link
                  to={`/p/${c.slug}`}
                  className="group flex h-full items-center gap-3 rounded-3xl border border-white/10 bg-card p-5 transition-colors hover:border-lime-400/35"
                >
                  <Avatar name={c.displayName} image={c.avatarUrl} className="size-14" />
                  <div className="min-w-0 flex-1">
                    <p className="font-display truncate text-base font-semibold">
                      {c.displayName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.headline || branding.productLabel}
                    </p>
                    {c.skills.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.skills.slice(0, 2).map((s) => (
                          <span
                            key={s.name}
                            className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {s.name}
                          </span>
                        ))}
                      </div>
                    )}
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
          title="One ecosystem, three products"
          description={`${branding.productLabel} is live today. Academy and Opportunity Hub are being built — and will slot straight in when they're ready.`}
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {products.map((p) => {
            const live = p.state === "active";
            const to =
              p.key === "academy"
                ? "/academy"
                : p.key === "opportunity-hub"
                  ? "/opportunity-hub"
                  : "/explore";
            return (
              <Reveal key={p.key} className="h-full">
                <div
                  className={cn(
                    "flex h-full flex-col rounded-3xl border p-6",
                    live
                      ? "border-lime-400/35 bg-gradient-to-br from-lime-400/12 to-card"
                      : "border-white/10 bg-card",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        "flex size-11 items-center justify-center rounded-2xl",
                        live ? "bg-lime-400/15 text-lime-300" : "bg-white/5 text-muted-foreground",
                      )}
                    >
                      {live ? <Compass className="size-5" /> : <Lock className="size-5" />}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                        live
                          ? "border-lime-400/40 bg-lime-400/10 text-lime-300"
                          : "border-white/10 text-muted-foreground",
                      )}
                    >
                      {live ? "Live" : "Coming soon"}
                    </span>
                  </div>
                  <h3 className="font-display mt-5 text-xl font-bold">{p.label}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {p.tagline ||
                      (live
                        ? "Where you create, manage and share your professional portfolio as your own website."
                        : "Structured learning, opportunities and everything that connects skills to what's next.")}
                  </p>
                  <Link to={to} className="mt-5">
                    <Button
                      variant={live ? "default" : "outline"}
                      className={cn(
                        "w-full gap-2",
                        live
                          ? "bg-lime-400 font-semibold text-black hover:bg-lime-300"
                          : "border-white/15 text-muted-foreground hover:border-lime-400/40 hover:text-lime-300",
                      )}
                    >
                      {live ? "Explore now" : "See what's coming"}
                      <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                </div>
              </Reveal>
            );
          })}
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
              Sign in to manage your portfolio, or copy your public link and
              share it anywhere — no account needed for visitors.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <SharePortfolioButton className="h-12 px-6 text-sm" />
              <Link
                to="/portfolio/signin"
                className="inline-flex h-12 items-center rounded-full border border-white/20 px-6 text-sm font-semibold transition-colors hover:border-white/35"
              >
                Sign In
              </Link>
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
      <Link to="/explore" className="mt-6 inline-block">
        <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
          Explore portfolios <ArrowRight className="size-4" />
        </Button>
      </Link>
    </div>
  );
}

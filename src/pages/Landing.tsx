import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Briefcase,
  Check,
  Compass,
  Eye,
  FolderKanban,
  Globe,
  GraduationCap,
  HeartHandshake,
  Link2,
  Lock,
  Palette,
  Rocket,
  Share2,
  Sparkles,
  Star,
  Target,
  User,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/site/Avatar";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "@/components/site/SectionHeading";
import { cn } from "@/lib/utils";

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

const SECTIONS = [
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

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

export default function Landing() {
  const stats = useQuery(api.projects.projectsStats);
  const featured = useQuery(api.projects.featuredPortfolios, { limit: 3 });
  const flags = useQuery(api.projects.featureFlags);

  const products = flags ?? [
    { key: "projects", label: "Projects", state: "active", tagline: "" },
    { key: "academy", label: "Academy", state: "locked", tagline: "" },
    { key: "opportunity-hub", label: "Opportunity Hub", state: "locked", tagline: "" },
  ];

  return (
    <div className="relative">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[90%] max-w-4xl -translate-x-1/2 rounded-full bg-lime-400/10 blur-[130px]"
        />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <motion.span
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full border border-lime-400/25 bg-lime-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-lime-300"
              >
                <Rocket className="size-3.5" /> ForgeX Projects
              </motion.span>

              <motion.h1
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.05 }}
                className="font-display mt-6 text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl"
              >
                Your work deserves its own{" "}
                <span className="text-gradient">website</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.12 }}
                className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground"
              >
                Create your portfolio once. Turn it into your own professional
                website. Share one link — anywhere.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.18 }}
                className="mt-8 flex flex-wrap items-center gap-3"
              >
                <Link to="/auth?mode=signup">
                  <Button
                    size="lg"
                    className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300 glow-lime-soft"
                  >
                    Create your portfolio free <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <Link to="/explore">
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 border-white/15 hover:border-lime-400/40 hover:text-lime-300"
                  >
                    <Compass className="size-4" /> Explore portfolios
                  </Button>
                </Link>
              </motion.div>

              <p className="mt-4 text-xs text-muted-foreground">
                Free to start · No credit card · Publish in minutes
              </p>
            </div>

            {/* Browser mock */}
            <motion.div
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="relative"
            >
              <div className="rounded-3xl border border-white/10 bg-card/80 p-3 shadow-2xl shadow-black/40 backdrop-blur">
                <div className="flex items-center gap-2 px-2 pb-3 pt-1">
                  <span className="size-2.5 rounded-full bg-rose-400/70" />
                  <span className="size-2.5 rounded-full bg-amber-400/70" />
                  <span className="size-2.5 rounded-full bg-lime-400/70" />
                  <div className="ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5">
                    <Globe className="size-3.5 shrink-0 text-lime-400" />
                    <span className="truncate font-mono text-[11px] text-muted-foreground">
                      projects.com/p/felix-ayomide
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#070906] p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-lime-400/80 to-emerald-500/80 text-sm font-bold text-black">
                      FA
                    </span>
                    <div className="min-w-0">
                      <p className="font-display truncate text-lg font-bold">
                        Felix Ishola Ayomide
                      </p>
                      <p className="truncate text-xs text-lime-300">
                        Nutrition &amp; Dietetics Student · Designer · Media Strategist
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {["About", "Projects", "Skills", "Experience", "Education", "Services", "Contact"].map(
                      (t, i) => (
                        <span
                          key={t}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                            i === 0
                              ? "border-lime-400/40 bg-lime-400/10 text-lime-300"
                              : "border-white/10 text-muted-foreground",
                          )}
                        >
                          {t}
                        </span>
                      ),
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2.5">
                    {[0, 1].map((i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <div className="h-14 rounded-lg bg-gradient-to-br from-lime-400/20 to-transparent" />
                        <div className="mt-2 h-2 w-3/4 rounded-full bg-white/15" />
                        <div className="mt-1.5 h-2 w-1/2 rounded-full bg-white/8" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-2 hidden rounded-2xl border border-lime-400/30 bg-black/85 px-4 py-2.5 text-xs font-semibold text-lime-300 backdrop-blur sm:block">
                One link. Everywhere.
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="border-y border-white/8 bg-black/20">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-4">
          {[
            { label: "Portfolios published", value: stats?.portfolios },
            { label: "Projects showcased", value: stats?.projects },
            { label: "Creators on Projects", value: stats?.creators },
            { label: "Portfolio views", value: stats?.views },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-display text-3xl font-bold text-lime-300">
                {s.value === undefined || s.value === 0
                  ? s.value === undefined
                    ? "—"
                    : "0"
                  : formatCount(s.value)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps to your own website"
          description="No code, no design skills, no hosting to figure out. Just your work, presented properly."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08} className="h-full">
              <div className="h-full rounded-3xl border border-white/10 bg-card p-6 transition-colors hover:border-lime-400/30">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-lime-400/12 text-lime-300">
                    <s.icon className="size-5" />
                  </span>
                  <span className="font-display text-3xl font-bold text-white/8">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="font-display mt-5 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── What your portfolio holds ────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <SectionHeading
          align="left"
          eyebrow="Everything included"
          title="A complete professional profile"
          description="Every section is editable from your dashboard, in any order you like."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((s, i) => (
            <Reveal key={s.label} delay={(i % 4) * 0.05} className="h-full">
              <div className="h-full rounded-2xl border border-white/10 bg-card p-5 transition-colors hover:border-lime-400/30">
                <span className="flex size-9 items-center justify-center rounded-xl bg-white/5 text-lime-300">
                  <s.icon className="size-4" />
                </span>
                <h3 className="font-display mt-3.5 text-sm font-semibold">{s.label}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Templates ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <SectionHeading
          eyebrow="Templates"
          title="Looks like a website, not a template"
          description="Start with a template, then set your accent colour. Switch any time — your content stays exactly where it is."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {TEMPLATES.map((t, i) => (
            <Reveal key={t.key} delay={i * 0.07}>
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-card p-3 transition-colors hover:border-lime-400/35">
                <div
                  className="rounded-2xl border border-white/10 p-4"
                  style={{ background: t.bg }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-8 rounded-full"
                      style={{ background: `${t.accent}33` }}
                    />
                    <div className="flex-1">
                      <div
                        className="h-2 w-2/3 rounded-full"
                        style={{ background: t.accent }}
                      />
                      <div className="mt-1.5 h-2 w-1/2 rounded-full bg-white/15" />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {["About", "Projects", "Skills"].map((x) => (
                      <span
                        key={x}
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: `${t.accent}22`, color: t.accent }}
                      >
                        {x}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[0, 1].map((n) => (
                      <div
                        key={n}
                        className="h-12 rounded-lg border border-white/10"
                        style={{ background: `${t.accent}14` }}
                      />
                    ))}
                  </div>
                </div>
                <p className="mt-3 px-1 pb-1 text-sm font-semibold">{t.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Featured portfolios ──────────────────────────────────────────── */}
      {featured && featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
          <SectionHeading
            align="left"
            eyebrow="From the community"
            title="Portfolios people are sharing"
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p, i) => (
              <Reveal key={p._id} delay={i * 0.06} className="h-full">
                <Link
                  to={`/p/${p.slug}`}
                  className="group flex h-full flex-col rounded-3xl border border-white/10 bg-card p-5 transition-colors hover:border-lime-400/35"
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={p.displayName} image={p.avatarUrl} className="size-12" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-display truncate text-base font-semibold">
                          {p.displayName}
                        </p>
                        <Star className="size-3.5 shrink-0 fill-lime-400 text-lime-400" />
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {p.headline || "Portfolio"}
                      </p>
                    </div>
                  </div>
                  {p.skills.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {p.skills.map((s) => (
                        <span
                          key={s.name}
                          className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-5 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Eye className="size-3.5" /> {p.views}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-lime-300">
                      View portfolio <ArrowRight className="size-3.5" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ── Ecosystem ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <SectionHeading
          eyebrow="The ForgeX Network"
          title="One ecosystem, three products"
          description="Projects is live today. Academy and Opportunity Hub are being built — and will slot straight in when they're ready."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {products.map((p) => {
            const active = p.state === "active";
            return (
              <Reveal key={p.key} className="h-full">
                <div
                  className={cn(
                    "flex h-full flex-col rounded-3xl border p-6",
                    active
                      ? "border-lime-400/35 bg-gradient-to-br from-lime-400/12 to-card"
                      : "border-white/10 bg-card",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex size-11 items-center justify-center rounded-2xl",
                        active ? "bg-lime-400/15 text-lime-300" : "bg-white/5 text-muted-foreground",
                      )}
                    >
                      {active ? <Rocket className="size-5" /> : <Lock className="size-5" />}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                        active
                          ? "border-lime-400/40 bg-lime-400/10 text-lime-300"
                          : "border-white/10 text-muted-foreground",
                      )}
                    >
                      {active ? "Live" : "Coming soon"}
                    </span>
                  </div>
                  <h3 className="font-display mt-5 text-xl font-bold">{p.label}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {p.tagline ||
                      (active
                        ? "Create your portfolio once and share one link."
                        : "A locked future product — coming soon.")}
                  </p>
                  {active ? (
                    <Link to="/auth?mode=signup" className="mt-5">
                      <Button className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                        Start now <ArrowRight className="size-4" />
                      </Button>
                    </Link>
                  ) : (
                    <Link
                      to={p.key === "academy" ? "/academy" : "/opportunity-hub"}
                      className="mt-5"
                    >
                      <Button
                        variant="outline"
                        className="w-full gap-2 border-white/15 text-muted-foreground hover:border-lime-400/40 hover:text-lime-300"
                      >
                        <HeartHandshake className="size-4" /> Notify me
                      </Button>
                    </Link>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-lime-400/25 bg-gradient-to-br from-lime-400/12 via-card to-transparent p-10 text-center sm:p-16">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 left-1/2 h-64 w-1/2 -translate-x-1/2 rounded-full bg-lime-400/15 blur-[100px]"
            />
            <div className="relative">
              <Target className="mx-auto size-9 text-lime-300" />
              <h2 className="font-display mx-auto mt-5 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                Build it once. Share one link. Get seen.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                Your portfolio is the fastest way to be taken seriously. Start
                free and publish in minutes.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link to="/auth?mode=signup">
                  <Button
                    size="lg"
                    className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300 glow-lime-soft"
                  >
                    Create my portfolio <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <Link to="/explore">
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 border-white/15 hover:border-lime-400/40 hover:text-lime-300"
                  >
                    <Compass className="size-4" /> See examples
                  </Button>
                </Link>
              </div>
              <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                {["Free to start", "Your own URL", "Publish or keep private"].map((t) => (
                  <li key={t} className="inline-flex items-center gap-1.5">
                    <Check className="size-3.5 text-lime-400" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

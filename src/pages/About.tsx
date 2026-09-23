import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  Compass,
  Globe,
  HeartHandshake,
  Lightbulb,
  Lock,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "@/components/site/SectionHeading";
import { cn } from "@/lib/utils";
import { useBranding } from "@/lib/branding";

const VALUES = [
  {
    icon: ShieldCheck,
    title: "You own your identity",
    body: "Your portfolio belongs to you. You decide whether it's private, link-only, or discoverable in Explore — and you can change that any time.",
  },
  {
    icon: Sparkles,
    title: "Show, don't tell",
    body: "Lists of skills are easy to fake. Work isn't. Portfolio puts your actual work in front of people, with the context to understand it.",
  },
  {
    icon: Globe,
    title: "One link changes things",
    body: "A professional link you can put in a bio, a CV, a DM or an application is the simplest upgrade a career can get.",
  },
  {
    icon: Users,
    title: "Built for everyone starting out",
    body: "Students, self-taught builders, career switchers and freelancers. You don't need a design agency or a developer to look credible.",
  },
];

const PRODUCTS = [
  {
    key: "projects",
    label: "Portfolio",
    state: "live",
    icon: Rocket,
    body: "Where you create, manage and share your professional portfolio as your own website.",
  },
  {
    key: "academy",
    label: "Academy",
    state: "locked",
    icon: Lock,
    body: "Structured learning paths, practical projects, assessments and verifiable certificates.",
  },
  {
    key: "opportunity-hub",
    label: "Opportunity Hub",
    state: "locked",
    icon: HeartHandshake,
    body: "Internships, jobs, scholarships and entrepreneurship — the bridge from skills to opportunity.",
  },
];

export default function About() {
  const branding = useBranding();
  const stats = useQuery(api.projects.projectsStats);

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 mx-auto h-[340px] max-w-3xl rounded-full bg-lime-400/8 blur-[120px]"
      />

      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-4 pb-14 pt-16 sm:px-6 sm:pt-24">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/25 bg-lime-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-lime-300">
            <Lightbulb className="size-3.5" /> About {branding.name}
          </span>
          <h1 className="font-display mt-6 text-4xl font-bold leading-[1.06] tracking-tight sm:text-6xl">
            The fastest way to be taken seriously online
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            {branding.name} is a portfolio platform. You create your portfolio once —
            your work, your skills, your experience — and turn it into your own
            professional website. Then you share one link: your CV, your bio,
            your applications, anywhere.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth?mode=signup">
              <Button size="lg" className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                Create your portfolio <ArrowRight className="size-4" />
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
          </div>
        </div>

        {stats && (
          <div className="mt-14 grid gap-6 rounded-3xl border border-white/10 bg-card p-8 sm:grid-cols-3">
            {[
              { label: "Portfolios published", value: stats.portfolios },
              { label: "Projects showcased", value: stats.projects },
              { label: `Creators on ${branding.name}`, value: stats.creators },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-display text-4xl font-bold text-gradient">
                  {s.value}
                </div>
                <div className="mt-1.5 text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Mission / vision */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-3xl border border-white/10 bg-card p-8">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
                <Target className="size-6" />
              </span>
              <h2 className="font-display mt-5 text-2xl font-bold">What we do</h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                We give people the tools to present their work properly: editable
                portfolio sections, project showcases, templates, a clean public
                URL, and a deliberate visibility setting so you control who sees
                what.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="h-full rounded-3xl border border-white/10 bg-card p-8">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
                <Lightbulb className="size-6" />
              </span>
              <h2 className="font-display mt-5 text-2xl font-bold">Why we exist</h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Too much talent is invisible. Brilliant work disappears into
                camera rolls, group chats and unfinished folders because there's
                nowhere good to put it. {branding.name} exists to fix that in minutes,
                not months.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <SectionHeading
          align="left"
          eyebrow="What we believe"
          title="Our principles"
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={(i % 2) * 0.07} className="h-full">
              <div className="flex h-full gap-4 rounded-2xl border border-white/10 bg-card p-6 transition-colors hover:border-lime-400/30">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                  <v.icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-display text-base font-semibold">{v.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {v.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Ecosystem */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <SectionHeading
          eyebrow="The bigger picture"
          title={`Part of ${branding.name}`}
          description={`${branding.productLabel} is the first product of ${branding.name}. Two more are on the way — and they'll plug straight into the portfolio you build here.`}
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PRODUCTS.map((p) => {
            const live = p.state === "live";
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
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex size-11 items-center justify-center rounded-2xl",
                        live ? "bg-lime-400/15 text-lime-300" : "bg-white/5 text-muted-foreground",
                      )}
                    >
                      <p.icon className="size-5" />
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
                    {p.body}
                  </p>
                  <Link
                    to={live ? "/auth?mode=signup" : p.key === "academy" ? "/academy" : "/opportunity-hub"}
                    className="mt-5"
                  >
                    <Button
                      variant={live ? "default" : "outline"}
                      className={cn(
                        "w-full gap-2",
                        live
                          ? "bg-lime-400 font-semibold text-black hover:bg-lime-300"
                          : "border-white/15 text-muted-foreground hover:border-lime-400/40 hover:text-lime-300",
                      )}
                    >
                      {live ? "Start now" : "Notify me"} <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mt-16">
          <div className="rounded-3xl border border-lime-400/20 bg-gradient-to-br from-lime-400/10 via-card to-transparent p-10 text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              Ready to build yours?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              It takes minutes to create your portfolio, and you can publish,
              keep it private, or make it discoverable whenever you're ready.
            </p>
            <Link to="/auth?mode=signup" className="mt-7 inline-block">
              <Button size="lg" className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300 glow-lime-soft">
                Create my portfolio <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

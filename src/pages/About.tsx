import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  Compass,
  Eye,
  ExternalLink,
  HeartHandshake,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "@/components/site/SectionHeading";
import { toExternalHref } from "@/lib/url";

export default function About() {
  const content = useQuery(api.public.siteContentAll);
  const about = content?.about as
    | {
        story?: string;
        impact?: Array<{ value: string; label: string }>;
        values?: Array<{ title: string; description: string }>;
      }
    | undefined;
  const mission = content?.mission as string | undefined;
  const vision = content?.vision as string | undefined;

  // Admin socials: array of {platform, url, enabled?, order?}. Defensive
  // normalization so a malformed/legacy value can never crash the page.
  const socialLinks = (
    (Array.isArray(content?.socials) ? content.socials : []) as Array<{
      platform: string;
      url: string;
      enabled?: boolean;
      order?: number;
    }>
  )
    .filter((s) => s && s.url && s.enabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6">
        <Reveal className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/25 bg-lime-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-lime-300">
            About us
          </span>
          <h1 className="font-display mt-6 text-5xl font-bold tracking-tight sm:text-6xl">
            We build the bridge between{" "}
            <span className="text-gradient">learning and opportunity</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            ForgeX Academy is the learning platform of ForgeX Network — a
            community built to prepare people for internships, jobs,
            scholarships and entrepreneurship.
          </p>
        </Reveal>

        {/* Mission & Vision */}
        <div className="mt-16 grid gap-6 md:grid-cols-2">
          <Reveal>
            <div className="relative h-full overflow-hidden rounded-3xl border border-white/10 bg-card p-8">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
                <Target className="size-6" />
              </span>
              <h2 className="font-display mt-5 text-2xl font-bold">Our mission</h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                {mission ??
                  "To empower individuals through accessible, practical, and industry-relevant learning that prepares them for real-world opportunities."}
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="relative h-full overflow-hidden rounded-3xl border border-white/10 bg-card p-8">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
                <Eye className="size-6" />
              </span>
              <h2 className="font-display mt-5 text-2xl font-bold">Our vision</h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                {vision ??
                  "To become a trusted learning platform where people develop valuable skills, earn credible certifications, and unlock meaningful opportunities."}
              </p>
            </div>
          </Reveal>
        </div>

        {/* Story */}
        <Reveal className="mt-20">
          <SectionHeading align="left" eyebrow="Why we exist" title="Our story" />
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">
            {about?.story ??
              "ForgeX Academy was born inside ForgeX Network — a community built to prepare young people for internships, jobs, scholarships and entrepreneurship. We saw too many learners stuck between tutorials and opportunity, so we built the missing bridge: structured paths, real tutors, hands-on projects, and certificates that verify."}
          </p>
        </Reveal>

        {/* Impact */}
        {about?.impact && (
          <Reveal className="mt-16">
            <div className="grid gap-6 rounded-3xl border border-white/10 bg-card p-10 sm:grid-cols-2 lg:grid-cols-4">
              {about.impact.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="font-display text-4xl font-bold text-gradient">
                    {s.value}
                  </div>
                  <div className="mt-1.5 text-sm text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {/* Values */}
        {about?.values && (
          <div className="mt-20">
            <SectionHeading eyebrow="What we believe" title="Our values" />
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {about.values.map((v, i) => (
                <Reveal key={v.title} delay={(i % 2) * 0.07}>
                  <div className="flex h-full gap-4 rounded-2xl border border-white/10 bg-card p-6 transition-colors hover:border-lime-400/30">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                      <HeartHandshake className="size-5" />
                    </span>
                    <div>
                      <h3 className="font-display text-base font-semibold">{v.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {v.description}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        )}

        {/* Social links */}
        <Reveal className="mt-20">
          <SectionHeading
            eyebrow="Follow us"
            title="Connect with ForgeX"
          />
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {/* Admin socials are stored as an array of
                {platform, url, enabled, order} — the same shape Footer uses.
                Reading it as a map crashed on toExternalHref(url) (url was an
                object), which surfaced as the page "refreshing" in a loop. */}
            {socialLinks.map(({ platform, url }) => (
              <a
                key={platform}
                href={toExternalHref(url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
              >
                {platform.charAt(0).toUpperCase() + platform.slice(1)}
                <ExternalLink className="size-3.5" />
              </a>
            ))}
          </div>
        </Reveal>

        {/* CTA */}
        <Reveal className="mt-20 text-center">
          <div className="mx-auto max-w-3xl rounded-3xl border border-lime-400/25 bg-gradient-to-br from-lime-400/12 to-card p-10">
            <Compass className="mx-auto size-10 text-lime-300" />
            <h2 className="font-display mt-4 text-3xl font-bold">
              Ready to start your path?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Join thousands of students building skills that lead somewhere.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link to="/courses">
                <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                  Explore courses <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/roadmap">
                <Button variant="outline" className="border-white/15 hover:border-lime-400/40 hover:text-lime-300">
                  View roadmaps
                </Button>
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </PageShell>
  );
}

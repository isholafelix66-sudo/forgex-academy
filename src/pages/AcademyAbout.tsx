import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  Compass,
  GraduationCap,
  Rocket,
  Target,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/site/Reveal";
import { SafeImage } from "@/components/site/SafeImage";
import { Stat } from "@/components/site/Stat";

/**
 * ForgeX Academy — About page.
 *
 * Mission / vision / story / imagery are all editable from the Academy admin
 * dashboard (Admin → Website & branding) and stored in `siteContent`. This is
 * the Academy product's own About page — it is deliberately separate from the
 * Portfolio site's About page.
 */

const DEFAULT_MISSION =
  "To empower individuals through accessible, practical, and industry-relevant learning that prepares them for real-world opportunities.";

const DEFAULT_VISION =
  "To become a trusted learning platform where people develop valuable skills, earn credible certifications, and unlock meaningful opportunities.";

const DEFAULT_ABOUT =
  "ForgeX Academy is the learning platform of ForgeX Network. We help people acquire real skills through structured learning paths, taught by tutors who actually build. You take assessments, complete projects, earn certificates — and leave with proof of what you can do.";

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export default function AcademyAbout() {
  const content = useQuery(api.public.siteContentAll);
  const stats = useQuery(api.public.stats);

  const mission = str(content?.mission) ?? DEFAULT_MISSION;
  const vision = str(content?.vision) ?? DEFAULT_VISION;
  const about = str(content?.about) ?? DEFAULT_ABOUT;
  const aboutImage = str(content?.aboutImage);
  const missionImage = str(content?.missionImage);
  const visionImage = str(content?.visionImage);

  return (
    <div className="relative overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 mx-auto h-[340px] max-w-3xl rounded-full bg-lime-400/8 blur-[120px]"
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 sm:pt-24">
        <Reveal className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/25 bg-lime-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-lime-300">
            <GraduationCap className="size-3.5" /> About ForgeX Academy
          </span>
          <h1 className="font-display mt-6 text-4xl font-bold leading-[1.06] tracking-tight sm:text-6xl">
            Learn. Build. Succeed.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            {about}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/academy/login?mode=signup">
              <Button
                size="lg"
                className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
              >
                Join ForgeX free <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/academy/courses">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-white/15 hover:border-lime-400/40 hover:text-lime-300"
              >
                <Compass className="size-4" /> Explore courses
              </Button>
            </Link>
          </div>
        </Reveal>

        {aboutImage && (
          <Reveal delay={0.1} className="mt-12">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-card">
              <SafeImage
                src={aboutImage}
                alt="ForgeX Academy"
                className="aspect-[16/7] w-full object-cover"
                fallback={<div className="aspect-[16/7] bg-gradient-to-br from-lime-400/20 via-black to-black" />}
              />
            </div>
          </Reveal>
        )}

        {stats && (
          <Reveal delay={0.12} className="mt-12">
            <div className="grid gap-6 rounded-3xl border border-white/10 bg-card p-8 sm:grid-cols-2 lg:grid-cols-4">
              <Stat value={`${stats.courses}`} label="Courses published" />
              <Stat value={`${stats.tutors}`} label="Verified tutors" delay={0.05} />
              <Stat value={`${stats.students}`} label="Learners" delay={0.1} />
              <Stat value={`${stats.certificates}`} label="Certificates issued" delay={0.15} />
            </div>
          </Reveal>
        )}
      </section>

      {/* ── Mission & vision ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-card p-8">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
                <Target className="size-6" />
              </span>
              <h2 className="font-display mt-5 text-2xl font-bold">Our mission</h2>
              <p className="mt-3 flex-1 text-base leading-relaxed text-muted-foreground">
                {mission}
              </p>
              {missionImage && (
                <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                  <SafeImage
                    src={missionImage}
                    alt="Our mission"
                    className="aspect-[16/9] w-full object-cover"
                    fallback={<div className="aspect-[16/9] bg-black/40" />}
                  />
                </div>
              )}
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-card p-8">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
                <Rocket className="size-6" />
              </span>
              <h2 className="font-display mt-5 text-2xl font-bold">Our vision</h2>
              <p className="mt-3 flex-1 text-base leading-relaxed text-muted-foreground">
                {vision}
              </p>
              {visionImage && (
                <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                  <SafeImage
                    src={visionImage}
                    alt="Our vision"
                    className="aspect-[16/9] w-full object-cover"
                    fallback={<div className="aspect-[16/9] bg-black/40" />}
                  />
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <Reveal>
          <div className="rounded-[2rem] border border-lime-400/20 bg-gradient-to-br from-lime-400/12 via-card to-emerald-500/5 p-9 text-center sm:p-14">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-lime-400/25 bg-lime-400/10 text-lime-300">
              <Users className="size-7" />
            </span>
            <h2 className="font-display mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
              Start learning with ForgeX Academy
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Create a free account, pick a roadmap, and turn what you learn into
              a certificate you can share.
            </p>
            <Link to="/academy/login?mode=signup" className="mt-7 inline-block">
              <Button
                size="lg"
                className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300 glow-lime-soft"
              >
                Create your free account <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

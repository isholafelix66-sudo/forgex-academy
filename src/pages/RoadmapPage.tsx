import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  Map,
  PlayCircle,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "@/components/site/SectionHeading";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export default function RoadmapPage() {
  const { isAuthenticated } = useAuth();
  const roadmaps = useQuery(api.public.roadmapsAll);
  const myRoadmaps = useQuery(
    api.learn.roadmapProgress,
    isAuthenticated ? {} : "skip",
  );

  const withProgress = (roadmapId: string) =>
    myRoadmaps?.find((r) => r._id === roadmapId);

  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-14 sm:px-6">
        <Reveal>
          <span className="w-fit rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-lime-300">
            Learning roadmaps
          </span>
          <h1 className="font-display mt-3 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Follow a path, not a playlist
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Each roadmap takes you from beginner to certified. Levels unlock as
            you complete the courses inside them — so your progress is always
            visible.
          </p>
        </Reveal>

        {roadmaps === undefined ? (
          <div className="mt-12 space-y-8">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-96 animate-pulse rounded-3xl border border-white/8 bg-card" />
            ))}
          </div>
        ) : roadmaps.length === 0 ? (
          <div className="mt-12 text-center text-muted-foreground">
            Roadmaps are being built — check back soon.
          </div>
        ) : (
          <div className="mt-12 space-y-12">
            {roadmaps.map((rm, ri) => {
              const mine = withProgress(rm._id);
              return (
                <Reveal key={rm._id} delay={ri * 0.05}>
                  <div className="overflow-hidden rounded-3xl border border-white/10 bg-card">
                    <div className="flex flex-col gap-4 border-b border-white/10 bg-black/20 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                      <div className="flex items-start gap-4">
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
                          <Map className="size-6" />
                        </span>
                        <div>
                          <h2 className="font-display text-2xl font-bold">
                            {rm.name}
                          </h2>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {rm.tagline}
                          </p>
                        </div>
                      </div>
                      {mine && (
                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm">
                          <span className="text-muted-foreground">Your progress</span>
                          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-lime-400 transition-all"
                              style={{
                                width: `${Math.round(
                                  (mine.levels.filter((l) => l.done).length /
                                    Math.max(1, mine.levels.length)) *
                                    100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-0 p-6 sm:p-8 lg:grid-cols-5">
                      {rm.levels.map((lvl, i) => {
                        const isLast = i === rm.levels.length - 1;
                        const unlocked = !mine || lvl.unlocked;
                        return (
                          <div key={lvl._id} className="relative">
                            {!isLast && (
                              <span className="absolute left-6 top-14 hidden h-px w-full bg-gradient-to-r from-lime-400/40 to-white/10 lg:block" />
                            )}
                            <div className="flex flex-col items-start gap-3 lg:items-center lg:text-center">
                              <div
                                className={cn(
                                  "relative z-10 flex size-12 items-center justify-center rounded-full border text-sm font-bold",
                                  lvl.done
                                    ? "border-lime-400 bg-lime-400 text-black"
                                    : unlocked
                                      ? "border-lime-400/40 bg-lime-400/10 text-lime-300"
                                      : "border-white/10 bg-white/5 text-muted-foreground",
                                )}
                              >
                                {lvl.done ? (
                                  <CheckCircle2 className="size-6" />
                                ) : unlocked ? (
                                  i + 1
                                ) : (
                                  <Lock className="size-4" />
                                )}
                              </div>
                              <div className="px-1">
                                <p
                                  className={cn(
                                    "text-xs font-semibold uppercase tracking-wider",
                                    unlocked ? "text-lime-300/80" : "text-muted-foreground/60",
                                  )}
                                >
                                  Level {i + 1}
                                </p>
                                <h3 className="mt-1 font-display text-base font-semibold">
                                  {lvl.title}
                                </h3>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                  {lvl.description}
                                </p>
                              </div>

                              <div className="mt-1 flex flex-col gap-2">
                                {lvl.courses.map((c) => (
                                  <Link
                                    key={c._id}
                                    to={`/courses/${c.slug}`}
                                    className={cn(
                                      "flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs transition-colors hover:border-lime-400/40",
                                      unlocked
                                        ? "hover:text-lime-300"
                                        : "pointer-events-none opacity-50",
                                    )}
                                  >
                                    <PlayCircle className="size-3.5 shrink-0" />
                                    <span className="truncate">{c.title}</span>
                                    {c.status === "completed" ? (
                                      <CheckCircle2 className="ml-auto size-3.5 shrink-0 text-lime-400" />
                                    ) : (
                                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                                        {c.progress > 0 ? `${c.progress}%` : ""}
                                      </span>
                                    )}
                                  </Link>
                                ))}
                                {lvl.courses.length === 0 && (
                                  <span className="rounded-xl border border-dashed border-white/10 px-3 py-2 text-xs text-muted-foreground/60">
                                    Courses coming soon
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between border-t border-white/10 bg-black/20 px-6 py-4 sm:px-8">
                      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <Rocket className="size-4 text-lime-300" />
                        {mine
                          ? `${mine.levels.filter((l) => l.done).length}/${mine.levels.length} levels complete`
                          : "Free · learn at your own pace"}
                      </span>
                      <Link to="/courses">
                        <Button variant="outline" size="sm" className="gap-1.5 border-white/15 hover:border-lime-400/40 hover:text-lime-300">
                          Browse courses <ArrowRight className="size-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}

        <Reveal className="mt-16">
          <SectionHeading
            eyebrow="Not sure where to start?"
            title="Start with any roadmap — first level is free"
            description="Every roadmap's first level is fully open. Complete it, unlock the next, and keep going until you're certified."
          />
        </Reveal>
      </section>
    </PageShell>
  );
}

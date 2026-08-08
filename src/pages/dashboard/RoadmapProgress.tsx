import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowRight, CheckCircle2, Lock, Map, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { cn } from "@/lib/utils";

export default function RoadmapProgress() {
  const roadmaps = useQuery(api.learn.roadmapProgress);

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Roadmaps"
        description="Levels unlock as you complete the courses inside them."
        actions={
          <Link to="/roadmap">
            <Button variant="outline" className="border-white/15 hover:border-lime-400/40 hover:text-lime-300">
              All roadmaps <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        }
      />

      {roadmaps === undefined ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-3xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : roadmaps.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-muted-foreground">
          No roadmaps available yet.
        </p>
      ) : (
        roadmaps.map((rm) => {
          const doneLevels = rm.levels.filter((l) => l.done).length;
          const overall =
            rm.levels.length > 0
              ? Math.round((doneLevels / rm.levels.length) * 100)
              : 0;
          return (
            <div key={rm._id} className="overflow-hidden rounded-3xl border border-white/10 bg-card">
              <div className="flex flex-col gap-4 border-b border-white/10 bg-black/20 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
                    <Map className="size-5" />
                  </span>
                  <div>
                    <h2 className="font-display text-xl font-bold">{rm.name}</h2>
                    <p className="text-xs text-muted-foreground">{rm.tagline}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {doneLevels}/{rm.levels.length} levels
                  </span>
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-lime-400 transition-all" style={{ width: `${overall}%` }} />
                  </div>
                </div>
              </div>

              <div className="grid gap-0 p-6 sm:p-8 lg:grid-cols-5">
                {rm.levels.map((lvl, i) => {
                  const isLast = i === rm.levels.length - 1;
                  return (
                    <div key={lvl._id} className="relative">
                      {!isLast && (
                        <span className="absolute left-6 top-12 hidden h-px w-full bg-gradient-to-r from-lime-400/40 to-white/10 lg:block" />
                      )}
                      <div className="flex flex-col items-start gap-3 lg:items-center lg:text-center">
                        <div
                          className={cn(
                            "relative z-10 flex size-11 items-center justify-center rounded-full border text-sm font-bold",
                            lvl.done
                              ? "border-lime-400 bg-lime-400 text-black"
                              : lvl.unlocked
                                ? "border-lime-400/40 bg-lime-400/10 text-lime-300"
                                : "border-white/10 bg-white/5 text-muted-foreground",
                          )}
                        >
                          {lvl.done ? <CheckCircle2 className="size-5" /> : lvl.unlocked ? i + 1 : <Lock className="size-4" />}
                        </div>
                        <div className="px-1">
                          <p className={cn("text-[11px] font-semibold uppercase tracking-wider", lvl.unlocked ? "text-lime-300/80" : "text-muted-foreground/50")}>
                            Level {i + 1}
                          </p>
                          <h3 className="mt-0.5 font-display text-sm font-semibold">{lvl.title}</h3>
                        </div>
                        <div className="flex w-full flex-col gap-1.5">
                          {lvl.courses.map((c) => (
                            <Link
                              key={c._id}
                              to={lvl.unlocked ? `/learn/${c.slug}` : `/courses/${c.slug}`}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs transition-colors hover:border-lime-400/40",
                                lvl.unlocked ? "hover:text-lime-300" : "pointer-events-none opacity-50",
                              )}
                            >
                              <PlayCircle className="size-3.5 shrink-0" />
                              <span className="truncate">{c.title}</span>
                              {c.status === "completed" ? (
                                <CheckCircle2 className="ml-auto size-3.5 shrink-0 text-lime-400" />
                              ) : (
                                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                                  {c.progress > 0 ? `${c.progress}%` : "Start"}
                                </span>
                              )}
                            </Link>
                          ))}
                          {lvl.courses.length === 0 && (
                            <span className="rounded-xl border border-dashed border-white/10 px-3 py-2 text-xs text-muted-foreground/50">
                              Coming soon
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

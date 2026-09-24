import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { GraduationCap, Users } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { Avatar } from "@/components/site/Avatar";
import { EmptyState } from "@/components/site/EmptyState";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Tutors() {
  const tutors = useQuery(api.public.tutorsList);

  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-14 sm:px-6">
        <Reveal>
          <span className="w-fit rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-lime-300">
            Tutors
          </span>
          <h1 className="font-display mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Meet the people behind the courses
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Every tutor is a practicing professional, verified by the Academy
            before their dashboard opens.
          </p>
        </Reveal>

        {tutors === undefined ? (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl border border-white/8 bg-card" />
            ))}
          </div>
        ) : tutors.length === 0 ? (
          <div className="mt-12">
            <EmptyState
              icon={<GraduationCap className="size-6" />}
              title="No tutors yet"
              description="Tutors are onboarded as they're verified. Check back soon."
            />
          </div>
        ) : (
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tutors.map((t, i) => (
              <Reveal key={t._id} delay={(i % 3) * 0.06}>
                <Link
                  to={t.slug ? `/tutor/${t.slug}` : `/tutors/${t._id}`}
                  className="card-lift group flex h-full flex-col rounded-2xl border border-white/8 bg-card p-6"
                >
                  <div className="flex items-center gap-4">
                    <Avatar
                      name={t.name}
                      image={t.image}
                      className="size-14 text-lg transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-lg font-semibold group-hover:text-lime-300">
                        {t.name}
                      </h2>
                      {t.headline && (
                        <p className="truncate text-sm text-muted-foreground">
                          {t.headline}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {t.bio}
                  </p>
                  {t.skills.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {t.skills.slice(0, 4).map((s) => (
                        <span
                          key={s}
                          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto flex items-center gap-3 pt-5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3.5 fill-amber-400 text-amber-400" />
                      {t.avgRating.toFixed(1)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <GraduationCap className="size-3.5" /> {t.courseCount} courses
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" /> {t.studentCount.toLocaleString()}
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}

        <Reveal className="mt-16 text-center">
          <div className="mx-auto max-w-2xl rounded-3xl border border-lime-400/25 bg-gradient-to-br from-lime-400/12 to-card p-10">
            <h2 className="font-display text-2xl font-bold">
              Are you a practicing professional?
            </h2>
            <p className={cn("mt-2 text-sm text-muted-foreground")}>
              Apply to become a verified ForgeX Academy tutor. Get reviewed by
              our admin team and start teaching.
            </p>
            <Link to="/academy/become-tutor" className="mt-5 inline-block">
              <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                Apply to teach <GraduationCap className="size-4" />
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>
    </PageShell>
  );
}

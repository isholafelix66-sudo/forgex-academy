import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Compass,
  Eye,
  FolderKanban,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/site/Avatar";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "@/components/site/SectionHeading";
import { cn } from "@/lib/utils";

/**
 * Public discovery: portfolios that their owners deliberately made
 * `discoverable`. Draft and link-only portfolios never appear here.
 */
export default function Explore() {
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState<string | null>(null);

  const skills = useQuery(api.projects.exploreSkills);
  const results = useQuery(api.projects.explorePortfolios, {
    q: query.trim() || undefined,
    skill: skill ?? undefined,
    limit: 36,
  });

  const active = useMemo(
    () => (query.trim().length > 0 || !!skill),
    [query, skill],
  );

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 mx-auto h-[360px] max-w-3xl rounded-full bg-lime-400/8 blur-[120px]"
      />

      <section className="relative mx-auto max-w-7xl px-4 pb-10 pt-16 sm:px-6 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/25 bg-lime-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-lime-300">
            <Compass className="size-3.5" /> Explore
          </span>
          <h1 className="font-display mt-6 text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl">
            Discover people and the work they <span className="text-gradient">build</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Every portfolio here was published by its owner and made
            discoverable. Browse their projects, skills and experience — or
            start building your own.
          </p>
        </div>

        {/* Search + skill filters */}
        <Reveal className="mx-auto mt-10 max-w-3xl">
          <div className="rounded-3xl border border-white/10 bg-card p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, skill, project or location…"
                aria-label="Search portfolios"
                className="h-11 border-white/10 bg-black/20 pl-9"
              />
            </div>
            {(skills?.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {skills!.map((s) => (
                  <button
                    key={s.name}
                    onClick={() => setSkill(skill === s.name ? null : s.name)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      skill === s.name
                        ? "border-lime-400/50 bg-lime-400/12 text-lime-300"
                        : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground",
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        {results === undefined ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-3xl border border-white/10 bg-card"
              />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-card p-12 text-center">
            <Sparkles className="mx-auto size-10 text-lime-300/70" />
            <h3 className="font-display mt-4 text-lg font-semibold">
              {active ? "No portfolios match that" : "No portfolios are public yet"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {active
                ? "Try a different search or clear the filters to see everyone who's discoverable."
                : "Be the first — publish your portfolio, make it discoverable, and you'll show up here."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {active && (
                <Button
                  variant="outline"
                  className="gap-2 border-white/15"
                  onClick={() => {
                    setQuery("");
                    setSkill(null);
                  }}
                >
                  <X className="size-4" /> Clear filters
                </Button>
              )}
              <Link to="/auth?mode=signup">
                <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                  Create your portfolio <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((p, i) => (
              <Reveal key={p._id} delay={(i % 3) * 0.06} className="h-full">
                <motion.article
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="group flex h-full flex-col rounded-3xl border border-white/10 bg-card p-5 transition-colors hover:border-lime-400/35"
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      name={p.displayName}
                      image={p.avatarUrl}
                      className="size-12"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-display truncate text-base font-semibold">
                          {p.displayName}
                        </h3>
                        {p.featured && (
                          <Star className="size-3.5 shrink-0 fill-lime-400 text-lime-400" />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {p.headline || "Portfolio"}
                      </p>
                    </div>
                  </div>

                  {p.skills.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {p.skills.slice(0, 4).map((s) => (
                        <span
                          key={s.name}
                          className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto flex items-center gap-4 pt-5 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <FolderKanban className="size-3.5" />
                      {p.projectCount} project{p.projectCount === 1 ? "" : "s"}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Eye className="size-3.5" />
                      {p.views}
                    </span>
                    {p.location && (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{p.location}</span>
                      </span>
                    )}
                  </div>

                  <Link
                    to={`/p/${p.slug}`}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-lime-400/30 bg-lime-400/10 px-4 py-2.5 text-sm font-semibold text-lime-300 transition-colors hover:bg-lime-400 hover:text-black"
                  >
                    View portfolio <ArrowRight className="size-4" />
                  </Link>
                </motion.article>
              </Reveal>
            ))}
          </div>
        )}

        <Reveal className="mt-20">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-lime-400/10 via-card to-transparent p-8 text-center sm:p-12">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              Your portfolio could be next
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Build it once, publish it, and share one link — your own
              professional website in minutes.
            </p>
            <Link to="/auth?mode=signup" className="mt-7 inline-block">
              <Button
                size="lg"
                className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300 glow-lime-soft"
              >
                Create my portfolio <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

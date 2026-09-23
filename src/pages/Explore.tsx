import { useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
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
import { SafeImage } from "@/components/site/SafeImage";
import { Reveal } from "@/components/site/Reveal";
import { cn } from "@/lib/utils";
import { useBranding } from "@/lib/branding";

/**
 * Explore — the public discovery feed.
 *
 * Mobile-first, matching the ForgeX Network Portfolio app: a search field,
 * category chips, then featured/recent work cards that carry the creator with
 * them. Only portfolios their owner made `discoverable` ever show up here.
 */
export default function Explore() {
  const branding = useBranding();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const recentAnchor = useRef<HTMLDivElement | null>(null);

  const categories = useQuery(api.projects.exploreCategories);
  const results = useQuery(api.projects.exploreProjects, {
    q: query.trim() || undefined,
    category: category ?? undefined,
    limit: 36,
  });
  const creators = useQuery(api.projects.explorePortfolios, {
    q: query.trim() || undefined,
    skill: category ?? undefined,
    limit: 9,
  });

  const active = query.trim().length > 0 || !!category;

  const { featured, recent } = useMemo(() => {
    const all = results ?? [];
    return {
      featured: all.filter((p) => p.featured).slice(0, 4),
      recent: all.filter((p) => !p.featured),
    };
  }, [results]);

  const clear = () => {
    setQuery("");
    setCategory(null);
  };

  const jumpToRecent = () =>
    recentAnchor.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="relative">
      {/* Background glow — the lime wash behind the whole page */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-[300px] max-w-2xl rounded-full bg-lime-400/8 blur-[120px]"
      />

      {/* ── Hero + search + filters ─────────────────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-14">
        <div className="mx-auto max-w-2xl text-center sm:max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/25 bg-lime-400/10 px-3.5 py-1.5 text-[11px] font-bold tracking-widest text-lime-300 uppercase">
            <Compass className="size-3.5" /> Explore
          </span>
          <h1 className="font-display mt-5 text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
            Discover work and the people behind it
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:max-w-2xl sm:text-base">
            Every project here was published by its creator and made
            discoverable. Browse the work, then visit their {branding.productLabel.toLowerCase()} —
            or start building your own.
          </p>
        </div>

        {/* Search */}
        <Reveal className="mx-auto mt-7 max-w-3xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects, creators…"
              aria-label="Search projects and creators"
              className="h-12 rounded-full border-white/10 bg-white/[0.03] pl-11 pr-11 text-sm placeholder:text-muted-foreground/70"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </Reveal>

        {/* Category chips */}
        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
          <Chip active={!category} onClick={() => setCategory(null)}>
            All
          </Chip>
          {(categories ?? []).map((c) => (
            <Chip
              key={c.name}
              active={category === c.name}
              onClick={() => setCategory(category === c.name ? null : c.name)}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      </section>

      {/* ── Work ────────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 sm:pt-10">
        {results === undefined ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading work…
          </div>
        ) : results.length === 0 ? (
          <EmptyState active={active} onClear={clear} />
        ) : (
          <>
            {featured.length > 0 && (
              <div>
                <SectionHead
                  title="Featured Projects"
                  onArrow={jumpToRecent}
                  arrowLabel="Skip to recent projects"
                />
                <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-5">
                  {featured.map((p, i) => (
                    <ProjectCard key={p._id} project={p} delay={(i % 2) * 0.06} />
                  ))}
                </div>
              </div>
            )}

            {recent.length > 0 && (
              <div ref={recentAnchor} className="scroll-mt-24">
                <SectionHead
                  title={featured.length > 0 ? "Recent Projects" : "Projects"}
                />
                <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-5">
                  {recent.map((p, i) => (
                    <ProjectCard key={p._id} project={p} delay={(i % 2) * 0.06} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Creators ──────────────────────────────────────────────────── */}
        {(creators?.length ?? 0) > 0 && (
          <div className="mt-14">
            <SectionHead title="Creators to follow" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {creators!.map((p, i) => (
                <Reveal key={p._id} delay={(i % 3) * 0.05} className="h-full">
                  <Link
                    to={`/p/${p.slug}`}
                    className="group flex h-full items-center gap-3 rounded-3xl border border-white/10 bg-card p-4 transition-colors hover:border-lime-400/35"
                  >
                    <Avatar name={p.displayName} image={p.avatarUrl} className="size-12" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-display truncate text-sm font-semibold">
                          {p.displayName}
                        </h3>
                        {p.featured && (
                          <Star className="size-3.5 shrink-0 fill-lime-400 text-lime-400" />
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {p.headline || branding.productLabel}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <FolderKanban className="size-3" />
                          {p.projectCount}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Eye className="size-3" />
                          {p.views}
                        </span>
                        {p.location && (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <MapPin className="size-3 shrink-0" />
                            <span className="truncate">{p.location}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-lime-300" />
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        )}

        {/* ── Closing CTA ───────────────────────────────────────────────── */}
        <Reveal className="mt-16">
          <div className="rounded-3xl border border-lime-400/20 bg-gradient-to-br from-lime-400/10 via-card to-transparent p-8 text-center sm:p-12">
            <h2 className="font-display text-xl font-bold sm:text-3xl">
              Your work could be next
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Build it once, publish it, and share one link — your own
              professional website in minutes.
            </p>
            <Link to="/auth?mode=signup" className="mt-7 inline-block">
              <Button
                size="lg"
                className="glow-lime-soft gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
              >
                Create my {branding.productLabel.toLowerCase()}{" "}
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors",
        active
          ? "border-lime-400/50 bg-lime-400 text-black"
          : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function SectionHead({
  title,
  onArrow,
  arrowLabel,
}: {
  title: string;
  onArrow?: () => void;
  arrowLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
        {title}
      </h2>
      {onArrow && (
        <button
          onClick={onArrow}
          aria-label={arrowLabel ?? "More"}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
        >
          <ArrowRight className="size-4" />
        </button>
      )}
    </div>
  );
}

type ExploreProject = FunctionReturnType<
  typeof api.projects.exploreProjects
>[number];

/** One piece of showcased work, with its creator attached. */
function ProjectCard({
  project,
  delay = 0,
}: {
  project: ExploreProject;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <motion.article
        whileHover={{ y: -3 }}
        transition={{ duration: 0.2 }}
        className="group h-full"
      >
        <Link
          to={`/p/${project.owner.slug}`}
          className="flex h-full gap-3 rounded-3xl border border-white/10 bg-card p-3 transition-colors hover:border-lime-400/35 sm:flex-col sm:p-4"
        >
          <div className="relative shrink-0 overflow-hidden rounded-2xl">
            <SafeImage
              src={project.imageUrl ?? undefined}
              alt={project.title}
              className="h-24 w-24 object-cover sm:h-44 sm:w-full"
              fallback={
                <div className="flex h-24 w-24 items-center justify-center bg-gradient-to-br from-lime-400/25 to-emerald-500/5 sm:h-44 sm:w-full">
                  <FolderKanban className="size-7 text-lime-300/80" />
                </div>
              }
            />
            {project.featured && (
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold tracking-wide text-lime-300 uppercase backdrop-blur">
                <Star className="size-2.5 fill-lime-400 text-lime-400" /> Featured
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            {project.category && (
              <span className="mb-1.5 w-fit rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-lime-300 uppercase">
                {project.category}
              </span>
            )}

            <h3 className="font-display text-base font-bold leading-snug tracking-tight sm:text-lg">
              {project.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {project.summary}
            </p>

            {project.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {project.tags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-auto flex items-center gap-2.5 pt-4">
              <Avatar
                name={project.owner.displayName}
                image={project.owner.avatarUrl ?? undefined}
                className="size-8"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">
                  {project.owner.displayName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {project.owner.headline || "Creator"}
                </p>
              </div>
              {project.liveUrl ? (
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-lime-400/15 text-lime-300 transition-colors group-hover:bg-lime-400 group-hover:text-black"
                  aria-hidden
                >
                  <ArrowUpRight className="size-4" />
                </span>
              ) : (
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-muted-foreground transition-colors group-hover:bg-lime-400 group-hover:text-black"
                  aria-hidden
                >
                  <ArrowRight className="size-4" />
                </span>
              )}
            </div>
          </div>
        </Link>
      </motion.article>
    </Reveal>
  );
}

function EmptyState({
  active,
  onClear,
}: {
  active: boolean;
  onClear: () => void;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-card p-10 text-center sm:p-12">
      <Sparkles className="mx-auto size-9 text-lime-300/70" />
      <h3 className="font-display mt-4 text-lg font-semibold">
        {active ? "Nothing matches that" : "No work is public yet"}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {active
          ? "Try a different search or clear the filters to see everything that's discoverable."
          : "Be the first — publish a project, make it discoverable, and it'll show up right here."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {active && (
          <Button variant="outline" className="gap-2 border-white/15" onClick={onClear}>
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
  );
}

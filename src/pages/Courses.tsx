import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { CourseCard } from "@/components/site/CourseCard";
import { EmptyState } from "@/components/site/EmptyState";
import { cn } from "@/lib/utils";
import type { Difficulty } from "@/lib/format";
import { DIFFICULTY_META } from "@/lib/format";

const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];
const SORTS = [
  { value: "popular", label: "Most popular" },
  { value: "rating", label: "Highest rated" },
  { value: "newest", label: "Newest" },
  { value: "duration", label: "Shortest" },
];

export default function Courses() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "";
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [duration, setDuration] = useState<number>(0);
  const [minRating, setMinRating] = useState<number>(0);
  const [sort, setSort] = useState("popular");
  const [showFilters, setShowFilters] = useState(false);

  const categories = useQuery(api.public.categoriesList);
  const courses = useQuery(api.public.coursesList, {
    search: search || undefined,
    category: category || undefined,
    difficulty: difficulty || undefined,
    maxDuration: duration || undefined,
    minRating: minRating || undefined,
    sort: sort as never,
  });

  const activeCount =
    (category ? 1 : 0) +
    (difficulty ? 1 : 0) +
    (duration ? 1 : 0) +
    (minRating ? 1 : 0);

  const clearAll = () => {
    setDifficulty("");
    setDuration(0);
    setMinRating(0);
    setSearch("");
    setParams({});
  };

  const filterChip = useMemo(
    () =>
      "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300",
    [],
  );

  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-14 sm:px-6">
        <Reveal>
          <div className="flex flex-col gap-2">
            <span className="w-fit rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-lime-300">
              Course catalog
            </span>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Browse all courses
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Project-driven courses across design, development, data, business
              and marketing. Filter by what matters to you.
            </p>
          </div>
        </Reveal>

        {/* Search + toolbar */}
        <Reveal delay={0.05} className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search courses, skills, topics…"
              className="h-11 rounded-xl border-white/10 bg-card pl-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-11 rounded-xl border border-white/10 bg-card px-3 text-sm text-foreground outline-none focus:border-lime-400/50"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              className="h-11 border-white/10"
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="mr-2 size-4" />
              Filters
              {activeCount > 0 && (
                <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-lime-400 text-[10px] font-bold text-black">
                  {activeCount}
                </span>
              )}
            </Button>
          </div>
        </Reveal>

        {/* Filter panel */}
        {showFilters && (
          <Reveal className="mt-5 rounded-2xl border border-white/10 bg-card p-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Category
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setParams({})} className={cn(filterChip, !category && "border-lime-400/50 text-lime-300")}>
                    All
                  </button>
                  {categories?.map((c) => (
                    <button
                      key={c._id}
                      onClick={() => setParams(category === c.slug ? {} : { category: c.slug })}
                      className={cn(filterChip, category === c.slug && "border-lime-400/50 text-lime-300")}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Difficulty
                </p>
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(difficulty === d ? "" : d)}
                      className={cn(filterChip, difficulty === d && "border-lime-400/50 text-lime-300")}
                    >
                      {DIFFICULTY_META[d].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Duration
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: 0, l: "Any" },
                    { v: 10, l: "≤ 10h" },
                    { v: 15, l: "≤ 15h" },
                    { v: 20, l: "≤ 20h" },
                  ].map((o) => (
                    <button
                      key={o.v}
                      onClick={() => setDuration(duration === o.v ? 0 : o.v)}
                      className={cn(filterChip, duration === o.v && "border-lime-400/50 text-lime-300")}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Minimum rating
                </p>
                <div className="flex flex-wrap gap-2">
                  {[0, 4, 4.5].map((r) => (
                    <button
                      key={r}
                      onClick={() => setMinRating(minRating === r ? 0 : r)}
                      className={cn(filterChip, minRating === r && "border-lime-400/50 text-lime-300")}
                    >
                      {r === 0 ? "Any" : `${r}★+`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {activeCount > 0 && (
              <button
                onClick={clearAll}
                className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-lime-300 hover:underline"
              >
                <X className="size-3.5" /> Clear all filters
              </button>
            )}
          </Reveal>
        )}

        {/* Results */}
        <div className="mt-10">
          {courses === undefined ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-80 animate-pulse rounded-2xl border border-white/8 bg-card" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <EmptyState
              icon={<Search className="size-6" />}
              title="No courses match those filters"
              description="Try widening your search or clearing a filter or two."
              action={
                <Button variant="outline" onClick={clearAll}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <p className="mb-5 text-sm text-muted-foreground">
                {courses.length} course{courses.length !== 1 ? "s" : ""} found
              </p>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((c, i) => (
                  <Reveal key={c._id} delay={(i % 3) * 0.05}>
                    <CourseCard course={c} />
                  </Reveal>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </PageShell>
  );
}

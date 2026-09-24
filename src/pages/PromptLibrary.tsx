import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  Bot,
  Braces,
  Check,
  Clock3,
  Copy,
  Flame,
  Heart,
  ListOrdered,
  Search,
  Sparkles,
  Star,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "@/components/site/SectionHeading";
import { DIFFICULTY_META } from "@/lib/format";
import { copyText } from "@/lib/copy";
import { usePromptFavorites } from "@/hooks/use-prompt-favorites";

type Prompt = NonNullable<
  ReturnType<typeof useQuery<typeof api.prompts.listPublished>>
>[number];

const DIFFICULTIES = [
  "beginner",
  "intermediate",
  "advanced",
  "professional",
  "expert",
] as const;

const SORTS = [
  { key: "newest", label: "Newest", icon: <Clock3 className="size-3.5" /> },
  { key: "popular", label: "Popular", icon: <Flame className="size-3.5" /> },
  { key: "az", label: "A–Z", icon: <ListOrdered className="size-3.5" /> },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

function DifficultyBadge({ d }: { d?: string }) {
  if (!d || !(d in DIFFICULTY_META)) return null;
  const meta = DIFFICULTY_META[d as keyof typeof DIFFICULTY_META];
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.badge}`}>
      {meta.label}
    </span>
  );
}

function PromptCard({
  p,
  favoritesOpen,
  isFavorite,
  onToggleFavorite,
  delay = 0,
}: {
  p: Prompt;
  favoritesOpen: boolean;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  delay?: number;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await copyText(p.template);
    if (ok) {
      setCopied(true);
      toast.success("Prompt copied to clipboard.");
      setTimeout(() => setCopied(false), 1800);
    } else {
      toast.error("Couldn't copy — select the template manually on the prompt page.");
    }
  };

  return (
    <Reveal delay={delay} className="h-full">
      <article className="group relative flex h-full flex-col rounded-3xl border border-white/10 bg-card p-5 transition-colors hover:border-lime-400/35">
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-lime-400/25 to-emerald-500/10 text-lime-300">
            <Braces className="size-5" />
          </div>
          <div className="flex items-center gap-1.5">
            {p.featured && (
              <span className="inline-flex items-center gap-1 rounded-full border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 text-[10px] font-bold text-lime-300">
                <Star className="size-2.5 fill-lime-400" /> Featured
              </span>
            )}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(p._id as string);
              }}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              className={`flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                isFavorite
                  ? "border-lime-400/50 bg-lime-400/15 text-lime-300"
                  : "border-white/10 text-muted-foreground hover:border-lime-400/40 hover:text-lime-300"
              }`}
            >
              <Heart className={`size-4 ${isFavorite ? "fill-lime-400" : ""}`} />
            </button>
          </div>
        </div>

        <h3 className="font-display mt-4 text-base font-bold leading-snug">
          <Link
            to={`/prompts/${p.slug}`}
            className="transition-colors group-hover:text-lime-300"
          >
            {p.title}
          </Link>
        </h3>
        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {p.description}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {p.categoryName}
          </span>
          {p.subcategory && (
            <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {p.subcategory}
            </span>
          )}
          <DifficultyBadge d={p.difficulty} />
        </div>
        {p.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {p.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-[11px] text-muted-foreground/80">
                #{t}
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center gap-2 pt-1">
          <Button
            onClick={handleCopy}
            className="flex-1 gap-1.5 border border-lime-400/30 bg-lime-400/10 text-lime-300 hover:bg-lime-400 hover:text-black"
            size="sm"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied!" : "Copy prompt"}
          </Button>
          <Link
            to={`/prompts/${p.slug}`}
            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-lime-400 text-sm font-semibold text-black transition-colors hover:bg-lime-300"
          >
            View / use <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {favoritesOpen && !isFavorite && (
          <span className="pointer-events-none absolute right-4 top-4 rounded-full border border-white/10 bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Not in favorites
          </span>
        )}
      </article>
    </Reveal>
  );
}

function PromptGridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-64 animate-pulse rounded-3xl border border-white/10 bg-card" />
      ))}
    </div>
  );
}

export default function PromptLibrary() {
  const published = useQuery(api.prompts.listPublished);
  const categories = useQuery(api.prompts.listCategories);
  const { favorites, isFavorite, toggle } = usePromptFavorites();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [tag, setTag] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("newest");

  const allTags = useMemo(() => {
    if (!published) return [];
    const counts = new Map<string, number>();
    for (const p of published) {
      for (const t of p.tags) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([t]) => t);
  }, [published]);

  const featured = useMemo(
    () => (published ? published.filter((p) => p.featured) : undefined),
    [published],
  );

  const filtered = useMemo(() => {
    if (!published) return undefined;
    const q = search.trim().toLowerCase();
    const base = favoritesOpen
      ? published.filter((p) => favorites.includes(p._id as string))
      : published;
    const out = base.filter((p) => {
      if (category !== "All" && p.categoryName !== category) return false;
      if (difficulty !== "all" && p.difficulty !== difficulty) return false;
      if (tag !== "all" && !p.tags.includes(tag)) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.usefulFor.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
    if (sort === "popular") {
      return [...out].sort((a, b) => b.views - a.views);
    }
    if (sort === "az") {
      return [...out].sort((a, b) => a.title.localeCompare(b.title));
    }
    return [...out].sort((a, b) => b.createdAt - a.createdAt);
  }, [published, search, category, tag, difficulty, favoritesOpen, favorites, sort]);

  const clearFilters = () => {
    setSearch("");
    setCategory("All");
    setTag("all");
    setDifficulty("all");
    setFavoritesOpen(false);
  };

  return (
    <PageShell>
      {/* ------------------------------------------------ Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/30 bg-lime-400/10 px-4 py-1.5 text-xs font-semibold text-lime-300">
              <Wand2 className="size-3.5" /> ForgeX Academy
            </span>
            <h1 className="font-display mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
              The ForgeX <span className="text-gradient">Prompt Library</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Copy-ready, high-quality AI prompts for students, creators,
              designers, freelancers and business owners — organized, searchable
              and customizable with the built-in prompt builder.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        {/* ------------------------------------------------ Toolbar */}
        <div className="rounded-3xl border border-white/10 bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search prompts, tags, descriptions…"
                className="h-11 w-full border-white/10 bg-black/20 pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger className="h-11 w-44 border-white/10 bg-black/20">
                  <SelectValue placeholder="All tags" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-card">
                  <SelectItem value="all">All tags</SelectItem>
                  {allTags.map((t) => (
                    <SelectItem key={t} value={t}>
                      #{t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={() => setFavoritesOpen((v) => !v)}
                className={`inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                  favoritesOpen
                    ? "border-lime-400/50 bg-lime-400/12 text-lime-300"
                    : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                }`}
              >
                <Heart className={`size-3.5 ${favoritesOpen ? "fill-lime-400" : ""}`} />
                Favorites ({favorites.length})
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {["All", ...(categories?.map((c) => c.name) ?? [])].map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  category === c
                    ? "border-lime-400/40 bg-lime-400/12 text-lime-300"
                    : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Level:</span>
            {(["all", ...DIFFICULTIES] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  difficulty === d
                    ? "border-lime-400/40 bg-lime-400/12 text-lime-300"
                    : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                }`}
              >
                {d === "all" ? "All levels" : DIFFICULTY_META[d].label}
              </button>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------ Featured */}
        {featured && featured.length > 0 && !favoritesOpen && (
          <div className="mt-10">
            <SectionHeading align="left" eyebrow="Editor’s picks" title="Featured prompts" />
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p, i) => (
                <PromptCard
                  key={p._id as string}
                  p={p}
                  favoritesOpen={favoritesOpen}
                  isFavorite={isFavorite(p._id as string)}
                  onToggleFavorite={toggle}
                  delay={(i % 3) * 0.06}
                />
              ))}
            </div>
          </div>
        )}

        {/* ------------------------------------------------ All prompts */}
        <div className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              align="left"
              eyebrow="The full library"
              title={favoritesOpen ? "Your favorites" : "Browse every prompt"}
            />
            <div className="flex rounded-full border border-white/10 bg-black/20 p-1">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    sort === s.key
                      ? "bg-lime-400 text-black"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.icon}
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {filtered === undefined ? (
            <div className="mt-6">
              <PromptGridSkeleton />
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-white/10 bg-card p-12 text-center">
              <Braces className="mx-auto size-10 text-lime-300/70" />
              <h3 className="font-display mt-4 text-lg font-semibold">
                {favoritesOpen && favorites.length === 0
                  ? "No favorites yet"
                  : "No prompts match that"}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {favoritesOpen && favorites.length === 0
                  ? "Tap the heart on any prompt to save it here for quick access."
                  : "Try a different search, or clear the filters to see everything in the library."}
              </p>
              <Button
                variant="outline"
                className="mt-6 border-white/15"
                onClick={clearFilters}
              >
                <X className="size-4" /> Clear filters
              </Button>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p, i) => (
                <PromptCard
                  key={p._id as string}
                  p={p}
                  favoritesOpen={favoritesOpen}
                  isFavorite={isFavorite(p._id as string)}
                  onToggleFavorite={toggle}
                  delay={(i % 3) * 0.06}
                />
              ))}
            </div>
          )}
        </div>

        {/* ------------------------------------------------ Cross-link: AI Hub */}
        <div className="mt-16 rounded-3xl border border-white/10 bg-card p-8 sm:p-10">
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-lime-400/12 text-lime-300">
              <Bot className="size-7" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-xl font-bold">
                Looking for the tools themselves?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                The ForgeX AI Hub curates the actual AI tools, tutorials and setup
                guides — prompts here, resources there. Visit both to build your
                full AI workflow.
              </p>
            </div>
            <Link to="/academy/ai-hub">
              <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300 glow-lime-soft">
                Explore the AI Hub <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* ------------------------------------------------ CTA */}
        <div className="mt-10 rounded-3xl border border-lime-400/20 bg-gradient-to-br from-lime-400/10 via-card to-emerald-500/5 p-8 text-center sm:p-12">
          <Reveal>
            <Sparkles className="mx-auto size-8 text-lime-300" />
            <h2 className="font-display mx-auto mt-4 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
              Better prompts, better results
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Open any prompt to customize it with the dynamic builder — fill in
              your details and copy a finished, ready-to-use prompt in seconds.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link to="/academy/courses">
                <Button size="lg" className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300 glow-lime-soft">
                  Learn design & creative skills <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/auth?mode=signup">
                <Button size="lg" variant="outline" className="border-white/15 hover:border-lime-400/40 hover:text-lime-300">
                  Join ForgeX free
                </Button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </PageShell>
  );
}

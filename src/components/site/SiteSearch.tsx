import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  BookOpen,
  Bot,
  Clock,
  FileText,
  Map,
  Megaphone,
  Search,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* Debounce the keystroke so we don't hit the backend on every character. */
function useDebounced(value: string, delay = 220) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

type AnyResult =
  | { kind: "course"; id: string; title: string; subtitle?: string | null; slug: string; meta: string }
  | { kind: "roadmap"; id: string; title: string; subtitle?: string | null; slug: string; meta: string }
  | { kind: "prompt"; id: string; title: string; subtitle?: string | null; slug: string; meta: string }
  | { kind: "resource"; id: string; title: string; subtitle?: string | null; slug: string; meta: string }
  | { kind: "announcement"; id: string; title: string; subtitle?: string | null; slug: string; meta: string };

const KIND_META: Record<
  AnyResult["kind"],
  { label: string; icon: React.ComponentType<{ className?: string }>; to: (r: AnyResult) => string }
> = {
  course: { label: "Courses", icon: BookOpen, to: (r) => `/courses/${r.slug}` },
  roadmap: { label: "Roadmaps", icon: Map, to: () => "/roadmap" },
  prompt: { label: "Prompt Library", icon: FileText, to: (r) => `/prompts/${r.slug}` },
  resource: { label: "AI Hub", icon: Bot, to: () => "/ai-hub" },
  announcement: { label: "Updates", icon: Megaphone, to: () => "/updates" },
};

export function SiteSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [raw, setRaw] = useState("");
  const term = useDebounced(raw);
  const navigate = useNavigate();

  const results = useQuery(api.search.siteSearch, open && term.trim().length >= 2 ? { q: term } : "skip");

  const grouped = useMemo(() => {
    if (!results) return [];
    const flat: AnyResult[] = [
      ...results.courses.map((c) => ({
        kind: "course" as const,
        id: c.id,
        title: c.title,
        subtitle: c.subtitle ?? null,
        slug: c.slug,
        meta: [c.difficulty, c.durationHours ? `${c.durationHours}h` : null].filter(Boolean).join(" · "),
      })),
      ...results.roadmaps.map((r) => ({
        kind: "roadmap" as const,
        id: r.id,
        title: r.name,
        subtitle: r.tagline ?? null,
        slug: r.slug,
        meta: "Roadmap",
      })),
      ...results.prompts.map((p) => ({
        kind: "prompt" as const,
        id: p.id,
        title: p.title,
        subtitle: p.description ?? null,
        slug: p.slug,
        meta: "Prompt",
      })),
      ...results.resources.map((r) => ({
        kind: "resource" as const,
        id: r.id,
        title: r.title,
        subtitle: r.description ?? null,
        slug: r.slug,
        meta: "AI resource",
      })),
      ...results.announcements.map((a) => ({
        kind: "announcement" as const,
        id: a.id,
        title: a.title,
        subtitle: a.body ?? null,
        slug: "",
        meta: a.category ?? "Announcement",
      })),
    ];
    const order: AnyResult["kind"][] = ["course", "roadmap", "prompt", "resource", "announcement"];
    return order
      .map((kind) => ({ kind, items: flat.filter((r) => r.kind === kind) }))
      .filter((g) => g.items.length > 0);
  }, [results]);

  const total = grouped.reduce((n, g) => n + g.items.length, 0);
  const loading = open && term.trim().length >= 2 && results === undefined;
  const showEmpty = !loading && term.trim().length >= 2 && total === 0;

  const go = (r: AnyResult) => {
    onOpenChange(false);
    navigate(KIND_META[r.kind].to(r));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-0 max-h-[85dvh] translate-y-0 gap-0 overflow-hidden rounded-b-3xl border-white/10 bg-[#0b0e0c]/95 p-0 backdrop-blur-xl sm:top-1/2 sm:max-w-lg sm:translate-y-[-50%] sm:rounded-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Search ForgeX Academy</DialogTitle>
          <DialogDescription>Search courses, roadmaps, prompts and resources.</DialogDescription>
        </DialogHeader>

        {/* Search input row */}
        <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
          <Search className="size-5 shrink-0 text-lime-300" />
          <input
            autoFocus
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Search courses, prompts, roadmaps..."
            className="h-9 w-full min-w-0 bg-transparent text-[15px] text-foreground outline-none placeholder:text-white/25"
            aria-label="Search"
          />
          {raw && (
            <button
              aria-label="Clear search"
              onClick={() => setRaw("")}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
          <button
            aria-label="Close search"
            onClick={() => onOpenChange(false)}
            className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
          >
            Esc
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[calc(85dvh-4.25rem)] overflow-y-auto overscroll-contain px-2 py-3 sm:max-h-[26rem]">
          {term.trim().length < 2 ? (
            <div className="px-3 py-10 text-center">
              <Search className="mx-auto size-6 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium text-foreground">Search ForgeX Academy</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Find courses, roadmaps, prompts, AI resources and updates.
              </p>
            </div>
          ) : loading ? (
            <div className="space-y-2 px-1 py-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[52px] animate-pulse rounded-xl border border-white/8 bg-white/5" />
              ))}
            </div>
          ) : showEmpty ? (
            <div className="px-3 py-10 text-center">
              <p className="text-sm font-semibold text-foreground">No results found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try searching for a course, skill or resource.
              </p>
            </div>
          ) : (
            grouped.map((group) => {
              const meta = KIND_META[group.kind];
              const Icon = meta.icon;
              return (
                <div key={group.kind} className="mb-2">
                  <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-lime-300/80">
                    {meta.label}
                  </p>
                  {group.items.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => go(r)}
                      className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lime-400/10 text-lime-300">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground group-hover:text-lime-300">
                          {r.title}
                        </span>
                        {r.subtitle && (
                          <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>
                        )}
                      </span>
                      {r.meta && (
                        <span className="hidden shrink-0 items-center gap-1 text-[11px] text-muted-foreground sm:inline-flex">
                          <Clock className="size-3" />
                          {r.meta}
                        </span>
                      )}
                      <ArrowRight
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-lime-300",
                        )}
                      />
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

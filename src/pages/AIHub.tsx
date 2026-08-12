import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Braces,
  ExternalLink,
  FileText,
  Flame,
  ListChecks,
  Loader2,
  PlayCircle,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { SectionHeading } from "@/components/site/SectionHeading";
import { SafeImage } from "@/components/site/SafeImage";
import { AI_CATEGORIES } from "@/convex/aiResources";
import { formatDate } from "@/lib/format";

type Resource = NonNullable<
  ReturnType<typeof useQuery<typeof api.aiResources.listPublished>>
>[number];

const PRICING_LABEL: Record<string, string> = {
  free: "Free",
  freemium: "Freemium",
  paid: "Paid",
};

const TYPE_LABEL: Record<string, string> = {
  tool: "AI Tool",
  article: "Article",
  tutorial: "Tutorial",
  "setup-guide": "Setup guide",
  "learning-resource": "Learning resource",
};

function PricingBadge({ pricing, noCreditCard }: { pricing: string; noCreditCard?: boolean }) {
  const styles =
    pricing === "free"
      ? "border-lime-400/30 bg-lime-400/10 text-lime-300"
      : pricing === "freemium"
        ? "border-sky-400/30 bg-sky-400/10 text-sky-300"
        : "border-amber-400/30 bg-amber-400/10 text-amber-300";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${styles}`}
    >
      {noCreditCard && pricing !== "free" ? <BadgeCheck className="size-3" /> : null}
      {PRICING_LABEL[pricing] ?? pricing}
      {noCreditCard && <span className="hidden sm:inline">· no card</span>}
    </span>
  );
}

function ResourceCard({
  r,
  onOpen,
  delay = 0,
}: {
  r: Resource;
  onOpen: (r: Resource) => void;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <article className="group flex h-full flex-col rounded-3xl border border-white/10 bg-card p-5 transition-colors hover:border-lime-400/35">
        <div className="flex items-start justify-between gap-3">
          {r.thumbnailUrl ? (
            <SafeImage
              src={r.thumbnailUrl}
              alt={`${r.title} logo`}
              className="size-14 shrink-0 rounded-2xl object-cover ring-1 ring-white/10"
              fallback={
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-lime-400/25 to-emerald-500/10 text-lime-300">
                  <Bot className="size-6" />
                </div>
              }
            />
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-lime-400/25 to-emerald-500/10 text-lime-300">
              <Bot className="size-6" />
            </div>
          )}
          {r.featured && (
            <span className="inline-flex items-center gap-1 rounded-full border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 text-[10px] font-bold text-lime-300">
              <Star className="size-2.5 fill-lime-400" /> Featured
            </span>
          )}
        </div>

        <h3 className="font-display mt-4 text-base font-bold leading-snug">{r.title}</h3>
        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {r.description}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {r.category}
          </span>
          <PricingBadge pricing={r.pricingType} noCreditCard={r.noCreditCard} />
          {r.videoUrl && r.resourceType !== "article" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              <PlayCircle className="size-3 text-lime-300" /> Video
            </span>
          )}
          {r.body && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              <FileText className="size-3 text-lime-300" /> Article
            </span>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2 pt-1">
          <Button
            onClick={() => onOpen(r)}
            className="flex-1 gap-1.5 border border-lime-400/30 bg-lime-400/10 text-lime-300 hover:bg-lime-400 hover:text-black"
            size="sm"
          >
            View resource <ArrowRight className="size-3.5" />
          </Button>
          {r.url && (
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
              aria-label={`Open ${r.title} in a new tab`}
              title="Open the original resource in a new tab"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>
      </article>
    </Reveal>
  );
}

/** Extract a YouTube video id from watch/shorts/embed/youtu.be links. */
function getYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  );
  return m ? m[1] : null;
}

/** Extract a Vimeo video id. */
function getVimeoId(url: string): string | null {
  const m = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d{6,})/);
  return m ? m[1] : null;
}

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

/** Lazy, embeddable video player — YouTube/Vimeo embed lazily, direct files in
 *  a native player (metadata-only preload), anything else as a safe external
 *  link. Never autoplays and never downloads the file until the user plays. */
function VideoEmbed({ url }: { url: string }) {
  const ytId = getYouTubeId(url);
  const vimeoId = getVimeoId(url);

  if (ytId) {
    return (
      <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${ytId}`}
          title="Tutorial video"
          className="size-full"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }
  if (vimeoId) {
    return (
      <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
        <iframe
          src={`https://player.vimeo.com/video/${vimeoId}`}
          title="Tutorial video"
          className="size-full"
          loading="lazy"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  if (isDirectVideo(url)) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
        <video src={url} controls playsInline preload="metadata" className="aspect-video w-full" />
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-black/20 px-4 py-4 text-sm font-semibold text-lime-300 transition-colors hover:border-lime-400/40"
    >
      <PlayCircle className="size-5" /> Watch the video <ExternalLink className="size-4" />
    </a>
  );
}

/** Escape user content so it is always rendered as text, never as HTML. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Inline text: support **bold** segments, everything else literal text. */
function renderInline(text: string): ReactNode {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i}>{escapeHtml(part)}</strong>
    ) : (
      <span key={i}>{escapeHtml(part)}</span>
    ),
  );
}

/** Dependency-free article renderer: paragraphs, `## ` headings, `- ` bullets
 *  and **bold**. All content is escaped — no raw HTML is ever rendered. */
function ArticleBody({ body }: { body: string }) {
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={key++} className="text-[15px] leading-relaxed text-foreground/85">
        {renderInline(paragraph.join(" "))}
      </p>,
    );
    paragraph = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={key++} className="space-y-2.5">
        {list.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-foreground/85">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-lime-400" />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const raw of body.split("\n")) {
    const line = raw.trimEnd();
    if (/^##\s+/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push(
        <h3 key={key++} className="font-display pt-1 text-lg font-bold">
          {renderInline(line.replace(/^##\s+/, ""))}
        </h3>,
      );
    } else if (/^-\s+/.test(line)) {
      flushParagraph();
      list.push(line.replace(/^-\s+/, ""));
    } else if (line.trim() === "") {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return <div className="space-y-4">{blocks}</div>;
}

function ResourceDetail({
  r,
  onClose,
}: {
  r: Resource;
  onClose: () => void;
}) {
  const steps = r.instructions ?? [];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-white/10 bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-start gap-4 pr-6">
            {r.thumbnailUrl ? (
              <SafeImage
                src={r.thumbnailUrl}
                alt={`${r.title} logo`}
                className="size-14 shrink-0 rounded-2xl object-cover ring-1 ring-white/10"
                fallback={
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-lime-400/25 to-emerald-500/10 text-lime-300">
                    <Bot className="size-6" />
                  </div>
                }
              />
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-lime-400/25 to-emerald-500/10 text-lime-300">
                <Bot className="size-6" />
              </div>
            )}
            <span className="pt-0.5">
              <span className="block text-lg sm:text-xl">{r.title}</span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {r.category}
                </span>
                <PricingBadge pricing={r.pricingType} noCreditCard={r.noCreditCard} />
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {TYPE_LABEL[r.resourceType] ?? r.resourceType}
                </span>
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {r.videoUrl && r.resourceType !== "article" && (
            <VideoEmbed url={r.videoUrl} />
          )}

          <p className="text-[15px] leading-relaxed text-foreground/85">{r.description}</p>

          {r.body && <ArticleBody body={r.body} />}

          {steps.length > 0 && (
            <div>
              <h4 className="font-display flex items-center gap-2 text-sm font-semibold">
                <ListChecks className="size-4 text-lime-400" /> How to get started
              </h4>
              <ol className="mt-3 space-y-3">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-lime-400/15 text-xs font-bold text-lime-300">
                      {i + 1}
                    </span>
                    <p className="text-sm leading-relaxed text-foreground/80">{step}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
            {r.lastVerifiedAt && (
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="size-3.5 text-lime-400" />
                Verified {formatDate(r.lastVerifiedAt)} by the ForgeX team
              </span>
            )}
            <span>Curated by ForgeX Academy</span>
          </div>

          {r.url && (
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 py-3 font-semibold text-black transition-colors hover:bg-lime-300"
            >
              Open the original resource <ExternalLink className="size-4" />
            </a>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Opens in a new tab. ForgeX Academy is not affiliated with the tool’s creators.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResourceGridSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-64 animate-pulse rounded-3xl border border-white/10 bg-card" />
      ))}
    </div>
  );
}

export default function AIHub() {
  const published = useQuery(api.aiResources.listPublished);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [pricing, setPricing] = useState<string>("all");
  const [noCardOnly, setNoCardOnly] = useState(false);
  const [selected, setSelected] = useState<Resource | null>(null);

  const filtered = useMemo(() => {
    if (!published) return undefined;
    const q = search.trim().toLowerCase();
    return published.filter((r) => {
      if (category !== "All" && r.category !== category) return false;
      if (pricing !== "all" && r.pricingType !== pricing) return false;
      if (noCardOnly && !r.noCreditCard) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    });
  }, [published, search, category, pricing, noCardOnly]);

  const featured = useMemo(
    () => (published ? published.filter((r) => r.featured) : undefined),
    [published],
  );

  return (
    <PageShell>
      {/* ------------------------------------------------ Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/30 bg-lime-400/10 px-4 py-1.5 text-xs font-semibold text-lime-300">
              <Sparkles className="size-3.5" /> ForgeX Academy
            </span>
            <h1 className="font-display mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
              The ForgeX <span className="text-gradient">AI Hub</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              A curated collection of genuinely useful AI tools, tutorials, setup
              guides and learning resources — hand-picked and verified by the
              ForgeX team so you can spend your time building, not guessing.
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
                placeholder="Search tools, tutorials, setup guides…"
                className="h-11 w-full border-white/10 bg-black/20 pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-full border border-white/10 bg-black/20 p-1">
                {(["all", "free", "freemium"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPricing(p)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                      pricing === p
                        ? "bg-lime-400 text-black"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p === "all" ? "All pricing" : PRICING_LABEL[p]}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setNoCardOnly((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
                  noCardOnly
                    ? "border-lime-400/50 bg-lime-400/12 text-lime-300"
                    : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                }`}
              >
                <BadgeCheck className="size-3.5" /> No credit card
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {["All", ...AI_CATEGORIES].map((c) => (
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
        </div>

        {/* ------------------------------------------------ Cross-link: Prompt Library */}
        <Link
          to="/prompts"
          className="group mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-card p-4 transition-colors hover:border-lime-400/35 sm:p-5"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
            <Braces className="size-5" />
          </span>
          <span className="flex-1">
            <span className="font-display block text-sm font-semibold group-hover:text-lime-300">
              Need prompts to go with these tools?
            </span>
            <span className="text-xs text-muted-foreground">
              The ForgeX Prompt Library has copy-ready, customizable AI prompts — separate from the AI Hub.
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-lime-300" />
        </Link>

        {/* ------------------------------------------------ Featured */}
        {featured && featured.length > 0 && (
          <div className="mt-10">
            <SectionHeading
              align="left"
              eyebrow="Editor’s picks"
              title="Featured for this week"
            />
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((r, i) => (
                <ResourceCard key={r._id as string} r={r} onOpen={setSelected} delay={(i % 3) * 0.06} />
              ))}
            </div>
          </div>
        )}

        {/* ------------------------------------------------ All resources */}
        <div className="mt-12">
          <SectionHeading
            align="left"
            eyebrow="The full collection"
            title={
              featured && featured.length > 0 ? "Explore every resource" : "Curated resources"
            }
          />
          {filtered === undefined ? (
            <div className="mt-6">
              <ResourceGridSkeleton />
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-white/10 bg-card p-12 text-center">
              <Bot className="mx-auto size-10 text-lime-300/70" />
              <h3 className="font-display mt-4 text-lg font-semibold">
                No resources match that
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Try a different search, or clear the filters to see everything
                the ForgeX team has curated.
              </p>
              <Button
                variant="outline"
                className="mt-6 border-white/15"
                onClick={() => {
                  setSearch("");
                  setCategory("All");
                  setPricing("all");
                  setNoCardOnly(false);
                }}
              >
                <X className="size-4" /> Clear filters
              </Button>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((r, i) => (
                <ResourceCard key={r._id as string} r={r} onOpen={setSelected} delay={(i % 3) * 0.06} />
              ))}
            </div>
          )}
        </div>

        {/* ------------------------------------------------ CTA */}
        <div className="mt-16 rounded-3xl border border-lime-400/20 bg-gradient-to-br from-lime-400/10 via-card to-emerald-500/5 p-8 text-center sm:p-12">
          <Reveal>
            <Flame className="mx-auto size-8 text-lime-300" />
            <h2 className="font-display mx-auto mt-4 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
              Learn to build with the tools you just discovered
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              The AI Hub shows you what’s out there — ForgeX courses teach you
              how to actually use it. Pick a roadmap and start building.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link to="/courses">
                <Button size="lg" className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300 glow-lime-soft">
                  Explore courses <ArrowRight className="size-4" />
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

      {selected && <ResourceDetail r={selected} onClose={() => setSelected(null)} />}
    </PageShell>
  );
}

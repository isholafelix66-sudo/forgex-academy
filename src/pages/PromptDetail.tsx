import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Braces,
  Check,
  ChevronRight,
  ClipboardList,
  Copy,
  Heart,
  ListChecks,
  Loader2,
  Sparkles,
  Star,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { DIFFICULTY_META } from "@/lib/format";
import { copyText } from "@/lib/copy";
import { usePromptFavorites } from "@/hooks/use-prompt-favorites";
import type { PromptField } from "@/convex/schema";

type Prompt = NonNullable<
  ReturnType<typeof useQuery<typeof api.prompts.getBySlug>>
>;

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 border-white/15"
      onClick={async () => {
        const ok = await copyText(text);
        if (ok) {
          setCopied(true);
          toast.success("Copied to clipboard.");
          setTimeout(() => setCopied(false), 1800);
        } else {
          toast.error("Couldn't copy — please select the text manually.");
        }
      }}
    >
      {copied ? <Check className="size-3.5 text-lime-300" /> : <Copy className="size-3.5" />}
      {copied ? "Copied!" : label}
    </Button>
  );
}

function PromptBuilder({ p }: { p: Prompt }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of p.fields) {
      if (f.type === "select" && f.options && f.options.length > 0) {
        init[f.key] = f.options[0];
      } else {
        init[f.key] = "";
      }
    }
    return init;
  });
  const [built, setBuilt] = useState(false);

  const generated = useMemo(() => {
    let out = p.template;
    for (const f of p.fields) {
      const value = (values[f.key] ?? "").trim();
      out = out.replace(new RegExp(`\\{\\{${f.key}\\}\\}`, "g"), value);
    }
    return out.replace(/\s{2,}/g, " ").trim();
  }, [p.template, p.fields, values]);

  const setValue = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  if (p.fields.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display flex items-center gap-2 text-base font-semibold">
            <Wand2 className="size-4 text-lime-400" /> Ready to use
          </h3>
          <CopyButton text={p.template} label="Copy prompt" />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          This prompt needs no customization — copy it and paste it into your AI tool.
        </p>
        <pre className="mt-4 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/25 p-4 font-mono text-sm leading-relaxed text-foreground/90">
          {p.template}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-lime-400/25 bg-gradient-to-br from-lime-400/10 to-transparent p-5 sm:p-6">
        <h3 className="font-display flex items-center gap-2 text-base font-semibold">
          <Wand2 className="size-4 text-lime-400" /> Customize this prompt
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill in your details below, then generate a finished prompt you can copy.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {p.fields.map((f) => {
            const id = `pf-${f.key}`;
            return (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={id} className="text-sm font-medium">
                  {f.label}
                  {f.required && <span className="ml-1 text-lime-300">*</span>}
                </Label>
                {f.type === "textarea" ? (
                  <Textarea
                    id={id}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValue(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="min-h-20 resize-y border-white/10 bg-black/25"
                  />
                ) : f.type === "select" && f.options && f.options.length > 0 ? (
                  <Select
                    value={values[f.key]}
                    onValueChange={(v) => setValue(f.key, v)}
                  >
                    <SelectTrigger id={id} className="w-full border-white/10 bg-black/25">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-card">
                      {f.options.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={id}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValue(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    className="h-10 border-white/10 bg-black/25"
                  />
                )}
              </div>
            );
          })}
        </div>

        <Button
          onClick={() => setBuilt(true)}
          className="mt-5 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
        >
          <Sparkles className="size-4" /> Generate / build prompt
        </Button>
      </div>

      {(built || Object.values(values).some((v) => v.trim() !== "")) && (
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display flex items-center gap-2 text-base font-semibold">
              <Braces className="size-4 text-lime-400" /> Your generated prompt
            </h3>
            <CopyButton text={generated} label="Copy final prompt" />
          </div>
          <pre className="mt-4 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/25 p-4 font-mono text-sm leading-relaxed text-foreground/90">
            {generated}
          </pre>
          <p className="mt-3 text-xs text-muted-foreground">
            Paste this into your favorite AI tool — ChatGPT, Claude, Midjourney,
            Gemini and more.
          </p>
        </div>
      )}
    </div>
  );
}

export default function PromptDetail() {
  const { slug = "" } = useParams();
  const prompt = useQuery(api.prompts.getBySlug, { slug });
  const related = useQuery(api.prompts.listRelated, { slug });
  const incrementViews = useMutation(api.prompts.incrementViews);
  const { isFavorite, toggle } = usePromptFavorites();

  useEffect(() => {
    if (!slug) return;
    void incrementViews({ slug }).catch(() => {});
  }, [slug, incrementViews]);

  if (prompt === undefined) {
    return (
      <PageShell>
        <div className="mx-auto flex min-h-[50vh] max-w-7xl items-center justify-center px-4 py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  if (prompt === null) {
    return (
      <PageShell>
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <div className="rounded-3xl border border-white/10 bg-card p-12 text-center">
            <Braces className="mx-auto size-10 text-lime-300/70" />
            <h1 className="font-display mt-4 text-2xl font-bold">Prompt not found</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              This prompt doesn’t exist or isn’t published yet.
            </p>
            <Link to="/prompts">
              <Button className="mt-6 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                <ArrowLeft className="size-4" /> Back to the library
              </Button>
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const p = prompt;

  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <Link to="/prompts" className="inline-flex items-center gap-1 transition-colors hover:text-lime-300">
            <ArrowLeft className="size-3.5" /> Prompt Library
          </Link>
          <ChevronRight className="size-3.5" />
          <span>{p.categoryName}</span>
          {p.subcategory && (
            <>
              <ChevronRight className="size-3.5" />
              <span>{p.subcategory}</span>
            </>
          )}
        </div>

        <Reveal className="mt-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
            {/* ------------------------------------------------ Main column */}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-muted-foreground">
                  {p.categoryName}
                </span>
                {p.subcategory && (
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-medium text-muted-foreground">
                    {p.subcategory}
                  </span>
                )}
                {p.difficulty && p.difficulty in DIFFICULTY_META && (
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      DIFFICULTY_META[p.difficulty as keyof typeof DIFFICULTY_META].badge
                    }`}
                  >
                    {DIFFICULTY_META[p.difficulty as keyof typeof DIFFICULTY_META].label}
                  </span>
                )}
                {p.featured && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-xs font-bold text-lime-300">
                    <Star className="size-3 fill-lime-400" /> Featured
                  </span>
                )}
                <button
                  onClick={() => toggle(p._id as string)}
                  className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isFavorite(p._id as string)
                      ? "border-lime-400/50 bg-lime-400/15 text-lime-300"
                      : "border-white/10 text-muted-foreground hover:border-lime-400/40 hover:text-lime-300"
                  }`}
                >
                  <Heart className={`size-3.5 ${isFavorite(p._id as string) ? "fill-lime-400" : ""}`} />
                  {isFavorite(p._id as string) ? "Saved to favorites" : "Save to favorites"}
                </button>
              </div>

              <h1 className="font-display mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                {p.title}
              </h1>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                {p.description}
              </p>

              {p.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {p.tags.map((t) => (
                    <span key={t} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-muted-foreground">
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-card p-5">
                  <h3 className="font-display flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="size-4 text-lime-400" /> What it’s useful for
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {p.usefulFor}
                  </p>
                </div>
                {p.requiredInputs.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-card p-5">
                    <h3 className="font-display flex items-center gap-2 text-sm font-semibold">
                      <ClipboardList className="size-4 text-lime-400" /> Required inputs
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {p.requiredInputs.map((input) => (
                        <li key={input} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-lime-400" />
                          {input}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="mt-8">
                <PromptBuilder p={p} />
              </div>
            </div>

            {/* ------------------------------------------------ Side column */}
            <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-white/10 bg-card p-5">
                <h3 className="font-display flex items-center gap-2 text-sm font-semibold">
                  <ListChecks className="size-4 text-lime-400" /> How to use this prompt
                </h3>
                <ol className="mt-3 space-y-3">
                  {[
                    "Fill in the fields in the builder, or use the raw template below.",
                    "Generate your finished prompt — variables are replaced automatically.",
                    "Copy it and paste it into your AI tool of choice.",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-lime-400/15 text-xs font-bold text-lime-300">
                        {i + 1}
                      </span>
                      <p className="text-sm leading-relaxed text-foreground/80">{step}</p>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 border-t border-white/10 pt-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-lime-300">{p.views.toLocaleString()} views</span> · curated by the ForgeX team
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold">Raw template</h3>
                  <CopyButton text={p.template} />
                </div>
                <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/25 p-3 font-mono text-xs leading-relaxed text-foreground/80">
                  {p.template}
                </pre>
              </div>

              <Link to="/ai-hub">
                <div className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-card p-5 transition-colors hover:border-lime-400/35">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                    <Bot className="size-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-display text-sm font-semibold group-hover:text-lime-300">
                      Find the tools to run this
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Browse AI tools in the ForgeX AI Hub
                    </p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-lime-300" />
                </div>
              </Link>
            </div>
          </div>
        </Reveal>

        {/* ------------------------------------------------ Related */}
        {related && related.length > 0 && (
          <div className="mt-16">
            <h2 className="font-display text-2xl font-bold tracking-tight">
              More prompts in {p.categoryName}
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r, i) => (
                <Reveal key={r._id as string} delay={(i % 3) * 0.06}>
                  <Link
                    to={`/prompts/${r.slug}`}
                    className="group flex h-full flex-col rounded-2xl border border-white/10 bg-card p-5 transition-colors hover:border-lime-400/35"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-lime-400/25 to-emerald-500/10 text-lime-300">
                        <Braces className="size-4" />
                      </div>
                      {r.featured && (
                        <Star className="size-3.5 fill-lime-400 text-lime-400" />
                      )}
                    </div>
                    <h3 className="font-display mt-3 text-sm font-semibold group-hover:text-lime-300">
                      {r.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                      {r.description}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-lime-300">
                      Open prompt <ArrowRight className="size-3.5" />
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        )}
      </section>
    </PageShell>
  );
}

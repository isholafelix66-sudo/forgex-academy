import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Check,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  Save,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dash/PageHeader";
import { Field } from "@/components/portfolio/PortfolioFields";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { getPortfolioUserToken } from "@/lib/portfolio-user-session";
import type { PortfolioVisibility } from "./portfolio-types";

const VISIBILITY: {
  key: PortfolioVisibility;
  label: string;
  blurb: string;
  icon: typeof Lock;
}[] = [
  { key: "draft", label: "Draft", blurb: "Only you can see it.", icon: Lock },
  {
    key: "published",
    label: "Published",
    blurb: "Anyone with your portfolio link can view it.",
    icon: Unlock,
  },
  {
    key: "discoverable",
    label: "Discoverable",
    blurb: "Your portfolio can also appear in the public Explore section.",
    icon: Globe,
  },
];

const ALL_SECTIONS = [
  { key: "about", label: "About" },
  { key: "skills", label: "Skills" },
  { key: "experience", label: "Experience" },
  { key: "education", label: "Education" },
  { key: "services", label: "Services" },
  { key: "projects", label: "Projects" },
  { key: "contact", label: "Contact" },
];

export default function PortfolioSettings() {
  const userToken = getPortfolioUserToken();
  const data = useQuery(
    api.projects.myPortfolio,
    userToken ? { token: userToken } : "skip",
  );
  const setSlug = useMutation(api.projects.setSlug);
  const setVisibility = useMutation(api.projects.setVisibility);
  const updatePortfolio = useMutation(api.projects.updatePortfolio);

  const portfolio = data?.portfolio ?? null;

  const [slug, setSlugValue] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [order, setOrder] = useState<string[]>(ALL_SECTIONS.map((s) => s.key));
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!portfolio) return;
    setSlugValue(portfolio.slug);
    setSeoTitle(portfolio.seoTitle ?? "");
    setSeoDescription(portfolio.seoDescription ?? "");
    const saved = portfolio.sectionOrder ?? [];
    const merged = [
      ...saved.filter((k) => ALL_SECTIONS.some((s) => s.key === k)),
      ...ALL_SECTIONS.map((s) => s.key).filter((k) => !saved.includes(k)),
    ];
    setOrder(merged);
  }, [portfolio]);

  if (!portfolio) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const run = async (key: string, fn: () => Promise<unknown>, message: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(message);
    } catch (err) {
      toast.error(friendlyError(err, "Could not save that change."));
    } finally {
      setBusy(null);
    }
  };

  const moveSection = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio Settings"
        description="Your link, your visibility, and how your portfolio looks in search results."
        actions={
          <Link to={`/p/${portfolio.slug}`} target="_blank">
            <Button variant="outline" className="gap-2 border-white/15">
              <ExternalLink className="size-4" /> View live
            </Button>
          </Link>
        }
      />

      {/* Public link */}
      <section className="rounded-3xl border border-white/10 bg-card p-5 sm:p-6">
        <h3 className="font-display text-lg font-bold">Your public link</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          This is the one link you share. Changing it breaks older links, so
          choose carefully.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Portfolio URL" className="flex-1">
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-muted-foreground">
                /p/
              </span>
              <Input
                value={slug}
                onChange={(e) => setSlugValue(e.target.value)}
                placeholder="felix-ayomide"
                className="border-white/10 bg-black/20 font-mono"
              />
            </div>
          </Field>
          <Button
            disabled={busy === "slug" || slug.trim() === portfolio.slug}
            onClick={() =>
              void run("slug", () => setSlug({ token: userToken ?? "", slug }), "Your portfolio link is updated.")
            }
            className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            {busy === "slug" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Update link
          </Button>
        </div>
      </section>

      {/* Visibility */}
      <section className="rounded-3xl border border-white/10 bg-card p-5 sm:p-6">
        <h3 className="font-display text-lg font-bold">Visibility</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose exactly who can see your portfolio.
        </p>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {VISIBILITY.map((v) => {
            const active = portfolio.visibility === v.key;
            const Icon = v.icon;
            return (
              <button
                key={v.key}
                disabled={busy !== null}
                onClick={() =>
                  void run(
                    v.key,
                    () => setVisibility({ token: userToken ?? "", visibility: v.key }),
                    v.key === "draft"
                      ? "Your portfolio is private again."
                      : v.key === "published"
                        ? "Your portfolio is published."
                        : "Your portfolio is discoverable in Explore.",
                  )
                }
                className={cn(
                  "rounded-2xl border p-4 text-left transition-colors disabled:opacity-60",
                  active ? "border-lime-400/45 bg-lime-400/10" : "border-white/10 hover:border-white/25",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl",
                    active ? "bg-lime-400/15 text-lime-300" : "bg-white/5 text-muted-foreground",
                  )}
                >
                  {busy === v.key ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : active ? (
                    <Check className="size-4" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                </span>
                <p className="mt-3 text-sm font-semibold">{v.label}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{v.blurb}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* SEO */}
      <section className="rounded-3xl border border-white/10 bg-card p-5 sm:p-6">
        <h3 className="font-display text-lg font-bold">Search & sharing</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          What people see when your portfolio link is shared.
        </p>
        <div className="mt-4 space-y-4">
          <Field label="Share title" hint="Defaults to your name and headline.">
            <Input
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder={`${portfolio.displayName} — portfolio`}
              className="border-white/10 bg-black/20"
            />
          </Field>
          <Field label="Share description">
            <Textarea
              rows={3}
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              placeholder="Designer and media strategist building brands people remember."
              className="border-white/10 bg-black/20"
            />
          </Field>
          <Button
            disabled={busy === "seo"}
            onClick={() =>
              void run(
                "seo",
                () => updatePortfolio({ token: userToken ?? "", seoTitle, seoDescription }),
                "Search settings saved.",
              )
            }
            className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            {busy === "seo" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save
          </Button>
        </div>
      </section>

      {/* Section order */}
      <section className="rounded-3xl border border-white/10 bg-card p-5 sm:p-6">
        <h3 className="font-display text-lg font-bold">Section order</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Arrange your public page. Empty sections are skipped automatically.
        </p>
        <ul className="mt-4 space-y-2">
          {order.map((key, index) => (
            <li
              key={key}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
            >
              <span className="flex size-6 items-center justify-center rounded-lg bg-white/5 text-xs font-bold text-muted-foreground">
                {index + 1}
              </span>
              <span className="flex-1 text-sm font-medium">
                {ALL_SECTIONS.find((s) => s.key === key)?.label ?? key}
              </span>
              <button
                onClick={() => moveSection(index, -1)}
                disabled={index === 0}
                className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-white/5 disabled:opacity-30"
              >
                Up
              </button>
              <button
                onClick={() => moveSection(index, 1)}
                disabled={index === order.length - 1}
                className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-white/5 disabled:opacity-30"
              >
                Down
              </button>
            </li>
          ))}
        </ul>
        <Button
          disabled={busy === "order"}
          onClick={() =>
            void run("order", () => updatePortfolio({ token: userToken ?? "", sectionOrder: order }), "Section order saved.")
          }
          className="mt-4 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
        >
          {busy === "order" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save order
        </Button>
      </section>
    </div>
  );
}

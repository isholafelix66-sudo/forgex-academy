import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  Check,
  CircleUser,
  Copy,
  ExternalLink,
  Eye,
  FolderKanban,
  Globe,
  Link2,
  Loader2,
  Lock,
  PenSquare,
  Sparkles,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { StatCard } from "@/components/dash/StatCard";
import { Avatar } from "@/components/site/Avatar";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { getPortfolioUserToken } from "@/lib/portfolio-user-session";
import type { PortfolioVisibility } from "./portfolio-types";

const VISIBILITY = [
  {
    key: "draft" as PortfolioVisibility,
    label: "Draft",
    blurb: "Only you can see it.",
    icon: Lock,
  },
  {
    key: "published" as PortfolioVisibility,
    label: "Published",
    blurb: "Anyone with your portfolio link can view it.",
    icon: Unlock,
  },
  {
    key: "discoverable" as PortfolioVisibility,
    label: "Discoverable",
    blurb: "Your portfolio can also appear in the public Explore section.",
    icon: Globe,
  },
];

export default function PortfolioOverview() {
  const userToken = getPortfolioUserToken();
  const data = useQuery(
    api.projects.myPortfolio,
    userToken ? { token: userToken } : "skip",
  );
  const setVisibility = useMutation(api.projects.setVisibility);
  const [busy, setBusy] = useState<PortfolioVisibility | null>(null);

  const portfolio = data?.portfolio ?? null;
  const projects = data?.projects ?? [];

  const checklist = useMemo(() => {
    if (!portfolio) return [];
    return [
      { label: "Add your display name", done: portfolio.displayName.trim().length > 1, to: "/portfolio/edit" },
      { label: "Write a headline", done: !!portfolio.headline?.trim(), to: "/portfolio/edit" },
      { label: "Add a profile photo", done: !!portfolio.avatarUrl, to: "/portfolio/edit" },
      { label: "Tell your story in About", done: (portfolio.about ?? portfolio.bio ?? "").trim().length > 40, to: "/portfolio/edit/about" },
      { label: "List your skills", done: portfolio.skills.length > 0, to: "/portfolio/edit/skills" },
      { label: "Show at least one project", done: projects.length > 0, to: "/portfolio/projects" },
      { label: "Add a way to contact you", done: !!(portfolio.email || portfolio.phone), to: "/portfolio/edit" },
      { label: "Add a social link", done: portfolio.links.length > 0, to: "/portfolio/edit/links" },
    ];
  }, [portfolio, projects.length]);

  const done = checklist.filter((c) => c.done).length;
  const percent = checklist.length ? Math.round((done / checklist.length) * 100) : 0;

  if (!portfolio) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/p/${portfolio.slug}`
      : `/p/${portfolio.slug}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied — share it anywhere.");
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  };

  const change = async (visibility: PortfolioVisibility) => {
    setBusy(visibility);
    try {
      await setVisibility({ token: userToken ?? "", visibility });
      toast.success(
        visibility === "draft"
          ? "Your portfolio is back to draft — nobody else can see it."
          : visibility === "published"
            ? "Published — anyone with your link can view it."
            : "Discoverable — your portfolio can now appear in Explore.",
      );
    } catch (err) {
      toast.error(friendlyError(err, "Could not update your visibility."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${portfolio.displayName.split(" ")[0] || "there"}`}
        description="Your portfolio is your professional website. Build it here, publish it, and share one link."
        actions={
          <>
            <Link to={`/p/${portfolio.slug}`} target="_blank">
              <Button variant="outline" className="gap-2 border-white/15">
                <ExternalLink className="size-4" /> View live
              </Button>
            </Link>
            <Link to="/portfolio/edit">
              <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                <PenSquare className="size-4" /> Edit portfolio
              </Button>
            </Link>
          </>
        }
      />

      {/* Share link */}
      <div className="rounded-3xl border border-lime-400/25 bg-gradient-to-br from-lime-400/10 via-card to-transparent p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={portfolio.displayName} image={portfolio.avatarUrl} className="size-12" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-lime-300">
                Your portfolio link
              </p>
              <p className="truncate font-mono text-sm">/p/{portfolio.slug}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void copy()} className="gap-2 border-white/15">
              <Copy className="size-4" /> Copy link
            </Button>
            <a href={`/p/${portfolio.slug}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2 border-white/15">
                <ExternalLink className="size-4" /> Open
              </Button>
            </a>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {portfolio.visibility === "draft"
            ? "This link is private while your portfolio is a draft."
            : "Share this single link anywhere — it's your personal website."}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<FolderKanban className="size-5" />}
          label="Projects"
          value={projects.length}
          accent
        />
        <StatCard icon={<Eye className="size-5" />} label="Portfolio views" value={portfolio.views} />
        <StatCard
          icon={<Sparkles className="size-5" />}
          label="Skills listed"
          value={portfolio.skills.length}
        />
        <StatCard
          icon={<Link2 className="size-5" />}
          label="Social links"
          value={portfolio.links.length}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Visibility */}
        <section className="rounded-3xl border border-white/10 bg-card p-5 sm:p-6">
          <h3 className="font-display text-lg font-bold">Who can see your portfolio</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            You decide. This is a deliberate setting, not a default.
          </p>
          <div className="mt-5 space-y-2.5">
            {VISIBILITY.map((v) => {
              const activeOption = portfolio.visibility === v.key;
              const Icon = v.icon;
              return (
                <button
                  key={v.key}
                  onClick={() => void change(v.key)}
                  disabled={busy !== null || activeOption}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors disabled:cursor-default",
                    activeOption
                      ? "border-lime-400/45 bg-lime-400/10"
                      : "border-white/10 hover:border-white/25",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                      activeOption ? "bg-lime-400/15 text-lime-300" : "bg-white/5 text-muted-foreground",
                    )}
                  >
                    {busy === v.key ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : activeOption ? (
                      <Check className="size-4" />
                    ) : (
                      <Icon className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {v.label}
                      {activeOption && (
                        <span className="rounded-full bg-lime-400 px-2 py-0.5 text-[10px] font-bold text-black">
                          Current
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {v.blurb}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {portfolio.publishedAt && (
            <p className="mt-4 text-xs text-muted-foreground">
              First published {formatDate(portfolio.publishedAt)}.
            </p>
          )}
        </section>

        {/* Progress */}
        <section className="rounded-3xl border border-white/10 bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-bold">Finish your portfolio</h3>
            <span className="text-sm font-bold text-lime-300">{percent}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-lime-400 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <ul className="mt-5 space-y-2">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link
                  to={c.to}
                  className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-white/5"
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      c.done
                        ? "border-lime-400/50 bg-lime-400/20 text-lime-300"
                        : "border-white/20 text-transparent",
                    )}
                  >
                    <Check className="size-3" />
                  </span>
                  <span className={cn("flex-1", c.done && "text-muted-foreground line-through")}>
                    {c.label}
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Recent projects */}
      <section className="rounded-3xl border border-white/10 bg-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-bold">Your projects</h3>
          <Link
            to="/portfolio/projects"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-lime-300"
          >
            Manage <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {projects.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/12 p-8 text-center">
            <FolderKanban className="mx-auto size-8 text-lime-300/70" />
            <p className="mt-3 text-sm text-muted-foreground">
              No projects yet. Projects are the strongest part of a portfolio —
              add the work you're proud of.
            </p>
            <Link to="/portfolio/projects" className="mt-4 inline-block">
              <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                <CircleUser className="size-4" /> Add your first project
              </Button>
            </Link>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/8">
            {projects.slice(0, 4).map((p) => (
              <li key={p._id} className="flex items-center gap-3 py-3">
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/5">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <FolderKanban className="size-4 text-muted-foreground" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.summary}</p>
                </div>
                <Link
                  to="/portfolio/projects"
                  className="shrink-0 text-xs font-semibold text-lime-300"
                >
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

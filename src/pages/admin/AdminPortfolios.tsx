import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Ban,
  Eye,
  ExternalLink,
  FolderKanban,
  Globe,
  Loader2,
  Search,
  Star,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dash/PageHeader";
import { StatCard } from "@/components/dash/StatCard";
import { getAdminToken } from "@/lib/admin-session";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

const VISIBILITIES = ["draft", "published", "discoverable"] as const;
type Visibility = (typeof VISIBILITIES)[number];

/**
 * Admin · Portfolios.
 *
 * Every portfolio on the platform with its owner, visibility, views and
 * moderation controls (feature, suspend/unpublish). Real data only.
 */
export default function AdminPortfolios() {
  const token = getAdminToken();
  const [q, setQ] = useState("");

  const overview = useQuery(
    api.projects.adminProjectsOverview,
    token ? { token } : "skip",
  );
  const list = useQuery(
    api.projects.adminListPortfolios,
    token ? { token, q: q.trim() || undefined } : "skip",
  );

  const setVisibility = useMutation(api.projects.adminSetPortfolioVisibility);
  const toggleFeatured = useMutation(api.projects.adminToggleFeatured);
  const toggleSuspended = useMutation(api.projects.adminToggleSuspended);

  const act = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      toast.success(message);
    } catch (err) {
      toast.error(friendlyError(err, "Action failed."));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolios"
        description="Who's on Projects, what they've published, and the moderation controls."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Globe className="size-5" />}
          label="Published portfolios"
          value={overview?.totals.published ?? "—"}
          accent
        />
        <StatCard
          icon={<Users className="size-5" />}
          label="Creators"
          value={overview?.totals.users ?? "—"}
        />
        <StatCard
          icon={<FolderKanban className="size-5" />}
          label="Projects created"
          value={overview?.totals.projects ?? "—"}
        />
        <StatCard
          icon={<Eye className="size-5" />}
          label="Portfolio views"
          value={overview?.totals.views ?? "—"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Drafts", value: overview?.totals.drafts },
          { label: "Discoverable", value: overview?.totals.discoverable },
          { label: "Featured", value: overview?.totals.featured },
          { label: "Suspended", value: overview?.totals.suspended },
          { label: "New (24h)", value: overview?.totals.newRegistrations },
          { label: "Open reports", value: overview?.totals.openReports },
          { label: "Waitlist sign-ups", value: overview?.totals.waitlist },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/10 bg-card px-4 py-3"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {s.label}
            </p>
            <p className="font-display mt-1 text-2xl font-bold">{s.value ?? "—"}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-white/10 bg-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, slug, headline or location…"
            className="h-11 border-white/10 bg-black/20 pl-9"
          />
        </div>
      </div>

      {list === undefined ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/12 p-12 text-center text-sm text-muted-foreground">
          No portfolios match that search yet.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <div
              key={p._id}
              className={cn(
                "rounded-3xl border bg-card p-4",
                p.suspended ? "border-rose-400/30" : "border-white/10",
              )}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{p.displayName}</p>
                    <span className="font-mono text-xs text-muted-foreground">
                      /p/{p.slug}
                    </span>
                    {p.featured && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-lime-400/40 bg-lime-400/10 px-2 py-0.5 text-[10px] font-bold text-lime-300">
                        <Star className="size-2.5 fill-lime-400" /> Featured
                      </span>
                    )}
                    {p.suspended && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-400/10 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                        <Ban className="size-2.5" /> Suspended
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {p.headline || "No headline"}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {p.owner?.name ?? "Unknown owner"}
                    {p.owner?.email ? ` · ${p.owner.email}` : ""} · {p.projects} project
                    {p.projects === 1 ? "" : "s"} · {p.views} views · created{" "}
                    {formatDate(p.createdAt)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={p.visibility}
                    onChange={(e) =>
                      void act(
                        () =>
                          setVisibility({
                            token: token!,
                            portfolioId: p._id as Id<"portfolios">,
                            visibility: e.target.value as Visibility,
                          }),
                        "Visibility updated.",
                      )
                    }
                    className="h-9 rounded-lg border border-white/10 bg-black/30 px-2 text-xs"
                  >
                    {VISIBILITIES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>

                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-white/15"
                    onClick={() =>
                      void act(
                        () =>
                          toggleFeatured({
                            token: token!,
                            portfolioId: p._id as Id<"portfolios">,
                          }),
                        p.featured ? "Removed from featured." : "Portfolio featured.",
                      )
                    }
                  >
                    <Star
                      className={cn(
                        "size-3.5",
                        p.featured && "fill-lime-400 text-lime-400",
                      )}
                    />
                    {p.featured ? "Unfeature" : "Feature"}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      "gap-1.5 border-white/15",
                      p.suspended && "border-rose-400/40 text-rose-300",
                    )}
                    onClick={() =>
                      void act(
                        () =>
                          toggleSuspended({
                            token: token!,
                            portfolioId: p._id as Id<"portfolios">,
                          }),
                        p.suspended ? "Portfolio restored." : "Portfolio suspended.",
                      )
                    }
                  >
                    <Ban className="size-3.5" />
                    {p.suspended ? "Restore" : "Suspend"}
                  </Button>

                  <a href={`/p/${p.slug}`} target="_blank" rel="noopener noreferrer">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-muted-foreground"
                    >
                      <ExternalLink className="size-3.5" /> View
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

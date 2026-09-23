import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  CheckCircle2,
  ExternalLink,
  Flag,
  FolderKanban,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dash/PageHeader";
import { getAdminToken } from "@/lib/admin-session";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

/**
 * Admin · Project moderation.
 *
 * Review every project published on the platform, remove anything that
 * shouldn't be there (with a reason the owner never sees), or restore it.
 * Reported portfolios are listed alongside so nothing gets lost.
 */
export default function AdminProjectsAdmin() {
  const token = getAdminToken();
  const [q, setQ] = useState("");
  const [reason, setReason] = useState("");

  const projects = useQuery(
    api.projects.adminListProjects,
    token ? { token, q: q.trim() || undefined } : "skip",
  );
  const reports = useQuery(
    api.projects.adminListReports,
    token ? { token } : "skip",
  );

  const removeProject = useMutation(api.projects.adminRemoveProject);
  const restoreProject = useMutation(api.projects.adminRestoreProject);
  const resolveReport = useMutation(api.projects.adminResolveReport);
  const toggleSuspended = useMutation(api.projects.adminToggleSuspended);

  const act = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      toast.success(message);
    } catch (err) {
      toast.error(friendlyError(err, "Action failed."));
    }
  };

  const openReports = (reports ?? []).filter((r) => !r.resolved);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project moderation"
        description="Review and moderate the work published across ForgeX Network."
      />

      {/* Reports */}
      <section className="rounded-3xl border border-white/10 bg-card p-5">
        <div className="flex items-center gap-2">
          <Flag className="size-4 text-amber-300" />
          <h3 className="font-display text-lg font-bold">
            Open reports ({openReports.length})
          </h3>
        </div>
        {openReports.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing reported. Reports raised by visitors appear here.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {openReports.map((r) => (
              <li
                key={r._id}
                className="flex flex-col gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{r.reason}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    /p/{r.slug}
                    {r.details ? ` · ${r.details}` : ""} · {formatDate(r.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <a href={`/p/${r.slug}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 border-white/15">
                      <ExternalLink className="size-3.5" /> Open
                    </Button>
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-white/15"
                    onClick={() =>
                      void act(
                        () =>
                          toggleSuspended({
                            token: token!,
                            portfolioId: r.portfolioId as Id<"portfolios">,
                          }),
                        "Portfolio visibility updated.",
                      )
                    }
                  >
                    <Trash2 className="size-3.5" /> Toggle portfolio
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                    onClick={() =>
                      void act(
                        () => resolveReport({ token: token!, reportId: r._id }),
                        "Report resolved.",
                      )
                    }
                  >
                    <CheckCircle2 className="size-3.5" /> Resolve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Search + removal reason */}
      <div className="grid gap-3 rounded-3xl border border-white/10 bg-card p-4 sm:grid-cols-[2fr_1fr]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects by title, summary or tag…"
            className="h-11 border-white/10 bg-black/20 pl-9"
          />
        </div>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for removal (internal)"
          className="h-11 border-white/10 bg-black/20"
        />
      </div>

      {projects === undefined ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/12 p-12 text-center text-sm text-muted-foreground">
          No projects yet.
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <div
              key={p._id}
              className={cn(
                "flex flex-col gap-4 rounded-3xl border bg-card p-4 sm:flex-row sm:items-center",
                p.removed ? "border-rose-400/30" : "border-white/10",
              )}
            >
              <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/5">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <FolderKanban className="size-5 text-muted-foreground" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{p.title}</p>
                  {p.removed && (
                    <span className="rounded-full border border-rose-400/40 bg-rose-400/10 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                      Removed
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {p.summary}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {p.portfolioName ?? "—"}
                  {p.portfolioSlug ? ` (/p/${p.portfolioSlug})` : ""} ·{" "}
                  {p.ownerName ?? "unknown owner"} · {formatDate(p.createdAt)}
                  {p.removed && p.removedReason ? ` · ${p.removedReason}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {p.portfolioSlug && (
                  <a
                    href={`/p/${p.portfolioSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
                      <ExternalLink className="size-3.5" /> Portfolio
                    </Button>
                  </a>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "gap-1.5 border-white/15",
                    p.removed && "text-lime-300",
                  )}
                  onClick={() =>
                    void act(
                      () =>
                        p.removed
                          ? restoreProject({ token: token!, projectId: p._id })
                          : removeProject({
                              token: token!,
                              projectId: p._id,
                              reason: reason.trim() || "Removed by an administrator.",
                            }),
                      p.removed ? "Project restored." : "Project removed.",
                    )
                  }
                >
                  {p.removed ? (
                    <>
                      <RotateCcw className="size-3.5" /> Restore
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-3.5" /> Remove
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

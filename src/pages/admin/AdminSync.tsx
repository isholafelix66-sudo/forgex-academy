import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Database,
  RefreshCw,
  RotateCcw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { formatDate } from "@/lib/format";
import { getAdminToken } from "@/lib/admin-session";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

/**
 * Admin · Sync dashboard.
 *
 * Real-time view of the database fallback/sync subsystem: whether fallback
 * mode is (or was) active, how many queued ops have been replayed into
 * Convex, per-kind counters, and the bounded list of failed ops with retry.
 * All data comes from the sync tables — no mock rows.
 */

const KIND_LABELS: Record<string, string> = {
  "lesson-complete": "Lesson completions",
  "watch-position": "Watch positions",
  "profile-update": "Profile updates",
  enroll: "Enrollments",
};

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

export default function AdminSync() {
  const token = getAdminToken();
  const status = useQuery(
    api.syncData.adminSyncStatus,
    token ? { token } : "skip",
  );
  const retryFailure = useMutation(api.syncData.adminRetryFailure);
  const dismissFailure = useMutation(api.syncData.adminDismissFailure);

  const degraded = !!status?.degradedSince;
  const totals = (status?.counters ?? []).reduce(
    (acc, c) => ({ applied: acc.applied + c.applied, failed: acc.failed + c.failed }),
    { applied: 0, failed: 0 },
  );

  const retry = async (failureId: string) => {
    try {
      const res = await retryFailure({ token: token!, failureId });
      if (res.ok) toast.success("Op re-applied.");
      else toast.error(res.reason ? `Still failing: ${res.reason}` : "Still failing.");
    } catch (err) {
      toast.error(friendlyError(err, "Retry failed."));
    }
  };

  const dismiss = async (failureId: string) => {
    try {
      await dismissFailure({ token: token!, failureId });
      toast.success("Failure record cleared.");
    } catch (err) {
      toast.error(friendlyError(err, "Could not clear the record."));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Database Sync"
        description="Fallback-mode status, queued-write replay counters, and failed-op recovery. Convex remains the primary database."
      />

      {/* Mode + totals */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          className={`rounded-2xl border p-4 ${
            degraded ? "border-amber-400/40 bg-amber-400/5" : "border-lime-400/30 bg-lime-400/5"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            {degraded ? (
              <>
                <CloudOff className="size-4 text-amber-400" aria-hidden />
                <span className="text-amber-300">Fallback mode active</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4 text-lime-400" aria-hidden />
                <span className="text-lime-300">Convex primary — healthy</span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {degraded
              ? `Since ${formatDate(status!.degradedSince!)}`
              : status?.lastProbeOk
                ? `Last confirmed alive ${formatDate(status.lastProbeOk)}`
                : "No outage recorded"}
          </p>
        </div>
        <StatTile icon={Database} label="Ops replayed to Convex" value={totals.applied} />
        <StatTile icon={AlertTriangle} label="Failed ops" value={totals.failed} tone={totals.failed > 0 ? "warn" : "ok"} />
        <StatTile
          icon={RefreshCw}
          label="Ops handled while degraded"
          value={status?.totalFallbackOps ?? 0}
        />
      </div>

      {/* Per-kind counters */}
      <div className="rounded-2xl border border-white/10 bg-card">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Per-operation counters</div>
        {(status?.counters.length ?? 0) === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No replayed operations yet — this fills in automatically if an outage ever queues writes.
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {status!.counters.map((c) => (
              <div key={c.kind} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-medium">{kindLabel(c.kind)}</span>
                <span className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{c.applied} applied</span>
                  <span className={c.failed > 0 ? "text-rose-400" : ""}>{c.failed} failed</span>
                  {c.lastAppliedAt ? <span>last {formatDate(c.lastAppliedAt)}</span> : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Failed ops */}
      <div className="rounded-2xl border border-white/10 bg-card">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-sm font-semibold">Failed operations</span>
          <span className="text-xs text-muted-foreground">{status?.failures.length ?? 0} shown</span>
        </div>
        {(status?.failures.length ?? 0) === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No failed syncs. 🎉</p>
        ) : (
          <div className="divide-y divide-white/5">
            {status!.failures.map((f) => (
              <div key={f._id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {kindLabel(f.kind)} · op {f.opId.slice(0, 8)}…
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {f.error} · {f.attempts} attempt{f.attempts === 1 ? "" : "s"} · last {formatDate(f.lastFailedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => retry(f._id)}>
                    <RotateCcw className="size-3.5" /> Retry
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => dismiss(f._id)}>
                    <Trash2 className="size-3.5" /> Clear
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent replayed ops */}
      <div className="rounded-2xl border border-white/10 bg-card">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Recently replayed ops</div>
        {(status?.recent.length ?? 0) === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nothing replayed yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {status!.recent.map((r) => (
              <div key={r._id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-medium">
                  {kindLabel(r.kind)} · {r.opId.slice(0, 8)}…
                </span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span
                    className={
                      r.result === "applied"
                        ? "text-lime-400"
                        : r.result === "stale"
                          ? "text-amber-400"
                          : "text-muted-foreground"
                    }
                  >
                    {r.result ?? "—"}
                  </span>
                  <span>{formatDate(r.appliedAt)}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone = "ok",
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={`size-4 ${tone === "warn" ? "text-amber-400" : "text-lime-400"}`} aria-hidden />
        {label}
      </div>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

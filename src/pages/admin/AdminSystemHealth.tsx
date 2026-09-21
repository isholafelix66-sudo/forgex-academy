import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Database,
  HelpCircle,
  KeyRound,
  Mail,
  MessageSquare,
  Mic,
  RefreshCw,
  Server,
  ShieldAlert,
  Upload,
  UserPlus,
  XCircle,
  ClipboardList,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { formatDate } from "@/lib/format";
import { getAdminToken } from "@/lib/admin-session";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";

const SERVICE_META: Record<
  string,
  { label: string; icon: LucideIcon; hint?: string }
> = {
  database: { label: "Database", icon: Database, hint: "Live read/write heartbeat" },
  auth: { label: "Authentication", icon: KeyRound },
  web: { label: "Web application", icon: Globe },
  registration: { label: "User registration", icon: UserPlus },
  enrollment: { label: "Course enrollment", icon: ClipboardList },
  assignments: { label: "Assignment submission", icon: Upload },
  uploads: { label: "File uploads / storage", icon: Server },
  storage: { label: "File storage", icon: Upload },
  "ai-chat": { label: "AI Chat", icon: MessageSquare },
  "ai-quizgen": { label: "AI Quiz generation", icon: Bot },
  "ai-voice": { label: "Voice messaging", icon: Mic },
  email: { label: "Email services", icon: Mail, hint: "Email log outcomes" },
  "background-jobs": { label: "Background jobs", icon: Activity },
  admin: { label: "Admin dashboard", icon: ShieldAlert },
};

const STATUS_STYLE: Record<
  string,
  { label: string; dot: string; chip: string; Icon: LucideIcon }
> = {
  operational: {
    label: "Operational",
    dot: "bg-lime-400",
    chip: "bg-lime-400/10 text-lime-300 border-lime-400/30",
    Icon: CheckCircle2,
  },
  degraded: {
    label: "Degraded",
    dot: "bg-amber-400",
    chip: "bg-amber-400/10 text-amber-300 border-amber-400/30",
    Icon: AlertTriangle,
  },
  down: {
    label: "Down",
    dot: "bg-rose-500",
    chip: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    Icon: XCircle,
  },
  unknown: {
    label: "Unknown",
    dot: "bg-zinc-500",
    chip: "bg-white/5 text-zinc-400 border-white/10",
    Icon: HelpCircle,
  },
};

function Stat({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string | number;
  accent?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 font-display text-2xl font-bold", accent)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function AdminSystemHealth() {
  const token = getAdminToken() ?? "";
  const sessionArgs = token ? { token } : "skip";

  const overview = useQuery(api.monitorData.adminOverview, sessionArgs);
  const health = useQuery(api.monitorData.adminServiceHealth, sessionArgs);
  const runSweep = useMutation(api.monitorData.adminRunHealthSweep);
  const [sweeping, setSweeping] = useState(false);

  const refresh = async () => {
    setSweeping(true);
    try {
      await runSweep({ token });
      toast.success("Health status re-evaluated from live signals.");
    } catch (err) {
      toast.error(friendlyError(err, "Could not run the health sweep."));
    } finally {
      setSweeping(false);
    }
  };

  const rows = (health ?? []).slice().sort((a, b) => {
    const order = { down: 0, degraded: 1, unknown: 2, operational: 3 } as const;
    return order[a.status] - order[b.status];
  });

  const incidents = overview?.errors.unresolvedIncidents ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="System Health"
        description="Live status of every platform service, computed from real activity and error signals — never guessed."
        actions={
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-lime-400/30 text-lime-300 hover:bg-lime-400/10"
            onClick={() => void refresh()}
            disabled={sweeping}
          >
            <RefreshCw className={cn("size-3.5", sweeping && "animate-spin")} />
            Refresh status
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Services operational"
          value={`${overview?.services.ok ?? "–"}/${overview?.services.total ?? "–"}`}
          accent="text-lime-300"
          sub={overview ? `${overview.services.degraded} degraded · ${overview.services.down} down` : undefined}
        />
        <Stat
          label="Errors (24h)"
          value={overview?.errors.today ?? "–"}
          accent={(overview?.errors.today ?? 0) > 0 ? "text-amber-300" : "text-foreground"}
          sub={`${overview?.errors.week ?? 0} in 7 days`}
        />
        <Stat
          label="Open incidents"
          value={incidents}
          accent={incidents > 0 ? "text-rose-300" : "text-lime-300"}
        />
        <Stat
          label="Critical groups (7d)"
          value={overview?.errors.criticalWeek ?? "–"}
          accent={(overview?.errors.criticalWeek ?? 0) > 0 ? "text-rose-300" : "text-foreground"}
        />
      </div>

      {/* Service rows */}
      {health === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-card p-10 text-center text-sm text-muted-foreground">
          No health data yet — the sweep runs every 5 minutes and after you press
          “Refresh status”.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
          <div className="divide-y divide-white/5">
            {rows.map((s) => {
              const meta = SERVICE_META[s.serviceId] ?? {
                label: s.serviceId,
                icon: Activity,
              };
              const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.unknown;
              const Icon = meta.icon;
              const StatusIcon = st.Icon;
              return (
                <div key={s._id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-lime-300">
                    <Icon className="size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{meta.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {meta.hint ??
                        `${s.ok} ok · ${s.fail} failed (30 min window)`}
                      {s.lastActivityAt
                        ? ` · last activity ${formatDate(s.lastActivityAt)}`
                        : ""}
                    </p>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="text-xs text-muted-foreground">Last checked</p>
                    <p className="text-xs font-medium">{formatDate(s.evaluatedAt)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">Recent failures</p>
                    <p className={cn("text-xs font-semibold", s.recentFailures > 0 ? "text-rose-300" : "text-muted-foreground")}>
                      {s.recentFailures}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                      st.chip,
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", st.dot)} />
                    {st.label}
                  </span>
                  <StatusIcon className="hidden size-4 shrink-0 text-muted-foreground lg:block" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Status is derived only from observed signals: the database heartbeat, per-module
        success/failure counters, email delivery logs, AI circuit-breaker state and recent
        error groups. Services with no traffic in the window show <em>Unknown</em> — not
        “operational”. {overview?.historicalNote}
      </p>
    </div>
  );
}

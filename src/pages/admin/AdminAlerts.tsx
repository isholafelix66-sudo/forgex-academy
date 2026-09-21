import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BellRing, BellOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/dash/PageHeader";
import { formatDate } from "@/lib/format";
import { getAdminToken } from "@/lib/admin-session";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";

const RULE_DESCRIPTIONS: Record<string, string> = {
  "critical-error": "Any CRITICAL error anywhere on the platform.",
  "incident-opened": "A new incident is automatically detected.",
  "incident-escalated": "An existing incident crosses a higher severity.",
  "service-down": "A monitored service reports Down in the health sweep.",
  "auth-failure-spike": "Login failures spike above the normal rate.",
};

const SEVERITY_CHIP: Record<string, string> = {
  critical: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  medium: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  low: "border-white/10 bg-white/5 text-zinc-400",
};

type AlertRule = {
  _id: string;
  key: string;
  enabled: boolean;
  minSeverity?: "critical" | "high" | "medium" | "low";
  cooldownMinutes?: number;
};

type AlertRow = {
  _id: string;
  ruleKey: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  summary?: string;
  channel: "email" | "inapp";
  deliveredAt: number;
  incidentId?: string;
};

export default function AdminAlerts() {
  const token = getAdminToken() ?? "";
  const view = useQuery(api.monitorData.adminAlertsView, token ? { token } : "skip");
  const setRule = useMutation(api.monitorData.adminSetAlertRule);

  const updateRule = async (
    key: string,
    enabled: boolean,
    minSeverity?: string,
    cooldownMinutes?: number,
  ) => {
    try {
      await setRule({
        token,
        key,
        enabled,
        minSeverity,
        cooldownMinutes,
      });
      toast.success("Alert rule updated.");
    } catch (err) {
      toast.error(friendlyError(err, "Could not update the rule."));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Decide which platform events raise alerts and review everything that has been sent."
      />

      {/* Rules */}
      {view === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
          <div className="divide-y divide-white/5">
            {view.rules.map((r: AlertRule) => (
              <div key={r._id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl",
                    r.enabled
                      ? "bg-lime-400/10 text-lime-300"
                      : "bg-white/5 text-muted-foreground",
                  )}
                >
                  {r.enabled ? <BellRing className="size-4" /> : <BellOff className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{r.key}</p>
                  <p className="text-xs text-muted-foreground">
                    {RULE_DESCRIPTIONS[r.key] ?? "Custom alert rule."}
                    {r.cooldownMinutes ? ` · cooldown ${r.cooldownMinutes}m` : ""}
                  </p>
                </div>
                <Select
                  value={r.minSeverity ?? "default"}
                  onValueChange={(v) =>
                    void updateRule(
                      r.key,
                      r.enabled,
                      v === "default" ? undefined : v,
                      r.cooldownMinutes,
                    )
                  }
                >
                  <SelectTrigger className="h-8 w-[150px] border-white/10 bg-black/20">
                    <SelectValue placeholder="Min severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default threshold</SelectItem>
                    <SelectItem value="critical">Critical only</SelectItem>
                    <SelectItem value="high">High and above</SelectItem>
                    <SelectItem value="medium">Medium and above</SelectItem>
                    <SelectItem value="low">Everything</SelectItem>
                  </SelectContent>
                </Select>
                <Switch
                  checked={r.enabled}
                  onCheckedChange={(checked) =>
                    void updateRule(r.key, checked, r.minSeverity, r.cooldownMinutes)
                  }
                />
              </div>
            ))}
            {view.rules.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                No alert rules configured yet.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Sent alerts history */}
      <div>
        <h2 className="font-display mb-3 text-lg font-bold">Sent alerts</h2>
        {view === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-2xl border border-white/8 bg-card" />
            ))}
          </div>
        ) : view.alerts.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-card p-10 text-center text-sm text-muted-foreground">
            No alerts sent yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
            <div className="divide-y divide-white/5">
              {view.alerts.map((a: AlertRow) => (
                <div key={a._id} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase",
                      SEVERITY_CHIP[a.severity],
                    )}
                  >
                    {a.severity}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.summary}
                      {a.incidentId ? ` · incident ${a.incidentId.slice(-6)}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {a.channel}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(a.deliveredAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

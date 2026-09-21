import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ChevronDown, ChevronRight, Filter, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const SEVERITY_CHIP: Record<string, string> = {
  critical: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  high: "bg-orange-500/10 text-orange-300 border-orange-500/30",
  medium: "bg-amber-400/10 text-amber-300 border-amber-400/30",
  low: "bg-white/5 text-zinc-400 border-white/10",
};

type ErrorRow = {
  _id: string;
  fingerprint: string;
  module: string;
  action?: string;
  kind: "error" | "security";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  lastMessage?: string;
  occurrences: number;
  affectedUsers?: number;
  firstSeenAt: number;
  lastSeenAt: number;
  route?: string;
  resolvedAt?: number;
};

export default function AdminErrors() {
  const token = getAdminToken() ?? "";
  const [severity, setSeverity] = useState("all");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("unresolved");
  const [moduleFilter, setModuleFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const listArgs = token
    ? {
        token,
        severity: severity !== "all" ? severity : undefined,
        kind: kind !== "all" ? kind : undefined,
        status: status !== "all" ? status : undefined,
        module: moduleFilter.trim() || undefined,
        limit: 150,
      }
    : "skip";
  const groups = useQuery(api.monitorData.adminErrorsList, listArgs);
  const resolve = useMutation(api.monitorData.adminSetErrorResolved);

  const detail = useQuery(
    api.monitorData.adminErrorDetail,
    expanded && token ? { token, fingerprint: expanded } : "skip",
  );

  const modules = useMemo(
    () => Array.from(new Set((groups ?? []).map((g) => g.module))).sort(),
    [groups],
  );

  const setResolved = async (fingerprint: string, resolved: boolean) => {
    try {
      await resolve({ token, fingerprint, resolved });
      toast.success(resolved ? "Error group marked resolved." : "Reopened.");
    } catch (err) {
      toast.error(friendlyError(err, "Could not update the error group."));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Error tracking"
        description="Grouped failures across the whole platform. Repeats collapse into one group with occurrence counts."
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter className="size-3.5" /> Filters
        </span>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="h-9 w-[140px] border-white/10 bg-black/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="h-9 w-[130px] border-white/10 bg-black/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            <SelectItem value="error">Errors</SelectItem>
            <SelectItem value="security">Security</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[140px] border-white/10 bg-black/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unresolved">Unresolved</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="all">Any status</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={moduleFilter || "all"}
          onValueChange={(v) => setModuleFilter(v === "all" ? "" : v)}
        >
          <SelectTrigger className="h-9 w-[160px] border-white/10 bg-black/20">
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {modules.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {groups === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-card p-10 text-center text-sm text-muted-foreground">
          Nothing matches these filters — no {status !== "all" ? status + " " : ""}errors
          recorded for the selected scope.
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map((g: ErrorRow) => (
            <div
              key={g._id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-card"
            >
              <button
                type="button"
                onClick={() => setExpanded(expanded === g.fingerprint ? null : g.fingerprint)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
              >
                {expanded === g.fingerprint ? (
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                    SEVERITY_CHIP[g.severity],
                  )}
                >
                  {g.severity}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {g.title}
                    {g.kind === "security" && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-rose-300">
                        <ShieldAlert className="size-3" /> security
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {g.module}
                    {g.action ? ` · ${g.action}` : ""}
                    {g.route ? ` · ${g.route}` : ""}
                    {g.lastMessage ? ` — ${g.lastMessage.slice(0, 90)}` : ""}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-[11px] text-muted-foreground">First seen</p>
                  <p className="text-xs">{formatDate(g.firstSeenAt)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] text-muted-foreground">Last seen</p>
                  <p className="text-xs">{formatDate(g.lastSeenAt)}</p>
                </div>
                <div className="w-16 shrink-0 text-right">
                  <p className="text-[11px] text-muted-foreground">Occurrences</p>
                  <p className="text-sm font-bold text-lime-300">{g.occurrences}</p>
                </div>
              </button>

              {expanded === g.fingerprint && (
                <div className="border-t border-white/5 bg-black/20 px-5 py-4">
                  {detail === undefined ? (
                    <p className="text-xs text-muted-foreground">Loading occurrences…</p>
                  ) : !detail ? (
                    <p className="text-xs text-muted-foreground">Group no longer exists.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-white/10"
                          onClick={() => void setResolved(g.fingerprint, !g.resolvedAt)}
                        >
                          {g.resolvedAt ? "Reopen group" : "Mark resolved"}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {detail.occurrences.length} recent occurrences
                          {detail.group.affectedUsers
                            ? ` · ${detail.group.affectedUsers} users affected`
                            : ""}
                        </span>
                      </div>
                      <div className="max-h-64 overflow-y-auto rounded-xl border border-white/8">
                        <div className="divide-y divide-white/5">
                          {detail.occurrences.map((o) => (
                            <div key={o._id} className="px-3 py-2 text-xs">
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate font-medium">{o.message ?? "—"}</span>
                                <span className="shrink-0 text-muted-foreground">
                                  {formatDate(o.at)}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {o.route ? `${o.route} · ` : ""}
                                {o.requestId ? `req ${o.requestId.slice(0, 12)} · ` : ""}
                                severity {o.severity}
                              </p>
                            </div>
                          ))}
                          {detail.occurrences.length === 0 && (
                            <p className="px-3 py-3 text-xs text-muted-foreground">
                              Individual occurrences have been pruned by retention.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

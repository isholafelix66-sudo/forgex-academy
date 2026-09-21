import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CheckCircle2, Filter, XCircle } from "lucide-react";
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
import { cn } from "@/lib/utils";

type ActivityRow = {
  _id: string;
  action: string;
  module: string;
  result: "success" | "failure";
  actorLabel?: string;
  resourceType?: string;
  resourceId?: string;
  detail?: string;
  route?: string;
  at: number;
};

export default function AdminActivity() {
  const token = getAdminToken() ?? "";
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("");

  const listArgs = token
    ? {
        token,
        module: moduleFilter !== "all" ? moduleFilter : undefined,
        action: actionFilter.trim() || undefined,
        limit: 300,
      }
    : "skip";
  const rows = useQuery(api.monitorData.adminActivityList, listArgs);

  const modules = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.module))).sort(),
    [rows],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity log"
        description="Trail of important platform actions — enrollments, submissions, uploads, AI requests and admin operations."
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Filter className="size-3.5" /> Filters
        </span>
        <Select value={moduleFilter} onValueChange={setModuleFilter}>
          <SelectTrigger className="h-9 w-[170px] border-white/10 bg-black/20">
            <SelectValue />
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
        <Input
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filter by action, e.g. user.registered"
          className="h-9 w-[240px] border-white/10 bg-black/20"
        />
      </div>

      {rows === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-card p-10 text-center text-sm text-muted-foreground">
          No activity recorded for this scope yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
          <div className="divide-y divide-white/5">
            {rows.map((a: ActivityRow) => (
              <div key={a._id} className="flex items-center gap-3 px-5 py-2.5">
                {a.result === "success" ? (
                  <CheckCircle2 className="size-4 shrink-0 text-lime-400" />
                ) : (
                  <XCircle className="size-4 shrink-0 text-rose-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="font-semibold text-lime-300">{a.action}</span>
                    <span className="text-muted-foreground"> · {a.module}</span>
                    {a.actorLabel && (
                      <span className="text-muted-foreground"> — {a.actorLabel}</span>
                    )}
                    {a.detail && (
                      <span className="text-muted-foreground"> — {a.detail}</span>
                    )}
                  </p>
                  {(a.resourceType || a.route) && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {a.resourceType ? `${a.resourceType}` : ""}
                      {a.resourceId ? ` ${a.resourceId.slice(0, 10)}` : ""}
                      {a.route ? ` · ${a.route}` : ""}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                    a.result === "success"
                      ? "border-lime-400/30 bg-lime-400/10 text-lime-300"
                      : "border-rose-500/30 bg-rose-500/10 text-rose-300",
                  )}
                >
                  {a.result}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(a.at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ChevronDown, ChevronRight } from "lucide-react";
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

const STATUS_CHIP: Record<string, string> = {
  open: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  investigating: "bg-amber-400/10 text-amber-300 border-amber-400/30",
  acknowledged: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  resolved: "bg-lime-400/10 text-lime-300 border-lime-400/30",
  ignored: "bg-white/5 text-zinc-400 border-white/10",
};

type Incident = {
  _id: Id<"monitorIncidents">;
  number: number;
  title: string;
  module: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "investigating" | "acknowledged" | "resolved" | "ignored";
  occurrences: number;
  affectedUsers?: number;
  sampleMessage?: string;
  detectedAt: number;
  firstSeenAt: number;
  lastSeenAt: number;
};

const NEXT_STATUSES = ["investigating", "acknowledged", "resolved", "ignored", "open"] as const;

export default function AdminIncidents() {
  const token = getAdminToken() ?? "";
  const [status, setStatus] = useState("open");

  const listArgs = token
    ? { token, status: status !== "all" ? status : undefined, limit: 150 }
    : "skip";
  const incidents = useQuery(api.monitorData.adminIncidentsList, listArgs);
  const setStatusMutation = useMutation(api.monitorData.adminSetIncidentStatus);

  const [expanded, setExpanded] = useState<Id<"monitorIncidents"> | null>(null);
  const detail = useQuery(
    api.monitorData.adminIncidentDetail,
    expanded && token ? { token, incidentId: expanded } : "skip",
  );
  const [note, setNote] = useState("");

  const changeStatus = async (
    incidentId: Id<"monitorIncidents">,
    next: (typeof NEXT_STATUSES)[number],
  ) => {
    try {
      await setStatusMutation({
        token,
        incidentId,
        status: next,
        note: note.trim() || undefined,
      });
      setNote("");
      toast.success(`Incident marked ${next}.`);
    } catch (err) {
      toast.error(friendlyError(err, "Could not update the incident."));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        description="Automatically detected failure patterns. An incident opens when a real error threshold is crossed."
      />

      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[170px] border-white/10 bg-black/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="ignored">Ignored</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {incidents === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-card p-10 text-center text-sm text-muted-foreground">
          No incidents in this view — thresholds have not been crossed.
        </p>
      ) : (
        <div className="space-y-2">
          {incidents.map((inc: Incident) => (
            <div
              key={inc._id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-card"
            >
              <button
                type="button"
                onClick={() => {
                  setExpanded(expanded === inc._id ? null : inc._id);
                  setNote("");
                }}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
              >
                {expanded === inc._id ? (
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  #{inc.number}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                    SEVERITY_CHIP[inc.severity],
                  )}
                >
                  {inc.severity}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{inc.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {inc.module}
                    {inc.occurrences ? ` · ${inc.occurrences} occurrences` : ""}
                    {inc.affectedUsers ? ` · ${inc.affectedUsers} users` : ""}
                    {inc.sampleMessage ? ` — ${inc.sampleMessage.slice(0, 80)}` : ""}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-[11px] text-muted-foreground">Detected</p>
                  <p className="text-xs">{formatDate(inc.detectedAt)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] text-muted-foreground">Last seen</p>
                  <p className="text-xs">{formatDate(inc.lastSeenAt)}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                    STATUS_CHIP[inc.status],
                  )}
                >
                  {inc.status}
                </span>
              </button>

              {expanded === inc._id && (
                <div className="border-t border-white/5 bg-black/20 px-5 py-4">
                  {detail === undefined ? (
                    <p className="text-xs text-muted-foreground">Loading detail…</p>
                  ) : !detail ? (
                    <p className="text-xs text-muted-foreground">Incident no longer exists.</p>
                  ) : (
                    <div className="space-y-4">
                      {/* Status actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        {NEXT_STATUSES.filter((s) => s !== inc.status).map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant="outline"
                            className="h-8 border-white/10 capitalize"
                            onClick={() => void changeStatus(inc._id, s)}
                          >
                            Mark {s}
                          </Button>
                        ))}
                        <Input
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Optional note for the timeline…"
                          className="h-8 w-full max-w-xs border-white/10 bg-black/20 text-xs"
                        />
                      </div>

                      {/* Timeline */}
                      <div>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Timeline
                        </p>
                        <div className="space-y-1.5">
                          {detail.timeline.map((ev) => (
                            <div key={ev._id} className="flex items-start gap-2 text-xs">
                              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-lime-400/70" />
                              <div className="min-w-0">
                                <p>
                                  {ev.type === "detected" && "Incident detected"}
                                  {ev.type === "status" && (
                                    <>
                                      Status {ev.fromStatus ?? "—"} →{" "}
                                      <span className="font-semibold text-lime-300">
                                        {ev.toStatus}
                                      </span>
                                    </>
                                  )}
                                  {ev.type === "note" && "Note added"}
                                  {ev.by ? ` · by ${ev.by}` : ""}
                                  {ev.note ? ` — “${ev.note}”` : ""}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {formatDate(ev.at)}
                                </p>
                              </div>
                            </div>
                          ))}
                          {detail.timeline.length === 0 && (
                            <p className="text-xs text-muted-foreground">No events recorded.</p>
                          )}
                        </div>
                      </div>

                      {/* Occurrences */}
                      <div>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Recent occurrences
                        </p>
                        <div className="max-h-56 overflow-y-auto rounded-xl border border-white/8">
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
                                  {o.userId ? "signed-in user · " : "anonymous · "}
                                  severity {o.severity}
                                </p>
                              </div>
                            ))}
                            {detail.occurrences.length === 0 && (
                              <p className="px-3 py-3 text-xs text-muted-foreground">
                                Occurrences pruned by retention.
                              </p>
                            )}
                          </div>
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

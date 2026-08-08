import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquareWarning,
  RotateCcw,
  Search,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/dash/PageHeader";
import { Avatar } from "@/components/site/Avatar";
import { cn } from "@/lib/utils";
import { formatDate, timeAgo } from "@/lib/format";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-white/8 text-muted-foreground" },
  submitted: { label: "Submitted", cls: "bg-amber-400/12 text-amber-300" },
  "under-review": { label: "Under review", cls: "bg-amber-400/12 text-amber-300" },
  "information-required": { label: "Info required", cls: "bg-sky-400/12 text-sky-300" },
  approved: { label: "Approved", cls: "bg-lime-400/12 text-lime-300" },
  verified: { label: "Verified", cls: "bg-lime-400/15 text-lime-300" },
  rejected: { label: "Rejected", cls: "bg-rose-400/12 text-rose-300" },
  suspended: { label: "Suspended", cls: "bg-rose-400/15 text-rose-300" },
};

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm">{value || "—"}</p>
    </div>
  );
}

export default function AdminApplications() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const apps = useQuery(api.admin.tutorApplications, { search: search || undefined });
  const detail = useQuery(
    api.admin.applicationDetail,
    selectedId ? { id: selectedId as never } : "skip",
  );
  const review = useMutation(api.admin.reviewTutorApplication);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (action: string) => {
    if (!selectedId) return;
    setBusy(true);
    try {
      await review({
        applicationId: selectedId as never,
        action: action as never,
        reason: reason || undefined,
      });
      setConfirming(null);
      setReason("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tutor verification"
        description="Review applications, verify credentials and control tutor dashboard access."
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search applicants…"
          className="h-11 border-white/10 bg-card pl-10"
        />
      </div>

      {apps === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : apps.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-card p-10 text-center text-sm text-muted-foreground">
          No tutor applications yet.
        </p>
      ) : (
        <div className="space-y-3">
          {apps.map((a) => {
            const meta = STATUS_META[a.status] ?? STATUS_META.draft;
            return (
              <button
                key={a._id}
                onClick={() => {
                  setSelectedId(a._id);
                  setConfirming(null);
                  setReason("");
                }}
                className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-card p-4 text-left transition-colors hover:border-lime-400/30"
              >
                <Avatar name={a.user?.name ?? a.fullName} image={a.user?.image} className="size-11" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{a.fullName}</p>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold", meta.cls)}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.professionalTitle} · {a.city}, {a.country} · submitted{" "}
                    {a.submittedAt ? timeAgo(a.submittedAt) : "—"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white/8 px-3 py-1 text-xs text-muted-foreground">
                  {a.skills.slice(0, 2).join(", ")}
                  {a.skills.length > 2 ? "…" : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-card sm:max-w-3xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">
                  {detail.fullName}
                  <span className={cn("ml-2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold", STATUS_META[detail.status]?.cls)}>
                    {STATUS_META[detail.status]?.label}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-lime-300">Personal</h3>
                  <Field label="Email" value={detail.email} />
                  <Field label="Phone" value={detail.phone} />
                  <Field label="Address" value={`${detail.residentialAddress}, ${detail.city}, ${detail.state}, ${detail.country}`} />
                </div>
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-lime-300">Professional</h3>
                  <Field label="Title" value={detail.professionalTitle} />
                  <Field label="Experience" value={`${detail.yearsOfExperience} years · ${detail.currentOccupation}`} />
                  <Field label="Qualification" value={`${detail.highestQualification} in ${detail.fieldOfStudy} — ${detail.institution} (${detail.graduationYear})`} />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-lime-300">Biography</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {detail.biography}
                </p>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-lime-300">Skills & teaching</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.skills.map((s) => (
                      <span key={s} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs">{s}</span>
                    ))}
                  </div>
                  <Field label="Expertise" value={detail.areasOfExpertise} />
                  <Field label="Teaching experience" value={detail.teachingExperience} />
                  <Field label="Teaching format" value={detail.teachingFormat} />
                  <Field label="Subjects" value={detail.teachingSubjects.join(", ")} />
                </div>
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-lime-300">Statement</h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {detail.teachingStatement}
                  </p>
                  <Field label="Why ForgeX?" value={detail.whyForgeX} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="CV" value={
                  detail.cvUrl ? (
                    <a href={detail.cvUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-lime-300 hover:underline">
                      <FileText className="size-3.5" /> {detail.cvFileName ?? "Download CV"} <ExternalLink className="size-3" />
                    </a>
                  ) : "—"
                } />
                <Field label="NIN" value={<span className="font-mono">{detail.nin}</span>} />
                <Field label="Links" value={
                  [detail.linkedin, detail.website, detail.portfolio, detail.github, detail.youtube, detail.otherLink]
                    .filter(Boolean)
                    .map((l) => (
                      <a key={l} href={l} target="_blank" rel="noopener noreferrer" className="block truncate text-lime-300 hover:underline">
                        {l}
                      </a>
                    )) || "—"
                } />
              </div>

              {detail.reviewNote && (
                <p className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                  <span className="font-semibold text-muted-foreground">Last review note: </span>
                  {detail.reviewNote}
                </p>
              )}

              {detail.auditRows.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">History</h3>
                  <div className="mt-2 space-y-1.5">
                    {detail.auditRows.slice(0, 5).map((r) => (
                      <p key={r._id} className="text-xs text-muted-foreground">
                        {formatDate(r.createdAt)} · <span className="text-lime-300">{r.action}</span> · {r.detail}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {confirming ? (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm">
                    Confirm <span className="font-semibold text-lime-300">{confirming}</span>?{" "}
                    {(confirming === "reject" || confirming === "request-info") && (
                      <span className="text-muted-foreground">Reason required.</span>
                    )}
                  </p>
                  {(confirming === "reject" || confirming === "request-info") && (
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      placeholder={confirming === "reject" ? "Why is this application being rejected?" : "What information is required?"}
                      className="border-white/10 bg-black/30"
                    />
                  )}
                  <div className="flex gap-2">
                    <Button
                      disabled={busy || ((confirming === "reject" || confirming === "request-info") && !reason.trim())}
                      onClick={() => void act(confirming)}
                      className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                    >
                      {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                      Confirm
                    </Button>
                    <Button variant="outline" onClick={() => setConfirming(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
                  <Button size="sm" className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300" onClick={() => setConfirming("approve")}>
                    <UserCheck className="size-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 border-lime-400/40 text-lime-300 hover:bg-lime-400/10" onClick={() => setConfirming("verify")}>
                    <BadgeCheck className="size-3.5" /> Approve + verify badge
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 border-white/15" onClick={() => setConfirming("request-info")}>
                    <MessageSquareWarning className="size-3.5" /> Request info
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 border-white/15" onClick={() => setConfirming("reactivate")}>
                    <RotateCcw className="size-3.5" /> Reactivate
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5 border-rose-400/30 text-rose-300 hover:bg-rose-400/10" onClick={() => setConfirming("suspend")}>
                    <Ban className="size-3.5" /> Suspend
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1.5 text-rose-300" onClick={() => setConfirming("reject")}>
                    <XCircle className="size-3.5" /> Reject
                  </Button>
                </div>
              )}

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5 text-lime-300" />
                Approving unlocks the Tutor Dashboard. Verify also adds the ✓ badge to their profile.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

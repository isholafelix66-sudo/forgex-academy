import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTeamAuth } from "@/hooks/use-team-auth";
import { motion } from "framer-motion";
import {
  Loader2,
  GraduationCap,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Search,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_TABS = ["all", "submitted", "under-review", "approved", "rejected"] as const;
const STATUS_COLORS: Record<string, string> = {
  submitted: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  "under-review": "border-amber-400/30 bg-amber-400/10 text-amber-300",
  approved: "border-green-400/30 bg-green-400/10 text-green-300",
  rejected: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  "information-required": "border-amber-400/30 bg-amber-400/10 text-amber-300",
  verified: "border-lime-400/30 bg-lime-400/10 text-lime-300",
};

export default function TeamTutors() {
  const { token } = useTeamAuth();
  const [teamId, setTeamId] = useState<string | null>(null);
  // Get team ID from workspace
  const workspace = useQuery(api.teamAuthWorkspace.getTeamWorkspace, token ? { token } : "skip");
  const team = workspace?.team as any;
  const [tab, setTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState("");

  const applications = useQuery(
    api.teamAuthWorkspaceRoles.listAllTutorApplications,
    token ? { token } : "skip",
  );

  const reviewMutation = useMutation(api.teamAuthWorkspaceRoles.reviewTutorApplication);

  const handleReview = async (app: any, status: string) => {
    if (!token) return;
    try {
      await reviewMutation({
        token,
        applicationId: app._id,
        status: status as any,
        note: reviewNote || undefined,
      });
      toast.success(`Tutor application ${status.replace(/_/g, " ")}`);
      setSelectedApp(null);
      setReviewNote("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!workspace) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-lime-400" />
      </div>
    );
  }

  const filtered = (applications ?? []).filter((app: any) => {
    if (tab !== "all" && app.status !== tab) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        app.fullName?.toLowerCase().includes(q) ||
        app.email?.toLowerCase().includes(q) ||
        app.professionalTitle?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-lime-400/15 bg-gradient-to-br from-lime-400/5 to-transparent p-6"
      >
        <div className="flex items-center gap-3">
          <GraduationCap className="size-6 text-lime-400" />
          <div>
            <h2 className="font-display text-xl font-bold text-white">Tutor Verification</h2>
            <p className="text-sm text-white/50">
              Review tutor applications, inspect profiles and qualifications, then recommend approval or request changes.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                tab === s
                  ? "border border-lime-400/40 bg-lime-400/12 text-lime-300"
                  : "border border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tutors…"
            className="h-9 w-56 rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none"
          />
        </div>
      </div>

      {/* Applications List */}
      {!applications ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-lime-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-card p-10 text-center">
          <GraduationCap className="mx-auto size-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No tutor applications found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app: any) => (
            <motion.div
              key={app._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-white/5 bg-card p-5 transition-colors hover:border-lime-400/20"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-sm font-bold text-white">{app.fullName}</h3>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[app.status] ?? "border-white/10 bg-white/5 text-white/50"}`}>
                      {app.status}
                    </span>
                    {app.review && (
                      <span className="rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-0.5 text-[10px] font-bold text-lime-300">
                        Team reviewed
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-white/40">{app.email} · {app.professionalTitle}</p>
                  <p className="mt-1 text-xs text-white/30 line-clamp-2">{app.biography}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {app.skills?.slice(0, 5).map((s: string) => (
                      <span key={s} className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-white/40">{s}</span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setSelectedApp(app)}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-white/50 transition-colors hover:border-lime-400/30 hover:text-white"
                  >
                    Review
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedApp(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-bold text-white">{selectedApp.fullName}</h3>
            <p className="text-sm text-white/50">{selectedApp.professionalTitle} · {selectedApp.email}</p>

            <div className="mt-4 space-y-3 text-sm text-white/60">
              <div><span className="font-medium text-white/80">Experience:</span> {selectedApp.yearsOfExperience} years</div>
              <div><span className="font-medium text-white/80">Qualification:</span> {selectedApp.highestQualification} in {selectedApp.fieldOfStudy}</div>
              <div><span className="font-medium text-white/80">Institution:</span> {selectedApp.institution} ({selectedApp.graduationYear})</div>
              <div><span className="font-medium text-white/80">Teaching Experience:</span> {selectedApp.teachingExperience}</div>
              <div><span className="font-medium text-white/80">Teaching Statement:</span> {selectedApp.teachingStatement}</div>
              <div><span className="font-medium text-white/80">Why ForgeX:</span> {selectedApp.whyForgeX}</div>
              {selectedApp.skills?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedApp.skills.map((s: string) => (
                    <span key={s} className="rounded-md bg-lime-400/10 px-2 py-0.5 text-[11px] text-lime-300">{s}</span>
                  ))}
                </div>
              )}
            </div>



            {/* Review Note */}
            <div className="mt-4">
              <label className="text-xs font-medium text-white/40">Reviewer Note</label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Add a note for this review…"
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none"
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => handleReview(selectedApp, "approved")}
                className="flex items-center gap-1.5 rounded-xl bg-green-500/20 px-4 py-2 text-sm font-medium text-green-300 transition-colors hover:bg-green-500/30"
              >
                <CheckCircle2 className="size-4" /> Recommend Approve
              </button>
              <button
                onClick={() => handleReview(selectedApp, "revision_required")}
                className="flex items-center gap-1.5 rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-500/30"
              >
                <AlertCircle className="size-4" /> Request Changes
              </button>
              <button
                onClick={() => handleReview(selectedApp, "rejected")}
                className="flex items-center gap-1.5 rounded-xl bg-rose-500/20 px-4 py-2 text-sm font-medium text-rose-300 transition-colors hover:bg-rose-500/30"
              >
                <XCircle className="size-4" /> Recommend Reject
              </button>
              <button
                onClick={() => handleReview(selectedApp, "reviewing")}
                className="flex items-center gap-1.5 rounded-xl bg-sky-500/20 px-4 py-2 text-sm font-medium text-sky-300 transition-colors hover:bg-sky-500/30"
              >
                <Clock className="size-4" /> Mark Reviewing
              </button>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedApp(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/50 hover:text-white"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

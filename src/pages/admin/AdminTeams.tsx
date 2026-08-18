import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getAdminToken } from "@/lib/admin-session";
import { friendlyError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Shield,
  Users,
  XCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminTeamManagement() {
  const token = getAdminToken();
  const teams = useQuery(api.team.listAllTeams);
  const pendingApps = useQuery(
    api.team.listPendingApplications,
    token ? {} : "skip"
  );
  const allApps = useQuery(
    api.team.listAllApplications,
    token ? {} : "skip"
  );
  const allActivity = useQuery(api.team.getAllTeamActivity);
  const createTeam = useMutation(api.team.createTeam);
  const reviewApp = useMutation(api.team.reviewApplication);
  const deactivateMember = useMutation(api.team.deactivateMember);

  const [tab, setTab] = useState<"pending" | "teams" | "members" | "activity">("pending");
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: "", slug: "", description: "" });
  const [reviewingApp, setReviewingApp] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState({ teamId: "", role: "teamMember", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  if (!token) return null;

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamForm.name.trim() || !teamForm.slug.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createTeam({
        name: teamForm.name.trim(),
        slug: teamForm.slug.trim(),
        description: teamForm.description.trim(),
        token,
      });
      setTeamForm({ name: "", slug: "", description: "" });
      setShowCreateTeam(false);
    } catch (err) {
      setError(friendlyError(err, "Could not create team."));
    } finally {
      setSaving(false);
    }
  };

  const handleReviewApp = async (appId: string, decision: "approved" | "rejected") => {
    setSaving(true);
    setError(null);
    try {
      await reviewApp({
        applicationId: appId as any,
        decision,
        teamId: reviewForm.teamId ? (reviewForm.teamId as any) : undefined,
        role: reviewForm.role as any,
        reviewNote: reviewForm.note.trim() || undefined,
        token,
      });
      setReviewingApp(null);
      setReviewForm({ teamId: "", role: "teamMember", note: "" });
    } catch (err) {
      setError(friendlyError(err, "Could not review application."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (membershipId: string) => {
    if (!confirm("Deactivate this team member?")) return;
    try {
      await deactivateMember({ membershipId: membershipId as any, token });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/5 pb-2">
        {[
          { key: "pending", label: "Pending Applications", count: pendingApps?.length },
          { key: "teams", label: "Teams", count: teams?.length },
          { key: "members", label: "All Applications", count: allApps?.length },
          { key: "activity", label: "Activity", count: allActivity?.length },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key
                ? "bg-lime-500/10 text-lime-400"
                : "text-white/50 hover:bg-white/5"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1.5 rounded-full bg-lime-400/20 px-1.5 py-0.5 text-[10px] text-lime-300">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pending Applications */}
      {tab === "pending" && (
        <div className="space-y-3">
          {!pendingApps ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-lime-400" />
            </div>
          ) : pendingApps.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-card p-8 text-center">
              <p className="text-sm text-white/40">No pending applications.</p>
            </div>
          ) : (
            pendingApps.map((app) => (
              <div
                key={app._id}
                className="rounded-xl border border-white/5 bg-card p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-white">{app.name}</p>
                    <p className="text-sm text-white/50">{app.email}</p>
                    <p className="mt-1 text-xs text-white/40">
                      Skill: {app.skill} • Applied{" "}
                      {new Date(app.createdAt).toLocaleDateString()}
                    </p>
                    {app.introduction && (
                      <p className="mt-2 text-xs text-white/40 line-clamp-2">
                        {app.introduction}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {reviewingApp === app._id ? (
                      <div className="space-y-2 rounded-lg bg-white/5 p-3">
                        <select
                          value={reviewForm.teamId}
                          onChange={(e) =>
                            setReviewForm((f) => ({ ...f, teamId: e.target.value }))
                          }
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white"
                        >
                          <option value="">Select team</option>
                          {teams?.map((t) => (
                            <option key={t._id} value={t._id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={reviewForm.role}
                          onChange={(e) =>
                            setReviewForm((f) => ({ ...f, role: e.target.value }))
                          }
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white"
                        >
                          <option value="teamMember">Team Member</option>
                          <option value="teamLead">Team Lead</option>
                        </select>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={saving || !reviewForm.teamId}
                            onClick={() => handleReviewApp(app._id, "approved")}
                            className="flex-1 bg-green-500 text-black hover:brightness-110"
                          >
                            {saving ? <Loader2 className="size-3 animate-spin" /> : "Approve"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReviewApp(app._id, "rejected")}
                            className="flex-1 border-red-500/30 text-red-400"
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setReviewingApp(app._id)}
                        className="gap-1 bg-lime-500 text-black hover:brightness-110"
                      >
                        Review
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Teams */}
      {tab === "teams" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              onClick={() => setShowCreateTeam(!showCreateTeam)}
              className="gap-1.5 bg-lime-500 text-black hover:brightness-110"
              size="sm"
            >
              <Plus className="size-3.5" />
              New Team
            </Button>
          </div>

          <AnimatePresence>
            {showCreateTeam && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-2xl border border-white/5 bg-card p-5"
                onSubmit={handleCreateTeam}
              >
                <h3 className="mb-3 text-sm font-semibold text-white">New Team</h3>
                <div className="space-y-3">
                  <Input
                    value={teamForm.name}
                    onChange={(e) => setTeamForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Team name"
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                    required
                  />
                  <Input
                    value={teamForm.slug}
                    onChange={(e) => setTeamForm((f) => ({ ...f, slug: e.target.value }))}
                    placeholder="URL slug (e.g. academic)"
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                    required
                  />
                  <Textarea
                    value={teamForm.description}
                    onChange={(e) => setTeamForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Team description"
                    rows={2}
                    className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                  />
                  {error && (
                    <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={saving} className="bg-lime-500 text-black">
                      {saving ? <Loader2 className="size-3 animate-spin" /> : "Create"}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreateTeam(false)} className="text-white/50">
                      Cancel
                    </Button>
                  </div>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {!teams ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-lime-400" />
            </div>
          ) : teams.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-card p-8 text-center">
              <p className="text-sm text-white/40">No teams created yet.</p>
            </div>
          ) : (
            teams.map((t) => (
              <div key={t._id} className="rounded-xl border border-white/5 bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{t.name}</p>
                    <p className="text-xs text-white/50">{t.description}</p>
                    <p className="mt-1 text-xs text-white/40">
                      {t.memberCount} members • {t.activeWorkCount} active work items • {t.status}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* All Applications */}
      {tab === "members" && (
        <div className="space-y-3">
          {!allApps ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-lime-400" />
            </div>
          ) : allApps.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-card p-8 text-center">
              <p className="text-sm text-white/40">No applications yet.</p>
            </div>
          ) : (
            allApps.map((app) => (
              <div key={app._id} className="rounded-xl border border-white/5 bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{app.name}</p>
                    <p className="text-xs text-white/50">{app.email} • {app.skill}</p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
                      app.status === "approved"
                        ? "bg-green-500/10 text-green-400"
                        : app.status === "rejected"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-yellow-500/10 text-yellow-400"
                    }`}
                  >
                    {app.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Activity */}
      {tab === "activity" && (
        <div className="space-y-2">
          {!allActivity ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-lime-400" />
            </div>
          ) : allActivity.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-card p-8 text-center">
              <p className="text-sm text-white/40">No team activity yet.</p>
            </div>
          ) : (
            allActivity.map((a) => (
              <div key={a._id} className="flex items-start gap-3 rounded-xl border border-white/5 bg-card px-4 py-3">
                <div className="mt-0.5 size-2 shrink-0 rounded-full bg-lime-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/80">
                    <span className="font-medium text-white">{a.user?.name || "Someone"}</span>{" "}
                    {a.action.replace(/_/g, " ")}
                    {a.targetLabel && (
                      <>
                        {" "}
                        <span className="text-lime-400/80">{a.targetLabel}</span>
                      </>
                    )}
                  </p>
                  {a.details && (
                    <p className="mt-0.5 text-xs text-white/40">{a.details}</p>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-white/30">
                  {new Date(a.createdAt).toLocaleString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

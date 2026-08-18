import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { friendlyError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";
import { motion } from "framer-motion";

const SECTIONS = [
  { value: "lessons", label: "Lessons" },
  { value: "quizzes", label: "Quizzes" },
  { value: "resources", label: "Resources" },
  { value: "objectives", label: "Learning Objectives" },
  { value: "general", label: "General" },
] as const;

const DECISIONS = [
  { value: "approved", label: "Approved", icon: CheckCircle2, color: "text-green-400" },
  { value: "revision_required", label: "Revision Required", icon: XCircle, color: "text-red-400" },
  { value: "pending", label: "Pending", icon: Clock, color: "text-yellow-400" },
] as const;

export default function TeamReviews() {
  const { user } = useAuth();
  const myTeam = useQuery(api.team.getMyTeam);
  const team = myTeam?.team;
  const submitReview = useMutation(api.team.submitCourseReview);

  const [courseId, setCourseId] = useState("");
  const [activeSection, setActiveSection] = useState<string>("lessons");
  const [decision, setDecision] = useState<string>("approved");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reviews = useQuery(
    api.team.getCourseReviews,
    team && courseId ? { teamId: team._id, courseId: courseId as any } : "skip"
  );

  if (!team) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-lime-400" />
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!courseId) return;
    setSaving(true);
    setError(null);
    try {
      await submitReview({
        courseId: courseId as any,
        teamId: team._id,
        section: activeSection as any,
        decision: decision as any,
        note: note.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setNote("");
    } catch (err) {
      setError(friendlyError(err, "Could not submit review."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Course Reviews</h1>
        <p className="mt-0.5 text-sm text-white/50">
          Review course sections and submit your assessment.
        </p>
      </div>

      {/* Course ID input */}
      <div className="rounded-2xl border border-white/5 bg-card p-5">
        <label className="mb-2 block text-sm font-medium text-white/80">
          Course ID to Review
        </label>
        <div className="flex gap-2">
          <Input
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            placeholder="Paste the course ID"
            className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
          />
        </div>
      </div>

      {courseId && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Section tabs */}
          <div className="flex flex-wrap gap-2">
            {SECTIONS.map((s) => {
              const existingReview = reviews?.find((r) => r.section === s.value);
              return (
                <button
                  key={s.value}
                  onClick={() => {
                    setActiveSection(s.value);
                    if (existingReview) {
                      setDecision(existingReview.decision);
                      setNote(existingReview.note || "");
                    }
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeSection === s.value
                      ? "bg-lime-500/10 text-lime-400"
                      : "text-white/50 hover:bg-white/5"
                  }`}
                >
                  {existingReview?.decision === "approved" && (
                    <CheckCircle2 className="size-3 text-green-400" />
                  )}
                  {existingReview?.decision === "revision_required" && (
                    <XCircle className="size-3 text-red-400" />
                  )}
                  {existingReview?.decision === "pending" && (
                    <Clock className="size-3 text-yellow-400" />
                  )}
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Decision */}
          <div className="rounded-2xl border border-white/5 bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-white">
              {SECTIONS.find((s) => s.value === activeSection)?.label} Review
            </h3>
            <div className="mb-4 flex gap-2">
              {DECISIONS.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDecision(d.value)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    decision === d.value
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:bg-white/5"
                  }`}
                >
                  <d.icon className={`size-3.5 ${decision === d.value ? d.color : ""}`} />
                  {d.label}
                </button>
              ))}
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add notes about your review decision..."
              rows={3}
              className="mb-4 border-white/10 bg-white/5 text-white placeholder:text-white/30"
            />
            {error && (
              <p className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="gap-1.5 bg-gradient-to-r from-lime-400 to-emerald-500 text-black hover:brightness-110"
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="size-3.5" />
              ) : null}
              {saved ? "Submitted" : "Submit Review"}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

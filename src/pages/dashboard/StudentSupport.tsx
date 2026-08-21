import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import {
  HelpCircle,
  Send,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "course", label: "Course Issue", icon: "📚" },
  { value: "video", label: "Video Issue", icon: "🎬" },
  { value: "quiz", label: "Quiz Issue", icon: "📝" },
  { value: "account", label: "Account Issue", icon: "👤" },
  { value: "technical", label: "Technical Problem", icon: "🔧" },
  { value: "academic", label: "Academic Question", icon: "🎓" },
  { value: "learning", label: "Learning Difficulty", icon: "📖" },
  { value: "general", label: "General Support", icon: "💬" },
  { value: "other", label: "Other", icon: "❓" },
] as const;

export default function StudentSupport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const submitCase = useMutation(api.teamWorkspace.submitStudentSupport);
  const myCases = useQuery(api.teamWorkspace.myStudentSupportCases, {});

  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) { toast.error("Please select a category"); return; }
    if (!subject.trim()) { toast.error("Please add a subject"); return; }
    if (!description.trim()) { toast.error("Please describe your issue"); return; }
    setSubmitting(true);
    try {
      const result = await submitCase({
        category: category as any,
        subject: subject.trim(),
        description: description.trim(),
      });
      setSubmitted(result.caseNumber);
      setCategory(""); setSubject(""); setDescription("");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const safeCases = Array.isArray(myCases) ? myCases : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate("/dashboard")} className="text-white/40 hover:text-white">
          <ArrowLeft className="size-5" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Student Support</h1>
          <p className="text-sm text-white/40">Report issues, ask questions, or get help with the platform.</p>
        </div>
      </div>

      {/* Success Banner */}
      {submitted && (
        <div className="rounded-2xl border border-lime-400/20 bg-lime-400/5 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 text-lime-400" />
            <div>
              <p className="font-medium text-lime-300">Support request submitted!</p>
              <p className="mt-1 text-sm text-lime-300/60">
                Your case number is <span className="font-mono font-bold text-lime-300">{submitted}</span>.
                Our Student Support team will review your request and respond shortly.
              </p>
              <button
                type="button"
                onClick={() => setSubmitted(null)}
                className="mt-3 text-xs text-lime-300/40 hover:text-lime-300"
              >
                Submit another request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submission Form */}
      {!submitted && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-card p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-white">Submit Support Request</h2>

          {/* Category */}
          <div>
            <label className="mb-2 block text-sm font-medium text-white/60">Category</label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-colors ${
                    category === cat.value
                      ? "border-lime-400/40 bg-lime-400/10 text-lime-300"
                      : "border-white/10 bg-white/5 text-white/40 hover:bg-white/10"
                  }`}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-[10px] font-medium leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="mb-1 block text-sm font-medium text-white/60">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your issue..."
              className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-white/60">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your issue in detail. Include any error messages, course names, or steps to reproduce..."
              rows={5}
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none resize-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-lime-300 disabled:opacity-40"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {submitting ? "Submitting..." : "Submit Support Request"}
          </button>
        </form>
      )}

      {/* Previous Cases */}
      <div className="rounded-2xl border border-white/10 bg-card p-6">
        <h2 className="font-display text-lg font-bold text-white">Your Support Requests</h2>
        {safeCases.length === 0 ? (
          <div className="mt-4 py-8 text-center">
            <MessageSquare className="mx-auto size-8 text-white/20" />
            <p className="mt-2 text-sm text-white/30">No support requests yet.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {safeCases.map((c) => (
              <div key={c._id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{c.subject}</p>
                    <p className="mt-0.5 text-xs text-white/30">
                      {c.caseNumber} • {c.category} • {new Date(c.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    c.status === "open" ? "bg-amber-400/10 text-amber-300" :
                    c.status === "in_progress" ? "bg-blue-400/10 text-blue-300" :
                    c.status === "resolved" ? "bg-lime-400/10 text-lime-300" :
                    "bg-white/5 text-white/30"
                  }`}>
                    {c.status?.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-2 text-sm text-white/40 line-clamp-2">{c.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

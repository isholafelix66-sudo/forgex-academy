import { useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, X, CheckCircle2, ArrowUpCircle, Play, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatLessonDuration } from "@/lib/format";

export default function CoursePreviewModal({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  // getCoursePreview requires a signed-in user (requireAuth). Password-gated
  // admins have no user session — skip instead of throwing mid-render.
  const { isAuthenticated } = useConvexAuth();
  const preview = useQuery(
    api.teamWorkspace.getCoursePreview,
    isAuthenticated ? { courseId: courseId as any } : "skip",
  );
  const approveCourse = useMutation(api.teamWorkspace.approveCourse);
  const requestRevision = useMutation(api.teamWorkspace.requestCourseRevision);
  const [activeTab, setActiveTab] = useState<"overview" | "lessons" | "quizzes">("overview");
  const [revisionModal, setRevisionModal] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  const handleApprove = async () => {
    setSaving(true);
    try { await approveCourse({ courseId: courseId as any }); toast.success("Approved"); onClose(); }
    catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };
  const handleRevision = async () => {
    if (!revisionFeedback.trim()) { toast.error("Provide feedback"); return; }
    setSaving(true);
    try { await requestRevision({ courseId: courseId as any, feedback: revisionFeedback.trim() }); toast.success("Revision requested"); onClose(); }
    catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  if (!preview) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="rounded-2xl border border-white/10 bg-card p-8 text-center" onClick={(e) => e.stopPropagation()}>
        {!isAuthenticated ? (
          <p className="max-w-xs text-sm text-amber-300">
            Sign in with an administrator account to preview courses.
          </p>
        ) : (
          <Loader2 className="size-6 animate-spin text-lime-400" />
        )}
      </div>
    </div>
  );

  const { course, tutorName, categoryName, lessons, quizzes, lessonQuizzes } = preview;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[95vh] rounded-2xl border border-white/10 bg-card flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold text-white truncate">{course.title}</h2>
            <p className="text-xs text-white/40 mt-1">by {tutorName} • {categoryName} • {course.difficulty} • {lessons.length} lessons • {quizzes.length} quizzes</p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg border border-white/10 p-2 text-white/40 hover:bg-white/5"><X className="size-4" /></button>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2">
          {course.status !== "approved" && (
            <button type="button" onClick={handleApprove} disabled={saving} className="rounded-lg border border-lime-400/30 px-3 py-1.5 text-xs font-semibold text-lime-300 hover:bg-lime-400/10 disabled:opacity-40">
              <CheckCircle2 className="mr-1 inline size-3" />Approve
            </button>
          )}
          {course.status !== "rejected" && (
            <button type="button" onClick={() => setRevisionModal(true)} className="rounded-lg border border-amber-400/30 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/10">
              <ArrowUpCircle className="mr-1 inline size-3" />Request Revision
            </button>
          )}
          <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${course.status === "approved" ? "bg-lime-400/10 text-lime-300" : course.status === "rejected" ? "bg-amber-400/10 text-amber-300" : "bg-blue-400/10 text-blue-300"}`}>
            {course.status?.toUpperCase() || "DRAFT"}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/10 px-4 py-2">
          {(["overview", "lessons", "quizzes"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setActiveTab(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === t ? "bg-lime-400/10 text-lime-300" : "text-white/50 hover:bg-white/5"}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div><h3 className="text-sm font-bold text-white mb-2">Description</h3><p className="text-sm text-white/60">{course.description || "No description."}</p></div>
              {course.longDescription && <div><h3 className="text-sm font-bold text-white mb-2">Full Description</h3><p className="text-sm text-white/50 whitespace-pre-wrap">{course.longDescription}</p></div>}
              {course.skills.length > 0 && <div><h3 className="text-sm font-bold text-white mb-2">Skills</h3><div className="flex flex-wrap gap-2">{course.skills.map((s: string, i: number) => <span key={i} className="rounded-full bg-lime-400/10 px-3 py-1 text-xs text-lime-300">{s}</span>)}</div></div>}
              {course.prerequisites.length > 0 && <div><h3 className="text-sm font-bold text-white mb-2">Prerequisites</h3><div className="flex flex-wrap gap-2">{course.prerequisites.map((p: string, i: number) => <span key={i} className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/50">{p}</span>)}</div></div>}
              {course.reviewNote && <div className="rounded-lg bg-amber-400/5 border border-amber-400/10 p-3"><p className="text-xs font-medium text-amber-300 mb-1">Review Note</p><p className="text-sm text-amber-300/70">{course.reviewNote}</p></div>}
            </div>
          )}

          {activeTab === "lessons" && (
            <div className="space-y-3">
              {lessons.length === 0 ? <p className="text-sm text-white/30">No lessons.</p> : lessons.map((l: any, idx: number) => {
                const lq = lessonQuizzes.find((q: any) => q.lessonId === l._id);
                return (
                  <div key={l._id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1"><p className="font-medium text-white text-sm">Lesson {idx + 1}: {l.title}</p><p className="text-xs text-white/30 mt-0.5">{formatLessonDuration(l)}{lq ? " • Has quiz" : ""}</p></div>
                      {l.videoUrl && <a href={l.videoUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/60 hover:bg-white/5"><Play className="mr-1 inline size-3" />Watch</a>}
                      {l.muxPlaybackId && <span className="shrink-0 rounded-lg bg-purple-400/10 px-2.5 py-1.5 text-[10px] font-semibold text-purple-300">MUX Video</span>}
                    </div>
                    {l.notes && <p className="mt-2 text-xs text-white/40 line-clamp-3">{l.notes}</p>}
                    {l.resources.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{l.resources.map((r: any, ri: number) => <a key={ri} href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/40 hover:bg-white/10"><ExternalLink className="size-2.5" />{r.name}</a>)}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "quizzes" && (
            <div className="space-y-3">
              {quizzes.length === 0 && lessonQuizzes.length === 0 ? <p className="text-sm text-white/30">No quizzes.</p> : <>
                {quizzes.map((q: any) => (
                  <div key={q._id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="font-medium text-white text-sm">{q.title}</p>
                    <p className="text-xs text-white/30 mt-0.5">{q.questionCount} questions • {q.timeLimitMinutes} min limit</p>
                    {q.description && <p className="mt-2 text-xs text-white/40">{q.description}</p>}
                    {q.questions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {q.questions.slice(0, 5).map((question: any, qi: number) => (
                          <div key={qi} className="rounded-lg bg-black/20 p-3">
                            <p className="text-xs font-medium text-white/70">Q{qi + 1}: {question.question}</p>
                            {question.options && question.options.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {question.options.map((opt: string, oi: number) => (
                                  <span key={oi} className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-white/40">{String.fromCharCode(65 + oi)}. {opt}</span>
                                ))}
                              </div>
                            )}
                            {question.correctAnswer && <p className="mt-1 text-[10px] text-lime-300/60">Answer: {question.correctAnswer}</p>}
                          </div>
                        ))}
                        {q.questions.length > 5 && <p className="text-[10px] text-white/30">...and {q.questions.length - 5} more questions</p>}
                      </div>
                    )}
                  </div>
                ))}
                {lessonQuizzes.length > 0 && (
                  <div className="rounded-xl border border-purple-400/10 bg-purple-400/5 p-4">
                    <p className="text-xs font-medium text-purple-300 mb-2">Lesson Quizzes ({lessonQuizzes.length})</p>
                    {lessonQuizzes.map((lq: any) => (
                      <div key={lq._id} className="mt-2 rounded-lg bg-black/20 p-3">
                        <p className="text-xs font-medium text-white/70">{lq.title} — Pass: {lq.passPercent}%</p>
                        <p className="text-[10px] text-white/30 mt-0.5">{lq.questionCount} questions</p>
                      </div>
                    ))}
                  </div>
                )}
              </>}
            </div>
          )}
        </div>
      </div>

      {/* Revision Modal */}
      {revisionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setRevisionModal(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-white">Request Revision</h3>
            <textarea value={revisionFeedback} onChange={(e) => setRevisionFeedback(e.target.value)}
              placeholder="What needs to be changed..." rows={4}
              className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none resize-none" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRevisionModal(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/50 hover:bg-white/5">Cancel</button>
              <button type="button" onClick={handleRevision} disabled={saving} className="rounded-xl bg-amber-400 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-40">
                {saving ? <Loader2 className="mr-1 inline size-3 animate-spin" /> : null}Send Revision Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ClipboardCheck, ExternalLink, FileText, Link2, Loader2, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Avatar } from "@/components/site/Avatar";
import { timeAgo } from "@/lib/format";

type Row = NonNullable<ReturnType<typeof useQuery<typeof api.tutor.pendingSubmissions>>>[number];

export default function TutorGrading() {
  const pending = useQuery(api.tutor.pendingSubmissions);
  const gradeSubmission = useMutation(api.submissions.gradeSubmission);
  const [selected, setSelected] = useState<Row | null>(null);
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (s: Row) => {
    setSelected(s);
    setGrade("");
    setFeedback("");
    setError(null);
  };

  const save = async () => {
    if (!selected) return;
    const g = Number(grade);
    if (Number.isNaN(g) || g < 0) {
      setError("Enter a valid grade.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await gradeSubmission({
        submissionId: selected._id as never,
        grade: g,
        feedback,
      });
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to grade.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Grading"
        description="Review student submissions, assign scores and leave feedback."
      />

      {pending === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : pending.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-6" />}
          title="Nothing waiting"
          description="Student submissions will appear here the moment they're handed in."
        />
      ) : (
        <div className="space-y-3">
          {pending.map((s) => (
            <div
              key={s._id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-card p-5 sm:flex-row sm:items-center"
            >
              <Avatar name={s.student?.name ?? "Student"} image={s.student?.image} className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.student?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.assignment?.title} · {s.course?.title} · submitted {timeAgo(s.submittedAt)}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">{s.text || "— no text, see links/files"}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {s.links.slice(0, 3).map((l, i) => (
                    <a key={i} href={l} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-muted-foreground hover:border-lime-400/40 hover:text-lime-300">
                      <Link2 className="size-3" /> link {i + 1}
                    </a>
                  ))}
                  {s.files.map((f, i) => (
                    <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-muted-foreground hover:border-lime-400/40 hover:text-lime-300">
                      <Paperclip className="size-3" /> {f.name}
                    </a>
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                className="shrink-0 gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                onClick={() => open(s)}
              >
                <ClipboardCheck className="size-3.5" /> Grade
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-card sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Grade submission</DialogTitle>
              </DialogHeader>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
                <p className="font-medium">{selected.assignment?.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selected.student?.name} · {selected.course?.title} · max score {selected.assignment?.maxScore}
                </p>
                {selected.text && (
                  <p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                    {selected.text}
                  </p>
                )}
                {(selected.links.length > 0 || selected.files.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selected.links.map((l, i) => (
                      <a key={i} href={l} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] hover:border-lime-400/40 hover:text-lime-300">
                        <ExternalLink className="size-3" /> link {i + 1}
                      </a>
                    ))}
                    {selected.files.map((f, i) => (
                      <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] hover:border-lime-400/40 hover:text-lime-300">
                        <FileText className="size-3" /> {f.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Score (0–{selected.assignment?.maxScore})</Label>
                  <Input
                    type="number"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="e.g. 85"
                    className="border-white/10 bg-black/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Feedback</Label>
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={4}
                    placeholder="What went well, what to improve…"
                    className="border-white/10 bg-black/20"
                  />
                </div>
                {error && (
                  <p className="rounded-xl border border-rose-400/25 bg-rose-400/8 p-3 text-sm text-rose-300">{error}</p>
                )}
                <Button
                  onClick={() => void save()}
                  disabled={saving}
                  className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Submit grade
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

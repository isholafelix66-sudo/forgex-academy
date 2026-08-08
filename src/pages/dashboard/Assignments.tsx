import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Paperclip,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { formatDate, formatDateShort, timeAgo } from "@/lib/format";

export default function Assignments() {
  const submissions = useQuery(api.submissions.mySubmissions);
  const [selected, setSelected] = useState<{
    assignmentId: string;
    title: string;
    maxScore: number;
    instructions: string;
    deadline: number | null;
    existing?: string;
  } | null>(null);

  const [text, setText] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [files, setFiles] = useState<Array<{ name: string; url: string }>>([]);
  const [fileInput, setFileInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitAssignment = useMutation(api.submissions.submitAssignment);

  type SubmissionRow = NonNullable<typeof submissions>[number];
  const openDialog = (s: SubmissionRow) => {
    setSelected({
      assignmentId: s.assignmentId,
      title: s.assignment?.title ?? "Assignment",
      maxScore: s.assignment?.maxScore ?? 100,
      instructions: s.assignment?.instructions ?? "",
      deadline: s.assignment?.deadline ?? null,
      existing: s.assignment ? s.assignment.title : undefined,
    });
    setText(s.text ?? "");
    setLinks(s.links ?? []);
    setFiles(s.files ?? []);
    setLinkInput("");
    setFileInput("");
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitAssignment({
        assignmentId: selected.assignmentId as never,
        text,
        links: links.filter(Boolean),
        files,
      });
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit.");
      setSubmitting(false);
    }
  };

  const addLink = () => {
    const l = linkInput.trim();
    if (l && !links.includes(l)) setLinks((v) => [...v, l]);
    setLinkInput("");
  };

  const addFile = () => {
    const f = fileInput.trim();
    if (f) setFiles((v) => [...v, { name: f.split("/").pop() || f, url: f }]);
    setFileInput("");
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Assignments"
        description="Submit work, track grades and read tutor feedback."
      />

      {submissions === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6" />}
          title="No assignments yet"
          description="Assignments appear here when tutors post them in your enrolled courses."
          action={
            <Link to="/courses">
              <Button className="bg-lime-400 font-semibold text-black hover:bg-lime-300">
                Browse courses
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => {
            const graded = s.grade !== undefined;
            return (
              <div
                key={s._id}
                className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-5 sm:flex-row sm:items-center"
              >
                <span
                  className={
                    graded
                      ? "flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-400/15 text-lime-300"
                      : "flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/12 text-amber-300"
                  }
                >
                  {graded ? <CheckCircle2 className="size-5" /> : <FileText className="size-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{s.assignment?.title ?? "Assignment"}</p>
                    {s.course && (
                      <Link
                        to={`/courses/${s.course.slug}`}
                        className="text-xs text-lime-300 hover:underline"
                      >
                        {s.course.title}
                      </Link>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Submitted {timeAgo(s.submittedAt)}
                    {s.assignment?.deadline
                      ? ` · due ${formatDateShort(s.assignment.deadline)}`
                      : ""}
                  </p>
                  {graded ? (
                    <p className="mt-1.5 text-sm">
                      <span className="font-bold text-lime-300">
                        {s.grade}/{s.assignment?.maxScore ?? 100}
                      </span>
                      {s.feedback && (
                        <span className="text-muted-foreground"> — {s.feedback}</span>
                      )}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-amber-300/80">Awaiting grade</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {s.links.length > 0 &&
                    s.links.slice(0, 2).map((l, i) => (
                      <a
                        key={i}
                        href={l}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-muted-foreground hover:border-lime-400/40 hover:text-lime-300"
                      >
                        <Link2 className="size-3" /> link {i + 1}
                      </a>
                    ))}
                  <Button variant="outline" size="sm" onClick={() => openDialog(s)}>
                    {graded ? "View / resubmit" : "Edit submission"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-card sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{selected.title}</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {selected.deadline
                    ? `Due ${formatDate(selected.deadline)} · ${selected.maxScore} points`
                    : `${selected.maxScore} points`}
                </DialogDescription>
              </DialogHeader>

              {selected.instructions && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-relaxed text-muted-foreground">
                  {selected.instructions}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Your submission</label>
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Write your answer or add notes here…"
                    rows={4}
                    className="border-white/10 bg-black/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">Links</label>
                  <div className="flex gap-2">
                    <Input
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLink())}
                      placeholder="https://your-work-link…"
                      className="border-white/10 bg-black/20"
                    />
                    <Button type="button" variant="outline" onClick={addLink}>
                      Add
                    </Button>
                  </div>
                  {links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {links.map((l, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs"
                        >
                          <Link2 className="size-3 text-lime-300" />
                          <span className="max-w-40 truncate">{l}</span>
                          <button onClick={() => setLinks((v) => v.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-rose-300">
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Files (paste a public URL to your file)
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={fileInput}
                      onChange={(e) => setFileInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFile())}
                      placeholder="https://…/my-work.pdf"
                      className="border-white/10 bg-black/20"
                    />
                    <Button type="button" variant="outline" onClick={addFile}>
                      <Paperclip className="size-4" />
                    </Button>
                  </div>
                  {files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {files.map((f, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs"
                        >
                          <Paperclip className="size-3 text-lime-300" />
                          {f.name}
                          <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-lime-300">
                            <ExternalLink className="size-3" />
                          </a>
                          <button onClick={() => setFiles((v) => v.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-rose-300">
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {error && (
                  <p className="rounded-xl border border-rose-400/25 bg-rose-400/8 p-3 text-sm text-rose-300">
                    {error}
                  </p>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={submitting || (!text.trim() && links.length === 0 && files.length === 0)}
                  className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Submit assignment
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ArrowRight className="size-3.5 text-lime-300" />
        Submitting a new version replaces your previous submission and clears the old grade.
      </p>
    </div>
  );
}

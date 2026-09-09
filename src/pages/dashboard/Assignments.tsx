import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Paperclip,
  PenLine,
  Send,
  X,
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
import { timeAgo } from "@/lib/format";
import { uploadFileToConvex } from "@/lib/convex-upload";
import type { Doc } from "@/convex/_generated/dataModel";

type SubmissionDoc = Doc<"submissions">;
type ResourceLike = NonNullable<SubmissionDoc["files"]>[number];

/** Smart file size formatting (B/KB/MB). */
function fmtSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Assignments() {
  const assignments = useQuery(api.submissions.myAssignments);
  const submissions = useQuery(api.submissions.mySubmissions);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const resolveFiles = useMutation(api.submissions.saveSubmittedFiles);
  const submitAssignment = useMutation(api.submissions.submitAssignment);

  // ------------------------------------------------------------------
  // Submission dialog state (one dialog serves legacy + built assignments)
  // ------------------------------------------------------------------
  const [selected, setSelected] = useState<Id<"assignments"> | null>(null);
  const [text, setText] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  // Shared attachments: available to every question (a student can reuse the
  // same workbook file for a text-and-file question and a general upload).
  const [files, setFiles] = useState<ResourceLike[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Per-question answers for built assignments.
  const [answers, setAnswers] = useState<
    Record<number, { text: string; url: string; fileId?: string }>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = useMemo(
    () => (assignments ?? []).find((a) => a._id === selected) ?? null,
    [assignments, selected],
  );
  const questions = active?.questions ?? [];

  const resetForm = () => {
    setText("");
    setLinks([]);
    setLinkInput("");
    setFiles([]);
    setUploadError(null);
    setAnswers({});
    setError(null);
  };

  const openDialog = (a: NonNullable<typeof assignments>[number]) => {
    setSelected(a._id);
    const s = a.submission;
    if (s) {
      setText(s.text ?? "");
      setLinks(s.links ?? []);
      setFiles(s.files ?? []);
      const pre: Record<
        number,
        { text: string; url: string; fileId?: string }
      > = {};
      (s.answers ?? []).forEach((ans) => {
        pre[ans.questionIndex] = {
          text: ans.text ?? "",
          url: ans.url ?? "",
          fileId: undefined,
        };
      });
      setAnswers(pre);
    } else {
      resetForm();
    }
  };

  /** Device upload → Convex storage → resolved file record. */
  const handleFilePicked = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      const arr = Array.from(fileList);
      const uploaded = await Promise.all(
        arr.map((file) =>
          uploadFileToConvex(file, () => generateUploadUrl({})),
        ),
      );
      const resolved = await resolveFiles({
        files: arr.map((f, i) => ({
          name: f.name,
          storageId: uploaded[i].storageId as Id<"_storage">,
          fileType: f.type,
          fileSize: f.size,
        })),
      });
      setFiles((prev) => [...prev, ...resolved]);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  const addLink = () => {
    const l = linkInput.trim();
    if (l && !links.includes(l)) setLinks((v) => [...v, l]);
    setLinkInput("");
  };

  /** A question is answered when it has text / a link / any attached file. */
  const questionAnswered = (i: number, type: string) => {
    const a = answers[i];
    const hasText = !!a?.text?.trim();
    const hasLink = !!a?.url?.trim();
    const hasFile = (a?.fileId && files.some((f) => f.storageId === a.fileId)) ||
      files.length > 0;
    if (type === "file") return !!hasFile;
    if (type === "link") return hasLink;
    if (type === "text-and-file") return hasText && !!hasFile;
    return hasText || hasFile;
  };

  const canSubmit = questions.length
    ? questions.every((q, i) => questionAnswered(i, q.type))
    : text.trim().length > 0 ||
      links.filter(Boolean).length > 0 ||
      files.length > 0;

  const handleSubmit = async () => {
    if (!active) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitAssignment({
        assignmentId: active._id,
        text: questions.length
          ? Object.entries(answers)
              .map(
                ([i, a]) =>
                  `Q${Number(i) + 1}: ${questions[Number(i)]?.question ?? ""}\n${a.text}`,
              )
              .join("\n\n")
          : text,
        links: links.filter(Boolean),
        files: files.map((f) => ({
          name: f.name,
          url: f.url,
          storageId: f.storageId,
          kind: "file" as const,
          fileType: f.fileType,
          fileSize: f.fileSize,
        })),
        answers: questions.length
          ? questions.map((_, i) => ({
              questionIndex: i,
              text: answers[i]?.text || undefined,
              url: answers[i]?.url || undefined,
              fileName:
                answers[i]?.fileId &&
                files.find((f) => f.storageId === answers[i]?.fileId)?.name,
              fileUrl:
                answers[i]?.fileId &&
                files.find((f) => f.storageId === answers[i]?.fileId)?.url,
            }))
          : undefined,
      });
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = (assignments ?? []).filter((a) => !a.submission).length;
  const submittedCount = (submissions ?? []).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Assignments"
        description="Work posted in your enrolled courses — submit, resubmit and track grades."
      />

      {assignments === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-white/8 bg-card"
            />
          ))}
        </div>
      ) : assignments.length === 0 ? (
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
        <>
          {/* Summary strip */}
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3.5 py-1.5 text-xs font-semibold text-amber-300">
              <Clock className="size-3.5" /> {pendingCount} to do
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/25 bg-lime-400/10 px-3.5 py-1.5 text-xs font-semibold text-lime-300">
              <CheckCircle2 className="size-3.5" /> {submittedCount} submitted
            </span>
          </div>

          <div className="space-y-3">
            {assignments.map((a) => {
              const s = a.submission;
              const graded = s?.grade !== undefined;
              const statusLabel = graded
                ? `Graded ${s!.grade}/${a.maxScore}`
                : s
                  ? "Submitted · awaiting grade"
                  : "To do";
              return (
                <div
                  key={a._id}
                  className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-5 sm:flex-row sm:items-center"
                >
                  <span
                    className={
                      graded
                        ? "flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-400/15 text-lime-300"
                        : s
                          ? "flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-400/12 text-blue-300"
                          : "flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/12 text-amber-300"
                    }
                  >
                    {graded ? (
                      <CheckCircle2 className="size-5" />
                    ) : (
                      <FileText className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{a.title}</p>
                      {a.course && (
                        <Link
                          to={`/courses/${a.course.slug}`}
                          className="text-xs text-lime-300 hover:underline"
                        >
                          {a.course.title}
                        </Link>
                      )}
                      {s && (
                        <span className="text-xs text-muted-foreground">
                          · submitted {timeAgo(s.submittedAt)}
                        </span>
                      )}
                    </div>
                    {a.instructions && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {a.instructions}
                      </p>
                    )}
                    {graded && s!.feedback && (
                      <p className="mt-1 text-xs text-lime-300/90">
                        Feedback: {s!.feedback}
                      </p>
                    )}
                    <span
                      className={
                        graded
                          ? "mt-1.5 inline-block rounded-full bg-lime-400/15 px-2 py-0.5 text-[11px] font-semibold text-lime-300"
                          : s
                            ? "mt-1.5 inline-block rounded-full bg-blue-400/15 px-2 py-0.5 text-[11px] font-semibold text-blue-300"
                            : "mt-1.5 inline-block rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300"
                      }
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {s?.links?.slice(0, 2).map((l, i) => (
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
                    <Button
                      variant={s ? "outline" : "default"}
                      size="sm"
                      onClick={() => openDialog(a)}
                      className={
                        s
                          ? ""
                          : "bg-lime-400 font-semibold text-black hover:bg-lime-300"
                      }
                    >
                      {s ? (
                        <>
                          <PenLine className="size-3.5" /> View / resubmit
                        </>
                      ) : (
                        "Start submission"
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Submission dialog — legacy single-text and built per-question     */}
      {/* assignments, with real device file uploads to Convex storage.     */}
      {/* ---------------------------------------------------------------- */}
      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-card sm:max-w-lg">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">
                  {active.title}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {active.maxScore} points
                  {active.course ? ` · ${active.course.title}` : ""}
                </DialogDescription>
              </DialogHeader>

              {active.instructions && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-relaxed text-muted-foreground">
                  {active.instructions}
                </div>
              )}

              {/* Built assignment: one input per configured question. */}
              {questions.length > 0 ? (
                <div className="space-y-4">
                  {questions.map((q, i) => {
                    const a = answers[i];
                    return (
                      <div
                        key={i}
                        className="rounded-xl border border-white/10 bg-black/10 p-4"
                      >
                        <label className="mb-1.5 block text-sm font-medium">
                          Q{i + 1}. {q.question}
                          {q.maxMarks ? (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              ({q.maxMarks} marks)
                            </span>
                          ) : null}
                        </label>
                        {(q.type === "short-text" ||
                          q.type === "long-text" ||
                          q.type === "text-and-file") && (
                          <Textarea
                            value={a?.text ?? ""}
                            onChange={(e) =>
                              setAnswers((prev) => ({
                                ...prev,
                                [i]: { ...prev[i], text: e.target.value },
                              }))
                            }
                            placeholder="Write your answer…"
                            rows={q.type === "long-text" ? 5 : 2}
                            className="border-white/10 bg-black/20"
                          />
                        )}
                        {q.type === "link" && (
                          <Input
                            value={a?.url ?? ""}
                            onChange={(e) =>
                              setAnswers((prev) => ({
                                ...prev,
                                [i]: {
                                  ...prev[i],
                                  url: e.target.value,
                                },
                              }))
                            }
                            placeholder="https://your-work-link…"
                            className="border-white/10 bg-black/20"
                          />
                        )}
                        {(q.type === "file" || q.type === "text-and-file") && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Use the attachments below to attach the required file.
                          </p>
                        )}
                        {q.type === "link" && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {links.map((l, li) => (
                              <span
                                key={li}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs"
                              >
                                <Link2 className="size-3 text-lime-300" />
                                <span className="max-w-40 truncate">{l}</span>
                                <button
                                  onClick={() =>
                                    setLinks((v) => v.filter((_, j) => j !== li))
                                  }
                                  className="text-muted-foreground hover:text-rose-300"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      );
                    })}
                </div>
              ) : (
                /* Legacy assignment: single free-text answer. */
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Your submission
                  </label>
                  <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Write your answer or add notes here…"
                    rows={4}
                    className="border-white/10 bg-black/20"
                  />
                </div>
              )}

              {/* Shared links (legacy flow + reusable across questions) */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Links</label>
                <div className="flex gap-2">
                  <Input
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addLink())
                    }
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
                        <button
                          onClick={() => setLinks((v) => v.filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-rose-300"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Attachments — real device uploads into Convex storage. */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Attachments
                </label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-black/10 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300">
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Paperclip className="size-4" />
                  )}
                  {uploading ? "Uploading…" : "Attach files from your device"}
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void handleFilePicked(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                {uploadError && (
                  <p className="mt-2 rounded-xl border border-rose-400/25 bg-rose-400/8 p-2.5 text-xs text-rose-300">
                    {uploadError}
                  </p>
                )}
                {files.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {files.map((f, i) => (
                      <div
                        key={f.storageId ?? i}
                        className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Paperclip className="size-3 shrink-0 text-lime-300" />
                          <span className="truncate">{f.name}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {fmtSize(f.fileSize)}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-lime-300"
                            aria-label="Open file"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                          <button
                            onClick={() =>
                              setFiles((v) => v.filter((_, j) => j !== i))
                            }
                            className="text-muted-foreground hover:text-rose-300"
                            aria-label="Remove"
                          >
                            <X className="size-3.5" />
                          </button>
                        </span>
                      </div>
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
                disabled={submitting || uploading || !canSubmit}
                className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {active.submission ? "Resubmit assignment" : "Submit assignment"}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ArrowRight className="size-3.5 text-lime-300" />
        Submitting a new version replaces your previous submission and clears the
        old grade.
      </p>
    </div>
  );
}

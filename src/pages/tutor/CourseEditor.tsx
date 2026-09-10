import { useEffect, useMemo, useRef, useState } from "react";
// probeML
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import MuxUploader from "@mux/mux-uploader-react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CloudUpload,
  FileText,
  ListChecks,
  Loader2,
  Mic,
  PlayCircle,
  Plus,
  Rocket,
  Save,
  Sparkles,
  Trash2,
  Trophy,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/dash/PageHeader";
import { SafeImage } from "@/components/site/SafeImage";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { formatLessonDuration } from "@/lib/format";
import { ImageUploader } from "@/components/media/ImageUploader";
import { friendlyError, isBackendRejection, isValidationError } from "@/lib/errors";
import {
  MAX_CONVEX_UPLOAD_BYTES,
  uploadFileToConvex,
} from "@/lib/convex-upload";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Resource = { name: string; url: string };

type VideoSource = "youtube" | "mp4" | "vimeo" | "loom" | "mux";

type LessonDraft = {
  id?: string;
  title: string;
  order: number;
  durationMinutes: number;
  image: string; // lesson cover image (Cloudinary)
  videoUrl: string;
  videoType: VideoSource;
  muxAssetId?: string;
  muxPlaybackId?: string;
  videoStorageId?: string;
  notes: string;
  transcript: string;
  resources: Resource[];
};

type QuestionDraft = {
  type: "multiple-choice" | "true-false" | "short-answer";
  question: string;
  options: string[];
  answer: string;
  points: number;
  explanation: string;
  acceptedAnswers?: string[];
};

type QuizDraft = {
  id?: string;
  title: string;
  description: string;
  timeLimitMinutes: number;
  passingScorePercent: number;
  attemptLimit: number; // 0 = unlimited retakes
  published: boolean;
  questions: QuestionDraft[];
};

type AssignmentQuestionDraft = {
  type: "short-text" | "long-text" | "file" | "link" | "text-and-file";
  question: string;
  maxMarks: number;
  modelAnswer: string;
  markingNotes: string;
};

type AssignmentDraft = {
  id?: string;
  title: string;
  description: string;
  instructions: string;
  maxScore: number;
  files: Resource[];
  published: boolean;
  questions: AssignmentQuestionDraft[];
};

const emptyLesson = (order: number): LessonDraft => ({
  title: "",
  order,
  durationMinutes: 10,
  image: "",
  videoUrl: "",
  videoType: "youtube",
  notes: "",
  transcript: "",
  resources: [],
});

const emptyQuiz: QuizDraft = {
  title: "",
  description: "",
  timeLimitMinutes: 10,
  passingScorePercent: 70,
  attemptLimit: 0,
  published: true,
  questions: [],
};

const emptyAssignmentQuestion: AssignmentQuestionDraft = {
  type: "long-text",
  question: "",
  maxMarks: 10,
  modelAnswer: "",
  markingNotes: "",
};

const emptyAssignment: AssignmentDraft = {
  title: "",
  description: "",
  instructions: "",
  maxScore: 100,
  files: [],
  published: true,
  questions: [],
};

type LessonQuizDraft = {
  id?: string;
  lessonId: string;
  title: string;
  description: string;
  passPercent: number;
  timeLimitMinutes: number;
  published: boolean;
  questions: QuestionDraft[];
};

const emptyLessonQuiz = (lessonId: string): LessonQuizDraft => ({
  lessonId,
  title: "Lesson quiz",
  description: "Quick check after watching the video.",
  passPercent: 70,
  timeLimitMinutes: 10,
  published: false,
  questions: [],
});

type ExamDraft = {
  id?: string;
  title: string;
  description: string;
  questionCount: number;
  totalMarks: number;
  passPercent: number;
  timeLimitMinutes: number;
  published: boolean;
  questions: QuestionDraft[];
};

const emptyExam: ExamDraft = {
  title: "Final exam",
  description: "Covers the whole course.",
  questionCount: 10,
  totalMarks: 100,
  passPercent: 60,
  timeLimitMinutes: 30,
  published: false,
  questions: [],
};

// ---------------------------------------------------------------------------
// Course details form
// ---------------------------------------------------------------------------
type CourseLike = {
  title?: string;
  subtitle?: string;
  description?: string;
  longDescription?: string;
  categoryId?: string;
  roadmapId?: string;
  levelId?: string;
  difficulty?: string;
  durationHours?: number;
  image?: string | null;
  imageStorageId?: string | null;
  gradient?: string | null;
  icon?: string | null;
  prerequisites?: string[];
  skills?: string[];
  featured?: boolean;
  hasCertificate?: boolean;
};

function DetailsForm({
  courseId,
  initial,
  onSaved,
}: {
  courseId?: string;
  initial?: CourseLike | null;
  /** Called with the (possibly new) course id after a successful save. */
  onSaved?: (id: string) => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const categories = useQuery(api.public.categoriesList);
  const roadmaps = useQuery(api.public.roadmapsAll);
  const upsertCourse = useMutation(api.tutor.upsertCourse);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const resolveUploadedFile = useMutation(api.storage.resolveUploadedFile);
  const deleteFile = useMutation(api.storage.deleteFile);
  const thumbInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState(() => ({
    title: initial?.title ?? "",
    subtitle: initial?.subtitle ?? "",
    description: initial?.description ?? "",
    longDescription: initial?.longDescription ?? "",
    categoryId: initial?.categoryId ?? "",
    roadmapId: initial?.roadmapId ?? "",
    levelId: initial?.levelId ?? "",
    difficulty: initial?.difficulty ?? "beginner",
    durationHours: initial?.durationHours ?? 12,
    image: initial?.image ?? "",
    imageStorageId: initial?.imageStorageId ?? undefined,
    gradient: initial?.gradient ?? "lime",
    icon: initial?.icon ?? "🎓",
    prerequisites: (initial?.prerequisites ?? []).join(", "),
    skills: (initial?.skills ?? []).join(", "),
    featured: initial?.featured ?? false,
    hasCertificate: initial?.hasCertificate ?? false,
  }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbBusy, setThumbBusy] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const savedTimer = useRef<number | null>(null);

  const levels = useMemo(
    () => roadmaps?.find((r) => r._id === form.roadmapId)?.levels ?? [],
    [roadmaps, form.roadmapId],
  );

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  /** Save with the storage id; retries with reduced args when the deployed
   *  backend rejects fields it doesn't know yet (the thumbnail URL is already
   *  resolved client-side, so the image survives the retry). */
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!user) throw new Error("Sign in to create or edit courses.");
      const baseArgs = (withStorageId: boolean) => ({
        id: courseId ? (courseId as never) : undefined,
        title: form.title,
        subtitle: form.subtitle,
        description: form.description,
        longDescription: form.longDescription,
        categoryId: form.categoryId as never,
        tutorId: user?._id as never,
        roadmapId: form.roadmapId ? (form.roadmapId as never) : undefined,
        levelId: form.levelId ? (form.levelId as never) : undefined,
        difficulty: form.difficulty as never,
        durationHours: Number(form.durationHours) || 0,
        image: form.image || undefined,
        imageStorageId:
          withStorageId && form.imageStorageId
            ? (form.imageStorageId as never)
            : undefined,
        gradient: form.gradient,
        icon: form.icon,
        prerequisites: form.prerequisites.split(",").map((s) => s.trim()).filter(Boolean),
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        featured: form.featured,
        published: false,
        hasCertificate: form.hasCertificate,
      });
      // Old backends reject unknown fields one layer at a time — fall back
      // to the earliest contract that works instead of failing the save.
      const attempts: (() => Promise<string>)[] = [
        () => upsertCourse(baseArgs(true)) as Promise<string>,
        () => upsertCourse(baseArgs(false)) as Promise<string>,
        // Last resort: only the fields every backend version has always had.
        () =>
          upsertCourse({
            id: courseId ? (courseId as never) : undefined,
            title: form.title,
            subtitle: form.subtitle,
            description: form.description,
            longDescription: form.longDescription,
            categoryId: form.categoryId as never,
            tutorId: user?._id as never,
            difficulty: form.difficulty as never,
            durationHours: Number(form.durationHours) || 0,
            image: form.image || undefined,
            gradient: form.gradient,
            icon: form.icon,
            prerequisites: form.prerequisites.split(",").map((s) => s.trim()).filter(Boolean),
            skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
            featured: form.featured,
            published: false,
            hasCertificate: form.hasCertificate,
          }) as Promise<string>,
      ];
      let id: string | null = null;
      for (let i = 0; i < attempts.length; i++) {
        try {
          id = await attempts[i]();
          break;
        } catch (err) {
          const last = i === attempts.length - 1;
          if (last || !isBackendRejection(err)) throw err;
          if (i === 0) {
            // The resolved URL is already stored — drop the id so later
            // saves don't keep hitting the same rejection.
            setForm((f) => ({ ...f, imageStorageId: undefined }));
          }
        }
      }
      if (!id) throw new Error("Couldn't save the course — please try again.");
      setSaved(true);
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSaved(false), 2500);
      if (!courseId) navigate(`/tutor/courses/${id}?step=lessons`, { replace: true });
      else onSaved?.(id);
    } catch (err) {
      setError(friendlyError(err, "Couldn't save the course — please try again."));
    } finally {
      setSaving(false);
    }
  };

  /** Upload a thumbnail image from the device into Convex file storage. */
  const uploadThumbnail = async (file: File) => {
    setThumbError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setThumbError("Pick a JPG, PNG or WEBP image.");
      return;
    }
    if (file.size > MAX_CONVEX_UPLOAD_BYTES) {
      setThumbError(
        `That image is ${Math.round(file.size / 1024 / 1024)} MB — the limit is ${Math.round(MAX_CONVEX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
      );
      return;
    }
    setThumbBusy(true);
    try {
      const { storageId } = await uploadFileToConvex(file, () => generateUploadUrl({}));
      const url = await resolveUploadedFile({ storageId: storageId as never });
      if (!url) throw new Error("The image couldn't be stored — please try again.");
      // Free the previous uploaded thumbnail when replacing one.
      const oldId = form.imageStorageId;
      if (oldId && oldId !== storageId) {
        void deleteFile({ storageId: oldId as never }).catch(() => {});
      }
      setForm((f) => ({ ...f, image: url, imageStorageId: storageId }));
      toast.success("Thumbnail uploaded — save the course to apply it.");
    } catch (err) {
      setThumbError(
        friendlyError(err, "Upload failed — please try again."),
      );
    } finally {
      setThumbBusy(false);
      if (thumbInputRef.current) thumbInputRef.current.value = "";
    }
  };

  const removeThumbnail = () => {
    if (form.imageStorageId) {
      void deleteFile({ storageId: form.imageStorageId as never }).catch(() => {});
    }
    setForm((f) => ({ ...f, image: "", imageStorageId: undefined }));
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-card p-6">
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-2">
          <Label>Course title *</Label>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Digital Design Fundamentals" className="border-white/10 bg-black/20" />
        </div>
        <div className="space-y-2">
          <Label>Subtitle *</Label>
          <Input value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="A short, punchy hook" className="border-white/10 bg-black/20" />
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label>Short description *</Label>
          <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="One-liner shown in listings" className="border-white/10 bg-black/20" />
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label>Long description *</Label>
          <Textarea value={form.longDescription} onChange={(e) => set("longDescription", e.target.value)} rows={4} placeholder="Full course overview…" className="border-white/10 bg-black/20" />
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label>Course thumbnail</Label>
          {form.image ? (
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <SafeImage
                src={form.image}
                alt="Course thumbnail"
                className="h-20 w-32 rounded-lg border border-white/10 object-cover"
                fallback={
                  <div className="flex h-20 w-32 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-xs text-muted-foreground">
                    Preview unavailable
                  </div>
                }
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-lime-300/90">✓ Thumbnail uploaded</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Shown on course cards and the course catalog.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-white/15"
                    onClick={() => thumbInputRef.current?.click()}
                    disabled={thumbBusy}
                  >
                    {thumbBusy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CloudUpload className="size-3.5" />
                    )}
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-rose-300"
                    onClick={removeThumbnail}
                  >
                    <Trash2 className="size-3.5" /> Remove
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/15 p-5 text-center">
              <CloudUpload className="mx-auto size-6 text-lime-300" />
              <p className="mt-2 text-sm font-medium">Add a thumbnail from your device</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                JPG, PNG or WEBP · up to{" "}
                {Math.round(MAX_CONVEX_UPLOAD_BYTES / 1024 / 1024)} MB. Stored in
                ForgeX file storage — no external service needed.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 gap-1.5 border-lime-400/30 text-lime-300"
                onClick={() => thumbInputRef.current?.click()}
                disabled={thumbBusy}
              >
                {thumbBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CloudUpload className="size-3.5" />
                )}
                {thumbBusy ? "Uploading…" : "Choose image from device"}
              </Button>
              {thumbError && (
                <p className="mt-2 text-xs text-rose-300">{thumbError}</p>
              )}
            </div>
          )}
          <input
            ref={thumbInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadThumbnail(f);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>Category *</Label>
          <select
            value={form.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
            className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-lime-400/50"
          >
            <option value="">Select category…</option>
            {(categories ?? []).map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Difficulty *</Label>
          <select
            value={form.difficulty}
            onChange={(e) => set("difficulty", e.target.value)}
            className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-lime-400/50"
          >
            {["beginner", "intermediate", "advanced", "professional", "expert"].map((d) => (
              <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Roadmap (optional)</Label>
          <select
            value={form.roadmapId}
            onChange={(e) => set("roadmapId", e.target.value)}
            className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-lime-400/50"
          >
            <option value="">None</option>
            {(roadmaps ?? []).map((r) => (
              <option key={r._id} value={r._id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Roadmap level (optional)</Label>
          <select
            value={form.levelId}
            onChange={(e) => set("levelId", e.target.value)}
            className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-lime-400/50"
          >
            <option value="">None</option>
            {levels.map((l) => (
              <option key={l._id} value={l._id}>{l.title}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Duration (hours) *</Label>
          <Input type="number" min={1} value={form.durationHours} onChange={(e) => set("durationHours", e.target.value)} className="border-white/10 bg-black/20" />
        </div>
        <div className="space-y-2">
          <Label>Cover gradient</Label>
          <select
            value={form.gradient}
            onChange={(e) => set("gradient", e.target.value)}
            className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-lime-400/50"
          >
            {["lime", "violet", "cyan", "amber", "rose", "sky", "fuchsia"].map((g) => (
              <option key={g} value={g}>{g[0].toUpperCase() + g.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Icon (emoji)</Label>
          <Input value={form.icon} onChange={(e) => set("icon", e.target.value)} className="border-white/10 bg-black/20" />
        </div>
        <div className="space-y-2">
          <Label>Prerequisites (comma separated)</Label>
          <Input value={form.prerequisites} onChange={(e) => set("prerequisites", e.target.value)} placeholder="Basic computer skills, Internet access" className="border-white/10 bg-black/20" />
        </div>
        <div className="space-y-2">
          <Label>What you'll learn (comma separated)</Label>
          <Input value={form.skills} onChange={(e) => set("skills", e.target.value)} placeholder="Color theory, Typography, Branding" className="border-white/10 bg-black/20" />
        </div>
      </div>

      <label className="mt-5 flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={form.featured}
          onChange={(e) => set("featured", e.target.checked)}
          className="size-4 accent-lime-400"
        />
        Feature this course on the homepage
      </label>

      <label className="mt-3 flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={form.hasCertificate}
          onChange={(e) => set("hasCertificate", e.target.checked)}
          className="size-4 accent-lime-400"
        />
        Issue certificate on completion
      </label>

      {error && (
        <p className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/8 p-3 text-sm text-rose-300">{error}</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          onClick={() => void save()}
          disabled={saving || !form.title || !form.categoryId}
          className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <Save className="size-4" />
          )}
          {saving
            ? "Saving…"
            : saved
              ? "✓ Saved"
              : "Save & Continue →"}
        </Button>
        {!courseId && (
          <p className="text-xs text-muted-foreground">
            Courses start as drafts — you can keep building (lessons, quizzes,
            assignments) and submit for review when ready.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared question editor (per-lesson quizzes + final exam)
// ---------------------------------------------------------------------------
function QuestionEditor({
  questions,
  onChange,
}: {
  questions: QuestionDraft[];
  onChange: (q: QuestionDraft[]) => void;
}) {
  const patch = (i: number, p: Partial<QuestionDraft>) =>
    onChange(questions.map((q, j) => (j === i ? { ...q, ...p } : q)));
  const add = () =>
    onChange([
      ...questions,
      { type: "multiple-choice", question: "", options: ["", "", "", ""], answer: "", points: 1, explanation: "" },
    ]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Questions ({questions.length})</Label>
        <Button variant="outline" size="sm" className="gap-1 border-white/15" onClick={add}>
          <Plus className="size-3.5" /> Add question
        </Button>
      </div>

      {questions.map((q, i) => (
        <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-lime-300/80">Q{i + 1}</span>
            <div className="flex items-center gap-2">
              <select
                value={q.type}
                onChange={(e) => patch(i, { type: e.target.value as QuestionDraft["type"] })}
                className="h-8 rounded-lg border border-white/10 bg-black/30 px-2 text-xs outline-none"
              >
                <option value="multiple-choice">Multiple choice</option>
                <option value="true-false">True / False</option>
                <option value="short-answer">Short answer</option>
              </select>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-rose-300"
                onClick={() => onChange(questions.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
          <Input
            value={q.question}
            onChange={(e) => patch(i, { question: e.target.value })}
            placeholder="Question text…"
            className="mt-2 border-white/10 bg-black/30"
          />
          {q.type === "multiple-choice" && (
            <div className="mt-2 space-y-1.5">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex gap-1.5">
                  <Input
                    value={opt}
                    onChange={(e) =>
                      patch(i, { options: q.options.map((o, j) => (j === oi ? e.target.value : o)) })
                    }
                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                    className="border-white/10 bg-black/30"
                  />
                  {q.answer === opt ? (
                    <span className="flex items-center rounded-lg bg-lime-400/15 px-2 text-xs font-bold text-lime-300">✓</span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[11px] text-muted-foreground"
                      onClick={() => patch(i, { answer: opt })}
                    >
                      Set
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {q.type !== "multiple-choice" && (
            <Input
              value={q.answer}
              onChange={(e) => patch(i, { answer: e.target.value })}
              placeholder={q.type === "true-false" ? "True or False" : "Correct answer (used for reference)"}
              className="mt-2 border-white/10 bg-black/30"
            />
          )}
          <div className="mt-2 grid grid-cols-[90px_1fr] gap-2">
            <Input
              type="number"
              value={q.points}
              onChange={(e) => patch(i, { points: Number(e.target.value) })}
              placeholder="Pts"
              className="border-white/10 bg-black/30"
            />
            <Input
              value={q.explanation}
              onChange={(e) => patch(i, { explanation: e.target.value })}
              placeholder="Explanation shown after grading (optional)"
              className="border-white/10 bg-black/30"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lessons tab
// ---------------------------------------------------------------------------
function LessonsTab({ courseId }: { courseId: string }) {
  const lessons = useQuery(api.public.lessonsByCourse, { courseId: courseId as never });
  const upsertLesson = useMutation(api.tutor.upsertLesson);
  const deleteLesson = useMutation(api.tutor.deleteLesson);
  const createUpload = useAction(api.mux.createUpload);
  const getPlaybackId = useAction(api.mux.getPlaybackId);
  const recordVideo = useMutation(api.media.recordVideo);
  const lessonQuizzes = useQuery(api.lessonquizzes.courseLessonQuizzesFull, {
    courseId: courseId as never,
  });
  const upsertLessonQuiz = useMutation(api.lessonquizzes.upsertLessonQuiz);
  const deleteLessonQuiz = useMutation(api.lessonquizzes.deleteLessonQuiz);
  const generateQuizQuestions = useAction(api.quizgen.generateQuizQuestions);
  const transcribeVideo = useAction(api.quizgen.transcribeVideo);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const resolveUploadedFile = useMutation(api.storage.resolveUploadedFile);
  const deleteFile = useMutation(api.storage.deleteFile);
  const [draft, setDraft] = useState<LessonDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [mediaMode, setMediaMode] = useState<"image" | "video" | "url" | "file">("url");
  const [quizDraft, setQuizDraft] = useState<LessonQuizDraft | null>(null);
  const [quizSaving, setQuizSaving] = useState(false);
  const [quizGenerating, setQuizGenerating] = useState(false);
  const [genSource, setGenSource] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);

  // Mux direct-upload flow state
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploaderRef = useRef<HTMLElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // Close upload state when the dialog closes
  useEffect(() => {
    if (!draft) {
      setUploadUrl(null);
      setUploadId(null);
      setUploading(false);
      setProcessing(false);
      setUploadError(null);
    }
  }, [draft]);

  const startUpload = async () => {
    setUploadError(null);
    setProcessing(false);
    setUploading(true);
    try {
      const res = await createUpload({
        title: draft?.title || "Lesson video",
        corsOrigin: window.location.origin,
      });
      setUploadUrl(res.uploadUrl);
      setUploadId(res.uploadId);
    } catch (err) {
      setUploadError(
        friendlyError(err, "Could not start the upload."),
      );
    } finally {
      setUploading(false);
    }
  };

  // Once the upload completes, poll Mux until the asset is playable, then
  // attach the playback id to the lesson draft.
  const onUploadSuccess = async (e: Event) => {
    const detail = (e as CustomEvent).detail as { uploadId?: string } | undefined;
    const id = detail?.uploadId ?? uploadId;
    if (!id) return;
    setUploading(false);
    setProcessing(true);
    const deadline = Date.now() + 10 * 60 * 1000; // give up after 10 min
    while (Date.now() < deadline) {
      try {
        const info = await getPlaybackId({ uploadId: id });
        if (info?.playbackId) {
          setDraft((d) =>
            d
              ? {
                  ...d,
                  muxAssetId: info.assetId,
                  muxPlaybackId: info.playbackId,
                  videoUrl: "",
                  videoType: "mp4",
                }
              : d,
          );
          setProcessing(false);
          setUploadUrl(null);
          // Track the video in the media library (Videos tab) — separate from
          // Cloudinary image records.
          void recordVideo({
            uploadId: id,
            title: draft?.title || "Lesson video",
            status: "ready",
            assetId: info.assetId,
            playbackId: info.playbackId,
            courseId: courseId as never,
          });
          return;
        }
      } catch {
        // transient — keep polling
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
    setProcessing(false);
    setUploadError("Mux is still processing the video. Save the lesson and check back later, or re-open this dialog to retry.");
  };

  const open = (l?: NonNullable<typeof lessons>[number]) => {
    setMediaMode(
      l?.image ? "image" : l?.muxPlaybackId ? "video" : l?.videoStorageId ? "file" : "url",
    );
    setDraft(
      l
        ? {
            id: l._id,
            title: l.title,
            order: l.order,
            durationMinutes: l.durationMinutes,
            image: l.image ?? "",
            videoUrl: l.videoUrl ?? "",
            videoType: (l.videoType as VideoSource) ?? "youtube",
            muxAssetId: l.muxAssetId ?? undefined,
            muxPlaybackId: l.muxPlaybackId ?? undefined,
            videoStorageId: l.videoStorageId ?? undefined,
            notes: l.notes,
            transcript: l.transcript,
            resources: l.resources,
          }
        : emptyLesson((lessons?.length ?? 0) + 1),
    );
  };

  /** Switch media type, clearing the other media fields so only one is used. */
  const chooseMediaMode = (m: "image" | "video" | "url" | "file") => {
    setMediaMode(m);
    // Leaving file mode drops the storage id so a stale uploaded file can
    // never override a URL/paste saved later. Image/video modes free the file.
    const oldStorageId = draft?.videoStorageId;
    if (oldStorageId && (m === "image" || m === "video")) {
      void deleteFile({ storageId: oldStorageId as never }).catch(() => {});
    }
    setDraft((d) => {
      if (!d) return d;
      if (m === "image") {
        return {
          ...d,
          videoUrl: "",
          videoStorageId: undefined,
          muxAssetId: undefined,
          muxPlaybackId: undefined,
        };
      }
      if (m === "video") {
        return { ...d, image: "", videoUrl: "", videoStorageId: undefined };
      }
      if (m === "file") {
        return { ...d, image: "", muxAssetId: undefined, muxPlaybackId: undefined };
      }
      return {
        ...d,
        image: "",
        videoStorageId: undefined,
        muxAssetId: undefined,
        muxPlaybackId: undefined,
      };
    });
    setUploadUrl(null);
    setUploadId(null);
  };

  /** Upload a video file from the device straight into Convex file storage. */
  const uploadVideoFile = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      setUploadError("Pick a video file — MP4, WebM or MOV work best.");
      return;
    }
    if (file.size > MAX_CONVEX_UPLOAD_BYTES) {
      setUploadError(
        `That video is ${Math.round(file.size / 1024 / 1024)} MB — the limit is ${Math.round(MAX_CONVEX_UPLOAD_BYTES / 1024 / 1024)} MB. For larger files use the Mux upload or a YouTube link.`,
      );
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const { storageId } = await uploadFileToConvex(file, () => generateUploadUrl({}));
      const url = await resolveUploadedFile({ storageId: storageId as never });
      if (!url) throw new Error("The video couldn't be stored — please try again.");
      // Free the previous uploaded file when replacing one.
      const oldId = draft?.videoStorageId;
      if (oldId && oldId !== storageId) {
        void deleteFile({ storageId: oldId as never }).catch(() => {});
      }
      setDraft((d) =>
        d
          ? { ...d, videoUrl: url, videoType: "mp4", videoStorageId: storageId }
          : d,
      );
      toast.success("Video uploaded — it plays as an MP4 lesson video.");
    } catch (err) {
      setUploadError(
        friendlyError(err, "Upload failed — please try again."),
      );
    } finally {
      setUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  const saveLesson = async () => {
    if (!draft || !draft.title) return;
    setSaving(true);
    try {
      const attempt = (withStorageId: boolean) =>
        upsertLesson({
          id: draft.id ? (draft.id as never) : undefined,
          courseId: courseId as never,
          title: draft.title,
          order: draft.order,
          durationMinutes: Number(draft.durationMinutes) || 0,
          videoUrl: draft.videoUrl || undefined,
          videoType: draft.videoType,
          image: draft.image || undefined,
          muxAssetId: draft.muxAssetId,
          muxPlaybackId: draft.muxPlaybackId,
          videoStorageId:
            withStorageId && draft.videoStorageId
              ? (draft.videoStorageId as never)
              : undefined,
          notes: draft.notes,
          transcript: draft.transcript,
          resources: draft.resources.filter((r) => r.name && r.url),
        });
      try {
        await attempt(true);
      } catch (err) {
        // Stale backends reject the file id — the resolved URL is already in
        // the draft, so retrying without the id still saves the video.
        if (draft.videoStorageId && isValidationError(err)) {
          await attempt(false);
        } else {
          throw err;
        }
      }
      setDraft(null);
    } catch (err) {
      toast.error(friendlyError(err, "Could not save the lesson."));
    } finally {
      setSaving(false);
    }
  };

  const existingQuizForDraft =
    draft?.id
      ? lessonQuizzes?.find((q) => String(q.lessonId) === draft.id) ?? null
      : null;

  const openQuizEditor = (q?: NonNullable<typeof lessonQuizzes>[number]) => {
    if (!draft?.id) return;
    setGenSource(null);
    setQuizDraft(
      q
        ? {
            id: q._id,
            lessonId: String(q.lessonId),
            title: q.title,
            description: q.description,
            passPercent: q.passPercent,
            timeLimitMinutes: q.timeLimitMinutes,
            published: q.published,
            questions: q.questions.map((x) => ({
              type: x.type as QuestionDraft["type"],
              question: x.question,
              options: x.options ?? [],
              answer: x.answer ?? "",
              points: x.points ?? 1,
              explanation: x.explanation ?? "",
            })),
          }
        : emptyLessonQuiz(draft.id),
    );
  };

  const handleSaveQuiz = async () => {
    if (!quizDraft || quizDraft.questions.length === 0) {
      toast.error("Add at least one question before saving the quiz.");
      return;
    }
    setQuizSaving(true);
    try {
      await upsertLessonQuiz({
        id: quizDraft.id ? (quizDraft.id as never) : undefined,
        courseId: courseId as never,
        lessonId: quizDraft.lessonId as never,
        title: quizDraft.title || "Lesson quiz",
        description: quizDraft.description,
        passPercent: Number(quizDraft.passPercent) || 70,
        timeLimitMinutes: Number(quizDraft.timeLimitMinutes) || 10,
        questions: quizDraft.questions
          .filter((q) => q.question.trim())
          .map((q) => ({
            type: q.type,
            question: q.question,
            options: q.type === "multiple-choice" ? q.options.filter(Boolean) : undefined,
            answer: q.answer || undefined,
            points: Number(q.points) || 1,
            explanation: q.explanation || undefined,
          })),
        published: quizDraft.published,
      });
      toast.success(quizDraft.id ? "Quiz updated" : "Quiz added to the lesson");
      setQuizDraft(null);
    } catch (err) {
      toast.error(friendlyError(err, "Could not save the quiz."));
    }
    setQuizSaving(false);
  };

  const handleDeleteQuiz = async (id: string) => {
    try {
      await deleteLessonQuiz({ id: id as never });
      toast.success("Quiz removed");
    } catch (err) {
      toast.error(friendlyError(err, "Could not remove the quiz."));
    }
  };

  const handleAiGenerate = async () => {
    if (!quizDraft) return;
    setQuizGenerating(true);
    setGenSource(null);
    try {
      const res = await generateQuizQuestions({
        courseId: courseId as never,
        scope: "lesson",
        lessonId: quizDraft.lessonId as never,
        count: 5,
      });
      setQuizDraft((d) =>
        d
          ? {
              ...d,
              questions: res.questions.map((x) => ({
                type: x.type as QuestionDraft["type"],
                question: x.question,
                options: x.options ?? [],
                answer: x.answer ?? "",
                points: 1,
                explanation: x.explanation ?? "",
              })),
            }
          : d,
      );
      setGenSource(res.source);
      toast.success(`Generated ${res.questions.length} suggested questions from the ${res.source}.`);
    } catch (err) {
      toast.error(
        friendlyError(err, "Question generation failed — is AI configured?"),
      );
    }
    setQuizGenerating(false);
  };

  const handleTranscribe = async () => {
    if (!draft) return;
    const url = draft.muxPlaybackId
      ? `https://stream.mux.com/${draft.muxPlaybackId}/high.mp4`
      : draft.videoType === "mp4"
        ? draft.videoUrl
        : null;
    if (!url) {
      toast.error("Add an MP4 video (or Mux upload) first, then transcribe.");
      return;
    }
    setTranscribing(true);
    try {
      const res = await transcribeVideo({
        courseId: courseId as never,
        lessonId: (draft.id ?? "") as never,
        url,
      });
      setDraft((d) => (d ? { ...d, transcript: res.text } : d));
      toast.success("Transcript generated — review it below, then save the lesson.");
    } catch (err) {
      toast.error(friendlyError(err, "Transcription failed."));
    }
    setTranscribing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{lessons?.length ?? 0} lessons</p>
        <Button variant="outline" size="sm" className="gap-1.5 border-white/15" onClick={() => open()}>
          <Plus className="size-3.5" /> Add lesson
        </Button>
      </div>

      {(lessons ?? []).map((l) => (
        <div key={l._id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-lime-400/12 text-xs font-bold text-lime-300">
            {l.order}
          </span>
          <PlayCircle className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{l.title}</p>
            <p className="text-xs text-muted-foreground">{formatLessonDuration(l)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => open(l)}>Edit</Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-rose-300"
            onClick={() => void deleteLesson({ id: l._id as never })}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}

      {lessons !== undefined && lessons.length === 0 && (
        <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
          No lessons yet — add your first lesson: upload a video from your device,
          paste a YouTube/Vimeo/Loom link, or use the Mux upload.
        </p>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-card sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display">{draft?.id ? "Edit lesson" : "New lesson"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_72px] gap-3">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="border-white/10 bg-black/20" />
                </div>
                <div className="space-y-2">
                  <Label>Order</Label>
                  <Input type="number" value={draft.order} onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) })} className="border-white/10 bg-black/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Duration (min)</Label>
                  <Input type="number" value={draft.durationMinutes} onChange={(e) => setDraft({ ...draft, durationMinutes: Number(e.target.value) })} className="border-white/10 bg-black/20" />
                </div>
                <div className="space-y-2">
                  <Label>Media type</Label>
                  <div className="grid h-10 grid-cols-4 overflow-hidden rounded-xl border border-white/10 bg-black/20 text-xs font-medium">
                    {(["image", "video", "file", "url"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => chooseMediaMode(m)}
                        className={cn(
                          "transition-colors",
                          mediaMode === m
                            ? "bg-lime-400/15 text-lime-300"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {m === "image"
                          ? "Image"
                          : m === "video"
                            ? "Video"
                            : m === "file"
                              ? "File"
                              : "URL"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {mediaMode === "image" && (
                <div className="space-y-2">
                  <Label>Lesson image (Cloudinary)</Label>
                  <ImageUploader
                    value={draft.image || null}
                    label="Upload lesson image"
                    record={{ kind: "lesson", label: draft.title || "Lesson image" }}
                    onUploaded={(img) => setDraft({ ...draft, image: img.secureUrl })}
                    onClear={() => setDraft({ ...draft, image: "" })}
                  />
                </div>
              )}

              {mediaMode === "video" && (
                <div className="rounded-xl border border-lime-400/20 bg-lime-400/5 p-4">
                  <div className="flex items-center gap-2">
                    <Video className="size-4 text-lime-300" />
                    <p className="text-sm font-semibold">Mux-hosted video</p>
                    {draft.muxPlaybackId && (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 text-[11px] font-semibold text-lime-300">
                        <CloudUpload className="size-3" /> Uploaded
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    Upload an MP4/MOV straight from this browser. Mux transcodes and
                    streams it with adaptive bitrate — no storage hosting needed.
                  </p>

                  {draft.muxPlaybackId ? (
                    <div className="mt-3 flex items-center gap-2 text-xs text-lime-300/90">
                      <span className="truncate font-mono">playback: {draft.muxPlaybackId}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-7 gap-1 text-muted-foreground hover:text-rose-300"
                        onClick={() =>
                          setDraft({ ...draft, muxAssetId: undefined, muxPlaybackId: undefined })
                        }
                      >
                        <X className="size-3.5" /> Remove
                      </Button>
                    </div>
                  ) : uploadUrl ? (
                    <div className="mt-3">
                      <MuxUploader
                        ref={uploaderRef as never}
                        endpoint={uploadUrl}
                        onSuccess={onUploadSuccess}
                        className="w-full"
                      />
                      {processing && (
                        <p className="mt-2 flex items-center gap-2 text-xs text-lime-300">
                          <Loader2 className="size-3.5 animate-spin" /> Upload complete — Mux is
                          processing the video…
                        </p>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-1.5 border-lime-400/30 text-lime-300"
                      onClick={() => void startUpload()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CloudUpload className="size-3.5" />
                      )}
                      {uploading ? "Preparing upload…" : "Upload video with Mux"}
                    </Button>
                  )}
                  {uploadError && (
                    <p className="mt-2 rounded-lg border border-rose-400/25 bg-rose-400/8 p-2.5 text-xs text-rose-300">
                      {uploadError}
                    </p>
                  )}
                </div>
              )}

              {mediaMode === "file" && (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <CloudUpload className="size-4 text-lime-300" />
                    <p className="text-sm font-semibold">Upload video from device</p>
                    {draft.videoUrl && draft.videoStorageId && (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-lime-400/30 bg-lime-400/10 px-2 py-0.5 text-[11px] font-semibold text-lime-300">
                        <CloudUpload className="size-3" /> Uploaded
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    Pick an MP4 / WebM / MOV straight from your device (up to{" "}
                    {Math.round(MAX_CONVEX_UPLOAD_BYTES / 1024 / 1024)} MB). It is stored
                    in ForgeX file storage and plays as a normal lesson video.
                  </p>
                  {draft.videoUrl && draft.videoStorageId ? (
                    <div className="mt-3 flex items-center gap-2 text-xs text-lime-300/90">
                      <PlayCircle className="size-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate font-mono">
                        {draft.videoUrl}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 gap-1 text-muted-foreground hover:text-rose-300"
                        onClick={() => {
                          void deleteFile({
                            storageId: draft.videoStorageId as never,
                          }).catch(() => {});
                          setDraft({
                            ...draft,
                            videoUrl: "",
                            videoType: "youtube",
                            videoStorageId: undefined,
                          });
                        }}
                      >
                        <X className="size-3.5" /> Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadVideoFile(f);
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-lime-400/30 text-lime-300"
                        onClick={() => videoInputRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <CloudUpload className="size-3.5" />
                        )}
                        {uploading ? "Uploading video…" : "Choose video from device"}
                      </Button>
                      {uploading && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Uploading… keep this window open.
                        </p>
                      )}
                    </div>
                  )}
                  {uploadError && (
                    <p className="mt-2 rounded-lg border border-rose-400/25 bg-rose-400/8 p-2.5 text-xs text-rose-300">
                      {uploadError}
                    </p>
                  )}
                </div>
              )}

              {mediaMode === "url" && (
                <div className="grid grid-cols-[1fr_130px] gap-3 items-end">
                  {draft.videoType === "mux" && !draft.muxPlaybackId ? (
                    <div className="space-y-2">
                      <Label>Mux Playback ID</Label>
                      <Input
                        value={draft.muxPlaybackId ?? ""}
                        onChange={(e) => setDraft({ ...draft, muxPlaybackId: e.target.value.trim() || undefined })}
                        placeholder="abc123xyz — from your Mux dashboard"
                        className="border-white/10 bg-black/20"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Paste the Playback ID from your Mux video asset. The player will load automatically.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Video URL (YouTube / Vimeo / Loom / MP4)</Label>
                      <Input value={draft.videoUrl} onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })} placeholder="https://youtube.com/watch?v=… or https://…/lesson.mp4" className="border-white/10 bg-black/20" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Video type</Label>
                    <select value={draft.videoType} onChange={(e) => setDraft({ ...draft, videoType: e.target.value as VideoSource })} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none">
                      <option value="mux">Mux (recommended)</option>
                      <option value="youtube">YouTube</option>
                      <option value="vimeo">Vimeo</option>
                      <option value="loom">Loom</option>
                      <option value="mp4">MP4 file</option>
                    </select>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>Lesson notes</Label>
                <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={4} className="border-white/10 bg-black/20" />
              </div>
              <div className="space-y-2">
                <Label>Transcript</Label>
                <Textarea value={draft.transcript} onChange={(e) => setDraft({ ...draft, transcript: e.target.value })} rows={4} className="border-white/10 bg-black/20" />
              </div>
              <div className="space-y-2">
                <Label>Resources (name · URL per line)</Label>
                <Textarea
                  value={draft.resources.map((r) => `${r.name} | ${r.url}`).join("\n")}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      resources: e.target.value
                        .split("\n")
                        .map((line) => {
                          const [name, url] = line.split("|").map((s) => s.trim());
                          return { name: name ?? "", url: url ?? "" };
                        })
                        .filter((r) => r.name || r.url),
                    })
                  }
                  rows={3}
                  placeholder={"Design brief.pdf | https://…/brief.pdf\nTemplates.zip | https://…/templates.zip"}
                  className="border-white/10 bg-black/20"
                />
              </div>
              <Button onClick={() => void saveLesson()} disabled={saving || !draft.title} className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save lesson
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quizzes tab
// ---------------------------------------------------------------------------
function QuizzesTab({ courseId }: { courseId: string }) {
  const quizzes = useQuery(api.tutor.courseQuizzesFull, { courseId: courseId as never });
  const upsertQuiz = useMutation(api.tutor.upsertQuiz);
  const deleteQuiz = useMutation(api.tutor.deleteQuiz);
  const [draft, setDraft] = useState<QuizDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const open = (q?: NonNullable<typeof quizzes>[number]) => {
    setDraft(
      q
        ? {
            id: q._id,
            title: q.title,
            description: q.description,
            timeLimitMinutes: q.timeLimitMinutes,
            passingScorePercent: q.passingScorePercent ?? 70,
            attemptLimit: q.attemptLimit ?? 0,
            published: q.published !== false,
            questions: q.questions.map((x) => ({
              type: x.type as QuestionDraft["type"],
              question: x.question,
              options: x.options ?? [],
              answer: x.answer ?? "",
              points: x.points ?? 1,
              explanation: x.explanation ?? "",
              acceptedAnswers: (x.acceptedAnswers ?? []).map(String),
            })),
          }
        : emptyQuiz,
    );
  };

  /** Client-side mirror of the backend publish rules so tutors get instant
   *  feedback; the backend re-validates authoritatively on save. */
  const validateDraft = (): string | null => {
    if (!draft) return null;
    if (!draft.title.trim()) return "Give the quiz a title.";
    const qs = draft.questions.filter((q) => q.question.trim());
    if (qs.length === 0) return "Add at least one question with text.";
    for (const [i, q] of draft.questions.entries()) {
      if (!q.question.trim()) continue;
      if (q.type === "multiple-choice") {
        const opts = q.options.filter((o) => o.trim());
        if (opts.length < 2) return `Question ${i + 1}: needs at least two answer options.`;
        if (!q.answer.trim() || !opts.includes(q.answer))
          return `Question ${i + 1}: select the correct answer.`;
      }
      if (q.type === "true-false" && !q.answer.trim())
        return `Question ${i + 1}: choose True or False as the correct answer.`;
    }
    return null;
  };

  const saveQuiz = async () => {
    if (!draft || !draft.title) return;
    const problem = validateDraft();
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      await upsertQuiz({
        id: draft.id ? (draft.id as never) : undefined,
        courseId: courseId as never,
        title: draft.title,
        description: draft.description,
        timeLimitMinutes: Number(draft.timeLimitMinutes) || 10,
        passingScorePercent: Math.max(1, Math.min(100, Number(draft.passingScorePercent) || 70)),
        attemptLimit: Math.max(0, Math.round(Number(draft.attemptLimit) || 0)),
        published: draft.published,
        questions: draft.questions
          .filter((q) => q.question.trim())
          .map((q) => ({
            type: q.type,
            question: q.question,
            options: q.type === "multiple-choice" ? q.options.filter(Boolean) : undefined,
            answer: q.answer || undefined,
            points: Number(q.points) || 1,
            explanation: q.explanation || undefined,
            acceptedAnswers:
              q.acceptedAnswers && q.acceptedAnswers.some((a) => a.trim())
                ? q.acceptedAnswers.filter(Boolean)
                : undefined,
          })),
      });
      toast.success(draft.published ? "Quiz saved & live for students" : "Quiz saved as draft");
      setSaving(false);
      setDraft(null);
    } catch (err) {
      setSaving(false);
      toast.error(isBackendRejection(err) ? friendlyError(err) : "Couldn't save the quiz. Please try again.");
    }
  };

  const duplicateQuestion = (i: number) =>
    setDraft((d) => {
      if (!d) return d;
      const copy = { ...d.questions[i], answer: "", acceptedAnswers: [] };
      const questions = [...d.questions];
      questions.splice(i + 1, 0, copy);
      return { ...d, questions };
    });

  const moveQuestion = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const j = i + dir;
      if (j < 0 || j >= d.questions.length) return d;
      const questions = [...d.questions];
      [questions[i], questions[j]] = [questions[j], questions[i]];
      return { ...d, questions };
    });

  const patchQuestion = (i: number, patch: Partial<QuestionDraft>) =>
    setDraft((d) =>
      d
        ? { ...d, questions: d.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) }
        : d,
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{quizzes?.length ?? 0} quizzes</p>
        <Button variant="outline" size="sm" className="gap-1.5 border-white/15" onClick={() => open()}>
          <Plus className="size-3.5" /> New quiz
        </Button>
      </div>

      {(quizzes ?? []).map((qz) => (
        <div key={qz._id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lime-400/12 text-lime-300">
            <ListChecks className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{qz.title}</p>
            <p className="text-xs text-muted-foreground">
              {qz.questions.length} questions · {qz.timeLimitMinutes} min · pass {qz.passingScorePercent ?? 70}% ·{" "}
              {qz.published === false ? (
                <span className="text-amber-300">Draft</span>
              ) : (
                <span className="text-lime-300">Published</span>
              )}
              {(qz.attemptLimit ?? 0) > 0 ? ` · ${qz.attemptLimit} attempt(s)` : " · unlimited retakes"}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => open(qz)}>Edit</Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-rose-300" onClick={() => void deleteQuiz({ id: qz._id as never })}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-card sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">{draft?.id ? "Edit quiz" : "New quiz"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="border-white/10 bg-black/20" />
                </div>
                <div className="space-y-2">
                  <Label>Time (min)</Label>
                  <Input type="number" value={draft.timeLimitMinutes} onChange={(e) => setDraft({ ...draft, timeLimitMinutes: Number(e.target.value) })} className="border-white/10 bg-black/20" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="border-white/10 bg-black/20" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Questions ({draft.questions.length})</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 border-white/15"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        questions: [
                          ...draft.questions,
                          { type: "multiple-choice", question: "", options: ["", "", "", ""], answer: "", points: 1, explanation: "" },
                        ],
                      })
                    }
                  >
                    <Plus className="size-3.5" /> Add question
                  </Button>
                </div>

                {draft.questions.map((q, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-lime-300/80">Q{i + 1}</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={q.type}
                          onChange={(e) => patchQuestion(i, { type: e.target.value as QuestionDraft["type"] })}
                          className="h-8 rounded-lg border border-white/10 bg-black/30 px-2 text-xs outline-none"
                        >
                          <option value="multiple-choice">Multiple choice</option>
                          <option value="true-false">True / False</option>
                          <option value="short-answer">Short answer</option>
                        </select>
                        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-rose-300" onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, j) => j !== i) })}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    <Input
                      value={q.question}
                      onChange={(e) => patchQuestion(i, { question: e.target.value })}
                      placeholder="Question text…"
                      className="mt-2 border-white/10 bg-black/30"
                    />
                    {q.type === "multiple-choice" && (
                      <div className="mt-2 space-y-1.5">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex gap-1.5">
                            <Input
                              value={opt}
                              onChange={(e) =>
                                patchQuestion(i, {
                                  options: q.options.map((o, j) => (j === oi ? e.target.value : o)),
                                })
                              }
                              placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                              className="border-white/10 bg-black/30"
                            />
                            {q.answer === opt ? (
                              <span className="flex items-center rounded-lg bg-lime-400/15 px-2 text-xs font-bold text-lime-300">✓</span>
                            ) : (
                              <Button variant="ghost" size="sm" className="text-[11px] text-muted-foreground" onClick={() => patchQuestion(i, { answer: opt })}>
                                Set
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.type !== "multiple-choice" && (
                      <Input
                        value={q.answer}
                        onChange={(e) => patchQuestion(i, { answer: e.target.value })}
                        placeholder={q.type === "true-false" ? "True or False" : "Correct answer (used for reference)"}
                        className="mt-2 border-white/10 bg-black/30"
                      />
                    )}
                    <div className="mt-2 grid grid-cols-[90px_1fr] gap-2">
                      <Input type="number" value={q.points} onChange={(e) => patchQuestion(i, { points: Number(e.target.value) })} placeholder="Pts" className="border-white/10 bg-black/30" />
                      <Input value={q.explanation} onChange={(e) => patchQuestion(i, { explanation: e.target.value })} placeholder="Explanation shown after grading (optional)" className="border-white/10 bg-black/30" />
                    </div>
                  </div>
                ))}
              </div>

              <Button onClick={() => void saveQuiz()} disabled={saving || !draft.title} className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save quiz
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assignments tab
// ---------------------------------------------------------------------------
function AssignmentsTab({ courseId }: { courseId: string }) {
  const assignments = useQuery(api.tutor.courseAssignmentsFull, { courseId: courseId as never });
  const upsertAssignment = useMutation(api.tutor.upsertAssignment);
  const deleteAssignment = useMutation(api.tutor.deleteAssignment);
  const [draft, setDraft] = useState<AssignmentDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const open = (a?: NonNullable<typeof assignments>[number]) => {
    setDraft(
      a
        ? {
            id: a._id,
            title: a.title,
            description: a.description,
            instructions: a.instructions,
            maxScore: a.maxScore,
            files: a.files,
            published: (a as { published?: boolean }).published ?? false,
            questions: ((a as { questions?: AssignmentQuestionDraft[] }).questions ?? []).map(
              (q) => ({
                type: q.type,
                question: q.question,
                maxMarks: q.maxMarks ?? 10,
                modelAnswer: String(q.modelAnswer ?? ""),
                markingNotes: String(
                  (q as { markingInstructions?: string }).markingInstructions ??
                    (q as { markingNotes?: string }).markingNotes ??
                    "",
                ),
              }),
            ),
          }
        : emptyAssignment,
    );
  };

  const saveAssignment = async () => {
    if (!draft || !draft.title) return;
    setSaving(true);
    await upsertAssignment({
      id: draft.id ? (draft.id as never) : undefined,
      courseId: courseId as never,
      title: draft.title,
      description: draft.description,
      instructions: draft.instructions,
      maxScore: Number(draft.maxScore) || 100,
      files: draft.files.filter((f) => f.name && f.url),
      published: draft.published,
      questions: draft.questions.map((q) => ({
        type: q.type,
        question: q.question,
        maxMarks: Number(q.maxMarks) || 0,
        modelAnswer: q.modelAnswer || undefined,
        markingInstructions: q.markingNotes || undefined,
      })),
    });
    setSaving(false);
    setDraft(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{assignments?.length ?? 0} assignments</p>
        <Button variant="outline" size="sm" className="gap-1.5 border-white/15" onClick={() => open()}>
          <Plus className="size-3.5" /> New assignment
        </Button>
      </div>

      {(assignments ?? []).map((a) => (
        <div key={a._id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/12 text-amber-300">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{a.title}</p>
            <p className="text-xs text-muted-foreground">
              {a.maxScore} points
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => open(a)}>Edit</Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-rose-300" onClick={() => void deleteAssignment({ id: a._id as never })}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-card sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display">{draft?.id ? "Edit assignment" : "New assignment"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="border-white/10 bg-black/20" />
                </div>
                <div className="space-y-2">
                  <Label>Max score</Label>
                  <Input type="number" value={draft.maxScore} onChange={(e) => setDraft({ ...draft, maxScore: Number(e.target.value) })} className="border-white/10 bg-black/20" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="border-white/10 bg-black/20" />
              </div>
              <div className="space-y-2">
                <Label>Instructions</Label>
                <Textarea value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} rows={4} className="border-white/10 bg-black/20" />
              </div>
              <div className="space-y-2">
                <Label>Files (name · URL per line)</Label>
                <Textarea
                  value={draft.files.map((f) => `${f.name} | ${f.url}`).join("\n")}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      files: e.target.value
                        .split("\n")
                        .map((line) => {
                          const [name, url] = line.split("|").map((s) => s.trim());
                          return { name: name ?? "", url: url ?? "" };
                        })
                        .filter((f) => f.name || f.url),
                    })
                  }
                  rows={3}
                  placeholder={"Brief.pdf | https://…/brief.pdf"}
                  className="border-white/10 bg-black/20"
                />
              </div>
              {/* Assignment Questions Builder */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Questions ({draft.questions.length})</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 border-white/15"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        questions: [...draft.questions, { ...emptyAssignmentQuestion }],
                      })
                    }
                  >
                    <Plus className="size-3.5" /> Add question
                  </Button>
                </div>
                {draft.questions.map((q, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-amber-300/80">Q{i + 1}</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={q.type}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              questions: draft.questions.map((qq, j) =>
                                j === i ? { ...qq, type: e.target.value as AssignmentQuestionDraft["type"] } : qq,
                              ),
                            })
                          }
                          className="h-8 rounded-lg border border-white/10 bg-black/30 px-2 text-xs outline-none"
                        >
                          <option value="short-text">Short text</option>
                          <option value="long-text">Long text</option>
                          <option value="file">File upload</option>
                          <option value="link">Link</option>
                          <option value="text-and-file">Text + File</option>
                        </select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-rose-300"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              questions: draft.questions.filter((_, j) => j !== i),
                            })
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    <Input
                      value={q.question}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          questions: draft.questions.map((qq, j) =>
                            j === i ? { ...qq, question: e.target.value } : qq,
                          ),
                        })
                      }
                      placeholder="Question text..."
                      className="mt-2 border-white/10 bg-black/30"
                    />
                    <div className="mt-2 grid grid-cols-[90px_1fr] gap-2">
                      <Input
                        type="number"
                        value={q.maxMarks}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            questions: draft.questions.map((qq, j) =>
                              j === i ? { ...qq, maxMarks: Number(e.target.value) } : qq,
                            ),
                          })
                        }
                        placeholder="Max marks"
                        className="border-white/10 bg-black/30"
                      />
                      <Input
                        value={q.modelAnswer}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            questions: draft.questions.map((qq, j) =>
                              j === i ? { ...qq, modelAnswer: e.target.value } : qq,
                            ),
                          })
                        }
                        placeholder="Model answer (optional)"
                        className="border-white/10 bg-black/30"
                      />
                    </div>
                    <Input
                      value={q.markingNotes}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          questions: draft.questions.map((qq, j) =>
                            j === i ? { ...qq, markingNotes: e.target.value } : qq,
                          ),
                        })
                      }
                      placeholder="Marking instructions (optional)"
                      className="mt-2 border-white/10 bg-black/30"
                    />
                  </div>
                ))}
              </div>

              <Button onClick={() => void saveAssignment()} disabled={saving || !draft.title} className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save assignment
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review & publish tab
// ---------------------------------------------------------------------------
function ReviewTab({
  courseId,
  course,
  onPublished,
}: {
  courseId: string;
  course: NonNullable<ReturnType<typeof useQuery<typeof api.tutor.myCourses>>>[number];
  onPublished: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const lessons = useQuery(api.public.lessonsByCourse, { courseId: courseId as never });
  const quizzes = useQuery(api.tutor.courseQuizzesFull, { courseId: courseId as never });
  const assignments = useQuery(api.tutor.courseAssignmentsFull, {
    courseId: courseId as never,
  });
  const upsertCourse = useMutation(api.tutor.upsertCourse);
  const submitForReview = useMutation(api.tutor.submitCourseForReview);
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lessonCount = lessons?.length ?? 0;
  const quizCount = quizzes?.length ?? 0;
  const assignmentCount = assignments?.length ?? 0;

  // Re-save the course with the thumbnail id; retries without it when the
  // deployed backend rejects uploaded-file ids (the URL is already stored).
  const attemptSave = async (published: boolean, withStorageId: boolean) =>
    upsertCourse({
      id: courseId as never,
      title: course.title,
      subtitle: course.subtitle ?? "",
      description: course.description ?? "",
      longDescription: course.longDescription ?? "",
      categoryId: course.categoryId as never,
      tutorId: user?._id as never,
      roadmapId: course.roadmapId ? (course.roadmapId as never) : undefined,
      levelId: course.levelId ? (course.levelId as never) : undefined,
      difficulty: course.difficulty as never,
      durationHours: course.durationHours,
      image: course.image ?? undefined,
      imageStorageId:
        withStorageId && course.imageStorageId
          ? (course.imageStorageId as never)
          : undefined,
      gradient: course.gradient ?? undefined,
      icon: course.icon ?? undefined,
      prerequisites: course.prerequisites ?? [],
      skills: course.skills ?? [],
      featured: course.featured,
      published,
    });
  const saveWithRetry = async (published: boolean) => {
    try {
      await attemptSave(published, true);
    } catch (err) {
      if (course.imageStorageId && isValidationError(err)) {
        await attemptSave(published, false);
      } else {
        throw err;
      }
    }
  };

  const saveDraft = async () => {
    if (!user) return;
    setBusy("draft");
    setError(null);
    try {
      await saveWithRetry(false);
      toast.success("✓ Draft saved — you can continue editing later.");
    } catch (err) {
      setError(friendlyError(err, "Couldn't save the draft."));
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    if (!user) return;
    if (!course.title.trim() || !course.categoryId) {
      setError("Add a course title and category before publishing.");
      return;
    }
    setBusy("publish");
    setError(null);
    try {
      if (user.role === "admin") {
        await saveWithRetry(true);
        toast.success("Course published! 🎉");
      } else {
        await submitForReview({ courseId: courseId as never });
        toast.success(
          "Submitted for admin review — you'll be notified once it's approved.",
        );
      }
      onPublished();
      navigate("/tutor/courses");
    } catch (err) {
      setError(friendlyError(err, "Couldn't publish the course."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-xl font-bold">{course.title}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {course.description || "No short description yet."}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
            {course.status === "pending"
              ? "Pending review"
              : course.status === "approved" || course.published
                ? "Published"
                : "Draft"}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <PlayCircle className="size-5 text-lime-300" />
            <p className="mt-2 font-display text-2xl font-bold">{lessonCount}</p>
            <p className="text-xs text-muted-foreground">Lessons</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <ListChecks className="size-5 text-lime-300" />
            <p className="mt-2 font-display text-2xl font-bold">{quizCount}</p>
            <p className="text-xs text-muted-foreground">Quizzes</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <FileText className="size-5 text-amber-300" />
            <p className="mt-2 font-display text-2xl font-bold">{assignmentCount}</p>
            <p className="text-xs text-muted-foreground">Assignments</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <Trophy className="size-5 text-lime-300" />
            <p className="mt-2 font-display text-2xl font-bold">
              {course.durationHours}h
            </p>
            <p className="text-xs text-muted-foreground">
              {course.difficulty[0].toUpperCase() + course.difficulty.slice(1)}
            </p>
          </div>
        </div>

        {lessonCount === 0 && (
          <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/8 p-3 text-xs text-amber-300">
            This course has no lessons yet — add at least one lesson before
            publishing so students have content to learn from.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/8 p-3 text-sm text-rose-300">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          variant="outline"
          className="gap-2 border-white/15"
          disabled={busy !== null}
          onClick={() => void saveDraft()}
        >
          {busy === "draft" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save as Draft
        </Button>
        <Button
          className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          disabled={busy !== null}
          onClick={() => void publish()}
        >
          {busy === "publish" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Rocket className="size-4" />
          )}
          {user?.role === "admin" ? "Publish Course" : "Submit for Review"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const BUILDER_STEPS = [
  { key: "details", label: "Course Information", icon: Sparkles },
  { key: "lessons", label: "Lessons", icon: PlayCircle },
  { key: "quizzes", label: "Quizzes", icon: ListChecks },
  { key: "assignments", label: "Assignments", icon: FileText },
  { key: "review", label: "Review & Publish", icon: Trophy },
] as const;

type BuilderStep = (typeof BUILDER_STEPS)[number]["key"];

export default function CourseEditor() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const courseId = isNew ? undefined : id;
  const courses = useQuery(api.tutor.myCourses, {});
  const course = courses?.find((c) => c._id === courseId);

  const rawStep = searchParams.get("step") ?? "";
  const step: BuilderStep = (BUILDER_STEPS as readonly { key: string }[]).some(
    (s) => s.key === rawStep,
  )
    ? (rawStep as BuilderStep)
    : "details";
  const stepIndex = BUILDER_STEPS.findIndex((s) => s.key === step);
  const goTo = (s: BuilderStep) => setSearchParams({ step: s });

  if (courseId && courses === undefined) {
    return (
      <div className="space-y-6">
        <div className="h-24 animate-pulse rounded-2xl border border-white/8 bg-card" />
      </div>
    );
  }

  if (courseId && !course) {
    return (
      <div className="rounded-2xl border border-white/10 bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">Course not found.</p>
        <Link to="/tutor/courses" className="mt-3 inline-block text-sm text-lime-300 hover:underline">
          ← Back to my courses
        </Link>
      </div>
    );
  }

  // Content steps need a saved course — never a dead end, just a nudge.
  if (!courseId && step !== "details") {
    return (
      <div className="rounded-2xl border border-white/10 bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Save the course information first, then add lessons, quizzes and
          assignments.
        </p>
        <Button
          className="mt-4 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          onClick={() => goTo("details")}
        >
          <ArrowLeft className="size-4" /> Back to Course Information
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isNew ? "Create a course" : "Edit course"}
        description={course?.title ?? "Set up your course details first."}
        actions={
          <Link to="/tutor/courses">
            <Button variant="outline" size="sm" className="gap-1.5 border-white/15">
              <ArrowLeft className="size-3.5" /> Back to courses
            </Button>
          </Link>
        }
      />

      {/* Stepper */}
      <div className="rounded-2xl border border-white/10 bg-card p-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {BUILDER_STEPS.map((s, i) => {
            const Icon = s.icon;
            const current = i === stepIndex;
            const done = i < stepIndex;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => done && goTo(s.key)}
                disabled={!done}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                  current
                    ? "bg-lime-400/15 text-lime-300"
                    : done
                      ? "text-lime-300/70 hover:bg-white/5"
                      : "text-muted-foreground",
                )}
              >
                {done ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                      current ? "bg-lime-400 text-black" : "bg-white/10",
                    )}
                  >
                    {i + 1}
                  </span>
                )}
                <Icon className="size-3.5" />
                <span className="whitespace-nowrap">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {step === "details" && (
        <DetailsForm
          key={courseId ?? "new"}
          courseId={courseId}
          initial={course ?? null}
          onSaved={(savedId) => navigate(`/tutor/courses/${savedId}?step=lessons`)}
        />
      )}

      {courseId && course && step === "lessons" && (
        <>
          <LessonsTab courseId={courseId} />
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" className="gap-1.5 border-white/15" onClick={() => goTo("details")}>
              <ArrowLeft className="size-3.5" /> Back
            </Button>
            <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300" onClick={() => goTo("quizzes")}>
              Save & Continue <ArrowRight className="size-4" />
            </Button>
          </div>
        </>
      )}

      {courseId && course && step === "quizzes" && (
        <>
          <QuizzesTab courseId={courseId} />
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" className="gap-1.5 border-white/15" onClick={() => goTo("lessons")}>
              <ArrowLeft className="size-3.5" /> Back
            </Button>
            <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300" onClick={() => goTo("assignments")}>
              Save & Continue <ArrowRight className="size-4" />
            </Button>
          </div>
        </>
      )}

      {courseId && course && step === "assignments" && (
        <>
          <AssignmentsTab courseId={courseId} />
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" className="gap-1.5 border-white/15" onClick={() => goTo("quizzes")}>
              <ArrowLeft className="size-3.5" /> Back
            </Button>
            <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300" onClick={() => goTo("review")}>
              Save & Continue <ArrowRight className="size-4" />
            </Button>
          </div>
        </>
      )}

      {courseId && course && step === "review" && (
        <>
          <ReviewTab courseId={courseId} course={course} onPublished={() => {}} />
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" className="gap-1.5 border-white/15" onClick={() => goTo("assignments")}>
              <ArrowLeft className="size-3.5" /> Back
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

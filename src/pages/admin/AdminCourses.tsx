import { useRef, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  CloudUpload,
  ExternalLink,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Rocket,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/dash/PageHeader";
import { Avatar } from "@/components/site/Avatar";
import { ImageUploader, type UploadedImage } from "@/components/admin/ImageUploader";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { StatusChip } from "@/pages/tutor/status";
import { toast } from "sonner";
import {
  MAX_CONVEX_UPLOAD_BYTES,
  uploadFileToConvex,
} from "@/lib/convex-upload";
import { timeAgo } from "@/lib/format";
import { getAdminToken } from "@/lib/admin-session";
import { friendlyError, isValidationError } from "@/lib/errors";
import { cn } from "@/lib/utils";

type CourseRow = FunctionReturnType<typeof api.admin.allCourses>[number];

const EMPTY_DRAFT = {
  id: undefined as string | undefined,
  title: "",
  subtitle: "",
  description: "",
  longDescription: "",
  categoryId: "",
  tutorId: "",
  difficulty: "beginner" as string,
  durationHours: 5,
  image: undefined as string | undefined,
  imageStorageId: undefined as string | undefined,
  gradient: "",
  icon: "",
  prerequisites: "",
  skills: "",
  featured: false,
  published: false,
  hasCertificate: false,
};

export default function AdminCourses() {
  const token = getAdminToken() ?? "";
  const pending = useQuery(api.admin.coursesPendingReview, token ? { token } : "skip");
  const all = useQuery(api.admin.allCourses, token ? { token } : "skip");
  const categories = useQuery(api.public.categoriesList);
  const tutorOptions = useQuery(api.admin.userOptions, token ? { token, role: "tutor" } : "skip");

  const reviewCourse = useMutation(api.admin.reviewCourse);
  const adminUpsertCourse = useMutation(api.admin.adminUpsertCourse);
  const setCoursePublished = useMutation(api.admin.setCoursePublished);
  const setCourseArchived = useMutation(api.admin.setCourseArchived);
  const adminDeleteCourse = useMutation(api.admin.adminDeleteCourse);
  const adminUpsertLesson = useMutation(api.admin.adminUpsertLesson);
  const adminDeleteLesson = useMutation(api.admin.adminDeleteLesson);
  const adminUpsertQuiz = useMutation(api.admin.adminUpsertQuiz);
  const adminDeleteQuiz = useMutation(api.admin.adminDeleteQuiz);
  const adminUpsertAssignment = useMutation(api.admin.adminUpsertAssignment);
  const adminDeleteAssignment = useMutation(api.admin.adminDeleteAssignment);
  const adminGenerateUploadUrl = useMutation(api.storage.adminGenerateUploadUrl);
  const adminResolveUploadUrl = useMutation(api.storage.adminResolveUploadUrl);

  const [reviewing, setReviewing] = useState<CourseRow | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [editor, setEditor] = useState<{ course?: CourseRow; draft: typeof EMPTY_DRAFT } | null>(null);
  const [tab, setTab] = useState("details");
  const [deleting, setDeleting] = useState<CourseRow | null>(null);
  const [archiving, setArchiving] = useState<CourseRow | null>(null);

  // Lesson mini-editor
  const [lessonDraft, setLessonDraft] = useState<{
    id?: string;
    title: string;
    order: number;
    durationMinutes: number;
    image: string;
    videoType: "youtube" | "mp4" | "vimeo" | "loom" | "";
    videoUrl: string;
    notes: string;
  } | null>(null);

  // Quiz / assignment mini-editors
  const [quizDraft, setQuizDraft] = useState<{ id?: string; title: string; description: string; timeLimitMinutes: number; passingScorePercent: number; attemptLimit: number; published: boolean; questions: { type: string; question: string; options: string[]; answer: string; points: number; explanation: string; acceptedAnswers: string[] }[] } | null>(null);
  const [assignDraft, setAssignDraft] = useState<{ id?: string; title: string; description: string; instructions: string; maxScore: number; deadline: string; published: boolean; questions: { type: string; question: string; maxMarks: number; modelAnswer: string; markingInstructions: string }[]; files: { name: string; url: string }[] } | null>(null);

  // Lesson video upload from device (Convex file storage, admin token flow)
  const [lessonVideoBusy, setLessonVideoBusy] = useState(false);
  const [lessonVideoError, setLessonVideoError] = useState<string | null>(null);
  const lessonVideoInput = useRef<HTMLInputElement | null>(null);

  // Course thumbnail upload from device (Convex file storage, admin token flow)
  const [thumbBusy, setThumbBusy] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const thumbInput = useRef<HTMLInputElement | null>(null);

  const uploadCourseThumbnail = async (file: File) => {
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
    if (!token) {
      setThumbError("Admin session missing — reopen the admin panel.");
      return;
    }
    setThumbBusy(true);
    try {
      const { storageId } = await uploadFileToConvex(file, () =>
        adminGenerateUploadUrl({ token }),
      );
      const url = await adminResolveUploadUrl({
        token,
        storageId: storageId as never,
      });
      if (!url) throw new Error("The image couldn't be stored — please try again.");
      setEditor((e) =>
        e
          ? { ...e, draft: { ...e.draft, image: url, imageStorageId: storageId } }
          : e,
      );
      toast.success("Thumbnail uploaded — save the course to apply it.");
    } catch (err) {
      setThumbError(
        friendlyError(err, "Upload failed — please try again."),
      );
    } finally {
      setThumbBusy(false);
      if (thumbInput.current) thumbInput.current.value = "";
    }
  };

  const uploadLessonVideo = async (file: File) => {
    setLessonVideoError(null);
    if (!file.type.startsWith("video/")) {
      setLessonVideoError("Pick a video file — MP4, WebM or MOV work best.");
      return;
    }
    if (file.size > MAX_CONVEX_UPLOAD_BYTES) {
      setLessonVideoError(
        `That video is ${Math.round(file.size / 1024 / 1024)} MB — the limit is ${Math.round(MAX_CONVEX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
      );
      return;
    }
    if (!token) {
      setLessonVideoError("Admin session missing — reopen the admin panel.");
      return;
    }
    setLessonVideoBusy(true);
    try {
      const { storageId } = await uploadFileToConvex(file, () =>
        adminGenerateUploadUrl({ token }),
      );
      const url = await adminResolveUploadUrl({
        token,
        storageId: storageId as never,
      });
      if (!url) throw new Error("The video couldn't be stored — please try again.");
      setLessonDraft((d) => ({
        ...(d ?? {
          title: "",
          order: 1,
          durationMinutes: 10,
          image: "",
          videoType: "mp4",
          videoUrl: "",
          notes: "",
        }),
        videoUrl: url,
        videoType: "mp4",
      }));
      toast.success("Video uploaded — it plays as an MP4 lesson video.");
    } catch (err) {
      setLessonVideoError(
        friendlyError(err, "Upload failed — please try again."),
      );
    } finally {
      setLessonVideoBusy(false);
      if (lessonVideoInput.current) lessonVideoInput.current.value = "";
    }
  };

  const rows = all ?? [];
  const content = useQuery(
    api.admin.courseContentDetail,
    editor?.course && token ? { courseId: editor.course._id as never, token } : "skip",
  );
  const courseStudents = useQuery(
    api.admin.adminCourseStudents,
    editor?.course && token ? { courseId: editor.course._id as never, token } : "skip",
  );

  const openNew = () => {
    setEditor({
      draft: {
        ...EMPTY_DRAFT,
        categoryId: categories?.[0]?._id ?? "",
        tutorId: tutorOptions?.[0]?._id ?? "",
      },
    });
    setTab("details");
  };

  const openEdit = (c: CourseRow) => {
    setEditor({
      course: c,
      draft: {
        id: c._id as string,
        title: c.title,
        subtitle: c.subtitle ?? "",
        description: c.description ?? "",
        longDescription: c.longDescription ?? "",
        categoryId: (c as any).categoryId ?? categories?.[0]?._id ?? "",
        tutorId: (c as any).tutorId ?? "",
        difficulty: c.difficulty,
        durationHours: c.durationHours,
        image: c.image ?? undefined,
        imageStorageId: (c as any).imageStorageId ?? undefined,
        gradient: c.gradient ?? "",
        icon: c.icon ?? "",
        prerequisites: (c.prerequisites ?? []).join(", "),
        skills: (c.skills ?? []).join(", "),
        featured: c.featured,
        published: c.published,
        hasCertificate: (c as any).hasCertificate ?? false,
      },
    });
    setTab("details");
  };

  /** Build the course mutation args from the current editor draft. */
  const courseArgs = (published: boolean) => {
    if (!editor) throw new Error("No course open");
    return {
      id: editor.draft.id ? (editor.draft.id as never) : undefined,
      title: editor.draft.title,
      subtitle: editor.draft.subtitle,
      description: editor.draft.description,
      longDescription: editor.draft.longDescription,
      categoryId: editor.draft.categoryId as never,
      tutorId: editor.draft.tutorId as never,
      difficulty: editor.draft.difficulty as never,
      durationHours: editor.draft.durationHours,
      image: editor.draft.image || undefined,
      imageStorageId: editor.draft.imageStorageId
        ? (editor.draft.imageStorageId as never)
        : undefined,
      gradient: editor.draft.gradient || undefined,
      icon: editor.draft.icon || undefined,
      prerequisites: editor.draft.prerequisites.split(",").map((s) => s.trim()).filter(Boolean),
      skills: editor.draft.skills.split(",").map((s) => s.trim()).filter(Boolean),
      featured: editor.draft.featured,
      published,
      hasCertificate: editor.draft.hasCertificate,
      token,
    };
  };

  /** Save the course; retries without the uploaded-file id when the deployed
   *  backend rejects it (the thumbnail URL is already resolved client-side,
   *  so the image survives the retry). */
  const saveCourse = async (published: boolean) => {
    const attempt = (withStorageId: boolean) =>
      adminUpsertCourse(
        withStorageId
          ? courseArgs(published)
          : { ...courseArgs(published), imageStorageId: undefined },
      );
    try {
      return await attempt(true);
    } catch (err) {
      if (editor?.draft.imageStorageId && isValidationError(err)) {
        const newId = await attempt(false);
        // The URL is already stored — drop the id so later saves don't keep
        // hitting the same rejection.
        setEditor((e) =>
          e ? { ...e, draft: { ...e.draft, imageStorageId: undefined } } : e,
        );
        return newId;
      }
      throw err;
    }
  };

  /** Save the course and move to the next builder step without leaving. */
  const saveCourseAndContinue = async () => {
    if (!editor || !editor.draft.title.trim()) return;
    setBusy(true);
    try {
      const newId = (await saveCourse(editor.draft.published)) as string;
      setEditor((e) =>
        e
          ? {
              ...e,
              course: { ...(e.course ?? {}), _id: newId as never } as CourseRow,
            }
          : e,
      );
      setTab("lessons");
      toast.success("✓ Course saved — now add lessons.");
    } catch (err) {
      toast.error(friendlyError(err, "Couldn't save the course."));
    } finally {
      setBusy(false);
    }
  };

  /** Final step: keep the course as an unpublished draft. */
  const saveAsDraft = async () => {
    if (!editor) return;
    setBusy(true);
    try {
      await saveCourse(false);
      setEditor(null);
      toast.success("✓ Draft saved — you can continue editing later.");
    } catch (err) {
      toast.error(friendlyError(err, "Couldn't save the draft."));
    } finally {
      setBusy(false);
    }
  };

  /** Final step: publish the course. */
  const publishFromEditor = async () => {
    if (!editor || !editor.draft.title.trim()) return;
    setBusy(true);
    try {
      await saveCourse(true);
      setEditor(null);
      toast.success("Course published! 🎉");
    } catch (err) {
      toast.error(friendlyError(err, "Couldn't publish the course."));
    } finally {
      setBusy(false);
    }
  };

  const saveLesson = async () => {
    if (!editor?.course || !lessonDraft?.title.trim()) return;
    await adminUpsertLesson({
      id: lessonDraft.id ? (lessonDraft.id as never) : undefined,
      courseId: editor.course._id as never,
      title: lessonDraft.title,
      order: lessonDraft.order,
      durationMinutes: lessonDraft.durationMinutes,
      videoUrl: lessonDraft.videoUrl || undefined,
      videoType: lessonDraft.videoType || undefined,
      image: lessonDraft.image || undefined,
      notes: lessonDraft.notes,
      transcript: "",
      token,
    });
    setLessonDraft(null);
  };

  const saveQuiz = async () => {
    if (!editor?.course || !quizDraft?.title.trim()) return;
    const qs = quizDraft.questions.filter((q) => q.question.trim());
    if (qs.length === 0) { toast.error("Add at least one question."); return; }
    await adminUpsertQuiz({
      id: quizDraft.id ? (quizDraft.id as never) : undefined,
      courseId: editor.course._id as never,
      title: quizDraft.title,
      description: quizDraft.description,
      timeLimitMinutes: quizDraft.timeLimitMinutes,
      questions: qs.map((q) => ({
        type: q.type as "multiple-choice" | "true-false" | "short-answer",
        question: q.question,
        options: q.type === "multiple-choice" ? q.options.filter(Boolean) : undefined,
        answer: q.answer || undefined,
        points: Number(q.points) || 1,
        explanation: q.explanation || undefined,
        acceptedAnswers: q.acceptedAnswers && q.acceptedAnswers.some((a) => a.trim()) ? q.acceptedAnswers.filter(Boolean) : undefined,
      })),
      passingScorePercent: Math.max(1, Math.min(100, quizDraft.passingScorePercent || 70)),
      attemptLimit: Math.max(0, Math.round(quizDraft.attemptLimit || 0)),
      published: quizDraft.published,
      token,
    });
    toast.success("Quiz saved!");
    setQuizDraft(null);
  };

  const saveAssignment = async () => {
    if (!editor?.course || !assignDraft?.title.trim()) return;
    await adminUpsertAssignment({
      id: assignDraft.id ? (assignDraft.id as never) : undefined,
      courseId: editor.course._id as never,
      title: assignDraft.title,
      description: assignDraft.description,
      instructions: assignDraft.instructions,
      deadline: assignDraft.deadline ? new Date(assignDraft.deadline).getTime() : undefined,
      maxScore: assignDraft.maxScore,
      files: (assignDraft.files ?? []).filter((f) => f.name && f.url),
      questions: (assignDraft.questions ?? []).map((q) => ({
        type: q.type as "short-text" | "long-text" | "file" | "link" | "text-and-file",
        question: q.question,
        maxMarks: Number(q.maxMarks) || 0,
        modelAnswer: q.modelAnswer || undefined,
        markingInstructions: q.markingInstructions || undefined,
      })),
      published: assignDraft.published,
      token,
    });
    toast.success("Assignment saved!");
    setAssignDraft(null);
  };

  const approveOrReject = async (approve: boolean) => {
    if (!reviewing) return;
    setBusy(true);
    try {
      await reviewCourse({
        courseId: reviewing._id as never,
        approve,
        note: reviewNote || undefined,
        token,
      });
      setReviewing(null);
      setReviewNote("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Courses"
        description="Create, edit, publish, archive and delete every course on the platform."
        actions={
          <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300" onClick={openNew}>
            <Plus className="size-4" /> Add new course
          </Button>
        }
      />

      {/* Pending review */}
      <section className="rounded-2xl border border-white/10 bg-card">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="font-display text-base font-semibold">Awaiting review ({pending?.length ?? 0})</h2>
        </div>
        {(pending ?? []).length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No courses waiting for approval. 🎉</p>
        ) : (
          <div className="space-y-2 p-4">
            {(pending ?? []).map((c) => (
              <div
                key={c._id}
                className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3 text-left transition-colors hover:border-lime-400/40"
              >
                <button
                  onClick={() => {
                    setReviewing(c);
                    setReviewNote("");
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-400/12 text-amber-300">
                    <BookOpen className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      by {c.tutor?.name ?? "Unknown"} · {c.durationHours}h · {c.difficulty} · submitted {timeAgo(c.createdAt)}
                    </p>
                  </div>
                </button>
                <StatusChip status={c.status} published={c.published} />
                <Link
                  to={`/admin/courses/preview/${c._id}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-lime-300 transition-colors hover:border-lime-400/40 hover:bg-lime-400/10"
                  title="Preview exactly as students will see it"
                >
                  <Eye className="size-3.5" /> Preview & verify
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* All courses */}
      <section className="rounded-2xl border border-white/10 bg-card">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="font-display text-base font-semibold">All courses ({rows.length})</h2>
        </div>
        <div className="divide-y divide-white/5">
          {rows.map((c) => (
            <div key={c._id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <Avatar name={c.tutor?.name ?? "?"} image={c.tutor?.image} className="size-8" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {c.title}
                  {c.archived && (
                    <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      Archived
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.tutor?.name ?? "Unknown"} · {c.enrolledCount} students · {c.rating.toFixed(1)}★ · {c.durationHours}h
                </p>
              </div>
              <StatusChip status={c.status} published={c.published} />
              <div className="flex shrink-0 items-center gap-1.5">
                {c.published && (
                  <Link to={`/courses/${c.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg p-2 text-lime-300 hover:bg-lime-400/10" title="View">
                    <ExternalLink className="size-4" />
                  </Link>
                )}
                <Link
                  to={`/admin/courses/preview/${c._id}`}
                  className="inline-flex items-center gap-1 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-lime-300"
                  title="Preview & verify course"
                >
                  <Eye className="size-4" />
                </Link>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" title="Edit course" onClick={() => openEdit(c)}>
                  <Pencil className="size-4" />
                </Button>
                {c.archived ? (
                  <Button variant="ghost" size="icon" className="text-lime-300 hover:bg-lime-400/10" title="Restore" onClick={() => void setCourseArchived({ courseId: c._id as never, archived: false, token })}>
                    <ArchiveRestore className="size-4" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" className="text-amber-300 hover:bg-amber-400/10" title="Archive" onClick={() => setArchiving(c)}>
                    <Archive className="size-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-rose-300" title="Delete course" onClick={() => setDeleting(c)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Review dialog */}
      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-card sm:max-w-lg">
          {reviewing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{reviewing.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p className="rounded-xl border border-white/10 bg-black/20 p-4 leading-relaxed text-muted-foreground">
                  {reviewing.longDescription}
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <p>Difficulty: <span className="text-foreground">{reviewing.difficulty}</span></p>
                  <p>Duration: <span className="text-foreground">{reviewing.durationHours}h</span></p>
                  <p>Tutor: <span className="text-foreground">{reviewing.tutor?.name}</span></p>
                  <p>Category: <span className="text-foreground">{reviewing.category?.name}</span></p>
                </div>
                <Link
                  to={`/admin/courses/preview/${reviewing._id}`}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-lime-400/25 bg-lime-400/8 px-4 py-2.5 text-sm font-medium text-lime-300 transition-colors hover:bg-lime-400/15"
                >
                  <Eye className="size-4" /> Preview full course — see lessons, quizzes & answers
                </Link>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Note to tutor (optional)</label>
                <Textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  rows={3}
                  placeholder="Appears on the tutor's course card (especially when rejected)…"
                  className="border-white/10 bg-black/20"
                />
              </div>
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => void approveOrReject(false)} variant="outline" className="flex-1 gap-1.5 border-rose-400/30 text-rose-300 hover:bg-rose-400/10">
                  <XCircle className="size-4" /> Reject
                </Button>
                <Button disabled={busy} onClick={() => void approveOrReject(true)} className="flex-1 gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Approve & publish
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Course editor */}
      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-card sm:max-w-3xl">
          {editor && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">
                  {editor.draft.id ? `Edit — ${editor.draft.title}` : "Add new course"}
                </DialogTitle>
              </DialogHeader>
              <Tabs value={tab} onValueChange={setTab}>
                <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1.5">
                  {[
                    { key: "details", label: "1. Details" },
                    { key: "lessons", label: "2. Lessons" },
                    { key: "quizzes", label: "3. Quizzes" },
                    { key: "assignments", label: "4. Assignments" },
                    { key: "students", label: "5. Students" },
                    { key: "review", label: "6. Review & Publish" },
                  ].map((s) => {
                    const current = tab === s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() =>
                          setTab(s.key)
                        }
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                          current
                            ? "bg-lime-400/15 text-lime-300"
                            : s.key === "review" && editor?.course
                              ? "text-lime-300/70 hover:bg-white/5"
                              : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {s.key === "details" && editor?.course ? (
                          <CheckCircle2 className="mr-1 inline size-3.5 text-lime-300" />
                        ) : null}
                        {s.label}
                      </button>
                    );
                  })}
                </div>

                <TabsContent value="details" className="space-y-4 pt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Course title *</Label>
                      <Input value={editor.draft.title} onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, title: e.target.value } })} className="border-white/10 bg-black/20" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Subtitle</Label>
                      <Input value={editor.draft.subtitle} onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, subtitle: e.target.value } })} className="border-white/10 bg-black/20" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Short description</Label>
                      <Textarea value={editor.draft.description} onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, description: e.target.value } })} rows={2} className="border-white/10 bg-black/20" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Long description</Label>
                      <Textarea value={editor.draft.longDescription} onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, longDescription: e.target.value } })} rows={3} className="border-white/10 bg-black/20" />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <select value={editor.draft.categoryId} onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, categoryId: e.target.value } })} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none">
                        {(categories ?? []).map((c) => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Assign tutor</Label>
                      <select value={editor.draft.tutorId} onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, tutorId: e.target.value } })} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none">
                        {(tutorOptions ?? []).map((u) => (
                          <option key={u._id} value={u._id}>{u.name}{u.isSeed ? " (demo)" : ""}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Difficulty</Label>
                      <select value={editor.draft.difficulty} onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, difficulty: e.target.value } })} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none">
                        {["beginner", "intermediate", "advanced", "professional", "expert"].map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Duration (hours)</Label>
                      <Input type="number" min={1} value={editor.draft.durationHours} onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, durationHours: Number(e.target.value) } })} className="border-white/10 bg-black/20" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Course thumbnail</Label>
                      <ImageUploader
                        value={editor.draft.image}
                        label="Upload thumbnail"
                        onUploaded={(img: UploadedImage) => setEditor({ ...editor, draft: { ...editor.draft, image: img.secureUrl, imageStorageId: undefined } })}
                        onClear={() => setEditor({ ...editor, draft: { ...editor.draft, image: undefined, imageStorageId: undefined } })}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={thumbInput}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadCourseThumbnail(f);
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-lime-400/30 text-lime-300"
                          onClick={() => thumbInput.current?.click()}
                          disabled={thumbBusy}
                        >
                          {thumbBusy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <CloudUpload className="size-3.5" />
                          )}
                          {thumbBusy
                            ? "Uploading…"
                            : "Upload thumbnail from device"}
                        </Button>
                        {editor.draft.image && (
                          <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-xs text-lime-300/90">
                            <CheckCircle2 className="size-3.5 shrink-0" />
                            <span className="truncate">Thumbnail set</span>
                          </span>
                        )}
                        {thumbError && (
                          <p className="w-full text-xs text-rose-300">
                            {thumbError}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Prerequisites (comma-separated)</Label>
                      <Input value={editor.draft.prerequisites} onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, prerequisites: e.target.value } })} className="border-white/10 bg-black/20" />
                    </div>
                    <div className="space-y-2">
                      <Label>Skills (comma-separated)</Label>
                      <Input value={editor.draft.skills} onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, skills: e.target.value } })} className="border-white/10 bg-black/20" />
                    </div>
                    <div className="flex items-center gap-6 sm:col-span-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={editor.draft.featured} onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, featured: e.target.checked } })} className="size-4 accent-lime-400" />
                        Featured on homepage
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={editor.draft.published} onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, published: e.target.checked } })} className="size-4 accent-lime-400" />
                        Publish immediately
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={editor.draft.hasCertificate} onChange={(e) => setEditor({ ...editor, draft: { ...editor.draft, hasCertificate: e.target.checked } })} className="size-4 accent-lime-400" />
                        Issue certificate on completion
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Button variant="outline" className="gap-1.5 border-white/15" onClick={() => setEditor(null)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => void saveCourseAndContinue()}
                      disabled={busy || !editor.draft.title.trim()}
                      className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      {busy ? "Saving…" : "Save & Continue →"}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="lessons" className="space-y-3 pt-4">
                  {!editor.course ? (
                    <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-muted-foreground">
                      Save the course first, then add lessons.
                    </p>
                  ) : (
                    <>
                      {(content?.lessons ?? []).map((l, i) => (
                        <div key={l._id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-lime-400/12 text-xs font-bold text-lime-300">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{l.title}</p>
                            <p className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="size-3" /> {l.durationMinutes} min
                              {l.videoType ? ` · ${l.videoType}` : ""}
                              {l.muxPlaybackId ? " · Mux video" : ""}
                            </p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => setLessonDraft({ id: l._id as string, title: l.title, order: l.order, durationMinutes: l.durationMinutes, image: l.image ?? "", videoType: (l.videoType as any) ?? "", videoUrl: l.videoUrl ?? "", notes: l.notes })}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-rose-300" onClick={() => void adminDeleteLesson({ id: l._id as never, token })}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                      {(content?.lessons ?? []).length === 0 && (
                        <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-muted-foreground">
                          No lessons yet. Add the first one below.
                        </p>
                      )}
                      <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                        <p className="text-sm font-semibold">{lessonDraft?.id ? "Edit lesson" : "Add lesson"}</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input placeholder="Lesson title *" value={lessonDraft?.title ?? ""} onChange={(e) => setLessonDraft((d) => ({ ...(d ?? { title: "", order: (content?.lessons.length ?? 0) + 1, durationMinutes: 10, image: "", videoType: "", videoUrl: "", notes: "" }), title: e.target.value }))} className="border-white/10 bg-black/30 sm:col-span-2" />
                          <Input type="number" placeholder="Order" value={lessonDraft?.order ?? (content?.lessons.length ?? 0) + 1} onChange={(e) => setLessonDraft((d) => ({ ...(d ?? { title: "", order: 1, durationMinutes: 10, image: "", videoType: "", videoUrl: "", notes: "" }), order: Number(e.target.value) }))} className="border-white/10 bg-black/30" />
                          <Input type="number" placeholder="Minutes" value={lessonDraft?.durationMinutes ?? 10} onChange={(e) => setLessonDraft((d) => ({ ...(d ?? { title: "", order: 1, durationMinutes: 10, image: "", videoType: "", videoUrl: "", notes: "" }), durationMinutes: Number(e.target.value) }))} className="border-white/10 bg-black/30" />
                          <select value={lessonDraft?.videoType ?? ""} onChange={(e) => setLessonDraft((d) => ({ ...(d ?? { title: "", order: 1, durationMinutes: 10, image: "", videoType: "", videoUrl: "", notes: "" }), videoType: e.target.value as "youtube" | "mp4" | "vimeo" | "loom" | "" }))} className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none">
                            <option value="">No video</option>
                            <option value="youtube">YouTube</option>
                            <option value="vimeo">Vimeo</option>
                            <option value="loom">Loom</option>
                            <option value="mp4">MP4 URL</option>
                          </select>
                          <Input placeholder="Video URL (YouTube / Vimeo / Loom / MP4)" value={lessonDraft?.videoUrl ?? ""} onChange={(e) => setLessonDraft((d) => ({ ...(d ?? { title: "", order: 1, durationMinutes: 10, image: "", videoType: "", videoUrl: "", notes: "" }), videoUrl: e.target.value }))} className="border-white/10 bg-black/30" />
                          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                            <input
                              ref={lessonVideoInput}
                              type="file"
                              accept="video/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void uploadLessonVideo(f);
                              }}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5 border-lime-400/30 text-lime-300"
                              onClick={() => lessonVideoInput.current?.click()}
                              disabled={lessonVideoBusy}
                            >
                              {lessonVideoBusy ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <CloudUpload className="size-3.5" />
                              )}
                              {lessonVideoBusy
                                ? "Uploading video…"
                                : "Upload video from device"}
                            </Button>
                            {lessonDraft?.videoType === "mp4" &&
                              lessonDraft.videoUrl && (
                                <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-xs text-lime-300/90">
                                  <CheckCircle2 className="size-3.5 shrink-0" />
                                  <span className="truncate">
                                    Uploaded — video URL is set
                                  </span>
                                </span>
                              )}
                            {lessonVideoError && (
                              <p className="w-full text-xs text-rose-300">
                                {lessonVideoError}
                              </p>
                            )}
                          </div>
                          <div className="sm:col-span-2">
                            <ImageUploader
                              value={lessonDraft?.image || null}
                              label="Lesson image (Cloudinary)"
                              record={{ kind: "lesson", label: lessonDraft?.title || "Lesson image" }}
                              onUploaded={(img) => setLessonDraft((d) => ({ ...(d ?? { title: "", order: 1, durationMinutes: 10, image: "", videoType: "", videoUrl: "", notes: "" }), image: img.secureUrl }))}
                              onClear={() => setLessonDraft((d) => (d ? { ...d, image: "" } : d))}
                              compact
                            />
                          </div>
                          <Textarea placeholder="Lesson notes" rows={2} value={lessonDraft?.notes ?? ""} onChange={(e) => setLessonDraft((d) => ({ ...(d ?? { title: "", order: 1, durationMinutes: 10, image: "", videoType: "", videoUrl: "", notes: "" }), notes: e.target.value }))} className="border-white/10 bg-black/30 sm:col-span-2" />
                        </div>
                        <div className="flex gap-2">
                          {lessonDraft && (
                            <Button variant="ghost" onClick={() => setLessonDraft(null)}>Cancel</Button>
                          )}
                          <Button className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300" onClick={() => void saveLesson()}>
                            <Plus className="size-4" /> {lessonDraft?.id ? "Save lesson" : "Add lesson"}
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <Button variant="outline" className="gap-1.5 border-white/15" onClick={() => setTab("details")}>
                      <ArrowLeft className="size-3.5" /> Back
                    </Button>
                    <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300" onClick={() => setTab("quizzes")}>
                      Save & Continue <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="quizzes" className="space-y-3 pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{content?.quizzes?.length ?? 0} quizzes</p>
                    <Button variant="outline" size="sm" className="gap-1.5 border-white/15" onClick={() => setQuizDraft({ title: "", description: "", timeLimitMinutes: 10, passingScorePercent: 70, attemptLimit: 0, published: true, questions: [] })}>
                      <Plus className="size-3.5" /> New quiz
                    </Button>
                  </div>
                  {(content?.quizzes ?? []).map((q) => (
                    <div key={q._id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{q.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {q.timeLimitMinutes} min · {q.questions.length} questions · pass {q.passingScorePercent ?? 70}% · {q.published === false ? <span className="text-amber-300">Draft</span> : <span className="text-lime-300">Published</span>}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setQuizDraft({ id: q._id as string, title: q.title, description: q.description, timeLimitMinutes: q.timeLimitMinutes, passingScorePercent: q.passingScorePercent ?? 70, attemptLimit: q.attemptLimit ?? 0, published: q.published !== false, questions: (q.questions ?? []).map((x) => ({ type: x.type, question: x.question, options: x.options ?? [], answer: x.answer ?? "", points: x.points ?? 1, explanation: x.explanation ?? "", acceptedAnswers: (x.acceptedAnswers ?? []).map(String) })) })}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-rose-300" onClick={() => void adminDeleteQuiz({ id: q._id as never, token })}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {quizDraft && (
                    <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                      <p className="text-sm font-semibold">{quizDraft.id ? "Edit quiz" : "Add quiz"}</p>
                      <Input placeholder="Quiz title *" value={quizDraft.title} onChange={(e) => setQuizDraft((d) => d ? { ...d, title: e.target.value } : d)} className="border-white/10 bg-black/30" />
                      <Input placeholder="Description" value={quizDraft.description} onChange={(e) => setQuizDraft((d) => d ? { ...d, description: e.target.value } : d)} className="border-white/10 bg-black/30" />
                      <div className="grid grid-cols-3 gap-3">
                        <Input type="number" placeholder="Time (min)" value={quizDraft.timeLimitMinutes} onChange={(e) => setQuizDraft((d) => d ? { ...d, timeLimitMinutes: Number(e.target.value) } : d)} className="border-white/10 bg-black/30" />
                        <Input type="number" placeholder="Pass %" value={quizDraft.passingScorePercent} onChange={(e) => setQuizDraft((d) => d ? { ...d, passingScorePercent: Number(e.target.value) } : d)} className="border-white/10 bg-black/30" />
                        <Input type="number" placeholder="Max attempts (0=∞)" value={quizDraft.attemptLimit} onChange={(e) => setQuizDraft((d) => d ? { ...d, attemptLimit: Number(e.target.value) } : d)} className="border-white/10 bg-black/30" />
                      </div>
                      {/* Questions */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Questions ({quizDraft.questions.length})</Label>
                          <Button variant="outline" size="sm" className="gap-1 border-white/15" onClick={() => setQuizDraft((d) => d ? { ...d, questions: [...d.questions, { type: "multiple-choice", question: "", options: ["", "", "", ""], answer: "", points: 1, explanation: "", acceptedAnswers: [] }] } : d)}>
                            <Plus className="size-3.5" /> Add question
                          </Button>
                        </div>
                        {quizDraft.questions.map((q, i) => (
                          <div key={i} className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wider text-lime-300/80">Q{i + 1}</span>
                              <div className="flex items-center gap-2">
                                <select value={q.type} onChange={(e) => setQuizDraft((d) => d ? { ...d, questions: d.questions.map((qq, j) => j === i ? { ...qq, type: e.target.value } : qq) } : d)} className="h-8 rounded-lg border border-white/10 bg-black/40 px-2 text-xs outline-none">
                                  <option value="multiple-choice">Multiple choice</option>
                                  <option value="true-false">True / False</option>
                                  <option value="short-answer">Short answer</option>
                                </select>
                                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-rose-300" onClick={() => setQuizDraft((d) => d ? { ...d, questions: d.questions.filter((_, j) => j !== i) } : d)}>
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                            <Input value={q.question} onChange={(e) => setQuizDraft((d) => d ? { ...d, questions: d.questions.map((qq, j) => j === i ? { ...qq, question: e.target.value } : qq) } : d)} placeholder="Question text…" className="border-white/10 bg-black/40" />
                            {q.type === "multiple-choice" && (
                              <div className="space-y-1">
                                {q.options.map((opt, oi) => (
                                  <div key={oi} className="flex gap-1.5">
                                    <Input value={opt} onChange={(e) => setQuizDraft((d) => d ? { ...d, questions: d.questions.map((qq, j) => j === i ? { ...qq, options: qq.options.map((o, k) => k === oi ? e.target.value : o) } : qq) } : d)} placeholder={`Option ${String.fromCharCode(65 + oi)}`} className="border-white/10 bg-black/40" />
                                    {q.answer === opt ? (
                                      <span className="flex items-center rounded-lg bg-lime-400/15 px-2 text-xs font-bold text-lime-300">✓</span>
                                    ) : (
                                      <Button variant="ghost" size="sm" className="text-[11px] text-muted-foreground" onClick={() => setQuizDraft((d) => d ? { ...d, questions: d.questions.map((qq, j) => j === i ? { ...qq, answer: opt } : qq) } : d)}>Set</Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {q.type !== "multiple-choice" && (
                              <Input value={q.answer} onChange={(e) => setQuizDraft((d) => d ? { ...d, questions: d.questions.map((qq, j) => j === i ? { ...qq, answer: e.target.value } : qq) } : d)} placeholder={q.type === "true-false" ? "True or False" : "Correct answer (reference)"} className="border-white/10 bg-black/40" />
                            )}
                            <div className="grid grid-cols-[80px_1fr] gap-2">
                              <Input type="number" value={q.points} onChange={(e) => setQuizDraft((d) => d ? { ...d, questions: d.questions.map((qq, j) => j === i ? { ...qq, points: Number(e.target.value) } : qq) } : d)} placeholder="Pts" className="border-white/10 bg-black/40" />
                              <Input value={q.explanation} onChange={(e) => setQuizDraft((d) => d ? { ...d, questions: d.questions.map((qq, j) => j === i ? { ...qq, explanation: e.target.value } : qq) } : d)} placeholder="Explanation (optional)" className="border-white/10 bg-black/40" />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setQuizDraft(null)}>Cancel</Button>
                        <Button className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300" onClick={() => void saveQuiz()}>
                          <Save className="size-4" /> {quizDraft.id ? "Save quiz" : "Add quiz"}
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <Button variant="outline" className="gap-1.5 border-white/15" onClick={() => setTab("lessons")}>
                      <ArrowLeft className="size-3.5" /> Back
                    </Button>
                    <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300" onClick={() => setTab("assignments")}>
                      Save & Continue <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="students" className="space-y-3 pt-4">
                  {!editor.course ? (
                    <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-muted-foreground">
                      Save the course first, then review its students.
                    </p>
                  ) : (courseStudents ?? []).length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-muted-foreground">
                      No students have enrolled in this course yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {(courseStudents ?? []).map((s) => (
                        <div key={s._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <Avatar name={s.student?.name ?? "Student"} image={s.student?.image} className="size-9" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {s.student?.name ?? "Anonymous"}
                              {s.status === "completed" && (
                                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-lime-400/12 px-2 py-0.5 text-[10px] font-semibold text-lime-300">
                                  <CheckCircle2 className="size-3" /> Completed
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {s.email ?? "No email"} · enrolled {timeAgo(s.enrolledAt)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                              <div className="h-full rounded-full bg-lime-400" style={{ width: `${s.progress}%` }} />
                            </div>
                            <span className="w-10 text-right text-xs font-semibold text-lime-300">{s.progress}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <Button variant="outline" className="gap-1.5 border-white/15" onClick={() => setTab("assignments")}>
                      <ArrowLeft className="size-3.5" /> Back
                    </Button>
                    <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300" onClick={() => setTab("review")}>
                      Save & Continue <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="review" className="space-y-4 pt-4">
                  {!editor.course ? (
                    <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-muted-foreground">
                      Save the course first, then review and publish it.
                    </p>
                  ) : (
                    <>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-display text-lg font-bold">
                              {editor.draft.title || "Untitled course"}
                            </h3>
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {editor.draft.description || "No short description yet."}
                            </p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                            {editor.draft.published ? "Published" : "Draft"}
                          </span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div className="rounded-lg border border-white/10 bg-card p-3">
                            <p className="font-display text-2xl font-bold text-lime-300">
                              {content?.lessons.length ?? 0}
                            </p>
                            <p className="text-xs text-muted-foreground">Lessons</p>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-card p-3">
                            <p className="font-display text-2xl font-bold text-lime-300">
                              {content?.quizzes.length ?? 0}
                            </p>
                            <p className="text-xs text-muted-foreground">Quizzes</p>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-card p-3">
                            <p className="font-display text-2xl font-bold text-amber-300">
                              {content?.assignments.length ?? 0}
                            </p>
                            <p className="text-xs text-muted-foreground">Assignments</p>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-card p-3">
                            <p className="font-display text-2xl font-bold text-lime-300">
                              {editor.draft.durationHours}h
                            </p>
                            <p className="text-xs text-muted-foreground">Duration</p>
                          </div>
                        </div>
                        {(content?.lessons.length ?? 0) === 0 && (
                          <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/8 p-3 text-xs text-amber-300">
                            No lessons yet — students will have nothing to learn
                            from. Add at least one lesson before publishing.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <Button
                          variant="outline"
                          className="gap-2 border-white/15"
                          disabled={busy}
                          onClick={() => void saveAsDraft()}
                        >
                          {busy ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Save className="size-4" />
                          )}
                          Save as Draft
                        </Button>
                        <Button
                          className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                          disabled={busy || !editor.draft.title.trim()}
                          onClick={() => void publishFromEditor()}
                        >
                          {busy ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Rocket className="size-4" />
                          )}
                          Publish Course
                        </Button>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="assignments" className="space-y-3 pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{content?.assignments?.length ?? 0} assignments</p>
                    <Button variant="outline" size="sm" className="gap-1.5 border-white/15" onClick={() => setAssignDraft({ title: "", description: "", instructions: "", maxScore: 100, deadline: "", published: true, questions: [], files: [] })}>
                      <Plus className="size-3.5" /> New assignment
                    </Button>
                  </div>
                  {(content?.assignments ?? []).map((a) => (
                    <div key={a._id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.title}</p>
                        <p className="truncate text-xs text-muted-foreground">Max {a.maxScore} pts</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setAssignDraft({ id: a._id as string, title: a.title, description: a.description, instructions: a.instructions, maxScore: a.maxScore, deadline: a.deadline ? new Date(a.deadline).toISOString().slice(0, 10) : "", published: a.published ?? false, questions: ((a.questions ?? []) as { type: string; question: string; maxMarks?: number; modelAnswer?: string; markingInstructions?: string }[]).map((q) => ({ type: q.type ?? "short-text", question: q.question, maxMarks: q.maxMarks ?? 10, modelAnswer: q.modelAnswer ?? "", markingInstructions: q.markingInstructions ?? "" })), files: ((a.files ?? []) as { name: string; url: string }[]) })}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-rose-300" onClick={() => void adminDeleteAssignment({ id: a._id as never, token })}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {assignDraft && (
                    <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                      <p className="text-sm font-semibold">{assignDraft.id ? "Edit assignment" : "Add assignment"}</p>
                      <Input placeholder="Assignment title *" value={assignDraft.title} onChange={(e) => setAssignDraft((d) => d ? { ...d, title: e.target.value } : d)} className="border-white/10 bg-black/30" />
                      <Input placeholder="Description" value={assignDraft.description} onChange={(e) => setAssignDraft((d) => d ? { ...d, description: e.target.value } : d)} className="border-white/10 bg-black/30" />
                      <Textarea placeholder="Instructions" rows={2} value={assignDraft.instructions} onChange={(e) => setAssignDraft((d) => d ? { ...d, instructions: e.target.value } : d)} className="border-white/10 bg-black/30" />
                      <div className="grid grid-cols-2 gap-3">
                        <Input type="number" placeholder="Max score" value={assignDraft.maxScore} onChange={(e) => setAssignDraft((d) => d ? { ...d, maxScore: Number(e.target.value) } : d)} className="border-white/10 bg-black/30" />
                        <Input type="date" value={assignDraft.deadline} onChange={(e) => setAssignDraft((d) => d ? { ...d, deadline: e.target.value } : d)} className="border-white/10 bg-black/30" />
                      </div>
                      {/* Questions */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Questions ({assignDraft.questions.length})</Label>
                          <Button variant="outline" size="sm" className="gap-1 border-white/15" onClick={() => setAssignDraft((d) => d ? { ...d, questions: [...d.questions, { type: "short-text", question: "", maxMarks: 10, modelAnswer: "", markingInstructions: "" }] } : d)}>
                            <Plus className="size-3.5" /> Add question
                          </Button>
                        </div>
                        {assignDraft.questions.map((q, i) => (
                          <div key={i} className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wider text-amber-300/80">Q{i + 1}</span>
                              <div className="flex items-center gap-2">
                                <select value={q.type} onChange={(e) => setAssignDraft((d) => d ? { ...d, questions: d.questions.map((qq, j) => j === i ? { ...qq, type: e.target.value } : qq) } : d)} className="h-8 rounded-lg border border-white/10 bg-black/40 px-2 text-xs outline-none">
                                  <option value="short-text">Short text</option>
                                  <option value="long-text">Long text</option>
                                  <option value="file">File upload</option>
                                  <option value="link">Link</option>
                                  <option value="text-and-file">Text + File</option>
                                </select>
                                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-rose-300" onClick={() => setAssignDraft((d) => d ? { ...d, questions: d.questions.filter((_, j) => j !== i) } : d)}>
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </div>
                            <Input value={q.question} onChange={(e) => setAssignDraft((d) => d ? { ...d, questions: d.questions.map((qq, j) => j === i ? { ...qq, question: e.target.value } : qq) } : d)} placeholder="Question text…" className="border-white/10 bg-black/40" />
                            <div className="grid grid-cols-[80px_1fr] gap-2">
                              <Input type="number" value={q.maxMarks} onChange={(e) => setAssignDraft((d) => d ? { ...d, questions: d.questions.map((qq, j) => j === i ? { ...qq, maxMarks: Number(e.target.value) } : qq) } : d)} placeholder="Marks" className="border-white/10 bg-black/40" />
                              <Input value={q.modelAnswer} onChange={(e) => setAssignDraft((d) => d ? { ...d, questions: d.questions.map((qq, j) => j === i ? { ...qq, modelAnswer: e.target.value } : qq) } : d)} placeholder="Model answer (optional)" className="border-white/10 bg-black/40" />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => setAssignDraft(null)}>Cancel</Button>
                        <Button className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300" onClick={() => void saveAssignment()}>
                          <Save className="size-4" /> {assignDraft.id ? "Save assignment" : "Add assignment"}
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <Button variant="outline" className="gap-1.5 border-white/15" onClick={() => setTab("quizzes")}>
                      <ArrowLeft className="size-3.5" /> Back
                    </Button>
                    <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300" onClick={() => setTab("students")}>
                      Save & Continue <ArrowRight className="size-4" />
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Archive confirm */}
      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={`Archive "${archiving?.title}"?`}
        description="The course is hidden from students and removed from the public catalog. It is not deleted and can be restored at any time."
        confirmLabel="Archive course"
        danger={false}
        onConfirm={() => {
          if (archiving) void setCourseArchived({ courseId: archiving._id as never, archived: true, token });
          setArchiving(null);
        }}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete "${deleting?.title}"?`}
        description="This permanently removes the course and all of its lessons, quizzes, assignments, enrollments and certificates from the database. This cannot be undone."
        confirmLabel="Confirm delete"
        onConfirm={() => {
          if (deleting) void adminDeleteCourse({ courseId: deleting._id as never, token });
          setDeleting(null);
        }}
      />
    </div>
  );
}

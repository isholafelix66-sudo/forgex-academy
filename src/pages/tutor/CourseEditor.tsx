import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import MuxUploader from "@mux/mux-uploader-react";
import {
  ArrowLeft,
  CloudUpload,
  FileText,
  ListChecks,
  Loader2,
  PlayCircle,
  Plus,
  Save,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/dash/PageHeader";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { ImageUploader } from "@/components/media/ImageUploader";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Resource = { name: string; url: string };

type VideoSource = "youtube" | "mp4" | "vimeo" | "loom";

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
};

type QuizDraft = {
  id?: string;
  title: string;
  description: string;
  timeLimitMinutes: number;
  questions: QuestionDraft[];
};

type AssignmentDraft = {
  id?: string;
  title: string;
  description: string;
  instructions: string;
  deadline: string;
  maxScore: number;
  files: Resource[];
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
  questions: [],
};

const emptyAssignment: AssignmentDraft = {
  title: "",
  description: "",
  instructions: "",
  deadline: "",
  maxScore: 100,
  files: [],
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
  gradient?: string | null;
  icon?: string | null;
  prerequisites?: string[];
  skills?: string[];
  featured?: boolean;
};

function DetailsForm({ courseId, initial }: { courseId?: string; initial?: CourseLike | null }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const categories = useQuery(api.public.categoriesList);
  const roadmaps = useQuery(api.public.roadmapsAll);
  const upsertCourse = useMutation(api.tutor.upsertCourse);

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
    gradient: initial?.gradient ?? "lime",
    icon: initial?.icon ?? "🎓",
    prerequisites: (initial?.prerequisites ?? []).join(", "),
    skills: (initial?.skills ?? []).join(", "),
    featured: initial?.featured ?? false,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const levels = useMemo(
    () => roadmaps?.find((r) => r._id === form.roadmapId)?.levels ?? [],
    [roadmaps, form.roadmapId],
  );

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {    const id = (await upsertCourse({
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
      gradient: form.gradient,
      icon: form.icon,
      prerequisites: form.prerequisites.split(",").map((s) => s.trim()).filter(Boolean),
      skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      featured: form.featured,
      published: false,
    })) as string;
      if (!courseId) navigate(`/tutor/courses/${id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save course.");
    } finally {
      setSaving(false);
    }
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

      {error && (
        <p className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/8 p-3 text-sm text-rose-300">{error}</p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Button
          onClick={() => void save()}
          disabled={saving || !form.title || !form.categoryId}
          className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {courseId ? "Save changes" : "Create course"}
        </Button>
        {!courseId && (
          <p className="text-xs text-muted-foreground">
            Courses start as drafts. Submit for review once content is ready.
          </p>
        )}
      </div>
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
  const [draft, setDraft] = useState<LessonDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [mediaMode, setMediaMode] = useState<"image" | "video" | "url">("url");

  // Mux direct-upload flow state
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploaderRef = useRef<HTMLElement | null>(null);

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
        err instanceof Error ? err.message : "Could not start the upload.",
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
    setMediaMode(l?.image ? "image" : l?.muxPlaybackId ? "video" : "url");
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
            notes: l.notes,
            transcript: l.transcript,
            resources: l.resources,
          }
        : emptyLesson((lessons?.length ?? 0) + 1),
    );
  };

  /** Switch media type, clearing the other media fields so only one is used. */
  const chooseMediaMode = (m: "image" | "video" | "url") => {
    setMediaMode(m);
    setDraft((d) => {
      if (!d) return d;
      if (m === "image") {
        return { ...d, videoUrl: "", muxAssetId: undefined, muxPlaybackId: undefined };
      }
      if (m === "video") {
        return { ...d, image: "", videoUrl: "" };
      }
      return { ...d, image: "", muxAssetId: undefined, muxPlaybackId: undefined };
    });
    setUploadUrl(null);
    setUploadId(null);
  };

  const saveLesson = async () => {
    if (!draft || !draft.title) return;
    setSaving(true);
    await upsertLesson({
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
      notes: draft.notes,
      transcript: draft.transcript,
      resources: draft.resources.filter((r) => r.name && r.url),
    });
    setSaving(false);
    setDraft(null);
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
            <p className="text-xs text-muted-foreground">{l.durationMinutes} min</p>
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
          No lessons yet — add your first lesson with a YouTube or MP4 video link.
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
                  <div className="grid h-10 grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-black/20 text-xs font-medium">
                    {(["image", "video", "url"] as const).map((m) => (
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
                        {m === "image" ? "Image" : m === "video" ? "Video" : "URL"}
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

              {mediaMode === "url" && (
                <div className="grid grid-cols-[1fr_130px] gap-3 items-end">
                  <div className="space-y-2">
                    <Label>Video URL (YouTube / Vimeo / Loom / MP4)</Label>
                    <Input value={draft.videoUrl} onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value })} placeholder="https://youtube.com/watch?v=… or https://…/lesson.mp4" className="border-white/10 bg-black/20" />
                  </div>
                  <div className="space-y-2">
                    <Label>Video type</Label>
                    <select value={draft.videoType} onChange={(e) => setDraft({ ...draft, videoType: e.target.value as VideoSource })} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none">
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
            questions: q.questions.map((x) => ({
              type: x.type as QuestionDraft["type"],
              question: x.question,
              options: x.options ?? [],
              answer: x.answer ?? "",
              points: x.points ?? 1,
              explanation: x.explanation ?? "",
            })),
          }
        : emptyQuiz,
    );
  };

  const saveQuiz = async () => {
    if (!draft || !draft.title) return;
    setSaving(true);
    await upsertQuiz({
      id: draft.id ? (draft.id as never) : undefined,
      courseId: courseId as never,
      title: draft.title,
      description: draft.description,
      timeLimitMinutes: Number(draft.timeLimitMinutes) || 10,
      questions: draft.questions
        .filter((q) => q.question.trim())
        .map((q) => ({
          type: q.type,
          question: q.question,
          options: q.type === "multiple-choice" ? q.options.filter(Boolean) : undefined,
          answer: q.answer || undefined,
          points: Number(q.points) || 1,
          explanation: q.explanation || undefined,
        })),
    });
    setSaving(false);
    setDraft(null);
  };

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
              {qz.questions.length} questions · {qz.timeLimitMinutes} min
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
            deadline: a.deadline ? new Date(a.deadline).toISOString().slice(0, 16) : "",
            maxScore: a.maxScore,
            files: a.files,
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
      deadline: draft.deadline ? new Date(draft.deadline).getTime() : undefined,
      maxScore: Number(draft.maxScore) || 100,
      files: draft.files.filter((f) => f.name && f.url),
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
              {a.maxScore} points{a.deadline ? ` · due ${new Date(a.deadline).toLocaleDateString()}` : ""}
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
                <Label>Deadline</Label>
                <Input type="datetime-local" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} className="border-white/10 bg-black/20" />
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
// Page
// ---------------------------------------------------------------------------
export default function CourseEditor() {
  const { id } = useParams();
  const isNew = id === "new";
  const courseId = isNew ? undefined : id;
  const courses = useQuery(api.tutor.myCourses);
  const course = courses?.find((c) => c._id === courseId);

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

  return (
    <div className="space-y-8">
      <PageHeader
        title={isNew ? "Create a course" : "Edit course"}
        description={isNew ? "Set up the details first — content tabs unlock after saving." : course?.title}
        actions={
          <Link to="/tutor/courses">
            <Button variant="outline" size="sm" className="gap-1.5 border-white/15">
              <ArrowLeft className="size-3.5" /> Back to courses
            </Button>
          </Link>
        }
      />

      <DetailsForm key={courseId ?? "new"} courseId={courseId} initial={course ?? null} />

      {courseId && course && (
        <Tabs defaultValue="lessons">
          <TabsList className="border-white/10 bg-card">
            <TabsTrigger value="lessons" className="gap-1.5">
              <PlayCircle className="size-4" /> Lessons
            </TabsTrigger>
            <TabsTrigger value="quizzes" className="gap-1.5">
              <ListChecks className="size-4" /> Quizzes
            </TabsTrigger>
            <TabsTrigger value="assignments" className="gap-1.5">
              <FileText className="size-4" /> Assignments
            </TabsTrigger>
          </TabsList>
          <TabsContent value="lessons" className="mt-4">
            <LessonsTab courseId={courseId} />
          </TabsContent>
          <TabsContent value="quizzes" className="mt-4">
            <QuizzesTab courseId={courseId} />
          </TabsContent>
          <TabsContent value="assignments" className="mt-4">
            <AssignmentsTab courseId={courseId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

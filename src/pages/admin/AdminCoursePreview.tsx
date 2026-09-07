import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  ListChecks,
  Loader2,
  PlayCircle,
  Rocket,
  Send,
  ShieldCheck,
  Star,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/site/EmptyState";
import { CoverArt } from "@/components/site/CoverArt";
import { DifficultyBadge } from "@/components/site/DifficultyBadge";
import { Avatar } from "@/components/site/Avatar";
import { Rating } from "@/components/site/Rating";
import { StatusChip } from "@/pages/tutor/status";
import { VideoPlayer } from "@/components/learn/VideoPlayer";
import { getAdminToken } from "@/lib/admin-session";
import { formatHours } from "@/lib/format";
import { cn } from "@/lib/utils";

const QUESTION_TYPE_LABEL: Record<string, string> = {
  "multiple-choice": "Multiple choice",
  "true-false": "True / False",
  "short-answer": "Short answer",
};

export default function AdminCoursePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = getAdminToken() ?? "";

  // Malformed or empty ids resolve to the not-found state instead of
  // crashing the admin session (public pages hide unpublished courses, so
  // this dedicated preview query is the only way to see them pre-launch).
  const validId = id && /^[a-z0-9]{8,}$/.test(id) ? id : null;
  const course = useQuery(
    api.admin.coursePreview,
    token && validId ? { courseId: validId as never, token } : "skip",
  );
  const reviewCourse = useMutation(api.admin.reviewCourse);

  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  const act = async (approve: boolean) => {
    if (!course || busy) return;
    if (!approve && !note.trim()) {
      toast.error("Add a short note so the tutor knows what to change.");
      return;
    }
    setBusy(approve ? "approve" : "reject");
    try {
      await reviewCourse({
        courseId: course._id as never,
        approve,
        note: note.trim() || undefined,
        token,
      });
      toast.success(
        approve
          ? `“${course.title}” is now live on the homepage catalog.`
          : `“${course.title}” rejected — the tutor was notified.`,
      );
      navigate("/admin/courses");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the course.");
      setBusy(null);
    }
  };

  if (course === undefined) {
    return (
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-2xl border border-white/8 bg-card" />
        <div className="h-96 animate-pulse rounded-3xl border border-white/8 bg-card" />
      </div>
    );
  }

  if (!course) {
    return (
      <EmptyState
        icon={<BookOpen className="size-6" />}
        title="Course not found"
        description="This course may have been deleted or the link is invalid."
        action={
          <Link to="/admin/courses">
            <Button variant="outline">Back to courses</Button>
          </Link>
        }
      />
    );
  }

  const live = course.published && course.status === "approved";

  // Lesson with a video, defaulting to the first one — lets the admin verify
  // playback inline instead of only seeing a link out to YouTube.
  const activeLesson =
    course.lessons.find((l) => l._id === activeLessonId) ??
    course.lessons.find((l) => l.videoUrl || l.muxPlaybackId) ??
    null;

  return (
    <div className="space-y-6">
      {/* Preview banner + actions */}
      <div className="sticky top-16 z-30 -mx-1 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/8 px-4 py-3 backdrop-blur-xl sm:top-20">
        <Link
          to="/admin/courses"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-lime-300"
        >
          <ArrowLeft className="size-4" /> Courses
        </Link>
        <span className="mx-1 h-5 w-px bg-white/10" />
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300">
          <ShieldCheck className="size-3.5" />
          {live ? "Live course" : "Preview — not live on the site yet"}
        </span>
        <StatusChip status={course.status} published={course.published} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={1}
            placeholder="Note to tutor (required to reject)…"
            className="h-9 min-h-9 w-full resize-none border-white/10 bg-black/30 py-1.5 text-xs sm:w-72"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => void act(false)}
            className="gap-1.5 border-rose-400/30 text-rose-300 hover:bg-rose-400/10"
          >
            {busy === "reject" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <XCircle className="size-3.5" />
            )}
            Reject
          </Button>
          <Button
            size="sm"
            disabled={busy !== null}
            onClick={() => void act(true)}
            className="gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            {busy === "approve" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="size-3.5" />
            )}
            {live ? "Save changes" : "Approve & publish"}
          </Button>
        </div>
      </div>

      {/* Course — rendered exactly as students will see it */}
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <CoverArt
            gradient={course.gradient}
            icon={course.icon}
            image={course.image}
            slug={course.slug}
            className="h-64 w-full sm:h-80"
            iconClassName="text-7xl"
          />

          <div className="mt-8">
            <div className="flex flex-wrap items-center gap-2">
              {course.category && (
                <Badge variant="outline" className="border-lime-400/30 bg-lime-400/10 text-lime-300">
                  {course.category.name}
                </Badge>
              )}
              <DifficultyBadge difficulty={course.difficulty} />
              {course.roadmap && (
                <Badge variant="outline" className="border-white/15 text-muted-foreground">
                  <Rocket className="size-3" /> {course.roadmap.name}
                  {course.level ? ` · Level ${course.level.title}` : ""}
                </Badge>
              )}
              {!live && (
                <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-amber-300">
                  <Clock className="size-3" /> Awaiting your approval
                </Badge>
              )}
            </div>

            <h1 className="font-display mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              {course.title}
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">{course.subtitle}</p>

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
              <Rating value={course.rating} count={course.ratingCount} />
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" /> {formatHours(course.durationHours)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="size-4" /> {course.lessons.length} lessons
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-4" /> {course.enrolledCount.toLocaleString()} enrolled
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ListChecks className="size-4" /> {course.quizzes.length} quiz
                {course.quizzes.length !== 1 ? "zes" : ""}
              </span>
            </div>
          </div>

          {/* Tutor */}
          {course.tutorProfile && (
            <div className="mt-8 flex items-center gap-4 rounded-2xl border border-white/10 bg-card p-5">
              <Avatar
                name={course.tutorProfile.name}
                image={course.tutorProfile.image}
                className="size-14 text-lg"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-lime-400/80">
                  Course tutor
                </p>
                <h3 className="font-display text-base font-semibold">
                  {course.tutorProfile.name}
                </h3>
                {course.tutorProfile.headline && (
                  <p className="truncate text-sm text-muted-foreground">
                    {course.tutorProfile.headline}
                  </p>
                )}
              </div>
              <Link to={`/tutors/${course.tutorId}`}>
                <Button size="sm" variant="outline" className="shrink-0 border-white/15">
                  View profile
                </Button>
              </Link>
            </div>
          )}

          {/* About */}
          <div className="mt-10">
            <h2 className="font-display text-2xl font-bold">About this course</h2>
            <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-muted-foreground">
              {course.longDescription}
            </p>
          </div>

          {/* Skills */}
          {course.skills.length > 0 && (
            <div className="mt-10">
              <h2 className="font-display text-2xl font-bold">What you'll learn</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {course.skills.map((s) => (
                  <div key={s} className="flex items-center gap-3 rounded-xl border border-white/10 bg-card px-4 py-3">
                    <CheckCircle2 className="size-4 shrink-0 text-lime-400" />
                    <span className="text-sm">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prerequisites */}
          <div className="mt-10">
            <h2 className="font-display text-2xl font-bold">Prerequisites</h2>
            {course.prerequisites.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No prerequisites — perfect for beginners. 🎉
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {course.prerequisites.map((p) => (
                  <li key={p} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex size-5 items-center justify-center rounded-full bg-lime-400/15 text-lime-300">
                      <Check className="size-3" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Lessons */}
          <div className="mt-10">
            <h2 className="font-display text-2xl font-bold">Course content</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {course.lessons.length} lessons ·{" "}
              {course.lessons.reduce((s, l) => s + l.durationMinutes, 0)} min total
            </p>

            {/* Inline player — verify the video actually plays before approving */}
            {activeLesson && (
              <div className="mt-5">
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <PlayCircle className="size-4 text-lime-300" />
                    {activeLesson.title}
                  </p>
                  <VideoPlayer
                    url={activeLesson.videoUrl}
                    type={activeLesson.videoType}
                    title={activeLesson.title}
                    muxPlaybackId={activeLesson.muxPlaybackId}
                    image={activeLesson.image}
                  />
                </div>
              </div>
            )}

            <div className="mt-5 space-y-3">
              {course.lessons.map((l, i) => (
                <div
                  key={l._id}
                  className={cn(
                    "flex items-center gap-4 rounded-xl border bg-card px-4 py-3.5",
                    l._id === activeLesson?._id
                      ? "border-lime-400/40"
                      : "border-white/10",
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lime-400/12 text-sm font-bold text-lime-300">
                    {i + 1}
                  </span>
                  <PlayCircle className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.durationMinutes} min
                      {l.videoType ? ` · ${l.videoType}` : ""}
                      {l.muxPlaybackId ? " · Mux video" : ""}
                    </p>
                  </div>
                  {(l.videoUrl || l.muxPlaybackId) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setActiveLessonId(l._id)}
                      className="shrink-0 gap-1.5 border-lime-400/30 text-lime-300 hover:bg-lime-400/10"
                    >
                      <PlayCircle className="size-3.5" />
                      Preview
                    </Button>
                  )}
                  {l.videoUrl && (
                    <a
                      href={l.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs text-muted-foreground hover:text-lime-300 hover:underline"
                    >
                      Open
                    </a>
                  )}
                </div>
              ))}
              {course.lessons.length === 0 && (
                <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-muted-foreground">
                  No lessons yet — the tutor hasn't added content.
                </p>
              )}
            </div>
          </div>

          {/* Quizzes — full question detail so the admin can verify quality */}
          {course.quizzes.length > 0 && (
            <div className="mt-10">
              <h2 className="font-display text-2xl font-bold">Quizzes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Full question list — check accuracy and answer keys before approving.
              </p>
              <div className="mt-5 space-y-4">
                {course.quizzes.map((qz) => (
                  <div key={qz._id} className="rounded-2xl border border-white/10 bg-card p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-base font-semibold">{qz.title}</p>
                      <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {qz.timeLimitMinutes} min
                      </span>
                    </div>
                    {qz.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{qz.description}</p>
                    )}
                    <div className="mt-4 space-y-2.5">
                      {qz.questions.map((q, qi) => (
                        <div key={qi} className="rounded-xl border border-white/8 bg-black/20 p-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium">
                              <span className="mr-1.5 text-lime-300">{qi + 1}.</span>
                              {q.question}
                            </p>
                            <span className="shrink-0 rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-muted-foreground">
                              {QUESTION_TYPE_LABEL[q.type] ?? q.type}
                            </span>
                          </div>
                          {q.options && q.options.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {q.options.map((o, oi) => (
                                <span
                                  key={oi}
                                  className={cn(
                                    "rounded-full border px-2.5 py-0.5 text-xs",
                                    o === q.answer
                                      ? "border-lime-400/40 bg-lime-400/10 text-lime-300"
                                      : "border-white/10 bg-white/5 text-muted-foreground",
                                  )}
                                >
                                  {o}
                                </span>
                              ))}
                            </div>
                          )}
                          {q.answer && (
                            <p className="mt-2 text-xs text-lime-300">
                              ✓ Correct answer: <span className="font-semibold">{q.answer}</span>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assignments */}
          {course.assignments.length > 0 && (
            <div className="mt-10">
              <h2 className="font-display text-2xl font-bold">Assignments</h2>
              <div className="mt-4 space-y-3">
                {course.assignments.map((a) => (
                  <div key={a._id} className="flex items-start gap-4 rounded-xl border border-white/10 bg-card px-4 py-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/12 text-amber-300">
                      <FileText className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.maxScore} points
                      </p>
                      {a.instructions && (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground/80">
                          {a.instructions}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certificate */}
          <div className="mt-10">
            <div className="flex items-start gap-4 rounded-2xl border border-lime-400/25 bg-lime-400/8 p-6">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
                <Award className="size-6" />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold">
                  Earn a verifiable certificate
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Completing this course ships a certificate with a unique ID and
                  QR code — students verify it online.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:pt-2">
          <div className="lg:sticky lg:top-44">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-card">
              <CoverArt
                gradient={course.gradient}
                icon={course.icon}
                image={course.image}
                className="h-44 rounded-none border-0"
                iconClassName="text-6xl"
              />
              <div className="p-6">
                <div className="space-y-3 border-b border-white/10 pb-5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <StatusChip status={course.status} published={course.published} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Difficulty</span>
                    <DifficultyBadge difficulty={course.difficulty} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium">{formatHours(course.durationHours)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Lessons</span>
                    <span className="font-medium">{course.lessons.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Quizzes</span>
                    <span className="font-medium">{course.quizzes.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Assignments</span>
                    <span className="font-medium">{course.assignments.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Students</span>
                    <span className="font-medium">{course.enrolledCount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Rating</span>
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Star className="size-3.5 fill-amber-400 text-amber-400" />
                      {course.rating.toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 space-y-2.5">
                  <Button
                    disabled={busy !== null}
                    onClick={() => void act(true)}
                    className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                  >
                    {busy === "approve" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <GraduationCap className="size-4" />
                    )}
                    {live ? "Update course" : "Approve & publish"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void act(false)}
                    className="w-full gap-2 border-rose-400/30 text-rose-300 hover:bg-rose-400/10"
                  >
                    <XCircle className="size-4" /> Reject with note
                  </Button>
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  {live
                    ? "This course is visible on the public site."
                    : "Approving makes it live in the catalog & homepage immediately."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Send className="size-3.5 text-lime-300" />
        Rejecting sends the note to the tutor. Approving notifies them and the course appears for students right away.
      </p>
    </div>
  );
}

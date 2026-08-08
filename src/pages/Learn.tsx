import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  ListChecks,
  Loader2,
  PlayCircle,
  ScrollText,
  StickyNote,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VideoPlayer } from "@/components/learn/VideoPlayer";
import { QuizRunner, type QuizData } from "@/components/learn/QuizRunner";
import { DifficultyBadge } from "@/components/site/DifficultyBadge";
import { Rating } from "@/components/site/Rating";
import { Avatar } from "@/components/site/Avatar";
import { EmptyState } from "@/components/site/EmptyState";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { formatHours } from "@/lib/format";

export default function Learn() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const course = useQuery(api.public.courseBySlug, { slug: slug ?? "" });
  const enrollment = useQuery(
    api.learn.enrollmentStatus,
    isAuthenticated && course ? { courseId: course._id } : "skip",
  );
  const quizzes = useQuery(
    api.quizzes.quizzesByCourse,
    isAuthenticated && course ? { courseId: course._id } : "skip",
  );
  const attempts = useQuery(
    api.quizzes.myQuizAttempts,
    isAuthenticated && course ? { courseId: course._id } : "skip",
  );
  const completeLesson = useMutation(api.learn.completeLesson);

  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState<QuizData | null>(null);
  const [marking, setMarking] = useState(false);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);

  const lessons = course?.lessons ?? [];
  const completedIds = useMemo(
    () => new Set(enrollment?.completedLessons ?? []),
    [enrollment],
  );

  const activeLesson =
    lessons.find((l) => l._id === activeLessonId) ?? lessons[0] ?? null;

  useEffect(() => {
    if (!activeLessonId && lessons.length > 0) {
      const firstIncomplete =
        lessons.find((l) => !completedIds.has(l._id)) ?? lessons[0];
      setActiveLessonId(firstIncomplete._id);
    }
  }, [lessons, activeLessonId, completedIds]);

  if (course === undefined) {
    return (
      <div className="min-h-screen bg-background px-4 py-16">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="h-96 animate-pulse rounded-3xl border border-white/8 bg-card" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-background px-4 py-24">
        <EmptyState
          icon={<GraduationCap className="size-6" />}
          title="Course not found"
          description="This course may have been unpublished or removed."
          action={
            <Link to="/courses">
              <Button variant="outline">Browse courses</Button>
            </Link>
          }
        />
      </div>
    );
  }

  // Signed-out users land here only after enrollment → route to sign-in
  if (!isAuthenticated || !enrollment) {
    return (
      <div className="min-h-screen bg-background px-4 py-24">
        <EmptyState
          icon={<GraduationCap className="size-6" />}
          title="Enroll to start learning"
          description={`Sign in and enroll in "${course.title}" to begin.`}
          action={
            <Button
              className="bg-lime-400 font-semibold text-black hover:bg-lime-300"
              onClick={() =>
                navigate(`/auth?returnTo=${encodeURIComponent(`/learn/${course.slug}`)}`)
              }
            >
              Sign in to enroll
            </Button>
          }
        />
      </div>
    );
  }

  const handleComplete = async () => {
    if (!activeLesson) return;
    setMarking(true);
    try {
      await completeLesson({ lessonId: activeLesson._id as never });
      setJustCompleted(activeLesson._id);
      const next = lessons.find(
        (l) => l._id !== activeLesson._id && !completedIds.has(l._id),
      );
      if (next) setTimeout(() => setActiveLessonId(next._id), 350);
      setTimeout(() => setJustCompleted(null), 1600);
    } finally {
      setMarking(false);
    }
  };

  const progress = enrollment.progress ?? 0;
  const doneCount = completedIds.size;
  const isComplete = enrollment.status === "completed";

  const bestScore = (quizId: string) =>
    attempts?.filter((a) => a.quizId === quizId).sort((a, b) => b.score - a.score)[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0d0f0c]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link
            to="/dashboard/my-courses"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-lime-300"
          >
            <ArrowLeft className="size-4" /> My courses
          </Link>
          <div className="mx-2 h-5 w-px bg-white/10" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold sm:text-base">
              {course.title}
            </p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {doneCount} of {lessons.length} lessons complete
            </p>
          </div>
          <div className="flex w-36 items-center gap-2 sm:w-48">
            <Progress value={progress} className="h-1.5 bg-white/10 [&>div]:bg-lime-400" />
            <span className="shrink-0 text-xs font-bold text-lime-300">{progress}%</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[320px_1fr]">
        {/* Lesson list */}
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
            <div className="border-b border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Course content
              </p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                {lessons.reduce((s, l) => s + l.durationMinutes, 0)} min ·{" "}
                {formatHours(course.durationHours)}
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {lessons.map((l, i) => {
                const done = completedIds.has(l._id) || justCompleted === l._id;
                const active = activeLesson?._id === l._id;
                return (
                  <button
                    key={l._id}
                    onClick={() => setActiveLessonId(l._id)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors",
                      active ? "bg-lime-400/10" : "hover:bg-white/5",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        done
                          ? "bg-lime-400 text-black"
                          : active
                            ? "bg-lime-400/20 text-lime-300"
                            : "bg-white/8 text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="size-3.5" /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm font-medium",
                          active ? "text-lime-200" : "text-foreground",
                        )}
                      >
                        {l.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{l.durationMinutes} min</p>
                    </div>
                    <PlayCircle
                      className={cn(
                        "size-4 shrink-0",
                        active ? "text-lime-300" : "text-muted-foreground/50",
                      )}
                    />
                  </button>
                );
              })}
            </div>
            {isComplete && (
              <div className="flex items-center gap-2 border-t border-lime-400/25 bg-lime-400/8 px-4 py-3 text-xs font-semibold text-lime-300">
                <Award className="size-4" /> Course completed — certificate earned!
              </div>
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0">
          {activeLesson && (
            <div className="space-y-6">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <DifficultyBadge difficulty={course.difficulty} />
                  {course.category && <Badge variant="outline">{course.category.name}</Badge>}
                  <Rating value={course.rating} size="xs" />
                </div>
                <h1 className="font-display mt-3 text-2xl font-bold sm:text-3xl">
                  {activeLesson.title}
                </h1>
              </div>

              <VideoPlayer
                url={activeLesson.videoUrl}
                type={activeLesson.videoType}
                muxPlaybackId={activeLesson.muxPlaybackId}
                image={activeLesson.image}
                title={activeLesson.title}
              />

              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-card p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {completedIds.has(activeLesson._id) ? "Lesson completed ✓" : "Mark this lesson as complete"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Completing all lessons unlocks your certificate
                  </p>
                </div>
                <Button
                  onClick={handleComplete}
                  disabled={marking || completedIds.has(activeLesson._id)}
                  className={cn(
                    "shrink-0 gap-2",
                    completedIds.has(activeLesson._id)
                      ? "border border-lime-400/40 bg-lime-400/10 text-lime-300 hover:bg-lime-400/15"
                      : "bg-lime-400 font-semibold text-black hover:bg-lime-300",
                  )}
                >
                  {marking ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : completedIds.has(activeLesson._id) ? (
                    <>
                      <CheckCircle2 className="size-4" /> Completed
                    </>
                  ) : (
                    "Mark complete"
                  )}
                </Button>
              </div>

              {/* Notes */}
              {activeLesson.notes && (
                <section className="rounded-2xl border border-white/10 bg-card p-6">
                  <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                    <StickyNote className="size-4 text-lime-300" /> Lesson notes
                  </h2>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {activeLesson.notes}
                  </p>
                </section>
              )}

              {/* Resources */}
              {activeLesson.resources.length > 0 && (
                <section className="rounded-2xl border border-white/10 bg-card p-6">
                  <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                    <FileText className="size-4 text-lime-300" /> Resources
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeLesson.resources.map((r, i) => (
                      <a
                        key={i}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm transition-colors hover:border-lime-400/40 hover:text-lime-300"
                      >
                        <FileText className="size-3.5" /> {r.name}
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* Transcript */}
              {activeLesson.transcript && (
                <section className="rounded-2xl border border-white/10 bg-card p-6">
                  <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                    <ScrollText className="size-4 text-lime-300" /> Transcript
                  </h2>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {activeLesson.transcript}
                  </p>
                </section>
              )}

              {/* Next lesson */}
              {(() => {
                const idx = lessons.findIndex((l) => l._id === activeLesson._id);
                const next = lessons[idx + 1];
                return next ? (
                  <button
                    onClick={() => setActiveLessonId(next._id)}
                    className="group flex w-full items-center justify-between rounded-2xl border border-white/10 bg-card p-5 transition-colors hover:border-lime-400/40"
                  >
                    <div className="text-left">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Up next</p>
                      <p className="font-display mt-1 font-semibold group-hover:text-lime-300">
                        {next.title}
                      </p>
                    </div>
                    <ChevronRight className="size-5 text-muted-foreground group-hover:text-lime-300" />
                  </button>
                ) : null;
              })()}

              {/* Quizzes */}
              {quizzes && quizzes.length > 0 && (
                <section className="rounded-2xl border border-white/10 bg-card p-6">
                  <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                    <ListChecks className="size-4 text-lime-300" /> Quizzes
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Test your knowledge — auto-graded, 70% to pass.
                  </p>
                  <div className="mt-4 space-y-3">
                    {quizzes.map((qz) => {
                      const best = bestScore(qz._id as never);
                      return (
                        <div
                          key={qz._id}
                          className="flex items-center gap-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3.5"
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                            <ListChecks className="size-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{qz.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {qz.questions.length} questions · {qz.timeLimitMinutes} min
                              {best && (
                                <span className="text-lime-300">
                                  {" "}· best {best.score}/{best.maxScore}
                                </span>
                              )}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant={best ? "outline" : "default"}
                            className={!best ? "bg-lime-400 font-semibold text-black hover:bg-lime-300" : "border-white/15"}
                            onClick={() => setQuizOpen(qz)}
                          >
                            {best ? "Retake" : "Take quiz"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Completion banner */}
              {isComplete && (
                <section className="rounded-2xl border border-lime-400/25 bg-lime-400/8 p-6 text-center">
                  <Award className="mx-auto size-10 text-lime-300" />
                  <h2 className="font-display mt-3 text-xl font-bold">Course complete! 🎉</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your certificate is waiting with a unique ID and QR code.
                  </p>
                  <Link to="/dashboard/certificates" className="mt-4 inline-block">
                    <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                      <Award className="size-4" /> View certificate
                    </Button>
                  </Link>
                </section>
              )}
            </div>
          )}

          {!activeLesson && (
            <EmptyState
              icon={<GraduationCap className="size-6" />}
              title="No lessons yet"
              description="The tutor is still adding content to this course."
            />
          )}
        </main>
      </div>

      {/* Quiz dialog */}
      <Dialog open={!!quizOpen} onOpenChange={(o) => !o && setQuizOpen(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-card sm:max-w-2xl">
          <DialogHeader className="flex-row items-center justify-between">
            <DialogTitle className="font-display sr-only">Quiz</DialogTitle>
            <button
              onClick={() => setQuizOpen(null)}
              className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-white/10"
            >
              <X className="size-4" />
            </button>
          </DialogHeader>
          {quizOpen && (
            <QuizRunner
              key={quizOpen._id}
              quiz={{
                ...quizOpen,
                _id: quizOpen._id as string,
                courseId: quizOpen.courseId as string,
              }}
              onExit={() => setQuizOpen(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Tutor strip */}
      {course.tutor && (
        <div className="border-t border-white/8 bg-black/20">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 sm:px-6">
            <Avatar name={course.tutor.name} image={course.tutor.image} className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{course.tutor.name}</p>
              <p className="text-xs text-muted-foreground">Course tutor</p>
            </div>
            <Link to={`/tutors/${course.tutorId}`} className="text-xs text-lime-300 hover:underline">
              View profile
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

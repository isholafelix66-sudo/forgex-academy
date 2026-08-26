import { useEffect, useMemo, useRef, useState } from "react";
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
  Lock,
  MessageSquare,
  PlayCircle,
  ScrollText,
  StickyNote,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VideoPlayer } from "@/components/learn/VideoPlayer";
import { QuizRunner, type QuizData, type QuizSubmitResult } from "@/components/learn/QuizRunner";
import { DifficultyBadge } from "@/components/site/DifficultyBadge";
import { Rating } from "@/components/site/Rating";
import { Avatar } from "@/components/site/Avatar";
import { EmptyState } from "@/components/site/EmptyState";
import { useAuth } from "@/hooks/use-auth";
import { openChatWith } from "@/lib/chat-open";
import { cn } from "@/lib/utils";
import { formatHours } from "@/lib/format";
import { friendlyError } from "@/lib/errors";

const DEFAULT_WATCH_GATE = 90;

type LessonQuizPayload = {
  _id: string;
  courseId: string;
  title: string;
  description: string;
  passPercent: number;
  timeLimitMinutes: number;
  questions: QuizData["questions"];
  kind: "lesson" | "legacy";
};

export default function Learn() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const course = useQuery(api.public.courseBySlug, { slug: slug ?? "" });
  const enrollment = useQuery(
    api.learn.enrollmentStatus,
    isAuthenticated && course ? { courseId: course._id } : "skip",
  );
  const states = useQuery(
    api.learn.lessonStates,
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
  const watchHeartbeat = useMutation(api.lms.watchHeartbeat);
  const saveWatchPosition = useMutation(api.lms.saveWatchPosition);
  const submitLessonQuiz = useMutation(api.lessonquizzes.submitLessonQuiz);
  const submitFinalExam = useMutation(api.exams.submitFinalExam);

  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState<LessonQuizPayload | null>(null);
  const [examOpen, setExamOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const lastReportRef = useRef<{ t: number; pct: number }>({ t: 0, pct: 0 });
  const videoPosRef = useRef<{ currentTime: number; duration: number }>({ currentTime: 0, duration: 0 });

  const lessonStates = states?.lessons ?? [];
  const activeState =
    lessonStates.find((l) => l.lesson._id === activeLessonId) ?? lessonStates[0] ?? null;
  const activeLesson = activeState?.lesson ?? null;
  const completedIds = useMemo(
    () => new Set(states?.lessons.filter((l) => l.completed).map((l) => l.lesson._id) ?? []),
    [states],
  );

  useEffect(() => {
    if (!activeLessonId && lessonStates.length > 0) {
      const firstIncomplete =
        lessonStates.find((l) => !l.completed && !l.locked) ?? lessonStates[0];
      setActiveLessonId(firstIncomplete.lesson._id);
    }
  }, [lessonStates, activeLessonId]);

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

  const trackable =
    !!activeLesson?.muxPlaybackId ||
    activeLesson?.videoType === "youtube" ||
    activeLesson?.videoType === "mp4" ||
    activeLesson?.videoType === "vimeo" ||
    activeLesson?.videoType === "mux";
  const watchPercent = activeState?.watchedPercent ?? 0;
  const watchGate = states?.completionRequirements?.videoWatchPercent ?? DEFAULT_WATCH_GATE;
  const watchOk = !trackable || watchPercent >= watchGate;

  const handleHeartbeat = (currentTime: number, duration: number, playing: boolean) => {
    if (!activeLesson) return;
    // Track position for resume
    videoPosRef.current = { currentTime, duration };
    void watchHeartbeat({
      lessonId: activeLesson._id as never,
      positionSeconds: currentTime,
      durationSeconds: duration,
      playing,
    });
  };

  const handlePause = (currentTime: number, duration: number) => {
    if (!activeLesson) return;
    videoPosRef.current = { currentTime, duration };
    void saveWatchPosition({
      lessonId: activeLesson._id as never,
      positionSeconds: currentTime,
      durationSeconds: duration,
    });
  };

  const handleSavePosition = (positionSeconds: number, durationSeconds: number) => {
    if (!activeLesson) return;
    videoPosRef.current = { currentTime: positionSeconds, duration: durationSeconds };
    void saveWatchPosition({
      lessonId: activeLesson._id as never,
      positionSeconds,
      durationSeconds,
    });
  };

  // Save resume position when leaving the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!activeLesson) return;
      const { currentTime, duration } = videoPosRef.current;
      if (duration > 0) {
        void saveWatchPosition({
          lessonId: activeLesson._id as never,
          positionSeconds: currentTime,
          durationSeconds: duration,
        });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeLesson]);

  const advanceAfterComplete = (lessonId: string) => {
    setJustCompleted(lessonId);
    const next = lessonStates.find(
      (l) => l.lesson._id !== lessonId && !l.completed && !l.locked,
    );
    if (next) setTimeout(() => setActiveLessonId(next.lesson._id), 350);
    setTimeout(() => setJustCompleted(null), 1600);
  };

  const handleComplete = async () => {
    if (!activeLesson) return;
    setMarking(true);
    try {
      await completeLesson({ lessonId: activeLesson._id as never });
      advanceAfterComplete(activeLesson._id);
    } catch (err) {
      toast.error(friendlyError(err, "Could not complete the lesson."));
    } finally {
      setMarking(false);
    }
  };

  const handleQuizResult = (lessonId: string, result: QuizSubmitResult) => {
    if (result.passed) advanceAfterComplete(lessonId);
  };

  const selectLesson = (state: (typeof lessonStates)[number]) => {
    if (state.locked) {
      toast.info("Complete the previous lesson first to unlock this one.");
      return;
    }
    setActiveLessonId(state.lesson._id);
  };

  const progress = enrollment.progress ?? 0;
  const doneCount = completedIds.size;
  const isComplete = enrollment.status === "completed";
  const exam = states?.exam ?? null;
  const bestExam = exam
    ? [...exam.attempts].sort((a, b) => b.percent - a.percent)[0] ?? null
    : null;

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
              {doneCount} of {lessonStates.length} lessons complete
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
                {lessonStates.reduce((s, l) => s + l.lesson.durationMinutes, 0)} min ·{" "}
                {formatHours(course.durationHours)}
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {lessonStates.map((st, i) => {
                const l = st.lesson;
                const done = st.completed || justCompleted === l._id;
                const active = activeLesson?._id === l._id;
                return (
                  <button
                    key={l._id}
                    onClick={() => selectLesson(st)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors",
                      active ? "bg-lime-400/10" : "hover:bg-white/5",
                      st.locked && "opacity-55",
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
                      {done ? <Check className="size-3.5" /> : st.locked ? <Lock className="size-3" /> : i + 1}
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
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {l.durationMinutes} min
                        {st.quiz && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1",
                              st.quizPassed
                                ? "text-lime-300"
                                : st.watchedPercent >= (states?.completionRequirements?.videoWatchPercent ?? DEFAULT_WATCH_GATE)
                                  ? "text-amber-300"
                                  : "text-muted-foreground/70",
                            )}
                          >
                            · <ListChecks className="size-3" /> quiz
                          </span>
                        )}
                      </p>
                    </div>
                    {st.quiz && st.quizPassed ? (
                      <CheckCircle2 className="size-4 shrink-0 text-lime-400" />
                    ) : st.quiz && st.watchedPercent >= (states?.completionRequirements?.videoWatchPercent ?? DEFAULT_WATCH_GATE) ? (
                      <ListChecks className="size-4 shrink-0 text-amber-300" />
                    ) : st.locked ? (
                      <Lock className="size-4 shrink-0 text-muted-foreground/50" />
                    ) : (
                      <PlayCircle
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-lime-300" : "text-muted-foreground/50",
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            {/* Final exam row */}
            <div className="border-t border-white/10">
              {exam ? (
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    bestExam?.passed || isComplete
                      ? "bg-lime-400/10"
                      : states?.allLessonsComplete
                        ? "bg-amber-400/8"
                        : "opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full",
                      bestExam?.passed || isComplete
                        ? "bg-lime-400 text-black"
                        : "bg-white/8 text-muted-foreground",
                    )}
                  >
                    {bestExam?.passed || isComplete ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Trophy className="size-3" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">Final exam</p>
                    <p className="text-xs text-muted-foreground">
                      {bestExam?.passed
                        ? `Passed — ${bestExam.percent}%`
                        : states?.allLessonsComplete
                          ? "All lessons done — take the exam"
                          : `${completedIds.size}/${lessonStates.length} lessons to unlock`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 opacity-60">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/8 text-muted-foreground">
                    <Trophy className="size-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-muted-foreground">
                      No final exam for this course
                    </p>
                  </div>
                </div>
              )}
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
          {activeLesson && activeState && (
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
                onHeartbeat={handleHeartbeat}
                onPause={handlePause}
                onSavePosition={handleSavePosition}
                onProgress={() => {}}
              />

              {/* Watch progress bar — always shown for video lessons */}
              {trackable && (
                <div className="rounded-2xl border border-white/10 bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {activeState.completed
                          ? "Lesson completed ✓"
                          : watchOk
                            ? activeState.quiz
                              ? "Quiz unlocked — well watched! 🎯"
                              : "Watch requirement met — mark complete"
                            : `Watch ${watchGate - Math.min(watchPercent, 100)}% more to ${activeState.quiz ? "unlock the quiz" : "complete"}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Video progress: {Math.min(watchPercent, 100)}% — requires {watchGate}%{watchOk ? " ✓" : ""}.
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                        watchOk ? "bg-lime-400/15 text-lime-300" : "bg-amber-400/10 text-amber-300",
                      )}
                    >
                      {Math.min(watchPercent, 100)}%
                    </span>
                  </div>
                  <Progress
                    value={Math.min(watchPercent, 100)}
                    className="mt-3 h-1.5 bg-white/10 [&>div]:bg-lime-400"
                  />
                </div>
              )}

              {/* Complete / quiz action row */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-card p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {activeState.completed
                      ? "Lesson completed ✓"
                      : activeState.quiz
                        ? watchOk
                          ? "Ready to test your knowledge"
                          : "Watch the video to unlock the quiz"
                        : "Mark this lesson as complete"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeState.quiz
                      ? `${activeState.quiz.questions.length} questions · pass ${activeState.quiz.passPercent}% · ${activeState.quiz.timeLimitMinutes} min`
                      : "Completing all lessons unlocks your certificate"}
                  </p>
                </div>
                {activeState.quiz ? (
                  <Button
                    onClick={() =>
                      setQuizOpen({
                        ...activeState.quiz!,
                        kind: "lesson",
                        courseId: course._id,
                      })
                    }
                    disabled={!watchOk || activeState.completed}
                    className={cn(
                      "shrink-0 gap-2",
                      activeState.completed
                        ? "border border-lime-400/40 bg-lime-400/10 text-lime-300 hover:bg-lime-400/15"
                        : "bg-lime-400 font-semibold text-black hover:bg-lime-300",
                    )}
                  >
                    {activeState.completed ? (
                      <>
                        <CheckCircle2 className="size-4" /> Completed
                      </>
                    ) : watchOk ? (
                      <>
                        <ListChecks className="size-4" /> Take quiz
                      </>
                    ) : (
                      <>
                        <Lock className="size-4" /> Watch to unlock
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleComplete}
                    disabled={marking || activeState.completed || (trackable && !watchOk)}
                    className={cn(
                      "shrink-0 gap-2",
                      activeState.completed
                        ? "border border-lime-400/40 bg-lime-400/10 text-lime-300 hover:bg-lime-400/15"
                        : "bg-lime-400 font-semibold text-black hover:bg-lime-300",
                    )}
                  >
                    {marking ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : activeState.completed ? (
                      <>
                        <CheckCircle2 className="size-4" /> Completed
                      </>
                    ) : (
                      "Mark complete"
                    )}
                  </Button>
                )}
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
                const idx = lessonStates.findIndex((l) => l.lesson._id === activeLesson._id);
                const next = lessonStates[idx + 1];
                return next ? (
                  <button
                    onClick={() => next.locked && toast.info("Complete the previous lesson first to unlock this one.") || setActiveLessonId(next.lesson._id)}
                    className="group flex w-full items-center justify-between rounded-2xl border border-white/10 bg-card p-5 transition-colors hover:border-lime-400/40"
                  >
                    <div className="text-left">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Up next</p>
                      <p className="font-display mt-1 flex items-center gap-2 font-semibold group-hover:text-lime-300">
                        {next.locked && <Lock className="size-4 text-muted-foreground" />}
                        {next.lesson.title}
                      </p>
                    </div>
                    <ChevronRight className="size-5 text-muted-foreground group-hover:text-lime-300" />
                  </button>
                ) : null;
              })()}

              {/* Final exam */}
              {exam && (
                <section
                  className={cn(
                    "rounded-2xl border p-6",
                    bestExam?.passed || isComplete
                      ? "border-lime-400/25 bg-lime-400/8"
                      : states?.allLessonsComplete
                        ? "border-amber-400/25 bg-amber-400/5"
                        : "border-white/10 bg-card",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-xl",
                        bestExam?.passed || isComplete
                          ? "bg-lime-400/15 text-lime-300"
                          : "bg-white/8 text-amber-300",
                      )}
                    >
                      <Trophy className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display flex items-center gap-2 text-base font-semibold">
                        Final exam
                        {bestExam?.passed && (
                          <Badge className="bg-lime-400/15 text-lime-300">Passed {bestExam.percent}%</Badge>
                        )}
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {exam.description ||
                          "One exam covering everything in this course — pass it to earn your certificate."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-white/5 px-2.5 py-1 font-medium">
                          {exam.questions.length} questions
                        </span>
                        <span className="rounded-full bg-white/5 px-2.5 py-1 font-medium">
                          {exam.totalMarks} marks
                        </span>
                        <span className="rounded-full bg-white/5 px-2.5 py-1 font-medium">
                          Pass {exam.passPercent}%
                        </span>
                        <span className="rounded-full bg-white/5 px-2.5 py-1 font-medium">
                          {exam.timeLimitMinutes} min
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {states?.allLessonsComplete
                        ? bestExam?.passed
                          ? "Your certificate is ready below. 🎉"
                          : "Every lesson complete — you're cleared to take the exam."
                        : `Complete all ${lessonStates.length} lessons to unlock the exam (${doneCount}/${lessonStates.length}).`}
                    </p>
                    <Button
                      onClick={() => setExamOpen(true)}
                      disabled={!states?.allLessonsComplete || !!bestExam?.passed}
                      className={cn(
                        "shrink-0 gap-2",
                        states?.allLessonsComplete && !bestExam?.passed
                          ? "bg-lime-400 font-semibold text-black hover:bg-lime-300"
                          : "border border-white/15",
                      )}
                    >
                      {bestExam?.passed ? (
                        <>
                          <CheckCircle2 className="size-4" /> Passed
                        </>
                      ) : states?.allLessonsComplete ? (
                        <>
                          <Trophy className="size-4" /> Start final exam
                        </>
                      ) : (
                        <>
                          <Lock className="size-4" /> Locked
                        </>
                      )}
                    </Button>
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

          {/* Legacy course-level quizzes (kept for courses created before
              per-lesson quizzes existed) */}
          {quizzes && quizzes.length > 0 && (
            <section className="mt-8 rounded-2xl border border-white/10 bg-card p-6">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                <ListChecks className="size-4 text-lime-300" /> Course quizzes
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
                        onClick={() =>
                          setQuizOpen({
                            _id: qz._id as string,
                            courseId: course._id,
                            title: qz.title,
                            description: qz.description,
                            passPercent: 70,
                            timeLimitMinutes: qz.timeLimitMinutes,
                            questions: qz.questions,
                            kind: "legacy",
                          })
                        }
                      >
                        {best ? "Retake" : "Take quiz"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Lesson quiz dialog */}
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
              quiz={quizOpen}
              passPercent={quizOpen.passPercent}
              onExit={() => setQuizOpen(null)}
              onResult={(r) => {
                if (activeLesson && r.passed && quizOpen.kind === "lesson") {
                  handleQuizResult(activeLesson._id, r);
                }
              }}
              submit={
                quizOpen.kind === "lesson"
                  ? (answers, t) =>
                      submitLessonQuiz({
                        quizId: quizOpen._id as never,
                        answers,
                        timeTakenSeconds: t,
                      })
                  : undefined
              }
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Final exam dialog */}
      <Dialog open={examOpen} onOpenChange={(o) => !o && setExamOpen(false)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-card sm:max-w-2xl">
          <DialogHeader className="flex-row items-center justify-between">
            <DialogTitle className="font-display sr-only">Final exam</DialogTitle>
            <button
              onClick={() => setExamOpen(false)}
              className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-white/10"
            >
              <X className="size-4" />
            </button>
          </DialogHeader>
          {exam && (
            <QuizRunner
              key={`exam-${exam._id}-${bestExam?._id ?? "first"}`}
              quiz={{
                _id: exam._id as string,
                courseId: exam.courseId as string,
                title: exam.title || "Final exam",
                description: exam.description,
                timeLimitMinutes: exam.timeLimitMinutes,
                questions: exam.questions,
              }}
              passPercent={exam.passPercent}
              totalMarks={exam.totalMarks}
              allowRetry={!bestExam?.passed}
              onExit={() => setExamOpen(false)}
              submit={(answers, t) =>
                submitFinalExam({
                  examId: exam._id as never,
                  answers,
                  timeTakenSeconds: t,
                })
              }
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
            <Button
              size="sm"
              variant="outline"
              onClick={() => openChatWith(course.tutorId)}
              className="shrink-0 gap-1.5 border-white/15 text-lime-300 hover:bg-lime-400/10"
            >
              <MessageSquare className="size-3.5" /> Message tutor
            </Button>
            <Link to={`/tutors/${course.tutorId}`} className="text-xs text-lime-300 hover:underline">
              View profile
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

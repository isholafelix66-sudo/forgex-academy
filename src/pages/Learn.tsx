import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Download,
  ExternalLink,
  Eye,
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
import { VideoPlayer, youtubeId } from "@/components/learn/VideoPlayer";
import { resolveLessonVideo } from "@/lib/lesson-videos";
import { QuizRunner, type QuizData, type QuizSubmitResult } from "@/components/learn/QuizRunner";
import { ExamRunner, type ExamData } from "@/components/learn/ExamRunner";
import { DifficultyBadge } from "@/components/site/DifficultyBadge";
import { Rating } from "@/components/site/Rating";
import { Avatar } from "@/components/site/Avatar";
import { EmptyState } from "@/components/site/EmptyState";
import { useAuth } from "@/hooks/use-auth";
import { openChatWith } from "@/lib/chat-open";
import { cn } from "@/lib/utils";
import {
  formatCourseDuration,
  formatLessonDuration,
} from "@/lib/format";
import { friendlyError } from "@/lib/errors";

// Video watch percentage is no longer a gate for lesson completion.
// Students can mark lessons complete freely; quizzes/assessments are the gate for certificates.

/** Notes from the “planned recording” era began with a now-obsolete banner —
 *  the lessons have real videos, so that leading sentence is stripped. */
const cleanLessonNotes = (n: string) =>
  n.replace(/^🎥 Video lesson — planned recording \(coming soon\)\.\s*/, "").trim();

const formatBytes = (b: number) =>
  b >= 1024 * 1024
    ? `${(b / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(b / 1024))} KB`;

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
  const saveLessonVideoDuration = useMutation(api.learn.saveLessonVideoDuration);
  const watchHeartbeat = useMutation(api.lms.watchHeartbeat);
  const saveWatchPosition = useMutation(api.lms.saveWatchPosition);
  const submitLessonQuiz = useMutation(api.lessonquizzes.submitLessonQuiz);
  const submitFinalExam = useMutation(api.exams.submitFinalExam);

  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState<LessonQuizPayload | null>(null);
  const [examOpen, setExamOpen] = useState(false);
  const [examPay, setExamPay] = useState<ExamData | null>(null);
  const [marking, setMarking] = useState(false);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);
  const [previewResource, setPreviewResource] = useState<{
    name: string;
    url: string;
  } | null>(null);

  /** Local progress for instant UI updates — the server is the source of
   *  truth for "is the lesson complete", but the local percent drives the
   *  progress bar so it never sits at 0% while the video is playing. */
  const [localWatchPercent, setLocalWatchPercent] = useState(0);

  const lessonStates = states?.lessons ?? [];
  const activeState =
    lessonStates.find((l) => l.lesson._id === activeLessonId) ?? lessonStates[0] ?? null;

  /** Server-side watched percent (reactive from Convex). */
  const serverWatchPercent = activeState?.watchedPercent ?? 0;
  /** Saved resume position in seconds — player seeks here on mount. */
  const resumePosition = activeState?.resumePosition ?? 0;
  const activeLesson = activeState?.lesson ?? null;
  /** Resources for the active lesson — storage URLs resolved server-side. */
  const resourceRows = useQuery(
    api.learn.lessonResources,
    activeLesson ? { lessonId: activeLesson._id as never } : "skip",
  );
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

  // Reset the duration-persist tracker when switching lessons.
  useEffect(() => {
    savedDurRef.current = 0;
  }, [activeLessonId]);

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

  /** Resolved video URL — real tutorials substituted for seeded placeholders. */
  const resolvedVideo = activeLesson
    ? resolveLessonVideo(course.slug, activeLesson.order, activeLesson.videoUrl)
    : null;
  /** Whether the lesson actually has a playable, trackable video. */
  const hasPlayableVideo =
    !!activeLesson?.muxPlaybackId ||
    (!!resolvedVideo &&
      resolvedVideo !== "planned-recording" &&
      resolvedVideo.trim() !== "" &&
      activeLesson?.videoType !== "loom");
  /** Watch threshold from the course's completion settings (default 90%). */
  const watchThreshold = states?.completionRequirements?.videoWatchPercent ?? 90;

  // Video lessons complete through real playback credit only — the UI mirrors
  // the backend gate (completeLessonInternal) by keeping the completion/quiz
  // buttons locked until the credited watch coverage meets the threshold.
  const trackable = hasPlayableVideo;
  const watchPercent = Math.max(localWatchPercent, serverWatchPercent);
  const watchOk = !trackable || watchPercent >= watchThreshold;

  /** Which player reported this lesson's progress (stored on watchProgress). */
  const videoSource: "mux" | "youtube" | "mp4" | "vimeo" | "loom" = (() => {
    if (!activeLesson) return "mp4";
    if (activeLesson.muxPlaybackId) return "mux";
    if (resolvedVideo && youtubeId(resolvedVideo)) return "youtube";
    if (activeLesson.videoType === "vimeo") return "vimeo";
    if (activeLesson.videoType === "loom") return "loom";
    return "mp4";
  })();

  /** Reset local progress when switching lessons. */
  useEffect(() => {
    setLocalWatchPercent(0);
  }, [activeLessonId]);

  /** Sync local progress from server when server catches up. */
  useEffect(() => {
    if (serverWatchPercent > localWatchPercent) {
      setLocalWatchPercent(serverWatchPercent);
    }
  }, [serverWatchPercent]);

  /** Video position for resume — latest known position from the player. */
  const videoPosRef = useRef<{ currentTime: number; duration: number }>({ currentTime: 0, duration: 0 });
  /** Track whether the player is currently playing. */
  const playingRef = useRef(false);
  /** Rate-limit heartbeats to every 5 seconds (not 12). */
  const lastHbTimeRef = useRef(0);
  /** The video's duration once known. */
  const durationRef = useRef(0);
  /** Last video duration persisted to the lesson (avoids repeat mutations). */
  const savedDurRef = useRef(0);

  /** Persist the real video duration as the lesson's authoritative length. */
  const persistDuration = useCallback(
    (duration: number) => {
      if (!activeLesson) return;
      const rounded = Math.round(duration);
      if (rounded <= 0) return;
      const stored = activeLesson.videoDurationSeconds ?? 0;
      if (rounded === stored || savedDurRef.current === rounded) return;
      savedDurRef.current = rounded;
      void saveLessonVideoDuration({
        lessonId: activeLesson._id as never,
        durationSeconds: rounded,
      });
    },
    [activeLesson, saveLessonVideoDuration],
  );

  /**
   * Send a heartbeat to the server. Rate-limited to every ~5s while playing,
   * but always fires immediately on pause/unload.
   */
  const fireHeartbeat = useCallback(
    (opts?: { force?: boolean }) => {
      if (!activeLesson) return;
      const { currentTime, duration } = videoPosRef.current;
      if (duration <= 0) return;
      const now = Date.now();
      const elapsed = now - lastHbTimeRef.current;
      if (!opts?.force && elapsed < 5_000) return;
      lastHbTimeRef.current = now;
      void watchHeartbeat({
        lessonId: activeLesson._id as never,
        positionSeconds: currentTime,
        durationSeconds: duration,
        playing: playingRef.current,
        videoSource,
      });
    },
    [activeLesson, watchHeartbeat, videoSource],
  );

  /**
   * Called by the VideoPlayer on every timeupdate (multiple times per second).
   * Updates the local progress bar instantly and fires a heartbeat every 5s.
   */
  const handleProgress = useCallback(
    (pct: number, currentTime: number, duration: number) => {
      videoPosRef.current = { currentTime, duration };
      if (duration > 0) durationRef.current = duration;
      const rounded = Math.round(Math.min(100, Math.max(0, pct)));
      setLocalWatchPercent((prev) => Math.max(prev, rounded));

      // Fire heartbeat periodically
      const now = Date.now();
      if (now - lastHbTimeRef.current >= 5_000 && activeLesson && duration > 0) {
        lastHbTimeRef.current = now;
        void watchHeartbeat({
          lessonId: activeLesson._id as never,
          positionSeconds: currentTime,
          durationSeconds: duration,
          playing: true,
          videoSource,
        });
      }
    },
    [activeLesson, watchHeartbeat, videoSource],
  );

  const handleHeartbeat = useCallback(
    (currentTime: number, duration: number, playing: boolean) => {
      if (!activeLesson) return;
      videoPosRef.current = { currentTime, duration };
      playingRef.current = playing;
      if (duration > 0) durationRef.current = duration;
      lastHbTimeRef.current = Date.now();
      void watchHeartbeat({
        lessonId: activeLesson._id as never,
        positionSeconds: currentTime,
        durationSeconds: duration,
        playing,
        videoSource,
      });
    },
    [activeLesson, watchHeartbeat, videoSource],
  );

  const handlePause = useCallback(
    (currentTime: number, duration: number) => {
      if (!activeLesson) return;
      videoPosRef.current = { currentTime, duration };
      playingRef.current = false;
      // Fire a final heartbeat on pause so the server gets the latest position
      void watchHeartbeat({
        lessonId: activeLesson._id as never,
        positionSeconds: currentTime,
        durationSeconds: duration,
        playing: false,
        videoSource,
      });
      void saveWatchPosition({
        lessonId: activeLesson._id as never,
        positionSeconds: currentTime,
        durationSeconds: duration,
        videoSource,
      });
    },
    [activeLesson, watchHeartbeat, saveWatchPosition, videoSource],
  );

  const handleSavePosition = useCallback(
    (positionSeconds: number, durationSeconds: number) => {
      if (!activeLesson) return;
      videoPosRef.current = { currentTime: positionSeconds, duration: durationSeconds };
      durationRef.current = durationSeconds;
      void saveWatchPosition({
        lessonId: activeLesson._id as never,
        positionSeconds,
        durationSeconds,
        videoSource,
      });
    },
    [activeLesson, saveWatchPosition, videoSource],
  );

  /** Called when the video duration becomes known (loadedmetadata / YouTube
   *  IFrame API / Mux metadata). Persists it so the course shows the REAL
   *  video length everywhere instead of the manual estimate. */
  const handleDurationReady = useCallback(
    (duration: number) => {
      durationRef.current = duration;
      persistDuration(duration);
    },
    [persistDuration],
  );

  /** Called when the player starts playing. */
  const handlePlay = useCallback(() => {
    playingRef.current = true;
  }, []);

  /** Called when the player pauses. */
  const handlePlayerPause = useCallback(() => {
    playingRef.current = false;
  }, []);

  /** Save resume position + fire final heartbeat when leaving the page. */
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!activeLesson) return;
      const { currentTime, duration } = videoPosRef.current;
      if (duration > 0) {
        // Fire a forced heartbeat (bypass rate limit)
        lastHbTimeRef.current = 0;
        void watchHeartbeat({
          lessonId: activeLesson._id as never,
          positionSeconds: currentTime,
          durationSeconds: duration,
          playing: false,
          videoSource,
        });
        void saveWatchPosition({
          lessonId: activeLesson._id as never,
          positionSeconds: currentTime,
          durationSeconds: duration,
          videoSource,
        });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeLesson, watchHeartbeat, saveWatchPosition, videoSource]);

  /** Save position when the browser tab becomes hidden (user switches tabs). */
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && activeLesson) {
        const { currentTime, duration } = videoPosRef.current;
        if (duration > 0) {
          lastHbTimeRef.current = 0;
          void watchHeartbeat({
            lessonId: activeLesson._id as never,
            positionSeconds: currentTime,
            durationSeconds: duration,
            playing: false,
            videoSource,
          });
          void saveWatchPosition({
            lessonId: activeLesson._id as never,
            positionSeconds: currentTime,
            durationSeconds: duration,
            videoSource,
          });
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [activeLesson, watchHeartbeat, saveWatchPosition, videoSource]);

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
      // Fire one last heartbeat before completing so server has latest progress
      lastHbTimeRef.current = 0;
      fireHeartbeat({ force: true });
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

  const handleExamResult = (result: { passed: boolean }) => {
    if (result.passed) {
      const nextIncomplete = lessonStates.find((l) => !l.completed && !l.locked);
      if (nextIncomplete) setActiveLessonId(nextIncomplete.lesson._id);
    }
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

  const attemptHistory = exam && exam.attempts.length > 1 ? (
    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Final exam attempts
      </p>
      <ul className="mt-2 space-y-2">
        {[...exam.attempts]
          .sort((a, b) => b.submittedAt - a.submittedAt)
          .map((a) => (
            <li key={a._id} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate font-medium">
                {a.examTitle ?? "Final exam"}
              </span>
              <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 font-mono">
                {a.score}/{a.totalMarks ?? exam.totalMarks} ({a.percent}%)
              </span>
              <span className="shrink-0">
                {a.passed ? (
                  <Badge className="bg-lime-400/15 text-lime-300">Passed</Badge>
                ) : (
                  <Badge className="bg-red-400/15 text-red-300">
                    Failed — {a.examPassPercent ?? exam.passPercent}% to pass
                  </Badge>
                )}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {new Date(a.submittedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
      </ul>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0d0f0c]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
          <Link
            to="/dashboard/my-courses"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-lime-300"
          >
            <ArrowLeft className="size-4" /> My courses
          </Link>
          <div className="mx-2 h-5 w-px shrink-0 bg-white/10" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold sm:text-base">
              {course.title}
            </p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {doneCount} of {lessonStates.length} lessons complete
            </p>
          </div>
          <div className="flex w-28 shrink-0 items-center gap-2 sm:w-48">
            <Progress value={progress} className="h-1.5 bg-white/10 [&>div]:bg-lime-400" />
            <span className="shrink-0 text-xs font-bold text-lime-300">{progress}%</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[320px_1fr]">
        {/* Lesson list */}
        <aside className="min-w-0 lg:sticky lg:top-24 lg:h-fit">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
            <div className="border-b border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Course content
              </p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                {formatCourseDuration(
                  lessonStates.map((s) => s.lesson),
                  course.durationHours,
                )}
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
                        {formatLessonDuration(l)}
                        {st.quiz && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1",
                              st.quizPassed
                                ? "text-lime-300"
                                : "text-amber-300",
                            )}
                          >
                            · <ListChecks className="size-3" /> quiz
                          </span>
                        )}
                      </p>
                    </div>
                    {st.quiz && st.quizPassed ? (
                      <CheckCircle2 className="size-4 shrink-0 text-lime-400" />
                    ) : st.quiz ? (
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
            {/* Assignments — visible in the outline with a submit CTA. */}
            {course.assignments.length > 0 && (
              <div className="border-t border-white/10">
                <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Assignments
                </p>
                {course.assignments.map((a) => (
                  <Link
                    key={a._id}
                    to="/dashboard/assignments"
                    className="flex items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/5"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-400/12 text-amber-300">
                      <FileText className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.maxScore} points
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-lime-400/15 px-2.5 py-1.5 text-[11px] font-semibold text-lime-300 transition-colors hover:bg-lime-400/25">
                      Submit <ChevronRight className="size-3" />
                    </span>
                  </Link>
                ))}
              </div>
            )}
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
                <h1 className="font-display mt-3 break-words text-2xl font-bold leading-snug sm:text-3xl">
                  {activeLesson.title}
                </h1>
              </div>

              <VideoPlayer
                key={activeLesson._id}
                url={resolveLessonVideo(course.slug, activeLesson.order, activeLesson.videoUrl)}
                type={activeLesson.videoType}
                muxPlaybackId={activeLesson.muxPlaybackId}
                image={activeLesson.image}
                title={activeLesson.title}
                resumePosition={resumePosition}
                onProgress={handleProgress}
                onHeartbeat={handleHeartbeat}
                onPause={handlePause}
                onSavePosition={handleSavePosition}
                onDurationReady={handleDurationReady}
                onPlay={handlePlay}
                onPlayerPause={handlePlayerPause}
              />

              {/* Video progress — watch credit toward the completion threshold */}
              {trackable && (
                <div className="rounded-2xl border border-white/10 bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {activeState.completed
                          ? "Lesson completed ✓"
                          : activeState.quiz
                            ? `Quiz unlocks at ${watchThreshold}% watched`
                            : watchOk
                              ? "Watch threshold reached — ready to complete"
                              : `Watch ${watchThreshold}% of the video to complete`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Video progress: {Math.min(watchPercent, 100)}% · {watchThreshold}% required.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-lime-400/15 px-2.5 py-1 text-xs font-bold text-lime-300">
                      {Math.min(watchPercent, 100)}%
                    </span>
                  </div>
                  <Progress
                    value={Math.min(watchPercent, 100)}
                    className="mt-3 h-1.5 bg-white/10 [&>div]:bg-lime-400"
                  />
                </div>
              )}

              {/* Complete / quiz action row — video lessons stay locked until
                  the credited watch coverage meets the course threshold. */}
              <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {activeState.completed
                      ? "Lesson completed ✓"
                      : activeState.quiz
                        ? "Ready to test your knowledge"
                        : watchOk
                          ? "Video watched — mark the lesson complete"
                          : "Keep watching to complete this lesson"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeState.quiz
                      ? trackable && !watchOk
                        ? `Watch ${watchThreshold}% of the video to unlock this quiz — ${Math.min(watchPercent, 100)}% watched`
                        : `${activeState.quiz.questions.length} questions · pass ${activeState.quiz.passPercent}% · ${activeState.quiz.timeLimitMinutes} min`
                      : trackable && !watchOk
                        ? `Watch ${watchThreshold}% of the video to complete — ${Math.min(watchPercent, 100)}% watched`
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
                    disabled={activeState.completed || (trackable && !watchOk)}
                    className={cn(
                      "w-full shrink-0 gap-2 sm:w-auto",
                      activeState.completed
                        ? "border border-lime-400/40 bg-lime-400/10 text-lime-300 hover:bg-lime-400/15"
                        : trackable && !watchOk
                          ? "border border-white/15 text-muted-foreground"
                          : "bg-lime-400 font-semibold text-black hover:bg-lime-300",
                    )}
                  >
                    {activeState.completed ? (
                      <>
                        <CheckCircle2 className="size-4" /> Completed
                      </>
                    ) : trackable && !watchOk ? (
                      <>
                        <Lock className="size-4" /> Quiz locked
                      </>
                    ) : (
                      <>
                        <ListChecks className="size-4" /> Take quiz
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleComplete}
                    disabled={marking || activeState.completed || (trackable && !watchOk)}
                    className={cn(
                      "w-full shrink-0 gap-2 sm:w-auto",
                      activeState.completed
                        ? "border border-lime-400/40 bg-lime-400/10 text-lime-300 hover:bg-lime-400/15"
                        : trackable && !watchOk
                          ? "border border-white/15 text-muted-foreground"
                          : "bg-lime-400 font-semibold text-black hover:bg-lime-300",
                    )}
                  >
                    {marking ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : activeState.completed ? (
                      <>
                        <CheckCircle2 className="size-4" /> Completed
                      </>
                    ) : trackable && !watchOk ? (
                      <>
                        <Lock className="size-4" /> Watch video to complete
                      </>
                    ) : (
                      "Mark complete"
                    )}
                  </Button>
                )}
              </div>

              {/* Notes */}
              {cleanLessonNotes(activeLesson.notes) && (
                <section className="rounded-2xl border border-white/10 bg-card p-6">
                  <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                    <StickyNote className="size-4 text-lime-300" /> Lesson notes
                  </h2>
                  <p className="mt-3 break-words whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {cleanLessonNotes(activeLesson.notes)}
                  </p>
                </section>
              )}

              {/* Resources — real files resolved from storage + external links */}
              <section className="rounded-2xl border border-white/10 bg-card p-6">
                <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                  <FileText className="size-4 text-lime-300" /> Resources
                </h2>
                {!resourceRows ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Loading resources…
                  </p>
                ) : resourceRows.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No resources available for this lesson.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {resourceRows.map((r) => (
                      <div
                        key={r.index}
                        className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <FileText className="size-5 shrink-0 text-lime-300" />
                          <div className="min-w-0">
                            <p className="break-words text-sm font-medium">{r.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.kind === "link"
                                ? "External link"
                                : `${r.fileSize > 0 ? `${formatBytes(r.fileSize)} · ` : ""}PDF / document`}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {r.kind === "link" ? (
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button size="sm" variant="outline" className="gap-1.5">
                                <ExternalLink className="size-3.5" /> Open
                              </Button>
                            </a>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() =>
                                setPreviewResource({ name: r.name, url: r.url })
                              }
                            >
                              <Eye className="size-3.5" /> View
                            </Button>
                          )}
                          <a
                            href={r.url}
                            download={r.kind === "file" ? r.name : undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 border-lime-400/30 text-lime-300"
                            >
                              <Download className="size-3.5" /> Download
                            </Button>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Transcript */}
              {activeLesson.transcript && (
                <section className="rounded-2xl border border-white/10 bg-card p-6">
                  <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                    <ScrollText className="size-4 text-lime-300" /> Transcript
                  </h2>
                  <p className="mt-3 break-words whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
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
                    <div className="min-w-0 text-left">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Up next</p>
                      <p className="font-display mt-1 flex min-w-0 items-center gap-2 font-semibold break-words group-hover:text-lime-300">
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
                  {attemptHistory}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {states?.allLessonsComplete
                        ? bestExam?.passed
                          ? "Your certificate is ready below. 🎉"
                          : "Every lesson complete — you're cleared to take the exam."
                        : `Complete all ${lessonStates.length} lessons to unlock the exam (${doneCount}/${lessonStates.length}).`}
                    </p>
                    <Button
                      onClick={() => {
                        setExamPay({
                          _id: exam._id as string,
                          courseId: course._id,
                          title: exam.title || "Final exam",
                          description: exam.description || "One exam covering everything in this course — pass it to earn your certificate.",
                          timeLimitMinutes: exam.timeLimitMinutes,
                          questions: exam.questions,
                          passPercent: exam.passPercent,
                          totalMarks: exam.totalMarks,
                        });
                        setExamOpen(true);
                      }}
                      disabled={!states?.allLessonsComplete || !!bestExam?.passed}
                      className={cn(
                        "w-full shrink-0 gap-2 sm:w-auto",
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

              {/* Final exam modal */}
              {examPay && (
                <Dialog open={examOpen} onOpenChange={setExamOpen}>
                  <DialogContent className="max-h-[90vh] overflow-y-auto p-0">
                    <DialogHeader className="sr-only">
                      <DialogTitle>Final exam</DialogTitle>
                    </DialogHeader>
                    <div className="p-6 sm:p-8">
                      <ExamRunner
                        exam={examPay}
                        allowRetry={!bestExam?.passed}
                        onExit={() => {
                          setExamOpen(false);
                          setExamPay(null);
                        }}
                        onResult={handleExamResult}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
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

      {/* In-app PDF / document viewer */}
      <Dialog
        open={!!previewResource}
        onOpenChange={(o) => !o && setPreviewResource(null)}
      >
        <DialogContent className="h-[92vh] max-h-[92vh] w-[min(94vw,70rem)] overflow-hidden border-white/10 bg-black p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{previewResource?.name ?? "Resource"}</DialogTitle>
          </DialogHeader>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
              <p className="min-w-0 truncate text-sm font-medium">
                {previewResource?.name}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                {previewResource && (
                  <a
                    href={previewResource.url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="outline" className="gap-1.5 border-lime-400/30 text-lime-300">
                      <Download className="size-3.5" /> Download
                    </Button>
                  </a>
                )}
                <button
                  onClick={() => setPreviewResource(null)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              {previewResource && (
                <iframe
                  src={previewResource.url}
                  title={previewResource.name}
                  className="block size-full border-0"
                />
              )}
            </div>
          </div>
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
            <Link to={`/tutors/${course.tutorId}`} className="hidden text-xs text-lime-300 hover:underline sm:inline">
              View profile
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

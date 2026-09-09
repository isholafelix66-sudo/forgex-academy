import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  ListChecks,
  Loader2,
  MessageSquare,
  MessageSquareText,
  PlayCircle,
  Rocket,
  Send,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { CoverArt } from "@/components/site/CoverArt";
import { Avatar } from "@/components/site/Avatar";
import { DifficultyBadge } from "@/components/site/DifficultyBadge";
import { Rating } from "@/components/site/Rating";
import { ProgressRing } from "@/components/site/ProgressRing";
import { EmptyState } from "@/components/site/EmptyState";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { openChatWith } from "@/lib/chat-open";
import {
  formatCourseDuration,
  formatLessonDuration,
} from "@/lib/format";

function formatRelative(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CourseDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  // A tutor account never enrolls as a student — one account, one role. If a
  // tutor opens a course page, they get their own dashboard, not an
  // enrollment record on their tutor identity.
  const isTutorAccount = user?.role === "tutor";
  const course = useQuery(api.public.courseBySlug, { slug: slug ?? "" });
  const enroll = useMutation(api.learn.enroll);
  const enrollment = useQuery(
    api.learn.enrollmentStatus,
    isAuthenticated && course ? { courseId: course._id } : "skip",
  );
  const reviews = useQuery(
    api.reviews.listByCourse,
    course ? { courseId: course._id } : "skip",
  );
  const myReview = useQuery(
    api.reviews.myReview,
    isAuthenticated && course ? { courseId: course._id } : "skip",
  );
  const upsertReview = useMutation(api.reviews.upsert);
  const removeReview = useMutation(api.reviews.remove);

  const [star, setStar] = useState(0);
  const [hoverStar, setHoverStar] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (myReview) {
      setStar(myReview.rating);
      setReviewComment(myReview.comment);
    }
  }, [myReview]);

  if (!course) {
    return (
      <PageShell>
        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <EmptyState
            icon={<BookOpen className="size-6" />}
            title="Course not found"
            description="This course may have been unpublished or removed."
            action={
              <Link to="/courses">
                <Button variant="outline">Browse courses</Button>
              </Link>
            }
          />
        </section>
      </PageShell>
    );
  }

  const handleEnroll = async () => {
    if (!isAuthenticated) {
      navigate(`/auth?returnTo=${encodeURIComponent(`/courses/${slug}`)}`);
      return;
    }
    if (isTutorAccount) {
      navigate("/tutor");
      return;
    }
    await enroll({ courseId: course._id });
    navigate(`/learn/${course.slug}`);
  };

  const isEnrolled = !!enrollment;

  const handleMessageTutor = () => {
    if (!isAuthenticated) {
      navigate(`/auth?returnTo=${encodeURIComponent(`/courses/${course.slug}`)}`);
      return;
    }
    openChatWith(course.tutorId);
  };

  const handleSubmitReview = async () => {
    if (star < 1) {
      toast.error("Pick a star rating first.");
      return;
    }
    setSubmittingReview(true);
    try {
      await upsertReview({ courseId: course._id, rating: star, comment: reviewComment });
      toast.success(myReview ? "Review updated" : "Thanks — your review is live!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't submit your review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async () => {
    setSubmittingReview(true);
    try {
      await removeReview({ courseId: course._id });
      setStar(0);
      setReviewComment("");
      toast.success("Review removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove your review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6">
        <Reveal>
          <Link
            to="/courses"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-lime-300"
          >
            <ArrowLeft className="size-4" /> All courses
          </Link>
        </Reveal>

        <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
          {/* Main */}
          <div className="min-w-0">
            <Reveal>
              <CoverArt
                gradient={course.gradient}
                icon={course.icon}
                image={course.image}
                slug={course.slug}
                className="h-64 w-full sm:h-80"
                iconClassName="text-7xl"
              />
            </Reveal>

            <Reveal className="mt-8">
              <div className="flex flex-wrap items-center gap-2">
                {course.category && (
                  <Badge variant="outline" className="border-lime-400/30 bg-lime-400/10 text-lime-300">
                    {course.category.name}
                  </Badge>
                )}
                <DifficultyBadge difficulty={course.difficulty} />
                {course.roadmap && (
                  <Link to="/roadmap">
                    <Badge variant="outline" className="border-white/15 text-muted-foreground hover:text-lime-300">
                      <Rocket className="size-3" /> {course.roadmap.name}
                      {course.level ? ` · Level ${course.level.title}` : ""}
                    </Badge>
                  </Link>
                )}
              </div>

              <h1 className="font-display mt-4 break-words text-4xl font-bold tracking-tight sm:text-5xl">
                {course.title}
              </h1>
              <p className="mt-3 text-lg text-muted-foreground">{course.subtitle}</p>

              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
                <Rating value={course.rating} count={course.ratingCount} />
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4" />{" "}
                  {formatCourseDuration(course.lessons, course.durationHours)}
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
            </Reveal>

            {/* Tutor */}
            {course.tutorProfile && (
              <Reveal className="mt-8">
                <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-5 transition-colors hover:border-lime-400/30 sm:flex-row sm:items-center">
                  <Link
                    to={`/tutors/${course.tutorId}`}
                    className="flex min-w-0 items-center gap-4 sm:flex-1"
                  >
                    <Avatar
                      name={course.tutorProfile.name}
                      image={course.tutorProfile.image}
                      className="size-14 text-lg"
                    />
                    <div className="min-w-0">
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
                    <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                  </Link>
                  <Button
                    size="sm"
                    onClick={handleMessageTutor}
                    className="w-full shrink-0 gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300 sm:w-auto"
                  >
                    <MessageSquare className="size-3.5" /> Message tutor
                  </Button>
                </div>
              </Reveal>
            )}

            {/* Description */}
            <Reveal className="mt-10">
              <h2 className="font-display text-2xl font-bold">About this course</h2>
              <p className="mt-4 break-words whitespace-pre-line text-base leading-relaxed text-muted-foreground">
                {course.longDescription}
              </p>
            </Reveal>

            {/* Skills */}
            {course.skills.length > 0 && (
              <Reveal className="mt-10">
                <h2 className="font-display text-2xl font-bold">What you'll learn</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {course.skills.map((s) => (
                    <div key={s} className="flex items-center gap-3 rounded-xl border border-white/10 bg-card px-4 py-3">
                      <CheckCircle2 className="size-4 shrink-0 text-lime-400" />
                      <span className="text-sm">{s}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            )}

            {/* Prerequisites */}
            <Reveal className="mt-10">
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
            </Reveal>

            {/* Lessons */}
            <Reveal className="mt-10">
              <h2 className="font-display text-2xl font-bold">Course content</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {course.lessons.length} lessons ·{" "}
                {formatCourseDuration(course.lessons)}
              </p>
              <div className="mt-5 space-y-3">
                {course.lessons.map((l, i) => (
                  <div
                    key={l._id}
                    className="flex items-center gap-4 rounded-xl border border-white/10 bg-card px-4 py-3.5"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lime-400/12 text-sm font-bold text-lime-300">
                      {i + 1}
                    </span>
                    <PlayCircle className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatLessonDuration(l)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>

            {/* Assignments */}
            {course.assignments.length > 0 && (
              <Reveal className="mt-10">
                <h2 className="font-display text-2xl font-bold">Assignments</h2>
                <div className="mt-4 space-y-3">
                  {course.assignments.map((a) => (
                    <div key={a._id} className="flex items-start gap-4 rounded-xl border border-white/10 bg-card px-4 py-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/12 text-amber-300">
                        <FileText className="size-5" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">{a.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {a.maxScore} points
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Reveal>
            )}

            {/* Quizzes */}
            {course.quizzes.length > 0 && (
              <Reveal className="mt-10">
                <h2 className="font-display text-2xl font-bold">Quizzes</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {course.quizzes.map((qz) => (
                    <div key={qz._id} className="rounded-xl border border-white/10 bg-card px-4 py-4">
                      <p className="text-sm font-medium">{qz.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {qz.questionCount} questions · {qz.timeLimitMinutes} min · auto-graded
                      </p>
                    </div>
                  ))}
                </div>
              </Reveal>
            )}

            {/* Certificate */}
            <Reveal className="mt-10">
              <div className="flex items-start gap-4 rounded-2xl border border-lime-400/25 bg-lime-400/8 p-6">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
                  <Award className="size-6" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold">Earn a verifiable certificate</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Complete every lesson to earn your certificate — it ships
                    with a unique ID and QR code anyone can verify online.
                  </p>
                </div>
              </div>
            </Reveal>

            {/* Ratings & reviews */}
            <Reveal className="mt-10">
              <div className="rounded-3xl border border-white/10 bg-card p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-lime-400/12 text-lime-300">
                    <MessageSquareText className="size-5" />
                  </span>
                  <div>
                    <h2 className="font-display text-2xl font-bold">Ratings &amp; reviews</h2>
                    <p className="text-sm text-muted-foreground">
                      {course.ratingCount > 0
                        ? "What learners say about this course"
                        : "Be the first to rate this course"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-6 sm:grid-cols-[170px_1fr]">
                  {/* Summary */}
                  <div className="text-center sm:border-r sm:border-white/10 sm:pr-6">
                    <p className="font-display text-5xl font-bold text-gradient">
                      {course.rating.toFixed(1)}
                    </p>
                    <div className="mt-2 flex justify-center">
                      <Rating value={course.rating} size="md" />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {course.ratingCount.toLocaleString()}{" "}
                      {course.ratingCount === 1 ? "review" : "reviews"}
                    </p>
                  </div>

                  {/* Distribution */}
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((n) => {
                      const count = reviews?.distribution[n] ?? 0;
                      const total = reviews?.total ?? course.ratingCount;
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={n} className="flex items-center gap-3 text-xs">
                          <span className="flex w-8 items-center gap-1 font-medium text-muted-foreground">
                            {n}
                            <Star className="size-3 fill-amber-400 text-amber-400" />
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-lime-400/70 to-lime-300 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-6 text-right tabular-nums text-muted-foreground">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Write a review */}
                <div className="mt-8 border-t border-white/10 pt-6">
                  {!isAuthenticated ? (
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-black/20 px-6 py-8 text-center">
                      <Star className="size-6 text-lime-400/70" />
                      <p className="text-sm text-muted-foreground">
                        Learned something great? Sign in to rate and review this course.
                      </p>
                      <Button
                        onClick={() =>
                          navigate(
                            `/auth?returnTo=${encodeURIComponent(`/courses/${course.slug}`)}`,
                          )
                        }
                        className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                      >
                        Sign in to review
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-medium">
                          {myReview ? "Update your review" : "Rate this course"}
                        </p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              aria-label={`${n} star${n > 1 ? "s" : ""}`}
                              onMouseEnter={() => setHoverStar(n)}
                              onMouseLeave={() => setHoverStar(0)}
                              onClick={() => setStar(n)}
                              className="rounded-md p-0.5 transition-transform hover:scale-125"
                            >
                              <Star
                                className={cn(
                                  "size-6 transition-colors",
                                  n <= (hoverStar || star)
                                    ? "fill-amber-400 text-amber-400"
                                    : "fill-transparent text-muted-foreground/30",
                                )}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <Textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="What did you like? What could be better? (optional)"
                        rows={3}
                        maxLength={1000}
                        className="mt-3"
                      />
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          {star > 0 ? `${star} of 5 stars` : "Tap a star to pick your rating"}
                        </p>
                        <div className="flex items-center gap-2">
                          {myReview && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={submittingReview}
                              onClick={handleDeleteReview}
                              className="text-muted-foreground hover:text-rose-300"
                            >
                              <Trash2 className="size-4" /> Remove
                            </Button>
                          )}
                          <Button
                            size="sm"
                            disabled={submittingReview || star < 1}
                            onClick={handleSubmitReview}
                            className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                          >
                            {submittingReview ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Send className="size-4" />
                            )}
                            {myReview ? "Update review" : "Publish review"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Review list */}
                <div className="mt-8 space-y-4">
                  {reviews === undefined ? (
                    <div className="space-y-4">
                      {[0, 1].map((i) => (
                        <div
                          key={i}
                          className="h-24 animate-pulse rounded-2xl border border-white/8 bg-black/20"
                        />
                      ))}
                    </div>
                  ) : reviews.reviews.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-6 py-10 text-center">
                      <p className="text-sm text-muted-foreground">
                        No reviews yet — your rating will help other learners pick this course.
                      </p>
                    </div>
                  ) : (
                    reviews.reviews.map((r) => (
                      <div
                        key={r._id}
                        className="flex gap-4 rounded-2xl border border-white/10 bg-black/20 p-5"
                      >
                        <Avatar
                          name={r.author.name}
                          image={r.author.image}
                          className="size-10 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p className="text-sm font-semibold">{r.author.name}</p>
                            <span className="inline-flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Star
                                  key={n}
                                  className={cn(
                                    "size-3",
                                    n <= r.rating
                                      ? "fill-amber-400 text-amber-400"
                                      : "fill-transparent text-muted-foreground/25",
                                  )}
                                />
                              ))}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatRelative(r.createdAt)}
                              {r.updatedAt !== r.createdAt ? " · edited" : ""}
                            </span>
                          </div>
                          {r.comment ? (
                            <p className="mt-1.5 break-words whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                              {r.comment}
                            </p>
                          ) : (
                            <p className="mt-1.5 text-sm italic text-muted-foreground/60">
                              Rated {r.rating} star{r.rating > 1 ? "s" : ""} — no written comment.
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Reveal>
          </div>

          {/* Sidebar */}
          <div className="min-w-0 lg:pt-2">
            <Reveal className="lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-card">
                <CoverArt
                  gradient={course.gradient}
                  icon={course.icon}
                  image={course.image}
                  slug={course.slug}
                  className="h-44 rounded-none border-0"
                  iconClassName="text-6xl"
                />
                <div className="p-6">
                  {isEnrolled ? (
                    <>
                      <div className="flex items-center gap-4">
                        <ProgressRing value={enrollment?.progress ?? 0} size={72} />
                        <div>
                          <p className="text-sm font-semibold">
                            {enrollment?.status === "completed"
                              ? "Course completed 🎉"
                              : "In progress"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {enrollment?.completedLessons.length ?? 0} of {course.lessons.length} lessons done
                          </p>
                        </div>
                      </div>
                      <Link to={`/learn/${course.slug}`} className="mt-5 block">
                        <Button className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                          {enrollment?.status === "completed" ? "Review course" : "Continue learning"}
                          <ArrowRight className="size-4" />
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-lime-400/15 px-3 py-1 text-xs font-bold text-lime-300">
                          Free course
                        </span>
                        <span className="text-xs text-muted-foreground">
                          No payment required
                        </span>
                      </div>
                      <Button
                        onClick={handleEnroll}
                        className="mt-5 w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300 glow-lime-soft"
                      >
                        <GraduationCap className="size-4" />
                        {isTutorAccount
                          ? "Open your tutor dashboard"
                          : isAuthenticated
                            ? "Enroll now"
                            : "Sign in to enroll"}
                      </Button>
                      <p className="mt-3 text-center text-xs text-muted-foreground">
                        Track progress · complete lessons · earn certificate
                      </p>
                    </>
                  )}

                  <div className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Difficulty</span>
                      <DifficultyBadge difficulty={course.difficulty} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-medium">
                        {formatCourseDuration(course.lessons, course.durationHours)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Lessons</span>
                      <span className="font-medium">{course.lessons.length}</span>
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
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

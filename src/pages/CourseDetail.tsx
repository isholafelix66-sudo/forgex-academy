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
  PlayCircle,
  Rocket,
  Star,
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
import { useAuth } from "@/hooks/use-auth";
import { formatHours } from "@/lib/format";

export default function CourseDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const course = useQuery(api.public.courseBySlug, { slug: slug ?? "" });
  const enroll = useMutation(api.learn.enroll);
  const enrollment = useQuery(
    api.learn.enrollmentStatus,
    isAuthenticated && course ? { courseId: course._id } : "skip",
  );

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
    await enroll({ courseId: course._id });
    navigate(`/learn/${course.slug}`);
  };

  const isEnrolled = !!enrollment;

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

        <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_380px]">
          {/* Main */}
          <div className="min-w-0">
            <Reveal>
              <CoverArt
                gradient={course.gradient}
                icon={course.icon}
                image={course.image}
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
            </Reveal>

            {/* Tutor */}
            {course.tutorProfile && (
              <Reveal className="mt-8">
                <Link
                  to={`/tutors/${course.tutorId}`}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-card p-5 transition-colors hover:border-lime-400/30"
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
              </Reveal>
            )}

            {/* Description */}
            <Reveal className="mt-10">
              <h2 className="font-display text-2xl font-bold">About this course</h2>
              <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-muted-foreground">
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
                {course.lessons.length} lessons · {course.lessons.reduce((s, l) => s + l.durationMinutes, 0)} min total
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
                      <p className="text-xs text-muted-foreground">{l.durationMinutes} min</p>
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
                          {a.deadline
                            ? ` · due ${new Date(a.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                            : ""}
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
          </div>

          {/* Sidebar */}
          <div className="lg:pt-2">
            <Reveal className="lg:sticky lg:top-24">
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-card">
                <CoverArt
                  gradient={course.gradient}
                  icon={course.icon}
                  image={course.image}
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
                        {isAuthenticated ? "Enroll now" : "Sign in to enroll"}
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
                      <span className="font-medium">{formatHours(course.durationHours)}</span>
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

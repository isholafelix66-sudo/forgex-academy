import { Link, Navigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Compass,
  FileText,
  Flame,
  GraduationCap,
  Percent,
  Sparkles,
  UserCheck,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { StatCard } from "@/components/dash/StatCard";
import { CourseCard } from "@/components/site/CourseCard";
import { ProgressRing } from "@/components/site/ProgressRing";
import { EmptyState } from "@/components/site/EmptyState";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/format";

export default function DashboardHome() {
  const { user } = useAuth();
  const enrollments = useQuery(api.learn.myEnrollments);
  const submissions = useQuery(api.submissions.mySubmissions);
  const announcements = useQuery(api.public.announcementsList);
  const recommendations = useQuery(api.learn.recommendations);
  const adminRecommended = useQuery(api.learn.recommendedCourses);

  // Role is the source of truth: this is the STUDENT dashboard. A tutor (or
  // admin) account is never shown student content here — they belong in
  // their own dashboard. (The other /dashboard/* pages — communities,
  // messaging — stay reachable for tutors via their own shell.)
  if (user?.role === "tutor") return <Navigate to="/tutor" replace />;
  if (user?.role === "admin") return <Navigate to="/admin" replace />;

  // Admin picks win when present; otherwise fall back to the existing
  // personalized recommendations query.
  const shownRecommendations =
    adminRecommended && adminRecommended.length > 0
      ? adminRecommended
      : recommendations;

  // First-time landing inside the dashboard: if the account has no display
  // name yet, prompt once here instead of blocking the whole app. This is a
  // dashboard-only CTA into profile editing — the name is still saved through
  // the same authenticated profile record.
  const needsName = !user?.name;

  const inProgress = enrollments?.filter(
    (e) => e.enrollment.status === "in-progress",
  );
  const completed = enrollments?.filter(
    (e) => e.enrollment.status === "completed",
  );
  const avgProgress =
    inProgress && inProgress.length > 0
      ? Math.round(
          inProgress.reduce((s, e) => s + e.enrollment.progress, 0) /
            inProgress.length,
        )
      : 0;
  const streak = user?.streak ?? 0;
  const awaitingGrade = submissions?.filter((s) => s.grade === undefined);

  return (
    <div className="space-y-10">
      <PageHeader
        title={`Welcome back${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description={
          streak > 0
            ? `${streak} day learning streak — keep it going! 🔥`
            : "Pick up where you left off and keep building."
        }
        actions={
          <Link to="/courses">
            <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
              <BookOpen className="size-4" /> Browse courses
            </Button>
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<BookOpen className="size-5" />}
          label="Courses in progress"
          value={inProgress?.length ?? "—"}
          hint={completed && completed.length > 0 ? `${completed.length} completed` : undefined}
        />
        <StatCard
          icon={<Percent className="size-5" />}
          label="Average completion"
          value={`${avgProgress}%`}
          accent
        />
        <StatCard
          icon={<FileText className="size-5" />}
          label="Awaiting grade"
          value={awaitingGrade?.length ?? "—"}
          hint={submissions && submissions.length > 0 ? `${submissions.length} total submitted` : undefined}
        />
        <StatCard
          icon={<Flame className="size-5" />}
          label="Day streak"
          value={streak}
          hint={streak > 0 ? "Complete a lesson daily" : "Start a streak today"}
        />
      </div>

      {/* ForgeX Resources */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Compass className="size-5 text-lime-300" />
          <h2 className="font-display text-xl font-bold">ForgeX Resources</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/ai-hub"
            className="group flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-6 transition-colors hover:border-lime-400/40"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
              <Sparkles className="size-5" />
            </span>
            <div>
              <p className="font-display text-base font-semibold">AI Hub</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Discover free AI tools
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-lime-300">
              Explore AI Hub
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          <Link
            to="/prompts"
            className="group flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-6 transition-colors hover:border-lime-400/40"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
              <Wand2 className="size-5" />
            </span>
            <div>
              <p className="font-display text-base font-semibold">Prompt Library</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Get ready-to-use AI prompts
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-lime-300">
              Explore Prompts
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </section>

      {/* Courses in progress */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Courses in progress</h2>
          <Link to="/dashboard/my-courses" className="inline-flex items-center gap-1 text-sm text-lime-300 hover:underline">
            View all <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {inProgress === undefined ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-80 animate-pulse rounded-2xl border border-white/8 bg-card" />
            ))}
          </div>
        ) : inProgress.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="size-6" />}
            title="No courses in progress"
            description="Enroll in your first course and start building."
            action={
              <Link to="/courses">
                <Button className="bg-lime-400 font-semibold text-black hover:bg-lime-300">
                  Browse courses
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {inProgress.slice(0, 3).map((e) => (
              <CourseCard
                key={e.course._id}
                course={{ ...e.course, progress: e.enrollment.progress, status: e.enrollment.status }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Announcements — assignments live in each course's outline and the
          dedicated Assignments page, so the dashboard keeps only a peek at
          course news here. */}
      <section>
        <h2 className="font-display mb-4 flex items-center gap-2 text-xl font-bold">
          <Bell className="size-5 text-lime-300" /> Recent announcements
        </h2>
        <div className="space-y-3">
            {announcements?.slice(0, 3).map((a) => (
              <Link
                key={a._id}
                to="/updates"
                className="block rounded-2xl border border-white/10 bg-card p-4 transition-colors hover:border-lime-400/30"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-lime-400/80">
                    {a.category}
                  </span>
                  <span className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</span>
                </div>
                <p className="mt-1.5 break-words text-sm font-medium leading-snug">{a.title}</p>
              </Link>
            ))}
          </div>
      </section>

      {/* First-time dashboard note — only shown when the account still needs
          a display name. This links straight to profile editing, never to a
          separate onboarding page. */}
      {needsName && (
        <div className="flex items-center gap-4 rounded-2xl border border-lime-400/25 bg-lime-400/8 p-5">
          <UserCheck className="size-8 shrink-0 text-lime-300" />
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold">
              Complete your profile
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your name so certificates and greetings show correctly.
            </p>
          </div>
          <Link to="/dashboard/profile">
            <Button className="shrink-0 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
              Edit profile
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      )}

      {/* Recommendations */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="size-5 text-lime-300" />
          <h2 className="font-display text-xl font-bold">Recommended for you</h2>
        </div>
        {shownRecommendations && shownRecommendations.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shownRecommendations.map((c) => (
              <CourseCard key={c._id} course={c} />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-card p-6">
            <GraduationCap className="size-8 shrink-0 text-lime-300" />
            <p className="text-sm text-muted-foreground">
              Recommended courses are currently unavailable.
            </p>
          </div>
        )}
      </section>

      {/* Certificates teaser */}
      {completed && completed.length > 0 && (
        <section className="flex items-center gap-4 rounded-2xl border border-lime-400/25 bg-lime-400/8 p-5">
          <Award className="size-8 shrink-0 text-lime-300" />
          <div className="flex-1">
            <p className="font-display font-semibold">
              You've earned {completed.length} certificate{completed.length > 1 ? "s" : ""} 🎉
            </p>
            <p className="text-sm text-muted-foreground">
              View and share your verifiable certificates.
            </p>
          </div>
          <Link to="/dashboard/certificates">
            <Button variant="outline" className="border-lime-400/30 text-lime-300 hover:bg-lime-400/10">
              View certificates
            </Button>
          </Link>
        </section>
      )}
    </div>
  );
}

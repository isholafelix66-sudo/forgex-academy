import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  CalendarClock,
  Flame,
  GraduationCap,
  Percent,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { StatCard } from "@/components/dash/StatCard";
import { CourseCard } from "@/components/site/CourseCard";
import { ProgressRing } from "@/components/site/ProgressRing";
import { EmptyState } from "@/components/site/EmptyState";
import { useAuth } from "@/hooks/use-auth";
import { formatDateShort, timeAgo } from "@/lib/format";

export default function DashboardHome() {
  const { user } = useAuth();
  const enrollments = useQuery(api.learn.myEnrollments);
  const deadlines = useQuery(api.submissions.upcomingDeadlines);
  const announcements = useQuery(api.public.announcementsList);
  const recommendations = useQuery(api.learn.recommendations);

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
          icon={<CalendarClock className="size-5" />}
          label="Upcoming deadlines"
          value={deadlines?.length ?? "—"}
          hint={deadlines && deadlines.length > 0 && deadlines[0] ? `Next: ${formatDateShort(deadlines[0].deadline!)}` : undefined}
        />
        <StatCard
          icon={<Flame className="size-5" />}
          label="Day streak"
          value={streak}
          hint={streak > 0 ? "Complete a lesson daily" : "Start a streak today"}
        />
      </div>

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

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Deadlines */}
        <section>
          <h2 className="font-display mb-4 text-xl font-bold">Upcoming deadlines</h2>
          <div className="space-y-3">
            {deadlines === undefined ? (
              <div className="h-32 animate-pulse rounded-2xl border border-white/8 bg-card" />
            ) : deadlines.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
                No upcoming deadlines — you're all caught up. 🎉
              </p>
            ) : (
              deadlines.map((d) => (
                <Link
                  key={d._id}
                  to={`/dashboard/assignments`}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-card p-4 transition-colors hover:border-lime-400/30"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/12 text-amber-300">
                    <CalendarClock className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.course?.title} · due {formatDateShort(d.deadline!)}
                    </p>
                  </div>
                  {d.submitted ? (
                    <span className="rounded-full bg-lime-400/15 px-2.5 py-1 text-xs font-semibold text-lime-300">
                      Submitted
                    </span>
                  ) : (
                    <span className="rounded-full bg-rose-400/15 px-2.5 py-1 text-xs font-semibold text-rose-300">
                      {Math.ceil((d.deadline! - Date.now()) / 86400000)}d left
                    </span>
                  )}
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Announcements */}
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
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-lime-400/80">
                    {a.category}
                  </span>
                  <span className="text-xs text-muted-foreground">{timeAgo(a.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-sm font-medium">{a.title}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Recommendations */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="size-5 text-lime-300" />
          <h2 className="font-display text-xl font-bold">Recommended for you</h2>
        </div>
        {recommendations && recommendations.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.slice(0, 3).map((c) => (
              <CourseCard key={c._id} course={c} />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-card p-6">
            <GraduationCap className="size-8 shrink-0 text-lime-300" />
            <p className="text-sm text-muted-foreground">
              Enroll in a course to unlock personalized recommendations.
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

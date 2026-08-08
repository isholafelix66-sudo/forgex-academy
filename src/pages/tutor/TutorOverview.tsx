import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  Clock,
  GraduationCap,
  Megaphone,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { StatCard } from "@/components/dash/StatCard";
import { EmptyState } from "@/components/site/EmptyState";
import { StatusChip } from "./status";
import { formatDateShort } from "@/lib/format";

export default function TutorOverview() {
  const courses = useQuery(api.tutor.myCourses);
  const pending = useQuery(api.tutor.pendingSubmissions);
  const students = useQuery(api.tutor.tutorStudents);
  const announcements = useQuery(api.tutor.allAnnouncements);

  const published = courses?.filter((c) => c.published).length ?? 0;
  const totalStudents = courses?.reduce((s, c) => s + (c.totalStudents ?? 0), 0) ?? 0;

  const recent = (courses ?? []).slice(0, 4);
  const recentPending = (pending ?? []).slice(0, 5);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Welcome back, tutor"
        description="Your courses, submissions and students at a glance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<BookOpen className="size-5" />}
          label="Courses"
          value={courses === undefined ? "…" : String(courses.length)}
          hint={`${published} published`}
        />
        <StatCard
          icon={<GraduationCap className="size-5" />}
          label="Total students"
          value={totalStudents.toLocaleString()}
          hint="across your courses"
        />
        <StatCard
          icon={<ClipboardCheck className="size-5" />}
          label="Awaiting grade"
          value={pending === undefined ? "…" : String(pending.length)}
          hint="submissions to review"
        />
        <StatCard
          icon={<Users className="size-5" />}
          label="Active students"
          value={students === undefined ? "…" : String(students.length)}
          hint="unique learners"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent courses */}
        <section className="rounded-2xl border border-white/10 bg-card">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="font-display text-base font-semibold">Your courses</h2>
            <Link to="/tutor/courses">
              <Button variant="ghost" size="sm" className="gap-1 text-lime-300 hover:text-lime-200">
                Manage <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
          {courses === undefined ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl border border-white/8 bg-black/20" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<BookOpen className="size-6" />}
                title="No courses yet"
                description="Create your first course and submit it for admin review."
                action={
                  <Link to="/tutor/courses/new">
                    <Button className="bg-lime-400 font-semibold text-black hover:bg-lime-300">
                      Create a course
                    </Button>
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {recent.map((c) => (
                <Link
                  key={c._id}
                  to={`/tutor/courses/${c._id}`}
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3 transition-colors hover:border-lime-400/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.totalStudents ?? 0} students · {c.lessonsCount} lessons
                      {c.pendingSubmissions > 0 && (
                        <span className="text-amber-300"> · {c.pendingSubmissions} to grade</span>
                      )}
                    </p>
                  </div>
                  <StatusChip status={c.status} published={c.published} />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Pending grading */}
        <section className="rounded-2xl border border-white/10 bg-card">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="font-display text-base font-semibold">Needs grading</h2>
            <Link to="/tutor/grading">
              <Button variant="ghost" size="sm" className="gap-1 text-lime-300 hover:text-lime-200">
                Grade now <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
          {recentPending.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<ClipboardCheck className="size-6" />}
                title="All caught up"
                description="No submissions waiting for a grade. Nice!"
              />
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {recentPending.map((s) => (
                <Link
                  key={s._id}
                  to="/tutor/grading"
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3 transition-colors hover:border-lime-400/40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-400/12 text-amber-300">
                    <Clock className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {s.assignment?.title ?? "Assignment"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.student?.name} · {s.course?.title}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateShort(s.submittedAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Announcements preview */}
      <section className="rounded-2xl border border-white/10 bg-card">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="font-display text-base font-semibold">Latest announcements</h2>
          <Link to="/tutor/announcements">
            <Button variant="ghost" size="sm" className="gap-1 text-lime-300 hover:text-lime-200">
              Manage <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
        {(announcements ?? []).length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            No announcements yet — share news, events or competitions with students.
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {(announcements ?? []).slice(0, 4).map((a) => (
              <div key={a._id} className="flex items-center gap-3 px-5 py-3.5">
                <Megaphone className="size-4 shrink-0 text-lime-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.body}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                    a.published
                      ? "bg-lime-400/12 text-lime-300"
                      : "bg-white/8 text-muted-foreground"
                  }`}
                >
                  {a.published ? "Live" : "Draft"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

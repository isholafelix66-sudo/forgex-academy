import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Progress as ProgressBar } from "@/components/ui/progress";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Avatar } from "@/components/site/Avatar";
import { Users } from "lucide-react";
import { Link } from "react-router";

export default function TutorStudents() {
  const students = useQuery(api.tutor.tutorStudents);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Students"
        description="Everyone learning in your courses, with live progress."
      />

      {students === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          title="No students yet"
          description="When learners enroll in your published courses, they'll show up here."
        />
      ) : (
        <div className="space-y-3">
          {students.map((row) => (
            <div key={row.student?._id} className="rounded-2xl border border-white/10 bg-card p-5">
              <div className="flex items-center gap-3">
                <Avatar name={row.student?.name ?? "Student"} image={row.student?.image} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.student?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.enrolledCourses.length} course{row.enrolledCourses.length !== 1 ? "s" : ""} · avg {Math.round(row.avgProgress)}%
                  </p>
                </div>
                <div className="w-32">
                  <ProgressBar
                    value={row.avgProgress}
                    className="h-1.5 bg-white/10 [&>div]:bg-lime-400"
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-xs font-bold text-lime-300">
                  {Math.round(row.avgProgress)}%
                </span>
              </div>
              <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
                {row.enrolledCourses.map((c) => (
                  <Link
                    key={c.courseId}
                    to={`/courses/${c.courseSlug}`}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-lime-300"
                  >
                    <span className="h-1 w-8 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full rounded-full bg-lime-400"
                        style={{ width: `${c.progress}%` }}
                      />
                    </span>
                    <span className="truncate">{c.courseTitle}</span>
                    <span className="ml-auto shrink-0">{c.progress}% · {c.status}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

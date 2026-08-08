import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { CourseCard } from "@/components/site/CourseCard";
import { EmptyState } from "@/components/site/EmptyState";
import { ProgressRing } from "@/components/site/ProgressRing";

export default function MyCourses() {
  const enrollments = useQuery(api.learn.myEnrollments);

  const inProgress = enrollments?.filter(
    (e) => e.enrollment.status === "in-progress",
  );
  const completed = enrollments?.filter(
    (e) => e.enrollment.status === "completed",
  );

  return (
    <div className="space-y-10">
      <PageHeader
        title="My Courses"
        description="Every course you've enrolled in, with live progress."
        actions={
          <Link to="/courses">
            <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
              Browse more <ArrowRight className="size-4" />
            </Button>
          </Link>
        }
      />

      {enrollments === undefined ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : enrollments.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-6" />}
          title="You haven't enrolled in any courses yet"
          description="Pick a course, hit enroll, and start building your skills."
          action={
            <Link to="/courses">
              <Button className="bg-lime-400 font-semibold text-black hover:bg-lime-300">
                Explore courses
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          {inProgress && inProgress.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {inProgress.map((e) => (
                <CourseCard
                  key={e.course._id}
                  course={{ ...e.course, progress: e.enrollment.progress, status: e.enrollment.status }}
                />
              ))}
            </div>
          )}

          {completed && completed.length > 0 && (
            <section>
              <h2 className="font-display mb-4 text-xl font-bold">
                Completed ({completed.length})
              </h2>
              <div className="space-y-3">
                {completed.map((e) => (
                  <div
                    key={e.course._id}
                    className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-5 sm:flex-row sm:items-center"
                  >
                    <ProgressRing value={100} size={52} stroke={5} />
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-semibold">{e.course.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Completed all {e.lessonCount} lessons
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-lime-400/15 px-3 py-1 text-xs font-semibold text-lime-300">
                      <CheckCircle2 className="size-3.5" /> Certified
                    </span>
                    <Link to={`/dashboard/certificates`}>
                      <Button variant="outline" size="sm" className="border-lime-400/30 text-lime-300 hover:bg-lime-400/10">
                        View certificate
                      </Button>
                    </Link>
                    <Link to={`/learn/${e.course.slug}`}>
                      <Button variant="ghost" size="sm">
                        Review
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

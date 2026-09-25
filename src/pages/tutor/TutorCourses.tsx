import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  BookOpen,
  ExternalLink,
  GraduationCap,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { StatusChip } from "./status";

export default function TutorCourses() {
  const courses = useQuery(api.tutor.myCourses, {});
  const submitCourseForReview = useMutation(api.tutor.submitCourseForReview);
  const deleteCourse = useMutation(api.tutor.deleteCourse);

  return (
    <div className="space-y-8">
      <PageHeader
        title="My courses"
        description="Create, edit and submit courses for admin review."
        actions={
          <Link to="/academy/tutor/courses/new">
            <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
              <Plus className="size-4" /> New course
            </Button>
          </Link>
        }
      />

      {courses === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-6" />}
          title="No courses yet"
          description="Create your first course — it stays a draft until an admin approves it."
          action={
            <Link to="/academy/tutor/courses/new">
              <Button className="bg-lime-400 font-semibold text-black hover:bg-lime-300">
                Create your first course
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {courses.map((c) => (
            <div
              key={c._id}
              className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card p-5 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                  <GraduationCap className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{c.title}</p>
                    <StatusChip status={c.status} published={c.published} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.lessonsCount} lessons · {c.assignmentsCount} assignments ·{" "}
                    {c.totalStudents ?? 0} students
                    {c.pendingSubmissions > 0 && (
                      <span className="text-amber-300"> · {c.pendingSubmissions} to grade</span>
                    )}
                  </p>
                  {c.status === "rejected" && c.reviewNote && (
                    <p className="mt-1 rounded-lg border border-rose-400/20 bg-rose-400/8 px-2.5 py-1 text-xs text-rose-300">
                      Admin note: {c.reviewNote}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {c.published && c.status === "approved" && (
                  <Link to={`/courses/${c.slug}`}>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-lime-300">
                      <ExternalLink className="size-3.5" /> View
                    </Button>
                  </Link>
                )}
                {c.status !== "approved" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-white/15"
                    onClick={() => void submitCourseForReview({ courseId: c._id as never })}
                  >
                    <Send className="size-3.5" /> Submit for review
                  </Button>
                )}
                <Link to={`/tutor/courses/${c._id}`}>
                  <Button variant="outline" size="sm" className="gap-1.5 border-white/15">
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-rose-300"
                  onClick={() => void deleteCourse({ id: c._id as never })}
                  title="Delete course"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

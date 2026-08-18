import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, BookOpen, ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { motion } from "framer-motion";

export default function TeamCourses() {
  // Public published courses list
  const courses = useQuery(api.public.coursesList, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BookOpen className="size-5 text-lime-400" />
        <h2 className="font-display text-lg font-bold text-white">Courses</h2>
      </div>
      <p className="text-sm text-white/40">
        Browse courses available for review. Select a course to review lessons,
        quizzes, resources, and learning objectives.
      </p>

      {!courses ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-lime-400" />
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-card p-8 text-center">
          <BookOpen className="mx-auto size-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No courses available yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course: any) => (
            <motion.div
              key={course._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="group rounded-xl border border-white/5 bg-card p-4 transition-colors hover:border-lime-400/20"
            >
              <h3 className="font-medium text-white line-clamp-1">
                {course.title}
              </h3>
              <p className="mt-1 text-xs text-white/40 line-clamp-2">
                {course.description}
              </p>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-white/30">
                <span className="rounded-md bg-white/5 px-1.5 py-0.5">
                  {course.difficulty}
                </span>
                <span>{course.durationHours}h</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Link
                  to={`/courses/${course.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/50 transition-colors hover:border-lime-400/30 hover:text-white"
                >
                  View <ExternalLink className="size-3" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

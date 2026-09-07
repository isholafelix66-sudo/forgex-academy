import { Link } from "react-router";
import { Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatHours, type Difficulty } from "@/lib/format";
import { Avatar } from "./Avatar";
import { CoverArt } from "./CoverArt";
import { DifficultyBadge } from "./DifficultyBadge";
import { Rating } from "./Rating";

export type CourseCardData = {
  _id: string;
  title: string;
  slug: string;
  subtitle: string;
  difficulty: Difficulty;
  durationHours: number;
  rating: number;
  ratingCount: number;
  enrolledCount: number;
  gradient?: string | null;
  icon?: string | null;
  image?: string | null;
  category?: { name: string; color: string; icon: string } | null;
  tutor?: { name: string; image?: string | null } | null;
  progress?: number;
  status?: string | null;
};

export function CourseCard({ course, className }: { course: CourseCardData; className?: string }) {
  const enrolled = course.progress !== undefined;
  return (
    <Link
      to={`/courses/${course.slug}`}
      className={cn(
        "card-lift group flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-card",
        className,
      )}
    >
      <div className="relative">
        <CoverArt
          gradient={course.gradient}
          icon={course.icon}
          image={course.image}
          slug={course.slug}
          className="h-40 w-full rounded-none border-0"
          iconClassName="text-5xl transition-transform duration-300 group-hover:scale-110"
        />
        <div className="absolute left-3 top-3">
          {course.category && (
            <span className="rounded-full border border-white/15 bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
              {course.category.name}
            </span>
          )}
        </div>
        <div className="absolute right-3 top-3">
          <DifficultyBadge difficulty={course.difficulty} className="bg-black/50 backdrop-blur" />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug transition-colors group-hover:text-lime-300">
            {course.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {course.subtitle}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={course.tutor?.name ?? "?"} image={course.tutor?.image} className="size-6 text-[10px]" />
            <span className="truncate text-xs text-muted-foreground">
              {course.tutor?.name}
            </span>
          </div>
          <Rating value={course.rating} size="xs" />
        </div>

        <div className="flex items-center gap-3 border-t border-white/8 pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {formatHours(course.durationHours)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" />
            {course.enrolledCount.toLocaleString()}
          </span>
          {enrolled && (
            <span
              className={cn(
                "ml-auto inline-flex items-center gap-1.5 text-lime-300",
              )}
            >
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                <span
                  className="block h-full rounded-full bg-lime-400"
                  style={{ width: `${course.progress ?? 0}%` }}
                />
              </span>
              {course.progress}%
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

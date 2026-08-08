import { Link } from "react-router";
import { GraduationCap, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";

export type TutorCardData = {
  _id: string;
  name: string;
  image?: string | null;
  headline?: string | null;
  bio?: string;
  courseCount: number;
  avgRating: number;
  studentCount: number;
};

export function TutorCard({
  tutor,
  className,
}: {
  tutor: TutorCardData;
  className?: string;
}) {
  return (
    <Link
      to={`/tutors/${tutor._id}`}
      className={cn(
        "card-lift group flex flex-col items-center gap-3 rounded-2xl border border-white/8 bg-card p-6 text-center",
        className,
      )}
    >
      <Avatar
        name={tutor.name}
        image={tutor.image}
        className="size-16 text-lg transition-transform duration-300 group-hover:scale-105"
      />
      <div>
        <h3 className="font-display text-base font-semibold group-hover:text-lime-300">
          {tutor.name}
        </h3>
        {tutor.headline && (
          <p className="mt-0.5 text-xs text-muted-foreground">{tutor.headline}</p>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Star className="size-3.5 fill-amber-400 text-amber-400" />
          {tutor.avgRating.toFixed(1)}
        </span>
        <span className="text-white/20">•</span>
        <span className="inline-flex items-center gap-1">
          <GraduationCap className="size-3.5" />
          {tutor.courseCount} courses
        </span>
      </div>
    </Link>
  );
}

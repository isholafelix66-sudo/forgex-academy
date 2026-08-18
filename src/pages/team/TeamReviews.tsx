import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, MessageSquare } from "lucide-react";

export default function TeamReviews() {
  const myTeam = useQuery(api.team.getMyTeam);
  const team = myTeam?.team;

  // Show a placeholder for now — reviews require a courseId context
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="size-5 text-lime-400" />
        <h2 className="font-display text-lg font-bold text-white">Reviews</h2>
      </div>

      <p className="text-sm text-white/40">
        Course reviews submitted by your team. Select a course from the Courses
        tab to review lessons, quizzes, resources, and learning objectives.
      </p>

      <div className="rounded-2xl border border-white/5 bg-card p-8 text-center">
        <MessageSquare className="mx-auto size-8 text-white/20" />
        <p className="mt-3 text-sm text-white/40">
          Go to the Courses tab and select a course to start reviewing.
        </p>
      </div>
    </div>
  );
}

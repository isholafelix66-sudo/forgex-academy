import { Loader2 } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function TeamCourses() {
  const myTeam = useQuery(api.team.getMyTeam);
  const team = myTeam?.team as any;

  if (!team) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-lime-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Course Reviews</h1>
        <p className="mt-0.5 text-sm text-white/50">Review courses submitted by tutors.</p>
      </div>
      <div className="rounded-2xl border border-white/5 bg-card p-8 text-center">
        <p className="text-sm text-white/50">Course review assignments appear here when a tutor submits a course for review. Check the Work tab for assigned review tasks.</p>
      </div>
    </div>
  );
}

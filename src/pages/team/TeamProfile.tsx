import { useTeamAuth } from "@/hooks/use-team-auth";
import { Loader2, UserCircle } from "lucide-react";

export default function TeamProfile() {
  const { teamName, teamSlug, isLoading } = useTeamAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-lime-400" />
      </div>
    );
  }

  if (!teamSlug) {
    return (
      <div className="flex justify-center py-10">
        <p className="text-sm text-muted-foreground">No account data found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <UserCircle className="size-5 text-lime-400" />
        <h2 className="font-display text-lg font-bold text-white">Profile</h2>
      </div>

      <div className="rounded-2xl border border-white/5 bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-full bg-lime-400/10 text-lime-300">
            <UserCircle className="size-8" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-white">
              {teamName || "Team Member"}
            </h3>
            <p className="text-sm text-white/40">{teamSlug}@forgex.team</p>
            <p className="mt-1 text-xs text-lime-400/70">
              Team: {teamSlug}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-card p-6">
        <h4 className="mb-2 text-xs font-semibold text-white/50">
          Team Information
        </h4>
        <div className="space-y-1 text-sm text-white/70">
          <p>
            Department: <span className="text-white/90">{teamName || "N/A"}</span>
          </p>
          <p>
            Team Slug: <span className="text-white/90">{teamSlug}</span>
          </p>
          <p>
            Status: <span className="text-white/90">Active</span>
          </p>
        </div>
      </div>
    </div>
  );
}

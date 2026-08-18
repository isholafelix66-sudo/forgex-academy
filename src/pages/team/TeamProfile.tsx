import { useTeamAuth } from "@/hooks/use-team-auth";
import { Loader2, UserCircle } from "lucide-react";

export default function TeamProfile() {
  const { teamMember, isLoading } = useTeamAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-lime-400" />
      </div>
    );
  }

  if (!teamMember) {
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
              {teamMember.name ?? "Team Member"}
            </h3>
            <p className="text-sm text-white/40">{teamMember.email}</p>
            <p className="mt-1 text-xs text-lime-400/70">
              Team ID: {teamMember.teamId} • Role: {teamMember.role ?? "Member"}
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
            Department: <span className="text-white/90">{teamMember.team?.name ?? "N/A"}</span>
          </p>
          <p>
            Role: <span className="text-white/90">{teamMember.role ?? "Member"}</span>
          </p>
          <p>
            Status: <span className="text-white/90">{teamMember.status ?? "Active"}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

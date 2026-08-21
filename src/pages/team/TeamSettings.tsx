import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2 } from "lucide-react";

const TEAM_INFO: Record<string, string> = {
  academic: "Academic Team",
  "ai-support": "AI Support",
  "tutor-support": "Tutor Support",
  "student-support": "Student Support",
  content: "Content Team",
};

const VALID_ROLES = ["academic", "ai-support", "tutor-support", "student-support", "content"] as const;

export default function TeamSettings() {
  const { user } = useAuth();
  const teamData = useQuery(api.teamAccess.getMyTeamRole);

  if (teamData === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-lime-400" />
      </div>
    );
  }

  const teamRole = teamData?.teamRole;
  const isValidRole = teamRole && VALID_ROLES.includes(teamRole as typeof VALID_ROLES[number]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-white">Settings</h2>
        <p className="mt-1 text-sm text-white/40">
          Your team workspace settings.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-card p-6">
        <h3 className="font-display text-sm font-bold text-white">Account Info</h3>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-sm text-white/60">Email</p>
            <p className="text-sm font-medium text-white">{user?.email}</p>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-sm text-white/60">Team Role</p>
            <p className="text-sm font-medium text-lime-300">
              {teamRole ? TEAM_INFO[teamRole] || teamRole : "Not assigned"}
            </p>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-sm text-white/60">Account Type</p>
            <p className="text-sm font-medium text-white capitalize">{user?.role || "Student"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

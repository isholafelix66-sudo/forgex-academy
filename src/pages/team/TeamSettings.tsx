import { useAuth } from "@/hooks/use-auth";
import { getTeamRole } from "@/components/RequireTeamAuth";

const TEAM_INFO: Record<string, string> = {
  academic: "Academic Support",
  "ai-support": "AI Support",
  "tutor-support": "Tutor Support",
  "student-support": "Student Support",
};

export default function TeamSettings() {
  const { user } = useAuth();
  const teamRole = getTeamRole(user as unknown as Record<string, unknown>);

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

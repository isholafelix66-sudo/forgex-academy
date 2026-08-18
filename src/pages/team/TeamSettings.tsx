import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "react-router";
import { Loader2, Settings, LogOut } from "lucide-react";

export default function TeamSettings() {
  const { user, signOut } = useAuth();
  const myTeam = useQuery(api.team.getMyTeam);
  const team = myTeam?.team as any;
  const membership = myTeam?.membership as any;

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/team";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="size-5 text-lime-400" />
        <h2 className="font-display text-lg font-bold text-white">Settings</h2>
      </div>

      <div className="rounded-2xl border border-white/5 bg-card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white/80">Account</h3>
        <div className="space-y-2">
          <Link
            to="/dashboard/settings"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
          >
            General Account Settings
          </Link>
          <Link
            to="/dashboard/profile"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
          >
            Student Profile
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white/80">Team</h3>        {team && (
          <div className="text-sm text-white/40">
            <p>
              Team: <span className="text-white/70">{team.name}</span>
            </p>
            <p>
              Role: {" "}
              <span className="text-white/70">
                {membership?.role === "teamLead" ? "Team Lead" : "Member"}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/5 bg-card p-6">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-red-400 transition-colors hover:bg-red-500/10"
        >
          <LogOut className="size-4" />
          Sign out of Team Workspace
        </button>
      </div>
    </div>
  );
}

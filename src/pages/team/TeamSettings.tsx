import { useTeamAuth } from "@/hooks/use-team-auth";
import { Loader2, Settings, LogOut, AlertTriangle } from "lucide-react";
import { useState } from "react";

export default function TeamSettings() {
  const { teamName, teamSlug, isLoading, logout } = useTeamAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } catch (err) {
      console.error("Sign out failed:", err);
    } finally {
      setSigningOut(false);
      window.location.href = "/team";
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-lime-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="size-5 text-lime-400" />
        <h2 className="font-display text-lg font-bold text-white">Settings</h2>
      </div>

      <div className="rounded-2xl border border-white/5 bg-card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white/80">Account</h3>
        <div className="space-y-1 text-sm text-white/60">
          <p>
            Team: <span className="text-white/80">{teamName}</span>
          </p>
          <p>
            Team Slug: <span className="text-white/80">{teamSlug}</span>
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-card p-6 space-y-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white/80">
          <AlertTriangle className="size-4 text-amber-400" />
          Danger Zone
        </h3>
        <p className="text-xs text-white/40">
          Signing out will end your team session. You'll need the team password
          to sign back in.
        </p>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2.5 text-sm font-medium text-rose-300 transition-colors hover:bg-rose-400/20 disabled:opacity-50"
        >
          {signingOut ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
          Sign Out
        </button>
      </div>
    </div>
  );
}

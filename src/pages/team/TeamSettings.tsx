import { useParams, useNavigate } from "react-router";
import { useTeamWorkspace } from "@/hooks/use-team-workspace";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function TeamSettings() {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const { logout } = useTeamWorkspace(teamSlug || "");
  const navigate = useNavigate();

  const handleLock = () => {
    logout();
    navigate("/team");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-white">Settings</h2>
        <p className="mt-1 text-sm text-white/40">Manage your workspace session.</p>
      </div>
      <div className="rounded-2xl border border-white/5 bg-card p-6">
        <h3 className="font-display text-sm font-bold text-white">Lock Workspace</h3>
        <p className="mt-1 text-xs text-white/40">Locking this workspace will require the password again to access it.</p>
        <Button variant="destructive" className="mt-4 gap-2" onClick={handleLock}>
          <LogOut className="size-4" /> Lock Workspace
        </Button>
      </div>
    </div>
  );
}

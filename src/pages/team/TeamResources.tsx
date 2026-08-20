import { Loader2 } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTeamAuth } from "@/hooks/use-team-auth";

export default function TeamResources() {
  const { token } = useTeamAuth();
  const workspace = useQuery(
    api.teamAuthWorkspace.getTeamWorkspace,
    token ? { token } : "skip",
  );
  const team = workspace?.team;

  if (!team) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-lime-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Resources</h1>
        <p className="mt-0.5 text-sm text-white/50">
          Shared team resources and documents.
        </p>
      </div>
      <div className="rounded-2xl border border-white/5 bg-card p-8 text-center">
        <p className="text-sm text-white/50">
          Team resources will appear here as your team adds them.
        </p>
      </div>
    </div>
  );
}

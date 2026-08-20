import { Navigate, useParams } from "react-router";
import { useTeamWorkspace } from "@/hooks/use-team-workspace";
import { Loader2 } from "lucide-react";

/**
 * Guard for team dashboard routes.
 * Validates workspace token and redirects to password screen if not unlocked.
 */
export function RequireTeamAuth({ children }: { children: React.ReactNode }) {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const { isUnlocked, isLoading } = useTeamWorkspace(teamSlug || "");

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-lime-400" />
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">ForgeX Team</p>
        </div>
      </div>
    );
  }

  if (!isUnlocked) {
    return <Navigate to={`/team/access/${teamSlug || ""}`} replace />;
  }

  return <>{children}</>;
}

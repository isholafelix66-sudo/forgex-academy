import { Navigate, useLocation, useParams } from "react-router";
import { useTeamAuth } from "@/hooks/use-team-auth";

/**
 * Guard for team dashboard routes.
 * Verifies the user has a valid team session AND is accessing their own team's route.
 * Redirects unauthenticated users to /team/login.
 * Redirects users accessing wrong team routes to their own workspace.
 */
export function RequireTeamAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, teamMember } = useTeamAuth();
  const location = useLocation();
  const { teamSlug } = useParams<{ teamSlug: string }>();

  // Show loading while auth state is resolving
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-9 animate-spin rounded-full border-2 border-lime-400/20 border-t-lime-400" />
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            ForgeX Team
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Never redirect if already on the login page — prevents loops
    if (location.pathname === "/team/login") {
      return <>{children}</>;
    }
    return (
      <Navigate
        to={`/team/login?returnTo=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  // Role-based routing: ensure user is accessing their own team's route
  if (teamSlug && teamMember?.teamSlug && teamSlug !== teamMember.teamSlug) {
    // User is trying to access another team's workspace — redirect to their own
    return <Navigate to={`/team/${teamMember.teamSlug}`} replace />;
  }

  // If no teamSlug in URL (shouldn't happen for protected routes), redirect to their workspace
  if (!teamSlug && teamMember?.teamSlug) {
    return <Navigate to={`/team/${teamMember.teamSlug}`} replace />;
  }

  return <>{children}</>;
}

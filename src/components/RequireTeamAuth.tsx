import { Navigate, useLocation, useParams } from "react-router";
import { useTeamHubAuth } from "@/hooks/use-team-hub-auth";

/**
 * Guard for team dashboard routes.
 * Uses the new Team Hub password-based session.
 * Verifies the user has a valid session AND is accessing their own team's route.
 */
export function RequireTeamAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, teamSlug: activeTeamSlug } = useTeamHubAuth();
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
    // Never redirect if already on a password or login page — prevents loops
    if (
      location.pathname.startsWith("/team/access") ||
      location.pathname === "/team/login"
    ) {
      return <>{children}</>;
    }
    return (
      <Navigate
        to={`/team/access/${teamSlug || ""}`}
        replace
      />
    );
  }

  // Role-based routing: ensure user is accessing their own team's route
  if (teamSlug && activeTeamSlug && teamSlug !== activeTeamSlug) {
    return <Navigate to={`/team/${activeTeamSlug}`} replace />;
  }

  return <>{children}</>;
}

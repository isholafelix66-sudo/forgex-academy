import { Navigate, useLocation } from "react-router";
import { useTeamAuth } from "@/hooks/use-team-auth";

/**
 * Guard for team dashboard routes. Completely independent from Academy auth.
 * Redirects unauthenticated team users to /team/login.
 * Uses Clerk for authentication — no redirect loops.
 */
export function RequireTeamAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useTeamAuth();
  const location = useLocation();

  // Show loading while auth state is resolving (Clerk + team session)
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

  return <>{children}</>;
}

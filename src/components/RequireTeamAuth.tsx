import { useEffect } from "react";
import { Navigate, useLocation } from "react-router";
import { useTeamAuth } from "@/hooks/use-team-auth";

/**
 * Guard for team dashboard routes. Completely independent from Academy auth.
 * Redirects unauthenticated team users to /team/login.
 */
export function RequireTeamAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useTeamAuth();
  const location = useLocation();

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
    return (
      <Navigate
        to={`/team/login?returnTo=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  return <>{children}</>;
}

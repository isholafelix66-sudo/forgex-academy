import { useAuth } from "@/hooks/use-auth";
import { Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation, Link } from "react-router";

const TEAM_ROLES = ["academic", "ai-support", "tutor-support", "student-support"] as const;

/**
 * Guard for team dashboard routes.
 * Checks: authenticated → has teamRole → can access.
 * Admins bypass the teamRole check.
 */
export function RequireTeamAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-lime-400" />
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            ForgeX Team
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  // Admins can access any team
  if (user?.role === "admin") return <>{children}</>;

  const teamRole = (user as Record<string, unknown> | undefined)
    ?.teamRole as string | undefined;

  if (
    !teamRole ||
    !TEAM_ROLES.includes(teamRole as (typeof TEAM_ROLES)[number])
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-card p-8 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-400/12 text-amber-300">
            <ShieldAlert className="size-7" />
          </span>
          <h1 className="font-display mt-5 text-2xl font-bold">
            Team access not approved
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your account is verified, but team access has not been approved by
            an administrator. Please contact your admin to get assigned a team
            role.
          </p>
          <Link
            to="/dashboard"
            className="mt-6 inline-flex items-center justify-center rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
          >
            Student Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/** Extract a valid teamRole from a user object, or null. */
export function getTeamRole(
  user: Record<string, unknown> | undefined | null,
): string | null {
  const role = user?.teamRole as string | undefined;
  if (
    !role ||
    !["academic", "ai-support", "tutor-support", "student-support"].includes(
      role,
    )
  )
    return null;
  return role;
}

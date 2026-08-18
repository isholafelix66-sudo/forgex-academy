import type { ReactNode } from "react";
import { Navigate, useLocation, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router";

/**
 * Guard that verifies the signed-in user has an active team membership
 * matching the :teamSlug in the URL. Admins are granted access to any team.
 */
export function RequireTeam({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const location = useLocation();
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const myTeam = useQuery(api.team.getMyTeam, isAuthenticated ? {} : "skip");

  if (isLoading || myTeam === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
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

  // Admins bypass team membership check
  if (user?.role === "admin") {
    return children;
  }

  if (!myTeam?.team || myTeam.membership?.status !== "active") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-card p-8 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-lime-400/12 text-lime-300">
            <ShieldCheck className="size-7" />
          </span>
          <h1 className="font-display mt-5 text-2xl font-bold">
            Team access required
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            You don&rsquo;t have an active team membership. Apply to join a
            team or check your application status.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              to="/team/register"
              className="inline-flex items-center justify-center rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-300"
            >
              Apply to Join
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
            >
              Student Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Verify the URL slug matches the user's team
  const teamData = myTeam.team as { slug: string } | undefined;
  if (teamSlug && teamData?.slug && teamData.slug !== teamSlug) {
    return <Navigate to={`/team/${teamData.slug}`} replace />;
  }

  return children;
}

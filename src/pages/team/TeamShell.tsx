import { useEffect } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

export default function TeamShell() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const myTeam = useQuery(api.team.getMyTeam);
  const location = useLocation();

  if (authLoading || myTeam === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-lime-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(location.pathname);
    return <Navigate to={`/auth?returnTo=${returnTo}`} replace />;
  }

  // Non-admin users must be active team members
  if (user?.role !== "admin" && (!myTeam?.team || myTeam.membership?.status !== "active")) {
    return <Navigate to="/team" replace />;
  }

  return <Outlet />;
}

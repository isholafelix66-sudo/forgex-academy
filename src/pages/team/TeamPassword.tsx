import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router";

/**
 * Legacy /team/access/:teamSlug route — now simply redirects to the team
 * dashboard. The old password-gated flow has been replaced by Convex Auth.
 */
export default function TeamPassword() {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-lime-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth?returnTo=/team" replace />;
  }

  const teamRole = (user as Record<string, unknown> | undefined)
    ?.teamRole as string | undefined;

  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  if (teamRole) {
    return <Navigate to={`/team/${teamRole}`} replace />;
  }

  return <Navigate to="/team" replace />;
}

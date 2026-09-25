import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router";

const VALID_ROLES = ["academic", "ai-support", "tutor-support", "student-support", "content"] as const;

const TEAM_ROLE_INFO: Record<string, { name: string; icon: string; description: string }> = {
  academic: { name: "Academic Team", icon: "📚", description: "Course review, academic quality, and curriculum standards." },
  "ai-support": { name: "AI Support", icon: "🤖", description: "AI Hub management, tool curation, and prompt library." },
  "tutor-support": { name: "Tutor Support", icon: "🎓", description: "Tutor onboarding, support tickets, and tutor issues." },
  "student-support": { name: "Student Support", icon: "💚", description: "Student-facing support, issues, and student experience." },
  content: { name: "Content Team", icon: "📝", description: "Content management, resources, and platform content." },
};

export default function TeamHub() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const teamData = useQuery(api.teamAccess.getMyTeamRole);

  if (authLoading || (isAuthenticated && teamData === undefined)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-lime-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/academy/login?returnTo=/team" replace />;
  }

  // Admins go to admin panel
  if (user?.role === "admin") {
    return <Navigate to="/academy/admin" replace />;
  }

  const teamRole = teamData?.teamRole;

  if (teamRole && VALID_ROLES.includes(teamRole as typeof VALID_ROLES[number])) {
    return <Navigate to={`/team/${teamRole}`} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-card p-8 text-center">
        <h1 className="font-display text-2xl font-bold">Team Workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account does not have an assigned team role. Please contact your
          administrator.
        </p>
      </div>
    </div>
  );
}

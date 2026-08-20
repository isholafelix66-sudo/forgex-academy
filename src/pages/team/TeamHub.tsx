import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router";

const TEAM_ROLES = [
  { slug: "academic", name: "Academic Support", icon: "📚", description: "Academic operations, course quality, and learning support." },
  { slug: "ai-support", name: "AI Support", icon: "🤖", description: "AI Hub, prompt resources, and AI-related tools." },
  { slug: "tutor-support", name: "Tutor Support", icon: "🎓", description: "Tutor-related support, onboarding, and tutor issues." },
  { slug: "student-support", name: "Student Support", icon: "💚", description: "Student-facing support, issues, and student experience." },
] as const;

export default function TeamHub() {
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

  // Admins see all workspaces
  if (user?.role === "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Navigate to="/admin" replace />
      </div>
    );
  }

  const teamRole = (user as Record<string, unknown> | undefined)
    ?.teamRole as string | undefined;

  if (teamRole) {
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

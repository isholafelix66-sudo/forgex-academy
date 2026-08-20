import { useState, useCallback, useEffect } from "react";
import { useParams, Link, Navigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTeamHubAuth } from "@/hooks/use-team-hub-auth";

const TEAM_LABELS: Record<string, string> = {
  academic: "Academic Team",
  "tutor-support": "Tutor Support",
  "student-support": "Student Support",
  content: "Content Team",
  "ai-prompts": "AI & Prompt Team",
};

export default function TeamPassword() {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const { isAuthenticated, isLoading: authLoading, teamSlug: activeTeam, login } = useTeamHubAuth();
  const teams = useQuery(api.teamAccess.listTeams);
  const seedMutation = useMutation(api.teamAccess.seedTeamAccess);

  // Ensure team access records are seeded (for direct-link visits)
  useEffect(() => {
    seedMutation();
  }, [seedMutation]);

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated for this team, go to the dashboard
  if (!authLoading && isAuthenticated && activeTeam === teamSlug) {
    return <Navigate to={`/team/${teamSlug}`} replace />;
  }

  // If authenticated for a different team, redirect there
  if (!authLoading && isAuthenticated && activeTeam && activeTeam !== teamSlug) {
    return <Navigate to={`/team/${activeTeam}`} replace />;
  }

  const team = teams?.find((t) => t.slug === teamSlug);
  const teamName = TEAM_LABELS[teamSlug || ""] || team?.name || "Team";

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamSlug) return;
    setError(null);
    setSubmitting(true);

    try {
      // Use the hook's login() which calls the mutation AND stores the
      // token in localStorage so RequireTeamAuth can find it on redirect.
      await login(teamSlug, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("currently unavailable")) {
        setError("This team is currently unavailable. Please contact the Admin.");
      } else if (msg.includes("not found")) {
        setError("Team not found.");
      } else if (msg.includes("Incorrect")) {
        setError("Incorrect team password. Please try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [teamSlug, password, login]);

  // Loading teams list
  if (teams === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-lime-400" />
      </div>
    );
  }

  // Team not found
  if (team && !team.isActive) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/5">
            <Lock className="size-7 text-red-400" />
          </div>
          <h1 className="font-display text-xl font-bold text-white">
            Team Unavailable
          </h1>
          <p className="mt-2 text-sm text-white/40">
            This team is currently unavailable. Please contact the Admin.
          </p>
          <Link
            to="/team"
            className="mt-6 inline-flex items-center gap-2 text-sm text-lime-400 hover:text-lime-300"
          >
            <ArrowLeft className="size-4" /> Back to Team Hub
          </Link>
        </div>
      </div>
    );
  }

  if (!teamSlug || (!team && teams.length > 0)) {
    return <Navigate to="/team" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Link
          to="/team"
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back to Team Hub
        </Link>

        <div className="rounded-3xl border border-white/10 bg-card p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/5">
              <Lock className="size-7 text-lime-400" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white">
              {teamName}
            </h1>
            <p className="mt-2 text-sm text-white/40">
              Enter your team password to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/60">
                Team Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/30" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter team password"
                  className="h-11 border-white/10 bg-white/5 pl-10 pr-10 text-white placeholder:text-white/20"
                  autoFocus
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white/60"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-400/25 bg-red-400/8 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting || !password}
              className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Enter Team Workspace"
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

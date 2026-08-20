import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { useTeamAuth } from "@/hooks/use-team-auth";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function TeamLogin() {
  const { isAuthenticated, isLoading: authLoading, teamSlug, login } = useTeamAuth();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "";

  const [teamId, setTeamId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If already authenticated, redirect to workspace
  if (!authLoading && isAuthenticated) {
    const dest = returnTo || (teamSlug ? `/team/${teamSlug}` : "/team");
    return <Navigate to={dest} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // The new hook expects teamSlug as the first argument
      // Map the teamId input to a slug-like value
      const slug = teamId.trim().toLowerCase().replace(/\s+/g, "-");
      await login(slug, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("currently unavailable")) {
        setError("This team is currently unavailable. Please contact the Admin.");
      } else if (msg.includes("not found")) {
        setError("Team not found.");
      } else if (msg.includes("Incorrect")) {
        setError("Incorrect team password. Please try again.");
      } else {
        setError("We couldn't sign you in right now. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

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
              Team Sign In
            </h1>
            <p className="mt-2 text-sm text-white/40">
              Enter your team password to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/60">
                Team
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/30" />
                <Input
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  placeholder="e.g. academic"
                  className="h-11 border-white/10 bg-white/5 pl-10 text-white lowercase placeholder:text-white/20"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-white/60">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/30" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter team password"
                  className="h-11 border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/20"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-400/25 bg-red-400/8 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting || !teamId.trim() || !password}
              className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Login to Team Workspace"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-white/30">
            Contact your Admin if you need access or have forgotten your
            password.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

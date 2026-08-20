import { useState, useCallback } from "react";
import { useParams, Link, Navigate } from "react-router";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTeamWorkspace } from "@/hooks/use-team-workspace";

const WORKSPACE_LABELS: Record<string, string> = {
  academic: "Academic Support",
  "ai-support": "AI Support",
  "tutor-support": "Tutor Support",
  "student-support": "Student Support",
};

export default function TeamPassword() {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const { isUnlocked, isLoading, unlock } = useTeamWorkspace(teamSlug || "");

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // If already unlocked, go straight to the dashboard
  if (!isLoading && isUnlocked) {
    return <Navigate to={`/team/${teamSlug}`} replace />;
  }

  if (!teamSlug || !WORKSPACE_LABELS[teamSlug]) {
    return <Navigate to="/team" replace />;
  }

  const workspaceName = WORKSPACE_LABELS[teamSlug];

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await unlock(password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("currently unavailable")) {
        setError("This workspace is currently unavailable.");
      } else if (msg.includes("Incorrect")) {
        setError("Incorrect password. Please try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [password, unlock]);

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
            <h1 className="font-display text-2xl font-bold text-white">{workspaceName}</h1>
            <p className="mt-2 text-sm text-white/40">Enter workspace password</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/30" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
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
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
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
              {submitting ? <Loader2 className="size-4 animate-spin" /> : "Unlock Workspace"}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

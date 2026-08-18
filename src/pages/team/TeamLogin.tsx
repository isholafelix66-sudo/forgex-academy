import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTeamAuth } from "@/hooks/use-team-auth";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Lock,
  KeyRound,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function TeamLogin() {
  const { isAuthenticated, isLoading: authLoading, login } = useTeamAuth();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/team/dashboard";

  const teamLogin = useMutation(api.teamAuth.teamLogin);

  const [teamId, setTeamId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mustChange, setMustChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changeSaving, setChangeSaving] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);

  const changePassword = useMutation(api.teamAuth.teamChangePassword);

  // If already authenticated, redirect to dashboard
  if (!authLoading && isAuthenticated) {
    return <Navigate to={returnTo} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId.trim() || !password.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const result = await teamLogin({
        teamId: teamId.trim().toUpperCase(),
        password,
      });
      if (result.mustChangePassword) {
        // Store token and show change password form
        login(result.token);
        setMustChange(true);
      } else {
        login(result.token);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim() || newPassword.length < 8) return;
    setChangeSaving(true);
    setChangeError(null);
    try {
      await changePassword({
        token: "",
        currentPassword: password,
        newPassword: newPassword.trim(),
      });
      // Force re-login with new password
      window.location.reload();
    } catch (err) {
      setChangeError(
        err instanceof Error
          ? err.message
          : "Could not change password. Please try again.",
      );
    } finally {
      setChangeSaving(false);
    }
  };

  // Must change password screen
  if (mustChange) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-3xl border border-white/10 bg-card p-8"
        >
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/5">
              <KeyRound className="size-7 text-amber-400" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white">
              Create New Password
            </h1>
            <p className="mt-2 text-sm text-white/40">
              You must create a new password before continuing.
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">
                New Password
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                minLength={8}
                required
              />
            </div>

            {changeError && (
              <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                {changeError}
              </p>
            )}

            <Button
              type="submit"
              disabled={changeSaving || newPassword.length < 8}
              className="w-full bg-lime-400 text-black hover:bg-lime-300"
            >
              {changeSaving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 size-4" />
              )}
              Set New Password
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Back link */}
        <Link
          to="/team"
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back to Team Entry
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
              Sign in with your Team ID and password.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">
                Team ID
              </label>
              <Input
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                placeholder="e.g. FX-A1B2C3"
                className="border-white/10 bg-white/5 font-mono text-white placeholder:text-white/30"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="border-white/10 bg-white/5 pr-10 text-white placeholder:text-white/30"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
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
              <div className="flex items-start gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={saving || !teamId.trim() || !password.trim()}
              className="w-full bg-lime-400 text-black hover:bg-lime-300"
            >
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Lock className="mr-2 size-4" />
              )}
              Sign In
            </Button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-3 text-sm">
            <Link
              to="/team/forgot-password"
              className="text-white/40 hover:text-lime-300"
            >
              Forgot your password?
            </Link>
            <p className="text-white/30">
              Don&apos;t have an account?{" "}
              <Link
                to="/team/register"
                className="text-lime-400/80 hover:text-lime-300"
              >
                Apply here
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

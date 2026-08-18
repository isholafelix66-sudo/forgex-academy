import { useState } from "react";
import { Link } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  KeyRound,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function TeamForgotPassword() {
  const submitRecovery = useMutation(api.teamAuth.teamRequestPasswordRecovery);

  const [form, setForm] = useState({
    teamId: "",
    name: "",
    email: "",
    reason: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.teamId.trim() ||
      !form.name.trim() ||
      !form.email.trim() ||
      !form.reason.trim()
    )
      return;
    setSaving(true);
    setError(null);
    try {
      await submitRecovery({
        teamId: form.teamId.trim().toUpperCase(),
        name: form.name.trim(),
        email: form.email.trim(),
        reason: form.reason.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not submit request. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-3xl border border-white/10 bg-card p-8 text-center"
        >
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-green-500/10">
            <CheckCircle2 className="size-8 text-green-400" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">
            Request Submitted
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/50">
            Your password recovery request has been submitted. An administrator
            will review your request manually. You will receive a new temporary
            password if approved.
          </p>
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300/80">
            ⚠️ This process requires manual admin verification for security.
            Automatic password resets are not available.
          </div>
          <div className="mt-6">
            <Link to="/team/login">
              <Button className="w-full bg-lime-400 text-black hover:bg-lime-300">
                Back to Sign In
              </Button>
            </Link>
          </div>
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
        <Link
          to="/team/login"
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back to Sign In
        </Link>

        <div className="rounded-3xl border border-white/10 bg-card p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/5">
              <KeyRound className="size-7 text-amber-400" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white">
              Forgot Password
            </h1>
            <p className="mt-2 text-sm text-white/40">
              Submit a recovery request. An admin will verify and provide a new
              password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">
                Team ID *
              </label>
              <Input
                value={form.teamId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, teamId: e.target.value }))
                }
                placeholder="e.g. FX-A1B2C3"
                className="border-white/10 bg-white/5 font-mono text-white placeholder:text-white/30"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">
                Your Name *
              </label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Your full name"
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">
                Email Address *
              </label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="you@example.com"
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/50">
                Reason for Recovery *
              </label>
              <Textarea
                value={form.reason}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reason: e.target.value }))
                }
                placeholder="Explain why you need a password reset..."
                rows={3}
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                required
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={
                saving ||
                !form.teamId.trim() ||
                !form.name.trim() ||
                !form.email.trim() ||
                !form.reason.trim()
              }
              className="w-full bg-lime-400 text-black hover:bg-lime-300"
            >
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 size-4" />
              )}
              Submit Recovery Request
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

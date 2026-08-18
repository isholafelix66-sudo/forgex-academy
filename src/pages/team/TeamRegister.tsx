import { useState } from "react";
import { Link } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Send,
  Users,
  AlertCircle,
  Copy,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function TeamRegister() {
  const submitApp = useMutation(api.teamAuth.registerTeamAccount);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    skill: "",
    preferredTeamId: "",
    introduction: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{
    teamId: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.skill.trim() ||
      !form.introduction.trim()
    )
      return;
    setSaving(true);
    setError(null);
    try {
      const result = await submitApp({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        skill: form.skill.trim(),
        preferredTeamId: form.preferredTeamId || undefined,
        introduction: form.introduction.trim(),
      });
      setCredentials({ teamId: result.teamId, password: result.password });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create account. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const copyCredentials = () => {
    if (!credentials) return;
    navigator.clipboard.writeText(
      `Team ID: ${credentials.teamId}\nPassword: ${credentials.password}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Show credentials after successful registration
  if (credentials) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg rounded-3xl border border-white/10 bg-card p-8 text-center"
        >
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-green-500/10">
            <CheckCircle2 className="size-8 text-green-400" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">
            Account Created Successfully
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/50">
            Your team account has been created and is pending admin approval.
            Save your credentials below — you will need them to log in.
          </p>

          {/* Credentials display */}
          <div className="mt-6 rounded-2xl border border-lime-400/20 bg-lime-400/5 p-5 text-left">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-lime-400">
              <KeyRound className="size-4" />
              Your Team Credentials
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-white/40">Team ID</p>
                <p className="font-mono text-lg font-bold text-white">
                  {credentials.teamId}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-white/40">Password</p>
                <p className="font-mono text-lg font-bold text-lime-300">
                  {credentials.password}
                </p>
              </div>
            </div>
            <button
              onClick={copyCredentials}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="size-4 text-green-400" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="size-4" /> Copy Credentials
                </>
              )}
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300/80">
            ⚠️ Save these credentials now. Your password will not be shown again.
            An admin must approve your account before you can log in.
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <Link to="/team/login">
              <Button className="w-full bg-lime-400 text-black hover:bg-lime-300">
                Go to Team Sign In
              </Button>
            </Link>
            <Link to="/team">
              <Button
                variant="outline"
                className="w-full border-white/10 text-white/60"
              >
                Back to Team Entry
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link
            to="/team"
            className="flex items-center gap-2 text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            <span className="text-sm font-medium">Team Workspace</span>
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-lime-400/10 font-display text-sm font-bold text-lime-400">
              F
            </div>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/5">
              <Users className="size-7 text-lime-400" />
            </div>
            <h1 className="font-display text-3xl font-bold text-white">
              Create Team Account
            </h1>
            <p className="mt-2 text-sm text-white/40">
              Apply to join the ForgeX team. No Academy account needed.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-2xl border border-white/5 bg-card p-6 space-y-4">
              <h2 className="text-sm font-semibold text-white/80">
                Personal Information
              </h2>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">
                  Full Name *
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
                  Phone Number{" "}
                  <span className="text-white/30">(optional)</span>
                </label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+234..."
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-card p-6 space-y-4">
              <h2 className="text-sm font-semibold text-white/80">
                Team Preferences
              </h2>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">
                  Area of Interest / Skill *
                </label>
                <Input
                  value={form.skill}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, skill: e.target.value }))
                  }
                  placeholder="e.g. Content Writing, UI Design, AI Research"
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">
                  Short Introduction *
                </label>
                <Textarea
                  value={form.introduction}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      introduction: e.target.value,
                    }))
                  }
                  placeholder="Tell us about yourself and why you want to join the team..."
                  rows={3}
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={
                saving ||
                !form.name.trim() ||
                !form.email.trim() ||
                !form.skill.trim() ||
                !form.introduction.trim()
              }
              className="w-full bg-lime-400 text-black hover:bg-lime-300"
            >
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              Create Team Account
            </Button>

            <p className="text-center text-xs text-white/30">
              Already have a team account?{" "}
              <Link
                to="/team/login"
                className="text-lime-400/80 hover:text-lime-300"
              >
                Sign in here
              </Link>
            </p>
          </form>
        </motion.div>
      </main>
    </div>
  );
}

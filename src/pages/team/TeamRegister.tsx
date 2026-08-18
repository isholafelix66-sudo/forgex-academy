import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { friendlyError } from "@/lib/errors";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Send,
  Users,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function TeamRegister() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const teams = useQuery(api.team.listAllTeams);
  const submitApp = useMutation(api.team.submitApplication);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    skill: "",
    preferredTeamId: "",
    introduction: "",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.skill.trim() || !form.introduction.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await submitApp({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        skill: form.skill.trim(),
        preferredTeamId: form.preferredTeamId ? (form.preferredTeamId as any) : undefined,
        introduction: form.introduction.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(friendlyError(err, "Could not submit application."));
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
            Application Submitted
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/50">
            Your application has been submitted successfully. An administrator
            will review your application before you can access the ForgeX Team
            Workspace.
          </p>
          <p className="mt-2 text-xs text-white/30">
            You&rsquo;ll be notified once your application is reviewed.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Link to="/team">
              <Button className="w-full bg-lime-400 text-black hover:bg-lime-300">
                Back to Team Entry
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="outline" className="w-full border-white/10 text-white/60">
                Go to Student Dashboard
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
          <Link to="/team" className="flex items-center gap-2 text-white/60 transition-colors hover:text-white">
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/5">
              <Users className="size-7 text-lime-400" />
            </div>
            <h1 className="font-display text-3xl font-bold text-white">
              Create Team Account
            </h1>
            <p className="mt-2 text-sm text-white/40">
              Apply to join the ForgeX team. An admin will review your
              application before granting access.
            </p>
          </div>

          {!authLoading && !isAuthenticated && (
            <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-amber-300">
                    Sign in required
                  </p>
                  <p className="mt-1 text-xs text-amber-300/60">
                    You need a ForgeX Academy account to apply.{" "}
                    <Link to="/auth?returnTo=/team/register" className="underline hover:text-amber-200">
                      Sign in or create one first
                    </Link>.
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-2xl border border-white/5 bg-card p-6 space-y-4">
              <h2 className="text-sm font-semibold text-white/80">Personal Information</h2>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">Full Name *</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Your full name"
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">Email Address *</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com"
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">Phone Number (optional)</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+234..."
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-card p-6 space-y-4">
              <h2 className="text-sm font-semibold text-white/80">Team Preferences</h2>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">Area of Interest / Skill *</label>
                <Input
                  value={form.skill}
                  onChange={(e) => setForm((f) => ({ ...f, skill: e.target.value }))}
                  placeholder="e.g. Content Writing, UI Design, AI Research"
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">Preferred Team</label>
                <select
                  value={form.preferredTeamId}
                  onChange={(e) => setForm((f) => ({ ...f, preferredTeamId: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                >
                  <option value="">No preference</option>
                  {teams?.filter((t: any) => t.status === "active").map((t: any) => (
                    <option key={t._id} value={t._id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">Short Introduction *</label>
                <Textarea
                  value={form.introduction}
                  onChange={(e) => setForm((f) => ({ ...f, introduction: e.target.value }))}
                  placeholder="Tell us about yourself and why you want to join the team..."
                  rows={3}
                  className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                  required
                />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              disabled={saving || !form.name.trim() || !form.email.trim() || !form.skill.trim() || !form.introduction.trim()}
              className="w-full bg-lime-400 text-black hover:bg-lime-300"
            >
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              Submit Application
            </Button>

            <p className="text-center text-xs text-white/30">
              Already have a team account?{" "}
              <Link to="/team/login" className="text-lime-400/80 hover:text-lime-300">
                Sign in here
              </Link>
            </p>
          </form>
        </motion.div>
      </main>
    </div>
  );
}

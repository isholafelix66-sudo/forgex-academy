import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { friendlyError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Send,
} from "lucide-react";

export default function TeamApply() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const teams = useQuery(api.team.listAllTeams);
  const submitApplication = useMutation(api.team.submitApplication);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    skill: "",
    preferredTeamId: "" as string,
    introduction: "",
  });
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/auth?returnTo=/team/create", { replace: true });
    return null;
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-lg px-6 py-20 text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-lime-500/10">
            <CheckCircle2 className="size-8 text-lime-400" />
          </div>
          <h1 className="mb-3 text-2xl font-bold text-white">
            Application Submitted
          </h1>
          <p className="mb-8 text-sm text-white/60">
            Your application has been submitted. An administrator will review
            your application before you can access the ForgeX Team Workspace.
          </p>
          <div className="flex justify-center gap-3">
            <Link to="/team">
              <Button
                variant="outline"
                className="border-white/15 text-white hover:bg-white/5"
              >
                <ArrowLeft className="mr-2 size-4" />
                Back to Team
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.email.trim() || !form.skill.trim() || !form.introduction.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    try {
      await submitApplication({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        skill: form.skill.trim(),
        preferredTeamId: form.preferredTeamId
          ? (form.preferredTeamId as any)
          : undefined,
        introduction: form.introduction.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(friendlyError(err, "Could not submit application."));
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/5 bg-card/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-4">
          <Link
            to="/team"
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Team
          </Link>
          <div className="text-sm font-semibold text-white">
            Apply for Team Access
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">
              Full Name *
            </label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Your full name"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">
              Email Address *
            </label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="you@example.com"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">
              Phone Number{" "}
              <span className="text-white/40">(optional)</span>
            </label>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
            />
          </div>

          {/* Skill */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">
              Area of Interest / Skill *
            </label>
            <Input
              value={form.skill}
              onChange={(e) => set("skill", e.target.value)}
              placeholder="e.g. Course Review, Content Writing, AI, UX"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
              required
            />
          </div>

          {/* Preferred Team */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">
              Preferred Team
            </label>
            <select
              value={form.preferredTeamId}
              onChange={(e) => set("preferredTeamId", e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            >
              <option value="">No preference</option>
              {teams?.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Introduction */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">
              Short Introduction *
            </label>
            <Textarea
              value={form.introduction}
              onChange={(e) => set("introduction", e.target.value)}
              placeholder="Tell us a bit about yourself and why you'd like to join..."
              rows={4}
              className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
              required
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={saving}
            className="w-full gap-2 bg-gradient-to-r from-lime-400 to-emerald-500 font-semibold text-black hover:brightness-110"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Submit Application
          </Button>

          <p className="text-center text-xs text-white/40">
            An administrator will review your application before granting
            access.
          </p>
        </form>
      </div>
    </div>
  );
}

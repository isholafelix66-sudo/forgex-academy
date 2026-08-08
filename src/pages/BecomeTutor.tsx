import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  GraduationCap,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { useAuth } from "@/hooks/use-auth";

const SUGGESTED = [
  "Design", "Development", "Data", "Marketing", "Business", "AI",
];

export default function BecomeTutor() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const application = useQuery(
    api.users.myTutorApplication,
    isAuthenticated ? {} : "skip",
  );
  const submit = useMutation(api.users.submitTutorApplication);

  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [expertise, setExpertise] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageShell>
        <section className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
          <GraduationCap className="mx-auto size-12 text-lime-300" />
          <h1 className="font-display mt-5 text-4xl font-bold">Become a tutor</h1>
          <p className="mt-3 text-muted-foreground">
            Sign in to apply. Applications are reviewed by our admin team
            before the tutor dashboard unlocks.
          </p>
          <Button
            className="mt-6 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
            onClick={() => navigate("/auth?mode=signup")}
          >
            Sign in to apply <ArrowRight className="size-4" />
          </Button>
        </section>
      </PageShell>
    );
  }

  if (user?.role === "tutor" && user.verified) {
    return (
      <PageShell>
        <section className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
          <CheckCircle2 className="mx-auto size-12 text-lime-400" />
          <h1 className="font-display mt-5 text-3xl font-bold">
            You're already a verified tutor! 🎓
          </h1>
          <p className="mt-3 text-muted-foreground">
            Your tutor dashboard is unlocked.
          </p>
          <Link to="/tutor" className="mt-6 inline-block">
            <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
              Open tutor dashboard <ArrowRight className="size-4" />
            </Button>
          </Link>
        </section>
      </PageShell>
    );
  }

  if (application?.status === "pending") {
    return (
      <PageShell>
        <section className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
          <Clock className="mx-auto size-12 text-amber-300" />
          <h1 className="font-display mt-5 text-3xl font-bold">
            Application under review
          </h1>
          <p className="mt-3 text-muted-foreground">
            Thanks for applying! Our admin team will verify your tutor account
            shortly. The tutor dashboard unlocks automatically once you're
            approved — we'll notify you.
          </p>
          <div className="mx-auto mt-8 max-w-md rounded-2xl border border-white/10 bg-card p-5 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              What happens next
            </p>
            <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-lime-400" /> An admin reviews your application</li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-lime-400" /> Your role switches to verified tutor</li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-lime-400" /> You can create courses & start teaching</li>
            </ul>
          </div>
          <Link to="/dashboard" className="mt-8 inline-block text-sm text-lime-300 hover:underline">
            Back to dashboard
          </Link>
        </section>
      </PageShell>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submit({
        headline,
        bio,
        expertise,
        socials: {
          website: website || undefined,
          linkedin: linkedin || undefined,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !expertise.includes(s) && expertise.length < 8) {
      setExpertise((v) => [...v, s]);
    }
    setSkillInput("");
  };

  return (
    <PageShell>
      <section className="mx-auto max-w-2xl px-4 pb-24 pt-14 sm:px-6">
        <Reveal>
          <span className="w-fit rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-lime-300">
            Tutor applications
          </span>
          <h1 className="font-display mt-3 text-4xl font-bold tracking-tight">
            Apply to teach at ForgeX Academy
          </h1>
          <p className="mt-3 text-muted-foreground">
            Every tutor is verified by an admin before teaching. Applications
            are usually reviewed within a few days.
          </p>
        </Reveal>

        {application?.status === "rejected" && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-400/25 bg-rose-400/8 p-5 text-sm">
            <XCircle className="mt-0.5 size-5 shrink-0 text-rose-300" />
            <div>
              <p className="font-semibold text-rose-200">Previous application not approved</p>
              <p className="mt-1 text-rose-200/70">
                {application.notes ?? "You're welcome to re-apply with more detail."}
              </p>
            </div>
          </div>
        )}

        <Reveal delay={0.05}>
          <form onSubmit={handleSubmit} className="mt-8 space-y-6 rounded-3xl border border-white/10 bg-card p-6 sm:p-8">
            <div>
              <label className="text-sm font-medium">Professional headline</label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                E.g. "Product Designer · ex-IBM"
              </p>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="What do you do?"
                required
                className="mt-2 border-white/10 bg-black/20"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Biography</label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Your experience, what you teach, and why you're great at it.
              </p>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell students who you are and what you'll help them achieve…"
                required
                rows={5}
                className="mt-2 border-white/10 bg-black/20"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Areas of expertise</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SUGGESTED.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() =>
                      setExpertise((v) =>
                        v.includes(s) ? v.filter((x) => x !== s) : [...v, s],
                      )
                    }
                    className={
                      expertise.includes(s)
                        ? "rounded-full border border-lime-400/50 bg-lime-400/10 px-3 py-1 text-xs font-medium text-lime-300"
                        : "rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-muted-foreground"
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder="Add your own skill…"
                  className="border-white/10 bg-black/20"
                />
                <Button type="button" variant="outline" onClick={addSkill}>
                  Add
                </Button>
              </div>
              {expertise.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {expertise.map((s) => (
                    <Badge
                      key={s}
                      variant="outline"
                      className="border-lime-400/30 bg-lime-400/10 text-lime-300"
                    >
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Website (optional)</label>
                <Input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://…"
                  className="mt-2 border-white/10 bg-black/20"
                />
              </div>
              <div>
                <label className="text-sm font-medium">LinkedIn (optional)</label>
                <Input
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/…"
                  className="mt-2 border-white/10 bg-black/20"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-rose-400/25 bg-rose-400/8 p-3 text-sm text-rose-300">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting || expertise.length === 0}
              className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              Submit application for review
            </Button>
          </form>
        </Reveal>
      </section>
    </PageShell>
  );
}

import { useState } from "react";
import { Navigate, Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dash/PageHeader";
import { Field } from "@/components/portfolio/PortfolioFields";
import { Loader2, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";

export default function TeamRegister() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const teams = useQuery(api.team.listAllTeams);
  const submit = useMutation(api.team.submitApplication);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [skill, setSkill] = useState("");
  const [preferredTeamId, setPreferredTeamId] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-lime-300" /></div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/academy/login?returnTo=%2Fteam%2Fregister" replace />;
  }

  const send = async () => {
    if (!name.trim() || !email.trim() || !skill.trim() || !introduction.trim()) {
      toast.error("Please complete all required fields.");
      return;
    }
    setBusy(true);
    try {
      await submit({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        skill: skill.trim(),
        preferredTeamId: (preferredTeamId || undefined) as never,
        introduction: introduction.trim(),
      });
      setSubmitted(true);
      toast.success("Application submitted.");
    } catch (err) {
      toast.error(friendlyError(err, "Could not submit your application."));
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-lime-400/12 text-lime-300"><Send className="size-6" /></span>
        <h1 className="mt-5 font-display text-2xl font-bold">Application received</h1>
        <p className="mt-2 text-sm text-muted-foreground">The team will review your application and contact you when there is an update.</p>
        <Link to="/academy/team" className="mt-6 text-sm font-semibold text-lime-300 hover:underline">Back to team workspace</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader title="Apply to join a team" description="Tell the ForgeX team where you can help. Applications are reviewed by an administrator." />
      <div className="rounded-3xl border border-white/10 bg-card p-6 sm:p-7">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300"><Users className="size-5" /></span>
          <div><p className="font-semibold">Your application</p><p className="text-xs text-muted-foreground">Signed in as {(user?.email ?? email) || "your Academy account"}</p></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></Field>
          <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
          <Field label="Phone (optional)"><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234…" /></Field>
          <Field label="Main skill"><Input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="e.g. curriculum design" /></Field>
        </div>
        <div className="mt-4">
          <Field label="Preferred team (optional)">
            <select value={preferredTeamId} onChange={(e) => setPreferredTeamId(e.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-lime-400/50">
              <option value="">Choose a team</option>
              {(teams ?? []).map((team) => <option key={team._id} value={team._id}>{team.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Introduction"><Textarea value={introduction} onChange={(e) => setIntroduction(e.target.value)} rows={6} placeholder="Tell us what you would like to work on and why you are a good fit." /></Field>
        </div>
        <Button onClick={() => void send()} disabled={busy} className="mt-6 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Submit application
        </Button>
      </div>
    </div>
  );
}

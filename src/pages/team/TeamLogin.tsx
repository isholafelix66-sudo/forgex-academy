import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useAuthActions } from "@convex-dev/auth/react";
import { friendlyError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Lock, Loader2, LogIn } from "lucide-react";

export default function TeamLogin() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const myTeam = useQuery(api.team.getMyTeam);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (myTeam?.team) {
      navigate(`/team/${(myTeam.team as any).slug}`, { replace: true });
    }
  }, [myTeam, navigate]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await signIn("password", { email: email.trim(), password });
    } catch (err) {
      setError(friendlyError(err, "Sign in failed. Check your credentials."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/team" className="mb-6 inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70">
            <ArrowLeft className="size-3.5" /> Team Workspace
          </Link>
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-lime-400 to-emerald-500">
            <Lock className="size-5 text-black" />
          </div>
          <h1 className="text-xl font-bold text-white">Team Sign In</h1>
          <p className="mt-1 text-sm text-white/50">Access your ForgeX team workspace</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@forgex.academy" className="border-white/10 bg-white/5 text-white placeholder:text-white/30" autoComplete="email" required />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" className="border-white/10 bg-white/5 text-white placeholder:text-white/30" autoComplete="current-password" required />
          </div>
          {error && <p className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full gap-2 bg-gradient-to-r from-lime-400 to-emerald-500 font-semibold text-black hover:brightness-110">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />} Sign In
          </Button>
        </form>
        <div className="mt-6 text-center text-sm text-white/40">
          Don&apos;t have a team account? <Link to="/team" className="text-lime-400 hover:underline">Apply here</Link>
        </div>
      </div>
    </div>
  );
}

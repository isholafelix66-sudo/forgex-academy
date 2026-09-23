import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  AlertTriangle,
  ArrowLeft,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/site/BrandMark";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import {
  getPortfolioAdminToken,
  setPortfolioAdminToken,
} from "@/lib/portfolio-admin-session";

/**
 * /portfolio/signin — the Portfolio's own sign-in.
 *
 * It authenticates ONLY against the Portfolio credential and lands in the
 * Portfolio portal (/adminbrand). It never creates or consults a ForgeX
 * Academy session, and an Academy login can never be used here.
 */
export default function PortfolioSignIn() {
  const navigate = useNavigate();
  const signIn = useMutation(api.portfolioAdmin.signIn);
  const status = useQuery(api.portfolioAdmin.status);

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in to the Portfolio? Go straight to the portal.
  useEffect(() => {
    if (getPortfolioAdminToken()) navigate("/adminbrand", { replace: true });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await signIn({ password });
      setPortfolioAdminToken(res.token);
      toast.success("Signed in to ForgeX Network Portfolio.");
      navigate("/adminbrand", { replace: true });
    } catch (err) {
      setError(friendlyError(err, "Could not sign in."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-[320px] max-w-xl rounded-full bg-lime-400/8 blur-[120px]"
      />

      <section className="relative mx-auto flex max-w-md flex-col px-4 py-14 sm:px-6 sm:py-20">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to the website
        </Link>

        <div className="mt-8 flex flex-col items-center text-center">
          <BrandMark to={null} size="lg" showProduct />
          <p className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-lime-300">
            <Lock className="size-3" /> Portfolio sign in
          </p>
          <h1 className="font-display mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            Manage your portfolio
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Portfolio access is separate from ForgeX Academy. Your Academy
            login does not work here, and this password does not open Academy.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="mt-7 rounded-3xl border border-white/10 bg-card p-6 sm:p-7"
        >
          <Label htmlFor="portfolio-password" className="text-xs">
            Portfolio password
          </Label>
          <Input
            id="portfolio-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1.5 h-11 border-white/10 bg-black/20"
            required
          />

          {error && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-xs text-rose-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="mt-5 h-11 w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-lime-400" />
            <span>
              Accounts aren&apos;t created on the public website. Portfolio
              access is issued by the {status?.initialised ? "Portfolio" : "ForgeX Network"}{" "}
              team, so nothing here can accidentally create an Academy account.
            </span>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Just here to browse?{" "}
          <Link to="/explore" className="font-medium text-lime-300 hover:underline">
            Explore portfolios
          </Link>{" "}
          — no account needed.
        </p>
      </section>
    </div>
  );
}

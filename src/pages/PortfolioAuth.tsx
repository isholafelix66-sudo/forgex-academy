import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { BrandMark } from "@/components/site/BrandMark";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import {
  getPortfolioUserToken,
  setPortfolioUserToken,
  clearPortfolioUserToken,
  PORTFOLIO_USER_DASHBOARD_PATH,
} from "@/lib/portfolio-user-session";

/**
 * /portfolio/auth — the Portfolio's own account screen.
 *
 * Email → Send OTP → Enter OTP → Verify → (new accounts: profile step) →
 * the creator dashboard at /portfolio/dashboard.
 *
 * This flow creates PORTFOLIO creator accounts ONLY — it never touches the
 * Academy `users` table or the Portfolio admin credential, and an Academy
 * login or an admin password cannot sign in here.
 */
export default function PortfolioAuth() {
  const navigate = useNavigate();
  const existingToken = getPortfolioUserToken();
  const session = useQuery(
    api.portfolioUsers.validateSession,
    existingToken ? { token: existingToken } : "skip",
  );

  const requestOtp = useMutation(api.portfolioUsers.requestOtp);
  const verifyOtp = useMutation(api.portfolioUsers.verifyOtp);
  const completeOnboarding = useMutation(api.portfolioUsers.completeOnboarding);

  type Step = "email" | "code" | "profile";
  const [step, setStep] = useState<Step>("email");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  // Profile step fields (new accounts).
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Already verified + onboarded → straight to the dashboard.
  useEffect(() => {
    if (session && session.onboarded) {
      navigate(PORTFOLIO_USER_DASHBOARD_PATH, { replace: true });
    } else if (session && !session.onboarded) {
      setStep("profile");
    }
  }, [session, navigate]);

  const sendCode = async (purpose: "signin" | "signup") => {
    setBusy(true);
    setError(null);
    try {
      const res = await requestOtp({ email, purpose });
      setMode(purpose);
      setStep("code");
      setResendIn(45);
      toast.success(res.message);
    } catch (err) {
      setError(friendlyError(err, "We couldn't send your code. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await verifyOtp({ email, code: otp, purpose: mode });
      setPortfolioUserToken(res.token);
      if (res.needsOnboarding) {
        setStep("profile");
      } else {
        toast.success("Welcome back.");
        navigate(PORTFOLIO_USER_DASHBOARD_PATH, { replace: true });
      }
    } catch (err) {
      setError(friendlyError(err, "That code isn't right. Try again."));
      setOtp("");
    } finally {
      setBusy(false);
    }
  };

  const finishOnboarding = async () => {
    const token = getPortfolioUserToken();
    if (!token) {
      setError("Your session expired — request a new code.");
      setStep("code");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await completeOnboarding({
        token,
        name,
        title: title || undefined,
        bio: bio || undefined,
      });
      toast.success("Your Portfolio account is ready.");
      navigate(PORTFOLIO_USER_DASHBOARD_PATH, { replace: true });
    } catch (err) {
      setError(friendlyError(err, "Could not save your profile."));
    } finally {
      setBusy(false);
    }
  };

  const signOutStale = () => {
    clearPortfolioUserToken();
    setStep("email");
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
          <h1 className="font-display mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
            {step === "email"
              ? mode === "signup"
                ? "Build your professional portfolio."
                : "Welcome back"
              : step === "code"
                ? "Check your email"
                : "Set up your profile"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {step === "email"
              ? mode === "signup"
                ? "Create your Portfolio account — no password needed, just a code."
                : "Sign in to manage your portfolio with a one-time code."
              : step === "code"
                ? `We sent a 6-digit code to ${email}. It expires in 10 minutes.`
                : "Tell visitors who you are. You can change this later."}
          </p>
        </div>

        <div className="mt-7 rounded-3xl border border-white/10 bg-card p-6 sm:p-7">
          {step === "email" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="pf-email" className="text-xs">
                  Email address
                </Label>
                <div className="relative mt-1.5">
                  <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="pf-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="h-11 border-white/10 bg-black/20 pl-10"
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-xl border border-rose-400/25 bg-rose-400/8 p-3 text-xs text-rose-300">
                  {error}
                </p>
              )}

              <Button
                onClick={() => void sendCode("signin")}
                disabled={busy || !email.trim()}
                className="h-11 w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Continue with Email <ArrowRight className="size-4" />
                  </>
                )}
              </Button>

              <div className="flex items-center justify-between pt-1 text-sm">
                {mode === "signin" ? (
                  <>
                    <span className="text-muted-foreground">
                      New to the Portfolio?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signup");
                        setError(null);
                      }}
                      className="font-medium text-lime-300 hover:underline"
                    >
                      Create one
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground">
                      Already have an account?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signin");
                        setError(null);
                      }}
                      className="font-medium text-lime-300 hover:underline"
                    >
                      Sign In
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {step === "code" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (otp.length === 6) void verify();
              }}
              className="space-y-4"
            >
              <div className="flex justify-center py-1">
                <InputOTP
                  value={otp}
                  onChange={setOtp}
                  maxLength={6}
                  disabled={busy}
                >
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {error && (
                <p className="rounded-xl border border-rose-400/25 bg-rose-400/8 p-3 text-center text-xs text-rose-300">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={busy || otp.length !== 6}
                className="h-11 w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Verify & continue <ArrowRight className="size-4" />
                  </>
                )}
              </Button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setError(null);
                    setOtp("");
                  }}
                  className="text-muted-foreground hover:text-lime-300"
                >
                  Use a different email
                </button>
                {resendIn > 0 ? (
                  <span className="text-muted-foreground">
                    Resend in {resendIn}s
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void sendCode(mode)}
                    className="font-medium text-lime-300 hover:underline"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </form>
          )}

          {step === "profile" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="pf-name" className="text-xs">
                  Full name
                </Label>
                <Input
                  id="pf-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  className="mt-1.5 h-11 border-white/10 bg-black/20"
                />
              </div>
              <div>
                <Label htmlFor="pf-title" className="text-xs">
                  Professional title{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="pf-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="UI/UX Designer"
                  className="mt-1.5 h-11 border-white/10 bg-black/20"
                />
              </div>
              <div>
                <Label htmlFor="pf-bio" className="text-xs">
                  Short bio{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <textarea
                  id="pf-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  placeholder="One or two lines about what you do."
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-lime-400/50"
                />
              </div>

              {error && (
                <p className="rounded-xl border border-rose-400/25 bg-rose-400/8 p-3 text-xs text-rose-300">
                  {error}
                </p>
              )}

              <Button
                onClick={() => void finishOnboarding()}
                disabled={busy || name.trim().length < 2}
                className="h-11 w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Enter my dashboard <ArrowRight className="size-4" />
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={signOutStale}
                className="w-full text-center text-xs text-muted-foreground hover:text-lime-300"
              >
                Start over with a different email
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 flex items-start justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-lime-400" />
          <span>
            Portfolio accounts are separate from any other ForgeX account and
            are only used to build and share your portfolio.
          </span>
        </p>
      </section>
    </div>
  );
}

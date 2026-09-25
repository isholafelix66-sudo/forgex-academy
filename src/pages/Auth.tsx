import { Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { AcademyNav } from "@/components/site/AcademyNav";
import { Footer } from "@/components/site/Footer";
import { BackgroundFX } from "@/components/site/PublicLayout";
import logo from "@/assets/logo.svg";
import {
  ArrowLeft,
  ArrowRight,
  Flame,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { resolveRedirectAfterAuth } from "@/lib/auth-redirect";
import { friendlyError } from "@/lib/errors";

interface AuthProps {
  redirectAfterAuth?: string;
}

type Mode = "signin" | "signup" | "reset";
function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, user, signIn } = useAuth();
  const initializeUser = useMutation(api.users.initializeUser);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  // ForgeX entry flow: signing in ALWAYS lands on the MAIN ForgeX WEBSITE
  // homepage ("ForgeX Home") first — for students and tutors alike, even if
  // the sign-in started from a protected route. Admin accounts go to the
  // admin dashboard. Profile settings is never a post-login destination;
  // editing the profile stays available inside the dashboard.

  // The first-time name pop-up lives in the global NameSetupDialog: it shows
  // whenever the signed-in profile has no name — anywhere in the app, across
  // refreshes — and saving it writes to the same authenticated profile record.
  const [docsReady, setDocsReady] = useState(false);

  // Do not run onboarding side effects until authed and the Convex mutation
  // layer is reachable.
  useEffect(() => {
    setDocsReady(true);
  }, []);

  // Signing up through the Become-a-Tutor flow creates a TUTOR account
  // (pending verification), never a student account. The account's role is
  // the source of truth everywhere else, so it must be right from day one.
  const intendedRole =
    redirect.startsWith("/academy/become-tutor") ? ("tutor" as const) : undefined;



  const initialMode: Mode =
    searchParams.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"form" | "code">("form");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0); // 60s anti-abuse cooldown

  // Countdown for the resend cooldown while the code step is visible.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Onboarding: once signed in, initialize the account (role + name). This
  // runs AFTER the name pop-up flow completes when the user is brand new.
  // The role is assigned once and never overwritten, so a tutor account stays
  // in the tutor portal no matter how often they sign in afterwards.
  useEffect(() => {
    if (!docsReady || authLoading || !isAuthenticated || !user) return;
    const pendingName = sessionStorage.getItem("fx-pending-name") ?? undefined;
    if (!user.onboarded || (pendingName && user.name !== pendingName)) {
      void initializeUser({
        // Never send the auth provider's email-derived placeholder back —
        // that would re-save it as if the learner had chosen it.
        name: user.needsName ? undefined : user.name,
        intendedRole,
      }).catch(() => {});
      // When a real name was consumed, drop the leftover signup prefill. While
      // the profile still needs a name the name popup owns this key.
      if (!user.needsName) sessionStorage.removeItem("fx-pending-name");
    }
  }, [
    docsReady,
    authLoading,
    isAuthenticated,
    user,
    initializeUser,
    intendedRole,
  ]);

  // After any sign-in the account lands on the main ForgeX website first
  // (ForgeX Home). That is the primary entry point for students and tutors
  // alike; there is no direct auto-route into the student dashboard login
  // flow.
  const landingDest = useMemo(() => {
    if (authLoading || !isAuthenticated || !user) return null;

    // An explicit protected returnTo always wins (course player, dashboard
    // form, tutor application, and so on). It can only be a same-site path.
    if (searchParams.get("returnTo")) return redirect;
    if (user?.role === "admin" || user?.role === "owner") return "/academy/admin";
    if (user?.role === "tutor" && user.verified) return "/academy/tutor";
    return "/academy/dashboard";
  }, [authLoading, isAuthenticated, user]);

  useEffect(() => {
    if (!landingDest) return;
    navigate(landingDest, { replace: true });
  }, [
    landingDest,
    navigate,
    redirect,
    searchParams,
  ]);

  // When a freshly verified student still needs a display name, also nudge
  // the rest of the app that it can show the dashboard "Complete your
  // profile" CTA instead of leaving the name blank.
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (!user.name) {
      window.dispatchEvent(
        new CustomEvent("fx-student-needs-name"),
      );
    }
  }, [isAuthenticated, user]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setIsLoading(true);
    setError(null);
    setInfo(null);
    try {
      const formData = new FormData();
      formData.set("email", email);
      if (mode === "signup" && name.trim()) {
        sessionStorage.setItem("fx-pending-name", name.trim());
      }
      // Preserve the Become-a-Tutor intent for the global name pop-up, which
      // is what actually saves the name for a brand-new account.
      if (intendedRole === "tutor") {
        sessionStorage.setItem("fx-intended-role", "tutor");
      }
      await signIn("email-otp", formData);
      setStep("code");
      setResendIn(60);
      setInfo(
        mode === "reset"
          ? "If that email has an account, a recovery code is on its way."
          : "📧 A verification code has been sent to your email address. Please check your inbox.",
      );
      setIsLoading(false);
    } catch (err) {
      console.error("Email sign-in error:", err);
      // Never surface SMTP/technical details — friendly message only.
      setError(
        friendlyError(
          err,
          "We couldn't send your verification code right now. Please try again.",
        ),
      );
      setIsLoading(false);
    }
  };

  /** Resend while on the code step — same signIn call, distinct messaging. */
  const resendCode = async () => {
    if (resendIn > 0 || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("email", email);
      await signIn("email-otp", formData);
      setResendIn(60);
      setInfo(
        mode === "reset"
          ? "📧 A new recovery code has been sent. Please check your Inbox, Spam, or Junk folder."
          : "📧 A new verification code has been sent. Please check your Inbox, Spam, or Junk folder.",
      );
    } catch (err) {
      console.error("OTP resend error:", err);
      setError(
        friendlyError(
          err,
          "We couldn't send your verification code right now. Please try again.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("code", otp);
      void signIn("email-otp", formData);
    } catch (err) {
      console.error("OTP verification error:", err);
      setError("That code isn't right. Double-check and try again.");
      setOtp("");
      setIsLoading(false);
    }
  };

  const resetFlow = () => {
    setMode("reset");
    setStep("form");
    setError(null);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setStep("form");
    setError(null);
    setOtp("");
  };

  return (
    <div className="relative flex min-h-screen flex-col">
      <BackgroundFX />
      <AcademyNav />
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <img
              src={logo}
              alt="ForgeX Network"
              className="mx-auto size-14 rounded-2xl shadow-lg"
            />
            <h1 className="font-display mt-4 text-2xl font-bold tracking-tight">
              {mode === "signup"
                ? "Create your free account"
                : mode === "reset"
                  ? "Reset access to your account"
                  : "Welcome back"}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === "signup"
                ? "Create your Academy account and start learning."
                : mode === "reset"
                  ? "We'll email you a code to regain access."
                  : "Sign in to continue your learning journey."}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-card p-6 shadow-2xl sm:p-8">
            {step === "form" ? (
              <form onSubmit={sendCode} className="space-y-4">
                {mode === "signup" && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Full name</label>
                    <div className="relative">
                      <UserPlus className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ada Lovelace"
                        className="h-11 border-white/10 bg-black/20 pl-10"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      type="email"
                      required
                      className="h-11 border-white/10 bg-black/20 pl-10"
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
                  disabled={isLoading || !email}
                  className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300 glow-lime-soft"
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      {mode === "signup" ? "Create account" : "Send me a code"}
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>

                {mode === "reset" ? (
                  <button
                    type="button"
                    onClick={() => switchMode("signin")}
                    className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-lime-300"
                  >
                    <ArrowLeft className="size-3.5" /> Back to sign in
                  </button>
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    {mode === "signin" ? (
                      <button
                        type="button"
                        onClick={() => switchMode("signup")}
                        className="font-medium text-lime-300 hover:underline"
                      >
                        New here? Sign up
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => switchMode("signin")}
                        className="font-medium text-lime-300 hover:underline"
                      >
                        Already have an account?
                      </button>
                    )}
                  </div>
                )}

                {mode !== "reset" && (
                  <button
                    type="button"
                    onClick={resetFlow}
                    className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-lime-300"
                  >
                    <KeyRound className="size-3" /> Forgot your password? Reset access
                  </button>
                )}
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <div className="rounded-2xl border border-lime-400/25 bg-lime-400/8 p-4 text-center">
                  <ShieldCheck className="mx-auto size-6 text-lime-300" />
                  <p className="mt-2 text-sm font-medium">
                    {mode === "signup"
                      ? "Verify your email"
                      : mode === "reset"
                        ? "Account recovery"
                        : "Check your email"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {info ?? "📧 A verification code has been sent to your email address. Please check your inbox."}
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">
                    Didn't receive it? Check your Spam or Junk folder, wait a few minutes, or request a new code below.
                  </p>
                </div>

                <input type="hidden" name="email" value={email} />
                <input type="hidden" name="code" value={otp} />

                <div className="flex justify-center py-2">
                  <InputOTP
                    value={otp}
                    onChange={setOtp}
                    maxLength={6}
                    disabled={isLoading}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                        (e.target as HTMLElement).closest("form")?.requestSubmit();
                      }
                    }}
                  >
                    <InputOTPGroup>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {error && (
                  <p className="rounded-xl border border-rose-400/25 bg-rose-400/8 p-3 text-center text-sm text-rose-300">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={isLoading || otp.length !== 6}
                  className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      Verify & continue <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setStep("form");
                    setError(null);
                    setOtp("");
                  }}
                  className="w-full text-center text-sm text-muted-foreground hover:text-lime-300"
                >
                  Use a different email
                </button>
                <div className="flex flex-col items-center gap-1">
                  {resendIn > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      Resend code in {resendIn} seconds
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isLoading}
                      onClick={() => void resendCode()}
                      className="gap-1.5 border-white/15 bg-black/20 text-lime-300 hover:bg-black/40 hover:text-lime-200"
                    >
                      {isLoading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : null}
                      Resend code
                    </Button>
                  )}
                  {info && !error && (
                    <span className="text-[11px] text-lime-300/80" role="status">
                      {info.startsWith("📧") ? info : null}
                    </span>
                  )}
                </div>
              </form>
            )}
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Flame className="size-3.5 text-lime-400" />
            Free forever · Discover. Express. Build.
          </p>
        </div>
      </div>
      <Footer product="academy" />
    </div>
  );
}

function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}

export default AuthPage;

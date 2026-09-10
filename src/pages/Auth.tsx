import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
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
import { PublicNav } from "@/components/site/PublicNav";
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
  UserCheck,
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

  // ForgeX entry flow: a fresh sign-in lands on the MAIN ForgeX WEBSITE
  // homepage first. The homepage shows the prominent "Dashboard" entry
  // point; from there users switch into their workspace, and "ForgeX Home"
  // in the dashboards returns them here. Only an explicit returnTo/redirect
  // (deep link, protected-route bounce, header Dashboard button) bypasses
  // the homepage and goes straight to the intended destination.
  const cameFromDeepLink = !!searchParams.get("returnTo");
  const landingRedirect = cameFromDeepLink
    ? redirect
    : redirect === "/dashboard"
      ? "/"
      : redirect;

  // First-time name onboarding: only appears immediately after a successful
  // OTP verification for an account that still has no display name. This is
  // a one-time pop-up, not a profile settings page. Returning users skip it.
  const [showNameOnboarding, setShowNameOnboarding] = useState(false);
  const [pendingName, setPendingName] = useState("");
  const [pendingSave, setPendingSave] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [docsReady, setDocsReady] = useState(false);
  const [pendingResolved, setPendingResolved] = useState(false);

  // Do not show the name pop-up until authed and the Convex mutation layer is
  // reachable. The routing effect uses this gate directly.
  useEffect(() => {
    setDocsReady(true);
  }, []);

  // Once the code is verified and the session is live, decide whether the
  // user still needs a display name. Existing names (including a pending name
  // from a re-authentication) are reused; otherwise we prompt once.
  useEffect(() => {
    if (!docsReady || authLoading || !isAuthenticated || !user) return;
    const pendingFromSession =
      sessionStorage.getItem("fx-pending-name") ?? undefined;
    const needsName =
      !user.name && (!pendingFromSession || user.name !== pendingFromSession);
    if (needsName) {
      setPendingName(pendingFromSession ?? "");
      setShowNameOnboarding(true);
    }
    sessionStorage.removeItem("fx-pending-name");
  }, [
    docsReady,
    authLoading,
    isAuthenticated,
    user,
  ]);

  // Signing up through the Become-a-Tutor flow creates a TUTOR account
  // (pending verification), never a student account. The account's role is
  // the source of truth everywhere else, so it must be right from day one.
  const intendedRole =
    redirect.startsWith("/become-tutor") ? ("tutor" as const) : undefined;



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
    if (showNameOnboarding || !user.name) return;
    const pendingName = sessionStorage.getItem("fx-pending-name") ?? undefined;
    if (!user.onboarded || (pendingName && user.name !== pendingName)) {
      void initializeUser({ name: user.name, intendedRole }).catch(() => {});
    }
    sessionStorage.removeItem("fx-pending-name");
  }, [
    docsReady,
    authLoading,
    isAuthenticated,
    user,
    initializeUser,
    intendedRole,
    showNameOnboarding,
  ]);

  // Role-aware landing after sign-in. A brand-new student without a name
  // still completes the name pop-up first, then lands on ForgeX Home.
  // Everyone else — including returning users and users with an existing name
  // — goes straight to the public ForgeX homepage.
  const landingDest = useMemo(() => {
    if (authLoading || !isAuthenticated || !user) return null;
    if (showNameOnboarding) return null;

    const role = user?.role;
    if (role === "tutor") return "/tutor";
    if (role === "admin") return "/admin";
    return "/";
  }, [
    authLoading,
    isAuthenticated,
    user,
    showNameOnboarding,
  ]);

  useEffect(() => {
    if (!landingDest) return;
    navigate(landingDest, { replace: true });
  }, [
    landingDest,
    navigate,
  ]);

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

  const saveName = async () => {
    const trimmed = pendingName.trim();
    if (!trimmed) {
      setNameError("Please enter your name so we know what to call you.");
      return;
    }
    setNameError(null);
    setPendingSave(true);
    try {
      const name = trimmed;
      // Persist the display name to the authenticated user profile first.
      // This is the single source of truth for names everywhere, including
      // certificates, the profile area and the ForgeX homepage greeting.
      await initializeUser({ name, intendedRole });
      sessionStorage.removeItem("fx-pending-name");
      setShowNameOnboarding(false);
    } catch (err) {
      console.error("Name save error:", err);
      setNameError(
        friendlyError(
          err,
          "We couldn't save your name just now. Please try again.",
        ),
      );
    } finally {
      setPendingSave(false);
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
    setShowNameOnboarding(false);
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
      <PublicNav />
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <img
              src={logo}
              alt="ForgeX Academy"
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
                ? "Start learning, building and earning certificates."
                : mode === "reset"
                  ? "We'll email you a code to regain access."
                  : "Sign in to continue your learning path."}
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
      {showNameOnboarding && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
          role="presentation"
        >
          <div
            className="w-full max-w-sm"
            aria-hidden
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          />
        </div>
      )}
      <Footer />
    </div>
  );
}

export function NameOnboardingGate({ children }: { children: ReactNode }) {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [showGate, setShowGate] = useState(false);
  const initializeUser = useMutation(api.users.initializeUser);

  // Only intercept a fresh account that still needs a display name after the
  // Convex session is live. Authenticated users that already have a name are
  // let through immediately.
  useEffect(() => {
    setShowGate(
      !authLoading &&
        isAuthenticated &&
        !!user &&
        !user.name,
    );
  }, [authLoading, isAuthenticated, user]);

  // Persist name and route straight to ForgeX Home, never to profile settings.
  const handleContinue = async () => {
    const name = prompt("What should we call you?");
    const trimmed = (name ?? "").trim();
    if (!trimmed) return;
    try {
      await initializeUser({ name: trimmed, intendedRole: undefined });
    } catch (err) {
      console.error("Name save error:", err);
    }
    setShowGate(false);
  };

  if (showGate && !authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-2xl border border-lime-400/20 bg-black/40 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-lime-400/15 text-lime-300">
            <UserPlus className="size-5" />
          </div>
          <h2 className="font-display text-center text-xl font-bold tracking-tight text-white">
            Welcome to ForgeX 👋
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Before you continue, tell us your name.
          </p>
          <p className="mt-1 text-center text-[11px] text-muted-foreground/70">
            This will also be used on your certificates.
          </p>
          <div className="mt-5 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-white/15 bg-black/30 text-muted-foreground"
              onClick={() => setShowGate(false)}
            >
              Skip for now
            </Button>
            <Button type="button" onClick={handleContinue} className="flex-1 gap-2 bg-lime-400 font-semibold text-black">
              Continue <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <NameOnboardingGate>
        <Auth {...props} />
      </NameOnboardingGate>
    </Suspense>
  );
}

export default AuthPage;

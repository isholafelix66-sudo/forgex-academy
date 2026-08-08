import { Suspense, useEffect, useState } from "react";
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
import { BackgroundFX } from "@/components/site/PageShell";
import logo from "@/assets/logo.svg";
import {
  ArrowLeft,
  ArrowRight,
  Flame,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
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

  // Onboarding: once signed in, initialize the account (role + name).
  useEffect(() => {
    if (!authLoading && isAuthenticated && user && !user.onboarded) {
      const pendingName = sessionStorage.getItem("fx-pending-name") ?? undefined;
      void initializeUser({ name: pendingName }).catch(() => {});
      sessionStorage.removeItem("fx-pending-name");
    }
  }, [authLoading, isAuthenticated, user, initializeUser]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

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
      setInfo(
        mode === "reset"
          ? "If that email has an account, a recovery code is on its way."
          : `We sent a 6-digit code to ${email}.`,
      );
      setIsLoading(false);
    } catch (err) {
      console.error("Email sign-in error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to send code. Try again.",
      );
      setIsLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("code", otp);
      await signIn("email-otp", formData);
      // navigation happens via the auth effect above
    } catch (err) {
      console.error("OTP verification error:", err);
      setError("That code isn't right. Double-check and try again.");
      setOtp("");
      setIsLoading(false);
    }
  };

  const handleGuest = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
    } catch (err) {
      console.error("Guest login error:", err);
      setError("Guest sign-in failed. Try email instead.");
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

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-2 text-xs uppercase tracking-wider text-muted-foreground">
                      Or
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-white/10"
                  onClick={handleGuest}
                  disabled={isLoading}
                >
                  <Sparkles className="mr-2 size-4 text-lime-300" />
                  Continue as guest
                </Button>

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
              <form onSubmit={verifyCode} className="space-y-4">
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
                    {info ?? `Enter the 6-digit code sent to ${email}`}
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
                <p className="text-center text-xs text-muted-foreground">
                  Didn't receive it?{" "}
                  <button
                    type="button"
                    onClick={() => void sendCode()}
                    className="font-medium text-lime-300 hover:underline"
                  >
                    Resend code
                  </button>
                </p>
              </form>
            )}
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Flame className="size-3.5 text-lime-400" />
            Free forever · Learn. Build. Succeed.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}

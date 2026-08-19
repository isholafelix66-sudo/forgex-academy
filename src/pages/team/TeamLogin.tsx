import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams, useNavigate } from "react-router";
import { SignIn, useAuth } from "@clerk/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTeamAuth } from "@/hooks/use-team-auth";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Lock } from "lucide-react";

export default function TeamLogin() {
  const { isAuthenticated, isLoading: authLoading, teamMember } = useTeamAuth();
  const { isSignedIn, isLoaded: clerkLoaded } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "";

  const clerkTeamLogin = useMutation(api.teamAuth.clerkAuthTeamLogin);
  const [bridging, setBridging] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  // If already authenticated via team session, redirect to workspace
  if (!authLoading && isAuthenticated) {
    const dest =
      returnTo ||
      (teamMember?.team?.slug
        ? `/team/${teamMember.team.slug}`
        : "/team");
    return <Navigate to={dest} replace />;
  }

  // After Clerk sign-in, bridge to team session
  useEffect(() => {
    if (!clerkLoaded || !isSignedIn || bridging || authLoading) return;
    if (isAuthenticated) return; // Already have a team session

    setBridging(true);
    setBridgeError(null);
    clerkTeamLogin({})
      .then((result) => {
        // Team session created — the useTeamAuth hook will pick up the token
        // and re-render, triggering the redirect above
        if (result?.teamSlug) {
          const dest = returnTo || `/team/${result.teamSlug}`;
          navigate(dest, { replace: true });
        }
      })
      .catch((err) => {
        const msg = err?.message || "Could not access team workspace.";
        if (msg.includes("No team account found")) {
          setBridgeError(
            "No team account found for this email. Please apply to join a team first.",
          );
        } else if (msg.includes("pending admin approval")) {
          setBridgeError("Your team account is pending admin approval.");
        } else if (msg.includes("suspended")) {
          setBridgeError("Your team account has been suspended.");
        } else {
          setBridgeError(msg);
        }
      })
      .finally(() => {
        setBridging(false);
      });
  }, [
    clerkLoaded,
    isSignedIn,
    bridging,
    authLoading,
    isAuthenticated,
    clerkTeamLogin,
    navigate,
    returnTo,
  ]);

  // Show bridging state
  if (bridging) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          <div className="rounded-3xl border border-white/10 bg-card p-8">
            <Loader2 className="mx-auto size-8 animate-spin text-lime-400" />
            <p className="mt-4 text-sm text-white/60">
              Connecting to your team workspace…
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Show bridge error (e.g., no team account for this email)
  if (bridgeError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Link
            to="/team"
            className="mb-6 inline-flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Back to Team Entry
          </Link>
          <div className="rounded-3xl border border-white/10 bg-card p-8">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/5">
              <Lock className="size-7 text-red-400" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white">
              Access Denied
            </h1>
            <p className="mt-3 text-sm text-white/50">{bridgeError}</p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                to="/team/register"
                className="inline-flex items-center justify-center rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-300"
              >
                Apply to Join a Team
              </Link>
              <button
                onClick={() => {
                  setBridgeError(null);
                  // Sign out of Clerk so they can try a different account
                  window.location.href = "/team/login";
                }}
                className="text-sm text-white/40 hover:text-white"
              >
                Try a different account
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Link
          to="/team"
          className="mb-6 inline-flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back to Team Entry
        </Link>
        <div className="rounded-3xl border border-white/10 bg-card p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/5">
              <Lock className="size-7 text-lime-400" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white">
              Team Sign In
            </h1>
            <p className="mt-2 text-sm text-white/40">
              Sign in with your email to access your team workspace.
            </p>
          </div>

          {/* Clerk Sign-In component — handles all auth (email, password, OTP, etc.) */}
          <div className="clerk-team-auth [&>.cl-rootBox]:!bg-transparent [&>.cl-card]:!bg-transparent [&>.cl-card]:!shadow-none [&>.cl-card]:!border-none [&>.cl-headerTitle]:!text-white [&>.cl-headerSubtitle]:!text-white/40 [&>.cl-formButtonPrimary]:!bg-lime-400 [&>.cl-formButtonPrimary]:!text-black [&>.cl-formButtonPrimary:hover]:!bg-lime-300 [&>.cl-footerActionLink]:!text-lime-300 [&>.cl-dividerLine]:!bg-white/10 [&>.cl-dividerText]:!text-white/40 [&>.cl-formFieldInput]:!bg-white/5 [&>.cl-formFieldInput]:!border-white/10 [&>.cl-formFieldInput]:!text-white [&>.cl-formFieldLabel]:!text-white/50 [&>.cl-socialButtonsBlockButton]:!border-white/10 [&>.cl-socialButtonsBlockButton]:!bg-white/5 [&>.cl-socialButtonsBlockButtonText]:!text-white">
            <SignIn
              routing="path"
              path="/team/login"
              fallbackRedirectUrl={returnTo || "/team"}
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "w-full bg-transparent shadow-none border-none",
                  headerTitle: "text-white font-display text-lg font-bold",
                  headerSubtitle: "text-white/40 text-sm",
                  formButtonPrimary:
                    "bg-lime-400 text-black hover:bg-lime-300 font-semibold !shadow-none",
                  formFieldInput:
                    "bg-white/5 border-white/10 text-white",
                  formFieldLabel: "text-white/50 text-sm font-medium",
                  footerActionLink: "text-lime-300 hover:text-lime-200",
                  dividerLine: "bg-white/10",
                  dividerText: "text-white/40",
                  socialButtonsBlockButton:
                    "border-white/10 bg-white/5 text-white hover:bg-white/10",
                  socialButtonsBlockButtonText: "text-white font-medium",
                  identityPreviewEditButton: "text-lime-300",
                },
              }}
            />
          </div>

          <div className="mt-6 flex flex-col items-center gap-3 text-sm">
            <Link
              to="/team/forgot-password"
              className="text-white/40 hover:text-lime-300"
            >
              Forgot your password?
            </Link>
            <p className="text-white/30">
              Don&apos;t have an account?{" "}
              <Link
                to="/team/register"
                className="text-lime-400/80 hover:text-lime-300"
              >
                Apply here
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

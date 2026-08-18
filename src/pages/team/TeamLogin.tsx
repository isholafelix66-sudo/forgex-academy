import { useEffect } from "react";
import { Link, Navigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, ShieldCheck, Users } from "lucide-react";

export default function TeamLogin() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const myTeam = useQuery(api.team.getMyTeam, isAuthenticated ? {} : "skip");

  // If signed in and has active team membership, redirect to their workspace
  if (!authLoading && isAuthenticated && myTeam !== undefined) {
    if (myTeam?.team) {
      const t = myTeam.team as any;
      return <Navigate to={`/team/${t.slug}`} replace />;
    }
  }

  // If signed in but no team membership, show pending message
  if (!authLoading && isAuthenticated && myTeam === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-3xl border border-white/10 bg-card p-8 text-center"
        >
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-amber-500/10">
            <ShieldCheck className="size-8 text-amber-400" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">
            No Team Access Yet
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/50">
            You don&rsquo;t have an active team membership. If you&rsquo;ve
            already applied, an admin is reviewing your application. If not,
            you can apply to join a team.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Link to="/team/register">
              <button className="w-full rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-300">
                Apply to Join a Team
              </button>
            </Link>
            <Link to="/dashboard">
              <button className="w-full rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-white/60 transition-colors hover:border-lime-400/40 hover:text-white">
                Go to Student Dashboard
              </button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/team" className="flex items-center gap-2 text-white/60 transition-colors hover:text-white">
            <ArrowLeft className="size-4" />
            <span className="text-sm font-medium">Team Workspace</span>
          </Link>
          <Link to="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-lime-400/10 font-display text-sm font-bold text-lime-400">
              F
            </div>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/5">
              <Users className="size-7 text-lime-400" />
            </div>
            <h1 className="font-display text-3xl font-bold text-white">
              Team Sign In
            </h1>
            <p className="mt-2 text-sm text-white/40">
              Sign in with your ForgeX Academy account to access the team
              workspace.
            </p>
          </div>

          {authLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-lime-400" />
            </div>
          ) : isAuthenticated ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-lime-400" />
              <span className="ml-2 text-sm text-white/40">Checking team access...</span>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/5 bg-card p-6 text-center">
                <p className="text-sm text-white/50 mb-4">
                  Use the same sign-in you use for the Academy.
                </p>
                <Link
                  to="/auth?returnTo=/team/login"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-300"
                >
                  Sign In with ForgeX
                </Link>
              </div>

              <p className="mt-6 text-center text-xs text-white/30">
                Don&rsquo;t have an account?{" "}
                <Link to="/team/register" className="text-lime-400/80 hover:text-lime-300">
                  Apply for a team account
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}

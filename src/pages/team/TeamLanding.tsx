import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  Shield,
  Users,
  Zap,
} from "lucide-react";

const TEAMS = [
  "Academic Team",
  "Content Team",
  "AI Team",
  "Student Experience Team",
];

export default function TeamLanding() {
  const { user, isAuthenticated } = useAuth();
  const myTeam = useQuery(api.team.getMyTeam);
  const navigate = useNavigate();

  // If already a team member, redirect to workspace
  useEffect(() => {
    if (myTeam?.team) {
      navigate(`/team/${myTeam.team.slug}`, { replace: true });
    }
  }, [myTeam, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-white/5 bg-card/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-lime-400 to-emerald-500 font-bold text-black">
              F
            </div>
            <span className="text-sm font-semibold text-white">
              ForgeX Academy
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <Link to="/auth">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/60 hover:text-white"
                >
                  Main Site
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-20 md:py-32">
        {/* Background accents */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-lime-500/5 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-emerald-500/5 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-lime-500/20 bg-lime-500/10 px-4 py-1.5 text-xs font-medium text-lime-400">
              <Lock className="size-3" />
              Internal Workspace
            </div>
          </motion.div>

          <motion.h1
            className="mb-4 text-4xl font-bold tracking-tight text-white md:text-6xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            ForgeX Team{" "}
            <span className="bg-gradient-to-r from-lime-400 to-emerald-400 bg-clip-text text-transparent">
              Workspace
            </span>
          </motion.h1>

          <motion.p
            className="mx-auto mb-10 max-w-xl text-lg text-white/60"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Your internal workspace for contributing to ForgeX Academy.
            Collaborate with your team, review courses, and shape the learning
            experience.
          </motion.p>

          <motion.div
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {isAuthenticated ? (
              <Link to="/team/create">
                <Button
                  size="lg"
                  className="gap-2 bg-gradient-to-r from-lime-400 to-emerald-500 font-semibold text-black hover:brightness-110"
                >
                  Apply for Team Access
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            ) : (
              <Link to="/auth?returnTo=/team/create">
                <Button
                  size="lg"
                  className="gap-2 bg-gradient-to-r from-lime-400 to-emerald-500 font-semibold text-black hover:brightness-110"
                >
                  Create Team Account
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            )}

            <Link to="/team/login">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-white/15 text-white hover:bg-white/5"
              >
                <Lock className="size-4" />
                Team Sign In
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-white/5 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-2xl font-bold text-white">
            Built for the ForgeX team
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                icon: Shield,
                title: "Role-Based Access",
                desc: "Each member gets access only to their assigned team workspace. No cross-team visibility.",
              },
              {
                icon: Users,
                title: "Team Collaboration",
                desc: "Work together on course reviews, content, and platform improvements in your dedicated space.",
              },
              {
                icon: Zap,
                title: "Streamlined Workflow",
                desc: "Simple work items, comments, and activity tracking — no unnecessary complexity.",
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                className="rounded-2xl border border-white/5 bg-card p-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * i }}
              >
                <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-lime-500/10">
                  <f.icon className="size-5 text-lime-400" />
                </div>
                <h3 className="mb-2 text-sm font-semibold text-white">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-white/50">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Teams preview */}
      <section className="border-t border-white/5 px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-8 text-2xl font-bold text-white">Our Teams</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {TEAMS.map((t, i) => (
              <motion.div
                key={t}
                className="rounded-xl border border-white/5 bg-card/50 p-4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.05 * i }}
              >
                <p className="text-sm font-medium text-white/80">{t}</p>
              </motion.div>
            ))}
          </div>
          <p className="mt-6 text-xs text-white/40">
            More teams can be created by Admin at any time.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8">
        <div className="mx-auto max-w-6xl text-center text-xs text-white/30">
          © {new Date().getFullYear()} ForgeX Academy — Team Workspace
        </div>
      </footer>
    </div>
  );
}

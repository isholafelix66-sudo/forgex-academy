import { Link } from "react-router";
import { motion } from "framer-motion";
import { Users, ArrowRight, Shield, Zap } from "lucide-react";

export default function TeamEntry() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-lime-400/10 font-display text-lg font-bold text-lime-400">
              F
            </div>
            <span className="font-display text-sm font-bold tracking-wide text-white">
              ForgeX Academy
            </span>
          </Link>
          <div className="flex gap-3">
            <Link
              to="/team/login"
              className="rounded-xl border border-white/10 px-5 py-2 text-sm font-medium text-white/70 transition-colors hover:border-lime-400/40 hover:text-white"
            >
              Sign In
            </Link>
            <Link
              to="/team/register"
              className="rounded-xl bg-lime-400 px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-lime-300"
            >
              Join Team
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-6xl px-6 py-20 md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-center"
        >
          <div className="mx-auto mb-8 flex size-20 items-center justify-center rounded-3xl border border-lime-400/20 bg-lime-400/5">
            <Users className="size-10 text-lime-400" />
          </div>

          <h1 className="font-display text-4xl font-bold text-white md:text-6xl">
            ForgeX Team{" "}
            <span className="bg-gradient-to-r from-lime-400 to-green-400 bg-clip-text text-transparent">
              Workspace
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/50 leading-relaxed">
            Your internal workspace for contributing to ForgeX Academy. Join a
            team, collaborate on courses, review content, and help shape the
            future of learning.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/team/register"
              className="group inline-flex items-center gap-2 rounded-2xl bg-lime-400 px-8 py-3.5 text-sm font-bold text-black transition-all hover:bg-lime-300 hover:shadow-lg hover:shadow-lime-400/20"
            >
              Create Team Account
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/team/login"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-8 py-3.5 text-sm font-medium text-white/70 transition-colors hover:border-lime-400/40 hover:text-white"
            >
              Team Sign In
            </Link>
          </div>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-24 grid gap-6 md:grid-cols-3"
        >
          {[
            {
              icon: Shield,
              title: "Admin Approval",
              desc: "Every team member is verified by an administrator before gaining access to the workspace.",
            },
            {
              icon: Users,
              title: "Team Collaboration",
              desc: "Work together on courses, content, and student experience — each team has its own dedicated workspace.",
            },
            {
              icon: Zap,
              title: "Focused Modules",
              desc: "Access only the tools and pages your team needs — Academic, Content, AI, Student Experience, and more.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/5 bg-card p-6 transition-colors hover:border-lime-400/20"
            >
              <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-lime-400/8">
                <f.icon className="size-5 text-lime-400" />
              </div>
              <h3 className="font-display text-sm font-bold text-white">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/40">
                {f.desc}
              </p>
            </div>
          ))}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-xs text-white/30">
          &copy; {new Date().getFullYear()} ForgeX Academy. Internal workspace
          — not publicly accessible.
        </div>
      </footer>
    </div>
  );
}

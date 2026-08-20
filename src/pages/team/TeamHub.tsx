import { Link } from "react-router";
import { motion } from "framer-motion";
import { Lock, BookOpen, Bot, GraduationCap, HeartHandshake, ArrowRight } from "lucide-react";

const WORKSPACES = [
  { slug: "academic", name: "Academic Support", description: "Academic operations, course quality, and learning support.", icon: BookOpen, color: "from-blue-400/10 to-blue-600/5" },
  { slug: "ai-support", name: "AI Support", description: "AI Hub, prompt resources, and AI-related tools.", icon: Bot, color: "from-purple-400/10 to-purple-600/5" },
  { slug: "tutor-support", name: "Tutor Support", description: "Tutor-related support, onboarding, and tutor issues.", icon: GraduationCap, color: "from-amber-400/10 to-amber-600/5" },
  { slug: "student-support", name: "Student Support", description: "Student-facing support, issues, and student experience.", icon: HeartHandshake, color: "from-lime-400/10 to-lime-600/5" },
];

export default function TeamHub() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="font-display text-xl font-bold text-white">
            ForgeX<span className="text-lime-400"> Team</span>
          </h1>
          <Link to="/" className="text-sm text-white/40 transition-colors hover:text-white/70">
            Back to site
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="mx-auto w-full max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 text-center"
          >
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/5">
              <Lock className="size-7 text-lime-400" />
            </div>
            <h2 className="font-display text-3xl font-bold text-white">Team Workspace</h2>
            <p className="mt-3 text-sm text-white/50">Select your workspace and enter the password to continue.</p>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2">
            {WORKSPACES.map((ws, i) => {
              const Icon = ws.icon;
              return (
                <motion.div
                  key={ws.slug}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * i }}
                >
                  <Link
                    to={`/team/access/${ws.slug}`}
                    className={`group block rounded-2xl border border-white/5 bg-gradient-to-br ${ws.color} p-6 transition-all hover:border-white/10 hover:scale-[1.02]`}
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-white/5">
                        <Icon className="size-5 text-white/60" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-display text-sm font-bold text-white">{ws.name}</h3>
                      </div>
                      <Lock className="size-4 text-white/20" />
                    </div>
                    <p className="mb-4 text-xs text-white/40">{ws.description}</p>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-lime-400/70 transition-colors group-hover:text-lime-400">
                      Open Workspace <ArrowRight className="size-3.5" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

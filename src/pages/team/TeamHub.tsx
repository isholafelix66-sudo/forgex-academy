import { Link } from "react-router";
import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Headphones,
  HeartHandshake,
  FileText,
  Bot,
  ArrowRight,
  Loader2,
  Lock,
} from "lucide-react";
import logo from "@/assets/logo.svg";

const TEAM_ICONS: Record<string, React.ReactNode> = {
  academic: <GraduationCap className="size-7" />,
  "tutor-support": <Headphones className="size-7" />,
  "student-support": <HeartHandshake className="size-7" />,
  content: <FileText className="size-7" />,
  "ai-prompts": <Bot className="size-7" />,
};

const TEAM_COLORS: Record<string, string> = {
  academic: "from-blue-400/20 to-blue-600/10",
  "tutor-support": "from-amber-400/20 to-amber-600/10",
  "student-support": "from-emerald-400/20 to-emerald-600/10",
  content: "from-purple-400/20 to-purple-600/10",
  "ai-prompts": "from-lime-400/20 to-lime-600/10",
};

const TEAM_DESCRIPTIONS: Record<string, string> = {
  academic: "Academic operations, academic quality, and learning support.",
  "tutor-support": "Tutor-related support, onboarding, and tutor issues.",
  "student-support":
    "Student-facing support, student issues, and student experience.",
  content: "Content creation, learning materials, and content operations.",
  "ai-prompts":
    "AI Hub, prompt resources, AI-related tools, and prompt-library operations.",
};

export default function TeamHub() {
  const teams = useQuery(api.teamAccess.listTeams);
  const seedMutation = useMutation(api.teamAccess.seedTeamAccess);

  // Seed team access on first load (idempotent)
  useEffect(() => {
    seedMutation();
  }, [seedMutation]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="ForgeX" className="size-8 rounded-lg" />
            <span className="font-display text-sm font-bold tracking-wide text-white">
              ForgeX Academy
            </span>
          </Link>
          <Link
            to="/"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/50 transition-colors hover:border-lime-400/40 hover:text-lime-300"
          >
            Back to Home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl border border-lime-400/20 bg-lime-400/5">
            <Lock className="size-8 text-lime-400" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white md:text-5xl">
            Team Hub
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/40">
            Select your team to access its workspace. Each team is protected by
            its own password.
          </p>
        </motion.div>

        {/* Team Cards */}
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(teams ?? []).map((team, i) => (
            <motion.div
              key={team.slug}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 * i }}
            >
              <Link
                to={
                  team.isActive
                    ? `/team/access/${team.slug}`
                    : "#"
                }
                className={`group flex h-full flex-col rounded-2xl border border-white/5 bg-card p-6 transition-all ${
                  team.isActive
                    ? "hover:border-lime-400/25 hover:shadow-lg hover:shadow-lime-400/5"
                    : "cursor-not-allowed opacity-50"
                }`}
              >
                <div
                  className={`mb-4 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br ${
                    TEAM_COLORS[team.slug] || "from-white/10 to-white/5"
                  } text-lime-300`}
                >
                  {TEAM_ICONS[team.slug] || (
                    <Lock className="size-6" />
                  )}
                </div>
                <h3 className="font-display text-base font-bold text-white">
                  {team.name}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-white/40">
                  {TEAM_DESCRIPTIONS[team.slug] || ""}
                </p>
                <div className="mt-5 flex items-center justify-between">
                  {team.isActive ? (
                    <>
                      <span className="text-xs font-medium text-lime-400">
                        Enter Team
                      </span>
                      <ArrowRight className="size-4 text-lime-400 transition-transform group-hover:translate-x-0.5" />
                    </>
                  ) : (
                    <span className="text-xs font-medium text-red-400/60">
                      Unavailable
                    </span>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}

          {teams === undefined && (
            <div className="col-span-full flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-lime-400" />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-xs text-white/30">
          &copy; {new Date().getFullYear()} ForgeX Academy — Team Hub
        </div>
      </footer>
    </div>
  );
}

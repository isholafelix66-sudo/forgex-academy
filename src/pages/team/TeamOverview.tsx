import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Loader2,
  MessageSquare,
  Plus,
  Star,
} from "lucide-react";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-400 bg-red-500/10",
  high: "text-orange-400 bg-orange-500/10",
  medium: "text-yellow-400 bg-yellow-500/10",
  low: "text-green-400 bg-green-500/10",
};

const STATUS_COLORS: Record<string, string> = {
  todo: "text-white/60 bg-white/5",
  in_progress: "text-blue-400 bg-blue-500/10",
  in_review: "text-yellow-400 bg-yellow-500/10",
  completed: "text-green-400 bg-green-500/10",
};

export default function TeamOverview() {
  const { user } = useAuth();
  const myTeam = useQuery(api.team.getMyTeam);
  const team = myTeam?.team;
  const workItems = useQuery(
    api.team.getTeamWorkItems,
    team ? { teamId: team._id } : "skip"
  );
  const activity = useQuery(
    api.team.getTeamActivity,
    team ? { teamId: team._id, limit: 10 } : "skip"
  );

  if (!team || workItems === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-lime-400" />
      </div>
    );
  }

  const todo = workItems.filter((i) => i.status === "todo").length;
  const inProgress = workItems.filter((i) => i.status === "in_progress").length;
  const completed = workItems.filter((i) => i.status === "completed").length;
  const review = workItems.filter((i) => i.status === "in_review").length;

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-white">
          Welcome, {user?.name?.split(" ")[0] || "Member"}
        </h1>
        <p className="mt-1 text-sm text-white/50">
          {team.name} workspace
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        className="grid grid-cols-2 gap-4 md:grid-cols-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {[
          { label: "To Do", value: todo, icon: Clock, color: "text-white/60" },
          { label: "In Progress", value: inProgress, icon: Star, color: "text-blue-400" },
          { label: "In Review", value: review, icon: MessageSquare, color: "text-yellow-400" },
          { label: "Completed", value: completed, icon: CheckCircle2, color: "text-green-400" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/5 bg-card p-4"
          >
            <div className="mb-2 flex items-center gap-2">
              <s.icon className={`size-4 ${s.color}`} />
              <span className="text-xs text-white/50">{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent work */}
        <motion.div
          className="rounded-2xl border border-white/5 bg-card p-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <h2 className="mb-4 text-sm font-semibold text-white">
            Recent Work Items
          </h2>
          {workItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/40">
              No work items yet. Create one from the Work tab.
            </p>
          ) : (
            <div className="space-y-3">
              {workItems.slice(0, 5).map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white/90">
                      {item.title}
                    </p>
                    <p className="text-xs text-white/40">
                      {item.assignee?.name || "Unassigned"}
                    </p>
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[item.priority] || ""}`}
                    >
                      {item.priority}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[item.status] || ""}`}
                    >
                      {item.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Recent activity */}
        <motion.div
          className="rounded-2xl border border-white/5 bg-card p-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <h2 className="mb-4 text-sm font-semibold text-white">
            Recent Activity
          </h2>
          {(!activity || activity.length === 0) ? (
            <p className="py-8 text-center text-sm text-white/40">
              No activity yet.
            </p>
          ) : (
            <div className="space-y-3">
              {activity.map((a) => (
                <div
                  key={a._id}
                  className="flex items-start gap-3 rounded-lg bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="mt-0.5 size-2 shrink-0 rounded-full bg-lime-400" />
                  <div className="min-w-0">
                    <p className="text-sm text-white/80">
                      <span className="font-medium text-white/90">
                        {a.user?.name || "Someone"}
                      </span>{" "}
                      {a.action.replace(/_/g, " ")}
                      {a.targetLabel ? (
                        <>
                          {" "}
                          <span className="text-lime-400/80">
                            {a.targetLabel}
                          </span>
                        </>
                      ) : null}
                    </p>
                    {a.details && (
                      <p className="mt-0.5 text-xs text-white/40">
                        {a.details}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-white/30">
                      {new Date(a.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

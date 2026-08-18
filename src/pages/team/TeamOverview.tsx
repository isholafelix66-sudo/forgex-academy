import { useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import {
  Loader2,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertCircle,
  Activity,
} from "lucide-react";

export default function TeamOverview() {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const myTeam = useQuery(api.team.getMyTeam);
  const team = myTeam?.team as any;
  const user = myTeam?.user as any;

  const workItems = useQuery(
    api.team.getTeamWorkItems,
    team ? { teamId: team._id } : "skip",
  );
  const activity = useQuery(
    api.team.getTeamActivity,
    team ? { teamId: team._id, limit: 10 } : "skip",
  );

  if (!team) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-lime-400" />
      </div>
    );
  }

  const todoItems = workItems?.filter((i: any) => i.status === "todo") ?? [];
  const inProgressItems = workItems?.filter((i: any) => i.status === "in_progress") ?? [];
  const completedItems = workItems?.filter((i: any) => i.status === "completed") ?? [];
  const urgentItems = workItems?.filter((i: any) => i.priority === "urgent" && i.status !== "completed") ?? [];

  const stats = [
    {
      label: "To Do",
      value: todoItems.length,
      icon: <Clock className="size-5" />,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      label: "In Progress",
      value: inProgressItems.length,
      icon: <AlertCircle className="size-5" />,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
    },
    {
      label: "Completed",
      value: completedItems.length,
      icon: <CheckCircle2 className="size-5" />,
      color: "text-green-400",
      bg: "bg-green-400/10",
    },
    {
      label: "Urgent",
      value: urgentItems.length,
      icon: <ClipboardList className="size-5" />,
      color: "text-red-400",
      bg: "bg-red-400/10",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-lime-400/15 bg-gradient-to-br from-lime-400/5 to-transparent p-6"
      >
        <h2 className="font-display text-xl font-bold text-white">
          Welcome, {user?.name ?? "Team Member"} 👋
        </h2>
        <p className="mt-1 text-sm text-white/50">
          {team.description || `You're part of the ${team.name}. Here's your workspace overview.`}
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className="rounded-xl border border-white/5 bg-card p-4"
          >
            <div className={`mb-3 inline-flex rounded-lg p-2 ${s.bg}`}>
              <span className={s.color}>{s.icon}</span>
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-white/40">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border border-white/5 bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="size-4 text-lime-400" />
          <h3 className="font-display text-sm font-bold text-white">
            Recent Activity
          </h3>
        </div>
        {!activity ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-4 animate-spin text-lime-400" />
          </div>
        ) : activity.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/30">
            No activity yet. Start working on your first task!
          </p>
        ) : (
          <div className="space-y-2">
            {activity.map((a: any) => (
              <div
                key={a._id}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
              >
                <div className="mt-1 size-2 shrink-0 rounded-full bg-lime-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/70">
                    <span className="font-medium text-white">
                      {a.user?.name ?? "Someone"}
                    </span>{" "}
                    {a.action.replace(/_/g, " ")}
                    {a.targetLabel ? (
                      <>
                        {" "}
                        <span className="text-lime-400/70">
                          {a.targetLabel}
                        </span>
                      </>
                    ) : null}
                  </p>
                  {a.details && (
                    <p className="mt-0.5 text-xs text-white/30">
                      {a.details}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-white/20">
                  {new Date(a.createdAt).toLocaleString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

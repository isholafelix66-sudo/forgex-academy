import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function TeamActivity() {
  const myTeam = useQuery(api.team.getMyTeam);
  const team = myTeam?.team as any;
  const activity = useQuery(api.team.getTeamActivity, team ? { teamId: team._id, limit: 50 } : "skip");

  if (!team || activity === undefined) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-lime-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Activity</h1>
        <p className="mt-0.5 text-sm text-white/50">Recent actions across {team.name}.</p>
      </div>
      {activity.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-card p-8 text-center"><p className="text-sm text-white/40">No activity yet.</p></div>
      ) : (
        <div className="space-y-2">
          {activity.map((a: any, i: number) => (
            <motion.div key={a._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.02 * i }} className="flex items-start gap-3 rounded-xl border border-white/5 bg-card px-4 py-3">
              <div className="mt-0.5 size-2 shrink-0 rounded-full bg-lime-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/80">
                  <span className="font-medium text-white">{a.user?.name || "Someone"}</span>{" "}
                  <span className="text-white/60">{a.action.replace(/_/g, " ")}</span>
                  {a.targetLabel && <><span className="text-lime-400/80"> {a.targetLabel}</span></>}
                </p>
                {a.details && <p className="mt-0.5 text-xs text-white/40">{a.details}</p>}
              </div>
              <span className="shrink-0 text-[10px] text-white/30">{new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

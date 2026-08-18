import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTeamAuth } from "@/hooks/use-team-auth";
import { Loader2, Activity } from "lucide-react";

export default function TeamActivity() {
  const { token } = useTeamAuth();
  const activity = useQuery(
    api.teamAuthWorkspace.getTeamActivity,
    token ? { token, limit: 50 } : "skip",
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="size-5 text-lime-400" />
        <h2 className="font-display text-lg font-bold text-white">Activity</h2>
      </div>

      {!activity ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-lime-400" />
        </div>
      ) : activity.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-card p-8 text-center">
          <Activity className="mx-auto size-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No activity yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activity.map((a: any) => (
            <div
              key={a._id}
              className="flex items-start gap-3 rounded-xl border border-white/5 bg-card px-4 py-3 transition-colors hover:border-white/10"
            >
              <div className="mt-1 size-2 shrink-0 rounded-full bg-lime-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/80">
                  <span className="font-medium text-white">
                    {a.user?.name ?? "Someone"}
                  </span>{" "}
                  {a.action.replace(/_/g, " ")}
                  {a.targetLabel ? (
                    <>
                      {" "}
                      <span className="text-lime-400/80">{a.targetLabel}</span>
                    </>
                  ) : null}
                </p>
                {a.details && (
                  <p className="mt-0.5 text-xs text-white/40">{a.details}</p>
                )}
              </div>
              <span className="shrink-0 text-[10px] text-white/30">
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
  );
}

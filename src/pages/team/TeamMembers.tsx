import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTeamAuth } from "@/hooks/use-team-auth";
import { Loader2, Users } from "lucide-react";
import { Avatar } from "@/components/site/Avatar";

export default function TeamMembers() {
  const { token } = useTeamAuth();
  const members = useQuery(
    api.teamAuthWorkspace.listTeamMembers,
    token ? { token } : "skip",
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="size-5 text-lime-400" />
        <h2 className="font-display text-lg font-bold text-white">Members</h2>
      </div>

      {!members ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-lime-400" />
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-card p-8 text-center">
          <Users className="mx-auto size-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No members yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {members.map((m: any) => (
            <div
              key={m._id}
              className="flex items-center gap-4 rounded-xl border border-white/5 bg-card p-4 transition-colors hover:border-white/10"
            >
              <Avatar
                name={m.teamAccount?.name ?? m.user?.name ?? "Unknown"}
                image={m.user?.image}
                className="size-11"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">
                  {m.teamAccount?.name ?? m.user?.name ?? "Unknown"}
                </p>
                <p className="text-xs text-white/40">
                  {m.teamAccount?.email ?? m.user?.email}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium ${
                  m.role === "teamLead"
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-white/5 text-white/40"
                }`}
              >
                {m.role === "teamLead" ? "Team Lead" : "Member"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

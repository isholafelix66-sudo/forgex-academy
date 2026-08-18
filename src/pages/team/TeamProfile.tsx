import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, UserCircle } from "lucide-react";
import { Avatar } from "@/components/site/Avatar";

export default function TeamProfile() {
  const { user } = useAuth();
  const myTeam = useQuery(api.team.getMyTeam);
  const team = myTeam?.team as any;
  const membership = myTeam?.membership as any;

  if (!user) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-lime-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <UserCircle className="size-5 text-lime-400" />
        <h2 className="font-display text-lg font-bold text-white">Profile</h2>
      </div>

      <div className="rounded-2xl border border-white/5 bg-card p-6">
        <div className="flex items-center gap-4">
          <Avatar name={user.name ?? "Member"} image={user.image} className="size-16" />
          <div>
            <h3 className="font-display text-lg font-bold text-white">
              {user.name ?? "Team Member"}
            </h3>
            <p className="text-sm text-white/40">{user.email}</p>            {team && (
              <p className="mt-1 text-xs text-lime-400/70">
                {team.name} • {" "}
                {membership?.role === "teamLead" ? "Team Lead" : "Member"}
              </p>
            )}
          </div>
        </div>
      </div>

      {user.bio && (
        <div className="rounded-2xl border border-white/5 bg-card p-6">
          <h4 className="mb-2 text-xs font-semibold text-white/50">Bio</h4>
          <p className="text-sm text-white/70">{user.bio}</p>
        </div>
      )}

      {user.skills && user.skills.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-card p-6">
          <h4 className="mb-2 text-xs font-semibold text-white/50">Skills</h4>
          <div className="flex flex-wrap gap-2">
            {user.skills.map((skill: string) => (
              <span
                key={skill}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

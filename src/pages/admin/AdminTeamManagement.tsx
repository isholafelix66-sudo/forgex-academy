import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Loader2,
  Shield,
  Search,
  ChevronDown,
  Check,
  X,
  Users,
  Clock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

const TEAM_ROLES = [
  { value: "academic", label: "Academic Team", icon: "📚", color: "text-blue-300" },
  { value: "ai-support", label: "AI Support", icon: "🤖", color: "text-purple-300" },
  { value: "tutor-support", label: "Tutor Support", icon: "🎓", color: "text-amber-300" },
  { value: "student-support", label: "Student Support", icon: "💚", color: "text-lime-300" },
  { value: "content", label: "Content Team", icon: "📝", color: "text-cyan-300" },
] as const;

/** Error boundary for the entire admin team management section */
function ErrorFallback({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-8 text-center">
      <AlertTriangle className="mx-auto size-10 text-rose-400" />
      <p className="mt-3 font-display text-lg font-bold text-white">Something went wrong</p>
      <p className="mt-2 text-sm text-white/40">{error}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/5"
      >
        <RefreshCw className="size-4" />
        Retry
      </button>
    </div>
  );
}

export default function AdminTeamManagement() {
  const users = useQuery(api.teamAccess.adminListUsers);
  const setTeamRole = useMutation(api.teamAccess.setTeamRole);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Reset error when query retries
  useEffect(() => {
    if (users !== undefined) {
      setQueryError(null);
    }
  }, [users]);

  const handleAssign = async (userId: string, role: string) => {
    if (!role) return;
    setSaving(true);
    try {
      await setTeamRole({ userId: userId as any, teamRole: role as any });
      toast.success("Team role assigned successfully");
      setEditingId(null);
    } catch (err: any) {
      const msg = err?.message || "Failed to assign role";
      toast.error(msg);
      // Do NOT reload — just show the error
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setSaving(true);
    try {
      await setTeamRole({ userId: userId as any, teamRole: null });
      toast.success("Team role removed");
      setEditingId(null);
    } catch (err: any) {
      const msg = err?.message || "Failed to remove role";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const safeUsers = Array.isArray(users) ? users : [];
  const filteredUsers = safeUsers.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u?.name ?? "").toLowerCase().includes(q) ||
      (u?.email ?? "").toLowerCase().includes(q)
    );
  });

  const roleCounts = TEAM_ROLES.map((r) => ({
    ...r,
    count: safeUsers.filter((u) => u?.teamRole === r.value).length,
  }));

  // Error state
  if (queryError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Team Access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage team role assignments. Assign users to team workspaces.
          </p>
        </div>
        <ErrorFallback error={queryError} onRetry={() => { setQueryError(null); }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Team Access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage team role assignments. Assign users to team workspaces.
        </p>
      </div>

      {/* Info card */}
      <div className="rounded-2xl border border-lime-400/20 bg-lime-400/5 p-4">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 size-5 text-lime-400" />
          <div>
            <p className="text-sm font-medium text-lime-300">How it works</p>
            <p className="mt-1 text-xs text-lime-300/60">
              Users sign up with email/password and verify via OTP. Once verified,
              assign them a team role here. They can then access their team
              dashboard at /team.
            </p>
          </div>
        </div>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {roleCounts.map((r) => (
          <div
            key={r.value}
            className="rounded-xl border border-white/10 bg-card p-4 text-center"
          >
            <span className="text-2xl">{r.icon}</span>
            <p className="mt-2 text-sm font-medium text-white">{r.label}</p>
            <p className="mt-1 text-xs text-white/40">{r.count} assigned</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users by name or email..."
          className="h-11 w-full rounded-xl border border-white/10 bg-card pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none"
        />
      </div>

      {/* Users table */}
      {users === undefined ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-lime-400" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-card p-12 text-center">
          <Users className="mx-auto size-10 text-white/20" />
          <p className="mt-3 text-sm text-white/40">
            {search ? "No users match your search." : "No users found."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                    Email Verified
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">
                    Current Role
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/40">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((u) => {
                  if (!u?._id) return null;
                  const isEditing = editingId === u._id;
                  const currentRole = TEAM_ROLES.find((r) => r.value === u.teamRole);

                  return (
                    <tr
                      key={u._id}
                      className="transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-white">{u.name ?? "Anonymous"}</p>
                          <p className="text-xs text-white/40">{u.email ?? ""}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.emailVerified ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-lime-400/10 px-2 py-0.5 text-xs font-medium text-lime-300">
                            <Check className="size-3" />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs font-medium text-white/40">
                            <Clock className="size-3" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {currentRole ? (
                          <span className={`inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium ${currentRole.color}`}>
                            {currentRole.icon} {currentRole.label}
                          </span>
                        ) : (
                          <span className="text-xs text-white/30">No role</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            {saving ? (
                              <Loader2 className="size-4 animate-spin text-lime-400" />
                            ) : (
                              <>
                                <div className="relative">
                                  <select
                                    className="h-8 appearance-none rounded-lg border border-white/10 bg-black/30 pl-3 pr-8 text-xs text-white focus:border-lime-400/40 focus:outline-none"
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val) {
                                        handleAssign(u._id, val);
                                      }
                                    }}
                                    defaultValue=""
                                  >
                                    <option value="" disabled>
                                      Select role...
                                    </option>
                                    {TEAM_ROLES.map((r) => (
                                      <option key={r.value} value={r.value}>
                                        {r.icon} {r.label}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-white/40" />
                                </div>
                                {u.teamRole && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemove(u._id)}
                                    className="h-8 rounded-lg border border-rose-400/30 px-2 text-xs text-rose-300 transition-colors hover:bg-rose-400/10"
                                  >
                                    Remove
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="h-8 rounded-lg border border-white/10 px-2 text-xs text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                                >
                                  <X className="size-3" />
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingId(u._id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:border-lime-400/30 hover:bg-lime-400/5 hover:text-lime-300"
                          >
                            {u.teamRole ? "Change" : "Assign"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, Shield, Search, ChevronDown, Check, X } from "lucide-react";
import { toast } from "sonner";

const TEAM_ROLES = [
  { value: "academic", label: "Academic Support", icon: "📚", color: "text-blue-300" },
  { value: "ai-support", label: "AI Support", icon: "🤖", color: "text-purple-300" },
  { value: "tutor-support", label: "Tutor Support", icon: "🎓", color: "text-amber-300" },
  { value: "student-support", label: "Student Support", icon: "💚", color: "text-lime-300" },
] as const;

export default function AdminTeamManagement() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");

  // Only admins should access this page
  if (user?.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Access denied.</p>
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

      {/* Team role summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TEAM_ROLES.map((r) => (
          <div
            key={r.value}
            className="rounded-xl border border-white/10 bg-card p-4 text-center"
          >
            <span className="text-2xl">{r.icon}</span>
            <p className="mt-2 text-sm font-medium text-white">{r.label}</p>
          </div>
        ))}
      </div>

      {/* Admin team role management uses the admin page's existing
          admin-set-team-role mutation. Since we're building on the existing
          user system, the admin can assign roles via this interface. */}
      <AdminTeamRoleManager />
    </div>
  );
}

/** Internal component that manages the team role assignment UI */
function AdminTeamRoleManager() {
  const [search, setSearch] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const setTeamRole = useMutation(api.teamAccess.setTeamRole);

  const handleAssign = async (userId: string, role: string) => {
    setSaving(true);
    try {
      await setTeamRole({ userId: userId as any, teamRole: role as any });
      toast.success("Team role updated successfully");
      setEditingUserId(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update role");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setSaving(true);
    try {
      await setTeamRole({ userId: userId as any, teamRole: null });
      toast.success("Team role removed");
      setEditingUserId(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove role");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-card">
      <div className="border-b border-white/10 p-4">
        <p className="text-sm text-white/40">
          Use the Admin Users page to assign team roles to individual users.
          Navigate to <span className="font-mono text-lime-300">/admin/users</span> to manage
          user accounts and assign team workspace access.
        </p>
      </div>
    </div>
  );
}

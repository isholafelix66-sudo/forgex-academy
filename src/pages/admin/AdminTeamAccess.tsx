import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import {
  Loader2,
  Shield,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminTeamAccess() {
  const teams = useQuery(api.teamAccess.adminListTeams);
  const changePassword = useMutation(api.teamAccess.adminChangePassword);
  const toggleTeam = useMutation(api.teamAccess.adminToggleTeam);
  const seedTeams = useMutation(api.teamAccess.seedTeamAccess);

  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingSlug, setTogglingSlug] = useState<string | null>(null);

  const handleSeed = async () => {
    try {
      await seedTeams();
    } catch {
      // Ignore
    }
  };

  const handleSavePassword = async () => {
    if (!editingSlug) return;
    setPwError(null);
    setPwSuccess(null);

    if (!newPassword) {
      setPwError("Password cannot be empty.");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      await changePassword({ teamSlug: editingSlug, newPassword });
      setPwSuccess("Team password updated successfully.");
      setEditingSlug(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (slug: string, isActive: boolean) => {
    setTogglingSlug(slug);
    try {
      await toggleTeam({ teamSlug: slug, isActive: !isActive });
    } catch {
      // Ignore
    } finally {
      setTogglingSlug(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Team Access Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage team passwords and access status.
          </p>
        </div>
        <Button
          onClick={handleSeed}
          variant="outline"
          className="gap-2 border-white/10"
        >
          <Shield className="size-4" />
          Seed Teams
        </Button>
      </div>

      {teams === undefined ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-lime-400" />
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-card p-8 text-center">
          <Lock className="mx-auto size-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">No teams configured</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click &quot;Seed Teams&quot; to create the default team configurations.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((team, i) => (
            <motion.div
              key={team.teamSlug}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i }}
              className="rounded-2xl border border-white/5 bg-card p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex size-10 items-center justify-center rounded-xl ${
                      team.isActive
                        ? "bg-lime-400/10 text-lime-400"
                        : "bg-red-400/10 text-red-400"
                    }`}
                  >
                    {team.isActive ? (
                      <Unlock className="size-5" />
                    ) : (
                      <XCircle className="size-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-white">
                      {team.teamName}
                    </h3>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {team.hasPassword ? (
                          <CheckCircle2 className="size-3 text-lime-400" />
                        ) : (
                          <XCircle className="size-3 text-red-400" />
                        )}
                        Password: {team.hasPassword ? "Configured" : "Not Set"}
                      </span>
                      <span>
                        Status: {team.isActive ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-white/10"
                    onClick={() => {
                      setEditingSlug(editingSlug === team.teamSlug ? null : team.teamSlug);
                      setNewPassword("");
                      setConfirmPassword("");
                      setPwError(null);
                      setPwSuccess(null);
                    }}
                  >
                    <Lock className="size-3.5" />
                    Change Password
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`gap-1.5 ${
                      team.isActive
                        ? "text-amber-400 hover:text-amber-300"
                        : "text-lime-400 hover:text-lime-300"
                    }`}
                    disabled={togglingSlug === team.teamSlug}
                    onClick={() => handleToggle(team.teamSlug, team.isActive)}
                  >
                    {togglingSlug === team.teamSlug ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : team.isActive ? (
                      <>
                        <XCircle className="size-3.5" />
                        Disable
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-3.5" />
                        Enable
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Password change form */}
              {editingSlug === team.teamSlug && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-4 border-t border-white/5 pt-4"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/60">
                        New Password
                      </label>
                      <div className="relative">
                        <Input
                          type={showNew ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min 6 characters"
                          className="h-9 border-white/10 bg-white/5 pr-9 text-white text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew(!showNew)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                        >
                          {showNew ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/60">
                        Confirm Password
                      </label>
                      <Input
                        type={showNew ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        className="h-9 border-white/10 bg-white/5 text-white text-sm"
                      />
                    </div>
                  </div>

                  {pwError && (
                    <p className="mt-2 text-xs text-red-400">{pwError}</p>
                  )}
                  {pwSuccess && (
                    <p className="mt-2 text-xs text-lime-400">{pwSuccess}</p>
                  )}

                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5 bg-lime-400 text-black hover:bg-lime-300"
                      disabled={saving || !newPassword}
                      onClick={handleSavePassword}
                    >
                      {saving ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Save className="size-3.5" />
                      )}
                      Save Password
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingSlug(null);
                        setPwError(null);
                        setPwSuccess(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

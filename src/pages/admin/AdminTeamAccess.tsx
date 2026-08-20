import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { Loader2, Lock, Save, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminTeamAccess() {
  const workspaces = useQuery(api.teamAccess.adminListWorkspaces);
  const changePassword = useMutation(api.teamAccess.adminChangePassword);
  const seedWorkspaces = useMutation(api.teamAccess.seedWorkspaces);

  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSeed = async () => {
    try { await seedWorkspaces(); } catch { /* */ }
  };

  const handleSavePassword = async () => {
    if (!editingSlug) return;
    setPwError(null);
    setPwSuccess(null);
    if (!newPassword) { setPwError("Password cannot be empty."); return; }
    if (newPassword.length < 4) { setPwError("Password must be at least 4 characters."); return; }
    if (newPassword !== confirmPassword) { setPwError("Passwords do not match."); return; }
    setSaving(true);
    try {
      await changePassword({ teamSlug: editingSlug, newPassword });
      setPwSuccess("Workspace password updated successfully.");
      setEditingSlug(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Team Workspace Passwords</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage workspace passwords. Changes take effect immediately.</p>
        </div>
        <Button onClick={handleSeed} variant="outline" className="gap-2 border-white/10">
          <Lock className="size-4" /> Seed Workspaces
        </Button>
      </div>

      {workspaces === undefined ? (
        <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-lime-400" /></div>
      ) : workspaces.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-card p-8 text-center">
          <Lock className="mx-auto size-8 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">No workspaces configured</p>
          <p className="mt-1 text-xs text-muted-foreground">Click "Seed Workspaces" to create the default configurations.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {workspaces.map((ws, i) => (
            <motion.div
              key={ws.slug}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 * i }}
              className="rounded-2xl border border-white/5 bg-card p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`flex size-10 items-center justify-center rounded-xl ${ws.isActive ? "bg-lime-400/10 text-lime-400" : "bg-red-400/10 text-red-400"}`}>
                    <Lock className="size-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-bold text-white">{ws.name}</h3>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {ws.hasPassword ? <CheckCircle2 className="size-3 text-lime-400" /> : null}
                        Password: {ws.hasPassword ? "Configured" : "Not Set"}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-white/10"
                  onClick={() => {
                    setEditingSlug(editingSlug === ws.slug ? null : ws.slug);
                    setNewPassword("");
                    setConfirmPassword("");
                    setPwError(null);
                    setPwSuccess(null);
                  }}
                >
                  <Lock className="size-3.5" />
                  Change Password
                </Button>
              </div>

              {editingSlug === ws.slug && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 border-t border-white/5 pt-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/60">New Password</label>
                      <div className="relative">
                        <Input
                          type={showNew ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min 4 characters"
                          className="h-9 border-white/10 bg-white/5 pr-9 text-white text-sm"
                        />
                        <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                          {showNew ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/60">Confirm Password</label>
                      <Input
                        type={showNew ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat password"
                        className="h-9 border-white/10 bg-white/5 text-white text-sm"
                      />
                    </div>
                  </div>
                  {pwError && <p className="mt-2 text-xs text-red-400">{pwError}</p>}
                  {pwSuccess && <p className="mt-2 text-xs text-lime-400">{pwSuccess}</p>}
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="gap-1.5 bg-lime-400 text-black hover:bg-lime-300" disabled={saving || !newPassword} onClick={handleSavePassword}>
                      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                      Save Password
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingSlug(null); setPwError(null); setPwSuccess(null); }}>
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

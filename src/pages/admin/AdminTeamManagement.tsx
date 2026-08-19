import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import {
  Users,
  UserCheck,
  UserX,
  KeyRound,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Shield,
  Eye,
  Copy,
  Loader2,
  Search,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tab = "applications" | "members" | "recovery" | "teams";

export default function AdminTeamManagement() {
  const [tab, setTab] = useState<Tab>("applications");
  const [search, setSearch] = useState("");
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [approveTeamSlug, setApproveTeamSlug] = useState("");
  const [approveRole, setApproveRole] = useState<"teamMember" | "teamLead">(
    "teamMember",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const applications = useQuery(api.teamAuth.listAllTeamApplications);
  const accounts = useQuery(api.teamAuth.listAllTeamAccounts);
  const recoveryRequests = useQuery(api.teamAuth.listPendingRecoveryRequests);
  const teams = useQuery(api.teamAuth.getTeamCategories);

  const approveApp = useMutation(api.teamAuth.approveTeamApplication);
  const rejectApp = useMutation(api.teamAuth.rejectTeamApplication);
  const resetPassword = useMutation(api.teamAuth.adminResetTeamPassword);
  const toggleStatus = useMutation(api.teamAuth.toggleTeamAccountStatus);
  const approveRecovery = useMutation(api.teamAuth.approvePasswordRecovery);
  const rejectRecovery = useMutation(api.teamAuth.rejectPasswordRecovery);
  const createTeamAccount = useMutation(api.teamAuth.adminCreateTeamAccount);
  const deleteTeamAccount = useMutation(api.teamAuth.adminDeleteTeamAccount);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createTeamId, setCreateTeamId] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createRole, setCreateRole] = useState<"teamMember" | "teamLead" | "admin">("teamMember");
  const [createPassword, setCreatePassword] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdCreds, setCreatedCreds] = useState<{ teamId: string; password: string } | null>(null);

  const handleApprove = async (appId: string) => {
    if (!approveTeamSlug.trim()) return;
    setBusy(appId);
    try {
      await approveApp({
        applicationId: appId as any,
        teamSlug: approveTeamSlug.trim(),
        role: approveRole,
      });
      setSelectedApp(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async (appId: string) => {
    if (!rejectReason.trim()) return;
    setBusy(appId);
    try {
      await rejectApp({
        applicationId: appId as any,
        reason: rejectReason.trim(),
      });
      setSelectedApp(null);
      setRejectReason("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setBusy(null);
    }
  };

  const handleResetPassword = async (accountId: string) => {
    setBusy(accountId);
    try {
      const result = await resetPassword({
        teamAccountId: accountId as any,
      });
      setNewPassword(result.newPassword);
      setShowCredentials(accountId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reset");
    } finally {
      setBusy(null);
    }
  };

  const handleToggleStatus = async (
    accountId: string,
    status: "active" | "suspended",
  ) => {
    setBusy(accountId);
    try {
      await toggleStatus({
        teamAccountId: accountId as any,
        status,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusy(null);
    }
  };

  const handleApproveRecovery = async (recoveryId: string) => {
    setBusy(recoveryId);
    try {
      const result = await approveRecovery({
        recoveryId: recoveryId as any,
      });
      setNewPassword(result.newPassword);
      setShowCredentials(recoveryId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setBusy(null);
    }
  };

  const handleRejectRecovery = async (recoveryId: string) => {
    const reason = prompt("Rejection reason (optional):");
    if (reason === null) return;
    setBusy(recoveryId);
    try {
      await rejectRecovery({ recoveryId: recoveryId as any, reason });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setBusy(null);
    }
  };

  const handleCreateAccount = async () => {
    setCreateError(null);
    if (!createName.trim() || !createTeamId.trim() || !createSlug || !createPassword.trim()) {
      setCreateError("All fields are required.");
      return;
    }
    setBusy("create");
    try {
      await createTeamAccount({
        name: createName.trim(),
        teamId: createTeamId.trim(),
        teamSlug: createSlug,
        role: createRole,
        password: createPassword.trim(),
      });
      setCreatedCreds({ teamId: createTeamId.trim().toUpperCase(), password: createPassword.trim() });
      setCreateName("");
      setCreateTeamId("");
      setCreateSlug("");
      setCreateRole("teamMember");
      setCreatePassword("");
      setShowCreate(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm("Are you sure you want to delete this team member? This cannot be undone.")) return;
    setBusy(accountId);
    try {
      await deleteTeamAccount({ teamAccountId: accountId as any });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(null);
    }
  };

  const filteredApps = applications?.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredAccounts = accounts?.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase()) ||
      a.teamId.toLowerCase().includes(search.toLowerCase()),
  );

  type Tab = "applications" | "members" | "recovery" | "teams" | "create";

  const tabs: { key: Tab; label: string; count?: number }[] = [
    {
      key: "applications",
      label: "Applications",
      count: applications?.filter((a) => a.status === "pending").length,
    },
    { key: "members", label: "Team Members", count: accounts?.length },
    { key: "create", label: "+ Create Member" },
    {
      key: "recovery",
      label: "Password Recovery",
      count: recoveryRequests?.length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            Team Management
          </h1>
          <p className="mt-1 text-sm text-white/40">
            Manage team applications, members, and password recovery.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-lime-400/40 bg-lime-400/12 text-lime-300"
                : "border-white/10 text-white/50 hover:text-white/80"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-2 rounded-full bg-lime-400/20 px-2 py-0.5 text-xs font-bold text-lime-300">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or Team ID..."
          className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/30"
        />
      </div>

      {/* Credentials modal */}
      {showCredentials && newPassword && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-lime-400/30 bg-lime-400/5 p-5"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-lime-400">
            <KeyRound className="size-4" />
            New Password Generated
          </div>
          <p className="mt-2 font-mono text-lg font-bold text-white">
            {newPassword}
          </p>
          <p className="mt-1 text-xs text-white/40">
            Copy and share this password securely. It will not be shown again.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-white/10"
              onClick={() => {
                navigator.clipboard.writeText(newPassword);
              }}
            >
              <Copy className="mr-1 size-3" /> Copy
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowCredentials(null);
                setNewPassword(null);
              }}
            >
              Close
            </Button>
          </div>
        </motion.div>
      )}

      {/* Applications Tab */}
      {tab === "applications" && (
        <div className="space-y-3">
          {filteredApps === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/5"
                />
              ))}
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-card p-8 text-center">
              <Users className="mx-auto size-8 text-white/20" />
              <p className="mt-3 text-sm text-white/40">
                No applications found.
              </p>
            </div>
          ) : (
            filteredApps.map((app) => (
              <div
                key={app._id}
                className="rounded-2xl border border-white/5 bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {app.name}
                    </p>
                    <p className="text-xs text-white/40">{app.email}</p>
                    <p className="mt-1 text-xs text-white/30">
                      Skill: {app.skill} · Applied{" "}
                      {new Date(app.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                        app.status === "pending"
                          ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                          : app.status === "approved"
                            ? "border-green-400/30 bg-green-400/10 text-green-300"
                            : "border-red-400/30 bg-red-400/10 text-red-300"
                      }`}
                    >
                      {app.status.toUpperCase()}
                    </span>
                    {app.status === "pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setSelectedApp(
                            selectedApp?._id === app._id ? null : app,
                          )
                        }
                        className="text-xs text-white/50 hover:text-white"
                      >
                        Review
                      </Button>
                    )}
                  </div>
                </div>

                {/* Review panel */}
                {selectedApp?._id === app._id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 space-y-4 border-t border-white/5 pt-4"
                  >
                    <div>
                      <p className="text-xs font-medium text-white/50">
                        Introduction
                      </p>
                      <p className="mt-1 text-sm text-white/70">
                        {app.introduction}
                      </p>
                    </div>

                    {/* Approve form */}
                    <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                      <p className="mb-3 text-xs font-semibold text-green-400">
                        Approve Application
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs text-white/40">
                            Team Slug
                          </label>
                          <Input
                            value={approveTeamSlug}
                            onChange={(e) => setApproveTeamSlug(e.target.value)}
                            placeholder="e.g. academic, content, ai"
                            className="border-white/10 bg-white/5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-white/40">
                            Role
                          </label>
                          <select
                            value={approveRole}
                            onChange={(e) =>
                              setApproveRole(
                                e.target.value as "teamMember" | "teamLead",
                              )
                            }
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
                          >
                            <option value="teamMember">Team Member</option>
                            <option value="teamLead">Team Lead</option>
                          </select>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(app._id)}
                        disabled={!approveTeamSlug.trim() || busy === app._id}
                        className="mt-3 gap-1 bg-green-500 text-white hover:bg-green-600"
                      >
                        {busy === app._id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <UserCheck className="size-3" />
                        )}
                        Approve
                      </Button>
                    </div>

                    {/* Reject form */}
                    <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                      <p className="mb-3 text-xs font-semibold text-red-400">
                        Reject Application
                      </p>
                      <Input
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection..."
                        className="border-white/10 bg-white/5 text-xs text-white"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(app._id)}
                        disabled={!rejectReason.trim() || busy === app._id}
                        className="mt-3 gap-1"
                      >
                        {busy === app._id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <UserX className="size-3" />
                        )}
                        Reject
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Members Tab */}
      {tab === "members" && (
        <div className="space-y-3">
          {filteredAccounts === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/5"
                />
              ))}
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-card p-8 text-center">
              <Users className="mx-auto size-8 text-white/20" />
              <p className="mt-3 text-sm text-white/40">No team members yet.</p>
            </div>
          ) : (
            filteredAccounts.map((acct) => (
              <div
                key={acct._id}
                className="rounded-2xl border border-white/5 bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">
                        {acct.name}
                      </p>
                      <span className="font-mono text-xs text-lime-400">
                        {acct.teamId}
                      </span>
                    </div>
                    <p className="text-xs text-white/40">{acct.email}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
                      <span
                        className={`rounded-full border px-2 py-0.5 font-bold ${
                          acct.status === "active"
                            ? "border-green-400/30 bg-green-400/10 text-green-300"
                            : acct.status === "pending"
                              ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                              : "border-red-400/30 bg-red-400/10 text-red-300"
                        }`}
                      >
                        {acct.status.toUpperCase()}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/50">
                        {acct.role}
                      </span>
                      {acct.teamSlug && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/50">
                          Team: {acct.teamSlug}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleResetPassword(acct._id)}
                      disabled={busy === acct._id}
                      className="gap-1 text-xs text-white/50 hover:text-amber-300"
                      title="Reset password"
                    >
                      {busy === acct._id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <KeyRound className="size-3" />
                      )}
                      Reset PW
                    </Button>
                    {acct.status === "active" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleToggleStatus(acct._id, "suspended")
                        }
                        disabled={busy === acct._id}
                        className="gap-1 text-xs text-white/50 hover:text-red-300"
                      >
                        <UserX className="size-3" /> Suspend
                      </Button>
                    ) : acct.status === "suspended" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleStatus(acct._id, "active")}
                        disabled={busy === acct._id}
                        className="gap-1 text-xs text-white/50 hover:text-green-300"
                      >
                        <UserCheck className="size-3" /> Activate
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Member Tab */}
      {tab === "create" && (
        <div className="rounded-2xl border border-white/5 bg-card p-6">
          <h3 className="font-display text-lg font-bold text-white">Create Team Member</h3>
          <p className="mt-1 text-sm text-white/40">
            Create credentials for a new team member. They will use these to sign in to the Team Portal.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/50">Name</label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. John Doe"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/50">Team Member ID</label>
              <Input
                value={createTeamId}
                onChange={(e) => setCreateTeamId(e.target.value)}
                placeholder="e.g. CONTENT-001"
                className="border-white/10 bg-white/5 font-mono uppercase text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/50">Team</label>
              <select
                value={createSlug}
                onChange={(e) => setCreateSlug(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              >
                <option value="">Select a team...</option>
                {teams?.map((t) => (
                  <option key={t.slug} value={t.slug}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/50">Role</label>
              <select
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as any)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              >
                <option value="teamMember">Team Member</option>
                <option value="teamLead">Team Lead</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/50">Password</label>
              <Input
                type="text"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="border-white/10 bg-white/5 font-mono text-white"
              />
            </div>
          </div>
          {createError && (
            <p className="mt-3 text-sm text-red-400">{createError}</p>
          )}
          <Button
            onClick={handleCreateAccount}
            disabled={busy === "create" || !createName.trim() || !createTeamId.trim() || !createSlug || !createPassword.trim()}
            className="mt-4 gap-2 bg-lime-400 text-black hover:bg-lime-300"
          >
            {busy === "create" ? <Loader2 className="size-4 animate-spin" /> : <UserCheck className="size-4" />}
            Create Team Member
          </Button>
        </div>
      )}

      {/* Recovery Tab */}
      {tab === "recovery" && (
        <div className="space-y-3">
          {recoveryRequests === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/5"
                />
              ))}
            </div>
          ) : recoveryRequests.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-card p-8 text-center">
              <KeyRound className="mx-auto size-8 text-white/20" />
              <p className="mt-3 text-sm text-white/40">
                No pending recovery requests.
              </p>
            </div>
          ) : (
            recoveryRequests.map((req) => (
              <div
                key={req._id}
                className="rounded-2xl border border-white/5 bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">
                        {req.name}
                      </p>
                      <span className="font-mono text-xs text-amber-400">
                        {req.teamId}
                      </span>
                    </div>
                    <p className="text-xs text-white/40">{req.email}</p>
                    <p className="mt-1 text-xs text-white/30">
                      Reason: {req.reason}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => handleApproveRecovery(req._id)}
                      disabled={busy === req._id}
                      className="gap-1 bg-green-500 text-xs text-white hover:bg-green-600"
                    >
                      {busy === req._id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRejectRecovery(req._id)}
                      disabled={busy === req._id}
                      className="gap-1 text-xs"
                    >
                      {busy === req._id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <XCircle className="size-3" />
                      )}
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

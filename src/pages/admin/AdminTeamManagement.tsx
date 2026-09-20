import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { friendlyError } from "@/lib/errors";
import { useAuth } from "@/hooks/use-auth";
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
  MessageSquare,
  Send,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

const TEAM_ROLES = [
  { value: "academic", label: "Academic Team", icon: "📚", color: "text-blue-300" },
  { value: "ai-support", label: "AI Support", icon: "🤖", color: "text-purple-300" },
  { value: "tutor-support", label: "Tutor Support", icon: "🎓", color: "text-amber-300" },
  { value: "student-support", label: "Student Support", icon: "💚", color: "text-lime-300" },
  { value: "content", label: "Content Team", icon: "📝", color: "text-cyan-300" },
] as const;

type AdminTab = "team" | "support" | "messages";

function ErrorFallback({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-8 text-center">
      <AlertTriangle className="mx-auto size-10 text-rose-400" />
      <p className="mt-3 font-display text-lg font-bold text-white">Something went wrong</p>
      <p className="mt-2 text-sm text-white/40">{error}</p>
      <button type="button" onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/5">
        <RefreshCw className="size-4" /> Retry
      </button>
    </div>
  );
}

export default function AdminTeamManagement() {
  const [adminTab, setAdminTab] = useState<AdminTab>("team");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Team Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage team roles, view support logs, and message team members.
        </p>
      </div>
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-card p-1">
        {([
          { key: "team" as const, label: "Team Access", icon: <Users className="size-4" /> },
          { key: "support" as const, label: "Support Logs", icon: <ClipboardList className="size-4" /> },
          { key: "messages" as const, label: "Messages", icon: <MessageSquare className="size-4" /> },
        ]).map((t) => (
          <button key={t.key} type="button" onClick={() => setAdminTab(t.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${adminTab === t.key ? "bg-lime-400/10 text-lime-300" : "text-white/50 hover:bg-white/5 hover:text-white"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {adminTab === "team" && <TeamAccessPanel />}
      {adminTab === "support" && <SupportLogsPanel />}
      {adminTab === "messages" && <AdminMessagesPanel />}
    </div>
  );
}

// ===================== TEAM ACCESS PANEL =====================
function TeamAccessPanel() {
  // Requires a signed-in admin USER (getAuthUserId). Password-gated admins
  // have no user session — skip the query instead of crashing the panel.
  const { isAuthenticated } = useConvexAuth();
  const users = useQuery(api.teamAccess.adminListUsers, isAuthenticated ? {} : "skip");
  const setTeamRole = useMutation(api.teamAccess.setTeamRole);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  useEffect(() => { if (users !== undefined) setQueryError(null); }, [users]);

  // Early return AFTER all hooks so the hook order stays stable across renders.
  if (!isAuthenticated) {
    return (
      <p className="rounded-xl border border-amber-400/25 bg-amber-400/8 p-4 text-sm text-amber-300">
        Sign in with an administrator account to manage team roles.
      </p>
    );
  }

  const handleAssign = async (userId: string, role: string) => {
    if (!role) return;
    setSaving(true);
    try {
      await setTeamRole({ userId: userId as any, teamRole: role as any });
      toast.success("Team role assigned successfully");
      setEditingId(null);
    } catch (err: any) {
      toast.error(friendlyError(err, "Failed to assign role"));
    } finally { setSaving(false); }
  };

  const handleRemove = async (userId: string) => {
    setSaving(true);
    try {
      await setTeamRole({ userId: userId as any, teamRole: null });
      toast.success("Team role removed");
      setEditingId(null);
    } catch (err: any) {
      toast.error(friendlyError(err, "Failed to remove role"));
    } finally { setSaving(false); }
  };

  const safeUsers = Array.isArray(users) ? users : [];
  const filteredUsers = safeUsers.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u?.name ?? "").toLowerCase().includes(q) || (u?.email ?? "").toLowerCase().includes(q);
  });
  const roleCounts = TEAM_ROLES.map((r) => ({ ...r, count: safeUsers.filter((u) => u?.teamRole === r.value).length }));

  if (queryError) {
    return (
      <div className="space-y-6">
        <ErrorFallback error={queryError} onRetry={() => setQueryError(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-lime-400/20 bg-lime-400/5 p-4">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 size-5 text-lime-400" />
          <div>
            <p className="text-sm font-medium text-lime-300">How it works</p>
            <p className="mt-1 text-xs text-lime-300/60">
              Users sign up with email/password and verify via OTP. Once verified, assign them a team role here. They can then access their team dashboard at /team.
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {roleCounts.map((r) => (
          <div key={r.value} className="rounded-xl border border-white/10 bg-card p-4 text-center">
            <span className="text-2xl">{r.icon}</span>
            <p className="mt-2 text-sm font-medium text-white">{r.label}</p>
            <p className="mt-1 text-xs text-white/40">{r.count} assigned</p>
          </div>
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users by name or email..."
          className="h-11 w-full rounded-xl border border-white/10 bg-card pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" />
      </div>
      {users === undefined ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="size-6 animate-spin text-lime-400" /></div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-card p-12 text-center">
          <Users className="mx-auto size-10 text-white/20" />
          <p className="mt-3 text-sm text-white/40">{search ? "No users match your search." : "No users found."}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Email Verified</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/40">Current Role</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((u) => {
                  if (!u?._id) return null;
                  const isEditing = editingId === u._id;
                  const currentRole = TEAM_ROLES.find((r) => r.value === u.teamRole);
                  return (
                    <tr key={u._id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-white">{u.name ?? "Anonymous"}</p>
                          <p className="text-xs text-white/40">{u.email ?? ""}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {u.emailVerified ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-lime-400/10 px-2 py-0.5 text-xs font-medium text-lime-300">
                            <Check className="size-3" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs font-medium text-white/40">
                            <Clock className="size-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {currentRole ? (
                          <span className={`inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium ${currentRole.color}`}>
                            {currentRole.icon} {currentRole.label}
                          </span>
                        ) : <span className="text-xs text-white/30">No role</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            {saving ? <Loader2 className="size-4 animate-spin text-lime-400" /> : (
                              <>
                                <div className="relative">
                                  <select className="h-8 appearance-none rounded-lg border border-white/10 bg-black/30 pl-3 pr-8 text-xs text-white focus:border-lime-400/40 focus:outline-none"
                                    onChange={(e) => { const val = e.target.value; if (val) handleAssign(u._id, val); }} defaultValue="">
                                    <option value="" disabled>Select role...</option>
                                    {TEAM_ROLES.map((r) => <option key={r.value} value={r.value}>{r.icon} {r.label}</option>)}
                                  </select>
                                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-white/40" />
                                </div>
                                {u.teamRole && (
                                  <button type="button" onClick={() => handleRemove(u._id)}
                                    className="h-8 rounded-lg border border-rose-400/30 px-2 text-xs text-rose-300 transition-colors hover:bg-rose-400/10">Remove</button>
                                )}
                                <button type="button" onClick={() => setEditingId(null)}
                                  className="h-8 rounded-lg border border-white/10 px-2 text-xs text-white/40 transition-colors hover:bg-white/5 hover:text-white"><X className="size-3" /></button>
                              </>
                            )}
                          </div>
                        ) : (
                          <button type="button" onClick={() => setEditingId(u._id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:border-lime-400/30 hover:bg-lime-400/5 hover:text-lime-300">
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

// ===================== SUPPORT LOGS PANEL =====================
function SupportLogsPanel() {
  // adminAllSupportCases requires a signed-in user (requireAuth). The password-
  // gated admin dashboard has no user session — skip the query instead of
  // letting it throw mid-render and crash the page.
  const { isAuthenticated } = useConvexAuth();
  const cases = useQuery(api.teamWorkspace.adminAllSupportCases, isAuthenticated ? {} : "skip");
  const [filter, setFilter] = useState<"all" | "student" | "tutor">("all");
  const [statusFilter, setStatusFilter] = useState<string>("");

  if (!isAuthenticated) {
    return (
      <p className="rounded-xl border border-amber-400/25 bg-amber-400/8 p-4 text-sm text-amber-300">
        Sign in with an administrator account to view support logs.
      </p>
    );
  }

  const safeCases = Array.isArray(cases) ? cases : [];
  const filtered = safeCases.filter((c: any) => {
    if (filter !== "all" && c.type !== filter) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    return true;
  });

  const statusColor = (s: string) => {
    if (s === "open" || s === "new") return "bg-amber-400/10 text-amber-300";
    if (s === "in_progress" || s === "responded") return "bg-blue-400/10 text-blue-300";
    if (s === "resolved" || s === "closed") return "bg-lime-400/10 text-lime-300";
    if (s === "escalated") return "bg-rose-400/10 text-rose-300";
    return "bg-white/5 text-white/40";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-white/10 bg-card p-1">
          {(["all", "student", "tutor"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? "bg-lime-400/10 text-lime-300" : "text-white/50 hover:bg-white/5"}`}>
              {f === "all" ? "All Cases" : f === "student" ? "Student Support" : "Tutor Support"}
            </button>
          ))}
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded-lg border border-white/10 bg-card px-3 text-xs text-white focus:border-lime-400/40 focus:outline-none">
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <span className="ml-auto text-xs text-white/30">{filtered.length} cases</span>
      </div>
      {cases === undefined ? (
        <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-lime-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-card p-12 text-center">
          <ClipboardList className="mx-auto size-10 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No support cases found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c: any) => (
            <div key={c._id} className="rounded-xl border border-white/10 bg-card p-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.type === "student" ? "bg-lime-400/10 text-lime-300" : "bg-amber-400/10 text-amber-300"}`}>
                      {c.type === "student" ? "Student" : "Tutor"}
                    </span>
                    <p className="font-medium text-white truncate">{c.subject || c.title || "No subject"}</p>
                  </div>
                  <p className="mt-1 text-xs text-white/30">
                    {c.reporterName} ({c.reporterEmail}) • {c.category || "general"}
                    {c.caseNumber && <> • {c.caseNumber}</>}
                  </p>
                  {c.description && (
                    <p className="mt-1 text-xs text-white/40 line-clamp-2">{c.description}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusColor(c.status)}`}>
                  {c.status?.replace(/_/g, " ")?.toUpperCase()}
                </span>
              </div>
              <p className="mt-2 text-[10px] text-white/20">
                {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== MESSAGES PANEL =====================
function AdminMessagesPanel() {
  const { user } = useAuth();
  // All of these require a signed-in user — skip (never throw) without one.
  const { isAuthenticated } = useConvexAuth();
  const conversations = useQuery(api.teamWorkspace.myConversations, isAuthenticated ? {} : "skip");
  const directory = useQuery(api.teamWorkspace.listTeamDirectory, isAuthenticated ? {} : "skip");
  const sendMessage = useMutation(api.teamWorkspace.adminSendDirectMessage);
  const sendConvMsg = useMutation(api.teamWorkspace.sendConversationMessage);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newMsg, setNewMsg] = useState("");
  const [showNewConv, setShowNewConv] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [convSubject, setConvSubject] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useQuery(
    api.teamWorkspace.getConversationMessagesDetailed,
    isAuthenticated && selectedId ? { conversationId: selectedId as any } : "skip"
  );

  const safeDirectory = Array.isArray(directory) ? directory : [];
  const filteredDirectory = safeDirectory.filter((d: any) => {
    if (!searchUser) return true;
    const q = searchUser.toLowerCase();
    return (d.name ?? "").toLowerCase().includes(q) || (d.email ?? "").toLowerCase().includes(q);
  });

  const handleSendMessage = async () => {
    if (!selectedId || !newMsg.trim()) return;
    try {
      await sendConvMsg({ conversationId: selectedId as any, body: newMsg.trim() });
      setNewMsg("");
    } catch (err) { toast.error(friendlyError(err, "Something went wrong.")); }
  };

  const handleStartConversation = async () => {
    if (!recipientId || !newMsg.trim()) return;
    try {
      await sendMessage({
        recipientId: recipientId as any,
        body: newMsg.trim(),
        subject: convSubject || undefined,
      });
      toast.success("Message sent!");
      setShowNewConv(false);
      setNewMsg("");
      setRecipientId(null);
      setConvSubject("");
      setSearchUser("");
    } catch (err) { toast.error(friendlyError(err, "Something went wrong.")); }
  };

  if (!isAuthenticated) {
    return (
      <p className="rounded-xl border border-amber-400/25 bg-amber-400/8 p-4 text-sm text-amber-300">
        Sign in with an administrator account to use team messaging.
      </p>
    );
  }

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 280px)" }}>
      {/* Sidebar: conversations list */}
      <div className="w-80 shrink-0 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-card p-3">
        <div className="flex items-center justify-between px-2 pb-2">
          <h3 className="font-display text-sm font-bold text-white">Conversations</h3>
          <button type="button" onClick={() => { setShowNewConv(true); setSelectedId(null); }}
            className="rounded-lg bg-lime-400 px-2.5 py-1 text-[10px] font-semibold text-black hover:bg-lime-300">
            <Send className="mr-1 inline size-3" /> New
          </button>
        </div>
        {conversations === undefined ? (
          <Loader2 className="mx-auto size-4 animate-spin text-lime-400" />
        ) : (conversations as any[]).length === 0 ? (
          <p className="px-2 py-4 text-sm text-white/30">No conversations yet.</p>
        ) : (
          (conversations as any[]).map((c: any) => (
            <button key={c._id} type="button" onClick={() => { setSelectedId(c._id); setShowNewConv(false); }}
              className={`w-full rounded-xl p-3 text-left transition-colors ${selectedId === c._id ? "bg-lime-400/10 border border-lime-400/30" : "hover:bg-white/5 border border-transparent"}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white truncate">{c.subject || "Direct Message"}</p>
                <span className="text-[10px] text-white/20">{c.lastSenderName}</span>
              </div>
              <p className="mt-0.5 text-xs text-white/30 line-clamp-1">{c.lastMessageBody || "No messages"}</p>
              <p className="mt-0.5 text-[10px] text-white/20">{new Date(c.lastMessageAt).toLocaleDateString()}</p>
            </button>
          ))
        )}
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col rounded-2xl border border-white/10 bg-card">
        {showNewConv ? (
          /* New conversation form */
          <div className="flex flex-1 flex-col p-4">
            <h3 className="font-display text-sm font-bold text-white mb-3">Start a Conversation</h3>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
              <input type="text" value={searchUser} onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Search users to message..."
                className="h-10 w-full rounded-xl border border-white/10 bg-black/20 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 mb-3">
              {filteredDirectory.map((d: any) => (
                <button key={d._id} type="button" onClick={() => { setRecipientId(d._id); setSearchUser(d.name); }}
                  className={`w-full rounded-lg p-2.5 text-left transition-colors ${recipientId === d._id ? "bg-lime-400/10 border border-lime-400/30" : "hover:bg-white/5 border border-transparent"}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white">{d.name}</p>
                    <span className="text-[10px] text-white/30">{d.teamRole || d.role}</span>
                  </div>
                  <p className="text-xs text-white/30">{d.email}</p>
                </button>
              ))}
              {filteredDirectory.length === 0 && (
                <p className="py-3 text-sm text-white/30 text-center">No users found</p>
              )}
            </div>
            {recipientId && (
              <input value={convSubject} onChange={(e) => setConvSubject(e.target.value)}
                placeholder="Subject (optional)" className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none mb-3" />
            )}
            <div className="flex gap-2 mt-auto">
              <input value={newMsg} onChange={(e) => setNewMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStartConversation()}
                placeholder="Type your message..." disabled={!recipientId}
                className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none disabled:opacity-40" />
              <button type="button" onClick={handleStartConversation} disabled={!recipientId || !newMsg.trim()}
                className="rounded-xl bg-lime-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-40">
                <Send className="size-4" />
              </button>
            </div>
          </div>
        ) : selectedId ? (
          /* Conversation view */
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages === undefined ? (
                <Loader2 className="mx-auto size-4 animate-spin text-lime-400" />
              ) : (messages as any[]).length === 0 ? (
                <p className="text-center text-sm text-white/30 py-8">No messages yet.</p>
              ) : (
                (messages as any[]).map((m: any) => (
                  <div key={m._id} className={`rounded-xl p-3 ${m.isInternal ? "bg-amber-400/5 border border-amber-400/20" : "bg-white/5"}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">{m.senderName || m.senderRole}</span>
                      <span className="text-[10px] rounded-full bg-white/5 px-1.5 py-0.5 text-white/30">{m.senderRoleLabel}</span>
                      <span className="text-xs text-white/30">{new Date(m.createdAt).toLocaleString()}</span>
                      {m.isInternal && <span className="text-[10px] text-amber-300">INTERNAL</span>}
                    </div>
                    <p className="mt-1 text-sm text-white/70">{m.body}</p>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="border-t border-white/10 p-3">
              <div className="flex gap-2">
                <input value={newMsg} onChange={(e) => setNewMsg(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" />
                <button type="button" onClick={handleSendMessage} disabled={!newMsg.trim()}
                  className="rounded-xl bg-lime-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-40">
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <MessageSquare className="mx-auto size-10 text-white/20" />
              <p className="mt-3 text-sm text-white/30">Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

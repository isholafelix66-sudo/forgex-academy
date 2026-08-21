import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import {
  Loader2,
  LayoutDashboard,
  Settings,
  LogOut,
  Menu,
  X,
  BookOpen,
  MessageSquare,
  Bell,
  Activity,
  ClipboardList,
  Search,
  Bot,
  FileText,
  HelpCircle,
  Users,
  Send,
} from "lucide-react";
import { toast } from "sonner";

const VALID_ROLES = ["academic", "ai-support", "tutor-support", "student-support", "content"] as const;

const TEAM_INFO: Record<string, { name: string; icon: string; color: string }> = {
  academic: { name: "Academic Team", icon: "📚", color: "border-blue-400/20 bg-blue-400/5 text-blue-300" },
  "ai-support": { name: "AI Support", icon: "🤖", color: "border-purple-400/20 bg-purple-400/5 text-purple-300" },
  "tutor-support": { name: "Tutor Support", icon: "🎓", color: "border-amber-400/20 bg-amber-400/5 text-amber-300" },
  "student-support": { name: "Student Support", icon: "💚", color: "border-lime-400/20 bg-lime-400/5 text-lime-300" },
  content: { name: "Content Team", icon: "📝", color: "border-cyan-400/20 bg-cyan-400/5 text-cyan-300" },
};

type Tab = "overview" | "cases" | "courses" | "messages" | "notifications" | "activity" | "settings";

const TAB_CONFIG: Record<string, { label: string; icon: React.ReactNode; tabs: Tab[] }> = {
  academic: {
    label: "Academic",
    icon: <BookOpen className="size-4" />,
    tabs: ["overview", "courses", "messages", "notifications", "activity", "settings"],
  },
  "ai-support": {
    label: "AI Support",
    icon: <Bot className="size-4" />,
    tabs: ["overview", "cases", "messages", "notifications", "activity", "settings"],
  },
  "tutor-support": {
    label: "Tutor Support",
    icon: <HelpCircle className="size-4" />,
    tabs: ["overview", "cases", "messages", "notifications", "activity", "settings"],
  },
  "student-support": {
    label: "Student Support",
    icon: <Users className="size-4" />,
    tabs: ["overview", "cases", "messages", "notifications", "activity", "settings"],
  },
  content: {
    label: "Content",
    icon: <FileText className="size-4" />,
    tabs: ["overview", "cases", "messages", "notifications", "activity", "settings"],
  },
};

const TAB_LABELS: Record<Tab, { label: string; icon: React.ReactNode }> = {
  overview: { label: "Overview", icon: <LayoutDashboard className="size-4" /> },
  cases: { label: "Cases", icon: <ClipboardList className="size-4" /> },
  courses: { label: "Courses", icon: <BookOpen className="size-4" /> },
  messages: { label: "Messages", icon: <MessageSquare className="size-4" /> },
  notifications: { label: "Notifications", icon: <Bell className="size-4" /> },
  activity: { label: "Activity", icon: <Activity className="size-4" /> },
  settings: { label: "Settings", icon: <Settings className="size-4" /> },
};

export default function TeamDashboardShell({ children }: { children?: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const teamData = useQuery(api.teamAccess.getMyTeamRole);
  const notifications = useQuery(api.teamWorkspace.myNotifications, { unreadOnly: true });
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

  if (!user || teamData === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-lime-400" />
      </div>
    );
  }

  const teamRole = teamData?.teamRole;
  const isValidRole = teamRole && VALID_ROLES.includes(teamRole as typeof VALID_ROLES[number]);
  const info = isValidRole ? TEAM_INFO[teamRole!] : null;
  const config = isValidRole ? TAB_CONFIG[teamRole!] : null;

  if (!info || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">No team role assigned.</p>
      </div>
    );
  }

  const unreadCount = notifications?.length ?? 0;

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-white/10 bg-card transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-white/10 p-4">
            <span className={`flex size-10 items-center justify-center rounded-xl border text-lg ${info.color}`}>
              {info.icon}
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-sm font-bold text-white truncate">{info.name}</h2>
              <p className="text-[11px] text-white/30">Team Workspace</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/40 hover:text-white">
              <X className="size-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {config.tabs.map((t) => {
              const tl = TAB_LABELS[t];
              const isActive = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => { setTab(t); setSidebarOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? "bg-lime-400/10 text-lime-300" : "text-white/50 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {tl.icon}
                  {tl.label}
                  {t === "notifications" && unreadCount > 0 && (
                    <span className="ml-auto rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-3">
            <button
              onClick={async () => { await signOut(); navigate("/"); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/50 transition-colors hover:bg-red-400/10 hover:text-red-300"
            >
              <LogOut className="size-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center gap-4 border-b border-white/10 bg-card/50 px-4 py-3 backdrop-blur-sm">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-white/40 hover:text-white">
            <Menu className="size-5" />
          </button>
          <h1 className="font-display text-lg font-bold text-white">
            {TAB_LABELS[tab].label} — {info.name}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-white/30">{user.name || user.email || "Team Member"}</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {tab === "overview" && <TeamOverview teamRole={teamRole!} />}
          {tab === "cases" && <TeamCases teamRole={teamRole!} />}
          {tab === "courses" && <TeamCourses teamRole={teamRole!} />}
          {tab === "messages" && <TeamMessages />}
          {tab === "notifications" && <TeamNotifications />}
          {tab === "activity" && <TeamActivityFeed />}
          {tab === "settings" && <TeamSettingsPanel />}
          {children}
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview Panel
// ---------------------------------------------------------------------------
function TeamOverview({ teamRole }: { teamRole: string }) {
  const teamData = useQuery(api.teamAccess.getMyTeamRole);
  const activity = useQuery(api.teamWorkspace.getTeamActivityFeed, { limit: 10 });
  const notifications = useQuery(api.teamWorkspace.myNotifications, {});
  const info = TEAM_INFO[teamRole];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-card p-6">
        <h2 className="font-display text-xl font-bold text-white">Welcome to {info?.name}</h2>
        <p className="mt-2 text-sm text-white/40">
          {teamRole === "academic" && "Manage academic quality, review courses, and maintain curriculum standards."}
          {teamRole === "ai-support" && "Curate AI tools, manage the prompt library, and maintain AI resources."}
          {teamRole === "tutor-support" && "Support tutors with issues, onboarding, and platform guidance."}
          {teamRole === "student-support" && "Help students resolve issues and improve their learning experience."}
          {teamRole === "content" && "Manage platform content, resources, and editorial quality."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/30">Your Role</p>
          <p className="mt-2 font-display text-2xl font-bold text-white">{info?.name}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/30">Status</p>
          <p className="mt-2 font-display text-2xl font-bold text-lime-400">Active</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/30">Member Since</p>
          <p className="mt-2 font-display text-2xl font-bold text-white">
            {teamData?.teamRoleAssignedAt
              ? new Date(teamData.teamRoleAssignedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
              : "N/A"}
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-2xl border border-white/10 bg-card p-6">
        <h3 className="font-display text-sm font-bold text-white">Recent Activity</h3>
        <div className="mt-4 space-y-3">
          {activity === undefined ? (
            <Loader2 className="size-4 animate-spin text-lime-400" />
          ) : activity.length === 0 ? (
            <p className="text-sm text-white/30">No recent activity.</p>
          ) : (
            activity.slice(0, 5).map((a) => (
              <div key={a._id} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <Activity className="mt-0.5 size-4 shrink-0 text-lime-400/60" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/70">
                    <span className="font-medium text-white">{a.user?.name || "Someone"}</span>{" "}
                    {a.action.replace(/_/g, " ")}
                    {a.targetLabel && <span className="text-white/40"> — {a.targetLabel}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-white/30">{new Date(a.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cases Panel (Support Teams)
// ---------------------------------------------------------------------------
function TeamCases({ teamRole }: { teamRole: string }) {
  // AI Support doesn't use support cases — it manages AI Hub tools
  if (teamRole === "ai-support") return <AISupportTools />;
  if (teamRole === "content") return <ContentTeamPanel />;

  const cases = useQuery(
    api.teamWorkspace.listStudentSupportCases,
    teamRole === "student-support" ? {} : "skip"
  );

  const tutorCases = useQuery(
    api.tutorSupport.mySupportMessages,
    teamRole === "tutor-support" ? {} : "skip"
  );

  const displayCases = teamRole === "student-support" ? cases : tutorCases;

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-bold text-white">
        {teamRole === "student-support" ? "Student Support Cases" : "Tutor Support Cases"}
      </h2>
      {displayCases === undefined ? (
        <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-lime-400" /></div>
      ) : !displayCases || displayCases.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-card p-12 text-center">
          <ClipboardList className="mx-auto size-10 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No cases yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayCases.map((c: any) => (
            <div key={c._id} className="rounded-xl border border-white/10 bg-card p-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{c.subject || c.caseNumber}</p>
                  <p className="mt-1 text-sm text-white/40 line-clamp-2">{c.body || c.description}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      c.status === "open" ? "bg-amber-400/10 text-amber-300" :
                      c.status === "resolved" ? "bg-lime-400/10 text-lime-300" :
                      "bg-white/5 text-white/40"
                    }`}>
                      {c.status?.replace(/_/g, " ") || "open"}
                    </span>
                    <span className="text-xs text-white/30">{new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Courses Panel (Academic Team)
// ---------------------------------------------------------------------------
function TeamCourses({ teamRole }: { teamRole: string }) {
  if (teamRole !== "academic") {
    return <p className="text-sm text-white/40">Course review is managed by the Academic Team.</p>;
  }

  const courses = useQuery(api.teamWorkspace.listStudentSupportCases, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-white">Course Reviews</h2>
      </div>
      <div className="rounded-2xl border border-white/10 bg-card p-6">
        <p className="text-sm text-white/40">
          Course review connects to the existing Tutor Course system. Courses pending review will appear here.
          Use the Academic Team's course review workflow to review, provide feedback, request revisions, and approve courses.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-2xl font-bold text-blue-300">0</p>
            <p className="mt-1 text-xs text-white/40">Awaiting Review</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-2xl font-bold text-amber-300">0</p>
            <p className="mt-1 text-xs text-white/40">Under Review</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-2xl font-bold text-lime-300">0</p>
            <p className="mt-1 text-xs text-white/40">Approved</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Messages Panel
// ---------------------------------------------------------------------------
function TeamMessages() {
  const conversations = useQuery(api.teamWorkspace.listTeamConversations, {});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newMsg, setNewMsg] = useState("");
  const sendMessage = useMutation(api.teamWorkspace.sendConversationMessage);

  const messages = useQuery(
    api.teamWorkspace.getConversationMessages,
    selectedId ? { conversationId: selectedId as any } : "skip"
  );

  const handleSend = async () => {
    if (!selectedId || !newMsg.trim()) return;
    try {
      await sendMessage({ conversationId: selectedId as any, body: newMsg.trim() });
      setNewMsg("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    }
  };

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 200px)" }}>
      {/* Conversation list */}
      <div className="w-80 shrink-0 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-card p-3">
        <h3 className="px-2 pb-2 font-display text-sm font-bold text-white">Conversations</h3>
        {conversations === undefined ? (
          <Loader2 className="mx-auto size-4 animate-spin text-lime-400" />
        ) : conversations.length === 0 ? (
          <p className="px-2 py-4 text-sm text-white/30">No conversations yet.</p>
        ) : (
          conversations.map((c) => (
            <button
              key={c._id}
              onClick={() => setSelectedId(c._id)}
              className={`w-full rounded-xl p-3 text-left transition-colors ${
                selectedId === c._id ? "bg-lime-400/10 border border-lime-400/30" : "hover:bg-white/5 border border-transparent"
              }`}
            >
              <p className="text-sm font-medium text-white truncate">{c.subject}</p>
              <p className="mt-0.5 text-xs text-white/30">{c.entityType} • {new Date(c.lastMessageAt).toLocaleDateString()}</p>
            </button>
          ))
        )}
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col rounded-2xl border border-white/10 bg-card">
        {selectedId ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages === undefined ? (
                <Loader2 className="mx-auto size-4 animate-spin text-lime-400" />
              ) : (
                messages.map((m) => (
                  <div key={m._id} className={`rounded-xl p-3 ${m.isInternal ? "bg-amber-400/5 border border-amber-400/20" : "bg-white/5"}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">{m.senderRole}</span>
                      <span className="text-xs text-white/30">{new Date(m.createdAt).toLocaleString()}</span>
                      {m.isInternal && <span className="text-[10px] text-amber-300">INTERNAL</span>}
                    </div>
                    <p className="mt-1 text-sm text-white/70">{m.body}</p>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-white/10 p-3">
              <div className="flex gap-2">
                <input
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none"
                />
                <button
                  onClick={handleSend}
                  disabled={!newMsg.trim()}
                  className="rounded-xl bg-lime-400 px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-lime-300 disabled:opacity-40"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-white/30">Select a conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications Panel
// ---------------------------------------------------------------------------
function TeamNotifications() {
  const notifications = useQuery(api.teamWorkspace.myNotifications, {});
  const markRead = useMutation(api.teamWorkspace.markNotificationRead);
  const markAllRead = useMutation(api.teamWorkspace.markAllNotificationsRead);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-white">Notifications</h2>
        <button
          onClick={() => markAllRead()}
          className="text-xs text-lime-300 hover:text-lime-200"
        >
          Mark all read
        </button>
      </div>
      {notifications === undefined ? (
        <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-lime-400" /></div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-card p-12 text-center">
          <Bell className="mx-auto size-10 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No notifications.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n._id}
              className={`rounded-xl border p-4 transition-colors ${
                n.read ? "border-white/5 bg-white/[0.01]" : "border-lime-400/20 bg-lime-400/5"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{n.title}</p>
                  <p className="mt-1 text-sm text-white/40">{n.body}</p>
                  <p className="mt-1 text-xs text-white/20">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                {!n.read && (
                  <button
                    onClick={() => markRead({ notificationId: n._id })}
                    className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/40 hover:bg-white/5"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity Feed
// ---------------------------------------------------------------------------
function TeamActivityFeed() {
  const activity = useQuery(api.teamWorkspace.getTeamActivityFeed, { limit: 50 });

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-bold text-white">Activity Feed</h2>
      {activity === undefined ? (
        <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-lime-400" /></div>
      ) : activity.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-card p-12 text-center">
          <Activity className="mx-auto size-10 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No activity yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activity.map((a) => (
            <div key={a._id} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <Activity className="mt-0.5 size-4 shrink-0 text-lime-400/60" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/70">
                  <span className="font-medium text-white">{a.user?.name || "Someone"}</span>{" "}
                  {a.action.replace(/_/g, " ")}
                  {a.targetLabel && <span className="text-white/40"> — {a.targetLabel}</span>}
                </p>
                {a.details && <p className="mt-0.5 text-xs text-white/30">{a.details}</p>}
                <p className="mt-0.5 text-xs text-white/20">{new Date(a.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Support — Connected to existing AI Hub tables
// ---------------------------------------------------------------------------
function AISupportTools() {
  const aiResources = useQuery(api.aiResources.listPublished, {});
  const prompts = useQuery(api.prompts.listPublished, {});

  return (
    <div className="space-y-6">
      <h2 className="font-display text-lg font-bold text-white">AI Hub Management</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/30">AI Tools</p>
          <p className="mt-2 font-display text-3xl font-bold text-purple-300">{aiResources === undefined ? "—" : aiResources.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/30">Prompts</p>
          <p className="mt-2 font-display text-3xl font-bold text-blue-300">{prompts === undefined ? "—" : prompts.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/30">Status</p>
          <p className="mt-2 font-display text-3xl font-bold text-lime-400">Active</p>
        </div>
      </div>

      {/* AI Tools List */}
      <div className="rounded-2xl border border-white/10 bg-card p-6">
        <h3 className="font-display text-sm font-bold text-white">Published AI Tools</h3>
        <div className="mt-4 space-y-2">
          {aiResources === undefined ? (
            <Loader2 className="size-4 animate-spin text-lime-400" />
          ) : aiResources.length === 0 ? (
            <p className="text-sm text-white/30">No AI tools published yet.</p>
          ) : (
            aiResources.slice(0, 10).map((r) => (
              <div key={r._id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white truncate">{r.title}</p>
                  <p className="text-xs text-white/30">{r.category} • {r.pricingType}</p>
                </div>
                <a href={`/ai-hub/${r.slug}`} target="_blank" rel="noreferrer" className="text-xs text-lime-300 hover:text-lime-200">View →</a>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Prompts List */}
      <div className="rounded-2xl border border-white/10 bg-card p-6">
        <h3 className="font-display text-sm font-bold text-white">Published Prompts</h3>
        <div className="mt-4 space-y-2">
          {prompts === undefined ? (
            <Loader2 className="size-4 animate-spin text-lime-400" />
          ) : prompts.length === 0 ? (
            <p className="text-sm text-white/30">No prompts published yet.</p>
          ) : (
            prompts.slice(0, 10).map((p) => (
              <div key={p._id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white truncate">{p.title}</p>
                  <p className="text-xs text-white/30">{p.usefulFor}</p>
                </div>
                <a href={`/prompts/${p.slug}`} target="_blank" rel="noreferrer" className="text-xs text-lime-300 hover:text-lime-200">View →</a>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content Team Panel
// ---------------------------------------------------------------------------
function ContentTeamPanel() {
  return (
    <div className="space-y-6">
      <h2 className="font-display text-lg font-bold text-white">Content Management</h2>
      <div className="rounded-2xl border border-white/10 bg-card p-6">
        <p className="text-sm text-white/40">
          Content Team manages platform content, articles, resources, and announcements.
          Connect to existing siteContent and updates tables for live content management.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-2xl font-bold text-cyan-300">0</p>
            <p className="mt-1 text-xs text-white/40">Articles</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-2xl font-bold text-cyan-300">0</p>
            <p className="mt-1 text-xs text-white/40">Resources</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings Panel
// ---------------------------------------------------------------------------
function TeamSettingsPanel() {
  const { user } = useAuth();
  const teamData = useQuery(api.teamAccess.getMyTeamRole);
  const info = TEAM_INFO[teamData?.teamRole || ""];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-card p-6">
        <h3 className="font-display text-lg font-bold text-white">Account</h3>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-sm text-white/60">Email</p>
            <p className="text-sm font-medium text-white">{user?.email}</p>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-sm text-white/60">Team Role</p>
            <p className="text-sm font-medium text-lime-300">{info?.name || "Not assigned"}</p>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-sm text-white/60">Account Type</p>
            <p className="text-sm font-medium text-white capitalize">{user?.role || "Student"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

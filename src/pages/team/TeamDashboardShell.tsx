import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import {
  Loader2,
  LayoutDashboard,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { getTeamRole } from "@/components/RequireTeamAuth";

const TEAM_INFO: Record<
  string,
  { name: string; icon: string; color: string }
> = {
  academic: {
    name: "Academic Support",
    icon: "📚",
    color: "border-blue-400/20 bg-blue-400/5 text-blue-300",
  },
  "ai-support": {
    name: "AI Support",
    icon: "🤖",
    color: "border-purple-400/20 bg-purple-400/5 text-purple-300",
  },
  "tutor-support": {
    name: "Tutor Support",
    icon: "🎓",
    color: "border-amber-400/20 bg-amber-400/5 text-amber-300",
  },
  "student-support": {
    name: "Student Support",
    icon: "💚",
    color: "border-lime-400/20 bg-lime-400/5 text-lime-300",
  },
};

export default function TeamDashboardShell({
  children,
}: {
  children?: React.ReactNode;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tab, setTab] = useState<"dashboard" | "settings">("dashboard");

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-lime-400" />
      </div>
    );
  }

  const teamRole = getTeamRole(user as unknown as Record<string, unknown>);
  const info = teamRole ? TEAM_INFO[teamRole] : null;

  if (!info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">No team role assigned.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-white/10 bg-card transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-white/10 p-4">
            <span
              className={`flex size-10 items-center justify-center rounded-xl border text-lg ${info.color}`}
            >
              {info.icon}
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-sm font-bold text-white truncate">
                {info.name}
              </h2>
              <p className="text-[11px] text-white/30">Team Workspace</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-white/40 hover:text-white"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-1 p-3">
            <button
              onClick={() => {
                setTab("dashboard");
                setSidebarOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === "dashboard"
                  ? "bg-lime-400/10 text-lime-300"
                  : "text-white/50 hover:bg-white/5 hover:text-white"
              }`}
            >
              <LayoutDashboard className="size-4" />
              Dashboard
            </button>
            <button
              onClick={() => {
                setTab("settings");
                setSidebarOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === "settings"
                  ? "bg-lime-400/10 text-lime-300"
                  : "text-white/50 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Settings className="size-4" />
              Settings
            </button>
          </nav>

          {/* Logout */}
          <div className="border-t border-white/10 p-3">
            <button
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
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
        {/* Top bar */}
        <header className="flex items-center gap-4 border-b border-white/10 bg-card/50 px-4 py-3 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-white/40 hover:text-white"
          >
            <Menu className="size-5" />
          </button>
          <h1 className="font-display text-lg font-bold text-white">
            {tab === "dashboard" ? info.name : "Settings"}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-white/30">
              {(user as Record<string, unknown>)?.name as string || user.email || "Team Member"}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {tab === "dashboard" ? (
            <div className="space-y-6">
              {/* Welcome card */}
              <div className="rounded-2xl border border-white/10 bg-card p-6">
                <h2 className="font-display text-xl font-bold text-white">
                  Welcome to {info.name}
                </h2>
                <p className="mt-2 text-sm text-white/40">
                  {teamRole === "academic" &&
                    "Manage academic operations, course quality, and learning support."}
                  {teamRole === "ai-support" &&
                    "Manage AI Hub resources, prompt library, and AI tools."}
                  {teamRole === "tutor-support" &&
                    "Handle tutor onboarding, support tickets, and tutor management."}
                  {teamRole === "student-support" &&
                    "Support students, resolve issues, and improve student experience."}
                </p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-card p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-white/30">
                    Your Role
                  </p>
                  <p className="mt-2 font-display text-2xl font-bold text-white">
                    {info.name}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-card p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-white/30">
                    Status
                  </p>
                  <p className="mt-2 font-display text-2xl font-bold text-lime-400">
                    Active
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-card p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-white/30">
                    Member Since
                  </p>
                  <p className="mt-2 font-display text-2xl font-bold text-white">
                    {new Date(
                      (user as Record<string, unknown>)?.teamRoleAssignedAt as number || Date.now(),
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Quick actions */}
              <div className="rounded-2xl border border-white/10 bg-card p-6">
                <h3 className="font-display text-sm font-bold text-white">
                  Quick Actions
                </h3>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {teamRole === "academic" && (
                    <>
                      <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/70 transition-colors hover:border-blue-400/30 hover:bg-blue-400/5 hover:text-blue-300">
                        📋 Review Tutor Applications
                      </button>
                      <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/70 transition-colors hover:border-blue-400/30 hover:bg-blue-400/5 hover:text-blue-300">
                        📝 Course Quality Review
                      </button>
                    </>
                  )}
                  {teamRole === "ai-support" && (
                    <>
                      <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/70 transition-colors hover:border-purple-400/30 hover:bg-purple-400/5 hover:text-purple-300">
                        🤖 Manage AI Resources
                      </button>
                      <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/70 transition-colors hover:border-purple-400/30 hover:bg-purple-400/5 hover:text-purple-300">
                        💡 Prompt Library
                      </button>
                    </>
                  )}
                  {teamRole === "tutor-support" && (
                    <>
                      <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/70 transition-colors hover:border-amber-400/30 hover:bg-amber-400/5 hover:text-amber-300">
                        🎓 Tutor Onboarding
                      </button>
                      <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/70 transition-colors hover:border-amber-400/30 hover:bg-amber-400/5 hover:text-amber-300">
                        📩 Support Tickets
                      </button>
                    </>
                  )}
                  {teamRole === "student-support" && (
                    <>
                      <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/70 transition-colors hover:border-lime-400/30 hover:bg-lime-400/5 hover:text-lime-300">
                        💚 Student Issues
                      </button>
                      <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white/70 transition-colors hover:border-lime-400/30 hover:bg-lime-400/5 hover:text-lime-300">
                        📊 Student Feedback
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Settings tab */
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-card p-6">
                <h3 className="font-display text-lg font-bold text-white">
                  Account
                </h3>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">Email</p>
                      <p className="text-xs text-white/40">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        Team Role
                      </p>
                      <p className="text-xs text-white/40">{info.name}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

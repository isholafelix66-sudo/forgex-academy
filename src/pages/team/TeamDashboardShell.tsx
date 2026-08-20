import { useParams, Link } from "react-router";
import { useTeamWorkspace } from "@/hooks/use-team-workspace";
import { Navigate } from "react-router";
import { LayoutDashboard, Settings, LogOut, Menu, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect, lazy, Suspense } from "react";

const AcademicOverview = lazy(() => import("./AcademicOverview"));
const AISupportOverview = lazy(() => import("./AISupportOverview"));
const TutorSupportOverview = lazy(() => import("./TutorSupportOverview"));
const StudentSupportOverview = lazy(() => import("./StudentSupportOverview"));
const TeamSettings = lazy(() => import("./TeamSettings"));

function Overview({ slug }: { slug: string }) {
  switch (slug) {
    case "ai-support": return <AISupportOverview />;
    case "tutor-support": return <TutorSupportOverview />;
    case "student-support": return <StudentSupportOverview />;
    default: return <AcademicOverview />;
  }
}

export default function TeamDashboardShell() {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const { unlocked, loading, logout, workspaceName } = useTeamWorkspace(teamSlug || "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState<"overview" | "settings">("overview");

  useEffect(() => { setMenuOpen(false); }, [teamSlug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-lime-400" />
      </div>
    );
  }

  if (!unlocked) return <Navigate to={`/team/access/${teamSlug || ""}`} replace />;

  const handleLogout = () => { logout(); window.location.href = "/team/login"; };

  const navItems = [
    { k: "overview" as const, label: "Overview", icon: <LayoutDashboard className="size-4" /> },
    { k: "settings" as const, label: "Settings", icon: <Settings className="size-4" /> },
  ];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b border-white/8 px-4">
        <Link to="/team" className="font-display text-sm font-bold text-white">ForgeX<span className="text-lime-400"> Team</span></Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((n) => (
          <button key={n.k} onClick={() => setTab(n.k)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors", tab === n.k ? "bg-lime-400/12 text-lime-300" : "text-muted-foreground hover:bg-white/5 hover:text-foreground")}>
            <span className="shrink-0">{n.icon}</span><span>{n.label}</span>
          </button>
        ))}
      </nav>
      <div className="border-t border-white/8 p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{workspaceName}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Lock workspace" className="text-white/40 hover:text-red-400">
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 border-r border-white/8 bg-sidebar lg:block">{sidebar}</aside>
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-sidebar shadow-2xl">
            <button onClick={() => setMenuOpen(false)} className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-white/10"><X className="size-5" /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-56">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/8 bg-background/85 px-4 backdrop-blur-xl lg:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)}><Menu className="size-5" /></Button>
            <h1 className="font-display text-base font-bold text-white">{workspaceName}</h1>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-lime-400" /></div>}>
              {tab === "overview" ? <Overview slug={teamSlug || ""} /> : <TeamSettings />}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

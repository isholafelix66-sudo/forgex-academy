import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  ArrowLeft,
  LayoutDashboard,
  ClipboardList,
  BookOpen,
  Star,
  FileText,
  MessageSquare,
  LogOut,
  Loader2,
} from "lucide-react";

const NAV_ITEMS = [
  { slug: "", label: "Overview", icon: LayoutDashboard },
  { slug: "work", label: "Work", icon: ClipboardList },
  { slug: "courses", label: "Courses", icon: BookOpen },
  { slug: "reviews", label: "Reviews", icon: Star },
  { slug: "resources", label: "Resources", icon: FileText },
  { slug: "activity", label: "Activity", icon: MessageSquare },
];

export default function TeamWorkspace() {
  const { user } = useAuth();
  const { signOut } = useAuthActions();
  const myTeam = useQuery(api.team.getMyTeam);
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const teamSlug = location.pathname.split("/")[2] || "";
  const team = myTeam?.team as any;
  const membership = myTeam?.membership as any;

  if (!team) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-lime-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between border-b border-white/5 bg-card/90 px-4 py-3 backdrop-blur-lg md:hidden">
        <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-lg p-1.5 text-white/60 hover:bg-white/5">
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
        <span className="text-sm font-semibold text-white">{team.name}</span>
        <div className="size-8" />
      </div>

      {/* Sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-white/5 bg-card transition-transform md:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-lime-400 to-emerald-500 text-xs font-bold text-black">F</div>
          <div>
            <p className="text-sm font-semibold text-white">{team.name}</p>
            <p className="text-xs text-white/40">ForgeX Team Workspace</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const href = `/team/${teamSlug}${item.slug ? `/${item.slug}` : ""}`;
            const active = location.pathname === href;
            return (
              <Link key={item.slug} to={href} onClick={() => setMobileOpen(false)} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors", active ? "bg-lime-500/10 text-lime-400" : "text-white/60 hover:bg-white/5 hover:text-white")}>
                <item.icon className="size-4" /> {item.label}
              </Link>
            );
          })}
          {(user as any)?.role === "admin" && (
            <Link to="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white">
              <ArrowLeft className="size-4" /> Admin Dashboard
            </Link>
          )}
        </nav>

        <div className="border-t border-white/5 px-3 py-3">
          <div className="mb-2 px-3">
            <p className="text-xs font-medium text-white/80">{(user as any)?.name || "Team Member"}</p>
            <p className="text-xs text-white/40">{membership?.role === "teamLead" ? "Team Lead" : "Team Member"}</p>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-white/60 hover:text-white" onClick={() => signOut()}>
            <LogOut className="size-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />}

      <main className="flex-1 pt-14 md:pt-0 md:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

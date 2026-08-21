import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import {
  Loader2, LayoutDashboard, Settings, LogOut, Menu, X, BookOpen,
  MessageSquare, Bell, Activity, ClipboardList, Search, Bot, FileText,
  HelpCircle, Users, Send, Plus, Pencil, Trash2, CheckCircle2,
  ArrowUpCircle,  Eye, Star, Globe, ExternalLink, ChevronDown, Play,
} from "lucide-react";
import { toast } from "sonner";
import CoursePreviewModal from "@/components/team/CoursePreviewModal";

const VALID_ROLES = ["academic", "ai-support", "tutor-support", "student-support", "content"] as const;
const TEAM_INFO: Record<string, { name: string; icon: string; color: string }> = {
  academic: { name: "Academic Team", icon: "📚", color: "border-blue-400/20 bg-blue-400/5 text-blue-300" },
  "ai-support": { name: "AI Support", icon: "🤖", color: "border-purple-400/20 bg-purple-400/5 text-purple-300" },
  "tutor-support": { name: "Tutor Support", icon: "🎓", color: "border-amber-400/20 bg-amber-400/5 text-amber-300" },
  "student-support": { name: "Student Support", icon: "💚", color: "border-lime-400/20 bg-lime-400/5 text-lime-300" },
  content: { name: "Content Team", icon: "📝", color: "border-cyan-400/20 bg-cyan-400/5 text-cyan-300" },
};

type Tab = "overview" | "tools" | "prompts" | "courses" | "cases" | "messages" | "notifications" | "activity" | "settings";

const TAB_CONFIG: Record<string, { tabs: Tab[] }> = {
  academic: { tabs: ["overview", "courses", "messages", "notifications", "activity", "settings"] },
  "ai-support": { tabs: ["overview", "tools", "prompts", "messages", "notifications", "activity", "settings"] },
  "tutor-support": { tabs: ["overview", "cases", "messages", "notifications", "activity", "settings"] },
  "student-support": { tabs: ["overview", "cases", "messages", "notifications", "activity", "settings"] },
  content: { tabs: ["overview", "cases", "messages", "notifications", "activity", "settings"] },
};

const TAB_LABELS: Record<Tab, { label: string; icon: React.ReactNode }> = {
  overview: { label: "Overview", icon: <LayoutDashboard className="size-4" /> },
  tools: { label: "AI Tools", icon: <Bot className="size-4" /> },
  prompts: { label: "Prompts", icon: <FileText className="size-4" /> },
  courses: { label: "Courses", icon: <BookOpen className="size-4" /> },
  cases: { label: "Cases", icon: <ClipboardList className="size-4" /> },
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
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-lime-400" /></div>;
  }

  const teamRole = teamData?.teamRole;
  const isValidRole = teamRole && VALID_ROLES.includes(teamRole as typeof VALID_ROLES[number]);
  const info = isValidRole ? TEAM_INFO[teamRole!] : null;
  const config = isValidRole ? TAB_CONFIG[teamRole!] : null;
  if (!info || !config) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><p className="text-muted-foreground">No team role assigned.</p></div>;
  }

  return (
    <div className="flex min-h-screen max-w-full overflow-x-hidden bg-background">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 border-r border-white/10 bg-card transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-white/10 p-4">
            <span className={`flex size-10 items-center justify-center rounded-xl border text-lg ${info.color}`}>{info.icon}</span>
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-sm font-bold text-white truncate">{info.name}</h2>
              <p className="text-[11px] text-white/30">Team Workspace</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/40 hover:text-white"><X className="size-5" /></button>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {config.tabs.map((t) => {
              const tl = TAB_LABELS[t];
              const isActive = tab === t;
              const unread = t === "notifications" ? (notifications?.length ?? 0) : 0;
              return (
                <button key={t} onClick={() => { setTab(t); setSidebarOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-lime-400/10 text-lime-300" : "text-white/50 hover:bg-white/5 hover:text-white"}`}>
                  {tl.icon}{tl.label}
                  {unread > 0 && <span className="ml-auto rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-bold text-black">{unread > 99 ? "99+" : unread}</span>}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-white/10 p-3">
            <button onClick={async () => { await signOut(); navigate("/"); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/50 transition-colors hover:bg-red-400/10 hover:text-red-300">
              <LogOut className="size-4" />Sign Out
            </button>
          </div>
        </div>
      </aside>
      <div className="flex flex-1 flex-col min-w-0 max-w-full overflow-x-hidden">
        <header className="flex items-center gap-4 border-b border-white/10 bg-card/50 px-4 py-3 backdrop-blur-sm">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-white/40 hover:text-white"><Menu className="size-5" /></button>
          <h1 className="font-display text-base sm:text-lg font-bold text-white truncate">{TAB_LABELS[tab].label} — {info.name}</h1>
          <div className="ml-auto text-xs text-white/30">{user.name || user.email}</div>
        </header>
        <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6 min-w-0 max-w-full">
          {tab === "overview" && <TeamOverview teamRole={teamRole!} />}
          {tab === "tools" && <AIToolsPanel />}
          {tab === "prompts" && <AIPromptsPanel />}
          {tab === "courses" && <AcademicCoursesPanel />}
          {tab === "cases" && <SupportCasesPanel teamRole={teamRole!} />}
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

// ====================== OVERVIEW ======================
function TeamOverview({ teamRole }: { teamRole: string }) {
  const teamData = useQuery(api.teamAccess.getMyTeamRole);
  const activity = useQuery(api.teamWorkspace.getTeamActivityFeed, { limit: 10 });
  const stats = useQuery(api.teamWorkspace.getTeamScopedStats);
  const info = TEAM_INFO[teamRole];
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-card p-6">
        <h2 className="font-display text-xl font-bold text-white">Welcome to {info?.name}</h2>
        <p className="mt-2 text-sm text-white/40">
          {teamRole === "academic" && "Review courses, request revisions, approve content, and maintain academic quality."}
          {teamRole === "ai-support" && "Manage AI tools, curate prompts, publish resources to the live AI Hub."}
          {teamRole === "tutor-support" && "Support tutors with issues, reply to tickets, and escalate problems."}
          {teamRole === "student-support" && "Help students resolve issues and improve their learning experience."}
          {teamRole === "content" && "Manage platform content, articles, and resources."}
        </p>
      </div>
      {stats && stats.type !== "default" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.type === "academic" && (<><div className="rounded-xl border border-white/10 bg-card p-4 text-center"><p className="font-display text-2xl font-bold text-white">{(stats as any).totalCourses ?? 0}</p><p className="mt-1 text-xs text-white/40">Total Courses</p></div><div className="rounded-xl border border-white/10 bg-card p-4 text-center"><p className="font-display text-2xl font-bold text-blue-300">{(stats as any).awaitingReview ?? 0}</p><p className="mt-1 text-xs text-white/40">Awaiting Review</p></div><div className="rounded-xl border border-white/10 bg-card p-4 text-center"><p className="font-display text-2xl font-bold text-lime-300">{(stats as any).approved ?? 0}</p><p className="mt-1 text-xs text-white/40">Approved</p></div><div className="rounded-xl border border-white/10 bg-card p-4 text-center"><p className="font-display text-2xl font-bold text-amber-300">{(stats as any).rejected ?? 0}</p><p className="mt-1 text-xs text-white/40">Rejected</p></div></>)}
          {stats.type === "tutor-support" && (<><div className="rounded-xl border border-white/10 bg-card p-4 text-center"><p className="font-display text-2xl font-bold text-white">{(stats as any).totalCases ?? 0}</p><p className="mt-1 text-xs text-white/40">Total Cases</p></div><div className="rounded-xl border border-white/10 bg-card p-4 text-center"><p className="font-display text-2xl font-bold text-amber-300">{(stats as any).open ?? 0}</p><p className="mt-1 text-xs text-white/40">Open</p></div><div className="rounded-xl border border-white/10 bg-card p-4 text-center"><p className="font-display text-2xl font-bold text-blue-300">{(stats as any).responded ?? 0}</p><p className="mt-1 text-xs text-white/40">Responded</p></div><div className="rounded-xl border border-white/10 bg-card p-4 text-center"><p className="font-display text-2xl font-bold text-lime-300">{(stats as any).resolved ?? 0}</p><p className="mt-1 text-xs text-white/40">Resolved</p></div></>)}
          {stats.type === "student-support" && (<><div className="rounded-xl border border-white/10 bg-card p-4 text-center"><p className="font-display text-2xl font-bold text-white">{(stats as any).totalCases ?? 0}</p><p className="mt-1 text-xs text-white/40">Total Cases</p></div><div className="rounded-xl border border-white/10 bg-card p-4 text-center"><p className="font-display text-2xl font-bold text-amber-300">{(stats as any).open ?? 0}</p><p className="mt-1 text-xs text-white/40">Open</p></div><div className="rounded-xl border border-white/10 bg-card p-4 text-center"><p className="font-display text-2xl font-bold text-blue-300">{(stats as any).inProgress ?? 0}</p><p className="mt-1 text-xs text-white/40">In Progress</p></div><div className="rounded-xl border border-white/10 bg-card p-4 text-center"><p className="font-display text-2xl font-bold text-lime-300">{(stats as any).resolved ?? 0}</p><p className="mt-1 text-xs text-white/40">Resolved</p></div></>)}
          {stats.type === "ai-support" && (<><div className="rounded-xl border border-white/10 bg-card p-4 text-center"><p className="font-display text-2xl font-bold text-white">{(stats as any).totalTools ?? 0}</p><p className="mt-1 text-xs text-white/40">AI Tools</p></div><div className="rounded-xl border border-white/10 bg-card p-4 text-center"><p className="font-display text-2xl font-bold text-lime-300">{(stats as any).publishedTools ?? 0}</p><p className="mt-1 text-xs text-white/40">Published</p></div><div className="rounded-xl border border-white/10 bg-card p-4 text-center"><p className="font-display text-2xl font-bold text-purple-300">{(stats as any).totalPrompts ?? 0}</p><p className="mt-1 text-xs text-white/40">Prompts</p></div><div className="rounded-xl border border-white/10 bg-card p-4 text-center"><p className="font-display text-2xl font-bold text-lime-300">{(stats as any).publishedPrompts ?? 0}</p><p className="mt-1 text-xs text-white/40">Published</p></div></>)}
          {stats.type === "content" && (<><div className="rounded-xl border border-white/10 bg-card p-4 text-center"><p className="font-display text-2xl font-bold text-white">{(stats as any).totalContent ?? 0}</p><p className="mt-1 text-xs text-white/40">Total Content</p></div><div className="rounded-xl border border-white/10 bg-card p-4 text-center"><p className="font-display text-2xl font-bold text-lime-300">{(stats as any).published ?? 0}</p><p className="mt-1 text-xs text-white/40">Published</p></div></>)}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            {teamData?.teamRoleAssignedAt ? new Date(teamData.teamRoleAssignedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "N/A"}
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-card p-6">
        <h3 className="font-display text-sm font-bold text-white">Recent Activity</h3>
        <div className="mt-4 space-y-3">
          {activity === undefined ? <Loader2 className="size-4 animate-spin text-lime-400" /> :
           activity.length === 0 ? <p className="text-sm text-white/30">No recent activity.</p> :
           activity.slice(0, 5).map((a) => (
            <div key={a._id} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
              <Activity className="mt-0.5 size-4 shrink-0 text-lime-400/60" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/70"><span className="font-medium text-white">{a.user?.name || "Someone"}</span> {a.action.replace(/_/g, " ")}{a.targetLabel && <span className="text-white/40"> — {a.targetLabel}</span>}</p>
                <p className="mt-0.5 text-xs text-white/30">{new Date(a.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ====================== AI TOOLS PANEL ======================
function AIToolsPanel() {
  const tools = useQuery(api.teamWorkspace.listAllAiTools, {});
  const createTool = useMutation(api.teamWorkspace.createAiTool);
  const updateTool = useMutation(api.teamWorkspace.updateAiTool);
  const togglePublish = useMutation(api.teamWorkspace.toggleAiToolPublish);
  const deleteTool = useMutation(api.teamWorkspace.deleteAiTool);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: "", slug: "", description: "", category: "Productivity", url: "", pricingType: "free" as const, body: "", published: false });

  const resetForm = () => { setForm({ title: "", slug: "", description: "", category: "Productivity", url: "", pricingType: "free", body: "", published: false }); setEditing(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (editing) {
        await updateTool({ toolId: editing._id, ...form });
        toast.success("Tool updated");
      } else {
        await createTool({ ...form, slug: form.slug || form.title.toLowerCase().replace(/\s+/g, "-") });
        toast.success("Tool created");
      }
      setShowModal(false);
      resetForm();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleTogglePublish = async (tool: any) => {
    try { const result = await togglePublish({ toolId: tool._id }); toast.success(result ? "Published" : "Unpublished"); } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (tool: any) => {
    if (!confirm(`Delete "${tool.title}"?`)) return;
    try { await deleteTool({ toolId: tool._id }); toast.success("Deleted"); } catch (err: any) { toast.error(err.message); }
  };

  const openEdit = (tool: any) => { setEditing(tool); setForm({ title: tool.title, slug: tool.slug, description: tool.description, category: tool.category, url: tool.url, pricingType: tool.pricingType, body: tool.body || "", published: tool.published }); setShowModal(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-white">AI Tools Directory</h2>
        <button type="button" onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 rounded-xl bg-lime-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-lime-300">
          <Plus className="size-4" />Add AI Tool
        </button>
      </div>
      {tools === undefined ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-lime-400" /></div> :
       tools.length === 0 ? <div className="rounded-2xl border border-white/10 bg-card p-12 text-center"><Bot className="mx-auto size-10 text-white/20" /><p className="mt-3 text-sm text-white/40">No AI tools yet. Add one to get started.</p></div> :
       <div className="space-y-2">{tools.map((t) => (
        <div key={t._id} className="flex items-center gap-4 rounded-xl border border-white/10 bg-card p-4 hover:bg-white/[0.02] transition-colors">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-white truncate">{t.title}</p>
              {t.published ? <span className="rounded-full bg-lime-400/10 px-2 py-0.5 text-[10px] font-semibold text-lime-300">LIVE</span> : <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/30">DRAFT</span>}
              {t.featured && <Star className="size-3 text-amber-400" />}
            </div>
            <p className="mt-0.5 text-xs text-white/30">{t.category} • {t.pricingType}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={t.url} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 p-1.5 text-white/40 hover:bg-white/5"><ExternalLink className="size-3.5" /></a>
            <button type="button" onClick={() => handleTogglePublish(t)} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${t.published ? "border-amber-400/30 text-amber-300 hover:bg-amber-400/10" : "border-lime-400/30 text-lime-300 hover:bg-lime-400/10"}`}>
              {t.published ? "Unpublish" : "Publish"}
            </button>
            <button type="button" onClick={() => openEdit(t)} className="rounded-lg border border-white/10 p-1.5 text-white/40 hover:bg-white/5"><Pencil className="size-3.5" /></button>
            <button type="button" onClick={() => handleDelete(t)} className="rounded-lg border border-rose-400/20 p-1.5 text-rose-400/60 hover:bg-rose-400/10"><Trash2 className="size-3.5" /></button>
          </div>
        </div>
       ))}</div>}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-card p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-white">{editing ? "Edit AI Tool" : "Add New AI Tool"}</h3>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Tool Name" className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" required />
              <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="Website URL" className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" required />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white focus:border-lime-400/40 focus:outline-none">
                  {["Design", "Coding", "Content", "Marketing", "Video", "Productivity", "Audio", "Other"].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={form.pricingType} onChange={(e) => setForm({ ...form, pricingType: e.target.value as any })} className="h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white focus:border-lime-400/40 focus:outline-none">
                  <option value="free">Free</option><option value="freemium">Freemium</option><option value="paid">Paid</option>
                </select>
              </div>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={3} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none resize-none" required />
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Detailed use cases & features (optional)" rows={3} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none resize-none" />
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} className="size-4 rounded border-white/20" />
                <span className="text-sm text-white/60">Publish immediately</span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/50 hover:bg-white/5">Cancel</button>
                <button type="submit" className="rounded-xl bg-lime-400 px-5 py-2 text-sm font-semibold text-black hover:bg-lime-300">{editing ? "Save Changes" : "Create Tool"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ====================== AI PROMPTS PANEL ======================
function AIPromptsPanel() {
  const prompts = useQuery(api.teamWorkspace.listAllPrompts, {});
  const categories = useQuery(api.teamWorkspace.listPromptCategories, {});
  const createPrompt = useMutation(api.teamWorkspace.createPrompt);
  const updatePrompt = useMutation(api.teamWorkspace.updatePrompt);
  const togglePublish = useMutation(api.teamWorkspace.togglePromptPublish);
  const toggleFeatured = useMutation(api.teamWorkspace.togglePromptFeatured);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: "", slug: "", description: "", categoryId: "" as any, template: "", usefulFor: "", tags: "", published: false, featured: false });

  const resetForm = () => { setForm({ title: "", slug: "", description: "", categoryId: "", template: "", usefulFor: "", tags: "", published: false, featured: false }); setEditing(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (editing) {
        await updatePrompt({ promptId: editing._id, title: form.title, description: form.description, template: form.template, tags, usefulFor: form.usefulFor });
        toast.success("Prompt updated");
      } else {
        if (!form.categoryId) { toast.error("Select a category"); return; }
        await createPrompt({ ...form, tags, slug: form.slug || form.title.toLowerCase().replace(/\s+/g, "-") });
        toast.success("Prompt created");
      }
      setShowModal(false); resetForm();
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-white">Prompt Library</h2>
        <button type="button" onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 rounded-xl bg-lime-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-lime-300">
          <Plus className="size-4" />Create Prompt
        </button>
      </div>
      {prompts === undefined ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-lime-400" /></div> :
       prompts.length === 0 ? <div className="rounded-2xl border border-white/10 bg-card p-12 text-center"><FileText className="mx-auto size-10 text-white/20" /><p className="mt-3 text-sm text-white/40">No prompts yet.</p></div> :
       <div className="space-y-2">{prompts.map((p) => (
        <div key={p._id} className="flex items-center gap-4 rounded-xl border border-white/10 bg-card p-4 hover:bg-white/[0.02] transition-colors">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-white truncate">{p.title}</p>
              {p.published ? <span className="rounded-full bg-lime-400/10 px-2 py-0.5 text-[10px] font-semibold text-lime-300">LIVE</span> : <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/30">DRAFT</span>}
              {p.featured && <Star className="size-3 text-amber-400" />}
            </div>
            <p className="mt-0.5 text-xs text-white/30">{p.usefulFor}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={async () => { await togglePublish({ promptId: p._id }); toast.success("Toggled"); }}
              className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${p.published ? "border-amber-400/30 text-amber-300" : "border-lime-400/30 text-lime-300"}`}>
              {p.published ? "Unpublish" : "Publish"}
            </button>
            <button type="button" onClick={async () => { await toggleFeatured({ promptId: p._id }); toast.success("Toggled"); }}
              className={`rounded-lg border p-1.5 ${p.featured ? "border-amber-400/30 text-amber-400" : "border-white/10 text-white/40"}`}>
              <Star className="size-3.5" />
            </button>
            <button type="button" onClick={() => { setEditing(p); setForm({ title: p.title, slug: p.slug, description: p.description, categoryId: p.categoryId, template: p.template, usefulFor: p.usefulFor, tags: p.tags.join(", "), published: p.published, featured: p.featured }); setShowModal(true); }}
              className="rounded-lg border border-white/10 p-1.5 text-white/40 hover:bg-white/5"><Pencil className="size-3.5" /></button>
          </div>
        </div>
       ))}</div>}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-card p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-white">{editing ? "Edit Prompt" : "Create New Prompt"}</h3>
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Prompt Title" className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" required />
              {!editing && <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white focus:border-lime-400/40 focus:outline-none">
                <option value="">Select category...</option>
                {(categories ?? []).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>}
              <textarea value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })} placeholder="Prompt template / instructions" rows={4} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none resize-none font-mono" required />
              <input value={form.usefulFor} onChange={(e) => setForm({ ...form, usefulFor: e.target.value })} placeholder="Useful for (e.g. 'Writing blog posts')" className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" />
              <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Tags (comma separated)" className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/50 hover:bg-white/5">Cancel</button>
                <button type="submit" className="rounded-xl bg-lime-400 px-5 py-2 text-sm font-semibold text-black hover:bg-lime-300">{editing ? "Save" : "Create"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ====================== ACADEMIC COURSES PANEL ======================
function AcademicCoursesPanel() {
  const courses = useQuery(api.teamWorkspace.listCoursesForReview, {});
  const requestRevision = useMutation(api.teamWorkspace.requestCourseRevision);
  const approveCourse = useMutation(api.teamWorkspace.approveCourse);
  const escalate = useMutation(api.teamWorkspace.escalateToAdmin);
  const [showRevisionModal, setShowRevisionModal] = useState<string | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [previewCourseId, setPreviewCourseId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const safeCourses = Array.isArray(courses) ? courses : [];
  const filtered = filterStatus ? safeCourses.filter((c: any) => c.status === filterStatus) : safeCourses;
  const awaitingCount = safeCourses.filter((c: any) => !c.status || c.status === "pending" || c.status === "draft").length;
  const approvedCount = safeCourses.filter((c: any) => c.status === "approved").length;
  const rejectedCount = safeCourses.filter((c: any) => c.status === "rejected").length;

  const handleRequestRevision = async (courseId: string) => {
    if (!revisionFeedback.trim()) { toast.error("Please provide feedback"); return; }
    try {
      await requestRevision({ courseId: courseId as any, feedback: revisionFeedback.trim() });
      toast.success("Revision requested");
      setShowRevisionModal(null); setRevisionFeedback("");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleApprove = async (courseId: string) => {
    try { await approveCourse({ courseId: courseId as any }); toast.success("Course approved"); } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-bold text-white">Course Review Queue</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <button type="button" onClick={() => setFilterStatus("")} className={`rounded-xl border p-4 text-center transition-colors ${!filterStatus ? "border-lime-400/30 bg-lime-400/5" : "border-white/10 bg-card hover:bg-white/5"}`}>
          <p className="text-2xl font-bold text-white">{safeCourses.length}</p>
          <p className="mt-1 text-xs text-white/40">All Courses</p>
        </button>
        <button type="button" onClick={() => setFilterStatus("pending")} className={`rounded-xl border p-4 text-center transition-colors ${filterStatus === "pending" ? "border-blue-400/30 bg-blue-400/5" : "border-white/10 bg-card hover:bg-white/5"}`}>
          <p className="text-2xl font-bold text-blue-300">{awaitingCount}</p>
          <p className="mt-1 text-xs text-white/40">Awaiting Review</p>
        </button>
        <button type="button" onClick={() => setFilterStatus("rejected")} className={`rounded-xl border p-4 text-center transition-colors ${filterStatus === "rejected" ? "border-amber-400/30 bg-amber-400/5" : "border-white/10 bg-card hover:bg-white/5"}`}>
          <p className="text-2xl font-bold text-amber-300">{rejectedCount}</p>
          <p className="mt-1 text-xs text-white/40">Revision Needed</p>
        </button>
        <button type="button" onClick={() => setFilterStatus("approved")} className={`rounded-xl border p-4 text-center transition-colors ${filterStatus === "approved" ? "border-lime-400/30 bg-lime-400/5" : "border-white/10 bg-card hover:bg-white/5"}`}>
          <p className="text-2xl font-bold text-lime-300">{approvedCount}</p>
          <p className="mt-1 text-xs text-white/40">Approved</p>
        </button>
      </div>
      {courses === undefined ? (
        <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-lime-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-card p-12 text-center">
          <BookOpen className="mx-auto size-10 text-white/20" /><p className="mt-3 text-sm text-white/40">No courses{filterStatus ? " matching this filter" : " yet"}.</p>
        </div>
      ) : (
        <div className="space-y-2">{filtered.map((c: any) => (
          <div key={c._id} className="rounded-xl border border-white/10 bg-card p-4 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-white truncate">{c.title}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.status === "approved" ? "bg-lime-400/10 text-lime-300" : c.status === "rejected" ? "bg-amber-400/10 text-amber-300" : "bg-blue-400/10 text-blue-300"}`}>
                    {c.status?.toUpperCase() || "DRAFT"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-white/30">{c.difficulty ?? ""} {c.category ? `• ${c.category}` : ""}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" onClick={() => setPreviewCourseId(c._id)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/60 hover:bg-white/5"><Eye className="mr-1 inline size-3" />Preview</button>
                {c.status !== "approved" && (
                  <button type="button" onClick={() => handleApprove(c._id)} disabled={saving} className="rounded-lg border border-lime-400/30 px-2.5 py-1.5 text-[10px] font-semibold text-lime-300 hover:bg-lime-400/10 disabled:opacity-40">
                    <CheckCircle2 className="mr-1 inline size-3" />Approve
                  </button>
                )}
                {c.status !== "rejected" && (
                  <button type="button" onClick={() => { setShowRevisionModal(c._id); setRevisionFeedback(c.reviewNote || ""); }} className="rounded-lg border border-amber-400/30 px-3 py-1.5 text-[10px] font-semibold text-amber-300 hover:bg-amber-400/10">
                    <ArrowUpCircle className="mr-1 inline size-3" />Request Revision
                  </button>
                )}
                <button type="button" onClick={async () => { const reason = prompt("Escalation reason:"); if (reason) { try { await escalate({ targetType: "course", targetId: c._id, targetLabel: c.title, reason }); toast.success("Escalated to admin"); } catch (err: any) { toast.error(err.message); } } }} className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/40 hover:bg-white/5">
                  Escalate
                </button>
              </div>
            </div>
            {c.reviewNote && <p className="mt-2 rounded-lg bg-amber-400/5 border border-amber-400/10 px-3 py-2 text-xs text-amber-300/70">Review note: {c.reviewNote}</p>}
          </div>
        ))}</div>
      )}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowRevisionModal(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-white">Request Revision</h3>
            <textarea value={revisionFeedback} onChange={(e) => setRevisionFeedback(e.target.value)}
              placeholder="Describe what needs to be changed..." rows={4}
              className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none resize-none" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setShowRevisionModal(null); setRevisionFeedback(""); }} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/50 hover:bg-white/5">Cancel</button>
              <button type="button" onClick={() => handleRequestRevision(showRevisionModal)} disabled={saving} className="rounded-xl bg-amber-400 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-40">{saving ? <Loader2 className="mr-1 inline size-3 animate-spin" /> : null}Send Revision Request</button>
            </div>
          </div>
        </div>
      )}
      {previewCourseId && <CoursePreviewModal courseId={previewCourseId} onClose={() => setPreviewCourseId(null)} />}
    </div>
  );
}

// ====================== SUPPORT CASES PANEL ======================
function SupportCasesPanel({ teamRole }: { teamRole: string }) {
  const isTutorSupport = teamRole === "tutor-support";
  const isStudentSupport = teamRole === "student-support";

  // Student support cases
  const studentCases = useQuery(api.teamWorkspace.listStudentSupportCases, isStudentSupport ? {} : "skip");
  const claimStudentCase = useMutation(api.teamWorkspace.claimSupportCase);
  const replyToStudentCase = useMutation(api.teamWorkspace.replyToStudentCase);
  const escalateStudentCase = useMutation(api.teamWorkspace.escalateStudentCase);

  // Tutor support cases
  const tutorCases = useQuery(api.teamWorkspace.listTutorSupportCases, isTutorSupport ? {} : "skip");
  const replyToTutorCase = useMutation(api.teamWorkspace.replyToTutorSupportCase);

  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const cases = isTutorSupport ? tutorCases : studentCases;
  const isTutorCase = isTutorSupport && selectedCase && selectedCase.tutorId;

  const handleReply = async () => {
    if (!selectedCase || !replyText.trim()) return;
    try {
      if (isTutorCase) {
        await replyToTutorCase({ caseId: selectedCase._id, body: replyText.trim(), isInternal });
      } else {
        await replyToStudentCase({ caseId: selectedCase._id, body: replyText.trim(), isInternal });
      }
      setReplyText(""); setIsInternal(false);
      toast.success(isInternal ? "Internal note added" : "Reply sent");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleClaim = async (caseId: string) => {
    try {
      if (isTutorCase) {
        await replyToTutorCase({ caseId: caseId as any, body: "Claiming this case.", status: "responded" });
      } else {
        await claimStudentCase({ caseId: caseId as any });
      }
      toast.success("Case claimed");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleEscalate = async (caseId: string, to: "admin" | "academic") => {
    const note = prompt("Escalation reason:");
    if (!note) return;
    try {
      await escalateStudentCase({ caseId: caseId as any, escalateTo: to, note });
      toast.success("Escalated");
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 200px)" }}>
      <div className="w-80 shrink-0 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-card p-3">
        <h3 className="px-2 pb-2 font-display text-sm font-bold text-white">
          {isTutorSupport ? "Tutor Support Cases" : "Student Support Cases"}
        </h3>
        {cases === undefined ? <Loader2 className="mx-auto size-4 animate-spin text-lime-400" /> :
         cases.length === 0 ? <p className="px-2 py-4 text-sm text-white/30">No cases yet.</p> :
         (cases as any[]).map((c: any) => (
          <button key={c._id} onClick={() => setSelectedCase(c)}
            className={`w-full rounded-xl p-3 text-left transition-colors ${selectedCase?._id === c._id ? "bg-lime-400/10 border border-lime-400/30" : "hover:bg-white/5 border border-transparent"}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white truncate">{c.subject}</p>
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${c.status === "open" ? "bg-amber-400/10 text-amber-300" : c.status === "resolved" ? "bg-lime-400/10 text-lime-300" : "bg-white/5 text-white/30"}`}>
                {c.status?.replace(/_/g, " ")}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-white/30">{isTutorSupport ? (c.tutor?.name ?? "Unknown tutor") : c.caseNumber}</p>
          </button>
         ))}
      </div>
      <div className="flex flex-1 flex-col rounded-2xl border border-white/10 bg-card">
        {selectedCase ? (
          <>
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-white">{selectedCase.subject}</h3>
                  <p className="text-xs text-white/30">
                    {isTutorCase ? `From: ${selectedCase.tutor?.name ?? "Unknown"} • ${selectedCase.category}` : `${selectedCase.caseNumber} • ${selectedCase.category}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!selectedCase.assignedTo && !isTutorCase && (
                    <button type="button" onClick={() => handleClaim(selectedCase._id)} className="rounded-lg border border-lime-400/30 px-3 py-1.5 text-xs font-medium text-lime-300 hover:bg-lime-400/10">Claim</button>
                  )}
                  {!selectedCase.assignedTo && isTutorCase && (
                    <button type="button" onClick={() => handleClaim(selectedCase._id)} className="rounded-lg border border-lime-400/30 px-3 py-1.5 text-xs font-medium text-lime-300 hover:bg-lime-400/10">Claim</button>
                  )}
                  {isStudentSupport && (
                    <>
                      <button type="button" onClick={() => handleEscalate(selectedCase._id, "academic")} className="rounded-lg border border-blue-400/30 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-400/10">Escalate → Academic</button>
                      <button type="button" onClick={() => handleEscalate(selectedCase._id, "admin")} className="rounded-lg border border-amber-400/30 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-400/10">Escalate → Admin</button>
                    </>
                  )}
                </div>
              </div>
              <p className="mt-2 text-sm text-white/50">{selectedCase.description || selectedCase.body}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                {/* Original message */}
                <div className="rounded-xl bg-white/5 border border-white/5 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">{isTutorCase ? (selectedCase.tutor?.name ?? "Tutor") : "Student"}</span>
                    <span className="text-xs text-white/20">{new Date(selectedCase.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-sm text-white/60">{selectedCase.body}</p>
                </div>
                {/* Admin response if exists */}
                {selectedCase.adminNote && (
                  <div className="rounded-xl bg-lime-400/5 border border-lime-400/10 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-lime-300">Team Response</span>
                      <span className="text-xs text-white/20">{selectedCase.adminNoteAt ? new Date(selectedCase.adminNoteAt).toLocaleString() : ""}</span>
                    </div>
                    <p className="mt-1 text-sm text-white/60">{selectedCase.adminNote}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t border-white/10 p-3">
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="size-3.5 rounded border-white/20" />
                <span className="text-xs text-amber-300">Internal note (staff only)</span>
              </label>
              <div className="flex gap-2">
                <input value={replyText} onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleReply()}
                  placeholder={isInternal ? "Internal note..." : isTutorCase ? "Reply to tutor..." : "Reply to student..."}
                  className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" />
                <button type="button" onClick={handleReply} disabled={!replyText.trim()}
                  className="rounded-xl bg-lime-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-40">
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center"><p className="text-sm text-white/30">Select a case</p></div>
        )}
      </div>
    </div>
  );
}

// ====================== MESSAGES ======================
function TeamMessages() {
  const { user } = useAuth();
  const conversations = useQuery(api.teamWorkspace.myConversations);
  const sendMessage = useMutation(api.teamWorkspace.sendConversationMessage);
  const adminSendMsg = useMutation(api.teamWorkspace.adminSendDirectMessage);
  const directory = useQuery(api.teamWorkspace.listTeamDirectory);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newMsg, setNewMsg] = useState("");
  const [showNewConv, setShowNewConv] = useState(false);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [searchUser, setSearchUser] = useState("");

  const messages = useQuery(
    api.teamWorkspace.getConversationMessagesDetailed,
    selectedId ? { conversationId: selectedId as any } : "skip"
  );

  const safeDirectory = Array.isArray(directory) ? directory : [];
  // Sort directory: admins first, then team roles, then others
  const sortedDirectory = [...safeDirectory].sort((a: any, b: any) => {
    if (a.role === "admin" && b.role !== "admin") return -1;
    if (a.role !== "admin" && b.role === "admin") return 1;
    if (a.teamRole && !b.teamRole) return -1;
    if (!a.teamRole && b.teamRole) return 1;
    return 0;
  });
  const filteredDirectory = sortedDirectory.filter((d: any) => {
    if (!searchUser) return true;
    const q = searchUser.toLowerCase();
    return (d.name ?? "").toLowerCase().includes(q) || (d.email ?? "").toLowerCase().includes(q) || (d.role ?? "").toLowerCase().includes(q);
  });
  // Separate admins from the rest for quick access
  const adminUsers = filteredDirectory.filter((d: any) => d.role === "admin");
  const otherUsers = filteredDirectory.filter((d: any) => d.role !== "admin");

  const handleSend = async () => {
    if (!selectedId || !newMsg.trim()) return;
    try { await sendMessage({ conversationId: selectedId as any, body: newMsg.trim() }); setNewMsg(""); } catch (err: any) { toast.error(err.message); }
  };

  const handleStartConversation = async () => {
    if (!recipientId || !newMsg.trim()) return;
    try {
      await adminSendMsg({ recipientId: recipientId as any, body: newMsg.trim() });
      toast.success("Message sent!");
      setShowNewConv(false); setNewMsg(""); setRecipientId(null); setSearchUser("");
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 200px)" }}>
      <div className="w-80 shrink-0 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-card p-3">
        <div className="flex items-center justify-between px-2 pb-2">
          <h3 className="font-display text-sm font-bold text-white">Conversations</h3>
          <button type="button" onClick={() => { setShowNewConv(true); setSelectedId(null); }}
            className="rounded-lg bg-lime-400 px-2.5 py-1 text-[10px] font-semibold text-black hover:bg-lime-300">
            <Plus className="mr-1 inline size-3" />New
          </button>
        </div>
        {conversations === undefined ? <Loader2 className="mx-auto size-4 animate-spin text-lime-400" /> :
         (conversations as any[]).length === 0 ? <p className="px-2 py-4 text-sm text-white/30">No conversations yet.</p> :
         (conversations as any[]).map((c: any) => (
          <button key={c._id} type="button" onClick={() => { setSelectedId(c._id); setShowNewConv(false); }}
            className={`w-full rounded-xl p-3 text-left transition-colors ${selectedId === c._id ? "bg-lime-400/10 border border-lime-400/30" : "hover:bg-white/5 border border-transparent"}`}>
            <p className="text-sm font-medium text-white truncate">
              {(c.otherParticipantNames && c.otherParticipantNames.length > 0) ? c.otherParticipantNames.join(", ") : c.subject || "Direct Message"}
            </p>
            <p className="mt-0.5 text-xs text-white/40 line-clamp-1">{c.lastSenderName ? `${c.lastSenderName}: ` : ""}{c.lastMessageBody || "No messages"}</p>
            <p className="mt-0.5 text-[10px] text-white/20">{new Date(c.lastMessageAt).toLocaleDateString()}</p>
          </button>
         ))}
      </div>
      <div className="flex flex-1 flex-col rounded-2xl border border-white/10 bg-card">
        {showNewConv ? (
          <div className="flex flex-1 flex-col p-4">
            <h3 className="font-display text-sm font-bold text-white mb-3">Start Conversation</h3>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
              <input type="text" value={searchUser} onChange={(e) => setSearchUser(e.target.value)}
                placeholder="Search users..."
                className="h-10 w-full rounded-xl border border-white/10 bg-black/20 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" />
            </div>
            <div className="max-h-[60vh] overflow-y-auto space-y-2">
              {/* Quick Message Admin buttons */}
              {adminUsers.length > 0 && !searchUser && (
                <div className="mb-2">
                  <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300/60">Message Admin</p>
                  {adminUsers.map((d: any) => (
                    <button key={d._id} type="button"
                      onClick={() => { setRecipientId(d._id); setSearchUser(d.name); }}
                      className={`w-full rounded-lg p-2.5 text-left transition-colors mb-1 ${recipientId === d._id ? "bg-amber-400/10 border border-amber-400/30" : "bg-amber-400/5 border border-amber-400/10 hover:bg-amber-400/10"}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-amber-300">{d.name}</p>
                        <span className="rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">Admin</span>
                      </div>
                      <p className="text-xs text-white/30">{d.email}</p>
                    </button>
                  ))}
                </div>
              )}
              {/* All other users */}
              {adminUsers.length > 0 && !searchUser && <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">All Users</p>}
              {(searchUser ? filteredDirectory : otherUsers).map((d: any) => (
                <button key={d._id} type="button"
                  onClick={() => { setRecipientId(d._id); setSearchUser(d.name); }}
                  className={`w-full rounded-lg p-2.5 text-left transition-colors ${recipientId === d._id ? "bg-lime-400/10 border border-lime-400/30" : "hover:bg-white/5 border border-transparent"}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white">{d.name}</p>
                    <div className="flex items-center gap-1.5">
                      {d.teamRole && <span className="rounded-full bg-lime-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-lime-300">{d.teamRole}</span>}
                      <span className="text-[10px] text-white/30">{d.role}</span>
                    </div>
                  </div>
                  <p className="text-xs text-white/30">{d.email}</p>
                </button>
              ))}
              {filteredDirectory.length === 0 && <p className="py-3 text-sm text-white/30 text-center">No users found</p>}
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
              <input value={newMsg} onChange={(e) => setNewMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStartConversation()}
                placeholder={recipientId ? "Type your message..." : "Select a recipient first..."} disabled={!recipientId}
                className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none disabled:opacity-40" />
              <button type="button" onClick={handleStartConversation} disabled={!recipientId || !newMsg.trim()}
                className="rounded-xl bg-lime-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-40"><Send className="size-4" /></button>
            </div>
          </div>
        ) : selectedId ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages === undefined ? <Loader2 className="mx-auto size-4 animate-spin text-lime-400" /> :
               (messages as any[]).length === 0 ? <p className="text-center text-sm text-white/30 py-8">No messages yet.</p> :
               (messages as any[]).map((m: any) => (
                <div key={m._id} className={`rounded-xl p-3 ${m.isInternal ? "bg-amber-400/5 border border-amber-400/20" : m.senderRoleLabel === "Admin" ? "bg-amber-400/5 border border-amber-400/10" : "bg-white/5"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${m.senderRoleLabel === "Admin" ? "text-amber-300" : "text-white"}`}>{m.senderName || m.senderRole}</span>
                    {m.senderRoleLabel && <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${m.senderRoleLabel === "Admin" ? "bg-amber-400/10 text-amber-300" : "bg-white/5 text-white/30"}`}>{m.senderRoleLabel}</span>}
                    <span className="text-xs text-white/30">{new Date(m.createdAt).toLocaleString()}</span>
                    {m.isInternal && <span className="text-[10px] text-amber-300">INTERNAL</span>}
                  </div>
                  <p className="mt-1 text-sm text-white/70">{m.body}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 p-3">
              <div className="flex gap-2">
                <input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Type a message..." className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" />
                <button type="button" onClick={handleSend} disabled={!newMsg.trim()} className="rounded-xl bg-lime-400 px-4 py-2.5 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-40"><Send className="size-4" /></button>
              </div>
            </div>
          </>
        ) : <div className="flex flex-1 items-center justify-center"><p className="text-sm text-white/30">Select a conversation or start a new one</p></div>}
      </div>
    </div>
  );
}

// ====================== NOTIFICATIONS ======================
function TeamNotifications() {
  const notifications = useQuery(api.teamWorkspace.myNotifications, {});
  const markRead = useMutation(api.teamWorkspace.markNotificationRead);
  const markAllRead = useMutation(api.teamWorkspace.markAllNotificationsRead);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-white">Notifications</h2>
        <button type="button" onClick={() => markAllRead()} className="text-xs text-lime-300 hover:text-lime-200">Mark all read</button>
      </div>
      {notifications === undefined ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-lime-400" /></div> :
       notifications.length === 0 ? <div className="rounded-2xl border border-white/10 bg-card p-12 text-center"><Bell className="mx-auto size-10 text-white/20" /><p className="mt-3 text-sm text-white/40">No notifications.</p></div> :
       <div className="space-y-2">{notifications.map((n) => (
        <div key={n._id} className={`rounded-xl border p-4 transition-colors ${n.read ? "border-white/5 bg-white/[0.01]" : "border-lime-400/20 bg-lime-400/5"}`}>
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white">{n.title}</p>
              <p className="mt-1 text-sm text-white/40">{n.body}</p>
              <p className="mt-1 text-xs text-white/20">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
            {!n.read && <button type="button" onClick={() => markRead({ notificationId: n._id })} className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/40 hover:bg-white/5">Mark read</button>}
          </div>
        </div>
       ))}</div>
      }
    </div>
  );
}

// ====================== ACTIVITY FEED ======================
function TeamActivityFeed() {
  const activity = useQuery(api.teamWorkspace.getTeamActivityFeed, { limit: 50 });
  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-bold text-white">Activity Feed</h2>
      {activity === undefined ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-lime-400" /></div> :
       activity.length === 0 ? <div className="rounded-2xl border border-white/10 bg-card p-12 text-center"><Activity className="mx-auto size-10 text-white/20" /><p className="mt-3 text-sm text-white/40">No activity yet.</p></div> :
       <div className="space-y-2">{activity.map((a) => (
        <div key={a._id} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <Activity className="mt-0.5 size-4 shrink-0 text-lime-400/60" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white/70"><span className="font-medium text-white">{a.user?.name || "Someone"}</span> {a.action.replace(/_/g, " ")}{a.targetLabel && <span className="text-white/40"> — {a.targetLabel}</span>}</p>
            {a.details && <p className="mt-0.5 text-xs text-white/30">{a.details}</p>}
            <p className="mt-0.5 text-xs text-white/20">{new Date(a.createdAt).toLocaleString()}</p>
          </div>
        </div>
       ))}</div>
      }
    </div>
  );
}

// ====================== SETTINGS ======================
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
            <p className="text-sm text-white/60">Email</p><p className="text-sm font-medium text-white">{user?.email}</p>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-sm text-white/60">Team Role</p><p className="text-sm font-medium text-lime-300">{info?.name || "Not assigned"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

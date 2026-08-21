import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import {
  Loader2, LayoutDashboard, Settings, LogOut, Menu, X, BookOpen,
  MessageSquare, Bell, Activity, ClipboardList, Search, Bot, FileText,
  HelpCircle, Users, Send, Plus, Pencil, Trash2, CheckCircle2,
  ArrowUpCircle, Eye, Star, Globe, ExternalLink, ChevronDown,
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
    <div className="flex min-h-screen bg-background">
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
      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center gap-4 border-b border-white/10 bg-card/50 px-4 py-3 backdrop-blur-sm">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-white/40 hover:text-white"><Menu className="size-5" /></button>
          <h1 className="font-display text-lg font-bold text-white">{TAB_LABELS[tab].label} — {info.name}</h1>
          <div className="ml-auto text-xs text-white/30">{user.name || user.email}</div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
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
  const courses = useQuery(api.teamWorkspace.listAllAiTools, {}); // placeholder — would query courses
  const requestRevision = useMutation(api.teamWorkspace.requestCourseRevision);
  const approveCourse = useMutation(api.teamWorkspace.approveCourse);
  const escalate = useMutation(api.teamWorkspace.escalateToAdmin);
  const [showRevisionModal, setShowRevisionModal] = useState<string | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState("");

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-bold text-white">Course Review Queue</h2>
      <div className="rounded-2xl border border-white/10 bg-card p-6">
        <p className="text-sm text-white/40">Connect to the existing courses table to show pending review courses. Use "Request Revision" and "Approve" buttons to manage the review workflow.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-2xl font-bold text-blue-300">—</p>
            <p className="mt-1 text-xs text-white/40">Awaiting Review</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-2xl font-bold text-amber-300">—</p>
            <p className="mt-1 text-xs text-white/40">Under Review</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-2xl font-bold text-lime-300">—</p>
            <p className="mt-1 text-xs text-white/40">Approved</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-white/20">Courses submitted by tutors will appear here for academic review.</p>
      </div>
    </div>
  );
}

// ====================== SUPPORT CASES PANEL ======================
function SupportCasesPanel({ teamRole }: { teamRole: string }) {
  const cases = useQuery(api.teamWorkspace.listStudentSupportCases, teamRole === "student-support" ? {} : "skip");
  const claimCase = useMutation(api.teamWorkspace.claimSupportCase);
  const replyToCase = useMutation(api.teamWorkspace.replyToStudentCase);
  const escalateCase = useMutation(api.teamWorkspace.escalateStudentCase);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const handleReply = async () => {
    if (!selectedCase || !replyText.trim()) return;
    try {
      await replyToCase({ caseId: selectedCase._id, body: replyText.trim(), isInternal });
      setReplyText(""); setIsInternal(false);
      toast.success(isInternal ? "Internal note added" : "Reply sent");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleClaim = async (caseId: string) => {
    try { await claimCase({ caseId: caseId as any }); toast.success("Case claimed"); } catch (err: any) { toast.error(err.message); }
  };

  const handleEscalate = async (caseId: string, to: "admin" | "academic") => {
    const note = prompt("Escalation reason:");
    if (!note) return;
    try { await escalateCase({ caseId: caseId as any, escalateTo: to, note }); toast.success("Escalated"); } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 200px)" }}>
      <div className="w-80 shrink-0 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-card p-3">
        <h3 className="px-2 pb-2 font-display text-sm font-bold text-white">Support Cases</h3>
        {cases === undefined ? <Loader2 className="mx-auto size-4 animate-spin text-lime-400" /> :
         cases.length === 0 ? <p className="px-2 py-4 text-sm text-white/30">No cases yet.</p> :
         cases.map((c: any) => (
          <button key={c._id} onClick={() => setSelectedCase(c)}
            className={`w-full rounded-xl p-3 text-left transition-colors ${selectedCase?._id === c._id ? "bg-lime-400/10 border border-lime-400/30" : "hover:bg-white/5 border border-transparent"}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white truncate">{c.subject}</p>
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${c.status === "open" ? "bg-amber-400/10 text-amber-300" : c.status === "resolved" ? "bg-lime-400/10 text-lime-300" : "bg-white/5 text-white/30"}`}>
                {c.status?.replace(/_/g, " ")}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-white/30">{c.caseNumber}</p>
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
                  <p className="text-xs text-white/30">{selectedCase.caseNumber} • {selectedCase.category}</p>
                </div>
                <div className="flex gap-2">
                  {!selectedCase.assignedTo && <button type="button" onClick={() => handleClaim(selectedCase._id)} className="rounded-lg border border-lime-400/30 px-3 py-1.5 text-xs font-medium text-lime-300 hover:bg-lime-400/10">Claim</button>}
                  <button type="button" onClick={() => handleEscalate(selectedCase._id, "academic")} className="rounded-lg border border-blue-400/30 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-400/10">Escalate → Academic</button>
                  <button type="button" onClick={() => handleEscalate(selectedCase._id, "admin")} className="rounded-lg border border-amber-400/30 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-400/10">Escalate → Admin</button>
                </div>
              </div>
              <p className="mt-2 text-sm text-white/50">{selectedCase.description}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-xs text-white/20">Messages appear here from the conversation thread.</p>
            </div>
            <div className="border-t border-white/10 p-3">
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="size-3.5 rounded border-white/20" />
                <span className="text-xs text-amber-300">Internal note (staff only)</span>
              </label>
              <div className="flex gap-2">
                <input value={replyText} onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleReply()}
                  placeholder={isInternal ? "Internal note..." : "Reply to student..."}
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
  const conversations = useQuery(api.teamWorkspace.listTeamConversations, {});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newMsg, setNewMsg] = useState("");
  const sendMessage = useMutation(api.teamWorkspace.sendConversationMessage);
  const messages = useQuery(api.teamWorkspace.getConversationMessages, selectedId ? { conversationId: selectedId as any } : "skip");

  const handleSend = async () => {
    if (!selectedId || !newMsg.trim()) return;
    try { await sendMessage({ conversationId: selectedId as any, body: newMsg.trim() }); setNewMsg(""); } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 200px)" }}>
      <div className="w-80 shrink-0 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-card p-3">
        <h3 className="px-2 pb-2 font-display text-sm font-bold text-white">Conversations</h3>
        {conversations === undefined ? <Loader2 className="mx-auto size-4 animate-spin text-lime-400" /> :
         conversations.length === 0 ? <p className="px-2 py-4 text-sm text-white/30">No conversations yet.</p> :
         conversations.map((c: any) => (
          <button key={c._id} onClick={() => setSelectedId(c._id)}
            className={`w-full rounded-xl p-3 text-left transition-colors ${selectedId === c._id ? "bg-lime-400/10 border border-lime-400/30" : "hover:bg-white/5 border border-transparent"}`}>
            <p className="text-sm font-medium text-white truncate">{c.subject}</p>
            <p className="mt-0.5 text-xs text-white/30">{c.entityType} • {new Date(c.lastMessageAt).toLocaleDateString()}</p>
          </button>
         ))}
      </div>
      <div className="flex flex-1 flex-col rounded-2xl border border-white/10 bg-card">
        {selectedId ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages === undefined ? <Loader2 className="mx-auto size-4 animate-spin text-lime-400" /> :
               messages.map((m: any) => (
                <div key={m._id} className={`rounded-xl p-3 ${m.isInternal ? "bg-amber-400/5 border border-amber-400/20" : "bg-white/5"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-white">{m.senderRole}</span>
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
        ) : <div className="flex flex-1 items-center justify-center"><p className="text-sm text-white/30">Select a conversation</p></div>}
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

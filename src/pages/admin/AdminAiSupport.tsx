import { useState } from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Loader2,
  Bot,
  Plus,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  ClipboardList,
  BarChart3,
  Sparkles,
  BookOpen,
  X,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import AiEscalatedTickets from "@/components/team/AiEscalatedTickets";

const KB_CATEGORIES = [
  { value: "student-support", label: "Student Support" },
  { value: "tutor-support", label: "Tutor Support" },
  { value: "course-management", label: "Course Management" },
  { value: "platform-features", label: "Platform Features" },
  { value: "technical", label: "Technical Problems" },
  { value: "account", label: "Account Issues" },
  { value: "community", label: "Community" },
  { value: "ai-hub", label: "AI Hub" },
  { value: "general", label: "General FAQs" },
] as const;

type AdminTab = "kb" | "analytics";

export default function AdminAiSupport() {
  const [tab, setTab] = useState<AdminTab>("kb");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">AI Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the AI assistant's knowledge base and review support analytics.
        </p>
      </div>
      <div className="flex gap-1 rounded-xl border border-white/10 bg-card p-1">
        {([
          { key: "kb" as const, label: "Knowledge Base", icon: <BookOpen className="size-4" /> },
          { key: "analytics" as const, label: "Analytics", icon: <BarChart3 className="size-4" /> },
        ]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-lime-400/10 text-lime-300" : "text-white/50 hover:bg-white/5 hover:text-white"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === "kb" ? <KnowledgePanel /> : <AnalyticsPanel />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Knowledge base panel
// ---------------------------------------------------------------------------

function KnowledgePanel() {
  // These functions require a signed-in user (requireKbEditor). The admin
  // dashboard itself is password-gated with no user account — skip instead of
  // throwing mid-render (which crashes the whole page).
  const { isAuthenticated } = useConvexAuth();
  const entries = useQuery(api.aiSupportData.listKnowledgeAdmin, isAuthenticated ? {} : "skip");
  const save = useMutation(api.aiSupportData.saveKnowledgeEntry);
  const remove = useMutation(api.aiSupportData.deleteKnowledgeEntry);
  const seed = useMutation(api.aiSupportData.seedDefaultKnowledge);

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any>(null); // entry being edited
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [keywords, setKeywords] = useState("");
  const [content, setContent] = useState("");
  const [enabled, setEnabled] = useState(true);

  const openEditor = (entry?: any) => {
    if (entry) {
      setEditing(entry);
      setTitle(entry.title ?? "");
      setCategory(entry.category ?? "general");
      setKeywords((entry.keywords ?? []).join(", "));
      setContent(entry.content ?? "");
      setEnabled(entry.enabled ?? true);
      setCreating(false);
    } else {
      setEditing(null);
      setTitle("");
      setCategory("general");
      setKeywords("");
      setContent("");
      setEnabled(true);
      setCreating(true);
    }
  };

  const closeEditor = () => {
    setEditing(null);
    setCreating(false);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required.");
      return;
    }
    setSaving(true);
    try {
      await save({
        id: editing?._id as any,
        title: title.trim(),
        category,
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        content: content.trim(),
        enabled,
      });
      toast.success(editing ? "Knowledge entry updated." : "Knowledge entry added.");
      closeEditor();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save the entry.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this knowledge entry permanently?")) return;
    setDeletingId(id);
    try {
      await remove({ id: id as any });
      toast.success("Entry deleted.");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not delete.");
    } finally {
      setDeletingId(null);
    }
  };

  const safeEntries = Array.isArray(entries) ? entries : [];
  const filtered = safeEntries.filter((e: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (e?.title ?? "").toLowerCase().includes(q) ||
      (e?.category ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search knowledge base…"
            className="h-10 w-full rounded-xl border border-white/10 bg-card pl-10 pr-4 text-sm placeholder:text-white/25 focus:border-lime-400/40 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => openEditor()}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 text-sm font-bold text-black hover:bg-lime-300"
        >
          <Plus className="size-4" /> Add Knowledge
        </button>
      </div>

      {/* Editor modal */}
      {(creating || editing) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-2 backdrop-blur-sm sm:p-6">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <h3 className="font-display text-base font-bold">
                {editing ? "Edit Knowledge Entry" : "Add Knowledge Entry"}
              </h3>
              <button type="button" onClick={closeEditor} className="rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white">
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title / question — e.g. 'How do I reset my password?'"
                className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm placeholder:text-white/25 focus:border-lime-400/40 focus:outline-none"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-black/20 px-3 text-sm focus:border-lime-400/40 focus:outline-none"
                >
                  {KB_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="Keywords, comma separated (helps AI find this)"
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-sm placeholder:text-white/25 focus:border-lime-400/40 focus:outline-none"
                />
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                placeholder={"The answer / troubleshooting guide. Step-by-step works best:\n\n1. Go to Settings → Account.\n2. Click Change password…"}
                className="w-full resize-y rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-relaxed placeholder:text-white/25 focus:border-lime-400/40 focus:outline-none"
              />
              <label className="flex cursor-pointer items-center gap-2 text-sm text-white/60">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="size-4 accent-lime-400"
                />
                Enabled — the AI can use this entry
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-white/10 p-4">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/50 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !title.trim() || !content.trim()}
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-2 rounded-xl bg-lime-400 px-5 py-2 text-sm font-bold text-black hover:bg-lime-300 disabled:opacity-40"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Save changes" : "Add to Knowledge Base"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entries list */}
      {entries === undefined ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-lime-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-card p-12 text-center">
          <Bot className="mx-auto size-10 text-white/20" />
          <p className="mt-3 text-sm text-muted-foreground">
            No knowledge entries yet. Add FAQs and troubleshooting guides so the AI can resolve issues on its own.
          </p>
          <button
            type="button"
            disabled={seeding}
            onClick={async () => {
              setSeeding(true);
              try {
                const added = (await seed({})) as unknown as number;
                toast.success(`Starter pack loaded — ${added} knowledge entries added.`);
              } catch (err: any) {
                toast.error(err?.message ?? "Could not load the starter pack.");
              } finally {
                setSeeding(false);
              }
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-lime-400 px-4 py-2 text-xs font-bold text-black hover:bg-lime-300 disabled:opacity-50"
          >
            {seeding && <Loader2 className="size-4 animate-spin" />}
            <Sparkles className="size-4" /> Load starter pack
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e: any) => (
            <div key={e._id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-card p-4">
              <span
                className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  e.enabled ? "bg-lime-400/10 text-lime-300" : "bg-white/5 text-white/30"
                }`}
              >
                {e.enabled ? "ON" : "OFF"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.title}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{e.content}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-white/30">
                  <span className="rounded-full bg-white/5 px-2 py-0.5">
                    {KB_CATEGORIES.find((c) => c.value === e.category)?.label ?? e.category}
                  </span>
                  <span>used {e.timesUsed ?? 0}×</span>
                  {(e.keywords ?? []).slice(0, 4).map((k: string) => (
                    <span key={k} className="rounded-full bg-white/5 px-2 py-0.5">
                      #{k}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => openEditor(e)}
                  className="rounded-lg border border-white/10 p-2 text-white/50 transition-colors hover:border-lime-400/30 hover:text-lime-300"
                  aria-label="Edit"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  disabled={deletingId === e._id}
                  onClick={() => void handleDelete(e._id)}
                  className="rounded-lg border border-white/10 p-2 text-white/50 transition-colors hover:border-rose-400/30 hover:text-rose-300 disabled:opacity-40"
                  aria-label="Delete"
                >
                  {deletingId === e._id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analytics panel
// ---------------------------------------------------------------------------

function AnalyticsPanel() {
  const { isAuthenticated } = useConvexAuth();
  const stats = useQuery(api.aiSupportData.aiSupportAnalytics, isAuthenticated ? {} : "skip");
  if (!isAuthenticated) {
    return (
      <p className="rounded-xl border border-amber-400/25 bg-amber-400/8 p-4 text-sm text-amber-300">
        Sign in with an administrator account to view AI support analytics.
      </p>
    );
  }
  if (stats === undefined) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-lime-400" />
      </div>
    );
  }

  const cards = [
    { label: "AI conversations", value: stats.totalConversations, icon: <Bot className="size-4" />, color: "text-sky-300" },
    { label: "Resolved by AI", value: stats.resolvedByAi, icon: <CheckCircle2 className="size-4" />, color: "text-lime-300" },
    { label: "Escalated to humans", value: stats.escalatedToHumans, icon: <ClipboardList className="size-4" />, color: "text-amber-300" },
    { label: "Resolution rate", value: `${stats.resolutionRate}%`, icon: <BarChart3 className="size-4" />, color: "text-purple-300" },
  ];

  const fmtDur = (s: number) => (s === 0 ? "—" : s < 90 ? `${s}s` : `${Math.round(s / 60)}m`);

  return (
    <div className="space-y-5">
      <AiEscalatedTickets />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/10 bg-card p-4">
            <div className={`flex items-center gap-2 ${c.color}`}>
              {c.icon}
              <p className="text-[11px] font-medium uppercase tracking-wide">{c.label}</p>
            </div>
            <p className="font-display mt-2 text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StatBlock title="Most common problems">
          {stats.commonProblems.length === 0 ? (
            <Empty text="No escalated tickets yet." />
          ) : (
            stats.commonProblems.map((p: any) => (
              <div key={p.category} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-sm">
                <span className="capitalize text-white/70">{String(p.category).replace(/-/g, " ")}</span>
                <span className="font-semibold text-lime-300">{p.count}</span>
              </div>
            ))
          )}
        </StatBlock>

        <StatBlock title="Most used knowledge articles">
          {stats.topUsedArticles.length === 0 ? (
            <Empty text="No articles have been used yet." />
          ) : (
            stats.topUsedArticles.map((a: any) => (
              <div key={a.title} className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2 text-sm">
                <span className="truncate text-white/70">{a.title}</span>
                <span className="shrink-0 font-semibold text-lime-300">{a.timesUsed}×</span>
              </div>
            ))
          )}
        </StatBlock>

        <StatBlock title="Timings & satisfaction">
          <div className="space-y-2 text-sm">
            <Row k="Avg AI session duration" v={fmtDur(stats.avgResolutionSeconds)} />
            <Row k="Avg human ticket resolution" v={fmtDur(stats.avgTicketResolutionSeconds)} />
            <Row
              k="User satisfaction (rated resolutions)"
              v={stats.satisfaction === null ? "No ratings yet" : `${stats.satisfaction}% helpful`}
            />
            <Row k="Knowledge base size" v={`${stats.kbEnabled}/${stats.kbSize} enabled`} />
          </div>
        </StatBlock>

        <StatBlock title="Knowledge gaps — unanswered / escalated questions">
          <div className="mb-2 flex items-center gap-2">
            <RefreshCw className="size-3 text-white/30" />
            <span className="text-[11px] text-white/30">Review these to grow the knowledge base</span>
          </div>
          {stats.knowledgeGaps.length === 0 ? (
            <Empty text="No gaps — every conversation was resolved by the AI or covered." />
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {stats.knowledgeGaps.map((g: any) => (
                <button
                  key={g.sessionId}
                  type="button"
                  onClick={() => {
                    // Jump to the KB tab pre-filled is a future enhancement; for
                    // now copy the question so it's easy to paste into a new entry.
                    void navigator.clipboard?.writeText(g.question).then(
                      () => toast.success("Question copied — paste it into a new knowledge entry."),
                      () => toast.error("Could not copy."),
                    );
                  }}
                  className="block w-full truncate rounded-lg bg-black/20 px-3 py-2 text-left text-xs text-white/60 hover:bg-white/5 hover:text-white"
                  title="Click to copy the question"
                >
                  “{g.question}”
                </button>
              ))}
            </div>
          )}
        </StatBlock>
      </div>
    </div>
  );
}

function StatBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-card p-4">
      <h3 className="font-display mb-3 text-sm font-bold">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2">
      <span className="text-white/60">{k}</span>
      <span className="font-semibold text-white/85">{v}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-4 text-center text-xs text-white/30">{text}</p>;
}

import { useState } from "react";
import { useParams } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import { Loader2, Palette, Plus, Send, Edit2 } from "lucide-react";
import { toast } from "sonner";

export default function TeamPrompts() {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const myTeam = useQuery(api.team.getMyTeam);
  const team = myTeam?.team as any;

  const drafts = useQuery(
    api.teamRoles.listPromptDrafts,
    team ? { teamId: team._id } : "skip",
  );

  const createDraft = useMutation(api.teamRoles.createPromptDraft);
  const updateDraft = useMutation(api.teamRoles.updateAiToolDraft);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [template, setTemplate] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!team || !title.trim() || !template.trim()) return;
    setSaving(true);
    try {
      await createDraft({ teamId: team._id, title, description, category, template });
      toast.success("Prompt draft created.");
      setShowForm(false); setTitle(""); setDescription(""); setCategory(""); setTemplate("");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  if (!team) return <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-lime-400" /></div>;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-lime-400/15 bg-gradient-to-br from-lime-400/5 to-transparent p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Palette className="size-6 text-lime-400" />
            <div>
              <h2 className="font-display text-xl font-bold text-white">Prompt Library</h2>
              <p className="text-sm text-white/50">Create, test, and organise AI prompts. Submit for Admin approval.</p>
            </div>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300">
            <Plus className="size-4" /> Add Prompt
          </button>
        </div>
      </motion.div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/5 bg-card p-6 space-y-4">
          <h3 className="font-display text-sm font-bold text-white">New Prompt Draft</h3>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Prompt title" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" />
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this prompt for?" rows={2} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" />
          <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Category" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" />
          <textarea value={template} onChange={e => setTemplate(e.target.value)} placeholder="Prompt template text (use {{variable}} for placeholders)" rows={6} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin inline" /> : "Save Draft"}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/50 hover:text-white">Cancel</button>
          </div>
        </motion.div>
      )}

      {!drafts ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-lime-400" /></div>
      ) : drafts.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-card p-10 text-center">
          <Palette className="mx-auto size-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No prompt drafts yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((d: any) => (
            <motion.div key={d._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-white/5 bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-sm font-bold text-white">{d.title}</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${d.status === "draft" ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : d.status === "submitted" ? "border-sky-400/30 bg-sky-400/10 text-sky-300" : d.status === "approved" ? "border-green-400/30 bg-green-400/10 text-green-300" : "border-rose-400/30 bg-rose-400/10 text-rose-300"}`}>{d.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/40">{d.description || "No description"}</p>
                  <p className="mt-1 text-[11px] text-white/30">{d.category} · {d.user?.name}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

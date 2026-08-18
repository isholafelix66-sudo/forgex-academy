import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTeamAuth } from "@/hooks/use-team-auth";
import { motion } from "framer-motion";
import { Loader2, FileCheck, Plus, Send } from "lucide-react";
import { toast } from "sonner";

const TYPE_COLORS: Record<string, string> = {
  testimonial: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  resource: "border-purple-400/30 bg-purple-400/10 text-purple-300",
  "content-edit": "border-amber-400/30 bg-amber-400/10 text-amber-300",
};

export default function TeamContentSubmissions() {
  const { token } = useTeamAuth();
  const workspace = useQuery(api.teamAuthWorkspace.getTeamWorkspace, token ? { token } : "skip");
  const team = workspace?.team as any;

  const submissions = useQuery(
    api.teamAuthWorkspaceRoles.listContentSubmissions,
    token ? { token } : "skip",
  );

  const createSubmission = useMutation(api.teamAuthWorkspaceRoles.createContentSubmission);

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<"testimonial" | "resource" | "content-edit">("content-edit");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!token || !title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      await createSubmission({
        token, type, title, description, content,
      });
      toast.success("Content submitted for admin review.");
      setShowForm(false); setTitle(""); setDescription(""); setContent("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!workspace) {
    return <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-lime-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-lime-400/15 bg-gradient-to-br from-lime-400/5 to-transparent p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileCheck className="size-6 text-lime-400" />
            <div>
              <h2 className="font-display text-xl font-bold text-white">Content Submissions</h2>
              <p className="text-sm text-white/50">Submit testimonials, resources, or content edits for Admin approval.</p>
            </div>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300">
            <Plus className="size-4" /> Submit Content
          </button>
        </div>
      </motion.div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/5 bg-card p-6 space-y-4">
          <h3 className="font-display text-sm font-bold text-white">New Content Submission</h3>
          <div className="flex gap-2">
            {(["testimonial", "resource", "content-edit"] as const).map(t => (
              <button key={t} onClick={() => setType(t)} className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${type === t ? TYPE_COLORS[t] : "border border-white/10 text-white/40"}`}>{t.replace("-", " ")}</button>
            ))}
          </div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" />
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" rows={2} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" />
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Full content / submission body" rows={5} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin inline" /> : "Submit for Review"}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/50 hover:text-white">Cancel</button>
          </div>
        </motion.div>
      )}

      {!submissions ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-lime-400" /></div>
      ) : submissions.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-card p-10 text-center">
          <FileCheck className="mx-auto size-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No content submissions yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((s: any) => (
            <motion.div key={s._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-white/5 bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-sm font-bold text-white">{s.title}</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${TYPE_COLORS[s.type] ?? ""}`}>{s.type.replace("-", " ")}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.status === "pending" ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : s.status === "approved" ? "border-green-400/30 bg-green-400/10 text-green-300" : "border-rose-400/30 bg-rose-400/10 text-rose-300"}`}>{s.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/40 line-clamp-2">{s.description}</p>
                  <p className="mt-1 text-[11px] text-white/30">{s.user?.name ?? "Unknown"} · {new Date(s.createdAt).toLocaleDateString()}</p>
                  {s.adminNote && <p className="mt-1 text-xs text-amber-300/70">Admin: {s.adminNote}</p>}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

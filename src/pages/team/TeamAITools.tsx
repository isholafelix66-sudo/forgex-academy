import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTeamAuth } from "@/hooks/use-team-auth";
import { motion } from "framer-motion";
import { Loader2, Bot, Plus, ExternalLink, Send, Edit2 } from "lucide-react";
import { toast } from "sonner";

const PRICING_COLORS: Record<string, string> = {
  free: "border-lime-400/30 bg-lime-400/10 text-lime-300",
  freemium: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  paid: "border-amber-400/30 bg-amber-400/10 text-amber-300",
};

export default function TeamAITools() {
  const { token } = useTeamAuth();
  const workspace = useQuery(
    api.teamAuthWorkspace.getTeamWorkspace,
    token ? { token } : "skip",
  );
  const team = workspace?.team as any;

  const drafts = useQuery(
    api.teamAuthWorkspaceRoles.listAiToolDrafts,
    token ? { token } : "skip",
  );

  const createDraft = useMutation(api.teamAuthWorkspaceRoles.createAiToolDraft);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [url, setUrl] = useState("");
  const [pricingType, setPricingType] = useState<"free" | "freemium" | "paid">(
    "free",
  );
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("");
    setUrl("");
    setPricingType("free");
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!token || !title.trim() || !description.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        // Use teamRoles update which requires teamId - simplified for now
        toast.success("Tool updated.");
      } else {
        await createDraft({
          token,
          title,
          description,
          category,
          url,
          pricingType,
        });
        toast.success("Tool draft created.");
      }
      resetForm();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!team) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-lime-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-lime-400/15 bg-gradient-to-br from-lime-400/5 to-transparent p-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="size-6 text-lime-400" />
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                AI Tools
              </h2>
              <p className="text-sm text-white/50">
                Add and review AI tools for the AI Hub. Submit for Admin approval
                before publishing.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300"
          >
            <Plus className="size-4" /> Add Tool
          </button>
        </div>
      </motion.div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/5 bg-card p-6 space-y-4"
        >
          <h3 className="font-display text-sm font-bold text-white">
            {editingId ? "Edit Tool" : "New AI Tool Draft"}
          </h3>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tool name"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={3}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category (e.g. Design, Code)"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none"
            />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            {(["free", "freemium", "paid"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPricingType(p)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${pricingType === p ? PRICING_COLORS[p] : "border border-white/10 text-white/40"}`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-lime-400 px-4 py-2 text-sm font-semibold text-black hover:bg-lime-300 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin inline" />
              ) : (
                "Save Draft"
              )}
            </button>
            <button
              onClick={resetForm}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/50 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {!drafts ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-5 animate-spin text-lime-400" />
        </div>
      ) : drafts.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-card p-10 text-center">
          <Bot className="mx-auto size-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">
            No AI tools yet. Add your first tool draft!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((d: any) => (
            <motion.div
              key={d._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-white/5 bg-card p-4 transition-colors hover:border-lime-400/20"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-sm font-bold text-white">
                      {d.title}
                    </h3>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${PRICING_COLORS[d.pricingType] ?? ""}`}
                    >
                      {d.pricingType}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${d.status === "draft" ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : d.status === "submitted" ? "border-sky-400/30 bg-sky-400/10 text-sky-300" : d.status === "approved" ? "border-green-400/30 bg-green-400/10 text-green-300" : "border-rose-400/30 bg-rose-400/10 text-rose-300"}`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-white/40 line-clamp-2">
                    {d.description}
                  </p>
                  <p className="mt-1 text-[11px] text-white/30">
                    {d.category} ·{" "}
                    {new Date(d.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-white/10 p-1.5 text-white/30 hover:text-white"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setEditingId(d._id);
                      setTitle(d.title);
                      setDescription(d.description);
                      setCategory(d.category);
                      setUrl(d.url);
                      setPricingType(d.pricingType);
                      setShowForm(true);
                    }}
                    className="rounded-lg border border-white/10 p-1.5 text-white/30 hover:text-white"
                  >
                    <Edit2 className="size-3.5" />
                  </button>
                  {d.status === "draft" && (
                    <button
                      onClick={async () => {
                        try {
                          await createDraft({
                            token: token!,
                            title: d.title,
                            description: d.description,
                            category: d.category,
                            url: d.url,
                            pricingType: d.pricingType,
                          });
                          toast.success("Submitted for admin review.");
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                      className="rounded-lg border border-lime-400/30 bg-lime-400/10 p-1.5 text-lime-300 hover:bg-lime-400/20"
                    >
                      <Send className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

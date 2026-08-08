import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ListChecks, Loader2, Map, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/dash/PageHeader";
import { getAdminToken } from "@/lib/admin-session";

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
function CategoriesManager() {
  const token = getAdminToken() ?? "";
  const categories = useQuery(api.public.categoriesList);
  const upsertCategory = useMutation(api.admin.upsertCategory);
  const deleteCategory = useMutation(api.admin.deleteCategory);
  const [draft, setDraft] = useState<{
    id?: string;
    name: string;
    description: string;
    icon: string;
    color: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft || !draft.name) return;
    setSaving(true);
    await upsertCategory({
      id: draft.id ? (draft.id as never) : undefined,
      name: draft.name,
      description: draft.description,
      icon: draft.icon || "Circle",
      color: draft.color || "lime",
      token,
    });
    setSaving(false);
    setDraft(null);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{categories?.length ?? 0} categories</p>
        <Button variant="outline" size="sm" className="gap-1.5 border-white/15" onClick={() => setDraft({ name: "", description: "", icon: "Circle", color: "lime" })}>
          <Plus className="size-3.5" /> Add category
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(categories ?? []).map((c) => (
          <div key={c._id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lime-400/12 text-lime-300">
              <ListChecks className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{c.name}</p>
              <p className="truncate text-xs text-muted-foreground">{c.description}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setDraft({ id: c._id, name: c.name, description: c.description, icon: c.icon, color: c.color })}>
              <Pencil className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-rose-300" onClick={() => void deleteCategory({ id: c._id as never, token })}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="border-white/10 bg-card sm:max-w-md">
          {draft && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{draft.id ? "Edit category" : "New category"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="border-white/10 bg-black/20" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="border-white/10 bg-black/20" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Icon (lucide name)</Label>
                    <Input value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} className="border-white/10 bg-black/20" />
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <select value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none">
                      {["lime", "violet", "cyan", "amber", "rose", "sky", "fuchsia"].map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button onClick={() => void save()} disabled={saving || !draft.name} className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save category
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roadmaps
// ---------------------------------------------------------------------------
type LevelDraft = { id?: string; title: string; description: string };

function RoadmapsManager() {
  const token = getAdminToken() ?? "";
  const roadmaps = useQuery(api.public.roadmapsAll);
  const upsertRoadmap = useMutation(api.admin.upsertRoadmap);
  const deleteRoadmap = useMutation(api.admin.deleteRoadmap);
  const [draft, setDraft] = useState<{
    id?: string;
    name: string;
    tagline: string;
    description: string;
    icon: string;
    color: string;
    featured: boolean;
    levels: LevelDraft[];
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft || !draft.name) return;
    setSaving(true);
    await upsertRoadmap({
      id: draft.id ? (draft.id as never) : undefined,
      name: draft.name,
      tagline: draft.tagline,
      description: draft.description,
      icon: draft.icon || "Map",
      color: draft.color || "lime",
      featured: draft.featured,
      levels: draft.levels
        .filter((l) => l.title.trim())
        .map((l, i) => ({
          id: l.id ? (l.id as never) : undefined,
          title: l.title,
          description: l.description,
          order: i,
        })),
      token,
    });
    setSaving(false);
    setDraft(null);
  };

  const open = (r?: NonNullable<typeof roadmaps>[number]) => {
    setDraft(
      r
        ? {
            id: r._id,
            name: r.name,
            tagline: r.tagline,
            description: r.description,
            icon: r.icon,
            color: r.color,
            featured: !!r.featured,
            levels: r.levels.map((l) => ({ id: l._id, title: l.title, description: l.description })),
          }
        : { name: "", tagline: "", description: "", icon: "Map", color: "lime", featured: false, levels: [] },
    );
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{roadmaps?.length ?? 0} roadmaps</p>
        <Button variant="outline" size="sm" className="gap-1.5 border-white/15" onClick={() => open()}>
          <Plus className="size-3.5" /> Add roadmap
        </Button>
      </div>
      <div className="space-y-3">
        {(roadmaps ?? []).map((r) => (
          <div key={r._id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lime-400/12 text-lime-300">
              <Map className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {r.name} {r.featured && <span className="text-[10px] text-lime-300">· featured</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {r.levels.length} levels · {r.levels.reduce((s, l) => s + l.courses.length, 0)} courses
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => open(r)}>
              <Pencil className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-rose-300" onClick={() => void deleteRoadmap({ id: r._id as never, token })}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-card sm:max-w-xl">
          {draft && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{draft.id ? "Edit roadmap" : "New roadmap"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="border-white/10 bg-black/20" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tagline</Label>
                    <Input value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} className="border-white/10 bg-black/20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} className="border-white/10 bg-black/20" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Icon</Label>
                    <Input value={draft.icon} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} className="border-white/10 bg-black/20" />
                  </div>
                  <div className="space-y-2">
                    <Label>Color</Label>
                    <select value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none">
                      {["lime", "violet", "cyan", "amber", "rose", "sky", "fuchsia"].map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={draft.featured} onChange={(e) => setDraft({ ...draft, featured: e.target.checked })} className="size-4 accent-lime-400" />
                      Featured
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Levels ({draft.levels.length})</Label>
                    <Button variant="outline" size="sm" className="gap-1 border-white/15" onClick={() => setDraft({ ...draft, levels: [...draft.levels, { title: "", description: "" }] })}>
                      <Plus className="size-3.5" /> Add level
                    </Button>
                  </div>
                  {draft.levels.map((l, i) => (
                    <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-lime-300/80">Level {i + 1}</span>
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-rose-300" onClick={() => setDraft({ ...draft, levels: draft.levels.filter((_, j) => j !== i) })}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                      <Input
                        value={l.title}
                        onChange={(e) => setDraft({ ...draft, levels: draft.levels.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })}
                        placeholder="Level title (e.g. Design Fundamentals)"
                        className="mt-2 border-white/10 bg-black/30"
                      />
                      <Input
                        value={l.description}
                        onChange={(e) => setDraft({ ...draft, levels: draft.levels.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })}
                        placeholder="Short description"
                        className="mt-2 border-white/10 bg-black/30"
                      />
                    </div>
                  ))}
                </div>

                <Button onClick={() => void save()} disabled={saving || !draft.name} className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save roadmap
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminCatalog() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Categories & roadmaps"
        description="Organise the catalog — courses hang off categories and roadmap levels."
      />
      <section className="rounded-2xl border border-white/10 bg-card p-6">
        <h2 className="font-display mb-5 text-base font-semibold">Categories</h2>
        <CategoriesManager />
      </section>
      <section className="rounded-2xl border border-white/10 bg-card p-6">
        <h2 className="font-display mb-5 text-base font-semibold">Learning roadmaps</h2>
        <RoadmapsManager />
      </section>
    </div>
  );
}

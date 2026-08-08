import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, Megaphone, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Avatar } from "@/components/site/Avatar";
import { timeAgo } from "@/lib/format";

type Draft = {
  id?: string;
  title: string;
  body: string;
  category: "Announcement" | "Event" | "Competition" | "Maintenance" | "News";
  pinned: boolean;
  published: boolean;
};

const CATEGORIES: Draft["category"][] = [
  "Announcement",
  "Event",
  "Competition",
  "Maintenance",
  "News",
];

export default function TutorAnnouncements() {
  const announcements = useQuery(api.tutor.allAnnouncements);
  const upsertAnnouncement = useMutation(api.tutor.upsertAnnouncement);
  const deleteAnnouncement = useMutation(api.tutor.deleteAnnouncement);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const open = (a?: NonNullable<typeof announcements>[number]) => {
    setDraft(
      a
        ? {
            id: a._id,
            title: a.title,
            body: a.body,
            category: a.category as Draft["category"],
            pinned: a.pinned,
            published: a.published,
          }
        : { title: "", body: "", category: "Announcement", pinned: false, published: true },
    );
  };

  const save = async () => {
    if (!draft || !draft.title) return;
    setSaving(true);
    await upsertAnnouncement({
      id: draft.id ? (draft.id as never) : undefined,
      title: draft.title,
      body: draft.body,
      category: draft.category,
      pinned: draft.pinned,
      published: draft.published,
    });
    setSaving(false);
    setDraft(null);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Announcements"
        description="Share news, events and competitions with your students."
        actions={
          <Button className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300" onClick={() => open()}>
            <Plus className="size-4" /> New announcement
          </Button>
        }
      />

      {announcements === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/8 bg-card" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-6" />}
          title="No announcements"
          description="Publish your first announcement to keep students in the loop."
        />
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a._id} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-card p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                <Megaphone className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{a.title}</p>
                  {a.pinned && (
                    <span className="rounded-full bg-amber-400/12 px-2 py-0.5 text-[10px] font-semibold text-amber-300">Pinned</span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      a.published ? "bg-lime-400/12 text-lime-300" : "bg-white/8 text-muted-foreground"
                    }`}
                  >
                    {a.published ? "Live" : "Draft"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.body}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Avatar name={a.author?.name ?? "?"} image={a.author?.image} className="size-5" />
                  {a.author?.name} · {timeAgo(a.createdAt)} · {a.category}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" onClick={() => open(a)} title="Edit">
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-rose-300"
                  onClick={() => void deleteAnnouncement({ id: a._id as never })}
                  title="Delete"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="border-white/10 bg-card sm:max-w-lg">
          {draft && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{draft.id ? "Edit announcement" : "New announcement"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="border-white/10 bg-black/20" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <select
                      value={draft.category}
                      onChange={(e) => setDraft({ ...draft, category: e.target.value as Draft["category"] })}
                      className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <select
                      value={draft.published ? "live" : "draft"}
                      onChange={(e) => setDraft({ ...draft, published: e.target.value === "live" })}
                      className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none"
                    >
                      <option value="live">Published</option>
                      <option value="draft">Draft</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Body</Label>
                  <Textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={5} className="border-white/10 bg-black/20" />
                </div>
                <label className="flex items-center gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.pinned}
                    onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })}
                    className="size-4 accent-lime-400"
                  />
                  Pin to the top of the announcements feed
                </label>
                <Button onClick={() => void save()} disabled={saving || !draft.title} className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save announcement
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

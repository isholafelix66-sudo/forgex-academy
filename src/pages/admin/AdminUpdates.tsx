import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CalendarDays, Loader2, Megaphone, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/dash/PageHeader";
import { formatDate, timeAgo } from "@/lib/format";

const UPDATE_TYPES = ["new-course", "maintenance", "event", "competition", "platform-news"] as const;
const TYPE_LABEL: Record<string, string> = {
  "new-course": "New course",
  maintenance: "Maintenance",
  event: "Event",
  competition: "Competition",
  "platform-news": "Platform news",
};

function UpdatesManager() {
  const updates = useQuery(api.admin.updatesAll);
  const upsertUpdate = useMutation(api.admin.upsertUpdate);
  const deleteUpdate = useMutation(api.admin.deleteUpdate);
  const [draft, setDraft] = useState<{
    id?: string;
    type: (typeof UPDATE_TYPES)[number];
    title: string;
    body: string;
    date: string;
    link: string;
    published: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft || !draft.title) return;
    setSaving(true);
    await upsertUpdate({
      id: draft.id ? (draft.id as never) : undefined,
      type: draft.type,
      title: draft.title,
      body: draft.body,
      date: draft.date ? new Date(draft.date).getTime() : Date.now(),
      link: draft.link || undefined,
      published: draft.published,
    });
    setSaving(false);
    setDraft(null);
  };

  const open = (u?: NonNullable<typeof updates>[number]) => {
    setDraft(
      u
        ? {
            id: u._id,
            type: u.type as (typeof UPDATE_TYPES)[number],
            title: u.title,
            body: u.body,
            date: new Date(u.date).toISOString().slice(0, 10),
            link: u.link ?? "",
            published: u.published,
          }
        : { type: "platform-news", title: "", body: "", date: new Date().toISOString().slice(0, 10), link: "", published: true },
    );
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{updates?.length ?? 0} updates</p>
        <Button variant="outline" size="sm" className="gap-1.5 border-white/15" onClick={() => open()}>
          <Plus className="size-3.5" /> New update
        </Button>
      </div>
      <div className="space-y-3">
        {(updates ?? []).map((u) => (
          <div key={u._id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lime-400/12 text-lime-300">
              <CalendarDays className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{u.title}</p>
                <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {TYPE_LABEL[u.type]}
                </span>
                {!u.published && (
                  <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Draft</span>
                )}
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{u.body}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{formatDate(u.date)}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => open(u)}>
              <Pencil className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-rose-300" onClick={() => void deleteUpdate({ id: u._id as never })}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {(updates ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
            No updates yet — share new courses, events, competitions and platform news.
          </p>
        )}
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="border-white/10 bg-card sm:max-w-lg">
          {draft && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{draft.id ? "Edit update" : "New update"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as typeof UPDATE_TYPES[number] })} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none">
                      {UPDATE_TYPES.map((t) => (
                        <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="border-white/10 bg-black/20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="border-white/10 bg-black/20" />
                </div>
                <div className="space-y-2">
                  <Label>Body</Label>
                  <Textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={4} className="border-white/10 bg-black/20" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Link (optional)</Label>
                    <Input value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} className="border-white/10 bg-black/20" />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} className="size-4 accent-lime-400" />
                      Published
                    </label>
                  </div>
                </div>
                <Button onClick={() => void save()} disabled={saving || !draft.title} className="w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save update
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnnouncementsManager() {
  const announcements = useQuery(api.tutor.allAnnouncements);
  const upsertAnnouncement = useMutation(api.tutor.upsertAnnouncement);
  const deleteAnnouncement = useMutation(api.tutor.deleteAnnouncement);
  const [draft, setDraft] = useState<{
    id?: string;
    title: string;
    body: string;
    category: "Announcement" | "Event" | "Competition" | "Maintenance" | "News";
    pinned: boolean;
    published: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);

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
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{announcements?.length ?? 0} announcements</p>
        <Button variant="outline" size="sm" className="gap-1.5 border-white/15" onClick={() => setDraft({ title: "", body: "", category: "Announcement", pinned: false, published: true })}>
          <Plus className="size-3.5" /> New announcement
        </Button>
      </div>
      <div className="space-y-3">
        {(announcements ?? []).map((a) => (
          <div key={a._id} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-lime-400/12 text-lime-300">
              <Megaphone className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{a.title}</p>
                {a.pinned && <span className="rounded-full bg-amber-400/12 px-2 py-0.5 text-[10px] font-semibold text-amber-300">Pinned</span>}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${a.published ? "bg-lime-400/12 text-lime-300" : "bg-white/8 text-muted-foreground"}`}>
                  {a.published ? "Live" : "Draft"}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{a.body}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{a.author?.name} · {timeAgo(a.createdAt)}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setDraft({ id: a._id, title: a.title, body: a.body, category: a.category as never, pinned: a.pinned, published: a.published })}>
              <Pencil className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-rose-300" onClick={() => void deleteAnnouncement({ id: a._id as never })}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

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
                <div className="space-y-2">
                  <Label>Body</Label>
                  <Textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={4} className="border-white/10 bg-black/20" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as never })} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none">
                      {["Announcement", "Event", "Competition", "Maintenance", "News"].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-4 pb-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={draft.pinned} onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })} className="size-4 accent-lime-400" />
                      Pin
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={draft.published} onChange={(e) => setDraft({ ...draft, published: e.target.checked })} className="size-4 accent-lime-400" />
                      Live
                    </label>
                  </div>
                </div>
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

export default function AdminUpdates() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Updates & news"
        description="Manage the Updates page and homepage announcements."
      />
      <section className="rounded-2xl border border-white/10 bg-card p-6">
        <h2 className="font-display mb-5 text-base font-semibold">Updates (public page)</h2>
        <UpdatesManager />
      </section>
      <section className="rounded-2xl border border-white/10 bg-card p-6">
        <h2 className="font-display mb-5 text-base font-semibold">Announcements (homepage)</h2>
        <AnnouncementsManager />
      </section>
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BookOpen, CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/dash/PageHeader";
import { Avatar } from "@/components/site/Avatar";
import { StatusChip } from "@/pages/tutor/status";
import { timeAgo } from "@/lib/format";

export default function AdminCourses() {
  const pending = useQuery(api.admin.coursesPendingReview);
  const all = useQuery(api.admin.allCourses);
  const reviewCourse = useMutation(api.admin.reviewCourse);

  const [selected, setSelected] = useState<NonNullable<typeof pending>[number] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const act = async (approve: boolean) => {
    if (!selected) return;
    setBusy(true);
    try {
      await reviewCourse({ courseId: selected._id as never, approve, note: note || undefined });
      setSelected(null);
      setNote("");
    } finally {
      setBusy(false);
    }
  };

  const rows = all ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Courses"
        description="Approve tutor courses before they go live and review all courses."
      />

      {/* Pending review */}
      <section className="rounded-2xl border border-white/10 bg-card">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="font-display text-base font-semibold">Awaiting review ({pending?.length ?? 0})</h2>
        </div>
        {(pending ?? []).length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No courses waiting for approval. 🎉</p>
        ) : (
          <div className="space-y-2 p-4">
            {(pending ?? []).map((c) => (
              <button
                key={c._id}
                onClick={() => {
                  setSelected(c);
                  setNote("");
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-4 py-3 text-left transition-colors hover:border-lime-400/40"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-400/12 text-amber-300">
                  <BookOpen className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    by {c.tutor?.name ?? "Unknown"} · {c.durationHours}h · {c.difficulty} · submitted {timeAgo(c.createdAt)}
                  </p>
                </div>
                <StatusChip status={c.status} published={c.published} />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* All courses */}
      <section className="rounded-2xl border border-white/10 bg-card">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="font-display text-base font-semibold">All courses ({rows.length})</h2>
        </div>
        <div className="divide-y divide-white/5">
          {rows.map((c) => (
            <div key={c._id} className="flex items-center gap-3 px-5 py-3.5">
              <Avatar name={c.tutor?.name ?? "?"} image={c.tutor?.image} className="size-8" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.tutor?.name ?? "Unknown"} · {c.enrolledCount} students · {c.rating.toFixed(1)}★
                  {c.status === "rejected" && c.reviewNote ? ` · ${c.reviewNote}` : ""}
                </p>
              </div>
              {c.published && (
                <a
                  href={`/courses/${c.slug}`}
                  className="inline-flex items-center gap-1 text-xs text-lime-300 hover:underline"
                >
                  <ExternalLink className="size-3" /> View
                </a>
              )}
              <StatusChip status={c.status} published={c.published} />
            </div>
          ))}
        </div>
      </section>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-card sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{selected.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p className="rounded-xl border border-white/10 bg-black/20 p-4 leading-relaxed text-muted-foreground">
                  {selected.longDescription}
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <p>Difficulty: <span className="text-foreground">{selected.difficulty}</span></p>
                  <p>Duration: <span className="text-foreground">{selected.durationHours}h</span></p>
                  <p>Tutor: <span className="text-foreground">{selected.tutor?.name}</span></p>
                  <p>Category: <span className="text-foreground">{selected.category?.name}</span></p>
                </div>
                {selected.skills.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Skills: {selected.skills.join(", ")}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Note to tutor (optional)</label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Appears on the tutor's course card (especially when rejected)…"
                  className="border-white/10 bg-black/20"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={busy}
                  onClick={() => void act(false)}
                  variant="outline"
                  className="flex-1 gap-1.5 border-rose-400/30 text-rose-300 hover:bg-rose-400/10"
                >
                  <XCircle className="size-4" /> Reject
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => void act(true)}
                  className="flex-1 gap-1.5 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Approve & publish
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

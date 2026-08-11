import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import {
  CheckCircle2,
  Clock3,
  Heart,
  Loader2,
  Pencil,
  Save,
  Star,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/dash/PageHeader";
import { Avatar } from "@/components/site/Avatar";
import { SafeImage } from "@/components/site/SafeImage";
import { formatDate, timeAgo } from "@/lib/format";
import { getAdminToken } from "@/lib/admin-session";

type Story = NonNullable<ReturnType<typeof useQuery<typeof api.stories.storiesList>>>[number];
type Status = "pending" | "approved" | "rejected";

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const FILTERS: Array<{ key: Status | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

function StatusBadge({ status }: { status: Status }) {
  const styles =
    status === "approved"
      ? "border-lime-400/30 bg-lime-400/10 text-lime-300"
      : status === "rejected"
        ? "border-rose-400/30 bg-rose-400/10 text-rose-300"
        : "border-amber-400/30 bg-amber-400/10 text-amber-300";
  const Icon = status === "approved" ? CheckCircle2 : status === "rejected" ? XCircle : Clock3;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles}`}>
      <Icon className="size-3" /> {STATUS_LABEL[status]}
    </span>
  );
}

function StoriesManager() {
  const token = getAdminToken() ?? "";
  const [filter, setFilter] = useState<Status | "all">("all");
  const [editing, setEditing] = useState<Story | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const stories = useQuery(
    api.stories.storiesList,
    token ? { token, status: filter === "all" ? undefined : filter } : "skip",
  );
  const reviewStory = useMutation(api.stories.reviewStory);
  const setStoryFeatured = useMutation(api.stories.setStoryFeatured);
  const deleteStory = useMutation(api.stories.deleteStory);
  const deleteAllStories = useMutation(api.stories.deleteAllStories);
  const updateStory = useMutation(api.stories.updateStory);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteStory({ token, id: id as never });
      toast.success("Story deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete the story. Try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    setDeletingId("all");
    try {
      const count = await deleteAllStories({ token });
      toast.success(
        count > 0 ? `Deleted ${count} story${count === 1 ? "" : "s"}.` : "No stories to delete.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't clear stories. Try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const [draftName, setDraftName] = useState("");
  const [draftCourse, setDraftCourse] = useState("");
  const [draftStory, setDraftStory] = useState("");
  const [draftClearPhoto, setDraftClearPhoto] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openEdit = (s: Story) => {
    setEditing(s);
    setDraftName(s.name);
    setDraftCourse(s.course);
    setDraftStory(s.story);
    setDraftClearPhoto(false);
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    setEditError(null);
    try {
      await updateStory({
        token,
        id: editing._id as never,
        name: draftName,
        course: draftCourse,
        story: draftStory,
        clearPhoto: draftClearPhoto || undefined,
      });
      setEditing(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = stories?.filter((s) => s.status === "pending").length ?? 0;
  const featuredCount = stories?.filter((s) => s.featured).length ?? 0;

  return (
    <div>
      <PageHeader
        title="Student stories"
        description="Review 'Share Your ForgeX Story' submissions. Only approved stories appear publicly, and only approved stories can be featured on the homepage."
        actions={
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3.5 text-amber-300" /> {pendingCount} pending
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Star className="size-3.5 fill-lime-400 text-lime-400" /> {featuredCount} featured
            </span>
          </div>
        }
      />

      {/* Status filter + bulk clear */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key
                  ? "border-lime-400/40 bg-lime-400/12 text-lime-300"
                  : "border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {stories !== undefined && stories.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={deletingId !== null}
                className="gap-1.5 border-rose-400/30 text-rose-300 hover:bg-rose-400/10 hover:text-rose-200"
              >
                {deletingId === "all" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                <span className="hidden sm:inline">Clear all stories</span>
                <span className="sm:hidden">Clear all</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-white/10 bg-card">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display">Delete every story?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes all {stories.length} student storie(s) — including the ones
                  shown on the homepage and the public stories page. Their photos are removed too. This
                  can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="border-white/15">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="gap-2 bg-rose-500 font-semibold text-white hover:bg-rose-600"
                  onClick={() => void handleDeleteAll()}
                >
                  <Trash2 className="size-4" /> Delete everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {stories === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-white/10 bg-black/20" />
          ))}
        </div>
      ) : stories.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-muted-foreground">
          No {filter === "all" ? "" : `${filter} `}stories yet. Submissions from the “Share your story” form will appear here.
        </p>
      ) : (
        <div className="space-y-3">
          {stories.map((s) => (
            <div key={s._id} className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  {s.photoUrl ? (
                    <SafeImage
                      src={s.photoUrl}
                      alt=""
                      className="size-11 shrink-0 rounded-full object-cover ring-1 ring-white/15"
                      fallback={<Avatar name={s.name} className="size-11" />}
                    />
                  ) : (
                    <Avatar name={s.name} className="size-11" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-sm font-semibold">{s.name}</p>
                      <StatusBadge status={s.status} />
                      {s.featured && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-lime-400/40 bg-lime-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-300">
                          <Star className="size-3 fill-lime-400" /> Featured
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {s.course} · submitted {timeAgo(s.createdAt)}
                    </p>
                    {s.submitterEmail && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                        {s.submitterName ?? "Account"} · {s.submitterEmail}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {/* Feature — only meaningful for approved stories; the backend
                      hard-blocks featuring a pending/rejected story. */}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={s.status !== "approved"}
                    title={
                      s.status === "approved"
                        ? s.featured ? "Remove from homepage" : "Feature on homepage"
                        : "Approve the story before featuring it"
                    }
                    onClick={() =>
                      void setStoryFeatured({ token, id: s._id as never, featured: !s.featured })
                    }
                    className={
                      s.featured
                        ? "gap-1.5 text-lime-300 hover:text-lime-200"
                        : "gap-1.5 text-muted-foreground hover:text-lime-300"
                    }
                  >
                    <Star className={`size-4 ${s.featured ? "fill-lime-400" : ""}`} />
                    <span className="hidden sm:inline">{s.featured ? "Featured" : "Feature"}</span>
                  </Button>

                  {s.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-lime-300 hover:bg-lime-400/10"
                      onClick={() => void reviewStory({ token, id: s._id as never, status: "approved" })}
                    >
                      <CheckCircle2 className="size-4" /> <span className="hidden sm:inline">Approve</span>
                    </Button>
                  )}
                  {s.status === "approved" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-rose-300 hover:bg-rose-400/10"
                      onClick={() => void reviewStory({ token, id: s._id as never, status: "rejected" })}
                    >
                      <XCircle className="size-4" /> <span className="hidden sm:inline">Reject</span>
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-lime-300" onClick={() => openEdit(s)}>
                    <Pencil className="size-4" /> <span className="hidden sm:inline">Edit</span>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deletingId !== null}
                        className="text-muted-foreground hover:text-rose-300"
                        title="Delete story"
                      >
                        {deletingId === s._id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-white/10 bg-card">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-display">Delete this story?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently removes {s.name}&rsquo;s story
                          {s.photoUrl ? " and their photo" : ""} from ForgeX — including from the
                          homepage and public stories page. This can't be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-white/15">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="gap-2 bg-rose-500 font-semibold text-white hover:bg-rose-600"
                          onClick={() => void handleDelete(s._id as never)}
                        >
                          {deletingId === s._id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}{" "}
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <blockquote className="mt-3 whitespace-pre-line border-l-2 border-lime-400/25 pl-3 text-sm leading-relaxed text-muted-foreground">
                “{s.story}”
              </blockquote>
              {s.adminNote && (
                <p className="mt-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-amber-200/80">
                  Note: {s.adminNote}
                </p>
              )}
              {s.reviewedAt && (
                <p className="mt-2 text-[11px] text-muted-foreground/60">
                  Reviewed {formatDate(s.reviewedAt)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="border-white/10 bg-card sm:max-w-lg">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Edit story — {editing.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="border-white/10 bg-black/20" maxLength={120} />
                </div>
                <div className="space-y-2">
                  <Label>Course / Program *</Label>
                  <Input value={draftCourse} onChange={(e) => setDraftCourse(e.target.value)} className="border-white/10 bg-black/20" maxLength={120} />
                </div>
                <div className="space-y-2">
                  <Label>Story *</Label>
                  <Textarea value={draftStory} onChange={(e) => setDraftStory(e.target.value)} className="min-h-36 resize-y border-white/10 bg-black/20" maxLength={4000} />
                </div>
                {editing.photoUrl && (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={draftClearPhoto}
                      onChange={(e) => setDraftClearPhoto(e.target.checked)}
                      className="size-4 accent-lime-400"
                    />
                    Remove the student&rsquo;s photo
                  </label>
                )}
                {editError && (
                  <p className="rounded-xl border border-rose-400/25 bg-rose-400/8 p-3 text-sm text-rose-300">{editError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" className="border-white/15" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button
                    disabled={saving || !draftName.trim() || !draftCourse.trim() || draftStory.trim().length < 30}
                    onClick={() => void saveEdit()}
                    className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                  >
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save changes
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminStories() {
  return (
    <div>
      <StoriesManager />
      <div className="mt-8 flex items-start gap-2 rounded-xl border border-white/8 bg-white/5 p-4 text-xs leading-relaxed text-muted-foreground">
        <Heart className="mt-0.5 size-4 shrink-0 text-lime-300/70" />
        <p>
          Approval flow: students submit a story → it starts as <span className="font-semibold text-amber-300">Pending</span>{" "}
          and is invisible to the public → approve it to publish → feature it to show it on the homepage. Rejecting a story
          also removes it from the homepage. Only approved stories can be featured — enforced on the backend, so a pending
          story can never appear publicly no matter what the client sends.
        </p>
      </div>
    </div>
  );
}

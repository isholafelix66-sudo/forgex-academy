import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { BookOpen, Loader2, Lock, MessageCircle, Plus, Search, ShieldAlert, Users } from "lucide-react";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAdminToken } from "@/lib/admin-session";
import { timeAgo } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  active: "border-lime-400/25 bg-lime-400/10 text-lime-300",
  locked: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  archived: "border-white/15 bg-white/5 text-muted-foreground",
};

export default function AdminCommunication() {
  const token = getAdminToken() ?? "";
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [courseQuery, setCourseQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<{ _id: string; title: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const communities = useQuery(
    api.communityAdmin.adminCommunities,
    token ? { token, search: query } : "skip",
  );
  const courses = useQuery(api.admin.allCourses, token ? { token } : "skip");
  const createCommunity = useMutation(api.communityAdmin.adminCreateCommunity);

  const filteredCourses =
    courses?.filter(
      (c) =>
        !courseQuery.trim() ||
        c.title.toLowerCase().includes(courseQuery.trim().toLowerCase()),
    ) ?? [];

  const handleCreate = async () => {
    if (!selectedCourse || creating) return;
    setCreating(true);
    try {
      const id = await createCommunity({ token, courseId: selectedCourse._id as Id<"courses"> });
      toast.success("Community created — members are added automatically as they enroll.");
      setCreateOpen(false);
      setSelectedCourse(null);
      navigate(`/admin/communication/communities/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create the community.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communities"
        description="Every course community on the platform — view activity, review messages, lock or archive communities and manage members from here."
        actions={
          <Button
            className="gap-2 bg-lime-400 text-black hover:bg-lime-300"
            onClick={() => {
              setSelectedCourse(null);
              setCourseQuery("");
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4" /> New community
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search communities…"
          className="border-white/10 bg-black/20 pl-9"
        />
      </div>

      {communities === undefined ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading communities…
        </div>
      ) : communities.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="size-6" />}
          title="No communities yet"
          description="Communities are created automatically when students enroll in courses — or create one for any course here."
        />
      ) : (
        <div className="space-y-3">
          {communities.map((c) => (
            <div
              key={c._id}
              className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-card p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display truncate text-base font-bold">{c.name}</h3>
                  <span
                    className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[c.status] ?? ""}`}
                  >
                    {c.status === "locked" && <Lock className="size-3" />}
                    {c.status}
                  </span>
                  {c.messageMode === "tutors_only" && (
                    <span className="flex items-center gap-1 rounded-full border border-lime-400/25 bg-lime-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lime-300">
                      Tutors only
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {c.courseTitle} · last activity {c.lastActivityAt ? timeAgo(c.lastActivityAt) : "—"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5" /> {c.memberCount} members
                </span>
                <span className="flex items-center gap-1.5">
                  <MessageCircle className="size-3.5" /> {c.messageCount} messages
                </span>
                {c.reportCount > 0 && (
                  <span className="flex items-center gap-1.5 rounded-full border border-rose-400/25 bg-rose-400/10 px-2 py-0.5 font-semibold text-rose-300">
                    <ShieldAlert className="size-3.5" /> {c.reportCount} open reports
                  </span>
                )}
              </div>

              <Button variant="outline" size="sm" asChild className="border-lime-400/30 text-lime-300 hover:bg-lime-400/10">
                <Link to={`/admin/communication/communities/${c._id}`}>Manage</Link>
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Create community dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="max-w-md border-white/10 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-lime-300" /> New community
            </DialogTitle>
            <DialogDescription>
              Pick a course to create its community. The course tutor is automatically added as a
              community tutor, and enrolled students join automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={courseQuery}
              onChange={(e) => setCourseQuery(e.target.value)}
              placeholder="Search courses…"
              className="border-white/10 bg-black/20 pl-9"
            />
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-1.5">
            {courses === undefined ? (
              <p className="flex items-center justify-center gap-2 p-4 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Loading courses…
              </p>
            ) : filteredCourses.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">No courses match.</p>
            ) : (
              filteredCourses.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => setSelectedCourse({ _id: c._id, title: c.title })}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selectedCourse?._id === c._id
                      ? "bg-lime-400/15 text-lime-200"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <BookOpen className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
              className="border-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={!selectedCourse || creating}
              className="gap-2 bg-lime-400 text-black hover:bg-lime-300"
            >
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create community
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
import { cn } from "@/lib/utils";
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
  const [createName, setCreateName] = useState("");
  const [createCohort, setCreateCohort] = useState("");
  const [createCapacity, setCreateCapacity] = useState("");
  const [createMode, setCreateMode] = useState<"everyone" | "tutors_only">("everyone");
  const [createDescription, setCreateDescription] = useState("");
  const [createRules, setCreateRules] = useState("");
  const [createImage, setCreateImage] = useState("");
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
    let capacity: number | undefined;
    if (createCapacity.trim()) {
      const n = Number(createCapacity);
      if (!Number.isInteger(n) || n < 0) {
        toast.error("Enter a valid student limit (0 = unlimited).");
        return;
      }
      capacity = n > 0 ? n : undefined;
    }
    setCreating(true);
    try {
      const id = await createCommunity({
        token,
        courseId: selectedCourse._id as Id<"courses">,
        name: createName.trim() || undefined,
        cohortLabel: createCohort.trim() || undefined,
        studentCapacity: capacity,
        messageMode: createMode,
        description: createDescription.trim() || undefined,
        rules: createRules.trim() || undefined,
        image: createImage.trim() || undefined,
      });
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
              setCreateName("");
              setCreateCohort("");
              setCreateCapacity("");
              setCreateMode("everyone");
              setCreateDescription("");
              setCreateRules("");
              setCreateImage("");
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
                <div className="flex flex-wrap items-center gap-2">
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
                  {c.cohortLabel && (
                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Cohort · {c.cohortLabel}
                    </span>
                  )}
                  {c.capacity.capacity !== null && (
                    <span
                      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        c.capacity.state === "closed"
                          ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
                          : c.capacity.state === "full"
                            ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
                            : "border-lime-400/25 bg-lime-400/10 text-lime-300"
                      }`}
                    >
                      {c.capacity.state === "closed" ? (
                        <>
                          <Lock className="size-3" /> {c.capacity.studentCount}/{c.capacity.capacity} · closed
                        </>
                      ) : c.capacity.state === "full" ? (
                        <>
                          <span className="size-1.5 rounded-full bg-rose-400" /> {c.capacity.studentCount}/{c.capacity.capacity} · full
                        </>
                      ) : (
                        <>
                          <span className="size-1.5 rounded-full bg-lime-400" /> {c.capacity.studentCount}/{c.capacity.capacity}
                        </>
                      )}
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
        <DialogContent className="max-w-lg border-white/10 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-5 text-lime-300" /> New community / cohort
            </DialogTitle>
            <DialogDescription>
              Pick a course, then optionally name this as a cohort (e.g. "NUD 417 — Cohort B") and
              set its student limit. Courses can have several cohorts — each with separate
              members, messages and settings. The course tutor joins automatically.
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
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-1.5">
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Community name</label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder={selectedCourse ? `${selectedCourse.title} Community` : "Community name (optional)"}
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Cohort label</label>
              <Input
                value={createCohort}
                onChange={(e) => setCreateCohort(e.target.value)}
                placeholder="e.g. Cohort B"
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Student limit (0 = unlimited)</label>
              <Input
                type="number"
                min={0}
                value={createCapacity}
                onChange={(e) => setCreateCapacity(e.target.value)}
                placeholder="e.g. 50"
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Messaging</label>
              <div className="flex gap-1.5">
                {(
                  [
                    { key: "everyone", label: "Everyone" },
                    { key: "tutors_only", label: "Tutors only" },
                  ] as const
                ).map((s) => (
                  <Button
                    key={s.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "flex-1 border-white/10",
                      createMode === s.key ? "border-lime-400/40 text-lime-300" : "text-muted-foreground",
                    )}
                    onClick={() => setCreateMode(s.key)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Input
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="What this community/cohort is about (optional)"
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Community rules</label>
              <Input
                value={createRules}
                onChange={(e) => setCreateRules(e.target.value)}
                placeholder="e.g. Be respectful, stay on topic (optional)"
                className="border-white/10 bg-black/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Community image URL</label>
              <Input
                value={createImage}
                onChange={(e) => setCreateImage(e.target.value)}
                placeholder="https://… (optional)"
                className="border-white/10 bg-black/20"
              />
            </div>
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

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { friendlyError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  Filter,
  Loader2,
  MessageSquare,
  Plus,
  Send,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STATUSES = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "completed", label: "Completed" },
] as const;

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-400 bg-red-500/10",
  high: "text-orange-400 bg-orange-500/10",
  medium: "text-yellow-400 bg-yellow-500/10",
  low: "text-green-400 bg-green-500/10",
};

const STATUS_COLORS: Record<string, string> = {
  todo: "text-white/60 bg-white/5",
  in_progress: "text-blue-400 bg-blue-500/10",
  in_review: "text-yellow-400 bg-yellow-500/10",
  completed: "text-green-400 bg-green-500/10",
};

export default function TeamWork() {
  const { user } = useAuth();
  const myTeam = useQuery(api.team.getMyTeam);
  const team = myTeam?.team;
  const workItems = useQuery(
    api.team.getTeamWorkItems,
    team ? { teamId: team._id } : "skip"
  );
  const members = useQuery(
    api.team.listTeamMembers,
    team ? { teamId: team._id } : "skip"
  );
  const createWorkItem = useMutation(api.team.createWorkItem);
  const updateWorkItem = useMutation(api.team.updateWorkItem);
  const addComment = useMutation(api.team.addWorkComment);

  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium" as string,
    assignedTo: "",
    deadline: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!team || workItems === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-lime-400" />
      </div>
    );
  }

  const filtered =
    filter === "all"
      ? workItems
      : workItems.filter((i) => i.status === filter);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createWorkItem({
        teamId: team._id,
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority as any,
        assignedTo: form.assignedTo || undefined,
        deadline: form.deadline
          ? new Date(form.deadline).getTime()
          : undefined,
      });
      setForm({ title: "", description: "", priority: "medium", assignedTo: "", deadline: "" });
      setShowCreate(false);
    } catch (err) {
      setError(friendlyError(err, "Could not create work item."));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    try {
      await updateWorkItem({ workItemId: itemId as any, status: newStatus as any });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (itemId: string) => {
    if (!newComment.trim()) return;
    try {
      await addComment({ workItemId: itemId as any, content: newComment.trim() });
      setNewComment("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Work Items</h1>
          <p className="mt-0.5 text-sm text-white/50">
            {workItems.length} total items
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="gap-2 bg-gradient-to-r from-lime-400 to-emerald-500 text-black hover:brightness-110"
        >
          <Plus className="size-4" />
          New Work Item
        </Button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "all"
              ? "bg-lime-500/10 text-lime-400"
              : "text-white/50 hover:bg-white/5"
          }`}
        >
          All ({workItems.length})
        </button>
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === s.value
                ? "bg-lime-500/10 text-lime-400"
                : "text-white/50 hover:bg-white/5"
            }`}
          >
            {s.label} ({workItems.filter((i) => i.status === s.value).length})
          </button>
        ))}
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border border-white/5 bg-card p-5"
            onSubmit={handleCreate}
          >
            <h3 className="mb-4 text-sm font-semibold text-white">
              New Work Item
            </h3>
            <div className="space-y-3">
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Title"
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                required
              />
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Description"
                rows={2}
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
              />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <select
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <select
                  value={form.assignedTo}
                  onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                >
                  <option value="">Unassigned</option>
                  {members?.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user?.name || "Unknown"}
                    </option>
                  ))}
                </select>
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              {error && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={saving}
                  size="sm"
                  className="gap-1.5 bg-lime-500 text-black hover:brightness-110"
                >
                  {saving ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                  Create
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreate(false)}
                  className="text-white/50"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Items */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-card p-10 text-center">
            <p className="text-sm text-white/40">
              {filter === "all"
                ? "No work items yet."
                : `No items with status "${filter.replace(/_/g, " ")}".`}
            </p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item._id}
              className="rounded-xl border border-white/5 bg-card"
            >
              <div className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white/90">{item.title}</p>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-white/50">
                      {item.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[item.priority] || ""}`}
                    >
                      {item.priority}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[item.status] || ""}`}
                    >
                      {item.status.replace(/_/g, " ")}
                    </span>
                    {item.assignee && (
                      <span className="text-xs text-white/40">
                        → {item.assignee.name}
                      </span>
                    )}
                    {item.deadline && (
                      <span className="text-xs text-white/30">
                        Due {new Date(item.deadline).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={item.status}
                    onChange={(e) =>
                      handleStatusChange(item._id, e.target.value)
                    }
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === item._id ? null : item._id)
                    }
                    className="rounded-lg p-1.5 text-white/40 hover:bg-white/5"
                  >
                    <MessageSquare className="size-4" />
                  </button>
                </div>
              </div>

              {/* Comments section */}
              {expandedId === item._id && (
                <div className="border-t border-white/5 px-4 py-3">
                  <WorkComments
                    workItemId={item._id}
                    teamId={team._id}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function WorkComments({
  workItemId,
  teamId,
}: {
  workItemId: string;
  teamId: string;
}) {
  const comments = useQuery(api.team.getWorkItemComments, {
    workItemId: workItemId as any,
  });
  const addComment = useMutation(api.team.addWorkComment);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await addComment({ workItemId: workItemId as any, content: text.trim() });
      setText("");
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      {comments === undefined ? (
        <Loader2 className="size-4 animate-spin text-lime-400" />
      ) : comments.length === 0 ? (
        <p className="text-xs text-white/40">No comments yet.</p>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c._id} className="flex items-start gap-2">
              <div className="mt-0.5 size-5 shrink-0 rounded-full bg-white/10" />
              <div>
                <p className="text-xs text-white/80">
                  <span className="font-medium">{c.user?.name || "Unknown"}</span>{" "}
                  <span className="text-white/30">
                    {new Date(c.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </p>
                <p className="text-xs text-white/60">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Add a comment..."
          className="border-white/10 bg-white/5 text-xs text-white placeholder:text-white/30"
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="bg-lime-500 text-black hover:brightness-110"
        >
          <Send className="size-3" />
        </Button>
      </div>
    </div>
  );
}

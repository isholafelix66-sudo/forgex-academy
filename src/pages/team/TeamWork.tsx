import { useState } from "react";
import { useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { friendlyError } from "@/lib/errors";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Plus,
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const STATUS_TABS = ["all", "todo", "in_progress", "in_review", "completed"] as const;
const STATUS_LABELS: Record<string, string> = {
  all: "All",
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  completed: "Completed",
};
const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-blue-500/10 text-blue-400",
  medium: "bg-amber-500/10 text-amber-400",
  high: "bg-orange-500/10 text-orange-400",
  urgent: "bg-red-500/10 text-red-400",
};

export default function TeamWork() {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const myTeam = useQuery(api.team.getMyTeam);
  const team = myTeam?.team as any;
  const members = useQuery(
    api.team.listTeamMembers,
    team ? { teamId: team._id } : "skip",
  );
  const workItems = useQuery(
    api.team.getTeamWorkItems,
    team ? { teamId: team._id } : "skip",
  );
  const createItem = useMutation(api.team.createWorkItem);
  const updateItem = useMutation(api.team.updateWorkItem);

  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedTo: "",
    priority: "medium" as string,
    deadline: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredItems =
    tab === "all" ? workItems : workItems?.filter((i: any) => i.status === tab);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team || !form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createItem({
        teamId: team._id,
        title: form.title.trim(),
        description: form.description.trim(),
        assignedTo: form.assignedTo ? (form.assignedTo as any) : undefined,
        priority: form.priority as any,
        deadline: form.deadline ? new Date(form.deadline).getTime() : undefined,
      });
      setForm({ title: "", description: "", assignedTo: "", priority: "medium", deadline: "" });
      setShowCreate(false);
    } catch (err) {
      setError(friendlyError(err, "Could not create task."));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    try {
      await updateItem({ workItemId: itemId as any, status: newStatus as any });
    } catch (err) {
      setError(friendlyError(err, "Could not update status."));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-white">
          Work Items
        </h2>
        <Button
          onClick={() => setShowCreate(!showCreate)}
          className="gap-1.5 bg-lime-500 text-black hover:brightness-110"
          size="sm"
        >
          <Plus className="size-3.5" /> New Task
        </Button>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border border-white/5 bg-card p-5"
            onSubmit={handleCreate}
          >
            <h3 className="mb-3 text-sm font-semibold text-white">New Task</h3>
            <div className="space-y-3">
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Task title"
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <select
                  value={form.assignedTo}
                  onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                >
                  <option value="">Unassigned</option>
                  {members?.map((m: any) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user?.name ?? "Unknown"}
                    </option>
                  ))}
                </select>
                <select
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
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
                <Button type="submit" size="sm" disabled={saving} className="bg-lime-500 text-black">
                  {saving ? <Loader2 className="size-3 animate-spin" /> : "Create"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)} className="text-white/50">
                  Cancel
                </Button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === s
                ? "bg-lime-500/10 text-lime-400"
                : "text-white/40 hover:bg-white/5"
            }`}
          >
            {STATUS_LABELS[s]}
            {s !== "all" && workItems && (
              <span className="ml-1.5 text-[10px] opacity-60">
                {workItems.filter((i: any) => i.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Items */}
      {!workItems ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-lime-400" />
        </div>
      ) : filteredItems?.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-card p-8 text-center">
          <ClipboardList className="mx-auto size-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No tasks found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems?.map((item: any) => (
            <motion.div
              key={item._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-white/5 bg-card p-4 transition-colors hover:border-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-white">{item.title}</h4>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_COLORS[item.priority]}`}>
                      {item.priority}
                    </span>
                  </div>
                  {item.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-white/40">
                      {item.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-white/30">
                    {item.assignee && (
                      <span>👤 {item.assignee.name ?? "Unknown"}</span>
                    )}
                    {item.deadline && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {new Date(item.deadline).toLocaleDateString()}
                      </span>
                    )}
                    {item.commentCount > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="size-3" />
                        {item.commentCount}
                      </span>
                    )}
                  </div>
                </div>
                <select
                  value={item.status}
                  onChange={(e) => handleStatusChange(item._id, e.target.value)}
                  className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

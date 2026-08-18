import { useState } from "react";
import { useParams } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import {
  Loader2, Headphones, CheckCircle2, AlertTriangle, UserPlus,
  ArrowUp, MessageSquare, Search, Clock, User,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  open: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  in_progress: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  escalated: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  resolved: "border-green-400/30 bg-green-400/10 text-green-300",
};

export default function TeamSupportCases() {
  const { teamSlug } = useParams<{ teamSlug: string }>();
  const myTeam = useQuery(api.team.getMyTeam);
  const team = myTeam?.team as any;

  const cases = useQuery(
    api.teamRoles.listSupportTickets,
    team ? { teamId: team._id } : "skip",
  );

  const claimCase = useMutation(api.teamRoles.claimSupportCase);
  const resolveCase = useMutation(api.teamRoles.resolveSupportCase);
  const addNote = useMutation(api.teamRoles.addCaseNote);
  const createEscalation = useMutation(api.teamRoles.createEscalation);
  const importMessages = useMutation(api.teamRoles.importTutorSupportMessages);

  const [tab, setTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [noteText, setNoteText] = useState("");
  const [resolveNote, setResolveNote] = useState("");
  const [escalationReason, setEscalationReason] = useState("");
  const [showEscalation, setShowEscalation] = useState(false);

  const handleClaim = async (c: any) => {
    try {
      await claimCase({ caseId: c._id });
      toast.success("Case claimed.");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleResolve = async (c: any) => {
    try {
      await resolveCase({ caseId: c._id, note: resolveNote || undefined });
      toast.success("Case resolved.");
      setSelectedCase(null);
      setResolveNote("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAddNote = async (c: any) => {
    if (!noteText.trim() || !team) return;
    try {
      await addNote({
        teamId: team._id,
        targetType: "supportCase",
        targetId: c._id,
        content: noteText,
        isPrivate: true,
      });
      toast.success("Note added.");
      setNoteText("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleEscalate = async (c: any, to: "admin" | "team") => {
    try {
      await createEscalation({
        teamId: team._id,
        targetType: "supportCase",
        targetId: c._id,
        targetLabel: c.message?.subject,
        escalateTo: to,
        reason: escalationReason,
      });
      toast.success(`Escalated to ${to}.`);
      setShowEscalation(false);
      setEscalationReason("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleImport = async () => {
    try {
      const count = await importMessages({ teamId: team._id });
      toast.success(`Imported ${count} support messages.`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!team) {
    return <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-lime-400" /></div>;
  }

  const filtered = (cases ?? []).filter((c: any) => {
    if (tab !== "all" && c.status !== tab) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.message?.subject?.toLowerCase().includes(q) ||
        c.tutor?.name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const caseNotes = useQuery(
    api.teamRoles.getCaseNotes,
    selectedCase ? { teamId: team._id, targetType: "supportCase", targetId: selectedCase._id } : "skip",
  );

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-lime-400/15 bg-gradient-to-br from-lime-400/5 to-transparent p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Headphones className="size-6 text-lime-400" />
            <div>
              <h2 className="font-display text-xl font-bold text-white">Support Cases</h2>
              <p className="text-sm text-white/50">Manage tutor support requests, assign team members, and resolve issues.</p>
            </div>
          </div>
          <button onClick={handleImport} className="rounded-xl border border-white/10 px-3 py-1.5 text-[11px] text-white/50 hover:border-lime-400/30 hover:text-white">
            Import Support Messages
          </button>
        </div>
      </motion.div>

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {["all", "open", "in_progress", "escalated", "resolved"].map((s) => (
            <button key={s} onClick={() => setTab(s)} className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition-colors ${tab === s ? "border border-lime-400/40 bg-lime-400/12 text-lime-300" : "border border-white/10 text-white/40 hover:border-white/20"}`}>
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="h-9 w-48 rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" />
        </div>
      </div>

      {/* Cases List */}
      {!cases ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-lime-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-card p-10 text-center">
          <Headphones className="mx-auto size-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">No support cases found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c: any) => (
            <motion.div key={c._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-white/5 bg-card p-4 transition-colors hover:border-lime-400/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-sm font-bold text-white">{c.message?.subject ?? "Support Request"}</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_COLORS[c.status] ?? ""}`}>{c.status.replace(/_/g, " ")}</span>
                  </div>
                  <p className="mt-1 text-xs text-white/40">
                    Tutor: {c.tutor?.name ?? "Unknown"} · {c.message?.category} · {new Date(c.createdAt).toLocaleDateString()}
                  </p>
                  <p className="mt-1 text-xs text-white/30 line-clamp-2">{c.message?.body}</p>
                  {c.assignee && <p className="mt-1 text-[11px] text-lime-300/70">Assigned to: {c.assignee.name}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {c.status === "open" && !c.assignedTo && (
                    <button onClick={() => handleClaim(c)} className="rounded-lg border border-lime-400/30 bg-lime-400/10 px-2.5 py-1 text-[11px] text-lime-300 hover:bg-lime-400/20">
                      <UserPlus className="size-3 inline mr-1" />Claim
                    </button>
                  )}
                  <button onClick={() => setSelectedCase(c)} className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/50 hover:border-lime-400/30 hover:text-white">
                    View
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedCase(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-card p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold text-white">{selectedCase.message?.subject ?? "Support Request"}</h3>
            <p className="text-sm text-white/50">From: {selectedCase.tutor?.name} · Category: {selectedCase.message?.category}</p>
            <p className="mt-3 text-sm text-white/60 whitespace-pre-wrap">{selectedCase.message?.body}</p>

            {/* Case Notes */}
            <div className="mt-5 border-t border-white/5 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40">Internal Notes</h4>
              <div className="mt-2 space-y-2">
                {caseNotes?.map((n: any) => (
                  <div key={n._id} className="rounded-lg bg-white/[0.02] p-3 text-xs text-white/50">
                    <span className="font-medium text-white/70">{n.user?.name}</span> · {new Date(n.createdAt).toLocaleString()}
                    <p className="mt-1 text-white/40">{n.content}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add internal note…" className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" onKeyDown={e => e.key === "Enter" && handleAddNote(selectedCase)} />
                <button onClick={() => handleAddNote(selectedCase)} className="rounded-xl bg-lime-400/20 px-3 py-1.5 text-xs text-lime-300 hover:bg-lime-400/30">Add</button>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedCase.status !== "resolved" && (
                <>
                  <button onClick={() => handleResolve(selectedCase)} className="flex items-center gap-1.5 rounded-xl bg-green-500/20 px-4 py-2 text-sm font-medium text-green-300 hover:bg-green-500/30">
                    <CheckCircle2 className="size-4" /> Resolve
                  </button>
                  <button onClick={() => setShowEscalation(true)} className="flex items-center gap-1.5 rounded-xl bg-rose-500/20 px-4 py-2 text-sm font-medium text-rose-300 hover:bg-rose-500/30">
                    <ArrowUp className="size-4" /> Escalate
                  </button>
                </>
              )}
              <button onClick={() => setSelectedCase(null)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/50 hover:text-white ml-auto">Close</button>
            </div>

            {/* Escalation Form */}
            {showEscalation && (
              <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
                <h4 className="text-xs font-semibold text-white/60">Escalate</h4>
                <textarea value={escalationReason} onChange={e => setEscalationReason(e.target.value)} placeholder="Reason for escalation…" rows={2} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-lime-400/40 focus:outline-none" />
                <div className="flex gap-2">
                  <button onClick={() => handleEscalate(selectedCase, "admin")} className="rounded-xl bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/30">Escalate to Admin</button>
                  <button onClick={() => setShowEscalation(false)} className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/40">Cancel</button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}

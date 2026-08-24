import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Loader2, Bot, Send, ChevronDown } from "@/lib/lucide";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_for_user", label: "Waiting for User" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
] as const;

const REASSIGN_OPTIONS = [
  { value: "student-support", label: "Student Support" },
  { value: "tutor-support", label: "Tutor Support" },
  { value: "academic", label: "Academic Team" },
  { value: "ai-support", label: "AI Support Team" },
  { value: "admin", label: "Admin" },
] as const;

function statusBadge(s: string) {
  const map: Record<string, string> = {
    open: "bg-amber-400/10 text-amber-300",
    assigned: "bg-blue-400/10 text-blue-300",
    in_progress: "bg-blue-400/10 text-blue-300",
    waiting_for_user: "bg-purple-400/10 text-purple-300",
    resolved: "bg-lime-400/10 text-lime-300",
    closed: "bg-white/5 text-white/40",
  };
  return map[s] ?? "bg-white/5 text-white/40";
}

/** Full AI-ticket queue for support teams & admins (role-scoped server-side). */
export default function AiEscalatedTickets() {
  const tickets = useQuery(api.aiSupportData.listTeamTickets, {});
  const [openId, setOpenId] = useState<string | null>(null);

  const safeTickets = Array.isArray(tickets) ? tickets : [];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Bot className="size-4 text-lime-300" />
        <h3 className="font-display text-sm font-bold">AI-Escalated Tickets</h3>
        <span className="text-[10px] text-white/30">
          escalated by the support assistant · full AI conversation attached
        </span>
      </div>
      {tickets === undefined ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-lime-400" />
        </div>
      ) : safeTickets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-card p-6 text-center text-xs text-white/30">
          No AI-escalated tickets in your queue yet.
        </p>
      ) : (
        safeTickets.map((t: any) => (
          <TicketRow key={t._id} ticket={t} open={openId === t._id} onToggle={() => setOpenId(openId === t._id ? null : t._id)} />
        ))
      )}
    </div>
  );
}

function TicketRow({ ticket, open, onToggle }: { ticket: any; open: boolean; onToggle: () => void }) {
  const thread = useQuery(api.aiSupportData.getTicketThread, open ? { ticketId: ticket._id } : "skip");
  const claimTicket = useMutation(api.aiSupportData.claimTicket);
  const reply = useMutation(api.aiSupportData.teamReplyToTicket);
  const setStatus = useMutation(api.aiSupportData.updateTicketStatus);
  const reassign = useMutation(api.aiSupportData.reassignTicket);

  const [body, setBody] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [showAiHistory, setShowAiHistory] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [open, thread?.messages.length]);

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await reply({ ticketId: ticket._id, body: body.trim(), isInternalNote: isNote });
      setBody("");
      setIsNote(false);
      toast.success(isNote ? "Internal note added" : "Reply sent to user");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not send.");
    } finally {
      setSending(false);
    }
  };

  const handleStatus = async (value: string) => {
    try {
      await setStatus({ ticketId: ticket._id, status: value as any });
      toast.success(`Status updated`);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update status.");
    }
  };

  const handleReassign = async (team: string) => {
    try {
      await reassign({ ticketId: ticket._id, newTeam: team });
      toast.success("Ticket reassigned");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not reassign.");
    }
  };

  const handleClaim = async () => {
    try {
      await claimTicket({ ticketId: ticket._id });
      toast.success("Ticket claimed");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not claim.");
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-white/[0.02]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-sm font-bold text-lime-300">{ticket.ticketNumber}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge(ticket.status)}`}>
              {String(ticket.status).replace(/_/g, " ").toUpperCase()}
            </span>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] capitalize text-white/40">
              {String(ticket.category).replace(/-/g, " ")}
            </span>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/40">{ticket.userRole}</span>
          </div>
          <p className="mt-1 truncate text-sm text-white/70">{ticket.subject}</p>
          {ticket.aiSummary && <p className="mt-0.5 line-clamp-1 text-xs text-white/35">{ticket.aiSummary}</p>}
        </div>
        <ChevronDown className={`size-4 shrink-0 text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-white/10">
          {/* Actions bar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
            {!ticket.assignedTo && ticket.status === "open" && (
              <button
                type="button"
                onClick={() => void handleClaim()}
                className="rounded-lg border border-lime-400/30 px-3 py-1.5 text-xs font-medium text-lime-300 hover:bg-lime-400/10"
              >
                Claim
              </button>
            )}
            <select
              value={ticket.status}
              onChange={(e) => void handleStatus(e.target.value)}
              className="h-8 appearance-none rounded-lg border border-white/10 bg-black/30 px-2 text-xs focus:border-lime-400/40 focus:outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              value=""
              onChange={(e) => e.target.value && void handleReassign(e.target.value)}
              className="h-8 appearance-none rounded-lg border border-white/10 bg-black/30 px-2 text-xs focus:border-lime-400/40 focus:outline-none"
            >
              <option value="">Reassign to…</option>
              {REASSIGN_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {ticket.additionalDetails && (
              <span className="ml-auto max-w-full truncate text-[10px] text-white/30" title={ticket.additionalDetails}>
                Extra details: {ticket.additionalDetails}
              </span>
            )}
          </div>

          {thread === undefined ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-4 animate-spin text-lime-400" />
            </div>
          ) : (
            <>
              <div className="max-h-80 space-y-3 overflow-y-auto p-4">
                {/* AI handoff summary */}
                <div className="rounded-xl border border-lime-400/20 bg-lime-400/5 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-lime-300">
                    <Bot className="size-3" /> AI handoff summary
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-white/70">
                    {thread.ticket.aiSummary}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAiHistory((v) => !v)}
                    className="mt-2 text-xs font-medium text-lime-300/80 underline-offset-2 hover:underline"
                  >
                    {showAiHistory ? "Hide" : "Show"} full AI conversation ({thread.aiConversation.length})
                  </button>
                  {showAiHistory && (
                    <div className="mt-2 space-y-2 rounded-lg border border-dashed border-lime-400/20 bg-black/30 p-3">
                      {thread.aiConversation.map((m: any, i: number) => (
                        <p key={i} className={`whitespace-pre-wrap break-words text-xs leading-relaxed ${m.role === "user" ? "text-white/75" : "text-lime-200/60"}`}>
                          <span className="mr-1 font-semibold">{m.role === "user" ? "USER:" : "🤖 AI:"}</span>
                          {m.body}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Human thread */}
                {thread.messages.map((m: any) => (
                  <div key={m._id} className={`rounded-xl p-3 ${m.isInternalNote ? "border border-amber-400/20 bg-amber-400/5" : m.senderType === "system" ? "bg-white/[0.03]" : "bg-white/5"}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">
                        {m.senderType === "system" ? "⚙️ System" : m.senderType === "user" ? `👤 ${(m.senderName ?? "User")}` : `${(m.senderName ?? "Staff")} (Support)`}
                      </span>
                      {m.isInternalNote && <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">INTERNAL</span>}
                      <span className="text-[10px] text-white/25">{new Date(m.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/70">{m.body}</p>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              {/* Reply composer */}
              {ticket.status !== "closed" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSend();
                  }}
                  className="space-y-2 border-t border-white/10 p-3"
                >
                  <div className="flex gap-2">
                    <input
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder={isNote ? "Internal note (hidden from user)…" : "Reply to the user…"}
                      className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3.5 text-sm placeholder:text-white/25 focus:border-lime-400/40 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={sending || !body.trim()}
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-black disabled:opacity-40"
                      aria-label="Send"
                    >
                      {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    </button>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-white/50">
                    <input type="checkbox" checked={isNote} onChange={(e) => setIsNote(e.target.checked)} className="size-3.5 accent-lime-400" />
                    Add as internal note (visible only to staff)
                  </label>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Bot,
  Send,
  Loader2,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Sparkles,
  LifeBuoy,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

const QUICK_ACTIONS = [
  "I cannot access my course",
  "I have an account problem",
  "I need help with my learning",
  "I am having a technical issue",
  "I need help using the platform",
] as const;

type AiMessage = { role: "user" | "ai"; body: string; at: number };

function fmtTime(t: number) {
  return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function StudentSupport() {
  const session = useQuery(api.aiSupportData.getMyActiveSession);
  const myTickets = useQuery(api.aiSupportData.myTickets, {});
  const startSession = useMutation(api.aiSupportData.startSession);
  const resolveSession = useMutation(api.aiSupportData.resolveSession);
  const sendAi = useAction(api.aiSupport.sendAiMessage);
  const escalate = useAction(api.aiSupport.escalateToHuman);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [askedSolved, setAskedSolved] = useState(false); // show solve-check after latest AI answer
  const [showEscalateForm, setShowEscalateForm] = useState(false);
  const [extraDetails, setExtraDetails] = useState("");
  const [escalating, setEscalating] = useState(false);
  const [justResolved, setJustResolved] = useState<"helpful" | "not_helpful" | null>(null);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [session?.messages.length, sending]);

  const messages: AiMessage[] = (session?.messages ?? []) as AiMessage[];
  const safeTickets = Array.isArray(myTickets) ? myTickets : [];

  const handleSend = async (text?: string) => {
    const body = (text ?? input).trim();
    if (!body || sending) return;
    if (!session) {
      toast.error("Starting your session… try again in a moment.");
      return;
    }
    setInput("");
    setAskedSolved(false);
    setShowEscalateForm(false);
    setSending(true);
    try {
      await sendAi({ sessionId: session._id, text: body });
      setAskedSolved(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not reach the assistant. Try again.");
    } finally {
      setSending(false);
    }
  };

  const handleStartNew = async () => {
    try {
      await startSession({});
      setJustResolved(null);
      setAskedSolved(false);
      setShowEscalateForm(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not start a new conversation.");
    }
  };

  const markResolved = async (rating?: "helpful" | "not_helpful") => {
    if (!session) return;
    try {
      await resolveSession({ sessionId: session._id, rating });
      setJustResolved(rating ?? null);
      setAskedSolved(false);
      toast.success("Great! Your AI support session is marked as resolved.");
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong.");
    }
  };

  const handleEscalate = async () => {
    if (!session) return;
    setEscalating(true);
    try {
      const ticketNumber = (await escalate({
        sessionId: session._id,
        additionalDetails: extraDetails.trim() || undefined,
      })) as unknown as string;
      toast.success(`Ticket ${ticketNumber} created — our team has the full conversation.`);
      setExtraDetails("");
      setShowEscalateForm(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Escalation failed. Please try again.");
    } finally {
      setEscalating(false);
    }
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      open: "bg-amber-400/10 text-amber-300",
      assigned: "bg-blue-400/10 text-blue-300",
      in_progress: "bg-blue-400/10 text-blue-300",
      waiting_for_user: "bg-purple-400/10 text-purple-300",
      resolved: "bg-lime-400/10 text-lime-300",
      closed: "bg-white/5 text-white/40",
    };
    return map[s] ?? "bg-white/5 text-white/40";
  };

  // ------------------------------------------------------------------ render
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-lime-400/20 bg-lime-400/5 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-400/15 text-lime-300">
            <Bot className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="font-display truncate text-base font-bold">ForgeX Support Assistant</p>
            <p className="truncate text-xs text-muted-foreground">
              AI first-line support · humans join when needed
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleStartNew}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:border-lime-400/30 hover:text-lime-300"
        >
          <RefreshCw className="size-3.5" /> New chat
        </button>
      </div>

      {/* Resolved confirmation */}
      {justResolved && (
        <div className="rounded-2xl border border-lime-400/25 bg-lime-400/8 p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-lime-300" />
          <p className="font-display mt-3 text-lg font-bold">Glad we could help! 🎉</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your conversation was saved as resolved{justResolved === "helpful" ? " and rated helpful" : ""}. You can
            start a new conversation anytime.
          </p>
        </div>
      )}

      {/* Chat area */}
      {!justResolved && (
        <div className="rounded-2xl border border-white/10 bg-card">
          <div className="max-h-[52vh] min-h-[280px] space-y-3 overflow-y-auto p-4">
            {session === undefined ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-6 animate-spin text-lime-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="py-10 text-center">
                <Bot className="mx-auto size-10 text-white/20" />
                <p className="mt-3 text-sm text-muted-foreground">Starting a fresh conversation…</p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "rounded-br-sm bg-lime-400 text-black"
                        : "rounded-bl-sm border border-white/10 bg-black/20 text-white/85"
                    }`}
                  >
                    {m.role === "ai" && (
                      <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-lime-300/70">
                        🤖 AI Assistant
                      </p>
                    )}
                    {m.body}
                    <span className={`mt-1 block text-right text-[10px] ${m.role === "user" ? "text-black/50" : "text-white/25"}`}>
                      {fmtTime(m.at)}
                    </span>
                  </div>
                </div>
              ))
            )}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-lime-400" /> Assistant is thinking…
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Solve check */}
          {askedSolved && !sending && messages.length > 1 && (
            <div className="border-t border-white/10 bg-lime-400/[0.04] p-3">
              <p className="mb-2 text-center text-sm font-medium">Did this solve your problem?</p>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void markResolved("helpful")}
                  className="rounded-xl bg-lime-400 px-4 py-2 text-xs font-semibold text-black transition-colors hover:bg-lime-300"
                >
                  Yes, my problem is solved
                </button>
                <button
                  type="button"
                  onClick={() => setShowEscalateForm(true)}
                  className="rounded-xl border border-rose-400/30 px-4 py-2 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-400/10"
                >
                  No, I still need help
                </button>
              </div>
            </div>
          )}

          {/* Escalation panel */}
          {showEscalateForm && session && (
            <div className="border-t border-white/10 p-4">
              <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
                <LifeBuoy className="mt-0.5 size-4 shrink-0 text-amber-300" />
                <p className="text-xs leading-relaxed text-amber-200/80">
                  I'm sorry I couldn't fully resolve this issue. Request support from our team — they'll receive
                  everything we've already discussed, so you won't need to start over.
                </p>
              </div>
              <textarea
                value={extraDetails}
                onChange={(e) => setExtraDetails(e.target.value)}
                rows={3}
                placeholder="Add any extra details for the support team (optional)…"
                className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm placeholder:text-white/25 focus:border-lime-400/40 focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEscalateForm(false)}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-white/50 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={escalating}
                  onClick={() => void handleEscalate()}
                  className="inline-flex items-center gap-2 rounded-xl bg-lime-400 px-4 py-2 text-xs font-bold text-black transition-colors hover:bg-lime-300 disabled:opacity-50"
                >
                  {escalating ? <Loader2 className="size-4 animate-spin" /> : <HelpCircle className="size-4" />}
                  Request Human Support
                </button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-white/10 p-3">
            {!session || session.status !== "active" ? (
              <button
                type="button"
                onClick={handleStartNew}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-lime-400 text-sm font-semibold text-black hover:bg-lime-300"
              >
                <Sparkles className="size-4" /> Start a new conversation
              </button>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
                className="flex gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe your issue…"
                  maxLength={1200}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 text-sm placeholder:text-white/25 focus:border-lime-400/40 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-black transition-colors hover:bg-lime-300 disabled:opacity-40"
                  aria-label="Send message"
                >
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Quick actions */}
      {(!session || session.status === "active") && messages.length <= 1 && (
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={sending}
              onClick={() => void handleSend(q)}
              className="rounded-full border border-white/10 bg-card px-3.5 py-1.5 text-xs text-white/60 transition-colors hover:border-lime-400/30 hover:text-lime-300 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Escalated tickets */}
      {safeTickets.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-white/40">Your support tickets</p>
          {safeTickets.map((t: any) => (
            <TicketCard
              key={t._id}
              ticket={t}
              open={openTicketId === t._id}
              onToggle={() => setOpenTicketId(openTicketId === t._id ? null : t._id)}
              statusBadge={statusBadge}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ticket card with human-support thread
// ---------------------------------------------------------------------------

function TicketCard({
  ticket,
  open,
  onToggle,
  statusBadge,
}: {
  ticket: any;
  open: boolean;
  onToggle: () => void;
  statusBadge: (s: string) => string;
}) {
  const thread = useQuery(
    api.aiSupportData.getTicketThread,
    open ? { ticketId: ticket._id } : "skip",
  );
  const reply = useMutation(api.aiSupportData.replyToMyTicket);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [showAiHistory, setShowAiHistory] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [open, thread?.messages.length]);

  const handleReply = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await reply({ ticketId: ticket._id, body: body.trim() });
      setBody("");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not send your message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left hover:bg-white/[0.02]">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-sm font-bold text-lime-300">{ticket.ticketNumber}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge(ticket.status)}`}>
              {String(ticket.status).replace(/_/g, " ").toUpperCase()}
            </span>
            <span className="text-[10px] text-white/30">{ticket.category}</span>
          </div>
          <p className="mt-1 truncate text-sm text-white/70">{ticket.subject}</p>
        </div>
        <ChevronDown className={`size-4 shrink-0 text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-white/10">
          {thread === undefined ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-lime-400" />
            </div>
          ) : (
            <>
              <div className="max-h-72 space-y-3 overflow-y-auto p-4">
                {thread.ticket.aiSummary && (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">Issue summary</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/60">{thread.ticket.aiSummary}</p>
                  </div>
                )}

                {thread.messages.map((m: any) => (
                  <div key={m._id} className="flex justify-start">
                    <div className="max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-sm border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm">
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                        {m.senderType === "system" ? "⚙️ System" : `👤 ${m.senderName ?? "Human Support Team"}`}
                      </p>
                      <p className="text-white/80">{m.body}</p>
                      <span className="mt-1 block text-right text-[10px] text-white/20">{fmtTime(m.createdAt)}</span>
                    </div>
                  </div>
                ))}

                {thread.aiConversation.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAiHistory((v) => !v)}
                      className="text-xs font-medium text-lime-300/80 underline-offset-2 hover:underline"
                    >
                      {showAiHistory ? "Hide" : "Show"} full AI conversation ({thread.aiConversation.length})
                    </button>
                    {showAiHistory && (
                      <div className="mt-2 space-y-2 rounded-xl border border-dashed border-white/10 bg-black/30 p-3">
                        {thread.aiConversation.map((m: any, i: number) => (
                          <p key={i} className={`text-xs leading-relaxed ${m.role === "user" ? "text-white/70" : "text-lime-200/60"}`}>
                            <span className="mr-1 font-semibold">{m.role === "user" ? "You:" : "🤖 AI:"}</span>
                            {m.body}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {ticket.status !== "closed" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleReply();
                  }}
                  className="flex gap-2 border-t border-white/10 p-3"
                >
                  <input
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Reply to the support team…"
                    className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3.5 text-sm placeholder:text-white/25 focus:border-lime-400/40 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={sending || !body.trim()}
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-black disabled:opacity-40"
                    aria-label="Send reply"
                  >
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

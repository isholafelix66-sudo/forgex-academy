import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Bot, Loader2, Send, Sparkles, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DraggableFab } from "./DraggableFab";
import { useAuth } from "@/hooks/use-auth";

/**
 * ForgeX AI Support Assistant — floating panel used by the homepage
 * (and any public page) floating button. Reuses the existing AI support
 * backend (aiSupport / aiSupportData), so conversations land in the same
 * system the /dashboard/support page uses (admin inbox, tickets, team
 * handoff — everything keeps working).
 *
 * Guest mode: guests chat with the same assistant WITHOUT an account.
 * The AI answers general questions from the knowledge base; anything
 * account-specific gets a clear "sign-in required" notice plus a Sign In CTA.
 * If the AI can't resolve the issue, the Contact page is offered for human
 * escalation. Guests are never forced to sign in before asking questions.
 *
 * Open it from anywhere with:
 *   window.dispatchEvent(new Event(OPEN_AI_ASSISTANT_EVENT));
 */

export const OPEN_AI_ASSISTANT_EVENT = "forgex:open-ai-assistant";

/** Public helper: open the assistant from any component. */
export function openAiAssistant() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_AI_ASSISTANT_EVENT));
  }
}

type AiMessage = { role: "user" | "ai"; body: string; at: number };
type GuestMessage = { role: "user" | "ai"; body: string; accountSpecific?: boolean };

export function AiSupportAssistant() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const latest = useQuery(api.aiSupportData.getMyLatestSession);
  const startSession = useMutation(api.aiSupportData.startSession);
  const sendAi = useAction(api.aiSupport.sendAiMessage);
  const sendGuestAi = useAction(api.aiSupport.sendGuestAiMessage);
  const replyToTeam = useMutation(api.aiSupportData.replyToMyTicket);

  // Dashboard areas have their own full support pages and the chat FAB —
  // the assistant FAB lives on public pages only (panel still opens via event).
  const onDashboardArea = /^\/(?:dashboard|tutor|admin|team)(?:\/|$)/.test(pathname);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Guest-side transcript — in-memory only (no account to persist it to).
  const [guestMessages, setGuestMessages] = useState<GuestMessage[]>([]);

  // Open on the custom event (fired by floating buttons / CTAs).
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_AI_ASSISTANT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_AI_ASSISTANT_EVENT, onOpen);
  }, []);

  const session = latest ?? null;
  const messages: AiMessage[] = (session?.messages ?? []) as AiMessage[];

  // Same AI → human handoff contract as the /dashboard/support page.
  const isHumanOwned = session?.status === "escalated" && !!session?.ticket;
  const activeThreadId = isHumanOwned
    ? ((session!.ticket as { _id: string })._id as string)
    : null;
  const liveThread = useQuery(
    api.aiSupportData.getTicketThread,
    activeThreadId ? { ticketId: activeThreadId as never } : "skip",
  );

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, open, liveThread?.messages.length, guestMessages.length]);

  // ── Guest send: ask the AI directly, no sign-in required ────────────
  const handleGuestSend = async () => {
    const body = input.trim();
    if (!body || sending) return;
    setInput("");
    setGuestMessages((v) => [...v, { role: "user", body }]);
    setSending(true);
    try {
      const res = (await sendGuestAi({ text: body })) as {
        reply: string;
        accountSpecific?: boolean;
      };
      setGuestMessages((v) => [
        ...v,
        { role: "ai", body: res.reply, accountSpecific: res.accountSpecific },
      ]);
    } catch (err) {
      console.warn("[ForgeX] Guest AI assistant error:", err);
      setGuestMessages((v) => [
        ...v,
        {
          role: "ai",
          body:
            "Sorry — I couldn't process that right now. Please try again, or reach the team through the Contact page.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  // ── Authenticated send (unchanged contract) ─────────────────────────
  const handleSend = async () => {
    const body = input.trim();
    if (!body || sending) return;
    setInput("");
    setSending(true);
    try {
      const sid = session?._id ?? ((await startSession({})) as unknown as string);
      if (isHumanOwned && activeThreadId) {
        await replyToTeam({ ticketId: activeThreadId as never, body });
      } else if (sid) {
        await sendAi({ sessionId: sid as never, text: body });
      }
    } catch (err) {
      console.warn("[ForgeX] AI assistant error:", err);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = () => {
    if (isAuthenticated) void handleSend();
    else void handleGuestSend();
  };

  // Merge the persisted conversation with the human-team thread when the
  // session has been escalated, mirroring the dashboard support page.
  const teamMessages = isHumanOwned
    ? ((liveThread?.messages ?? []) as unknown as Array<{
        body: string;
        createdAt: number;
        senderType?: string;
      }>)
    : [];
  const transcript: Array<AiMessage & { team?: boolean }> = isHumanOwned
    ? [
        ...messages,
        ...teamMessages.map((m) => ({
          role: m.senderType === "user" ? ("user" as const) : ("ai" as const),
          body: m.body,
          at: m.createdAt,
          team: true,
        })),
      ].sort((a, b) => a.at - b.at)
    : messages;

  const showEscalation = isAuthenticated
    ? transcript.length >= 2
    : guestMessages.length >= 2;

  const goToSignIn = (mode: "signin" | "signup") => {
    setOpen(false);
    navigate(`/auth?mode=${mode}`);
  };

  return (
    <>
      {/* Draggable floating button — sits safely above the mobile bottom nav.
          Hidden inside dashboard areas so it never collides with the chat FAB. */}
      {!open && !onDashboardArea && (
        <DraggableFab
          onClick={() => setOpen(true)}
          title="Open the ForgeX AI Support Assistant"
          ariaLabel="Open the ForgeX AI Support Assistant"
          className="fixed z-50 flex size-14 items-center justify-center rounded-full border border-lime-400/40 bg-[#11150f] text-lime-300 shadow-xl shadow-lime-400/15 transition-[transform] hover:scale-105 hover:text-lime-200 active:scale-95 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-4 md:bottom-6 md:right-5"
        >
          <Sparkles className="size-6" />
        </DraggableFab>
      )}

      {/* Panel */}
      {open && (
        <div
          className="fixed z-[60] flex h-[min(560px,calc(100dvh-9rem))] w-[calc(100vw-2rem)] max-w-[380px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-card shadow-2xl shadow-black/50 bottom-[calc(6.5rem+env(safe-area-inset-bottom,0px))] right-4 md:bottom-24 md:right-6"
          role="dialog"
          aria-label="ForgeX AI Support Assistant"
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-white/10 bg-gradient-to-r from-lime-400/15 to-transparent px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-lime-400/15 text-lime-300">
              <Bot className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">ForgeX AI Support</p>
              <p className="text-[11px] text-muted-foreground">
                {isAuthenticated
                  ? "Ask anything about the platform"
                  : "Ask anything — no account needed"}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/10"
              aria-label="Close assistant"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Transcript */}
          <div ref={scrollRef} className="bg-grid flex-1 space-y-2.5 overflow-y-auto p-4">
            {/* ── GUEST VIEW ─────────────────────────────────────────── */}
            {!isAuthenticated && guestMessages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <Bot className="size-8 text-lime-300/60" />
                <p className="text-sm font-medium">Hi there 👋 How can we help?</p>
                <p className="max-w-[260px] text-xs leading-relaxed text-muted-foreground">
                  Ask me anything about ForgeX Academy — courses, roadmaps,
                  certificates, becoming a tutor. No sign-in needed.
                </p>
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  {[
                    "How do certificates work?",
                    "Is ForgeX free to start?",
                    "How do I become a tutor?",
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setInput(q);
                        inputRef.current?.focus();
                      }}
                      className="rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1 text-[11px] font-medium text-lime-300 transition-colors hover:bg-lime-400/20"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {guestMessages.map((m, i) => (
              <div
                key={`g-${i}`}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div className="max-w-[85%] space-y-2">
                  <div
                    className={cn(
                      "whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                      m.role === "user"
                        ? "rounded-br-sm bg-lime-400 text-black"
                        : "rounded-bl-sm border border-white/10 bg-white/5 text-foreground",
                    )}
                  >
                    {m.body}
                  </div>
                  {/* Account-specific AI reply → Sign In / Get Started CTA */}
                  {m.role === "ai" && m.accountSpecific && (
                    <div className="rounded-2xl border border-lime-400/25 bg-lime-400/8 p-3">
                      <p className="text-xs leading-relaxed text-foreground/90">
                        That part needs an account — sign in or create a free one
                        and we can help with your courses, progress and certificates.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => goToSignIn("signin")}
                          className="flex-1 rounded-lg bg-lime-400 px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-lime-300"
                        >
                          Sign in
                        </button>
                        <button
                          type="button"
                          onClick={() => goToSignIn("signup")}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-lime-400/40 px-3 py-1.5 text-xs font-semibold text-lime-300 transition-colors hover:bg-lime-400/15"
                        >
                          <UserPlus className="size-3" /> Get started
                        </button>
                      </div>
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        You can keep asking general questions without an account.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* ── AUTHENTICATED VIEW ─────────────────────────────────── */}
            {isAuthenticated && transcript.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <Bot className="size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">Hi there 👋</p>
                <p className="max-w-[240px] text-xs text-muted-foreground">
                  I&rsquo;m the ForgeX AI Support Assistant. Ask me about
                  courses, certificates, your account or anything else.
                </p>
              </div>
            )}
            {isAuthenticated &&
              transcript.map((m, i) => (
                <div
                  key={`${m.at}-${i}`}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                      m.role === "user"
                        ? "rounded-br-sm bg-lime-400 text-black"
                        : "rounded-bl-sm border border-white/10 bg-white/5 text-foreground",
                    )}
                  >
                    {m.body}
                  </div>
                </div>
              ))}

            {/* Escalation bar — appears once the conversation has substance */}
            {showEscalation && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-muted-foreground">
                  {isAuthenticated
                    ? "Didn't find your answer? Our team can pick up where the AI left off."
                    : "Didn't find your answer? The human support team is one message away."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    navigate(isAuthenticated ? "/dashboard/support" : "/contact");
                  }}
                  className="mt-2 w-full rounded-lg border border-lime-400/30 bg-lime-400/10 px-3 py-1.5 text-xs font-semibold text-lime-300 transition-colors hover:bg-lime-400/15"
                >
                  {isAuthenticated ? "Request human support" : "Contact the team"}
                </button>
              </div>
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-foreground/80">
                  <Loader2 className="size-3.5 animate-spin" />
                  Thinking…
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-white/10 p-3">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isAuthenticated ? "Type your question…" : "Ask anything…"}
                className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-lime-400/40"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-400 text-black transition-colors hover:bg-lime-300 disabled:opacity-40"
                aria-label="Send"
              >
                {sending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </form>
            {!isAuthenticated && (
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                Guests can ask anything — sign in for account-specific help.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

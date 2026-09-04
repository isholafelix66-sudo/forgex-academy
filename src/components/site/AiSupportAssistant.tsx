import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Bot, Loader2, Send, Sparkles, X } from "lucide-react";
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
 * Open it from anywhere with:
 *   window.dispatchEvent(new Event(OPEN_AI_ASSISTANT_EVENT));
 */

export const OPEN_AI_ASSISTANT_EVENT = "forgex:open-ai-assistant";

type AiMessage = { role: "user" | "ai"; body: string; at: number };

export function openAiAssistant() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_AI_ASSISTANT_EVENT));
  }
}

export function AiSupportAssistant() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const latest = useQuery(api.aiSupportData.getMyLatestSession);
  const startSession = useMutation(api.aiSupportData.startSession);
  const sendAi = useAction(api.aiSupport.sendAiMessage);
  const replyToTeam = useMutation(api.aiSupportData.replyToMyTicket);

  // Dashboard areas have their own full support pages and the chat FAB —
  // the assistant FAB lives on public pages only (panel still opens via event).
  const onDashboardArea = /^\/(?:dashboard|tutor|admin|team)(?:\/|$)/.test(pathname);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
  }, [messages.length, open, liveThread?.messages.length]);

  const handleSend = async () => {
    const body = input.trim();
    if (!body || sending) return;
    if (!isAuthenticated) {
      // Guests: send them to sign-in first (same page, preserving intent).
      navigate(`/auth?mode=signin&returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
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
                Ask anything about the platform
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
            {!isAuthenticated && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <Bot className="size-8 text-lime-300/60" />
                <p className="text-sm font-medium">Sign in to chat with support</p>
                <p className="max-w-[250px] text-xs text-muted-foreground">
                  Create a free ForgeX account and the AI Support Assistant is
                  all yours — course help, certificates, account questions and
                  more.
                </p>
              </div>
            )}
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
            {transcript.map((m, i) => (
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
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-muted-foreground">
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
                void handleSend();
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isAuthenticated ? "Type your question…" : "Sign in to start chatting…"}
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
          </div>
        </div>
      )}
    </>
  );
}

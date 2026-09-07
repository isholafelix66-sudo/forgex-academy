import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Bot, Loader2, Send, Sparkles, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DraggableFab } from "./DraggableFab";
import { useAuth } from "@/hooks/use-auth";

/** ForgeX AI Support Assistant — floating panel used by the homepage
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

type AiMessage = { role: "user" | "ai"; body: string };  const GuestMessage = { role: "user" | "ai"; body: string };

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

  useEffect(() => {
    const existing = sessionStorage.getItem("forgex-ai-guest-messages");
    if (existing && isAuthenticated === false) {
      try {
        const parsed = JSON.parse(existing) as GuestMessage[];
        if (Array.isArray(parsed)) setGuestMessages(parsed);
      } catch {}
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (open) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && document.activeElement === inputRef.current) {
        handleSend();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, input, sending]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest("[data-ai-assistant-root]") && !target.closest("[data-ai-assistant-panel]")) {
        setOpen(false);
      }
    };
    if (open) {
      window.addEventListener("mousedown", onOutside);
      window.addEventListener("touchstart", onOutside, { passive: true });
      return () => {
        window.removeEventListener("mousedown", onOutside);
        window.removeEventListener("touchstart", onOutside);
      };
    }
  }, [open]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === OPEN_AI_ASSISTANT_EVENT) setOpen(true);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const close = () => {
    setOpen(false);
    if (inputRef.current) inputRef.current.blur();
  };

  const startNewChat = () => {
    setGuestMessages([]);
    sessionStorage.removeItem("forgex-ai-guest-messages");
    setInput("");
    setSending(false);
    void startSession().then((session) => {
      if (!session?._id && !isAuthenticated) {
        setGuestMessages([
          {
            role: "ai",
            body: "Welcome to the ForgeX AI Support Assistant. Ask me about courses, tutoring, certificates, scholarships, placements or anything related to the Academy. I can also help you find the right page.",
          },
        ]);
        persistGuestMessages();
      }
    });
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const userLine: GuestMessage = { role: "user", body: text };
    setGuestMessages((prev) => {
      const next = [...prev, userLine];
      persistGuestMessages(next);
      return next;
    });
    setInput("");
    setSending(true);

    if (!isAuthenticated) {
      void handleGuestSend(userLine);
    } else {
      void handleAiSend(userLine);
    }

    const handleAiSendWrapped = async (userLine: AiMessage) => {
      try {
        const reply = await sendAi({
          text: userLine.body,
          sessionId: latest?._id,
        });
        const replyBody = reply.reply ?? "";
        setGuestMessages((prev) => [...prev, { role: "ai", body: replyBody }]);
      } catch (err) {
        console.error("[AiSupport] sendAi failed", err);
      setGuestMessages((prev) => [
        ...prev,
        {
          role: "ai",
          body: "I’m having trouble reaching the assistant right now. Please try again in a moment, or use the Contact page for human help.",
        } as GuestMessage,
      ]);
      }
      setSending(false);
    };
  };

  const persistGuestMessages = (messages?: GuestMessage[]) => {
    try {
      sessionStorage.setItem(
        "forgex-ai-guest-messages",
        JSON.stringify(messages ?? guestMessages),
      );
    } catch {}
  };

  const handleGuestSend = (userLine: GuestMessage) => {
    setGuestMessages((prev) => {
      const next = [
        ...prev,
        {
          role: "ai",
          body: "Sign in to get responses tied to your account and your learning progress.",
        } as GuestMessage,
        {
          role: "ai",
          body:
            "You can always ask general questions as a guest, but signing in unlocks account-aware help, course progress context, and the ability to escalate to a human via the Contact page.",
        } as GuestMessage,
      ];
      persistGuestMessages(next);
      return next;
    });
    setSending(false);
  };

  const handleAiSend = async (userLine: AiMessage) => {
    try {
      const reply = await sendAi({
        text: userLine.body,
        sessionId: latest!._id,
      });
      const replyBody: string = (reply as any).reply ?? "";
      setGuestMessages((prev) => [...prev, { role: "ai", body: replyBody } as GuestMessage]);
    } catch (err) {
      console.error("[AiSupport] sendAi failed", err);
      setGuestMessages((prev) => [
        ...prev,
        {
          role: "ai",
          body: "I’m having trouble reaching the assistant right now. Please try again in a moment, or use the Contact page for human help.",
        } as GuestMessage,
      ]);
    }
    setSending(false);
  };

  const messagesFromLatest = (() => {
    if (!latest?._id) return undefined;
    const session = latest;
    if (!Array.isArray(session?.messages)) return undefined;
    return session.messages as AiMessage[] | undefined;
  })();

  const visibleMessages = isAuthenticated
    ? messagesFromLatest?.map((m) => ({ role: m.role, body: m.body })) ?? []
    : guestMessages;

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
          data-ai-assistant-root
        >
          {/* Header */}
          <div
            className="flex items-center justify-between border-b border-white/10 px-3 py-3"
            data-ai-assistant-panel
          >
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300 ring-1 ring-lime-400/20">
                <Sparkles className="size-4" />
              </div>
              <span className="font-display text-sm font-bold">AI Support</span>
            </div>
            <div className="flex items-center gap-1.5">
              {isAuthenticated ? (
                <button
                  onClick={startNewChat}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                >
                  <Bot className="size-3.5" />
                  New chat
                </button>
              ) : (
                <span className="text-[11px] text-muted-foreground">Guest mode</span>
              )}
              <button
                onClick={close}
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                aria-label="Close assistant"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
            data-ai-assistant-panel
          >
            {visibleMessages.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                Ask about courses, tutoring, certificates, scholarships, placements or anything else about the Academy.
              </p>
            ) : (
              visibleMessages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[88%] rounded-2xl px-3 py-2.5 text-[13px] leading-relaxed",
                    msg.role === "user"
                      ? "ml-auto bg-lime-400/10 text-foreground border border-lime-400/20"
                      : "bg-white/5 text-foreground",
                  )}
                >
                  {msg.body}
                </div>
              ))
            )}
            {sending && (
              <div className="rounded-2xl bg-white/5 px-3 py-2.5 text-[13px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin text-lime-300" />
                  Thinking…
                </span>
              </div>
            )}
          </div>

          {/* Composer */}
          <div
            className="flex items-center gap-2 border-t border-white/10 px-3 py-3"
            data-ai-assistant-panel
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !sending) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                isAuthenticated
                  ? "Ask the ForgeX assistant…"
                  : "Ask as a guest…"
              }
              className="h-9 flex-1 bg-white/5 outline-none ring-1 ring-white/10 text-sm text-foreground placeholder:text-white/30 sm:text-base"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm transition-colors",
                sending || !input.trim()
                  ? "border-white/10 bg-white/5 text-muted-foreground"
                  : "border-lime-400/40 bg-lime-400/10 text-lime-300 hover:bg-lime-400/20 hover:text-lime-200",
              )}
              aria-label={sending ? "Sending…" : "Send message"}
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </button>
          </div>

          {/* Guest note */}
          {!isAuthenticated && (
            <div className="border-t border-white/10 px-3 py-2 text-[11px] text-muted-foreground">
              You’re chatting as a guest. Sign in for account-aware help, or{" "}
              <button
                onClick={() => {
                  close();
                  navigate("/auth?mode=signin");
                }}
                className="underline hover:text-foreground"
              >
                sign in
              </button>{" "}
              to continue.
            </div>
          )}
        </div>
      )}
    </>
  );
}

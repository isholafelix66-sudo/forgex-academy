import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Bot, Loader2, Send, Sparkles, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/errors";
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

type AiMessage = { role: "user" | "ai"; body: string };
type GuestMessage = { role: "user" | "ai"; body: string };

/** Stable per-browser id so the guest rate limit is per-visitor. */
function guestClientId(): string {
  if (typeof window === "undefined") return "anonymous";
  try {
    const existing = sessionStorage.getItem("forgex-ai-guest-id");
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem("forgex-ai-guest-id", id);
    return id;
  } catch {
    return "anonymous";
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
  // Only shown when the AI said the question needs an account — guests are
  // never nagged to sign in while asking general questions.
  const [showSignInCta, setShowSignInCta] = useState(false);
  // Created once per browser session (lazy initializer → no effect on render).
  const [guestId] = useState(guestClientId);

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
    const onOutside = (e: MouseEvent | TouchEvent) => {
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
    setShowSignInCta(false);
    sessionStorage.removeItem("forgex-ai-guest-messages");
    setInput("");
    setSending(false);
    const greeting: GuestMessage = {
      role: "ai",
      body: "Welcome to the ForgeX Support Assistant. Ask me about your portfolio, publishing, visibility, your account, or anything else on Projects. I can also help you find the right page.",
    };
    setGuestMessages([greeting]);
    persistGuestMessages([greeting]);
    if (isAuthenticated) void startSession();
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const prior = guestMessages;
    const userLine: GuestMessage = { role: "user", body: text };
    const next = [...prior, userLine];
    setGuestMessages(next);
    persistGuestMessages(next);
    setInput("");
    setSending(true);

    if (!isAuthenticated) {
      await handleGuestSend(userLine, prior);
    } else {
      await handleAiSend(userLine);
    }
  };

  const persistGuestMessages = (messages?: GuestMessage[]) => {
    try {
      sessionStorage.setItem(
        "forgex-ai-guest-messages",
        JSON.stringify(messages ?? guestMessages),
      );
    } catch {}
  };

  /**
   * Guest chat — actually answers from the assistant, no account required.
   * Prior turns are sent along so follow-up questions keep their context.
   * The Sign In CTA only appears when the AI flags the question as
   * account-specific; general questions are answered fully either way.
   */
  const handleGuestSend = async (userLine: GuestMessage, prior: GuestMessage[]) => {
    const append = (msg: GuestMessage) => {
      setGuestMessages((prev) => {
        const merged = [...prev, msg];
        persistGuestMessages(merged);
        return merged;
      });
    };
    try {
      const history = prior
        .filter((m) => m.body?.trim())
        .slice(-6)
        .map((m) => ({ role: m.role, body: m.body.slice(0, 600) }));
      const res = (await sendGuestAi({ text: userLine.body, history, clientId: guestId })) as {
        reply?: string;
        accountSpecific?: boolean;
      };
      const reply = res?.reply?.trim();
      append({
        role: "ai",
        body:
          reply ||
          "I couldn't put together an answer for that. Please try rephrasing, or use the Contact page to reach the human support team.",
      });
      setShowSignInCta(!!res?.accountSpecific);
    } catch (err) {
      console.error("[AiSupport] sendGuestAi failed", err);
      // friendlyError keeps the app's own messages (e.g. the per-visitor rate
      // limit) while hiding backend internals.
      append({
        role: "ai",
        body: friendlyError(
          err,
          "I’m having trouble reaching the assistant right now. Please try again in a moment, or use the Contact page for human help.",
        ),
      });
    } finally {
      setSending(false);
    }
  };

  const handleAiSend = async (userLine: AiMessage) => {
    // Fallback: the session query may still be loading. Never let the send
    // button get stuck — tell the user and release the composer.
    const sessionId = latest?._id;
    if (!sessionId) {
      setGuestMessages((prev) => [
        ...prev,
        {
          role: "ai",
          body: "One moment — I'm setting up your session. Please send that again in a second.",
        } as GuestMessage,
      ]);
      setSending(false);
      return;
    }
    try {
      const reply = await sendAi({
        text: userLine.body,
        sessionId,
      });
      const replyBody: string = (reply as any).reply ?? "";
      setGuestMessages((prev) => [...prev, { role: "ai", body: replyBody } as GuestMessage]);
      setShowSignInCta(false);
    } catch (err) {
      console.error("[AiSupport] sendAi failed", err);
      setGuestMessages((prev) => [
        ...prev,
        {
          role: "ai",
          body: friendlyError(
            err,
            "I’m having trouble reaching the assistant right now. Please try again in a moment, or use the Contact page for human help.",
          ),
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

  // Keep the newest message in view on every device. Without this the panel
  // showed the transcript from the top and you had to scroll down to read the
  // latest reply. We pin to the bottom whenever messages change, the assistant
  // starts/finishes thinking, or the panel is reopened.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [visibleMessages.length, sending, open]);

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
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3"
            data-ai-assistant-panel
          >
            {visibleMessages.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                Ask about your portfolio, projects, skills, publishing, visibility or your account.
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

          {/* Sign In CTA — ONLY when the AI flagged the question as
              account-specific. General guest questions are answered without
              ever asking anyone to sign in. */}
          {!isAuthenticated && showSignInCta && (
            <div className="flex items-center justify-between gap-2 border-t border-lime-400/20 bg-lime-400/[0.06] px-3 py-2">
              <span className="text-[11px] text-lime-200/90">
                That part needs an account.
              </span>
              <button
                onClick={() => {
                  close();
                  navigate("/auth?mode=signin");
                }}
                className="flex items-center gap-1 rounded-lg border border-lime-400/40 bg-lime-400/10 px-2.5 py-1 text-[11px] font-semibold text-lime-200 transition-colors hover:bg-lime-400/20"
              >
                <UserPlus className="size-3.5" /> Sign in
              </button>
            </div>
          )}

          {/* Guest footer — informational only, never a gate. */}
          {!isAuthenticated && (
            <div className="border-t border-white/10 px-3 py-2 text-[11px] text-muted-foreground">
              You’re chatting as a guest. General questions are answered here —{" "}
              <Link to="/contact" className="underline hover:text-foreground">
                Contact us
              </Link>{" "}
              to reach the human team.
            </div>
          )}
        </div>
      )}
    </>
  );
}

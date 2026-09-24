import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  Check,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/errors";
import { getPortfolioUserToken } from "@/lib/portfolio-user-session";

/* ═══════════════════════════════════════════════════════════════════════════
   /help — Portfolio “Get help / report an issue”.

   Anyone can send a request: visitors, creators, no account needed. Every
   request goes to the Portfolio admin portal's Help desk, where it can be
   replied to and resolved; the reply is emailed back to the sender.
   ═══════════════════════════════════════════════════════════════════════════ */

const TOPICS = [
  { value: "bug", label: "Something is broken", hint: "Errors, broken pages, uploads failing" },
  { value: "account", label: "Sign-in / account", hint: "OTP codes, access, profile" },
  { value: "portfolio", label: "My portfolio", hint: "Editing, publishing, sharing, messages" },
  { value: "billing", label: "Billing", hint: "Payments or invoices" },
  { value: "other", label: "Something else", hint: "Anything not covered above" },
] as const;

type Topic = (typeof TOPICS)[number]["value"];

export default function Help() {
  const submit = useMutation(api.portfolioHelp.submit);
  // Signed-in creators get their details prefilled; guests simply type them.
  const creatorToken = getPortfolioUserToken();
  const session = useQuery(
    api.portfolioUsers.validateSession,
    creatorToken ? { token: creatorToken } : "skip",
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<Topic>("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!session) return;
    setName((prev) => prev || session.name || "");
    setEmail((prev) => prev || session.email);
  }, [session]);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await submit({
        name,
        email,
        topic,
        subject,
        message,
        pageUrl: typeof window !== "undefined" ? window.location.pathname : undefined,
        creatorToken: creatorToken ?? undefined,
      });
      setSent(true);
      toast.success("Sent — we'll reply by email.");
    } catch (err) {
      setError(friendlyError(err, "We couldn't send that. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-[320px] max-w-2xl rounded-full bg-lime-400/8 blur-[120px]"
      />

      <section className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to the website
        </Link>

        <div className="mt-8 flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-lime-400/12 text-lime-300">
            <LifeBuoy className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-4xl">
              Get help
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Report a problem or ask us anything about your portfolio. No account
              needed — we reply to the email you give us, usually within one
              working day.
            </p>
          </div>
        </div>

        {sent ? (
          <div className="mt-8 rounded-3xl border border-lime-400/25 bg-lime-400/5 p-6 sm:p-8">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
              <Check className="size-5" />
            </span>
            <h2 className="font-display mt-4 text-xl font-bold">Your request is in</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              We sent a confirmation to <strong>{email}</strong>. The Portfolio team
              has it in the help desk and will reply to that address — replying to
              our email keeps the whole conversation together.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => {
                  setSent(false);
                  setSubject("");
                  setMessage("");
                }}
                variant="outline"
                className="h-11 gap-2 border-white/15"
              >
                <MessageSquare className="size-4" /> Send another request
              </Button>
              <Link to="/" className="sm:w-auto">
                <Button className="h-11 w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300 sm:w-auto">
                  Back to the website
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-white/10 bg-card p-5 sm:p-7">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="help-name" className="text-xs">
                  Your name
                </Label>
                <Input
                  id="help-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                  className="mt-1.5 h-11 border-white/10 bg-black/20"
                />
              </div>
              <div>
                <Label htmlFor="help-email" className="text-xs">
                  Email we should reply to
                </Label>
                <Input
                  id="help-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  className="mt-1.5 h-11 border-white/10 bg-black/20"
                />
              </div>
            </div>

            <div className="mt-5">
              <Label className="text-xs">What's this about?</Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {TOPICS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTopic(t.value)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      topic === t.value
                        ? "border-lime-400/50 bg-lime-400/10"
                        : "border-white/10 bg-black/20 hover:border-white/20",
                    )}
                  >
                    <span
                      className={cn(
                        "block text-sm font-semibold",
                        topic === t.value && "text-lime-300",
                      )}
                    >
                      {t.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                      {t.hint}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <Label htmlFor="help-subject" className="text-xs">
                Subject
              </Label>
              <Input
                id="help-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Uploads fail on my project page"
                className="mt-1.5 h-11 border-white/10 bg-black/20"
              />
            </div>

            <div className="mt-4">
              <Label htmlFor="help-message" className="text-xs">
                Tell us what happened
              </Label>
              <Textarea
                id="help-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder="What were you doing, what did you expect, and what happened instead?"
                className="mt-1.5 border-white/10 bg-black/20"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Screenshots help — you can also send them by replying to our email.
              </p>
            </div>

            {error && (
              <p className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/8 p-3 text-xs text-rose-300">
                {error}
              </p>
            )}

            <Button
              onClick={() => void send()}
              disabled={busy || !name.trim() || !email.trim() || subject.trim().length < 3 || message.trim().length < 10}
              className="mt-6 h-11 w-full gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300 sm:w-auto"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {busy ? "Sending…" : "Send request"}
            </Button>
          </div>
        )}

        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground sm:text-left">
          Prefer email? Write to the address in the footer — the same team answers both.
        </p>
      </section>
    </div>
  );
}

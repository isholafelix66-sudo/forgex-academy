import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  Bug,
  CheckCircle2,
  Flag,
  Inbox,
  LifeBuoy,
  Loader2,
  MessageSquareText,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dash/PageHeader";
import { EmptyState } from "@/components/site/EmptyState";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "bug", label: "Bug / something's broken", icon: <Bug className="size-3.5" /> },
  { value: "feature", label: "Feature request", icon: <MessageSquareText className="size-3.5" /> },
  { value: "account", label: "Account / payments", icon: <ShieldCheck className="size-3.5" /> },
  { value: "content", label: "Content / course help", icon: <Flag className="size-3.5" /> },
  { value: "other", label: "Something else", icon: <Inbox className="size-3.5" /> },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

const STATUS_STYLE: Record<string, string> = {
  open: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  responded: "border-lime-400/25 bg-lime-400/10 text-lime-300",
  resolved: "border-white/15 bg-white/5 text-muted-foreground",
};

export default function TutorSupport() {
  const messages = useQuery(api.tutorSupport.mySupportMessages);
  const submit = useMutation(api.tutorSupport.submitSupportMessage);
  const [category, setCategory] = useState<Category>("bug");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const canSend = subject.trim().length > 0 && body.trim().length > 0;

  const send = async () => {
    if (!canSend || busy) return;
    setBusy(true);
    try {
      await submit({ category, subject: subject.trim(), body: body.trim() });
      toast.success("Sent — the admin team will get back to you here.");
      setSubject("");
      setBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send your message.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Report an issue"
        description="Something not working? Need help with your account or courses? Send a message straight to the ForgeX admin team (the Developer) — replies land here."
      />

      {/* Compose */}
      <section className="rounded-2xl border border-white/10 bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
            <LifeBuoy className="size-4" />
          </span>
          <h2 className="font-display text-base font-semibold">Message the admin team</h2>
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          What's this about?
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors",
                category === c.value
                  ? "border-lime-400/40 bg-lime-400/12 text-lime-300"
                  : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground",
              )}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Short subject — e.g. “Video not loading on Module 3”"
            className="h-11 border-white/10 bg-black/20"
            maxLength={200}
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Describe what happened, what you expected, and any steps to reproduce (or just say hi 👋)."
            className="min-h-32 border-white/10 bg-black/20"
            maxLength={5000}
          />
          <div className="flex justify-end">
            <Button
              onClick={() => void send()}
              disabled={!canSend || busy}
              className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send to admin
            </Button>
          </div>
        </div>
      </section>

      {/* History */}
      <section className="rounded-2xl border border-white/10 bg-card">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="font-display text-base font-semibold">Your messages</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Keep an eye here for replies from the admin team.
          </p>
        </div>
        {messages === undefined ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl border border-white/8 bg-black/20" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<LifeBuoy className="size-6" />}
              title="No messages yet"
              description="When you report an issue or message the admin, it shows up here with its status and any reply."
            />
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {messages.map((m) => (
              <div key={m._id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{m.subject}</span>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize",
                      STATUS_STYLE[m.status],
                    )}
                  >
                    {m.status}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {timeAgo(m.createdAt)}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">{m.body}</p>
                {m.adminNote && (
                  <div className="mt-3 rounded-xl border border-lime-400/20 bg-lime-400/8 px-4 py-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-lime-300">
                      <CheckCircle2 className="size-3.5" /> Admin reply
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">{m.adminNote}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

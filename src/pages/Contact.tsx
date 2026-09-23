import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Send,
} from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { toExternalHref } from "@/lib/url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useBranding } from "@/lib/branding";

const SOCIAL_ICONS: Record<string, string> = {
  facebook: "f",
  instagram: "ig",
  x: "𝕏",
  linkedin: "in",
  youtube: "▶",
  tiktok: "♫",
  whatsapp: "wa",
  telegram: "✈",
};

export default function Contact() {
  const branding = useBranding();
  const content = useQuery(api.public.siteContentAll);
  const { user } = useAuth();
  const contact = (content?.contact as
    | { email?: string; phone?: string; address?: string }
    | undefined) || {};
  const socials = (content?.socials ?? []) as Array<{
    platform: string;
    url: string;
    enabled?: boolean;
    order?: number;
  }>;
  const visibleSocials = socials
    .filter((s) => s.enabled !== false && s.url)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const submit = useMutation(api.contact.submitContact);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentVia, setSentVia] = useState<"chat" | "inbox" | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !body.trim()) {
      setError("Please fill in your name, email and message.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = await submit({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        body: body.trim(),
      });
      setSentVia(result.via);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't send your message. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setSentVia(null);
    setSubject("");
    setBody("");
    setError(null);
  };

  return (
    <PageShell>
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6">
        <Reveal className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/25 bg-lime-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-lime-300">
            Contact
          </span>
          <h1 className="font-display mt-6 text-5xl font-bold tracking-tight sm:text-6xl">
            We'd love to <span className="text-gradient">hear from you</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            Questions about your portfolio, publishing, visibility or the ForgeX
            Network? Reach out — the {branding.name} team responds quickly.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-8 lg:grid-cols-5">
          {/* Contact details */}
          <div className="space-y-4 lg:col-span-2">
            {contact.email && (
              <Reveal>
                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-card p-5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                    <Mail className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Email</p>
                    <p className="truncate text-sm font-medium">{contact.email}</p>
                  </div>
                </div>
              </Reveal>
            )}
            {contact.phone && (
              <Reveal delay={0.05}>
                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-card p-5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                    <Phone className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium">{contact.phone}</p>
                  </div>
                </div>
              </Reveal>
            )}
            {contact.address && (
              <Reveal delay={0.1}>
                <div className="flex items-start gap-4 rounded-2xl border border-white/10 bg-card p-5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                    <MapPin className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Address</p>
                    <p className="text-sm font-medium">{contact.address}</p>
                  </div>
                </div>
              </Reveal>
            )}

            {visibleSocials.length > 0 && (
              <Reveal delay={0.15}>
                <div className="rounded-2xl border border-white/10 bg-card p-5">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Follow us</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {visibleSocials.map((s) => (
                      <a
                        key={s.platform}
                        href={toExternalHref(s.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={s.platform}
                        className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-muted-foreground transition-colors hover:border-lime-400/40 hover:text-lime-300"
                      >
                        {SOCIAL_ICONS[s.platform] ?? s.platform.slice(0, 2)}
                      </a>
                    ))}
                  </div>
                </div>
              </Reveal>
            )}
          </div>

          {/* Message form — delivered straight to the ForgeX team inbox */}
          <Reveal className="lg:col-span-3" delay={0.05}>
            {sentVia ? (
              <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-lime-400/25 bg-lime-400/8 p-10 text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
                  <CheckCircle2 className="size-7" />
                </span>
                <h2 className="font-display mt-5 text-2xl font-bold">
                  Message sent!
                </h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  {sentVia === "chat"
                    ? "Thanks — the ForgeX team has received your message. Watch your chat inbox (bottom-right) for the reply."
                    : "Thanks — your message is in the ForgeX team's inbox. We'll reply by email as soon as possible."}
                </p>
                <Button
                  variant="outline"
                  onClick={reset}
                  className="mt-6 border-white/15 hover:border-lime-400/40 hover:text-lime-300"
                >
                  Send another message
                </Button>
              </div>
            ) : (
              <form
                onSubmit={(e) => void handleSubmit(e)}
                className="rounded-3xl border border-white/10 bg-card p-6 sm:p-8"
              >
                <h2 className="font-display text-xl font-bold">Send a message</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Delivered straight to the ForgeX team's inbox — no email app
                  needed{user?._id ? ", and we can reply right here in your chat." : "."}
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Your name</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                      className="border-white/10 bg-black/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Your email</label>
                    <Input
                      value={email}
                      type="email"
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="border-white/10 bg-black/20"
                    />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <label className="text-sm font-medium">Subject</label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="How can we help?"
                    className="border-white/10 bg-black/20"
                  />
                </div>
                <div className="mt-4 space-y-2">
                  <label className="text-sm font-medium">Message</label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={6}
                    required
                    placeholder="Write your message…"
                    className="border-white/10 bg-black/20"
                  />
                </div>
                {error && (
                  <p className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/8 p-3 text-sm text-rose-300">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={sending}
                  className="mt-6 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {sending ? "Sending…" : "Send message"}
                </Button>
              </form>
            )}
          </Reveal>
        </div>
      </section>
    </PageShell>
  );
}

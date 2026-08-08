import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import { PageShell } from "@/components/site/PageShell";
import { Reveal } from "@/components/site/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
  const content = useQuery(api.public.siteContentAll);
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
            Questions about courses, tutor applications, certificates or the
            ForgeX Network? Reach out — the Academy team responds quickly.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-8 lg:grid-cols-5">
          {/* Contact details */}
          <div className="space-y-4 lg:col-span-2">
            {contact.email && (
              <Reveal>
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-card p-5 transition-colors hover:border-lime-400/30"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                    <Mail className="size-5" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{contact.email}</p>
                  </div>
                </a>
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
                        href={s.url}
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

          {/* Message form (mailto fallback — no backend needed) */}
          <Reveal className="lg:col-span-3" delay={0.05}>
            <form
              className="rounded-3xl border border-white/10 bg-card p-6 sm:p-8"
              action={
                contact.email
                  ? `mailto:${contact.email}`
                  : undefined
              }
              method="post"
              encType="text/plain"
            >
              <h2 className="font-display text-xl font-bold">Send a message</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This opens your email app addressed to the Academy.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Your name</label>
                  <Input name="name" required placeholder="Full name" className="border-white/10 bg-black/20" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Your email</label>
                  <Input name="email" type="email" required placeholder="you@example.com" className="border-white/10 bg-black/20" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <label className="text-sm font-medium">Subject</label>
                <Input name="subject" placeholder="How can we help?" className="border-white/10 bg-black/20" />
              </div>
              <div className="mt-4 space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea name="body" rows={6} required placeholder="Write your message…" className="border-white/10 bg-black/20" />
              </div>
              <Button
                type="submit"
                disabled={!contact.email}
                className="mt-6 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
              >
                <Send className="size-4" /> Send message
              </Button>
              {!contact.email && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Contact details haven't been configured yet — the admin can set
                  them under Admin → Website content.
                </p>
              )}
            </form>
          </Reveal>
        </div>
      </section>
    </PageShell>
  );
}

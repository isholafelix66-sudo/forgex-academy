import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  Check,
  Loader2,
  Lock,
  Sparkles,
  HeartHandshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/site/Reveal";
import { PRODUCT_META, type ProductKey } from "@/lib/features";
import { friendlyError } from "@/lib/errors";
import { toast } from "sonner";
import { useBranding } from "@/lib/branding";

/**
 * The page a LOCKED product shows to normal users.
 *
 * Typing /academy or /opportunity-hub by hand lands here instead of leaking
 * the (still fully intact) product behind it. Copy is admin-editable through
 * the feature flags, so the wording can change without a deploy.
 */
export function ComingSoon({ product }: { product: ProductKey }) {
  const branding = useBranding();
  const meta = PRODUCT_META[product];
  const flags = useQuery(api.projects.featureFlags);
  const notifyMe = useMutation(api.projects.notifyMe);

  const flag = flags?.find((f) => f.key === product);
  const label = flag?.label ?? meta.label;
  const tagline = flag?.tagline ?? meta.tagline;
  const copy = flag?.comingSoonCopy?.trim() || meta.blurb;

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const highlights = useMemo(() => meta.highlights, [meta]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const res = await notifyMe({ product, email });
      setDone(true);
      toast.success(
        res.already
          ? "You're already on the list — we'll be in touch."
          : `We'll email you when ${label} launches.`,
      );
      setEmail("");
    } catch (err) {
      toast.error(friendlyError(err, "Could not save your email. Please try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Ambient lime glow behind the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[420px] max-w-3xl rounded-full bg-lime-400/10 blur-[120px]"
      />

      <section className="relative mx-auto max-w-4xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-lime-400/25 bg-lime-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-lime-300"
        >
          <Lock className="size-3.5" />
          Coming soon
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="font-display mt-6 text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl"
        >
          {label} is <span className="text-gradient">coming soon</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground"
        >
          {copy}
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.18 }}
          className="mt-3 text-sm font-medium text-lime-300/90"
        >
          {tagline}
        </motion.p>

        {/* Notify me */}
        <Reveal className="mt-10" delay={0.1}>
          <form
            onSubmit={submit}
            className="mx-auto flex w-full max-w-xl flex-col gap-2.5 rounded-2xl border border-white/10 bg-card/80 p-3 backdrop-blur sm:flex-row"
          >
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              aria-label={`Email me when ${label} launches`}
              className="h-11 flex-1 border-white/10 bg-black/20"
            />
            <Button
              type="submit"
              disabled={sending}
              className="h-11 shrink-0 gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300"
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : done ? (
                <Check className="size-4" />
              ) : (
                <Bell className="size-4" />
              )}
              {done ? "You're on the list" : `Notify me`}
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            We only email you about this launch. No spam, unsubscribe any time.
          </p>
        </Reveal>

        {/* What's coming */}
        <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          {highlights.map((item, i) => (
            <Reveal key={item} delay={0.06 * i}>
              <div className="h-full rounded-2xl border border-white/10 bg-card p-5">
                <span className="flex size-9 items-center justify-center rounded-xl bg-lime-400/12 text-lime-300">
                  <Check className="size-4" />
                </span>
                <p className="mt-3 text-sm leading-relaxed text-foreground/85">
                  {item}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Meanwhile — the live product */}
      <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-lime-400/25 bg-gradient-to-br from-lime-400/12 via-card to-transparent p-8 sm:p-12">
            <Sparkles className="size-8 text-lime-300" />
            <h2 className="font-display mt-4 text-2xl font-bold sm:text-3xl">
              {branding.productLabel} is live right now
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Build your professional portfolio, publish it as your own website,
              and share one link — that's available today while we finish
              {" "}
              {label}.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/auth?mode=signup">
                <Button
                  size="lg"
                  className="gap-2 bg-lime-400 font-semibold text-black hover:bg-lime-300 glow-lime-soft"
                >
                  Create your portfolio <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/explore">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 border-white/15 hover:border-lime-400/40 hover:text-lime-300"
                >
                  <HeartHandshake className="size-4" /> Explore portfolios
                </Button>
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

/**
 * Entry point for a product's own URL (/academy, /opportunity-hub).
 *
 * While the product is locked it renders Coming Soon; once its flag is
 * switched to `active` the same URL forwards to the product's real home, so
 * launching never needs a code change.
 */
export function ProductEntry({
  product,
  to,
}: {
  product: ProductKey;
  to: string;
}) {
  const flags = useQuery(api.projects.featureFlags);
  if (flags === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const state = flags.find((f) => f.key === product)?.state ?? "locked";
  if (state === "active") return <Navigate to={to} replace />;
  return <ComingSoon product={product} />;
}

export default ComingSoon;

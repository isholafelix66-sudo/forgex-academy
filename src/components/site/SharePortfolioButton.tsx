import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Check, Link2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBranding } from "@/lib/branding";

/**
 * The lime pill in the ForgeX Network top bar.
 *
 * Signed in with a portfolio → copies the owner's public portfolio link so it
 * can be pasted anywhere. Signed out → sends them to create one. The label is
 * admin-editable (branding.shareLabel, default "Share Portfolio Link").
 */
export function SharePortfolioButton({
  className,
  showLabel = true,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const branding = useBranding();
  const data = useQuery(api.projects.myPortfolio);
  const [copied, setCopied] = useState(false);

  const slug = data?.portfolio?.slug;
  const label = branding.shareLabel;

  const pill =
    "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-lime-400 px-3.5 py-2 text-[11px] font-bold tracking-wide text-black transition-colors hover:bg-lime-300 sm:text-xs";

  // Loading — render an inert pill so the bar never jumps on first paint.
  if (data === undefined) {
    return (
      <span className={cn(pill, "opacity-60", className)} aria-hidden>
        <Link2 className="size-3.5 shrink-0" />
        {showLabel && <span className="whitespace-nowrap">{label}</span>}
      </span>
    );
  }

  if (!slug) {
    return (
      <Link to="/auth?mode=signup" className={cn(pill, className)}>
        <Link2 className="size-3.5 shrink-0" />
        {showLabel && <span className="whitespace-nowrap">{label}</span>}
      </Link>
    );
  }

  const copyLink = async () => {
    const url = `${window.location.origin}/p/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Portfolio link copied — paste it anywhere.");
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("Couldn't copy automatically — open your portfolio to copy it.");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copyLink()}
      aria-label={`${label} — ${branding.name}`}
      className={cn(pill, className)}
    >
      {copied ? (
        <Check className="size-3.5 shrink-0" />
      ) : (
        <Link2 className="size-3.5 shrink-0" />
      )}
      {showLabel && (
        <span className="whitespace-nowrap">{copied ? "Link copied" : label}</span>
      )}
    </button>
  );
}

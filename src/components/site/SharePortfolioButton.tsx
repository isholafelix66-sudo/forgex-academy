import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Check, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBranding } from "@/lib/branding";
import { getPortfolioUserToken } from "@/lib/portfolio-user-session";

/**
 * The lime pill in the ForgeX Network top bar.
 *
 * Signed in as a creator → copies / shares their public portfolio URL
 * (with native mobile sharing where supported). Signed out → copies the
 * public website link. The label is admin-editable
 * (branding.shareLabel, default "Share Portfolio Link").
 */
export function SharePortfolioButton({
  className,
  showLabel = true,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const branding = useBranding();
  const userToken = getPortfolioUserToken();
  const data = useQuery(
    api.projects.myPortfolio,
    userToken ? { token: userToken } : "skip",
  );
  const [copied, setCopied] = useState(false);

  const slug = data?.portfolio?.slug;
  const label = branding.shareLabel;

  const pill =
    "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-lime-400 px-3.5 py-2 text-[11px] font-bold tracking-wide text-black transition-colors hover:bg-lime-300 sm:text-xs";

  const share = async (url: string, successMessage: string) => {
    // Native mobile share sheet where supported (Web Share API), otherwise
    // fall back to the clipboard.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: branding.name, url });
        return;
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("Couldn't copy automatically — copy it from the address bar.");
    }
  };

  // Loading — render an inert pill so the bar never jumps on first paint.
  if (userToken && data === undefined) {
    return (
      <span className={cn(pill, "opacity-60", className)} aria-hidden>
        <Link2 className="size-3.5 shrink-0" />
        {showLabel && <span className="whitespace-nowrap">{label}</span>}
      </span>
    );
  }

  // Signed out (or no portfolio yet): the pill still shares — it copies the
  // public website link. It never opens account creation.
  if (!slug) {
    const siteUrl = typeof window !== "undefined" ? window.location.origin : "/";
    return (
      <button
        type="button"
        onClick={() => void share(siteUrl, "Website link copied.")}
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

  const url = `${window.location.origin}/p/${slug}`;
  return (
    <button
      type="button"
      onClick={() => void share(url, "Portfolio link copied — paste it anywhere.")}
      aria-label={`${label} — ${branding.name}`}
      className={cn(pill, className)}
    >
      {copied ? (
        <Check className="size-3.5 shrink-0" />
      ) : (
        <Share2 className="size-3.5 shrink-0" />
      )}
      {showLabel && (
        <span className="whitespace-nowrap">{copied ? "Link copied" : label}</span>
      )}
    </button>
  );
}

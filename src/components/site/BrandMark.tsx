import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { useBranding, type Branding } from "@/lib/branding";

/**
 * The ForgeX Network wordmark: the leading name, its lime accent tail and the
 * optional product label / tagline underneath.
 *
 * Renders text rather than an uploaded logo so an admin can rename the network
 * from the admin panel and every surface follows immediately.
 */
export function BrandMark({
  branding,
  to = "/",
  className,
  size = "md",
  showProduct = false,
  showTagline = false,
  onClick,
}: {
  branding?: Branding;
  to?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Show the product label ("Portfolio") under the wordmark. */
  showProduct?: boolean;
  /** Show the tagline line ("Create • Showcase • Grow"). */
  showTagline?: boolean;
  onClick?: () => void;
}) {
  const fallback = useBranding();
  const b = branding ?? fallback;

  const main = {
    sm: "text-sm",
    md: "text-[15px]",
    lg: "text-lg",
  }[size];

  const sub = {
    sm: "text-[8px]",
    md: "text-[9px]",
    lg: "text-[10px]",
  }[size];

  const body = (
    <span className={cn("min-w-0 leading-none", className)}>
      <span className={cn("font-display block font-extrabold tracking-[0.2em] uppercase", main)}>
        {b.wordmark}
        {b.wordmarkAccent ? (
          <span className="text-lime-400">{b.wordmarkAccent}</span>
        ) : null}
      </span>
      {showProduct && b.productLabel ? (
        <span
          className={cn(
            "mt-1 block font-medium tracking-[0.34em] text-muted-foreground uppercase",
            sub,
          )}
        >
          {b.productLabel}
        </span>
      ) : null}
      {showTagline && b.tagline ? (
        <span className={cn("mt-1 block font-medium tracking-wide text-muted-foreground", sub)}>
          {b.tagline}
        </span>
      ) : null}
    </span>
  );

  if (!to) return body;

  return (
    <Link
      to={to}
      onClick={onClick}
      className="group flex min-w-0 shrink-0 items-center"
      aria-label={b.name}
    >
      {body}
    </Link>
  );
}

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Brand identity — every string the product uses to name itself.
 *
 * Stored in the Portfolio's OWN content table under the key `branding`, so the
 * Portfolio admin portal (/adminbrand) can rename ForgeX Network without a
 * code change — and without touching any Academy setting.
 * `DEFAULT_BRANDING` is the fallback whenever content is missing, still
 * loading, or a field was left blank.
 */
export type Branding = {
  /** Full company name — "ForgeX Network". Used in titles and copy. */
  name: string;
  /** Leading, unaccented part of the wordmark — "ForgeX". */
  wordmark: string;
  /** Accented (lime) tail of the wordmark — "Network". */
  wordmarkAccent: string;
  /** The product label under the wordmark — "Portfolio". */
  productLabel: string;
  /** Short line under the wordmark — "Create • Showcase • Grow". */
  tagline: string;
  /** Label for the pill in the top bar and the drawer button. */
  shareLabel: string;
};

export const DEFAULT_BRANDING: Branding = {
  name: "ForgeX Network",
  wordmark: "ForgeX",
  wordmarkAccent: "Network",
  productLabel: "Portfolio",
  tagline: "Create • Showcase • Grow",
  shareLabel: "Share Portfolio Link",
};

/** Site-content key holding the branding object. */
export const BRANDING_CONTENT_KEY = "branding";

function pick(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

/** Coerce stored content (any shape) into a complete Branding object. */
export function normalizeBranding(raw: unknown): Branding {
  const record =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    name: pick(record.name, DEFAULT_BRANDING.name),
    wordmark: pick(record.wordmark, DEFAULT_BRANDING.wordmark),
    wordmarkAccent: pick(record.wordmarkAccent, DEFAULT_BRANDING.wordmarkAccent),
    productLabel: pick(record.productLabel, DEFAULT_BRANDING.productLabel),
    tagline: pick(record.tagline, DEFAULT_BRANDING.tagline),
    shareLabel: pick(record.shareLabel, DEFAULT_BRANDING.shareLabel),
  };
}

/** Brand identity for the current render (reactive; falls back to defaults). */
export function useBranding(): Branding {
  const raw = useQuery(api.portfolioAdmin.publicContent, {
    key: BRANDING_CONTENT_KEY,
  });
  return normalizeBranding(raw ?? undefined);
}

/** "ForgeX Network" as a single string, for alt text and meta titles. */
export function brandFullName(branding: Branding): string {
  return `${branding.wordmark} ${branding.wordmarkAccent}`.trim();
}

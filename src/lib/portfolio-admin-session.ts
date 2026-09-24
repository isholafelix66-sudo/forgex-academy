/**
 * Portfolio admin session storage.
 *
 * A deliberately SEPARATE storage key from the Academy admin session
 * (`src/lib/admin-session.ts`) and from any Convex/Academy auth token. A
 * Portfolio sign-in therefore cannot be mistaken for — or upgraded into — an
 * Academy session, and signing out of one never affects the other.
 */

const TOKEN_KEY = "fx-portfolio-admin-token";

export function getPortfolioAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setPortfolioAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage blocked — the session simply won't persist */
  }
}

export function clearPortfolioAdminToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Where Portfolio management lives. Never an Academy route. */
export const PORTFOLIO_ADMIN_PATH = "/admin-brand";
/** The legacy spelling, kept only as a redirect for stale bookmarks. */
export const PORTFOLIO_ADMIN_LEGACY_PATH = "/adminbrand";
/** Public Portfolio sign-in entry point. */
export const PORTFOLIO_SIGNIN_PATH = "/portfolio/signin";

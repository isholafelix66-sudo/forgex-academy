/**
 * Portfolio CREATOR session storage.
 *
 * A deliberately SEPARATE storage key from:
 *   • the Academy admin session   (`src/lib/admin-session.ts`)
 *   • the Portfolio ADMIN session (`src/lib/portfolio-admin-session.ts`)
 *   • the Academy auth token      (Convex Auth client)
 *
 * A Portfolio creator sign-in therefore cannot be mistaken for — or upgraded
 * into — an admin or Academy session, and signing out of one never affects
 * the others.
 */

const TOKEN_KEY = "fx-portfolio-user-token";

export function getPortfolioUserToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setPortfolioUserToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage blocked — the session simply won't persist */
  }
}

export function clearPortfolioUserToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** The creator dashboard. Never an admin route. */
export const PORTFOLIO_USER_DASHBOARD_PATH = "/portfolio/dashboard";
/** Public creator entry point (email → OTP). */
export const PORTFOLIO_AUTH_PATH = "/portfolio/auth";

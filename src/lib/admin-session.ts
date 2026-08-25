const KEY = "fx_admin_token";
const ISSUED_AT = "fx_admin_token_issued_at";

/**
 * Server-side sessions expire after 12 hours (ADMIN_SESSION_TTL in convex/lib.ts).
 * We treat the token as stale slightly BEFORE that so privileged Convex queries
 * are skipped client-side instead of running with credentials the backend will
 * REJECT — requireAdminSession throws, which crashes any admin page mid-render.
 */
const CLIENT_MAX_AGE_MS = 11 * 60 * 60 * 1000;

/**
 * Admin session token storage.
 *
 * Uses localStorage so the admin dashboard survives page refreshes (and
 * browser restarts) without re-entering the access password — previously a
 * forced reload after a deploy dropped the admin back at the password gate.
 *
 * Security is not weakened: every privileged Convex query/mutation validates
 * the token server-side via isAdminUnlocked / requireAdmin, and the backend
 * expires tokens independently of client storage.
 */
export function getAdminToken(): string | null {
  try {
    const token = localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY);
    if (!token) return null;
    // Age guard: never hand out a token old enough that the backend has
    // already expired it server-side.
    const issuedAt = Number(localStorage.getItem(ISSUED_AT) ?? "0");
    if (issuedAt && Date.now() - issuedAt > CLIENT_MAX_AGE_MS) {
      clearAdminToken();
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

/** Persist the admin session token after the password gate succeeds. */
export function setAdminToken(token: string) {
  try {
    localStorage.setItem(KEY, token);
    localStorage.setItem(ISSUED_AT, String(Date.now()));
    // Migrate away from the legacy sessionStorage copy if present.
    sessionStorage.removeItem(KEY);
  } catch {
    // Storage unavailable (private mode etc.) — fall back to memory-only,
    // which still works for the current tab session.
    try {
      sessionStorage.setItem(KEY, token);
    } catch {
      // ignore
    }
  }
}

/** Clear the admin session token (locks the dashboard). */
export function clearAdminToken() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(ISSUED_AT);
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore storage errors
  }
}

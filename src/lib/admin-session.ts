const KEY = "fx_admin_token";

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
    return (
      localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY)
    );
  } catch {
    return null;
  }
}

/** Persist the admin session token after the password gate succeeds. */
export function setAdminToken(token: string) {
  try {
    localStorage.setItem(KEY, token);
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
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore storage errors
  }
}

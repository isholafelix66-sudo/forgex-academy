const KEY = "fx_admin_token";

/** Read the admin session token from sessionStorage (null when not unlocked). */
export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Persist the admin session token after the password gate succeeds. */
export function setAdminToken(token: string) {
  try {
    sessionStorage.setItem(KEY, token);
  } catch {
    // ignore storage errors
  }
}

/** Clear the admin session token (locks the dashboard). */
export function clearAdminToken() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore storage errors
  }
}

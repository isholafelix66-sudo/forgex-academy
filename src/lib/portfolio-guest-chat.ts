/**
 * Guest portfolio conversations.
 *
 * A visitor who messages a portfolio does NOT need an account. When they start
 * a conversation the server issues an opaque token; we keep it in this browser
 * (one per portfolio) so the same visitor can reopen and continue that thread.
 * The server stores only the SHA-256 hash, so the token is the only key to the
 * conversation.
 */

const PREFIX = "fx-portfolio-chat:";

export function getGuestChatToken(slug: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + slug);
  } catch {
    return null;
  }
}

export function setGuestChatToken(slug: string, token: string): void {
  try {
    window.localStorage.setItem(PREFIX + slug, token);
  } catch {
    /* private mode — the conversation still works for this tab session */
  }
}

export function clearGuestChatToken(slug: string): void {
  try {
    window.localStorage.removeItem(PREFIX + slug);
  } catch {
    /* ignore */
  }
}

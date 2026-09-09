/**
 * Page-recovery helpers for transient network failures.
 *
 * Mobile browsers (Chrome on Android especially) suspend background tabs:
 * WebSockets die, fetches abort, and the Convex connection drops. When the
 * user returns, the first thing that renders may throw — a query rejects
 * with "Connection closed", a lazy chunk fails to load, etc. Error
 * boundaries must then recover ON THEIR OWN once the network is back,
 * instead of trapping the user on an error screen until they navigate.
 *
 * This module gives boundaries two things:
 *  1. `isNetworkRelatedError` — classify a thrown error as a transient
 *     transport/connection problem (safe to auto-retry indefinitely) vs a
 *     genuine code bug (show a manual retry after a few attempts).
 *  2. `subscribeToRecoverySignals` — a single source of resume/reconnect
 *     events: browser `online`, document `visibilitychange` back to visible,
 *     and the app-wide `forgex:connection-restored` event dispatched by the
 *     connection banner when the network monitor flips back online.
 */

const NETWORK_PATTERNS = [
  /failed to fetch/i,
  /networkerror/i,
  /network error/i,
  /load failed/i,
  /offline/i,
  /connection closed/i,
  /connection lost/i,
  /failed to connect/i,
  /reconnect/i,
  /websocket/i,
  /convex is unreachable/i,
  /timed ?out/i,
  /timeout/i,
  /aborted/i,
  /abort/i,
  /dynamically imported/i,
  /importing a module script/i,
  /econnrefused/i,
  /enotfound/i,
  /fetch failed/i,
  /suspended/i,
  /backend i\/o error/i,
];

/** App-wide event fired when the network monitor flips from offline back to
 *  online — boundaries and data layers listen so the current page reconnects
 *  immediately instead of waiting for the next retry tick. */
export const CONNECTION_RESTORED_EVENT = "forgex:connection-restored";

/** True when `err` looks like a transient transport/connection failure that
 *  will resolve on its own once the network returns — as opposed to a bug in
 *  the code that retrying can never fix. */
export function isNetworkRelatedError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  const msg =
    (err instanceof Error ? err.message : "") +
    " " +
    (typeof err === "object" && err !== null && "name" in err
      ? String((err as { name?: unknown }).name ?? "")
      : "") +
    " " +
    (typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : "");
  return NETWORK_PATTERNS.some((re) => re.test(msg));
}

/**
 * Subscribe to every "the network may be back / the app was resumed" signal
 * and call `cb` when one fires. Returns an unsubscribe function. Safe to
 * call from class components (no hooks).
 */
export function subscribeToRecoverySignals(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  let lastVisibleAt = 0;
  const onOnline = () => cb();

  const onVisibility = () => {
    // Only fire on an actual transition INTO the visible state (not the
    // initial load), and dedupe rapid events (Android can fire multiple).
    if (document.visibilityState !== "visible") return;
    const now = Date.now();
    if (now - lastVisibleAt < 400) return;
    lastVisibleAt = now;
    cb();
  };

  const onRestored = () => cb();

  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener(CONNECTION_RESTORED_EVENT, onRestored);

  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener(CONNECTION_RESTORED_EVENT, onRestored);
  };
}
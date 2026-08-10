/**
 * Sentry error tracking & performance monitoring (client-side).
 *
 * Initialised once at app boot from `VITE_SENTRY_DSN` — the DSN is a public
 * key by design (it only identifies the project, never grants access), so it
 * is safe to ship in the browser bundle. If the key is missing, every call
 * below no-ops gracefully and the app behaves exactly as before.
 *
 * What's enabled:
 *  - Error capture: uncaught exceptions, unhandled promise rejections and
 *    React render errors (via the RootErrorBoundary in main.tsx).
 *  - Performance tracing: browser tracing at a small sample rate plus
 *    session replay that records only when an error happens.
 */

import * as Sentry from "@sentry/react";

const DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();
const enabled = Boolean(DSN);

if (enabled) {
  Sentry.init({
    dsn: DSN,
    environment:
      (import.meta.env.VITE_SENTRY_ENV as string | undefined)?.trim() ||
      import.meta.env.MODE ||
      "development",
    // 10% of sessions get full performance tracing; keep the default span
    // volume low so the free tier lasts.
    tracesSampleRate: 0.1,
    // Never record full sessions — only capture a replay when an error
    // actually happens, so user privacy stays high and quota stays low.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
  });
}

/**
 * Report an exception to Sentry. Safe to call from anywhere — when Sentry is
 * not configured (no DSN) this is a no-op.
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
) {
  if (!enabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/** Tag the current user onto error reports (or clear when signed out). */
export function setSentryUser(user: {
  id?: string;
  name?: string;
  email?: string;
} | null) {
  if (!enabled) return;
  if (!user?.id) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    id: user.id,
    username: user.name || undefined,
    email: user.email || undefined,
  });
}

/** True when Sentry was successfully initialised with a DSN. */
export function isSentryEnabled(): boolean {
  return enabled;
}

/**
 * Resolve the post-auth redirect target from a `returnTo` query parameter.
 *
 * Two guards, both loop-safety critical:
 *
 *  1. Open-redirect guard: only same-site paths are allowed. Anything that
 *     could escape the app (protocol-relative `//host`, backslash, control
 *     characters, `javascript:` etc.) falls back to the dashboard.
 *  2. Auth-loop guard: `/auth` (with any query/fragment, e.g. the crafted
 *     `?returnTo=/auth` or `/academy/login`) is rejected. Redirecting back to the auth page after
 *     a successful sign-in sends the app into an infinite client-side
 *     navigation loop that reads as “keeps refreshing” on iOS Safari.
 *
 * Pure function — unit tested in `src/lib/auth-redirect.test.ts`.
 */
/** Reject current and legacy auth URLs — anything that would bounce a freshly
 *  signed-in user straight back onto an auth page. */
function isAuthLoopTarget(path: string): boolean {
  return ["/auth", "/academy/login", "/academy/signup", "/academy/reset"].some(
    (base) => path === base || path.startsWith(`${base}?`) || path.startsWith(`${base}#`) || path.startsWith(`${base}/`),
  );
}

export function resolveRedirectAfterAuth(
  returnTo: string | null | undefined,
  fallback = "/academy/dashboard",
) {
  if (
    typeof returnTo === "string" &&
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//") &&
    !isAuthLoopTarget(returnTo) &&
    !/[\u0000-\u001F\u007F\\]/.test(returnTo)
  ) {
    return returnTo;
  }
  return fallback;
}

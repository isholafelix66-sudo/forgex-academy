/**
 * Resolve the post-auth redirect target from a `returnTo` query parameter.
 *
 * Two guards, both loop-safety critical:
 *
 *  1. Open-redirect guard: only same-site paths are allowed. Anything that
 *     could escape the app (protocol-relative `//host`, backslash, control
 *     characters, `javascript:` etc.) falls back to the dashboard.
 *  2. Auth-loop guard: `/auth` (with any query/fragment, e.g. the crafted
 *     `?returnTo=/auth`) is rejected. Redirecting back to the auth page after
 *     a successful sign-in sends the app into an infinite client-side
 *     navigation loop that reads as “keeps refreshing” on iOS Safari.
 *
 * Pure function — unit tested in `src/lib/auth-redirect.test.ts`.
 */
/** Reject `/auth`, `/auth?…`, `/auth#…` and `/auth/…` — anything that would
 *  bounce a freshly signed-in user straight back onto the auth page. */
function isAuthLoopTarget(path: string): boolean {
  return (
    path === "/auth" ||
    path.startsWith("/auth?") ||
    path.startsWith("/auth#") ||
    path.startsWith("/auth/")
  );
}

export function resolveRedirectAfterAuth(
  returnTo: string | null | undefined,
  fallback = "/dashboard",
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

/**
 * Resolve the post-auth redirect target from a `returnTo` query parameter.
 *
 * Open-redirect guard: only same-site paths are allowed. Anything that could
 * escape the app (protocol-relative `//host`, backslash, control characters,
 * `javascript:` etc.) falls back to the dashboard. Pure function — unit
 * tested in `src/lib/auth-redirect.test.ts`.
 */
export function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (
    typeof returnTo === "string" &&
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//") &&
    !/[\u0000-\u001F\u007F\\]/.test(returnTo)
  ) {
    return returnTo;
  }
  return fallback;
}

/**
 * Normalize a user/admin-entered external URL for use in an `<a href>`.
 *
 * Stored links are often typed without a protocol (e.g. "instagram.com/forgex"
 * or "www.facebook.com/forgex"). Without this, the browser resolves them as
 * relative internal routes ("mysite.com/instagram.com/forgex") and nginx
 * returns a 404. This prepends `https://` to anything that looks like an
 * external domain, and leaves internal routes (/about), anchors (#top),
 * protocol-relative (//cdn...) and already-absolute links untouched.
 */
export function toExternalHref(url: string | null | undefined): string {
  const value = (url ?? "").trim();
  if (!value) return "";

  // Already has a scheme (https:, http:, mailto:, tel:, data:, javascript:…)
  // or is protocol-relative — use as-is.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//")) {
    return value;
  }

  // Internal routes, anchors and query strings — keep as-is.
  if (value.startsWith("/") || value.startsWith("#") || value.startsWith("?")) {
    return value;
  }

  // "www.example.com/…" or a bare domain like "instagram.com/forgex" →
  // prepend https:// so it opens externally instead of 404ing internally.
  if (
    /^www\./i.test(value) ||
    /^[\w-]+(\.[\w-]+)+(?:\/|$)/.test(value)
  ) {
    return `https://${value}`;
  }

  // Anything else (e.g. a plain relative path) — leave untouched.
  return value;
}
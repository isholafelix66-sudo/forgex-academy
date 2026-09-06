/**
 * Instant scroll-to-top shared by every navigation entry point (header links,
 * bottom navigation, the More menu, dashboards' sidebars).
 *
 * Uses `behavior: "auto"` instead of `"instant"`: `ScrollBehavior` only
 * accepts `"auto" | "instant" | "smooth"` from newer specs, and older Safari
 * builds throw a SyntaxError for `"instant"` — which would kill the click
 * handler and read as a dead nav button. `"auto"` behaves instantly and is
 * universally supported.
 */
export function scrollToTopInstant() {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, behavior: "auto" });
}

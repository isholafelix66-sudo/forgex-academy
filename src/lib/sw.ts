/**
 * Service worker registration for offline support and faster repeat loads.
 *
 * The worker itself lives at /sw.js (copied verbatim from `public/` into the
 * build) and is plain JavaScript — no bundling needed. Registration is
 * deliberately best-effort: sandboxed preview iframes and older browsers
 * simply skip it, and the app keeps working exactly as before.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // Wait for the first load to finish so the worker never competes with the
  // initial HTML/JS for bandwidth on the very first visit.
  window.addEventListener(
    "load",
    () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => {
          console.info("[ForgeX] Service worker ready — offline support active.");
        })
        .catch((err: unknown) => {
          console.warn(
            "[ForgeX] Service worker registration skipped:",
            err instanceof Error ? err.message : err,
          );
        });
    },
    { once: true },
  );
}

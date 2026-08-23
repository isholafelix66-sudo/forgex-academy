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
        .then((registration) => {
          console.info("[ForgeX] Service worker ready — offline support active.");
          // If an updated worker finished installing but is waiting to take
          // over (deploy happened while this tab was open), activate it now.
          // We deliberately do NOT force a page reload on controllerchange:
          // assets are content-hashed and navigations are network-first, so
          // the running session stays valid until the user's next navigation
          // naturally picks up the fresh deployment.
          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }
          registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            installing?.addEventListener("statechange", () => {
              if (
                installing.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                installing.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });
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

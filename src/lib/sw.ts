/**
 * Service worker registration for offline support and faster repeat loads.
 *
 * The worker itself lives at /sw.js (copied verbatim from `public/` into the
 * build) and is plain JavaScript — no bundling needed. Registration is
 * deliberately best-effort: sandboxed preview iframes and older browsers
 * simply skip it, and the app keeps working exactly as before.
 *
 * Production only. A worker installed against the dev server caches that
 * server's HTML, which is bound to one Vite process: the document it stores
 * references `?html-proxy&index=N.js` module URLs created by that process,
 * and once the server restarts (or a stale shell is served after a hiccup)
 * those URLs fail with "No matching HTML proxy module found" — the failure
 * that used to break the preview/build. Dev never registers, and any worker
 * left behind by an older session is unregistered on load.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (import.meta.env.DEV) {
    void removeDevServiceWorkers();
    return;
  }

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

/**
 * Dev-only cleanup: unregister any worker an earlier dev session installed and
 * drop its caches, so the preview always loads live HTML straight from the dev
 * server instead of a cached document with dead module URLs. Best-effort — a
 * blocked or missing Cache API never breaks app startup.
 */
async function removeDevServiceWorkers(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("forgex-"))
          .map((key) => caches.delete(key)),
      );
    }
  } catch {
    // Nothing to clean up (sandboxed iframe, storage disabled, …).
  }
}

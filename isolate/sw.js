/* ForgeX Academy — service worker
 *
 * Gives offline support and fast repeat loads:
 *  - Navigations: network-first, falling back to the cached app shell, so the
 *    SPA boots and renders even with no connection.
 *  - Same-origin static assets (JS/CSS/images): cache-first with background
 *    revalidation. Build assets are content-hashed in production, so they are
 *    immutable — cache-first is both safe and fast.
 *  - Google Fonts: cache-first so typography survives offline too.
 *  - Everything else (Convex API, Mux, uploads, auth): network only.
 *
 * Versioned caches let us atomically drop stale entries on every deploy.
 */
const VERSION = "forgex-shell-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const FONT_CACHE = `${VERSION}-fonts`;

self.addEventListener("install", (event) => {
  // Nothing to precache at install time: asset names are content-hashed and
  // only known after the first load, so the runtime caches fill as the app
  // is used. Taking control immediately keeps the experience consistent.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("forgex-") && !key.startsWith(VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin: only Google Fonts are worth caching (Convex, Mux, media
  // and auth traffic must always hit the network).
  if (url.origin !== self.location.origin) {
    if (
      url.hostname === "fonts.googleapis.com" ||
      url.hostname === "fonts.gstatic.com"
    ) {
      event.respondWith(cacheFirst(request, FONT_CACHE));
    }
    return;
  }

  // App navigations: fresh from the network, cached shell as offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Same-origin static assets: serve from cache instantly, refresh in the
  // background so the next load is already up to date.
  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      // Cache under the requested URL *and* a stable /index.html key so the
      // offline fallback works no matter which page was opened first.
      cache.put(request, fresh.clone());
      cache.put("/index.html", fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const shell = await cache.match("/index.html");
    return shell || Response.error();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  if (cached) return cached;
  return network || Response.error();
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

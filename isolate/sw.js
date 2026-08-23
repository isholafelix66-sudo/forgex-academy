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
 * iOS Safari notes (why caching is wrapped defensively):
 *  Safari can throw when a streamed response is cloned/cached (especially
 *  navigation responses). A cache write must NEVER change what the page
 *  receives — the fresh network response is always returned when available;
 *  the cache is only a fallback for when the network itself fails.
 *
 * Versioned caches let us atomically drop stale entries on every deploy —
 * bump VERSION whenever sw.js behavior changes so old broken caches are
 * purged instead of being served forever.
 */
const VERSION = "forgex-shell-v3";
const SHELL_CACHE = `${VERSION}-shell`;
const FONT_CACHE = `${VERSION}-fonts`;

self.addEventListener("install", (event) => {
  // Nothing to precache at install time: asset names are content-hashed and
  // only known after the first load, so the runtime caches fill as the app
  // is used. Taking control immediately keeps the experience consistent.
  event.waitUntil(self.skipWaiting());
});

// Allow the page to fast-forward the update: when a new worker is waiting,
// posting { type: "SKIP_WAITING" } activates it immediately.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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
  // background so the next load is already up to date. The service worker
  // file itself must ALWAYS be network-first, otherwise browsers can keep
  // running a stale worker across deploys.
  if (url.pathname === "/sw.js") {
    return; // fall through to network
  }
  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
});

/** Cache write that can never throw — Safari throws on streamed responses,
 *  and a failed cache write must not break the request that triggered it. */
async function safeCachePut(cache, request, response) {
  try {
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
  } catch {
    // Cache is best-effort. The caller still has the fresh response.
  }
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  let fresh = null;
  try {
    fresh = await fetch(request);
  } catch {
    fresh = null; // network failed — fall through to cache below
  }

  if (fresh && fresh.ok) {
    // Success: return the fresh page. Cache it in the background, but a
    // cache failure must never downgrade this to the stale shell (which
    // references old hashed chunks and breaks after a deploy).
    await safeCachePut(cache, request, fresh);
    await safeCachePut(cache, "/index.html", fresh);
    return fresh;
  }

  // Network genuinely failed (offline / 5xx) — fall back to the last good
  // shell so the SPA still boots.
  try {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const shell = await cache.match("/index.html");
    if (shell) return shell;
  } catch {
    // cache API unavailable — nothing to fall back to
  }
  return fresh || Response.error();
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Revalidate in the background; the response (cached or fresh) is always
  // what the page asked for. A revalidation failure never produces an error.
  const network = fetch(request)
    .then(async (response) => {
      await safeCachePut(cache, request, response);
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
  await safeCachePut(cache, request, response);
  return response;
}

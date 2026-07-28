/**
 * Offline shell for Quicky Resume.
 *
 * The app is fully static and stores everything in localStorage, so caching the
 * shell is enough to make the entire editor work with no network.
 *
 * PRECACHE and SHELL_URL are injected by scripts/build-sw.mjs after the export
 * is generated, because the build emits content-hashed filenames.
 */
const CACHE_VERSION = "quicky-resume-v1";
const PRECACHE = __PRECACHE_MANIFEST__;
const SHELL_URL = __SHELL_URL__;

self.addEventListener("install", (event) => {
  // Activate immediately rather than waiting for every other tab to close.
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      // One failed entry must not abort the whole install.
      await Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => undefined),
        ),
      );
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

/** Navigations try the network first so a fresh deploy is picked up promptly. */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    return (await cache.match(request)) ?? (await cache.match(SHELL_URL)) ?? Promise.reject(error);
  }
}

/** Hashed build assets never change under one URL, so the cache always wins. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(request.mode === "navigate" ? networkFirst(request) : cacheFirst(request));
});

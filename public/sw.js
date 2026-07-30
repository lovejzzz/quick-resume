/**
 * Offline shell for Quicky Resume.
 *
 * The app is fully static and stores everything in localStorage, so caching the
 * shell is enough to make the entire editor work with no network.
 *
 * PRECACHE and SHELL_URL are injected by scripts/build-sw.mjs after the export
 * is generated, because the build emits content-hashed filenames.
 */
const PRECACHE = __PRECACHE_MANIFEST__;
const SHELL_URL = __SHELL_URL__;
// Cache Storage is origin-wide, so include this deployment's path and only
// remove versions owned by this copy of Quicky Resume.
const CACHE_NAMESPACE = `quicky-resume:${SHELL_URL}`;
// The build injects a digest of every precached file. This matters even for
// assets whose framework-generated URL stays stable across builds.
const CACHE_VERSION = `${CACHE_NAMESPACE}:__CACHE_VERSION__`;
const LEGACY_CACHE_NAMES = new Set(["quicky-resume-v1"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      // An incomplete replacement is worse than an older complete offline
      // release. Fail the install atomically and keep the active worker/cache
      // when any required shell asset cannot be fetched.
      await cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              LEGACY_CACHE_NAMES.has(key) ||
              (key.startsWith(`${CACHE_NAMESPACE}:`) && key !== CACHE_VERSION),
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Navigations try the network first so a fresh deploy is picked up promptly. */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    // "Network first" must bypass the browser's HTTP cache as well as Cache
    // Storage, or a reload can still receive an older exported HTML shell.
    const response = await fetch(new Request(request, { cache: "reload" }));
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

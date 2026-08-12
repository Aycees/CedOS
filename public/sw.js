/**
 * App-shell caching only (system design build plan, phase 10). Deliberately
 * narrow: this app has no offline-write story in v1, and the mutation client
 * (core/mutation/client.ts) is the seam a future outbox queue slots into —
 * caching API responses here would half-implement offline and blur that
 * seam. Only immutable build assets and the two PWA metadata files are
 * cached; every page route and every /api/* request always goes to the
 * network.
 */

const CACHE_NAME = "ced-os-shell-v1";
const PRECACHE_URLS = ["/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Never the API — see the file header.
  if (url.pathname.startsWith("/api/")) return;

  // Never a page route — every one is dynamic, per-session content; only
  // the immutable build output and the two PWA metadata files are the shell.
  const isShellAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/manifest.webmanifest";
  if (!isShellAsset) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    }),
  );
});

/*
 * Service worker: cache every file so the prototypes work offline.
 *
 * Paths are relative to this file, so the site works at the domain root or
 * under a GitHub Pages subpath such as /rabbit-onboarding-prototypes/.
 * Requests are answered from the cache first, and the cache is refreshed
 * from the network in the background, so a new deploy shows up on the next
 * visit. Change VERSION when the file list changes to drop the old cache.
 */
const VERSION = "v3";
const CACHE = "rabbit-onboarding-prototypes-" + VERSION;
const FILES = [
  "./",
  "index.html",
  "a/",
  "a/index.html",
  "b/",
  "b/index.html",
  "c/",
  "c/index.html",
  "assets/app.css",
  "assets/breeds.js",
  "assets/shared.js",
  "assets/index.js",
  "assets/a.js",
  "assets/b.js",
  "assets/c.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("rabbit-onboarding-prototypes-") && key !== CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      const fresh = await network;
      if (fresh) {
        return fresh;
      }
      // Offline and not cached: fall back to the index page for navigations.
      if (request.mode === "navigate") {
        return cache.match("./");
      }
      return new Response("", { status: 504, statusText: "Offline" });
    })
  );
});

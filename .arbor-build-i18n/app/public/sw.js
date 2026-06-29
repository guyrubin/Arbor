/* Arbor service worker: app-shell cache for installability + offline load.
   API and cross-origin requests are never cached (Firestore handles offline
   data via its own IndexedDB cache).

   CACHE is stamped with a unique build id at build time (scripts/stamp-sw.mjs
   replaces __BUILD_ID__). Because the bytes of this file change every deploy,
   the browser detects a new service worker, activates it (skipWaiting +
   clients.claim), and the controllerchange handler in main.tsx reloads open
   tabs once — so users always get the latest build instead of a stale shell. */
const CACHE = "arbor-shell-__BUILD_ID__";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // skip API / Firebase / cross-origin
  if (url.pathname.startsWith("/api")) return;

  // SPA navigations: network-first, fall back to cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Static assets: cache-first, then network.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached)
    )
  );
});

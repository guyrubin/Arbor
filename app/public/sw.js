/* Arbor service worker: app-shell cache for installability + offline load.
   API and cross-origin requests are never cached (Firestore handles offline
   data via its own IndexedDB cache).

   CACHE is stamped with a unique build id at build time (scripts/stamp-sw.mjs
   replaces __BUILD_ID__). Because the bytes of this file change every deploy,
   the browser detects a new service worker, activates it (skipWaiting +
   clients.claim), and the controllerchange handler in main.tsx reloads open
   tabs once — so users always get the latest build instead of a stale shell. */
const CACHE = "arbor-shell-__BUILD_ID__";

/* Install-time precache. The runtime cache-first branch below only ever holds
   what a previous ONLINE paint happened to request, which is not good enough
   for two assets:

   · the self-hosted Material Symbols subset — it IS the app's entire
     iconography (index.html), it has no CDN to fall back to any more, and
     Material Symbols icons are ligatures, so a missing font means literal
     English words where icons belong;
   · the app shell itself, so a cold offline start has something to render.

   Kept deliberately tiny: everything else stays lazily cached on first use. */
const PRECACHE = ["/index.html", "/fonts/material-symbols-rounded-subset.woff2"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      // A precache miss (offline install, asset renamed) must never block
      // activation — the worker still works, just without the head start.
      .catch(() => undefined),
  );
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
        .catch(() => caches.match("/index.html", { ignoreVary: true }))
    );
    return;
  }

  /* Static assets: cache-first, then network.

     ignoreVary is load-bearing, not a nicety. Hosts commonly answer with
     `Vary: Origin`, and a font is ALWAYS requested in CORS mode (the
     `crossorigin` preload + @font-face rule in index.html), so its request
     carries an Origin header while the install-time addAll() request did not.
     Honouring Vary therefore missed the precached icon font offline — verified:
     the entry was in the cache and the app still rendered no icons. */
  event.respondWith(
    caches.match(req, { ignoreVary: true }).then(
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

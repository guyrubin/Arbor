/* Arbor service worker: public shell/art only. API and cross-origin requests
   stay outside this cache. A new worker waits for old clients to close: never
   take over or reload a child's active game, recording, or unsaved draft. */
const CACHE = "arbor-shell-__BUILD_ID__";
const ART_VERSION = "v1";
const ART_CACHE = `arbor-kid-art-${ART_VERSION}`;
const ART_MAX = 40;
const ART_CACHE_MAX = 256;
const isKidArt = (path) => typeof path === "string" && /^\/visuals\/[\w\/.-]+\.webp$/.test(path) && !path.includes("..");
const PRECACHE = ["/index.html", "/fonts/material-symbols-rounded-subset.woff2"];

/* Public, stable art URLs are revalidated once per worker lifetime, with one
   in-flight refresh per URL. Cached art paints immediately and stays offline.
   A stamped deployment starts a fresh validation set, not a stale v1 forever. */
const validatedArt = new Set();
const refreshingArt = new Map();
async function trimArt(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - ART_CACHE_MAX)).map(key => cache.delete(key)));
}
function refreshArt(cache, req) {
  const key = req.url;
  if (refreshingArt.has(key)) return refreshingArt.get(key);
  const update = fetch(req, { cache: "no-cache" }).then(async res => {
    if (res.ok) {
      try {
        await cache.put(req, res.clone()); await trimArt(cache);
        validatedArt.add(key);
        if (validatedArt.size > ART_CACHE_MAX) validatedArt.delete(validatedArt.values().next().value);
      } catch { /* Quota must not prevent online play or mark stale bytes fresh. */ }
    }
    return res;
  }).catch(() => undefined).finally(() => refreshingArt.delete(key));
  refreshingArt.set(key, update);
  return update;
}

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).catch(() => undefined));
  // Deliberately no forced activation: let the browser preserve existing clients.
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key =>
    (key.startsWith("arbor-shell-") || key.startsWith("arbor-kid-art-")) && key !== CACHE && key !== ART_CACHE
  ).map(key => caches.delete(key)))).then(() => caches.open(ART_CACHE)).then(trimArt).catch(() => undefined));
  // No clients.claim(): documents already running keep their coherent version.
});

self.addEventListener("message", event => {
  const data = event.data;
  if (!data || data.type !== "kid-art-precache" || !Array.isArray(data.urls)) return;
  const urls = [...new Set(data.urls.filter(isKidArt))].slice(0, ART_MAX);
  event.waitUntil(caches.open(ART_CACHE).then(async cache => {
    // Sequential warming is intentionally bounded, unlike a 40-request burst.
    for (const url of urls) {
      try { if (!await cache.match(url, { ignoreVary: true })) await cache.add(url); } catch { /* Offline. */ }
    }
    await trimArt(cache);
  }).catch(() => undefined));
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api")) return;

  if (req.mode === "navigate") {
    const response = fetch(req);
    event.respondWith(response.catch(async () => await caches.match("/index.html", { ignoreVary: true }) || Response.error()));
    event.waitUntil(response.then(async res => {
      if (res.ok) { const copy = res.clone(); await (await caches.open(CACHE)).put("/index.html", copy); }
    }).catch(() => undefined));
    return;
  }

  if (url.pathname.startsWith("/visuals/")) {
    const lookup = caches.open(ART_CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreVary: true });
      const update = !cached || !validatedArt.has(req.url) ? refreshArt(cache, req) : Promise.resolve(undefined);
      return { cached, update };
    });
    event.respondWith(lookup.then(({ cached, update }) => cached || update.then(res => res ? res.clone() : Response.error())).catch(() => fetch(req)));
    // Keep revalidation alive after a cached response has already painted.
    event.waitUntil(lookup.then(({ update }) => update).then(() => undefined).catch(() => undefined));
    return;
  }

  /* Preserve ignoreVary: font preloads carry Origin, install addAll does not.
     Respecting Vary here previously made the cached icon font miss offline. */
  let write = Promise.resolve();
  const response = caches.match(req, { ignoreVary: true }).then(cached => cached || fetch(req).then(res => {
    if (res.ok) {
      const copy = res.clone();
      write = caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => undefined);
    }
    return res;
  }));
  event.respondWith(response.catch(() => Response.error()));
  event.waitUntil(response.then(() => write).catch(() => undefined));
});

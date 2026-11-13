const CACHE_NAME = "loop-out-offline-v3";
const APP_SHELL = [
  "./", "./index.html", "./game.js", "./manifest.webmanifest", "./gamelogo.png",
  "./assets/blackout/building-type-a.glb", "./assets/blackout/building-type-b.glb",
  "./assets/blackout/building-type-c.glb", "./assets/blackout/tree-large.glb",
  "./assets/blackout/construction-barrier.glb", "./assets/blackout/construction-cone.glb"
];
const VENDOR = [
  "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js",
  "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/PointerLockControls.js",
  "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await Promise.all(VENDOR.map(async url => {
      try { await cache.add(new Request(url, { mode: "cors" })); }
      catch (error) { console.warn("Could not precache game engine module:", url, error); }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const vendorRequest = VENDOR.includes(url.href);
  if (!sameOrigin && !vendorRequest) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put("./index.html", response.clone()));
      return response;
    }).catch(() => caches.match("./index.html")));
    return;
  }

  event.respondWith(caches.match(request).then(cached => {
    if (cached) return cached;
    return fetch(request).then(response => {
      if (response.ok && sameOrigin) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    });
  }));
});

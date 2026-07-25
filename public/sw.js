const CACHE = "cma-v5";
const APP_SHELL = ["./", "./index.html", "./icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  const updateCache = (response) => {
    if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
    return response;
  };

  // La pantalla principal comprova sempre primer la versió publicada.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(updateCache)
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./") || Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then(updateCache).catch(() => Response.error()))
  );
});
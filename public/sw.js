const CACHE = "cma-v65";
const APP_SHELL = ["./", "./index.html", "./admin.html", "./icon.svg", "./falck-eagle-admin.png"];

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

  event.respondWith(
    fetch(request)
      .then(updateCache)
      .catch(() => caches.match(request).then((cached) => cached || (request.mode === "navigate" ? caches.match("./") : Response.error())))
  );
});

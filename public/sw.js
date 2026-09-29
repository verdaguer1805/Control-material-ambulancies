const CACHE = "cma-v194";
const APP_SHELL = ["./", "./index.html", "./admin.html", "./admin/", "./admin/manifest.webmanifest", "./icon.svg", "./falck-eagle-admin.png", "./svb-zones.html", "./svb-preview.html", "./svb-front-preview.html", "./svb-right-preview.html", "./checklists/svb-paret-lateral-esquerre-mobile.jpg", "./checklists/svb-paret-frontal-mobile.jpg", "./checklists/svb-zona-derecha-mobile.jpg", "./checklists/svb-front-wall-data.js", "./checklists/svb-right-zone-data.js", "./checklists/svb-vehicle-assignment.js", "./checklists/svb-zones-production.js"];

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
      .catch(() => caches.match(request).then((cached) => {
        if (cached) return cached;
        if (request.mode !== "navigate") return Response.error();
        return new URL(request.url).pathname.endsWith("/admin/")
          ? caches.match("./admin/")
          : caches.match("./");
      }))
  );
});

const CACHE = "cma-v222";
const APP_SHELL = ["./", "./index.html", "./admin.html", "./admin/", "./admin/manifest.webmanifest", "./icon.svg", "./falck-eagle-admin.png", "./svb-zones.html", "./svb-door-preview.html", "./checklists/svb-door-data.js", "./checklists/svb-puerta-izquierda-mobile.jpg", "./svb-cabin.html", "./checklists/svb-cabin.js", "./checklists/svb-cabin-data.js", "./svb-preview.html", "./svb-front-preview.html", "./svb-right-preview.html", "./checklists/svb-paret-lateral-esquerre-mobile.jpg", "./checklists/svb-paret-frontal-mobile.jpg", "./checklists/svb-zona-derecha-mobile.jpg", "./checklists/svb-front-wall-data.js", "./checklists/svb-left-wall-data.js", "./checklists/svb-right-zone-data.js", "./checklists/svb-vehicle-assignment.js", "./checklists/svb-guard-window.js", "./checklists/svb-zones-production.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: "reload" })))));
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
  const freshCode = request.mode === "navigate" || /\.(?:html|js)$/.test(new URL(request.url).pathname);

  const updateCache = (response) => {
    if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
    return response;
  };

  event.respondWith(
    fetch(freshCode ? new Request(request, { cache: "no-cache" }) : request)
      .then(updateCache)
      .catch(() => caches.match(request).then(async (cached) => {
        if (cached) return cached;
        const versioned = new URL(request.url).searchParams.has("v") || new URL(request.url).searchParams.has("from");
        if (versioned) {
          const base = new URL(request.url); base.search = "";
          const cachedBase = await caches.match(base.href);
          if (cachedBase) return cachedBase;
        }
        if (request.mode !== "navigate") return Response.error();
        return new URL(request.url).pathname.endsWith("/admin/")
          ? caches.match("./admin/")
          : caches.match("./");
      }))
  );
});

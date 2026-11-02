const CACHE = "bq-shell-v42";
const SHELL = [
  "/",
  "/css/app.css",
  "/js/boot.js",
  "/js/app.js",
  "/js/camera.js",
  "/js/profile.js",
  "/js/extras.js",
  "/js/feed.js",
  "/js/admin.js",
  "/js/work.js",
  "/js/qr.js",
  "/js/secure.js",
  "/js/posting.js",
  "/js/shell.js",
  "/img/icon-192.png",
  "/img/bq-connect.svg",
  "/img/avatar-default.svg",
  "/favicon.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/media/") || url.pathname.startsWith("/avatar/")) return;
  const key = request.mode === "navigate" ? "/" : url.pathname;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && (request.mode === "navigate" || SHELL.includes(url.pathname) || url.pathname.startsWith("/img/"))) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(key, copy));
        }
        return response;
      })
      .catch(() => caches.match(key).then((hit) => hit || Response.error())),
  );
});

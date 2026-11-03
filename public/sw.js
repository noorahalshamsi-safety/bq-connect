const CACHE = "bq-shell-v57";
const SHELL = [
  "/",
  "/css/app.css",
  "/js/boot.js",
  "/js/app.js",
  "/js/camera.js",
  "/js/editor.js",
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

// "//host" and "/\host" are treated as other sites by the browser, so only same-origin paths pass.
function localPath(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/";
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const url = localPath(data.url);
  event.waitUntil(self.registration.showNotification(String(data.title || "BQ Connect").slice(0, 120), {
    body: String(data.body || "").slice(0, 200),
    tag: String(data.tag || "bq"),
    icon: "/img/icon-192.png",
    badge: "/favicon.png",
    lang: "ar",
    dir: "auto",
    data: { url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = localPath(event.notification.data && event.notification.data.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        open.postMessage({ type: "open", url });
        return open.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});

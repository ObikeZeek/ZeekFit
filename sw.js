const CACHE="zeekfit-v3.0";
const FILES=["./","./index.html","./manifest.json","./three-zeekfit.js"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  // Model files stay on the network so newly uploaded Mixamo assets are available immediately.
  const url = new URL(event.request.url);
  if (url.pathname.endsWith("/index.html") || url.pathname.endsWith("/three-zeekfit.js")) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});

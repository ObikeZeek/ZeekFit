const CACHE="zeekfit-v3.1";
const FILES=["./","./index.html","./manifest.json","./three-zeekfit.js"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.pathname.endsWith("/index.html") || url.pathname.endsWith("/three-zeekfit.js")) {
    event.respondWith(fetch(event.request).then(async response => {
      if (url.pathname.endsWith("/index.html")) {
        const text = await response.text();
        // Inject the 3D module into the existing ZeekFit page without rewriting its large HTML file.
        const injected = text.replace("</body>", '<script type="module" src="./three-zeekfit.js"></script></body>');
        return new Response(injected, {headers: {"Content-Type":"text/html; charset=utf-8"}});
      }
      return response;
    }).catch(() => caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});

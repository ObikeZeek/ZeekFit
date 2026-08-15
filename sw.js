const CACHE="zeekfit-v3.4";
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
  const url = new URL(event.request.url);
  const isAppPage =
    url.pathname.endsWith("/ZeekFit/") ||
    url.pathname.endsWith("/ZeekFit/index.html") ||
    url.pathname.endsWith("/ZeekFit/three-zeekfit.js");

  if (isAppPage) {
    event.respondWith(
      fetch(event.request).then(async response => {
        if (url.pathname.endsWith("/ZeekFit/") || url.pathname.endsWith("/ZeekFit/index.html")) {
          const text = await response.text();

          // Three.js addons use the bare "three" module specifier.
          // The import map tells the browser where that module and its addons live.
          const importMap = `<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"
  }
}
</script>`;

          const injected = text
            .replace("</head>", `${importMap}</head>`)
            .replace(
              "</body>",
              '<script type="module" src="./three-zeekfit.js?v=3.4"></script></body>'
            );

          return new Response(injected, {
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Keep the rest of the app shell available offline.
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
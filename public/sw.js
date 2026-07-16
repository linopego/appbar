// Service worker MINIMALE: serve solo all'installabilità PWA + cache della
// shell statica (icone, manifest). NESSUN caching offline dei dati dinamici:
// ticket e API arrivano SEMPRE dalla rete — la verità sullo stato è il server.
const CACHE_NAME = "klink-shell-v1";
const SHELL_ASSETS = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isShellAsset =
    url.origin === self.location.origin && SHELL_ASSETS.includes(url.pathname);

  // Solo la shell statica va in cache-first; tutto il resto passa dalla rete
  if (!isShellAsset) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request))
  );
});

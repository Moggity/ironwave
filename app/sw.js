/* IRONWAVE service worker.
   Caches the app shell so the app launches with no network at all (e.g. a gym
   with no signal). The shell is the four scripts + styles + icons; training
   data is NOT cached here, it lives on-device via localStorage (see app.js
   loadState/save). API calls to /api/state are never intercepted, so when a
   server happens to be reachable it still works, and when it is not the app
   simply falls back to local storage.

   Bump CACHE_VERSION whenever a shell file changes so clients fetch the new
   build instead of serving stale assets from cache. */
const CACHE_VERSION = 'ironwave-shell-v1';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './engine.js',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                 // never cache writes
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;      // let API hit the network (or fail) untouched

  // Cache-first for the shell: instant offline launch, network only fills gaps.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          // Cache same-origin successful GETs we did not preload (defensive).
          if (res && res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html')); // offline navigation fallback
    })
  );
});

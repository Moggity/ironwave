/* IRONWAVE service worker.
   Caches the app shell so the app launches with no network at all (e.g. a gym
   with no signal). The shell is the four scripts + styles + icons; training
   data is NOT cached here, it lives on-device via localStorage (see app.js
   loadState/save). API calls to /api/state are never intercepted, so when a
   server happens to be reachable it still works, and when it is not the app
   simply falls back to local storage.

   Bump CACHE_VERSION whenever a shell file changes so clients fetch the new
   build instead of serving stale assets from cache. Keep the version suffix in
   step with APP_VERSION in data.js. */
const CACHE_VERSION = 'ironwave-shell-v1.18.0';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './i18n/i18n.js',
  './i18n/en.js',
  './i18n/es.js',
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

/* [Epic H8] Exercise media lives in its OWN cache: clips must never bloat the
   shell (the shell stays instant and offline-safe), and the media cache must
   SURVIVE shell version bumps (activate keeps it). Size-capped below. */
const MEDIA_CACHE = 'ironwave-media-v1';
const MEDIA_MAX_ENTRIES = 80;

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k !== CACHE_VERSION && k !== MEDIA_CACHE)
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Drop the oldest cached clips past the cap (cache keys keep insertion order).
function trimMediaCache(cache) {
  return cache.keys().then((keys) => {
    const clips = keys.filter((k) => !k.url.endsWith('manifest.json'));
    if (clips.length <= MEDIA_MAX_ENTRIES) return;
    return Promise.all(clips.slice(0, clips.length - MEDIA_MAX_ENTRIES).map((k) => cache.delete(k)));
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                 // never cache writes
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/')) return;      // let API hit the network (or fail) untouched

  // [Epic H8] Media routes to its own capped cache, never the shell cache
  // below. Range requests (video seeks) go straight to the network: caching a
  // 206 partial would corrupt playback. Clips are immutable by convention
  // (rename the file to bust), so they are cache-first; the manifest is the
  // one mutable file, network-first so a fresh upload shows without a version
  // bump, with the cached copy as the offline fallback.
  if (url.origin === self.location.origin && url.pathname.includes('/media/')) {
    if (req.headers.get('range')) return;
    if (url.pathname.endsWith('manifest.json')) {
      event.respondWith(
        fetch(req).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(MEDIA_CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        }).catch(() => caches.match(req))
      );
    } else {
      event.respondWith(
        caches.open(MEDIA_CACHE).then((cache) =>
          cache.match(req).then((hit) => hit || fetch(req).then((res) => {
            if (res && res.status === 200) {
              cache.put(req, res.clone()).then(() => trimMediaCache(cache));
            }
            return res;
          }))
        )
      );
    }
    return;
  }

  // Stale-while-revalidate for the shell: serve the cached copy instantly (so
  // the app still launches with no signal), but in the background re-fetch and
  // refresh the cache so the next launch runs the newest code. This is what
  // stops an installed PWA from being pinned to a stale build between version
  // bumps; cache-first alone never re-fetched an already-cached app.js.
  event.respondWith(
    caches.match(req).then((hit) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res && res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => hit || caches.match('./index.html')); // offline: fall back to cache
      return hit || fetched;
    })
  );
});

/* Tapping the rest-done notification (app.js showRestNotification) brings the
   athlete straight back to the session: focus an open IRONWAVE window if there
   is one, otherwise open a fresh one. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('./');
    })
  );
});

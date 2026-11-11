/* Beginner app service worker. Offline shell, no other origin ever.
   assemble-beginner.js replaces __SHELL_HASH__ with a content hash of the other shell
   files (so every change makes a new cache) and the FILES list with every shell file. */
'use strict';
const CACHE = 'beginner-shell-__SHELL_HASH__';
const PREFIX = 'beginner-';
const FILES = [/*__SHELL_FILES__*/];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(['./'].concat(FILES)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names
        // Only this app's own old caches. Other apps on the same origin keep theirs.
        .filter(n => n.indexOf(PREFIX) === 0 && n !== CACHE)
        .map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;
  event.respondWith(answer(req));
});

async function answer(req) {
  const cache = await caches.open(CACHE);
  if (req.mode === 'navigate') {
    const page = await cache.match(new URL('index.html', self.location.href).href);
    if (page) return page;
  } else {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
  }
  return fetch(req);
}

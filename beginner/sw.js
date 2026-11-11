/* Beginner app service worker. Offline shell, no other origin ever.
   assemble-beginner.js replaces __SHELL_HASH__ with a content hash of the other shell
   files (so every change makes a new cache) and the FILES list with every shell file. */
'use strict';
const CACHE = 'beginner-shell-__SHELL_HASH__';
const PREFIX = 'beginner-';
const FILES = [/*__SHELL_FILES__*/];
const SCOPE = new URL('./', self.location.href).href;

// Every shell request bypasses the browser HTTP cache, so a redeploy never freezes a mix
// of old and new files.
const fresh = rel => new Request(rel, { cache: 'reload' });

async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(['./'].concat(FILES).map(fresh));
}

self.addEventListener('install', event => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
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
  // Held open so a background repair of the cache can finish.
  let finish = () => {};
  event.waitUntil(new Promise(res => { finish = res; }));
  event.respondWith(answer(req, url, finish));
});

async function answer(req, url, finish) {
  try {
    const cache = await caches.open(CACHE);
    const nav = req.mode === 'navigate';
    const hit = nav
      ? await cache.match(new URL('index.html', SCOPE).href)
      : await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const rel = url.href.indexOf(SCOPE) === 0 ? url.href.slice(SCOPE.length).split('?')[0].split('#')[0] : null;
    const shell = nav || (rel !== null && (rel === '' || FILES.indexOf(rel) !== -1));
    if (!shell) return await fetch(req);
    // A shell file the cache lacks: another worker on this origin may have deleted our cache.
    const key = nav ? new URL('index.html', SCOPE).href : SCOPE + rel;
    const res = await fetch(fresh(key));
    if (res.ok) {
      try { await cache.put(key, res.clone()); } catch (e) { /* still answer */ }
      try { if ((await cache.keys()).length < FILES.length + 1) await precache(); } catch (e) { /* repaired next time */ }
    }
    return res;
  } finally { finish(); }
}

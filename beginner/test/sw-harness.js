/* ============================================================
   BEGINNER APP, package 6 (Web release): a minimal fake service worker global, so the
   ASSEMBLED sw.js can be run in a vm context and driven without a browser. Test helper
   only (no tests here). Node 18 compatible (uses the global Request-free fakes plus the
   global Response, Headers, URL and fetch types, which Node 18 has).

   createSwEnv({ source, origin, basePath, dir, cacheStorage }) returns
     { install(), activate(), fetch(url, { method, mode }), net, caches, listeners,
       skipWaitingCalls, claimCalls, scopeUrl }
   - source       text of the (assembled) sw.js
   - origin       default 'https://host.test'
   - basePath     where the app is served, default '/sub/dir/' (any sub-path must work)
   - dir          the assembled folder served by the fake network
   - cacheStorage optional, from makeCacheStorage(), shared between two envs to model an
                  update (the old worker's caches are still there for the new one)
   net: { calls: [{ url, method, cache }], offline: boolean } (cache is the cache mode of the request, 'default' unless set).
   The sandbox has a Request (relative URLs resolve against the worker). env.rebind() re-points a shared
   storage at this worker after another env (for example Ironwave's app/sw.js) ran. Every fetch attempt is logged, also
   when offline. A request to another origin is answered 200 'external' so a test can see it.
   fetch() returns { handled, response }: handled is false when the worker did not call
   respondWith (the browser then does its own thing, which is what "pass through" means);
   respondWith after the dispatch has returned throws, like a browser.
   Requests are plain objects ({ url, method, mode, headers, destination, clone() }) so a
   test can model mode 'navigate', which Node's Request constructor forbids.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function listFiles(dir, base) {
  const out = [];
  for (const name of fs.readdirSync(path.join(dir, base || ''))) {
    const rel = base ? base + '/' + name : name;
    if (fs.statSync(path.join(dir, rel)).isDirectory()) out.push(...listFiles(dir, rel));
    else out.push(rel);
  }
  return out.sort();
}

const TYPES = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', svg: 'image/svg+xml', png: 'image/png' };

function baseCacheStorage(getBase, getFetch) {
  const stores = new Map();
  const hrefOf = (req, base) => { const u = new URL(typeof req === 'string' ? req : req.url, base); u.hash = ''; return u.href; };
  class FakeCache {
    constructor() { this.map = new Map(); }
    _find(req, opts) {
      if (typeof req !== 'string' && req.method && req.method !== 'GET') return undefined;
      const u = new URL(hrefOf(req, getBase()));
      for (const [k, v] of this.map) {
        if (k === u.href) return v;
        if (opts && opts.ignoreSearch) { const a = new URL(k); if (a.origin === u.origin && a.pathname === u.pathname) return v; }
      }
      return undefined;
    }
    async match(req, opts) { const v = this._find(req, opts); return v ? v.clone() : undefined; }
    async put(req, res) {
      if (typeof req !== 'string' && req.method && req.method !== 'GET') throw new TypeError('Cache.put only takes GET requests');
      this.map.set(hrefOf(req, getBase()), res.clone());
    }
    async add(req) { await this.addAll([req]); }
    async addAll(reqs) {
      const urls = reqs.map(r => hrefOf(r, getBase()));
      const ress = await Promise.all(reqs.map(r => getFetch()(r)));
      ress.forEach((r, i) => { if (!r.ok) throw new TypeError('addAll failed for ' + urls[i] + ' (' + r.status + ')'); });
      ress.forEach((r, i) => this.map.set(urls[i], r.clone()));
    }
    async keys() { return [...this.map.keys()].map(u => ({ url: u, method: 'GET' })); }
    async delete(req) { return this.map.delete(hrefOf(req, getBase())); }
  }
  return {
    stores,
    async open(name) { if (!stores.has(name)) stores.set(name, new FakeCache()); return stores.get(name); },
    async keys() { return [...stores.keys()]; },
    async has(name) { return stores.has(name); },
    async delete(name) { return stores.delete(name); },
    async match(req, opts) {
      for (const c of stores.values()) { const v = c._find(req, opts); if (v) return v.clone(); }
      return undefined;
    },
  };
}

function createSwEnv(o) {
  const origin = o.origin || 'https://host.test';
  const basePath = o.basePath || '/sub/dir/';
  const scopeUrl = origin + basePath;
  const swUrl = scopeUrl + 'sw.js';
  const net = { calls: [], offline: false };
  const env = { net, scopeUrl, swUrl, skipWaitingCalls: 0, claimCalls: 0, listeners: {} };

  async function fakeFetch(input, init) {
    const url = new URL(typeof input === 'string' ? input : input.url, swUrl);
    const method = (init && init.method) || (typeof input !== 'string' && input.method) || 'GET';
    const cacheMode = (init && init.cache) || (typeof input !== 'string' && input.cache) || 'default';
    net.calls.push({ url: url.href, method, cache: cacheMode });
    if (net.offline) throw new TypeError('Failed to fetch');
    if (url.origin !== origin) return new Response('external', { status: 200 });
    const p = decodeURIComponent(url.pathname);
    if (!p.startsWith(basePath)) return new Response('not found', { status: 404 });
    const rel = p.slice(basePath.length) || 'index.html';
    const file = path.join(o.dir, rel);
    if (!file.startsWith(path.resolve(o.dir)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return new Response('not found', { status: 404 });
    const ext = rel.split('.').pop();
    return new Response(fs.readFileSync(file), { status: 200, headers: { 'content-type': TYPES[ext] || 'application/octet-stream' } });
  }

  // A storage shared by two envs resolves relative strings against whichever worker is asking.
  const cacheStorage = o.cacheStorage || sharedCacheStorage();
  cacheStorage.bind({ swUrl, _fetch: fakeFetch });
  env.caches = cacheStorage;
  env._fetch = fakeFetch;
  // Shared storage resolves relative strings for whoever bound last; call after another env ran.
  env.rebind = () => cacheStorage.bind(env);

  // Like a browser, a relative URL given to new Request resolves against the worker's location.
  class SwRequest extends Request {
    constructor(input, init) { super(typeof input === 'string' ? new URL(input, swUrl).href : input, init); }
  }
  const sandbox = {
    Request: SwRequest, URL, URLSearchParams, Response, Headers, TextEncoder, console, setTimeout, clearTimeout, queueMicrotask,
    fetch: fakeFetch,
    caches: cacheStorage,
    location: new URL(swUrl),
    registration: { scope: scopeUrl },
    skipWaiting() { env.skipWaitingCalls++; return Promise.resolve(); },
    clients: { claim() { env.claimCalls++; return Promise.resolve(); }, matchAll: async () => [] },
    addEventListener(type, fn) { (env.listeners[type] = env.listeners[type] || []).push(fn); },
  };
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(o.source, sandbox, { filename: 'sw.js' });

  async function dispatch(type) {
    const waits = [];
    const ev = { type, waitUntil(p) { waits.push(Promise.resolve(p)); } };
    for (const fn of env.listeners[type] || []) fn.call(sandbox, ev);
    await Promise.all(waits);
  }
  env.install = () => dispatch('install');
  env.activate = () => dispatch('activate');

  env.request = (url, opts) => {
    const mode = (opts && opts.mode) || 'cors';
    return {
      url: new URL(url, scopeUrl).href, method: (opts && opts.method) || 'GET', mode,
      headers: new Headers(), destination: mode === 'navigate' ? 'document' : '', credentials: 'same-origin', redirect: 'follow',
      clone() { return this; },
    };
  };
  env.fetch = async (url, opts) => {
    const request = env.request(url, opts);
    const waits = [];
    let responded = null;
    let done = false;
    const ev = {
      type: 'fetch', request, clientId: '', resultingClientId: '',
      waitUntil(p) { waits.push(Promise.resolve(p)); },
      respondWith(p) {
        if (done) throw new Error('respondWith called after the fetch event dispatch returned');
        if (responded) throw new Error('respondWith called twice');
        responded = Promise.resolve(p);
      },
    };
    for (const fn of env.listeners.fetch || []) fn.call(sandbox, ev);
    done = true;
    await Promise.all(waits);
    return { handled: responded !== null, response: responded ? await responded : null };
  };
  return env;
}

function sharedCacheStorage() {
  const ctx = { swUrl: 'https://host.test/sub/dir/sw.js', fetchFn: null };
  const storage = baseCacheStorage(() => ctx.swUrl, () => ctx.fetchFn || (() => Promise.reject(new Error('no fetch bound'))));
  storage.bind = env => { ctx.swUrl = env.swUrl; ctx.fetchFn = (input, init) => env._fetch(input, init); };
  return storage;
}

module.exports = { createSwEnv, makeCacheStorage: sharedCacheStorage, listFiles };

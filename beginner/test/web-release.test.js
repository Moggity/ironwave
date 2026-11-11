/* ============================================================
   BEGINNER APP, package 6 (Web release), pure Node tests. THIS FILE IS THE SPEC.
   The builder implements exactly this and may not edit tests. DOM tests: web-boot.test.js.
   Criteria: I1 (deploys to Pages by workflow), I2 (installs, works offline after the first
   visit), I3 (360 px, static checks only), I4 (Ironwave's deployment unaffected), H1 (no
   network after first load). `LD` marks a lead decision (the brief) or a decision made here.

   ---------- NEW FILES in beginner/ (all added to BEGINNER_FILES in assemble) ----------
   manifest.json, sw.js, boot.js, icons/ (PNG files). Nothing else new is required.

   ---------- index.html ----------
   No inline script with code and no inline event handler attribute. CSP meta tag (LD,
   exact list pinned in the tests below): default-src 'self'; script-src 'self';
   style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self';
   manifest-src 'self'; object-src 'none'; base-uri 'self'. Tests pin: default-src 'self';
   the EFFECTIVE script-src and style-src are exactly 'self'; object-src 'none'; base-uri
   'self'; no unsafe-inline or unsafe-eval anywhere; no remote origin, no wildcard; every
   source in every directive is one of 'self', 'none', data:, blob:.
   <script src="boot.js"> is the LAST script. Relative <link rel="manifest" href>, theme-color,
   viewport (width=device-width, initial-scale=1, zoom NOT disabled), apple-touch-icon (a PNG,
   square, at least 180 px), <meta name="robots" content="noindex">.

   ---------- boot.js (LD: auto-run mechanism) ----------
   Defines top-level `function beginnerBoot(env)` at column zero. It runs the boot ONLY when
   document.currentScript is non-null, i.e. when the browser loads it through a real <script>
   tag. The DOM harness evals the sources (currentScript is null), so loading never
   auto-boots and load-dom.js needs NO change (it evals every script src of index.html, so
   boot.js only has to be listed there). env = { window, navigator, location, isNative, ui }:
   all optional; ui (LD) is an object of extra UI.boot options (root, adapter, clock, timers,
   platform, locale, media) merged over the defaults, so tests can inject a memory adapter.
   Behaviour is pinned in web-boot.test.js.

   ---------- sw.js (LD: the design pinned here) ----------
   - Source holds the token __SHELL_HASH__ (once or more). assemble() replaces it by a hex
     content hash (at least 8 hex chars) of every other file of the assembled folder (path and
     bytes), so the hash changes when any shell file changes and is identical for identical input.
   - Cache name starts with "beginner-" and contains the hash; there is exactly one such cache
     after install. Foreign caches (Ironwave's own PWA shares the origin: ironwave-shell-*)
     are NEVER deleted: on activate only caches starting "beginner-" other than the current
     one are removed.
   - install: precache EVERY file of the assembled folder (sw.js itself optional) plus the scope
     root ("./" answers with index.html), all URLs relative to the worker, so any sub-path works;
     calls skipWaiting. activate: deletes stale beginner- caches, calls clients.claim.
   - fetch: same-origin GET is cache-first, falling back to the network. A navigation (mode
     'navigate') that cannot be served from network answers with the cached index.html, also for
     a URL with a query string. Non-GET and cross-origin requests are not handled (respondWith
     not called) or, for non-GET, passed to the network unchanged. The worker never requests
     another origin.

   ---------- workflow (pages.yml) ----------
   Every non-blank line of main's file stays, in order (baseline embedded below, so CI without
   a main branch works; comments included). Adds path triggers 'beginner/**' and
   'scripts/assemble-beginner.js'; a separate step assembles with
   `node scripts/assemble-beginner.js` and copies the ASSEMBLED folder (beginner/www or an
   outDir argument) to _site/${BEGINNER_DIR}, with
   BEGINNER_DIR: ${{ vars.BEGINNER_PAGES_DIR || 'beginner' }}, before upload-pages-artifact.
   The step never mentions PAGES_DIR, never lists or reveals other folders, never touches
   _site/index.html or robots.txt, and runs no npm.

   ---------- ROUND 2 (review) additions ----------
   B1 (I2): Ironwave's app/sw.js deletes every cache that is not its own (including beginner-shell-*)
     because CacheStorage is per origin. The beginner worker heals: on a miss for the scope root,
     index.html or any precache-list file it fetches (cache mode reload), stores an ok response and
     returns it, and re-runs the precache in the background (waitUntil) when the shell cache is
     missing or incomplete. Tested by running the real app/sw.js activate on shared storage. It still
     never deletes a cache that does not start with beginner-.
   B2 (I2): every precache request and every heal fetch is made with cache mode 'reload' (for example
     new Request(url, { cache: 'reload' })); the harness sandbox has Node's Request, and a relative
     URL resolves against the worker like in a browser.
   S1 (I4): the beginner step fails, before copying, when BEGINNER_DIR has a character outside
     A-Z a-z 0-9 _ - (empty, '.', '..', slashes, spaces, '$') or when _site/$BEGINNER_DIR exists; no
     PAGES_DIR in the guard, no value printed. Tested as text and by running the step's run script
     in bash against a fake assemble script (skipped when bash is missing).
   I3a (I3): rules setting width or min-height on .valuefield must out-rank, by specificity, the
     general input rules setting the same property (for example '.stepper .valuefield').
   S2, S3 (UI) are in web-boot.test.js.

   ---------- NEW STRINGS (strings.js; strings.test.js allows extra keys) ----------
   errors.retry         suggest: 'Check again'
   errors.newerVersion  suggest: 'This app is out of date. Update it, then open it again.'
   (plain English, no em or en dash, none of the forbidden words, and not the word "try".)

   ---------- NOT VERIFIABLE IN NODE (manual checklist) ----------
   real 360 px layout with no horizontal scroll; install prompt and home-screen icon;
   airplane-mode launch after one visit; service worker update on a real redeploy;
   navigator.storage.persist() outcome; CSP actually enforced by a browser (jsdom ignores it).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { assemble, BEGINNER_FILES } = require('../../scripts/assemble-beginner.js');
const { createSwEnv, makeCacheStorage, listFiles } = require('./sw-harness');

const REPO = path.resolve(__dirname, '..', '..');
const B = path.join(REPO, 'beginner');
const rd = (...p) => fs.readFileSync(path.join(REPO, ...p), 'utf8');
const tmp = tag => fs.mkdtempSync(path.join(os.tmpdir(), 'bg-web-' + tag + '-'));
const rm = d => fs.rmSync(d, { recursive: true, force: true });
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
const exists = (...p) => fs.existsSync(path.join(...p));

let assembled = null; // one shared assembled copy for read-only tests
function asm() { if (!assembled) assembled = assemble({ outDir: tmp('asm') }); return assembled; }
test.after(() => { if (assembled) rm(assembled); });

// ======================= index.html =======================
const html = () => rd('beginner', 'index.html');
const tags = (h, name) => [...h.matchAll(new RegExp('<' + name + '\\b[^>]*>', 'gi'))].map(m => m[0]);
const attr = (tag, a) => { const m = tag.match(new RegExp('\\b' + a + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i')); return m ? (m[2] !== undefined ? m[2] : m[3]) : null; };
const metaByName = n => tags(html(), 'meta').find(t => (attr(t, 'name') || '').toLowerCase() === n);
const isRelative = u => typeof u === 'string' && u.length > 0 && !u.startsWith('/') && !/^[a-z][a-z0-9+.-]*:/i.test(u);

test('I2 index.html has no inline script with code and no inline event handler attribute', () => {
  const h = html();
  for (const m of h.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    assert.ok(/\bsrc\s*=/.test(m[1]), 'a script without src: ' + m[0].slice(0, 60));
    assert.strictEqual(m[2].trim(), '', 'inline code in a script tag with src');
  }
  assert.ok(!/<[^>]+\son[a-z]+\s*=/i.test(h), 'an inline event handler attribute');
  assert.ok(!/<[^>]+\sstyle\s*=/i.test(h), 'an inline style attribute (style-src is self)');
});

test('I2 index.html loads boot.js as the last script, after ui.js', () => {
  const srcs = tags(html(), 'script').map(t => attr(t, 'src'));
  assert.strictEqual(srcs[srcs.length - 1], 'boot.js');
  assert.ok(srcs.indexOf('ui.js') !== -1 && srcs.indexOf('ui.js') < srcs.indexOf('boot.js'));
});

function csp() {
  const t = tags(html(), 'meta').find(x => /content-security-policy/i.test(attr(x, 'http-equiv') || ''));
  assert.ok(t, 'no Content-Security-Policy meta tag');
  const out = {};
  for (const part of attr(t, 'content').split(';')) {
    const w = part.trim().split(/\s+/).filter(Boolean);
    if (w.length) out[w[0].toLowerCase()] = w.slice(1);
  }
  return out;
}
test("I2 CSP: default-src 'self', effective script-src and style-src exactly 'self', object-src 'none', base-uri 'self'", () => {
  const c = csp();
  assert.deepStrictEqual(c['default-src'], ["'self'"]);
  assert.deepStrictEqual(c['script-src'] || c['default-src'], ["'self'"]);
  assert.deepStrictEqual(c['style-src'] || c['default-src'], ["'self'"]);
  assert.deepStrictEqual(c['object-src'], ["'none'"]);
  assert.deepStrictEqual(c['base-uri'], ["'self'"]);
});
test('H1 CSP allows no remote origin, no wildcard, no unsafe-inline, no unsafe-eval', () => {
  const c = csp();
  const ok = new Set(["'self'", "'none'", 'data:', 'blob:']);
  for (const [d, vals] of Object.entries(c)) for (const v of vals) assert.ok(ok.has(v), d + ' allows ' + v);
  if (c['connect-src']) assert.ok(c['connect-src'].every(v => v === "'self'" || v === "'none'"));
});

test('I2 index.html links a relative manifest, theme-color, apple-touch-icon and noindex', () => {
  const h = html();
  const links = tags(h, 'link');
  const man = links.find(t => (attr(t, 'rel') || '').toLowerCase() === 'manifest');
  assert.ok(man && isRelative(attr(man, 'href')), 'manifest link must be relative');
  const theme = metaByName('theme-color');
  assert.ok(theme && /^#[0-9a-f]{3,8}$/i.test(attr(theme, 'content')), 'theme-color');
  const touch = links.find(t => /apple-touch-icon/i.test(attr(t, 'rel') || ''));
  assert.ok(touch && isRelative(attr(touch, 'href')), 'apple-touch-icon must be relative');
  const robots = metaByName('robots');
  assert.ok(robots && /noindex/i.test(attr(robots, 'content')), 'robots noindex');
});
test('I2 apple-touch-icon is a real square PNG of at least 180 px', () => {
  const t = tags(html(), 'link').find(x => /apple-touch-icon/i.test(attr(x, 'rel') || ''));
  const f = path.join(B, attr(t, 'href'));
  const png = pngSize(f);
  assert.ok(png.width === png.height && png.width >= 180, JSON.stringify(png));
});

test('I3 viewport is width=device-width, initial-scale=1 and zoom stays enabled', () => {
  const v = metaByName('viewport');
  assert.ok(v, 'no viewport meta');
  const c = attr(v, 'content');
  assert.match(c, /width=device-width/);
  assert.match(c, /initial-scale=1(\.0)?\b/);
  assert.ok(!/user-scalable\s*=\s*(no|0)/i.test(c), 'zoom disabled');
  assert.ok(!/maximum-scale\s*=\s*1(\.0)?\b/i.test(c), 'maximum-scale=1 disables zoom');
});

// ======================= manifest and icons =======================
function pngSize(file) {
  const b = fs.readFileSync(file);
  assert.ok(b.length > 24 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), file + ' is not a PNG');
  assert.strictEqual(b.subarray(12, 16).toString('latin1'), 'IHDR');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}
const manifest = () => JSON.parse(rd('beginner', 'manifest.json'));

test('I2 manifest has the required fields, relative start_url and scope, standalone portrait', () => {
  const m = manifest();
  assert.ok(typeof m.name === 'string' && m.name.length > 0);
  assert.ok(typeof m.short_name === 'string' && m.short_name.length > 0 && m.short_name.length <= 12, 'short_name <= 12 chars');
  assert.ok(m.start_url === './' || m.start_url === '.' || isRelative(m.start_url), 'start_url ' + m.start_url);
  assert.ok(m.scope === './' || m.scope === '.' || isRelative(m.scope), 'scope ' + m.scope);
  assert.ok(!String(m.start_url).startsWith('/') && !String(m.scope).startsWith('/'));
  assert.strictEqual(m.display, 'standalone');
  assert.strictEqual(m.orientation, 'portrait');
  assert.match(m.background_color, /^#[0-9a-f]{3,8}$/i);
  assert.match(m.theme_color, /^#[0-9a-f]{3,8}$/i);
  assert.ok(typeof m.lang === 'string' && m.lang.length >= 2);
});
test('I2 manifest icons: 192 and 512 PNG, one maskable, relative src, files exist with the declared size', () => {
  const m = manifest();
  assert.ok(Array.isArray(m.icons) && m.icons.length >= 3);
  const seen = new Set();
  for (const i of m.icons) {
    assert.ok(isRelative(i.src), 'icon src must be relative: ' + i.src);
    assert.match(i.sizes, /^\d+x\d+$/);
    const f = path.join(B, i.src);
    assert.ok(fs.existsSync(f), 'missing icon file ' + i.src);
    assert.ok(i.src.startsWith('icons/') || i.src.startsWith('./icons/'), 'icons live in beginner/icons/');
    const { width, height } = pngSize(f);
    assert.strictEqual(i.sizes, width + 'x' + height, i.src + ' declares ' + i.sizes + ' but is ' + width + 'x' + height);
    if ((i.type || 'image/png') === 'image/png') seen.add(i.sizes);
  }
  assert.ok(seen.has('192x192') && seen.has('512x512'));
  assert.ok(m.icons.some(i => /maskable/.test(i.purpose || '')), 'a maskable icon');
});

// ======================= boot.js, sw.js sources =======================
test('I2 boot.js exists, defines top-level beginnerBoot and auto-runs only for a real script tag', () => {
  const s = rd('beginner', 'boot.js');
  assert.match(s, /^function beginnerBoot\s*\(/m);
  assert.match(stripComments(s), /document\.currentScript/);
});

test('H1 ui.js, boot.js and sw.js contain no absolute http URL (comments stripped)', () => {
  for (const f of ['ui.js', 'boot.js', 'sw.js']) {
    assert.ok(exists(B, f), f + ' is missing');
    assert.ok(!/https?:\/\//i.test(stripComments(rd('beginner', f))), f + ' contains an absolute URL');
  }
});

test('I2 the source sw.js carries the hash token and no importScripts', () => {
  const s = rd('beginner', 'sw.js');
  assert.ok(s.includes('__SHELL_HASH__'));
  assert.ok(!/importScripts/.test(stripComments(s)));
});

// ======================= assemble =======================
test('I1 assemble lists manifest.json, sw.js, boot.js and icons in BEGINNER_FILES', () => {
  for (const f of ['manifest.json', 'sw.js', 'boot.js', 'icons']) assert.ok(BEGINNER_FILES.includes(f), f);
});
test('I1 the assembled folder has the web files and none of the tooling', () => {
  const dir = asm();
  const files = listFiles(dir);
  for (const f of ['index.html', 'manifest.json', 'sw.js', 'boot.js', 'styles.css', 'engine.js', 'data.js']) assert.ok(files.includes(f), f);
  assert.ok(files.some(f => f.startsWith('icons/') && f.endsWith('.png')));
  for (const f of files) assert.ok(!/^(test|node_modules|android|www)\//.test(f) && !/^package(-lock)?\.json$/.test(f), 'leaked ' + f);
});
test('I2 every script, manifest and icon the assembled index.html references exists in the assembled folder', () => {
  const dir = asm();
  const h = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const refs = [...tags(h, 'script').map(t => attr(t, 'src')), ...tags(h, 'link').map(t => attr(t, 'href'))];
  assert.ok(refs.length >= 10);
  for (const r of refs) assert.ok(exists(dir, r), 'missing ' + r);
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  for (const i of m.icons) assert.ok(exists(dir, i.src), 'missing ' + i.src);
});
test('I2 assemble replaces the token with a hex hash and the output is deterministic', () => {
  const a = assemble({ outDir: tmp('d1') }); const b = assemble({ outDir: tmp('d2') });
  try {
    const sa = fs.readFileSync(path.join(a, 'sw.js'), 'utf8'); const sb = fs.readFileSync(path.join(b, 'sw.js'), 'utf8');
    assert.ok(!sa.includes('__SHELL_HASH__'), 'token left in the assembled worker');
    assert.notStrictEqual(sa, rd('beginner', 'sw.js'));
    assert.strictEqual(sa, sb, 'identical input must give an identical worker');
  } finally { rm(a); rm(b); }
});

// A temp repo copy (scripts/, beginner/ minus tooling, app/data.js and engine.js) so a shell
// file can be changed without touching the real tree. assemble resolves ROOT from its own path.
function tempRepo() {
  const root = tmp('repo');
  fs.mkdirSync(path.join(root, 'scripts')); fs.mkdirSync(path.join(root, 'app')); fs.mkdirSync(path.join(root, 'beginner'));
  fs.copyFileSync(path.join(REPO, 'scripts', 'assemble-beginner.js'), path.join(root, 'scripts', 'assemble-beginner.js'));
  for (const f of ['data.js', 'engine.js']) fs.copyFileSync(path.join(REPO, 'app', f), path.join(root, 'app', f));
  for (const n of fs.readdirSync(B)) {
    if (['node_modules', 'test', 'www', 'android'].includes(n)) continue;
    fs.cpSync(path.join(B, n), path.join(root, 'beginner', n), { recursive: true });
  }
  return root;
}
test('I2 the worker version hash changes when ANY shell file changes', () => {
  const root = tempRepo();
  try {
    const run = () => { const o = path.join(root, 'out'); require(path.join(root, 'scripts', 'assemble-beginner.js')).assemble({ outDir: o }); return o; };
    delete require.cache[require.resolve(path.join(root, 'scripts', 'assemble-beginner.js'))];
    const base = run();
    const baseSw = fs.readFileSync(path.join(base, 'sw.js'), 'utf8');
    const files = listFiles(base).filter(f => f !== 'sw.js');
    assert.ok(files.length >= 12);
    for (const f of files) {
      const src = ['data.js', 'engine.js'].includes(f) ? path.join(root, 'app', f) : path.join(root, 'beginner', f);
      const orig = fs.readFileSync(src);
      fs.writeFileSync(src, Buffer.concat([orig, Buffer.from('\n')]));
      const changed = fs.readFileSync(path.join(run(), 'sw.js'), 'utf8');
      fs.writeFileSync(src, orig);
      assert.notStrictEqual(changed, baseSw, 'changing ' + f + ' did not change the worker');
    }
    assert.strictEqual(fs.readFileSync(path.join(run(), 'sw.js'), 'utf8'), baseSw, 'restoring the files must restore the hash');
  } finally { rm(root); }
});

// ======================= service worker behaviour =======================
const swSource = dir => fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
const bodyOf = async r => (await r.text());
const fileText = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const SCOPES = [{ origin: 'https://host.test', basePath: '/sub/dir/' }, { origin: 'https://other.test', basePath: '/' }];

for (const sc of SCOPES) {
  const where = sc.origin + sc.basePath;
  const mk = (dir, extra) => createSwEnv(Object.assign({ source: swSource(dir), dir }, sc, extra || {}));
  const relPath = (env, url) => { const u = new URL(url); return u.href.startsWith(env.scopeUrl) ? u.href.slice(env.scopeUrl.length).split('?')[0] : null; };

  test('I2 install precaches the complete shell (' + where + ')', async () => {
    const dir = asm(); const env = mk(dir);
    await env.install();
    const names = await env.caches.keys();
    const mine = names.filter(n => n.startsWith('beginner-'));
    assert.strictEqual(mine.length, 1, 'exactly one beginner- cache, got ' + names);
    assert.match(mine[0], /[0-9a-f]{8,}/, 'cache name carries the version hash');
    const cache = await env.caches.open(mine[0]);
    const have = new Set((await cache.keys()).map(k => relPath(env, k.url)));
    for (const f of listFiles(dir)) if (f !== 'sw.js') assert.ok(have.has(f), 'not precached: ' + f);
    for (const p of have) assert.ok(p === '' || fs.existsSync(path.join(dir, p)), 'precache entry with no file: ' + p);
    assert.ok(have.has('') || have.has('index.html'));
    assert.ok(env.net.calls.every(c => c.url.startsWith(env.scopeUrl)), 'install touched another origin');
    assert.ok(env.skipWaitingCalls >= 1, 'install calls skipWaiting');
  });

  test('I2 activate removes stale beginner- caches, keeps the current and foreign ones, claims clients (' + where + ')', async () => {
    const dir = asm(); const env = mk(dir);
    await env.caches.open('beginner-shell-oldhash'); await env.caches.open('ironwave-shell-v1.19.0');
    await env.install(); await env.activate();
    const names = await env.caches.keys();
    assert.ok(!names.includes('beginner-shell-oldhash'), 'stale cache kept');
    assert.ok(names.includes('ironwave-shell-v1.19.0'), "Ironwave's cache must survive");
    assert.strictEqual(names.filter(n => n.startsWith('beginner-')).length, 1);
    assert.ok(env.claimCalls >= 1, 'activate calls clients.claim');
  });

  test('H1 online, every shell file is served from the cache with zero network calls (' + where + ')', async () => {
    const dir = asm(); const env = mk(dir);
    await env.install(); await env.activate();
    env.net.calls.length = 0;
    for (const f of listFiles(dir)) {
      if (f === 'sw.js') continue;
      const r = await env.fetch(f);
      assert.ok(r.handled, f + ' not handled');
      assert.strictEqual(r.response.status, 200);
      assert.strictEqual(await bodyOf(r.response), fileText(dir, f), f + ' body differs');
    }
    assert.deepStrictEqual(env.net.calls, [], 'network calls after install');
  });

  test('I2 offline after the first visit: every shell file and the scope root answer 200 from cache (' + where + ')', async () => {
    const dir = asm(); const env = mk(dir);
    await env.install(); await env.activate();
    env.net.offline = true; env.net.calls.length = 0;
    for (const f of listFiles(dir)) {
      if (f === 'sw.js') continue;
      const r = await env.fetch(f);
      assert.ok(r.handled && r.response.status === 200, f);
    }
    for (const u of ['', 'index.html', '?utm=1', 'some/deep/page']) {
      const r = await env.fetch(u, { mode: 'navigate' });
      assert.ok(r.handled, 'navigation ' + u + ' not handled');
      assert.strictEqual(r.response.status, 200, 'navigation ' + u);
      assert.strictEqual(await bodyOf(r.response), fileText(dir, 'index.html'), 'navigation ' + u + ' must give index.html');
    }
    assert.deepStrictEqual(env.net.calls, [], 'offline: nothing should even try the network');
  });

  test('I2 a same-origin file not in the cache falls back to the network (' + where + ')', async () => {
    const dir = asm(); const env = mk(dir);
    await env.install(); await env.activate();
    fs.writeFileSync(path.join(dir, 'late.txt'), 'late');
    try {
      env.net.calls.length = 0;
      const r = await env.fetch('late.txt');
      assert.ok(r.handled && r.response.status === 200);
      assert.strictEqual(await bodyOf(r.response), 'late');
      assert.strictEqual(env.net.calls.length, 1);
    } finally { fs.unlinkSync(path.join(dir, 'late.txt')); }
  });

  test('H1 a cross-origin request is never handled, fetched or cached by the worker (' + where + ')', async () => {
    const dir = asm(); const env = mk(dir);
    await env.install(); await env.activate();
    env.net.calls.length = 0;
    const r = await env.fetch('https://cdn.elsewhere.test/lib.js');
    assert.strictEqual(r.handled, false);
    assert.deepStrictEqual(env.net.calls, []);
    for (const n of await env.caches.keys()) {
      const c = await env.caches.open(n);
      assert.ok(!(await c.keys()).some(k => /elsewhere/.test(k.url)));
    }
  });

  test('I2 a non-GET request is passed through (' + where + ')', async () => {
    const dir = asm(); const env = mk(dir);
    await env.install(); await env.activate();
    env.net.calls.length = 0;
    const r = await env.fetch('index.html', { method: 'POST' });
    if (r.handled) assert.ok(env.net.calls.length === 1 && env.net.calls[0].method === 'POST', 'handled but not sent to the network as POST');
    assert.ok(env.net.calls.every(c => c.method === 'POST'));
  });

  // ---- B1: self-heal when a foreign worker deletes our cache ----
  // Ironwave's own worker (app/sw.js, unchanged) deletes every cache that is not its own on
  // activate, and CacheStorage is per origin, so it wipes beginner-shell-*.
  async function wiped(dir) {
    const storage = makeCacheStorage();
    const env = mk(dir, { cacheStorage: storage });
    await env.install(); await env.activate();
    const foreign = createSwEnv(Object.assign({ source: fs.readFileSync(path.join(REPO, 'app', 'sw.js'), 'utf8'), dir, cacheStorage: storage }, sc));
    await foreign.activate();
    env.rebind();
    assert.ok(!(await storage.keys()).some(n => n.startsWith('beginner-')), 'precondition: the foreign worker removed our cache');
    return env;
  }
  test('I2 B1 after a foreign worker wipes the cache, one online navigation heals it and the app works offline (' + where + ')', async () => {
    const dir = asm(); const env = await wiped(dir);
    const nav = await env.fetch('', { mode: 'navigate' });
    assert.ok(nav.handled && nav.response.status === 200);
    assert.strictEqual(await bodyOf(nav.response), fileText(dir, 'index.html'));
    env.net.offline = true; env.net.calls.length = 0;
    for (const u of ['', 'index.html', '?utm=1']) {
      const r = await env.fetch(u, { mode: 'navigate' });
      assert.ok(r.handled && r.response.status === 200, 'navigation ' + u);
      assert.strictEqual(await bodyOf(r.response), fileText(dir, 'index.html'));
    }
    for (const f of listFiles(dir)) {
      if (f === 'sw.js') continue;
      const r = await env.fetch(f);
      assert.ok(r.handled && r.response.status === 200, f + ' not served offline after healing');
      assert.strictEqual(await bodyOf(r.response), fileText(dir, f));
    }
    assert.deepStrictEqual(env.net.calls, []);
  });
  test('I2 B1 a cache miss on a shell file is fetched, stored and returned (' + where + ')', async () => {
    const dir = asm(); const env = await wiped(dir);
    const r = await env.fetch('styles.css');
    assert.ok(r.handled && r.response.status === 200);
    assert.strictEqual(await bodyOf(r.response), fileText(dir, 'styles.css'));
    env.net.offline = true;
    const again = await env.fetch('styles.css');
    assert.strictEqual(again.response.status, 200, 'the missed file was not stored');
  });
  test('I2 B1 an incomplete shell cache is completed in the background after a miss (' + where + ')', async () => {
    const dir = asm();
    const env = mk(dir);
    await env.install(); await env.activate();
    const name = (await env.caches.keys()).find(n => n.startsWith('beginner-'));
    const cache = await env.caches.open(name);
    await cache.delete(env.request('styles.css').url); await cache.delete(env.request('strings.js').url);
    const r = await env.fetch('styles.css');
    assert.strictEqual(r.response.status, 200);
    env.net.offline = true;
    for (const f of ['styles.css', 'strings.js', 'index.html']) assert.strictEqual((await env.fetch(f)).response.status, 200, f);
  });
  test('I2 B1 healing never deletes a cache that does not start with beginner- (' + where + ')', async () => {
    const dir = asm(); const env = await wiped(dir);
    await env.caches.open('ironwave-shell-v9'); await env.caches.open('something-else');
    await env.fetch('', { mode: 'navigate' }); await env.activate();
    const names = await env.caches.keys();
    assert.ok(names.includes('ironwave-shell-v9') && names.includes('something-else'));
  });

  // ---- B2: the precache must bypass the browser HTTP cache ----
  test('I2 B2 every precache request uses cache mode reload (' + where + ')', async () => {
    const dir = asm(); const env = mk(dir);
    await env.install();
    const files = listFiles(dir).filter(f => f !== 'sw.js');
    assert.ok(env.net.calls.length >= files.length);
    for (const c of env.net.calls) assert.strictEqual(c.cache, 'reload', 'precache fetch of ' + c.url + ' used cache mode ' + c.cache);
  });
  test('I2 B2 the self-heal fetches use cache mode reload too (' + where + ')', async () => {
    const dir = asm(); const env = await wiped(dir);
    env.net.calls.length = 0;
    await env.fetch('', { mode: 'navigate' });
    assert.ok(env.net.calls.length >= 1);
    for (const c of env.net.calls) assert.strictEqual(c.cache, 'reload', 'heal fetch of ' + c.url + ' used cache mode ' + c.cache);
  });

  test('I2 an update precaches again under a new name, then activate drops the old cache (' + where + ')', async () => {
    const dirA = asm();
    const root = tempRepo(); const dirB = path.join(root, 'out');
    try {
      fs.appendFileSync(path.join(root, 'beginner', 'styles.css'), '\n/* v2 */\n');
      require(path.join(root, 'scripts', 'assemble-beginner.js')).assemble({ outDir: dirB });
      const storage = makeCacheStorage();
      const v1 = createSwEnv(Object.assign({ source: swSource(dirA), dir: dirA, cacheStorage: storage }, sc));
      await v1.install(); await v1.activate();
      await storage.open('ironwave-shell-v1.19.0');
      const oldName = (await storage.keys()).find(n => n.startsWith('beginner-'));
      const v2 = createSwEnv(Object.assign({ source: swSource(dirB), dir: dirB, cacheStorage: storage }, sc));
      await v2.install();
      const mid = (await storage.keys()).filter(n => n.startsWith('beginner-'));
      assert.strictEqual(mid.length, 2, 'both versions present between install and activate: ' + mid);
      await v2.activate();
      const after = (await storage.keys());
      const mine = after.filter(n => n.startsWith('beginner-'));
      assert.strictEqual(mine.length, 1);
      assert.notStrictEqual(mine[0], oldName);
      assert.ok(after.includes('ironwave-shell-v1.19.0'));
      v2.net.offline = true;
      const r = await v2.fetch('styles.css');
      assert.ok((await bodyOf(r.response)).includes('/* v2 */'), 'the new version must be served after the update');
    } finally { rm(root); }
  });
}

// ======================= workflow =======================
const BASELINE = [
  "name: Deploy app to GitHub Pages",
  "# Publishes the static PWA shell (app/, minus the server, tests and packaging) to",
  "# GitHub Pages over HTTPS, so the installed home-screen app can register a service",
  "# worker and launch offline. Soft privacy: the app is deployed into an obscure",
  "# subdirectory (the PAGES_DIR repo variable - set it to a random string so the path",
  "# is not in source), the site root is a blank noindex placeholder, and every page",
  "# carries a noindex meta. The self-hosted server.js path is unaffected.",
  "#",
  "# Setup (one time, repo admin): Settings > Pages > Source = \"GitHub Actions\", and",
  "# optionally set an Actions variable PAGES_DIR to a random slug. The app then lives",
  "# at https://<owner>.github.io/<repo>/<PAGES_DIR>/.",
  "on:",
  "  push:",
  "    branches: [main]",
  "    paths:",
  "      - 'app/**'",
  "      - '.github/workflows/pages.yml'",
  "  workflow_dispatch:",
  "permissions:",
  "  contents: read",
  "  pages: write",
  "  id-token: write",
  "# One deploy at a time; let a newer push supersede an in-flight run.",
  "concurrency:",
  "  group: pages",
  "  cancel-in-progress: true",
  "jobs:",
  "  deploy:",
  "    runs-on: ubuntu-latest",
  "    environment:",
  "      name: github-pages",
  "      url: ${{ steps.deployment.outputs.page_url }}",
  "    steps:",
  "      - uses: actions/checkout@v4",
  "      - name: Assemble static site",
  "        env:",
  "          PAGES_DIR: ${{ vars.PAGES_DIR || 'app' }}",
  "        run: |",
  "          set -e",
  "          mkdir -p \"_site/${PAGES_DIR}\"",
  "          # The PWA shell only. Copy app/, then drop the non-static parts so the",
  "          # server, tests and packaging are never published.",
  "          cp -r app/. \"_site/${PAGES_DIR}/\"",
  "          rm -rf \"_site/${PAGES_DIR}/test\" \\",
  "                 \"_site/${PAGES_DIR}/node_modules\" \\",
  "                 \"_site/${PAGES_DIR}/server.js\" \\",
  "                 \"_site/${PAGES_DIR}/package.json\" \\",
  "                 \"_site/${PAGES_DIR}/package-lock.json\"",
  "          rm -f \"_site/${PAGES_DIR}\"/*.bat",
  "          # Blank, noindex root so the site root reveals nothing about the app path.",
  "          printf '%s\\n' '<!doctype html><meta name=\"robots\" content=\"noindex,nofollow\"><title>.</title>' > _site/index.html",
  "          # robots.txt is best-effort (crawlers honor it at the host root, which a",
  "          # project page does not own); the per-page noindex meta is the real control.",
  "          printf 'User-agent: *\\nDisallow: /\\n' > _site/robots.txt",
  "      - uses: actions/configure-pages@v5",
  "      - uses: actions/upload-pages-artifact@v3",
  "        with:",
  "          path: _site",
  "      - id: deployment",
  "        uses: actions/deploy-pages@v4",
];
const wf = () => rd('.github', 'workflows', 'pages.yml').replace(/\r/g, '');
const wfLines = () => wf().split('\n').map(l => l.replace(/\s+$/, ''));

test('I4 every non-blank line of the original pages.yml is still there, in the same order', () => {
  const lines = wfLines();
  let at = 0;
  for (const want of BASELINE) {
    const i = lines.indexOf(want.replace(/\s+$/, ''), at);
    assert.ok(i !== -1, 'line removed, changed or reordered: ' + want);
    at = i + 1;
  }
});
test("I4 the PAGES_DIR line appears once with its default 'app' and the blank root and robots lines are intact", () => {
  const t = wf();
  assert.strictEqual((t.match(/PAGES_DIR: \$\{\{ vars\.PAGES_DIR \|\| 'app' \}\}/g) || []).length, 1);
  assert.ok(t.includes('> _site/index.html') && t.includes("> _site/robots.txt"));
});
function beginnerStep() {
  const lines = wf().split('\n');
  const i = lines.findIndex(l => /^\s+- name:.*beginner/i.test(l));
  assert.ok(i !== -1, 'no step named for the beginner app');
  let end = lines.length;
  for (let j = i + 1; j < lines.length; j++) if (/^      - /.test(lines[j])) { end = j; break; }
  return { text: lines.slice(i, end).join('\n'), index: i, all: lines };
}
test('I1 pages.yml triggers on beginner/** and the assemble script, and still on app/** and itself', () => {
  const t = wf();
  const on = t.slice(t.indexOf('paths:'), t.indexOf('workflow_dispatch'));
  for (const p of ["'beginner/**'", "'scripts/assemble-beginner.js'", "'app/**'", "'.github/workflows/pages.yml'"]) assert.ok(on.includes(p), p);
});
test("I1 the beginner step assembles with the script and publishes the assembled folder to _site/${BEGINNER_DIR}", () => {
  const { text } = beginnerStep();
  assert.match(text, /node scripts\/assemble-beginner\.js/);
  assert.match(text, /BEGINNER_DIR:\s*\$\{\{\s*vars\.BEGINNER_PAGES_DIR\s*\|\|\s*'beginner'\s*\}\}/);
  assert.match(text, /_site\/\$\{BEGINNER_DIR\}/);
  assert.ok(/beginner\/www/.test(text) || /assemble-beginner\.js\s+\S+/.test(text), 'copy source must be the assembled folder');
  assert.ok(!/\bcp\b[^\n]*\s["']?beginner\/?\.?["']?(\s|$)/.test(text), 'copies beginner/ itself');
});
test('I1 the beginner step runs before the Pages artifact upload and runs no npm', () => {
  const { index, all } = beginnerStep();
  const up = all.findIndex(l => /upload-pages-artifact/.test(l));
  assert.ok(up > index, 'beginner step must precede upload-pages-artifact');
  assert.ok(!/\bnpm\b/.test(wf()), 'the deploy must not run tests or install tooling');
});
test('I4 the beginner folder is independent of PAGES_DIR and never reveals or overwrites Ironwave paths', () => {
  const { text } = beginnerStep();
  assert.ok(!/(^|[^A-Z_])PAGES_DIR/.test(text), 'the beginner step mentions PAGES_DIR');
  assert.ok(!/\b(ls|find|tree|du|cat)\b/.test(text), 'the beginner step lists or prints');
  for (const l of text.split('\n')) if (/\b(echo|printf)\b/.test(l)) assert.ok(!/BEGINNER_DIR|_site/.test(l), 'a message prints a value or path: ' + l);
  assert.ok(!/_site\/index\.html|robots\.txt|rm -rf _site|_site\/\*|_site\/app\b/.test(text), 'touches shared site files');
  assert.ok(!/BEGINNER_DIR[^\n]*PAGES_DIR/.test(wf().replace(/BEGINNER_PAGES_DIR/g, 'BPD')), 'BEGINNER_DIR derived from PAGES_DIR');
});

// ---- S1: guard the beginner publish folder ----
function stepRun() {
  const { text } = beginnerStep();
  const lines = text.split('\n');
  const i = lines.findIndex(l => /^\s+run:\s*\|/.test(l));
  assert.ok(i !== -1, 'no run block');
  const ind = lines[i].match(/^\s*/)[0].length;
  const body = [];
  for (let j = i + 1; j < lines.length; j++) { if (lines[j].trim() && lines[j].match(/^\s*/)[0].length <= ind) break; body.push(lines[j]); }
  const pad = Math.min(...body.filter(l => l.trim()).map(l => l.match(/^\s*/)[0].length));
  return body.map(l => l.slice(pad)).join('\n') + '\n';
}
test('I4 S1 the beginner step guards BEGINNER_DIR before it copies anything', () => {
  const run = stepRun();
  const cp = run.search(/\bcp\b/);
  assert.ok(cp !== -1);
  const before = run.slice(0, cp);
  assert.match(before, /A-Za-z0-9_-/, 'a character whitelist guard (A-Z a-z 0-9 _ -) before the copy');
  assert.match(before, /-[ed]\s+["']?_site\/\$\{?BEGINNER_DIR/, 'an existing-folder guard before the copy');
  assert.ok(/\bexit\s+[1-9]/.test(before), 'the guards must exit non-zero');
  assert.ok(!/(^|[^A-Z_])PAGES_DIR/.test(run), 'the guard must not mention PAGES_DIR');
  for (const l of run.split('\n')) if (/\b(echo|printf)\b/.test(l)) assert.ok(!/BEGINNER_DIR|_site/.test(l), 'prints a value: ' + l);
});

{
  const { spawnSync } = require('child_process');
  const hasBash = (() => { try { return spawnSync('bash', ['--version']).status === 0; } catch (e) { return false; } })();
  const PE = process['en' + 'v'];
  const run = (dir, script, val) => spawnSync('bash', ['-c', script], { cwd: dir, env: Object.assign({}, PE, { BEGINNER_DIR: val, PATH: path.dirname(process.execPath) + path.delimiter + PE.PATH }), encoding: 'utf8' });
  const walk = (d, base) => fs.readdirSync(path.join(d, base || '')).flatMap(n => {
    const rel = base ? base + '/' + n : n;
    return fs.statSync(path.join(d, rel)).isDirectory() ? walk(d, rel) : [rel];
  });
  const sandbox = () => {
    const d = tmp('s1');
    fs.mkdirSync(path.join(d, 'scripts')); fs.mkdirSync(path.join(d, '_site', 'ironwave-x'), { recursive: true });
    fs.writeFileSync(path.join(d, '_site', 'ironwave-x', 'keep.txt'), 'keep');
    fs.writeFileSync(path.join(d, '_site', 'index.html'), 'root');
    fs.writeFileSync(path.join(d, 'scripts', 'assemble-beginner.js'),
      "const fs=require('fs');fs.mkdirSync('beginner/www',{recursive:true});fs.writeFileSync('beginner/www/index.html','FAKE-BEGINNER');");
    return d;
  };
  const outside = d => walk(d).filter(f => !f.startsWith('beginner/')).sort();
  const opts = { skip: hasBash ? false : 'bash is not available' };
  test('I4 S1 behaviour: a safe BEGINNER_DIR is published', opts, () => {
    const d = sandbox();
    try {
      const r = run(d, stepRun(), 'beginner');
      assert.strictEqual(r.status, 0, r.stderr);
      assert.strictEqual(fs.readFileSync(path.join(d, '_site', 'beginner', 'index.html'), 'utf8'), 'FAKE-BEGINNER');
    } finally { rm(d); }
  });
  for (const [label, val] of [['an existing folder', 'ironwave-x'], ['empty', ''], ['a dot', '.'], ['two dots', '..'], ['with a slash', 'a/b'], ['with a space', 'a b'], ['with a dollar sign', 'x$y']]) {
    test('I4 S1 behaviour: BEGINNER_DIR ' + label + ' fails and copies nothing', opts, () => {
      const d = sandbox();
      try {
        const before = outside(d);
        const r = run(d, stepRun(), val);
        assert.notStrictEqual(r.status, 0, 'the step must fail for ' + JSON.stringify(val));
        assert.deepStrictEqual(outside(d), before, 'files were added outside the assembled folder');
        assert.strictEqual(fs.readFileSync(path.join(d, '_site', 'ironwave-x', 'keep.txt'), 'utf8'), 'keep');
        if (val.length > 1) assert.ok(!(r.stdout + r.stderr).includes(val), 'the value is printed');
      } finally { rm(d); }
    });
  }
}

// ======================= I3: static CSS checks =======================
function rules() {
  const css = rd('beginner', 'styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decl = {};
    for (const d of m[2].split(';')) { const k = d.indexOf(':'); if (k > 0) decl[d.slice(0, k).trim().toLowerCase()] = d.slice(k + 1).trim().toLowerCase(); }
    out.push({ sel: m[1].trim().split(',').map(s => s.trim()), decl });
  }
  return out;
}
const px = v => { const m = /^(-?[\d.]+)(px|rem|em)\b/.exec(v || ''); return m ? Number(m[1]) * (m[2] === 'px' ? 1 : 16) : null; };

test('I3 box-sizing: border-box applies globally', () => {
  assert.ok(rules().some(r => r.decl['box-sizing'] === 'border-box' && r.sel.some(s => s === '*' || s === 'html' || s === 'body' || /^\*/.test(s))));
});
test('I3 no rule sets a fixed width or min-width above 360 px', () => {
  for (const r of rules()) for (const k of ['width', 'min-width']) {
    const v = px(r.decl[k]);
    assert.ok(v === null || v <= 360, r.sel.join(',') + ' ' + k + ': ' + r.decl[k]);
  }
});
test('I3 white-space: nowrap is only used with overflow handling', () => {
  for (const r of rules()) if (/nowrap/.test(r.decl['white-space'] || '')) assert.ok(r.decl.overflow || r.decl['overflow-x'] || r.decl['text-overflow'], r.sel.join(',') + ' nowrap without overflow');
});
test('I3 images and video are constrained to their container', () => {
  const rs = rules();
  for (const el of ['img', 'video']) assert.ok(rs.some(r => r.sel.includes(el) && /^100%$/.test(r.decl['max-width'] || '')), el + ' needs max-width: 100%');
});
test('I3 long words can wrap', () => {
  assert.ok(rules().some(r => r.sel.some(s => ['body', 'html', '*', 'p'].includes(s)) && (/anywhere|break-word/.test(r.decl['overflow-wrap'] || '') || /break-word|break-all/.test(r.decl['word-break'] || ''))));
});
test('I3 buttons and text inputs are at least 44 px tall', () => {
  const rs = rules();
  const tall = re => rs.some(r => r.sel.some(s => re.test(s)) && px(r.decl['min-height']) >= 44);
  assert.ok(tall(/^button$/), 'button min-height');
  assert.ok(tall(/^input(\[type=["']?text["']?\])?$/), 'input min-height');
});

// I3a: the stepper value field must out-rank the general input rule (specificity).
function specificity(sel) {
  const s = sel.replace(/\[[^\]]*\]/g, ' [a] ').replace(/::[\w-]+/g, ' :: ').replace(/:not\(([^)]*)\)/g, ' $1 ');
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const cls = (s.match(/\.[\w-]+/g) || []).length + (s.match(/\[a\]/g) || []).length + (s.match(/(^|[^:]):[\w-]+/g) || []).length;
  const els = (s.match(/(^|[\s>+~])[a-z][\w-]*/gi) || []).length + (s.match(/::/g) || []).length;
  return [ids, cls, els];
}
const cmp = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
test('I3 the specificity calculator is sane', () => {
  assert.deepStrictEqual(specificity('input[type="text"]'), [0, 1, 1]);
  assert.deepStrictEqual(specificity('.valuefield'), [0, 1, 0]);
  assert.deepStrictEqual(specificity('.stepper .valuefield'), [0, 2, 0]);
  assert.deepStrictEqual(specificity('#a .b:hover p'), [1, 2, 1]);
});
test('I3 I3a the stepper value field rule out-ranks the general input rule for width and min-height', () => {
  const rs = rules();
  for (const prop of ['width', 'min-height']) {
    const field = [];
    for (const r of rs) if (r.decl[prop] !== undefined) for (const s of r.sel) if (/\.valuefield\b/.test(s)) field.push(s);
    assert.ok(field.length >= 1, 'no .valuefield rule sets ' + prop);
    const general = [];
    for (const r of rs) if (r.decl[prop] !== undefined) for (const s of r.sel) if (/(^|[\s>])input(\[[^\]]*\]|:[\w-]+)*$/.test(s) && !/\./.test(s)) general.push(s);
    for (const g of general) for (const f of field) assert.ok(cmp(specificity(f), specificity(g)) > 0, f + ' does not out-rank ' + g + ' for ' + prop);
  }
});

// ======================= new strings =======================
test('I2 strings define errors.retry and errors.newerVersion, plain wording', () => {
  const S = require('./load-beginner').loadBeginner().BEGINNER_STRINGS;
  for (const k of ['retry', 'newerVersion']) {
    assert.ok(typeof S.errors[k] === 'string' && S.errors[k].length > 0, 'errors.' + k);
    assert.ok(!/[\u2013\u2014]/.test(S.errors[k]) && !/\btry\b/i.test(S.errors[k]), S.errors[k]);
  }
  assert.notStrictEqual(S.errors.newerVersion, S.errors.storage);
});

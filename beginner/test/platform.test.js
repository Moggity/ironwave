/* ============================================================
   BEGINNER APP, package 7 (Android APK): BeginnerPlatform and boot wiring.
   THIS FILE IS THE SPEC (together with android.test.js and screens-back.test.js, whose headers
   hold the rest of the contract). Pure-Node tests run on Node 18; the boot-wiring tests use jsdom
   and self-skip on Node < 20 like the other DOM tests. NO real Capacitor code runs here: every
   test uses the hand-made fakeCapacitor() in screens-helpers.js.

   ---------- DOCUMENTATION FACTS (read on 2026-11-11; LD = lead decision) ----------
   Sources: capacitorjs.com/docs (v8 pages) and the Capacitor source on GitHub (main branch).
   - Current stable major is 8. Capacitor 8 needs Node >= 22 (docs "Environment setup",
     https://capacitorjs.com/docs/getting-started/environment-setup; @capacitor/cli 8.6.0 has
     engines.node ">=22.0.0", https://raw.githubusercontent.com/ionic-team/capacitor/main/cli/package.json).
     Android Studio 2025.2.1 or later; the docs say Android Studio brings the right JDK (they name
     none: UNVERIFIED which JDK; Capacitor 8 projects carry JavaVersion.VERSION_21 in the generated
     capacitor.build.gradle, so android.test.js compares the workflow JDK with that file instead of
     naming a number). Android SDK API 24 or greater (android-template variables.gradle: minSdkVersion 24,
     compileSdk and targetSdk 36, https://raw.githubusercontent.com/ionic-team/capacitor/main/android-template/variables.gradle).
     Minimum WebView version: UNVERIFIED (docs silent). Gradle and AGP versions: UNVERIFIED (come with
     the generated project; the builder uses the generated wrapper).
     CONSEQUENCE: the beginner CI job runs `npm ci` on Node 18 and 20. @capacitor/cli declares
     engines >= 22, which makes npm print an EBADENGINE warning but not fail (unless engine-strict is
     set). The tests never require a Capacitor package, so the suite stays green on 18 and 20.
   - Config keys (https://capacitorjs.com/docs/config): appId, appName, webDir, server.androidScheme
     (default "https"), server.hostname (default "localhost"), server.url (loads the app from a URL:
     never set it).
   - Plugins (package: method):
       @capacitor/app            addListener('backButton', cb) -> Promise<handle>; cb gets { canGoBack };
                                  registering the listener disables the default back behaviour (Android only);
                                  minimizeApp() (Android only); exitApp() force-exits.
                                  https://capacitorjs.com/docs/apis/app
       @capacitor/haptics        vibrate({ duration }) default 300 ms. https://capacitorjs.com/docs/apis/haptics
       @capacitor/filesystem     writeFile({ path, data, directory, encoding, recursive }) -> { uri };
                                  Directory.Cache is the string 'CACHE', Encoding.UTF8 is 'utf8'.
                                  https://capacitorjs.com/docs/apis/filesystem
       @capacitor/share          share({ title, text, url, files: [file:// url], dialogTitle });
                                  by default only files in the cache folder can be shared (Android).
                                  https://capacitorjs.com/docs/apis/share
       @capacitor/local-notifications  schedule({ notifications: [{ id, title, body, channelId,
                                  schedule: { at: Date, allowWhileIdle } }] }); createChannel({ id, name,
                                  importance 0-5 default 3, vibration }); a notification whose channelId
                                  does not exist does not fire; checkPermissions/requestPermissions ->
                                  { display }; from 8.3.0 schedule() requests permission itself;
                                  cancel({ notifications: [{ id }] }), cancelAll(); Android 13+ needs the
                                  POST_NOTIFICATIONS runtime permission; from Android 12 notifications are
                                  inexact unless the manifest declares SCHEDULE_EXACT_ALARM; Android 14+
                                  USE_EXACT_ALARM grants exact alarms with no prompt; allowWhileIdle lets one
                                  fire during Doze (at most once per 9 minutes per app).
                                  https://capacitorjs.com/docs/apis/local-notifications
   - HOW PLUGINS ARE REACHED WITHOUT A BUNDLER (read from source, no page states it):
     https://raw.githubusercontent.com/ionic-team/capacitor/main/core/src/runtime.ts shows that
     Capacitor.Plugins.<Name> is filled ONLY when something calls registerPlugin('<Name>'), which the
     npm plugin packages do when imported. This app has no bundler, so window.Capacitor.Plugins is
     probably EMPTY. window.Capacitor.registerPlugin(name) is a core function that finds the native
     plugin through the injected PluginHeaders and returns a proxy. LD: platform.js reads a plugin as
     `cap.Plugins[name]` when present, else `cap.registerPlugin(name)` (inside try/catch). Tests cover
     both ways (fakeCapacitor via 'plugins', 'register', 'both'). The registered plugin names
     'App', 'Haptics', 'Filesystem', 'Share', 'LocalNotifications' follow each package's own
     registerPlugin call: UNVERIFIED by reading the plugin sources, check on a device.
     isNativePlatform() exists on window.Capacitor once the bridge is injected.
   - HOW THE BRIDGE GETS INTO THE PAGE (read from
     https://raw.githubusercontent.com/ionic-team/capacitor/main/android/capacitor/src/main/java/com/getcapacitor/Bridge.java
     and .../JSInjector.java): preferred path is WebViewCompat.addDocumentStartJavaScript for the app
     origin, which is not an inline script and is not subject to the page CSP. FALLBACK (WebView
     without document-start support) rewrites index.html and inserts an INLINE <script> after <head>.
     LOUD WARNING: beginner/index.html has `script-src 'self'`, which blocks an inline script. On a
     phone that takes the fallback path window.Capacitor would be missing, isNative would be false and
     the app would run as a plain web page (service worker registered, no native hooks). This CANNOT be
     proven without a device: it is on the device checklist. Do not loosen the CSP to fix it without
     telling the lead.
   - Generated files after `npx cap add android` (android-template): android/build.gradle,
     android/variables.gradle, android/app/build.gradle, android/app/capacitor.build.gradle,
     android/app/src/main/AndroidManifest.xml, android/gradlew. `cap sync` copies webDir into
     android/app/src/main/assets/public (the default asset folder: UNVERIFIED by a docs page, taken
     from Capacitor convention, so tests do not name it).

   ---------- LD A: beginner/platform.js, ONE global `const BeginnerPlatform` (column zero) ----------
   Loaded after ui.js and before boot.js (index.html order, BEGINNER_FILES). Pure: touches only the
   `win` it is handed, never the DOM, no require/import, no timers, no http URL.
     BeginnerPlatform.isNative(win)  true only when win.Capacitor exists and
         win.Capacitor.isNativePlatform() returns true; never throws (missing object, missing function,
         throwing function, non-function: false).
     BeginnerPlatform.create(win)    the object UI.boot receives as opts.platform.
       WEB (not native, win may be undefined): has NO own keys vibrate, saveFile, pickFile or reload
         (UI browser defaults stay, Object.assign in UI.boot), and has no-op functions scheduleRestEnd,
         cancelRestEnd, onBack, exit that touch no plugin and never throw.
       NATIVE: vibrate(ms) -> Haptics.vibrate({ duration: ms });
         saveFile(name, text) -> Filesystem.writeFile({ path: name, data: text, directory: 'CACHE',
           encoding: 'utf8' }) then Share.share({ files: [result.uri] }) (title and dialogTitle optional);
         pickFile and reload are NOT overridden (the WebView supports the file input; a reload is harmless
           inside the shell and E_NEWER_VERSION cannot normally happen because Android refuses downgrades);
         scheduleRestEnd(atMs): one device-level notification at atMs that vibrates, replacing any earlier
           one; cancelRestEnd(): removes it. Notification: channelId of a channel created through
           createChannel with vibration:true and name = BEGINNER_STRINGS.rest.channelName, title
           rest.notifyTitle, body rest.notifyBody, schedule { at: <Date for atMs>, allowWhileIdle: true }.
           Permission and channel work happen LAZILY at the first scheduleRestEnd call: create() and
           onBack() ask nothing and call no plugin (criterion A3, nothing before the first set). A refused
           permission is swallowed.
         onBack(handler): App.addListener('backButton', ...) ; every press calls handler() once
           (canGoBack is ignored). exit(): App.minimizeApp(), or App.exitApp() when minimizeApp is absent.
       EVERY native call is wrapped: a missing plugin, a throwing plugin or a rejected promise never
         throws and never leaves an unhandled rejection. Functions may return a promise.
     LD (manifest, checked in android.test.js): the app manifest declares VIBRATE, POST_NOTIFICATIONS and
         an exact-alarm permission (USE_EXACT_ALARM, with SCHEDULE_EXACT_ALARM for Android 12 also fine),
         because a rest timer must not fire minutes late.

   ---------- LD B: boot.js ----------
   beginnerBoot(env) decides native by env.isNative when it is given (true or false), else by
   BeginnerPlatform.isNative(env.window || window). Native: no service worker registration. It passes
   BeginnerPlatform.create(win) as ui.platform, with env.ui.platform keys merged on top (they win), and
   on native calls platform.onBack(() => { if (!UI.back()) platform.exit(); }) on that merged platform.
   Web: onBack is never called. The existing web-boot tests stay green unchanged.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const H = require('./screens-helpers');
const { N, NODE_MAJOR, fakeCapacitor, fakeClock, fakeTimers, seedState, Store, BEGINNER_CONFIG, KEY } = H;

const BP = () => {
  assert.ok(N.BeginnerPlatform, 'BeginnerPlatform is missing: beginner/platform.js must declare `const BeginnerPlatform` at column zero');
  return N.BeginnerPlatform;
};
const SM = () => { assert.ok(N.BEGINNER_STRINGS.rest, 'BEGINNER_STRINGS.rest is missing'); return N.BEGINNER_STRINGS.rest; };
const tickMacro = () => new Promise(r => setImmediate(r));
const settle = async () => { for (let i = 0; i < 200; i++) await Promise.resolve(); };
// Runs fn, lets everything settle, and reports a throw/reject of fn plus any unhandled rejection.
async function quiet(fn) {
  const rej = [];
  const on = e => rej.push(e);
  process.on('unhandledRejection', on);
  let threw = null;
  let value;
  try { value = await fn(); } catch (e) { threw = e; }
  await settle(); await tickMacro(); await tickMacro();
  process.off('unhandledRejection', on);
  return { rej, threw, value };
}
const AT = Date.UTC(2026, 5, 10, 12, 1, 30);
const isDate = d => Object.prototype.toString.call(d) === '[object Date]';
const ALL_PLUGINS = ['App', 'Haptics', 'Filesystem', 'Share', 'LocalNotifications'];

// ======================= the file =======================
const SRC = path.join(__dirname, '..', 'platform.js');
test('J1 platform.js exists and declares exactly one top-level const BeginnerPlatform', () => {
  assert.ok(fs.existsSync(SRC), 'beginner/platform.js does not exist yet');
  const src = fs.readFileSync(SRC, 'utf8');
  assert.match(src, /^const BeginnerPlatform\b/m);
  const { topLevelNames } = require('./load-beginner');
  assert.deepStrictEqual(topLevelNames(src), ['BeginnerPlatform'], 'one global only');
});
test('J1 platform.js is plain browser code: no require, import, export, absolute URL or em dash in strings', () => {
  const src = fs.readFileSync(SRC, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
  assert.ok(!/\brequire\s*\(|^\s*import\b|^\s*export\b|module\.exports/m.test(code));
  assert.ok(!/https?:\/\//.test(code));
  assert.ok(!/[\u2014\u2013]/.test(code), 'dash in code or strings');
});

// ======================= isNative =======================
test('J1 isNative is true only when Capacitor.isNativePlatform() returns true, and never throws', () => {
  const b = BP();
  assert.strictEqual(typeof b.isNative, 'function');
  assert.strictEqual(b.isNative({ Capacitor: { isNativePlatform: () => true } }), true);
  for (const win of [undefined, null, {}, { Capacitor: null }, { Capacitor: {} }, { Capacitor: { isNativePlatform: true } },
    { Capacitor: { isNativePlatform: () => false } }, { Capacitor: { isNativePlatform: () => undefined } },
    { Capacitor: { isNativePlatform: () => { throw new Error('bridge not ready'); } } }]) {
    assert.strictEqual(b.isNative(win), false);
  }
});

// ======================= web platform =======================
test('J1 on the web create() overrides no browser default and its hooks are harmless no-ops', async () => {
  const b = BP();
  const web = fakeCapacitor({ native: false });
  for (const win of [undefined, {}, web.win]) {
    const p = b.create(win);
    for (const k of ['vibrate', 'saveFile', 'pickFile', 'reload']) assert.ok(!Object.prototype.hasOwnProperty.call(p, k), 'web must not override ' + k);
    for (const k of ['scheduleRestEnd', 'cancelRestEnd', 'onBack', 'exit']) assert.strictEqual(typeof p[k], 'function', k);
    const r = await quiet(async () => { await p.scheduleRestEnd(AT); await p.cancelRestEnd(); await p.onBack(() => {}); await p.exit(); });
    assert.strictEqual(r.threw, null);
    assert.deepStrictEqual(r.rej, []);
  }
  assert.deepStrictEqual(web.calls, [], 'the web platform must not touch any plugin');
});

// ======================= native platform =======================
test('J4 A3 on native, create() and onBack() call no plugin except the back listener (nothing is asked before the first set)', async () => {
  const b = BP();
  const f = fakeCapacitor({ via: 'register' });
  const p = b.create(f.win);
  await settle();
  assert.deepStrictEqual(f.calls, []);
  await quiet(async () => { await p.onBack(() => {}); });
  assert.deepStrictEqual(f.calls.map(c => c[0] + '.' + c[1]), ['App.addListener']);
});
test('J1 on native create() supplies vibrate and saveFile but leaves pickFile and reload to the browser defaults', () => {
  const p = BP().create(fakeCapacitor().win);
  assert.strictEqual(typeof p.vibrate, 'function');
  assert.strictEqual(typeof p.saveFile, 'function');
  for (const k of ['pickFile', 'reload']) assert.ok(!Object.prototype.hasOwnProperty.call(p, k), 'native must not override ' + k);
  for (const k of ['scheduleRestEnd', 'cancelRestEnd', 'onBack', 'exit']) assert.strictEqual(typeof p[k], 'function', k);
});

for (const via of ['plugins', 'register', 'both']) {
  test('J4 native vibrate calls Haptics.vibrate({ duration }) (plugins reached via ' + via + ')', async () => {
    const f = fakeCapacitor({ via });
    const p = BP().create(f.win);
    const r = await quiet(() => p.vibrate(200));
    assert.strictEqual(r.threw, null);
    assert.deepStrictEqual(r.rej, []);
    assert.deepStrictEqual(f.calls.filter(c => c[0] === 'Haptics'), [['Haptics', 'vibrate', { duration: 200 }]]);
  });
  test('H3 native saveFile writes utf8 text to the cache folder, then shares that file (plugins via ' + via + ')', async () => {
    const f = fakeCapacitor({ via });
    const p = BP().create(f.win);
    const r = await quiet(() => p.saveFile('ironwave-beginner-2026-06-10.json', '{"a":1}'));
    assert.strictEqual(r.threw, null);
    assert.deepStrictEqual(r.rej, []);
    const names = f.calls.map(c => c[0] + '.' + c[1]);
    assert.deepStrictEqual(names, ['Filesystem.writeFile', 'Share.share']);
    const w = f.calls[0][2];
    assert.strictEqual(w.path, 'ironwave-beginner-2026-06-10.json');
    assert.strictEqual(w.data, '{"a":1}');
    assert.strictEqual(w.directory, 'CACHE');
    assert.strictEqual(w.encoding, 'utf8');
    assert.deepStrictEqual(f.calls[1][2].files, ['file:///cache/ironwave-beginner-2026-06-10.json']);
  });
}
test('H3 a failed write shares nothing and nothing escapes', async () => {
  const f = fakeCapacitor({ reject: ['Filesystem.writeFile'] });
  const r = await quiet(() => BP().create(f.win).saveFile('x.json', '{}'));
  assert.strictEqual(r.threw, null);
  assert.deepStrictEqual(r.rej, []);
  assert.ok(!f.calls.some(c => c[0] === 'Share'));
});

// ---- J4: the locked-phone signal ----
for (const via of ['plugins', 'register']) {
  test('J4 scheduleRestEnd schedules one vibrating, idle-proof notification at the given time (plugins via ' + via + ')', async () => {
    const f = fakeCapacitor({ via });
    const p = BP().create(f.win);
    const r = await quiet(() => p.scheduleRestEnd(AT));
    assert.strictEqual(r.threw, null);
    assert.deepStrictEqual(r.rej, []);
    const sched = f.calls.filter(c => c[0] === 'LocalNotifications' && c[1] === 'schedule');
    assert.strictEqual(sched.length, 1);
    const list = sched[0][2].notifications;
    assert.strictEqual(list.length, 1);
    const n = list[0];
    assert.ok(Number.isInteger(n.id), 'a numeric id');
    assert.ok(isDate(n.schedule.at) && n.schedule.at.getTime() === AT, 'schedule.at is a Date for atMs');
    assert.strictEqual(n.schedule.allowWhileIdle, true);
    assert.strictEqual(n.title, SM().notifyTitle);
    assert.strictEqual(n.body, SM().notifyBody);
    assert.strictEqual(typeof n.channelId, 'string');
    const ch = f.channels[n.channelId];
    assert.ok(ch, 'a notification on a channel that was never created does not fire (docs)');
    assert.strictEqual(ch.vibration, true);
    assert.strictEqual(ch.name, SM().channelName);
    assert.ok(!/[\u2014\u2013]/.test(n.title + n.body + ch.name));
  });
}
test('J4 a second scheduleRestEnd replaces the first: the phone holds exactly one signal, at the newest time', async () => {
  const f = fakeCapacitor();
  const p = BP().create(f.win);
  await quiet(async () => { await p.scheduleRestEnd(AT); await p.scheduleRestEnd(AT + 90000); });
  assert.strictEqual(f.pending.size, 1);
  assert.strictEqual([...f.pending.values()][0].schedule.at.getTime(), AT + 90000);
});
test('J4 cancelRestEnd removes the pending signal, and cancelling with nothing pending is harmless', async () => {
  const f = fakeCapacitor();
  const p = BP().create(f.win);
  let r = await quiet(() => p.cancelRestEnd());
  assert.strictEqual(r.threw, null);
  assert.deepStrictEqual(r.rej, []);
  await quiet(() => p.scheduleRestEnd(AT));
  assert.strictEqual(f.pending.size, 1);
  r = await quiet(() => p.cancelRestEnd());
  assert.strictEqual(r.threw, null);
  assert.strictEqual(f.pending.size, 0);
});
test('J4 A3 a refused notification permission is swallowed and the in-app vibrate still works', async () => {
  const f = fakeCapacitor({ perm: 'denied' });
  const p = BP().create(f.win);
  const r = await quiet(() => p.scheduleRestEnd(AT));
  assert.strictEqual(r.threw, null);
  assert.deepStrictEqual(r.rej, []);
  assert.strictEqual(f.pending.size, 0);
  const v = await quiet(() => p.vibrate(200));
  assert.strictEqual(v.threw, null);
  assert.ok(f.calls.some(c => c[0] === 'Haptics' && c[1] === 'vibrate'));
});

// ---- back and exit ----
test('J3 onBack subscribes to the hardware back button and calls the handler once per press, ignoring canGoBack', async () => {
  const f = fakeCapacitor({ via: 'register' });
  const p = BP().create(f.win);
  let n = 0;
  await quiet(() => p.onBack(() => { n++; }));
  assert.strictEqual(typeof f.listeners.backButton, 'function', 'no backButton listener registered');
  f.listeners.backButton({ canGoBack: true });
  f.listeners.backButton({ canGoBack: false });
  assert.strictEqual(n, 2);
});
test('J3 a handler that throws never escapes the listener', async () => {
  const f = fakeCapacitor();
  const p = BP().create(f.win);
  await quiet(() => p.onBack(() => { throw new Error('ui broke'); }));
  const r = await quiet(async () => { f.listeners.backButton({ canGoBack: false }); });
  assert.strictEqual(r.threw, null);
  assert.deepStrictEqual(r.rej, []);
});
test('J3 exit minimizes the app and does not kill it; exitApp is only the fallback', async () => {
  let f = fakeCapacitor();
  await quiet(() => BP().create(f.win).exit());
  assert.deepStrictEqual(f.calls.map(c => c[0] + '.' + c[1]), ['App.minimizeApp']);
  f = fakeCapacitor({ noMinimize: true });
  await quiet(() => BP().create(f.win).exit());
  assert.deepStrictEqual(f.calls.map(c => c[0] + '.' + c[1]), ['App.exitApp']);
});

// ---- robustness ----
function everyHook(p) {
  return async () => {
    await p.vibrate(200); await p.saveFile('x.json', '{}'); await p.scheduleRestEnd(AT); await p.cancelRestEnd();
    await p.onBack(() => {}); await p.exit();
  };
}
for (const via of ['plugins', 'register']) {
  test('J1 J3 J4 with every plugin missing no hook throws or rejects (plugins via ' + via + ')', async () => {
    const f = fakeCapacitor({ via, missing: ALL_PLUGINS });
    const r = await quiet(everyHook(BP().create(f.win)));
    assert.strictEqual(r.threw, null, String(r.threw));
    assert.deepStrictEqual(r.rej, []);
  });
}
test('J1 J3 J4 when every plugin call rejects no hook throws or leaves an unhandled rejection', async () => {
  const methods = [];
  const probe = fakeCapacitor();
  for (const [pl, o] of Object.entries(probe.P)) for (const m of Object.keys(o)) methods.push(pl + '.' + m);
  const f = fakeCapacitor({ reject: methods });
  const r = await quiet(everyHook(BP().create(f.win)));
  assert.strictEqual(r.threw, null, String(r.threw));
  assert.deepStrictEqual(r.rej, []);
});

// ======================= boot.js wiring (jsdom) =======================
if (NODE_MAJOR < 20) {
  test('J3 boot wiring DOM tests (skipped: jsdom requires Node >= 20)', { skip: true }, () => {});
} else {
  async function bootWith(o = {}) {
    const { loadDom } = require('./load-dom');
    const { window, document, app } = loadDom();
    window.structuredClone = window.structuredClone || structuredClone;
    assert.strictEqual(typeof app.beginnerBoot, 'function');
    const f = fakeCapacitor(o.cap || { via: 'register' });
    if (o.cap !== null) window.Capacitor = f.cap;
    const root = document.getElementById('app');
    const reg = [];
    const navigator = { serviceWorker: { register(u) { reg.push(u); return Promise.resolve({}); } } };
    const clock = fakeClock();
    const timers = fakeTimers();
    const ui = Object.assign({ root, adapter: Store.memoryAdapter({ [KEY]: seedState() }), clock, timers, locale: 'en-GB' }, o.ui || {});
    const env = { window, navigator, location: window.location, ui };
    if (o.isNative !== undefined) env.isNative = o.isNative;
    const rej = [];
    const on = e => rej.push(e);
    process.on('unhandledRejection', on);
    try { await app.beginnerBoot(env); await settle(); await tickMacro(); } finally { process.off('unhandledRejection', on); }
    const w = {
      window, document, app, root, f, reg, clock, timers, rej,
      screen: () => { const el = root.querySelector('[data-screen]'); return el && el.getAttribute('data-screen'); },
      q: id => root.querySelector('[data-testid="' + id + '"]'),
      click: async id => { w.q(id).dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); await settle(); },
      back: async () => { f.listeners.backButton({ canGoBack: false }); await settle(); },
    };
    return w;
  }

  test('J1 J3 on native boot registers no service worker and subscribes to back once', async () => {
    const w = await bootWith();
    assert.deepStrictEqual(w.reg, []);
    assert.strictEqual(w.f.calls.filter(c => c[0] === 'App' && c[1] === 'addListener').length, 1);
    assert.strictEqual(w.screen(), 'pick');
    assert.deepStrictEqual(w.rej, []);
  });
  test('J3 on Pick the hardware back leaves the app (minimize); on Lift it goes to Pick first and the next press leaves', async () => {
    const w = await bootWith();
    await w.click('pick-start');
    assert.strictEqual(w.screen(), 'lift');
    await w.back();
    assert.strictEqual(w.screen(), 'pick');
    assert.ok(!w.f.calls.some(c => c[1] === 'minimizeApp' || c[1] === 'exitApp'), 'Lift back must not leave the app');
    await w.back();
    assert.strictEqual(w.f.calls.filter(c => c[1] === 'minimizeApp').length, 1);
  });
  test('J3 env.ui.platform keys win over the native platform for onBack and exit', async () => {
    const seen = { handler: null, exits: 0 };
    const w = await bootWith({ ui: { platform: { onBack: h => { seen.handler = h; }, exit: () => { seen.exits++; } } } });
    assert.strictEqual(typeof seen.handler, 'function', 'the merged platform onBack must be used');
    assert.ok(!w.f.calls.some(c => c[0] === 'App' && c[1] === 'addListener'));
    seen.handler();
    assert.strictEqual(seen.exits, 1, 'back on Pick calls the merged platform exit');
    await w.click('pick-start');
    seen.handler();
    assert.strictEqual(seen.exits, 1, 'back on Lift is handled by the UI');
    assert.strictEqual(w.screen(), 'pick');
  });
  test('J1 on the web a Capacitor that is not native changes nothing: worker registered, no back listener', async () => {
    const w = await bootWith({ cap: { native: false, via: 'register' } });
    assert.strictEqual(w.reg.length, 1);
    assert.ok(!w.f.calls.some(c => c[1] === 'addListener'));
  });
  test('J1 env.isNative false wins over a native Capacitor: worker registered, back not wired', async () => {
    const w = await bootWith({ isNative: false });
    assert.strictEqual(w.reg.length, 1);
    assert.ok(!w.f.calls.some(c => c[1] === 'addListener'));
  });
  test('J1 env.isNative true wins over a missing Capacitor: no worker, boots, back is a no-op subscription', async () => {
    const w = await bootWith({ cap: null, isNative: true });
    assert.deepStrictEqual(w.reg, []);
    assert.strictEqual(w.screen(), 'pick');
  });

  test('J4 through the real UI: Done schedules the device signal for the rest end, the in-app vibrate then cancels it (no double signal)', async () => {
    const w = await bootWith();
    await w.click('pick-start');
    assert.strictEqual(w.screen(), 'lift');
    assert.ok(!w.f.calls.some(c => c[1] === 'schedule'), 'nothing scheduled before the first set');
    for (let i = 0; i < 10; i++) await w.click('reps-plus');
    if (w.q('weight-plus')) await w.click('weight-plus');
    const doneAt = w.clock();
    await w.click('lift-done');
    const sched = w.f.calls.filter(c => c[1] === 'schedule');
    assert.strictEqual(sched.length, 1);
    assert.strictEqual(sched[0][2].notifications[0].schedule.at.getTime(), doneAt + BEGINNER_CONFIG.ui.restSec * 1000);
    assert.strictEqual(w.f.pending.size, 1);
    w.clock.advance(BEGINNER_CONFIG.ui.restSec * 1000);
    w.timers.tick();
    await settle();
    assert.deepStrictEqual(w.f.calls.filter(c => c[0] === 'Haptics'), [['Haptics', 'vibrate', { duration: BEGINNER_CONFIG.ui.vibrateMs }]]);
    assert.strictEqual(w.f.pending.size, 0, 'the scheduled signal must be cancelled when the in-app vibrate fires');
    assert.deepStrictEqual(w.rej, []);
  });
}

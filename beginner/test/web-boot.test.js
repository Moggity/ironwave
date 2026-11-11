/* ============================================================
   BEGINNER APP, package 6 (Web release), jsdom tests. THIS FILE IS THE SPEC (together with
   web-release.test.js, whose header holds the full contract: files, CSP, sw design, strings).
   DOM tests self-skip on Node < 20, like the other DOM tests.

   ---------- beginnerBoot(env) (boot.js) ----------
   LD (auto-run): boot.js runs the boot by itself only when document.currentScript is non-null
   (a real <script> tag). load-dom.js evals scripts, so loading it never boots; load-dom.js
   needs no change, index.html only has to list boot.js. env = { window, navigator, location,
   isNative, ui }; every key optional. LD: env.ui is an object of extra UI.boot options (root,
   adapter, clock, timers, platform, locale, media) merged over the defaults.
   - calls UI.boot; the returned promise resolves after the first render.
   - isNative falsy and 'serviceWorker' in navigator: register('sw.js' or './sw.js', optional
     { scope: './' or '.' }) exactly once, AFTER the first render, never throwing or leaving a
     rejection if registration fails (sync throw or rejected promise).
   - isNative true: registers nothing. No serviceWorker in navigator: nothing, no throw.
   - navigator.storage.persist() called exactly once when it exists (web and native), result
     and rejection ignored. Not a network request (H1).

   ---------- storage failure is not a dead end (UI) ----------
   When Store.open rejects, the screen keeps data-screen="error", shows errors.storage (or
   errors.newerVersion for E_NEWER_VERSION) and a button testid storage-retry labelled
   errors.retry. Clicking it opens the store again; on success the normal first screen renders;
   on another failure the error screen stays with the retry control. Handlers are registered
   once (a retry must not double them).

   ---------- ROUND 2 (review): retry is safe ----------
   S2 (C6): retry is single-flight. While a store open is in progress the storage-retry control is
     disabled and further clicks do nothing, so the store is never opened more than once at a time
     (counted with an adapter whose get is held).
   S3: after E_NEWER_VERSION the retry control calls platform.reload() (a NEW platform hook, default
     location.reload()) and does NOT open the store again with the same old code. For every other
     error code retry reopens the store and never reloads.

   ---------- carry-forward fixes in ui.js ----------
   (a) a typed lb weight with more than two decimals is rounded to two decimals when committed
       (shown value, logged kg and later pre-fills all use the rounded number);
   (b) stepping up to the lb cap never logs more than BEGINNER_CONFIG.ui.maxWeightKg kg.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const H = require('./screens-helpers');
const { boot, seedState, Store, BEGINNER_CONFIG, KG_PER_LB, fakeClock, fakeTimers } = H;

if (H.NODE_MAJOR < 20) {
  test('web boot DOM tests (skipped: jsdom requires Node >= 20)', { skip: true }, () => {});
} else {
  const tick = (ms = 15) => new Promise(r => setTimeout(r, ms));

  // ---------- beginnerBoot ----------
  async function web(o = {}) {
    const { loadDom } = require('./load-dom');
    const { window, document, app } = loadDom();
    window.structuredClone = window.structuredClone || structuredClone;
    assert.strictEqual(typeof app.beginnerBoot, 'function', 'boot.js must define top-level function beginnerBoot and be listed in index.html');
    const root = document.getElementById('app');
    const reg = []; const st = { persist: 0 };
    const nav = {};
    if (o.sw !== false) {
      nav.serviceWorker = {
        register(url, opts) {
          reg.push({ url, opts, rendered: !!root.querySelector('[data-screen]') });
          if (o.regThrow) throw new Error('sync failure');
          return o.regReject ? Promise.reject(new Error('refused')) : Promise.resolve({});
        },
      };
    }
    if (o.storage !== false) nav.storage = { persist() { st.persist++; return o.persistReject ? Promise.reject(new Error('no')) : Promise.resolve(false); } };
    const ui = { root, adapter: Store.memoryAdapter({ [BEGINNER_CONFIG.store.key]: seedState({ onboarded: false }) }), clock: fakeClock(), timers: fakeTimers(), locale: 'en-GB' };
    const rejections = [];
    const onRej = e => rejections.push(e);
    process.on('unhandledRejection', onRej);
    let result;
    try {
      result = app.beginnerBoot({ window, navigator: nav, location: window.location, isNative: !!o.isNative, ui });
      assert.ok(result && typeof result.then === 'function', 'beginnerBoot must return a promise');
      await result;
      await tick();
    } finally { process.off('unhandledRejection', onRej); }
    return { window, document, app, root, reg, st, rejections, screen: () => root.querySelector('[data-screen]') };
  }

  test('I2 loading boot.js does not boot by itself (no document.currentScript in the harness)', async () => {
    const { loadDom } = require('./load-dom');
    const { window, document, app } = loadDom();
    assert.strictEqual(typeof app.beginnerBoot, 'function', 'beginnerBoot missing');
    assert.strictEqual(document.getElementById('app').children.length, 0);
    assert.deepStrictEqual(window.__netCalls, []);
  });

  test('I2 a real page load boots by itself through boot.js', async () => {
    const { assemble } = require('../../scripts/assemble-beginner.js');
    const { JSDOM } = require('jsdom');
    const dir = assemble({ outDir: fs.mkdtempSync(path.join(os.tmpdir(), 'bg-web-page-')) });
    const dom = await JSDOM.fromFile(path.join(dir, 'index.html'), { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true });
    try {
      let el = null;
      for (let i = 0; i < 200 && !el; i++) { await tick(15); el = dom.window.document.querySelector('[data-screen]'); }
      assert.strictEqual(typeof dom.window.beginnerBoot, 'function', 'beginnerBoot missing from the page');
      assert.ok(el, 'nothing rendered: boot.js did not run the boot');
    } finally { dom.window.close(); fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('I2 on the web beginnerBoot registers sw.js once, with relative URL and scope, after the first render', async () => {
    const w = await web();
    assert.ok(w.screen(), 'first screen rendered');
    assert.strictEqual(w.reg.length, 1);
    assert.match(w.reg[0].url, /^(\.\/)?sw\.js$/);
    if (w.reg[0].opts && w.reg[0].opts.scope !== undefined) assert.match(w.reg[0].opts.scope, /^\.\/?$/);
    assert.strictEqual(w.reg[0].rendered, true, 'registered before the first render');
  });
  test('I2 a rejected registration is swallowed', async () => {
    const w = await web({ regReject: true });
    assert.ok(w.screen());
    assert.strictEqual(w.reg.length, 1);
    assert.deepStrictEqual(w.rejections, []);
  });
  test('I2 a registration that throws synchronously is swallowed', async () => {
    const w = await web({ regThrow: true });
    assert.ok(w.screen());
  });
  test('I2 without serviceWorker support the app still boots', async () => {
    const w = await web({ sw: false });
    assert.ok(w.screen());
  });
  test('I2 inside the native shell nothing is registered, the app still boots', async () => {
    const w = await web({ isNative: true });
    assert.deepStrictEqual(w.reg, []);
    assert.ok(w.screen());
  });
  for (const [label, o] of [['web', {}], ['native', { isNative: true }], ['web with a rejecting persist', { persistReject: true }]]) {
    test('H1 storage.persist is requested once and its result ignored (' + label + ')', async () => {
      const w = await web(o);
      assert.strictEqual(w.st.persist, 1);
      assert.deepStrictEqual(w.rejections, []);
      assert.ok(w.screen());
    });
  }
  test('I2 a navigator without storage is fine', async () => {
    const w = await web({ storage: false });
    assert.ok(w.screen());
  });
  test('H1 a full boot through beginnerBoot makes no network call', async () => {
    const w = await web();
    w.root.querySelector('[data-testid="goal-skip"]').dispatchEvent(new w.window.MouseEvent('click', { bubbles: true }));
    await tick();
    assert.deepStrictEqual(w.window.__netCalls, []);
  });

  // ---------- storage failure is not a dead end ----------
  const flaky = (kind, failures) => {
    const base = Store.memoryAdapter();
    let n = 0;
    return {
      get: async k => {
        if (n++ < failures) {
          if (kind === 'E_NEWER_VERSION') return { version: 9999 };
          const e = new Error('boom'); e.code = kind; throw e;
        }
        return base.get(k);
      },
      set: (k, v) => base.set(k, v),
      opens: () => n,
    };
  };
  for (const kind of ['E_NO_STORAGE', 'E_STORAGE', 'E_NEWER_VERSION']) {
    test('I2 ' + kind + ' on open shows the error text and a retry control', async () => {
      const h = await boot({ adapter: flaky(kind, 1) });
      assert.strictEqual(h.screen(), 'error');
      const want = kind === 'E_NEWER_VERSION' ? h.S.errors.newerVersion : h.S.errors.storage;
      assert.ok(typeof want === 'string' && want.length > 0, 'strings key missing');
      assert.ok(h.text().includes(want), 'shows: ' + h.text());
      const btn = h.q('storage-retry');
      assert.ok(btn && btn.tagName === 'BUTTON', 'storage-retry button');
      assert.strictEqual(btn.textContent.trim(), h.S.errors.retry);
    });
  }
  test('I2 retry after a storage failure opens the store and renders the first screen, handlers once', async () => {
    const h = await boot({ adapter: flaky('E_NO_STORAGE', 1) });
    await h.click('storage-retry');
    assert.strictEqual(h.screen(), 'goal');
    assert.strictEqual(h.q('storage-retry'), null);
    await h.click(h.all('goal-tile')[0]);
    assert.strictEqual(h.all('goal-tile')[0].getAttribute('aria-pressed'), 'true', 'a tap toggled twice: handlers were registered again');
  });
  test('I2 a retry that fails again keeps the error screen and the control, a later one works', async () => {
    const h = await boot({ adapter: flaky('E_STORAGE', 2) });
    await h.click('storage-retry');
    assert.strictEqual(h.screen(), 'error');
    assert.ok(h.q('storage-retry'));
    await h.click('storage-retry');
    assert.strictEqual(h.screen(), 'goal');
  });

  // ---------- S2, S3: retry is single-flight, and reloads after a newer version ----------
  async function raw(adapter) {
    const { loadDom } = require('./load-dom');
    const { window, document, app } = loadDom();
    window.structuredClone = window.structuredClone || structuredClone;
    const root = document.getElementById('app');
    const calls = { reload: 0 };
    await app.UI.boot({ root, adapter, clock: fakeClock(), timers: fakeTimers(), locale: 'en-GB',
      platform: { vibrate() {}, saveFile() {}, pickFile: async () => null, reload() { calls.reload++; } } });
    const settle = async () => { for (let i = 0; i < 200; i++) await Promise.resolve(); };
    await settle();
    const q = id => root.querySelector('[data-testid="' + id + '"]');
    const click = async el => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); await settle(); };
    return { root, calls, q, click, settle, screen: () => (root.querySelector('[data-screen]') || { getAttribute: () => null }).getAttribute('data-screen') };
  }
  test('C6 S2 retry is single-flight: while the store opens the control is disabled and clicks do nothing', async () => {
    const base = Store.memoryAdapter();
    const st = { gets: 0, release: null };
    const adapter = {
      get: k => {
        st.gets++;
        if (st.gets === 1) return Promise.reject(Object.assign(new Error('x'), { code: 'E_STORAGE' }));
        if (st.gets === 2) return new Promise(res => { st.release = () => res(base.get(k)); });
        return base.get(k);
      },
      set: (k, v) => base.set(k, v),
    };
    const h = await raw(adapter);
    assert.strictEqual(h.screen(), 'error');
    await h.click(h.q('storage-retry'));
    assert.strictEqual(st.gets, 2, 'the first retry opens the store once');
    const btn = h.q('storage-retry');
    assert.ok(btn && btn.disabled, 'the retry control must be disabled while opening');
    for (let i = 0; i < 4; i++) await h.click(h.q('storage-retry') || btn);
    assert.strictEqual(st.gets, 2, 'extra clicks opened the store again');
    st.release(); await h.settle();
    assert.strictEqual(st.gets, 2);
    assert.strictEqual(h.screen(), 'goal');
  });
  test('C6 S3 after E_NEWER_VERSION retry reloads the page and does not open the store again', async () => {
    let gets = 0;
    const adapter = { get: async () => { gets++; return { version: 9999 }; }, set: async () => {} };
    const h = await raw(adapter);
    assert.strictEqual(h.screen(), 'error');
    assert.strictEqual(gets, 1);
    await h.click(h.q('storage-retry'));
    assert.strictEqual(h.calls.reload, 1, 'platform.reload not called');
    assert.strictEqual(gets, 1, 'the store was opened again with the same old code');
  });
  for (const code of ['E_NO_STORAGE', 'E_STORAGE']) {
    test('C6 S3 after ' + code + ' retry reopens the store and never reloads', async () => {
      let gets = 0; const base = Store.memoryAdapter();
      const adapter = { get: async k => { if (gets++ === 0) throw Object.assign(new Error('x'), { code }); return base.get(k); }, set: (k, v) => base.set(k, v) };
      const h = await raw(adapter);
      await h.click(h.q('storage-retry'));
      assert.strictEqual(gets, 2);
      assert.strictEqual(h.calls.reload, 0);
      assert.strictEqual(h.screen(), 'goal');
    });
  }

  // ---------- carry-forward fixes in ui.js ----------
  const lift = async (boo = {}) => { const h = await boot({ seed: seedState({}), locale: 'en-US', ...boo }); await h.toLift(['db-curl']); return h; };
  for (const typed of ['47.006', '47.005']) {
    test('G4 a typed lb weight of ' + typed + ' is rounded to two decimals when committed and kept by the next pre-fill', async () => {
      const h = await lift();
      await h.type('weight-value', typed);
      const shown = h.val('weight-value');
      assert.match(shown, /^\d+(\.\d{1,2})?$/, 'shown ' + shown);
      assert.ok(Math.abs(Number(shown) - Number(typed)) <= 0.0051, 'shown ' + shown);
      await h.type('reps-value', '10');
      await h.click('lift-done');
      assert.strictEqual(h.val('weight-value'), shown, 'the next pre-fill changed the committed weight');
      const sets = (await h.active()).sets;
      assert.ok(Math.abs(sets[0].weightKg - Number(shown) * KG_PER_LB) < 1e-6, 'logged ' + sets[0].weightKg);
    });
  }
  test('N3 stepping up to the lb cap never logs more than maxWeightKg', async () => {
    const h = await lift();
    const lbAtCap = BEGINNER_CONFIG.ui.maxWeightKg / KG_PER_LB;
    await h.type('weight-value', String(Math.floor(lbAtCap)));
    await h.click('weight-plus');
    await h.clickN('weight-plus', 3);
    await h.type('reps-value', '1');
    await h.click('lift-done');
    const sets = (await h.active()).sets;
    assert.ok(sets[0].weightKg <= BEGINNER_CONFIG.ui.maxWeightKg, 'logged ' + sets[0].weightKg + ' kg');
    assert.ok(sets[0].weightKg > BEGINNER_CONFIG.ui.maxWeightKg - 5);
  });
  test('N3 stepping up to the kg cap logs exactly maxWeightKg at most', async () => {
    const h = await lift({ locale: 'en-GB' });
    await h.type('weight-value', String(BEGINNER_CONFIG.ui.maxWeightKg - 1));
    await h.clickN('weight-plus', 3);
    await h.type('reps-value', '1');
    await h.click('lift-done');
    assert.ok((await h.active()).sets[0].weightKg <= BEGINNER_CONFIG.ui.maxWeightKg);
  });
}

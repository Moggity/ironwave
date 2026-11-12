/* ============================================================
   IRONWAVE — test/icons.test.js
   UI icons. icons.js is generated from icons/ui/ and must match its
   sources; icon() renders inline SVG in currentColor; every icon
   name the app code asks for exists; the shell lists icons.js so the
   installed app has it offline; and the main surfaces render SVG
   icons rather than the old text symbols.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./load-app');
const { build } = require('../../scripts/build-icons');

const appDir = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(appDir, f), 'utf8').replace(/\r\n/g, '\n');
const app = loadApp();

test('icons.js matches the sources in icons/ui (run scripts/build-icons.js)', () => {
  assert.strictEqual(read('icons.js'), build());
});

test('every icon is a single-colour body of plain shapes', () => {
  const names = Object.keys(app.ICONS);
  assert.ok(names.length >= 48, 'the supplied set is present');
  for (const n of names) {
    const body = app.ICONS[n];
    assert.match(n, /^[a-z0-9-]+$/, n + ' is a kebab-case name');
    assert.ok(body.startsWith('<path') || body.startsWith('<circle') || body.startsWith('<rect'), n + ' has shapes');
    assert.ok(!/#[0-9a-f]{3,8}\b/i.test(body), n + ' has no hard-coded colour');
    assert.ok(body.includes('currentColor'), n + ' is drawn in currentColor');
    assert.ok(!/clip-path|<defs|<g\b|<svg/.test(body), n + ' has no wrapper left over');
  }
});

test('icon() renders a decorative inline SVG and nothing for an unknown name', () => {
  const html = app.icon('swap');
  assert.match(html, /^<svg class="ico" data-ic="swap" viewBox="0 0 24 24" fill="none" aria-hidden="true"/);
  assert.ok(html.includes(app.ICONS.swap) && html.endsWith('</svg>'));
  assert.strictEqual(app.icon('no-such-icon'), '');
});

test('every icon name used in app.js exists', () => {
  const src = read('app.js');
  const used = new Set();
  for (const m of src.matchAll(/\bicon\('([a-z0-9-]+)'/g)) used.add(m[1]);
  for (const m of src.matchAll(/'(chevron-(?:up|down))'/g)) used.add(m[1]);
  for (const m of src.matchAll(/\btab\('[a-z]+','([a-z-]+)'\)/g)) used.add(m[1]);
  for (const m of src.matchAll(/\blink\(t\('[^']+'\), '([a-z-]+)'/g)) used.add(m[1]);
  Object.values(app.PUMP_ICONS).forEach(n => used.add(n));
  Object.values(app.FINISHER_ICONS).forEach(n => used.add(n));
  assert.ok(used.size >= 40, 'found the call sites');
  for (const n of used) assert.ok(app.ICONS[n], `icon "${n}" exists`);
});

test('the shell loads icons.js before data.js and caches it for offline', () => {
  const html = read('index.html');
  assert.ok(html.indexOf('src="icons.js"') > 0 && html.indexOf('src="icons.js"') < html.indexOf('src="data.js"'));
  assert.ok(read('sw.js').includes("'./icons.js'"));
});

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor >= 20) {
  const { loadDom } = require('./load-dom');

  test('tab bar, More hub and workout cards render SVG icons', () => {
    const { app: a, document } = loadDom();
    a.S = a.defaultState();
    a.S.program = a.makeProgram({ daysPerWeek: 4, maxes: {} });
    const names = sel => [...document.querySelectorAll(sel)].map(el => el.getAttribute('data-ic'));

    a.V = { view: 'dashboard', tab: 'dashboard', dayIdx: 0 };
    a.render();
    assert.deepStrictEqual(names('.tabbar svg.ico'), ['dashboard', 'workout', 'history', 'more']);

    a.V = { view: 'more', tab: 'more', dayIdx: 0 };
    a.render();
    assert.deepStrictEqual(names('.lib-item svg.ico'),
      ['program', 'progress', 'data', 'nutrition', 'exercises', 'settings']);

    a.V = { view: 'workout', tab: 'workout', dayIdx: 0 };
    a.render();
    const card = names('.ex-card svg.ico');
    for (const n of ['drag-grip', 'info', 'swap']) assert.ok(card.includes(n), 'workout card has ' + n);
    assert.ok(!/[▥🏋🗂☰ⓘ⇄🗑⠿]/u.test(document.getElementById('app').innerHTML), 'no old symbols left');
  });
}

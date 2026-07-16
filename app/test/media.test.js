/* ============================================================
   IRONWAVE — test/media.test.js
   [Epic H8] Exercise media plumbing. The app must be fully
   functional MEDIA-LESS (the emoji placeholder is the contract
   until clips are recorded):
   - the manifest is lazy, one fetch, and a failed fetch degrades
     to no media without throwing or re-looping,
   - exMediaSrc only serves plain basenames listed for the id
     (a hostile manifest cannot path-traverse),
   - the detail modal keeps the placeholder without media and
     swaps in a muted looping video with it,
   - the service worker keeps media OUT of the app shell: its own
     capped cache, kept across shell version bumps.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./load-app');

const app = loadApp();

// ---------------------------------------------------------------------------
// Manifest loading
// ---------------------------------------------------------------------------
test('ensureMediaManifest degrades to empty on a failed fetch and never re-loops', async () => {
  app.S = app.defaultState();
  assert.strictEqual(app.MEDIA, null, 'nothing fetched until a detail opens');
  app.ensureMediaManifest(); // harness fetch rejects (no network in tests)
  assert.deepStrictEqual(app.MEDIA, { items: {} }, 'set eagerly so a failure cannot loop');
  await new Promise(r => setImmediate(r)); // let the rejection settle: no throw
  app.ensureMediaManifest(); // second call is a no-op
  assert.deepStrictEqual(app.MEDIA, { items: {} });
});

test('the committed manifest is a valid empty v1', () => {
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'media', 'manifest.json'), 'utf8'));
  assert.strictEqual(m.schemaVersion, 1);
  assert.deepStrictEqual(m.items, {});
});

// ---------------------------------------------------------------------------
// Source resolution: listed ids only, plain basenames only
// ---------------------------------------------------------------------------
test('exMediaSrc serves listed ids and rejects traversal and junk', () => {
  app.MEDIA = { items: {
    'comp-squat': 'comp-squat.mp4',
    'db-fly': 'db-fly.v2.webm',
    'evil-1': '../../database.json',
    'evil-2': 'a/b.mp4',
    'evil-3': 42,
    'evil-4': '.hidden',
  } };
  assert.strictEqual(app.exMediaSrc('comp-squat'), 'media/comp-squat.mp4');
  assert.strictEqual(app.exMediaSrc('db-fly'), 'media/db-fly.v2.webm', 'cache-busted names pass');
  assert.strictEqual(app.exMediaSrc('comp-bench'), null, 'unlisted id: placeholder');
  assert.strictEqual(app.exMediaSrc('evil-1'), null, 'no path traversal');
  assert.strictEqual(app.exMediaSrc('evil-2'), null, 'no subpaths');
  assert.strictEqual(app.exMediaSrc('evil-3'), null, 'no non-strings');
  assert.strictEqual(app.exMediaSrc('evil-4'), null, 'no dotfiles');
  app.MEDIA = null;
  assert.strictEqual(app.exMediaSrc('comp-squat'), null, 'no manifest: placeholder');
});

test('exMediaHTML is a muted looping lazy video, or empty for the placeholder', () => {
  app.MEDIA = { items: { 'comp-squat': 'comp-squat.mp4' } };
  const html = app.exMediaHTML('comp-squat');
  for (const attr of ['muted', 'loop', 'playsinline', 'preload="metadata"', 'onerror']) {
    assert.ok(html.includes(attr), `video carries ${attr}`);
  }
  assert.ok(html.includes('src="media/comp-squat.mp4"'));
  assert.strictEqual(app.exMediaHTML('comp-bench'), '', 'no clip, no markup');
  app.MEDIA = null;
});

// ---------------------------------------------------------------------------
// The shell contract (file-level: the sw script is not executable in node:test)
// ---------------------------------------------------------------------------
test('the service worker keeps media out of the SHELL and preserves its cache', () => {
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const shell = sw.slice(sw.indexOf('const SHELL'), sw.indexOf('];', sw.indexOf('const SHELL')));
  assert.ok(!/media/.test(shell), 'no media file is ever pre-cached in the shell');
  assert.ok(/MEDIA_CACHE/.test(sw), 'a dedicated media cache exists');
  assert.ok(/MEDIA_MAX_ENTRIES/.test(sw), 'and it is size-capped');
  assert.ok(/k !== CACHE_VERSION && k !== MEDIA_CACHE/.test(sw),
    'activate keeps the media cache across shell version bumps');
  assert.ok(/range/.test(sw), 'range requests bypass the cache (206 partials would corrupt playback)');
});

test('the media directory ships only the manifest until clips are recorded', () => {
  const files = fs.readdirSync(path.join(__dirname, '..', 'media'));
  assert.deepStrictEqual(files, ['manifest.json']);
});

/* ============================================================
   BEGINNER APP, package 1 (Scaffold), criterion K2. THIS FILE IS THE SPEC.
   The builder implements exactly the contract below and may not edit tests.

   Name check: none of BEGINNER_CONFIG, BEGINNER_EXERCISES, Coach, Store, UI
   collides with a top-level name in app/data.js or app/engine.js (verified), so
   no name was changed.

   beginner/package.json: private, type commonjs, engines.node >=18, scripts
     test = "node --test test/*.test.js", assemble = "node ../scripts/assemble-beginner.js",
     single devDependency jsdom (same range as app/package.json), no runtime deps.
   Browser script order (one shared global scope): data.js, engine.js (copied
     from app/), then config.js, exercises.js, coach.js, store.js, ui.js.
     config.js    -> const BEGINNER_CONFIG  (deeply frozen plain object)
     exercises.js -> const BEGINNER_EXERCISES (array, may be empty)
     coach.js     -> const Coach  (plain object, PURE: source text must not mention
                     document, window, localStorage, indexedDB, Date.now, new Date())
     store.js     -> const Store  (plain object)
     ui.js        -> const UI     (plain object; only file allowed to touch the DOM)
   test/load-beginner.js: loadBeginner() concatenates data, engine, config,
     exercises, coach, store (NOT ui) and compiles in the current realm via
     vm.runInThisContext; returns { Engine, EXERCISES, EXERCISE_LIST, EX_META,
     EX_CUES, VOLUME_LANDMARKS, EXPERIENCE_FACTOR, TIME_MODEL, BEGINNER_CONFIG,
     BEGINNER_EXERCISES, Coach, Store }. No DOM needed; independent instances.
   test/load-dom.js: loadDom() loads beginner/index.html body into jsdom, evals all
     seven scripts, returns { window, document, app }; jsdom required lazily.
     DOM tests self-skip on Node < 20 (same mechanism as app render-smoke).
   beginner/index.html: <div id="app">, viewport meta, seven script tags in order,
     flat relative paths (data.js, engine.js, config.js, ...).
   scripts/assemble-beginner.js: exports assemble({ outDir }); run directly it
     assembles into beginner/www/. A copy, not a build. Output: index.html,
     styles.css, config.js, exercises.js, coach.js, store.js, ui.js, engine.js and
     data.js byte-identical to app/, media/ if it exists. Never test/, node_modules/,
     package.json, package-lock.json, android/, www/. Clears outDir first (idempotent).
     beginner/www/ is git-ignored.
   CI: ci.yml keeps job `check` (matrix [18, 20], working-directory app) and gains
     job `beginner` (matrix [18, 20], working-directory beginner, npm ci, npm test).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const NODE_MAJOR = Number(process.versions.node.split('.')[0]);
const ROOT = path.resolve(__dirname, '..', '..');
const B = path.join(ROOT, 'beginner');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const SEVEN = ['data.js', 'engine.js', 'config.js', 'exercises.js', 'coach.js', 'store.js', 'ui.js'];

function load() { return require('./load-beginner').loadBeginner(); }

// ---------- package.json ----------
test('K2 package.json declares the beginner scripts, engines and only jsdom', () => {
  const pkg = JSON.parse(read('beginner', 'package.json'));
  const appPkg = JSON.parse(read('app', 'package.json'));
  assert.strictEqual(pkg.private, true);
  assert.strictEqual(pkg.type, 'commonjs');
  assert.strictEqual(pkg.engines.node, '>=18');
  assert.strictEqual(pkg.scripts.test, 'node --test test/*.test.js');
  assert.strictEqual(pkg.scripts.assemble, 'node ../scripts/assemble-beginner.js');
  assert.deepStrictEqual(Object.keys(pkg.devDependencies || {}), ['jsdom']);
  assert.strictEqual(pkg.devDependencies.jsdom, appPkg.devDependencies.jsdom);
  assert.ok(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0, 'no runtime dependencies');
});

test('K2 package-lock.json exists and locks jsdom', () => {
  const lock = JSON.parse(read('beginner', 'package-lock.json'));
  assert.ok(lock.packages && lock.packages['node_modules/jsdom'], 'jsdom is locked');
});

// ---------- source files and globals ----------
test('K2 the five beginner source files exist and each defines its top-level global', () => {
  const want = { 'config.js': 'BEGINNER_CONFIG', 'exercises.js': 'BEGINNER_EXERCISES', 'coach.js': 'Coach', 'store.js': 'Store', 'ui.js': 'UI' };
  for (const [file, name] of Object.entries(want)) {
    const src = read('beginner', file);
    assert.match(src, new RegExp('^const ' + name + '\\b', 'm'), `${file} must declare top-level const ${name}`);
  }
});

test('K2 coach.js is pure: no DOM, storage or clock references in its source', () => {
  const src = read('beginner', 'coach.js');
  for (const bad of [/\bdocument\b/, /\bwindow\b/, /\blocalStorage\b/, /\bindexedDB\b/, /Date\.now/, /new Date\(\s*\)/]) {
    assert.ok(!bad.test(src), `coach.js must not match ${bad}`);
  }
});

test('K2 beginner global names do not collide with app/data.js or app/engine.js', () => {
  const shared = read('app', 'data.js') + '\n' + read('app', 'engine.js');
  for (const name of ['BEGINNER_CONFIG', 'BEGINNER_EXERCISES', 'Coach', 'Store', 'UI']) {
    assert.ok(!new RegExp('^(const|let|var|function|class)\\s+' + name + '\\b', 'm').test(shared), name);
  }
});

// ---------- harness 1 ----------
test('K2 loadBeginner loads without a DOM and returns the full surface', () => {
  assert.strictEqual(typeof document, 'undefined');
  const a = load();
  for (const k of ['Engine', 'EXERCISES', 'EXERCISE_LIST', 'EX_META', 'EX_CUES', 'VOLUME_LANDMARKS', 'EXPERIENCE_FACTOR', 'TIME_MODEL', 'BEGINNER_CONFIG', 'BEGINNER_EXERCISES', 'Coach', 'Store']) {
    assert.ok(a[k] !== undefined && a[k] !== null, `missing ${k}`);
  }
  assert.ok(Array.isArray(a.BEGINNER_EXERCISES));
  assert.ok(Array.isArray(a.EXERCISE_LIST) && a.EXERCISE_LIST.length > 0);
  assert.strictEqual(typeof a.Coach, 'object');
  assert.strictEqual(typeof a.Store, 'object');
});

test('K2 loadBeginner exposes a callable shared Engine returning this-realm values', () => {
  const { Engine } = load();
  assert.strictEqual(typeof Engine.e1rm, 'function');
  assert.strictEqual(typeof Engine.weightFor, 'function');
  const e = Engine.e1rm(100, 5);
  assert.strictEqual(typeof e, 'number');
  assert.ok(e > 100);
  assert.strictEqual(typeof Engine.weightFor(e, 5), 'number');
  // this-realm check: Engine's prototype is this realm's Object.prototype
  assert.strictEqual(Object.getPrototypeOf(Engine), Object.prototype);
});

test('K2 loadBeginner returns independent instances', () => {
  const a = load();
  const b = load();
  assert.notStrictEqual(a.Engine, b.Engine);
  assert.notStrictEqual(a.Coach, b.Coach);
  a.TIME_MODEL.__probe = 1;
  a.Coach.__probe = 1;
  assert.strictEqual(b.TIME_MODEL.__probe, undefined);
  assert.strictEqual(b.Coach.__probe, undefined);
});

test('K2 BEGINNER_CONFIG is a deeply frozen plain object', () => {
  const { BEGINNER_CONFIG } = load();
  assert.strictEqual(Object.getPrototypeOf(BEGINNER_CONFIG), Object.prototype);
  (function walk(o, p) {
    assert.ok(Object.isFrozen(o), `${p} is not frozen`);
    for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object') walk(v, p + '.' + k);
  })(BEGINNER_CONFIG, 'BEGINNER_CONFIG');
});

// ---------- index.html ----------
test('K2 index.html has #app, a viewport meta and the seven scripts in order by flat path', () => {
  const html = read('beginner', 'index.html');
  assert.match(html, /<div[^>]*\bid=["']app["']/);
  assert.match(html, /<meta[^>]*name=["']viewport["']/);
  const srcs = [...html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["']/g)].map(m => m[1]);
  assert.deepStrictEqual(srcs, SEVEN);
});

// ---------- harness 2 + DOM ----------
test('K2 load-dom exports loadDom and does not require jsdom at module load', () => {
  const src = read('beginner', 'test', 'load-dom.js');
  const beforeFn = src.split(/function\s+loadDom/)[0];
  assert.ok(!/require\(\s*['"]jsdom['"]\s*\)/.test(beforeFn), 'jsdom must be required inside loadDom');
  assert.strictEqual(typeof require('./load-dom').loadDom, 'function');
});

if (NODE_MAJOR < 20) {
  test('K2 DOM scaffold tests (skipped: jsdom requires Node >= 20)', { skip: true }, () => {});
} else {
  test('K2 loadDom provides #app, all globals including UI, and makes no network request', () => {
    let calls = 0;
    const realFetch = globalThis.fetch;
    globalThis.fetch = function () { calls++; return Promise.reject(new Error('network is forbidden in tests')); };
    try {
      const { window, document, app } = require('./load-dom').loadDom();
      assert.ok(window && document);
      assert.ok(document.getElementById('app'), '#app missing');
      for (const k of ['Engine', 'BEGINNER_CONFIG', 'BEGINNER_EXERCISES', 'Coach', 'Store', 'UI']) {
        assert.ok(app[k] !== undefined, `app.${k} missing`);
      }
      assert.strictEqual(typeof app.UI, 'object');
      assert.strictEqual(calls, 0, 'no fetch on load');
    } finally { globalThis.fetch = realFetch; }
  });

  test('K2 loadDom returns independent windows', () => {
    const a = require('./load-dom').loadDom();
    const b = require('./load-dom').loadDom();
    assert.notStrictEqual(a.window, b.window);
    a.document.getElementById('app').innerHTML = '<p>x</p>';
    assert.strictEqual(b.document.getElementById('app').innerHTML, '');
  });
}

// ---------- assemble ----------
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'bg-assemble-')); }
function listAll(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listAll(p, base, out); else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out.sort();
}
function runAssemble(outDir) { return require(path.join(ROOT, 'scripts', 'assemble-beginner.js')).assemble({ outDir }); }

test('K2 assemble copies the required files and engine/data byte-identical to app/', () => {
  const out = tmp();
  try {
    runAssemble(out);
    const files = listAll(out);
    for (const f of ['index.html', 'styles.css', 'config.js', 'exercises.js', 'coach.js', 'store.js', 'ui.js', 'engine.js', 'data.js']) {
      assert.ok(files.includes(f), `missing ${f}`);
    }
    for (const f of ['engine.js', 'data.js']) {
      assert.ok(fs.readFileSync(path.join(out, f)).equals(fs.readFileSync(path.join(ROOT, 'app', f))), `${f} differs from app/`);
    }
    for (const f of ['index.html', 'styles.css', 'config.js', 'exercises.js', 'coach.js', 'store.js', 'ui.js']) {
      assert.ok(fs.readFileSync(path.join(out, f)).equals(fs.readFileSync(path.join(B, f))), `${f} differs from beginner/`);
    }
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('K2 assemble output excludes test, node_modules, package files, android and www', () => {
  const out = tmp();
  try {
    runAssemble(out);
    for (const f of listAll(out)) {
      const top = f.split('/')[0];
      for (const bad of ['test', 'node_modules', 'package.json', 'package-lock.json', 'android', 'www']) {
        assert.notStrictEqual(top, bad, `output must not contain ${f}`);
      }
    }
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('K2 assemble clears the output folder first and is idempotent', () => {
  const out = tmp();
  try {
    fs.writeFileSync(path.join(out, 'stale.txt'), 'old');
    fs.mkdirSync(path.join(out, 'olddir'));
    fs.writeFileSync(path.join(out, 'olddir', 'x.js'), 'old');
    runAssemble(out);
    const first = listAll(out);
    assert.ok(!first.includes('stale.txt') && !first.some(f => f.startsWith('olddir/')), 'stale files removed');
    runAssemble(out);
    assert.deepStrictEqual(listAll(out), first);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('K2 assemble copies media/ only when beginner/media exists', () => {
  const out = tmp();
  try {
    runAssemble(out);
    assert.strictEqual(fs.existsSync(path.join(out, 'media')), fs.existsSync(path.join(B, 'media')));
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('K2 beginner/www/ is git-ignored', () => {
  const texts = [path.join(ROOT, '.gitignore'), path.join(B, '.gitignore')]
    .filter(p => fs.existsSync(p)).map(p => fs.readFileSync(p, 'utf8'));
  const lines = texts.join('\n').split(/\r?\n/).map(l => l.trim());
  assert.ok(lines.some(l => ['beginner/www/', 'beginner/www', '/beginner/www/', '/beginner/www', 'www/', 'www', '/www/', '/www'].includes(l)), 'no ignore rule for beginner/www');
});

// ---------- CI ----------
function jobBlock(yml, key) {
  const lines = yml.split(/\r?\n/);
  const start = lines.findIndex(l => l.replace(/\s+$/, '') === '  ' + key + ':');
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^  [A-Za-z0-9_-]+:\s*$/.test(lines[i]) || /^\S/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n');
}

test('K2 ci.yml keeps job check (node 18 and 20, working directory app)', () => {
  const blk = jobBlock(read('.github', 'workflows', 'ci.yml'), 'check');
  assert.ok(blk, 'job check missing');
  assert.match(blk, /node:\s*\[\s*18\s*,\s*20\s*\]/);
  assert.match(blk, /working-directory:\s*app\s*$/m);
});

test('K2 ci.yml adds job beginner (node 18 and 20, working directory beginner, npm ci and npm test)', () => {
  const blk = jobBlock(read('.github', 'workflows', 'ci.yml'), 'beginner');
  assert.ok(blk, 'job beginner missing');
  assert.match(blk, /node:\s*\[\s*18\s*,\s*20\s*\]/);
  assert.match(blk, /working-directory:\s*beginner\s*$/m);
  assert.match(blk, /run:\s*npm ci\b/);
  assert.match(blk, /run:\s*npm test\b/);
});

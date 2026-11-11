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
   REVISED CONTRACT (after review):
     - Script order in index.html is ordered, not closed: data.js, engine.js, then
       any extra shared scripts, then config.js, exercises.js, coach.js, store.js,
       ui.js in that relative order; all src values flat relative paths.
     - BEGINNER_CONFIG has frozen plain sections exercises, store, coach, ui (more
       may be added, contents free) and NO top-level schemaVersion.
     - Both harnesses expose EVERY top-level const/let/var/function/class declared
       in the beginner files (ui.js too for the DOM harness) plus the fixed shared
       names, and accept an optional { beginnerDir } folder of alternative sources.
     - loadDom() gives the window fetch and XMLHttpRequest stubs that record into
       window.__netCalls (an array) and reject/throw; zero calls on load.
     - Purity of coach.js is checked on comment-stripped source (real window./
       document. access, storage, Date.now, new Date(), fetch( are forbidden).
     - assemble-beginner.js also exports SHARED_FROM_APP (starts data.js, engine.js)
       and BEGINNER_FILES; every SHARED_FROM_APP entry is copied byte-identical.
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

function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
}
const IMPURE = [/\b(window|document)\s*[.\[]/, /\b(localStorage|indexedDB|sessionStorage)\b/, /Date\.now/, /new Date\(\s*\)/, /\bfetch\s*\(/];
const impureHits = src => IMPURE.filter(re => re.test(stripComments(src)));

test('K2 the purity check flags bad samples and passes good ones (cannot go vacuous)', () => {
  const bad = ['const a = document.body;', 'x = window["y"];', 'localStorage.getItem(1)', 'indexedDB.open()',
    'sessionStorage.x', 'const t = Date.now();', 'const d = new Date();', 'fetch("/x")'];
  for (const s of bad) assert.ok(impureHits(s).length > 0, 'should flag: ' + s);
  const good = '// rolling 7-day window, document it\n/* uses Date.now() and fetch( in prose */\nconst d = new Date(ts);\nconst windowSize = 7;';
  assert.deepStrictEqual(impureHits(good), []);
});

test('K2 coach.js is pure: no DOM, storage, clock or network access in its source', () => {
  const hits = impureHits(read('beginner', 'coach.js'));
  assert.deepStrictEqual(hits.map(String), [], 'coach.js must stay pure');
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
  // identity only: exported objects may be frozen by later packages
  for (const k of ['Engine', 'Coach', 'Store', 'TIME_MODEL', 'BEGINNER_CONFIG', 'BEGINNER_EXERCISES', 'EXERCISES']) {
    assert.notStrictEqual(a[k], b[k], `${k} must be a per-load instance`);
  }
});

test('K2 BEGINNER_CONFIG is deeply frozen, sectioned, and has no top-level schemaVersion', () => {
  const { BEGINNER_CONFIG } = load();
  assert.strictEqual(Object.getPrototypeOf(BEGINNER_CONFIG), Object.prototype);
  (function walk(o, p) {
    assert.ok(Object.isFrozen(o), `${p} is not frozen`);
    for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object') walk(v, p + '.' + k);
  })(BEGINNER_CONFIG, 'BEGINNER_CONFIG');
  for (const s of ['exercises', 'store', 'coach', 'ui']) {
    const sec = BEGINNER_CONFIG[s];
    assert.ok(sec && typeof sec === 'object' && !Array.isArray(sec), `section ${s} must be an object`);
    assert.strictEqual(Object.getPrototypeOf(sec), Object.prototype, `section ${s} must be plain`);
    assert.ok(Object.isFrozen(sec), `section ${s} must be frozen`);
  }
  assert.ok(!('schemaVersion' in BEGINNER_CONFIG), 'schemaVersion belongs inside the store section');
});

// ---------- automatic harness exports ----------
function probeDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-probe-'));
  for (const f of ['config.js', 'exercises.js', 'coach.js', 'store.js', 'ui.js', 'index.html']) {
    fs.copyFileSync(path.join(B, f), path.join(dir, f));
  }
  fs.appendFileSync(path.join(dir, 'exercises.js'), '\nconst EXTRA_PROBE = 42;\nfunction extraProbeFn() { return 7; }\n');
  return dir;
}

test('K2 loadBeginner auto-exposes every top-level declaration of the beginner files', () => {
  const dir = probeDir();
  try {
    const a = require('./load-beginner').loadBeginner({ beginnerDir: dir });
    assert.strictEqual(a.EXTRA_PROBE, 42);
    assert.strictEqual(a.extraProbeFn(), 7);
    for (const k of ['BEGINNER_CONFIG', 'BEGINNER_EXERCISES', 'Coach', 'Store', 'Engine', 'EXERCISES']) {
      assert.ok(a[k] !== undefined, `missing ${k}`);
    }
    assert.strictEqual(a.UI, undefined, 'ui.js is not loaded by the non-DOM harness');
    assert.strictEqual(load().EXTRA_PROBE, undefined, 'default behaviour unchanged');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---------- index.html ----------
test('K2 index.html has #app, a viewport meta and ordered flat-path scripts (extras allowed)', () => {
  const html = read('beginner', 'index.html');
  assert.match(html, /<div[^>]*\bid=["']app["']/);
  assert.match(html, /<meta[^>]*name=["']viewport["']/);
  const srcs = [...html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["']/g)].map(m => m[1]);
  for (const s of srcs) assert.ok(!/[\/]|\.\.|http/i.test(s), `src must be a flat relative path: ${s}`);
  const idx = f => srcs.indexOf(f);
  const own = ['config.js', 'exercises.js', 'coach.js', 'store.js', 'ui.js'];
  for (const f of ['data.js', 'engine.js', ...own]) assert.ok(idx(f) >= 0, `missing script ${f}`);
  assert.ok(idx('data.js') < idx('engine.js'), 'data.js before engine.js');
  for (let i = 1; i < own.length; i++) assert.ok(idx(own[i - 1]) < idx(own[i]), `${own[i - 1]} before ${own[i]}`);
  for (const s of srcs.slice(0, idx('config.js'))) assert.ok(idx(s) < idx('config.js'));
  assert.ok(idx('engine.js') < idx('config.js') && idx('data.js') < idx('config.js'), 'shared scripts precede config.js');
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
  test('K2 loadDom provides #app and all globals including UI', () => {
    const { window, document, app } = require('./load-dom').loadDom();
    assert.ok(window && document);
    assert.ok(document.getElementById('app'), '#app missing');
    for (const k of ['Engine', 'BEGINNER_CONFIG', 'BEGINNER_EXERCISES', 'Coach', 'Store', 'UI']) {
      assert.ok(app[k] !== undefined, `app.${k} missing`);
    }
    assert.strictEqual(typeof app.UI, 'object');
  });

  test('K2 loadDom records network use in window.__netCalls: none on load, live spy afterwards', () => {
    const { window } = require('./load-dom').loadDom();
    assert.ok(Array.isArray(window.__netCalls), 'window.__netCalls must be an array');
    assert.strictEqual(window.__netCalls.length, 0, 'no network request on load');
    assert.strictEqual(typeof window.XMLHttpRequest, 'function');
    let result;
    try { result = window.fetch('/x'); } catch (e) { result = null; }
    if (result && typeof result.catch === 'function') result.catch(() => {});
    assert.strictEqual(window.__netCalls.length, 1, 'the fetch spy must be live');
  });

  test('K2 loadDom auto-exposes every top-level declaration including ui.js', () => {
    const dir = probeDir();
    fs.appendFileSync(path.join(dir, 'ui.js'), '\nconst UI_PROBE = 5;\n');
    try {
      const { app } = require('./load-dom').loadDom({ beginnerDir: dir });
      assert.strictEqual(app.EXTRA_PROBE, 42);
      assert.strictEqual(app.extraProbeFn(), 7);
      assert.strictEqual(app.UI_PROBE, 5);
      assert.ok(app.UI && app.Coach && app.Store && app.Engine);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('K2 loadDom returns independent windows', () => {
    const a = require('./load-dom').loadDom();
    const b = require('./load-dom').loadDom();
    assert.notStrictEqual(a.window, b.window);
    assert.notStrictEqual(a.document, b.document);
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

test('K2 assemble exports SHARED_FROM_APP and BEGINNER_FILES lists', () => {
  const m = require(path.join(ROOT, 'scripts', 'assemble-beginner.js'));
  assert.ok(Array.isArray(m.SHARED_FROM_APP), 'SHARED_FROM_APP must be an array');
  assert.ok(Array.isArray(m.BEGINNER_FILES), 'BEGINNER_FILES must be an array');
  assert.deepStrictEqual(m.SHARED_FROM_APP.slice(0, 2), ['data.js', 'engine.js']);
  for (const f of ['index.html', 'styles.css', 'config.js', 'exercises.js', 'coach.js', 'store.js', 'ui.js']) {
    assert.ok(m.BEGINNER_FILES.includes(f), `BEGINNER_FILES must list ${f}`);
  }
});

test('K2 assemble copies the required files and every shared file byte-identical to app/', () => {
  const out = tmp();
  try {
    runAssemble(out);
    const files = listAll(out);
    for (const f of ['index.html', 'styles.css', 'config.js', 'exercises.js', 'coach.js', 'store.js', 'ui.js', 'engine.js', 'data.js']) {
      assert.ok(files.includes(f), `missing ${f}`);
    }
    const m = require(path.join(ROOT, 'scripts', 'assemble-beginner.js'));
    assert.ok(Array.isArray(m.SHARED_FROM_APP), 'SHARED_FROM_APP must be an array');
    for (const f of m.SHARED_FROM_APP) {
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

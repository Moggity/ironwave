/* ============================================================
   BEGINNER APP, package 3 (Store), criteria C6, H1, H2, H3. THIS FILE IS THE SPEC.
   The builder edits only beginner/store.js and the `store` section of
   BEGINNER_CONFIG in beginner/config.js, and may not edit tests.

   store.js is loaded in plain Node by loadBeginner(): at load time it must not
   touch indexedDB, window, document or navigator. Storage is reached only through
   an adapter. Top-level globals are single plain declarations at column zero.
   BEGINNER_CONFIG.store = { schemaVersion: 1, key: <non-empty string> } (more
   fields allowed); the store reads BOTH from config, never hard-coded.

   STATE (plain JSON data, weights in kg, times are epoch ms passed in by callers):
     { version, name:'', goals:[], onboarded:false, excludedEquipment:[], units:null,
       workouts:[ { id, startedAt, endedAt|null, feel:null|'easy'|'right'|'much',
                    plan:[exerciseId], sets:[ { exerciseId, weightKg, reps,
                    effort:null|'easy'|'good'|'hard', at, extra?:true } ] } ] }
   goals keys: arms chest legs fit strong. units: null | 'kg' | 'lb'.

   API on Store:
     defaultState(); migrate(raw); memoryAdapter(initial); idbAdapter(opts);
     open(adapter) -> session db.
   Adapter: exactly two async methods, get(key) -> value|undefined and
     set(key, value) -> resolves when durably written. memoryAdapter(initial) takes
     a plain object mapping key to value (or nothing); values are structured-cloned
     in and out. idbAdapter is lazy (never opened at load); tested by shape only,
     real IndexedDB is verified on device in package 7.
   Session: state (getter), setProfile, excludeEquipment, restoreEquipment,
     startWorkout, activeWorkout (sync), logSet, setEffort, updatePlan, endWorkout,
     setFeel, exportData (sync), importData. Every async method resolves only AFTER
     adapter.set resolved (C6). Writes are serialised in call order (no lost update).

   DECISIONS PINNED HERE (the lead's defaults):
     - migrate drops unknown top-level fields; never mutates input; never throws
       except E_NEWER_VERSION for an integer version above the current one.
       A missing, non-integer or < 1 version is treated as legacy and upgraded.
     - migrate drops: non-object workouts, workouts without a non-empty string id or
       a finite startedAt, sets without a string exerciseId, finite weightKg >= 0 and
       integer reps >= 0. Invalid effort/feel become null. Unknown goal keys, bad
       units, non-string equipment are dropped/nulled; goals and equipment are
       de-duplicated. At most one open workout survives migrate.
     - Store.open on an adapter holding a newer version rejects E_NEWER_VERSION and
       writes nothing.
     - A failed adapter.set rejects the call AND rolls the in-memory state back, so
       db.state equals what a reopen would see; later writes still work.
     - logSet stores `extra: true` only when extra === true; otherwise no key.
     - importData rejects E_BAD_IMPORT on non-string, invalid JSON, non-object,
       wrong or missing app marker ('ironwave-beginner'), or a newer-version state.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadBeginner } = require('./load-beginner');

const B = path.join(__dirname, '..');
const { Store, BEGINNER_CONFIG } = loadBeginner();
const KEY = BEGINNER_CONFIG.store.key;
const VER = BEGINNER_CONFIG.store.schemaVersion;
const clone = v => JSON.parse(JSON.stringify(v));
const tick = async (n = 5) => { for (let i = 0; i < n; i++) await new Promise(r => setImmediate(r)); };

function deepFreeze(o) {
  if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); }
  return o;
}

// Adapter wrapper: records set calls, can gate sets, fail sets, and delay sets.
function instrument(base) {
  const a = { sets: [], gate: null, failNext: 0, delays: [] };
  a.get = k => base.get(k);
  a.set = async (k, v) => {
    a.sets.push(k);
    const d = a.delays.length ? a.delays.shift() : 0;
    for (let i = 0; i < d; i++) await new Promise(r => setImmediate(r));
    if (a.failNext > 0) { a.failNext--; throw new Error('disk full'); }
    if (a.gate) await a.gate.promise;
    return base.set(k, v);
  };
  a.arm = () => { let res; const promise = new Promise(r => { res = r; }); a.gate = { promise, release: () => { a.gate = null; res(); } }; return a.gate; };
  return a;
}

async function fresh() {
  const base = Store.memoryAdapter();
  const ad = instrument(base);
  const db = await Store.open(ad);
  return { base, ad, db };
}
const reopen = base => Store.open(base);
const rejectsWith = async (p, code) => {
  let err = null;
  try { await p; } catch (e) { err = e; }
  assert.ok(err, 'expected a rejection with ' + code);
  assert.strictEqual(err.code, code);
};

const SET1 = { exerciseId: 'goblet-squat', weightKg: 12.5, reps: 10, effort: null, now: 1000 };

// ---------- config ----------
test('H2 config: schemaVersion is 1 and key is a non-empty string', () => {
  assert.strictEqual(BEGINNER_CONFIG.store.schemaVersion, 1);
  assert.strictEqual(typeof BEGINNER_CONFIG.store.key, 'string');
  assert.ok(BEGINNER_CONFIG.store.key.length > 0);
});

function customDir(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-store-'));
  for (const f of ['exercises.js', 'coach.js', 'store.js', 'ui.js', 'index.html']) fs.copyFileSync(path.join(B, f), path.join(dir, f));
  const cfg = clone(BEGINNER_CONFIG);
  mutate(cfg.store);
  const src = fs.readFileSync(path.join(B, 'config.js'), 'utf8');
  const head = src.slice(0, src.indexOf('const BEGINNER_CONFIG'));
  fs.writeFileSync(path.join(dir, 'config.js'), head + 'const BEGINNER_CONFIG = beginnerDeepFreeze(' + JSON.stringify(cfg) + ');\n');
  return dir;
}

test('H2 config: the store reads its key and schemaVersion from config', async () => {
  const dir = customDir(s => { s.key = 'custom-key-xyz'; s.schemaVersion = 2; });
  try {
    const L = loadBeginner({ beginnerDir: dir });
    assert.strictEqual(L.BEGINNER_CONFIG.store.key, 'custom-key-xyz');
    assert.strictEqual(L.Store.defaultState().version, 2);
    const base = L.Store.memoryAdapter();
    const db = await L.Store.open(base);
    await db.startWorkout({ plan: ['a'], now: 1 });
    assert.ok(await base.get('custom-key-xyz'), 'written under the configured key');
    assert.strictEqual(await base.get(KEY), undefined, 'not under the default key');
    const seeded = L.Store.memoryAdapter({ 'custom-key-xyz': { version: 2, name: 'Zed' } });
    assert.strictEqual((await L.Store.open(seeded)).state.name, 'Zed');
    assert.throws(() => L.Store.migrate({ version: 3 }), e => e.code === 'E_NEWER_VERSION');
    assert.doesNotThrow(() => L.Store.migrate({ version: 2 }));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---------- shape / load ----------
test('H1 loading store.js in Node does not throw and exposes the API by shape', () => {
  assert.doesNotThrow(() => loadBeginner());
  for (const f of ['defaultState', 'migrate', 'memoryAdapter', 'idbAdapter', 'open']) {
    assert.strictEqual(typeof Store[f], 'function', 'Store.' + f);
  }
  const a = Store.idbAdapter({ name: 'unused' });
  assert.strictEqual(typeof a.get, 'function');
  assert.strictEqual(typeof a.set, 'function');
});

// ---------- H2 ----------
test('H2 default state carries the version and the empty shape', () => {
  const s = Store.defaultState();
  assert.deepStrictEqual(s, { version: VER, name: '', goals: [], onboarded: false, excludedEquipment: [], units: null, workouts: [] });
  assert.notStrictEqual(Store.defaultState(), Store.defaultState(), 'fresh object each call');
  s.goals.push('arms');
  assert.deepStrictEqual(Store.defaultState().goals, []);
});

const GOOD_WORKOUT = {
  id: 'w1', startedAt: 1000, endedAt: 5000, feel: 'right', plan: ['squat', 'row'],
  sets: [
    { exerciseId: 'squat', weightKg: 20, reps: 8, effort: 'good', at: 2000 },
    { exerciseId: 'row', weightKg: 0, reps: 12, effort: null, at: 3000, extra: true },
  ],
};
const OPEN_WORKOUT = { id: 'w2', startedAt: 9000, endedAt: null, feel: null, plan: ['squat'], sets: [{ exerciseId: 'squat', weightKg: 22.5, reps: 8, effort: 'hard', at: 9500 }] };
const FIXTURES = {
  null: null,
  undefined: undefined,
  emptyObject: {},
  array: [],
  string: 'garbage',
  number: 42,
  noVersionLegacy: { name: 'Sam', goals: ['arms', 'legs'], workouts: [GOOD_WORKOUT] },
  versionOnly: { version: 1 },
  partial: { version: 1, name: 'Al', workouts: [clone(GOOD_WORKOUT)] },
  currentFull: { version: VER, name: 'Bo', goals: ['fit'], onboarded: true, excludedEquipment: ['barbell'], units: 'lb', workouts: [GOOD_WORKOUT, OPEN_WORKOUT] },
  unknownFields: { version: 1, name: 'C', mystery: { a: 1 }, extra: true, workouts: [] },
  badTypes: { version: 1, name: 5, goals: 'arms', onboarded: 'yes', excludedEquipment: [1, null, 'bench', 'bench'], units: 'stone', workouts: 'nope' },
  badGoalsDup: { goals: ['arms', 'arms', 'bogus', 7] },
  badVersions: { version: 'abc', name: 'D' },
  garbageWorkouts: { workouts: [null, 5, 'x', [], {}, { id: 1 }, { id: '', startedAt: 1 }, { id: 'nots' }, GOOD_WORKOUT] },
  badSets: { workouts: [{ ...clone(GOOD_WORKOUT), sets: [null, { exerciseId: 'a' }, { exerciseId: 'a', weightKg: -1, reps: 5, at: 1 }, { exerciseId: 'a', weightKg: 5, reps: 1.5, at: 1 }, { exerciseId: 'a', weightKg: NaN, reps: 5, at: 1 }, { exerciseId: 'ok', weightKg: 5, reps: 5, effort: 'wild', at: 1 }] }] },
  twoOpen: { workouts: [{ id: 'a', startedAt: 1, endedAt: null, plan: [], sets: [] }, { id: 'b', startedAt: 2, endedAt: null, plan: [], sets: [] }] },
};

function assertValidState(s) {
  assert.strictEqual(s.version, VER);
  assert.strictEqual(typeof s.name, 'string');
  assert.ok(Array.isArray(s.goals) && s.goals.every(g => ['arms', 'chest', 'legs', 'fit', 'strong'].includes(g)));
  assert.strictEqual(new Set(s.goals).size, s.goals.length);
  assert.strictEqual(typeof s.onboarded, 'boolean');
  assert.ok(Array.isArray(s.excludedEquipment) && s.excludedEquipment.every(e => typeof e === 'string'));
  assert.strictEqual(new Set(s.excludedEquipment).size, s.excludedEquipment.length);
  assert.ok(s.units === null || s.units === 'kg' || s.units === 'lb');
  assert.ok(Array.isArray(s.workouts));
  let open = 0;
  for (const w of s.workouts) {
    assert.ok(typeof w.id === 'string' && w.id.length > 0);
    assert.ok(Number.isFinite(w.startedAt));
    assert.ok(w.endedAt === null || Number.isFinite(w.endedAt));
    if (w.endedAt === null) open++;
    assert.ok([null, 'easy', 'right', 'much'].includes(w.feel));
    assert.ok(Array.isArray(w.plan) && w.plan.every(p => typeof p === 'string'));
    for (const st of w.sets) {
      assert.ok(typeof st.exerciseId === 'string');
      assert.ok(Number.isFinite(st.weightKg) && st.weightKg >= 0);
      assert.ok(Number.isInteger(st.reps) && st.reps >= 0);
      assert.ok([null, 'easy', 'good', 'hard'].includes(st.effort));
      assert.ok(Number.isFinite(st.at));
      if ('extra' in st) assert.strictEqual(st.extra, true);
    }
  }
  assert.ok(open <= 1, 'at most one open workout');
}

test('H2 migrate returns a valid current-version state for every fixture and is idempotent', () => {
  assert.ok(Object.keys(FIXTURES).length >= 8);
  for (const [name, raw] of Object.entries(FIXTURES)) {
    const once = Store.migrate(raw);
    assertValidState(once);
    assert.deepStrictEqual(Store.migrate(once), once, 'idempotent for ' + name);
    assert.deepStrictEqual(Store.migrate(Store.migrate(raw)), Store.migrate(raw), 'migrate(migrate(x)) for ' + name);
  }
});

test('H2 migrate never mutates its input (deeply frozen fixtures)', () => {
  for (const [name, raw] of Object.entries(FIXTURES)) {
    const snap = raw === undefined ? undefined : JSON.stringify(raw);
    const frozen = raw && typeof raw === 'object' ? deepFreeze(clone(raw)) : raw;
    assert.doesNotThrow(() => Store.migrate(frozen), name);
    if (snap !== undefined) assert.strictEqual(JSON.stringify(frozen), snap, name);
  }
});

test('H2 migrate output does not share references with its input', () => {
  const raw = clone(FIXTURES.currentFull);
  const out = Store.migrate(raw);
  out.workouts[0].sets[0].reps = 99;
  out.goals.push('chest');
  assert.strictEqual(raw.workouts[0].sets[0].reps, 8);
  assert.deepStrictEqual(raw.goals, ['fit']);
});

test('H2 migrate of null, undefined, {} and a legacy no-version save gives sensible content', () => {
  for (const raw of [null, undefined, {}]) assert.deepStrictEqual(Store.migrate(raw), Store.defaultState());
  const legacy = Store.migrate(FIXTURES.noVersionLegacy);
  assert.strictEqual(legacy.name, 'Sam');
  assert.deepStrictEqual(legacy.goals, ['arms', 'legs']);
  assert.deepStrictEqual(legacy.workouts, [GOOD_WORKOUT]);
  assert.strictEqual(legacy.units, null);
  assert.strictEqual(legacy.onboarded, false);
});

test('H2 migrate keeps a fully valid current state unchanged', () => {
  assert.deepStrictEqual(Store.migrate(FIXTURES.currentFull), FIXTURES.currentFull);
});

test('H2 migrate drops unknown top-level fields', () => {
  const out = Store.migrate(FIXTURES.unknownFields);
  assert.deepStrictEqual(Object.keys(out).sort(), Object.keys(Store.defaultState()).sort());
  assert.strictEqual(out.name, 'C');
});

test('H2 migrate cleans bad field types and duplicates', () => {
  const out = Store.migrate(FIXTURES.badTypes);
  assert.strictEqual(out.name, '');
  assert.deepStrictEqual(out.goals, []);
  assert.strictEqual(out.onboarded, false);
  assert.deepStrictEqual(out.excludedEquipment, ['bench']);
  assert.strictEqual(out.units, null);
  assert.deepStrictEqual(out.workouts, []);
  assert.deepStrictEqual(Store.migrate(FIXTURES.badGoalsDup).goals, ['arms']);
  assert.strictEqual(Store.migrate(FIXTURES.badVersions).name, 'D');
});

test('H2 migrate drops malformed workouts and sets and keeps the good ones in order', () => {
  assert.deepStrictEqual(Store.migrate(FIXTURES.garbageWorkouts).workouts, [GOOD_WORKOUT]);
  const w = Store.migrate(FIXTURES.badSets).workouts[0];
  assert.strictEqual(w.sets.length, 1);
  assert.strictEqual(w.sets[0].exerciseId, 'ok');
  assert.strictEqual(w.sets[0].effort, null, 'unknown effort becomes null');
  assert.ok(Store.migrate(FIXTURES.twoOpen).workouts.filter(x => x.endedAt === null).length <= 1);
});

test('H2 a state with a newer version is rejected with E_NEWER_VERSION, never downgraded', () => {
  for (const v of [VER + 1, VER + 50]) {
    assert.throws(() => Store.migrate({ version: v, name: 'x' }), e => e instanceof Error && e.code === 'E_NEWER_VERSION');
  }
});

test('H2 open rejects a newer stored version and writes nothing', async () => {
  const base = Store.memoryAdapter({ [KEY]: { version: VER + 1, name: 'future' } });
  const ad = instrument(base);
  await rejectsWith(Store.open(ad), 'E_NEWER_VERSION');
  assert.strictEqual(ad.sets.length, 0);
  assert.strictEqual((await base.get(KEY)).name, 'future');
});

test('H2 open loads a legacy save from the adapter through migrate', async () => {
  const base = Store.memoryAdapter({ [KEY]: clone(FIXTURES.noVersionLegacy) });
  const db = await Store.open(base);
  assert.deepStrictEqual(db.state, Store.migrate(FIXTURES.noVersionLegacy));
  const empty = await Store.open(Store.memoryAdapter());
  assert.deepStrictEqual(empty.state, Store.defaultState());
});

test('H2 memoryAdapter clones values in and out', async () => {
  const obj = { a: { b: 1 } };
  const m = Store.memoryAdapter();
  assert.strictEqual(await m.get('k'), undefined);
  await m.set('k', obj);
  obj.a.b = 2;
  const got = await m.get('k');
  assert.strictEqual(got.a.b, 1);
  got.a.b = 3;
  assert.strictEqual((await m.get('k')).a.b, 1);
  const seed = { k2: { z: 1 } };
  const m2 = Store.memoryAdapter(seed);
  seed.k2.z = 9;
  assert.strictEqual((await m2.get('k2')).z, 1);
});

// ---------- session basics ----------
test('C6 startWorkout appends an open workout, returns its id and never opens two', async () => {
  const { db } = await fresh();
  assert.strictEqual(db.activeWorkout(), null);
  const id = await db.startWorkout({ plan: ['squat', 'row'], now: 1000 });
  assert.ok(typeof id === 'string' && id.length > 0);
  const w = db.activeWorkout();
  assert.deepStrictEqual(w, { id, startedAt: 1000, endedAt: null, feel: null, plan: ['squat', 'row'], sets: [] });
  const again = await db.startWorkout({ plan: ['other'], now: 2000 });
  assert.strictEqual(again, id);
  assert.strictEqual(db.state.workouts.length, 1);
  assert.deepStrictEqual(db.activeWorkout().plan, ['squat', 'row']);
  assert.strictEqual(db.activeWorkout().startedAt, 1000);
});

test('C6 workout ids are unique non-empty strings', async () => {
  const { db } = await fresh();
  const ids = [];
  for (let i = 0; i < 5; i++) {
    ids.push(await db.startWorkout({ plan: ['a'], now: 100 + i }));
    await db.logSet({ ...SET1, now: 100 + i });
    await db.endWorkout({ now: 200 + i, feel: 'right' });
  }
  assert.strictEqual(new Set(ids).size, 5);
  assert.ok(ids.every(i => typeof i === 'string' && i.length > 0));
});

test('C6 logSet appends the set to the active workout with all fields', async () => {
  const { db } = await fresh();
  await db.startWorkout({ plan: ['goblet-squat'], now: 500 });
  await db.logSet(SET1);
  await db.logSet({ exerciseId: 'row', weightKg: 0, reps: 0, effort: 'easy', now: 1100, extra: true });
  await db.logSet({ exerciseId: 'row', weightKg: 7.25, reps: 12, now: 1200, extra: false });
  const sets = db.activeWorkout().sets;
  assert.deepStrictEqual(sets[0], { exerciseId: 'goblet-squat', weightKg: 12.5, reps: 10, effort: null, at: 1000 });
  assert.deepStrictEqual(sets[1], { exerciseId: 'row', weightKg: 0, reps: 0, effort: 'easy', at: 1100, extra: true });
  assert.deepStrictEqual(sets[2], { exerciseId: 'row', weightKg: 7.25, reps: 12, effort: null, at: 1200 });
  assert.ok(!('extra' in sets[0]) && !('extra' in sets[2]));
});

test('C6 logSet rejects E_NO_WORKOUT when no workout is active and writes nothing', async () => {
  const { db, ad } = await fresh();
  await rejectsWith(db.logSet(SET1), 'E_NO_WORKOUT');
  await db.startWorkout({ plan: ['a'], now: 1 });
  await db.logSet(SET1);
  await db.endWorkout({ now: 5, feel: null });
  const n = ad.sets.length;
  await rejectsWith(db.logSet(SET1), 'E_NO_WORKOUT');
  assert.strictEqual(ad.sets.length, n);
});

test('C6 logSet rejects invalid input with E_BAD_SET and writes nothing', async () => {
  const { db, ad } = await fresh();
  await db.startWorkout({ plan: ['a'], now: 1 });
  const n = ad.sets.length;
  const bad = [
    { weightKg: NaN }, { weightKg: Infinity }, { weightKg: -1 }, { weightKg: -0.5 },
    { reps: 1.5 }, { reps: -1 }, { reps: NaN }, { effort: 'wild' },
  ];
  for (const patch of bad) {
    await rejectsWith(db.logSet({ ...SET1, ...patch }), 'E_BAD_SET');
  }
  assert.strictEqual(ad.sets.length, n);
  assert.strictEqual(db.activeWorkout().sets.length, 0);
  await db.logSet({ ...SET1, weightKg: 0, reps: 0, effort: 'good' });
  assert.strictEqual(db.activeWorkout().sets.length, 1);
});

test('C6 setEffort sets the effort of an already logged set by index', async () => {
  const { db, base } = await fresh();
  await db.startWorkout({ plan: ['a'], now: 1 });
  await db.logSet(SET1);
  await db.logSet({ ...SET1, now: 1100 });
  await db.setEffort({ index: 1, effort: 'hard' });
  await db.setEffort({ index: 0, effort: 'easy' });
  assert.deepStrictEqual(db.activeWorkout().sets.map(s => s.effort), ['easy', 'hard']);
  const re = await reopen(base);
  assert.deepStrictEqual(re.activeWorkout().sets.map(s => s.effort), ['easy', 'hard']);
});

test('C6 updatePlan replaces the active workout plan', async () => {
  const { db, base } = await fresh();
  await db.startWorkout({ plan: ['a', 'b'], now: 1 });
  await db.updatePlan(['a', 'c', 'd']);
  assert.deepStrictEqual(db.activeWorkout().plan, ['a', 'c', 'd']);
  assert.deepStrictEqual((await reopen(base)).activeWorkout().plan, ['a', 'c', 'd']);
});

test('C6 endWorkout stamps endedAt and feel; a workout with zero sets is removed', async () => {
  const { db, base } = await fresh();
  const id = await db.startWorkout({ plan: ['a'], now: 10 });
  await db.logSet(SET1);
  await db.endWorkout({ now: 99, feel: 'much' });
  assert.strictEqual(db.activeWorkout(), null);
  const w = db.state.workouts.find(x => x.id === id);
  assert.strictEqual(w.endedAt, 99);
  assert.strictEqual(w.feel, 'much');
  await db.setFeel(id, 'easy');
  assert.strictEqual(db.state.workouts[0].feel, 'easy');
  assert.strictEqual((await reopen(base)).state.workouts[0].feel, 'easy');

  await db.startWorkout({ plan: ['a'], now: 200 });
  await db.endWorkout({ now: 210, feel: null });
  assert.strictEqual(db.state.workouts.length, 1, 'empty workout removed');
  assert.strictEqual((await reopen(base)).state.workouts.length, 1);
  assert.strictEqual(db.activeWorkout(), null);
});

test('C6 setProfile updates only name, goals, onboarded and units, partially', async () => {
  const { db, base } = await fresh();
  await db.setProfile({ name: 'Sam', goals: ['arms'] });
  assert.strictEqual(db.state.name, 'Sam');
  assert.deepStrictEqual(db.state.goals, ['arms']);
  assert.strictEqual(db.state.onboarded, false);
  await db.setProfile({ onboarded: true, units: 'lb' });
  assert.strictEqual(db.state.name, 'Sam');
  assert.deepStrictEqual(db.state.goals, ['arms']);
  assert.strictEqual(db.state.onboarded, true);
  assert.strictEqual(db.state.units, 'lb');
  await db.setProfile({ units: null, workouts: [{ id: 'evil' }], version: 99 });
  assert.strictEqual(db.state.units, null);
  assert.deepStrictEqual(db.state.workouts, []);
  assert.strictEqual(db.state.version, VER);
  const re = await reopen(base);
  assert.strictEqual(re.state.name, 'Sam');
  assert.strictEqual(re.state.onboarded, true);
});

test('C6 excludeEquipment and restoreEquipment keep the list free of duplicates', async () => {
  const { db, base } = await fresh();
  await db.excludeEquipment('barbell');
  await db.excludeEquipment('barbell');
  await db.excludeEquipment('bench');
  assert.deepStrictEqual(db.state.excludedEquipment, ['barbell', 'bench']);
  await db.restoreEquipment('cable');
  assert.deepStrictEqual(db.state.excludedEquipment, ['barbell', 'bench']);
  await db.restoreEquipment('barbell');
  assert.deepStrictEqual(db.state.excludedEquipment, ['bench']);
  assert.deepStrictEqual((await reopen(base)).state.excludedEquipment, ['bench']);
});

// ---------- C6 durability ----------
test('C6 after logSet resolves, a brand-new open on the same adapter sees the set and the active workout', async () => {
  const { db, base } = await fresh();
  const id = await db.startWorkout({ plan: ['goblet-squat', 'row'], now: 1 });
  await db.logSet(SET1);
  await db.logSet({ ...SET1, weightKg: 15, reps: 8, now: 2000 });
  const killed = await reopen(base); // simulates killing the app and reopening
  const w = killed.activeWorkout();
  assert.ok(w, 'workout resumes');
  assert.strictEqual(w.id, id);
  assert.deepStrictEqual(w.plan, ['goblet-squat', 'row']);
  assert.deepStrictEqual(w.sets.map(s => [s.exerciseId, s.weightKg, s.reps]), [['goblet-squat', 12.5, 10], ['goblet-squat', 15, 8]]);
  assert.deepStrictEqual(killed.state, db.state);
});

// Every write method must resolve only after adapter.set resolved.
const WRITERS = {
  startWorkout: { prep: async () => {}, run: db => db.startWorkout({ plan: ['a'], now: 1 }) },
  logSet: { prep: db => db.startWorkout({ plan: ['a'], now: 1 }), run: db => db.logSet(SET1) },
  setEffort: { prep: async db => { await db.startWorkout({ plan: ['a'], now: 1 }); await db.logSet(SET1); }, run: db => db.setEffort({ index: 0, effort: 'hard' }) },
  updatePlan: { prep: db => db.startWorkout({ plan: ['a'], now: 1 }), run: db => db.updatePlan(['a', 'b']) },
  endWorkout: { prep: async db => { await db.startWorkout({ plan: ['a'], now: 1 }); await db.logSet(SET1); }, run: db => db.endWorkout({ now: 9, feel: 'right' }) },
  setFeel: { prep: async db => { const id = await db.startWorkout({ plan: ['a'], now: 1 }); await db.logSet(SET1); await db.endWorkout({ now: 9, feel: null }); db.__id = id; }, run: db => db.setFeel(db.__id, 'easy') },
  setProfile: { prep: async () => {}, run: db => db.setProfile({ name: 'Q' }) },
  excludeEquipment: { prep: async () => {}, run: db => db.excludeEquipment('bench') },
  restoreEquipment: { prep: db => db.excludeEquipment('bench'), run: db => db.restoreEquipment('bench') },
  importData: { prep: async () => {}, run: db => db.importData(JSON.stringify({ app: 'ironwave-beginner', exportedAt: 1, state: { version: VER, name: 'Imp' } })) },
};
for (const [name, w] of Object.entries(WRITERS)) {
  test(`C6 ${name} does not resolve before the adapter set resolves`, async () => {
    const { db, ad, base } = await fresh();
    await w.prep(db);
    const before = ad.sets.length;
    const gate = ad.arm();
    let settled = false;
    const p = w.run(db).then(() => { settled = true; }, () => { settled = true; });
    await tick();
    assert.ok(ad.sets.length > before, 'a write was started');
    assert.strictEqual(settled, false, 'still pending while adapter.set is pending');
    gate.release();
    await p;
    assert.strictEqual(settled, true);
    assert.deepStrictEqual((await reopen(base)).state, db.state, 'what resolved is what a reopen sees');
  });
}

test('C6 rapid sequential logSet calls (not awaited individually) all land in order', async () => {
  const { db, ad, base } = await fresh();
  await db.startWorkout({ plan: ['a'], now: 1 });
  ad.delays = [6, 0, 3, 0, 5, 1, 0, 2]; // uneven write latency must not reorder or drop
  const ps = [];
  for (let i = 1; i <= 8; i++) ps.push(db.logSet({ exerciseId: 'a', weightKg: i, reps: i, effort: null, now: 1000 + i }));
  await Promise.all(ps);
  assert.deepStrictEqual(db.activeWorkout().sets.map(s => s.reps), [1, 2, 3, 4, 5, 6, 7, 8]);
  const re = await reopen(base);
  assert.deepStrictEqual(re.activeWorkout().sets.map(s => s.reps), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepStrictEqual(re.state, db.state);
});

test('C6 mixed rapid writes (log, effort, plan, equipment) are all applied in call order', async () => {
  const { db, ad, base } = await fresh();
  await db.startWorkout({ plan: ['a'], now: 1 });
  ad.delays = [4, 0, 2];
  await Promise.all([
    db.logSet({ ...SET1, now: 10 }),
    db.setEffort({ index: 0, effort: 'good' }),
    db.updatePlan(['a', 'b']),
    db.excludeEquipment('bench'),
    db.logSet({ ...SET1, reps: 6, now: 20 }),
  ]);
  const re = await reopen(base);
  const w = re.activeWorkout();
  assert.strictEqual(w.sets.length, 2);
  assert.strictEqual(w.sets[0].effort, 'good');
  assert.deepStrictEqual(w.plan, ['a', 'b']);
  assert.deepStrictEqual(re.state.excludedEquipment, ['bench']);
});

test('C6 a failing adapter set rejects the call and rolls the in-memory state back', async () => {
  const { db, ad, base } = await fresh();
  await db.startWorkout({ plan: ['a'], now: 1 });
  await db.logSet(SET1);
  const before = clone(db.state);
  ad.failNext = 1;
  let err = null;
  try { await db.logSet({ ...SET1, reps: 3, now: 2000 }); } catch (e) { err = e; }
  assert.ok(err, 'the call rejects');
  assert.deepStrictEqual(db.state, before, 'in-memory state rolled back');
  assert.deepStrictEqual((await reopen(base)).state, before, 'matches what a reopen sees');
  await db.logSet({ ...SET1, reps: 4, now: 3000 }); // queue is not poisoned
  assert.deepStrictEqual(db.activeWorkout().sets.map(s => s.reps), [10, 4]);
  assert.deepStrictEqual((await reopen(base)).state, db.state);
});

test('C6 a failing write in other methods also rolls back', async () => {
  const { db, ad, base } = await fresh();
  await db.startWorkout({ plan: ['a'], now: 1 });
  await db.logSet(SET1);
  const before = clone(db.state);
  for (const fn of [
    () => db.setEffort({ index: 0, effort: 'hard' }),
    () => db.updatePlan(['z']),
    () => db.endWorkout({ now: 50, feel: 'easy' }),
    () => db.setProfile({ name: 'X' }),
    () => db.excludeEquipment('bench'),
  ]) {
    ad.failNext = 1;
    await assert.rejects(fn());
    assert.deepStrictEqual(db.state, before);
  }
  assert.deepStrictEqual((await reopen(base)).state, before);
  assert.ok(db.activeWorkout(), 'workout still resumable');
});

test('C6 a failing startWorkout leaves no workout behind', async () => {
  const { db, ad, base } = await fresh();
  ad.failNext = 1;
  await assert.rejects(db.startWorkout({ plan: ['a'], now: 1 }));
  assert.strictEqual(db.activeWorkout(), null);
  assert.deepStrictEqual(db.state.workouts, []);
  assert.strictEqual((await reopen(base)).activeWorkout(), null);
});

// ---------- H1 ----------
// Strip comments while respecting string and template literals, so a "//" inside a
// URL string does not hide the rest of the line from the scan.
function stripComments(src) {
  let out = '', i = 0, q = null;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (q) {
      out += c;
      if (c === '\\') { out += d || ''; i += 2; continue; }
      if (c === q) q = null;
      i++;
    } else if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; }
    else if (c === '/' && d === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; }
    else { if (c === '"' || c === "'" || c === '`') q = c; out += c; i++; }
  }
  return out;
}
const NET_PATTERNS = [/\bfetch\s*\(/, /XMLHttpRequest/, /WebSocket/, /sendBeacon/, /EventSource/, /\bimport\s*\(/, /https?:/i];
const netHits = src => NET_PATTERNS.filter(re => re.test(stripComments(src))).map(String);

test('H1 the network scanner flags bad samples and ignores comments (not vacuous)', () => {
  for (const bad of [
    "fetch('/x')", 'await fetch (u)', 'new XMLHttpRequest()', 'new WebSocket(u)', 'navigator.sendBeacon(u)',
    'new EventSource(u)', "await import('x')", "const u = 'http://example.com'", 'const u = "https://a.b"',
    "// note\nfetch('http://x')", "const s = 'a'; const u = 'http://x'; // c",
  ]) assert.ok(netHits(bad).length > 0, 'should flag: ' + bad);
  for (const ok of ['// fetch( http://x\nconst a = 1;', '/* XMLHttpRequest import( */ const a = 1;', 'const a = 1; // sendBeacon']) {
    assert.deepStrictEqual(netHits(ok), [], 'should not flag: ' + ok);
  }
});

test('H1 store.js source has no network API, dynamic import or http URL', () => {
  const src = fs.readFileSync(path.join(B, 'store.js'), 'utf8');
  assert.deepStrictEqual(netHits(src), []);
  // store.js must be real (not the empty placeholder) for this check to mean anything
  assert.ok(src.replace(/\s/g, '').length > 200, 'store.js is implemented');
});

test('H1 a full open, log, export, import cycle makes zero network calls', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (...a) => { calls.push(a); return Promise.reject(new Error('no network')); };
  try {
    const { db } = await fresh();
    await db.setProfile({ name: 'Net', goals: ['fit'], onboarded: true });
    await db.startWorkout({ plan: ['a'], now: 1 });
    await db.logSet(SET1);
    const text = db.exportData({ now: 5 });
    const other = await Store.open(Store.memoryAdapter());
    await other.importData(text);
    await db.endWorkout({ now: 9, feel: 'right' });
    assert.deepStrictEqual(other.state.name, 'Net');
  } finally { globalThis.fetch = realFetch; }
  assert.strictEqual(calls.length, 0);
});

// ---------- H3 ----------
async function busySession() {
  const s = await fresh();
  const { db } = s;
  await db.setProfile({ name: 'Round', goals: ['arms', 'strong'], onboarded: true, units: 'kg' });
  await db.excludeEquipment('barbell');
  const id = await db.startWorkout({ plan: ['a', 'b'], now: 100 });
  await db.logSet({ exerciseId: 'a', weightKg: 2.5, reps: 10, effort: 'good', now: 110 });
  await db.logSet({ exerciseId: 'b', weightKg: 7.25, reps: 8, effort: null, now: 120, extra: true });
  await db.logSet({ exerciseId: 'b', weightKg: 0, reps: 15, effort: 'easy', now: 130 });
  await db.endWorkout({ now: 200, feel: 'right' });
  const id2 = await db.startWorkout({ plan: ['a'], now: 300 });
  await db.logSet({ exerciseId: 'a', weightKg: 12.75, reps: 5, effort: 'hard', now: 310 });
  return { ...s, id, id2 };
}

test('H3 export is one string of valid JSON with the app marker, exportedAt and state', async () => {
  const { db } = await busySession();
  const text = db.exportData({ now: 777 });
  assert.strictEqual(typeof text, 'string');
  const parsed = JSON.parse(text);
  assert.strictEqual(parsed.app, 'ironwave-beginner');
  assert.strictEqual(parsed.exportedAt, 777);
  assert.deepStrictEqual(parsed.state, db.state);
  assert.deepStrictEqual(Object.keys(parsed).sort(), ['app', 'exportedAt', 'state']);
});

test('H3 export then import into a fresh store on a different adapter gives a deep-equal state', async () => {
  const { db } = await busySession();
  const text = db.exportData({ now: 1 });
  const base2 = Store.memoryAdapter();
  const db2 = await Store.open(base2);
  await db2.importData(text);
  assert.deepStrictEqual(db2.state, db.state);
  assert.deepStrictEqual((await Store.open(base2)).state, db.state, 'import was persisted');
});

test('H3 an export taken mid-workout round-trips the in-progress workout', async () => {
  const { db, id2 } = await busySession();
  const db2 = await Store.open(Store.memoryAdapter());
  await db2.importData(db.exportData({ now: 2 }));
  const w = db2.activeWorkout();
  assert.ok(w);
  assert.strictEqual(w.id, id2);
  assert.strictEqual(w.endedAt, null);
  assert.deepStrictEqual(w.sets, db.activeWorkout().sets);
  await db2.logSet({ exerciseId: 'a', weightKg: 12.75, reps: 4, effort: null, now: 320 });
  assert.strictEqual(db2.activeWorkout().sets.length, 2, 'can resume logging after import');
});

test('H3 weights round-trip exactly', async () => {
  const { db } = await busySession();
  const db2 = await Store.open(Store.memoryAdapter());
  await db2.importData(db.exportData({ now: 3 }));
  const weights = db2.state.workouts.flatMap(w => w.sets.map(s => s.weightKg));
  assert.deepStrictEqual(weights, [2.5, 7.25, 0, 12.75]);
  assert.strictEqual(db2.state.workouts[0].sets[1].extra, true);
});

test('H3 import REPLACES the whole state', async () => {
  const { db } = await busySession();
  const text = db.exportData({ now: 4 });
  const target = await fresh();
  await target.db.setProfile({ name: 'Old', goals: ['legs'] });
  await target.db.excludeEquipment('cable');
  const oid = await target.db.startWorkout({ plan: ['z'], now: 5 });
  await target.db.logSet({ ...SET1, now: 6 });
  await target.db.importData(text);
  assert.deepStrictEqual(target.db.state, db.state);
  assert.ok(!target.db.state.workouts.some(w => w.id === oid));
});

test('H3 importing an older or partial state migrates it', async () => {
  const db = (await fresh()).db;
  await db.importData(JSON.stringify({ app: 'ironwave-beginner', exportedAt: 1, state: { name: 'Old', workouts: [GOOD_WORKOUT] } }));
  assert.deepStrictEqual(db.state, Store.migrate({ name: 'Old', workouts: [GOOD_WORKOUT] }));
  assertValidState(db.state);
});

test('H3 bad imports reject E_BAD_IMPORT and change nothing', async () => {
  const { db, ad, base } = await busySession();
  const before = clone(db.state);
  const stored = clone(await base.get(KEY));
  const n = ad.sets.length;
  const bads = [
    'not json', '', '{', '[]', 'null', '42', '"str"', undefined, null, 5, {},
    JSON.stringify({}),
    JSON.stringify({ state: { version: VER } }),
    JSON.stringify({ app: 'someone-else', state: { version: VER } }),
    JSON.stringify({ app: 'ironwave', state: { version: VER } }),
    JSON.stringify({ app: 'ironwave-beginner', exportedAt: 1, state: { version: VER + 1, name: 'future' } }),
  ];
  for (const bad of bads) {
    await rejectsWith(db.importData(bad), 'E_BAD_IMPORT');
    assert.deepStrictEqual(db.state, before);
  }
  assert.strictEqual(ad.sets.length, n, 'adapter never written');
  assert.deepStrictEqual(await base.get(KEY), stored, 'adapter content untouched');
});

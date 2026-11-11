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

   ROUND 2 RULES (review findings; every one is tested below):
     - OPEN WORKOUTS: only `endedAt === null` or a MISSING endedAt means open. Any other
       non-finite endedAt (string, NaN) means CLOSED with endedAt = max(startedAt, last
       set.at). A finite endedAt earlier than startedAt is clamped up to startedAt, in
       migrate AND in endWorkout. migrate keeps exactly ONE open workout, the
       LATEST-STARTED one. Every other open workout that has sets is CLOSED (never
       dropped) with endedAt = max(startedAt, last set.at) and feel null; only EMPTY
       extra open workouts are dropped. All logged sets survive. Still idempotent.
     - Duplicate workout ids in migrate are made unique (later duplicates get a
       suffix, the id still starts with the original); idempotent.
     - A weightKg of -0 is stored as 0 by migrate and by logSet.
     - IMMUTABLE STATE: db.state and db.activeWorkout() are deep-frozen. Mutating them
       throws or has no effect, never reaches the adapter, and a reopen deep-equals
       db.state afterwards.
     - ERROR CODES: setEffort/updatePlan/endWorkout with no active workout reject
       E_NO_WORKOUT; setFeel with an unknown id rejects E_NO_WORKOUT; setEffort with an
       out-of-range or non-integer index or an invalid effort rejects E_BAD_SET and
       writes nothing; effort null succeeds.
     - QUEUE: un-awaited calls run in order; one failing write rejects only its own
       call, and later calls apply on the rolled-back state. There is NO optimistic
       state: db.state shows the state BEFORE a change until its promise resolves.
     - exportData({ now }) needs a finite now, else throws Error code E_BAD_EXPORT.
     - importData resolves { workouts, sets, droppedWorkouts, droppedSets } counting
       what was kept and what migration dropped from the file.
     - MEMO: state gains memo: {}. BEGINNER_CONFIG.store.memoKeys is an array (the
       whitelist). db.setMemo(key, value) persists a JSON scalar (string, finite
       number, boolean, null) under a whitelisted key; otherwise rejects E_BAD_MEMO.
       migrate keeps only whitelisted keys with scalar values.
     - LAZY IDB: loading store.js and calling Store.idbAdapter() never calls
       indexedDB.open; the first get or set does.
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
  const a = { sets: [], gate: null, failNext: 0, failAtCall: -1, delays: [] };
  a.get = k => base.get(k);
  a.set = async (k, v) => {
    a.sets.push(k);
    if (a.failAtCall === a.sets.length) throw new Error('disk full at call');
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
  for (const f of fs.readdirSync(B)) {
    if (f.endsWith('.js') || f === 'index.html') fs.copyFileSync(path.join(B, f), path.join(dir, f));
  }
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
  assert.deepStrictEqual(s, { version: VER, name: '', goals: [], onboarded: false, excludedEquipment: [], units: null, memo: {}, workouts: [] });
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
  currentFull: { version: VER, name: 'Bo', goals: ['fit'], onboarded: true, excludedEquipment: ['barbell'], units: 'lb', memo: {}, workouts: [GOOD_WORKOUT, OPEN_WORKOUT] },
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
  assert.ok(s.memo && typeof s.memo === 'object' && !Array.isArray(s.memo));
  assert.ok(Object.values(s.memo).every(v => v === null || ['string', 'boolean'].includes(typeof v) || (typeof v === 'number' && Number.isFinite(v))));
  assert.ok(Array.isArray(s.workouts));
  assert.strictEqual(new Set(s.workouts.map(w => w.id)).size, s.workouts.length, 'unique workout ids');
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
  const snap = clone(out);
  raw.workouts[0].sets[0].reps = 99;
  raw.goals.push('chest');
  assert.deepStrictEqual(out, snap, 'later changes to the input do not reach the output');
  assert.strictEqual(out.workouts[0].sets[0].reps, 8);
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
let lastId = null;
const WRITERS = {
  startWorkout: { prep: async () => {}, run: db => db.startWorkout({ plan: ['a'], now: 1 }) },
  logSet: { prep: db => db.startWorkout({ plan: ['a'], now: 1 }), run: db => db.logSet(SET1) },
  setEffort: { prep: async db => { await db.startWorkout({ plan: ['a'], now: 1 }); await db.logSet(SET1); }, run: db => db.setEffort({ index: 0, effort: 'hard' }) },
  updatePlan: { prep: db => db.startWorkout({ plan: ['a'], now: 1 }), run: db => db.updatePlan(['a', 'b']) },
  endWorkout: { prep: async db => { await db.startWorkout({ plan: ['a'], now: 1 }); await db.logSet(SET1); }, run: db => db.endWorkout({ now: 9, feel: 'right' }) },
  setFeel: { prep: async db => { const id = await db.startWorkout({ plan: ['a'], now: 1 }); await db.logSet(SET1); await db.endWorkout({ now: 9, feel: null }); lastId = id; }, run: db => db.setFeel(lastId, 'easy') },
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

// ================= ROUND 2 =================
const mkSet = (at, extra) => ({ exerciseId: 'a', weightKg: 5, reps: 5, effort: null, at, ...(extra || {}) });
const byId = (s, id) => s.workouts.find(w => w.id === id);

// ---------- 1 and 2: open workouts ----------
const MULTI_OPEN = {
  workouts: [
    { id: 'b', startedAt: 200, endedAt: null, feel: 'easy', plan: ['a'], sets: [mkSet(250), mkSet(260)] },
    { id: 'a', startedAt: 100, endedAt: null, feel: null, plan: ['a'], sets: [mkSet(150), mkSet(170)] },
    { id: 'd', startedAt: 150, endedAt: null, feel: null, plan: ['a'], sets: [] },
    { id: 'c', startedAt: 300, endedAt: null, feel: null, plan: ['a'], sets: [mkSet(310)] },
    { id: 'e', startedAt: 120, plan: ['a'], sets: [mkSet(50)] },
  ],
};

test('H2 migrate keeps the latest-started open workout, closes other open ones with sets, drops empty ones', () => {
  const out = Store.migrate(MULTI_OPEN);
  assertValidState(out);
  assert.deepStrictEqual(out.workouts.map(w => w.id), ['b', 'a', 'c', 'e'], 'empty extra open workout d dropped, order kept');
  assert.strictEqual(byId(out, 'c').endedAt, null, 'latest-started stays open');
  assert.deepStrictEqual(byId(out, 'b').endedAt, 260);
  assert.strictEqual(byId(out, 'b').feel, null);
  assert.strictEqual(byId(out, 'a').endedAt, 170);
  assert.strictEqual(byId(out, 'e').endedAt, 120, 'set.at before startedAt: endedAt is startedAt');
  assert.strictEqual(out.workouts.reduce((n, w) => n + w.sets.length, 0), 6, 'every logged set survives');
  assert.deepStrictEqual(Store.migrate(out), out);
  assert.deepStrictEqual(Store.migrate(MULTI_OPEN), out);
});

test('H2 migrate keeps an empty workout open when it is the latest-started one', () => {
  const out = Store.migrate({ workouts: [
    { id: 'old', startedAt: 10, endedAt: null, plan: [], sets: [mkSet(20)] },
    { id: 'new', startedAt: 90, endedAt: null, plan: ['a'], sets: [] },
  ] });
  assert.strictEqual(byId(out, 'new').endedAt, null);
  assert.strictEqual(byId(out, 'old').endedAt, 20);
  assert.deepStrictEqual(Store.migrate(out), out);
});

test('H2 a corrupted endedAt means closed, and the genuine open workout stays the active one', async () => {
  const raw = { workouts: [
    { id: 'x', startedAt: 100, endedAt: 'oops', plan: ['a'], sets: [mkSet(150), mkSet(180)] },
    { id: 'n', startedAt: 110, endedAt: NaN, plan: ['a'], sets: [mkSet(120)] },
    { id: 'real', startedAt: 500, endedAt: null, plan: ['a'], sets: [mkSet(520)] },
  ] };
  const out = Store.migrate(raw);
  assert.strictEqual(byId(out, 'x').endedAt, 180);
  assert.strictEqual(byId(out, 'n').endedAt, 120);
  assert.strictEqual(byId(out, 'real').endedAt, null);
  assert.deepStrictEqual(Store.migrate(out), out);
  const db = await Store.open(Store.memoryAdapter({ [KEY]: raw }));
  assert.strictEqual(db.activeWorkout().id, 'real');
  assert.strictEqual(db.state.workouts.length, 3);
});

test('H2 an endedAt earlier than startedAt is clamped to startedAt', () => {
  const out = Store.migrate({ workouts: [{ id: 'q', startedAt: 100, endedAt: 50, plan: [], sets: [mkSet(110)] }] });
  assert.strictEqual(out.workouts[0].endedAt, 100);
  assert.deepStrictEqual(Store.migrate(out), out);
});

test('C6 endWorkout never stamps an endedAt earlier than startedAt', async () => {
  const { db, base } = await fresh();
  const id = await db.startWorkout({ plan: ['a'], now: 1000 });
  await db.logSet({ ...SET1, now: 1100 });
  await db.endWorkout({ now: 900, feel: null });
  assert.strictEqual(byId(db.state, id).endedAt, 1000);
  assert.strictEqual(byId((await reopen(base)).state, id).endedAt, 1000);
});

// ---------- 3: immutable state ----------
function assertDeepFrozen(o, where = 'state') {
  if (o && typeof o === 'object') {
    assert.ok(Object.isFrozen(o), where + ' is frozen');
    for (const [k, v] of Object.entries(o)) assertDeepFrozen(v, where + '.' + k);
  }
}
const attempt = fn => { try { fn(); } catch (e) { assert.ok(e instanceof TypeError, 'mutation throws TypeError or is ignored'); } };

test('C6 db.state and db.activeWorkout() are deep-frozen, after open and after every kind of write', async () => {
  const { db, base } = await fresh();
  assertDeepFrozen(db.state);
  await db.startWorkout({ plan: ['a', 'b'], now: 1 });
  await db.logSet(SET1);
  assertDeepFrozen(db.state);
  assertDeepFrozen(db.activeWorkout());
  await db.setProfile({ name: 'F', goals: ['fit'] });
  await db.excludeEquipment('bench');
  assertDeepFrozen(db.state);
  await db.importData(db.exportData({ now: 1 }));
  assertDeepFrozen(db.state);
  assertDeepFrozen((await reopen(base)).state);
});

test('C6 mutating db.state or the active workout never reaches the adapter or a reopen', async () => {
  const { db, base } = await fresh();
  await db.startWorkout({ plan: ['a'], now: 1 });
  await db.logSet(SET1);
  await db.endWorkout({ now: 5, feel: null });
  await db.startWorkout({ plan: ['a'], now: 10 });
  await db.logSet({ ...SET1, now: 11 });
  const before = clone(db.state);
  const w = db.activeWorkout();
  attempt(() => { db.state.name = 'HACK'; });
  attempt(() => { db.state.goals.push('arms'); });
  attempt(() => { w.sets.push({ exerciseId: 'evil', weightKg: 1, reps: 1, effort: null, at: 1 }); });
  attempt(() => { w.sets[0].reps = 99; });
  attempt(() => { w.plan.length = 0; });
  attempt(() => { db.state.workouts.sort((a, b) => b.startedAt - a.startedAt); });
  attempt(() => { db.state.workouts.reverse(); });
  attempt(() => { db.state.workouts.pop(); });
  assert.deepStrictEqual(db.state, before, 'state unchanged by mutation attempts');
  await db.setProfile({ name: 'Real' }); // unrelated write must not carry the mutations
  const re = await reopen(base);
  assert.deepStrictEqual(re.state, db.state);
  assert.strictEqual(re.state.name, 'Real');
  assert.deepStrictEqual(re.state.workouts.map(x => x.startedAt), [1, 10]);
  assert.strictEqual(re.activeWorkout().sets.length, 1);
  assert.strictEqual(re.activeWorkout().sets[0].reps, 10);
  assert.deepStrictEqual(re.activeWorkout().plan, ['a']);
});

// ---------- 4: error codes ----------
test('C6 setEffort, updatePlan and endWorkout with no active workout reject E_NO_WORKOUT and write nothing', async () => {
  const { db, ad } = await fresh();
  await rejectsWith(db.setEffort({ index: 0, effort: 'good' }), 'E_NO_WORKOUT');
  await rejectsWith(db.updatePlan(['a']), 'E_NO_WORKOUT');
  await rejectsWith(db.endWorkout({ now: 5, feel: null }), 'E_NO_WORKOUT');
  assert.strictEqual(ad.sets.length, 0);
});

test('C6 setFeel with an unknown workout id rejects E_NO_WORKOUT and writes nothing', async () => {
  const { db, ad } = await fresh();
  await db.startWorkout({ plan: ['a'], now: 1 });
  await db.logSet(SET1);
  const n = ad.sets.length;
  await rejectsWith(db.setFeel('no-such-id', 'easy'), 'E_NO_WORKOUT');
  assert.strictEqual(ad.sets.length, n);
});

test('C6 setEffort rejects a bad index or effort with E_BAD_SET and writes nothing; null succeeds', async () => {
  const { db, ad } = await fresh();
  await db.startWorkout({ plan: ['a'], now: 1 });
  await db.logSet(SET1);
  await db.logSet({ ...SET1, now: 2 });
  await db.setEffort({ index: 0, effort: 'hard' });
  const n = ad.sets.length;
  for (const bad of [{ index: -1, effort: 'good' }, { index: 2, effort: 'good' }, { index: 99, effort: 'good' }, { index: 0.5, effort: 'good' },
    { index: NaN, effort: 'good' }, { index: undefined, effort: 'good' }, { index: 0, effort: 'wild' }, { index: 0, effort: undefined }]) {
    await rejectsWith(db.setEffort(bad), 'E_BAD_SET');
  }
  assert.strictEqual(ad.sets.length, n);
  assert.strictEqual(db.activeWorkout().sets[0].effort, 'hard');
  await db.setEffort({ index: 0, effort: null });
  assert.strictEqual(db.activeWorkout().sets[0].effort, null);
});

// ---------- 5: queue semantics ----------
test('C6 five un-awaited logSet calls with the third write failing: ok, ok, rejected, ok, ok', async () => {
  const { db, ad, base } = await fresh();
  await db.startWorkout({ plan: ['a'], now: 1 });
  ad.failAtCall = ad.sets.length + 3;
  const ps = [];
  for (let i = 1; i <= 5; i++) ps.push(db.logSet({ exerciseId: 'a', weightKg: i, reps: i, effort: null, now: 100 + i }));
  const res = await Promise.allSettled(ps);
  assert.deepStrictEqual(res.map(r => r.status), ['fulfilled', 'fulfilled', 'rejected', 'fulfilled', 'fulfilled']);
  assert.deepStrictEqual(db.activeWorkout().sets.map(s => s.reps), [1, 2, 4, 5]);
  const re = await reopen(base);
  assert.deepStrictEqual(re.activeWorkout().sets.map(s => s.reps), [1, 2, 4, 5]);
  assert.deepStrictEqual(re.state, db.state);
});

test('C6 there is no optimistic state: db.state shows the state before a change until it resolves', async () => {
  const { db, ad } = await fresh();
  await db.startWorkout({ plan: ['a'], now: 1 });
  const gate = ad.arm();
  const p = db.logSet(SET1);
  assert.strictEqual(db.activeWorkout().sets.length, 0, 'immediately after the call');
  await tick();
  assert.strictEqual(db.state.workouts[0].sets.length, 0, 'while the write is pending');
  assert.strictEqual(db.activeWorkout().sets.length, 0);
  gate.release();
  await p;
  assert.strictEqual(db.activeWorkout().sets.length, 1, 'after it resolves');
});

// ---------- 6 and 7: ids and negative zero ----------
test('H2 duplicate workout ids in migrate are made unique, keep the first, and stay idempotent', () => {
  const mk = (t) => ({ id: 'dup', startedAt: t, endedAt: t + 5, feel: null, plan: ['a'], sets: [mkSet(t + 1)] });
  const out = Store.migrate({ workouts: [mk(10), mk(20), mk(30)] });
  assert.strictEqual(out.workouts.length, 3, 'no workout lost');
  assert.strictEqual(out.workouts[0].id, 'dup');
  assert.strictEqual(new Set(out.workouts.map(w => w.id)).size, 3);
  assert.ok(out.workouts.every(w => w.id.startsWith('dup')));
  assert.deepStrictEqual(out.workouts.map(w => w.startedAt), [10, 20, 30]);
  assert.deepStrictEqual(Store.migrate(out), out);
  assert.deepStrictEqual(Store.migrate({ workouts: [mk(10), mk(20), mk(30)] }), out, 'deterministic');
});

test('H2 negative zero weight is stored as 0 by migrate and by logSet', async () => {
  const out = Store.migrate({ workouts: [{ id: 'z', startedAt: 1, endedAt: 2, plan: [], sets: [{ exerciseId: 'a', weightKg: -0, reps: 3, effort: null, at: 1 }] }] });
  assert.ok(Object.is(out.workouts[0].sets[0].weightKg, 0));
  const { db, base } = await fresh();
  await db.startWorkout({ plan: ['a'], now: 1 });
  await db.logSet({ ...SET1, weightKg: -0 });
  assert.ok(Object.is(db.activeWorkout().sets[0].weightKg, 0));
  assert.ok(Object.is((await reopen(base)).activeWorkout().sets[0].weightKg, 0));
});

// ---------- 8 and 9: export / import ----------
test('H3 exportData requires a finite now and throws E_BAD_EXPORT otherwise', async () => {
  const { db } = await fresh();
  for (const arg of [undefined, {}, { now: undefined }, { now: NaN }, { now: Infinity }, { now: '5' }, { now: null }]) {
    assert.throws(() => db.exportData(arg), e => e instanceof Error && e.code === 'E_BAD_EXPORT', String(JSON.stringify(arg)));
  }
  assert.doesNotThrow(() => db.exportData({ now: 0 }));
});

test('H3 importData resolves a summary of what was kept and what migration dropped', async () => {
  const { db } = await busySession();
  const clean = await (await fresh()).db.importData(db.exportData({ now: 1 }));
  assert.deepStrictEqual(clean, { workouts: 2, sets: 4, droppedWorkouts: 0, droppedSets: 0 });
  const target = (await fresh()).db;
  const file = JSON.stringify({ app: 'ironwave-beginner', exportedAt: 1, state: { version: VER, workouts: [
    GOOD_WORKOUT, null, { id: 'nots' },
    { id: 'mixed', startedAt: 1, endedAt: 9, plan: [], sets: [mkSet(2), { exerciseId: 'a', weightKg: -1, reps: 1, at: 3 }, mkSet(4)] },
  ] } });
  const sum = await target.importData(file);
  assert.deepStrictEqual(sum, { workouts: 2, sets: 4, droppedWorkouts: 2, droppedSets: 1 });
  assert.strictEqual(target.state.workouts.length, 2);
});

// ---------- 10: memo ----------
test('H2 config: memoKeys is an array and the default state has an empty memo', () => {
  assert.ok(Array.isArray(BEGINNER_CONFIG.store.memoKeys));
  assert.deepStrictEqual(Store.defaultState().memo, {});
  assert.deepStrictEqual(Store.migrate({ memo: { 'zz-never-listed': 1 } }).memo, {});
});

test('H2 memo: setMemo persists whitelisted JSON scalars and rejects everything else with E_BAD_MEMO', async () => {
  const dir = customDir(s => { s.memoKeys = ['tip', 'lastKg', 'flag', 'nothing']; });
  try {
    const L = loadBeginner({ beginnerDir: dir });
    const base = L.Store.memoryAdapter();
    const ad = instrument(base);
    const db = await L.Store.open(ad);
    await db.setMemo('tip', 'hello');
    await db.setMemo('lastKg', 7.25);
    await db.setMemo('flag', false);
    await db.setMemo('nothing', null);
    assert.deepStrictEqual(db.state.memo, { tip: 'hello', lastKg: 7.25, flag: false, nothing: null });
    assert.deepStrictEqual((await L.Store.open(base)).state.memo, db.state.memo);
    await db.setMemo('tip', 'again');
    assert.strictEqual(db.state.memo.tip, 'again');
    const n = ad.sets.length;
    for (const [k, v] of [['unlisted', 1], ['tip', {}], ['tip', []], ['tip', NaN], ['tip', Infinity], ['tip', undefined], ['tip', () => 1], ['__proto__', 1]]) {
      await rejectsWith(db.setMemo(k, v), 'E_BAD_MEMO');
    }
    assert.strictEqual(ad.sets.length, n, 'nothing written');
    assert.strictEqual(db.state.memo.tip, 'again');
    const m = L.Store.migrate({ memo: { tip: 'x', lastKg: 2, flag: true, nothing: null, unlisted: 1, nested: { a: 1 } } });
    assert.deepStrictEqual(m.memo, { tip: 'x', lastKg: 2, flag: true, nothing: null });
    assert.deepStrictEqual(L.Store.migrate({ memo: { tip: { a: 1 }, lastKg: [1], flag: NaN } }).memo, {});
    assert.deepStrictEqual(L.Store.migrate({ memo: [1, 2] }).memo, {});
    assert.deepStrictEqual(L.Store.migrate(m), m);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H3 memo round-trips through export and import', async () => {
  const dir = customDir(s => { s.memoKeys = ['tip']; });
  try {
    const L = loadBeginner({ beginnerDir: dir });
    const a = await L.Store.open(L.Store.memoryAdapter());
    await a.setMemo('tip', 'kept');
    const b = await L.Store.open(L.Store.memoryAdapter());
    await b.importData(a.exportData({ now: 1 }));
    assert.deepStrictEqual(b.state.memo, { tip: 'kept' });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---------- 11: lazy IndexedDB ----------
test('H1 idbAdapter is lazy: zero indexedDB.open calls until the first get or set', async () => {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const opens = [];
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true, writable: true,
    value: { open(name, ver) { opens.push([name, ver]); return {}; } },
  });
  try {
    const L = loadBeginner();
    assert.strictEqual(opens.length, 0, 'loading the app opens nothing');
    const a = L.Store.idbAdapter();
    assert.strictEqual(opens.length, 0, 'creating the adapter opens nothing');
    a.get('k').catch(() => {});
    await tick();
    assert.ok(opens.length >= 1, 'first get opens the database');
    opens.length = 0;
    const b = L.Store.idbAdapter();
    assert.strictEqual(opens.length, 0);
    b.set('k', { v: 1 }).catch(() => {});
    await tick();
    assert.ok(opens.length >= 1, 'first set opens the database');
  } finally {
    if (had) Object.defineProperty(globalThis, 'indexedDB', had); else delete globalThis.indexedDB;
  }
});

// ================= FOLLOW-UPS (package 3b) =================
// RULES: (1) idbAdapter timeout: on the write timer, try tx.abort(); if abort THROWS
//   (commit already under way) do not reject on the timer, wait for complete (resolve)
//   or abort/error (reject); reject on the timer (code E_STORAGE) only when abort
//   succeeded. (2) duplicate-id renaming in migrate is linear. (3) -0 is stored as 0
//   in startedAt, endedAt, set.at and numeric memo values. (4) valid goal keys are
//   Object.keys(BEGINNER_GOALS) at call time, in migrate and setProfile.
// The adapter reads setTimeout from the global at call time, so these tests swap
// globalThis.setTimeout for the exact configured writeTimeoutMs; no seam is needed.
const { createFakeIdb } = require('./fake-idb');

function fakeTimers() {
  const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
  const list = [];
  globalThis.setTimeout = (fn, ms, ...a) => {
    if (ms !== BEGINNER_CONFIG.store.writeTimeoutMs) return realSet(fn, ms, ...a);
    const t = { live: true, fn };
    list.push(t);
    return t;
  };
  globalThis.clearTimeout = h => { if (h && typeof h === 'object' && 'live' in h) h.live = false; else realClear(h); };
  return {
    live: () => list.filter(t => t.live).length,
    fire() { for (const t of list.filter(x => x.live)) { t.live = false; t.fn(); } },
    restore() { globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear; },
  };
}

async function withIdb(fn) {
  const fake = createFakeIdb();
  fake.install();
  const timers = fakeTimers();
  try { await fn(fake, timers); } finally { timers.restore(); fake.restore(); }
}
const track = p => { const s = { done: false, ok: undefined, err: undefined }; p.then(v => { s.done = true; s.ok = v; }, e => { s.done = true; s.err = e; }); return s; };
const idbStored = (fake, k) => fake.data.get(BEGINNER_CONFIG.store.dbName).get(BEGINNER_CONFIG.store.storeName).get(k);

test('C6 idb get returns undefined for a missing key and the stored value otherwise', async () => {
  await withIdb(async fake => {
    const a = Store.idbAdapter();
    assert.strictEqual(await a.get('nope'), undefined);
    await a.set('k', { v: [1, 2, { w: 7.25 }] });
    assert.deepStrictEqual(await a.get('k'), { v: [1, 2, { w: 7.25 }] });
    assert.deepStrictEqual(await Store.idbAdapter().get('k'), { v: [1, 2, { w: 7.25 }] }, 'a second adapter sees it');
    assert.strictEqual(fake.opens, 2, 'one open per adapter instance');
  });
});

test('C6 idb set resolves on transaction complete, not on request success', async () => {
  await withIdb(async fake => {
    const a = Store.idbAdapter();
    await a.get('warm');
    fake.controls.mode = 'holdCommitting';
    const before = fake.stats.requestSuccess;
    const s = track(a.set('k', { v: 1 }));
    await tick();
    assert.ok(fake.stats.requestSuccess > before, 'the put request already succeeded');
    assert.strictEqual(fake.held.length, 1);
    assert.strictEqual(s.done, false, 'still pending before the transaction completes');
    assert.strictEqual(idbStored(fake, 'k'), undefined, 'not on disk yet');
    fake.held[0].complete();
    await tick();
    assert.strictEqual(s.done, true);
    assert.strictEqual(s.err, undefined);
    assert.deepStrictEqual(idbStored(fake, 'k'), { v: 1 });
    assert.strictEqual(fake.controls.mode, 'holdCommitting');
  });
});

test('C6 idb open failure rejects E_NO_STORAGE, and a later call can succeed', async () => {
  await withIdb(async fake => {
    const a = Store.idbAdapter();
    fake.controls.failOpen = true;
    await rejectsWith(a.get('k'), 'E_NO_STORAGE');
    await rejectsWith(a.set('k', 1), 'E_NO_STORAGE');
    fake.controls.failOpen = false;
    await a.set('k', 5);
    assert.strictEqual(await a.get('k'), 5);
    const b = Store.idbAdapter();
    fake.controls.blockOpen = true;
    await rejectsWith(b.get('k'), 'E_NO_STORAGE');
  });
});

test('C6 idb rejects when indexedDB does not exist at all with E_NO_STORAGE', async () => {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  delete globalThis.indexedDB;
  try { await rejectsWith(Store.idbAdapter().get('k'), 'E_NO_STORAGE'); }
  finally { if (had) Object.defineProperty(globalThis, 'indexedDB', had); }
});

test('C6 idb transaction abort rejects and writes nothing; the next call works', async () => {
  await withIdb(async fake => {
    const a = Store.idbAdapter();
    await a.get('warm');
    fake.controls.autoAbort = true;
    await assert.rejects(a.set('k', { v: 1 }));
    assert.strictEqual(idbStored(fake, 'k'), undefined);
    fake.controls.autoAbort = false;
    await a.set('k', { v: 2 });
    assert.deepStrictEqual(await a.get('k'), { v: 2 });
  });
});

test('C6 idb after onclose the next call reopens the database', async () => {
  await withIdb(async fake => {
    const a = Store.idbAdapter();
    await a.set('k', { v: 1 });
    assert.strictEqual(fake.opens, 1);
    fake.closeConnections();
    assert.deepStrictEqual(await a.get('k'), { v: 1 });
    assert.strictEqual(fake.opens, 2, 'reopened');
    await a.set('k', { v: 2 });
    assert.deepStrictEqual(await a.get('k'), { v: 2 });
  });
});

test('C6 idb full round trip: Store.open on idbAdapter, log a set, reopen sees it', async () => {
  await withIdb(async fake => {
    const db = await Store.open(Store.idbAdapter());
    const id = await db.startWorkout({ plan: ['a', 'b'], now: 1 });
    await db.logSet(SET1);
    await db.setEffort({ index: 0, effort: 'good' });
    const re = await Store.open(Store.idbAdapter());
    assert.strictEqual(re.activeWorkout().id, id);
    assert.deepStrictEqual(re.activeWorkout().plan, ['a', 'b']);
    assert.deepStrictEqual(re.activeWorkout().sets.map(s => [s.weightKg, s.reps, s.effort]), [[12.5, 10, 'good']]);
    assert.deepStrictEqual(re.state, db.state);
  });
});

test('C6 idb a write timer is cleared when the write completes', async () => {
  await withIdb(async (fake, timers) => {
    const a = Store.idbAdapter();
    await a.set('k', 1);
    await a.get('k');
    assert.strictEqual(timers.live(), 0);
  });
});

test('C6 idb timeout while the transaction can still be aborted rejects E_STORAGE and writes nothing', async () => {
  await withIdb(async (fake, timers) => {
    const a = Store.idbAdapter();
    await a.get('warm');
    fake.controls.mode = 'holdActive';
    const s = track(a.set('k', { v: 1 }));
    await tick();
    assert.strictEqual(s.done, false);
    assert.strictEqual(timers.live(), 1, 'a timeout is armed');
    timers.fire();
    await tick();
    assert.strictEqual(s.done, true);
    assert.strictEqual(s.err && s.err.code, 'E_STORAGE');
    assert.strictEqual(idbStored(fake, 'k'), undefined);
  });
});

test('C6 idb timeout during commit (abort throws) does not reject; it resolves when the commit completes', async () => {
  await withIdb(async (fake, timers) => {
    const a = Store.idbAdapter();
    await a.get('warm');
    fake.controls.mode = 'holdCommitting';
    const s = track(a.set('k', { v: 1 }));
    await tick();
    timers.fire();
    await tick();
    assert.strictEqual(s.done, false, 'must not reject on the timer while the commit is under way');
    fake.held[0].complete();
    await tick();
    assert.strictEqual(s.done, true);
    assert.strictEqual(s.err, undefined, 'resolved, because the data landed');
    assert.deepStrictEqual(idbStored(fake, 'k'), { v: 1 });
  });
});

test('C6 idb timeout during commit then a failed commit rejects and nothing is on disk', async () => {
  await withIdb(async (fake, timers) => {
    const a = Store.idbAdapter();
    await a.get('warm');
    fake.controls.mode = 'holdCommitting';
    const s = track(a.set('k', { v: 1 }));
    await tick();
    timers.fire();
    await tick();
    assert.strictEqual(s.done, false);
    fake.held[0].fail(new Error('quota'));
    await tick();
    assert.strictEqual(s.done, true);
    assert.ok(s.err, 'rejected');
    assert.strictEqual(idbStored(fake, 'k'), undefined);
  });
});

test('C6 idb timeout during commit: memory and disk agree and a retry does not duplicate the set', async () => {
  await withIdb(async (fake, timers) => {
    const db = await Store.open(Store.idbAdapter());
    await db.startWorkout({ plan: ['a'], now: 1 });
    fake.controls.mode = 'holdCommitting';
    const p = track(db.logSet(SET1));
    await tick();
    timers.fire();
    await tick();
    fake.held[0].complete();
    await tick();
    fake.controls.mode = 'normal';
    assert.strictEqual(p.done, true);
    assert.strictEqual(p.err, undefined, 'logSet resolved because the set is on disk');
    assert.strictEqual(db.activeWorkout().sets.length, 1, 'memory has the set');
    const re = await Store.open(Store.idbAdapter());
    assert.strictEqual(re.activeWorkout().sets.length, 1, 'disk has exactly one set');
    assert.deepStrictEqual(re.state, db.state);
  });
});

// ---------- 2: linear duplicate-id renaming ----------
test('H2 migrating 20000 workouts that share one id is fast, unique and idempotent', () => {
  const N = 20000;
  const workouts = [];
  for (let i = 0; i < N; i++) workouts.push({ id: 'same', startedAt: i + 1, endedAt: i + 2, feel: null, plan: ['a'], sets: [mkSet(i + 1)] });
  const t0 = process.hrtime.bigint();
  const out = Store.migrate({ workouts });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 2000, 'took ' + Math.round(ms) + ' ms');
  assert.strictEqual(out.workouts.length, N);
  assert.strictEqual(new Set(out.workouts.map(w => w.id)).size, N);
  assert.strictEqual(out.workouts[0].id, 'same');
  assert.ok(out.workouts.every(w => w.id.startsWith('same')));
  const t1 = process.hrtime.bigint();
  const again = Store.migrate(out);
  assert.ok(Number(process.hrtime.bigint() - t1) / 1e6 < 2000);
  assert.deepStrictEqual(again, out);
});

// ---------- 3: negative zero everywhere ----------
test('H2 negative zero in startedAt, endedAt, set.at and memo values is stored as 0 and migrate survives a JSON round trip', () => {
  const dir = customDir(s => { s.memoKeys = ['m']; });
  try {
    const L = loadBeginner({ beginnerDir: dir });
    const raw = {
      memo: { m: -0 },
      workouts: [{ id: 'z', startedAt: -0, endedAt: -0, feel: null, plan: [], sets: [{ exerciseId: 'a', weightKg: -0, reps: 1, effort: null, at: -0 }] }],
    };
    const out = L.Store.migrate(raw);
    const w = out.workouts[0];
    assert.ok(Object.is(w.startedAt, 0), 'startedAt');
    assert.ok(Object.is(w.endedAt, 0), 'endedAt');
    assert.ok(Object.is(w.sets[0].at, 0), 'set.at');
    assert.ok(Object.is(w.sets[0].weightKg, 0), 'weightKg');
    assert.ok(Object.is(out.memo.m, 0), 'memo');
    assert.deepStrictEqual(L.Store.migrate(JSON.parse(JSON.stringify(out))), out);
    assert.deepStrictEqual(L.Store.migrate(JSON.parse(JSON.stringify(L.Store.migrate(raw)))), out, 'migrate stays idempotent across JSON');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('H2 a closed workout whose set.at is negative zero closes at a clean 0', () => {
  const out = Store.migrate({ workouts: [{ id: 'q', startedAt: -0, endedAt: 'oops', plan: [], sets: [{ exerciseId: 'a', weightKg: 1, reps: 1, at: -0 }] }] });
  assert.ok(Object.is(out.workouts[0].endedAt, 0));
  assert.deepStrictEqual(Store.migrate(JSON.parse(JSON.stringify(out))), out);
});

// ---------- 4: goal keys come from BEGINNER_GOALS ----------
test('H2 the valid goal keys are exactly Object.keys(BEGINNER_GOALS)', async () => {
  const { BEGINNER_GOALS } = loadBeginner();
  const keys = Object.keys(BEGINNER_GOALS);
  assert.deepStrictEqual(Store.migrate({ goals: [...keys, 'bogus'] }).goals, keys);
  const { db } = await fresh();
  await db.setProfile({ goals: [...keys, 'bogus'] });
  assert.deepStrictEqual(db.state.goals, keys);
});

test('H2 an extra goal added to exercises.js survives migrate and setProfile; unknown keys are still dropped', async () => {
  const dir = customDir(() => {});
  try {
    const f = path.join(dir, 'exercises.js');
    const src = fs.readFileSync(f, 'utf8');
    const marker = 'const BEGINNER_GOALS = Object.freeze({\n';
    assert.ok(src.includes(marker), 'exercises.js still declares BEGINNER_GOALS in the expected form');
    fs.writeFileSync(f, src.replace(marker, marker + "  mobility: Object.freeze({ label: 'Move better', focus: Object.freeze({ arms: 2, chest: 2, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 2 }) }),\n"));
    const L = loadBeginner({ beginnerDir: dir });
    assert.ok('mobility' in L.BEGINNER_GOALS);
    assert.deepStrictEqual(L.Store.migrate({ goals: ['mobility', 'arms', 'bogus', 'mobility'] }).goals, ['mobility', 'arms']);
    const db = await L.Store.open(L.Store.memoryAdapter());
    await db.setProfile({ goals: ['mobility', 'bogus', 'legs'] });
    assert.deepStrictEqual(db.state.goals, ['mobility', 'legs']);
    assert.deepStrictEqual(Store.migrate({ goals: ['mobility'] }).goals, [], 'the stock store still drops it');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

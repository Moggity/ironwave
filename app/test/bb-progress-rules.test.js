/* ============================================================
   IRONWAVE — test/bb-progress-rules.test.js
   Unit tests of the pure weekly progression writer
   Engine.coach.progress(prev, logged, spec, ctx), one test per row
   of the R4 table in docs/week2-prescriptions/phase2-rules.md, plus
   the deload (R8) and not-logged (R5) rows and the closed
   Engine.REASON_CODES enum.

   Synthetic logs only: no simulation, no clock, no randomness.
   Assertions follow the spec text, not the implementation.
   ============================================================ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const E = app.Engine;
app.S = app.defaultState();
const progress = (...a) => E.coach.progress(...a);

// A set logged at `reps` with `rir` reps in reserve (stored as RPE = 10 - RIR).
const set = (reps, rir, extra) => Object.assign({ reps, rpe: 10 - rir }, extra || {});
const sets = (n, reps, rir, extra) => Array.from({ length: n }, () => set(reps, rir, extra));
const WORK = { weekType: 'intensification' };
// An isolation exercise on a 10-15 range at RIR 1-2, barbell-style 2.5 kg steps.
const ISO = { range: [10, 15], rir: [1, 2], inc: 2.5, e1: null, maxSetAdj: 2 };
const C = () => E.REASON_CODES;

// ---- the closed enum ------------------------------------------------------
const SPEC_CODES = ['CALIBRATED', 'LOAD_UP', 'LOAD_UP_EARNED', 'LOAD_DOWN', 'HOLD', 'STEP_TOO_BIG', 'ADD_SET',
  'REMOVE_SET', 'RIR_TIGHTEN', 'RIR_EASE', 'PEAK_SET', 'DELOAD', 'BLOCK_TRANSITION', 'MAX_UPDATED'];

test('REASON_CODES is a frozen closed enum whose keys equal their values (R4)', () => {
  const codes = E.REASON_CODES;
  assert.ok(codes && typeof codes === 'object', 'Engine.REASON_CODES exists');
  assert.ok(Object.isFrozen(codes), 'the enum is frozen');
  for (const k of Object.keys(codes)) assert.strictEqual(codes[k], k, `key ${k} equals its value`);
  assert.deepStrictEqual(Object.keys(codes).sort(), SPEC_CODES.slice().sort(), 'exactly the codes the spec lists');
  assert.throws(() => { 'use strict'; codes.NEW_CODE = 'NEW_CODE'; }, TypeError, 'no code can be added at runtime');
});

// ---- R4 rows ----------------------------------------------------------------
test('R4 nothing logged last week: plan unchanged, no codes', () => {
  const prev = { load: 50, setAdj: 1, miss: 1 };
  for (const logged of [[], null, undefined]) {
    const r = progress(prev, logged, ISO, WORK);
    assert.strictEqual(r.load, 50);
    assert.strictEqual(r.setAdj, 1);
    assert.strictEqual(r.miss, 1);
    assert.deepStrictEqual(r.reasons, []);
  }
});

test('R5 never logged and no max: no load is invented (stays on calibration)', () => {
  const r = progress(null, [], ISO, WORK);
  assert.strictEqual(r.load, null, 'no plan load, so the resolver keeps the calibration scheme');
  assert.deepStrictEqual(r.reasons, []);
});

test('R4 only calibration sets logged: load priced from the e1RM for the middle of the range at the top of the RIR target, CALIBRATED', () => {
  const spec = { range: [8, 12], rir: [2, 3], inc: 2.5, e1: 100, maxSetAdj: 2 };
  const logged = [set(12, 4, { calib: true }), set(10, 3, { calib: true }), set(8, 2, { calib: true })];
  const r = progress(null, logged, spec, { weekType: 'accumulation' });
  // Middle of 8-12 is 10 reps; top of RIR 2-3 is 3, i.e. RPE 7.
  const expected = E.weightFor(100, 10, 7, 2.5);
  assert.ok(expected > 0);
  assert.strictEqual(r.load, expected);
  assert.deepStrictEqual(r.reasons, [C().CALIBRATED]);
  assert.strictEqual(r.miss, 0);
});

test('R4 no load yet but an e1RM exists (working sets logged): priced, CALIBRATED', () => {
  // Spec row 2 reads "Only calibration sets logged, OR no load yet but an
  // e1RM exists". Reading: the second clause covers an exercise that has no
  // priced load (prev null) but whose logged sets give an e1RM; it must be
  // priced exactly like the calibration case.
  const spec = { range: [8, 12], rir: [2, 3], inc: 2.5, e1: 100, maxSetAdj: 2 };
  const r = progress(null, sets(3, 10, 3), spec, { weekType: 'accumulation' });
  assert.strictEqual(r.load, E.weightFor(100, 10, 7, 2.5), 'a load is priced from the e1RM');
  assert.ok(r.reasons.includes(C().CALIBRATED), `CALIBRATED expected, got ${JSON.stringify(r.reasons)}`);
});

test('R4 every set at the top of the range, none too hard: load up by the largest whole number of steps <= 5%, LOAD_UP', () => {
  // 100 kg, 2.5 kg steps: 5% = 5 kg = 2 whole steps.
  let r = progress({ load: 100, setAdj: 0, miss: 0 }, sets(3, 15, 2), ISO, WORK);
  assert.strictEqual(r.load, 105);
  assert.deepStrictEqual(r.reasons, [C().LOAD_UP]);
  // 110 kg: 5% = 5.5 kg, rounded DOWN to whole steps = 5 kg (not 7.5).
  r = progress({ load: 110, setAdj: 0, miss: 0 }, sets(3, 15, 1), ISO, WORK);
  assert.strictEqual(r.load, 115);
  assert.deepStrictEqual(r.reasons, [C().LOAD_UP]);
  // Above the top of the range also counts as "at or above".
  r = progress({ load: 60, setAdj: 0, miss: 0 }, sets(3, 17, 2), ISO, WORK);
  assert.strictEqual(r.load, 62.5);
  assert.deepStrictEqual(r.reasons, [C().LOAD_UP]);
});

test('R4 one step is more than 5% but at most 10%: exactly one step, LOAD_UP_EARNED', () => {
  // 40 kg, 2.5 kg step = 6.25%.
  const r = progress({ load: 40, setAdj: 0, miss: 0 }, sets(3, 15, 2), ISO, WORK);
  assert.strictEqual(r.load, 42.5);
  assert.deepStrictEqual(r.reasons, [C().LOAD_UP_EARNED]);
  // Exactly 10% is still earned ("at most 10%"): 25 kg + 2.5 kg.
  const r2 = progress({ load: 25, setAdj: 0, miss: 0 }, sets(3, 15, 2), ISO, WORK);
  assert.strictEqual(r2.load, 27.5);
  assert.deepStrictEqual(r2.reasons, [C().LOAD_UP_EARNED]);
});

test('R4 one step is more than 10% (2.5 kg/hand dumbbells): hold, HOLD + STEP_TOO_BIG', () => {
  const inc = app.loadingFor('lateral-raise').totalInc;
  assert.strictEqual(inc, 5, 'precondition: a dumbbell pair steps 2.5 kg per hand = 5 kg total');
  // 2 x 20 kg dumbbells = 40 kg total: one 5 kg step = 12.5%.
  const spec = { range: [10, 15], rir: [1, 2], inc, e1: null, maxSetAdj: 2 };
  const r = progress({ load: 40, setAdj: 0, miss: 0 }, sets(3, 15, 2), spec, WORK);
  assert.strictEqual(r.load, 40, 'the jump waits for the block transition');
  assert.ok(r.reasons.includes(C().HOLD), JSON.stringify(r.reasons));
  assert.ok(r.reasons.includes(C().STEP_TOO_BIG), JSON.stringify(r.reasons));
  assert.ok(!r.reasons.includes(C().LOAD_UP) && !r.reasons.includes(C().LOAD_UP_EARNED));
});

test('R4 first miss (a set under the bottom of the range): hold, HOLD, miss counted', () => {
  const r = progress({ load: 50, setAdj: 0, miss: 0 }, [set(12, 2), set(11, 2), set(9, 2)], ISO, WORK);
  assert.strictEqual(r.load, 50);
  assert.deepStrictEqual(r.reasons, [C().HOLD]);
  assert.strictEqual(r.miss, 1);
});

test('R4 first miss (a set harder than the RIR target): hold, HOLD', () => {
  // Target RIR 1-2; a set at RIR 0 (RPE 10) is harder than rir[0].
  const r = progress({ load: 50, setAdj: 0, miss: 0 }, [set(12, 1), set(12, 1), set(12, 0)], ISO, WORK);
  assert.strictEqual(r.load, 50);
  assert.deepStrictEqual(r.reasons, [C().HOLD]);
  assert.strictEqual(r.miss, 1);
});

test('R4 second consecutive miss: load down one step, LOAD_DOWN', () => {
  const r = progress({ load: 50, setAdj: 0, miss: 1 }, sets(3, 8, 2), ISO, WORK);
  assert.strictEqual(r.load, 47.5);
  assert.ok(r.reasons.includes(C().LOAD_DOWN), JSON.stringify(r.reasons));
  assert.ok(!r.reasons.includes(C().ADD_SET));
});

test('R4 a good week between two misses resets the count (misses must be consecutive)', () => {
  const ok = progress({ load: 50, setAdj: 0, miss: 1 }, sets(3, 12, 1), ISO, WORK);
  assert.strictEqual(ok.miss, 0);
  const miss = progress(ok, sets(3, 8, 2), ISO, WORK);
  assert.strictEqual(miss.load, 50, 'a first miss after a reset only holds');
  assert.deepStrictEqual(miss.reasons, [C().HOLD]);
});

test('R4 in range, on target effort: no change, no codes', () => {
  const prev = { load: 50, setAdj: 1, miss: 0 };
  const r = progress(prev, [set(13, 2), set(12, 1), set(11, 1)], ISO, WORK);
  assert.strictEqual(r.load, 50);
  assert.strictEqual(r.setAdj, 1);
  assert.deepStrictEqual(r.reasons, []);
});

test('R4 easy week (every set RIR >= top of target + 1), no miss, no load rise: one more set, ADD_SET', () => {
  // Target RIR 1-2: every set at RIR 3 or more is "easier by 1 or more".
  const r = progress({ load: 50, setAdj: 0, miss: 0 }, [set(12, 3), set(12, 4), set(11, 3)], ISO, WORK);
  assert.strictEqual(r.load, 50);
  assert.strictEqual(r.setAdj, 1);
  assert.deepStrictEqual(r.reasons, [C().ADD_SET]);
});

test('R4 ADD_SET stops at maxSetAdj', () => {
  const spec = Object.assign({}, ISO, { maxSetAdj: 2 });
  let prev = { load: 50, setAdj: 0, miss: 0 };
  const easy = sets(3, 12, 4);
  const seen = [];
  for (let i = 0; i < 4; i++) { prev = progress(prev, easy, spec, WORK); seen.push(prev.setAdj); }
  assert.deepStrictEqual(seen, [1, 2, 2, 2]);
  const capped = progress({ load: 50, setAdj: 2, miss: 0 }, easy, spec, WORK);
  assert.ok(!capped.reasons.includes(C().ADD_SET), 'no ADD_SET once at the cap');
});

test('R4 an easy week that also earns a load rise adds load OR a set, never both', () => {
  // Top of the range AND very easy: the load goes up, the set count does not.
  const r = progress({ load: 100, setAdj: 0, miss: 0 }, sets(3, 15, 4), ISO, WORK);
  assert.strictEqual(r.load, 105);
  assert.strictEqual(r.setAdj, 0);
  assert.ok(!r.reasons.includes(C().ADD_SET), JSON.stringify(r.reasons));
});

test('R4 an easy week is never a reason to add a set on a miss', () => {
  // Under the range but at high RIR: a miss (under the bottom), so no ADD_SET.
  const r = progress({ load: 50, setAdj: 0, miss: 0 }, sets(3, 8, 4), ISO, WORK);
  assert.strictEqual(r.setAdj, 0);
  assert.ok(!r.reasons.includes(C().ADD_SET));
});

test('R4 calibration flags are ignored once working sets exist (feelers do not count as misses)', () => {
  const logged = [set(15, 4, { calib: true }), set(6, 0, { calib: true })].concat(sets(3, 12, 1));
  const r = progress({ load: 50, setAdj: 0, miss: 0 }, logged, ISO, WORK);
  assert.strictEqual(r.load, 50);
  assert.deepStrictEqual(r.reasons, []);
});

// ---- R8 deload / R5 not logged ----------------------------------------------
test('R8 entering the deload week: the plan keeps its working load and sets (the resolver derives the deload), DELOAD', () => {
  // Reading: progress() never raises load or adds a set INTO the deload; the
  // deload week (x0.9 load, half the sets, RIR 4-5) is derived from the kept
  // plan by the resolver.
  const prev = { load: 100, setAdj: 1, miss: 0 };
  const r = progress(prev, sets(3, 15, 4), ISO, { weekType: 'deload' });
  assert.strictEqual(r.load, 100);
  assert.strictEqual(r.setAdj, 1);
  assert.ok(r.reasons.includes(C().DELOAD), JSON.stringify(r.reasons));
  assert.ok(!r.reasons.includes(C().LOAD_UP) && !r.reasons.includes(C().ADD_SET));
});

test('R5 not logged: a skipped exercise keeps its plan (hold) and is never cut for it', () => {
  const prev = { load: 62.5, setAdj: 2, miss: 0 };
  // Sets that exist but were not done (no reps) count as not logged.
  const r = progress(prev, [{ reps: null, rpe: null }, { reps: 0, rpe: 8 }], ISO, WORK);
  assert.strictEqual(r.load, 62.5);
  assert.strictEqual(r.setAdj, 2, 'nothing is removed for being skipped');
  assert.ok(!r.reasons.includes(C().REMOVE_SET) && !r.reasons.includes(C().LOAD_DOWN));
});

test('progress is pure: it does not mutate its inputs', () => {
  const prev = Object.freeze({ load: 100, setAdj: 0, miss: 1 });
  const logged = Object.freeze(sets(3, 8, 0).map(Object.freeze));
  const spec = Object.freeze(Object.assign({}, ISO, { range: Object.freeze([10, 15]), rir: Object.freeze([1, 2]) }));
  assert.doesNotThrow(() => progress(prev, logged, spec, Object.freeze({ weekType: 'realization' })));
});

test('every code progress() can return is a member of REASON_CODES', () => {
  const known = new Set(Object.values(E.REASON_CODES));
  const prevs = [null, { load: 25, setAdj: 0, miss: 0 }, { load: 40, setAdj: 2, miss: 1 }, { load: 100, setAdj: 1, miss: 0 }];
  const logs = [[], sets(3, 15, 2), sets(3, 12, 4), sets(3, 8, 2), sets(3, 12, 0), [set(12, 4, { calib: true })]];
  const specs = [ISO, Object.assign({}, ISO, { inc: 5, e1: 80 }), { range: [6, 10], rir: [2, 3], inc: 2.5, e1: 120, maxSetAdj: 2 }];
  const types = ['accumulation', 'intensification', 'realization', 'deload'];
  let n = 0;
  for (const p of prevs) for (const l of logs) for (const s of specs) for (const weekType of types) {
    const r = progress(p, l, s, { weekType });
    assert.ok(Array.isArray(r.reasons));
    for (const c of r.reasons) { assert.ok(known.has(c), `unknown code ${c}`); n++; }
  }
  assert.ok(n > 0, 'the grid produced codes');
});

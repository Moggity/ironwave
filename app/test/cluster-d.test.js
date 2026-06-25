/* ============================================================
   IRONWAVE — test/cluster-d.test.js
   Cluster D / Epic 4, first slice: the per-muscle weekly volume dashboard.
   - Engine.volumeStatus classifies sets vs MV/MEV/MRV (pure).
   - weeklyVolumeByMuscle tallies the current week's direct working sets per
     muscle, keyed like the landmark grid; big compounds attribute through
     SYNERGIST_COVERAGE; only landmark muscles appear. Read-only, so the golden
     master is untouched.
   Through the existing test/load-app.js harness (no jsdom).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine, VOLUME_LANDMARKS } = app;

const DEFAULT_FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

// ---------------------------------------------------------------------------
// Engine.volumeStatus
// ---------------------------------------------------------------------------
test('volumeStatus classifies sets against MV/MEV/MRV', () => {
  const lm = { mv: 8, mev: 10, mrv: 22 };
  assert.strictEqual(Engine.volumeStatus(0, lm).key, 'none');
  assert.strictEqual(Engine.volumeStatus(6, lm).key, 'under');     // below MV
  assert.strictEqual(Engine.volumeStatus(9, lm).key, 'maint');     // MV..MEV
  assert.strictEqual(Engine.volumeStatus(10, lm).key, 'productive'); // at MEV
  assert.strictEqual(Engine.volumeStatus(22, lm).key, 'productive'); // at MRV
  assert.strictEqual(Engine.volumeStatus(25, lm).key, 'over');     // above MRV
});

test('volumeStatus fill is sets relative to MRV, clamped to 100', () => {
  const lm = { mv: 8, mev: 10, mrv: 20 };
  assert.strictEqual(Engine.volumeStatus(10, lm).pct, 50);
  assert.strictEqual(Engine.volumeStatus(30, lm).pct, 100);
  assert.deepStrictEqual(Engine.volumeStatus(5, null), { key: 'none', label: 'No landmark', pct: 0 });
});

// ---------------------------------------------------------------------------
// weeklyVolumeByMuscle
// ---------------------------------------------------------------------------
function bbProgram() {
  app.S = app.defaultState();
  app.S.program = app.makeProgram({
    daysPerWeek: 5, track: 'bodybuilding', timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  });
  return app.S.program;
}

test('weeklyVolumeByMuscle tallies only landmark muscles, with positive sets', () => {
  bbProgram();
  const vol = app.weeklyVolumeByMuscle();
  const keys = Object.keys(vol);
  assert.ok(keys.length, 'some muscles are trained this week');
  for (const k of keys) {
    assert.ok(VOLUME_LANDMARKS[k], `${k} is a landmark-keyed muscle`);
    assert.ok(vol[k] > 0, `${k} has positive volume`);
  }
  // The big-4 movement buckets are never keys: they attribute to muscles instead.
  for (const m of ['squat', 'bench', 'deadlift', 'press']) {
    assert.ok(!(m in vol), `${m} is attributed, not counted directly`);
  }
});

test('a bench-pressing day attributes volume to the chest via synergist coverage', () => {
  const prog = bbProgram();
  // A single day whose only slot is a barbell bench main (movement "bench").
  prog.days = [{ name: 'Push', slots: [{ type: 'main', lift: 'comp-bench' }] }];
  // Give it a working max so the main resolves to weighted working sets.
  prog.wm['comp-bench'] = 100;
  const vol = app.weeklyVolumeByMuscle();
  assert.ok(vol.chest > 0, 'bench feeds the chest');
  assert.ok(vol.tricep > 0 && vol.tricep < vol.chest, 'triceps get partial coverage');
  assert.ok(!('bench' in vol));
});

test('weeklyVolumeByMuscle counts working sets but not warmup ramps', () => {
  const prog = bbProgram();
  prog.days = [{ name: 'Pull', slots: [{ type: 'acc', cat: 'bicep', def: 'db-curl', ex: 'db-curl' }] }];
  app.S.records['db-curl'] = [{ ts: Date.now(), weight: 15, reps: 12, rpe: 8 }];
  const vol = app.weeklyVolumeByMuscle();
  // Resolve the same slot directly and confirm the count matches its non-ramp sets.
  const rs = app.resolveSlot(prog.days[0].slots[0], prog.pointer.block, prog.pointer.week);
  const expected = rs.sets.filter(s => !s.ramp).length;
  assert.strictEqual(vol.bicep, expected);
});

// ---------------------------------------------------------------------------
// weeklyVolumeByHead (Cluster C/D per-head split)
// ---------------------------------------------------------------------------
test('weeklyVolumeByHead nests head-tagged sets under the muscle, consistent with the muscle tally', () => {
  const prog = bbProgram();
  // Two chest accessories with distinct heads on one day.
  prog.days = [{ name: 'Chest', slots: [
    { type: 'acc', cat: 'chest', def: 'dips', ex: 'dips' },           // chest-lower
    { type: 'acc', cat: 'chest', def: 'cable-fly', ex: 'cable-fly' }, // no head
  ] }];
  app.S.records['dips'] = [{ ts: Date.now(), weight: 40, reps: 10, rpe: 8 }];
  app.S.records['cable-fly'] = [{ ts: Date.now(), weight: 20, reps: 12, rpe: 8 }];
  const heads = app.weeklyVolumeByHead();
  const dipSets = app.resolveSlot(prog.days[0].slots[0], 0, 0).sets.filter(s => !s.ramp).length;
  assert.ok(heads.chest, 'chest has a head breakdown');
  assert.strictEqual(heads.chest['chest-lower'], dipSets, 'lower-chest count matches the dips working sets');
  assert.ok(!('null' in heads.chest) && heads.chest[null] === undefined, 'a headless exercise adds no head bucket');
});

test('weeklyVolumeByHead attributes a pattern-movement head to the muscle it names, by coverage', () => {
  const prog = bbProgram();
  prog.days = [{ name: 'Push', slots: [{ type: 'main', lift: 'comp-bench' }] }]; // head chest-lower, movement bench
  prog.wm['comp-bench'] = 100;
  const heads = app.weeklyVolumeByHead();
  const benchSets = app.resolveSlot(prog.days[0].slots[0], 0, 0).sets.filter(s => !s.ramp).length;
  // bench -> chest at SYNERGIST_COVERAGE 1.0, so the chest-lower head now gets the
  // full working sets (it used to be skipped entirely, leaving upper chest blind).
  assert.ok(heads.chest && heads.chest['chest-lower'] != null, 'the bench pattern now feeds the chest head split');
  assert.strictEqual(heads.chest['chest-lower'], Math.round(benchSets * app.SYNERGIST_COVERAGE.bench.chest * 2) / 2);
  // The head numbers stay consistent with the (fractionally attributed) muscle bar.
  assert.strictEqual(app.weeklyVolumeByMuscle().chest, heads.chest['chest-lower']);
});

/* ============================================================
   IRONWAVE — test/cluster-b.test.js
   Cluster B / Epic 2, first technique end-to-end: the drop set.
   - Engine.buildDropSet constructs the child mini-sets (prescription).
   - Engine.setTimeSec / estimateSessionSec learn the drop's time cost.
   - Engine.tonnage counts the logged drops (volume).
   - applyTechnique only fires for an opted-in bodybuilding accessory; every
     other track / untagged exercise stays byte-identical (golden master holds).
   Through the existing test/load-app.js harness (no jsdom).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine, TIME_MODEL, DROP_DEFAULTS } = app;

const DEFAULT_FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

// ---------------------------------------------------------------------------
// buildDropSet (prescription / construction)
// ---------------------------------------------------------------------------
test('buildDropSet keeps the top set and adds descending mini-sets', () => {
  const out = Engine.buildDropSet({ weight: 100, reps: 10, rpe: 8 }, { rounding: 2.5 });
  assert.strictEqual(out.technique, 'drop');
  assert.strictEqual(out.weight, 100, 'top set weight unchanged');
  assert.strictEqual(out.drops.length, DROP_DEFAULTS.drops);
  // 20% strips off 100 -> 80 -> 64 (rounded to 2.5).
  assert.deepStrictEqual(out.drops.map(d => d.weight), [80, 65]);
  assert.ok(out.drops.every(d => d.reps >= 1), 'each drop carries a rep target');
});

test('buildDropSet leaves a weightless or no-drop set untouched', () => {
  const calib = { reps: 12, rpe: 8, calib: true };
  assert.strictEqual(Engine.buildDropSet(calib, { rounding: 2.5 }), calib, 'no weight -> unchanged');
  const set = { weight: 100, reps: 10 };
  assert.strictEqual(Engine.buildDropSet(set, { drops: 0 }), set, 'zero drops -> unchanged');
});

test('buildDropSet does not mutate the input set', () => {
  const set = { weight: 100, reps: 10, rpe: 8 };
  Engine.buildDropSet(set, { rounding: 2.5 });
  assert.strictEqual(set.technique, undefined);
  assert.strictEqual(set.drops, undefined);
});

// ---------------------------------------------------------------------------
// Time accounting
// ---------------------------------------------------------------------------
test('setTimeSec charges drops their exec + one transition each, one rest total', () => {
  const TM = TIME_MODEL, kind = 'accessory', rest = TM.restSec[kind];
  const plain = { reps: 10 };
  const drop = Engine.buildDropSet({ weight: 100, reps: 10 }, { rounding: 2.5 });
  const plainT = Engine.setTimeSec(plain, TM, kind, rest);
  const dropT = Engine.setTimeSec(drop, TM, kind, rest);
  // Exactly the two mini-sets' exec plus one transition each, and NOT extra rests.
  const expected = plainT + drop.drops.reduce((a, d) =>
    a + d.reps * TM.execSecPerRep[kind] + TM.dropTransitionSec, 0);
  assert.strictEqual(dropT, expected);
  // A drop set must cost less than running each mini-set as its own full-rest set.
  const asFullSets = plainT + drop.drops.reduce((a, d) =>
    a + d.reps * TM.execSecPerRep[kind] + rest, 0);
  assert.ok(dropT < asFullSets, 'drop transition is cheaper than a full rest');
});

test('estimateSessionSec reflects a drop set on an accessory', () => {
  app.S = app.defaultState(); // estimateSessionSec reaches exById -> S.customEx
  const exId = 'cable-fly';
  const base = { exId, isMain: false, isSecondary: false, sets: [{ weight: 50, reps: 12, rpe: 8 }] };
  const dropped = { exId, isMain: false, isSecondary: false,
    sets: [Engine.buildDropSet({ weight: 50, reps: 12, rpe: 8 }, { rounding: 2.5 })] };
  const diff = app.estimateSessionSec([dropped], false) - app.estimateSessionSec([base], false);
  const drops = dropped.sets[0].drops;
  const expected = drops.reduce((a, d) =>
    a + d.reps * TIME_MODEL.execSecPerRep.accessory + TIME_MODEL.dropTransitionSec, 0);
  assert.strictEqual(diff, expected);
});

// ---------------------------------------------------------------------------
// Volume / tonnage
// ---------------------------------------------------------------------------
test('tonnage includes the logged drops', () => {
  const entries = [{ sets: [
    { done: true, weight: 100, reps: 10, drops: [{ weight: 80, reps: 8 }, { weight: 64, reps: 6 }] },
  ] }];
  // 1000 + 640 + 384
  assert.strictEqual(Engine.tonnage(entries), 2024);
});

// ---------------------------------------------------------------------------
// applyTechnique routing (bodybuilding-only, opt-in, golden-master-safe)
// ---------------------------------------------------------------------------
function bbProgramWithRecords(exId) {
  app.S = app.defaultState();
  app.S.program = app.makeProgram({
    daysPerWeek: 4, track: 'bodybuilding', timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  });
  // Give the accessory a recent history so its prescription carries real weight.
  app.S.records[exId] = [{ ts: Date.now(), weight: 40, reps: 12, rpe: 8 }];
  return app.S.program;
}
const accSlot = exId => ({ type: 'acc', cat: 'chest', def: exId, ex: exId });

test('applyTechnique adds a drop set only to an opted-in bodybuilding accessory', () => {
  const exId = 'cable-fly';
  const prog = bbProgramWithRecords(exId);
  prog.days[0] = { name: 'Chest', slots: [accSlot(exId)] };

  // Untagged: no drop anywhere. Week 2 (intensification) is finisher-eligible.
  let rs = app.resolveSlot(prog.days[0].slots[0], 0, 2);
  assert.ok(rs.sets.length, 'accessory resolved to weighted sets');
  assert.ok(!rs.sets.some(s => s.technique === 'drop'), 'untagged accessory has no drop set');

  // Tagged: exactly the last weighted working set becomes a drop set.
  app.S.techniques[exId] = 'drop';
  // The periodization gate holds it back on early weeks (intro/accumulation).
  const early = app.resolveSlot(prog.days[0].slots[0], 0, 1);
  assert.ok(!early.sets.some(s => s.technique === 'drop'), 'no finisher on an accumulation week');
  rs = app.resolveSlot(prog.days[0].slots[0], 0, 2);
  const dropSets = rs.sets.filter(s => s.technique === 'drop');
  assert.strictEqual(dropSets.length, 1, 'exactly one drop set');
  assert.strictEqual(rs.sets[rs.sets.length - 1].technique, 'drop', 'it is the last set');
  assert.ok(dropSets[0].drops.length === DROP_DEFAULTS.drops);
});

test('applyTechnique is inert off the bodybuilding track even if tagged', () => {
  const exId = 'cable-fly';
  app.S = app.defaultState();
  app.S.program = app.makeProgram({
    daysPerWeek: 4, track: 'powerbuilding', timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  });
  app.S.records[exId] = [{ ts: Date.now(), weight: 40, reps: 12, rpe: 8 }];
  app.S.techniques[exId] = 'drop';
  app.S.program.days[0] = { name: 'Day', slots: [accSlot(exId)] };
  const rs = app.resolveSlot(app.S.program.days[0].slots[0], 0, 2);
  assert.ok(!rs.sets.some(s => s.technique === 'drop'), 'powerbuilding never gets a drop set');
});

// ---------------------------------------------------------------------------
// In-session surfacing helpers + one-time flag state
// ---------------------------------------------------------------------------
test('defaultState and migrateState carry the additive techniques / flags maps', () => {
  const s = app.defaultState();
  assert.deepStrictEqual(s.techniques, {});
  assert.deepStrictEqual(s.flags, {});
  const legacy = {};                 // a pre-Cluster-A/B save has neither
  app.migrateState(legacy);
  assert.deepStrictEqual(legacy.techniques, {});
  assert.deepStrictEqual(legacy.flags, {});
  legacy.techniques['cable-fly'] = 'drop';
  app.migrateState(legacy);          // idempotent: does not wipe existing
  assert.strictEqual(legacy.techniques['cable-fly'], 'drop');
});

test('lastWorkingSetIdx finds the last weighted working set, skipping ramp/calib/amrap', () => {
  assert.strictEqual(app.lastWorkingSetIdx([
    { ramp: true, targetWeight: 40 },
    { targetWeight: 60, targetReps: 8 },
    { targetWeight: 60, targetReps: 8 },
    { amrap: true, targetWeight: 80 },
  ]), 2);
  assert.strictEqual(app.lastWorkingSetIdx([{ calib: true, targetReps: 12 }]), -1, 'no weighted set');
  assert.strictEqual(app.lastWorkingSetIdx([{ done: true, weight: 50, targetWeight: null }]), 0, 'logged weight counts');
});

test('entryHasDrop / canDropEntry gate the chip to a bodybuilding accessory', () => {
  app.S = app.defaultState();
  app.S.program = app.makeProgram({
    daysPerWeek: 4, track: 'bodybuilding', timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  });
  const acc = { isMain: false, isSecondary: false, exId: 'cable-fly', sets: [{ targetWeight: 40, targetReps: 12 }] };
  const main = { isMain: true, isSecondary: false, exId: 'comp-bench', sets: [{ targetWeight: 80, targetReps: 5 }] };
  assert.strictEqual(app.canDropEntry(acc), true);
  assert.strictEqual(app.canDropEntry(main), false, 'mains anchor the working max, no drop');
  assert.strictEqual(app.entryHasDrop(acc), false);
  acc.sets[0].technique = 'drop';
  assert.strictEqual(app.entryHasDrop(acc), true);

  app.S.program.trainingConfig.track = 'powerbuilding';
  assert.strictEqual(app.canDropEntry(acc), false, 'off the bodybuilding track the chip never shows');
});

/* ============================================================
   IRONWAVE — test/cluster-b-myo.test.js
   Cluster B / Epic 2, second technique end-to-end: myo-reps.
   Myo-reps share the drop set's child mini-set plumbing (the `drops`
   field + `technique` tag), so this covers what differs:
   - Engine.buildMyoReps keeps the SAME weight across short mini-sets.
   - Engine.setTimeSec charges the longer myo mini-rest, not the drop strip.
   - applyTechnique routes 'myo' for an opted-in bodybuilding accessory only.
   - entryTech reports the technique and drop/myo never coexist.
   Through the existing test/load-app.js harness (no jsdom).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine, TIME_MODEL, MYO_DEFAULTS } = app;

const DEFAULT_FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

// ---------------------------------------------------------------------------
// buildMyoReps (prescription / construction)
// ---------------------------------------------------------------------------
test('buildMyoReps keeps the activation set and adds same-weight mini-sets', () => {
  const out = Engine.buildMyoReps({ weight: 60, reps: 15, rpe: 9 });
  assert.strictEqual(out.technique, 'myo');
  assert.strictEqual(out.weight, 60, 'activation set weight unchanged');
  assert.strictEqual(out.drops.length, MYO_DEFAULTS.minis);
  // Unlike a drop set, every mini-set is at the SAME load.
  assert.ok(out.drops.every(d => d.weight === 60), 'mini-sets stay at the activation weight');
  assert.ok(out.drops.every(d => d.reps === MYO_DEFAULTS.miniReps), 'each mini-set is a few reps');
});

test('buildMyoReps leaves a weightless or zero-mini set untouched, no mutation', () => {
  const calib = { reps: 15, rpe: 9, calib: true };
  assert.strictEqual(Engine.buildMyoReps(calib), calib, 'no weight -> unchanged');
  const set = { weight: 60, reps: 15 };
  assert.strictEqual(Engine.buildMyoReps(set, { minis: 0 }), set, 'zero minis -> unchanged');
  Engine.buildMyoReps(set);
  assert.strictEqual(set.technique, undefined, 'input set is not mutated');
  assert.strictEqual(set.drops, undefined);
});

// ---------------------------------------------------------------------------
// Time accounting: myo mini-rest differs from the drop strip transition
// ---------------------------------------------------------------------------
test('setTimeSec charges myo mini-rests, longer than a drop strip transition', () => {
  const TM = TIME_MODEL, kind = 'accessory', rest = TM.restSec[kind];
  const myo = Engine.buildMyoReps({ weight: 60, reps: 15 });
  const plain = { reps: 15 };
  const myoT = Engine.setTimeSec(myo, TM, kind, rest);
  const expected = Engine.setTimeSec(plain, TM, kind, rest) + myo.drops.reduce((a, d) =>
    a + d.reps * TM.execSecPerRep[kind] + TM.myoRestSec, 0);
  assert.strictEqual(myoT, expected, 'each mini-set adds exec + one myo mini-rest, one full rest total');

  // Same child count as a drop, but a myo mini-rest costs more than a drop strip.
  const drop = { technique: 'drop', reps: 15, drops: myo.drops };
  assert.ok(TM.myoRestSec > TM.dropTransitionSec);
  assert.ok(myoT > Engine.setTimeSec(drop, TM, kind, rest), 'myo mini-rest is the slower transition');
});

// ---------------------------------------------------------------------------
// Volume / tonnage (shared child plumbing, but assert it counts myo too)
// ---------------------------------------------------------------------------
test('tonnage includes the logged myo mini-sets at the activation weight', () => {
  const entries = [{ sets: [
    { done: true, weight: 60, reps: 15, technique: 'myo',
      drops: [{ weight: 60, reps: 5 }, { weight: 60, reps: 5 }, { weight: 60, reps: 4 }] },
  ] }];
  // 900 + 300 + 300 + 240
  assert.strictEqual(Engine.tonnage(entries), 1740);
});

// ---------------------------------------------------------------------------
// applyTechnique routing + entryTech (bodybuilding-only, opt-in, golden-safe)
// ---------------------------------------------------------------------------
function bbProgramWithRecords(exId) {
  app.S = app.defaultState();
  app.S.program = app.makeProgram({
    daysPerWeek: 4, track: 'bodybuilding', timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  });
  app.S.records[exId] = [{ ts: Date.now(), weight: 40, reps: 12, rpe: 8 }];
  return app.S.program;
}
const accSlot = exId => ({ type: 'acc', cat: 'chest', def: exId, ex: exId });

test('applyTechnique turns the last working set into a myo set when tagged myo', () => {
  const exId = 'cable-fly';
  const prog = bbProgramWithRecords(exId);
  prog.days[0] = { name: 'Chest', slots: [accSlot(exId)] };
  app.S.techniques[exId] = 'myo';
  const rs = app.resolveSlot(prog.days[0].slots[0], 0, 1);
  const myoSets = rs.sets.filter(s => s.technique === 'myo');
  assert.strictEqual(myoSets.length, 1, 'exactly one myo set');
  assert.strictEqual(rs.sets[rs.sets.length - 1].technique, 'myo', 'it is the last set');
  const top = rs.sets[rs.sets.length - 1];
  assert.ok(top.drops.every(d => d.weight === top.weight), 'mini-sets ride the working weight');
});

test('applyTechnique is inert off the bodybuilding track even if tagged myo', () => {
  const exId = 'cable-fly';
  app.S = app.defaultState();
  app.S.program = app.makeProgram({
    daysPerWeek: 4, track: 'powerbuilding', timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  });
  app.S.records[exId] = [{ ts: Date.now(), weight: 40, reps: 12, rpe: 8 }];
  app.S.techniques[exId] = 'myo';
  app.S.program.days[0] = { name: 'Day', slots: [accSlot(exId)] };
  const rs = app.resolveSlot(app.S.program.days[0].slots[0], 0, 1);
  assert.ok(!rs.sets.some(s => s.technique === 'myo'), 'powerbuilding never gets a myo set');
});

test('entryTech reports the technique on an entry; drop and myo are distinct', () => {
  const e = { sets: [{ targetWeight: 40 }, { targetWeight: 40, technique: 'myo', drops: [] }] };
  assert.strictEqual(app.entryTech(e), 'myo');
  e.sets[1].technique = 'drop';
  assert.strictEqual(app.entryTech(e), 'drop');
  e.sets[1].technique = null;
  assert.strictEqual(app.entryTech(e), null, 'a plain entry has no technique');
});

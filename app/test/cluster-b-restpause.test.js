/* ============================================================
   IRONWAVE — test/cluster-b-restpause.test.js
   Cluster B / Epic 2, third technique end-to-end: rest-pause.
   Like myo-reps it keeps the working weight, so it rides the shared child
   mini-set plumbing; this covers what is rest-pause-specific:
   - Engine.buildRestPause constructs same-weight bursts.
   - Engine.techTransitionSec / setTimeSec charge the rest-pause pause.
   - applyTechnique + buildTechnique route 'restpause' for a tagged
     bodybuilding accessory only; off-track stays inert (golden master holds).
   Through the existing test/load-app.js harness (no jsdom).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine, TIME_MODEL, RESTPAUSE_DEFAULTS, FINISHER_TECHS, SAME_WEIGHT_TECHS } = app;

const DEFAULT_FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

// ---------------------------------------------------------------------------
// buildRestPause (prescription / construction)
// ---------------------------------------------------------------------------
test('buildRestPause keeps the working set and adds same-weight bursts', () => {
  const out = Engine.buildRestPause({ weight: 80, reps: 8, rpe: 9 });
  assert.strictEqual(out.technique, 'restpause');
  assert.strictEqual(out.weight, 80, 'working set weight unchanged');
  assert.strictEqual(out.drops.length, RESTPAUSE_DEFAULTS.bursts);
  assert.ok(out.drops.every(d => d.weight === 80), 'bursts stay at the working weight');
  assert.ok(out.drops.every(d => d.reps === RESTPAUSE_DEFAULTS.burstReps), 'each burst is a few reps');
});

test('buildRestPause leaves a weightless or zero-burst set untouched, no mutation', () => {
  const calib = { reps: 8, rpe: 9, calib: true };
  assert.strictEqual(Engine.buildRestPause(calib), calib, 'no weight -> unchanged');
  const set = { weight: 80, reps: 8 };
  assert.strictEqual(Engine.buildRestPause(set, { bursts: 0 }), set, 'zero bursts -> unchanged');
  Engine.buildRestPause(set);
  assert.strictEqual(set.technique, undefined, 'input set is not mutated');
  assert.strictEqual(set.drops, undefined);
});

// ---------------------------------------------------------------------------
// Time accounting: the rest-pause pause is its own intrinsic transition
// ---------------------------------------------------------------------------
test('techTransitionSec maps each technique to its intrinsic intra-set rest', () => {
  assert.strictEqual(Engine.techTransitionSec('drop', TIME_MODEL), TIME_MODEL.dropTransitionSec);
  assert.strictEqual(Engine.techTransitionSec('myo', TIME_MODEL), TIME_MODEL.myoRestSec);
  assert.strictEqual(Engine.techTransitionSec('restpause', TIME_MODEL), TIME_MODEL.restPauseSec);
  // Unknown / straight falls back to the cheapest (drop strip) transition.
  assert.strictEqual(Engine.techTransitionSec(undefined, TIME_MODEL), TIME_MODEL.dropTransitionSec);
});

test('setTimeSec charges rest-pause bursts the pause, one full rest total', () => {
  const TM = TIME_MODEL, kind = 'accessory', rest = TM.restSec[kind];
  const rp = Engine.buildRestPause({ weight: 80, reps: 8 });
  const plain = { reps: 8 };
  const expected = Engine.setTimeSec(plain, TM, kind, rest) + rp.drops.reduce((a, d) =>
    a + d.reps * TM.execSecPerRep[kind] + TM.restPauseSec, 0);
  assert.strictEqual(Engine.setTimeSec(rp, TM, kind, rest), expected);
});

// ---------------------------------------------------------------------------
// Volume / tonnage (shared plumbing, assert it counts rest-pause too)
// ---------------------------------------------------------------------------
test('tonnage includes the logged rest-pause bursts', () => {
  const entries = [{ sets: [
    { done: true, weight: 80, reps: 8, technique: 'restpause',
      drops: [{ weight: 80, reps: 3 }, { weight: 80, reps: 2 }] },
  ] }];
  // 640 + 240 + 160
  assert.strictEqual(Engine.tonnage(entries), 1040);
});

// ---------------------------------------------------------------------------
// Routing + the shared finisher constants
// ---------------------------------------------------------------------------
test('the finishers are registered, and only drop strips the weight', () => {
  assert.deepStrictEqual(FINISHER_TECHS, ['drop', 'myo', 'restpause', 'partials']);
  // Drop is the only finisher that strips the load; the rest ride the working weight.
  assert.deepStrictEqual(SAME_WEIGHT_TECHS, ['myo', 'restpause', 'partials']);
  // buildTechnique dispatches each tag.
  assert.strictEqual(app.buildTechnique('restpause', { weight: 80, reps: 8 }, 2.5).technique, 'restpause');
  assert.strictEqual(app.buildTechnique('myo', { weight: 80, reps: 8 }, 2.5).technique, 'myo');
  assert.strictEqual(app.buildTechnique('drop', { weight: 80, reps: 8 }, 2.5).technique, 'drop');
  assert.strictEqual(app.buildTechnique('partials', { weight: 80, reps: 8 }, 2.5).technique, 'partials');
});

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

test('applyTechnique turns the last working set into a rest-pause set when tagged', () => {
  const exId = 'cable-fly';
  const prog = bbProgramWithRecords(exId);
  prog.days[0] = { name: 'Chest', slots: [accSlot(exId)] };
  app.S.techniques[exId] = 'restpause';
  const rs = app.resolveSlot(prog.days[0].slots[0], 0, 1);
  const rpSets = rs.sets.filter(s => s.technique === 'restpause');
  assert.strictEqual(rpSets.length, 1, 'exactly one rest-pause set');
  assert.strictEqual(rs.sets[rs.sets.length - 1].technique, 'restpause', 'it is the last set');
  const top = rs.sets[rs.sets.length - 1];
  assert.ok(top.drops.every(d => d.weight === top.weight), 'bursts ride the working weight');
});

test('applyTechnique is inert off the bodybuilding track even if tagged rest-pause', () => {
  const exId = 'cable-fly';
  app.S = app.defaultState();
  app.S.program = app.makeProgram({
    daysPerWeek: 4, track: 'powerbuilding', timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  });
  app.S.records[exId] = [{ ts: Date.now(), weight: 40, reps: 12, rpe: 8 }];
  app.S.techniques[exId] = 'restpause';
  app.S.program.days[0] = { name: 'Day', slots: [accSlot(exId)] };
  const rs = app.resolveSlot(app.S.program.days[0].slots[0], 0, 1);
  assert.ok(!rs.sets.some(s => s.technique === 'restpause'), 'powerbuilding never gets a rest-pause set');
});

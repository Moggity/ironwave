/* ============================================================
   IRONWAVE — test/cluster-b-partials.test.js
   Cluster B / Epic 2, fourth technique end-to-end: lengthened partials.
   Like myo / rest-pause it keeps the working weight, so it rides the shared
   child mini-set plumbing; this covers what is partials-specific:
   - Engine.buildPartials constructs a same-weight partial burst.
   - Engine.techTransitionSec / setTimeSec charge the small partials slowdown.
   - Partials keep the weight (SAME_WEIGHT_TECHS) but get NO timed rest cue
     (not in TIMED_REST_TECHS), unlike myo / rest-pause.
   - applyTechnique + buildTechnique route 'partials' for a tagged bodybuilding
     accessory only; off-track stays inert (golden master holds).
   Through the existing test/load-app.js harness (no jsdom).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine, TIME_MODEL, PARTIAL_DEFAULTS, FINISHER_TECHS, SAME_WEIGHT_TECHS, TIMED_REST_TECHS } = app;

const DEFAULT_FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

// ---------------------------------------------------------------------------
// buildPartials (prescription / construction)
// ---------------------------------------------------------------------------
test('buildPartials keeps the working set and adds a same-weight partial burst', () => {
  const out = Engine.buildPartials({ weight: 60, reps: 10, rpe: 9 });
  assert.strictEqual(out.technique, 'partials');
  assert.strictEqual(out.weight, 60, 'working set weight unchanged');
  assert.strictEqual(out.drops.length, PARTIAL_DEFAULTS.sets);
  assert.ok(out.drops.every(d => d.weight === 60), 'partials stay at the working weight');
  assert.ok(out.drops.every(d => d.reps === PARTIAL_DEFAULTS.partialReps), 'each burst is a few partial reps');
});

test('buildPartials leaves a weightless or zero-set input untouched, no mutation', () => {
  const calib = { reps: 8, rpe: 9, calib: true };
  assert.strictEqual(Engine.buildPartials(calib), calib, 'no weight -> unchanged');
  const set = { weight: 60, reps: 10 };
  assert.strictEqual(Engine.buildPartials(set, { sets: 0 }), set, 'zero bursts -> unchanged');
  Engine.buildPartials(set);
  assert.strictEqual(set.technique, undefined, 'input set is not mutated');
});

// ---------------------------------------------------------------------------
// Time accounting
// ---------------------------------------------------------------------------
test('techTransitionSec/setTimeSec charge the partials slowdown per burst', () => {
  assert.strictEqual(Engine.techTransitionSec('partials', TIME_MODEL), TIME_MODEL.partialsSec);
  const set = Engine.buildPartials({ weight: 60, reps: 10 });
  const restSec = 90;
  const exec = TIME_MODEL.execSecPerRep.accessory;
  // one full set + one rest, then each partial burst's reps + the slowdown.
  let expected = 10 * exec + restSec;
  for (const d of set.drops) expected += d.reps * exec + TIME_MODEL.partialsSec;
  assert.strictEqual(Engine.setTimeSec(set, TIME_MODEL, 'accessory', restSec), expected);
});

// ---------------------------------------------------------------------------
// Shared finisher constants
// ---------------------------------------------------------------------------
test('partials keep the weight but get no timed rest cue', () => {
  assert.ok(FINISHER_TECHS.includes('partials'), 'partials is a registered finisher');
  assert.ok(SAME_WEIGHT_TECHS.includes('partials'), 'partials ride the working weight');
  assert.ok(!TIMED_REST_TECHS.includes('partials'), 'partials have no intrinsic timed rest');
  assert.strictEqual(app.buildTechnique('partials', { weight: 60, reps: 10 }, 2.5).technique, 'partials');
});

// ---------------------------------------------------------------------------
// applyTechnique routing (bodybuilding-only, last working set)
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

test('applyTechnique turns the last working set into partials when tagged, off-track inert', () => {
  bbProgramWithRecords('cable-fly');
  app.S.techniques = { 'cable-fly': 'partials' };
  const sets = [{ weight: 40, reps: 12, rpe: 8 }, { weight: 40, reps: 12, rpe: 8 }];
  const out = app.applyTechnique('cable-fly', sets, 2.5, 0, 2); // week 2: finisher-eligible
  assert.strictEqual(out[out.length - 1].technique, 'partials', 'last working set tagged');
  assert.strictEqual(out[0].technique, undefined, 'earlier sets untouched');

  // The periodization gate holds the same tag back on an accumulation week.
  const early = app.applyTechnique('cable-fly', [{ weight: 40, reps: 12, rpe: 8 }], 2.5, 0, 1);
  assert.strictEqual(early[0].technique, undefined, 'no finisher on an early week');

  // The same tag is inert on a non-bodybuilding program.
  app.S.program.trainingConfig.track = 'powerbuilding';
  const out2 = app.applyTechnique('cable-fly', [{ weight: 40, reps: 12, rpe: 8 }], 2.5, 0, 2);
  assert.strictEqual(out2[0].technique, undefined, 'off-track stays a straight set');
});

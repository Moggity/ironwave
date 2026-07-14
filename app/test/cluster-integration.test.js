/* ============================================================
   IRONWAVE — test/cluster-integration.test.js
   Cross-cluster revision: A..F together on a simulated bodybuilding routine.
   Guards the interactions between logging (A), drop sets (B), the SFR/head
   model (C), the volume dashboard (D), per-muscle autoreg (E), and the training
   phase (F), and confirms the default/powerbuilding path stays inert.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine } = app;
const DEFAULT_FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };
const slot = ex => ({ type: 'acc', cat: 'bicep', def: ex, ex });

function program(track) {
  app.S = app.defaultState();
  app.S.program = app.makeProgram({
    daysPerWeek: 5, track, timeMode: 'unlimited', muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  });
  return app.S.program;
}
function plainSets(rs) { return rs.sets.filter(s => !s.ramp && !s.amrap && !s.calib).length; }

// ---------------------------------------------------------------------------
// Default path stays inert (every cluster is bodybuilding-gated or additive).
// ---------------------------------------------------------------------------
test('a powerbuilding program is byte-identical with E/F state present but unused', () => {
  const prog = program('powerbuilding');
  prog.days = [{ name: 'Arms', slots: [slot('db-curl')] }];
  app.S.records['db-curl'] = [{ ts: Date.now(), weight: 15, reps: 12, rpe: 8 }];
  const before = JSON.stringify(app.resolveSlot(prog.days[0].slots[0], 0, 1).sets);

  prog.volAdj = { bicep: 2 };          // E offset
  app.S.profile.phase = 'minicut';      // F deficit
  app.S.techniques['db-curl'] = 'drop'; // B opt-in
  const after = JSON.stringify(app.resolveSlot(prog.days[0].slots[0], 0, 1).sets);
  assert.strictEqual(after, before, 'none of E/F/B touch a non-bodybuilding routine');
});

// ---------------------------------------------------------------------------
// A -> E: logged pump + reps drive the per-muscle signal and the offset.
// D <-> E: the dashboard tally reflects the autoreg-added sets, and the loop
// converges (bounded, stops at the window/cap) instead of running away.
// ---------------------------------------------------------------------------
test('a multi-week cycle of good feedback ramps volume up, then converges', () => {
  const prog = program('bodybuilding');
  prog.days = [{ name: 'Arms', slots: [slot('db-curl'), slot('cable-curl')] }];
  for (const ex of ['db-curl', 'cable-curl']) app.S.records[ex] = [{ ts: Date.now(), weight: 15, reps: 12, rpe: 8 }];
  const session = () => ({ skipped: false, ts: Date.now(), entries: ['db-curl', 'cable-curl'].map(ex =>
    ({ exId: ex, sets: [{ done: true, reps: 13, targetReps: 12, pump: 3 }, { done: true, reps: 13, targetReps: 12, pump: 3 }] })) });

  let prev = -1, capped = false;
  for (let week = 0; week < 8; week++) {
    app.S.sessions = [session()];
    app.S.checkins = [{ ts: Date.now(), sliders: { upperpull: 5 } }]; // fresh
    app.updateAutoreg();
    const offset = prog.volAdj.bicep || 0;
    assert.ok(offset >= -2 && offset <= 2, 'offset stays bounded');
    assert.ok(offset >= prev, 'good feedback never reduces volume');
    if (offset === prev) capped = true;
    prev = offset;
  }
  assert.ok(capped, 'the ramp converges rather than running away');

  // The dashboard tally reflects the added sets and never exceeds the per-session cap.
  const tally = app.weeklyVolumeByMuscle();
  const lm = app.VOLUME_LANDMARKS.bicep;
  assert.ok(tally.bicep > 0 && tally.bicep <= 2 * Math.max(1, Math.round(lm.mrv / 2)));
});

// ---------------------------------------------------------------------------
// B <-> E: a drop set and an autoreg add coexist on the same accessory.
// ---------------------------------------------------------------------------
test('autoreg-added volume and a drop set apply together on one accessory', () => {
  const prog = program('bodybuilding');
  prog.pointer.week = 2; // finisher-eligible week; also aligns weeklyVolumeByMuscle (reads the pointer)
  prog.days = [{ name: 'Arms', slots: [slot('db-curl')] }];
  app.S.records['db-curl'] = [{ ts: Date.now(), weight: 15, reps: 12, rpe: 8 }];

  const baseline = plainSets(app.resolveSlot(prog.days[0].slots[0], 0, 2)); // no offset, no technique

  prog.volAdj = { bicep: 1 };           // E: one autoreg-added set
  app.S.techniques['db-curl'] = 'drop'; // B: finish with a drop set
  const rs = app.resolveSlot(prog.days[0].slots[0], 0, 2);
  assert.strictEqual(plainSets(rs), baseline + 1, 'the autoreg add landed');
  assert.strictEqual(rs.sets[rs.sets.length - 1].technique, 'drop', 'the last set became a drop set');
  // That drop set still counts as one working set toward weekly volume.
  assert.ok(app.weeklyVolumeByMuscle().bicep >= baseline + 1);
});

// ---------------------------------------------------------------------------
// F -> E: a deficit phase suppresses adds across the same good-feedback week.
// ---------------------------------------------------------------------------
test('a cut phase holds volume where lean-gain would have added it', () => {
  const prog = program('bodybuilding');
  prog.days = [{ name: 'Arms', slots: [slot('db-curl')] }];
  app.S.records['db-curl'] = [{ ts: Date.now(), weight: 15, reps: 12, rpe: 8 }];
  app.S.sessions = [{ skipped: false, ts: Date.now(),
    entries: [{ exId: 'db-curl', sets: [{ done: true, reps: 14, targetReps: 12, pump: 3 }] }] }];
  app.S.checkins = [{ ts: Date.now(), sliders: { upperpull: 5 } }];

  app.S.profile.phase = 'lean-gain';
  app.updateAutoreg();
  const grew = (prog.volAdj.bicep || 0) > 0;

  prog.volAdj = {};
  app.S.profile.phase = 'cut';
  app.updateAutoreg();
  const heldInCut = (prog.volAdj.bicep || 0) === 0;

  assert.ok(grew && heldInCut, 'lean-gain adds, the cut holds');
});

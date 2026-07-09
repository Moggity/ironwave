/* ============================================================
   IRONWAVE — test/cluster-ef.test.js
   Cluster E auto-application (feedback feeds prescribed set counts) and
   Cluster F (training phase / energy balance).
   - autoregForAccessory + resolveSlot apply P().volAdj, bodybuilding-only and
     inert without feedback (golden master safe).
   - updateAutoreg accumulates the per-muscle offset from a week's feedback.
   - phase modulates the autoregulator; fatigueSaturated flags a minicut.
   Through the existing test/load-app.js harness (no jsdom).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine } = app;
const DEFAULT_FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };
const LM = { mv: 8, mev: 10, mrv: 22 };

function bbProgram(over) {
  app.S = app.defaultState();
  app.S.program = app.makeProgram(Object.assign({
    daysPerWeek: 5, track: 'bodybuilding', timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  }, over));
  return app.S.program;
}
const accSlot = exId => ({ type: 'acc', cat: 'bicep', def: exId, ex: exId });

// ---------------------------------------------------------------------------
// E: auto-application
// ---------------------------------------------------------------------------
test('a positive volAdj adds plain working sets to a bodybuilding accessory', () => {
  const prog = bbProgram();
  prog.days = [{ name: 'Arms', slots: [accSlot('db-curl')] }];
  app.S.records['db-curl'] = [{ ts: Date.now(), weight: 15, reps: 12, rpe: 8 }];

  const base = app.resolveSlot(prog.days[0].slots[0], 0, 1).sets.filter(s => !s.ramp && !s.amrap && !s.calib).length;
  prog.volAdj = { bicep: 2 };
  const bumped = app.resolveSlot(prog.days[0].slots[0], 0, 1).sets.filter(s => !s.ramp && !s.amrap && !s.calib).length;
  assert.strictEqual(bumped, base + 2, 'two extra sets from the offset');
});

test('volAdj is inert off the bodybuilding track and when empty', () => {
  const prog = bbProgram({ track: 'powerbuilding' });
  prog.days = [{ name: 'Arms', slots: [accSlot('db-curl')] }];
  app.S.records['db-curl'] = [{ ts: Date.now(), weight: 15, reps: 12, rpe: 8 }];
  prog.volAdj = { bicep: 2 };
  assert.strictEqual(app.autoregForAccessory('db-curl', [{ reps: 12 }, { reps: 12 }]), 0, 'powerbuilding ignores volAdj');

  bbProgram(); // fresh bodybuilding, no offsets
  assert.strictEqual(app.autoregForAccessory('db-curl', [{ reps: 12 }, { reps: 12 }]), 0, 'empty volAdj is a no-op');
});

test('autoregForAccessory never pushes past the per-session landmark cap', () => {
  const prog = bbProgram();
  prog.volAdj = { bicep: 99 };
  // db-curl is a bicep movement; the cap is round(mrv/2) of the bicep landmark.
  const lm = (app.S.profile.landmarks && app.S.profile.landmarks.bicep) || app.VOLUME_LANDMARKS.bicep;
  const cap = Math.max(1, Math.round(lm.mrv / 2));
  const sets = [{ reps: 12 }, { reps: 12 }];
  assert.strictEqual(app.autoregForAccessory('db-curl', sets), cap - sets.length);
});

// ---------------------------------------------------------------------------
// E: weekly update
// ---------------------------------------------------------------------------
test('updateAutoreg adds volume for a recovered, performing muscle', () => {
  const prog = bbProgram();
  prog.days = [{ name: 'Arms', slots: [accSlot('db-curl')] }];
  app.S.records['db-curl'] = [{ ts: Date.now(), weight: 15, reps: 12, rpe: 8 }];
  app.S.sessions = [{ skipped: false, ts: Date.now(),
    entries: [{ exId: 'db-curl', sets: [
      { done: true, reps: 14, targetReps: 12, pump: 3 }, { done: true, reps: 13, targetReps: 12, pump: 3 }] }] }];
  app.S.checkins = [{ ts: Date.now(), sliders: { upperpull: 5 } }]; // bicep -> upperpull, fresh
  app.updateAutoreg();
  assert.ok(prog.volAdj.bicep > 0, 'recovered + performing -> add');
});

test('updateAutoreg cuts volume for a wrecked, in-window muscle', () => {
  const slot = ex => ({ type: 'acc', cat: 'bicep', def: ex, ex });
  const prog = bbProgram();
  // Three bicep slots put the muscle solidly in its productive window so a cut bites.
  prog.days = [{ name: 'Arms', slots: [slot('db-curl'), slot('cable-curl'), slot('bb-curl')] }];
  const sets = ex => ({ exId: ex, sets: [{ done: true, reps: 12, targetReps: 12 }, { done: true, reps: 12, targetReps: 12 }] });
  for (const ex of ['db-curl', 'cable-curl', 'bb-curl']) app.S.records[ex] = [{ ts: Date.now(), weight: 15, reps: 12, rpe: 8 }];
  app.S.sessions = [{ skipped: false, ts: Date.now(), entries: ['db-curl', 'cable-curl', 'bb-curl'].map(sets) }];
  app.S.checkins = [{ ts: Date.now(), sliders: { upperpull: 1 } }]; // wrecked
  app.updateAutoreg();
  assert.ok(prog.volAdj.bicep < 0, 'wrecked -> cut');
});

test('updateAutoreg is a no-op off the bodybuilding track', () => {
  const prog = bbProgram({ track: 'powerbuilding' });
  app.S.sessions = [{ skipped: false, ts: Date.now(),
    entries: [{ exId: 'db-curl', sets: [{ done: true, reps: 14, targetReps: 12 }] }] }];
  app.updateAutoreg();
  assert.deepStrictEqual(prog.volAdj, {});
});

// ---------------------------------------------------------------------------
// F: phase modulation + minicut
// ---------------------------------------------------------------------------
test('a deficit phase holds volume instead of adding, and cuts one notch sooner', () => {
  const good = { recovery: 5, performance: 1 };
  assert.strictEqual(Engine.autoregVolume(good, 14, LM, 'lean-gain').action, 'add');
  assert.strictEqual(Engine.autoregVolume(good, 14, LM, 'cut').action, 'hold', 'no adds in a deficit');
  // recovery 3 cuts in a deficit (cutRec 3) but only holds at maintenance.
  assert.strictEqual(Engine.autoregVolume({ recovery: 3, performance: 0 }, 16, LM, 'minicut').action, 'cut');
  assert.strictEqual(Engine.autoregVolume({ recovery: 3, performance: 0 }, 16, LM, 'lean-gain').action, 'hold');
});

test('fatigueSaturated flags when enough muscles sit at or near MRV', () => {
  const near = { key: 'productive', pct: 95 };
  const over = { key: 'over', pct: 100 };
  const mid = { key: 'productive', pct: 60 };
  assert.strictEqual(Engine.fatigueSaturated([near, over, mid]).saturated, false); // 2 < 3
  assert.strictEqual(Engine.fatigueSaturated([near, over, near]).saturated, true);  // 3
  assert.strictEqual(Engine.fatigueSaturated([], 3).over, 0);
});

test('phase state defaults to lean-gain and is not a deficit', () => {
  app.S = app.defaultState();
  assert.strictEqual(app.currentPhase(), 'lean-gain');
  assert.ok(!app.PHASE_DEFICIT['lean-gain'] && !app.PHASE_DEFICIT['maintenance']);
  assert.ok(app.PHASE_DEFICIT['cut'] && app.PHASE_DEFICIT['minicut']);
  assert.ok(app.PHASES.includes('minicut'));
  assert.strictEqual(app.t('phase.minicut'), 'Minicut');
});

/* ============================================================
   IRONWAVE — test/cluster-e.test.js
   Cluster E / Epic 1, first slice: per-muscle volume autoregulation.
   - Engine.autoregVolume: our own add / hold / cut decision from a seeded
     feedback signal vs the muscle's landmarks (pure, deterministic).
   - muscleSignal derives recovery (check-in) + performance + pump from data
     already captured.
   This slice RECOMMENDS only (no prescription change), so the golden master is
   untouched. Through the existing test/load-app.js harness (no jsdom).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine } = app;

const LM = { mv: 8, mev: 10, mrv: 22 };

// ---------------------------------------------------------------------------
// Engine.autoregVolume
// ---------------------------------------------------------------------------
test('below MEV with decent recovery ramps the volume in', () => {
  const r = Engine.autoregVolume({ recovery: 4, performance: 0 }, 6, LM);
  assert.strictEqual(r.action, 'add');
  assert.ok(r.delta >= 1);
});

test('recovered well inside the window adds one set', () => {
  const r = Engine.autoregVolume({ recovery: 5, performance: 1 }, 14, LM);
  assert.deepStrictEqual({ action: r.action, delta: r.delta }, { action: 'add', delta: 1 });
});

test('poor recovery or dropping reps backs the volume off', () => {
  assert.strictEqual(Engine.autoregVolume({ recovery: 2, performance: 0 }, 16, LM).action, 'cut');
  assert.strictEqual(Engine.autoregVolume({ recovery: 4, performance: -1 }, 16, LM).action, 'cut');
});

test('at MRV it holds rather than adding past the ceiling', () => {
  const r = Engine.autoregVolume({ recovery: 5, performance: 1 }, 22, LM);
  assert.strictEqual(r.action, 'hold');
  assert.strictEqual(r.nextSets, 22);
});

test('a clamp never pushes a muscle outside [mv, mrv]', () => {
  // Recovered + tiny window: adding stays at or below MRV.
  for (const sets of [8, 12, 18, 22]) {
    const r = Engine.autoregVolume({ recovery: 5, performance: 1 }, sets, LM);
    assert.ok(r.nextSets >= LM.mv && r.nextSets <= LM.mrv, `nextSets in range for ${sets}`);
  }
  // A cut never drops below maintenance volume.
  assert.ok(Engine.autoregVolume({ recovery: 1, performance: -1 }, 9, LM).nextSets >= LM.mv);
});

test('missing signal fields default to a neutral hold-ish read', () => {
  const r = Engine.autoregVolume({}, 14, LM); // rec=3, perf=0
  assert.strictEqual(r.action, 'hold');
  assert.deepStrictEqual(Engine.autoregVolume({}, 14, null),
    { action: 'hold', delta: 0, nextSets: 14, reason: 'No landmark yet' });
});

// ---------------------------------------------------------------------------
// muscleSignal derivation
// ---------------------------------------------------------------------------
test('checkinGroupForMovement maps muscles to the right check-in group', () => {
  assert.strictEqual(app.checkinGroupForMovement('chest'), 'bench');
  assert.strictEqual(app.checkinGroupForMovement('quad'), 'squat');
  assert.strictEqual(app.checkinGroupForMovement('bicep'), 'upperpull');
  assert.strictEqual(app.checkinGroupForMovement('unknown'), null);
});

test('muscleSignal reads recovery, performance and pump from captured data', () => {
  app.S = app.defaultState();
  // A chest is trained via cable-fly (movement "chest"): reps over target, big pump.
  app.S.sessions = [{
    skipped: false, ts: Date.now(),
    entries: [{ exId: 'cable-fly', sets: [
      { done: true, reps: 14, targetReps: 12, pump: 3 },
      { done: true, reps: 13, targetReps: 12, pump: 3 },
      { ramp: true, done: true, reps: 5, targetReps: 5 }, // warmup ignored
    ] }],
  }];
  app.S.checkins = [{ ts: Date.now(), sliders: { bench: 5 } }]; // chest -> bench group, fresh
  const sig = app.muscleSignal('chest');
  assert.strictEqual(sig.recovery, 5);
  assert.strictEqual(sig.performance, 1, 'reps over target -> +1');
  assert.strictEqual(sig.pump, 3);
  // Feeding it forward: fresh + over-performing inside the window -> add.
  assert.strictEqual(Engine.autoregVolume(sig, 14, LM).action, 'add');
});

test('muscleSignal is null for a muscle with no logged session', () => {
  app.S = app.defaultState();
  app.S.sessions = [];
  assert.strictEqual(app.muscleSignal('chest'), null);
});

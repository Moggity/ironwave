/* ============================================================
   IRONWAVE — test/bodyweight-tonnage.test.js
   Bodyweight counted in tonnage for bodyweight-mode ('bw') exercises:
   - Engine.tonnage: the optional per-set `bw` field adds bodyweight to
     every rep (and to each drop mini-set); absent bw is byte-identical.
   - Logging path: donePerf freezes S.profile.bodyweight into st.bw and
     the pushed record when the perf-modal toggle (PM.bwCount, default
     on) is active; weight stays ADDED load only, so e1RM is untouched.
   ============================================================ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine } = app;

// ---------------------------------------------------------------------------
// Engine.tonnage
// ---------------------------------------------------------------------------
test('tonnage without bw fields is unchanged (identity contract)', () => {
  const entries = [{ sets: [
    { done: true, weight: 100, reps: 10 },
    { done: true, weight: 100, reps: 10 },
    { done: true, weight: 100, reps: 10 },
  ] }];
  assert.strictEqual(Engine.tonnage(entries), 3000);
});

test('tonnage counts bodyweight plus added load per rep', () => {
  // The reported case: 3 sets of calf raises, bodyweight 77 kg + 10 kg added.
  const entries = [{ sets: [
    { done: true, weight: 10, bw: 77, reps: 10 },
    { done: true, weight: 10, bw: 77, reps: 10 },
    { done: true, weight: 10, bw: 77, reps: 10 },
  ] }];
  assert.strictEqual(Engine.tonnage(entries), 87 * 10 * 3); // 2610
});

test('a pure bodyweight set (added weight 0) now produces tonnage', () => {
  const entries = [{ sets: [{ done: true, weight: 0, bw: 77, reps: 10 }] }];
  assert.strictEqual(Engine.tonnage(entries), 770);
});

test('drop mini-sets ride the parent set bodyweight', () => {
  const entries = [{ sets: [
    { done: true, weight: 10, bw: 77, reps: 10, drops: [{ weight: 5, reps: 8 }] },
  ] }];
  assert.strictEqual(Engine.tonnage(entries), 87 * 10 + 82 * 8); // 1526
});

test('an unlogged set contributes nothing even with bw', () => {
  const entries = [{ sets: [
    { done: false, weight: 10, bw: 77, reps: 10 },
    { done: false, skipped: true, weight: null, bw: 77, reps: null },
  ] }];
  assert.strictEqual(Engine.tonnage(entries), 0);
});

test('a non-bw drop set still totals exactly as before', () => {
  // Mirror of cluster-b.test.js: 1000 + 640 + 384.
  const entries = [{ sets: [
    { done: true, weight: 100, reps: 10, drops: [{ weight: 80, reps: 8 }, { weight: 64, reps: 6 }] },
  ] }];
  assert.strictEqual(Engine.tonnage(entries), 2024);
});

test('volumeLoadTrend counts the optional bw field on records', () => {
  const ts = Date.now() - 3600e3;
  const recs = [
    { ts, weight: 10, reps: 10, rpe: 8, bw: 77 },
    { ts: ts + 60e3, weight: 10, reps: 10, rpe: 8 },
  ];
  const trend = Engine.volumeLoadTrend(recs);
  assert.strictEqual(trend.length, 1);
  assert.strictEqual(trend[0].value, 87 * 10 + 10 * 10);
});

// ---------------------------------------------------------------------------
// Logging path (donePerf / clearPerf / skipSet via the load-app harness)
// ---------------------------------------------------------------------------
// `ramp: true` is deliberate: a ramp set never arms the rest timer, so the
// node:test process is not kept alive by a setInterval.
function installDraft(exId) {
  const st = { targetReps: 10, targetRpe: 8, ramp: true,
               weight: null, reps: null, rpe: null, drops: null, done: false };
  const entry = { exId, name: 'Pull-up', isMain: false, si: 0, sets: [st], notes: '' };
  app.V = { view: 'session', draft: { entries: [entry], b: 0, w: 0, d: 0 } };
  return st;
}
function pmFor(overrides) {
  return Object.assign({ ei: 0, si: 0, weight: 10, reps: 10, rpe: 8,
                         pump: null, tech: null, drops: null, bwCount: true }, overrides);
}

test('donePerf freezes bodyweight into the set and the record, weight stays added load', () => {
  app.S = app.defaultState();
  app.S.profile.bodyweight = 77;
  const st = installDraft('pullup');
  app.PM = pmFor({});
  app.donePerf();
  assert.strictEqual(st.done, true);
  assert.strictEqual(st.bw, 77);
  assert.strictEqual(st.weight, 10);
  const recs = app.recordsFor('pullup');
  assert.strictEqual(recs.length, 1);
  assert.strictEqual(recs[0].bw, 77);
  assert.strictEqual(recs[0].weight, 10); // e1RM keeps seeing added load only
});

test('toggle off: re-logging the set removes bw from set and record', () => {
  app.S = app.defaultState();
  app.S.profile.bodyweight = 77;
  const st = installDraft('pullup');
  app.PM = pmFor({});
  app.donePerf();
  assert.strictEqual(st.bw, 77);
  app.PM = pmFor({ bwCount: false });
  app.donePerf();
  assert.strictEqual('bw' in st, false);
  const recs = app.recordsFor('pullup');
  assert.strictEqual('bw' in recs[recs.length - 1], false);
});

test('no bodyweight on file: nothing is written even with the toggle on', () => {
  app.S = app.defaultState();
  app.S.profile.bodyweight = null;
  const st = installDraft('pullup');
  app.PM = pmFor({});
  app.donePerf();
  assert.strictEqual('bw' in st, false);
  assert.strictEqual('bw' in app.recordsFor('pullup')[0], false);
});

test('a non-bodyweight lift never writes bw', () => {
  app.S = app.defaultState();
  app.S.profile.bodyweight = 77;
  const st = installDraft('comp-bench'); // barbell
  app.PM = pmFor({});
  app.donePerf();
  assert.strictEqual('bw' in st, false);
});

test('clearPerf and skipSet drop a previously frozen bw', () => {
  app.S = app.defaultState();
  app.S.profile.bodyweight = 77;
  const st = installDraft('pullup');
  app.PM = pmFor({});
  app.donePerf();
  assert.strictEqual(st.bw, 77);
  app.PM = pmFor({});
  app.clearPerf();
  assert.strictEqual('bw' in st, false);
  app.PM = pmFor({});
  app.donePerf();
  assert.strictEqual(st.bw, 77);
  app.PM = pmFor({});
  app.skipSet();
  assert.strictEqual('bw' in st, false);
  assert.strictEqual(st.skipped, true);
});

test('pmBw toggles the modal state; openPerf defaults on and restores a logged set', () => {
  app.S = app.defaultState();
  app.S.profile.bodyweight = 77;
  const st = installDraft('pullup');
  app.openPerf(0, 0);
  assert.strictEqual(app.PM.bwCount, true); // fresh set: counted by default
  app.pmBw();
  assert.strictEqual(app.PM.bwCount, false);
  app.pmBw();
  assert.strictEqual(app.PM.bwCount, true);
  app.PM = pmFor({ bwCount: false });
  app.donePerf();
  app.openPerf(0, 0);
  assert.strictEqual(app.PM.bwCount, false); // reopening restores what was stored
  assert.strictEqual('bw' in st, false);
});

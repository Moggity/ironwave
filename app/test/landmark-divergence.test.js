/* ============================================================
   IRONWAVE — test/landmark-divergence.test.js
   [B1 / SS1] The volume-table replacement contract. VOLUME_LANDMARKS
   is the OUTPUT of our own parametric model (data.js LANDMARK_TRAITS:
   need class -> MEV, recovery class -> MRV span, MV = 0.6 x MEV, all
   snapped to a 2-set grid). This file pins three things:
   1. DIVERGENCE: no muscle's (mv, mev, mrv) triple equals the retired
      external seed the app used to ship. This is the legal-report
      item 6 acceptance criterion, promoted to a beta gate (CYN4).
   2. DERIVATION: every value is reproducible from the trait tables,
      so a future edit that hand-tweaks a number without going through
      the model gets caught.
   3. CONSENSUS BOUNDS: every value stays inside the multi-source
      dose-response reading (a handful of sets maintains, ~8-12 grows,
      past ~20-25 returns diminish), so the model stays defensible.
   Plus the [B1] recalibration acceleration: with strong evidence the
   block-end step is 2, so athlete data dominates the seed quickly.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine, VOLUME_LANDMARKS } = app;

// The retired external seed, kept here ONLY as the divergence baseline.
// Never ship these triples again.
const RETIRED_SEED = {
  chest:     { mv: 8, mev: 10, mrv: 22 },
  vpull:     { mv: 8, mev: 10, mrv: 25 },
  hpull:     { mv: 8, mev: 10, mrv: 25 },
  upperback: { mv: 8, mev: 10, mrv: 25 },
  quad:      { mv: 6, mev: 8,  mrv: 20 },
  ham:       { mv: 4, mev: 6,  mrv: 20 },
  glute:     { mv: 0, mev: 0,  mrv: 16 },
  bicep:     { mv: 4, mev: 8,  mrv: 26 },
  tricep:    { mv: 4, mev: 6,  mrv: 18 },
  shoulder:  { mv: 6, mev: 8,  mrv: 26 },
  calf:      { mv: 6, mev: 8,  mrv: 20 },
  abs:       { mv: 0, mev: 0,  mrv: 25 },
  lowback:   { mv: 0, mev: 0,  mrv: 12 },
};

test('divergence: no muscle triple equals the retired external seed', () => {
  assert.deepStrictEqual(Object.keys(VOLUME_LANDMARKS).sort(), Object.keys(RETIRED_SEED).sort(),
    'same muscle set as before (consumers key on these)');
  for (const m in RETIRED_SEED) {
    const ours = VOLUME_LANDMARKS[m], theirs = RETIRED_SEED[m];
    assert.ok(ours.mv !== theirs.mv || ours.mev !== theirs.mev || ours.mrv !== theirs.mrv,
      `${m}: (${ours.mv}, ${ours.mev}, ${ours.mrv}) must not reproduce the retired triple`);
  }
});

test('derivation: every value is the model output, on the 2-set grid', () => {
  const NEED = { high: 10, moderate: 8, low: 6, covered: 0 };
  const SPAN = { fast: 14, medium: 12, slow: 10 };
  const snap2 = x => 2 * Math.round(x / 2);
  const spans = new Set(Object.values(SPAN));
  for (const m in VOLUME_LANDMARKS) {
    const L = VOLUME_LANDMARKS[m];
    assert.ok(Object.values(NEED).includes(L.mev), `${m}: MEV ${L.mev} comes from a need class`);
    assert.ok(spans.has(L.mrv - L.mev), `${m}: span ${L.mrv - L.mev} comes from a recovery class`);
    assert.strictEqual(L.mv, snap2(L.mev * 0.6), `${m}: MV is 0.6 x MEV snapped`);
    for (const k of ['mv', 'mev', 'mrv']) {
      assert.strictEqual(L[k] % 2, 0, `${m}.${k} sits on the 2-set grid`);
    }
  }
  // MEV 0 stays reserved for muscles the compounds already cover weekly.
  for (const m of ['glute', 'abs', 'lowback']) {
    assert.strictEqual(VOLUME_LANDMARKS[m].mev, 0, `${m}: covered, MEV 0`);
  }
  for (const m of ['chest', 'vpull', 'hpull', 'upperback', 'quad', 'ham', 'bicep', 'tricep', 'shoulder', 'calf']) {
    assert.ok(VOLUME_LANDMARKS[m].mev > 0, `${m}: directly trained, MEV > 0`);
  }
});

test('consensus bounds: the model lands inside the dose-response reading', () => {
  for (const m in VOLUME_LANDMARKS) {
    const L = VOLUME_LANDMARKS[m];
    assert.ok(L.mv <= L.mev, `${m}: mv <= mev`);
    assert.ok(L.mrv > L.mev, `${m}: mrv > mev`);
    assert.ok(L.mev <= 12, `${m}: MEV ${L.mev} within the growth-default band`);
    assert.ok(L.mrv >= 10 && L.mrv <= 25, `${m}: MRV ${L.mrv} inside diminishing-returns bounds`);
  }
});

// ---------------------------------------------------------------------------
// [B1] Recalibration acceleration: strong evidence moves a landmark 2 sets.
// ---------------------------------------------------------------------------
const FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };
function withProgram() {
  const s = app.defaultState();
  app.S = s;
  s.profile.landmarks = Engine.seedLandmarks('intermediate');
  s.program = app.makeProgram({ daysPerWeek: 4, track: 'bodybuilding',
    experience: 'intermediate', timeMode: 'unlimited', muscleFocus: { ...FOCUS }, maxes: {} });
  return s;
}
// A logged, scoring working set (done, targeted, not warmup/calibration/AMRAP).
const scored = (rpe, targetRpe) => ({ done: true, ramp: false, calib: false, reps: 10, rpe, targetRpe });
const chestSession = (w, nSets, rpe, target) => ({ b: 0, w, ts: w + 1, entries: [
  { exId: 'db-fly', sets: Array.from({ length: nSets }, () => scored(rpe, target)) },
] });

test('recalibrate: tolerated volume near the ceiling raises MRV by 2', () => {
  const s = withProgram();
  s.profile.landmarks.chest = { mv: 4, mev: 6, mrv: 8 };
  // 7 scoring chest sets in one week, easier than target, peak 7 >= mrv - 2.
  s.sessions = [chestSession(0, 7, 7, 8)];
  app.recalibrateLandmarks(0);
  assert.strictEqual(s.profile.landmarks.chest.mrv, 10, 'strong signal: +2');
});

test('recalibrate: tolerance far from the ceiling no longer moves it (SS6)', () => {
  const s = withProgram();
  s.profile.landmarks.chest = { mv: 4, mev: 6, mrv: 18 };
  // 7 scoring sets, all easy, but the athlete never trained near 18 weekly
  // sets: tolerating low volume says nothing about the ceiling.
  s.sessions = [chestSession(0, 7, 7, 8)];
  app.recalibrateLandmarks(0);
  assert.strictEqual(s.profile.landmarks.chest.mrv, 18, 'evidence-gated: unchanged');
});

test('recalibrate: near the ceiling with few scoring sets raises by 1 (SS6 + B1)', () => {
  const s = withProgram();
  s.profile.landmarks.chest = { mv: 2, mev: 3, mrv: 5 };
  // 4 scoring sets (>= 3 so a move happens, < 6 so the step stays small),
  // peak 4 within 2 of the 5-set ceiling: evidence present, weak signal.
  s.sessions = [chestSession(0, 4, 7, 8)];
  app.recalibrateLandmarks(0);
  assert.strictEqual(s.profile.landmarks.chest.mrv, 6, 'evidence + weak signal: +1');
});

test('recalibrate: overreached near the ceiling backs MRV off by 2', () => {
  const s = withProgram();
  s.profile.landmarks.chest = { mv: 4, mev: 6, mrv: 8 };
  // Harder than target (delta >= 1) with strong evidence: -2, floored at mev+1.
  s.sessions = [chestSession(0, 7, 9, 8)];
  app.recalibrateLandmarks(0);
  assert.strictEqual(s.profile.landmarks.chest.mrv, 7, 'strong signal: -2, floored at mev + 1 = 7');
});

test('recalibrate: few sets AND far from the ceiling moves nothing (SS6)', () => {
  const s = withProgram();
  s.profile.landmarks.chest = { mv: 4, mev: 6, mrv: 8 };
  // 4 easy scoring sets with a peak week of 4, well under mrv - 2: no
  // evidence the 8-set ceiling was ever tested, so it stays put.
  s.sessions = [chestSession(0, 4, 7, 8)];
  app.recalibrateLandmarks(0);
  assert.strictEqual(s.profile.landmarks.chest.mrv, 8, 'no evidence: unchanged');
});

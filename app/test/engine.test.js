/* ============================================================
   IRONWAVE — test/engine.test.js
   Pure-engine unit tests (future-work testing item 2). The math in
   engine.js is where correctness matters and is deterministic, so it
   is asserted directly: e1rm/RPE, weightFor round-trip, rounding,
   amrapAdjust (the +10-rep cap and the below-standard hold),
   plateMath, warmupSets, readinessScore, seedLandmarks, and the
   per-week ramps of prescribeMain and the jbb-hyp scheme for both a
   calibrated and an uncalibrated lift.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine, WAVES, DEFAULT_PLATES, VOLUME_LANDMARKS, EXPERIENCE_FACTOR, TIME_MODEL, JBB_HYP } = app;

// Float helper: engine weights/scores are real-valued.
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('e1rm: Epley + reps-in-reserve', () => {
  // rir = 10 - rpe; e1rm = weight * (1 + (reps + rir) / 30)
  assert.ok(near(Engine.e1rm(100, 5, 10), 100 * (1 + 5 / 30)));
  assert.ok(near(Engine.e1rm(100, 5, 8), 100 * (1 + 7 / 30)));   // 2 reps in reserve
  // A true single at RPE 10 is the e1RM itself (totalReps <= 1 short-circuit).
  assert.strictEqual(Engine.e1rm(140, 1, 10), 140);
  // More reps (or more in reserve) => higher estimate.
  assert.ok(Engine.e1rm(100, 6, 10) > Engine.e1rm(100, 5, 10));
  assert.ok(Engine.e1rm(100, 5, 7) > Engine.e1rm(100, 5, 8));
});

test('weightFor: inverse of e1rm, then rounded', () => {
  // Round-trip at fine rounding recovers the input weight.
  const e1 = Engine.e1rm(102.5, 5, 8);
  assert.ok(near(Engine.weightFor(e1, 5, 8, 0.0001), 102.5, 1e-3));
  // Heavier target reps/RPE => more load off the same e1RM.
  assert.ok(Engine.weightFor(e1, 3, 9, 0.0001) > Engine.weightFor(e1, 8, 7, 0.0001));
});

test('roundLoad: nearest multiple, default 2.5', () => {
  assert.strictEqual(Engine.roundLoad(101), 100);        // default rounding 2.5
  assert.strictEqual(Engine.roundLoad(101.25, 2.5), 102.5);
  assert.strictEqual(Engine.roundLoad(103.7, 2.5), 102.5);
  assert.strictEqual(Engine.roundLoad(52, 5), 50);
  assert.strictEqual(Engine.roundLoad(50, 5), 50);
});

test('amrapAdjust: working-max progression, +10-rep cap, holds', () => {
  // Reps over standard move the working max by increment/rep.
  let r = Engine.amrapAdjust(100, 13, 10, 1.25);
  assert.strictEqual(r.newWM, 103.75);
  assert.strictEqual(r.delta, 3.75);
  assert.strictEqual(r.capped, false);

  // More than +10 over standard is capped at 10 reps of credit.
  r = Engine.amrapAdjust(100, 25, 10, 1.25);
  assert.strictEqual(r.delta, 10 * 1.25);
  assert.strictEqual(r.newWM, 112.5);
  assert.strictEqual(r.capped, true);

  // Exactly standard: held, not advanced.
  r = Engine.amrapAdjust(100, 10, 10, 1.25);
  assert.strictEqual(r.newWM, 100);
  assert.strictEqual(r.delta, 0);
  assert.match(r.msg, /held/);

  // Below standard: held, with the recovery hint.
  r = Engine.amrapAdjust(100, 7, 10, 1.25);
  assert.strictEqual(r.newWM, 100);
  assert.match(r.msg, /Below standard/);
});

test('defaultIncrement: lower body heavier per rep than upper', () => {
  assert.strictEqual(Engine.defaultIncrement('comp-squat'), 2.5);
  assert.strictEqual(Engine.defaultIncrement('comp-deadlift'), 2.5);
  assert.strictEqual(Engine.defaultIncrement('comp-bench'), 1.25);
  assert.strictEqual(Engine.defaultIncrement('military-press'), 1.25);
});

test('plateMath: greedy per-side breakdown over the default inventory', () => {
  // 60 over a 20 bar => 20/side => one 20.
  let m = Engine.plateMath(60, 20, DEFAULT_PLATES);
  assert.deepStrictEqual(m.plates.map(p => p.w), [20]);
  assert.strictEqual(m.achieved, 60);
  assert.strictEqual(m.perSide, 20);

  // 100 over a 20 bar => 40/side => 25 + 15.
  m = Engine.plateMath(100, 20, DEFAULT_PLATES);
  assert.deepStrictEqual(m.plates.map(p => p.w), [25, 15]);
  assert.strictEqual(m.achieved, 100);

  // Bar only: nothing loaded.
  m = Engine.plateMath(20, 20, DEFAULT_PLATES);
  assert.deepStrictEqual(m.plates, []);
  assert.strictEqual(m.achieved, 20);

  // Unreachable exact total: report what was actually achieved, never overshoot.
  m = Engine.plateMath(61, 20, DEFAULT_PLATES);
  assert.strictEqual(m.achieved, 60);
  assert.ok(m.achieved <= 61);
});

test('warmupSets: ascending ramp from the bar, below the top set', () => {
  const sets = Engine.warmupSets(100, 20, 2.5);
  assert.deepStrictEqual(sets.map(s => s.weight), [20, 40, 60, 80, 90]);
  assert.strictEqual(sets[0].reps, 10); // empty-bar set is high-rep

  // A top at or below the bar needs no warmup.
  assert.deepStrictEqual(Engine.warmupSets(20, 20, 2.5), []);

  // Strictly increasing and always under the top weight; collisions de-duped.
  const w = Engine.warmupSets(30, 20, 2.5).map(s => s.weight);
  for (let i = 1; i < w.length; i++) assert.ok(w[i] > w[i - 1]);
  assert.ok(w.every(x => x < 30));
});

test('restSecFor: prescribed rest per kind, tight table, safe fallback', () => {
  // Pulls the real prescription the session estimate uses, by kind.
  assert.strictEqual(Engine.restSecFor('main', false, TIME_MODEL), TIME_MODEL.restSec.main);
  assert.strictEqual(Engine.restSecFor('accessory', false, TIME_MODEL), TIME_MODEL.restSec.accessory);
  // A time-capped athlete rests on the compressed table; it is shorter.
  assert.strictEqual(Engine.restSecFor('main', true, TIME_MODEL), TIME_MODEL.restSecTight.main);
  assert.ok(Engine.restSecFor('main', true, TIME_MODEL) < Engine.restSecFor('main', false, TIME_MODEL));
  // Unknown kind never returns NaN; it falls back to the accessory value.
  assert.strictEqual(Engine.restSecFor('mystery', false, TIME_MODEL), TIME_MODEL.restSec.accessory);
});

test('readinessScore: composite, clamped to 0..30', () => {
  // All-defaults (only sleep given): sleep 6.667 + sliders 6 + rec 4 + acc 3 = 19.667.
  const base = Engine.readinessScore({ sleepHours: 7.5 });
  assert.ok(near(base, 7.5 / 9 * 8 + 6 + 4 + 3, 1e-9));

  // A maximal day clamps at 30, not above.
  const top = Engine.readinessScore({
    sleepHours: 9, sliderAvg: 5, lastSessionRating: 5, rpeDeviation: 0, streak: 5,
  });
  assert.strictEqual(top, 30);

  // A skip penalty lowers the score and never drops below 0.
  const penalized = Engine.readinessScore({ sleepHours: 7.5, skipPenalty: 100 });
  assert.strictEqual(penalized, 0);
});

test('seedLandmarks: derived grid scaled by experience, invariants preserved', () => {
  const L = Engine.seedLandmarks('intermediate');
  const f = EXPERIENCE_FACTOR.intermediate;

  // chest 6/10/22 * 0.85 => 5 / 9 / 19.
  assert.deepStrictEqual(L.chest, { mv: 5, mev: 9, mrv: 19 });

  // glute has MEV 0; that floor is preserved (not pushed up to mv).
  assert.strictEqual(L.glute.mev, 0);
  assert.strictEqual(L.glute.mv, 0);

  // Invariants across every muscle: mv <= mev and mrv > mev.
  for (const m of Object.keys(VOLUME_LANDMARKS)) {
    assert.ok(L[m].mev >= L[m].mv, `${m}: mev >= mv`);
    assert.ok(L[m].mrv >= L[m].mev + 1, `${m}: mrv > mev`);
    assert.ok(near(L[m].mv, Math.round(VOLUME_LANDMARKS[m].mv * f)), `${m}: mv scaled`);
  }

  // An unknown experience falls back to the intermediate factor (0.85).
  assert.deepStrictEqual(Engine.seedLandmarks('unknown-tier'), L);
});

test('landmarkStep: 2 only on strong evidence, else 1', () => {
  // Strong: >= 6 scoring sets AND a peak week within 2 sets of the ceiling.
  assert.strictEqual(Engine.landmarkStep(6, 18, 20), 2);
  assert.strictEqual(Engine.landmarkStep(9, 20, 20), 2);
  // Enough sets but the ceiling was never approached: normal nudge.
  assert.strictEqual(Engine.landmarkStep(9, 10, 20), 1);
  // Peak at the ceiling but too few scoring sets: normal nudge.
  assert.strictEqual(Engine.landmarkStep(5, 20, 20), 1);
  assert.strictEqual(Engine.landmarkStep(0, 0, 20), 1);
});

test('prescribeMain ramp: jm2 accumulation vs intro, calibrated and not', () => {
  const W = WAVES['5s'];
  const wm = 100;

  // Accumulation (week 1): acc.sets sets at acc.pct, last set the hard one.
  const acc = Engine.prescribeMain('5s', 1, wm, 2.5);
  assert.strictEqual(acc.length, W.acc.sets);
  assert.ok(acc.every(s => s.reps === W.acc.reps));
  assert.ok(acc.every(s => near(s.weight, Engine.roundLoad(wm * W.acc.pct, 2.5))));
  assert.strictEqual(acc[acc.length - 1].rpe, 8);
  assert.strictEqual(acc[0].rpe, 7);

  // Intro (week 0) is lighter than accumulation by the 2.5% backoff.
  const intro = Engine.prescribeMain('5s', 0, wm, 2.5);
  assert.ok(intro[0].weight < acc[0].weight);
  assert.ok(intro.every(s => s.rpe === 7));

  // Realization (week 3) ends in an AMRAP at the standard reps.
  const real = Engine.prescribeMain('5s', 3, wm, 2.5);
  const amrap = real[real.length - 1];
  assert.strictEqual(amrap.amrap, true);
  assert.strictEqual(amrap.reps, W.standard);

  // No working max yet => a 3-set calibration ramp, no prescribed weights.
  const calib = Engine.prescribeMain('5s', 1, null, 2.5);
  assert.strictEqual(calib.length, 3);
  assert.ok(calib.every(s => s.calib === true && s.weight === undefined));
});

test('calibrationRamp: descending reps floored at 3, RIR 4/3/2, beginner cap', () => {
  // RIR-led (rir = 10 - rpe): 4 / 3 / 2 by default, reps descend R, R-2, R-4.
  const acc = Engine.calibrationRamp(12, 'intermediate');
  assert.deepStrictEqual(acc.map(s => s.reps), [12, 10, 8]);
  assert.deepStrictEqual(acc.map(s => s.rpe), [6, 7, 8]); // RIR 4 / 3 / 2
  assert.ok(acc.every(s => s.calib === true && s.weight === undefined));

  // Reps never drop below 3, so a strength wave does not calibrate on a single.
  assert.deepStrictEqual(Engine.calibrationRamp(5, 'intermediate').map(s => s.reps), [5, 3, 3]);

  // Beginners stop at RIR 3 (top-set RPE 7), never close to failure on a guess.
  const beg = Engine.calibrationRamp(12, 'beginner');
  assert.deepStrictEqual(beg.map(s => s.rpe), [6, 7, 7]); // RIR 4 / 3 / 3

  // Routed by every prescribe* path: main/secondary/accessory all use it.
  assert.deepStrictEqual(Engine.prescribeAccessory('hypertrophy', 1, [], 2.5, 'intermediate').map(s => s.reps), [12, 10, 8]);
  assert.deepStrictEqual(Engine.prescribeSecondary('hypertrophy', 1, null, 2.5, 1, 'intermediate').map(s => s.reps), [5, 3, 3]);
});

test('anchorE1RM: rep-proximity anchor for prescriptions', () => {
  const now = Date.now();
  const oneRM = { ts: now, weight: 90, reps: 1, rpe: 10, seed: true };
  const tenRM = { ts: now, weight: 60, reps: 10, rpe: 10, seed: true };

  // The endurance-poor athlete: the 1RM implies e1 = 90, the 10RM implies 80.
  // A 12-rep prescription anchors on the stated 10RM, not the extrapolated 1RM.
  assert.ok(near(Engine.anchorE1RM([oneRM, tenRM], 12), Engine.e1rm(60, 10, 10)));
  // A low-rep target anchors on the 1RM (the close record).
  assert.ok(near(Engine.anchorE1RM([oneRM, tenRM], 3), 90));
  // Nothing close to the target: falls back to the bestE1RM behavior (max).
  assert.ok(near(Engine.anchorE1RM([oneRM], 12), Engine.bestE1RM([oneRM])));
  // Same recency window as bestE1RM: stale and empty inputs return null.
  assert.strictEqual(Engine.anchorE1RM([], 12), null);
  assert.strictEqual(Engine.anchorE1RM([{ ts: now - 200 * 864e5, weight: 60, reps: 10, rpe: 10 }], 12), null);

  // End to end: with both maxes on record, a 12-rep accessory prescription
  // stays below the stated 10RM (it used to land at or above it).
  const sets = Engine.prescribeAccessory('hypertrophy', 1, [oneRM, tenRM], 2.5, 'intermediate');
  assert.ok(sets.every(s => s.weight < 60), 'never at or above the athlete\'s 10RM');
});

test('jbb-hyp secondary: RIR-anchored moderate reps, deload, calibration', () => {
  const jbb = Engine.schemes['jbb-hyp'];
  const block = { wave: '10s', type: 'hypertrophy', scheme: 'jbb-hyp', mesoIdx: 0 };
  const wm = 90; // = 0.9 x e1RM 100

  // Work weeks: secSets counts, 8 reps, weight priced off the e1RM to hit the
  // secRpe ramp (RIR 3 -> 1), i.e. the book's effective 5-10 rep window.
  const wk0 = jbb.secondary(block, 0, wm, 2.5);
  assert.strictEqual(wk0.length, JBB_HYP.secSets[0][0]);
  assert.ok(wk0.every(s => s.reps === JBB_HYP.secReps && s.rpe === JBB_HYP.secRpe[0]));
  assert.ok(near(wk0[0].weight, Engine.weightFor(100, JBB_HYP.secReps, JBB_HYP.secRpe[0], 2.5)));
  // ~73% of e1RM at week 0: inside the effective window, far from the old 54%.
  assert.ok(wk0[0].weight / 100 > 0.68 && wk0[0].weight / 100 < 0.80);
  const wk3 = jbb.secondary(block, 3, wm, 2.5);
  assert.ok(wk3[0].weight > wk0[0].weight, 'load climbs as the RIR tightens');

  // Deload: unchanged shape, deliberately light.
  const dl = jbb.secondary(block, 4, wm, 2.5);
  assert.strictEqual(dl.length, JBB_HYP.deload.secSets);
  assert.ok(near(dl[0].weight, Engine.roundLoad(wm * JBB_HYP.deload.secPct, 2.5)));

  // Uncalibrated: ramps at the scheme's own 8-rep target ([8,6,4]).
  const calib = jbb.secondary(block, 0, null, 2.5, 1, 'intermediate');
  assert.deepStrictEqual(calib.map(s => s.reps), [8, 6, 4]);
  assert.ok(calib.every(s => s.calib === true));
});

test('jbb-hyp main ramp: sets climb, week 4 AMRAP, deload, uncalibrated', () => {
  const jbb = Engine.schemes['jbb-hyp'];
  const block = { wave: '10s', type: 'hypertrophy', scheme: 'jbb-hyp', mesoIdx: 0 };
  const wm = 100, W = WAVES['10s'];

  // Volume climbs week over week within the meso (mainSets row [3,4,5,...]).
  const wk0 = jbb.main(block, 0, wm, 2.5);
  const wk1 = jbb.main(block, 1, wm, 2.5);
  const wk2 = jbb.main(block, 2, wm, 2.5);
  assert.strictEqual(wk0.length, 3);
  assert.strictEqual(wk1.length, 4);
  assert.strictEqual(wk2.length, 5);
  assert.ok(wk0.every(s => s.reps === W.standard && s.rpe === 7));

  // Week 4 (idx 3) appends an AMRAP at the realization percentage.
  const wk3 = jbb.main(block, 3, wm, 2.5);
  const last = wk3[wk3.length - 1];
  assert.strictEqual(last.amrap, true);
  assert.strictEqual(last.reps, W.standard);
  assert.ok(near(last.weight, Engine.roundLoad(wm * W.real.amrap.pct, 2.5)));

  // Deload (week 4 index): the three-set DELOAD ramp.
  const deload = jbb.main(block, 4, wm, 2.5);
  assert.strictEqual(deload.length, 3);
  assert.ok(deload.every(s => /^deload/.test(s.noteKey)));

  // Uncalibrated lift falls back to the shared calibration ramp.
  const calib = jbb.main(block, 0, null, 2.5);
  assert.strictEqual(calib.length, 3);
  assert.ok(calib.every(s => s.calib === true));
});

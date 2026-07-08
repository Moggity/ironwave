/* ============================================================
   IRONWAVE — test/feedback-fixes.test.js
   User-feedback round (v1.2.0): the skip-set state, the outlier
   weight net (Engine.weightOutlier), the ghost-tap guard, and the
   phase-colored block rows' inputs. Everything here is pure or
   stub-safe, so it runs on the no-DOM harness.
   ============================================================ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine } = app;

// ------------------------------------------------------------
// Engine.weightOutlier: the bad-record net
// ------------------------------------------------------------
test('weightOutlier flags a bodyweight-sized typo over a light history', () => {
  // The reported bug: split squat history topped out at 30 kg total
  // (15 kg/hand), then a 154 kg record appeared (typed bodyweight, doubled
  // per-hand). That must be flagged.
  const recs = [
    { weight: 10, reps: 12, rpe: 6 },
    { weight: 20, reps: 10, rpe: 7 },
    { weight: 30, reps: 8, rpe: 7 },
  ];
  assert.strictEqual(Engine.weightOutlier(recs, 154), true);
});

test('weightOutlier stays quiet on normal progression and small jumps', () => {
  const recs = [
    { weight: 60, reps: 10, rpe: 7 },
    { weight: 65, reps: 10, rpe: 7 },
    { weight: 70, reps: 8, rpe: 8 },
  ];
  assert.strictEqual(Engine.weightOutlier(recs, 75), false, 'ordinary bump');
  assert.strictEqual(Engine.weightOutlier(recs, 100), false, 'big but < 2x');
  // 2x rule alone is not enough on tiny weights: 5 -> 10 kg is a normal jump.
  const light = [{ weight: 5, reps: 12, rpe: 6 }, { weight: 5, reps: 12, rpe: 6 }, { weight: 7.5, reps: 12, rpe: 6 }];
  assert.strictEqual(Engine.weightOutlier(light, 15), false, 'needs the 20 kg margin too');
});

test('weightOutlier needs history and ignores seeded records and junk input', () => {
  assert.strictEqual(Engine.weightOutlier([], 200), false, 'no history');
  assert.strictEqual(Engine.weightOutlier([{ weight: 20, reps: 10, rpe: 7 }], 200), false, 'thin history');
  // Seeded 1RM/10RM rows are estimates, not performances: they neither trigger
  // nor mask the check.
  const seeded = [
    { weight: 10, reps: 12, rpe: 6 }, { weight: 12.5, reps: 12, rpe: 6 }, { weight: 15, reps: 10, rpe: 7 },
    { weight: 180, reps: 1, rpe: 10, seed: true },
  ];
  assert.strictEqual(Engine.weightOutlier(seeded, 154), true, 'seed does not mask the real max');
  const recs = [{ weight: 60, reps: 10, rpe: 7 }, { weight: 60, reps: 10, rpe: 7 }, { weight: 60, reps: 10, rpe: 7 }];
  assert.strictEqual(Engine.weightOutlier(recs, 0), false, 'zero weight');
  assert.strictEqual(Engine.weightOutlier(recs, NaN), false, 'NaN weight');
});

// ------------------------------------------------------------
// Skip-set semantics on the pure helpers
// ------------------------------------------------------------
test('a skipped set logs nothing: tonnage ignores it', () => {
  const entries = [{
    sets: [
      { done: true, weight: 60, reps: 10 },
      { done: false, skipped: true, weight: null, reps: null },
    ],
  }];
  assert.strictEqual(Engine.tonnage(entries), 600);
});

test('lastWorkingSetIdx passes over a skipped set (finisher lands on real work)', () => {
  const sets = [
    { targetWeight: 60, targetReps: 10 },
    { targetWeight: 60, targetReps: 10 },
    { targetWeight: 60, targetReps: 10, skipped: true },
  ];
  assert.strictEqual(app.lastWorkingSetIdx(sets), 1, 'skipped last set is not the working set');
  const allSkipped = sets.map(s => ({ ...s, skipped: true }));
  assert.strictEqual(app.lastWorkingSetIdx(allSkipped), -1);
});

test('a skipped member set completes a superset round instead of blocking it', () => {
  const mk = (group, sets) => ({ superset: true, supersetGroup: group, sets });
  const a = mk(1, [{ done: true }]);
  const b = mk(1, [{ done: false, skipped: true }]);
  const entries = [a, b];
  assert.strictEqual(app.supersetRoundComplete(entries, a, 0), true, 'skipped counts as settled');
  assert.strictEqual(app.supersetNextInRound(entries, a, 0), undefined, 'nobody owes the round a set');
});

// ------------------------------------------------------------
// Ghost-tap guard timing
// ------------------------------------------------------------
test('tap guard swallows the ghost click window, then relaxes', () => {
  const outsideModal = {}; // not inside the $modal stub
  assert.strictEqual(app.tapGuardActive(outsideModal), false, 'idle: no guard');
  app.armTapGuard();
  assert.strictEqual(app.tapGuardActive(outsideModal), true, 'just closed a modal: guarded');
});

// ------------------------------------------------------------
// Block rows share the timeline's emphasis colors
// ------------------------------------------------------------
test('barColorFor tints a cut block teal and a strength block orange', () => {
  const cut = { type: 'hypertrophy', scheme: 'jbb-hyp', phase: 'cut' };
  const strength = { type: 'strength', scheme: 'jm2-wave', phase: 'maintenance' };
  const gain = { type: 'hypertrophy', scheme: 'jbb-hyp', phase: 'lean-gain' };
  assert.strictEqual(app.barColorFor(cut), app.BLOCK_COLORS.bridge);
  assert.strictEqual(app.barColorFor(strength), app.BLOCK_COLORS.strength);
  assert.strictEqual(app.barColorFor(gain), app.BLOCK_COLORS.hypertrophy);
});

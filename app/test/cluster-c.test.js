/* ============================================================
   IRONWAVE — test/cluster-c.test.js
   Cluster C / Epic 3, data slice: head/region + SFR + stretch metadata.
   - Every EXERCISES entry carries the new fields, with neutral defaults when
     unspecified (so the data lift is additive).
   - Authored values land on the right exercises.
   - Data integrity: every head tag has a label.
   - Inert: the metadata is not on the prescription path, so resolveSlot output
     never carries sfr / stretch / head (golden master stays safe).
   Through the existing test/load-app.js harness (no jsdom).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { EXERCISES, SFR_LABELS, HEAD_LABELS, Engine, muscleHeads, headLandmarkFor, headVolumeOverMrv, VOLUME_LANDMARKS } = app;

// ---------------------------------------------------------------------------
// Shape + defaults
// ---------------------------------------------------------------------------
test('every exercise carries sfr / stretch / head with neutral defaults', () => {
  for (const e of EXERCISES) {
    assert.ok([1, 2, 3].includes(e.sfr), `${e.id} has a 1..3 sfr`);
    assert.strictEqual(typeof e.stretch, 'boolean', `${e.id} stretch is boolean`);
    assert.ok(e.head === null || typeof e.head === 'string', `${e.id} head is null or a string`);
  }
  // An untagged exercise (no EX_META row) takes the neutral default.
  const plank = EXERCISES.find(e => e.id === 'plank');
  assert.deepStrictEqual({ sfr: plank.sfr, stretch: plank.stretch, head: plank.head },
    { sfr: 2, stretch: false, head: null });
});

// ---------------------------------------------------------------------------
// Authored values
// ---------------------------------------------------------------------------
test('authored metadata lands on the right exercises', () => {
  const by = id => EXERCISES.find(e => e.id === id);
  // Heavy compound: lower SFR.
  assert.strictEqual(by('comp-deadlift').sfr, 1);
  // Cable lateral raise: high SFR, side-delt, loaded stretch.
  assert.deepStrictEqual(
    (({ sfr, stretch, head }) => ({ sfr, stretch, head }))(by('cable-lateral-raise')),
    { sfr: 3, stretch: true, head: 'delt-side' });
  // Overhead triceps extension biases the long head at length.
  assert.strictEqual(by('overhead-triceps-ext').head, 'tri-long');
  assert.strictEqual(by('overhead-triceps-ext').stretch, true);
  // Incline bench is upper chest; pushdown is the lateral head of the triceps.
  assert.strictEqual(by('incline-bench').head, 'chest-upper');
  assert.strictEqual(by('triceps-pushdown').head, 'tri-lateral');
});

// ---------------------------------------------------------------------------
// Per-head landmarks (this branch)
// ---------------------------------------------------------------------------
test('Engine.headLandmark splits the muscle landmark across heads with floors', () => {
  const lm = { mv: 8, mev: 10, mrv: 20 };
  const two = Engine.headLandmark(lm, 2);
  assert.ok(two.mv <= two.mev && two.mev <= two.mrv, 'ordering mv <= mev <= mrv holds');
  assert.ok(two.mrv <= lm.mrv, 'a head never exceeds the whole-muscle MRV');
  assert.ok(two.mev < lm.mev, 'a head needs less than the whole muscle');
  // A small landmark still floors a head at a trainable MEV.
  assert.strictEqual(Engine.headLandmark({ mv: 0, mev: 2, mrv: 4 }, 3).mev, 2);
  // A single (or unsplit) muscle keeps the whole-muscle landmark.
  assert.deepStrictEqual(Engine.headLandmark(lm, 1), { mv: 8, mev: 10, mrv: 20 });
  assert.strictEqual(Engine.headLandmark(null, 2), null);
});

test('muscleHeads reports a landmark-movement\'s heads; triceps splits into long and lateral', () => {
  app.S = app.defaultState();
  const heads = muscleHeads('tricep');
  assert.ok(heads.includes('tri-long') && heads.includes('tri-lateral'), 'triceps has both heads');
  // Every reported head has a label (data integrity for the surfaced split).
  for (const h of heads) assert.ok(HEAD_LABELS[h], `${h} has a label`);
});

test('pattern-movement heads roll up to the muscle they name, at the coverage fraction', () => {
  app.S = app.defaultState();
  const { exHeadAttribution, HEAD_MUSCLE, EXERCISES, SYNERGIST_COVERAGE } = app;
  // A landmark-movement head counts in full against its own muscle.
  const latRaise = EXERCISES.find(e => e.id === 'lateral-raise');
  assert.deepStrictEqual(exHeadAttribution(latRaise), { muscle: 'shoulder', head: 'delt-side', frac: 1 });
  // Incline bench lives on the bench PATTERN (no landmark); its upper-chest work
  // rolls up to Chest at the bench->chest coverage fraction.
  const incline = EXERCISES.find(e => e.id === 'incline-bench');
  assert.deepStrictEqual(exHeadAttribution(incline),
    { muscle: 'chest', head: 'chest-upper', frac: SYNERGIST_COVERAGE.bench.chest });
  // So Chest now splits into both regions (upper chest used to be invisible).
  assert.ok(muscleHeads('chest').includes('chest-upper') && muscleHeads('chest').includes('chest-lower'),
    'chest gains its upper region from the bench pattern');
  // A headless exercise contributes no attribution.
  assert.strictEqual(exHeadAttribution(EXERCISES.find(e => e.id === 'pec-deck')), null);
  // Every rollup target is a real landmark muscle.
  for (const h in HEAD_MUSCLE) assert.ok(VOLUME_LANDMARKS[HEAD_MUSCLE[h]], `${h} -> a landmark muscle`);
});

test('headVolumeOverMrv flags a region piled past its per-head MRV', () => {
  app.S = app.defaultState();
  const hlm = headLandmarkFor('tricep');
  assert.ok(hlm && hlm.mrv > 0, 'triceps has a derived per-head landmark');
  assert.ok(hlm.mrv < VOLUME_LANDMARKS.tricep.mrv, 'a head MRV is below the whole-muscle MRV');
  // All the triceps volume dumped on one head trips the flag; a light head does not.
  assert.strictEqual(headVolumeOverMrv('tricep', 'tri-long', { tricep: { 'tri-long': hlm.mrv } }), true);
  assert.strictEqual(headVolumeOverMrv('tricep', 'tri-long', { tricep: { 'tri-long': hlm.mrv - 1 } }), false);
  assert.strictEqual(headVolumeOverMrv('tricep', null, {}), false);
});

// ---------------------------------------------------------------------------
// Data integrity
// ---------------------------------------------------------------------------
test('every head tag in use has a label, and labels are non-empty', () => {
  for (const e of EXERCISES) {
    if (e.head) assert.ok(HEAD_LABELS[e.head], `head "${e.head}" (${e.id}) needs a label`);
  }
  for (const k of [1, 2, 3]) assert.ok(SFR_LABELS[k] && SFR_LABELS[k].length);
});

// ---------------------------------------------------------------------------
// Inert on the prescription path (golden master safety)
// ---------------------------------------------------------------------------
test('resolveSlot output does not carry exercise metadata', () => {
  app.S = app.defaultState();
  app.S.program = app.makeProgram({
    daysPerWeek: 4, track: 'powerbuilding', timeMode: 'unlimited',
    muscleFocus: { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 }, maxes: {},
  });
  const p = app.S.program;
  for (const slot of p.days[0].slots) {
    const rs = app.resolveSlot(slot, 0, 1);
    for (const s of rs.sets) {
      assert.ok(!('sfr' in s) && !('stretch' in s) && !('head' in s),
        'prescribed sets stay free of exercise metadata');
    }
  }
});

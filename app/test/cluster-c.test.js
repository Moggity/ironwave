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
const { EXERCISES, SFR_LABELS, HEAD_LABELS } = app;

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

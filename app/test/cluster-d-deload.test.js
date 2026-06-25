/* ============================================================
   IRONWAVE — test/cluster-d-deload.test.js
   Cluster D / Epic 4: autoregulated deload (depth) + resensitization.
   - Engine.deloadDepth sizes the deload to accumulated fatigue (pure).
   - resolveSlot applies the stored plan to a bodybuilding accessory on the
     deload week only; off-track / off-week / no-plan is byte-identical.
   - advanceWeek resensitizes (resets volAdj) when a block ends.
   Bodybuilding-only; the Powerbuilding golden master is unaffected.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine } = app;
const DEFAULT_FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };
const st = (key, pct) => ({ key, pct: pct == null ? (key === 'over' ? 100 : 80) : pct });

// ---------------------------------------------------------------------------
// Engine.deloadDepth (pure)
// ---------------------------------------------------------------------------
test('deloadDepth: deeper when fatigue is saturated, lighter when fresh', () => {
  // 3+ muscles at/near MRV -> deeper deload (one fewer set).
  const deep = Engine.deloadDepth([st('over'), st('over'), st('over')], false);
  assert.strictEqual(deep.level, 'deep');
  assert.strictEqual(deep.setDelta, -1);

  // 2 near MRV plus readiness trending down also goes deep.
  assert.strictEqual(Engine.deloadDepth([st('over'), st('over')], true).level, 'deep');

  // Trained, none near MRV, no downtrend -> lighter deload (one more set).
  const light = Engine.deloadDepth([st('productive'), st('maint')], false);
  assert.strictEqual(light.level, 'light');
  assert.strictEqual(light.setDelta, 1);

  // Mixed / mild -> standard (no change).
  assert.strictEqual(Engine.deloadDepth([st('over'), st('productive')], false).level, 'standard');
});

test('deloadDepth: no fatigue data defaults to standard, not light', () => {
  const out = Engine.deloadDepth([], false);
  assert.strictEqual(out.level, 'standard');
  assert.strictEqual(out.setDelta, 0);
});

// ---------------------------------------------------------------------------
// resolveSlot application (deload week, bodybuilding only)
// ---------------------------------------------------------------------------
function bbAccessoryCount(program, slot, wIdx) {
  return app.resolveSlot(slot, 0, wIdx).sets.filter(s => !s.amrap && !s.ramp && !s.calib).length;
}
function freshBB() {
  app.S = app.defaultState();
  app.V = {};
  app.S.program = app.makeProgram({
    daysPerWeek: 4, track: 'bodybuilding', timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  });
  app.S.records['cable-fly'] = [{ ts: Date.now(), weight: 20, reps: 12, rpe: 8 }];
  return app.S.program;
}
const accSlot = { type: 'acc', cat: 'chest', def: 'cable-fly', ex: 'cable-fly' };

test('the deload plan deepens or lightens accessory volume on the deload week only', () => {
  const p = freshBB();
  assert.strictEqual(Engine.weekType(4), 'deload');
  p.deloadPlan = null;
  const standard = bbAccessoryCount(p, accSlot, 4);
  p.deloadPlan = { level: 'deep', setDelta: -1 };
  assert.strictEqual(bbAccessoryCount(p, accSlot, 4), standard - 1, 'deep deload removes a set');
  p.deloadPlan = { level: 'light', setDelta: 1 };
  assert.strictEqual(bbAccessoryCount(p, accSlot, 4), standard + 1, 'light deload adds a set');

  // A non-deload week (accumulation) ignores the plan entirely.
  p.deloadPlan = { level: 'deep', setDelta: -1 };
  const accumNoPlan = (() => { p.deloadPlan = null; return bbAccessoryCount(p, accSlot, 1); })();
  p.deloadPlan = { level: 'deep', setDelta: -1 };
  assert.strictEqual(bbAccessoryCount(p, accSlot, 1), accumNoPlan, 'plan never touches a work week');
});

test('the deload plan is inert on a non-bodybuilding program', () => {
  app.S = app.defaultState();
  app.V = {};
  app.S.program = app.makeProgram({
    daysPerWeek: 4, track: 'powerbuilding', timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  });
  const p = app.S.program;
  app.S.records['cable-fly'] = [{ ts: Date.now(), weight: 20, reps: 12, rpe: 8 }];
  const before = bbAccessoryCount(p, accSlot, 4);
  p.deloadPlan = { level: 'deep', setDelta: -1 };
  assert.strictEqual(bbAccessoryCount(p, accSlot, 4), before, 'powerbuilding deload is unchanged');
});

// ---------------------------------------------------------------------------
// Resensitization: volAdj resets when a block ends
// ---------------------------------------------------------------------------
test('finishing a block resets the per-muscle autoreg offset (resensitization)', () => {
  const p = freshBB();
  p.volAdj = { chest: 2, back: -1 };
  // Advance a full block (weeksPerBlock weeks) to roll into the next meso.
  for (let i = 0; i < p.weeksPerBlock; i++) app.advanceWeek();
  assert.ok(p.pointer.block >= 1, 'rolled into the next block');
  assert.deepStrictEqual(p.volAdj, { chest: 0, back: 0 }, 'offsets reset toward MEV');
  assert.strictEqual(p.deloadPlan, null, 'the spent deload plan is cleared');
});

test('advancing into the deload week stores a plan for a bodybuilding athlete', () => {
  const p = freshBB();
  // Walk to the deload week (week index 4): four advances from week 0.
  for (let i = 0; i < 4; i++) app.advanceWeek();
  assert.strictEqual(Engine.weekType(p.pointer.week), 'deload');
  assert.ok(p.deloadPlan && typeof p.deloadPlan.setDelta === 'number', 'a deload plan was computed');
});

// ---------------------------------------------------------------------------
// Deload-depth refinements (this branch): intensity modulation + autoreg gating
// ---------------------------------------------------------------------------
test('deloadDepth: a deeper deload also eases effort (rpeDelta), lighter/standard do not', () => {
  assert.strictEqual(Engine.deloadDepth([st('over'), st('over'), st('over')], false).rpeDelta, -1);
  assert.strictEqual(Engine.deloadDepth([st('productive'), st('maint')], false).rpeDelta, 0);
  assert.strictEqual(Engine.deloadDepth([], false).rpeDelta, 0);
});

function plainRpes(slot, wIdx) {
  return app.resolveSlot(slot, 0, wIdx).sets.filter(s => !s.amrap && !s.ramp && !s.calib).map(s => s.rpe);
}
test('a deep deload eases accessory RPE on the deload week only', () => {
  const p = freshBB();
  p.deloadPlan = null;
  const baseRpes = plainRpes(accSlot, 4);
  assert.ok(baseRpes.length && baseRpes.every(r => r != null), 'deload sets carry an RPE');
  p.deloadPlan = { level: 'deep', setDelta: 0, rpeDelta: -1 };
  const easedRpes = plainRpes(accSlot, 4);
  easedRpes.forEach((r, i) => assert.strictEqual(r, Math.max(5, baseRpes[i] - 1), 'each working set is one RIR easier'));
  // A work week ignores the intensity delta entirely.
  const workBefore = plainRpes(accSlot, 1);
  assert.deepStrictEqual(plainRpes(accSlot, 1), workBefore, 'rpeDelta never touches a work week');
});

test('autoreg never ADDS volume on the deload week, but still adds on a work week', () => {
  const p = freshBB();
  p.deloadPlan = null;
  // A positive per-muscle offset would add a set where autoreg applies.
  p.volAdj = { chest: 2 };
  const workCount = app.resolveSlot(accSlot, 0, 1).sets.filter(s => !s.amrap && !s.ramp && !s.calib).length;
  const workBaseline = (() => { p.volAdj = {}; const n = app.resolveSlot(accSlot, 0, 1).sets.filter(s => !s.amrap && !s.ramp && !s.calib).length; p.volAdj = { chest: 2 }; return n; })();
  assert.ok(workCount > workBaseline, 'a positive offset adds volume on a work week');
  // On the deload week the same positive offset is suppressed.
  const deloadCount = app.resolveSlot(accSlot, 0, 4).sets.filter(s => !s.amrap && !s.ramp && !s.calib).length;
  p.volAdj = {};
  const deloadBaseline = app.resolveSlot(accSlot, 0, 4).sets.filter(s => !s.amrap && !s.ramp && !s.calib).length;
  assert.strictEqual(deloadCount, deloadBaseline, 'the offset does not add volume on the deload week');
});

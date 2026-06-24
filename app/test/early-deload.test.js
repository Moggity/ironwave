/* ============================================================
   IRONWAVE — test/early-deload.test.js
   Cluster D / Epic 4: early (autoregulated) deload TIMING trigger.
   - Engine.earlyDeloadAdvised decides, mid-block, whether accumulated fatigue
     warrants pulling the deload in before week 5 (pure).
   - resolveSlot prescribes the triggered work week exactly like the deload week
     when P().earlyDeload marks it; off-track / unmarked is byte-identical.
   - advanceWeek treats the early-deload week as the end of the block: it
     resensitizes and rolls to the next block, clearing the flag.
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
// Engine.earlyDeloadAdvised (pure)
// ---------------------------------------------------------------------------
test('earlyDeloadAdvised: advises only when fatigue is saturated or trending down', () => {
  // 3+ muscles at/near MRV -> advise pulling the deload in.
  assert.strictEqual(Engine.earlyDeloadAdvised([st('over'), st('over'), st('over')], false).advised, true);
  // 2 near MRV plus readiness sliding -> advise.
  assert.strictEqual(Engine.earlyDeloadAdvised([st('over'), st('over')], true).advised, true);
  // 2 near MRV but readiness steady -> hold (not enough to cut the block short).
  assert.strictEqual(Engine.earlyDeloadAdvised([st('over'), st('over')], false).advised, false);
  // 1 near MRV -> hold.
  assert.strictEqual(Engine.earlyDeloadAdvised([st('over')], true).advised, false);
  // No fatigue data -> hold, with empty reason.
  const none = Engine.earlyDeloadAdvised([], false);
  assert.strictEqual(none.advised, false);
  assert.strictEqual(none.reason, '');
});

test('earlyDeloadAdvised: reason names the muscle count and the trend', () => {
  const out = Engine.earlyDeloadAdvised([st('over'), st('over'), st('over')], true);
  assert.match(out.reason, /3 muscles/);
  assert.match(out.reason, /readiness is sliding/);
});

// ---------------------------------------------------------------------------
// resolveSlot: an early-deload week prescribes like the deload week
// ---------------------------------------------------------------------------
function freshBB(track = 'bodybuilding') {
  app.S = app.defaultState();
  app.V = {};
  app.S.program = app.makeProgram({
    daysPerWeek: 4, track, timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  });
  app.S.records['cable-fly'] = [{ ts: Date.now(), weight: 20, reps: 12, rpe: 8 }];
  return app.S.program;
}
const accSlot = { type: 'acc', cat: 'chest', def: 'cable-fly', ex: 'cable-fly' };
const plain = (slot, wIdx) => app.resolveSlot(slot, 0, wIdx).sets.filter(s => !s.amrap && !s.ramp && !s.calib).length;

test('marking a work week as an early deload prescribes it as the deload week', () => {
  const p = freshBB();
  p.deloadPlan = null;
  const work = plain(accSlot, 1);          // accumulation week, full volume
  const deload = plain(accSlot, 4);        // scheduled deload, reduced volume
  assert.ok(deload < work, 'sanity: the deload week carries fewer sets than a work week');

  // Convert week 1 to an early deload: it should now match the deload prescription.
  p.earlyDeload = { block: 0, week: 1 };
  assert.strictEqual(plain(accSlot, 1), deload, 'the early-deload week resolves like the deload week');
});

test('the early-deload mark is inert on a non-bodybuilding program', () => {
  const p = freshBB('powerbuilding');
  const before = plain(accSlot, 1);
  p.earlyDeload = { block: 0, week: 1 };
  assert.strictEqual(plain(accSlot, 1), before, 'powerbuilding ignores the early-deload mark');
});

test('the early-deload mark only remaps the exact block and week it names', () => {
  const p = freshBB();
  p.deloadPlan = null;
  const work1 = plain(accSlot, 1);
  const work2 = plain(accSlot, 2);
  p.earlyDeload = { block: 0, week: 1 }; // names week 1, not week 2
  assert.strictEqual(plain(accSlot, 2), work2, 'week 2 keeps its work-week prescription');
  p.earlyDeload = { block: 1, week: 1 }; // names a different block (resolveSlot here is block 0)
  assert.strictEqual(plain(accSlot, 1), work1, 'a mark on another block does not touch this one');
});

// ---------------------------------------------------------------------------
// advanceWeek: an early deload ends the block (resensitize + roll over)
// ---------------------------------------------------------------------------
test('completing an early-deload week ends the block early and resensitizes', () => {
  const p = freshBB();
  // Sit the athlete on an intensification work week with an accumulated offset.
  p.pointer.block = 0; p.pointer.week = 2;
  p.volAdj = { chest: 2, back: -1 };
  p.earlyDeload = { block: 0, week: 2 };
  p.deloadPlan = { level: 'deep', setDelta: -1 };

  app.advanceWeek();

  assert.strictEqual(p.pointer.block, 1, 'rolled into the next block');
  assert.strictEqual(p.pointer.week, 0, 'next block starts at week 0');
  assert.strictEqual(p.earlyDeload, null, 'the early-deload mark is spent');
  assert.strictEqual(p.deloadPlan, null, 'the deload plan is spent');
  assert.deepStrictEqual(p.volAdj, { chest: 0, back: 0 }, 'offsets reset toward MEV (resensitized)');
});

test('without an early-deload mark a mid-block week advances normally (no skip)', () => {
  const p = freshBB();
  p.pointer.block = 0; p.pointer.week = 1;
  app.advanceWeek();
  assert.strictEqual(p.pointer.block, 0, 'still in the same block');
  assert.strictEqual(p.pointer.week, 2, 'advanced to the next week, not a new block');
});

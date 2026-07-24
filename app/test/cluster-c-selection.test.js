/* ============================================================
   IRONWAVE — test/cluster-c-selection.test.js
   Cluster C / Epic 3, selection slice: the generator and the cross-meso
   rotation consuming the head/SFR metadata.
   - pickAccessory spreads a muscle across its heads, rotates per meso.
   - generateBodybuildingDays covers distinct heads for a high-frequency muscle.
   - advanceWeek rotates bodybuilding generator-default accessories into a new
     block, keeps a day's picks distinct, and leaves other tracks untouched.
   Bodybuilding-only; the golden master (Powerbuilding) is unaffected.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const DEFAULT_FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

function freshBB(focus) {
  app.S = app.defaultState();
  app.V = {}; // advanceWeek writes V.dayIdx
  app.S.program = app.makeProgram({
    daysPerWeek: 5, track: 'bodybuilding', timeMode: 'unlimited',
    muscleFocus: { ...(focus || DEFAULT_FOCUS) }, maxes: {},
  });
  return app.S.program;
}

// ---------------------------------------------------------------------------
// pickAccessory (pure selection)
// ---------------------------------------------------------------------------
test('pickAccessory prefers an unused exercise covering a new head', () => {
  app.S = app.defaultState(); // exById needs S.customEx
  const pool = app.DEFAULT_ACC.chest; // dips(lower), db-incline(upper), cable-fly(null), ...
  // First pick: the head of the pool.
  assert.strictEqual(app.pickAccessory(pool, new Set(), new Set()), 'dips');
  // With chest-lower already covered, skip dips and take the new (upper) head.
  assert.strictEqual(app.pickAccessory(pool, new Set(), new Set(['chest-lower'])), 'db-incline-bench');
});

test('pickAccessory falls back to any unused, then cross-day reuse, then null (B4)', () => {
  app.S = app.defaultState();
  const pool = app.DEFAULT_ACC.chest;
  // Every head already covered: still returns an unused exercise (headless ok).
  const used = new Set(['dips', 'db-incline-bench']);
  const out = app.pickAccessory(pool, used, new Set(['chest-lower', 'chest-upper']));
  assert.ok(pool.includes(out) && !used.has(out), 'returns an unused pool exercise');
  // [B4] Week-exhausted: a cross-day REUSE is legal when the caller passes the
  // day's guard (a 3-exercise muscle trained 2x must repeat across days)...
  const reuse = app.pickAccessory(pool, new Set(pool), new Set(), 0, null, new Set(['dips']));
  assert.ok(pool.includes(reuse) && reuse !== 'dips', 'cross-day reuse skips the day\'s own picks');
  // ...but with no day guard, exhaustion is NULL, never a silent repeat (F8).
  assert.strictEqual(app.pickAccessory(pool, new Set(pool), new Set()), null);
  // And a fully-used day yields null even with the guard (no within-day dups).
  assert.strictEqual(app.pickAccessory(pool, new Set(pool), new Set(), 0, null, new Set(pool)), null);
});

test('musclePool: the curated order first, then the library by SFR, anchors excluded (B4)', () => {
  app.S = app.defaultState();
  const pool = app.musclePool('chest');
  assert.deepStrictEqual(pool.slice(0, app.DEFAULT_ACC.chest.length), app.DEFAULT_ACC.chest,
    'curated picks keep their preference order');
  assert.ok(pool.length > app.DEFAULT_ACC.chest.length, 'the library extends the pool');
  assert.ok(!pool.includes('comp-bench'), 'working-max anchors never appear as accessory picks');
  const seen = new Set(pool);
  assert.strictEqual(seen.size, pool.length, 'no duplicate ids');
  // preferHeads wins over plain head-novelty when given.
  const pref = app.pickAccessory(pool, new Set(), new Set(), 0, ['chest-upper']);
  assert.strictEqual((app.EXERCISES.find(e => e.id === pref) || {}).head, 'chest-upper');
});

test('pickAccessory rotation offset changes the starting exercise per meso', () => {
  app.S = app.defaultState();
  const pool = app.DEFAULT_ACC.chest;
  assert.strictEqual(app.pickAccessory(pool, new Set(), new Set(), 0), 'dips');
  assert.notStrictEqual(app.pickAccessory(pool, new Set(), new Set(), 2), 'dips');
  // Offset wraps around the pool length.
  assert.strictEqual(app.pickAccessory(pool, new Set(), new Set(), pool.length), 'dips');
});

// ---------------------------------------------------------------------------
// Generator head coverage
// ---------------------------------------------------------------------------
test('a 3x muscle is spread across distinct heads, not doubled on one region', () => {
  freshBB({ ...DEFAULT_FOCUS, chest: 5 }); // chest 5 -> 3x/week
  const days = app.generateBodybuildingDays({ ...DEFAULT_FOCUS, chest: 5 }, 5);
  const chest = [];
  for (const d of days) for (const sl of d.slots) {
    if (sl.def && app.muscleOfAcc(sl.def) === 'chest') chest.push(sl.def);
  }
  assert.ok(chest.length >= 2, 'chest is trained several times');
  const heads = chest.map(app.accHead).filter(Boolean);
  assert.ok(new Set(heads).size >= 2, `chest accessories cover >=2 heads, got ${JSON.stringify(heads)}`);
  assert.strictEqual(new Set(chest).size, chest.length, 'no duplicate chest exercise in the week');
});

// ---------------------------------------------------------------------------
// Cross-meso rotation at block advance
// ---------------------------------------------------------------------------
function defsByDay(prog) {
  return prog.days.map(d => d.slots.filter(s => s.type === 'acc').map(s => s.def));
}
function advanceOneBlock(prog) {
  for (let i = 0; i < prog.weeksPerBlock; i++) app.advanceWeek();
}

test('advancing a block rotates bodybuilding generator accessories, keeping a day distinct', () => {
  const prog = freshBB({ ...DEFAULT_FOCUS, chest: 5, back: 5 });
  const before = defsByDay(prog);
  advanceOneBlock(prog);
  const after = defsByDay(prog);
  // At least one accessory rotated to a different exercise in the new meso.
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  assert.ok(changed, 'some accessory default rotated for the new block');
  // No day repeats the same exercise across its accessory slots.
  for (const day of after) assert.strictEqual(new Set(day).size, day.length, 'rotated picks stay distinct per day');
  // Rotated picks are still valid members of their muscle pool.
  for (const day of prog.days) for (const sl of day.slots) {
    if (sl.type === 'acc' && sl.def && app.muscleOfAcc(sl.def)) {
      assert.ok(app.DEFAULT_ACC[app.muscleOfAcc(sl.def)].includes(sl.def));
    }
  }
});

// ---------------------------------------------------------------------------
// Swap picker: heads already covered on a day (drives the "Adds <head>" hint)
// ---------------------------------------------------------------------------
test('dayHeadsCovered reports a day\'s same-movement heads, excluding the swapped slot', () => {
  app.S = app.defaultState();
  app.S.program = {
    days: [{
      name: 'Chest', slots: [
        { type: 'acc', cat: 'chest', def: 'db-incline-bench' }, // chest-upper
        { type: 'acc', cat: 'chest', def: 'dips' },             // chest-lower
        { type: 'acc', cat: 'back', def: 'lat-pulldown' },      // different movement
      ],
    }],
  };
  // From slot 0's view, the day already covers chest-lower (dips, slot 1); the
  // back lift is a different movement, so its head does not count here.
  const heads = app.dayHeadsCovered(0, 0, 'chest');
  assert.ok(heads.has('chest-lower'), 'sees the other chest slot head');
  assert.ok(!heads.has('chest-upper'), 'excludes the slot being swapped');
});

test('rotation is bodybuilding-only: a powerbuilding program keeps its accessory defs', () => {
  app.S = app.defaultState();
  app.V = {};
  app.S.program = app.makeProgram({
    daysPerWeek: 4, track: 'powerbuilding', timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  });
  const prog = app.S.program;
  const before = defsByDay(prog);
  advanceOneBlock(prog);
  const after = defsByDay(prog);
  assert.deepStrictEqual(after, before, 'non-bodybuilding accessory defaults are not rotated');
});

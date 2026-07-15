/* ============================================================
   IRONWAVE — test/h4.test.js
   [Epic H4] Hypertrophy prescription depth (bodybuilding-only):
   - rep ranges by movement + SFR class, shifted per meso,
   - double progression: reps climb inside the band at the target
     effort before weight climbs; displayed effort is DERIVED (the
     row never overstates proximity to failure),
   - the autoreg contract: volume autoreg owns SETS, double
     progression owns REPS,
   - e1RM-priced anchors: a swapped-in lead prices off its own e1RM
     and peaks on a rep-PR top set (AMRAP only on the barbell WM),
   - the range input absent -> jbb-hyp is byte-identical (the golden
     master contract; the golden master itself also pins this).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine } = app;

const FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };
const DAY = 864e5;

function withProgram(track) {
  const s = app.defaultState();
  app.S = s;
  s.program = app.makeProgram({ daysPerWeek: 4, track, experience: 'intermediate',
    timeMode: 'unlimited', muscleFocus: { ...FOCUS }, maxes: {} });
  return s;
}
const hypBlock = (mesoIdx) => ({ type: 'hypertrophy', scheme: 'jbb-hyp', wave: '10s', mesoIdx: mesoIdx || 0 });
const rec = (daysAgo, weight, reps, rpe) => ({ ts: Date.now() - daysAgo * DAY, weight, reps, rpe });

// ---------------------------------------------------------------------------
// Rep ranges
// ---------------------------------------------------------------------------
test('repRangeFor: movement band, +2 for a high-SFR pick', () => {
  assert.deepStrictEqual(Engine.repRangeFor('chest', 2), [8, 12]);
  assert.deepStrictEqual(Engine.repRangeFor('chest', 3), [10, 14]);
  assert.deepStrictEqual(Engine.repRangeFor('calf', 2), [12, 20]);
  assert.deepStrictEqual(Engine.repRangeFor('nope', 2), [10, 15], 'unknown movement: default band');
});

test('mesoRepRange: odd mesos shift the band up 2', () => {
  assert.deepStrictEqual(Engine.mesoRepRange([8, 12], 0), [8, 12]);
  assert.deepStrictEqual(Engine.mesoRepRange([8, 12], 1), [10, 14]);
  assert.deepStrictEqual(Engine.mesoRepRange([8, 12], 2), [8, 12]);
});

// ---------------------------------------------------------------------------
// Double progression
// ---------------------------------------------------------------------------
test('doubleProgression climbs reps at the same weight inside the band', () => {
  const dp = Engine.doubleProgression([rec(3, 40, 9, 8)], 8, 12, 8, 2.5);
  assert.deepStrictEqual(dp, { weight: 40, reps: 10, moved: 'reps' });
});

test('doubleProgression adds weight and restarts at the bottom after a comfortable range top', () => {
  const dp = Engine.doubleProgression([rec(3, 40, 12, 8)], 8, 12, 8, 2.5);
  assert.deepStrictEqual(dp, { weight: 42.5, reps: 8, moved: 'weight' });
});

test('doubleProgression holds at the top when the range top was a grind', () => {
  const dp = Engine.doubleProgression([rec(3, 40, 12, 9.5)], 8, 12, 8, 2.5);
  assert.deepStrictEqual(dp, { weight: 40, reps: 12, moved: 'hold' });
});

test('doubleProgression reads the most recent day, top set; seeds and no history return null', () => {
  const recs = [rec(10, 35, 12, 8), rec(2, 40, 9, 8), rec(2, 37.5, 12, 8)];
  assert.deepStrictEqual(Engine.doubleProgression(recs, 8, 12, 8, 2.5),
    { weight: 40, reps: 10, moved: 'reps' }, 'latest day wins, its heaviest set decides');
  assert.strictEqual(Engine.doubleProgression([{ ...rec(3, 60, 10, 10), seed: true }], 8, 12, 8, 2.5), null);
  assert.strictEqual(Engine.doubleProgression([], 8, 12, 8, 2.5), null);
});

test('a re-ranged meso clamps the rep target into the new band', () => {
  const dp = Engine.doubleProgression([rec(3, 40, 5, 8)], 8, 12, 8, 2.5);
  assert.deepStrictEqual(dp, { weight: 40, reps: 8, moved: 'reps' }, 'below the band climbs to its floor');
});

// ---------------------------------------------------------------------------
// The scheme with a range: reps/weight from DP, sets untouched, honest effort
// ---------------------------------------------------------------------------
test('jbb-hyp accessory with a range: DP owns weight x reps, the meso table owns sets', () => {
  const records = [rec(3, 40, 9, 8)];
  const plain = Engine.schemes['jbb-hyp'].accessory(hypBlock(), 1, records, 2.5, 'intermediate');
  const ranged = Engine.schemes['jbb-hyp'].accessory(hypBlock(), 1, records, 2.5, 'intermediate', [8, 12]);
  assert.strictEqual(ranged.length, plain.length, 'set count identical (autoreg owns sets)');
  assert.ok(ranged.every(s => s.reps === 10 && s.weight === 40), 'DP target: same weight, one more rep');
  assert.ok(ranged.every(s => Array.isArray(s.repRange)), 'sets carry the band for the row display');
  assert.ok(plain.every(s => s.repRange === undefined), 'no range: no new fields');
});

test('ranged sets show the DERIVED effort, not the weekly ramp', () => {
  const records = [rec(3, 40, 12, 8)]; // DP bumps to 42.5 x 8: objectively ~3+ RIR
  const sets = Engine.schemes['jbb-hyp'].accessory(hypBlock(), 2, records, 2.5, 'intermediate', [8, 12]);
  const e1 = Engine.anchorE1RM(records, 8);
  assert.strictEqual(sets[0].rpe, Engine.impliedRpe(e1, sets[0].weight, sets[0].reps));
  assert.ok(sets[0].rpe < 9, 'a fresh weight jump never claims near-failure');
});

test('jbb-hyp accessory WITHOUT a range is byte-identical (default-path contract)', () => {
  for (const w of [0, 1, 2, 3, 4]) {
    const before = Engine.schemes['jbb-hyp'].accessory(hypBlock(), w, [rec(3, 40, 12, 8)], 2.5, 'intermediate');
    const explicit = Engine.schemes['jbb-hyp'].accessory(hypBlock(), w, [rec(3, 40, 12, 8)], 2.5, 'intermediate', null);
    assert.deepStrictEqual(explicit, before);
    assert.ok(before.every(s => !s.repRange), 'no range fields on the default path');
  }
});

test('fresh ranged lift calibrates from the top of its band', () => {
  const sets = Engine.schemes['jbb-hyp'].accessory(hypBlock(), 0, [], 2.5, 'intermediate', [8, 12]);
  assert.ok(sets.every(s => s.calib), 'calibration ramp');
  assert.strictEqual(sets[0].reps, 12, 'descends from the band top');
});

// ---------------------------------------------------------------------------
// resolveSlot integration: bodybuilding gets ranges, powerbuilding never does
// ---------------------------------------------------------------------------
function firstAcc(p) {
  for (let di = 0; di < p.days.length; di++) {
    const si = p.days[di].slots.findIndex(sl => sl.type === 'acc' && (sl.ex || sl.def));
    if (si >= 0) return { di, si, slot: p.days[di].slots[si] };
  }
  return null;
}

test('bodybuilding accessories resolve with a rep range; powerbuilding stays flat 12s', () => {
  const sBB = withProgram('bodybuilding');
  const accBB = firstAcc(sBB.program);
  sBB.records[accBB.slot.ex || accBB.slot.def] = [rec(3, 40, 9, 8)];
  const rsBB = app.resolveSlot(accBB.slot, 0, 1);
  assert.ok(rsBB.sets.every(s => Array.isArray(s.repRange)), 'bb sets carry the range');

  const sPB = withProgram('powerbuilding');
  const hypIdx = sPB.program.blocks.findIndex(b => b.scheme === 'jbb-hyp');
  const accPB = firstAcc(sPB.program);
  sPB.records[accPB.slot.ex || accPB.slot.def] = [rec(3, 40, 9, 8)];
  const rsPB = app.resolveSlot(accPB.slot, hypIdx, 1);
  assert.ok(rsPB.sets.every(s => s.repRange === undefined && s.reps === 12),
    'powerbuilding hypertrophy accessories stay the flat 12s');
});

test('autoreg contract: volAdj still moves SETS while DP holds the rep target', () => {
  const s = withProgram('bodybuilding');
  const acc = firstAcc(s.program);
  const exId = acc.slot.ex || acc.slot.def;
  s.records[exId] = [rec(3, 40, 9, 8)];
  const base = app.resolveSlot(acc.slot, 0, 1);
  const mv = app.accessoryPrimaryMuscle(exId);
  s.program.volAdj = { [mv]: 1 };
  const adj = app.resolveSlot(acc.slot, 0, 1);
  assert.strictEqual(adj.sets.filter(x => !x.ramp).length,
    base.sets.filter(x => !x.ramp).length + 1, 'one more set from autoreg');
  assert.ok(adj.sets.every(x => x.reps === base.sets[0].reps), 'rep target unchanged');
});

// ---------------------------------------------------------------------------
// e1RM-priced anchors
// ---------------------------------------------------------------------------
test('a swapped bodybuilding lead prices off its own e1RM and peaks on a rep PR', () => {
  const s = withProgram('bodybuilding');
  const day = s.program.days.find(d => d.slots.some(sl => sl.type === 'main'));
  const slot = day.slots.find(sl => sl.type === 'main');
  slot.ex = 'db-incline-bench'; // lead demoted to a DB compound
  s.records['db-incline-bench'] = [rec(3, 50, 10, 8)];
  const wk1 = app.resolveSlot(slot, 0, 1);
  assert.ok(wk1.e1Anchor, 'flagged as e1RM-anchored');
  const e1 = Engine.anchorE1RM(s.records['db-incline-bench'], 10);
  assert.strictEqual(wk1.sets[0].weight, Engine.weightFor(e1, 10, 8, app.loadingFor('db-incline-bench').totalInc),
    'priced off the swapped lift, not the barbell WM');
  const wk4 = app.resolveSlot(slot, 0, 3);
  assert.ok(!wk4.sets.some(x => x.amrap), 'no WM-calibrating AMRAP off the barbell');
  const top = wk4.sets[wk4.sets.length - 1];
  assert.ok(top.repPR && top.noteKey === 'rep_pr', 'peaks on a rep-PR top set');
});

test('the un-swapped barbell anchor keeps the WM wave and its AMRAP', () => {
  const s = withProgram('bodybuilding');
  const day = s.program.days.find(d => d.slots.some(sl => sl.type === 'main'));
  const slot = day.slots.find(sl => sl.type === 'main');
  s.program.wm[slot.lift] = 100;
  const wk4 = app.resolveSlot(slot, 0, 3);
  assert.ok(!wk4.e1Anchor);
  assert.ok(wk4.sets.some(x => x.amrap), 'barbell anchor still calibrates via AMRAP');
});

test('a swapped main on a STRENGTH track still takes the WM path', () => {
  const s = withProgram('powerlifting');
  const day = s.program.days.find(d => d.slots.some(sl => sl.type === 'main'));
  const slot = day.slots.find(sl => sl.type === 'main');
  s.program.wm[slot.lift] = 100;
  slot.ex = 'db-incline-bench';
  const rs = app.resolveSlot(slot, 0, 1);
  assert.ok(!rs.e1Anchor, 'e1RM anchoring is bodybuilding-only');
  delete slot.ex;
});

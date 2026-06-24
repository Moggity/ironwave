/* ============================================================
   IRONWAVE — test/timeline.test.js
   Macrocycle timeline v2 (Epic G1/G3). The per-block phase model
   and the bar-color emphasis mapping are display-only and additive,
   so they must not touch prescription (covered by golden-master);
   here we pin the phase backfill and the emphasis-color rules.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();

test('stampBlockPhase backfills a default phase from block type', () => {
  const blocks = [
    { type: 'hypertrophy', scheme: 'jbb-hyp' },
    { type: 'strength', scheme: 'jm2-wave' },
    { type: 'peaking', scheme: 'jm2-wave' },
  ];
  app.stampBlockPhase(blocks);
  assert.strictEqual(blocks[0].phase, 'lean-gain');
  assert.strictEqual(blocks[1].phase, 'maintenance');
  assert.strictEqual(blocks[2].phase, 'peak');
});

test('stampBlockPhase is idempotent and respects an explicit phase', () => {
  const blocks = [{ type: 'hypertrophy', scheme: 'jbb-hyp', phase: 'cut' }];
  app.stampBlockPhase(blocks);
  assert.strictEqual(blocks[0].phase, 'cut', 'an already-set phase is left alone');
});

test('barColorFor: strength is always orange regardless of phase', () => {
  const c = app.barColorFor({ type: 'strength', scheme: 'jm2-wave', phase: 'cut' });
  assert.strictEqual(c, app.BLOCK_COLORS.strength);
});

test('barColorFor: a deficit phase reads teal, a peak reads red, building reads blue', () => {
  const hyp = { type: 'hypertrophy', scheme: 'jbb-hyp' };
  assert.strictEqual(app.barColorFor({ ...hyp, phase: 'cut' }), app.BLOCK_COLORS.bridge);
  assert.strictEqual(app.barColorFor({ ...hyp, phase: 'minicut' }), app.BLOCK_COLORS.bridge);
  assert.strictEqual(app.barColorFor({ ...hyp, phase: 'peak' }), app.BLOCK_COLORS.peaking);
  assert.strictEqual(app.barColorFor({ ...hyp, phase: 'lean-gain' }), app.BLOCK_COLORS.hypertrophy);
  assert.strictEqual(app.barColorFor({ ...hyp, phase: 'gain' }), app.BLOCK_COLORS.hypertrophy);
});

test('every phase has a label and a timeline color', () => {
  for (const ph of Object.keys(app.PHASE_LABELS)) {
    assert.ok(app.PHASE_COLORS[ph], `phase ${ph} needs a timeline color`);
  }
});

// ---- Epic G2: variable macrocycle length ----

test('blocksForWeeks rounds to fixed-length blocks and clamps to a sane range', () => {
  assert.strictEqual(app.blocksForWeeks(25, 5), 5);
  assert.strictEqual(app.blocksForWeeks(12, 5), 2);   // 2.4 -> 2
  assert.strictEqual(app.blocksForWeeks(60, 5), 12);  // clamps high
  assert.strictEqual(app.blocksForWeeks(3, 5), 2);    // clamps low
});

test('extendBlocks cycles the template pattern and renumbers labels', () => {
  const tpl = [
    { type: 'hypertrophy', scheme: 'jbb-hyp' },
    { type: 'strength', scheme: 'jm2-wave' },
  ];
  const out = app.extendBlocks(tpl, 5);
  assert.strictEqual(out.length, 5);
  assert.deepStrictEqual(out.map(b => b.type),
    ['hypertrophy', 'strength', 'hypertrophy', 'strength', 'hypertrophy']);
  assert.deepStrictEqual(out.filter(b => b.type === 'hypertrophy').map(b => b.label),
    ['Hypertrophy 1', 'Hypertrophy 2', 'Hypertrophy 3']);
  out.forEach((b, i) => { tpl[i % 2].mutated = true; assert.ok(!b.mutated, 'blocks are deep-cloned'); });
});

test('makeProgram: a custom length rebuilds the block count, default is untouched', () => {
  const base = { daysPerWeek: 4, track: 'powerbuilding', experience: 'intermediate',
    timeMode: 'unlimited', muscleFocus: {}, maxes: {} };
  const std = app.makeProgram({ ...base });
  assert.strictEqual(std.blocks.length, 5, 'default keeps the template block count');
  const longp = app.makeProgram({ ...base, macroWeeks: 40 });
  assert.strictEqual(longp.blocks.length, 8, '40wk / 5wk per block = 8 blocks');
  assert.ok(longp.testDate > std.testDate, 'a longer macro pushes the test date out');
  assert.ok(longp.blocks.every(b => typeof b.mesoIdx === 'number' && typeof b.phase === 'string'),
    'extended blocks are stamped with mesoIdx + phase');
});

// ---- Epic G5: technique periodization ----

test('scheduledTech: none on intro/accumulation/deload, drop on realization', () => {
  assert.strictEqual(app.Engine.scheduledTech(0, 0), null); // intro
  assert.strictEqual(app.Engine.scheduledTech(1, 0), null); // accumulation
  assert.strictEqual(app.Engine.scheduledTech(3, 0), 'drop'); // realization
  assert.strictEqual(app.Engine.scheduledTech(4, 0), null); // deload
});

test('scheduledTech: myo enters in intensification once adapted, held in a deficit', () => {
  assert.strictEqual(app.Engine.scheduledTech(2, 0), null, 'meso 0 has no myo yet');
  assert.strictEqual(app.Engine.scheduledTech(2, 1), 'myo', 'meso 1 adds a myo week');
  assert.strictEqual(app.Engine.scheduledTech(2, 1, { deficit: true }), null, 'a deficit holds it back');
});

test('scheduledTechForBlock: bodybuilding hypertrophy only, never on strength or other tracks', () => {
  const bb = { scheme: 'jbb-hyp', mesoIdx: 1, phase: 'lean-gain' };
  assert.strictEqual(app.scheduledTechForBlock(bb, 3, true), 'drop');
  assert.strictEqual(app.scheduledTechForBlock(bb, 3, false), null, 'not on a non-bb track');
  const str = { scheme: 'jm2-wave', mesoIdx: 1, phase: 'maintenance' };
  assert.strictEqual(app.scheduledTechForBlock(str, 3, true), null, 'never on a strength block');
});

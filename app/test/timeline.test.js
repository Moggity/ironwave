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

// ---- Epic G6: goal archetypes ----

test('applyArchetypePhases cycles the archetype phase sequence across blocks', () => {
  const blocks = Array.from({ length: 5 }, () => ({ phase: 'lean-gain' }));
  app.applyArchetypePhases(blocks, 'serious-macro');
  assert.deepStrictEqual(blocks.map(b => b.phase),
    ['lean-gain', 'lean-gain', 'minicut', 'gain', 'gain']);
  const two = Array.from({ length: 2 }, () => ({ phase: 'lean-gain' }));
  app.applyArchetypePhases(two, 'lean-asap');
  assert.deepStrictEqual(two.map(b => b.phase), ['minicut', 'cut']);
});

test('applyArchetypePhases is a no-op for an unknown archetype', () => {
  const blocks = [{ phase: 'lean-gain' }];
  app.applyArchetypePhases(blocks, 'nope');
  assert.strictEqual(blocks[0].phase, 'lean-gain');
});

test('makeProgram: a lean-asap bodybuilding program is short and deficit-phased', () => {
  app.S = app.defaultState(); // the bodybuilding generator reads global S (customEx)
  const p = app.makeProgram({ daysPerWeek: 4, track: 'bodybuilding', experience: 'intermediate',
    timeMode: 'unlimited', muscleFocus: {}, maxes: {}, goalArchetype: 'lean-asap', macroWeeks: 12 });
  assert.strictEqual(p.blocks.length, 2, '12wk / 5 = 2 blocks');
  assert.deepStrictEqual(p.blocks.map(b => b.phase), ['minicut', 'cut']);
  assert.ok(p.blocks.every(b => app.PHASE_DEFICIT[b.phase]), 'every block is a deficit phase');
});

test('makeProgram: an archetype only reshapes the bodybuilding track', () => {
  const pb = app.makeProgram({ daysPerWeek: 4, track: 'powerbuilding', experience: 'intermediate',
    timeMode: 'unlimited', muscleFocus: {}, maxes: {}, goalArchetype: 'lean-asap' });
  // Powerbuilding ignores the archetype: phases stay the type-derived defaults.
  assert.strictEqual(pb.blocks[0].phase, 'lean-gain');
  assert.strictEqual(pb.blocks[3].phase, 'maintenance');
});

// ---- Epic G4: block plan editor ----

test('relabelBlocks renumbers each type in order', () => {
  const blocks = [{ type: 'hypertrophy' }, { type: 'strength' }, { type: 'hypertrophy' }];
  app.relabelBlocks(blocks);
  assert.deepStrictEqual(blocks.map(b => b.label),
    ['Hypertrophy 1', 'Strength 1', 'Hypertrophy 2']);
});

test('commitPlan keeps locked blocks, appends the draft, restamps and recomputes the date', () => {
  const program = { startDate: 0, weeksPerBlock: 5,
    blocks: [{ type: 'hypertrophy', scheme: 'jbb-hyp', wave: '8s', phase: 'lean-gain' }] };
  const locked = program.blocks.slice(0, 1);
  const draft = [
    { type: 'strength', scheme: 'jm2-wave', wave: '5s', phase: 'maintenance' },
    { type: 'hypertrophy', scheme: 'jbb-hyp', wave: '8s', phase: 'cut' },
  ];
  const { blocks, testDate } = app.commitPlan(program, locked, draft);
  assert.strictEqual(blocks.length, 3);
  assert.deepStrictEqual(blocks.map(b => b.label), ['Hypertrophy 1', 'Strength 1', 'Hypertrophy 2']);
  assert.deepStrictEqual(blocks.map(b => b.phase), ['lean-gain', 'maintenance', 'cut']);
  // mesoIdx restamped per scheme across the whole list.
  assert.deepStrictEqual(blocks.filter(b => b.scheme === 'jbb-hyp').map(b => b.mesoIdx), [0, 1]);
  assert.strictEqual(testDate, 3 * 5 * 7 * 864e5, 'test date follows the new block count');
});

test('commitPlan does not mutate the locked source blocks', () => {
  const locked = [{ type: 'hypertrophy', scheme: 'jbb-hyp', wave: '8s', phase: 'lean-gain', label: 'Hypertrophy 1' }];
  const snapshot = JSON.parse(JSON.stringify(locked));
  app.commitPlan({ startDate: 0, weeksPerBlock: 5 }, locked, [app.newPlanBlock()]);
  assert.deepStrictEqual(locked, snapshot, 'locked blocks are cloned, not mutated');
});

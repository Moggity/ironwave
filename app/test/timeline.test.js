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

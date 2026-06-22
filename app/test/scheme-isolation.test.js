/* ============================================================
   IRONWAVE — test/scheme-isolation.test.js
   Scheme isolation (future-work testing item 3). The engine must
   never blend methodologies: schemeFor routes purely on
   block.scheme (with a type-based default only when scheme is
   absent), and the jm2-wave and jbb-hyp prescriptions are
   independent code paths that produce structurally different work.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine } = app;

test('schemeFor routes on block.scheme', () => {
  assert.strictEqual(Engine.schemeFor({ scheme: 'jm2-wave' }), Engine.schemes['jm2-wave']);
  assert.strictEqual(Engine.schemeFor({ scheme: 'jbb-hyp' }), Engine.schemes['jbb-hyp']);
});

test('block.scheme wins over block.type', () => {
  // An explicit scheme is authoritative even when the type would imply another.
  assert.strictEqual(
    Engine.schemeFor({ scheme: 'jm2-wave', type: 'hypertrophy' }),
    Engine.schemes['jm2-wave']
  );
  assert.strictEqual(
    Engine.schemeFor({ scheme: 'jbb-hyp', type: 'strength' }),
    Engine.schemes['jbb-hyp']
  );
});

test('type-based default only applies when scheme is absent', () => {
  assert.strictEqual(Engine.schemeFor({ type: 'hypertrophy' }), Engine.schemes['jbb-hyp']);
  assert.strictEqual(Engine.schemeFor({ type: 'strength' }), Engine.schemes['jm2-wave']);
});

test('an unknown scheme falls back to jm2-wave, never undefined', () => {
  assert.strictEqual(Engine.schemeFor({ scheme: 'does-not-exist' }), Engine.schemes['jm2-wave']);
  assert.ok(Engine.schemeFor({}));
});

test('the two registered schemes are distinct implementations', () => {
  const a = Engine.schemes['jm2-wave'];
  const b = Engine.schemes['jbb-hyp'];
  assert.notStrictEqual(a, b);
  assert.notStrictEqual(a.main, b.main);
  assert.notStrictEqual(a.weekVolume, b.weekVolume);
});

test('the schemes do not blend: same block, different week-2 structure', () => {
  // Same inputs through each scheme must not converge on one methodology.
  // jm2 accumulation = WAVES[wave].acc.sets fixed-percentage sets (5 for 10s);
  // jbb week 2 (idx 1) = JBB_HYP.mainSets[0][1] = 4 sets. Different by construction.
  const block = { wave: '10s', type: 'hypertrophy', mesoIdx: 0 };
  const jm2 = Engine.schemes['jm2-wave'].main(block, 1, 100, 2.5);
  const jbb = Engine.schemes['jbb-hyp'].main(block, 1, 100, 2.5);
  assert.strictEqual(jm2.length, 5);
  assert.strictEqual(jbb.length, 4);
  assert.notStrictEqual(jm2.length, jbb.length);
});

test('only jbb-hyp emits a mid-block AMRAP; jm2 reserves it for realization', () => {
  const block = { wave: '10s', type: 'hypertrophy', mesoIdx: 0 };
  const hasAmrap = sets => sets.some(s => s.amrap);

  // Week 4 (idx 3): jbb peaks with an AMRAP; jm2 at the same index is its
  // realization week and also AMRAPs — both legitimate, so compare a volume week.
  // Week 2 (idx 1): jbb is a plain volume week (no AMRAP); jm2 accumulation (no AMRAP).
  assert.strictEqual(hasAmrap(Engine.schemes['jbb-hyp'].main(block, 1, 100, 2.5)), false);
  assert.strictEqual(hasAmrap(Engine.schemes['jm2-wave'].main(block, 1, 100, 2.5)), false);

  // jbb week 4 is an AMRAP peak; jm2 only AMRAPs in its realization week (idx 3).
  assert.strictEqual(hasAmrap(Engine.schemes['jbb-hyp'].main(block, 3, 100, 2.5)), true);
  assert.strictEqual(hasAmrap(Engine.schemes['jm2-wave'].main(block, 2, 100, 2.5)), false);
});

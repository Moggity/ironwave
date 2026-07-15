/* ============================================================
   IRONWAVE — test/h6.test.js
   [Epic H6] Meet prep:
   - per-block week counts (block.weeks) with every helper falling
     back to the program-wide weeksPerBlock (default path identical),
   - a meet date plans backward: standard blocks + a real 2-week
     jm2-peak taper last, test date = meet date,
   - the jm2-peak scheme: openers week, meet-week primer, no
     accessories/secondary, no AMRAP, scheme isolation intact,
   - Engine.attempts from the athlete's own e1RM,
   - the meet-day view assembles.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine } = app;

const FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };
const WK = 7 * 864e5;

function withProgram(over) {
  const s = app.defaultState();
  app.S = s;
  s.program = app.makeProgram(Object.assign({ daysPerWeek: 4, track: 'powerlifting',
    experience: 'intermediate', timeMode: 'unlimited', muscleFocus: { ...FOCUS }, maxes: {} }, over || {}));
  app.V = { dayIdx: null, view: 'dashboard', tab: 'dashboard' };
  return s;
}

// ---------------------------------------------------------------------------
// Per-block weeks plumbing
// ---------------------------------------------------------------------------
test('blockWeeks falls back to weeksPerBlock; weeksBefore sums per block', () => {
  const s = withProgram();
  const p = s.program;
  assert.strictEqual(app.blockWeeks(p.blocks[0]), p.weeksPerBlock);
  assert.strictEqual(app.weeksBefore(2), 2 * p.weeksPerBlock, 'default math unchanged');
  p.blocks[0].weeks = 2;
  assert.strictEqual(app.weeksBefore(2), 2 + p.weeksPerBlock, 'a short block shortens the runway');
  assert.strictEqual(app.totalProgramWeeks(),
    2 + (p.blocks.length - 1) * p.weeksPerBlock);
});

test('the pointer wraps a 2-week block after week 1', () => {
  const s = withProgram({ meetDate: Date.now() + 12 * WK });
  const p = s.program;
  p.pointer.block = p.blocks.length - 1; // the taper
  p.pointer.week = 1;
  app.advanceWeek();
  assert.strictEqual(p.pointer.block, p.blocks.length, 'program done after meet week');
});

// ---------------------------------------------------------------------------
// Meet date planning
// ---------------------------------------------------------------------------
test('a meet date appends a 2-week jm2-peak taper and becomes the test date', () => {
  const meet = Date.now() + 12 * WK;
  const s = withProgram({ meetDate: meet });
  const p = s.program;
  const last = p.blocks[p.blocks.length - 1];
  assert.strictEqual(last.scheme, 'jm2-peak');
  assert.strictEqual(last.weeks, 2);
  assert.strictEqual(last.phase, 'peak');
  assert.strictEqual(p.testDate, meet, 'the countdown now ends at the meet');
  assert.strictEqual(p.meetDate, meet);
  assert.strictEqual(p.blocks.length - 1, 2, '10 weeks of runway fills 2 standard blocks');
});

test('no meet date: no taper block, no meetDate field (default shape intact)', () => {
  const s = withProgram();
  const p = s.program;
  assert.ok(!p.blocks.some(b => b.scheme === 'jm2-peak'));
  assert.ok(!('meetDate' in p));
  assert.ok(p.blocks.every(b => !('weeks' in b)));
});

test('a bodybuilding track ignores a meet date', () => {
  const s = withProgram({ track: 'bodybuilding', meetDate: Date.now() + 12 * WK });
  assert.ok(!s.program.blocks.some(b => b.scheme === 'jm2-peak'));
});

test('a too-close meet date is ignored', () => {
  const s = withProgram({ meetDate: Date.now() + 2 * WK });
  assert.ok(!s.program.blocks.some(b => b.scheme === 'jm2-peak'));
});

// ---------------------------------------------------------------------------
// The jm2-peak scheme
// ---------------------------------------------------------------------------
const taper = { type: 'peaking', scheme: 'jm2-peak', wave: '3s', weeks: 2, mesoIdx: 0 };

test('schemeFor routes a taper block to jm2-peak (isolation intact)', () => {
  assert.strictEqual(Engine.schemeFor(taper), Engine.schemes['jm2-peak']);
  assert.strictEqual(Engine.schemeFor({ type: 'hypertrophy', scheme: 'jbb-hyp' }), Engine.schemes['jbb-hyp']);
});

test('taper week 1 builds to a 91% opener single; meet week is a light primer', () => {
  const wm = 90; // implied max 100
  const wk0 = Engine.schemes['jm2-peak'].main(taper, 0, wm, 2.5);
  assert.strictEqual(wk0.length, 4);
  assert.deepStrictEqual(wk0.map(x => x.reps), [3, 2, 1, 1]);
  assert.strictEqual(wk0[3].weight, Engine.roundLoad(100 * 0.91, 2.5), 'opener single at ~91%');
  assert.ok(!wk0.some(x => x.amrap), 'no AMRAP in a taper');
  const wk1 = Engine.schemes['jm2-peak'].main(taper, 1, wm, 2.5);
  assert.strictEqual(wk1.length, 2);
  assert.ok(wk1.every(x => x.weight <= Engine.roundLoad(70, 2.5)), 'meet week stays light');
});

test('the taper prescribes no secondary and no accessories', () => {
  assert.deepStrictEqual(Engine.schemes['jm2-peak'].secondary(taper, 0, 90, 2.5), []);
  assert.deepStrictEqual(Engine.schemes['jm2-peak'].accessory(taper, 0, [], 2.5), []);
});

test('an uncalibrated taper lift falls back to the calibration ramp', () => {
  const sets = Engine.schemes['jm2-peak'].main(taper, 0, null, 2.5, 1, 'intermediate');
  assert.ok(sets.every(x => x.calib));
});

// ---------------------------------------------------------------------------
// Attempts + meet-day view
// ---------------------------------------------------------------------------
test('Engine.attempts prices opener/second/third off the e1RM', () => {
  const at = Engine.attempts(200, 2.5);
  assert.deepStrictEqual(at, {
    opener: Engine.roundLoad(182, 2.5),
    second: Engine.roundLoad(194, 2.5),
    third: Engine.roundLoad(204, 2.5),
  });
  assert.ok(at.opener < at.second && at.second < at.third);
  assert.strictEqual(Engine.attempts(null, 2.5), null);
});

test('the meet-day view lists attempts and warmups for lifts with data', () => {
  const s = withProgram({ meetDate: Date.now() + 12 * WK });
  s.program.wm['comp-squat'] = 180; // implied max 200
  app.V = { view: 'meet', tab: 'dashboard' };
  const html = app.vMeet();
  assert.ok(/meet-attempt/.test(html), 'attempt tiles render');
  const at = Engine.attempts(200, app.loadingFor('comp-squat').totalInc);
  assert.ok(html.includes(`<b>${app.dispW(at.opener)}</b>`), 'opener priced off the implied max');
  assert.ok(/↳/.test(html), 'warmups to the opener listed');
});

test('the peak week label keys exist in the catalog', () => {
  assert.strictEqual(app.t('week.peak_0'), 'Week 1 · Openers');
  assert.strictEqual(app.t('week.peak_1'), 'Meet week');
});

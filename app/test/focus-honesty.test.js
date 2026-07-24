/* ============================================================
   IRONWAVE — test/focus-honesty.test.js
   [B4] The frequency contract, enforced. The intake-QA F7/F8
   judgment probes are promoted here to hard assertions, driven by
   validateFocusWeek (the ONE statement of the generator contract,
   see app.js). Two layers:
   1. Validator fixtures: hand-built weeks prove the checker
      catches each violation class and passes a clean week.
   2. The sweep: every muscle x days 1..7 x slider 0..FOCUS_MAX
      (plus mixed vectors) through generateBodybuildingDays must
      validate clean, plus depth/head-rotation/no-pad/library
      assertions. GATED on the B4 generator (musclePool) so the
      spec can land first (commit 0) and the rewrite runs until
      this file is green.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { validateFocusWeek, FOCUS_KEYS } = app;
app.S = app.defaultState(); // exById consults custom exercises on S

const focusOf = (over) => Object.assign(
  { arms: 0, chest: 0, back: 0, shoulders: 0, glutes: 0, legs: 0, calves: 0 }, over);

// ---------------------------------------------------------------------------
// 1. Validator fixtures (active from commit 0)
// ---------------------------------------------------------------------------
test('validateFocusWeek: a clean 2-day week passes', () => {
  const days = [
    { name: 'A', primary: 'chest', slots: [
      { type: 'main', lift: 'comp-bench' },
      { type: 'acc', def: 'ez-curl' },
    ] },
    { name: 'B', primary: 'arms', slots: [
      { type: 'acc', def: 'triceps-pushdown' },
      { type: 'acc', def: 'cable-fly' },
    ] },
  ];
  const focus = focusOf({ chest: 2, arms: 2 });
  assert.deepStrictEqual(validateFocusWeek(days, focus, 2), []);
});

test('validateFocusWeek: catches the F7 lead monopoly and over-exposure', () => {
  const day = n => ({ name: n, primary: 'arms', slots: [{ type: 'acc', def: 'ez-curl' }] });
  const days = [day('1'), day('2'), day('3'), day('4'), day('5'), day('6')];
  const v = validateFocusWeek(days, focusOf({ arms: 4 }), 6);
  assert.ok(v.some(x => /arms: 6 exposures/.test(x)), 'over-exposure flagged');
  assert.ok(v.some(x => /leads 6 days/.test(x)), 'lead monopoly flagged');
});

test('validateFocusWeek: catches the F8 within-day repeat', () => {
  const days = [{ name: 'A', primary: 'arms', slots: [
    { type: 'acc', def: 'ez-curl' }, { type: 'acc', def: 'ez-curl' },
  ] }];
  const v = validateFocusWeek(days, focusOf({ arms: 1 }), 3);
  assert.ok(v.some(x => /ez-curl repeats within the day/.test(x)));
});

test('validateFocusWeek: catches under-delivery when capacity is left', () => {
  const days = [
    { name: 'A', primary: 'chest', slots: [{ type: 'main', lift: 'comp-bench' }] },
    { name: 'B', primary: 'legs', slots: [{ type: 'main', lift: 'comp-squat' }] },
  ];
  // chest asked for 2x, day B has plenty of room, chest only appears once.
  const v = validateFocusWeek(days, focusOf({ chest: 2, legs: 1 }), 2);
  assert.ok(v.some(x => /chest: 1\/2 exposures with day capacity left/.test(x)));
});

test('validateFocusWeek: slider 0 must appear nowhere; empty weeks need an all-zero excuse', () => {
  const days = [{ name: 'A', primary: 'chest', slots: [
    { type: 'main', lift: 'comp-bench' }, { type: 'acc', def: 'ez-curl' },
  ] }];
  const v = validateFocusWeek(days, focusOf({ chest: 1 }), 3);
  assert.ok(v.some(x => /arms: slider 0 but appears/.test(x)));
  assert.deepStrictEqual(validateFocusWeek([], focusOf({}), 3), [], 'all-zero week may be empty');
  assert.ok(validateFocusWeek([], focusOf({ chest: 2 }), 3).length, 'nonzero focus may not be empty');
});

test('validateFocusWeek: more days than availability is a violation', () => {
  const day = (n, m, id) => ({ name: n, primary: m, slots: [{ type: 'acc', def: id }] });
  const days = [day('1', 'chest', 'cable-fly'), day('2', 'back', 'cable-row'),
                day('3', 'legs', 'leg-extensions'), day('4', 'arms', 'ez-curl')];
  const v = validateFocusWeek(days, focusOf({ chest: 1, back: 1, legs: 1, arms: 1 }), 3);
  assert.ok(v.some(x => /built 4 days for 3 available/.test(x)));
});

// ---------------------------------------------------------------------------
// 2. The generator sweep (gated on the B4 generator landing)
// ---------------------------------------------------------------------------
const READY = typeof app.musclePool === 'function';
const sweep = READY ? test : test.skip;

sweep('sweep: every lone muscle x days x slider keeps the contract', () => {
  const FOCUS_MAX = app.FOCUS_MAX;
  for (const m of FOCUS_KEYS) {
    for (let N = 1; N <= 7; N++) {
      for (let s = 0; s <= FOCUS_MAX; s++) {
        const focus = focusOf({ [m]: s });
        const days = app.generateBodybuildingDays(focus, N);
        const v = validateFocusWeek(days, focus, N);
        assert.deepStrictEqual(v, [], `${m} slider ${s} on ${N} days: ${v.join(' | ')}`);
        if (s > 0 && N > Math.min(s, N)) {
          assert.ok(days.length <= Math.max(1, Math.min(s, N)),
            `${m}@${s} x ${N}: short week (rest days), got ${days.length}`);
        }
      }
    }
  }
});

sweep('sweep: mixed focus vectors keep the contract', () => {
  const vectors = [
    { focus: focusOf({ arms: 2, chest: 2, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 2 }), N: 4 },
    { focus: focusOf({ arms: 1, chest: 1, back: 1, shoulders: 1, glutes: 1, legs: 1, calves: 1 }), N: 2 },
    { focus: focusOf({ arms: 1, chest: 1, back: 1, shoulders: 1, glutes: 1, legs: 1, calves: 1 }), N: 6 },
    { focus: focusOf({ chest: 4, back: 4, legs: 2 }), N: 4 },
    { focus: focusOf({ chest: 3, back: 3, shoulders: 2, arms: 2, legs: 3, glutes: 2, calves: 1 }), N: 5 },
    { focus: focusOf({ legs: 4, glutes: 3, calves: 2 }), N: 7 },
    { focus: focusOf({ chest: 2, back: 2, legs: 2 }), N: 3 },
  ];
  for (const { focus, N } of vectors) {
    const days = app.generateBodybuildingDays(focus, N);
    const v = validateFocusWeek(days, focus, N);
    assert.deepStrictEqual(v, [], `N=${N} ${JSON.stringify(focus)}: ${v.join(' | ')}`);
  }
});

sweep('depth: the owner example (2 days, arms at 4) builds two deep arm days', () => {
  const focus = focusOf({ arms: 4 });
  const days = app.generateBodybuildingDays(focus, 2);
  assert.deepStrictEqual(validateFocusWeek(days, focus, 2), []);
  assert.strictEqual(days.length, 2, 'both days used');
  for (const d of days) {
    const armSlots = d.slots.filter(sl => {
      const ex = app.EXERCISES[sl.def || sl.lift || sl.ex];
      return ex && ['bicep', 'tricep'].includes(ex.movement);
    });
    assert.ok(armSlots.length >= 2, `${d.name}: surplus became depth (${armSlots.length} arm slots)`);
    const heads = new Set(armSlots.map(sl => (app.EXERCISES[sl.def] || {}).head).filter(Boolean));
    assert.ok(heads.size >= 2, `${d.name}: depth spans both biceps and triceps tissue`);
  }
});

sweep('head rotation: a 3x+ muscle alternates emphasis across its days', () => {
  for (const [m, movements, N] of [['arms', ['bicep', 'tricep'], 4], ['chest', ['chest', 'bench'], 4]]) {
    const focus = focusOf({ [m]: 4 });
    const days = app.generateBodybuildingDays(focus, N);
    const weekHeads = new Set();
    for (const d of days) {
      for (const sl of d.slots) {
        const ex = app.EXERCISES[sl.def || sl.lift];
        if (ex && movements.includes(ex.movement) && ex.head) weekHeads.add(ex.head);
      }
    }
    assert.ok(weekHeads.size >= 2, `${m}: week spans ${[...weekHeads].join(',')} (needs 2+ emphasis groups)`);
  }
});

sweep('no-pad: an all-1 week never invents extra exposures to fill time', () => {
  const focus = focusOf({ arms: 1, chest: 1, back: 1, shoulders: 1, glutes: 1, legs: 1, calves: 1 });
  const days = app.generateBodybuildingDays(focus, 6);
  assert.deepStrictEqual(validateFocusWeek(days, focus, 6), []);
  const totalSlots = days.reduce((s, d) => s + d.slots.length, 0);
  assert.ok(totalSlots <= 7, `7 single exposures produce at most 7 slots, got ${totalSlots}`);
});

sweep('library fallthrough: depth never repeats before the library is exhausted', () => {
  // Arms at 4 on 4 days demands more picks than the 6-entry curated pool
  // once depth lands; the F8 fix must reach outside DEFAULT_ACC before any
  // week-level repeat, and within-day repeats are already contract rule 6.
  const focus = focusOf({ arms: 4 });
  const days = app.generateBodybuildingDays(focus, 4);
  assert.deepStrictEqual(validateFocusWeek(days, focus, 4), []);
  const ids = [];
  for (const d of days) for (const sl of d.slots) {
    const ex = app.EXERCISES[sl.def || sl.lift];
    if (ex && ['bicep', 'tricep'].includes(ex.movement)) ids.push(sl.def || sl.lift);
  }
  const distinct = new Set(ids);
  if (ids.length > app.DEFAULT_ACC.arms.length) {
    assert.ok([...distinct].some(id => !app.DEFAULT_ACC.arms.includes(id)),
      'picks reached the library beyond the curated pool');
  }
  assert.ok(distinct.size >= Math.min(ids.length, app.DEFAULT_ACC.arms.length),
    'no repeats before the curated pool is exhausted');
});

sweep('budget honesty: generated days price within the budget assumption', () => {
  // The currency is real only if a generated day costs what the budget
  // charged for it. Build a mid-size plan, resolve a build week, and check
  // each day's estimate against the coach's per-day pricing (15% tolerance).
  const focus = focusOf({ arms: 2, chest: 2, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 2 });
  const s = app.defaultState();
  app.S = s;
  s.profile.landmarks = app.Engine.seedLandmarks('intermediate');
  s.program = app.makeProgram({ daysPerWeek: 4, track: 'bodybuilding',
    experience: 'intermediate', timeMode: 'unlimited', muscleFocus: { ...focus }, maxes: {} });
  for (const l of ['comp-squat', 'comp-bench', 'military-press']) if (!s.program.wm[l]) s.program.wm[l] = 100;
  const perDaySec = app.Engine.coach.exposurePriceSec('main')
    + (app.Engine.coach.focusSpend(focus) / s.program.days.length - 1) * app.Engine.coach.exposurePriceSec('accessory')
    + 180; // session overhead, mirroring focusBudget's accounting
  for (let di = 0; di < s.program.days.length; di++) {
    const entries = app.resolveDayEntries(di, 0, 1).items.map(x => x.rs);
    const est = app.estimateSessionSec(entries, false);
    assert.ok(est <= perDaySec * 1.15,
      `day ${di}: ${Math.round(est / 60)}min exceeds priced ${Math.round(perDaySec * 1.15 / 60)}min`);
  }
});

/* ============================================================
   IRONWAVE — test/master-coach.test.js
   [Epic I5] The master coach arbitrator (Engine.coach): the single
   source of truth when an input or an auto-built routine does not
   make sense. Owner rulings 2026-07-17:
   - bodyweight is 25..300 kg at EVERY surface that logs it,
   - a 1RM outside 20..500 kg is a typo, not a max,
   - the shortest meet runway is one full block + the taper (49 days),
   - a meet 49..75 days out gets a volume lead-in of 2 weeks AT MOST,
   - the meet plan fills strength-first backward from the meet and
     never extends past it (intake-QA F1/F2).
   Through test/load-app.js (no DOM needed).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine, PROGRAM_TEMPLATES } = app;
const coach = Engine.coach;

const DAY = 864e5;
const FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

// ---------------------------------------------------------------------------
// Plausibility checkers
// ---------------------------------------------------------------------------
test('checkBodyweight: 25..300 kg passes, everything else is refused', () => {
  for (const ok of [25, 300, 82.5]) assert.strictEqual(coach.checkBodyweight(ok), null);
  for (const bad of [24.9, 300.1, 0, -80, NaN, Infinity]) {
    const iss = coach.checkBodyweight(bad);
    assert.ok(iss && iss.key === 'val.bw_range', `${bad} refused`);
    assert.deepStrictEqual([iss.params.lo, iss.params.hi], [25, 300]);
  }
});

test('checkMax: 20..500 kg passes, the intake-QA absurdities are refused', () => {
  assert.strictEqual(coach.checkMax('comp-bench', 100), null);
  for (const bad of [1000, 2, 0, -50, NaN]) {
    const iss = coach.checkMax('comp-squat', bad);
    assert.ok(iss && iss.key === 'val.max_range', `${bad} kg refused`);
    assert.strictEqual(iss.params.lift, 'comp-squat', 'the flagged lift is named');
  }
});

test('checkFocus: only the all-zero week is refused', () => {
  assert.strictEqual(coach.checkFocus({ ...FOCUS }), null);
  assert.strictEqual(coach.checkFocus({ ...FOCUS, arms: 0 }), null);
  const zero = Object.fromEntries(Object.keys(FOCUS).map(k => [k, 0]));
  assert.ok(coach.checkFocus(zero), 'all-zero refused');
  assert.strictEqual(coach.checkFocus(null), null, 'no focus map, no verdict');
});

test('the meet runway floor derives from one full block + the taper', () => {
  assert.strictEqual(coach.minMeetRunwayDays(5), 49);
  for (const id of ['powerbuilding', 'powerlifting']) {
    assert.strictEqual(app.TRACK_SPEC[id].intake.meetMinDaysOut,
      coach.minMeetRunwayDays(PROGRAM_TEMPLATES[id].weeksPerBlock),
      `${id} declares the derived floor`);
  }
});

// ---------------------------------------------------------------------------
// The arbitrated meet plan (pre-taper blocks)
// ---------------------------------------------------------------------------
const planWeeks = (plan, wpb) => plan.reduce((a, b) => a + (b.weeks || wpb), 0);

test('a 49-day meet is one full strength block, the heaviest wave (no volume base)', () => {
  for (const id of ['powerbuilding', 'powerlifting']) {
    const tpl = PROGRAM_TEMPLATES[id];
    const plan = coach.meetBlockPlan(49, tpl.blocks, tpl.weeksPerBlock);
    assert.strictEqual(plan.length, 1, `${id}: one block`);
    assert.strictEqual(plan[0].type, 'strength', `${id}: it is strength, not hypertrophy`);
    assert.strictEqual(plan[0].wave, '3s', `${id}: the heaviest wave feeds the taper`);
  }
});

test('a 63-day meet caps the volume lead-in at 2 weeks (owner ruling 49-75 days)', () => {
  const tpl = PROGRAM_TEMPLATES.powerlifting;
  const plan = coach.meetBlockPlan(63, tpl.blocks, tpl.weeksPerBlock);
  assert.strictEqual(plan.length, 2);
  assert.strictEqual(plan[0].type, 'hypertrophy');
  assert.strictEqual(plan[0].weeks, 2, 'the accumulation lead-in is 2 weeks');
  assert.strictEqual(plan[1].type, 'strength');
  assert.strictEqual(planWeeks(plan, tpl.weeksPerBlock) + 2, 9, 'fills the 9-week runway');
});

test('across the whole 49-75 day window no volume phase exceeds 2 weeks', () => {
  const tpl = PROGRAM_TEMPLATES.powerbuilding;
  for (let days = 49; days <= 75; days++) {
    const plan = coach.meetBlockPlan(days, tpl.blocks, tpl.weeksPerBlock);
    const hypWeeks = plan.filter(b => b.type === 'hypertrophy')
      .reduce((a, b) => a + (b.weeks || tpl.weeksPerBlock), 0);
    assert.ok(hypWeeks <= 2, `${days} days: ${hypWeeks} volume weeks`);
    assert.ok(plan.some(b => b.type === 'strength'), `${days} days: carries strength work`);
  }
});

test('the plan never extends past the meet for any valid runway (F1 fixed)', () => {
  for (const id of ['powerbuilding', 'powerlifting']) {
    const tpl = PROGRAM_TEMPLATES[id];
    for (let days = 49; days <= 366; days += 1) {
      const total = planWeeks(coach.meetBlockPlan(days, tpl.blocks, tpl.weeksPerBlock),
        tpl.weeksPerBlock) + coach.bounds.meetTaperWeeks;
      assert.ok(total * 7 <= days, `${id} ${days} days: ${total} weeks fits`);
    }
  }
});

test('even the engine-defense zone below the validator floor stays inside the meet', () => {
  const tpl = PROGRAM_TEMPLATES.powerlifting;
  for (let days = 25; days < 49; days++) {
    const plan = coach.meetBlockPlan(days, tpl.blocks, tpl.weeksPerBlock);
    const total = planWeeks(plan, tpl.weeksPerBlock) + coach.bounds.meetTaperWeeks;
    assert.ok(plan.length >= 1 && total * 7 <= days, `${days} days: ${total} weeks fits`);
  }
});

test('strength blocks sample the wave progression: two blocks run 5s into 3s', () => {
  const tpl = PROGRAM_TEMPLATES.powerbuilding; // strength waves: 5s, 3s
  const plan = coach.meetBlockPlan(84, tpl.blocks, tpl.weeksPerBlock); // 12 weeks
  assert.deepStrictEqual(plan.map(b => b.wave), ['5s', '3s']);
});

test('a full-template runway reproduces the template block order', () => {
  for (const id of ['powerbuilding', 'powerlifting']) {
    const tpl = PROGRAM_TEMPLATES[id];
    const days = (tpl.blocks.length * tpl.weeksPerBlock + 2) * 7;
    const plan = coach.meetBlockPlan(days, tpl.blocks, tpl.weeksPerBlock);
    assert.deepStrictEqual(plan.map(b => [b.type, b.wave]),
      tpl.blocks.map(b => [b.type, b.wave]), `${id} reproduces its template`);
  }
});

// ---------------------------------------------------------------------------
// makeProgram consumes the arbitrated plan
// ---------------------------------------------------------------------------
function meetProgram(days, track) {
  app.S = app.defaultState();
  return app.makeProgram({ daysPerWeek: 4, track: track || 'powerlifting',
    experience: 'intermediate', timeMode: 'unlimited', muscleFocus: { ...FOCUS },
    maxes: {}, meetDate: Date.now() + days * DAY });
}

test('a 49-day meet program is strength + taper and ends AT the meet', () => {
  const p = meetProgram(49);
  assert.deepStrictEqual(p.blocks.map(b => b.scheme), ['jm2-wave', 'jm2-peak']);
  const total = p.blocks.reduce((a, b) => a + (b.weeks || p.weeksPerBlock), 0);
  assert.strictEqual(total, 7, 'one block + taper = the 49-day runway');
  assert.strictEqual(p.testDate, p.meetDate);
});

test('a 63-day meet program carries the 2-week lead-in and relabeled blocks', () => {
  const p = meetProgram(63);
  assert.strictEqual(p.blocks[0].weeks, 2, 'truncated volume lead-in');
  assert.strictEqual(p.blocks[0].scheme, 'jbb-hyp');
  assert.strictEqual(p.blocks[1].scheme, 'jm2-wave');
  assert.strictEqual(p.blocks[2].scheme, 'jm2-peak');
  assert.ok(p.blocks[0].label && p.blocks[1].label, 'blocks are relabeled');
  const total = p.blocks.reduce((a, b) => a + (b.weeks || p.weeksPerBlock), 0);
  assert.ok(total * 7 <= 63, 'the taper is never scheduled after the meet');
});

test('short-runway strength selection replaces the old hypertrophy-only fill (F2 fixed)', () => {
  // Old behavior: extendBlocks cycled from the template start, so a short
  // powerlifting meet plan was hypertrophy base -> taper with ZERO strength.
  const p = meetProgram(56);
  assert.ok(p.blocks.some(b => b.type === 'strength' && b.scheme === 'jm2-wave'),
    'a 56-day meet plan trains strength');
});

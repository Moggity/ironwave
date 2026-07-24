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

test('checkMax: 10..500 kg passes, the intake-QA absurdities are refused', () => {
  assert.strictEqual(coach.checkMax('comp-bench', 100), null);
  for (const bad of [1000, 2, -50, NaN]) {
    const iss = coach.checkMax('comp-squat', bad);
    assert.ok(iss && iss.key === 'val.max_range', `${bad} kg refused`);
    assert.strictEqual(iss.params.lift, 'comp-squat', 'the flagged lift is named');
  }
});

test('checkMax: 10-20 kg is a confirm-level caution, not a refusal (ruling 1e)', () => {
  const iss = coach.checkMax('military-press', 15);
  assert.ok(iss, '15 kg raises a caution');
  assert.strictEqual(iss.level, 'confirm', 'confirm, never error');
  assert.strictEqual(iss.key, 'val.max_low_confirm');
  assert.strictEqual(coach.checkMax('military-press', 20), null, '20 kg passes clean');
  const floor = coach.checkMax('military-press', 10);
  assert.ok(floor && floor.level === 'confirm', '10 kg is in, but asks first');
});

test('checkGoal: beginner + lean-asap is a confirm gate, everything else silent (SS8)', () => {
  const iss = coach.checkGoal('lean-asap', 'beginner');
  assert.ok(iss && iss.level === 'confirm' && iss.key === 'val.goal_beginner_cut');
  assert.strictEqual(coach.checkGoal('lean-asap', 'intermediate'), null);
  assert.strictEqual(coach.checkGoal('recomp', 'beginner'), null);
  assert.strictEqual(coach.checkGoal(null, 'beginner'), null);
  // validateIntake carries it on the experience field at confirm level.
  const issues = app.Engine.validateIntake(
    { bodyweight: 63, track: 'bodybuilding', goalArchetype: 'lean-asap',
      experience: 'beginner', maxes: {} },
    { obSteps: ['welcome', 'goal', 'experience'], intake: {} }, Date.now());
  const g = issues.find(i => i.key === 'val.goal_beginner_cut');
  assert.ok(g && g.field === 'experience' && g.level === 'confirm');
});

test('belowBarLoad: flags only a real prescription under the bar (FPL1)', () => {
  assert.strictEqual(coach.belowBarLoad(17.5, 20), true, 'the S3 press deload exists now');
  assert.strictEqual(coach.belowBarLoad(20, 20), false, 'the empty bar itself is loadable');
  assert.strictEqual(coach.belowBarLoad(60, 20), false);
  assert.strictEqual(coach.belowBarLoad(0, 20), false, 'no weight prescribed yet');
  assert.strictEqual(coach.belowBarLoad(undefined, 20), false);
});

test('lowMaxRounding: a sub-50 kg main tightens coarse rounding to 1.25 (FPL3)', () => {
  assert.strictEqual(coach.lowMaxRounding({ 'military-press': 30 }, 2.5), 1.25);
  assert.strictEqual(coach.lowMaxRounding({ 'military-press': 30, 'comp-squat': 120 }, 2.5), 1.25,
    'the lightest lift drives it');
  assert.strictEqual(coach.lowMaxRounding({ 'comp-squat': 120 }, 2.5), null, 'no light max, no change');
  assert.strictEqual(coach.lowMaxRounding({ 'military-press': 30 }, 1.25), null, 'already fine');
  assert.strictEqual(coach.lowMaxRounding({ 'military-press': 30 }, 0.5), null, 'finer than fine stays');
  assert.strictEqual(coach.lowMaxRounding({}, 2.5), null);
});

// ---------------------------------------------------------------------------
// [B4] The focus budget: sliders as frequency currency
// ---------------------------------------------------------------------------
test('exposure prices derive from TIME_MODEL and stay in a sane band', () => {
  const main = coach.exposurePriceSec('main'), acc = coach.exposurePriceSec('accessory');
  // A silent TIME_MODEL edit that breaks the budget must fail loudly here.
  assert.ok(main >= 20 * 60 && main <= 32 * 60, `main exposure ${main}s in 20-32min`);
  assert.ok(acc >= 10 * 60 && acc <= 16 * 60, `accessory exposure ${acc}s in 10-16min`);
  assert.ok(main > acc, 'a lead costs more than an accessory exposure');
});

test('focusSpend: clamped sum of slider points', () => {
  assert.strictEqual(coach.focusSpend({ arms: 2, chest: 2 }), 4);
  assert.strictEqual(coach.focusSpend({ arms: 9, chest: -3 }), 3, 'clamped to 0..FOCUS_MAX');
  assert.strictEqual(coach.focusSpend({}), 0);
});

test('focusBudget: monotonic in days and time, honest at the owner example', () => {
  // The owner's worked example: 2 days at 50 minutes affords about 4-5 points.
  const tight = coach.focusBudget(2, 50);
  assert.ok(tight >= 3 && tight <= 6, `2 days x 50min = ${tight} points (~4-5)`);
  // More days or more time never buys fewer points.
  for (let d = 1; d < 7; d++) {
    assert.ok(coach.focusBudget(d + 1, 60) >= coach.focusBudget(d, 60), `days ${d}`);
  }
  assert.ok(coach.focusBudget(4, 90) >= coach.focusBudget(4, 45), 'time monotonic');
  // Unlimited time prices at a default session, never infinity: a 7-day
  // unlimited athlete still cannot exceed the global ceilings.
  assert.ok(coach.focusBudget(7, null) <= 7 * app.FOCUS_MAX);
  assert.ok(coach.focusBudget(3, 660) <= 3 * coach.bounds.maxMusclesPerDay,
    'an 11-hour cap is bounded by per-day coherence, not time');
});

test('focusBudget: the even minimum week is always affordable when schedulable', () => {
  for (let d = 3; d <= 7; d++) {
    assert.ok(coach.focusBudget(d, 45) >= 7, `${d} days x 45min affords all sliders at 1`);
  }
  // 2 days x 60min can host its share of 7 exposures, so the floor applies;
  // 2 days x 45min honestly cannot (4 accessory exposures do not fit 45min),
  // so the guarantee correctly stays out of the way.
  assert.ok(coach.focusBudget(2, 60) >= 7, '2 days x 60min affords the even minimum');
  assert.ok(coach.focusBudget(2, 45) < 7, '2 days x 45min honestly cannot host 7 exposures');
  // The default intake (3 days, unlimited, all sliders at the standard 2)
  // must fit, or onboarding would warn out of the box.
  assert.ok(coach.focusBudget(3, null) >= 14, '3 days unlimited affords the all-2 default');
});

test('checkFocusBudget: over-budget carries the honest have/need numbers', () => {
  const focus = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };
  const iss = coach.checkFocusBudget(focus, 2, 50);
  assert.ok(iss && iss.key === 'val.focus_over_budget');
  assert.strictEqual(iss.params.need, 21);
  assert.strictEqual(iss.params.have, coach.focusBudget(2, 50));
  assert.strictEqual(coach.checkFocusBudget({ arms: 2 }, 2, 50), null, 'affordable passes');
  assert.strictEqual(coach.checkFocusBudget(null, 2, 50), null);
});

// ---------------------------------------------------------------------------
// [B4.1] Owner rulings 2026-07-24: sliders are not session length
// ---------------------------------------------------------------------------
test('checkFocusBudget: no time limit means no points, even at maximum spend', () => {
  const maxed = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };
  assert.strictEqual(coach.checkFocusBudget(maxed, 2, null), null, 'unlimited never blocks');
  assert.strictEqual(coach.checkFocusBudget(maxed, 7, undefined), null);
  assert.strictEqual(coach.checkFocusBudget(maxed, 2, 0), null, 'a zero cap is no cap');
  assert.ok(coach.checkFocusBudget(maxed, 2, 50), 'a real cap still prices the plan');
});

test('sessionTargetSec: a short cap is a target, a long cap a ceiling, no cap nothing', () => {
  assert.strictEqual(coach.sessionTargetSec('custom', 50), 50 * 60, '50min cap is a fill target');
  assert.strictEqual(coach.sessionTargetSec('custom', '50'), 50 * 60, 'string caps parse');
  assert.strictEqual(coach.sessionTargetSec('custom', coach.bounds.capTargetMaxMin),
    coach.bounds.capTargetMaxMin * 60, 'the boundary cap still targets');
  assert.strictEqual(coach.sessionTargetSec('custom', coach.bounds.capTargetMaxMin + 1), null,
    'past the boundary the cap is only a ceiling');
  assert.strictEqual(coach.sessionTargetSec('unlimited', null), null);
  assert.strictEqual(coach.sessionTargetSec('unlimited', 50), null, 'no cap mode, no target');
  assert.strictEqual(coach.sessionTargetSec('custom', null), null);
});

test('checkSessionEstimate: unlimited warns past the expected band, never blocks', () => {
  const [lo, hi] = coach.bounds.expectedSessionMin;
  assert.strictEqual(coach.checkSessionEstimate(hi, 'unlimited'), null, 'the band edge is fine');
  assert.strictEqual(coach.checkSessionEstimate(lo - 30, 'unlimited'), null, 'short is never nagged');
  const iss = coach.checkSessionEstimate(hi + 20, 'unlimited');
  assert.ok(iss && iss.key === 'val.session_long', 'past the band it speaks');
  assert.strictEqual(iss.level, 'warn', 'warn, never error');
  assert.deepStrictEqual([iss.params.lo, iss.params.hi], [lo, hi], 'the band rides along');
  assert.strictEqual(coach.checkSessionEstimate(hi + 200, 'custom'), null,
    'capped athletes belong to the cap machinery');
});

test('rebalanceFocus: deterministic, ratio-preserving, floors at 1, never grows', () => {
  const ask = { arms: 3, chest: 3, back: 2, shoulders: 2, glutes: 1, legs: 3, calves: 1 }; // 15 points
  const a = coach.rebalanceFocus(ask, 10), b = coach.rebalanceFocus(ask, 10);
  assert.deepStrictEqual(a, b, 'same input, same output');
  assert.strictEqual(coach.focusSpend(a.focus), 10, 'lands exactly on the budget');
  for (const k of Object.keys(ask)) {
    assert.ok(a.focus[k] <= ask[k], `${k} never grows`);
    if (ask[k] > 0) assert.ok(a.focus[k] >= 1 || coach.focusSpend(ask) > 14, `${k} floors at 1`);
  }
  // The heaviest asks keep the most points (ratios respected).
  assert.ok(a.focus.arms >= a.focus.glutes && a.focus.legs >= a.focus.calves);
  // The delta names every change, from -> to (receipts-ready, never silent).
  assert.ok(a.delta.length > 0);
  for (const d of a.delta) {
    assert.strictEqual(d.from, ask[d.m]);
    assert.strictEqual(d.to, a.focus[d.m]);
    assert.ok(d.to < d.from);
  }
  // A fitting focus is identity with an empty delta.
  const fit = coach.rebalanceFocus({ arms: 2, chest: 2 }, 10);
  assert.deepStrictEqual(fit.focus, { arms: 2, chest: 2, back: 0, shoulders: 0, glutes: 0, legs: 0, calves: 0 });
  assert.deepStrictEqual(fit.delta, []);
  // A budget too small even for the 1-floors zeroes the smallest asks last.
  const tiny = coach.rebalanceFocus({ arms: 1, chest: 1, back: 1, shoulders: 1, glutes: 1, legs: 1, calves: 1 }, 4);
  assert.strictEqual(coach.focusSpend(tiny.focus), 4);
  assert.ok(Object.values(tiny.focus).every(v => v === 0 || v === 1));
});

test('wmRaiseCheck: overshooting the logged e1RM offers the smaller raise (SS3)', () => {
  // 60 kg x 6 at RPE 10 -> e1rm 72, implied WM 64.8. A formula raise to 72.5
  // overshoots by >5%; the suggested raise is the implied WM, rounded.
  const xc = coach.wmRaiseCheck(60, 72.5, { weight: 60, reps: 6, rpe: 10 });
  assert.ok(xc, 'overshoot flagged');
  assert.ok(xc.suggested > 60 && xc.suggested < 72.5, 'a smaller, real raise');
  assert.strictEqual(xc.suggested % 1.25, 0, 'on the fine grid');
  // A raise the bar speed supports passes silently.
  assert.strictEqual(coach.wmRaiseCheck(60, 63, { weight: 60, reps: 6, rpe: 10 }), null);
  // Never suggests below the current WM, and never fires without a raise.
  assert.strictEqual(coach.wmRaiseCheck(100, 102.5, { weight: 60, reps: 2, rpe: 10 }), null,
    'implied below current WM: the suggestion would not be a raise');
  assert.strictEqual(coach.wmRaiseCheck(100, 100, { weight: 100, reps: 10, rpe: 10 }), null);
});

test('checkMax: 0 means bodyweight only and lands on the calibration path', () => {
  assert.strictEqual(coach.checkMax('comp-squat', 0), null, '0 is a legitimate answer');
  // makeProgram already treats a falsy max as "no working max": week 1 calibrates
  app.S = app.defaultState();
  const p = app.makeProgram({ daysPerWeek: 4, track: 'powerlifting',
    experience: 'intermediate', timeMode: 'unlimited', muscleFocus: { ...FOCUS },
    maxes: { 'comp-squat': 0, 'comp-bench': 100 } });
  assert.strictEqual(p.wm['comp-squat'], null, 'a 0 max stays uncalibrated');
  assert.ok(p.wm['comp-bench'] > 0, 'a real max still seeds the working max');
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

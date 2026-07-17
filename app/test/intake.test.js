/* ============================================================
   IRONWAVE — test/intake.test.js
   [Epic I] Track contracts and intake integrity (slices I1 + I2):
   - TRACK_SPEC covers every onboarding track; the step pipeline is
     data-driven (strength tracks ask the meet, bodybuilding asks
     focus, neither leaks into the other),
   - Engine.validateIntake refuses the absurd inputs the old flow
     accepted silently (a 10 minute powerlifting cap, a meet date
     tomorrow, a meet over a year out, a custom cap left empty),
   - obNext gates on those errors (the step does not advance) and a
     valid strength flow builds the meet program (jm2-peak taper),
   - meetChoice 'none' builds the default program shape (no meetDate).
   Through test/load-app.js (no DOM needed).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine, TRACK_SPEC } = app;

const NOW = Date.UTC(2026, 6, 17); // seeded clock for the pure validator
const DAY = 864e5;
const iso = ts => new Date(ts).toISOString().slice(0, 10);
const FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

// ---------------------------------------------------------------------------
// I1/I2: the track contract table
// ---------------------------------------------------------------------------
test('every onboarding track has a contract with steps and intake limits', () => {
  for (const id of app.OB_TRACKS) {
    const spec = TRACK_SPEC[id];
    assert.ok(spec, `${id} has a TRACK_SPEC entry`);
    assert.ok(Array.isArray(spec.obSteps) && spec.obSteps.length >= 5, `${id} declares steps`);
    assert.ok(spec.intake && spec.intake.minSessionMin > 0, `${id} has a session floor`);
  }
});

test('strength tracks ask the meet; bodybuilding asks focus; neither leaks', () => {
  for (const id of ['powerbuilding', 'powerlifting']) {
    const steps = app.obStepList({ track: id });
    assert.ok(steps.includes('meet'), `${id} asks the meet`);
    assert.ok(!steps.includes('focus'), `${id} does not ask muscle focus`);
    assert.ok(TRACK_SPEC[id].intake.meetMinDaysOut >= 28, `${id} has a meet runway floor`);
  }
  const bb = app.obStepList({ track: 'bodybuilding' });
  assert.ok(bb.includes('focus'), 'bodybuilding asks focus');
  assert.ok(!bb.includes('meet'), 'bodybuilding never asks a meet');
});

test('the shared head of the flow is welcome -> goal on every track', () => {
  for (const id of app.OB_TRACKS) {
    assert.deepStrictEqual(app.obStepList({ track: id }).slice(0, 2), ['welcome', 'goal']);
  }
  assert.deepStrictEqual(app.obStepList({ track: null }).slice(0, 2), ['welcome', 'goal']);
});

// ---------------------------------------------------------------------------
// I1: validateIntake, the absurd-input battery
// ---------------------------------------------------------------------------
const PL = TRACK_SPEC.powerlifting;
const BB = TRACK_SPEC.bodybuilding;
const keysOf = issues => issues.map(i => i.key);

test('a 10 minute powerlifting session cap is refused', () => {
  const issues = Engine.validateIntake({ bodyweight: 80, timeMode: 'custom', timeCapMin: 10, meetChoice: 'none' }, PL, NOW);
  assert.deepStrictEqual(keysOf(issues), ['val.time_min']);
  assert.strictEqual(issues[0].params.min, 45);
});

test('a 45 minute powerlifting cap and a 30 minute bodybuilding cap pass', () => {
  assert.deepStrictEqual(
    Engine.validateIntake({ bodyweight: 80, timeMode: 'custom', timeCapMin: 45, meetChoice: 'none' }, PL, NOW), []);
  assert.deepStrictEqual(
    Engine.validateIntake({ bodyweight: 80, timeMode: 'custom', timeCapMin: 30 }, BB, NOW), []);
});

test('a 20 minute bodybuilding cap is refused (30 minute floor)', () => {
  assert.deepStrictEqual(
    keysOf(Engine.validateIntake({ bodyweight: 80, timeMode: 'custom', timeCapMin: 20 }, BB, NOW)),
    ['val.time_min']);
});

test('custom time mode with no minutes entered is an error, not unlimited', () => {
  assert.deepStrictEqual(
    keysOf(Engine.validateIntake({ bodyweight: 80, timeMode: 'custom', timeCapMin: '', meetChoice: 'none' }, PL, NOW)),
    ['val.time_required']);
});

test('unlimited time mode never raises a time issue', () => {
  assert.deepStrictEqual(
    Engine.validateIntake({ bodyweight: 80, timeMode: 'unlimited', meetChoice: 'none' }, PL, NOW), []);
});

test('a meet date tomorrow is refused with the runway reason', () => {
  const issues = Engine.validateIntake(
    { bodyweight: 80, timeMode: 'unlimited', meetChoice: 'date', meetDate: iso(NOW + DAY) }, PL, NOW);
  assert.deepStrictEqual(keysOf(issues), ['val.meet_too_soon']);
  assert.strictEqual(issues[0].params.min, 49);
});

test('a meet date over a year out is refused', () => {
  assert.deepStrictEqual(
    keysOf(Engine.validateIntake(
      { bodyweight: 80, timeMode: 'unlimited', meetChoice: 'date', meetDate: iso(NOW + 500 * DAY) }, PL, NOW)),
    ['val.meet_too_far']);
});

test('a meet 10 weeks out passes clean', () => {
  assert.deepStrictEqual(
    Engine.validateIntake(
      { bodyweight: 80, timeMode: 'unlimited', meetChoice: 'date', meetDate: iso(NOW + 70 * DAY) }, PL, NOW), []);
});

test('an unanswered meet question blocks; choosing a date without one blocks', () => {
  assert.deepStrictEqual(
    keysOf(Engine.validateIntake({ bodyweight: 80, timeMode: 'unlimited' }, PL, NOW)),
    ['val.meet_choice']);
  assert.deepStrictEqual(
    keysOf(Engine.validateIntake({ bodyweight: 80, timeMode: 'unlimited', meetChoice: 'date' }, PL, NOW)),
    ['val.meet_date_required']);
});

test('bodybuilding never raises meet issues, even with an absurd date on the draft', () => {
  assert.deepStrictEqual(
    Engine.validateIntake({ bodyweight: 80, timeMode: 'unlimited', meetDate: iso(NOW + DAY) }, BB, NOW), []);
});

// ---------------------------------------------------------------------------
// I2: the gates hold through the real handlers (obNext does not advance)
// ---------------------------------------------------------------------------
function draftAt(stepId, ob) {
  app.S = app.defaultState();
  const draft = Object.assign(app.obDefaults(), ob);
  const step = app.obStepList(draft).indexOf(stepId);
  assert.ok(step >= 0, `${stepId} is on this track's pipeline`);
  app.V = { view: 'onboarding', tab: 'dashboard', dayIdx: null,
            libTab: 'alpha', libSearch: '', obStep: step, ob: draft, draft: null };
  return step;
}

test('the meet step refuses to advance on a too-soon date', () => {
  const step = draftAt('meet', { bodyweight: 80, track: 'powerlifting', daysPerWeek: 4, daysMode: 'count',
    meetChoice: 'date', meetDate: iso(Date.now() + 2 * DAY) });
  app.obNext(step);
  assert.strictEqual(app.V.obStep, step, 'still on the meet step');
});

test('the meet step advances on a valid date and on an explicit no-meet', () => {
  let step = draftAt('meet', { bodyweight: 80, track: 'powerlifting', daysPerWeek: 4, daysMode: 'count',
    meetChoice: 'date', meetDate: iso(Date.now() + 70 * DAY) });
  app.obNext(step);
  assert.strictEqual(app.V.obStep, step + 1, 'valid date advances');
  step = draftAt('meet', { bodyweight: 80, track: 'powerlifting', daysPerWeek: 4, daysMode: 'count',
    meetChoice: 'none' });
  app.obNext(step);
  assert.strictEqual(app.V.obStep, step + 1, 'no-meet advances');
});

test('the time step refuses a below-floor cap and accepts one at the floor', () => {
  let step = draftAt('time', { bodyweight: 80, track: 'powerbuilding', daysPerWeek: 4, daysMode: 'count',
    meetChoice: 'none', experience: 'intermediate', timeMode: 'custom', timeCapMin: 10 });
  app.obNext(step);
  assert.strictEqual(app.V.obStep, step, '10 minutes is refused');
  assert.strictEqual(app.V.ob.timeCapMin, 10, 'the typed cap is kept for correction');
  app.V.ob.timeCapMin = 45;
  app.obNext(step);
  assert.strictEqual(app.V.obStep, step + 1, '45 minutes advances');
});

test('a stale Continue for another step is a no-op', () => {
  const step = draftAt('experience', { bodyweight: 80, track: 'powerlifting', daysPerWeek: 4, daysMode: 'count',
    meetChoice: 'none', experience: 'intermediate' });
  app.obNext(step + 2);
  assert.strictEqual(app.V.obStep, step, 'wrong-index click ignored');
});

// ---------------------------------------------------------------------------
// I2: the full strength flow builds the right program shape
// ---------------------------------------------------------------------------
function runFlow(ob) {
  app.S = app.defaultState();
  app.V = { view: 'onboarding', tab: 'dashboard', dayIdx: null,
            libTab: 'alpha', libSearch: '', obStep: 0,
            ob: Object.assign(app.obDefaults(), ob), draft: null };
  const steps = app.obStepList(app.V.ob);
  for (let i = 0; i < steps.length; i++) {
    assert.strictEqual(app.V.obStep, i, `arrived at step ${i} (${steps[i]})`);
    app.obNext(i);
  }
  return app.S.program;
}

test('a powerlifting flow with a valid meet date builds the jm2-peak taper', () => {
  const meet = Date.now() + 84 * DAY; // 12 weeks out
  const p = runFlow({ bodyweight: 80, track: 'powerlifting', daysPerWeek: 4, daysMode: 'count',
    experience: 'intermediate', timeMode: 'unlimited',
    meetChoice: 'date', meetDate: iso(meet), muscleFocus: { ...FOCUS } });
  assert.ok(p, 'program created');
  assert.ok(p.meetDate, 'meetDate stored');
  const last = p.blocks[p.blocks.length - 1];
  assert.strictEqual(last.scheme, 'jm2-peak', 'taper block appended');
  assert.strictEqual(last.weeks, 2, 'taper is 2 weeks');
  assert.strictEqual(p.testDate, p.meetDate, 'the countdown ends at the meet');
});

test('a powerlifting flow answering no-meet builds the default shape', () => {
  const p = runFlow({ bodyweight: 80, track: 'powerlifting', daysPerWeek: 4, daysMode: 'count',
    experience: 'intermediate', timeMode: 'unlimited',
    meetChoice: 'none', muscleFocus: { ...FOCUS } });
  assert.ok(p, 'program created');
  assert.ok(!('meetDate' in p), 'no meetDate key');
  assert.ok(p.blocks.every(b => b.scheme !== 'jm2-peak'), 'no taper block');
});

test('a bodybuilding flow never sees the meet step and still asks focus', () => {
  const p = runFlow({ bodyweight: 80, track: 'bodybuilding', goalArchetype: 'recomp',
    daysPerWeek: 4, daysMode: 'count', experience: 'intermediate',
    timeMode: 'unlimited', muscleFocus: { ...FOCUS } });
  assert.ok(p, 'program created');
  assert.ok(!('meetDate' in p), 'no meetDate key');
});

// ---------------------------------------------------------------------------
// I5: the master coach's intake rules (owner rulings 2026-07-17)
// ---------------------------------------------------------------------------
test('bodyweight is required to continue', () => {
  assert.deepStrictEqual(
    keysOf(Engine.validateIntake({ timeMode: 'unlimited', meetChoice: 'none' }, PL, NOW)),
    ['val.bw_required']);
  assert.deepStrictEqual(
    keysOf(Engine.validateIntake({ bodyweight: '', timeMode: 'unlimited', meetChoice: 'none' }, PL, NOW)),
    ['val.bw_required']);
});

test('bodyweight outside 25-300 kg is refused; the bounds pass', () => {
  for (const bad of [10, 24.9, 301, 10000, -80, 0]) {
    assert.deepStrictEqual(
      keysOf(Engine.validateIntake({ bodyweight: bad, timeMode: 'unlimited', meetChoice: 'none' }, PL, NOW)),
      ['val.bw_range'], `${bad} kg refused`);
  }
  for (const ok of [25, 300, 82.5]) {
    assert.deepStrictEqual(
      Engine.validateIntake({ bodyweight: ok, timeMode: 'unlimited', meetChoice: 'none' }, PL, NOW),
      [], `${ok} kg passes`);
  }
});

test('a 1000 kg or 2 kg 1RM is refused; blank stays the calibration path', () => {
  const base = { bodyweight: 80, timeMode: 'unlimited', meetChoice: 'none' };
  assert.deepStrictEqual(
    keysOf(Engine.validateIntake({ ...base, maxes: { 'comp-bench': 1000 } }, PL, NOW)),
    ['val.max_range']);
  assert.deepStrictEqual(
    keysOf(Engine.validateIntake({ ...base, maxes: { 'comp-squat': 2 } }, PL, NOW)),
    ['val.max_range']);
  assert.deepStrictEqual(
    Engine.validateIntake({ ...base, maxes: { 'comp-bench': 100 } }, PL, NOW), []);
  assert.deepStrictEqual(
    Engine.validateIntake({ ...base, maxes: {} }, PL, NOW), []);
});

test('an all-zero focus is a hard block on bodybuilding, not a warning', () => {
  const zero = { arms: 0, chest: 0, back: 0, shoulders: 0, glutes: 0, legs: 0, calves: 0 };
  assert.deepStrictEqual(
    keysOf(Engine.validateIntake({ bodyweight: 80, timeMode: 'unlimited', muscleFocus: zero }, BB, NOW)),
    ['val.focus_all_zero']);
  // a strength track never carries the focus rule (no focus step)
  assert.deepStrictEqual(
    Engine.validateIntake({ bodyweight: 80, timeMode: 'unlimited', meetChoice: 'none', muscleFocus: zero }, PL, NOW),
    []);
});

test('the meet runway floor is 49 days: one full block + the taper', () => {
  assert.deepStrictEqual(
    keysOf(Engine.validateIntake(
      { bodyweight: 80, timeMode: 'unlimited', meetChoice: 'date', meetDate: iso(NOW + 48 * DAY) }, PL, NOW)),
    ['val.meet_too_soon'], '48 days is refused');
  assert.deepStrictEqual(
    Engine.validateIntake(
      { bodyweight: 80, timeMode: 'unlimited', meetChoice: 'date', meetDate: iso(NOW + 49 * DAY) }, PL, NOW),
    [], '49 days passes');
  assert.strictEqual(Engine.coach.minMeetRunwayDays(5), 49, 'the floor derives from the template');
});

test('the welcome step refuses to advance without a plausible bodyweight', () => {
  let step = draftAt('welcome', { track: null });
  app.obNext(step);
  assert.strictEqual(app.V.obStep, step, 'empty bodyweight blocks step 0');
  step = draftAt('welcome', { track: null, bodyweight: 500 });
  app.obNext(step);
  assert.strictEqual(app.V.obStep, step, '500 kg blocks step 0');
  step = draftAt('welcome', { track: null, bodyweight: 80 });
  app.obNext(step);
  assert.strictEqual(app.V.obStep, step + 1, 'a plausible bodyweight advances');
});

test('the maxes step refuses an implausible 1RM and keeps the program unbuilt', () => {
  const step = draftAt('maxes', { bodyweight: 80, track: 'powerlifting', daysPerWeek: 4,
    daysMode: 'count', meetChoice: 'none', experience: 'intermediate', timeMode: 'unlimited',
    maxes: { 'comp-bench': 1000 } });
  app.obNext(step);
  assert.strictEqual(app.S.program, null, 'no program built on an absurd max');
  app.V.ob.maxes['comp-bench'] = 100;
  app.obNext(step);
  assert.ok(app.S.program, 'a plausible max builds the program');
});

test('the focus step refuses the all-zero week', () => {
  const zero = { arms: 0, chest: 0, back: 0, shoulders: 0, glutes: 0, legs: 0, calves: 0 };
  const step = draftAt('focus', { bodyweight: 80, track: 'bodybuilding', goalArchetype: 'recomp',
    daysPerWeek: 4, daysMode: 'count', experience: 'intermediate', timeMode: 'unlimited',
    muscleFocus: zero });
  app.obNext(step);
  assert.strictEqual(app.V.obStep, step, 'all-zero focus blocks');
  app.V.ob.muscleFocus.chest = 3;
  app.obNext(step);
  assert.strictEqual(app.V.obStep, step + 1, 'one raised slider advances');
});

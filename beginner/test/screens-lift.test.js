/* Package 5 flow tests, part 2: the Lift screen (C1-C6, D1, D6, G4).
   Contract in screens-helpers.js. DOM tests self-skip on Node < 20. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const H = require('./screens-helpers');
const { boot, seedState, workout, history, ex, fmt, Coach, BEGINNER_CONFIG, BEGINNER_EXERCISES, KEY, KG_PER_LB, T0, HOUR } = H;

const FIRST = 'Pick a weight you could lift for 12 repetitions. Stop when it gets hard.';

if (H.NODE_MAJOR < 20) {
  test('screens lift DOM tests (skipped: jsdom requires Node >= 20)', { skip: true }, () => {});
} else {
  const lift = async (ids, o = {}) => { const h = await boot({ seed: seedState(o.seed || {}), ...o.boot }); await h.toLift(ids); return h; };
  const ui = () => BEGINNER_CONFIG.ui;
  const counter = (h, n, m) => fmt(h.S.lift.setOf, { n, m });
  const expectPrefill = async (h, id, units = 'kg') => {
    const s = await h.state();
    const w = s.workouts.find(x => x.endedAt === null);
    return Coach.prefill({ exercise: ex(id), workouts: s.workouts, currentWorkoutId: w.id, units, now: h.clock() });
  };

  // ---------- C1 ----------
  test('C1 the Lift screen shows one exercise with name, demo, cue, steppers, set counter and Done', async () => {
    const h = await lift(['db-curl']);
    assert.strictEqual(h.screen(), 'lift');
    assert.strictEqual(h.all('lift-name').length, 1);
    assert.strictEqual(h.val('lift-name'), ex('db-curl').name);
    assert.ok(h.q('lift-demo'));
    assert.strictEqual(h.val('lift-cue'), ex('db-curl').cue);
    for (const id of ['weight-minus', 'weight-plus', 'weight-value', 'reps-minus', 'reps-plus', 'reps-value', 'set-counter', 'lift-done']) assert.ok(h.q(id), 'missing ' + id);
    assert.strictEqual(h.all('pick-card').length, 0);
  });

  test('C1 (LD) a bodyweight exercise has no weight stepper', async () => {
    const h = await lift(['pushup']);
    for (const id of ['weight-minus', 'weight-plus', 'weight-value']) assert.strictEqual(h.q(id), null, id);
    assert.ok(h.q('reps-plus'));
  });

  test('C1 the set counter reads "Set 1 of M" with M from the coach', async () => {
    const h = await lift(['db-curl']);
    const m = Coach.setCount({ exerciseId: 'db-curl', workouts: (await h.state()).workouts, currentWorkoutId: (await h.active()).id });
    assert.strictEqual(h.val('set-counter'), counter(h, 1, m));
  });

  test('C1 a returning exercise counts three sets', async () => {
    const h = await lift(['db-curl'], { seed: { workouts: H.history('db-curl', 10, [10, 10]) } });
    assert.strictEqual(h.val('set-counter'), counter(h, 1, 3));
  });

  // ---------- C2 / D1 ----------
  test('C2 the first time on an exercise the only prompt is the 12 repetitions sentence and the steppers are empty', async () => {
    const h = await lift(['db-curl']);
    assert.strictEqual(h.val('lift-prompt'), FIRST);
    assert.strictEqual(h.val('weight-value'), '');
    assert.strictEqual(h.val('reps-value'), '');
  });

  test('D1 first-time steppers do not state a target: plus goes to one increment and to 1 rep, Done needs reps', async () => {
    const h = await lift(['db-curl']);
    assert.strictEqual(h.q('lift-done').disabled, true);
    await h.click('weight-plus');
    assert.strictEqual(h.num('weight-value'), Coach.incrementKg('db', 'kg'));
    assert.strictEqual(h.q('lift-done').disabled, true, 'weight alone must not enable Done');
    await h.click('reps-plus');
    assert.strictEqual(h.num('reps-value'), 1);
    assert.strictEqual(h.q('lift-done').disabled, false);
  });

  test('C2 a returning exercise is pre-filled from the coach and shows no prompt', async () => {
    const h = await lift(['db-curl'], { seed: { workouts: history('db-curl', 10, [10, 10]) } });
    const p = await expectPrefill(h, 'db-curl');
    assert.strictEqual(h.q('lift-prompt'), null);
    assert.strictEqual(h.num('weight-value'), p.weightKg);
    assert.strictEqual(h.num('reps-value'), p.reps);
  });

  // ---------- C5 sets, swap, add, end ----------
  test('C5 after the last planned set the screen offers One more and Next exercise instead of Done', async () => {
    const h = await lift(['db-curl', 'db-bench']);
    assert.strictEqual(h.val('set-counter'), counter(h, 1, 2));
    await h.logSets(2);
    assert.strictEqual(h.q('lift-done'), null);
    assert.strictEqual(h.val('one-more'), h.S.lift.oneMore);
    assert.strictEqual(h.val('next-exercise'), h.S.lift.nextExercise);
  });

  test('C5 the last exercise offers One more and a finish control', async () => {
    const h = await lift(['db-curl']);
    await h.logSets(2);
    assert.ok(h.q('one-more'));
    assert.ok(h.q('lift-finish'));
    assert.strictEqual(h.q('next-exercise'), null);
  });

  test('C5 more sets than shown are allowed through One more', async () => {
    const h = await lift(['db-curl']);
    await h.logSets(2);
    await h.click('one-more');
    assert.ok(h.q('lift-done'));
    assert.match(h.val('set-counter'), /^Set 3 of \d+$/);
    h.gap();
    await h.click('lift-done');
    assert.strictEqual((await h.active()).sets.length, 3);
  });

  test('C5 fewer sets than shown are allowed: Next exercise after one set keeps it and moves on', async () => {
    const h = await lift(['db-curl', 'db-bench']);
    const first = h.val('lift-name');
    await h.logSets(1);
    await h.click('next-exercise');
    assert.notStrictEqual(h.val('lift-name'), first);
    assert.strictEqual((await h.active()).sets.length, 1);
  });

  test('C5 swap replaces the current exercise through updatePlan and keeps logged sets', async () => {
    const h = await lift(['db-curl', 'db-bench']);
    const before = await h.active();
    await h.logSets(1);
    await h.click('lift-swap');
    const opt = h.all('swap-option')[0];
    assert.ok(opt, 'no swap options');
    const id = opt.getAttribute('data-exercise');
    assert.strictEqual(ex(id).muscle, ex(before.plan[0]).muscle, 'LD: swap stays in the same muscle');
    await h.click(opt);
    const after = await h.active();
    assert.deepStrictEqual(after.plan, [id, ...before.plan.slice(1)]);
    assert.strictEqual(after.sets.length, 1);
    assert.strictEqual(h.val('lift-name'), ex(id).name);
  });

  test('C5 add appends an exercise to the plan', async () => {
    const h = await lift(['db-curl']);
    await h.click('lift-add');
    const opt = h.all('add-option').find(o => o.getAttribute('data-exercise') !== 'db-curl');
    const id = opt.getAttribute('data-exercise');
    await h.click(opt);
    assert.deepStrictEqual((await h.active()).plan, ['db-curl', id]);
  });

  test('C5 end workout is available at any point and keeps everything logged', async () => {
    const h = await lift(['db-curl', 'db-bench']);
    await h.logSets(1);
    await h.click('lift-end');
    const s = await h.state();
    assert.strictEqual(h.screen(), 'done');
    assert.strictEqual(s.workouts.length, 1);
    assert.notStrictEqual(s.workouts[0].endedAt, null);
    assert.strictEqual(s.workouts[0].sets.length, 1);
  });

  // ---------- C3 faces and rest ----------
  test('C3 after Done three optional faces appear and the rest timer starts by itself', async () => {
    const h = await lift(['db-curl']);
    assert.strictEqual(h.q('face-easy'), null);
    assert.strictEqual(h.q('rest-timer'), null);
    await h.logSets(1);
    assert.deepStrictEqual(['face-easy', 'face-good', 'face-hard'].map(id => h.val(id)), ['Easy', 'Good', 'Hard']);
    assert.strictEqual(Number(h.q('rest-timer').getAttribute('data-remaining')), ui().restSec);
    assert.match(h.val('rest-timer'), /\d+:\d\d/);
  });

  for (const [face, effort] of [['face-easy', 'easy'], ['face-good', 'good'], ['face-hard', 'hard']]) {
    test('C3 tapping ' + face + ' stores effort ' + effort + ' on the set just logged', async () => {
      const h = await lift(['db-curl']);
      await h.logSets(1);
      await h.click(face);
      assert.strictEqual((await h.active()).sets[0].effort, effort);
    });
  }

  test('C3 not tapping a face is fine: effort stays unset and the next set logs', async () => {
    const h = await lift(['db-curl']);
    await h.logSets(2);
    const w = await h.active();
    assert.strictEqual(w.sets.length, 2);
    assert.strictEqual(w.sets[0].effort, null);
  });

  test('D6 an Easy first set at 12 reps or more pre-fills the next set from the coach, with no message', async () => {
    const h = await lift(['db-curl']);
    // Search upward for the fewest plus clicks at which the coach's easy rule applies.
    const inc = Coach.incrementKg('db', 'kg');
    const easyAt = k => Coach.prefill({ exercise: ex('db-curl'), units: 'kg', now: h.clock(), currentWorkoutId: 'x',
      workouts: [{ id: 'x', startedAt: h.clock(), endedAt: null, feel: null, plan: ['db-curl'], sets: [{ exerciseId: 'db-curl', weightKg: k * inc, reps: 12, effort: 'easy', at: h.clock() }] }] });
    let clicks = 0;
    for (let k = 1; k <= 60 && !clicks; k++) if (easyAt(k).rule === 'easy') clicks = k;
    assert.ok(clicks > 0, 'precondition: some weight within 60 increments triggers the easy rule');
    await h.clickN('weight-plus', clicks);
    await h.clickN('reps-plus', 12);
    await h.click('lift-done');
    await h.click('face-easy');
    const p = await expectPrefill(h, 'db-curl');
    assert.strictEqual(p.rule, 'easy', 'precondition: the coach applies the easy rule');
    assert.strictEqual(h.num('weight-value'), p.weightKg);
    assert.strictEqual(h.num('reps-value'), p.reps);
    assert.strictEqual(h.q('lift-prompt'), null);
  });

  // ---------- C4 rest timer from timestamps ----------
  const rem = h => Number(h.q('rest-timer').getAttribute('data-remaining'));

  test('C4 a locked phone: after a big clock jump one tick shows the right remaining time', async () => {
    const h = await lift(['db-curl']);
    await h.logSets(1);
    h.clock.advance(30000);
    h.timers.tick(); await h.settle();
    assert.strictEqual(rem(h), ui().restSec - 30);
  });

  test('C4 a visibilitychange alone refreshes the remaining time', async () => {
    const h = await lift(['db-curl']);
    await h.logSets(1);
    h.clock.advance(20000);
    await h.hiddenNote();
    assert.strictEqual(rem(h), ui().restSec - 20);
  });

  test('C4 past the end the timer shows zero (never negative) and the phone vibrates once', async () => {
    const h = await lift(['db-curl']);
    await h.logSets(1);
    h.clock.advance(ui().restSec * 1000 + HOUR);
    h.timers.tick(); await h.settle();
    h.timers.tick(); await h.hiddenNote();
    assert.strictEqual(rem(h), 0);
    assert.strictEqual(h.vib.length, 1);
  });

  test('C4 the rest timer never blocks: the next set can be logged during rest', async () => {
    const h = await lift(['db-curl']);
    await h.logSets(1);
    assert.ok(rem(h) > 0);
    assert.strictEqual(h.q('lift-done').disabled, false);
    h.gap();
    await h.click('lift-done');
    assert.strictEqual((await h.active()).sets.length, 2);
  });

  // ---------- C6 ----------
  test('C6 Done awaits the save before the next render', async () => {
    const h = await boot({ seed: seedState(), gated: true });
    await h.toLift(['db-curl']);
    await h.clickN('reps-plus', 10);
    h.adapter.hold = true;
    await h.click('lift-done');
    assert.strictEqual(h.val('set-counter').slice(0, 5), 'Set 1', 'counter advanced before the write finished');
    assert.strictEqual(h.q('face-easy'), null, 'faces appeared before the write finished');
    h.adapter.release();
    await h.settle();
    assert.strictEqual(h.val('set-counter').slice(0, 5), 'Set 2');
    assert.strictEqual((await h.active()).sets.length, 1);
  });

  test('C6 killing the app mid-workout loses nothing and reopening resumes the same exercise', async () => {
    const h = await lift(['db-curl', 'db-bench']);
    const name = h.val('lift-name');
    await h.logSets(1);
    const h2 = await boot({ adapter: h.adapter, clock: h.clock });
    assert.strictEqual(h2.screen(), 'lift');
    assert.strictEqual(h2.val('lift-name'), name);
    assert.match(h2.val('set-counter'), /^Set 2 of \d+$/);
    assert.strictEqual((await h2.active()).sets.length, 1);
  });

  test('C6 (LD) an open workout older than the stale limit is ended silently, kept, and Pick is shown', async () => {
    const start = T0 - (ui().staleWorkoutHours + 1) * HOUR;
    const w = workout('old', start, [['db-curl', 10, 10]], { open: true, plan: ['db-curl'] });
    const h = await boot({ seed: seedState({ workouts: [w] }) });
    assert.strictEqual(h.screen(), 'pick');
    const s = await h.state();
    assert.strictEqual(s.workouts.length, 1);
    assert.notStrictEqual(s.workouts[0].endedAt, null);
    assert.strictEqual(s.workouts[0].sets.length, 1);
  });

  test('C6 (LD) a recent open workout resumes on Lift', async () => {
    const w = workout('recent', T0 - HOUR, [['db-curl', 10, 10]], { open: true, plan: ['db-curl'] });
    const h = await boot({ seed: seedState({ workouts: [w] }) });
    assert.strictEqual(h.screen(), 'lift');
  });

  test('C6 a failed save does not count the set, keeps the steppers and allows a retry', async () => {
    const h = await boot({ seed: seedState(), gated: true });
    await h.toLift(['db-curl']);
    await h.clickN('reps-plus', 10);
    await h.clickN('weight-plus', 3);
    const kept = [h.val('weight-value'), h.val('reps-value')];
    h.adapter.failNext = 1;
    await h.click('lift-done');
    assert.strictEqual((await h.active()).sets.length, 0);
    assert.strictEqual(h.val('save-error'), h.S.errors.save);
    assert.strictEqual(h.val('set-counter').slice(0, 5), 'Set 1');
    assert.deepStrictEqual([h.val('weight-value'), h.val('reps-value')], kept);
    await h.click('lift-done');
    assert.strictEqual((await h.active()).sets.length, 1);
    assert.strictEqual(h.q('save-error'), null);
  });

  // ---------- G4 units ----------
  test('G4 en-US shows pounds, steps in lb and stores kg', async () => {
    const h = await lift(['db-curl'], { boot: { locale: 'en-US' } });
    assert.strictEqual(h.val('weight-unit'), h.S.units.lb);
    await h.click('weight-plus');
    const step = Coach.incrementKg('db', 'lb') / KG_PER_LB;
    assert.ok(Math.abs(h.num('weight-value') - step) < 1e-9);
    await h.click('reps-plus');
    await h.click('lift-done');
    const set = (await h.active()).sets[0];
    assert.ok(Math.abs(set.weightKg - step * KG_PER_LB) < 1e-6, 'stored kg ' + set.weightKg);
  });

  test('G4 es-AR shows kilograms and stores them unchanged', async () => {
    const h = await lift(['db-curl'], { boot: { locale: 'es-AR' } });
    assert.strictEqual(h.val('weight-unit'), h.S.units.kg);
    await h.click('weight-plus'); await h.click('reps-plus'); await h.click('lift-done');
    assert.strictEqual((await h.active()).sets[0].weightKg, Coach.incrementKg('db', 'kg'));
  });

  test('G4 the region table: US, LR, MM use pounds, GB and a bare language use kilograms', async () => {
    for (const [loc, unit] of [['en-LR', 'lb'], ['my-MM', 'lb'], ['en-GB', 'kg'], ['en', 'kg']]) {
      const h = await lift(['db-curl'], { boot: { locale: loc } });
      assert.strictEqual(h.val('weight-unit'), h.S.units[unit], loc);
    }
  });

  test('G4 a saved unit preference wins over the locale', async () => {
    const h = await lift(['db-curl'], { seed: { units: 'lb' }, boot: { locale: 'es-AR' } });
    assert.strictEqual(h.val('weight-unit'), h.S.units.lb);
  });

  test('G4 a held kg weight is shown on the lb grid, never as 49.6', async () => {
    const h = await lift(['db-curl'], { seed: { workouts: history('db-curl', 22.5, [10, 10]) }, boot: { locale: 'en-US' } });
    const p = await expectPrefill(h, 'db-curl', 'lb');
    const inc = Coach.incrementKg('db', 'lb') / KG_PER_LB;
    const want = Math.round(p.weightKg / KG_PER_LB / inc) * inc;
    assert.strictEqual(h.num('weight-value'), want);
    assert.ok(!/\./.test(h.val('weight-value')), 'shown ' + h.val('weight-value'));
    await h.click('lift-done');
    assert.ok(Math.abs((await h.active()).sets[0].weightKg - want * KG_PER_LB) < 1e-6);
  });
}

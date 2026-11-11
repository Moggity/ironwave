/* ============================================================
   BEGINNER APP, package 7 (Android APK): UI.back() and the rest-end hooks, jsdom tests.
   THIS FILE IS THE SPEC (with platform.test.js and android.test.js). DOM tests self-skip on
   Node < 20 like the other DOM tests. Helpers: screens-helpers.js (boot with { spy: true } records
   the rest hooks in h.plat; h.pendingRest() replays them as a one-slot alarm).

   ---------- LD C: UI.back() (ui.js, exported next to UI.boot) ----------
   UI.back() is SYNCHRONOUS and returns true when it handled the press, false when there is nothing
   to go back to (boot.js then calls platform.exit()). It never writes to the store and never deletes
   a set. Order of handling:
     1. a confirm dialog is open (Pick, data-testid confirm-dialog): same as its "no" button; true.
     2. the swap or add panel is open on Lift: closes it; true.
     3. a write is pending (a Store call that has not settled: Done, Start, End, Finish, Swap...):
        does nothing; true (so the app never closes while a save is in flight).
     4. Done screen: goes to Pick; true.
     5. Lift: goes to Pick; true. LD (Martin has not ruled): the open workout STAYS open with every
        logged set; nothing is written or deleted. A workout with no sets also stays open.
     6. Pick, Goal, or the storage error screen with nothing layered: false.
   LD (the Pick reached by back while a workout is open, the smallest consistent rule): Pick shows
     exactly the open workout's plan (known exercises, in plan order) as cards, ALL ticked, and Start
     RESUMES the open workout: no new workout is created (same workout id, earlier sets still there),
     the ticks are ignored, and Lift opens on the exercise of the newest logged set (the same rule as
     a relaunch). A relaunch (new boot on the same adapter) still resumes on Lift as today.
     Reason: a second workout can never be created while one is open (a store invariant), and
     silently dropping or hiding the ticks is simpler than offering choices a beginner cannot judge.
     NOTE FOR MARTIN: a visible "resume" label is a later design choice; none is required now.

   ---------- LD D: rest end hooks (J4) ----------
   After a SUCCESSFUL Done the UI calls platform.scheduleRestEnd(doneAt + restSec * 1000) exactly once
   (doneAt = the logged set's time, from the injected clock). It calls platform.cancelRestEnd() when the
   rest is replaced or ends early: End workout, Finish, leaving Lift through back, and when the in-app
   timer fires its vibrate (tick or visibilitychange), so the foreground user gets ONE signal, not two.
   A next Done reschedules (the pending signal is replaced; tests judge the net pending time through
   h.pendingRest(), so schedule-then-replace and cancel-then-schedule both pass). After a kill and
   relaunch inside a rest (the REST AFTER KILL rule), and when Start resumes an open workout inside its
   rest, the UI schedules again for the same end time; if the rest is already over it schedules nothing.
   A failed Done schedules nothing. Both hooks are optional on opts.platform (existing screens tests
   pass a platform without them) and are called inside try/catch: a hook that throws or rejects never
   shows an error, never blocks logging and never leaves an unhandled rejection. Nothing is scheduled
   before the first set (A3: no prompt before the first set).
   DEVICE CHECK (cannot be proven in jsdom): the notification fires at the same instant as the in-app
   tick when the app is in the foreground; the cancel on tick removes it, but a few milliseconds of
   overlap on a real phone is possible.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const H = require('./screens-helpers');
const { NODE_MAJOR, boot, seedState, BEGINNER_CONFIG, ex, fakeClock, KEY } = H;

if (NODE_MAJOR < 20) {
  test('J3 back and rest-hook DOM tests (skipped: jsdom requires Node >= 20)', { skip: true }, () => {});
} else {
  const REST_MS = () => BEGINNER_CONFIG.ui.restSec * 1000;
  const clone = x => JSON.parse(JSON.stringify(x));
  const back = h => {
    assert.strictEqual(typeof h.app.UI.back, 'function', 'UI.back is missing');
    return h.app.UI.back();
  };
  // Start with the default ticks, log n sets of the first exercise.
  async function lift(h, n) {
    await h.click('pick-start');
    assert.strictEqual(h.screen(), 'lift');
    if (n) await h.logSets(n);
  }
  // Every set of the open workout exactly once, in order: the shape J3 must never disturb.
  const setsOf = w => w.sets.map(s => [s.exerciseId, s.weightKg, s.reps, s.at]);

  // ======================= nothing to go back to =======================
  test('J3 back on Pick returns false and changes nothing', async () => {
    const h = await boot({ seed: seedState() });
    const before = clone(await h.state());
    assert.strictEqual(back(h), false);
    assert.strictEqual(h.screen(), 'pick');
    assert.deepStrictEqual(await h.state(), before);
  });
  test('J3 back on Goal returns false', async () => {
    const h = await boot({ seed: seedState({ onboarded: false }) });
    assert.strictEqual(h.screen(), 'goal');
    assert.strictEqual(back(h), false);
    assert.strictEqual(h.screen(), 'goal');
  });
  test('J3 back on the storage error screen returns false', async () => {
    const adapter = { get: async () => { throw new Error('no storage'); }, set: async () => {} };
    const h = await boot({ adapter });
    assert.strictEqual(h.screen(), 'error');
    assert.strictEqual(back(h), false);
    assert.strictEqual(h.screen(), 'error');
  });

  // ======================= layers =======================
  test('J3 back closes an open confirm dialog like its no button, returns true, and imports nothing', async () => {
    const h = await boot({ seed: seedState() });
    const before = clone(await h.state());
    h.setPick('{"not":"used"}');
    await h.click('import-btn');
    assert.ok(h.q('confirm-dialog'), 'the confirm dialog must be open');
    assert.strictEqual(back(h), true);
    assert.strictEqual(h.q('confirm-dialog'), null);
    assert.strictEqual(h.screen(), 'pick');
    assert.deepStrictEqual(await h.state(), before);
    assert.strictEqual(back(h), false, 'nothing is layered any more');
  });
  for (const [toggle, option, label] of [['lift-swap', 'swap-option', 'swap'], ['lift-add', 'add-option', 'add']]) {
    test('J3 back closes the ' + label + ' panel on Lift first and keeps the logged sets', async () => {
      const h = await boot({ seed: seedState() });
      await lift(h, 1);
      const before = await h.active();
      await h.click(toggle);
      assert.ok(h.all(option).length > 0, 'the panel must be open');
      assert.strictEqual(back(h), true);
      assert.strictEqual(h.all(option).length, 0, 'panel closed');
      assert.strictEqual(h.screen(), 'lift', 'still on Lift');
      assert.deepStrictEqual(await h.active(), before);
      assert.strictEqual(back(h), true, 'the next press leaves Lift');
      assert.strictEqual(h.screen(), 'pick');
    });
  }
  test('J3 back on the Done screen goes to Pick and keeps the finished workout as it was', async () => {
    const h = await boot({ seed: seedState() });
    await lift(h, 2);
    await h.click('lift-end');
    assert.strictEqual(h.screen(), 'done');
    const before = clone(await h.state());
    assert.strictEqual(back(h), true);
    assert.strictEqual(h.screen(), 'pick');
    assert.deepStrictEqual(await h.state(), before);
    assert.strictEqual(before.workouts.filter(w => w.endedAt === null).length, 0);
    assert.strictEqual(before.workouts[0].sets.length, 2);
    assert.strictEqual(back(h), false);
  });

  // ======================= Lift -> Pick keeps the workout =======================
  test('J3 back on Lift goes to Pick, keeps the workout open and every logged set exactly once', async () => {
    const h = await boot({ seed: seedState() });
    await lift(h, 2);
    const before = clone(await h.state());
    const w0 = before.workouts.find(w => w.endedAt === null);
    assert.strictEqual(w0.sets.length, 2);
    assert.strictEqual(back(h), true);
    assert.strictEqual(h.screen(), 'pick');
    assert.deepStrictEqual(await h.state(), before, 'back must not write anything');
    assert.strictEqual((await h.state()).workouts.length, 1);
  });
  test('J3 back on Lift with no sets logged still keeps the open workout', async () => {
    const h = await boot({ seed: seedState() });
    await lift(h, 0);
    const before = clone(await h.state());
    assert.strictEqual(before.workouts.filter(w => w.endedAt === null).length, 1);
    assert.strictEqual(back(h), true);
    assert.strictEqual(h.screen(), 'pick');
    assert.deepStrictEqual(await h.state(), before);
  });
  test('J3 LD the Pick after back shows the open plan, all ticked, and Start resumes the same workout with its sets', async () => {
    const h = await boot({ seed: seedState() });
    await lift(h, 2);
    const w0 = clone(await h.active());
    const known = w0.plan.filter(id => ex(id));
    back(h);
    await h.settle();
    assert.deepStrictEqual(h.cardIds(), known, 'cards = the open workout plan, in order');
    assert.deepStrictEqual(h.tickedIds(), known, 'all ticked');
    assert.ok(!h.q('pick-start').disabled);
    await h.click('pick-start');
    assert.strictEqual(h.screen(), 'lift');
    const s = await h.state();
    assert.strictEqual(s.workouts.length, 1, 'no second workout');
    const w1 = s.workouts[0];
    assert.strictEqual(w1.id, w0.id);
    assert.deepStrictEqual(setsOf(w1), setsOf(w0), 'earlier sets still present, once each');
    const newest = w0.sets.reduce((a, x) => (a === null || x.at >= a.at ? x : a), null);
    assert.strictEqual(h.val('lift-name'), ex(newest.exerciseId).name);
  });
  test('J3 LD ticks on a Pick reached by back are ignored by Start: the open workout resumes unchanged', async () => {
    const h = await boot({ seed: seedState() });
    await lift(h, 1);
    const w0 = clone(await h.active());
    back(h);
    await h.settle();
    for (const id of h.tickedIds().slice(1)) await h.click(h.tickOf(id));
    await h.click('pick-start');
    assert.strictEqual(h.screen(), 'lift');
    const s = await h.state();
    assert.strictEqual(s.workouts.length, 1);
    assert.deepStrictEqual(s.workouts[0], w0, 'plan and sets exactly as before');
  });
  test('J3 after back a relaunch on the same data still resumes on Lift', async () => {
    const h = await boot({ seed: seedState() });
    await lift(h, 2);
    const w0 = clone(await h.active());
    back(h);
    await h.settle();
    const h2 = await boot({ adapter: h.adapter, clock: h.clock });
    assert.strictEqual(h2.screen(), 'lift');
    assert.deepStrictEqual(setsOf(await h2.active()), setsOf(w0));
  });
  test('J3 pressing back repeatedly never loses a set: Lift to Pick, then false', async () => {
    const h = await boot({ seed: seedState() });
    await lift(h, 2);
    const w0 = clone(await h.active());
    assert.strictEqual(back(h), true);
    assert.strictEqual(back(h), false);
    assert.strictEqual(back(h), false);
    assert.deepStrictEqual(setsOf(await h.active()), setsOf(w0));
  });

  // ======================= pending writes =======================
  test('J3 back while a set is being saved does nothing, returns true, and the set is stored exactly once', async () => {
    const h = await boot({ seed: seedState(), gated: true });
    await h.click('pick-start');
    await h.clickN('reps-plus', 10);
    if (h.q('weight-plus')) await h.click('weight-plus');
    h.adapter.hold = true;
    await h.click('lift-done');
    assert.ok(h.q('lift-done').disabled, 'the save is pending');
    assert.strictEqual(back(h), true);
    assert.strictEqual(h.screen(), 'lift', 'the screen does not change under a pending save');
    h.adapter.release();
    await h.settle();
    assert.strictEqual(h.screen(), 'lift');
    const w = await h.active();
    assert.strictEqual(w.sets.length, 1, 'the set exists exactly once');
  });
  test('J3 back while Start is being saved does nothing and returns true (the app does not close mid-save)', async () => {
    const h = await boot({ seed: seedState(), gated: true });
    h.adapter.hold = true;
    await h.click('pick-start');
    assert.strictEqual(h.screen(), 'pick');
    assert.strictEqual(back(h), true);
    assert.strictEqual(h.screen(), 'pick');
    h.adapter.release();
    await h.settle();
    assert.strictEqual(h.screen(), 'lift');
    assert.strictEqual((await h.state()).workouts.length, 1);
  });
  test('J3 back while End workout is being saved does nothing and the workout ends once with every set', async () => {
    const h = await boot({ seed: seedState(), gated: true });
    await lift(h, 2);
    const before = clone(await h.active());
    h.adapter.hold = true;
    await h.click('lift-end');
    assert.strictEqual(back(h), true);
    assert.strictEqual(h.screen(), 'lift');
    h.adapter.release();
    await h.settle();
    assert.strictEqual(h.screen(), 'done');
    const s = await h.state();
    assert.strictEqual(s.workouts.length, 1);
    assert.deepStrictEqual(setsOf(s.workouts[0]), setsOf(before));
  });

  // ======================= J4: rest end hooks =======================
  const lastDone = async h => {
    if (h.q('reps-value') && h.val('reps-value') === '') await h.clickN('reps-plus', 10);
    if (h.q('weight-plus') && h.val('weight-value') === '') await h.click('weight-plus');
    h.gap();
    const at = h.clock();
    await h.click('lift-done');
    return at;
  };

  test('J4 A3 nothing is scheduled at boot, at Start or before the first Done', async () => {
    const h = await boot({ seed: seedState(), spy: true });
    await lift(h, 0);
    assert.deepStrictEqual(h.plat, []);
  });
  test('J4 a successful Done schedules the rest end exactly once, at doneAt + restSec', async () => {
    const h = await boot({ seed: seedState(), spy: true });
    await lift(h, 0);
    const at = await lastDone(h);
    assert.strictEqual(h.scheduleCalls(), 1);
    assert.strictEqual(h.pendingRest(), at + REST_MS());
    assert.ok(h.q('rest-timer'), 'the in-app timer still shows');
  });
  test('J4 the next Done replaces the pending signal with the new end time, once per Done', async () => {
    const h = await boot({ seed: seedState(), spy: true });
    await lift(h, 0);
    await lastDone(h);
    const at2 = await lastDone(h);
    assert.strictEqual(h.scheduleCalls(), 2);
    assert.strictEqual(h.pendingRest(), at2 + REST_MS());
  });
  test('J4 a failed Done schedules nothing', async () => {
    const h = await boot({ seed: seedState(), spy: true, gated: true });
    await lift(h, 0);
    await h.clickN('reps-plus', 10);
    h.adapter.failNext = 1;
    h.gap();
    await h.click('lift-done');
    assert.ok(h.q('save-error'));
    assert.strictEqual(h.scheduleCalls(), 0);
    assert.strictEqual(h.pendingRest(), null);
    h.gap();
    const at = h.clock();
    await h.click('lift-done');
    assert.strictEqual(h.q('save-error'), null, 'the retry saved');
    assert.strictEqual(h.scheduleCalls(), 1, 'the retry schedules once');
    assert.strictEqual(h.pendingRest(), at + REST_MS());
  });
  test('J4 End workout cancels the pending signal', async () => {
    const h = await boot({ seed: seedState(), spy: true });
    await lift(h, 0);
    await lastDone(h);
    assert.notStrictEqual(h.pendingRest(), null);
    await h.click('lift-end');
    assert.strictEqual(h.screen(), 'done');
    assert.strictEqual(h.pendingRest(), null);
  });
  test('J4 Finish cancels the pending signal', async () => {
    const h = await boot({ seed: seedState(), spy: true });
    await h.toLift([h.cardIds()[0]]);
    await lastDone(h);
    assert.notStrictEqual(h.pendingRest(), null);
    await h.click('lift-finish');
    assert.strictEqual(h.screen(), 'done');
    assert.strictEqual(h.pendingRest(), null);
  });
  test('J4 J3 leaving Lift through back cancels the signal, and resuming inside the rest schedules the same end again', async () => {
    const h = await boot({ seed: seedState(), spy: true });
    await lift(h, 0);
    const at = await lastDone(h);
    back(h);
    await h.settle();
    assert.strictEqual(h.pendingRest(), null);
    await h.click('pick-start');
    assert.strictEqual(h.screen(), 'lift');
    assert.strictEqual(h.pendingRest(), at + REST_MS());
  });
  test('J4 a relaunch inside a rest schedules again for the same end time', async () => {
    const clock = fakeClock();
    const h = await boot({ seed: seedState(), spy: true, clock });
    await lift(h, 0);
    const at = await lastDone(h);
    clock.advance(30000);
    const h2 = await boot({ adapter: h.adapter, clock, spy: true });
    assert.strictEqual(h2.screen(), 'lift');
    assert.ok(h2.q('rest-timer'));
    assert.strictEqual(h2.scheduleCalls(), 1);
    assert.strictEqual(h2.pendingRest(), at + REST_MS());
  });
  test('J4 a relaunch after the rest is over schedules nothing', async () => {
    const clock = fakeClock();
    const h = await boot({ seed: seedState(), spy: true, clock });
    await lift(h, 0);
    await lastDone(h);
    assert.strictEqual(h.scheduleCalls(), 1);
    clock.advance(REST_MS() + 1000);
    const h2 = await boot({ adapter: h.adapter, clock, spy: true });
    assert.strictEqual(h2.screen(), 'lift');
    assert.strictEqual(h2.scheduleCalls(), 0);
    assert.strictEqual(h2.pendingRest(), null);
  });
  test('J4 the in-app vibrate stays once per rest and cancels the device signal so the foreground gets one signal', async () => {
    const h = await boot({ seed: seedState(), spy: true });
    await lift(h, 0);
    await lastDone(h);
    assert.strictEqual(h.scheduleCalls(), 1);
    assert.notStrictEqual(h.pendingRest(), null);
    h.clock.advance(REST_MS());
    h.timers.tick();
    await h.settle();
    assert.deepStrictEqual(h.vib, [BEGINNER_CONFIG.ui.vibrateMs]);
    assert.strictEqual(h.pendingRest(), null);
    h.timers.tick();
    await h.hiddenNote();
    assert.strictEqual(h.vib.length, 1, 'still exactly one vibrate');
  });
  test('J4 returning to a rest that ended in the background vibrates in-app once and cancels the device signal', async () => {
    const h = await boot({ seed: seedState(), spy: true });
    await lift(h, 0);
    await lastDone(h);
    assert.notStrictEqual(h.pendingRest(), null);
    h.clock.advance(REST_MS() + 5000);
    await h.hiddenNote();
    assert.strictEqual(h.vib.length, 1);
    assert.strictEqual(h.pendingRest(), null);
  });
  test('J4 rest hooks that throw or reject never block logging, show no error and leave no rejection', async () => {
    const rej = [];
    const on = e => rej.push(e);
    process.on('unhandledRejection', on);
    try {
      const h = await boot({
        seed: seedState(),
        platform: { scheduleRestEnd: () => { throw new Error('alarm service gone'); }, cancelRestEnd: () => Promise.reject(new Error('nope')) },
      });
      await lift(h, 0);
      await lastDone(h);
      assert.strictEqual(h.q('save-error'), null, 'a hook failure is not a save failure');
      assert.strictEqual((await h.active()).sets.length, 1);
      await lastDone(h);
      assert.strictEqual((await h.active()).sets.length, 2);
      await h.click('lift-end');
      assert.strictEqual(h.screen(), 'done');
      await new Promise(r => setImmediate(r));
      assert.deepStrictEqual(h.errors, []);
    } finally { process.off('unhandledRejection', on); }
    assert.deepStrictEqual(rej, []);
  });
  test('J4 without any rest hooks on the platform (web) nothing breaks and the in-app vibrate still works', async () => {
    const h = await boot({ seed: seedState() });
    await lift(h, 0);
    await lastDone(h);
    h.clock.advance(REST_MS());
    h.timers.tick();
    await h.settle();
    assert.deepStrictEqual(h.vib, [BEGINNER_CONFIG.ui.vibrateMs]);
  });
}

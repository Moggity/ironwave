/* Package 5 round 4: typed weights are never silently changed (N1, G4), the clock going
   backwards never kills Done or the timer (N2, C4/C6), and sanity caps on typed input
   (N3, LD). Contract in screens-helpers.js (ROUND 4 paragraph).
   DOM tests self-skip on Node < 20. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const H = require('./screens-helpers');
const { boot, seedState, workout, history, ex, Coach, BEGINNER_CONFIG, KG_PER_LB, T0, DAY, HOUR } = H;

if (H.NODE_MAJOR < 20) {
  test('screens round 4 DOM tests (skipped: jsdom requires Node >= 20)', { skip: true }, () => {});
} else {
  const ui = () => BEGINNER_CONFIG.ui;
  const lift = async (ids, o = {}) => { const h = await boot({ seed: seedState(o.seed || {}), ...(o.boot || {}) }); await h.toLift(ids); return h; };
  const rem = h => Number(h.q('rest-timer').getAttribute('data-remaining'));

  // The documented lb display rule, computed independently of the UI.
  const lbShown = (kg, id) => {
    const lb = kg / KG_PER_LB;
    const r2 = Math.round(lb * 100) / 100;
    if (Math.abs(r2 * KG_PER_LB - kg) < 1e-6) return r2;
    const inc = Coach.incrementKg(ex(id).equipment, 'lb') / KG_PER_LB;
    return Math.round(lb / inc) * inc;
  };

  // ---------- N1: a typed weight is never silently changed ----------
  for (const typed of [47, 47.5]) {
    test('G4 a typed ' + typed + ' lb is shown unchanged on the next set and the following set stores the same kg', async () => {
      const h = await lift(['db-curl'], { boot: { locale: 'en-US' } });
      await h.type('weight-value', String(typed));
      await h.type('reps-value', '10');
      await h.click('lift-done');
      assert.strictEqual(h.num('weight-value'), typed, 'the next set pre-fill snapped the typed weight');
      h.gap();
      await h.click('lift-done');
      const sets = (await h.active()).sets;
      assert.strictEqual(sets.length, 2);
      assert.ok(Math.abs(sets[0].weightKg - typed * KG_PER_LB) < 1e-6, 'first set stored ' + sets[0].weightKg);
      assert.strictEqual(sets[1].weightKg, sets[0].weightKg, 'the untouched second set changed the weight');
    });
  }

  test('G4 the next session pre-fill shows the coach weight without snapping an exact lb value', async () => {
    const h = await lift(['db-curl'], { boot: { locale: 'en-US' } });
    await h.type('weight-value', '47');
    await h.type('reps-value', '10');
    await h.click('lift-done');
    h.gap();
    await h.click('lift-done');
    await h.click('lift-finish');
    await h.click('done-back');
    h.clock.advance(DAY);
    await h.toLift(['db-curl']);
    const s = await h.state();
    const w = s.workouts.find(x => x.endedAt === null);
    const p = Coach.prefill({ exercise: ex('db-curl'), workouts: s.workouts, currentWorkoutId: w.id, units: 'lb', now: h.clock() });
    assert.ok(p.weightKg > 0, 'precondition: a returning pre-fill');
    assert.ok(Math.abs(h.num('weight-value') - lbShown(p.weightKg, 'db-curl')) < 1e-9, 'shown ' + h.val('weight-value') + ' for ' + p.weightKg + ' kg');
  });

  test('G4 a held kg-native 22.5 kg still shows as 50 lb, never 49.6', async () => {
    const h = await lift(['db-curl'], { seed: { workouts: history('db-curl', 22.5, [10, 10]) }, boot: { locale: 'en-US' } });
    assert.strictEqual(h.val('weight-value'), '50');
  });

  test('G4 a typed off-grid 12.3 kg stays 12.3 on the next set and in the stored sets', async () => {
    const h = await lift(['db-curl']);
    await h.type('weight-value', '12.3');
    await h.type('reps-value', '10');
    await h.click('lift-done');
    assert.strictEqual(h.num('weight-value'), 12.3);
    h.gap();
    await h.click('lift-done');
    const sets = (await h.active()).sets;
    assert.strictEqual(sets[0].weightKg, 12.3);
    assert.strictEqual(sets[1].weightKg, 12.3);
  });

  // ---------- N2: the clock going backwards ----------
  test('C6 Done still logs after the clock moved two minutes back', async () => {
    const h = await lift(['db-curl']);
    await h.logSets(1);
    h.clock.advance(-120000);
    await h.click('lift-done');
    assert.strictEqual((await h.active()).sets.length, 2);
  });

  test('C6 a newest set stamped one hour in the future does not block Done', async () => {
    const w = workout('open', T0 - HOUR, [['db-curl', 10, 10]], { open: true, plan: ['db-curl'] });
    w.sets[0].at = T0 + HOUR;
    const h = await boot({ seed: seedState({ workouts: [w] }) });
    assert.strictEqual(h.screen(), 'lift');
    await h.click('lift-done');
    assert.strictEqual((await h.active()).sets.length, 2);
  });

  test('C4 with a newest set in the future the rest timer is absent or never shows more than restSec', async () => {
    const w = workout('open', T0 - HOUR, [['db-curl', 10, 10]], { open: true, plan: ['db-curl'] });
    w.sets[0].at = T0 + HOUR;
    const h = await boot({ seed: seedState({ workouts: [w] }) });
    if (h.q('rest-timer')) assert.ok(rem(h) <= ui().restSec, 'rest shows ' + rem(h));
    await h.click('lift-done');
    if (h.q('rest-timer')) assert.ok(rem(h) <= ui().restSec, 'rest shows ' + rem(h));
  });

  const resumedAt = async offsetMs => {
    const w = workout('open', T0, [['db-curl', 10, 10]], { open: true, plan: ['db-curl'] });
    return boot({ seed: seedState({ workouts: [w] }), clock: H.fakeClock(T0 + offsetMs) });
  };

  test('C4 a rest is resumed after a kill when now minus the set time is inside the rest', async () => {
    const h = await resumedAt(ui().restSec * 1000 - 1000);
    assert.ok(h.q('rest-timer'), 'rest timer missing');
    assert.strictEqual(rem(h), 1);
  });

  test('C4 a rest is not resumed when the gap is exactly restSec', async () => {
    const h = await resumedAt(ui().restSec * 1000);
    assert.strictEqual(h.q('rest-timer'), null);
  });

  test('C4 a rest is not resumed when the clock is before the newest set', async () => {
    const h = await resumedAt(-1000);
    assert.strictEqual(h.q('rest-timer'), null);
  });

  // ---------- N3: sanity caps ----------
  test('N3 (LD) the config defines maxWeightKg and maxReps', () => {
    assert.ok(typeof ui().maxWeightKg === 'number' && ui().maxWeightKg > 0, 'BEGINNER_CONFIG.ui.maxWeightKg');
    assert.ok(typeof ui().maxReps === 'number' && ui().maxReps > 0, 'BEGINNER_CONFIG.ui.maxReps');
  });

  test('N3 (LD) a typed weight above the cap is restored, one at the cap is accepted', async () => {
    const h = await lift(['db-curl']);
    await h.clickN('weight-plus', 5);
    await h.type('weight-value', String(ui().maxWeightKg + 1));
    assert.strictEqual(h.val('weight-value'), '10');
    await h.type('weight-value', String(ui().maxWeightKg));
    assert.strictEqual(h.num('weight-value'), ui().maxWeightKg);
  });

  test('N3 (LD) the weight cap is compared in kg when the display unit is lb', async () => {
    const h = await lift(['db-curl'], { boot: { locale: 'en-US' } });
    const lbAtCap = ui().maxWeightKg / KG_PER_LB;
    const ok = Math.floor(lbAtCap);
    const over = ok + 1;
    assert.ok(ok * KG_PER_LB <= ui().maxWeightKg && over * KG_PER_LB > ui().maxWeightKg, 'precondition: the lb pair straddles the cap');
    await h.type('weight-value', String(ok));
    assert.strictEqual(h.num('weight-value'), ok);
    await h.type('weight-value', String(over));
    assert.strictEqual(h.num('weight-value'), ok, 'a weight over the kg cap was accepted in lb');
  });

  test('N3 (LD) a typed reps value above the cap is restored, one at the cap is accepted', async () => {
    const h = await lift(['db-curl']);
    await h.clickN('reps-plus', 3);
    await h.type('reps-value', String(ui().maxReps + 1));
    assert.strictEqual(h.val('reps-value'), '3');
    await h.type('reps-value', String(ui().maxReps));
    assert.strictEqual(h.num('reps-value'), ui().maxReps);
  });

  test('N3 (LD) plus stops at the reps cap', async () => {
    const h = await lift(['db-curl']);
    await h.type('reps-value', String(ui().maxReps - 1));
    await h.clickN('reps-plus', 3);
    assert.strictEqual(h.num('reps-value'), ui().maxReps);
  });

  test('N3 (LD) plus stops at the weight cap and the logged weight never exceeds it', async () => {
    const h = await lift(['db-curl']);
    await h.type('weight-value', String(ui().maxWeightKg - 1));
    await h.clickN('weight-plus', 3);
    assert.ok(h.num('weight-value') <= ui().maxWeightKg, 'weight went to ' + h.val('weight-value'));
    await h.type('reps-value', '5');
    await h.click('lift-done');
    assert.ok((await h.active()).sets[0].weightKg <= ui().maxWeightKg);
  });
}

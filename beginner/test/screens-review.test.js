/* Package 5 review round: tests added after an Opus review drove the real UI.
   Contract (including every LD below) lives in screens-helpers.js. Covers:
     C4 rest survives a kill, C6 every failed write is visible, C5/H3 unknown ids,
     typing (LD), no rebuild on taps (LD), double-tap guard (LD), vibration owned by the
     tick (LD), accessible names from single strings (LD), harness hygiene (K2).
   DOM tests self-skip on Node < 20; the loadBeginner hygiene test runs on Node 18. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const H = require('./screens-helpers');
const { boot, seedState, workout, ex, fmt, BEGINNER_CONFIG, BEGINNER_EQUIPMENT, KG_PER_LB, T0, HOUR, Coach } = H;

const ui = () => BEGINNER_CONFIG.ui;

// ---------- K2 harness hygiene (pure Node, runs on Node 18) ----------
test('K2 loadBeginner throws a clear error when the custom folder lacks a required beginner file', () => {
  const { loadBeginner } = require('./load-beginner');
  const ok = H.copyBeginnerDir();
  try { assert.doesNotThrow(() => loadBeginner({ beginnerDir: ok }), 'a full copy must load'); } finally { fs.rmSync(ok, { recursive: true, force: true }); }
  for (const f of ['strings.js', 'coach.js', 'exercises.js']) {
    const dir = H.copyBeginnerDir([f]);
    try {
      assert.throws(() => loadBeginner({ beginnerDir: dir }), e => e instanceof Error && e.message.includes(f), 'no silent fallback for ' + f);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});

if (H.NODE_MAJOR < 20) {
  test('screens review DOM tests (skipped: jsdom requires Node >= 20)', { skip: true }, () => {});
} else {
  const lift = async (ids, o = {}) => { const h = await boot({ seed: seedState(o.seed || {}), ...(o.boot || {}) }); await h.toLift(ids); return h; };
  const rem = h => Number(h.q('rest-timer').getAttribute('data-remaining'));
  const alertOf = h => { const e = h.q('save-error'); return e && e.getAttribute('role') === 'alert' ? e : null; };
  const noErrors = h => assert.deepStrictEqual(h.errors.map(String), [], 'the UI threw');

  test('K2 loadDom throws a clear error when the custom folder lacks a required beginner file', () => {
    const { loadDom } = require('./load-dom');
    for (const f of ['strings.js', 'ui.js', 'coach.js']) {
      const dir = H.copyBeginnerDir([f]);
      try {
        assert.throws(() => loadDom({ beginnerDir: dir }), e => e instanceof Error && e.message.includes(f), 'no silent fallback for ' + f);
      } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    }
  });

  // ---------- C4: rest survives a kill ----------
  test('C4 the rest timer survives a kill: reopening shows the remaining time from the last set', async () => {
    const h = await lift(['db-curl']);
    await h.logSets(1);
    h.clock.advance(30000);
    const h2 = await boot({ adapter: h.adapter, clock: h.clock });
    assert.strictEqual(h2.screen(), 'lift');
    assert.ok(h2.q('rest-timer'), 'rest timer missing after reopen');
    assert.strictEqual(rem(h2), ui().restSec - 30);
  });

  test('C4 a resumed rest vibrates once when it ends', async () => {
    const h = await lift(['db-curl']);
    await h.logSets(1);
    h.clock.advance(30000);
    const h2 = await boot({ adapter: h.adapter, clock: h.clock });
    h2.clock.advance(ui().restSec * 1000);
    h2.timers.tick(); await h2.settle();
    h2.timers.tick(); await h2.settle();
    assert.strictEqual(rem(h2), 0);
    assert.strictEqual(h2.vib.length, 1);
  });

  test('C4 if the rest ended while the app was dead there is no timer and no vibration', async () => {
    const h = await lift(['db-curl']);
    await h.logSets(1);
    h.clock.advance(ui().restSec * 1000 + 5000);
    const h2 = await boot({ adapter: h.adapter, clock: h.clock });
    h2.timers.tick(); await h2.settle();
    assert.strictEqual(h2.screen(), 'lift');
    assert.strictEqual(h2.q('rest-timer'), null);
    assert.strictEqual(h2.vib.length, 0);
  });

  // ---------- C6: every failed write is visible ----------
  const gated = async (seed, ids) => {
    const h = await boot({ seed: seedState(seed || {}), gated: true });
    if (ids) await h.toLift(ids);
    return h;
  };

  test('C6 a failed logSet shows a role=alert save-error', async () => {
    const h = await gated({}, ['db-curl']);
    await h.clickN('reps-plus', 10);
    h.adapter.failNext = 1;
    await h.click('lift-done');
    assert.ok(alertOf(h), 'save-error with role="alert" missing');
  });

  test('C6 a failed goal Continue is visible, keeps the selection and works on retry', async () => {
    const h = await boot({ gated: true });
    await h.click(h.all('goal-tile')[0]);
    h.adapter.failNext = 1;
    await h.click('goal-continue');
    assert.strictEqual(h.screen(), 'goal');
    assert.ok(alertOf(h));
    assert.strictEqual(h.all('goal-tile')[0].getAttribute('aria-pressed'), 'true');
    const s = await h.state();
    assert.ok(!s || s.onboarded === false);
    await h.click('goal-continue');
    assert.strictEqual(h.screen(), 'pick');
    assert.strictEqual(h.q('save-error'), null);
  });

  test('C6 a failed goal Skip is visible and works on retry', async () => {
    const h = await boot({ gated: true });
    h.adapter.failNext = 1;
    await h.click('goal-skip');
    assert.strictEqual(h.screen(), 'goal');
    assert.ok(alertOf(h));
    await h.click('goal-skip');
    assert.strictEqual(h.screen(), 'pick');
  });

  test('C6 a failed Start is visible, keeps the ticks and works on retry', async () => {
    const h = await gated();
    const ticked = h.tickedIds();
    h.adapter.failNext = 1;
    await h.click('pick-start');
    assert.strictEqual(h.screen(), 'pick');
    assert.ok(alertOf(h));
    assert.strictEqual(await h.active(), null);
    assert.deepStrictEqual(h.tickedIds(), ticked);
    await h.click('pick-start');
    assert.strictEqual(h.screen(), 'lift');
    assert.strictEqual(h.q('save-error'), null);
  });

  test('C6 a failed End workout is visible, keeps the sets and works on retry', async () => {
    const h = await gated({}, ['db-curl', 'db-bench']);
    await h.logSets(1);
    h.adapter.failNext = 1;
    await h.click('lift-end');
    assert.strictEqual(h.screen(), 'lift');
    assert.ok(alertOf(h));
    assert.strictEqual((await h.active()).sets.length, 1);
    await h.click('lift-end');
    assert.strictEqual(h.screen(), 'done');
  });

  test('C6 a failed Finish is visible, keeps the sets and works on retry', async () => {
    const h = await gated({}, ['db-curl']);
    await h.logSets(1);
    h.adapter.failNext = 1;
    await h.click('lift-finish');
    assert.strictEqual(h.screen(), 'lift');
    assert.ok(alertOf(h));
    assert.strictEqual((await h.active()).sets.length, 1);
    await h.click('lift-finish');
    assert.strictEqual(h.screen(), 'done');
  });

  test('C6 a failed Swap is visible, keeps the plan and works on retry', async () => {
    const h = await gated({}, ['db-curl', 'db-bench']);
    const before = (await h.active()).plan;
    const name = h.val('lift-name');
    await h.click('lift-swap');
    const opt = h.all('swap-option')[0];
    h.adapter.failNext = 1;
    await h.click(opt);
    assert.strictEqual(h.screen(), 'lift');
    assert.ok(alertOf(h));
    assert.deepStrictEqual((await h.active()).plan, before);
    assert.strictEqual(h.val('lift-name'), name);
    if (!h.all('swap-option').length) await h.click('lift-swap');
    await h.click(h.all('swap-option')[0]);
    assert.notDeepStrictEqual((await h.active()).plan, before);
    assert.strictEqual(h.q('save-error'), null);
  });

  test('C6 a failed Add is visible, keeps the plan and works on retry', async () => {
    const h = await gated({}, ['db-curl']);
    await h.click('lift-add');
    const opt = h.all('add-option')[0];
    h.adapter.failNext = 1;
    await h.click(opt);
    assert.ok(alertOf(h));
    assert.deepStrictEqual((await h.active()).plan, ['db-curl']);
    if (!h.all('add-option').length) await h.click('lift-add');
    await h.click(h.all('add-option')[0]);
    assert.strictEqual((await h.active()).plan.length, 2);
  });

  test('C6 a failed "I don\'t have that here" is visible, keeps the cards and works on retry', async () => {
    const h = await gated();
    const cards = h.cardIds();
    const card = h.all('pick-card').find(c => ex(c.getAttribute('data-exercise')).equipKey !== 'none');
    const key = ex(card.getAttribute('data-exercise')).equipKey;
    h.adapter.failNext = 1;
    await h.click(card.querySelector('[data-testid="pick-missing"]'));
    assert.ok(alertOf(h));
    assert.deepStrictEqual(h.cardIds(), cards);
    assert.deepStrictEqual((await h.state()).excludedEquipment, []);
    await h.click(h.card(card.getAttribute('data-exercise')).querySelector('[data-testid="pick-missing"]'));
    assert.deepStrictEqual((await h.state()).excludedEquipment, [key]);
    assert.strictEqual(h.q('save-error'), null);
  });

  test('C6 a failed restore is visible, keeps the item and works on retry', async () => {
    const h = await gated({ excluded: ['dumbbells'] });
    h.adapter.failNext = 1;
    await h.click('restore-item');
    assert.ok(alertOf(h));
    assert.strictEqual(h.all('restore-item').length, 1);
    assert.deepStrictEqual((await h.state()).excludedEquipment, ['dumbbells']);
    await h.click('restore-item');
    assert.deepStrictEqual((await h.state()).excludedEquipment, []);
  });

  test('C6 a failed "How was that?" answer is visible, stays on Done and works on retry', async () => {
    const h = await gated({}, ['db-curl']);
    await h.logSets(1);
    await h.click('lift-end');
    h.adapter.failNext = 1;
    await h.click('feel-easy');
    assert.strictEqual(h.screen(), 'done');
    assert.ok(alertOf(h));
    assert.strictEqual((await h.state()).workouts[0].feel, null);
    await h.click('feel-easy');
    assert.strictEqual((await h.state()).workouts[0].feel, 'easy');
    assert.strictEqual(h.q('save-error'), null);
  });

  // ---------- C5/H3: unknown exercise ids never freeze the screen ----------
  const withWorkouts = (workouts, o = {}) => boot({ seed: seedState({ workouts, ...o }) });
  const open = (sets, plan) => workout('open', T0 - HOUR, sets, { open: true, plan });

  test('C5 resume skips an unknown id in the plan', async () => {
    const h = await withWorkouts([open([], ['ghost-1', 'db-curl', 'db-bench'])]);
    assert.strictEqual(h.screen(), 'lift');
    assert.strictEqual(h.val('lift-name'), ex('db-curl').name);
    noErrors(h);
  });

  test('C5 resume skips a last set that names an unknown id', async () => {
    const h = await withWorkouts([open([['ghost-1', 10, 10]], ['ghost-1', 'db-curl'])]);
    assert.strictEqual(h.screen(), 'lift');
    assert.strictEqual(h.val('lift-name'), ex('db-curl').name);
    noErrors(h);
  });

  test('C5 Next exercise advances past an unknown id', async () => {
    const h = await withWorkouts([open([], ['db-curl', 'ghost-1', 'db-bench'])]);
    await h.click('next-exercise');
    assert.strictEqual(h.val('lift-name'), ex('db-bench').name);
    noErrors(h);
  });

  test('C5 Swap works when the plan holds an unknown id', async () => {
    const h = await withWorkouts([open([], ['db-curl', 'ghost-1'])]);
    await h.click('lift-swap');
    const opt = h.all('swap-option')[0];
    const id = opt.getAttribute('data-exercise');
    await h.click(opt);
    assert.strictEqual(h.screen(), 'lift');
    assert.strictEqual(h.val('lift-name'), ex(id).name);
    noErrors(h);
  });

  test('C5 Repeat last workout skips unknown ids', async () => {
    const h = await withWorkouts([workout('w1', T0 - 2 * 864e5, [['ghost-1', 10, 10], ['pushup', 0, 10]])]);
    await h.click('pick-repeat');
    assert.deepStrictEqual(h.tickedIds(), ['pushup']);
    noErrors(h);
  });

  test('C5 the Done summary survives unknown ids in the log', async () => {
    const h = await withWorkouts([open([['ghost-1', 10, 10], ['db-curl', 10, 10]], ['ghost-1', 'db-curl'])]);
    await h.click('lift-end');
    assert.strictEqual(h.screen(), 'done');
    assert.ok(h.q('done-summary'));
    noErrors(h);
  });

  // ---------- typing (LD) ----------
  test('C1 (LD) weight and reps values are editable numeric inputs with the right input mode', async () => {
    const h = await lift(['db-curl']);
    const w = h.q('weight-value'), r = h.q('reps-value');
    assert.strictEqual(w.tagName, 'INPUT');
    assert.strictEqual(r.tagName, 'INPUT');
    assert.notStrictEqual(w.type, 'number', 'a comma decimal must be typeable');
    assert.strictEqual(w.getAttribute('inputmode'), 'decimal');
    assert.strictEqual(r.getAttribute('inputmode'), 'numeric');
  });

  test('C1 (LD) a typed weight and reps are logged as typed, off the grid', async () => {
    const h = await lift(['db-curl']);
    await h.type('weight-value', '62.5');
    await h.type('reps-value', '8');
    await h.click('lift-done');
    const s = (await h.active()).sets[0];
    assert.strictEqual(s.weightKg, 62.5);
    assert.strictEqual(s.reps, 8);
  });

  test('C1 (LD) a comma decimal is accepted', async () => {
    const h = await lift(['db-curl']);
    await h.type('weight-value', '62,5');
    await h.type('reps-value', '8');
    await h.click('lift-done');
    assert.strictEqual((await h.active()).sets[0].weightKg, 62.5);
  });

  test('G4 (LD) a typed pound weight is stored as its kg equivalent and shown as typed', async () => {
    const h = await lift(['db-curl'], { boot: { locale: 'en-US' } });
    await h.type('weight-value', '137');
    await h.type('reps-value', '8');
    assert.strictEqual(h.num('weight-value'), 137);
    await h.click('lift-done');
    assert.ok(Math.abs((await h.active()).sets[0].weightKg - 137 * KG_PER_LB) < 1e-6);
  });

  test('C1 (LD) invalid or negative weight input is ignored and the previous value restored', async () => {
    const h = await lift(['db-curl']);
    await h.clickN('weight-plus', 5);
    for (const bad of ['abc', '-5']) {
      await h.type('weight-value', bad);
      assert.strictEqual(h.val('weight-value'), '10', 'after typing ' + bad);
    }
  });

  test('C1 (LD) reps must be an integer of at least 0: bad input restores the previous value', async () => {
    const h = await lift(['db-curl']);
    await h.clickN('reps-plus', 3);
    for (const bad of ['7.5', '-1', 'x']) {
      await h.type('reps-value', bad);
      assert.strictEqual(h.val('reps-value'), '3', 'after typing ' + bad);
    }
  });

  test('C1 (LD) Done is enabled once typed reps reach 1 and disabled again at 0', async () => {
    const h = await lift(['db-curl']);
    await h.type('reps-value', '8');
    assert.strictEqual(h.q('lift-done').disabled, false);
    await h.type('reps-value', '0');
    assert.strictEqual(h.val('reps-value'), '0');
    assert.strictEqual(h.q('lift-done').disabled, true);
  });

  test('C1 (LD) plus after a typed off-grid weight steps from the typed value', async () => {
    const h = await lift(['db-curl']);
    await h.type('weight-value', '61');
    await h.click('weight-plus');
    assert.strictEqual(h.num('weight-value'), 61 + Coach.incrementKg('db', 'kg'));
  });

  // ---------- no rebuild (LD) ----------
  test('C1 (LD) a stepper tap keeps the demo node and the focused button', async () => {
    const h = await lift(['db-curl']);
    const demo = h.q('lift-demo');
    const plus = h.q('weight-plus');
    await h.focusClick(plus);
    assert.strictEqual(h.q('lift-demo'), demo, 'the demo was rebuilt');
    assert.strictEqual(h.q('weight-plus'), plus, 'the button was rebuilt');
    assert.strictEqual(h.document.activeElement, plus, 'focus was lost');
    const rm = h.q('reps-minus');
    await h.focusClick('reps-plus');
    await h.focusClick(rm);
    assert.strictEqual(h.q('lift-demo'), demo);
    assert.strictEqual(h.document.activeElement, rm);
  });

  test('C1 (LD) typing keeps the demo node and focus in the input', async () => {
    const h = await lift(['db-curl']);
    const demo = h.q('lift-demo');
    const input = h.q('weight-value');
    input.focus();
    await h.type('weight-value', '40');
    assert.strictEqual(h.q('lift-demo'), demo);
    assert.strictEqual(h.q('weight-value'), input);
    assert.strictEqual(h.document.activeElement, input);
  });

  test('B6 (LD) ticking a card keeps focus on its tick and every demo node', async () => {
    const h = await boot({ seed: seedState() });
    const id = h.cardIds()[0];
    const demos = h.cardIds().map(c => [c, h.card(c).querySelector('[data-testid="pick-demo"]')]);
    const tick = h.tickOf(id);
    await h.focusClick(tick);
    assert.strictEqual(h.document.activeElement, tick, 'focus was lost');
    for (const [c, node] of demos) assert.strictEqual(h.card(c).querySelector('[data-testid="pick-demo"]'), node, 'demo rebuilt on ' + c);
  });

  // ---------- double tap and pending (LD) ----------
  test('C6 (LD) a second Done within doubleTapMs of the previous logged set logs nothing', async () => {
    const ms = ui().doubleTapMs;
    assert.ok(typeof ms === 'number' && ms > 0, 'BEGINNER_CONFIG.ui.doubleTapMs must exist');
    const h = await lift(['db-curl']);
    await h.clickN('reps-plus', 10);
    await h.click('lift-done');
    h.clock.advance(ms - 100);
    await h.click('lift-done');
    assert.strictEqual((await h.active()).sets.length, 1);
  });

  test('C6 (LD) Done logs normally once doubleTapMs has passed', async () => {
    const ms = ui().doubleTapMs;
    assert.ok(typeof ms === 'number' && ms > 0, 'BEGINNER_CONFIG.ui.doubleTapMs must exist');
    const h = await lift(['db-curl']);
    await h.clickN('reps-plus', 10);
    await h.click('lift-done');
    h.clock.advance(ms + 100);
    await h.click('lift-done');
    assert.strictEqual((await h.active()).sets.length, 2);
  });

  test('C6 (LD) Done is disabled while a save is pending', async () => {
    const h = await gated({}, ['db-curl']);
    await h.clickN('reps-plus', 10);
    h.adapter.hold = true;
    await h.click('lift-done');
    assert.strictEqual(h.q('lift-done').disabled, true);
    h.adapter.release();
    await h.settle();
    assert.strictEqual((await h.active()).sets.length, 1);
  });

  // ---------- vibration owned by the tick (LD) ----------
  test('C4 (LD) a re-render after the rest ended does not swallow the vibration: the next tick vibrates once', async () => {
    const h = await lift(['db-curl']);
    await h.logSets(1);
    h.clock.advance(ui().restSec * 1000 + 1000);
    await h.click('weight-plus');
    assert.ok(h.vib.length <= 1);
    h.timers.tick(); await h.settle();
    h.timers.tick(); await h.settle();
    assert.strictEqual(h.vib.length, 1);
  });

  // ---------- accessible names (LD) ----------
  test('C1 (LD) stepper buttons are named by single strings from the table', async () => {
    const h = await lift(['db-curl']);
    const L = h.S.lift;
    assert.strictEqual(h.accName(h.q('weight-minus')), L.weightLess);
    assert.strictEqual(h.accName(h.q('weight-plus')), L.weightMore);
    assert.strictEqual(h.accName(h.q('reps-minus')), L.repsLess);
    assert.strictEqual(h.accName(h.q('reps-plus')), L.repsMore);
  });

  test('B5 (LD) the restore control is named from the template with the equipment label', async () => {
    const h = await boot({ seed: seedState({ excluded: ['barbell'] }) });
    assert.strictEqual(h.accName(h.q('restore-item')), fmt(h.S.pick.restoreItem, { item: BEGINNER_EQUIPMENT.barbell.label }));
  });

  test('D1 every aria-label, alt, title and placeholder on Pick, Lift and Done is free of targets and dashes', async () => {
    const h = await boot({ seed: seedState({ excluded: ['barbell'] }) });
    const seen = [...h.attrTexts()];
    await h.type('pick-search', 'a');
    seen.push(...h.attrTexts());
    await h.type('pick-search', '');
    await h.toLift(['db-curl']);
    await h.logSets(1);
    seen.push(...h.attrTexts());
    await h.click('lift-end');
    seen.push(...h.attrTexts());
    assert.ok(seen.length > 5, 'precondition: labels exist');
    for (const t of seen) {
      assert.ok(!/\b(try|target)\b|last time|time to go up/i.test(t), t);
      assert.ok(!/[—–]/.test(t), t);
    }
  });
}

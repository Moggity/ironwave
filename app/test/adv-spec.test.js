/* ============================================================
   IRONWAVE — test/adv-spec.test.js
   [G2] Advanced specialization groundwork (owner ruling 2026-07-24):
   the data + coach layer beneath the future per-muscle frequency
   tab. Three contracts pinned here:
   1. ADV_MUSCLES is a complete, non-overlapping partition seed:
      12+ rows, unique ids, valid parent sliders, translated labels
      in BOTH catalogs, and every row owns at least one exercise
      while no exercise belongs to two rows.
   2. The taxonomy pass is real: the neutral/pronated curls carry
      the new brachialis head and leave the biceps row.
   3. The coach frequency ceilings are physiology-shaped and the
      effective cap is min(ceiling, training days) with the owner
      examples honored (biceps: maxed on 3 days, 6x on 6 days).
   Through test/load-app.js (no DOM needed).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
app.S = app.defaultState(); // advRowExercises reaches exById -> S.customEx
const { ADV_MUSCLES, FOCUS_KEYS } = app;
const coach = app.Engine.coach;

test('ADV_MUSCLES: 12+ unique rows, valid parent sliders, labels in both catalogs', () => {
  assert.ok(ADV_MUSCLES.length >= 12, `${ADV_MUSCLES.length} rows (owner asked for 12+)`);
  const ids = ADV_MUSCLES.map(r => r.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'row ids are unique');
  for (const r of ADV_MUSCLES) {
    assert.ok(r.slider === null || FOCUS_KEYS.includes(r.slider),
      `${r.id}: parent slider '${r.slider}' is a focus key or null`);
    assert.ok(Array.isArray(r.heads) || Array.isArray(r.movements),
      `${r.id}: claims by heads or movements`);
  }
  for (const lang of ['en', 'es']) {
    app.I18N.setLang(lang);
    for (const r of ADV_MUSCLES) {
      assert.notStrictEqual(app.t('adv.' + r.id), 'adv.' + r.id, `${lang}: adv.${r.id} translated`);
    }
  }
  app.I18N.setLang('en');
});

test('every row owns exercises and no exercise belongs to two rows', () => {
  const owner = {};
  for (const r of ADV_MUSCLES) {
    const exs = app.advRowExercises(r.id);
    assert.ok(exs.length >= 1, `${r.id}: owns ${exs.length} exercises`);
    for (const e of exs) {
      assert.ok(!owner[e.id], `${e.id} claimed by both ${owner[e.id]} and ${r.id}`);
      owner[e.id] = r.id;
    }
  }
  // The arms split the owner named: biceps, triceps, brachialis all real.
  for (const id of ['biceps', 'triceps', 'brachialis']) {
    assert.ok(app.advRowExercises(id).length >= 2, `${id} is a real row, not a stub`);
  }
  assert.deepStrictEqual(app.advRowExercises('nope'), [], 'unknown row owns nothing');
});

test('brachialis: the neutral/pronated curls carry the new head and leave biceps', () => {
  const brach = app.advRowExercises('brachialis').map(e => e.id);
  assert.ok(brach.includes('hammer-curl'), 'hammer curl is brachialis work');
  assert.ok(brach.includes('reverse-curl'), 'reverse curl is brachialis work');
  const bi = app.advRowExercises('biceps').map(e => e.id);
  assert.ok(!bi.includes('hammer-curl') && !bi.includes('reverse-curl'),
    'the brachialis pair left the biceps row');
  assert.ok(bi.includes('ez-curl'), 'supinated curls stay biceps');
  assert.strictEqual(app.HEAD_LABELS['bi-brach'], 'Brachialis', 'head label registered');
});

test('advFreqCeiling: complete over the rows and shaped by tissue cost', () => {
  const ceil = coach.bounds.advFreqCeiling;
  for (const r of ADV_MUSCLES) {
    const c = ceil[r.id];
    assert.ok(Number.isInteger(c) && c >= 1 && c <= 7, `${r.id}: ceiling ${c} in 1..7`);
  }
  // Physiology ordering: axial < big compounds < small metabolic muscles.
  assert.ok(ceil['lower-back'] <= ceil.quads, 'axial loading recovers slowest');
  assert.ok(ceil.quads < ceil.chest, 'big lower compounds below torso muscles');
  assert.ok(ceil.chest < ceil.biceps, 'torso below small metabolic muscles');
  assert.ok(ceil['front-delts'] < ceil['side-delts'],
    'front delts already press every session, direct ceiling sits lower');
  assert.ok(coach.bounds.specSlots >= 1, 'specialization slots declared for G4');
});

test('advFreqCap: physiology first, then availability (the owner examples)', () => {
  assert.strictEqual(coach.advFreqCap('biceps', 3), 3, 'biceps on 3 days reads maxed at 3');
  assert.strictEqual(coach.advFreqCap('biceps', 6), 6, 'biceps on 6 days opens to 6');
  assert.strictEqual(coach.advFreqCap('quads', 6), 3, 'quads never pass their ceiling');
  assert.strictEqual(coach.advFreqCap('lower-back', 7), 2, 'axial ceiling holds on any week');
  assert.strictEqual(coach.advFreqCap('made-up-row', 7), coach.bounds.advFreqDefault,
    'unknown rows take the conservative default');
  assert.strictEqual(coach.advFreqCap('biceps', 0), 1, 'day floor is 1');
});

test('advTargets [G3]: caps asks, follows an off muscle, refuses the sole-row backdoor', () => {
  const focus = { arms: 2, chest: 2, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 0 };
  const t = app.advTargets({ biceps: 9, quads: 5, glutes: 0, calves: 3, abs: 2 }, focus, 6);
  assert.strictEqual(t.biceps, 6, 'asks clamp to the coach cap');
  assert.strictEqual(t.quads, 3, 'physiology ceiling holds');
  assert.strictEqual(t.glutes, undefined,
    'an ask of 0 on a muscle with one row is the slider confirm gate, not a backdoor');
  assert.strictEqual(t.calves, undefined, 'a row on an OFF muscle follows the muscle');
  assert.strictEqual(t.abs, 2, 'slider-less rows normalize like any other');
  assert.deepStrictEqual(app.advTargets(null, focus, 5), {}, 'no asks, no targets');
  const off = app.advTargets({ biceps: 0 }, focus, 5);
  assert.strictEqual(off.biceps, 0, 'ask 0 on a multi-row muscle is a real row-off target');
});

test('advRowPool [G3]: curated order first, own exercises only, anchors excluded', () => {
  const bi = app.advRowPool('biceps');
  assert.ok(bi.length >= 3, 'a real pool');
  assert.ok(bi.indexOf('ez-curl') === 0, 'the curated coach order leads');
  assert.ok(!bi.includes('hammer-curl') && !bi.includes('reverse-curl'),
    'brachialis work never enters the biceps pool');
  const abs = app.advRowPool('abs');
  assert.ok(abs.length >= 3, 'slider-less rows draw straight from the library');
  assert.deepStrictEqual(app.advRowPool('nope'), [], 'unknown row, empty pool');
});

test('checkAdvAsk: over the cap is an issue with the honest cap, at the cap is silent', () => {
  const iss = coach.checkAdvAsk('quads', 4, 6);
  assert.ok(iss && iss.key === 'val.adv_freq_cap');
  assert.strictEqual(iss.params.cap, 3, 'the honest cap rides along');
  assert.strictEqual(iss.params.m, 'quads', 'the row id rides along for the UI');
  assert.strictEqual(coach.checkAdvAsk('quads', 3, 6), null, 'at the cap passes');
  assert.strictEqual(coach.checkAdvAsk('biceps', 4, 4), null, 'at availability passes');
  assert.ok(coach.checkAdvAsk('biceps', 5, 4), 'asking past availability is refused honestly');
  assert.strictEqual(coach.checkAdvAsk('quads', 0, 6), null, 'no ask, no issue');
});

// ---------------------------------------------------------------------------
// [G4] Asks spend points, specialization slots, and the panel
// ---------------------------------------------------------------------------
const STD = { arms: 2, chest: 2, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 2 };

test('advSpend [G4]: only the exposures beyond what the sliders already host', () => {
  assert.strictEqual(coach.advSpend({ biceps: 4 }, STD, 5), 2, 'arms 2x hosts the first two');
  assert.strictEqual(coach.advSpend({ biceps: 2 }, STD, 5), 0, 'inside the slider is free');
  assert.strictEqual(coach.advSpend({ biceps: 1 }, STD, 5), 0, 'a reduction costs nothing');
  assert.strictEqual(coach.advSpend({ abs: 2 }, STD, 5), 2, 'slider-less rows are all new work');
  assert.strictEqual(coach.advSpend({ biceps: 9 }, STD, 5), 3, 'asks price at their capped target');
  assert.strictEqual(coach.advSpend(null, STD, 5), 0);
});

test('specCount + checkSpecSlots [G4]: at most bounds.specSlots muscles above their slider', () => {
  assert.strictEqual(coach.specCount({ biceps: 4, abs: 2 }, STD, 5), 2);
  assert.strictEqual(coach.specCount({ biceps: 2, quads: 1 }, STD, 5), 0, 'inside or below is not a slot');
  assert.strictEqual(coach.checkSpecSlots({ biceps: 4, abs: 2 }, STD, 5), null, 'two slots fit');
  const iss = coach.checkSpecSlots({ biceps: 4, 'side-delts': 4, calves: 4 }, STD, 5);
  assert.ok(iss && iss.key === 'val.adv_spec_slots');
  assert.deepStrictEqual([iss.params.used, iss.params.max], [3, coach.bounds.specSlots]);
});

test('checkFocusBudget [G4]: advanced asks ride the points budget (custom cap only)', () => {
  const clean = coach.checkFocusBudget(STD, 5, 50, null);
  const withAsk = coach.checkFocusBudget(STD, 5, 50, { biceps: 5 });
  assert.ok(withAsk, 'the ask pushed the plan over');
  assert.ok(!clean || withAsk.params.need > clean.params.need, 'asks raise the need');
  assert.strictEqual(coach.checkFocusBudget(STD, 5, null, { biceps: 5 }), null,
    'no time limit still means no points');
});

test('validateIntake [G4]: spec slots and ask-aware budget gate the focus step', () => {
  const spec = { obSteps: ['welcome', 'goal', 'days', 'experience', 'time', 'focus', 'maxes'],
    intake: { minSessionMin: 30 } };
  const base = { bodyweight: 80, track: 'bodybuilding', daysPerWeek: 5,
    timeMode: 'unlimited', muscleFocus: { ...STD }, maxes: {} };
  const overSlots = app.Engine.validateIntake(Object.assign({}, base,
    { focusAdv: { biceps: 4, 'side-delts': 4, calves: 4 } }), spec, Date.now());
  assert.ok(overSlots.some(i => i.key === 'val.adv_spec_slots' && i.level === 'error'),
    'a third specialization blocks');
  const okSlots = app.Engine.validateIntake(Object.assign({}, base,
    { focusAdv: { biceps: 4, abs: 2 } }), spec, Date.now());
  assert.ok(!okSlots.some(i => i.key === 'val.adv_spec_slots'), 'two slots pass');
  const capped = app.Engine.validateIntake(Object.assign({}, base,
    { timeMode: 'custom', timeCapMin: 45, focusAdv: { biceps: 5 } }), spec, Date.now());
  assert.ok(capped.some(i => i.key === 'val.focus_over_budget'), 'asks price into a capped intake');
});

test('panel [G4]: the owner example, locked pips at 3 days and open at 6', () => {
  app.S = app.defaultState();
  app.V = { advSurface: 'ob', advDraft: { biceps: 3 },
    ob: { muscleFocus: { ...STD }, daysPerWeek: 3, timeMode: 'unlimited', daysMode: 'count' } };
  let html = app.advPanelHTML();
  assert.ok(/adv-pip on locked|locked/.test(html), 'pips past 3 days render locked');
  assert.ok(/3x · MAX/.test(html), 'biceps at 3 on 3 days reads MAX');
  assert.ok(/Specialization slots: 1 of 2/.test(html), 'the slot ledger is visible');
  app.V.ob.daysPerWeek = 6;
  app.V.advDraft = { biceps: 6 };
  html = app.advPanelHTML();
  assert.ok(/6x · MAX/.test(html), 'six days open biceps to 6x');
  assert.ok(!/apSave\(\)" disabled/.test(html), 'save stays enabled');
});

test('panel [G4]: a third specialization shows the banner and disables save', () => {
  app.S = app.defaultState();
  app.V = { advSurface: 'ob', advDraft: { biceps: 4, 'side-delts': 4, calves: 4 },
    ob: { muscleFocus: { ...STD }, daysPerWeek: 5, timeMode: 'unlimited', daysMode: 'count' } };
  const html = app.advPanelHTML();
  assert.ok(/Only 2 muscles/.test(html), 'the honest slots banner renders');
  assert.ok(/onclick="apSave\(\)" disabled/.test(html), 'save is disabled while over');
});

test('panel [G4]: weekday preview lands on the chosen days and flags back to back', () => {
  app.S = app.defaultState();
  app.V = { advSurface: 'ob', advDraft: { biceps: 4 },
    ob: { muscleFocus: { ...STD }, daysPerWeek: 4, timeMode: 'unlimited',
      daysMode: 'calendar', trainingDays: [0, 2, 4, 5] } };
  const html = app.advPanelHTML();
  assert.ok(/Lands on/.test(html), 'the projection renders for an active ask');
  assert.ok(/Back to back/.test(html), 'Fri+Sat spacing is flagged');
  const prev = app.advWeekdayPreview(app.advCtx(), app.V.advDraft);
  assert.deepStrictEqual(prev.byRow.biceps, [0, 2, 4, 5], 'biceps lands on every chosen day');
  // Count-mode athletes get no projection.
  app.V.ob.daysMode = 'count'; delete app.V.ob.trainingDays;
  assert.strictEqual(app.advWeekdayPreview(app.advCtx(), app.V.advDraft), null);
});

test('panel [G4]: the G1 migration seed surfaces until a real ask exists', () => {
  app.S = app.defaultState();
  app.S.profile.training.focusSpecAsk = { arms: 4 };
  app.V = { advSurface: 'ob', advDraft: {},
    ob: { muscleFocus: { ...STD }, daysPerWeek: 5, timeMode: 'unlimited', daysMode: 'count' } };
  assert.ok(/old plan asked/.test(app.advPanelHTML()), 'the seed hint shows');
  app.V.advDraft = { biceps: 4 };
  assert.ok(!/old plan asked/.test(app.advPanelHTML()), 'a real ask retires the hint');
});

test('flow [G4]: apSave writes the drafts, feSave stages, endBlock applies', () => {
  const s = app.defaultState();
  app.S = s;
  s.profile.landmarks = app.Engine.seedLandmarks('intermediate');
  s.program = app.makeProgram({ daysPerWeek: 5, track: 'bodybuilding', experience: 'intermediate',
    timeMode: 'unlimited', muscleFocus: { ...STD }, maxes: {} });
  app.V = { dayIdx: null, view: 'dashboard', tab: 'dashboard' };
  // In-app: open the editor, ask biceps 4 through the panel, save both.
  app.openFocusEditor();
  app.openAdvPanel('fe');
  app.apAsk('biceps', 4);
  app.apSave();
  assert.deepStrictEqual(app.V.feAdvDraft, { biceps: 4 }, 'panel saved to the editor draft');
  app.feSave();
  assert.deepStrictEqual(s.program.pendingFocusAdv, { biceps: 4 }, 'staged for the boundary');
  // Cross the boundary: config commits, the new split honors the ask.
  s.program.pointer.week = s.program.weeksPerBlock - 1;
  app.advanceWeek();
  assert.strictEqual(s.program.pointer.block, 1);
  assert.deepStrictEqual(s.program.trainingConfig.focusAdv, { biceps: 4 }, 'committed to the config');
  assert.strictEqual(s.program.pendingFocusAdv, undefined, 'staging cleared');
  assert.deepStrictEqual(
    app.validateFocusWeek(s.program.days, s.program.trainingConfig.muscleFocus, 5, { biceps: 4 }), [],
    'the regenerated week keeps the ask');
});

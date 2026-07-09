/* ============================================================
   IRONWAVE — test/feedback-round2.test.js
   User-feedback round 2 (v1.3.0): per-level pump icons, the
   de-verbosed session card helpers, editable known maxes (seed
   records + record delete), the seed-aware perf prefill, and the
   Maxes-tab milestone series. Pure / stub-safe, no DOM.
   ============================================================ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine } = app;
const DAY = 864e5;

// ------------------------------------------------------------
// Pump icons: one per level
// ------------------------------------------------------------
test('each pump level has its own icon and badge', () => {
  assert.deepStrictEqual(app.PUMP_ICONS, { 1: '👍', 2: '💪', 3: '🔥' });
  assert.ok(app.pumpBadge(1).includes('👍') && app.pumpBadge(1).includes('Light'));
  assert.ok(app.pumpBadge(2).includes('💪') && app.pumpBadge(2).includes('Solid'));
  assert.ok(app.pumpBadge(3).includes('🔥') && app.pumpBadge(3).includes('Skin splitting'));
  assert.strictEqual(app.pumpBadge(null), '', 'no pump, no badge');
});

// ------------------------------------------------------------
// De-verbosed session card: card hint + compact per-set notes
// ------------------------------------------------------------
test('a calibration card hoists the explainer and rows keep only the suffix', () => {
  const sets = [
    { calib: true, targetReps: 12, targetRpe: 6, note: 'Calibration · build up' },
    { calib: true, targetReps: 10, targetRpe: 7, note: 'Calibration' },
    { calib: true, targetReps: 8, targetRpe: 8, note: 'Calibration · top set' },
  ];
  const hint = app.cardHintFor(sets);
  assert.ok(/calibration/i.test(hint), 'card-level calibration hint');
  assert.strictEqual(app.displaySetNote(sets[0], hint), 'build up');
  assert.strictEqual(app.displaySetNote(sets[1], hint), null, 'bare Calibration note vanishes');
  assert.strictEqual(app.displaySetNote(sets[2], hint), 'top set');
  // The row label itself is bare: no repeated 'eyeball the weight'.
  assert.ok(!app.setTargetLabel(sets[0], 'lat-pulldown').includes('eyeball'));
});

test('a note repeated on every set (deload copy) hoists to one line', () => {
  const sets = [
    { targetWeight: 60, targetReps: 5, note: 'Deload, move well and recover' },
    { targetWeight: 60, targetReps: 5, note: 'Deload, move well and recover' },
  ];
  const hint = app.cardHintFor(sets);
  assert.strictEqual(hint, 'Deload, move well and recover');
  assert.strictEqual(app.displaySetNote(sets[0], hint), null, 'row copy suppressed');
});

test('distinct per-set notes are left alone', () => {
  const sets = [
    { targetWeight: 60, targetReps: 8, note: null },
    { targetWeight: 60, targetReps: 8, note: 'Meso 1 · volume week 2 of 4, sets climb next week' },
  ];
  assert.strictEqual(app.cardHintFor(sets), null);
  assert.strictEqual(app.displaySetNote(sets[1], null), 'Meso 1 · volume week 2 of 4, sets climb next week');
});

// ------------------------------------------------------------
// [i18n phase 3] Keyed notes: the engine emits noteKey (+ params), the UI
// translates at render; legacy stored `note` strings (above) stay verbatim.
// ------------------------------------------------------------
test('keyed notes resolve through the catalog, with params interpolated', () => {
  assert.strictEqual(app.setNoteText({ noteKey: 'deload_main' }), 'Deload, move well and recover');
  assert.strictEqual(app.setNoteText({ noteKey: 'meso_week', noteParams: { m: 2, w: 3 } }),
    'Meso 2 · volume week 3 of 4, sets climb next week');
  assert.strictEqual(app.setNoteText({ noteKey: 'amrap', noteParams: { standard: 8 } }),
    'AMRAP. Standard is 8, and every rep over moves your working max up.');
  assert.strictEqual(app.setNoteText({ note: 'legacy stored note' }), 'legacy stored note');
  assert.strictEqual(app.setNoteText({}), null);
});

test('keyed calibration rows show short forms and the bare middle set vanishes', () => {
  const sets = [
    { calib: true, targetReps: 12, targetRpe: 6, noteKey: 'calib_build' },
    { calib: true, targetReps: 10, targetRpe: 7, noteKey: 'calib' },
    { calib: true, targetReps: 8, targetRpe: 8, noteKey: 'calib_top' },
  ];
  const hint = app.cardHintFor(sets);
  assert.ok(/calibration/i.test(hint), 'card-level calibration hint');
  assert.strictEqual(app.displaySetNote(sets[0], hint), 'build up');
  assert.strictEqual(app.displaySetNote(sets[1], hint), null);
  assert.strictEqual(app.displaySetNote(sets[2], hint), 'top set');
});

test('a keyed note repeated on every set hoists to one line', () => {
  const sets = [
    { targetWeight: 60, targetReps: 5, noteKey: 'deload_main' },
    { targetWeight: 60, targetReps: 5, noteKey: 'deload_main' },
  ];
  const hint = app.cardHintFor(sets);
  assert.strictEqual(hint, 'Deload, move well and recover');
  assert.strictEqual(app.displaySetNote(sets[0], hint), null, 'row copy suppressed');
});

test('keyed notes translate: Spanish deload note renders in Spanish', () => {
  app.I18N.setLang('es');
  try {
    assert.strictEqual(app.setNoteText({ noteKey: 'deload_main' }), 'Descarga: muévete bien y recupera');
  } finally {
    app.I18N.setLang('en');
  }
});

// ------------------------------------------------------------
// Known maxes: seeded records anchor the engine
// ------------------------------------------------------------
test('a seeded 1RM/10RM produces a bestE1RM, so calibration steps aside', () => {
  const s = app.defaultState();
  app.S = s;
  app.pushRecord('lat-pulldown', { ts: Date.now(), weight: 80, reps: 1, rpe: 10, seed: true });
  const e1 = Engine.bestE1RM(app.recordsFor('lat-pulldown'));
  assert.ok(e1 > 0, 'seed anchors the e1RM');
  // The jbb accessory path prescribes real weights once an e1RM exists.
  const block = { type: 'hypertrophy', scheme: 'jbb-hyp', wave: '10s', mesoIdx: 0 };
  const sets = Engine.schemeFor(block).accessory(block, 1, app.recordsFor('lat-pulldown'), 2.5, 'intermediate');
  assert.ok(sets.every(x => x.weight > 0), 'prescribed weights, not a calibration ramp');
  assert.ok(sets.every(x => !x.calib), 'no calib flags');
});

test('suggestedWeight prefers real history, else derives from the seed', () => {
  const s = app.defaultState();
  app.S = s;
  const st = { targetReps: 12, targetRpe: 7 };
  assert.strictEqual(app.suggestedWeight('lat-pulldown', st), null, 'nothing known');
  app.pushRecord('lat-pulldown', { ts: Date.now(), weight: 100, reps: 1, rpe: 10, seed: true });
  const fromSeed = app.suggestedWeight('lat-pulldown', st);
  assert.ok(fromSeed > 0 && fromSeed < 100, `derived from the seed at the set's reps (got ${fromSeed})`);
  app.pushRecord('lat-pulldown', { ts: Date.now(), weight: 55, reps: 12, rpe: 7 });
  assert.strictEqual(app.suggestedWeight('lat-pulldown', st), 55, 'real history wins');
});

// ------------------------------------------------------------
// Record delete (history correction)
// ------------------------------------------------------------
test('deleteRecord removes exactly the confirmed set', () => {
  const s = app.defaultState();
  app.S = s;
  const base = Date.now();
  app.pushRecord('lat-pulldown', { ts: base - 2 * DAY, weight: 40, reps: 10, rpe: 7 });
  app.pushRecord('lat-pulldown', { ts: base - DAY, weight: 160, reps: 10, rpe: 7 }); // the corrupted log
  app.pushRecord('lat-pulldown', { ts: base, weight: 45, reps: 8, rpe: 8 });
  app.deleteRecord('lat-pulldown', 1);
  app.confirmResolve(true);
  const left = app.recordsFor('lat-pulldown');
  assert.deepStrictEqual(left.map(r => r.weight), [40, 45], 'only the bad record went');
  // Cancel path leaves history alone.
  app.deleteRecord('lat-pulldown', 0);
  app.confirmResolve(false);
  assert.strictEqual(app.recordsFor('lat-pulldown').length, 2);
});

// ------------------------------------------------------------
// Rest-done notification (opt-in) plumbing
// ------------------------------------------------------------
test('migrateState backfills the restNotify opt-in as off, idempotently', () => {
  const s = { profile: { name: 'x' }, records: {}, sessions: [], checkins: [] };
  app.migrateState(s);
  assert.strictEqual(s.profile.restNotify, false, 'backfilled off');
  s.profile.restNotify = true;
  app.migrateState(s);
  assert.strictEqual(s.profile.restNotify, true, 'an opt-in survives re-migration');
});

test('showRestNotification is a hard no-op when off or unsupported', async () => {
  const s = app.defaultState();
  app.S = s;
  // Opted out: never shows regardless of platform support.
  s.profile.restNotify = false;
  assert.strictEqual(await app.showRestNotification(), false);
  // Opted in but no Notification API in this environment (the node harness):
  // silently declines rather than throwing mid-timer.
  s.profile.restNotify = true;
  assert.strictEqual(typeof Notification, 'undefined', 'harness has no Notification API');
  assert.strictEqual(await app.showRestNotification(), false);
  assert.strictEqual(app.restNotifySupported(), false);
});

// ------------------------------------------------------------
// Maxes tab milestones
// ------------------------------------------------------------
test('maxMilestones marks new estimated highs and entered maxes, newest first', () => {
  const base = Date.now() - 10 * DAY;
  const recs = [
    { ts: base, weight: 60, reps: 10, rpe: 8 },                       // first ever -> new
    { ts: base + DAY, weight: 60, reps: 10, rpe: 8 },                 // repeat -> nothing
    { ts: base + 2 * DAY, weight: 70, reps: 10, rpe: 8 },             // new high
    { ts: base + 3 * DAY, weight: 110, reps: 1, rpe: 10, seed: true },// entered max
    { ts: base + 4 * DAY, weight: 75, reps: 10, rpe: 8 },             // below the entered max -> nothing
  ];
  const m = Engine.maxMilestones(recs);
  assert.deepStrictEqual(m.map(x => x.kind), ['entered', 'new', 'new'], 'newest first');
  assert.strictEqual(m[0].value, 110, 'a 1RM seed shows the entered weight');
  assert.ok(m[1].value > m[2].value, 'each new milestone tops the last');
  assert.deepStrictEqual(Engine.maxMilestones([]), []);
});

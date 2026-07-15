/* ============================================================
   IRONWAVE — test/units.test.js
   [Epic H1] Units and intensity display. kg is the only stored unit;
   lb is a render/input skin, and RIR/RPE is a display choice with RPE
   always stored. These tests pin:
   - exact kg <-> lb round-trips (including through the rounding steps),
   - the profile fields' defaults + migration backfill,
   - the display/input helpers (fmtW, dispW, fmtRir) in both modes,
   - the unit switch moving untouched equipment to the new unit's
     defaults while leaving customized values alone,
   - lb plate math resolving clean lb faces and colors.
   Through test/load-app.js (no DOM needed).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine, KG_PER_LB } = app;

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// A fresh default S installed into the app, returned for tweaking.
function freshS() {
  const s = app.defaultState();
  app.S = s;
  return s;
}

// ---------------------------------------------------------------------------
// Conversion math
// ---------------------------------------------------------------------------
test('kgToLb / lbToKg are exact inverses at any value', () => {
  for (const lb of [1.25, 2.5, 5, 10, 45, 135, 225, 500.5]) {
    assert.ok(near(Engine.kgToLb(Engine.lbToKg(lb)), lb), `lb round-trip ${lb}`);
  }
  for (const kg of [0.5, 1.25, 2.5, 20, 102.5, 300]) {
    assert.ok(near(Engine.lbToKg(Engine.kgToLb(kg)), kg), `kg round-trip ${kg}`);
  }
  assert.strictEqual(Engine.kgToLb(null), null);
  assert.strictEqual(Engine.lbToKg(null), null);
});

test('roundLoad at an lb-equivalent rounding step lands on clean lb multiples', () => {
  for (const step of [1.25, 2.5, 5]) {
    const rounded = Engine.roundLoad(100, step * KG_PER_LB); // 100 kg to the lb grid
    const lb = Engine.kgToLb(rounded);
    assert.ok(near(lb % step, 0, 1e-6) || near(lb % step, step, 1e-6),
      `rounded to ${step} lb grid, got ${lb} lb`);
  }
});

test('typed display values survive parse -> store -> display at each rounding', () => {
  freshS().profile.units = 'lb';
  for (const typed of [225, 135, 47.5, 2.5, 1.25]) {
    const storedKg = app.fromDispW(typed);
    assert.ok(near(Engine.kgToLb(storedKg), typed), 'stored kg converts back exactly');
    assert.strictEqual(String(app.dispW(storedKg)), String(typed), `display shows ${typed}`);
  }
});

// ---------------------------------------------------------------------------
// State fields + migration
// ---------------------------------------------------------------------------
test('defaultState carries units kg and intensityDisplay rir', () => {
  const s = app.defaultState();
  assert.strictEqual(s.profile.units, 'kg');
  assert.strictEqual(s.profile.intensityDisplay, 'rir');
});

test('migrateState backfills units/intensityDisplay on a legacy save, idempotently', () => {
  const s = app.defaultState();
  delete s.profile.units;
  delete s.profile.intensityDisplay;
  app.migrateState(s);
  assert.strictEqual(s.profile.units, 'kg');
  assert.strictEqual(s.profile.intensityDisplay, 'rir');
  s.profile.units = 'lb';
  s.profile.intensityDisplay = 'rpe';
  app.migrateState(s); // a second pass never clobbers a real preference
  assert.strictEqual(s.profile.units, 'lb');
  assert.strictEqual(s.profile.intensityDisplay, 'rpe');
});

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------
test('fmtW renders kg by default and lb when flipped (storage unchanged)', () => {
  const s = freshS();
  assert.strictEqual(app.fmtW('comp-bench', 100), '100kg');
  s.profile.units = 'lb';
  assert.strictEqual(app.fmtW('comp-bench', 100), '220.5lb'); // 220.462 -> one decimal
  assert.strictEqual(app.fmtWU(Engine.lbToKg(225)), '225 lb');
});

test('fmtW keeps the per-hand split for a two-dumbbell lift in both units', () => {
  const s = freshS();
  const list = Array.isArray(app.EXERCISES) ? app.EXERCISES : Object.values(app.EXERCISES);
  const db = list.find(e => e.equipment === 'db' && app.loadingFor(e.id).count === 2);
  assert.ok(db, 'expected a two-dumbbell exercise in the catalog');
  assert.strictEqual(app.fmtW(db.id, 40), '20kg/hand');
  s.profile.units = 'lb';
  const perHand = app.displayWeight(db.id, 40);
  assert.ok(perHand.perHand, 'still per hand in lb');
  assert.ok(near(perHand.value, Engine.kgToLb(20)), 'per-hand value converts');
  assert.ok(app.fmtW(db.id, 40).endsWith('lb/hand'));
});

test('fmtRir shows RIR by default and RPE when flipped (stored RPE untouched)', () => {
  const s = freshS();
  assert.strictEqual(app.fmtRir(8), '2 RIR');
  s.profile.intensityDisplay = 'rpe';
  assert.strictEqual(app.fmtRir(8), 'RPE 8');
  assert.strictEqual(app.fmtRir(null), '–');
});

test('pmEffort steps the DISPLAYED scale in both modes, storing RPE', () => {
  const s = freshS();
  app.PM = { rpe: 8 };
  app.pmEffort(0.5);            // +0.5 RIR = easier
  assert.strictEqual(app.PM.rpe, 7.5);
  s.profile.intensityDisplay = 'rpe';
  app.pmEffort(0.5);            // +0.5 RPE = harder
  assert.strictEqual(app.PM.rpe, 8);
  app.PM = null;
});

// ---------------------------------------------------------------------------
// Unit switch: equipment defaults follow, customized values stay
// ---------------------------------------------------------------------------
test('applyUnits moves untouched kg equipment to the lb defaults and back', () => {
  const s = freshS();
  const swapped = app.applyUnits('lb');
  assert.strictEqual(swapped, true);
  assert.strictEqual(s.profile.units, 'lb');
  assert.ok(near(s.profile.barWeight, 45 * KG_PER_LB), '45 lb bar');
  assert.ok(near(s.profile.rounding, 2.5 * KG_PER_LB), '2.5 lb rounding');
  assert.ok(near(s.profile.dbIncrement, 5 * KG_PER_LB), '5 lb dumbbell step');
  assert.ok(near(s.profile.machineStep, 10 * KG_PER_LB), '10 lb machine step');
  assert.deepStrictEqual(s.profile.plates, app.DEFAULT_PLATES_LB, 'lb plate set');
  app.applyUnits('kg'); // and back: everything still at defaults, so it returns
  assert.strictEqual(s.profile.barWeight, 20);
  assert.strictEqual(s.profile.rounding, 2.5);
  assert.deepStrictEqual(s.profile.plates, app.DEFAULT_PLATES);
});

test('applyUnits leaves customized equipment alone (it just renders converted)', () => {
  const s = freshS();
  s.profile.barWeight = 17;                 // a custom technique bar
  s.profile.plates[0].count = 8;            // extra 25s
  app.applyUnits('lb');
  assert.strictEqual(s.profile.barWeight, 17, 'custom bar kept in kg');
  assert.strictEqual(s.profile.plates[0].w, 25, 'custom plate set kept');
  assert.ok(near(s.profile.rounding, 2.5 * KG_PER_LB), 'untouched rounding still swapped');
  assert.strictEqual(s.profile.units, 'lb');
});

test('applyUnits is a no-op for the same unit', () => {
  const s = freshS();
  assert.strictEqual(app.applyUnits('kg'), false);
  assert.strictEqual(s.profile.barWeight, 20);
});

// ---------------------------------------------------------------------------
// lb plates: math and faces
// ---------------------------------------------------------------------------
test('plateMath loads a 225 lb bench with two 45 lb plates per side', () => {
  const s = freshS();
  app.applyUnits('lb');
  const { plates, achieved } = Engine.plateMath(
    Engine.lbToKg(225), s.profile.barWeight, s.profile.plates);
  assert.strictEqual(plates.length, 2, 'two plates per side');
  assert.ok(plates.every(p => near(Engine.kgToLb(p.w), 45)), 'both are 45s');
  assert.ok(near(Engine.kgToLb(achieved), 225), 'achieves exactly 225 lb');
  assert.strictEqual(app.dispW(achieved), 225, 'displays as a clean 225');
});

test('plate colors key off the lb face value in lb mode', () => {
  freshS();
  app.applyUnits('lb');
  assert.strictEqual(app.plateColorFor(45 * KG_PER_LB), app.PLATE_COLORS_LB['45']);
  assert.strictEqual(app.plateColorFor(2.5 * KG_PER_LB), app.PLATE_COLORS_LB['2.5']);
  app.applyUnits('kg');
  assert.strictEqual(app.plateColorFor(20), '#3b6fe0', 'kg colors unchanged');
});

// ---------------------------------------------------------------------------
// Settings preset options
// ---------------------------------------------------------------------------
test('presetOptions selects the stored value and keeps a custom one visible', () => {
  const s = freshS();
  app.applyUnits('lb');
  const html = app.presetOptions('rounding', s.profile.rounding);
  assert.ok(/value="2.5" selected/.test(html), 'the 2.5 lb preset is selected');
  s.profile.rounding = 1.7; // a custom kg value no lb preset matches
  const custom = app.presetOptions('rounding', s.profile.rounding);
  assert.ok(/selected/.test(custom.split('</option>')[0]), 'custom value injected selected');
  const optVal = parseFloat(custom.match(/value="([^"]+)"/)[1]);
  assert.strictEqual(String(app.dispW(app.fromDispW(optVal))), String(app.dispW(1.7)),
    'custom option round-trips');
});

// ---------------------------------------------------------------------------
// The default path never moves
// ---------------------------------------------------------------------------
test('a kg athlete sees byte-identical strings after this feature', () => {
  freshS();
  assert.strictEqual(app.fmtW('comp-squat', 142.5), '142.5kg');
  assert.strictEqual(app.fmtWU(102.5), '102.5 kg');
  assert.strictEqual(app.fmtRir(7.5), '2.5 RIR');
  assert.strictEqual(app.wUnitFor({ perHand: true }), 'kg/hand');
});

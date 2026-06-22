/* ============================================================
   IRONWAVE — test/focus-generator.test.js
   Focus / generator behavior (future-work testing item 5):
   - muscle-focus sliders reshape accessory volume (0 removes, 1-2
     de-emphasize, 3+ leave per-session sets unchanged), and are a
     no-op off the bodybuilding track;
   - the frequency-driven split generator's region allocation, day
     count, and slot minimums, with removed muscles absent and
     leadership rotating;
   - the core / optional time tiers (mains never optional);
   - the block-end carryover drop/keep.
   All through the existing test/load-app.js harness (no jsdom).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();

const DEFAULT_FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

// Build a program with S installed first (the bodybuilding generator reads
// S.customEx through exById, exactly as it does in the running app).
function installProgram(over) {
  app.S = app.defaultState();
  app.S.program = app.makeProgram(Object.assign({
    daysPerWeek: 4, track: 'powerbuilding', timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  }, over));
  return app.S.program;
}
const plainSets = n => Array.from({ length: n }, () => ({ weight: 50, reps: 12, rpe: 8 }));

// ---------------------------------------------------------------------------
// Focus reallocation
// ---------------------------------------------------------------------------
test('focus slider 0 removes the muscle\'s accessory', () => {
  installProgram({ track: 'bodybuilding', muscleFocus: { ...DEFAULT_FOCUS, chest: 0 } });
  assert.deepStrictEqual(app.focusForAccessory('cable-fly', plainSets(4)), { removed: true });
});

test('focus sliders 1 and 2 de-emphasize (shed sets)', () => {
  installProgram({ track: 'bodybuilding', muscleFocus: { ...DEFAULT_FOCUS, back: 1, shoulders: 2 } });
  // FOCUS_FACTOR: 1 -> 0.5 (4 -> 2 sets), 2 -> 0.75 (4 -> 3 sets).
  assert.deepStrictEqual(app.focusForAccessory('lat-pulldown', plainSets(4)), { delta: -2 });
  assert.deepStrictEqual(app.focusForAccessory('lateral-raise', plainSets(4)), { delta: -1 });
});

test('focus slider 3 and above leave per-session sets unchanged', () => {
  installProgram({ track: 'bodybuilding', muscleFocus: { ...DEFAULT_FOCUS, arms: 3, legs: 5 } });
  // Emphasis comes from frequency (more days), not from inflating a session.
  assert.deepStrictEqual(app.focusForAccessory('ez-curl', plainSets(4)), { delta: 0 });
  assert.deepStrictEqual(app.focusForAccessory('leg-extensions', plainSets(4)), { delta: 0 });
});

test('focus is a no-op on a calibration ramp and off the bodybuilding track', () => {
  installProgram({ track: 'bodybuilding', muscleFocus: { ...DEFAULT_FOCUS, back: 1 } });
  // No plain working sets yet (calibration): nothing to scale.
  const calib = [{ reps: 12, rpe: 7, calib: true }];
  assert.deepStrictEqual(app.focusForAccessory('lat-pulldown', calib), { delta: 0 });

  installProgram({ track: 'powerbuilding', muscleFocus: { ...DEFAULT_FOCUS, back: 1 } });
  assert.deepStrictEqual(app.focusForAccessory('lat-pulldown', plainSets(4)), { delta: 0 });
});

// ---------------------------------------------------------------------------
// Split generator
// ---------------------------------------------------------------------------
const upperCount = days => days.filter(d => d.name.startsWith('Upper')).length;
const lowerCount = days => days.filter(d => d.name.startsWith('Lower')).length;

test('generator: region days are proportional to slider points', () => {
  app.S = app.defaultState();
  // Balanced 4-day: upper (4 muscles) vs lower (3) points => 2 upper / 2 lower.
  const balanced = app.generateBodybuildingDays({ ...DEFAULT_FOCUS }, 4);
  assert.strictEqual(balanced.length, 4);
  assert.strictEqual(upperCount(balanced), 2);
  assert.strictEqual(lowerCount(balanced), 2);

  // Upper-heavy 4-day (the CHANGELOG example) => 3 upper / 1 lower.
  const heavy = app.generateBodybuildingDays(
    { arms: 3, chest: 3, back: 3, shoulders: 4, glutes: 1, legs: 2, calves: 1 }, 4);
  assert.strictEqual(upperCount(heavy), 3);
  assert.strictEqual(lowerCount(heavy), 1);
});

test('generator: every day has at least three slots', () => {
  app.S = app.defaultState();
  const days = app.generateBodybuildingDays({ ...DEFAULT_FOCUS }, 4);
  assert.ok(days.every(d => d.slots.length >= 3));
});

test('generator: a removed muscle never appears, anywhere', () => {
  app.S = app.defaultState();
  const days = app.generateBodybuildingDays({ ...DEFAULT_FOCUS, glutes: 0, calves: 0 }, 5);
  const removed = new Set(['glutes', 'calves']);
  for (const d of days) {
    // No day is themed by a removed muscle (the theme label follows " · ").
    const theme = d.name.toLowerCase();
    assert.ok(!/glute|calv/.test(theme), `removed muscle leads a day: ${d.name}`);
    for (const sl of d.slots) {
      const id = sl.ex || sl.def || sl.lift;
      if (!id) continue;
      const key = app.MOVEMENT_SLIDER[(app.exById(id) || {}).movement];
      assert.ok(!removed.has(key), `${id} (${key}) belongs to a removed muscle`);
    }
  }
});

test('generator: leadership rotates across anchor muscles', () => {
  app.S = app.defaultState();
  // Several anchor-capable muscles present => distinct day themes, not one lead.
  const days = app.generateBodybuildingDays({ ...DEFAULT_FOCUS }, 4);
  const primaries = new Set(days.map(d => d.name));
  assert.ok(primaries.size >= 2, 'days should not all share one theme');
});

test('generator: everything removed yields no days (empty-week guard)', () => {
  app.S = app.defaultState();
  const none = app.generateBodybuildingDays(
    { arms: 0, chest: 0, back: 0, shoulders: 0, glutes: 0, legs: 0, calves: 0 }, 4);
  assert.deepStrictEqual(none, []);
});

// ---------------------------------------------------------------------------
// Core / optional time tiers
// ---------------------------------------------------------------------------
const CAL_MAXES = { 'comp-squat': 140, 'comp-bench': 100, 'comp-deadlift': 180, 'military-press': 60 };

test('time tiers: no cap means everything is core', () => {
  installProgram({ timeMode: 'unlimited', maxes: CAL_MAXES });
  const rd = app.resolveDayEntries(0, 0, 0);
  assert.strictEqual(rd.capMin, null);
  assert.strictEqual(rd.optItems.length, 0);
  assert.strictEqual(rd.coreItems.length, rd.items.length);
});

test('time tiers: a tight cap pushes accessories optional, mains stay core', () => {
  installProgram({ timeMode: 'custom', timeCapMin: 20, maxes: CAL_MAXES });
  const rd = app.resolveDayEntries(0, 0, 0);
  assert.strictEqual(rd.capMin, 20);
  assert.ok(rd.optItems.length > 0, 'some work runs over the cap');
  // Mains and secondaries are never demoted to optional.
  assert.ok(!rd.optItems.some(x => x.rs.isMain || x.rs.isSecondary));
  // Partition is exact and the full session is at least as long as core.
  assert.strictEqual(rd.coreItems.length + rd.optItems.length, rd.items.length);
  assert.ok(rd.fullMin >= rd.coreMin);
  assert.strictEqual(rd.optionalNames.length, rd.optItems.length);
});

// ---------------------------------------------------------------------------
// Block-end carryover
// ---------------------------------------------------------------------------
test('carryover: drops an accessory offered optional twice and never trained', () => {
  installProgram({ maxes: {} });
  // Deterministic two-accessory day.
  app.S.program.days = [{ name: 'D1', slots: [
    { type: 'acc', cat: 'chest', def: 'cable-fly' },
    { type: 'acc', cat: 'back', def: 'face-pull' },
  ] }];
  const entry = (exId, optional, done) => ({ exId, optional, sets: [{ done }] });
  app.S.sessions = [
    { b: 0, skipped: false, entries: [entry('cable-fly', true, false), entry('face-pull', true, true)] },
    { b: 0, skipped: false, entries: [entry('cable-fly', true, false), entry('face-pull', true, false)] },
  ];

  const dropped = app.carryoverOptionalDrops(0);
  // cable-fly: optional twice, never done -> dropped. face-pull: done once -> kept.
  assert.deepStrictEqual(dropped, ['Cable Fly']);
  assert.deepStrictEqual(app.S.program.days[0].slots.map(s => s.def), ['face-pull']);
});

test('carryover: keeps everything when nothing qualifies', () => {
  installProgram({ maxes: {} });
  app.S.program.days = [{ name: 'D1', slots: [{ type: 'acc', cat: 'chest', def: 'cable-fly' }] }];
  // Only one optional appearance -> not eligible (needs >= 2).
  app.S.sessions = [
    { b: 0, skipped: false, entries: [{ exId: 'cable-fly', optional: true, sets: [{ done: false }] }] },
  ];
  assert.deepStrictEqual(app.carryoverOptionalDrops(0), []);
  assert.deepStrictEqual(app.S.program.days[0].slots.map(s => s.def), ['cable-fly']);
});

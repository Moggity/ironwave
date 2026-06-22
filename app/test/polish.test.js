/* ============================================================
   IRONWAVE — test/polish.test.js
   Polish-bundle fixes:
   - checkinGroupsForDay must not surface a readiness slider for a
     muscle the athlete removed (slider 0): it now resolves each slot
     and skips the removed ones, matching what the workout view shows.
   - estimateMedianSessionMin gives an onboarding session estimate on
     every track, not just bodybuilding.
   Through the existing test/load-app.js harness (no jsdom).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();

const DEFAULT_FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

function installProgram(over) {
  app.S = app.defaultState();
  app.S.program = app.makeProgram(Object.assign({
    daysPerWeek: 4, track: 'bodybuilding', timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  }, over));
  return app.S.program;
}

// ---------------------------------------------------------------------------
// Check-in references removed muscles
// ---------------------------------------------------------------------------
const chestDay = () => ({ name: 'Chest', slots: [{ type: 'acc', cat: 'chest', def: 'cable-fly' }] });

test('check-in: a present muscle surfaces its readiness slider', () => {
  const prog = installProgram({ muscleFocus: { ...DEFAULT_FOCUS } });
  prog.days = [chestDay()];
  const groups = app.checkinGroupsForDay(prog.days[0]);
  assert.ok(groups.some(g => g.key === 'bench'), 'chest work should ask the bench/pecs check-in');
});

test('check-in: a removed muscle (slider 0) drops its readiness slider', () => {
  const prog = installProgram({ muscleFocus: { ...DEFAULT_FOCUS, chest: 0 } });
  prog.days = [chestDay()];
  // The only slot resolves to removed, so no readiness slider should remain.
  assert.deepStrictEqual(app.checkinGroupsForDay(prog.days[0]), []);
});

test('check-in: removing one muscle leaves the others intact', () => {
  const prog = installProgram({ muscleFocus: { ...DEFAULT_FOCUS, chest: 0 } });
  prog.days = [{ name: 'Mixed', slots: [
    { type: 'acc', cat: 'chest', def: 'cable-fly' },      // removed
    { type: 'acc', cat: 'vpull', def: 'lat-pulldown' },   // kept (back)
  ] }];
  const keys = app.checkinGroupsForDay(prog.days[0]).map(g => g.key);
  assert.ok(!keys.includes('bench'), 'removed chest must not ask the bench check-in');
  assert.ok(keys.includes('upperpull'), 'remaining back work keeps its check-in');
});

// ---------------------------------------------------------------------------
// Onboarding session estimate on every track
// ---------------------------------------------------------------------------
function obFor(track) {
  return { track, daysPerWeek: 4, experience: 'intermediate',
           timeMode: 'unlimited', muscleFocus: { ...DEFAULT_FOCUS }, maxes: {} };
}

for (const track of ['powerbuilding', 'powerlifting', 'bodybuilding']) {
  test(`onboarding estimate: ${track} gets a positive session estimate`, () => {
    app.S = app.defaultState();
    const before = app.S.program;
    const m = app.estimateMedianSessionMin(obFor(track));
    assert.ok(typeof m === 'number' && m > 0, `${track} should get a numeric estimate`);
    assert.strictEqual(app.S.program, before, 'estimate must not leave a program installed');
  });
}

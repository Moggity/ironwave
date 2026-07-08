/* ============================================================
   IRONWAVE — test/feedback-round3.test.js
   User-feedback round 3 (v1.5.0): the read-only dashboard timeline
   (no editor tile, no technique markers), and the reworked
   onboarding defaults (nothing preselected, bodybuilding first,
   renamed goal archetypes). All string/state level, no DOM.
   ============================================================ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();

const FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };
function installProgram() {
  const s = app.defaultState();
  app.S = s;
  s.program = app.makeProgram({ daysPerWeek: 4, track: 'bodybuilding', timeMode: 'unlimited',
    muscleFocus: { ...FOCUS }, maxes: {}, goalArchetype: 'recomp', macroWeeks: 18 });
  return s;
}

// ------------------------------------------------------------
// Timeline: editable flag + no technique markers
// ------------------------------------------------------------
test('the dashboard timeline variant is read-only (no + editor tile)', () => {
  installProgram();
  const dash = app.timelineHTML({ editable: false });
  assert.ok(!dash.includes('tl-add') && !dash.includes('openPlanEditor'), 'no editor entry point');
  const program = app.timelineHTML();
  assert.ok(program.includes('tl-add') && program.includes('openPlanEditor'), 'My Program keeps the editor');
});

test('technique markers are gone from the timeline in both variants', () => {
  installProgram();
  for (const html of [app.timelineHTML(), app.timelineHTML({ editable: false })]) {
    assert.ok(!html.includes('tl-mark'), 'no marker element');
    assert.ok(!html.includes('Myo-reps') && !html.includes('Drop set'), 'no marker legend');
  }
});

// ------------------------------------------------------------
// Onboarding defaults: nothing preselected except program length
// ------------------------------------------------------------
test('fresh onboarding preselects nothing but program length', () => {
  const ob = app.obDefaults();
  assert.strictEqual(ob.daysPerWeek, null);
  assert.strictEqual(ob.track, null);
  assert.strictEqual(ob.goalArchetype, null);
  assert.strictEqual(ob.experience, null);
  assert.strictEqual(ob.timeMode, null);
  assert.strictEqual(ob.macroWeeks, null, 'length defaults to the standard plan');
  assert.strictEqual(ob.showAdvanced, false, 'length presets start hidden');
});

test('bodybuilding leads the track list', () => {
  assert.strictEqual(app.OB_TRACKS[0][0], 'bodybuilding');
});

test('goal archetypes carry the renamed labels, ids unchanged', () => {
  const A = app.GOAL_ARCHETYPES;
  assert.strictEqual(A['serious-macro'].label, 'Serious bodybuilder training');
  assert.strictEqual(A['recomp'].label, 'Look good, stay healthy');
  assert.strictEqual(A['lean-asap'].label, 'Look lean ASAP');
  assert.ok(A['lean-asap'].warn.includes('Look good, stay healthy'), 'warning points at the renamed pick');
});

// makeProgram still works when optional onboarding fields are absent (the
// gated flow guarantees the required ones; the engine never sees nulls).
test('makeProgram is unaffected by the new null defaults when fields are provided', () => {
  const s = app.defaultState();
  app.S = s;
  const prog = app.makeProgram(Object.assign({}, app.obDefaults(), {
    daysPerWeek: 4, track: 'powerbuilding', experience: 'intermediate',
    timeMode: 'unlimited', muscleFocus: { ...FOCUS }, maxes: {},
  }));
  assert.strictEqual(prog.daysPerWeek, 4);
  assert.ok(prog.blocks.length > 0);
});

/* ============================================================
   IRONWAVE — test/h2.test.js
   [Epic H2] Onboarding completeness + check-in honesty:
   - the powerbuilding track card exists (the default was unreachable),
   - bodybuilding check-ins ask soreness by the day's actual muscles
     (strength tracks keep the lift-pattern groups untouched),
   - muscleSignal reads the muscle-keyed slider first, group fallback,
   - injury flags ease the flagged lift's draft (AMRAP off, -10%, +1 RIR)
     and are inert with no flags,
   - two consecutive below-standard AMRAPs offer a working-max reset,
   - the readiness digest chip appears once a check-in exists.
   Through test/load-app.js (no DOM needed).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine } = app;

const FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

function withProgram(track, maxes) {
  const s = app.defaultState();
  app.S = s;
  s.program = app.makeProgram({ daysPerWeek: 4, track, experience: 'intermediate',
    timeMode: 'unlimited', muscleFocus: { ...FOCUS }, maxes: maxes || {} });
  return s;
}

// ---------------------------------------------------------------------------
// H2.1 track cards
// ---------------------------------------------------------------------------
test('all three tracks are pickable from onboarding', () => {
  assert.deepStrictEqual(app.OB_TRACKS, ['bodybuilding', 'powerbuilding', 'powerlifting']);
});

// ---------------------------------------------------------------------------
// H2.4 muscle-named check-in groups
// ---------------------------------------------------------------------------
test('bodybuilding check-in groups are the day muscles, not lift patterns', () => {
  const s = withProgram('bodybuilding');
  const groups = app.checkinGroupsForDay(s.program.days[0]);
  assert.ok(groups.length > 0, 'day has groups');
  assert.ok(groups.every(g => g.muscle), 'every group is muscle-keyed');
  const PATTERNS = ['bench', 'press', 'squat', 'deadlift', 'upperpull'];
  assert.ok(groups.every(g => !PATTERNS.includes(g.key)),
    `no pattern groups, got ${groups.map(g => g.key).join(',')}`);
});

test('powerbuilding check-in groups keep the lift-pattern keys', () => {
  const s = withProgram('powerbuilding');
  const keys = app.checkinGroupsForDay(s.program.days[0]).map(g => g.key);
  assert.ok(keys.some(k => ['bench', 'press', 'squat', 'deadlift', 'upperpull', 'lowback'].includes(k)),
    `pattern keys expected, got ${keys.join(',')}`);
});

test('muscleSignal reads the muscle-keyed slider first, group as fallback', () => {
  const s = withProgram('bodybuilding');
  s.sessions = [{ skipped: false, entries: [{ exId: 'db-fly', sets: [
    { done: true, reps: 12, targetReps: 12 }] }] }];
  s.checkins = [{ sliders: { chest: 5, bench: 1 } }];
  assert.strictEqual(app.muscleSignal('chest').recovery, 5, 'muscle key wins');
  s.checkins = [{ sliders: { bench: 2 } }];
  assert.strictEqual(app.muscleSignal('chest').recovery, 2, 'pattern group still works');
});

// ---------------------------------------------------------------------------
// H2.3 injury easing
// ---------------------------------------------------------------------------
function draftEntry(exId, sets) {
  return { exId, name: exId, si: 0, sets, notes: '', notesOpen: false };
}

test('a flagged lift loses its AMRAP, drops 10% and gains one RIR', () => {
  withProgram('powerbuilding');
  const e = draftEntry('comp-squat', [
    { targetWeight: 100, targetReps: 10, targetRpe: null, amrap: false, ramp: false },
    { targetWeight: 120, targetReps: 5, targetRpe: null, amrap: true, ramp: false },
    { targetWeight: null, targetReps: 12, targetRpe: 8, amrap: false, ramp: false },
  ]);
  app.applyInjuryEasing(e, ['Squat']);
  assert.strictEqual(e.injured, true);
  assert.strictEqual(e.sets[0].targetWeight, 90, '10% off, rounded');
  assert.strictEqual(e.sets[1].amrap, false, 'no AMRAP on a tweak');
  assert.strictEqual(e.sets[1].targetWeight, Engine.roundLoad(120 * 0.9, 2.5));
  assert.strictEqual(e.sets[2].targetRpe, 7, 'one more rep in reserve');
});

test('injury easing is inert for unflagged lifts and empty flags', () => {
  withProgram('powerbuilding');
  const mk = () => draftEntry('comp-bench', [{ targetWeight: 100, targetReps: 5, targetRpe: null, amrap: true, ramp: false }]);
  const e1 = mk(); app.applyInjuryEasing(e1, ['Squat']);
  assert.strictEqual(e1.injured, undefined);
  assert.strictEqual(e1.sets[0].targetWeight, 100);
  assert.strictEqual(e1.sets[0].amrap, true);
  const e2 = mk(); app.applyInjuryEasing(e2, []);
  assert.deepStrictEqual(e2, mk(), 'no flags, byte-identical entry');
});

test('easing skips logged sets and warmup ramps', () => {
  withProgram('powerbuilding');
  const e = draftEntry('comp-squat', [
    { targetWeight: 60, targetReps: 5, ramp: true },
    { targetWeight: 100, targetReps: 10, done: true },
  ]);
  app.applyInjuryEasing(e, ['Squat']);
  assert.strictEqual(e.sets[0].targetWeight, 60, 'ramp untouched');
  assert.strictEqual(e.sets[1].targetWeight, 100, 'logged set untouched');
});

// ---------------------------------------------------------------------------
// H2.5 working-max reset nudge
// ---------------------------------------------------------------------------
test('two below-standard AMRAPs offer a WM reset; confirming applies it', () => {
  const s = withProgram('powerbuilding', { 'comp-squat': 160 });
  const wm0 = s.program.wm['comp-squat'];
  const e = { name: 'Squat', wmKey: 'comp-squat', exId: 'comp-squat' };
  const st = { weight: 100, reps: 6, rpe: 10 }; // a weak AMRAP read
  app.trackBelowStandard(e, st);
  assert.strictEqual(s.program.belowStd['comp-squat'], 1, 'first miss counts');
  assert.strictEqual(s.program.wm['comp-squat'], wm0, 'no change yet');
  app.trackBelowStandard(e, st); // second miss -> confirm dialog is up
  assert.strictEqual(s.program.belowStd['comp-squat'], 0, 'counter re-armed');
  app.confirmResolve(true);
  const implied = Engine.roundLoad(Engine.e1rm(100, 6, 10) * 0.9, 1.25);
  assert.strictEqual(s.program.wm['comp-squat'], implied, 'WM reset to the implied 90%');
  assert.ok(implied < wm0);
});

test('declining the reset keeps the WM and re-arms the counter', () => {
  const s = withProgram('powerbuilding', { 'comp-squat': 160 });
  const wm0 = s.program.wm['comp-squat'];
  const e = { name: 'Squat', wmKey: 'comp-squat', exId: 'comp-squat' };
  const st = { weight: 100, reps: 6, rpe: 10 };
  app.trackBelowStandard(e, st);
  app.trackBelowStandard(e, st);
  app.confirmResolve(false);
  assert.strictEqual(s.program.wm['comp-squat'], wm0);
  assert.strictEqual(s.program.belowStd['comp-squat'], 0);
});

test('no reset offer when the implied max is not below the current WM', () => {
  const s = withProgram('powerbuilding', { 'comp-squat': 100 });
  const e = { name: 'Squat', wmKey: 'comp-squat', exId: 'comp-squat' };
  const st = { weight: 100, reps: 9, rpe: 10 }; // implies MORE than the WM
  app.trackBelowStandard(e, st);
  app.trackBelowStandard(e, st);
  assert.strictEqual(s.program.wm['comp-squat'], Math.round(100 * 0.9 / 1.25) * 1.25);
});

test('migrateState backfills the belowStd counter map', () => {
  const s = withProgram('powerbuilding');
  delete s.program.belowStd;
  app.migrateState(s);
  assert.deepStrictEqual(s.program.belowStd, {});
});

// ---------------------------------------------------------------------------
// H2.2 readiness chip
// ---------------------------------------------------------------------------
test('readiness chip is empty before any check-in, renders after one', () => {
  const s = withProgram('powerbuilding');
  assert.strictEqual(app.readinessChipHTML(), '', 'fresh install shows nothing');
  app.logReadiness(app.computeReadiness());
  const html = app.readinessChipHTML();
  assert.ok(/readiness-chip/.test(html), 'chip renders');
  assert.ok(/openVolumeDashboard/.test(html), 'tap opens the trend screen');
});

test('the chip colors against the athlete baseline', () => {
  const s = withProgram('powerbuilding');
  const now = Date.now(), day = 864e5;
  // Strong 28-day baseline, weak current week -> down.
  s.readinessLog = [];
  for (let i = 0; i < 8; i++) s.readinessLog.push({ ts: now - (10 + i) * day, score: 24 });
  for (let i = 0; i < 4; i++) s.readinessLog.push({ ts: now - i * day, score: 12 });
  s.checkins = [{ sleepHours: 4, sliders: { bench: 1 } }];
  assert.ok(/down/.test(app.readinessChipHTML()), 'weak week reads down');
});

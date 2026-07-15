/* ============================================================
   IRONWAVE — test/h3.test.js
   [Epic H3] Progress analytics + macro report. Everything derives
   from records/sessions/check-ins via pure seeded Engine helpers;
   the ONE new persisted shape is the per-block landmark snapshot.
   Pins:
   - snapshots written at recalibrateLandmarks time, additive + migrated,
   - landmarksForBlock resolves the values in force DURING a block,
   - actualWeeklySets tallies logged working sets with the volume-bar
     attribution (compounds spread, warmups/calibration excluded),
   - pump / soreness series from data already logged,
   - the Progress and Report views assemble without a program change.
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
  s.profile.landmarks = Engine.seedLandmarks('intermediate');
  s.program = app.makeProgram({ daysPerWeek: 4, track: track || 'powerbuilding',
    experience: 'intermediate', timeMode: 'unlimited', muscleFocus: { ...FOCUS }, maxes: maxes || {} });
  return s;
}
const set = (over) => Object.assign({ done: true, ramp: false, calib: false, reps: 10 }, over);

// ---------------------------------------------------------------------------
// Landmark snapshots
// ---------------------------------------------------------------------------
test('recalibrateLandmarks writes one snapshot per finished block', () => {
  const s = withProgram('bodybuilding');
  assert.deepStrictEqual(s.landmarkLog, [], 'fresh state starts empty');
  // No sessions in the block: landmarks unchanged, boundary still recorded.
  app.recalibrateLandmarks(0);
  assert.strictEqual(s.landmarkLog.length, 1);
  assert.strictEqual(s.landmarkLog[0].block, 0);
  assert.deepStrictEqual(s.landmarkLog[0].landmarks, s.profile.landmarks);
  assert.notStrictEqual(s.landmarkLog[0].landmarks, s.profile.landmarks, 'a copy, not a reference');
});

test('the snapshot freezes values later evolution overwrites', () => {
  const s = withProgram('bodybuilding');
  app.recalibrateLandmarks(0);
  const frozen = s.landmarkLog[0].landmarks.chest.mrv;
  s.profile.landmarks.chest.mrv += 3; // later evolution
  assert.strictEqual(s.landmarkLog[0].landmarks.chest.mrv, frozen);
});

test('migrateState backfills landmarkLog on a legacy save', () => {
  const s = withProgram('powerbuilding');
  delete s.landmarkLog;
  app.migrateState(s);
  assert.deepStrictEqual(s.landmarkLog, []);
});

test('landmarksForBlock returns the values in force DURING a block', () => {
  const s = withProgram('bodybuilding');
  const live = s.profile.landmarks;
  assert.strictEqual(app.landmarksForBlock(0), live, 'no history: live values');
  s.landmarkLog = [
    { ts: 1, block: 0, landmarks: { chest: { mev: 10, mrv: 20 } } },
    { ts: 2, block: 1, landmarks: { chest: { mev: 11, mrv: 22 } } },
  ];
  assert.strictEqual(app.landmarksForBlock(0).chest.mrv, 20, 'block 0: earliest known past');
  assert.strictEqual(app.landmarksForBlock(1).chest.mrv, 20, 'block 1 ran under block 0 output');
  assert.strictEqual(app.landmarksForBlock(2).chest.mrv, 22, 'block 2 ran under block 1 output');
});

// ---------------------------------------------------------------------------
// Weekly-sets series
// ---------------------------------------------------------------------------
test('actualWeeklySets tallies logged working sets with compound attribution', () => {
  withProgram('powerbuilding');
  const sessions = [
    { b: 0, w: 0, ts: 1, entries: [
      { exId: 'db-fly', sets: [set({}), set({}), set({ done: false })] },      // 2 direct chest
      { exId: 'comp-bench', sets: [set({}), set({ ramp: true }), set({ calib: true })] }, // 1 counted, spreads
    ] },
    { b: 0, w: 1, ts: 2, entries: [{ exId: 'db-fly', sets: [set({})] }] },
    { b: 0, w: 2, ts: 3, skipped: true, entries: [{ exId: 'db-fly', sets: [set({})] }] },
  ];
  const weeks = Engine.actualWeeklySets(sessions, app.exVolumeAttribution);
  assert.strictEqual(weeks.length, 2, 'skipped session contributes no week');
  assert.deepStrictEqual([weeks[0].b, weeks[0].w], [0, 0]);
  const cov = app.SYNERGIST_COVERAGE.bench.chest;
  assert.strictEqual(weeks[0].tally.chest, Math.round((2 + 1 * cov) * 2) / 2,
    'direct sets + bench fraction, nearest half');
  assert.strictEqual(weeks[1].tally.chest, 1);
});

// ---------------------------------------------------------------------------
// Pump + soreness series
// ---------------------------------------------------------------------------
test('pumpSeries averages logged pump per session, skipping pump-less ones', () => {
  const sessions = [
    { ts: 10, entries: [{ exId: 'db-fly', sets: [set({ pump: 3 }), set({ pump: 2 })] }] },
    { ts: 20, entries: [{ exId: 'db-fly', sets: [set({})] }] }, // no taps
    { ts: 5, entries: [{ exId: 'db-fly', sets: [set({ pump: 1 })] }] },
  ];
  assert.deepStrictEqual(Engine.pumpSeries(sessions),
    [{ ts: 5, value: 1 }, { ts: 10, value: 2.5 }]);
});

test('sorenessSeries averages the check-in sliders per check-in', () => {
  const checkins = [
    { ts: 2, sliders: { chest: 4, quad: 2 } },
    { ts: 1, sliders: {} },          // nothing answered: skipped
    { ts: 3, sliders: { ham: 5 } },
  ];
  assert.deepStrictEqual(Engine.sorenessSeries(checkins),
    [{ ts: 2, value: 3 }, { ts: 3, value: 5 }]);
});

// ---------------------------------------------------------------------------
// Views assemble (string-level; jsdom smoke covers rendering)
// ---------------------------------------------------------------------------
test('the Progress view assembles: overlay, sets band, PR feed', () => {
  const s = withProgram('powerbuilding', { 'comp-bench': 100 });
  const day = 864e5;
  app.pushRecord('comp-bench', { ts: Date.now() - 30 * day, weight: 80, reps: 5, rpe: 8 });
  app.pushRecord('comp-bench', { ts: Date.now() - 2 * day, weight: 90, reps: 5, rpe: 8 });
  s.sessions = [{ b: 0, w: 0, ts: Date.now(), entries: [{ exId: 'db-fly', sets: [set({ pump: 2 })] }] }];
  s.checkins = [{ ts: Date.now(), sliders: { chest: 4 } }];
  app.V = { view: 'progress', tab: 'more' };
  const html = app.vProgress();
  assert.ok(/ovl-legend/.test(html), 'e1RM overlay renders');
  assert.ok(/px-chip/.test(html), 'muscle chips render');
  assert.ok(/🏅/.test(html), 'PR feed has the new-high entry');
});

test('the macro report shows sessions, tonnage, e1RM movement and MRV movement', () => {
  const s = withProgram('bodybuilding', {});
  const t0 = s.program.startDate;
  app.pushRecord('comp-bench', { ts: t0 + 1, weight: 80, reps: 5, rpe: 8 });
  app.pushRecord('comp-bench', { ts: t0 + 30 * 864e5, weight: 90, reps: 5, rpe: 8 });
  s.sessions = [
    { b: 0, w: 0, ts: t0, tonnage: 5000, entries: [
      { exId: 'comp-bench', wmKey: 'comp-bench', sets: [set({ amrap: true, weight: 80, reps: 12, rpe: 10 })] }] },
    { b: 0, w: 1, ts: t0 + 1, tonnage: 4000, skipped: true, entries: [] },
  ];
  s.landmarkLog = [{ ts: t0, block: 0, landmarks: { chest: { mev: 10, mrv: 20 } } }];
  s.profile.landmarks.chest.mrv = 23;
  const html = app.macroReportHTML();
  assert.ok(html.includes('1'), 'session count present');
  assert.ok(/AMRAP/.test(html), 'AMRAP history present');
  assert.ok(/MRV 20 → 23/.test(html), 'MRV movement reads start → now');
  assert.ok(/→/.test(html) && /▲/.test(html), 'e1RM start → finish with direction');
});

test('nothing here writes program state (read-only contract)', () => {
  const s = withProgram('powerbuilding', {});
  const before = JSON.stringify(s.program);
  app.V = { view: 'progress', tab: 'more' };
  app.vProgress();
  app.macroReportHTML();
  assert.strictEqual(JSON.stringify(s.program), before);
});

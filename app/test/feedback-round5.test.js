/* ============================================================
   IRONWAVE — test/feedback-round5.test.js
   User-feedback round 5:
   - refreshDraftTargets: a corrected max (seed / working max / deleted
     record) re-prescribes the ACTIVE session draft's un-logged sets,
     keeping every logged set and the notes.
   - Partials set rows drop the "then 22.5kg×6" detail (noise: partials
     ride the working weight and run to near failure).
   - previewSetLabel speaks RIR, not RPE (the preview was the one surface
     still showing "@ 7 RPE").
   - Onboarding language: English default (no auto-detect), obLang applies
     an explicit pick immediately.
   Through the test/load-app.js harness (no jsdom).
   ============================================================ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const DEFAULT_FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

function freshProgram(track) {
  app.S = app.defaultState();
  app.S.program = app.makeProgram({
    daysPerWeek: 4, track, timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  });
  return app.S.program;
}
// A draft snapshot the way beginSession builds one.
function draftFor(di, b, w) {
  const built = app.resolveDayEntries(di, b, w);
  return { id: 's1', ts: 1, b, w, d: di, entries: built.items.map(app.sessionEntryFrom) };
}

// ------------------------------------------------------------
// refreshDraftTargets
// ------------------------------------------------------------
test('a corrected accessory max re-prescribes the un-logged draft sets in place', () => {
  const p = freshProgram('bodybuilding');
  // First resolve just to find an accessory slot on day 0.
  const probe = app.resolveDayEntries(0, 0, 1).items.find(x => !x.rs.isMain && !x.rs.isSecondary);
  assert.ok(probe, 'day 0 has an accessory');
  const exId = probe.rs.exId;
  // Anchor it high (a wrongly entered 10RM seed), snapshot the draft. The
  // timestamp must be recent: bestE1RM only trusts the last 120 days.
  app.S.records[exId] = [{ ts: Date.now(), weight: 50, reps: 10, rpe: 10, seed: true }];
  app.V = { draft: draftFor(0, 0, 1) };
  const dr = app.V.draft;
  const ei = dr.entries.findIndex(e => e.exId === exId);
  assert.ok(ei >= 0, 'the accessory is in the draft');
  const before = dr.entries[ei].sets.map(s => s.targetWeight);
  assert.ok(before.every(w => w > 0), 'seeded max prescribes real weights');
  // Log the first set, keep a note, then correct the seed DOWN (what
  // saveExMaxes does: replace the seed records).
  const logged = dr.entries[ei].sets[0];
  Object.assign(logged, { done: true, weight: 30, reps: 12, rpe: 8 });
  dr.entries[ei].notes = 'left knee niggle';
  app.S.records[exId] = [{ ts: Date.now(), weight: 25, reps: 10, rpe: 10, seed: true }];
  app.refreshDraftTargets(exId);
  const after = dr.entries[ei];
  assert.strictEqual(after.sets[0], logged, 'a logged set is untouched');
  assert.strictEqual(after.notes, 'left knee niggle', 'notes survive the refresh');
  for (let j = 1; j < after.sets.length; j++) {
    assert.ok(after.sets[j].targetWeight < before[j],
      `un-logged set ${j + 1} picked up the lower corrected max`);
    assert.strictEqual(after.sets[j].done, false);
  }
});

test('a working max change refreshes the main lift keyed off it, and only it', () => {
  const p = freshProgram('powerbuilding');
  // Whatever lift day 0 mains, anchor it: wave weights hang off the WM.
  const probe = app.resolveDayEntries(0, 0, 1).items.find(x => x.rs.isMain);
  assert.ok(probe, 'day 0 has a main lift');
  const wmKey = probe.rs.wmKey;
  p.wm[wmKey] = 100;
  app.V = { draft: draftFor(0, 0, 1) }; // week 2: weighted pct-of-WM work
  const dr = app.V.draft;
  const main = dr.entries.find(e => e.isMain && e.wmKey === wmKey);
  const otherBefore = dr.entries.filter(e => e.wmKey !== wmKey)
    .map(e => e.sets.map(s => s.targetWeight));
  const before = main.sets[0].targetWeight;
  assert.ok(before > 0, 'WM prescribes a real weight');
  p.wm[wmKey] = 120;
  app.refreshDraftTargets(wmKey);
  const mainAfter = dr.entries.find(e => e.isMain && e.wmKey === wmKey);
  assert.ok(mainAfter.sets[0].targetWeight > before, 'main targets follow the new WM');
  const otherAfter = dr.entries.filter(e => e.wmKey !== wmKey)
    .map(e => e.sets.map(s => s.targetWeight));
  assert.deepStrictEqual(otherAfter, otherBefore, 'unrelated entries are untouched');
});

test('refreshDraftTargets is a no-op without an active draft', () => {
  freshProgram('powerbuilding');
  app.V = { draft: null };
  assert.doesNotThrow(() => app.refreshDraftTargets('comp-squat'));
});

// ------------------------------------------------------------
// Partials rows: no per-row detail
// ------------------------------------------------------------
test('a partials set row drops the badge and the "then WxR" detail', () => {
  const st = { targetWeight: 22.5, targetReps: 12, targetRpe: 7,
    technique: 'partials', dropTargets: [{ weight: 22.5, reps: 6 }] };
  const label = app.setTargetLabel(st, 'leg-extensions');
  assert.ok(!/then|×6|partial/i.test(label), 'no partials verbosity on the row');
  assert.match(label, /22\.5.*× 12/);
});

test('a drop set row keeps its strip targets (different weights are real info)', () => {
  const st = { targetWeight: 40, targetReps: 12, targetRpe: 8,
    technique: 'drop', dropTargets: [{ weight: 32.5, reps: 12 }, { weight: 25, reps: 12 }] };
  const label = app.setTargetLabel(st, 'leg-extensions');
  assert.match(label, /32\.5.*×12/, 'drop strip weights still shown');
});

// ------------------------------------------------------------
// previewSetLabel: RIR, never RPE
// ------------------------------------------------------------
test('the preview speaks RIR like every other surface', () => {
  const weighted = app.previewSetLabel({ weight: 60, reps: 10, rpe: 7 }, 'comp-bench');
  assert.match(weighted, /60kg × 10 @ 3 RIR/);
  assert.ok(!/RPE/.test(weighted), 'no RPE in the preview');
  const calib = app.previewSetLabel({ reps: 12, rpe: 6, calib: true }, 'ez-curl');
  assert.match(calib, /12 @ 4 RIR/);
  const amrap = app.previewSetLabel({ weight: 80, reps: 10, rpe: 10, amrap: true }, 'comp-bench');
  assert.match(amrap, /AMRAP/);
});

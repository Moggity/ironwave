/* ============================================================
   IRONWAVE — test/h5.test.js
   [Epic H5] Split editing + mid-macro re-spec (bodybuilding):
   - the editor mutates the SAME days[].slots[] shape the generator
     emits: move accessory between days, rename, add/remove a day
     (current-week completion marks re-key on removal),
   - frequency chips read trained days vs the slider target,
   - focus re-spec: pendingFocus regenerates the split at the block
     boundary, preserving wm + landmarks (volAdj resets as always),
   - other tracks and untouched programs are unaffected.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();

const FOCUS = { arms: 2, chest: 2, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 2 }; // [B4] 0-4 scale standard

function withProgram(focusOver) {
  const s = app.defaultState();
  app.S = s;
  s.program = app.makeProgram({ daysPerWeek: 4, track: 'bodybuilding', experience: 'intermediate',
    timeMode: 'unlimited', muscleFocus: Object.assign({ ...FOCUS }, focusOver || {}), maxes: {} });
  app.V = { dayIdx: null, view: 'program', tab: 'more' };
  return s;
}

// ---------------------------------------------------------------------------
// Editing primitives
// ---------------------------------------------------------------------------
test('seMove moves an accessory slot between days, same object', () => {
  const s = withProgram();
  const p = s.program;
  const di = p.days.findIndex(d => d.slots.some(sl => sl.type === 'acc'));
  const si = p.days[di].slots.findIndex(sl => sl.type === 'acc');
  const slot = p.days[di].slots[si];
  const dj = (di + 1) % p.days.length;
  const before = p.days[dj].slots.length;
  app.seMove(di, si, String(dj));
  assert.ok(!p.days[di].slots.includes(slot), 'gone from the source day');
  assert.strictEqual(p.days[dj].slots[before], slot, 'appended to the target day, same object');
});

test('seRename sets the plain name and clears theme/nameKey so it wins', () => {
  const s = withProgram();
  const d = s.program.days[0];
  d.theme = { primary: 'chest' }; d.nameKey = 'x';
  app.seRename(0, '  Push A ');
  assert.strictEqual(d.name, 'Push A');
  assert.ok(!('theme' in d) && !('nameKey' in d));
  assert.strictEqual(app.dayTheme(d), 'Push A');
});

test('seAddDay appends an empty day and tracks daysPerWeek', () => {
  const s = withProgram();
  app.seAddDay();
  assert.strictEqual(s.program.days.length, 5);
  assert.strictEqual(s.program.daysPerWeek, 5);
  assert.deepStrictEqual(s.program.days[4].slots, []);
});

test('seRemoveDay re-keys the current week completion marks past the gap', () => {
  const s = withProgram();
  const p = s.program;
  p.days[1].slots = []; // empty: removes without a confirm
  p.completedDays['0-0-0'] = 's1';
  p.completedDays['0-0-2'] = 's3';
  p.completedDays['0-0-3'] = 's4';
  app.seRemoveDay(1);
  assert.strictEqual(p.days.length, 3);
  assert.strictEqual(p.daysPerWeek, 3);
  assert.strictEqual(p.completedDays['0-0-0'], 's1', 'earlier day untouched');
  assert.strictEqual(p.completedDays['0-0-1'], 's3', 'later days shift left');
  assert.strictEqual(p.completedDays['0-0-2'], 's4');
  assert.strictEqual(p.completedDays['0-0-3'], undefined);
});

test('frequency chips flag a muscle trained under its slider target', () => {
  const s = withProgram();
  const p = s.program;
  // Strip every chest slot: chest (slider 3 -> 2x target) now reads 0/2x.
  for (const d of p.days) d.slots = d.slots.filter(sl =>
    !(sl.cat && ['chest', 'bench'].includes(sl.cat)) &&
    !(sl.type === 'main' && (app.exById(sl.lift) || {}).movement === 'bench'));
  const html = app.seFreqChips();
  assert.ok(/warn[^>]*>Chest 0\/2x/.test(html), 'chest chip reads 0/2x and warns');
  assert.ok(!/warn[^>]*>Back/.test(html), 'back still meets its target');
});

// ---------------------------------------------------------------------------
// Mid-macro focus re-spec
// ---------------------------------------------------------------------------
test('feSave stores pendingFocus; endBlock regenerates the split from it', () => {
  const s = withProgram();
  const p = s.program;
  p.wm['comp-bench'] = 80;
  const lmBefore = JSON.stringify(s.profile.landmarks);
  app.V.feDraft = Object.assign({}, FOCUS, { chest: 4, legs: 1 });
  app.feSave();
  assert.deepStrictEqual(p.pendingFocus.chest, 4, 'stored on the program');
  const oldDays = p.days;
  // Cross the block boundary.
  p.pointer.week = p.weeksPerBlock - 1;
  app.advanceWeek();
  assert.strictEqual(p.pointer.block, 1, 'block advanced');
  assert.notStrictEqual(p.days, oldDays, 'split regenerated');
  assert.strictEqual(p.pendingFocus, null, 'pending focus spent');
  assert.strictEqual(p.trainingConfig.muscleFocus.chest, 4, 'config follows');
  assert.strictEqual(p.wm['comp-bench'], 80, 'working maxes preserved');
  assert.strictEqual(JSON.stringify(s.profile.landmarks), lmBefore, 'landmarks preserved');
  const chestDays = p.days.filter(d => app.splitDayMuscles(d).has('chest')).length;
  const legDays = p.days.filter(d => app.splitDayMuscles(d).has('legs')).length;
  assert.ok(chestDays >= legDays, 'the new split reflects the new focus');
});

test('no pendingFocus: endBlock keeps the split and rotates as before', () => {
  const s = withProgram();
  const p = s.program;
  const oldDays = p.days;
  p.pointer.week = p.weeksPerBlock - 1;
  app.advanceWeek();
  assert.strictEqual(p.days, oldDays, 'same days array (rotation mutates in place)');
  assert.strictEqual(p.pendingFocus || null, null);
});

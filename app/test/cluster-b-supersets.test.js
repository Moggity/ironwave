/* ============================================================
   IRONWAVE — test/cluster-b-supersets.test.js
   Cluster B / Epic 2, first slice of supersets: pair an accessory with the
   NEXT accessory on a day (one shared rest per round).
   - resolveDayEntries tags both paired entries (head / tail), bodybuilding
     only, inert without the flag (golden master holds).
   - estimateSessionSec charges a shared rest, so a supersetted day is shorter.
   - supersetLayout / toggleSuperset drive the overview control: pairs only,
     no giant-set chains.
   Through the existing test/load-app.js harness (no jsdom).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const DEFAULT_FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

// A day with three plain accessories so pairing has room to work.
function bbDay(track = 'bodybuilding') {
  app.S = app.defaultState();
  app.V = {};
  app.S.program = app.makeProgram({
    daysPerWeek: 4, track, timeMode: 'unlimited', muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  });
  for (const id of ['cable-fly', 'triceps-pushdown', 'lateral-raise']) {
    app.S.records[id] = [{ ts: Date.now(), weight: 20, reps: 12, rpe: 8 }];
  }
  app.S.program.days = [{ name: 'D1', slots: [
    { type: 'acc', cat: 'chest', def: 'cable-fly', ex: 'cable-fly' },
    { type: 'acc', cat: 'tricep', def: 'triceps-pushdown', ex: 'triceps-pushdown' },
    { type: 'acc', cat: 'shoulder', def: 'lateral-raise', ex: 'lateral-raise' },
  ] }];
  return app.S.program;
}
const headOf = (built, exId) => built.items.find(x => x.rs.exId === exId).rs;

// ---------------------------------------------------------------------------
// resolveDayEntries tagging
// ---------------------------------------------------------------------------
test('a superset flag pairs an accessory with the next, tagging head and tail', () => {
  const p = bbDay();
  p.days[0].slots[0].superset = true;            // cable-fly supersets with triceps-pushdown
  const built = app.resolveDayEntries(0, 0, 0);
  const fly = headOf(built, 'cable-fly');
  const push = headOf(built, 'triceps-pushdown');
  const lat = headOf(built, 'lateral-raise');
  assert.strictEqual(fly.superset, true);
  assert.strictEqual(fly.supersetRole, 'head');
  assert.strictEqual(fly.supersetPartner, push.name);
  assert.strictEqual(push.superset, true);
  assert.strictEqual(push.supersetRole, 'tail');
  assert.strictEqual(push.supersetPartner, fly.name);
  assert.ok(!lat.superset, 'the unpaired accessory is untouched');
});

test('superset tagging is inert without the flag and off the bodybuilding track', () => {
  const p = bbDay();
  assert.ok(app.resolveDayEntries(0, 0, 0).items.every(x => !x.rs.superset), 'no flag, no pairing');
  const pl = bbDay('powerlifting');
  pl.days[0].slots[0].superset = true;
  assert.ok(app.resolveDayEntries(0, 0, 0).items.every(x => !x.rs.superset), 'flag is inert off-track');
});

test('no giant sets: a consumed tail does not also start a new pair', () => {
  const p = bbDay();
  p.days[0].slots[0].superset = true;            // fly -> pushdown
  p.days[0].slots[1].superset = true;            // pushdown would -> lateral, but it is already a tail
  const built = app.resolveDayEntries(0, 0, 0);
  assert.strictEqual(headOf(built, 'triceps-pushdown').supersetRole, 'tail');
  assert.ok(!headOf(built, 'lateral-raise').superset, 'the third accessory stays unpaired (pairs only)');
});

// ---------------------------------------------------------------------------
// Time accounting
// ---------------------------------------------------------------------------
test('a supersetted day estimates shorter than the same day unpaired', () => {
  const p = bbDay();
  const base = app.estimateSessionSec(app.resolveDayEntries(0, 0, 0).items.map(x => x.rs), false);
  p.days[0].slots[0].superset = true;
  const paired = app.estimateSessionSec(app.resolveDayEntries(0, 0, 0).items.map(x => x.rs), false);
  assert.ok(paired < base, `superset should save time (${paired} < ${base})`);
});

// ---------------------------------------------------------------------------
// Overview control: layout + toggle
// ---------------------------------------------------------------------------
test('supersetLayout reports roles and which slots can start a superset', () => {
  const p = bbDay();
  p.days[0].slots[0].superset = true;
  const { byId, eligible } = app.supersetLayout(0, 0, 0);
  assert.strictEqual(byId[0].role, 'head');
  assert.strictEqual(byId[1].role, 'tail');
  assert.ok(!byId[2], 'the last accessory is unpaired');
  // A head can still toggle (to unlink); a tail cannot start its own pair.
  assert.ok(eligible.has(0) && !eligible.has(1));
});

test('toggleSuperset turns a pair on and off, and clears a chain when turning on', () => {
  const p = bbDay();
  p.days[0].slots[1].superset = true;            // pre-existing pushdown -> lateral
  app.toggleSuperset(0, 0);                       // turn on fly -> pushdown
  assert.strictEqual(p.days[0].slots[0].superset, true);
  assert.strictEqual(p.days[0].slots[1].superset, false, 'the partner flag is cleared to avoid a chain');
  app.toggleSuperset(0, 0);                       // turn back off
  assert.strictEqual(p.days[0].slots[0].superset, false);
});

/* ============================================================
   IRONWAVE — test/cluster-b-supersets.test.js
   Cluster B / Epic 2, supersets + giant sets: a run of consecutive accessories
   linked by the `superset` flag is performed as one alternating group, sharing
   one rest per round.
   - resolveDayEntries groups the run and tags every member (head/member, group
     id, index, size, names). Bodybuilding only, inert without the flag.
   - estimateSessionSec charges 1/size the rest per supersetted set, so a group
     estimates shorter (more so for a giant set).
   - the time cap keeps a whole group together (all core or all optional).
   - supersetLayout / toggleSuperset drive the overview (chains allowed).
   Through the existing test/load-app.js harness (no jsdom).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const DEFAULT_FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

// A day with three plain accessories so grouping has room to work.
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
const rsOf = (built, exId) => built.items.find(x => x.rs.exId === exId).rs;

// ---------------------------------------------------------------------------
// resolveDayEntries grouping
// ---------------------------------------------------------------------------
test('a superset flag pairs an accessory with the next, tagging head and member', () => {
  const p = bbDay();
  p.days[0].slots[0].superset = true;            // cable-fly supersets with triceps-pushdown
  const built = app.resolveDayEntries(0, 0, 0);
  const fly = rsOf(built, 'cable-fly');
  const push = rsOf(built, 'triceps-pushdown');
  const lat = rsOf(built, 'lateral-raise');
  assert.strictEqual(fly.superset, true);
  assert.strictEqual(fly.supersetRole, 'head');
  assert.strictEqual(fly.supersetSize, 2);
  assert.strictEqual(fly.supersetPartner, push.name);
  assert.strictEqual(push.supersetRole, 'member');
  assert.strictEqual(push.supersetGroup, fly.supersetGroup);
  assert.strictEqual(push.supersetPartner, fly.name);
  assert.ok(!lat.superset, 'the unlinked accessory is untouched');
});

test('chained flags form a giant set (3+), every member tagged with the group', () => {
  const p = bbDay();
  p.days[0].slots[0].superset = true;            // fly -> pushdown
  p.days[0].slots[1].superset = true;            // pushdown -> lateral  => one group of 3
  const built = app.resolveDayEntries(0, 0, 0);
  const members = ['cable-fly', 'triceps-pushdown', 'lateral-raise'].map(id => rsOf(built, id));
  assert.ok(members.every(m => m.superset && m.supersetSize === 3), 'all three are one group');
  assert.strictEqual(new Set(members.map(m => m.supersetGroup)).size, 1, 'same group id');
  assert.deepStrictEqual(members.map(m => m.supersetIndex), [0, 1, 2]);
  assert.deepStrictEqual(members.map(m => m.supersetRole), ['head', 'member', 'member']);
});

test('superset tagging is inert without the flag and off the bodybuilding track', () => {
  bbDay();
  assert.ok(app.resolveDayEntries(0, 0, 0).items.every(x => !x.rs.superset), 'no flag, no grouping');
  const pl = bbDay('powerlifting');
  pl.days[0].slots[0].superset = true;
  assert.ok(app.resolveDayEntries(0, 0, 0).items.every(x => !x.rs.superset), 'flag is inert off-track');
});

// ---------------------------------------------------------------------------
// Time accounting
// ---------------------------------------------------------------------------
test('a group estimates shorter than unpaired, and a giant set shorter than a pair', () => {
  const p = bbDay();
  const time = () => app.estimateSessionSec(app.resolveDayEntries(0, 0, 0).items.map(x => x.rs), false);
  const base = time();
  p.days[0].slots[0].superset = true;            // a pair
  const pair = time();
  p.days[0].slots[1].superset = true;            // extend to a giant set of 3
  const giant = time();
  assert.ok(pair < base, `pair should save time (${pair} < ${base})`);
  assert.ok(giant < pair, `giant set should save more (${giant} < ${pair})`);
});

// ---------------------------------------------------------------------------
// Cap keeps a group together
// ---------------------------------------------------------------------------
test('the time cap keeps a superset group together (all core or all optional)', () => {
  const p = bbDay();
  p.days[0].slots[0].superset = true;            // fly + pushdown are one unit
  // Find a cap that splits the day: core fits the group but not the standalone.
  p.trainingConfig.timeMode = 'custom';
  p.trainingConfig.timeCapMin = 999;
  const full = app.resolveDayEntries(0, 0, 0).fullMin;
  p.trainingConfig.timeCapMin = full - 1;        // just under: something must drop
  const built = app.resolveDayEntries(0, 0, 0);
  const fly = built.items.find(x => x.rs.exId === 'cable-fly').rs;
  const push = built.items.find(x => x.rs.exId === 'triceps-pushdown').rs;
  assert.strictEqual(!!fly.optional, !!push.optional, 'the group shares one core/optional fate');
});

// ---------------------------------------------------------------------------
// Overview control: layout + toggle (chains allowed)
// ---------------------------------------------------------------------------
test('supersetLayout reports group roles/size and which slots can link', () => {
  const p = bbDay();
  p.days[0].slots[0].superset = true;
  p.days[0].slots[1].superset = true;            // giant set of 3
  const { byId, eligible } = app.supersetLayout(0, 0, 0);
  assert.strictEqual(byId[0].role, 'head');
  assert.strictEqual(byId[0].size, 3);
  assert.strictEqual(byId[1].role, 'member');
  assert.strictEqual(byId[2].role, 'member');
  // Every accessory with a following accessory can link (0 and 1, not the last).
  assert.ok(eligible.has(0) && eligible.has(1) && !eligible.has(2));
});

test('toggleSuperset links and unlinks, allowing chains (no auto-clear)', () => {
  const p = bbDay();
  p.days[0].slots[1].superset = true;            // pushdown -> lateral
  app.toggleSuperset(0, 0);                       // link fly -> pushdown, chaining into a giant set
  assert.strictEqual(p.days[0].slots[0].superset, true);
  assert.strictEqual(p.days[0].slots[1].superset, true, 'the existing link is preserved (chain, not cleared)');
  assert.strictEqual(app.resolveDayEntries(0, 0, 0).items.find(x => x.rs.exId === 'cable-fly').rs.supersetSize, 3);
  app.toggleSuperset(0, 0);                       // unlink the first link
  assert.strictEqual(p.days[0].slots[0].superset, false);
});

// ---------------------------------------------------------------------------
// Per-round shared rest (Epic 2 polish)
// ---------------------------------------------------------------------------
test('supersetRoundComplete arms only once every member logged the round', () => {
  const p = bbDay();
  p.days[0].slots[0].superset = true;            // fly + pushdown, one pair
  const built = app.resolveDayEntries(0, 0, 0);
  const entries = built.items.filter(x => x.rs.superset).map(x => ({
    exId: x.rs.exId, name: x.rs.name, superset: true, supersetGroup: x.rs.supersetGroup,
    sets: x.rs.sets.map(s => ({ done: false })),
  }));
  const fly = entries[0], push = entries[1];
  // Round 0: log the first member only -> not complete; the other is next up.
  fly.sets[0].done = true;
  assert.strictEqual(app.supersetRoundComplete(entries, fly, 0), false);
  assert.strictEqual(app.supersetNextInRound(entries, fly, 0).exId, push.exId);
  // Log the second member -> the round is complete (rest may arm).
  push.sets[0].done = true;
  assert.strictEqual(app.supersetRoundComplete(entries, push, 0), true);
  assert.strictEqual(app.supersetNextInRound(entries, push, 0), undefined);
});

// ---------------------------------------------------------------------------
// Reorder within a group (Epic 2 polish)
// ---------------------------------------------------------------------------
test('moveSupersetMember reorders within the group and keeps it intact', () => {
  const p = bbDay();
  p.days[0].slots[0].superset = true;
  p.days[0].slots[1].superset = true;            // giant set: fly, pushdown, lateral
  const order = () => app.resolveDayEntries(0, 0, 0).items
    .filter(x => x.rs.superset).sort((a, b) => a.rs.supersetIndex - b.rs.supersetIndex).map(x => x.rs.exId);
  assert.deepStrictEqual(order(), ['cable-fly', 'triceps-pushdown', 'lateral-raise']);
  // Move the last member up one place; the group stays a size-3 run, reordered.
  app.moveSupersetMember(0, 2, -1);
  assert.deepStrictEqual(order(), ['cable-fly', 'lateral-raise', 'triceps-pushdown']);
  assert.ok(app.resolveDayEntries(0, 0, 0).items.filter(x => x.rs.superset).every(x => x.rs.supersetSize === 3),
    'still one group of three after the move');
});

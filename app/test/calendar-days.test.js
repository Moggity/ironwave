/* ============================================================
   IRONWAVE — test/calendar-days.test.js
   [Calendar days] Onboarding picks WHICH weekdays the athlete
   trains (0 = Monday .. 6 = Sunday) instead of only how many,
   plus a per-day competitive-sport flag. The day count stays a
   derived value (trainingDays.length), so templates, the split
   generator, and the 1..7 bounds all keep working unchanged.
   The weekday map lives on program.schedule, index-aligned with
   days[]; the sport flag is captured now and consumed by the
   future sport-aware scheduling epic.
   - toggle logic (derived count, flag cleared on deselect);
   - makeProgram stores schedule only when weekdays were given
     (count-only builds stay byte-identical: golden master safe);
   - split editor add/remove keeps schedule index-aligned;
   - templates never carry a schedule (it is athlete-personal);
   - new-cycle carryover preserves weekdays + sport flags.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();

const FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

function baseOb(over) {
  return Object.assign({ daysPerWeek: null, trainingDays: [], sportDays: [],
    track: 'powerbuilding', experience: 'intermediate', timeMode: 'unlimited',
    muscleFocus: { ...FOCUS }, maxes: {} }, over || {});
}
function freshV() {
  app.S = app.defaultState();
  app.V = { view: 'onboarding', ob: app.obDefaults(), obStep: 1, dayIdx: null };
  return app.V.ob;
}

// ---------------------------------------------------------------------------
// Toggle logic
// ---------------------------------------------------------------------------
test('obToggleDay: selection sorts by weekday and derives the day count', () => {
  const ob = freshV();
  app.obToggleDay(4); app.obToggleDay(0); app.obToggleDay(2);
  assert.deepStrictEqual(ob.trainingDays, [0, 2, 4], 'kept in weekday order');
  assert.strictEqual(ob.daysPerWeek, 3, 'count is derived');
  app.obToggleDay(2);
  assert.deepStrictEqual(ob.trainingDays, [0, 4]);
  assert.strictEqual(ob.daysPerWeek, 2);
});

test('obToggleDay: an empty selection derives null so the continue gate closes', () => {
  const ob = freshV();
  app.obToggleDay(3);
  assert.strictEqual(ob.daysPerWeek, 1);
  app.obToggleDay(3);
  assert.strictEqual(ob.daysPerWeek, null);
});

test('obToggleSport: flags a day; deselecting the day clears its flag', () => {
  const ob = freshV();
  app.obToggleDay(2); app.obToggleDay(5);
  app.obToggleSport(null, 5);
  assert.deepStrictEqual(ob.sportDays, [5]);
  app.obToggleSport(null, 5);
  assert.deepStrictEqual(ob.sportDays, [], 'the pill toggles off');
  app.obToggleSport(null, 5);
  app.obToggleDay(5); // deselect the day itself
  assert.deepStrictEqual(ob.sportDays, [], 'no orphan sport flag on an untrained day');
  assert.deepStrictEqual(ob.trainingDays, [2]);
});

// ---------------------------------------------------------------------------
// Dual mode: specific days (default) vs days per week
// ---------------------------------------------------------------------------
test('obDaysMode: switching modes carries the count and keeps each selection', () => {
  const ob = freshV();
  assert.strictEqual(ob.daysMode, 'calendar', 'specific days is the default');
  app.obToggleDay(1); app.obToggleDay(3);
  app.obDaysMode('count');
  assert.strictEqual(ob.daysPerWeek, 2, 'the derived count seeds count mode');
  app.obDays(5);
  assert.strictEqual(ob.daysPerWeek, 5);
  app.obDaysMode('calendar');
  assert.strictEqual(ob.daysPerWeek, 2, 'calendar re-derives from the kept weekdays');
  assert.deepStrictEqual(ob.trainingDays, [1, 3], 'the weekday picks survived the round trip');
});

test('count mode never attaches a schedule, even with stale weekday picks', () => {
  app.S = app.defaultState();
  const p = app.makeProgram(baseOb({ daysMode: 'count', daysPerWeek: 3,
    trainingDays: [0, 2, 4], sportDays: [2] }));
  assert.strictEqual(p.days.length, 3);
  assert.ok(!('schedule' in p), 'a floating week carries no weekday map');
});

// ---------------------------------------------------------------------------
// makeProgram: the schedule rides alongside, count-only stays identical
// ---------------------------------------------------------------------------
test('makeProgram stores an index-aligned weekday map with sport flags', () => {
  app.S = app.defaultState();
  const p = app.makeProgram(baseOb({ daysPerWeek: 3, trainingDays: [0, 2, 4], sportDays: [2] }));
  assert.deepStrictEqual(p.schedule,
    [{ wd: 0, sport: false }, { wd: 2, sport: true }, { wd: 4, sport: false }]);
  assert.strictEqual(p.days.length, 3);
  assert.strictEqual(p.schedule.length, p.days.length, 'index-aligned with days');
});

test('a count-only build has NO schedule key at all (golden master safety)', () => {
  app.S = app.defaultState();
  const p = app.makeProgram(baseOb({ daysPerWeek: 4 }));
  assert.ok(!('schedule' in p), 'absent, not null or empty');
  const legacy = app.makeProgram({ daysPerWeek: 4, track: 'powerbuilding',
    experience: 'intermediate', timeMode: 'unlimited', muscleFocus: { ...FOCUS }, maxes: {} });
  assert.ok(!('schedule' in legacy), 'an ob without the new fields builds as before');
});

test('the frequency extremes keep their schedules: 1 day and all 7', () => {
  app.S = app.defaultState();
  const one = app.makeProgram(baseOb({ daysPerWeek: 1, trainingDays: [6], sportDays: [] }));
  assert.deepStrictEqual(one.schedule, [{ wd: 6, sport: false }]);
  assert.strictEqual(one.days.length, 1);
  const all = [0, 1, 2, 3, 4, 5, 6];
  const seven = app.makeProgram(baseOb({ daysPerWeek: 7, trainingDays: all, sportDays: [5, 6] }));
  assert.strictEqual(seven.days.length, 7);
  assert.deepStrictEqual(seven.schedule.map(x => x.wd), all);
  assert.deepStrictEqual(seven.schedule.filter(x => x.sport).map(x => x.wd), [5, 6]);
});

test('a bodybuilding fallback week still gets its schedule (length match holds)', () => {
  app.S = app.defaultState();
  const zero = { arms: 0, chest: 0, back: 0, shoulders: 0, glutes: 0, legs: 0, calves: 0 };
  const p = app.makeProgram(baseOb({ track: 'bodybuilding', daysPerWeek: 1,
    trainingDays: [3], muscleFocus: zero }));
  assert.strictEqual(p.days.length, 1, 'template fallback used');
  assert.deepStrictEqual(p.schedule, [{ wd: 3, sport: false }]);
});

// ---------------------------------------------------------------------------
// Split editor keeps the map aligned
// ---------------------------------------------------------------------------
test('seAddDay/seRemoveDay keep program.schedule index-aligned', () => {
  const s = app.defaultState();
  app.S = s;
  s.program = app.makeProgram(baseOb({ daysPerWeek: 3, trainingDays: [0, 2, 4], sportDays: [2] }));
  app.V = { dayIdx: null, view: 'dashboard', tab: 'dashboard' };
  app.seAddDay();
  assert.strictEqual(s.program.days.length, 4);
  assert.strictEqual(s.program.schedule.length, 4);
  assert.deepStrictEqual(s.program.schedule[3], { wd: null, sport: false },
    'a hand-added day starts unscheduled');
  s.program.days[1].slots = []; // empty day removes without the confirm modal
  app.seRemoveDay(1);
  assert.strictEqual(s.program.days.length, 3);
  assert.deepStrictEqual(s.program.schedule.map(x => x.wd), [0, 4, null],
    'the removed day took its weekday with it');
});

test('a legacy program without a schedule edits days as before', () => {
  const s = app.defaultState();
  app.S = s;
  s.program = app.makeProgram(baseOb({ daysPerWeek: 3 }));
  app.V = { dayIdx: null, view: 'dashboard', tab: 'dashboard' };
  app.seAddDay();
  assert.strictEqual(s.program.days.length, 4);
  assert.ok(!('schedule' in s.program), 'no schedule appears from nowhere');
});

// ---------------------------------------------------------------------------
// Templates and carryover
// ---------------------------------------------------------------------------
test('templates never carry a schedule (weekdays are athlete-personal)', () => {
  const s = app.defaultState();
  app.S = s;
  s.program = app.makeProgram(baseOb({ daysPerWeek: 3, trainingDays: [0, 2, 4], sportDays: [2] }));
  app.V = { dayIdx: null, view: 'dashboard', tab: 'dashboard' };
  const tpl = app.programTemplate();
  assert.ok(!('schedule' in tpl), 'export excludes it');
  assert.deepStrictEqual(app.validateTemplate(tpl), { ok: true });
  const p2 = app.programFromTemplate(tpl);
  assert.ok(!('schedule' in p2), 'an imported program floats until rescheduled');
});

test('a new cycle carries the weekday map and sport flags over', () => {
  const s = app.defaultState();
  app.S = s;
  s.profile.training = { track: 'powerbuilding', timeMode: 'unlimited', muscleFocus: { ...FOCUS } };
  s.profile.experience = 'intermediate';
  s.program = app.makeProgram(baseOb({ daysPerWeek: 3, trainingDays: [1, 3, 5], sportDays: [3] }));
  app.V = { dayIdx: null, view: 'dashboard', tab: 'dashboard' };
  app.doNewProgram();
  assert.deepStrictEqual(s.program.schedule,
    [{ wd: 1, sport: false }, { wd: 3, sport: true }, { wd: 5, sport: false }],
    'the next cycle keeps the athlete\'s week');
});

test('a new cycle from a legacy (count-only) program stays count-only', () => {
  const s = app.defaultState();
  app.S = s;
  s.profile.training = { track: 'powerbuilding', timeMode: 'unlimited', muscleFocus: { ...FOCUS } };
  s.profile.experience = 'intermediate';
  s.program = app.makeProgram(baseOb({ daysPerWeek: 4 }));
  app.V = { dayIdx: null, view: 'dashboard', tab: 'dashboard' };
  app.doNewProgram();
  assert.strictEqual(s.program.daysPerWeek, 4);
  assert.ok(!('schedule' in s.program), 'no schedule invented for a legacy athlete');
});

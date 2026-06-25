/* ============================================================
   IRONWAVE — test/render-smoke.test.js
   Boot / render smoke (future-work testing item 6). Loads the three
   scripts into a real jsdom document and renders every view for a
   default (Powerbuilding) and a Bodybuilding program, asserting each
   render produces markup and never throws. Light coverage by design:
   the math is unit-tested elsewhere; the DOM only needs to not break.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

// jsdom (a dev-only dependency) dropped Node 18 support: its ESM-only deps throw
// ERR_REQUIRE_ESM on Node < 20. The app's runtime still targets Node >= 18 and
// the engine suites cover it; only this DOM smoke layer needs Node >= 20. So the
// jsdom require is deferred and the suite is skipped below the floor, keeping the
// Node-18 CI leg green.
const NODE_MAJOR = Number(process.versions.node.split('.')[0]);

const DEFAULT_FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

// A fresh app instance per test, so state never leaks between cases.
function fresh() {
  const { loadDom } = require('./load-dom'); // lazy: only pulled in on Node >= 20
  const ctx = loadDom();
  ctx.baseV = {
    view: 'dashboard', tab: 'dashboard', dayIdx: null,
    libTab: 'alpha', libSearch: '', obStep: 0, ob: null,
    checkinStep: 0, checkinData: null, draft: null,
  };
  return ctx;
}

function withProgram(ctx, track) {
  const s = ctx.app.defaultState();
  // Install state first: the bodybuilding generator reads S.customEx via exById
  // during makeProgram, exactly as it does in the running app.
  ctx.app.S = s;
  ctx.app.V = Object.assign({}, ctx.baseV);
  s.program = ctx.app.makeProgram({
    daysPerWeek: 4, track, timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  });
  return s;
}

function renderView(ctx, view, extraV) {
  ctx.app.V = Object.assign({}, ctx.baseV, { view }, extraV);
  ctx.app.render();
  const html = ctx.document.getElementById('app').innerHTML;
  assert.ok(html && html.length > 0, `view "${view}" rendered empty`);
  return html;
}

// Views reachable by just navigating with a program loaded.
const NAV_VIEWS = ['dashboard', 'workout', 'history', 'more', 'exercises', 'program', 'settings'];

if (NODE_MAJOR < 20) {
  test('boot/render smoke (skipped: jsdom requires Node >= 20)', { skip: true }, () => {});
} else {
for (const track of ['powerbuilding', 'bodybuilding']) {
  test(`${track}: every navigation view renders`, () => {
    const ctx = fresh();
    withProgram(ctx, track);
    for (const view of NAV_VIEWS) renderView(ctx, view);
  });

  test(`${track}: a live session view renders`, () => {
    const ctx = fresh();
    withProgram(ctx, track);
    // Drive the real flow: a check-in builds V.checkinData, beginSession builds
    // the draft and navigates to the session view.
    ctx.app.startCheckin(0);
    ctx.app.beginSession();
    const html = ctx.document.getElementById('app').innerHTML;
    assert.ok(/section|card|set/i.test(html), 'session view rendered without content');
  });

  test(`${track}: a mid-session swap rebuilds the live entry`, () => {
    const ctx = fresh();
    withProgram(ctx, track);
    ctx.app.startCheckin(0);
    ctx.app.beginSession();
    const dr = ctx.app.V.draft;
    // Pick a swappable (accessory) entry and a different exercise in its movement.
    const ei = dr.entries.findIndex(e => !e.isMain && !e.isSecondary);
    assert.ok(ei >= 0, 'expected a swappable accessory entry');
    const entry = dr.entries[ei];
    const slot = ctx.app.S.program.days[dr.d].slots[entry.si];
    const cat = slot.cat || (ctx.app.exById(slot.ex || slot.def || slot.lift) || {}).movement;
    const alt = ctx.app.allExercises().find(x => x.movement === cat && x.id !== entry.exId);
    assert.ok(alt, 'expected an alternative exercise in the same movement');
    ctx.app.doSwap(dr.d, entry.si, alt.id);
    const rebuilt = ctx.app.V.draft.entries.find(e => e.si === entry.si);
    assert.strictEqual(rebuilt.exId, alt.id, 'the live entry now shows the swapped exercise');
    assert.ok(rebuilt.sets.every(s => !s.done), 'swapped entry sets reset to not done');
  });

  test(`${track}: the check-in view renders`, () => {
    const ctx = fresh();
    withProgram(ctx, track);
    ctx.app.startCheckin(0); // sets V.checkinData and renders 'checkin'
    const html = ctx.document.getElementById('app').innerHTML;
    assert.ok(html && html.length > 0, 'check-in rendered empty');
  });

  test(`${track}: the summary view renders for a completed session`, () => {
    const ctx = fresh();
    withProgram(ctx, track);
    ctx.app.S.sessions = [{
      id: 'sum1', b: 0, w: 0, d: 0, skipped: false,
      tonnage: 1234, rating: 8, readiness: 21.5, entries: [],
    }];
    renderView(ctx, 'summary', { summaryId: 'sum1' });
  });
}

test('bodybuilding: a superset group renders an alternating session card', () => {
  const ctx = fresh();
  const s = withProgram(ctx, 'bodybuilding');
  // Link the first two accessories on day 0 into a superset, then start a session.
  const accSlots = s.program.days[0].slots.filter(sl => sl.type === 'acc');
  assert.ok(accSlots.length >= 2, 'day has at least two accessories to superset');
  accSlots[0].superset = true;
  ctx.app.startCheckin(0);
  ctx.app.beginSession();
  const html = ctx.document.getElementById('app').innerHTML;
  assert.ok(/superset-group/.test(html), 'the combined superset card rendered');
  assert.ok(/Round 1/.test(html), 'the round-by-round layout rendered');
});

test('onboarding renders for a brand-new user (no program)', () => {
  const ctx = fresh();
  ctx.app.S = ctx.app.defaultState(); // program is null
  ctx.app.V = Object.assign({}, ctx.baseV, { view: 'onboarding', ob: ctx.app.obDefaults(), obStep: 0 });
  ctx.app.render();
  const html = ctx.document.getElementById('app').innerHTML;
  assert.ok(html && html.length > 0, 'onboarding rendered empty');
});
}

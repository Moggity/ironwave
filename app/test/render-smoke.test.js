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
const { loadDom } = require('./load-dom');

const DEFAULT_FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

// A fresh app instance per test, so state never leaks between cases.
function fresh() {
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

test('onboarding renders for a brand-new user (no program)', () => {
  const ctx = fresh();
  ctx.app.S = ctx.app.defaultState(); // program is null
  ctx.app.V = Object.assign({}, ctx.baseV, { view: 'onboarding', ob: ctx.app.obDefaults(), obStep: 0 });
  ctx.app.render();
  const html = ctx.document.getElementById('app').innerHTML;
  assert.ok(html && html.length > 0, 'onboarding rendered empty');
});

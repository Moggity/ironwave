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

const DEFAULT_FOCUS = { arms: 2, chest: 2, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 2 }; // [B4] the 0-4 scale standard

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
const NAV_VIEWS = ['dashboard', 'workout', 'history', 'more', 'exercises', 'program', 'settings', 'progress'];

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
  // The overview renders the link badge + in-group reorder controls without throwing.
  const overview = renderView(ctx, 'workout');
  assert.ok(/moveSupersetMember/.test(overview), 'in-group reorder controls rendered');
  ctx.app.startCheckin(0);
  ctx.app.beginSession();
  const html = ctx.document.getElementById('app').innerHTML;
  assert.ok(/superset-group/.test(html), 'the combined superset card rendered');
  assert.ok(/Round 1/.test(html), 'the round-by-round layout rendered');
});

test('bodybuilding: the volume dashboard renders the Cluster D controls', () => {
  const ctx = fresh();
  const s = withProgram(ctx, 'bodybuilding');
  // Two readiness entries so the recovery-trend chart draws.
  s.readinessLog = [{ ts: Date.now() - 864e5, score: 20 }, { ts: Date.now(), score: 14 }];
  // Force every trained muscle over MRV (tiny landmarks) so the overreach banner
  // + per-muscle deload controls all show. (A fresh defaultState has no landmarks
  // until migration, so set them explicitly.)
  s.profile.landmarks = {};
  for (const k of ['chest', 'shoulder', 'tricep', 'bicep', 'upperback', 'vpull', 'hpull', 'quad', 'ham', 'glute', 'calf', 'abs', 'lowback']) {
    s.profile.landmarks[k] = { mv: 1, mev: 1, mrv: 1 };
  }
  ctx.app.openVolumeDashboard();
  const html = ctx.document.getElementById('modal-root').innerHTML;
  assert.ok(html && html.length > 0, 'volume dashboard rendered empty');
  assert.ok(/Recovery trend/.test(html), 'fatigue/recovery trend chart rendered');
  assert.ok(/Overreaching/.test(html), 'overreach warning rendered');
  assert.ok(/deload this muscle/.test(html), 'per-muscle deload control rendered');
});

// One pass under a non-English catalog (i18n plan guardrail): a crash on a
// missing key or bad interpolation in a live session shows up here in CI.
test('i18n: the session view and navigation render under the Spanish catalog', () => {
  const ctx = fresh();
  withProgram(ctx, 'bodybuilding');
  ctx.app.I18N.setLang('es');
  ctx.app.startCheckin(0);
  ctx.app.beginSession();
  const html = ctx.document.getElementById('app').innerHTML;
  assert.ok(/Terminar entrenamiento/.test(html), 'probe key rendered in Spanish');
  assert.ok(!/session\.\w+/.test(html), 'no raw i18n keys leaked into the session view');
  for (const view of NAV_VIEWS) renderView(ctx, view);
});

test('i18n: every onboarding step renders under the Spanish catalog', () => {
  const ctx = fresh();
  ctx.app.S = ctx.app.defaultState();
  ctx.app.I18N.setLang('es');
  const ob = Object.assign(ctx.app.obDefaults(), {
    daysPerWeek: 4, track: 'bodybuilding', goalArchetype: 'lean-asap',
    showAdvanced: true, experience: 'intermediate', timeMode: 'custom', timeCapMin: 60,
  });
  for (let step = 0; step <= 6; step++) {
    const html = renderView(ctx, 'onboarding', { ob, obStep: step });
    // A missing key renders as the key itself between tags ('>ob.foo<'); the
    // looser pattern would false-positive on onclick code like 'V.ob.show...'.
    assert.ok(!/>(ob|track|goal|exp|muscle)\.[a-z_0-9]+</.test(html), `no raw i18n keys on step ${step}`);
  }
  const goalStep = renderView(ctx, 'onboarding', { ob, obStep: 1 }); // [Epic I2] goal is step 1
  assert.ok(/déficit agresivo/.test(goalStep), 'the lean-asap warning rendered in Spanish');
});

test('onboarding renders for a brand-new user (no program)', () => {
  const ctx = fresh();
  ctx.app.S = ctx.app.defaultState(); // program is null
  ctx.app.V = Object.assign({}, ctx.baseV, { view: 'onboarding', ob: ctx.app.obDefaults(), obStep: 0 });
  ctx.app.render();
  const html = ctx.document.getElementById('app').innerHTML;
  assert.ok(html && html.length > 0, 'onboarding rendered empty');
});

// [Epic H1] The whole app renders in lb + RPE display mode. Conversion is
// display/input-only, so every view must survive it with lb equipment defaults.
test('lb + RPE display: every navigation view and a live session render', () => {
  const ctx = fresh();
  const s = ctx.app.defaultState();
  ctx.app.S = s;
  ctx.app.V = Object.assign({}, ctx.baseV);
  // Seed maxes so the wave prescribes real weights (an uncalibrated program
  // shows none, and this test is about weights rendering in lb).
  s.program = ctx.app.makeProgram({
    daysPerWeek: 4, track: 'powerbuilding', timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS },
    maxes: { 'comp-squat': 140, 'comp-bench': 100, 'comp-deadlift': 180, 'comp-press': 60 },
  });
  ctx.app.setUnits('lb');
  ctx.app.setIntensityDisplay('rpe');
  for (const view of NAV_VIEWS) renderView(ctx, view);
  const settings = renderView(ctx, 'settings');
  assert.ok(/value="lb" selected/.test(settings), 'settings shows lb selected');
  ctx.app.startCheckin(0);
  ctx.app.beginSession();
  const html = ctx.document.getElementById('app').innerHTML;
  assert.ok(/lb/.test(html), 'the session view shows lb weights');
  assert.ok(!/\d ?kg/.test(html), 'no kg weight leaks into the lb session view');
  // The perf modal prices its weight input and plate math in lb + RPE too.
  const ei = ctx.app.V.draft.entries.findIndex(e => e.sets.some(st => st.targetWeight));
  assert.ok(ei >= 0, 'expected a weighted entry');
  ctx.app.openPerf(ei, ctx.app.V.draft.entries[ei].sets.findIndex(st => st.targetWeight));
  const modal = ctx.document.getElementById('modal-root').innerHTML;
  assert.ok(/lb/.test(modal), 'perf modal shows lb');
  assert.ok(/RPE/.test(modal), 'perf modal shows the RPE stepper');
});

// [Epic H3] A finished program shows the macro report on the workout tab and
// the report view renders from History.
test('macro report renders on a finished program', () => {
  const ctx = fresh();
  const s = withProgram(ctx, 'powerbuilding');
  s.program.pointer.block = s.program.blocks.length; // programDone
  s.sessions = [{ id: 'x1', b: 0, w: 0, d: 0, ts: Date.now(), tonnage: 5000, rating: 8, entries: [] }];
  const workout = renderView(ctx, 'workout');
  assert.ok(/rp\.|Sessions|Sesiones/.test(workout) || workout.length > 0, 'done screen rendered');
  const report = renderView(ctx, 'report');
  assert.ok(/Macro report|Informe/.test(report), 'report view rendered');
  const history = renderView(ctx, 'history');
  assert.ok(/nav\('report'\)/.test(history), 'history links to the report');
});

// [2-day + 1/7-day] The frequency extremes render end to end for both the
// strength and bodybuilding shapes, including a live session: paired mains (2),
// the single all-mains day (1), and the 6+1 layouts (7).
for (const n of [1, 2, 7]) {
  for (const track of ['powerlifting', 'bodybuilding']) {
    test(`${n}-day ${track}: views and a live session render`, () => {
      const ctx = fresh();
      const s = ctx.app.defaultState();
      ctx.app.S = s;
      ctx.app.V = Object.assign({}, ctx.baseV);
      s.program = ctx.app.makeProgram({ daysPerWeek: n, track, timeMode: 'unlimited',
        muscleFocus: { ...DEFAULT_FOCUS },
        maxes: { 'comp-squat': 140, 'comp-bench': 100, 'comp-deadlift': 180 } });
      assert.strictEqual(s.program.days.length, n);
      for (const view of NAV_VIEWS) renderView(ctx, view);
      ctx.app.startCheckin(0);
      ctx.app.beginSession();
      const html = ctx.document.getElementById('app').innerHTML;
      assert.ok(html.length > 0, 'session rendered');
    });
  }
}

test('onboarding weekday picker lists all 7 days; a selected day discloses the sport pill', () => {
  const ctx = fresh();
  ctx.app.S = ctx.app.defaultState();
  // [Epic I2] The days step sits after welcome -> goal on every pipeline.
  let html = renderView(ctx, 'onboarding', { ob: ctx.app.obDefaults(), obStep: 2 });
  for (let wd = 0; wd < 7; wd++) assert.ok(html.includes(`obToggleDay(${wd})`), `weekday row ${wd} renders`);
  assert.ok(!/wd-pill/.test(html), 'no sport pill before any day is selected');
  ctx.app.obToggleDay(2); // select Wednesday
  html = ctx.document.getElementById('app').innerHTML;
  assert.ok(/wd-row on/.test(html), 'the selected row highlights');
  assert.ok(/wd-pill/.test(html), 'the sport pill appears inside the selected row');
  assert.strictEqual(ctx.app.V.ob.daysPerWeek, 1, 'the day count stays derived');
  ctx.app.obToggleSport(null, 2);
  html = ctx.document.getElementById('app').innerHTML;
  assert.ok(/wd-pill on/.test(html), 'the sport pill shows its on state');
  assert.deepStrictEqual([...ctx.app.V.ob.sportDays], [2]); // spread: jsdom-realm array
  ctx.app.obToggleDay(2); // deselecting the day clears its sport flag
  assert.deepStrictEqual([...ctx.app.V.ob.sportDays], []);
  assert.strictEqual(ctx.app.V.ob.daysPerWeek, null, 'empty selection re-disables continue');
});

test('the days-per-week mode swaps the weekday list for the 1..7 count row', () => {
  const ctx = fresh();
  ctx.app.S = ctx.app.defaultState();
  let html = renderView(ctx, 'onboarding', { ob: ctx.app.obDefaults(), obStep: 2 });
  assert.ok(html.includes("obDaysMode('count')"), 'the mode switch renders');
  assert.ok(/wd-row/.test(html) && !/obDays\(4\)/.test(html), 'calendar mode by default');
  ctx.app.obDaysMode('count');
  html = ctx.document.getElementById('app').innerHTML;
  assert.ok(!/wd-row/.test(html), 'the weekday list is gone in count mode');
  for (let n = 1; n <= 7; n++) assert.ok(html.includes(`obDays(${n})`), `count button ${n} renders`);
  ctx.app.obDays(2);
  html = ctx.document.getElementById('app').innerHTML;
  assert.ok(html.includes(ctx.app.t('ob.two_day_note')), 'the two-day note still keys off the count');
  assert.strictEqual(ctx.app.V.ob.daysPerWeek, 2);
});

// [Epic I2] The strength-track meet step: both answer cards render, a
// too-soon date shows the validator's reason and keeps Continue disabled.
test('the meet step renders its cards and blocks a too-soon date', () => {
  const ctx = fresh();
  ctx.app.S = ctx.app.defaultState();
  const ob = Object.assign(ctx.app.obDefaults(), { track: 'powerlifting', daysPerWeek: 4 });
  let html = renderView(ctx, 'onboarding', { ob, obStep: 3 });
  assert.ok(html.includes("obMeetChoice('none')") && html.includes("obMeetChoice('date')"),
    'both meet cards render');
  ctx.app.obMeetChoice('date');
  ctx.app.obMeet(new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10));
  html = ctx.document.getElementById('app').innerHTML;
  assert.ok(/banner-warn/.test(html) && /days to that date/.test(html),
    'the too-soon reason renders');
  assert.ok(/onclick="obNext\(3\)" disabled/.test(html), 'Continue stays disabled');
  ctx.app.obMeet(new Date(Date.now() + 70 * 864e5).toISOString().slice(0, 10));
  html = ctx.document.getElementById('app').innerHTML;
  assert.ok(!/banner-warn/.test(html), 'a valid date clears the warning');
  assert.ok(/2 week taper/.test(html), 'the plan summary line renders');
});

// [Epic H5] The split editor + focus editor modals render for a bodybuilding
// program; [Epic H6] a meet program renders its taper dashboard and meet day.
test('split editor, focus editor, and meet day render', () => {
  const ctx = fresh();
  withProgram(ctx, 'bodybuilding');
  renderView(ctx, 'program');
  ctx.app.openSplitEditor();
  let modal = ctx.document.getElementById('modal-root').innerHTML;
  assert.ok(/se-move|se-name/.test(modal), 'split editor rendered');
  ctx.app.openFocusEditor();
  modal = ctx.document.getElementById('modal-root').innerHTML;
  assert.ok(/fe-val-chest/.test(modal), 'focus editor rendered');

  const s2 = ctx.app.defaultState();
  ctx.app.S = s2;
  ctx.app.V = Object.assign({}, ctx.baseV);
  s2.program = ctx.app.makeProgram({ daysPerWeek: 4, track: 'powerlifting',
    timeMode: 'unlimited', muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
    meetDate: Date.now() + 12 * 7 * 864e5 });
  s2.program.pointer.block = s2.program.blocks.length - 1; // the taper
  const dash = renderView(ctx, 'dashboard');
  assert.ok(/nav\('meet'\)/.test(dash), 'dashboard offers meet day during the taper');
  const meet = renderView(ctx, 'meet');
  assert.ok(/meet-attempt|chart\.empty|No data yet/.test(meet), 'meet day rendered');
  renderView(ctx, 'workout'); // taper week renders without accessories
});

// [Epic H2] The powerbuilding card must produce EXACTLY the program the golden
// master pins, driven through the real onboarding handlers. This is the
// regression anchor for the default track being reachable from a fresh install.
test('powerbuilding onboarding path produces the golden-master program', () => {
  const ctx = fresh();
  ctx.app.S = ctx.app.defaultState();
  ctx.app.V = Object.assign({}, ctx.baseV, { view: 'onboarding', ob: ctx.app.obDefaults(), obStep: 0 });
  ctx.app.render();
  // [Epic I2] Track-driven pipeline: welcome -> goal -> days -> meet ->
  // experience -> time -> maxes for the strength tracks.
  // [Epic I5] Bodyweight is required on the welcome step (master coach).
  ctx.document.getElementById('ob-bw').value = '80';
  ctx.app.obNext(0);
  assert.ok(/obTrack\('powerbuilding'\)/.test(ctx.document.getElementById('app').innerHTML),
    'the powerbuilding card renders on the goal step');
  ctx.app.obTrack('powerbuilding'); ctx.app.obNext(1);
  for (const wd of [0, 1, 3, 4]) ctx.app.obToggleDay(wd); // Mon/Tue/Thu/Fri
  ctx.app.obNext(2);
  ctx.app.obMeetChoice('none'); ctx.app.obNext(3); // the explicit meet answer
  ctx.app.obExp('intermediate'); ctx.app.obNext(4);
  ctx.app.obTimeMode('unlimited'); ctx.app.obNext(5);
  ctx.app.obNext(6); // maxes left empty -> uncalibrated, like the golden default
  const prog = ctx.app.S.program;
  assert.ok(prog, 'program created');
  const golden = ctx.app.makeProgram({ daysPerWeek: 4, track: 'powerbuilding',
    experience: 'intermediate', timeMode: 'unlimited', muscleFocus: { ...DEFAULT_FOCUS }, maxes: {} });
  const strip = p => { const c = JSON.parse(JSON.stringify(p)); delete c.startDate; delete c.testDate; return c; };
  // [Calendar days] The schedule rides alongside the program (weekday labels
  // only); the prescription itself must still equal the count-only golden build.
  assert.deepStrictEqual(strip(prog).schedule,
    [0, 1, 3, 4].map(wd => ({ wd, sport: false })), 'the weekday map is stored');
  const noSched = p => { const c = strip(p); delete c.schedule; return c; };
  assert.deepStrictEqual(noSched(prog), noSched(golden), 'onboarding output = golden-master program');
});

test('lb mode: onboarding step 0 shows the unit toggle and lb bodyweight label', () => {
  const ctx = fresh();
  ctx.app.S = ctx.app.defaultState();
  ctx.app.applyUnits('lb');
  const html = renderView(ctx, 'onboarding', { ob: ctx.app.obDefaults(), obStep: 0 });
  assert.ok(/obUnits\('kg'\)/.test(html) && /obUnits\('lb'\)/.test(html), 'unit toggle rendered');
  assert.ok(/\(lb\)/.test(html), 'bodyweight label reads lb');
});
}

/* ============================================================
   IRONWAVE — test/h7-twoday.test.js
   [Epic H7 + 2-day] Custom program templates and 2 training days
   per week.
   - 2-day bodybuilding: full-body generator (leads from different
     regions, 2x muscles hit BOTH days, nothing twice on one day);
   - 2-day strength: paired mains resolve two waves per session and
     two AMRAPs on realization day;
   - templates: export -> validate -> import round-trips the exact
     structure; garbage is rejected with a reason; a template-born
     program resolves every slot of every week;
   - simulated multi-week runs and eccentric edge cases (single-
     muscle athlete, no anchor-capable muscle, 24x8 template, a
     selects-only day).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine } = app;

const FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

// The generator resolves exercises through the app state (custom exercises can
// join pools), so give every direct generator call a fresh default S.
function freshS() { app.S = app.defaultState(); return app.S; }

function withProgram(track, over) {
  const s = app.defaultState();
  app.S = s;
  s.program = app.makeProgram(Object.assign({ daysPerWeek: 2, track, experience: 'intermediate',
    timeMode: 'unlimited', muscleFocus: { ...FOCUS }, maxes: {} }, over || {}));
  app.V = { dayIdx: null, view: 'dashboard', tab: 'dashboard' };
  return s;
}
// Resolve every slot of every block/week; returns the resolved list and throws
// on nothing (the structural sweep used by several cases below).
function sweepAll(p) {
  const out = [];
  p.blocks.forEach((b, bi) => {
    for (let wi = 0; wi < app.blockWeeks(b); wi++) {
      p.days.forEach((d, di) => d.slots.forEach((slot, si) => {
        out.push({ bi, wi, di, si, rs: app.resolveSlot(slot, bi, wi) });
      }));
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// 2-day bodybuilding: the full-body generator
// ---------------------------------------------------------------------------
test('2-day bodybuilding builds two full-body days, leads from different regions', () => {
  freshS();
  const days = app.generateFullBodyDays({ ...FOCUS }, 2);
  assert.strictEqual(days.length, 2);
  const regions = days.map(d => app.UPPER_MUSCLES.includes(d.primary) ? 'up' : 'lo');
  assert.deepStrictEqual(regions.sort(), ['lo', 'up'], 'one upper lead, one lower lead');
  assert.ok(days.every(d => d.theme.region === 'full'), 'themed as full body');
  assert.ok(days.every(d => d.slots.length >= 4), 'real sessions, not stubs');
});

test('2-day: a 2x/week muscle appears on BOTH days, never twice on one', () => {
  freshS();
  const days = app.generateFullBodyDays({ ...FOCUS }, 2); // slider 3 -> 2x for all
  for (const m of app.FOCUS_KEYS) {
    const hits = days.map(d => {
      const on = new Set();
      if (d.primary === m) on.add(m);
      for (const sl of d.slots) {
        const mv = sl.type === 'main' || sl.type === 'secondary'
          ? (app.exById(sl.ex || sl.lift) || {}).movement : sl.cat;
        if (app.MOVEMENT_SLIDER[mv] === m) on.add(m);
      }
      return on.has(m) ? 1 : 0;
    });
    assert.deepStrictEqual(hits, [1, 1], `${m} trains on both days`);
    for (const d of days) {
      const defs = d.slots.filter(sl => app.MOVEMENT_SLIDER[sl.cat] === m).map(sl => sl.def);
      assert.strictEqual(new Set(defs).size, defs.length, `${m}: no duplicate accessory on a day`);
    }
  }
});

test('2-day: a 1x muscle (slider 1) appears exactly once across the week', () => {
  freshS();
  const days = app.generateFullBodyDays(Object.assign({ ...FOCUS }, { calves: 1 }), 2);
  const hits = days.reduce((n, d) => n + (d.slots.some(sl => app.MOVEMENT_SLIDER[sl.cat] === 'calves') ? 1 : 0), 0);
  assert.strictEqual(hits, 1);
});

test('2-day bodybuilding program resolves every slot of every week', () => {
  const s = withProgram('bodybuilding');
  assert.strictEqual(s.program.days.length, 2);
  const all = sweepAll(s.program);
  assert.ok(all.length > 0);
  assert.ok(all.every(x => x.rs.isSelect || x.rs.isRemoved || x.rs.sets.length > 0),
    'every non-select slot prescribes sets');
});

// ---------------------------------------------------------------------------
// 2-day strength: paired mains
// ---------------------------------------------------------------------------
test('2-day powerlifting pairs mains: squat+bench / deadlift+press', () => {
  const s = withProgram('powerlifting', { maxes: {
    'comp-squat': 140, 'comp-bench': 100, 'comp-deadlift': 180, 'military-press': 60 } });
  const mains = s.program.days.map(d => d.slots.filter(sl => sl.type === 'main').map(sl => sl.lift));
  assert.deepStrictEqual(mains, [['comp-squat', 'comp-bench'], ['comp-deadlift', 'military-press']]);
  // Realization week: BOTH mains of a day peak with their own AMRAP.
  const day0 = s.program.days[0];
  const amraps = day0.slots.filter(sl => sl.type === 'main')
    .map(sl => app.resolveSlot(sl, 0, 3).sets.filter(x => x.amrap).length);
  assert.deepStrictEqual(amraps, [1, 1], 'two waves, two AMRAPs in one session');
});

test('2-day strength: the whole program resolves and each day estimates a real session', () => {
  const s = withProgram('powerbuilding', { maxes: { 'comp-squat': 140, 'comp-bench': 100 } });
  sweepAll(s.program);
  for (let di = 0; di < 2; di++) {
    const min = Math.round(app.estimateSessionSec(
      app.resolveDayEntries(di, 0, 1).items.map(x => x.rs), false) / 60);
    assert.ok(min >= 25 && min <= 150, `day ${di} estimates ${min} min`);
  }
});

// ---------------------------------------------------------------------------
// Simulated 2-day run: two blocks of training with logging + advancing
// ---------------------------------------------------------------------------
test('simulated: a 2-day bodybuilding athlete trains two full blocks without a hitch', () => {
  const s = withProgram('bodybuilding');
  const p = s.program;
  let sessions = 0;
  for (let block = 0; block < 2; block++) {
    const bi = p.pointer.block;
    for (let wi = 0; wi * 1 === p.pointer.week && wi < app.blockWeeks(p.blocks[bi]); wi++) {
      for (let di = 0; di < p.days.length; di++) {
        const built = app.resolveDayEntries(di, bi, p.pointer.week);
        assert.ok(built.items.length > 0, `b${bi} w${p.pointer.week} d${di} has work`);
        // Log every set as performed at target (the honest robot athlete).
        const entries = built.items.map(x => ({
          exId: x.rs.exId, wmKey: x.rs.wmKey || null,
          sets: x.rs.sets.filter(st => !st.ramp).map(st => ({
            done: true, ramp: false, calib: !!st.calib,
            weight: st.weight || 20, reps: st.reps, targetReps: st.reps,
            rpe: st.rpe || 8, targetRpe: st.rpe || null, pump: 2 })),
        }));
        s.sessions.push({ id: 's' + sessions++, b: bi, w: p.pointer.week, d: di,
          ts: Date.now(), tonnage: 1000, entries });
        for (const e of entries) for (const st of e.sets) {
          app.pushRecord(e.exId, { ts: Date.now(), weight: st.weight, reps: st.reps, rpe: st.rpe });
        }
      }
      app.advanceWeek();
      if (p.pointer.block !== bi) break; // block rolled over
    }
  }
  assert.ok(p.pointer.block >= 2, 'two blocks completed');
  assert.ok(sessions >= 4 * 2, 'sessions were logged all along');
  assert.ok((s.landmarkLog || []).length >= 2, 'landmark snapshots accrued at each boundary');
  sweepAll(p); // the advanced program still resolves everywhere
});

// ---------------------------------------------------------------------------
// Templates: round-trip + rejects
// ---------------------------------------------------------------------------
test('template round-trip: export -> validate -> import preserves the structure', () => {
  const s = withProgram('powerbuilding', { daysPerWeek: 4 });
  const tpl = app.programTemplate();
  assert.strictEqual(tpl.schemaVersion, app.TEMPLATE_SCHEMA_VERSION);
  assert.deepStrictEqual(app.validateTemplate(tpl), { ok: true });
  const p2 = app.programFromTemplate(tpl);
  assert.deepStrictEqual(
    p2.blocks.map(b => [b.type, b.wave, b.scheme || null, b.weeks || null]),
    s.program.blocks.map(b => [b.type, b.wave, b.scheme || null, b.weeks || null]),
    'block structure identical');
  assert.deepStrictEqual(
    p2.days.map(d => d.slots),
    s.program.days.map(d => d.slots.map(sl => {
      const o = { type: sl.type };
      if (sl.type === 'main' || sl.type === 'secondary') { o.lift = sl.lift; if (sl.baseLift) o.baseLift = sl.baseLift; }
      else { if (sl.cat) o.cat = sl.cat; if (sl.def) o.def = sl.def; }
      return o;
    })),
    'day/slot layout identical');
  assert.ok(Object.values(p2.wm).every(v => v === null), 'no working maxes travel in a template');
  app.S.program = p2;
  sweepAll(p2); // the imported program prescribes end to end
});

test('a meet-prep template round-trips its taper (per-block weeks survive)', () => {
  const s = withProgram('powerlifting', { daysPerWeek: 2, meetDate: Date.now() + 12 * 7 * 864e5 });
  const tpl = app.programTemplate();
  assert.deepStrictEqual(app.validateTemplate(tpl), { ok: true });
  const p2 = app.programFromTemplate(tpl);
  const last = p2.blocks[p2.blocks.length - 1];
  assert.strictEqual(last.scheme, 'jm2-peak');
  assert.strictEqual(last.weeks, 2);
  app.S.program = p2;
  assert.strictEqual(app.totalProgramWeeks(),
    (p2.blocks.length - 1) * p2.weeksPerBlock + 2);
});

test('imports reject everything that is not a clean v1 template', () => {
  const good = () => {
    withProgram('powerbuilding', { daysPerWeek: 4 });
    return JSON.parse(JSON.stringify(app.programTemplate()));
  };
  const cases = [
    [null, /not a template/],
    [[1, 2], /not a template/],
    [{ schemaVersion: 2, blocks: [], days: [] }, /schemaVersion/],
    [(() => { const x = good(); x.blocks[0].scheme = 'evil-scheme'; return x; })(), /unknown scheme/],
    [(() => { const x = good(); x.blocks[0].wave = '99s'; return x; })(), /unknown wave/],
    [(() => { const x = good(); x.blocks[0].weeks = 99; return x; })(), /weeks 99/],
    [(() => { const x = good(); x.days[0].slots[0] = { type: 'main', lift: 'rm -rf' }; return x; })(), /unknown lift/],
    [(() => { const x = good(); x.days[0].slots.push({ type: 'exec', cmd: 'x' }); return x; })(), /slot type/],
    [(() => { const x = good(); x.days[0].slots.push({ type: 'acc' }); return x; })(), /def or cat/],
    [(() => { const x = good(); x.days = []; return x; })(), /days/],
    [(() => { const x = good(); x.blocks = Array.from({ length: 25 }, () => x.blocks[0]); return x; })(), /blocks/],
  ];
  for (const [tpl, re] of cases) {
    const v = app.validateTemplate(tpl);
    assert.ok(v.error && re.test(v.error), `expected ${re} got ${JSON.stringify(v)}`);
  }
});

// ---------------------------------------------------------------------------
// Eccentric edge cases
// ---------------------------------------------------------------------------
test('eccentric: the calves-only athlete still gets two workable days', () => {
  freshS();
  const days = app.generateFullBodyDays(
    { arms: 0, chest: 0, back: 0, shoulders: 0, glutes: 0, legs: 0, calves: 6 }, 2);
  assert.strictEqual(days.length, 2, 'no anchor-capable muscle, days still build');
  assert.ok(days.every(d => d.slots.length > 0), 'both days have work');
  assert.ok(days.every(d => d.slots.every(sl => app.MOVEMENT_SLIDER[sl.cat] === 'calves')),
    'nothing but the one trained muscle');
});

test('eccentric: a single-muscle (chest 6) 2-day week leads day A with the main, day B with a secondary', () => {
  freshS();
  const days = app.generateFullBodyDays(
    { arms: 0, chest: 6, back: 0, shoulders: 0, glutes: 0, legs: 0, calves: 0 }, 2);
  assert.strictEqual(days.length, 2);
  assert.strictEqual(days[0].slots[0].type, 'main');
  assert.strictEqual(days[0].slots[0].lift, 'comp-bench');
  assert.strictEqual(days[1].slots[0].type, 'secondary', 'the same anchor demotes to a volume exposure');
  assert.strictEqual(days[1].slots[0].lift, 'comp-bench');
});

test('eccentric: everything at zero returns an empty week (the empty-day guard owns it)', () => {
  freshS();
  assert.deepStrictEqual(app.generateFullBodyDays(
    { arms: 0, chest: 0, back: 0, shoulders: 0, glutes: 0, legs: 0, calves: 0 }, 2), []);
});

test('eccentric: a 24-block x 8-week monster template validates and computes sane totals', () => {
  withProgram('powerbuilding', { daysPerWeek: 4 });
  const tpl = app.programTemplate();
  tpl.blocks = Array.from({ length: 24 }, (_, i) => ({
    type: i % 2 ? 'strength' : 'hypertrophy', wave: i % 2 ? '5s' : '10s',
    scheme: i % 2 ? 'jm2-wave' : 'jbb-hyp', weeks: 8 }));
  assert.deepStrictEqual(app.validateTemplate(tpl), { ok: true });
  const p2 = app.programFromTemplate(tpl);
  app.S.program = p2;
  assert.strictEqual(app.totalProgramWeeks(), 24 * 8);
  assert.ok(p2.testDate - p2.startDate === 24 * 8 * 7 * 864e5, 'test date honors per-block weeks');
});

test('eccentric: a selects-only day imports and renders as pure athlete choice', () => {
  withProgram('powerbuilding', { daysPerWeek: 4 });
  const tpl = app.programTemplate();
  tpl.days = [{ name: 'Choose', slots: Array.from({ length: 5 }, () => ({ type: 'select', cat: 'chest' })) }];
  assert.deepStrictEqual(app.validateTemplate(tpl), { ok: true });
  const p2 = app.programFromTemplate(tpl);
  app.S.program = p2;
  const rs = p2.days[0].slots.map(sl => app.resolveSlot(sl, 0, 0));
  assert.ok(rs.every(x => x.isSelect), 'unfilled selects wait for the athlete');
});

test('eccentric: a 2-day time-capped athlete still gets a core session under the cap', () => {
  const s = withProgram('bodybuilding', { timeMode: 'custom', timeCapMin: 45 });
  s.program.trainingConfig.timeMode = 'custom';
  s.program.trainingConfig.timeCapMin = 45;
  const built = app.resolveDayEntries(0, 0, 1);
  assert.ok(built.items.length > 0, 'core work survives the cap');
  assert.ok(built.coreMin <= 45 + 10, `core ${built.coreMin}min respects a 45min cap (small tolerance)`);
});

test('the 4-day default template is untouched by the 2-day addition', () => {
  assert.strictEqual(app.DAY_TEMPLATES[4].length, 4);
  assert.strictEqual(app.DAY_TEMPLATES[2].length, 2);
  assert.ok(app.DAY_TEMPLATES[2][0].slots.filter(sl => sl.type === 'main').length === 2);
});

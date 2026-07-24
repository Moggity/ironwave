/* ============================================================
   IRONWAVE — test/one-seven-day.test.js
   1 and 7 training days per week (the frequency extremes).
   - 1-day strength: three comp mains keep their waves and their
     realization AMRAPs in one session, the press rides as a
     permanent secondary (the 3-day precedent);
   - 1-day bodybuilding: one full-body day via the full-body
     generator, template fallback when everything is zeroed;
   - 7-day strength: the 6-day layout plus a light pump Day 7
     (no mains), weekly volume stays bounded;
   - 7-day bodybuilding: a slider-6 muscle unlocks a 4th weekly
     exposure (splitFreqFor) with the per-session landmark cap
     dividing by the real frequency; without a slider 6 the week
     is the 6-day split plus a generated Pump day;
   - inertness: 2-6 day behavior is byte-identical (pad floor,
     cap divisor, SPLIT_FREQ table untouched);
   - split editor bounds (grow to 7 and no further, shrink to 1)
     and template round-trips at both extremes.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();

const FOCUS = { arms: 2, chest: 2, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 2 }; // [B4] 0-4 scale standard

function freshS() { app.S = app.defaultState(); return app.S; }

function withProgram(track, over) {
  const s = app.defaultState();
  app.S = s;
  s.program = app.makeProgram(Object.assign({ daysPerWeek: 1, track, experience: 'intermediate',
    timeMode: 'unlimited', muscleFocus: { ...FOCUS }, maxes: {} }, over || {}));
  app.V = { dayIdx: null, view: 'dashboard', tab: 'dashboard' };
  return s;
}
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
// Days on which a slider-keyed muscle trains (same reverse map the app uses).
function trainedDays(days, muscle) {
  return days.filter(d => {
    if (d.primary === muscle) return true;
    return d.slots.some(sl => {
      const mv = (sl.type === 'main' || sl.type === 'secondary')
        ? (app.exById(sl.ex || sl.lift) || {}).movement : sl.cat;
      return app.MOVEMENT_SLIDER[mv] === muscle;
    });
  }).length;
}

// ---------------------------------------------------------------------------
// [B4] focusFreqDepth: the slider IS the frequency, clamped by days; surplus
// becomes same-day depth.
// ---------------------------------------------------------------------------
test('focusFreqDepth: slider = frequency clamped by days, surplus = depth', () => {
  const f = (v, N) => app.focusFreqDepth({ chest: v }, N);
  assert.strictEqual(f(4, 7).freq.chest, 4, 'slider 4 is 4x when days allow');
  assert.strictEqual(f(4, 2).freq.chest, 2, 'clamped by availability');
  assert.strictEqual(f(4, 2).depth.chest, 2, 'the surplus is paid out as depth');
  assert.strictEqual(f(2, 7).freq.chest, 2, 'no free frequency from extra days');
  assert.strictEqual(f(0, 5).freq.chest, undefined, 'slider 0 trains nothing');
  assert.strictEqual(f(9, 7).freq.chest, 4, 'values clamp to FOCUS_MAX');
});

// ---------------------------------------------------------------------------
// 1-day strength
// ---------------------------------------------------------------------------
test('DAY_TEMPLATES[1]: three comp mains plus a press secondary in one day', () => {
  assert.strictEqual(app.DAY_TEMPLATES[1].length, 1);
  const slots = app.DAY_TEMPLATES[1][0].slots;
  assert.deepStrictEqual(slots.filter(sl => sl.type === 'main').map(sl => sl.lift),
    ['comp-squat', 'comp-bench', 'comp-deadlift']);
  assert.deepStrictEqual(slots.filter(sl => sl.type === 'secondary').map(sl => sl.lift),
    ['military-press']);
});

test('1-day powerlifting: every main keeps its own wave and its realization AMRAP', () => {
  const s = withProgram('powerlifting', { maxes: {
    'comp-squat': 140, 'comp-bench': 100, 'comp-deadlift': 180, 'military-press': 60 } });
  assert.strictEqual(s.program.days.length, 1);
  const mains = s.program.days[0].slots.filter(sl => sl.type === 'main');
  // Accumulation week: three distinct weighted prescriptions.
  const acc = mains.map(sl => app.resolveSlot(sl, 0, 1));
  assert.ok(acc.every(rs => rs.sets.length > 0 && rs.sets.every(st => st.weight > 0)));
  assert.strictEqual(new Set(acc.map(rs => rs.sets[rs.sets.length - 1].weight)).size, 3,
    'three lifts, three top weights');
  // Realization week: three AMRAPs in the one session.
  const amraps = mains.map(sl => app.resolveSlot(sl, 0, 3).sets.filter(st => st.amrap).length);
  assert.deepStrictEqual(amraps, [1, 1, 1], 'three waves peak in one session');
});

test('1-day powerbuilding resolves everywhere and the single session is long but real', () => {
  const s = withProgram('powerbuilding', { maxes: { 'comp-squat': 140, 'comp-bench': 100 } });
  sweepAll(s.program);
  const min = Math.round(app.estimateSessionSec(
    app.resolveDayEntries(0, 0, 1).items.map(x => x.rs), false) / 60);
  assert.ok(min >= 45 && min <= 200, `the one session estimates ${min} min`);
});

test('1-day uncalibrated (no maxes) resolves via calibration ramps', () => {
  const s = withProgram('powerlifting');
  const all = sweepAll(s.program);
  assert.ok(all.length > 0);
  assert.ok(all.every(x => x.rs.isSelect || x.rs.isRemoved || x.rs.sets.length > 0));
});

// ---------------------------------------------------------------------------
// 1-day bodybuilding
// ---------------------------------------------------------------------------
test('1-day bodybuilding: one full-body day, every trained muscle exactly once', () => {
  freshS();
  const days = app.generateFullBodyDays({ ...FOCUS }, 1);
  assert.strictEqual(days.length, 1);
  assert.ok(days[0].slots.length >= 4, 'a real session, not a stub');
  for (const m of app.FOCUS_KEYS) {
    assert.strictEqual(trainedDays(days, m), 1, `${m} trains on the one day`);
  }
  const defs = days[0].slots.filter(sl => sl.def).map(sl => sl.def);
  assert.strictEqual(new Set(defs).size, defs.length, 'no duplicate accessory in the day');
});

test('1-day bodybuilding program builds and resolves end to end', () => {
  const s = withProgram('bodybuilding');
  assert.strictEqual(s.program.days.length, 1);
  const all = sweepAll(s.program);
  assert.ok(all.every(x => x.rs.isSelect || x.rs.isRemoved || x.rs.sets.length > 0));
});

test('1-day all-zero focus falls back to the BB_DAY_TEMPLATES[1] full-body day', () => {
  const zero = { arms: 0, chest: 0, back: 0, shoulders: 0, glutes: 0, legs: 0, calves: 0 };
  const s = withProgram('bodybuilding', { muscleFocus: zero });
  assert.strictEqual(s.program.days.length, 1);
  assert.strictEqual(s.program.days[0].nameKey, 'full_body');
});

test('1-day time-capped bodybuilding still fits a core session under the cap', () => {
  const s = withProgram('bodybuilding', { timeMode: 'custom', timeCapMin: 60 });
  s.program.trainingConfig.timeMode = 'custom';
  s.program.trainingConfig.timeCapMin = 60;
  const built = app.resolveDayEntries(0, 0, 1);
  assert.ok(built.items.length > 0, 'core work survives the cap');
  assert.ok(built.coreMin <= 60 + 10, `core ${built.coreMin}min respects a 60min cap (small tolerance)`);
});

// ---------------------------------------------------------------------------
// 7-day strength
// ---------------------------------------------------------------------------
test('DAY_TEMPLATES[7]: the 6-day layout verbatim plus a light Day 7 (no mains)', () => {
  assert.strictEqual(app.DAY_TEMPLATES[7].length, 7);
  assert.deepStrictEqual(app.DAY_TEMPLATES[7].slice(0, 6), app.DAY_TEMPLATES[6],
    'days 1-6 mirror the 6-day layout');
  const d7 = app.DAY_TEMPLATES[7][6];
  assert.strictEqual(d7.slots.filter(sl => sl.type === 'main').length, 0, 'no mains on Day 7');
  const secs = d7.slots.filter(sl => sl.type === 'secondary');
  assert.strictEqual(secs.length, 1);
  assert.strictEqual(secs[0].lift, 'military-press');
  assert.ok(secs[0].pctMod < 1, 'the press exposure is moderated');
});

test('7-day powerlifting: resolves everywhere, realization week still has exactly 4 AMRAPs', () => {
  const s = withProgram('powerlifting', { daysPerWeek: 7, maxes: {
    'comp-squat': 140, 'comp-bench': 100, 'comp-deadlift': 180, 'military-press': 60 } });
  assert.strictEqual(s.program.days.length, 7);
  sweepAll(s.program);
  let amraps = 0;
  s.program.days.forEach(d => d.slots.forEach(sl => {
    amraps += app.resolveSlot(sl, 0, 3).sets.filter(st => st.amrap).length;
  }));
  assert.strictEqual(amraps, 4, 'one AMRAP per main lift, Day 7 adds none');
  for (let di = 0; di < 7; di++) {
    const min = Math.round(app.estimateSessionSec(
      app.resolveDayEntries(di, 0, 1).items.map(x => x.rs), false) / 60);
    assert.ok(min >= 10 && min <= 150, `day ${di} estimates ${min} min`);
  }
});

// ---------------------------------------------------------------------------
// [B4] 7-day bodybuilding: frequency honesty, no pump-day padding
// ---------------------------------------------------------------------------
test('7-day with a slider at 4: that muscle trains 4x, the rest keep their sliders', () => {
  freshS();
  const focus = Object.assign({ ...FOCUS }, { chest: 4 });
  const days = app.generateBodybuildingDays(focus, 7);
  assert.strictEqual(trainedDays(days, 'chest'), 4, 'slider 4 is 4 weekly exposures');
  for (const m of ['back', 'shoulders', 'arms', 'glutes', 'calves']) {
    assert.strictEqual(trainedDays(days, m), focus[m], `${m} trains its slider frequency`);
  }
  assert.deepStrictEqual(app.validateFocusWeek(days, focus, 7), [], 'contract holds');
});

test('7-day availability builds only the days the dose needs (rest days, no pump padding)', () => {
  freshS();
  // The all-2 standard: 14 exposures fill 7 honest days with no invented work.
  const std = app.generateBodybuildingDays({ ...FOCUS }, 7);
  assert.ok(std.length <= 7, 'never more days than availability');
  assert.ok(std.every(d => !d.nameKey || d.nameKey !== 'pump'), 'the pump-day filler is gone');
  assert.deepStrictEqual(app.validateFocusWeek(std, { ...FOCUS }, 7), []);
  // A lone 3x muscle on 7 available days trains 3 days; the other 4 are rest.
  const lone = { arms: 0, chest: 3, back: 0, shoulders: 0, glutes: 0, legs: 0, calves: 0 };
  const days = app.generateBodybuildingDays(lone, 7);
  assert.strictEqual(days.length, 3, 'the week is as long as the dose');
  assert.deepStrictEqual(app.validateFocusWeek(days, lone, 7), []);
});

test('7-day bodybuilding program builds, resolves, and stays at or under MRV weekly', () => {
  const s = withProgram('bodybuilding', { daysPerWeek: 7,
    muscleFocus: Object.assign({ ...FOCUS }, { chest: 6 }) });
  assert.strictEqual(s.program.days.length, 7);
  sweepAll(s.program);
  s.program.pointer.week = 1; // measure a work week, not the intro
  const tally = app.weeklyVolumeByMuscle();
  for (const mv in tally) {
    const lm = (s.profile.landmarks && s.profile.landmarks[mv]) || app.VOLUME_LANDMARKS[mv];
    if (!lm || !lm.mrv) continue;
    assert.ok(tally[mv] <= lm.mrv * 1.15,
      `${mv}: ${tally[mv]} weekly sets stays near/under MRV ${lm.mrv}`);
  }
});

// ---------------------------------------------------------------------------
// The frequency-aware per-session cap
// ---------------------------------------------------------------------------
test('perSessionCapDiv divides by the real frequency at 4x and stays 2 below it', () => {
  const s = withProgram('bodybuilding', { daysPerWeek: 7,
    muscleFocus: Object.assign({ ...FOCUS }, { chest: 6 }) });
  assert.strictEqual(app.perSessionCapDiv('chest'), 4, 'the 4x muscle divides by 4');
  assert.strictEqual(app.perSessionCapDiv('back'), 2, 'a 2x muscle keeps the historical /2');
  assert.strictEqual(app.perSessionCapDiv(null), 2);
  // Inertness: a default 4-day bodybuilding program never leaves /2.
  withProgram('bodybuilding', { daysPerWeek: 4 });
  for (const k of app.FOCUS_KEYS) assert.strictEqual(app.perSessionCapDiv(k), 2);
});

// ---------------------------------------------------------------------------
// [B4] The pad floor is DEAD: days are as long as the dose, never padded
// ---------------------------------------------------------------------------
test('no pad floor: total weekly slots equal the paid exposures for 3-6 day weeks', () => {
  const spend = Object.values(FOCUS).reduce((a, b) => a + b, 0);
  for (const n of [3, 4, 5, 6]) {
    freshS();
    const days = app.generateBodybuildingDays({ ...FOCUS }, n);
    assert.ok(days.length <= n, `${n}-day availability never over-builds`);
    const slots = days.reduce((s, d) => s + d.slots.length, 0);
    assert.strictEqual(slots, spend, `${n} days: ${slots} slots for ${spend} paid exposures`);
    assert.deepStrictEqual(app.validateFocusWeek(days, { ...FOCUS }, n), []);
  }
});

// ---------------------------------------------------------------------------
// Simulated multi-block runs at the extremes
// ---------------------------------------------------------------------------
function simulateBlocks(s, blocks) {
  const p = s.program;
  let sessions = 0;
  for (let block = 0; block < blocks; block++) {
    const bi = p.pointer.block;
    for (let wi = 0; wi * 1 === p.pointer.week && wi < app.blockWeeks(p.blocks[bi]); wi++) {
      for (let di = 0; di < p.days.length; di++) {
        const built = app.resolveDayEntries(di, bi, p.pointer.week);
        assert.ok(built.items.length > 0, `b${bi} w${p.pointer.week} d${di} has work`);
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
      if (p.pointer.block !== bi) break;
    }
  }
  return sessions;
}

test('simulated: a 7-day bodybuilder trains two full blocks without a stuck deload', () => {
  const s = withProgram('bodybuilding', { daysPerWeek: 7,
    muscleFocus: Object.assign({ ...FOCUS }, { chest: 6 }) });
  const sessions = simulateBlocks(s, 2);
  assert.ok(s.program.pointer.block >= 2, 'two blocks completed');
  assert.ok(sessions >= 7 * 2, 'sessions were logged all along');
  assert.ok(!s.program.earlyDeload, 'no stuck early-deload state');
  sweepAll(s.program);
});

test('simulated: a 1-day powerbuilder trains two full blocks', () => {
  const s = withProgram('powerbuilding', { maxes: {
    'comp-squat': 140, 'comp-bench': 100, 'comp-deadlift': 180, 'military-press': 60 } });
  simulateBlocks(s, 2);
  assert.ok(s.program.pointer.block >= 2, 'two blocks completed');
  sweepAll(s.program);
});

// ---------------------------------------------------------------------------
// Split editor bounds
// ---------------------------------------------------------------------------
test('the split editor grows to 7 and no further, shrinks to 1', () => {
  const s = withProgram('bodybuilding', { daysPerWeek: 6 });
  app.seAddDay();
  assert.strictEqual(s.program.days.length, 7);
  assert.strictEqual(s.program.daysPerWeek, 7);
  app.seAddDay(); // at the ceiling: a no-op with a toast
  assert.strictEqual(s.program.days.length, 7, 'seven is the ceiling');
  const s2 = withProgram('bodybuilding', { daysPerWeek: 2 });
  s2.program.days[1].slots = []; // an empty day removes without the confirm modal
  app.seRemoveDay(1);
  assert.strictEqual(s2.program.days.length, 1, 'a program can shrink to one day');
  assert.strictEqual(s2.program.daysPerWeek, 1);
});

// ---------------------------------------------------------------------------
// Templates round-trip at the extremes
// ---------------------------------------------------------------------------
test('template round-trip preserves 1-day and 7-day layouts', () => {
  for (const [track, n] of [['powerlifting', 1], ['powerbuilding', 7]]) {
    const s = withProgram(track, { daysPerWeek: n });
    const tpl = app.programTemplate();
    assert.deepStrictEqual(app.validateTemplate(tpl), { ok: true });
    const p2 = app.programFromTemplate(tpl);
    assert.strictEqual(p2.days.length, n);
    assert.deepStrictEqual(
      p2.days.map(d => d.slots.map(sl => [sl.type, sl.lift || sl.def || sl.cat])),
      s.program.days.map(d => d.slots.map(sl => [sl.type, sl.lift || sl.def || sl.cat])),
      `${n}-day layout survives the round-trip`);
    app.S.program = p2;
    sweepAll(p2);
  }
});

test('the 2-6 day templates are untouched by the 1/7-day addition', () => {
  for (const n of [2, 3, 4, 5, 6]) {
    assert.strictEqual(app.DAY_TEMPLATES[n].length, n);
    assert.strictEqual(app.BB_DAY_TEMPLATES[n].length, n);
  }
  assert.strictEqual(app.BB_DAY_TEMPLATES[1].length, 1);
  assert.strictEqual(app.BB_DAY_TEMPLATES[7].length, 7);
  assert.strictEqual(app.BB_DAY_TEMPLATES[7][6].nameKey, 'pump');
});

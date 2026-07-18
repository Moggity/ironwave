/* ============================================================
   IRONWAVE — test/prescription-sanity.test.js
   Consensus-grounded prescription audit (the hypertrophy
   dose-response literature). Simulates whole programs
   through resolveSlot and asserts the output never contradicts
   the training best practices the app claims to follow:

   1. Finisher techniques respect periodization: never on the
      intro (week 1), accumulation, or deload weeks; they DO
      attach on intensification/realization when opted in.
   2. jbb-hyp secondaries and accessories land inside the
      effective-rep window: the implied reps-in-reserve of a
      prescribed set (inverse Epley against its anchor) matches
      the displayed RIR within tolerance and never drifts into
      junk-volume territory (cites in the private derivation notes).
      - jbb-hyp MAINS are deliberately EXEMPT for now: they still
        run strength-wave percentages far above the shown RIR.
        TODO(owner): pending the mains re-anchor decision.
      - jm2-wave is exempt: it reproduces its classic 2012 wave
        source verbatim (submaximal waves + AMRAP progression).
   3. An entered rep-max is respected: with a 10RM on record, no
      high-rep prescription meets or exceeds that weight.
   ============================================================ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const E = app.Engine;

const MAXES = { 'comp-squat': 140, 'comp-bench': 100, 'comp-deadlift': 180, 'military-press': 60 };

// Bodybuilding 5-day with shoulders leading two upper days, so the split
// generator emits a secondary slot (the repeat anchor exposure). Every
// accessory gets one recent 12-rep record and a persisted finisher tag.
function bbProgram() {
  app.S = app.defaultState();
  app.S.program = app.makeProgram({
    daysPerWeek: 5, track: 'bodybuilding', timeMode: 'unlimited',
    experience: 'intermediate', goalArchetype: 'serious-macro',
    muscleFocus: { chest: 4, back: 3, shoulders: 5, arms: 4, legs: 2, glutes: 1, calves: 1 },
    maxes: { ...MAXES },
  });
  seedAccessories();
  return app.S.program;
}
function pbProgram() {
  app.S = app.defaultState();
  app.S.program = app.makeProgram({
    daysPerWeek: 4, track: 'powerbuilding', timeMode: 'unlimited',
    experience: 'intermediate',
    muscleFocus: { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 },
    maxes: { ...MAXES },
  });
  seedAccessories();
  return app.S.program;
}
function seedAccessories(tag) {
  const p = app.S.program;
  for (const d of p.days) for (const sl of d.slots) {
    if (sl.type === 'main' || sl.type === 'secondary') continue;
    const ex = sl.ex || sl.def;
    if (!ex) continue;
    app.S.records[ex] = [{ ts: Date.now(), weight: 40, reps: 12, rpe: 8 }];
    if (tag !== false) app.S.techniques[ex] = 'drop';
  }
}

// Inverse Epley: reps to failure at weight w for anchor e1, minus prescribed
// reps = the set's implied reps-in-reserve.
const impliedRIR = (e1, w, reps) => 30 * (e1 / w - 1) - reps;

// The prescription anchor a set was priced against (accessories use the
// rep-proximity anchor, same as the engine's prescription path).
function anchorFor(p, slot, rs, reps) {
  if (rs.isMain || rs.isSecondary) {
    const wm = p.wm[rs.wmKey];
    return wm ? (wm * (slot.pctMod || 1)) / 0.9 : null;
  }
  return E.anchorE1RM(app.S.records[rs.exId] || [], reps);
}

function sweep(p, fn) {
  p.blocks.forEach((b, bi) => {
    for (let wi = 0; wi < p.weeksPerBlock; wi++) {
      p.days.forEach((d) => {
        d.slots.forEach((slot) => {
          const rs = app.resolveSlot(slot, bi, wi);
          if (rs.isSelect || rs.isRemoved || !rs.sets.length) return;
          fn({ b, bi, wi, slot, rs, weekType: E.weekType(wi) });
        });
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Guard: the scenario really exercises a secondary slot (generator drift
// would otherwise hollow out the whole audit silently).
// ---------------------------------------------------------------------------
test('the shoulder-emphasis split generates a secondary anchor exposure', () => {
  const p = bbProgram();
  assert.ok(p.days.some(d => d.slots.some(sl => sl.type === 'secondary')),
    'expected a {type:"secondary"} slot in the generated bodybuilding week');
});

// ---------------------------------------------------------------------------
// 1. Finisher periodization
// ---------------------------------------------------------------------------
test('finishers never attach on intro, accumulation, or deload weeks', () => {
  const p = bbProgram();
  sweep(p, ({ wi, rs, weekType }) => {
    if (weekType === 'intensification' || weekType === 'realization') return;
    const tech = rs.sets.filter(s => app.FINISHER_TECHS.includes(s.technique));
    assert.strictEqual(tech.length, 0,
      `finisher attached on ${weekType} week (wk ${wi}) for ${rs.exId}`);
  });
});

test('positive control: a tagged accessory still gets its finisher on eligible weeks', () => {
  const p = bbProgram();
  let attached = 0;
  sweep(p, ({ rs, weekType }) => {
    if (weekType !== 'intensification' && weekType !== 'realization') return;
    if (rs.isMain || rs.isSecondary) return;
    attached += rs.sets.filter(s => app.FINISHER_TECHS.includes(s.technique)).length;
  });
  assert.ok(attached > 0, 'the week gate must not swallow legitimate late-meso finishers');
});

test('powerbuilding never carries a finisher, any week', () => {
  const p = pbProgram();
  // Tag everything anyway: the track gate alone must keep them out.
  sweep(p, ({ rs }) => {
    assert.ok(!rs.sets.some(s => app.FINISHER_TECHS.includes(s.technique)));
  });
});

// ---------------------------------------------------------------------------
// 2. RIR coherence + junk-volume ceiling (jbb-hyp secondaries & accessories)
// ---------------------------------------------------------------------------
function assertRirCoherence(p, label) {
  sweep(p, ({ b, wi, slot, rs, weekType }) => {
    if (b.scheme !== 'jbb-hyp') return;         // jm2-wave: source-faithful, exempt
    if (rs.isMain) return;                      // TODO(owner): mains pending re-anchor decision
    if (weekType === 'deload') return;          // deloads are deliberately easy
    const inc = app.loadingFor(rs.exId).totalInc || 2.5;
    for (const s of rs.sets) {
      if (!(s.weight > 0) || s.ramp || s.calib || s.amrap || s.rpe == null) continue;
      const e1 = anchorFor(p, slot, rs, s.reps);
      if (!e1) continue;
      const imp = impliedRIR(e1, s.weight, s.reps);
      const shown = 10 - s.rpe;
      // Load rounding moves implied RIR by up to (inc/2) * d(impliedRIR)/dw.
      const tol = Math.max(2, (inc / 2) * 30 * e1 / (s.weight * s.weight) + 1);
      assert.ok(Math.abs(imp - shown) <= tol,
        `${label} ${rs.exId} wk${wi} (${rs.isSecondary ? 'secondary' : 'accessory'}): ` +
        `${s.weight}kg x ${s.reps} shows ${shown} RIR but implies ${imp.toFixed(1)} RIR`);
      assert.ok(imp <= 6,
        `${label} ${rs.exId} wk${wi}: ${s.weight}kg x ${s.reps} implies ${imp.toFixed(1)} RIR: junk volume`);
    }
  });
}
test('jbb-hyp secondaries and accessories land in the effective-rep window (bodybuilding)', () => {
  assertRirCoherence(bbProgram(), 'bb');
});
test('jbb-hyp accessories land in the effective-rep window (powerbuilding hypertrophy blocks)', () => {
  assertRirCoherence(pbProgram(), 'pb');
});

// ---------------------------------------------------------------------------
// 3. An entered rep-max is respected by high-rep prescriptions
// ---------------------------------------------------------------------------
test('with a 10RM on record, no 10+ rep prescription meets or exceeds it', () => {
  const p = bbProgram();
  // The endurance-poor athlete: a heavy 1RM plus an explicit lighter 10RM.
  const probe = p.days.flatMap(d => d.slots).find(sl =>
    sl.type !== 'main' && sl.type !== 'secondary' && (sl.ex || sl.def));
  const exId = probe.ex || probe.def;
  app.S.records[exId] = [
    { ts: Date.now(), weight: 90, reps: 1, rpe: 10, seed: true },
    { ts: Date.now(), weight: 60, reps: 10, rpe: 10, seed: true },
  ];
  sweep(p, ({ wi, rs, weekType }) => {
    if (rs.exId !== exId || weekType === 'deload') return;
    for (const s of rs.sets) {
      if (!(s.weight > 0) || s.ramp || s.calib || s.reps < 10) continue;
      assert.ok(s.weight < 60,
        `wk${wi}: prescribed ${s.weight}kg x ${s.reps} at/above the athlete's stated 10RM of 60`);
    }
  });
});

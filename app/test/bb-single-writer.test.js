/* ============================================================
   IRONWAVE — test/bb-single-writer.test.js
   R4/R6 single-writer guard for the bodybuilding + recomp path
   (docs/week2-prescriptions/phase2-rules.md).

   On this path an accessory's set count = allocator base + plan.setAdj,
   then the deload rule (R8), then the athlete's own slot.setAdj; its load
   comes from program.plan (written only by Engine.coach.progress through
   advanceWeek). Every legacy layer that used to stack on accessory sets or
   effort must be inert here:
     program.volAdj (cluster E autoreg), program.weekMod (accSetDelta,
     and the rest of the week-feel modifier), the focus set scaling
     (focusForAccessory's FOCUS_FACTOR / per-session cap, driven by
     profile.landmarks and the slider), program.deloadPlan (cluster D
     deload depth / intensity).
   Each test sets one legacy layer and FAILS if the resolved accessory's
   set count, load, reps fields or RIR move. Positive controls show the
   three legitimate writers do move them.

   Not covered on purpose (athlete opt-ins, see the report): per-muscle
   early deload (program.muscleDeload) and finisher techniques.
   ============================================================ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { simulate, isWorking } = require('./bb-invariants-helper');

// Two weeks simulated: week 1 calibrated, week 2 entered with stored plans.
const RUN = simulate({ style: 'ascending', days: 4, experience: 'intermediate', weeks: 2 });
const app = RUN.app;
const BASE = JSON.stringify(app.S);
const B = 0;
function fresh() {
  app.S = JSON.parse(BASE);
  app.V = { dayIdx: null, view: 'dashboard', tab: 'dashboard' };
  return app.S.program;
}
const accSlots = p => p.days.flatMap((d, di) => d.slots.map((slot, si) => ({ slot, di, si })))
  .filter(x => x.slot.type !== 'main' && x.slot.type !== 'secondary');
// What the single writer owns: set count, load, reps fields and RIR, per slot.
function snapshot(w) {
  const p = app.S.program;
  const out = {};
  for (const { slot, di, si } of accSlots(p)) {
    const rs = app.resolveSlot(slot, B, w);
    out[`d${di}s${si} ${rs.exId}`] = rs.sets.filter(isWorking)
      .map(s => [s.weight ?? null, s.reps ?? null, s.repRange || null, s.rpe ?? null, s.rirRange || null]);
  }
  return out;
}
const gWeek = w => w + 1; // block 0: global week = week index + 1
// Assert two snapshots match; on failure name each slot that moved.
function same(after, before, label) {
  const fmt = sets => `${sets.length} x [${sets[0] ? sets[0].map(v => JSON.stringify(v)).join(' ') : ''}]`;
  const diffs = Object.keys(Object.assign({}, before, after))
    .filter(k => JSON.stringify(after[k]) !== JSON.stringify(before[k]))
    .map(k => `${k}: ${before[k] ? fmt(before[k]) : 'absent'} -> ${after[k] ? fmt(after[k]) : 'absent'}`);
  assert.deepStrictEqual(diffs, [], `${label}: accessory prescription moved`);
}
const W2 = 1, W3 = 2, DELOAD = 4;

test('precondition: the program is on the gated path with stored plans, pointer on week 2', () => {
  const p = fresh();
  assert.strictEqual(app.bbSpecPath(), true);
  assert.deepStrictEqual(p.pointer, { block: 0, week: 1 });
  assert.ok(p.plan && Object.keys(p.plan).length > 0);
  const snap = snapshot(W2);
  assert.ok(Object.values(snap).every(sets => sets.length > 0 && sets.every(s => s[0] > 0)), 'priced accessories');
});

// ---- legacy layers must be inert ---------------------------------------------
test('program.volAdj (cluster E autoreg offset) does not change accessories', () => {
  for (const delta of [2, -2]) {
    fresh();
    const before = { w2: snapshot(W2), w3: snapshot(W3), dl: snapshot(DELOAD) };
    const p = app.S.program;
    p.volAdj = {};
    for (const mv of Object.keys(app.VOLUME_LANDMARKS)) p.volAdj[mv] = delta;
    same(snapshot(W2), before.w2, `volAdj ${delta}, week 2`);
    same(snapshot(W3), before.w3, `volAdj ${delta}, week 3`);
    same(snapshot(DELOAD), before.dl, `volAdj ${delta}, deload`);
  }
});

test('program.weekMod.accSetDelta for the week does not change accessories', () => {
  for (const w of [W2, W3]) for (const accSetDelta of [1, -1]) {
    fresh();
    const before = snapshot(w);
    app.S.program.weekMod = { appliesToGlobalWeek: gWeek(w), pctMod: 1, accSetDelta, mainSetDelta: 0 };
    same(snapshot(w), before, `week ${w + 1}, accSetDelta ${accSetDelta}`);
  }
});

test('the full week-feel modifier (feel 1: accSetDelta -1, mainSetDelta -1, pctMod 0.95) does not change accessories', () => {
  // This is what computeWeekMod returns for the lowest week-feel pick. The
  // modifier is a legacy layer; on this path no part of it may reach an
  // accessory's sets, directly or through another computation.
  for (const w of [W2, W3]) {
    fresh();
    const before = snapshot(w);
    app.S.program.weekMod = { appliesToGlobalWeek: gWeek(w), pctMod: 0.95, accSetDelta: -1, mainSetDelta: -1 };
    same(snapshot(w), before, `week ${w + 1}`);
  }
  // A modifier for week 2 must not reach week 3 either.
  fresh();
  const w3 = snapshot(W3);
  app.S.program.weekMod = { appliesToGlobalWeek: gWeek(W2), pctMod: 0.95, accSetDelta: -1, mainSetDelta: -1 };
  same(snapshot(W3), w3, 'week 3 with a week-2 modifier');
});

test('focus set scaling (per-session landmark cap, slider 2 -> 3) does not change accessories', () => {
  // focusForAccessory scales a slider-2 accessory to min(plain x 1, perSessionCap)
  // with perSessionCap from profile.landmarks: a tiny MRV would cut it to 1 set
  // on the legacy path. On this path the allocator owns the count.
  fresh();
  const before = snapshot(W2);
  const lm = {};
  for (const mv of Object.keys(app.VOLUME_LANDMARKS)) lm[mv] = Object.assign({}, app.VOLUME_LANDMARKS[mv], { mev: 0, mav: 1, mrv: 1 });
  app.S.profile.landmarks = lm;
  same(snapshot(W2), before, 'tiny per-session cap');
  fresh();
  const tc = app.S.program.trainingConfig;
  for (const k of Object.keys(tc.muscleFocus)) if (tc.muscleFocus[k] === 2) tc.muscleFocus[k] = 3;
  same(snapshot(W2), before, 'sliders 2 -> 3 (same allocator group set, no FOCUS_FACTOR scaling)');
});

test('program.deloadPlan (cluster D depth and intensity) does not change the deload week', () => {
  for (const plan of [
    { level: 'deep', setDelta: -1, rpeDelta: -1, over: 3, reason: 'x' },
    { level: 'light', setDelta: 1, rpeDelta: 0, over: 0, reason: 'x' },
  ]) {
    fresh();
    const before = snapshot(DELOAD);
    app.S.program.deloadPlan = plan;
    same(snapshot(DELOAD), before, plan.level);
  }
});

test('updateAutoreg() leaves program.volAdj untouched on this path, and the simulated weeks never wrote it', () => {
  fresh();
  const p = app.S.program;
  assert.ok(Object.values(p.volAdj || {}).every(v => !v), 'advanceWeek (which calls updateAutoreg) wrote no volAdj');
  p.volAdj = { chest: 1, quad: -1 };
  const before = JSON.stringify(p.volAdj);
  app.updateAutoreg();
  assert.strictEqual(JSON.stringify(p.volAdj), before);
});

// ---- the legitimate writers do move them ---------------------------------------
test('control: plan.load moves the load, plan.setAdj and slot.setAdj move the set count', () => {
  let p = fresh();
  const x = accSlots(p).find(a => { const rs = app.resolveSlot(a.slot, B, W2); return rs.sets.filter(isWorking).length < 5; });
  assert.ok(x, 'an accessory with room for one more set');
  const id = x.slot.ex || x.slot.def;
  const rs0 = app.resolveSlot(x.slot, B, W2);
  const n0 = rs0.sets.filter(isWorking).length;
  const w0 = rs0.sets.find(isWorking).weight;

  p.plan[id].load = w0 + 10;
  let rs = app.resolveSlot(x.slot, B, W2);
  assert.ok(rs.sets.filter(isWorking).every(s => s.weight === w0 + 10), 'plan.load is the load');

  p = fresh();
  p.plan[id].setAdj = (p.plan[id].setAdj || 0) + 1;
  const slot1 = p.days[x.di].slots[x.si];
  rs = app.resolveSlot(slot1, B, W2);
  assert.strictEqual(rs.sets.filter(isWorking).length, n0 + 1, 'plan.setAdj adds a set');

  p = fresh();
  const slot2 = p.days[x.di].slots[x.si];
  slot2.setAdj = 1;
  rs = app.resolveSlot(slot2, B, W2);
  assert.strictEqual(rs.sets.filter(isWorking).length, n0 + 1, 'slot.setAdj adds a set');
});

test('control: the allocator inputs (slider level) move the set count', () => {
  const p = fresh();
  const x = accSlots(p).find(a => app.MOVEMENT_SLIDER[app.exById(a.slot.ex || a.slot.def).movement]);
  const key = app.MOVEMENT_SLIDER[app.exById(x.slot.ex || x.slot.def).movement];
  p.trainingConfig.muscleFocus[key] = 1;
  const rs = app.resolveSlot(x.slot, B, W2);
  assert.strictEqual(rs.sets.filter(isWorking).length, 2, 'slider 1 = 2 sets per exercise (R6)');
  p.trainingConfig.muscleFocus[key] = 0;
  const off = app.resolveSlot(x.slot, B, W2);
  assert.strictEqual(off.sets.length, 0, 'slider 0 removes the exercise');
});

// ---- one writer, once ------------------------------------------------------------
test('R4 progress runs once per exercise per week, even when the exercise sits in two slots', () => {
  // After a block transition the rotation routinely places the same accessory
  // in two slots of the week (seen with 3-6 days). The writer must still run
  // once: the load may rise by at most one R4 step.
  const id = 'ez-curl';
  const runOnce = dup => {
    const p = fresh();
    const slot = p.days.flatMap(d => d.slots).find(s => (s.ex || s.def) === id);
    assert.ok(slot, 'precondition: the exercise is in the program');
    const other = p.days.findIndex(d => !d.slots.some(s => (s.ex || s.def) === id));
    if (dup) p.days[other].slots.push(JSON.parse(JSON.stringify(slot)));
    // Week 2 logged at the top of the range, on target effort.
    for (const s of app.S.sessions) if (s.b === 0 && s.w === 1) for (const e of s.entries) {
      if (e.exId === id) for (const st of e.sets) if (!st.ramp) Object.assign(st, { reps: st.repRange[1], rpe: 10 - st.rirRange[1], done: true });
    }
    const load0 = p.plan[id].load;
    app.advanceWeek();
    return { load0, load1: p.plan[id].load, reasons: p.planReasons.byEx[id] };
  };
  const single = runOnce(false);
  const double = runOnce(true);
  assert.ok(single.load1 > single.load0, `precondition: the single-slot week earns a rise (${JSON.stringify(single)})`);
  assert.strictEqual(double.load1, single.load1,
    `two slots must progress like one: ${single.load0} -> ${single.load1} single, ${double.load0} -> ${double.load1} with the exercise in two slots`);
});

// ---- the resolver only reads -------------------------------------------------------
test('resolveSlot on the gated path is a pure read (no state written, same output twice)', () => {
  fresh();
  const p = app.S.program;
  const before = JSON.stringify(app.S);
  const first = [];
  for (let w = 0; w < 5; w++) for (const d of p.days) for (const slot of d.slots) first.push(app.resolveSlot(slot, B, w));
  assert.strictEqual(JSON.stringify(app.S), before, 'S unchanged by resolving every slot of the block');
  const second = [];
  for (let w = 0; w < 5; w++) for (const d of p.days) for (const slot of d.slots) second.push(app.resolveSlot(slot, B, w));
  assert.deepStrictEqual(second, first);
});

/* ============================================================
   IRONWAVE — test/bb-recomp-regression.test.js
   Regression suite for the week-2 prescriptions fix
   (docs/week2-prescriptions/phase2-rules.md, R1-R9), on top of the
   reproduction in bb-recomp-invariants.test.js:

   - the user case over 8 weeks (crosses the deload and a block
     transition), both athlete styles, invariants I1-I6;
   - a sweep over every experience level x every supported
     days-per-week x both styles, 8 weeks each;
   - maxes on the fly (R7), before week 1 and mid-block;
   - the deload and block transition (R8);
   - the scope guard: other goals and tracks get none of the new fields;
   - one small rendering test of the R9 labels.

   Determinism: there is no randomness in the generator. A grep for
   Math.random over data.js, engine.js and app.js finds nothing, so there
   are no seeds to sweep; the athlete styles ('ascending', 'flat') and the
   input grid are the variation. The only clock reads are the helper's
   own fixed offsets from Date.now() (session timestamps are relative).

   Supported days per week: onboarding offers 1..7 (the day picker in
   app.js renders [1,2,3,4,5,6,7]; generateBodybuildingDays builds any of
   them), so the sweep covers 1..7.
   ============================================================ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const H = require('./bb-invariants-helper');
const { simulate, CHECKS, isPlain, isWorking } = H;

const WEEKS = 8;
const STYLES = ['ascending', 'flat'];
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const DAYS = [1, 2, 3, 4, 5, 6, 7];

function report(id, bad) {
  return `${id}: ${bad.length} violation(s)\n  ` + bad.slice(0, 25).join('\n  ') +
    (bad.length > 25 ? `\n  ... and ${bad.length - 25} more` : '');
}
function assertAll(runs) {
  const msgs = [];
  for (const id of Object.keys(CHECKS)) {
    const bad = runs.flatMap(run => CHECKS[id](run));
    if (bad.length) msgs.push(report(id, bad));
  }
  assert.strictEqual(msgs.length, 0, msgs.join('\n'));
}
const accRows = wk => wk.rows.filter(r => !r.rs.isMain && !r.rs.isSecondary);
const findWeek = (run, b, w) => run.weeks.find(x => x.b === b && x.w === w);

// ---- 1. the user case, 8 weeks ----------------------------------------------
const USER = STYLES.map(style => simulate({ style, days: 4, experience: 'intermediate', weeks: WEEKS }));

test('user case: 8 weeks reach the deload and the next block', () => {
  for (const run of USER) {
    assert.strictEqual(run.weeks.length, WEEKS);
    assert.ok(run.weeks.some(w => w.weekType === 'deload'), 'crosses the deload');
    assert.ok(run.weeks.some(w => w.b === 1), 'crosses a block transition');
  }
});

for (const id of Object.keys(CHECKS)) {
  test(`user case (bodybuilding + recomp, 4 days, intermediate, 8 weeks, both styles): ${id}`, () => {
    const bad = USER.flatMap(run => CHECKS[id](run));
    assert.strictEqual(bad.length, 0, report(id, bad));
  });
}

// ---- 2. the sweep -----------------------------------------------------------
for (const experience of LEVELS) for (const days of DAYS) {
  test(`sweep: ${experience}, ${days} day(s), both styles, ${WEEKS} weeks: I1-I6 on every week`, () => {
    const runs = STYLES.map(style => simulate({ style, days, experience, weeks: WEEKS }));
    for (const run of runs) assert.strictEqual(run.weeks.length, WEEKS, 'all 8 weeks generated');
    assertAll(runs);
  });
}

// ---- 3. progression that actually moves loads, across a block transition ----
// The default simulated athlete performs mid-range at the target RIR, so loads
// never rise and R4's LOAD_UP path is never exercised by the sweep. Here every
// accessory gets an entered 10RM well below the athlete's real strength, so the
// athlete tops the range and the coach must raise loads by the R4/I3 rules,
// including after the block transition (where exercises rotate and the
// same accessory can sit in two slots of the week).
test('loads that progress (entered maxes below real strength), 8 weeks, both styles: I1-I6', () => {
  const probe = require('./load-app').loadApp();
  const seeds = {};
  for (const e of probe.EXERCISES) if (!e.isMain) seeds[e.id] = { r10: Math.round(H.hiddenE1(e.id) * 0.5) };
  const runs = STYLES.map(style => simulate({ style, days: 4, experience: 'intermediate', weeks: WEEKS, seeds }));
  const rose = runs.some(run => run.weeks.some((wk, i) => i > 0 && accRows(wk).some(r => (r.rs.reasons || []).includes('LOAD_UP') || (r.rs.reasons || []).includes('LOAD_UP_EARNED'))));
  assert.ok(rose, 'precondition: loads do rise in this scenario');
  assertAll(runs);
});

// ---- 4. R8 deload and block transition --------------------------------------
test('R8 deload week: same range, load = last working load x 0.9 rounded down to a step, half the sets rounded up (min 2), RIR 4-5', () => {
  for (const run of USER) {
    const dl = run.weeks.find(w => w.weekType === 'deload');
    const pk = findWeek(run, dl.b, dl.w - 1);
    let checked = 0;
    for (const r of accRows(dl)) {
      const prev = pk.rows.find(x => x.di === r.di && x.si === r.si && x.exId === r.exId);
      if (!prev) continue;
      const pw = prev.rs.sets.filter(isPlain);
      if (!pw.length || !(pw[0].weight > 0)) continue;
      const work = r.rs.sets.filter(isWorking);
      const where = `${run.opts.style} ${r.exId}`;
      assert.strictEqual(r.rs.setScheme, 'DELOAD', `${where}: setScheme`);
      assert.strictEqual(work.length, Math.max(2, Math.ceil(pw.length / 2)), `${where}: sets`);
      const expected = Math.floor((pw[0].weight * 0.9) / r.inc + 1e-9) * r.inc;
      for (const s of work) {
        assert.strictEqual(s.weight, expected, `${where}: load`);
        assert.deepStrictEqual(s.rirRange, [4, 5], `${where}: RIR`);
        assert.deepStrictEqual(s.repRange, pw[0].repRange, `${where}: same range`);
        assert.strictEqual(s.repForm, 'range', `${where}: range form`);
      }
      assert.ok((r.rs.reasons || []).includes('DELOAD'), `${where}: DELOAD reason`);
      checked++;
    }
    assert.ok(checked > 0, 'some accessories were checked');
  }
});

test('R8 block transition: week 1 of the next block carries BLOCK_TRANSITION on every exercise, ranges from R1', () => {
  for (const run of USER) {
    const first = findWeek(run, 1, 0);
    assert.ok(first, 'block 2 week 1 was generated');
    for (const r of first.rows) {
      assert.ok((r.rs.reasons || []).includes('BLOCK_TRANSITION'), `${run.opts.style} ${r.exId}: ${JSON.stringify(r.rs.reasons)}`);
      if (r.rs.isMain || r.rs.isSecondary) continue;
      const spec = run.app.Engine.bbRepSpec(r.kind, run.app.exById(r.exId).movement);
      for (const s of r.rs.sets.filter(isWorking)) assert.deepStrictEqual(s.repRange, spec.range, r.exId);
    }
  }
});

// ---- 5. R5 an old save mid-block --------------------------------------------
// A save written before this change has logs but no program.plan. R5: "An
// exercise with logs keeps last week's plan (hold). An exercise never logged
// and with no entered max stays on the calibration scheme." Reading: an
// exercise that HAS logged working sets must not fall back to calibration once
// its logged week is processed by advanceWeek().
test('R5 old save mid-block (logs, no plan): logged exercises do not drop back to calibration after the next advance', () => {
  const run = simulate({ style: 'ascending', days: 4, experience: 'intermediate', weeks: 3 });
  const { app, program: p } = run;
  delete p.plan; delete p.planReasons; // as saved by v1.23.0
  const logged = new Set();
  for (const s of app.S.sessions) if (s.b === 0 && s.w === 2) for (const e of s.entries) {
    if (e.sets.some(st => st.done && !st.calib && st.weight > 0)) logged.add(e.exId);
  }
  app.advanceWeek();
  const bad = [];
  p.days.forEach(d => d.slots.forEach(slot => {
    if (slot.type === 'main' || slot.type === 'secondary') return;
    const rs = app.resolveSlot(slot, p.pointer.block, p.pointer.week);
    if (logged.has(rs.exId) && rs.setScheme === 'CALIBRATION') bad.push(rs.exId);
  }));
  assert.ok(logged.size > 0, 'precondition: accessories with logged working sets');
  assert.deepStrictEqual(bad, [], `back on calibration despite logged working sets: ${bad.join(', ')}`);
});

// ---- 6. R7 maxes on the fly ----------------------------------------------------
test('R7 (a) a 1RM / 10RM entered before week 1: week 1 is priced range sets, no CALIBRATION scheme for that exercise', () => {
  const id = 'bb-hip-thrust';
  for (const style of STYLES) {
    const run = simulate({ style, days: 4, experience: 'intermediate', weeks: 1, seeds: { [id]: { r1: 140, r10: 100 } } });
    const rows = run.weeks[0].rows.filter(r => r.exId === id);
    assert.ok(rows.length, 'precondition: the exercise is in week 1');
    const E = run.app.Engine;
    for (const r of rows) {
      assert.notStrictEqual(r.rs.setScheme, 'CALIBRATION', `${style}: no calibration week`);
      const work = r.rs.sets.filter(isWorking);
      assert.ok(work.length >= 1);
      const ex = run.app.exById(id);
      const spec = E.bbRepSpec(ex.kind, ex.movement);
      const rir = E.bbRir(ex.kind, 0);
      for (const s of work) {
        assert.ok(!s.calib, 'no feeler sets');
        assert.strictEqual(s.repForm, 'range');
        assert.deepStrictEqual(s.repRange, spec.range);
        assert.deepStrictEqual(s.rirRange, rir, 'week-1 RIR target');
        assert.ok(s.weight > 0, 'priced');
        // Priced from the entered max: the load gives a rep count inside the
        // range at the RIR target, for an e1RM between the two entries' e1RMs.
        assert.ok(s.weight < 140, 'below the entered 1RM');
      }
      const w = work[0].weight;
      const lo = E.e1rm(100, 10, 10), hi = E.e1rm(140, 1, 10);
      const midReps = Math.floor((spec.range[0] + spec.range[1]) / 2);
      const wLo = E.weightFor(Math.min(lo, hi), midReps, 10 - rir[1], r.inc);
      const wHi = E.weightFor(Math.max(lo, hi), midReps, 10 - rir[1], r.inc);
      assert.ok(w >= wLo - r.inc && w <= wHi + r.inc, `${style}: load ${w} priced from the entered maxes (${wLo}-${wHi})`);
    }
  }
});

// The app's own save path (saveExMaxes) reads two DOM inputs through byId().
// Neither harness can reach it: load-app.js stubs every element with an empty
// value (so saveExMaxes stops at "enter a max"), and load-dom.js evaluates the
// app as strict code, so its functions are not reachable from the window and
// its export shim does not list saveExMaxes. This test therefore replays the
// exact statements saveExMaxes runs (replace the seed records, push the new
// seeds, call bbMaxUpdated) and a static check below proves saveExMaxes and
// saveCustomEx do call bbMaxUpdated.
test('R7 (b) a max saved mid-block clears the plan, reprices on the next resolve (no calibration), reason MAX_UPDATED', () => {
  const id = 'bb-hip-thrust';
  const run = simulate({ style: 'ascending', days: 4, experience: 'intermediate', weeks: 3 });
  const { app, program: p } = run;
  const b = p.pointer.block, w = p.pointer.week;
  assert.strictEqual(w, 2, 'precondition: mid-block');
  assert.ok(p.plan && p.plan[id] && p.plan[id].load > 0, 'precondition: a stored plan');
  const slot = p.days.flatMap(d => d.slots).find(s => (s.ex || s.def) === id);
  const before = app.resolveSlot(slot, b, w).sets.filter(isWorking);
  // saveExMaxes(id) with 1RM 200:
  app.S.records[id] = app.recordsFor(id).filter(r => !r.seed);
  app.pushRecord(id, { ts: Date.now(), weight: 200, reps: 1, rpe: 10, seed: true });
  app.bbMaxUpdated(id);
  assert.ok(!(p.plan && p.plan[id]), 'the plan for that exercise is cleared');
  const rs = app.resolveSlot(slot, b, w);
  const work = rs.sets.filter(isWorking);
  assert.notStrictEqual(rs.setScheme, 'CALIBRATION', 'no calibration week');
  assert.ok(work.every(s => !s.calib && s.weight > 0 && s.repForm === 'range'));
  assert.ok(work[0].weight > before[0].weight, `repriced from the stronger max: ${before[0].weight} -> ${work[0].weight}`);
  assert.ok(work[0].weight < 200);
  assert.ok((rs.reasons || []).includes('MAX_UPDATED'), `MAX_UPDATED expected, got ${JSON.stringify(rs.reasons)}`);
  // Other exercises keep their plans and their reasons.
  const others = Object.keys(p.plan || {});
  assert.ok(others.length > 0, 'other plans untouched');
  // The resolve after that is stable (a pure read).
  assert.deepStrictEqual(app.resolveSlot(slot, b, w), rs);
});

test('R7 the save paths call bbMaxUpdated (saveExMaxes always, saveCustomEx when a max was entered)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const body = name => {
    const i = src.indexOf(`function ${name}(`);
    assert.ok(i >= 0, `${name} exists`);
    const j = src.indexOf('\nfunction ', i + 10);
    return src.slice(i, j);
  };
  assert.match(body('saveExMaxes'), /bbMaxUpdated\(id\)/);
  assert.match(body('saveCustomEx'), /bbMaxUpdated\(id\)/);
});

// ---- 7. scope guard ------------------------------------------------------------
const NEW_SET_FIELDS = ['repForm', 'rirRange'];
const NEW_SLOT_FIELDS = ['setScheme', 'reasons'];
function newFieldHits(rs, where) {
  const hits = [];
  for (const f of NEW_SLOT_FIELDS) if (f in rs) hits.push(`${where}: slot has ${f}`);
  for (const s of rs.sets || []) for (const f of NEW_SET_FIELDS) if (f in s) hits.push(`${where}: set has ${f}`);
  return hits;
}

// [Phase 3, owner ruling] serious-macro and lean-asap joined the spec path, so
// this guard moved to a bodybuilding program with NO goal (a save from before
// goals existed, or an imported template): it stays on the old engine.
test('scope guard: bodybuilding with no goal (legacy save) gets none of the new fields and no plan', () => {
  for (const style of STYLES) {
    const run = simulate({ style, days: 4, experience: 'intermediate', weeks: WEEKS, goal: null });
    assert.strictEqual(run.app.bbSpecPath(), false);
    const hits = run.weeks.flatMap(wk => wk.rows.flatMap(r => newFieldHits(r.rs, `b${wk.b + 1}w${wk.w + 1} ${r.exId}`)));
    assert.deepStrictEqual(hits.slice(0, 10), []);
    assert.strictEqual(run.program.plan, undefined);
    assert.strictEqual(run.program.planReasons, undefined);
  }
});

test('scope guard: track powerbuilding (even with goal recomp) gets none of the new fields and no plan', () => {
  const { loadApp } = require('./load-app');
  for (const experience of LEVELS) for (const days of [3, 4, 5]) {
    const app = loadApp();
    app.S = app.defaultState();
    app.V = { dayIdx: null, view: 'dashboard', tab: 'dashboard' };
    app.S.profile.experience = experience;
    app.S.program = app.makeProgram({ daysPerWeek: days, track: 'powerbuilding', goalArchetype: 'recomp',
      experience, timeMode: 'unlimited', maxes: {} });
    const p = app.S.program;
    assert.strictEqual(app.bbSpecPath(), false);
    const hits = [];
    for (let n = 0; n < WEEKS && p.pointer.block < p.blocks.length; n++) {
      const b = p.pointer.block, w = p.pointer.week;
      p.days.forEach((d, di) => d.slots.forEach((slot, si) => {
        hits.push(...newFieldHits(app.resolveSlot(slot, b, w), `${experience} ${days}d b${b + 1}w${w + 1} d${di} s${si}`));
      }));
      app.advanceWeek();
    }
    assert.deepStrictEqual(hits.slice(0, 10), []);
    assert.strictEqual(p.plan, undefined);
    assert.strictEqual(p.planReasons, undefined);
  }
});

// ---- 8. R9 rendering -------------------------------------------------------------
test('R9 labels: range, calibration, AMRAP and deload sets render the right text in English and Spanish, no em dashes', () => {
  const run = USER[0];
  const app = run.app;
  const pick = (pred) => { for (const wk of run.weeks) for (const r of wk.rows) if (pred(r, wk)) return { r, wk }; return null; };
  const range = pick((r, wk) => wk.weekType === 'accumulation' && !r.rs.setScheme && r.rs.sets.some(s => s.repForm === 'range' && s.weight > 0));
  const calib = pick(r => r.rs.setScheme === 'CALIBRATION' && !r.rs.isMain && !r.rs.isSecondary);
  const amrap = pick(r => r.rs.setScheme === 'AMRAP_FINISH');
  const deload = pick(r => r.rs.setScheme === 'DELOAD' && !r.rs.isMain && !r.rs.isSecondary);
  assert.ok(range && calib && amrap && deload, 'precondition: each kind of set occurs in the run');
  const draft = x => app.sessionEntryFrom({ si: x.r.si, rs: x.r.rs }).sets;
  const work = x => x.r.rs.sets.filter(isWorking);
  const errs = [];
  for (const lang of ['en', 'es']) {
    app.I18N.setLang(lang);
    for (const mode of ['rir', 'rpe']) {
      app.S.profile.intensityDisplay = mode;
      const all = [];
      // Range set: "load x lo-hi" on the row; "n x lo-hi · a-b RIR" on the scheme line.
      {
        const s = work(range)[0], st = draft(range).find(d => !d.ramp);
        const lbl = app.setTargetLabel(st, range.r.exId);
        const rr = `${s.repRange[0]}-${s.repRange[1]}`;
        if (!lbl.includes(`× ${rr}`)) errs.push(`${lang}/${mode} range row: ${lbl}`);
        if (!lbl.startsWith(app.fmtW(range.r.exId, s.weight))) errs.push(`${lang}/${mode} range row load: ${lbl}`);
        const eff = mode === 'rir' ? `${s.rirRange[0]}-${s.rirRange[1]} RIR` : `RPE ${10 - s.rirRange[1]}-${10 - s.rirRange[0]}`;
        const line = app.rangeSchemeLine(work(range));
        if (line !== `${work(range).length} x ${rr} · ${eff}`) errs.push(`${lang}/${mode} range scheme line: ${line}`);
        const pv = app.previewSetLabel(s, range.r.exId);
        if (pv !== `${app.fmtW(range.r.exId, s.weight)} × ${rr} @ ${eff}`) errs.push(`${lang}/${mode} range preview: ${pv}`);
        all.push(lbl, line, pv);
      }
      // Calibration set: bare "reps @ RIR" row, no load, no range scheme line.
      {
        const s = work(calib)[0], st = draft(calib)[0];
        const lbl = app.setTargetLabel(st, calib.r.exId);
        if (!lbl.includes(String(s.reps)) || lbl.includes('×')) errs.push(`${lang}/${mode} calibration row: ${lbl}`);
        if (app.rangeSchemeLine(work(calib)) !== null) errs.push(`${lang}/${mode} calibration must not get a range scheme line`);
        const pv = app.previewSetLabel(s, calib.r.exId);
        if (!pv.startsWith(String(s.reps)) || pv.includes('-' + s.repRange[1])) errs.push(`${lang}/${mode} calibration preview: ${pv}`);
        all.push(lbl, pv);
      }
      // AMRAP set on a main: "load x AMRAP".
      {
        const i = amrap.r.rs.sets.findIndex(s => s.amrap);
        const st = draft(amrap)[i];
        const lbl = app.setTargetLabel(st, amrap.r.exId);
        if (!lbl.includes('× AMRAP')) errs.push(`${lang}/${mode} AMRAP row: ${lbl}`);
        const pv = app.previewSetLabel(amrap.r.rs.sets[i], amrap.r.exId);
        if (!pv.includes('AMRAP')) errs.push(`${lang}/${mode} AMRAP preview: ${pv}`);
        all.push(lbl, pv);
      }
      // Deload set on an accessory: still the range, at RIR 4-5.
      {
        const s = work(deload)[0], st = draft(deload).find(d => !d.ramp);
        const rr = `${s.repRange[0]}-${s.repRange[1]}`;
        const lbl = app.setTargetLabel(st, deload.r.exId);
        if (lbl !== `${app.fmtW(deload.r.exId, s.weight)} × ${rr}`) errs.push(`${lang}/${mode} deload row: ${lbl}`);
        const eff = mode === 'rir' ? '4-5 RIR' : 'RPE 5-6';
        const line = app.rangeSchemeLine(work(deload));
        if (line !== `${work(deload).length} x ${rr} · ${eff}`) errs.push(`${lang}/${mode} deload scheme line: ${line}`);
        all.push(lbl, line);
      }
      for (const txt of all) if (/—/.test(txt)) errs.push(`${lang}/${mode} em dash in: ${txt}`);
    }
  }
  app.I18N.setLang('en'); app.S.profile.intensityDisplay = 'rir';
  for (const k of ['session.sets_x_range', 'session.sets_x_range_rir']) {
    for (const lang of ['en', 'es']) {
      const s = app.I18N.catalogs[lang].strings[k];
      if (typeof s !== 'string') errs.push(`${k} missing in ${lang}`);
      else if (/—/.test(s)) errs.push(`${k} (${lang}) has an em dash`);
    }
  }
  assert.deepStrictEqual(errs, []);
});

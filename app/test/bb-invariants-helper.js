/* ============================================================
   IRONWAVE — test/bb-invariants-helper.js
   Shared harness for the bodybuilding prescription invariants
   I1-I6 (docs/week2-prescriptions/decisions.md, "Final rules").
   Not a test file itself (the runner globs *.test.js): it exports
   a deterministic athlete simulation plus one checker per
   invariant, each returning a list of violation strings.

   ASSERTIONS LIVE HERE. Phase 2 must make them pass without
   editing them; if one looks wrong, stop and ask the owner.

   No randomness exists in the generator (no Math.random in
   data.js / engine.js / app.js), so fixed inputs are the seed.
   ============================================================ */
'use strict';
const { loadApp } = require('./load-app');

// ---- I1 whitelist ---------------------------------------------------------
const RANGES = { compound: [[6, 10], [8, 12]], isolation: [[10, 15], [12, 20]] };
const FIXED = [6, 8, 10, 12, 15];
// ---- I2 effort bounds (RIR) -----------------------------------------------
const RIR = { compound: [1, 3], isolation: [0, 2] };
// Declared schemes whose sets are exempt from I2 (owner ruling, Q4): feeler
// sets and deload sets are deliberately easy; the AMRAP set of a declared
// AMRAP_FINISH scheme is deliberately all-out.
const I2_EXEMPT_SCHEMES = ['CALIBRATION', 'DELOAD'];
// ---- I6 weekly hard sets per muscle group (owner ruling, Q1) ---------------
// Work weeks only (not calibration, not deload), groups at slider Standard (2)
// or High (3), floor scaled for short weeks: 10 x min(1, days / 4).
const VOL_MIN = 10, VOL_MAX = 20;
const WORK_WEEKS = ['accumulation', 'intensification', 'realization'];

const DAY = 864e5;
const DEFAULT_FOCUS = { arms: 2, chest: 2, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 2 };

const hiddenE1 = id => 40 + (id.length * 7) % 60; // deterministic strength per exercise
const isWorking = s => !s.ramp;                    // warm-up ramps are not working sets
const isPlain = s => !s.ramp && !s.amrap && !s.calib;
const sameRange = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
const inList = (list, r) => list.some(x => sameRange(x, r));
const fmtSet = s => `${s.weight ?? '?'}x${s.reps ?? (s.repRange || []).join('-')}@rpe${s.rpe ?? '-'}`;

/* The simulated athlete. Trains every prescribed day, logs every set, then
   completes the week through the app's own advanceWeek().
   - A set with a load is done at that load.
   - A set without one (calibration) gets a load the athlete picks:
       style 'ascending'  heavier each feeler set (priced off the hidden e1RM)
       style 'flat'       the same load on all feeler sets
   - Reps: a range-form set is performed to the target RIR, so the reps are
     whatever the hidden e1RM allows at that load (inverse Epley). Any other
     set is performed exactly as written.
   opts: { style, days, experience, weeks, focus, goal, maxes, seeds, track, meetDate, macroWeeks }
     track / meetDate / macroWeeks were added for the Phase 3 survey (defaults keep
     every earlier call identical).
     seeds: { exId: { r1, r10 } } entered before week 1 (maxes "on the fly").
   Returns { app, program, weeks: [{ b, w, weekType, rows, volume }] }. */
function simulate(opts = {}) {
  const o = Object.assign({ style: 'ascending', days: 4, experience: 'intermediate', weeks: 4,
    focus: DEFAULT_FOCUS, goal: 'recomp', maxes: {}, seeds: null,
    track: 'bodybuilding', meetDate: null, macroWeeks: 18 }, opts);
  const app = loadApp();
  const E = app.Engine;
  app.S = app.defaultState();
  app.V = { dayIdx: null, view: 'dashboard', tab: 'dashboard' };
  app.S.profile.experience = o.experience;
  app.S.program = app.makeProgram({
    daysPerWeek: o.days, track: o.track, goalArchetype: o.track === 'bodybuilding' ? o.goal : null,
    macroWeeks: o.track === 'bodybuilding' ? o.macroWeeks : null,
    ...(o.meetDate ? { meetDate: o.meetDate } : {}),
    experience: o.experience, timeMode: 'unlimited', muscleFocus: { ...o.focus }, maxes: { ...o.maxes },
  });
  const p = app.S.program;
  const T0 = Date.now() - 100 * DAY;
  if (o.seeds) {
    for (const id in o.seeds) {
      const { r1, r10 } = o.seeds[id];
      if (r1) app.pushRecord(id, { ts: T0 - DAY, weight: r1, reps: 1, rpe: 10, seed: true });
      if (r10) app.pushRecord(id, { ts: T0 - DAY, weight: r10, reps: 10, rpe: 10, seed: true });
    }
  }
  const weeks = [];
  for (let n = 0; n < o.weeks; n++) {
    if (p.pointer.block >= p.blocks.length) break;
    const b = p.pointer.block, w = p.pointer.week;
    const tally = app.weeklyVolumeByMuscle();
    const volume = {};
    for (const mv in tally) {
      const key = app.MOVEMENT_SLIDER[mv];
      if (key) volume[key] = (volume[key] || 0) + tally[mv];
    }
    const rows = [];
    p.days.forEach((d, di) => {
      const ts = T0 + (n * 7 + di) * DAY;
      const entries = [];
      for (const item of app.resolveDayEntries(di, b, w).items) {
        const rs = item.rs;
        const ex = app.exById(rs.exId);
        const inc = app.loadingFor(rs.exId).totalInc || 2.5;
        rows.push({ di, si: item.si, exId: rs.exId, kind: ex.kind, rs: JSON.parse(JSON.stringify(rs)), inc });
        const entry = app.sessionEntryFrom(item);
        const e1 = hiddenE1(rs.exId);
        const flat = rs.sets.length ? E.weightFor(e1, rs.sets[0].reps ?? 10, rs.sets[0].rpe ?? 8, inc) : 0;
        rs.sets.forEach((s, j) => {
          const rir = s.rirRange ? s.rirRange[1] : 10 - (s.rpe ?? 8);
          const weight = s.weight ?? (o.style === 'flat' ? flat : E.weightFor(e1, s.reps ?? 10, 10 - rir, inc));
          let reps = s.reps;
          if (s.repForm === 'range' && s.repRange && weight > 0) {
            reps = Math.max(1, Math.min(s.repRange[1] + 2, Math.round(30 * (e1 / weight - 1) - rir)));
          }
          const rpe = 10 - rir;
          Object.assign(entry.sets[j], { weight, reps, rpe, done: true });
          const rec = { ts, weight, reps, rpe };
          app.pushRecord(rs.exId, rec);
          if (s.calib && (rs.isMain || rs.isSecondary) && rs.wmKey) {
            const wm = E.recalibratedWM(p.wm[rs.wmKey], [rec]);
            if (wm) p.wm[rs.wmKey] = E.roundLoad(wm, 1.25);
          }
        });
        entries.push(entry);
      }
      app.S.sessions.push({ id: `s${n}-${di}`, ts, b, w, d: di, entries });
      p.completedDays[`${b}-${w}-${di}`] = `s${n}-${di}`;
    });
    weeks.push({ n, b, w, weekType: E.weekType(w), rows, volume });
    if (n < o.weeks - 1) app.advanceWeek();
  }
  return { app, program: p, weeks, opts: o };
}

const tag = (run, wk, r) => `[${run.opts.style} ${run.opts.days}d ${run.opts.experience}] b${wk.b + 1}w${wk.w + 1} ${r.exId}`;

// The exercise's rep CATEGORY for a week: the form plus the range (or the
// fixed target). Read from the plain working sets, else from any working set.
function repCategory(rs) {
  const s = rs.sets.find(isPlain) || rs.sets.find(isWorking);
  if (!s) return null;
  if (s.repForm === 'range' && s.repRange) return `range:${s.repRange[0]}-${s.repRange[1]}`;
  if (s.repForm === 'fixed') return `fixed:${s.reps}`;
  // No declared form (I1 reports that): read what the set actually carries.
  return s.repRange ? `range:${s.repRange[0]}-${s.repRange[1]}` : `fixed:${s.reps}`;
}
const plainWeight = rs => { const s = rs.sets.find(x => isPlain(x) && x.weight > 0); return s ? s.weight : null; };
const plainCount = rs => rs.sets.filter(isPlain).length;
const signature = rs => JSON.stringify(rs.sets.filter(isWorking).map(s => [s.weight ?? null, s.reps ?? null, s.repRange || null, s.rpe ?? null, s.rirRange || null]));
// The same slot one week earlier, same block only (a block transition may
// change anything; I4 still demands a reason for what persists across it).
function prevRow(run, i, r, sameBlock) {
  if (i === 0) return null;
  const prev = run.weeks[i - 1];
  if (sameBlock && prev.b !== run.weeks[i].b) return null;
  return prev.rows.find(x => x.di === r.di && x.si === r.si && x.exId === r.exId) || null;
}

// I1 rep format: whitelisted range or whitelisted fixed target, with a rationale.
function checkI1(run) {
  const bad = [];
  for (const wk of run.weeks) for (const r of wk.rows) {
    if (r.kind !== 'compound' && r.kind !== 'isolation') {
      bad.push(`${tag(run, wk, r)}: exercise has no compound/isolation category (kind=${r.kind})`);
    }
    const allowed = RANGES[r.kind] || RANGES.compound.concat(RANGES.isolation);
    for (const s of r.rs.sets.filter(isWorking)) {
      const where = `${tag(run, wk, r)} set ${fmtSet(s)}`;
      if (s.repForm !== 'range' && s.repForm !== 'fixed') bad.push(`${where}: no repForm (range|fixed)`);
      if (typeof s.repRationale !== 'string' || !s.repRationale) bad.push(`${where}: no repRationale`);
      if (!s.repRange || !inList(allowed, s.repRange)) {
        bad.push(`${where}: range ${JSON.stringify(s.repRange || null)} is not on the whitelist for ${r.kind || 'any category'}`);
      }
      // Any integer the prescription carries must itself be a whitelisted
      // target inside the exercise's range ("any other value is invalid").
      if (s.reps != null) {
        if (!FIXED.includes(s.reps)) bad.push(`${where}: ${s.reps} reps is not in {${FIXED.join(', ')}}`);
        else if (s.repRange && (s.reps < s.repRange[0] || s.reps > s.repRange[1])) bad.push(`${where}: ${s.reps} reps is outside its range`);
      } else if (s.repForm === 'fixed') bad.push(`${where}: fixed form without a rep target`);
    }
  }
  return bad;
}

// I2 effort: every working set carries an RIR target inside its category bounds.
function checkI2(run) {
  const bad = [];
  for (const wk of run.weeks) for (const r of wk.rows) {
    const [lo, hi] = RIR[r.kind] || [0, 3];
    const scheme = r.rs.setScheme;
    for (const s of r.rs.sets.filter(isWorking)) {
      const where = `${tag(run, wk, r)} set ${fmtSet(s)}`;
      const rir = s.rirRange || (s.rpe != null ? [10 - s.rpe, 10 - s.rpe] : null);
      if (!rir) { bad.push(`${where}: no RIR / RPE target`); continue; }
      if (I2_EXEMPT_SCHEMES.includes(scheme)) continue;
      if (s.amrap && scheme === 'AMRAP_FINISH') continue;
      if (rir[0] < lo || rir[1] > hi) bad.push(`${where}: RIR ${rir[0] === rir[1] ? rir[0] : rir.join('-')} outside ${lo}-${hi} (${r.kind || 'uncategorised'})`);
    }
  }
  return bad;
}

// I3 continuity: inside a block only load, sets and RIR move; the rep category holds.
function checkI3(run) {
  const bad = [];
  run.weeks.forEach((wk, i) => {
    for (const r of wk.rows) {
      const prev = prevRow(run, i, r, true);
      if (!prev) continue;
      const a = repCategory(prev.rs), b = repCategory(r.rs);
      if (a && b && a !== b) bad.push(`${tag(run, wk, r)}: rep category changed ${a} -> ${b}`);
      const w0 = plainWeight(prev.rs), w1 = plainWeight(r.rs);
      if (w0 && w1 && w1 > w0) {
        // Owner ruling (Q3): a rise is at most 5%, rounded DOWN to whole steps
        // of the implement. When one step is more than 5% the coach may still
        // take a single step of at most 10%, but only as an earned jump with
        // the LOAD_UP_EARNED reason code. Anything bigger waits.
        const diff = w1 - w0;
        const allowed = Math.floor((w0 * 0.05) / r.inc) * r.inc;
        const earned = diff <= r.inc + 1e-9 && diff <= w0 * 0.10 + 1e-9
          && Array.isArray(r.rs.reasons) && r.rs.reasons.includes('LOAD_UP_EARNED');
        if (diff > allowed + 1e-9 && !earned) {
          bad.push(`${tag(run, wk, r)}: load ${w0} -> ${w1} (+${(100 * diff / w0).toFixed(1)}%), allowed +${allowed}`);
        }
      }
      const n0 = plainCount(prev.rs), n1 = plainCount(r.rs);
      if (n0 && n1 && Math.abs(n1 - n0) > 1 && r.rs.setScheme !== 'DELOAD') {
        bad.push(`${tag(run, wk, r)}: plain sets ${n0} -> ${n1} (more than one set)`);
      }
    }
  });
  return bad;
}

// I4 explainability: every week-over-week change carries a reason code from the closed enum.
function checkI4(run) {
  const bad = [];
  const codes = run.app.Engine.REASON_CODES;
  if (!codes || typeof codes !== 'object') bad.push('Engine.REASON_CODES (the closed enum) does not exist');
  const known = new Set(codes ? Object.values(codes) : []);
  run.weeks.forEach((wk, i) => {
    for (const r of wk.rows) {
      const prev = prevRow(run, i, r, false);
      if (!prev || signature(prev.rs) === signature(r.rs)) continue;
      const reasons = r.rs.reasons;
      if (!Array.isArray(reasons) || !reasons.length) bad.push(`${tag(run, wk, r)}: changed with no reason code`);
      else for (const c of reasons) if (!known.has(c)) bad.push(`${tag(run, wk, r)}: unknown reason code ${c}`);
    }
  });
  return bad;
}

// I5 set homogeneity: one rep prescription and RIR per exercise unless a named scheme is declared.
function checkI5(run) {
  const bad = [];
  for (const wk of run.weeks) for (const r of wk.rows) {
    const sigs = new Set(r.rs.sets.filter(isWorking).map(s => JSON.stringify([s.reps ?? null, s.repRange || null, s.rpe ?? null, s.rirRange || null])));
    if (sigs.size > 1 && !(typeof r.rs.setScheme === 'string' && r.rs.setScheme)) {
      bad.push(`${tag(run, wk, r)}: mixed sets without a declared scheme: ${r.rs.sets.filter(isWorking).map(fmtSet).join(' | ')}`);
    }
  }
  return bad;
}

// I6 weekly volume: hard sets per muscle group inside the floor and ceiling on work weeks.
function checkI6(run) {
  const bad = [];
  const floor = VOL_MIN * Math.min(1, run.opts.days / 4);
  for (const wk of run.weeks) {
    if (!WORK_WEEKS.includes(wk.weekType)) continue;
    for (const key of Object.keys(run.opts.focus)) {
      if (!(run.opts.focus[key] >= 2)) continue;
      const n = wk.volume[key] || 0;
      if (n < floor || n > VOL_MAX) bad.push(`[${run.opts.style} ${run.opts.days}d ${run.opts.experience}] b${wk.b + 1}w${wk.w + 1} ${key}: ${n} sets (allowed ${floor}-${VOL_MAX})`);
    }
  }
  return bad;
}

const CHECKS = { I1: checkI1, I2: checkI2, I3: checkI3, I4: checkI4, I5: checkI5, I6: checkI6 };

module.exports = { simulate, CHECKS, checkI1, checkI2, checkI3, checkI4, checkI5, checkI6,
  RANGES, FIXED, RIR, VOL_MIN, VOL_MAX, DEFAULT_FOCUS, hiddenE1, isWorking, isPlain, fmtSet };

/* ============================================================
   IRONWAVE — app.js
   State, navigation, and all views. Vanilla JS, server-backed state
   via GET/POST /api/state (see server.js).
   ============================================================ */

'use strict';

// ------------------------------------------------------------
// STATE
// ------------------------------------------------------------
const LS_KEY = 'ironwave_v1';

// S (state) and V (view) are populated by boot() once the server state
// has loaded. They start as null so a stray synchronous access throws a
// clear error instead of silently reading off a pending Promise.
let S = null;
let V = null;

function defaultState() {
  return {
    v: 1,
    profile: { name: '', bodyweight: null, barWeight: 20, rounding: 2.5,
               dbIncrement: 2.5, machineStep: 5,
               plates: JSON.parse(JSON.stringify(DEFAULT_PLATES)),
               // Dynamic engine (see docs/dynamic-routine-engine-design.md). All
               // defaults make a routine identical to the legacy output.
               training: { track: 'powerbuilding', timeMode: 'unlimited', timeCapMin: null,
                 muscleFocus: { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 } },
               experience: 'intermediate',
               trainingAge: { startedTs: null, blocksCompleted: 0 },
               landmarks: {} },
    program: null,
    records: {},      // exId -> [{ts, weight, reps, rpe}]
    loadingProfiles: {}, // exId -> { mode, count, barWeight } — per-exercise loading, persists across programs
    customEx: [],
    sessions: [],
    checkins: [],
    readinessLog: [],
    skipPenalty: 0,
    lastSkipTs: null,
    orderPenalty: 0,
    lastOrderTs: null,
  };
}
async function loadState() {
  try {
    const res = await fetch('/api/state');
    if (res.ok) {
      const s = Object.assign(defaultState(), await res.json());
      migrateState(s);
      return s;
    }
  } catch (e) { console.warn('state load failed', e); }
  return defaultState();
}
// [Juggernaut + Bodybuilding] migration: programs saved before the
// scheme split get scheme ids stamped per block type.
function migrateState(s) {
  if (s.program && Array.isArray(s.program.blocks)) {
    s.program.blocks.forEach(b => {
      if (!b.scheme) b.scheme = b.type === 'hypertrophy' ? 'jbb-hyp' : 'jm2-wave';
    });
    if (s.program.blocks.some(b => b.mesoIdx == null)) stampMesoIdx(s.program.blocks);
    if (!s.program.methodology) s.program.methodology = 'Juggernaut + Bodybuilding';
    // Defensive defaults: a program from a very old save (or hand-edited
    // database.json) may predate these fields. The dashboard reads
    // pointer.block unconditionally, so guarantee they exist.
    if (!s.program.pointer) s.program.pointer = { block: 0, week: 0 };
    if (s.program.weeksPerBlock == null) s.program.weeksPerBlock = 5;
    if (!s.program.completedDays) s.program.completedDays = {};
    if (s.program.weekMod === undefined) s.program.weekMod = null;
  }
  // Dynamic engine fields (additive, idempotent). A save predating the engine
  // backfills to the legacy-identical defaults, so its routine is unchanged.
  const p = s.profile || (s.profile = {});
  const t = p.training = p.training || {};
  t.track = t.track || 'powerbuilding';
  t.timeMode = t.timeMode || 'unlimited';
  if (t.timeCapMin === undefined) t.timeCapMin = null;
  t.muscleFocus = Object.assign({ arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 },
                                t.muscleFocus || {});
  p.experience = p.experience || 'intermediate';
  if (!p.trainingAge) p.trainingAge = { startedTs: (s.program && s.program.startDate) || null, blocksCompleted: 0 };
  if (!p.landmarks || !Object.keys(p.landmarks).length) p.landmarks = Engine.seedLandmarks(p.experience);
  if (s.program && !s.program.trainingConfig) {
    // Legacy programs predate tracks: stamp them as the powerbuilding default.
    s.program.trainingConfig = { track: 'powerbuilding', timeMode: 'unlimited', timeCapMin: null,
      muscleFocus: Object.assign({}, t.muscleFocus) };
  }
}
// save() now serializes overlapping writes (last-write-wins is fine for a
// single user, but two in-flight POSTs racing to the file can interleave),
// and reports a real failure to the user instead of only console.warn.
let _saveChain = Promise.resolve();
function save() {
  _saveChain = _saveChain.then(async () => {
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(S)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
    } catch (e) {
      console.warn('state save failed', e);
      if (typeof toast === 'function') toast('Save failed, data not persisted', true);
    }
  });
  return _saveChain;
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
const $app = document.getElementById('app');
const $modal = document.getElementById('modal-root');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId = id => document.getElementById(id);
const fmtDate = ts => new Date(ts).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
const fmtDateLong = ts => new Date(ts).toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric', year:'numeric' });
const kg = w => (w % 1 === 0 ? w : w.toFixed(1));

function allExercises() { return EXERCISES.concat(S.customEx); }
function exById(id) { return allExercises().find(e => e.id === id); }
function exName(id) { const e = exById(id); return e ? e.name : id; }
function recordsFor(id) { return S.records[id] || []; }
function pushRecord(id, rec) { (S.records[id] = S.records[id] || []).push(rec); }

// ------------------------------------------------------------
// LOADING PROFILES (Change 1)
// Stored weight on a set is ALWAYS the total load moved, so all
// existing math (e1RM, wave %, tonnage, plate inventory) is untouched.
// We only change how the total is rounded and how it is displayed.
// ------------------------------------------------------------
// Dumbbell entries that use a single implement at a time.
const SINGLE_DB = new Set(['goblet-squat', 'db-row', 'kroc-row', 'single-leg-rdl', 'db-side-bend', 'suitcase-carry']);
const EQUIP_MODE = { bb: 'barbell', db: 'dumbbell', mc: 'machine', cb: 'cable', bw: 'bodyweight', bd: 'band' };

// Default loading derived from the exercise's equipment tag.
function defaultLoadingFor(exId) {
  const e = exById(exId);
  const eq = e ? e.equipment : 'bb';
  if (eq === 'db') return { mode: 'dumbbell', count: SINGLE_DB.has(exId) ? 1 : 2 };
  return { mode: EQUIP_MODE[eq] || 'barbell' };
}

// Resolved loading profile for an exercise (stored override merged over the default).
function loadingFor(exId) {
  const stored = (S.loadingProfiles || {})[exId] || {};
  const def = defaultLoadingFor(exId);
  const mode = stored.mode || def.mode || 'barbell';
  const count = mode === 'dumbbell' ? (stored.count ?? def.count ?? 2) : 1;
  const dbInc = S.profile.dbIncrement ?? 2.5;
  const mcStep = S.profile.machineStep ?? 5;
  let barWeight = 0, totalInc, showPlates = false;
  if (mode === 'barbell') { barWeight = S.profile.barWeight; totalInc = S.profile.rounding; showPlates = true; }
  else if (mode === 'lightbar') { barWeight = stored.barWeight ?? 10; totalInc = S.profile.rounding; showPlates = true; }
  else if (mode === 'dumbbell') { totalInc = dbInc * count; }            // round per hand, then x count
  else if (mode === 'machine' || mode === 'cable') { totalInc = mcStep; }
  else { totalInc = dbInc; }                                             // bodyweight / band: optional added load
  return { mode, count, barWeight, totalInc, showPlates };
}

// Display a stored total in the exercise's own units. Stored numbers stay totals; only the shown number divides.
function displayWeight(exId, totalWeight) {
  const L = loadingFor(exId);
  if (L.mode === 'dumbbell' && L.count === 2) {
    return { value: totalWeight == null ? null : totalWeight / 2, unit: 'kg per hand' };
  }
  return { value: totalWeight, unit: 'kg' }; // single dumbbell: the number is the dumbbell itself
}

// Compact weight string for set rows: "40kg" or "20kg/hand".
function fmtW(exId, totalWeight) {
  const d = displayWeight(exId, totalWeight);
  if (d.value == null) return '';
  return d.unit === 'kg per hand' ? `${kg(d.value)}kg/hand` : `${kg(d.value)}kg`;
}

function toast(msg, warn) {
  const root = document.getElementById('toast-root');
  const t = document.createElement('div');
  t.className = 'toast' + (warn ? ' warn' : '');
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function nav(view, extra) {
  V.view = view;
  if (extra) Object.assign(V, extra);
  window.scrollTo(0, 0);
  render();
}
function setTab(tab) {
  V.tab = tab;
  nav(tab === 'dashboard' ? 'dashboard' : tab === 'workout' ? 'workout' :
      tab === 'history' ? 'history' : 'more');
}

// ------------------------------------------------------------
// PROGRAM HELPERS
// ------------------------------------------------------------
// [Juggernaut + Bodybuilding] stamp each block's position among
// same-scheme blocks (mesoIdx) — drives macrocycle-level progression.
function stampMesoIdx(blocks) {
  const counts = {};
  blocks.forEach(b => {
    const id = blockScheme(b);
    b.mesoIdx = counts[id] || 0;
    counts[id] = b.mesoIdx + 1;
  });
}
function makeProgram(ob) {
  // Track selects the block periodization; day layouts are shared. Defaults to
  // powerbuilding so an onboarding without a track behaves exactly as before.
  const track = ob.track || 'powerbuilding';
  const tpl = PROGRAM_TEMPLATES[track] || PROGRAM_TEMPLATES.powerbuilding;
  const days = JSON.parse(JSON.stringify(DAY_TEMPLATES[ob.daysPerWeek]));
  const blocks = JSON.parse(JSON.stringify(tpl.blocks));
  stampMesoIdx(blocks);
  const totalWeeks = blocks.length * tpl.weeksPerBlock;
  const start = Date.now();
  const wm = {};
  const increments = {};
  for (const lift of ['comp-squat','comp-bench','comp-deadlift','military-press']) {
    wm[lift] = ob.maxes[lift] ? Math.round(ob.maxes[lift] * 0.9 / 1.25) * 1.25 : null;
    increments[lift] = Engine.defaultIncrement(lift);
  }
  const focus = Object.assign({ arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 },
                             ob.muscleFocus || {});
  // Bodybuilding: rebuild the day layout around the athlete's muscle focus
  // (drop deadlift + zeroed muscles, refill freed/empty slots and select-only
  // emphasized muscles, add an extra main dose for a muscle at 6). Other tracks
  // keep the shared templates untouched.
  if (track === 'bodybuilding') buildFocusedDays(days, focus, ob.daysPerWeek);
  return {
    template: tpl.id, daysPerWeek: ob.daysPerWeek,
    methodology: tpl.methodology || 'Juggernaut + Bodybuilding',
    startDate: start,
    testDate: ob.testDate || start + totalWeeks * 7 * 864e5,
    blocks,
    weeksPerBlock: tpl.weeksPerBlock,
    pointer: { block: 0, week: 0 },
    days, wm, increments,
    completedDays: {},
    weekMod: null, // Change 2: single-use end-of-week autoregulation modifier for the upcoming week
    // Snapshot of the config this cycle was built with, so editing profile later
    // does not silently rewrite an in-flight program.
    trainingConfig: {
      track,
      timeMode: ob.timeMode || 'unlimited',
      timeCapMin: ob.timeMode === 'custom' ? (ob.timeCapMin || null) : null,
      muscleFocus: Object.assign({}, focus),
    },
  };
}
// ------------------------------------------------------------
// BODYBUILDING DAY REBUILD (full refill)
// Turns the fixed pattern-based templates into a muscle-focus-aware layout so
// emphasis adds real exercises, removed muscles disappear, select-only muscles
// (glutes/calves) actually get trained, and no chosen training day ends empty.
// Runs once at program creation; sliders are fixed for the cycle.
// ------------------------------------------------------------
function buildFocusedDays(days, focus, daysPerWeek) {
  const lm = (S.profile && S.profile.landmarks) || {};
  const mvKey = m => MOVEMENT_SLIDER[m];
  const slotKey = sl => {
    if (sl.type === 'main' || sl.type === 'secondary') return mvKey((exById(sl.ex || sl.lift) || {}).movement);
    const ex = sl.ex || sl.def;
    return mvKey(ex ? (exById(ex) || {}).movement : sl.cat);
  };
  const isAcc = sl => sl.type !== 'main' && sl.type !== 'secondary';
  // 1. Drop deadlift lifts and any slot whose muscle is set to 0.
  for (const d of days) {
    d.slots = d.slots.filter(sl => {
      if ((sl.type === 'main' || sl.type === 'secondary') && (exById(sl.ex || sl.lift) || {}).movement === 'deadlift') return false;
      const k = slotKey(sl);
      return !(k && focus[k] === 0);
    });
  }
  // Track every exercise already placed, so refill adds variety.
  const used = new Set();
  days.forEach(d => d.slots.forEach(sl => { const e = sl.ex || sl.def; if (e) used.add(e); }));
  const pick = k => {
    for (const id of (DEFAULT_ACC[k] || [])) if (!used.has(id)) { used.add(id); return id; }
    return (DEFAULT_ACC[k] || [])[0] || null;
  };
  const muscleOnDay = (d, k) => d.slots.filter(sl => slotKey(sl) === k).length;
  const addAcc = (d, k) => {
    const ex = pick(k); if (!ex) return false;
    d.slots.push({ type: 'acc', cat: (exById(ex) || {}).movement, def: ex, focusFill: true });
    return true;
  };
  const filledAccFor = k => days.reduce((n, d) => n + d.slots.filter(sl => isAcc(sl) && (sl.ex || sl.def) && slotKey(sl) === k).length, 0);
  // Weekly accessory-slot budget for a muscle, from its MRV (~4 sets per slot).
  const budget = k => {
    let mrv = 12;
    for (const m of (SLIDER_MOVEMENTS[k] || [])) { const L = lm[m] || VOLUME_LANDMARKS[m]; if (L) mrv = Math.max(mrv, L.mrv); }
    return Math.max(1, Math.round(mrv / 4));
  };
  // 2. Emphasized muscles (>3) get more exercises up to budget, spread across days.
  const emph = FOCUS_KEYS.filter(k => focus[k] > 3).sort((a, b) => focus[b] - focus[a]);
  for (const k of emph) {
    const want = Math.min(budget(k), filledAccFor(k) + (focus[k] - 3)); // +1 slot per step above 3, capped
    let guard = 0;
    while (filledAccFor(k) < want && guard++ < 24) {
      const day = days.filter(d => muscleOnDay(d, k) < 2).sort((a, b) => a.slots.length - b.slots.length)[0];
      if (!day || !addAcc(day, k)) break;
    }
  }
  // 3. Backfill thin/empty days with the top targets (emphasized, else kept).
  const targets = (emph.length ? emph : FOCUS_KEYS.filter(k => focus[k] >= 1).sort((a, b) => focus[b] - focus[a]));
  for (const d of days) {
    let ti = 0, guard = 0;
    while (targets.length && d.slots.length < 3 && guard++ < 12) {
      const k = targets[ti % targets.length]; ti++;
      if (muscleOnDay(d, k) >= 2) { if (ti > targets.length * 3) break; continue; }
      if (!addAcc(d, k)) break;
    }
  }
  // 4. Extra main dose for a muscle at 6 on a 5-6 day split, placed ~half a week
  //    from its existing main exposure for recovery. Uses a secondary (volume)
  //    exposure so it never adds a second working-max-moving AMRAP.
  if (daysPerWeek >= 5) {
    for (const k of ['chest', 'legs', 'shoulders']) {
      if (focus[k] !== 6) continue;
      const lift = MUSCLE_MAIN[k];
      const at = days.findIndex(d => d.slots.some(sl => (sl.type === 'main' || sl.type === 'secondary') && (sl.lift === lift || sl.baseLift === lift)));
      if (at < 0) continue;
      const tgt = (at + Math.floor(days.length / 2)) % days.length;
      if (tgt === at) continue;
      const dup = days[tgt].slots.some(sl => (sl.type === 'main' || sl.type === 'secondary') && (sl.lift === lift || sl.baseLift === lift));
      if (!dup) days[tgt].slots.unshift({ type: 'secondary', lift, baseLift: lift, focusFill: true });
    }
  }
  return days;
}
function P() { return S.program; }
function dayKey(b, w, d) { return `${b}-${w}-${d}`; }
function blockOf(i) { return P().blocks[i]; }
function curBlock() { return blockOf(P().pointer.block); }
function weekIdx() { return P().pointer.week; }
function programDone() { return P().pointer.block >= P().blocks.length; }
function daysOut() { return Math.max(0, Math.ceil((P().testDate - Date.now()) / 864e5)); }
function globalWeekNum() { return P().pointer.block * P().weeksPerBlock + P().pointer.week + 1; }

// Resolve slot to a prescription { exId, name, sets, slotRef, isMain, isSelect }
// All prescriptions route through the block's declared scheme — see
// Engine.schemes ([Juggernaut + Bodybuilding] split). No cross-mixing.
function blockScheme(block) {
  return block.scheme || (block.type === 'hypertrophy' ? 'jbb-hyp' : 'jm2-wave');
}
// Change 2: safely add or drop PLAIN working sets (never an amrap, ramp, or
// calibration set, and never below one plain working set). Mutates and returns sets.
function applySetDelta(sets, delta) {
  if (!delta) return sets;
  const isPlain = s => !s.amrap && !s.ramp && !s.calib;
  if (delta > 0) {
    const plainIdx = sets.map((s, i) => (isPlain(s) ? i : -1)).filter(i => i >= 0);
    if (!plainIdx.length) return sets; // nothing to clone (e.g. a ramp-to-AMRAP realization main)
    const src = sets[plainIdx[plainIdx.length - 1]];
    let at = plainIdx[plainIdx.length - 1] + 1; // insert before any trailing AMRAP
    for (let k = 0; k < delta; k++) { sets.splice(at, 0, Object.assign({}, src, { note: null })); at++; }
  } else {
    let toRemove = -delta;
    for (let i = sets.length - 1; i >= 0 && toRemove > 0; i--) {
      if (!isPlain(sets[i])) continue;
      if (sets.filter(isPlain).length <= 1) break; // keep at least one plain working set
      sets.splice(i, 1); toRemove--;
    }
  }
  return sets;
}
// FOCUS (Step 4): bodybuilding muscle-focus sliders reshape ACCESSORY volume.
// A no-op for every other track and for any slider left at 3, so default and
// powerbuilding/powerlifting routines are byte-identical. Mains and secondaries
// are never touched (they carry the wave math and working-max progression).
// Returns { removed } or { delta } of plain working sets to apply via applySetDelta.
function focusForAccessory(exId, sets) {
  const tc = P() && P().trainingConfig;
  if (!tc || tc.track !== 'bodybuilding' || !tc.muscleFocus) return { delta: 0 };
  const e = exById(exId);
  const key = e && MOVEMENT_SLIDER[e.movement];
  if (!key) return { delta: 0 };
  const v = tc.muscleFocus[key];
  if (v == null || v === 3) return { delta: 0 };
  if (v === 0) return { removed: true };
  const plain = sets.filter(s => !s.amrap && !s.ramp && !s.calib).length;
  if (!plain) return { delta: 0 }; // a calibration ramp: nothing to scale yet
  const lm = (S.profile.landmarks && S.profile.landmarks[e.movement]) || VOLUME_LANDMARKS[e.movement];
  const perSessionCap = lm ? Math.max(1, Math.round(lm.mrv / 2)) : 8; // ~2 sessions/wk/muscle
  const target = Math.max(1, Math.min(Math.round(plain * FOCUS_FACTOR[v]), perSessionCap));
  return { delta: target - plain };
}
// Bodybuilding (hypertrophy) removal of a big lift: the deadlift has no place in
// a hypertrophy routine, and a muscle slider set to 0 (e.g. an injury the athlete
// is working around) drops that muscle's main/secondary lift too. Returns a short
// reason string, or null to keep the lift. Other tracks always keep their lifts.
function bbLiftRemoval(exId) {
  const tc = P() && P().trainingConfig;
  if (!tc || tc.track !== 'bodybuilding') return null;
  const mv = (exById(exId) || {}).movement;
  if (mv === 'deadlift') return 'not used in hypertrophy';
  const key = mv && MOVEMENT_SLIDER[mv];
  if (key && tc.muscleFocus && tc.muscleFocus[key] === 0) return 'removed by focus';
  return null;
}
function resolveSlot(slot, blockIdx, wIdx) {
  const block = blockOf(blockIdx);
  const sch = Engine.schemeFor(block);
  // Change 2: the pending weekly modifier applies to exactly one global week.
  const gWeek = blockIdx * P().weeksPerBlock + wIdx + 1;
  const mod = (P().weekMod && P().weekMod.appliesToGlobalWeek === gWeek) ? P().weekMod : null;
  const modPct = mod ? mod.pctMod : 1;
  if (slot.type === 'main') {
    const wmKey = slot.lift;                  // wave math always keys off the base lift's WM
    const exId = slot.ex || slot.lift;        // …but the performed exercise can be swapped
    const rm = bbLiftRemoval(exId);
    if (rm) return { exId, name: exName(exId), sets: [], isMain: true, wmKey, isRemoved: true, removedReason: rm };
    const r = loadingFor(exId).totalInc;      // Change 1: round the total to this implement's increment
    let sets = sch.main(block, wIdx, P().wm[wmKey], r, modPct);
    if (mod) sets = applySetDelta(sets, mod.mainSetDelta || 0);
    return { exId, name: exName(exId), sets, isMain: true, wmKey };
  }
  if (slot.type === 'secondary') {
    const wmKey = slot.baseLift || slot.lift;
    const exId = slot.ex || slot.lift;
    const rm = bbLiftRemoval(exId);
    if (rm) return { exId, name: exName(exId), sets: [], isSecondary: true, wmKey, isRemoved: true, removedReason: rm };
    const r = loadingFor(exId).totalInc;
    const sets = sch.secondary(block, wIdx, P().wm[wmKey], r, (slot.pctMod || 1) * modPct);
    return { exId, name: exName(exId), sets, isSecondary: true, wmKey };
  }
  const exId = slot.ex || slot.def || null; // select slots may be unfilled
  if (!exId) {
    // A select slot for a muscle the athlete removed (slider 0) should not nag
    // them to pick an exercise for it. Mark it removed instead of select.
    const tc = P() && P().trainingConfig;
    if (tc && tc.track === 'bodybuilding' && tc.muscleFocus && slot.cat) {
      const key = MOVEMENT_SLIDER[slot.cat];
      if (key && tc.muscleFocus[key] === 0) {
        return { exId: null, name: (MOVEMENTS[slot.cat] || {}).label || slot.cat, isRemoved: true, cat: slot.cat, sets: [] };
      }
    }
    return { exId: null, name: null, isSelect: true, cat: slot.cat, sets: [] };
  }
  const r = loadingFor(exId).totalInc;
  let sets = sch.accessory(block, wIdx, recordsFor(exId), r);
  if (mod) sets = applySetDelta(sets, mod.accSetDelta || 0);
  const focus = focusForAccessory(exId, sets);
  if (focus.removed) return { exId, name: exName(exId), sets: [], cat: slot.cat, isRemoved: true };
  if (focus.delta) sets = applySetDelta(sets, focus.delta);
  return { exId, name: exName(exId), sets, cat: slot.cat };
}

// ------------------------------------------------------------
// SESSION TIME ESTIMATE + MITIGATION (Steps 6-7)
// Predicts session length and, for a custom time cap, fits the session to it
// by compressing rest then pruning coherent accessories. A no-op when the
// athlete has no time cap, so default users are unaffected.
// ------------------------------------------------------------
function estimateSessionSec(resolved, tight) {
  const TM = TIME_MODEL;
  const rest = tight ? TM.restSecTight : TM.restSec;
  let t = TM.sessionOverheadSec;
  for (const rs of resolved) {
    const kind = rs.isMain ? 'main' : rs.isSecondary ? 'secondary' : 'accessory';
    for (const st of rs.sets) {
      t += (st.reps || 0) * TM.execSecPerRep[kind];   // execution
      t += rest[kind];                                 // rest after each set
    }
    if (kind === 'main' && loadingFor(rs.exId).showPlates) {
      const work = rs.sets.filter(s => s.weight);
      const top = work.length ? Math.max(...work.map(s => s.weight)) : 0;
      if (top) {
        const bar = loadingFor(rs.exId).barWeight || S.profile.barWeight;
        t += Engine.warmupSets(top, bar, S.profile.rounding).length * TM.warmupSecPerSet;
      }
    }
  }
  return t;
}
// Prune score: higher = trimmed first. Coherent (already trained by the day's
// main) + de-prioritized rank highest. Returns null for protected entries
// (a specialized muscle, slider >= 4, is never pruned).
function prunePriority(rs, mainMovs, tc) {
  const mov = (exById(rs.exId) || {}).movement;
  let cov = 0;
  for (const mm of mainMovs) { const c = (SYNERGIST_COVERAGE[mm] || {})[mov]; if (c > cov) cov = c; }
  let deprior = 0;
  if (tc && tc.track === 'bodybuilding' && tc.muscleFocus) {
    const key = MOVEMENT_SLIDER[mov];
    const v = key != null ? tc.muscleFocus[key] : null;
    if (v != null) { if (v >= 4) return null; deprior = (3 - v) / 3; }
  }
  return cov + deprior;
}
// Build a day's training entries with FOCUS applied (via resolveSlot) and then
// time mitigation. Returns { items:[{si, rs}], pruned:[names], estMin, capMin }.
// Used by the live session and the previews so they always agree.
function resolveDayEntries(di, bi, wi) {
  const p = P();
  let items = p.days[di].slots
    .map((slot, si) => ({ si, rs: resolveSlot(slot, bi, wi) }))
    .filter(x => !x.rs.isSelect && !x.rs.isRemoved && x.rs.sets.length);
  const tc = p.trainingConfig;
  const capMin = (tc && tc.timeMode === 'custom' && tc.timeCapMin) ? tc.timeCapMin : null;
  const pruned = [];
  let estSec = estimateSessionSec(items.map(x => x.rs), false);
  if (capMin && estSec > capMin * 60) {
    estSec = estimateSessionSec(items.map(x => x.rs), true); // step 1: compress rest
    if (estSec > capMin * 60) {
      const mains = items.filter(x => x.rs.isMain).map(x => (exById(x.rs.exId) || {}).movement);
      const cand = items
        .filter(x => !x.rs.isMain && !x.rs.isSecondary)
        .map(x => ({ x, score: prunePriority(x.rs, mains, tc) }))
        .filter(c => c.score !== null)
        .sort((a, b) => b.score - a.score);
      for (const c of cand) {                               // step 2: prune coherent accessories
        items = items.filter(x => x !== c.x);
        pruned.push(c.x.rs.name);
        estSec = estimateSessionSec(items.map(x => x.rs), true);
        if (estSec <= capMin * 60) break;
      }
    }
  }
  return { items, pruned, estMin: Math.round(estSec / 60), capMin };
}
// Heads-up banner in the workout view for athletes with a time cap.
function timeBannerHTML(di) {
  const p = P();
  const tc = p && p.trainingConfig;
  if (!tc || tc.timeMode !== 'custom' || !tc.timeCapMin) return '';
  const built = resolveDayEntries(di, p.pointer.block, p.pointer.week);
  if (built.pruned.length) {
    return `<div class="banner-warn mt8">Trimmed to fit your ${tc.timeCapMin} min limit: removed ${esc(built.pruned.join(', '))}. This day is now about ${built.estMin} min. Your main lifts and weights are kept.</div>`;
  }
  return `<div class="card mt8"><span class="faint">This day is about ${built.estMin} min, within your ${tc.timeCapMin} min limit.</span></div>`;
}

// ------------------------------------------------------------
// READINESS
// ------------------------------------------------------------
function decayedSkipPenalty() {
  if (!S.skipPenalty) return 0;
  const days = S.lastSkipTs ? (Date.now() - S.lastSkipTs) / 864e5 : 99;
  return Math.max(0, S.skipPenalty - days * 0.5);
}
function decayedOrderPenalty() {
  if (!S.orderPenalty) return 0;
  const days = S.lastOrderTs ? (Date.now() - S.lastOrderTs) / 864e5 : 99;
  return Math.max(0, S.orderPenalty - days * 0.3);
}
function lastSession() {
  return [...S.sessions].reverse().find(s => !s.skipped) || null;
}
function rpeDeviationOf(session) {
  if (!session) return null;
  let dev = 0, n = 0;
  for (const e of session.entries) for (const st of e.sets) {
    if (st.done && st.rpe && st.targetRpe) { dev += st.rpe - st.targetRpe; n++; }
  }
  return n ? dev / n : null;
}
function streakCount() {
  const cutoff = Date.now() - 7 * 864e5;
  return S.sessions.filter(s => !s.skipped && s.ts > cutoff).length;
}
function computeReadiness(extra) {
  const ci = extra || S.checkins[S.checkins.length - 1] || {};
  const sliders = ci.sliders ? Object.values(ci.sliders) : [];
  const ls = lastSession();
  return Engine.readinessScore({
    sleepHours: ci.sleepHours,
    sliderAvg: sliders.length ? sliders.reduce((a, b) => a + b, 0) / sliders.length : null,
    lastSessionRating: ls ? ls.rating : null,
    rpeDeviation: rpeDeviationOf(ls),
    streak: streakCount(),
    skipPenalty: decayedSkipPenalty() + decayedOrderPenalty(),
  });
}
function logReadiness(score) {
  S.readinessLog.push({ ts: Date.now(), score: Math.round(score * 100) / 100 });
  if (S.readinessLog.length > 120) S.readinessLog = S.readinessLog.slice(-120);
}

// ------------------------------------------------------------
// WEEKLY AUTOREGULATION (Change 2)
// A subjective end-of-week slider tunes the upcoming week, with the
// readiness trend acting only as a brake on optimistic picks. None of
// this ever writes the working max: it is a transient, single-use layer.
// ------------------------------------------------------------
const WEEK_FEEL_LEGEND = [
  'Training was too tough, greatly decrease difficulty.',
  'A bit much, ease it back.',
  'Felt good, proceed as planned.',
  'Felt strong, push me a little.',
  'Too easy, push me hard.',
];
function nextPointer(b, w) {
  let nb = b, nw = w + 1;
  if (nw >= P().weeksPerBlock) { nw = 0; nb = b + 1; }
  return { block: nb, week: nw };
}
// Count of PLAIN working sets a scheme normally prescribes for a slot kind,
// computed by calling the scheme so we never reach into its tables.
function plannedWorkingSets(block, wIdx, kind) {
  const sch = Engine.schemeFor(block);
  const sets = kind === 'main'
    ? sch.main(block, wIdx, 100, 2.5, 1)
    : sch.accessory(block, wIdx, [{ ts: Date.now(), weight: 100, reps: 5, rpe: 8 }], 2.5);
  return sets.filter(s => !s.amrap && !s.ramp && !s.calib).length;
}
// Readiness relative to the lifter's own recent baseline (not a fixed cutoff).
function readinessTrendingDown() {
  const log = S.readinessLog || [];
  if (log.length < 10) return false; // too little history: never brake (do not punish missing data)
  const now = Date.now(), day = 864e5;
  const wk = log.filter(r => r.ts >= now - 7 * day).map(r => r.score);
  const base = log.filter(r => r.ts < now - 8 * day && r.ts >= now - 28 * day).map(r => r.score);
  if (!wk.length || base.length < 3) return false;
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  return mean(wk) < mean(base) * 0.95; // small margin so it does not flap
}
function readinessContext() {
  const log = S.readinessLog || [];
  const now = Date.now(), day = 864e5;
  const wk = log.filter(r => r.ts >= now - 7 * day).map(r => r.score);
  const base = log.filter(r => r.ts < now - 8 * day && r.ts >= now - 28 * day).map(r => r.score);
  const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const r1 = n => (n == null ? null : Math.round(n * 10) / 10);
  const wkM = mean(wk);
  return {
    weekAvg: r1(wkM != null ? wkM : computeReadiness()),
    baseAvg: r1(mean(base)),
    hasBaseline: base.length >= 3 && log.length >= 10 && wkM != null,
  };
}
// Compute the transient modifier for the upcoming week from a slider value 1..5.
function computeWeekMod(value, upBi, upWi, curBi, curWi) {
  const FLOOR = 1, FLOOR_MAIN = 1;
  const accNext = plannedWorkingSets(blockOf(upBi), upWi, 'accessory');
  const accPrev = plannedWorkingSets(blockOf(curBi), curWi, 'accessory');
  const mainNext = plannedWorkingSets(blockOf(upBi), upWi, 'main');
  const mainPrev = plannedWorkingSets(blockOf(curBi), curWi, 'main');
  const down = readinessTrendingDown();

  // Governor (brake only): 4 trending down behaves like 3; 5 trending down keeps the
  // extra set but loses the weight push. It never adds load on its own.
  let setVal = value;
  if (value === 4 && down) setVal = 3;
  if (value === 5 && down) setVal = 4;
  let pctMod = 1.00;
  if (value === 1) pctMod = 0.95;
  else if (value === 5 && !down) pctMod = 1.05;

  let accFinal;
  if (setVal === 1) accFinal = Math.max(FLOOR, Math.min(accNext, accPrev) - 1);
  else if (setVal === 2) accFinal = Math.max(FLOOR, accNext - 1);
  else if (setVal === 3) accFinal = accNext;
  else accFinal = accNext + 1; // 4 or 5
  const accSetDelta = accFinal - accNext;

  // Mains only lose a set on the most severe pick.
  const mainFinal = setVal === 1 ? Math.max(FLOOR_MAIN, Math.min(mainNext, mainPrev) - 1) : mainNext;
  const mainSetDelta = mainFinal - mainNext;

  return { appliesToGlobalWeek: upBi * P().weeksPerBlock + upWi + 1, pctMod, accSetDelta, mainSetDelta };
}

// ------------------------------------------------------------
// RENDER DISPATCH
// ------------------------------------------------------------
function render() {
  const views = {
    onboarding: vOnboarding, dashboard: vDashboard, workout: vWorkout,
    checkin: vCheckin, session: vSession, history: vHistory, summary: vSummary,
    more: vMore, exercises: vExercises, program: vProgram, settings: vSettings,
  };
  $app.innerHTML = (views[V.view] || vDashboard)();
  bindRangeLabels();
}
function tabbar() {
  const t = (id, ic, label) => `
    <button class="${V.tab === id ? 'on' : ''}" onclick="setTab('${id}')">
      <span class="ic">${ic}</span>${label}</button>`;
  return `<nav class="tabbar">
    ${t('dashboard','▥','Dashboard')}${t('workout','🏋','Workout')}
    ${t('history','🗂','History')}${t('more','☰','More')}
  </nav>`;
}
function topbar(title) {
  return `<header class="topbar">
    ${title ? `<span class="page-title">${esc(title)}</span>` : `<span class="brand">IRON<b>WAVE</b></span>`}
  </header>`;
}

// ------------------------------------------------------------
// VIEW: ONBOARDING
// ------------------------------------------------------------
// Step indices. The muscle-focus step (5) is shown only for the bodybuilding
// track; obNext skips it otherwise, so other tracks keep the legacy-length flow.
const OB_TRACKS = [
  ['powerbuilding', 'Powerbuilding', 'Balanced size and strength. The original IRONWAVE mix: 3 hypertrophy blocks, 2 strength blocks.'],
  ['powerlifting',  'Powerlifting',  'Get as strong as possible. A hypertrophy base, then four book-wave strength blocks.'],
  ['bodybuilding',  'Bodybuilding',  'Size and appearance. All hypertrophy, with per-muscle focus sliders you set next.'],
];
const OB_EXP = [
  ['beginner', 'Beginner', 'Under a year of serious training. Starts your volume lower.'],
  ['intermediate', 'Intermediate', '1 to 3 years. The standard starting point.'],
  ['advanced', 'Advanced', '3+ years. Starts your volume near the top of the range.'],
];
const FOCUS_KEYS = ['arms', 'chest', 'back', 'shoulders', 'glutes', 'legs', 'calves'];
const FOCUS_LABELS = { arms: 'Arms', chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
                       glutes: 'Glutes', legs: 'Legs', calves: 'Calves' };

function obDefaults() {
  return { name: '', bodyweight: '', daysPerWeek: 4, track: 'powerbuilding',
           experience: 'intermediate', timeMode: 'unlimited', timeCapMin: '',
           muscleFocus: { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 },
           maxes: {} };
}
// Warning copy for any slider at the extremes (0 = removed, 6 = maxed).
function obFocusWarning(focus) {
  const removed = FOCUS_KEYS.filter(k => focus[k] === 0).map(k => FOCUS_LABELS[k]);
  const maxed = FOCUS_KEYS.filter(k => focus[k] === 6).map(k => FOCUS_LABELS[k]);
  if (!removed.length && !maxed.length) return '';
  const parts = [];
  if (removed.length) parts.push(`Removing ${removed.join(', ')} means no direct work there. Over a block you lose size and strength there, and big imbalances can stress your joints. Fine for an injury or a deliberate choice.`);
  if (maxed.length) parts.push(`Maxing ${maxed.join(', ')} is a large jump in volume, which raises injury and overuse risk. Ease into it.`);
  parts.push('Run a focus like this for about one block, 2 months at most, then rebalance.');
  return `<div class="banner-warn mt8">${parts.join(' ')}</div>`;
}
// Informative only: median training-day length for the current focus. Builds a
// throwaway bodybuilding program from the onboarding answers and times each day
// (rest + execution + warmup + overhead). Computed with calibration-level loads
// since maxes come on the next step; touches nothing persistent.
function estimateFocusMedianMin(ob) {
  if (typeof estimateSessionSec !== 'function') return null;
  const savedProg = S.program, savedLm = S.profile.landmarks;
  try {
    if (!savedLm || !Object.keys(savedLm).length) S.profile.landmarks = Engine.seedLandmarks(ob.experience || 'intermediate');
    const tmp = makeProgram(Object.assign({}, ob, { track: 'bodybuilding', maxes: ob.maxes || {} }));
    // Give mains a nominal working max so the estimate reflects a real working
    // session (weighted sets + warmup), not the week-1 calibration ramp.
    for (const l of ['comp-squat', 'comp-bench', 'comp-deadlift', 'military-press']) {
      if (!tmp.wm[l]) tmp.wm[l] = 100;
    }
    S.program = tmp;
    const wk = 1; // a representative build week
    const mins = tmp.days.map((d, di) => {
      const entries = d.slots.map(sl => resolveSlot(sl, 0, wk)).filter(rs => !rs.isSelect && !rs.isRemoved && rs.sets.length);
      return entries.length ? Math.round(estimateSessionSec(entries, false) / 60) : 0;
    }).filter(m => m > 0).sort((a, b) => a - b);
    if (!mins.length) return null;
    return mins[Math.floor((mins.length - 1) / 2)];
  } catch (e) {
    return null;
  } finally {
    S.program = savedProg; S.profile.landmarks = savedLm;
  }
}
function focusTimeLine(ob) {
  const m = estimateFocusMedianMin(ob);
  if (!m) return '';
  const cap = (ob.timeMode === 'custom' && ob.timeCapMin) ? parseInt(ob.timeCapMin) : null;
  if (cap) {
    return m > cap
      ? `Estimated median session about ${m} min, over your ${cap} min limit. Longer days will be trimmed to fit.`
      : `Estimated median session about ${m} min, within your ${cap} min limit.`;
  }
  return `Estimated median session about ${m} min (rest and execution included).`;
}

function vOnboarding() {
  if (!V.ob) V.ob = obDefaults();
  const ob = V.ob;
  const step = V.obStep;
  let body = '';

  if (step === 0) {
    body = `
      <div class="ob-title">Welcome to<br>IRON<span style="color:var(--blue)">WAVE</span></div>
      <p class="subtle">Auto-regulating training built on the Juggernaut Method 2.0 wave system.
      A few quick questions and we build your program.</p>
      <div class="field"><label>Your name</label>
        <input id="ob-name" value="${esc(ob.name)}" placeholder="Lifter name"></div>
      <div class="field"><label>Bodyweight (kg)</label>
        <input id="ob-bw" type="number" inputmode="decimal" value="${esc(ob.bodyweight)}" placeholder="100"></div>
      <button class="btn btn-green mt16" onclick="obNext(0)">Continue</button>`;
  } else if (step === 1) {
    body = `
      <div class="ob-title">Training days</div>
      <p class="subtle">How many days per week will you train? The program manages weekly fatigue around this.</p>
      <div class="seg mt16">
        ${[3,4,5,6].map(n => `<button class="${ob.daysPerWeek===n?'on':''}" onclick="obDays(${n})">${n}</button>`).join('')}
      </div>
      <p class="faint mt16">${{3:'Full-body emphasis. Squat / Bench / Deadlift+Press days.',
        4:'Classic split: Bench, Squat, Press, Deadlift.',
        5:'Classic split plus a volume bench/pump day.',
        6:'Classic split plus a secondary bench day and a secondary deadlift/squat volume day.'}[ob.daysPerWeek]}</p>
      <button class="btn btn-green mt24" onclick="obNext(1)">Continue</button>`;
  } else if (step === 2) {
    body = `
      <div class="ob-title">Primary goal</div>
      <p class="subtle">This sets how your blocks are periodized. You can start a fresh program later if your goal changes.</p>
      ${OB_TRACKS.map(([id, label, desc]) => `
        <button class="pick-card ${ob.track===id?'on':''}" onclick="obTrack('${id}')">
          <b>${label}</b><span class="faint">${desc}</span></button>`).join('')}
      <button class="btn btn-green mt16" onclick="obNext(2)">Continue</button>`;
  } else if (step === 3) {
    body = `
      <div class="ob-title">Experience</div>
      <p class="subtle">How long have you trained seriously? This only seeds your starting volume. It adjusts to your logged performance from there.</p>
      ${OB_EXP.map(([id, label, desc]) => `
        <button class="pick-card ${ob.experience===id?'on':''}" onclick="obExp('${id}')">
          <b>${label}</b><span class="faint">${desc}</span></button>`).join('')}
      <button class="btn btn-green mt16" onclick="obNext(3)">Continue</button>`;
  } else if (step === 4) {
    body = `
      <div class="ob-title">Time per session</div>
      <p class="subtle">If you set a cap, the app keeps each session inside it as volume climbs, by trimming rest and pruning accessories your main lift already covers. Your main lifts and weights are never cut.</p>
      <div class="seg mt16">
        <button class="${ob.timeMode==='unlimited'?'on':''}" onclick="obTimeMode('unlimited')">As much as necessary</button>
        <button class="${ob.timeMode==='custom'?'on':''}" onclick="obTimeMode('custom')">Enter time</button>
      </div>
      ${ob.timeMode==='custom' ? `<div class="field mt16"><label>Minutes per session</label>
        <input id="ob-time" type="number" inputmode="numeric" value="${esc(ob.timeCapMin)}" placeholder="60"></div>` : ''}
      <button class="btn btn-green mt24" onclick="obNext(4)">Continue</button>`;
  } else if (step === 5) {
    body = `
      <div class="ob-title">Muscle focus</div>
      <p class="subtle">Pull what you want to grow toward 6, and what you care less about toward 0. 3 is balanced. 0 removes that muscle's direct work.</p>
      ${FOCUS_KEYS.map(k => `
        <div class="focus-row">
          <div class="row"><span>${FOCUS_LABELS[k]}</span><b id="mf-val-${k}">${ob.muscleFocus[k]}</b></div>
          <input type="range" min="0" max="6" step="1" value="${ob.muscleFocus[k]}" oninput="obSlider('${k}', this.value)">
        </div>`).join('')}
      <div id="mf-warn">${obFocusWarning(ob.muscleFocus)}</div>
      <div id="mf-time" class="focus-time">${focusTimeLine(ob)}</div>
      <button class="btn btn-green mt16" onclick="obNext(5)">Continue</button>`;
  } else if (step === 6) {
    const lifts = [['comp-squat','Comp Squat'],['comp-bench','Comp Bench'],['comp-deadlift','Comp Deadlift'],['military-press','Military Press']];
    body = `
      <div class="ob-title">Your maxes</div>
      <p class="subtle">Enter a recent, real 1RM for each main lift. The working max is set to 90% of it, and being conservative here is how you progress for months. Leave blank to calibrate in week 1 with ramping RPE sets.</p>
      ${lifts.map(([id,label]) => `
        <div class="field"><label>${label} · 1RM (kg)</label>
          <input id="ob-max-${id}" type="number" inputmode="decimal"
            value="${ob.maxes[id] ?? ''}" placeholder="Calibrate in week 1"></div>`).join('')}
      <button class="btn btn-green mt16" onclick="obNext(6)">Create my program</button>`;
  }
  return `${topbar()}<div class="view">${body}</div>`;
}
function obDays(n) { V.ob.daysPerWeek = n; render(); }
function obTrack(id) { V.ob.track = id; render(); }
function obExp(id) { V.ob.experience = id; render(); }
function obTimeMode(mode) { V.ob.timeMode = mode; render(); }
// Update slider value + warning live, without a full re-render (keeps the drag smooth).
function obSlider(k, v) {
  V.ob.muscleFocus[k] = parseInt(v);
  const el = byId('mf-val-' + k); if (el) el.textContent = v;
  const wn = byId('mf-warn'); if (wn) wn.innerHTML = obFocusWarning(V.ob.muscleFocus);
  const tl = byId('mf-time'); if (tl) tl.textContent = focusTimeLine(V.ob);
}
function obNext(step) {
  const ob = V.ob;
  if (step === 0) {
    ob.name = document.getElementById('ob-name').value.trim();
    ob.bodyweight = parseFloat(document.getElementById('ob-bw').value) || null;
    V.obStep = 1;
  } else if (step === 1) {
    V.obStep = 2;
  } else if (step === 2) {
    V.obStep = 3;
  } else if (step === 3) {
    V.obStep = 4;
  } else if (step === 4) {
    if (ob.timeMode === 'custom') {
      const el = document.getElementById('ob-time');
      ob.timeCapMin = el ? (parseInt(el.value) || '') : '';
    }
    // Skip the muscle-focus step unless this is the bodybuilding track.
    V.obStep = ob.track === 'bodybuilding' ? 5 : 6;
  } else if (step === 5) {
    V.obStep = 6;
  } else if (step === 6) {
    try {
      for (const id of ['comp-squat','comp-bench','comp-deadlift','military-press']) {
        const el = document.getElementById('ob-max-' + id);
        const v = el ? parseFloat(el.value) : NaN;
        if (v > 0) ob.maxes[id] = v;
      }
      S.profile.name = ob.name;
      S.profile.bodyweight = ob.bodyweight;
      S.profile.experience = ob.experience;
      S.profile.training = {
        track: ob.track,
        timeMode: ob.timeMode,
        timeCapMin: ob.timeMode === 'custom' ? (parseInt(ob.timeCapMin) || null) : null,
        muscleFocus: Object.assign({ arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 }, ob.muscleFocus),
      };
      S.profile.trainingAge = { startedTs: Date.now(), blocksCompleted: 0 };
      if (!S.profile.landmarks || !Object.keys(S.profile.landmarks).length) {
        S.profile.landmarks = Engine.seedLandmarks(ob.experience);
      }
      S.program = makeProgram(ob);
      logReadiness(computeReadiness());
      save().then(() => {
        V.tab = 'dashboard';
        toast('Program created, ' + P().blocks.length * P().weeksPerBlock + ' weeks to test day');
        nav('dashboard');
      }).catch(() => {
        toast('Failed to save program', true);
      });
    } catch (e) {
      console.error('create program failed', e);
      toast('Could not create program: ' + (e && e.message || e), true);
    }
    return;
  }
  render();
}

// ------------------------------------------------------------
// VIEW: DASHBOARD
// ------------------------------------------------------------
const BLOCK_COLORS = { hypertrophy: '#5aa2f7', strength: '#e8883a', peaking: '#e2483d', bridge: '#2d9d8f' };

function sparklineHTML() {
  const log = S.readinessLog.slice(-30);
  if (log.length < 2) return '<div class="faint">Readiness builds as you check in and train.</div>';
  const W = 300, H = 60, pad = 6;
  const x = i => pad + i * (W - 2 * pad) / (log.length - 1);
  const y = s => H - pad - (s / 30) * (H - 2 * pad);
  const pts = log.map((r, i) => [x(i), y(r.score)]);
  return `<svg class="spark-line" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <polyline points="${pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}"
      fill="none" stroke="#4b8df8" stroke-width="1.4" stroke-dasharray="2 5" stroke-linecap="round"/>
    ${pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6" fill="#67a3ff"/>`).join('')}
  </svg>`;
}
// Tentative weekly volume index — routed through the block's scheme
function weekVolume(block, w) {
  return Engine.schemeFor(block).weekVolume(block, w);
}
function weekLabelFor(block, w) {
  const sch = Engine.schemeFor(block);
  return sch.weekLabel ? sch.weekLabel(w) : Engine.weekTypeLabel(w);
}
function timelineHTML() {
  const p = P();
  let maxV = 1;
  p.blocks.forEach(b => { for (let w = 0; w < p.weeksPerBlock; w++) maxV = Math.max(maxV, weekVolume(b, w)); });
  const bars = [];
  p.blocks.forEach((b, bi) => {
    for (let w = 0; w < p.weeksPerBlock; w++) {
      const passed = bi < p.pointer.block || (bi === p.pointer.block && w < p.pointer.week);
      const cur = bi === p.pointer.block && w === p.pointer.week;
      const h = Math.max(10, weekVolume(b, w) / maxV * 100);
      bars.push(`<i class="${passed ? 'done' : ''}${cur ? ' current' : ''}"
        onclick="openWeekPreview(${bi},${w})"
        style="height:${h.toFixed(0)}%;background:${BLOCK_COLORS[b.type]}"></i>`);
    }
  });
  return `<div class="timeline">${bars.join('')}</div>
    <div class="legend">
      <span><i style="background:${BLOCK_COLORS.hypertrophy}"></i>Hypertrophy</span>
      <span><i style="background:${BLOCK_COLORS.strength}"></i>Strength</span>
      <span class="faint">tap a week to preview</span>
    </div>`;
}
function openWeekPreview(bi, wi) {
  const p = P();
  const b = p.blocks[bi];
  showModal(anim => {
    const days = p.days.map(d => {
      const rows = d.slots.map(slot => {
        const rs = resolveSlot(slot, bi, wi);
        if (rs.isRemoved) return ''; // dropped by muscle focus (slider 0)
        if (rs.isSelect) return `<div class="row" style="padding:6px 0">
          <span class="subtle">Select ${MOVEMENTS[rs.cat].label}</span><span class="faint">—</span></div>`;
        const work = rs.sets.filter(s => !s.ramp);
        const f = work[0] || rs.sets[0];
        const am = rs.sets.some(s => s.amrap);
        // A lift with no anchor (main without a working max, accessory without a
        // logged e1RM) returns a flat calibration ramp on every week. Showing its
        // bare reps/RPE looks identical week to week and reads as broken, so we
        // surface the calibration state instead, with a tappable explainer.
        const uncalibrated = rs.sets.length > 0 && rs.sets.every(s => s.calib);
        let right;
        if (uncalibrated) {
          right = `<span class="subtle calib-tag">Waiting for calibration <button class="info-dot" onclick="event.stopPropagation();openCalibrationInfo()" aria-label="What is calibration?">ⓘ</button></span>`;
        } else {
          const scheme = f ? `${(work.length || rs.sets.length)}×${f.reps}${f.weight != null ? ' @ ' + kg(f.weight) + 'kg' : (f.rpe ? ' @ RPE ' + f.rpe : '')}` : '';
          right = `<span class="subtle">${scheme}</span>`;
        }
        return `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)">
          <span>${esc(rs.name)}${am ? ' <b style="color:var(--red)">AMRAP</b>' : ''}</span>
          ${right}</div>`;
      }).join('');
      return `<div class="card"><b>${esc(d.name)}</b>${rows}</div>`;
    }).join('');
    $modal.innerHTML = modalShell(anim, `${esc(b.label)} · Week ${bi * p.weeksPerBlock + wi + 1}`,
      `<p class="subtle" style="margin-bottom:10px">${weekLabelFor(b, wi)} · projected with current working maxes</p>${days}`);
  });
}

// Explainer for the "Waiting for calibration" state. Stacks over the preview,
// closes back to it. Plain language for the athlete, no jargon dumps.
function openCalibrationInfo() {
  showModal(anim => {
    $modal.innerHTML = modalShell(anim, 'Waiting for calibration', `
      <div class="card">
        <p>This lift does not have a reference number yet, so the app cannot
        prescribe exact weights or a target RPE for it. Until it does, you will
        see "Waiting for calibration" instead of a set and weight scheme.</p>

        <p class="mt16"><b>What calibration is.</b> The app builds every working
        weight from an anchor. For your main lifts that anchor is the working
        max, set to 90 percent of the 1RM you enter. For accessories the anchor
        is your first logged set, since you do not enter a max for those.</p>

        <p class="mt16"><b>How to calibrate it.</b> Train the lift in week 1 and
        log what you actually did. The week 1 plan gives you a short ramp of
        easy to moderate sets (around RPE 6 to 8) so you can find a weight that
        feels right without grinding. Log those sets and the app reads your
        effort to set the anchor.</p>

        <p class="mt16"><b>What happens next.</b> Once the anchor exists, this
        lift starts showing real weights and a target RPE that climbs week to
        week, peaking in the realization week, exactly like your calibrated
        lifts already do. You only calibrate a lift once. After that the app
        carries it forward and adjusts it from your logged performance.</p>

        <p class="mt16 faint">Tip: be honest and a little conservative in week 1.
        A slightly light anchor still climbs fast over the block, while an
        inflated one makes the later weeks harder than they should be.</p>
      </div>
      <button class="btn btn-blue" onclick="closeModal()">Got it</button>`);
  });
}
function vDashboard() {
  if (!P()) return vOnboarding();
  const readiness = computeReadiness();
  const p = P();
  const done = programDone();
  let weekSection = '';
  if (done) {
    weekSection = `<div class="card accent">
      <h3 style="font-size:1.3rem;margin-bottom:6px">Program complete 🏆</h3>
      <p class="subtle">Every block is in the books. Rest up, then test your maxes, or start the next cycle.</p>
      <button class="btn btn-blue mt16" onclick="confirmNewProgram()">Plan next cycle</button>
    </div>`;
  } else {
    const block = curBlock();
    const w = weekIdx();
    const dayRows = p.days.map((d, i) => {
      const k = dayKey(p.pointer.block, w, i);
      const st = p.completedDays[k];
      const cls = st ? 'done' : '';
      const mark = st === 'skipped' ? '⤼' : st ? '✓' : '○';
      return `<button class="day-row ${cls}" onclick="openDay(${i})">
        <span class="mark">${mark}</span> ${esc(d.name)} <span class="chev">›</span></button>`;
    }).join('');
    const allDone = p.days.every((d, i) => p.completedDays[dayKey(p.pointer.block, w, i)]);
    weekSection = `
      <div class="mt16">
        <div style="color:${BLOCK_COLORS[block.type]};font-weight:600">${esc(block.label)} · ${block.wave} wave</div>
        <div style="font-size:1.7rem;font-weight:800">Week ${globalWeekNum()}</div>
        <div class="subtle">${weekLabelFor(block, w)}</div>
      </div>
      ${dayRows}
      <button class="btn ${allDone ? 'btn-blue' : 'btn-outline'} mt16" onclick="completeWeek(${allDone})">Complete Week</button>`;
  }
  return `${topbar()}
  <div class="view">
    <div class="readiness-hero">
      <div class="row">
        <span class="label">Readiness <span class="faint">ⓘ 0–30</span></span>
        <span class="score-sm">${readiness.toFixed(2)}</span>
      </div>
      ${sparklineHTML()}
    </div>
    <div class="section-title mt24">My Program</div>
    <div style="font-size:2rem;font-weight:800">${daysOut()} Days Out</div>
    <div class="subtle">${fmtDateLong(p.testDate)}</div>
    ${timelineHTML()}
    ${weekSection}
  </div>${tabbar()}`;
}
function openDay(i) {
  const p = P();
  V.dayIdx = i; V.tab = 'workout';
  // Change 3: a completed (non-skipped) day opens its summary, not a fresh session.
  const st = p.completedDays[dayKey(p.pointer.block, p.pointer.week, i)];
  if (st && st !== 'skipped') { V.summaryId = st; nav('summary'); return; }
  nav('workout');
}
function completeWeek(allDone) {
  if (!allDone) {
    confirmModal({
      title: 'Complete week?',
      message: 'Not every day is logged. You can complete the week anyway and move on.',
      confirmLabel: 'Complete week',
    }, doCompleteWeek);
    return;
  }
  doCompleteWeek();
}
function doCompleteWeek() {
  const p = P();
  const up = nextPointer(p.pointer.block, p.pointer.week);
  // Change 2: only autoregulate into a genuine work week (accumulation / intensification / realization).
  if (up.block < p.blocks.length) {
    const t = Engine.weekType(up.week);
    if (t === 'accumulation' || t === 'intensification' || t === 'realization') { openWeekFeel(up); return; }
  }
  p.weekMod = null; // calibration or deload week ahead, or program finishing: no modifier
  advanceWeek();
}
function advanceWeek() {
  const p = P();
  const finishedBlock = p.pointer.block;
  p.pointer.week++;
  if (p.pointer.week >= p.weeksPerBlock) {
    // Block just completed: evolve the athlete's volume landmarks from how the
    // block actually went (Step 5). This grows MV/MEV/MRV as the lifter ages up.
    recalibrateLandmarks(finishedBlock);
    p.pointer.week = 0;
    p.pointer.block++;
    if (p.pointer.block < p.blocks.length) {
      // Clear block-scoped accessory selections so the user picks fresh each block.
      for (const day of p.days) {
        day.slots = day.slots.filter(sl => !sl.added);
        for (const sl of day.slots) {
          if (sl.type === 'main' || sl.type === 'secondary') continue;
          delete sl.ex;
          if (!sl.def) sl.type = 'select';
        }
      }
      toast(`New block: ${p.blocks[p.pointer.block].label}`);
    }
  }
  V.dayIdx = null;
  save(); render();
}
// ------------------------------------------------------------
// LANDMARK EVOLUTION (Step 5)
// Once per completed accumulation block, nudge the athlete's per-muscle volume
// landmarks from the same signals RP uses: did logged effort stay on target
// (tolerated, room to grow) or run hot (overreached)? Reuses readiness trend.
// Changes are capped at +/-1 set per muscle per block and clamped, because the
// book pins injury risk on rapid volume jumps. Only feeds the bodybuilding
// FOCUS endpoints, so other tracks see no routine change from this.
// ------------------------------------------------------------
function bumpTrainingAge() {
  if (!S.profile.trainingAge) S.profile.trainingAge = { startedTs: Date.now(), blocksCompleted: 0 };
  S.profile.trainingAge.blocksCompleted++;
}
function recalibrateLandmarks(blockIdx) {
  const lm = S.profile.landmarks;
  if (!lm) { bumpTrainingAge(); return; }
  const sessions = S.sessions.filter(s => !s.skipped && s.b === blockIdx && s.entries && s.entries.length);
  if (!sessions.length) { bumpTrainingAge(); return; }
  const down = readinessTrendingDown();
  // Mean (actual - target) RPE per movement over real working sets logged this block.
  const agg = {};
  for (const s of sessions) for (const e of s.entries) {
    const mv = (exById(e.exId) || {}).movement;
    if (!mv || !lm[mv]) continue;
    for (const st of e.sets) {
      if (st.done && st.rpe && st.targetRpe && !st.amrap && !st.calib && !st.ramp) {
        (agg[mv] = agg[mv] || { sum: 0, n: 0 });
        agg[mv].sum += st.rpe - st.targetRpe; agg[mv].n++;
      }
    }
  }
  for (const mv in agg) {
    if (agg[mv].n < 3) continue;                       // not enough signal to move a landmark
    const delta = agg[mv].sum / agg[mv].n;             // <0 easier than target, >0 harder
    const L = lm[mv];
    const seed = VOLUME_LANDMARKS[mv] || L;
    const ceil = Math.round(seed.mrv * 1.4);           // do not let it run away
    if (delta <= 0.5 && !down) {                        // tolerated: room to grow
      L.mrv = Math.min(ceil, L.mrv + 1);
      if (L.mrv - L.mev > 12) L.mev = L.mev + 1;        // let the productive window follow up slowly
    } else if (delta >= 1.0 || down) {                  // overreached: back off
      L.mrv = Math.max(L.mev + 1, L.mrv - 1);
    }
  }
  bumpTrainingAge();
}
// --- end-of-week feel slider (Change 2) ---
let WF = 3;
function openWeekFeel(up) { WF = 3; V.wfUp = up; showModal(renderWeekFeel); }
function renderWeekFeel(anim) {
  const up = V.wfUp;
  const upBlock = blockOf(up.block);
  const ctx = readinessContext();
  const ctxLine = ctx.hasBaseline
    ? `This week averaged ${ctx.weekAvg}, your recent baseline is ${ctx.baseAvg}.`
    : `Your recent readiness average is ${ctx.weekAvg}. A baseline builds with a few more weeks of check-ins.`;
  $modal.innerHTML = modalShell(anim, 'Complete Week', `
        <div class="slider-card">
          <div class="q">Tell us how this block week felt</div>
          <div class="feeling" style="font-size:2.2rem;font-weight:800" id="wf-val">${WF}</div>
          <p class="faint" id="wf-desc" style="min-height:34px;margin-bottom:6px">${WEEK_FEEL_LEGEND[WF - 1]}</p>
          <input type="range" min="1" max="5" step="1" value="${WF}" oninput="wfSet(this.value)">
          <div class="range-labels"><span>1 · TOO TOUGH</span><span>3 · AS PLANNED</span><span>5 · TOO EASY</span></div>
        </div>
        <div class="card"><span class="faint">Readiness context</span>
          <div class="subtle mt8">${ctxLine}</div>
          <p class="faint mt8">Next up: ${esc(upBlock.label)}, ${weekLabelFor(upBlock, up.week)}. Your answer tunes that week only and never changes your working max.</p></div>
        <button class="btn btn-green" onclick="confirmWeekFeel()">Set next week and advance</button>
        <button class="btn btn-outline mt8" onclick="closeModal()">Cancel</button>`, 'closeModal()');
}
function wfSet(v) {
  WF = parseInt(v);
  byId('wf-val').textContent = WF;
  byId('wf-desc').textContent = WEEK_FEEL_LEGEND[WF - 1];
}
function confirmWeekFeel() {
  const up = V.wfUp, p = P();
  p.weekMod = computeWeekMod(WF, up.block, up.week, p.pointer.block, p.pointer.week);
  closeAllModals();
  advanceWeek();
}

// ------------------------------------------------------------
// VIEW: WORKOUT (day preview)
// ------------------------------------------------------------
function currentDayIdx() {
  if (V.dayIdx != null) return V.dayIdx;
  const p = P();
  for (let i = 0; i < p.days.length; i++) {
    if (!p.completedDays[dayKey(p.pointer.block, p.pointer.week, i)]) return i;
  }
  return 0;
}
function vWorkout() {
  if (!P()) return vOnboarding();
  if (programDone()) return `${topbar('Workout')}<div class="view">
    <div class="card accent mt16"><b>Program complete.</b><p class="subtle mt8">Plan your next cycle from the dashboard.</p></div></div>${tabbar()}`;
  const p = P();
  const di = currentDayIdx();
  const day = p.days[di];
  const block = curBlock();
  const w = weekIdx();
  const k = dayKey(p.pointer.block, w, di);
  const doneState = p.completedDays[k];
  const locked = doneState && doneState !== 'skipped'; // Change 3
  // Empty-day safety net: only reachable if the athlete zeroed essentially every
  // muscle (refill cannot find anything to train). Guide them instead of starting
  // an empty session.
  const emptyDay = !locked && resolveDayEntries(di, p.pointer.block, w).items.length === 0;

  const cards = day.slots.map((slot, si) => {
    const rs = resolveSlot(slot, p.pointer.block, w);
    const grip = `<span class="grip" onpointerdown="gripDown(event,${di},${si})">⠿</span>`;
    if (rs.isRemoved) {
      // Dropped by muscle focus (slider 0). Shown muted so it is not a mystery.
      return `<div class="ex-card" data-si="${si}" style="opacity:.5">
        ${grip}<span class="name">${esc(rs.name)}</span>
        <span class="faint" style="font-size:.78rem">${esc(rs.removedReason || 'removed by focus')}</span></div>`;
    }
    if (rs.isSelect) {
      return `<div class="ex-card" data-si="${si}">
        ${grip}
        <button class="name select" onclick="openSwap(${di},${si})">Select ${MOVEMENTS[rs.cat].label} Exercise ⚙</button>
      </div>`;
    }
    return `<div class="ex-card" data-si="${si}">
      ${grip}
      <span class="name">${esc(rs.name)}</span>
      <span class="actions">
        <button class="icon-btn" onclick="openExDetail('${rs.exId}')"><span class="ic">ⓘ</span>Info</button>
        <button class="icon-btn" onclick="openSwap(${di},${si})"><span class="ic">⇄</span>Swap</button>
      </span>
    </div>`;
  }).join('');

  return `${topbar('Workout')}
  <div class="view">
    <div class="mt8">
      <div style="color:${BLOCK_COLORS[block.type]};font-weight:600">${esc(block.label)}</div>
      <div style="font-size:1.4rem;font-weight:700">Week ${globalWeekNum()}</div>
      <div class="row">
        <div style="font-size:2.4rem;font-weight:800">Day ${di + 1}</div>
        <div>
          <button class="day-nav" onclick="prevDay()">‹</button>
          <button class="day-nav" onclick="nextDay()">›</button>
        </div>
      </div>
      <div class="subtle">${weekLabelFor(block, w)}${doneState ? ' · ' + (doneState === 'skipped' ? 'Skipped' : 'Completed ✓') : ''}</div>
    </div>
    ${timeBannerHTML(di)}
    ${locked ? `
    <div class="card accent mt16"><b>Day complete ✓</b>
      <p class="subtle mt8">You logged this day. Open the summary to review your sets, or use the arrows to move to another day.</p>
      <button class="btn btn-blue mt8" onclick="openSummaryFor('${doneState}')">View summary</button>
      <button class="btn btn-outline mt8" onclick="redoDay(${di})">Redo day</button>
    </div>` : emptyDay ? `
    <div class="card accent mt16"><b>No exercises for this day</b>
      <p class="subtle mt8">Your muscle focus removed everything scheduled here. Add an exercise below, or start a new program and keep at least one muscle group above 0.</p>
      <button class="btn btn-outline mt8" onclick="openAddExercise(${di})">＋ Add an exercise</button>
    </div>` : `
    <button class="btn btn-green mt16" onclick="startCheckin(${di})">Start Training →</button>
    <div class="btn-row">
      <button class="btn btn-outline" onclick="skipWorkout(${di})">Skip Workout</button>
      <button class="btn btn-outline" onclick="openPreview(${di})">Preview Workout</button>
    </div>`}
    <div class="section-title">Overview <span class="faint">hold ⠿ to reorder</span></div>
    <div id="ex-list">${cards}</div>
    <button class="btn btn-outline" style="border-radius:24px" onclick="openAddExercise(${di})">＋ Add Exercise</button>
  </div>${tabbar()}`;
}
function prevDay() { V.dayIdx = Math.max(0, currentDayIdx() - 1); render(); }
function nextDay() { V.dayIdx = Math.min(P().days.length - 1, currentDayIdx() + 1); render(); }

// --- drag-to-reorder exercises (hold the ⠿ grip) ---
let DRAG = null;
function gripDown(ev, di, si) {
  ev.preventDefault();
  const card = ev.target.closest('.ex-card');
  const list = byId('ex-list');
  if (!card || !list) return;
  DRAG = { di, card, list, moved: false };
  card.classList.add('dragging');
  document.addEventListener('pointermove', gripMove);
  document.addEventListener('pointerup', gripUp, { once: true });
  document.addEventListener('pointercancel', gripUp, { once: true });
}
function gripMove(ev) {
  if (!DRAG) return;
  ev.preventDefault();
  DRAG.moved = true;
  const { card, list } = DRAG;
  const y = ev.clientY;
  const others = [...list.children].filter(c => c !== card);
  let placed = false;
  for (const c of others) {
    const r = c.getBoundingClientRect();
    if (y < r.top + r.height / 2) { list.insertBefore(card, c); placed = true; break; }
  }
  if (!placed) list.appendChild(card);
}
function gripUp() {
  document.removeEventListener('pointermove', gripMove);
  if (!DRAG) return;
  const { di, card, list, moved } = DRAG;
  card.classList.remove('dragging');
  const order = [...list.children].map(c => +c.dataset.si);
  DRAG = null;
  if (!moved || order.every((si, i) => si === i)) return;
  commitReorder(di, order);
}
function commitReorder(di, order) {
  const slots = P().days[di].slots;
  P().days[di].slots = order.map(i => slots[i]);
  // Reshuffling the planned order costs a little readiness (fatigue-management drift)
  S.orderPenalty = Math.min(2, decayedOrderPenalty() + 0.3);
  S.lastOrderTs = Date.now();
  logReadiness(computeReadiness());
  save(); render();
  toast('Order updated. Small readiness hit for the shuffle', true);
}

function skipWorkout(di) {
  confirmModal({
    title: 'Skip this workout?',
    message: 'Skipping lowers your readiness, and the penalty decays over the next few days.',
    confirmLabel: 'Skip workout',
    danger: true,
  }, () => doSkipWorkout(di));
}
function doSkipWorkout(di) {
  const p = P();
  p.completedDays[dayKey(p.pointer.block, p.pointer.week, di)] = 'skipped';
  S.skipPenalty = Math.min(6, decayedSkipPenalty() + 2);
  S.lastSkipTs = Date.now();
  S.sessions.push({ id: 's' + Date.now(), ts: Date.now(), b: p.pointer.block, w: p.pointer.week, d: di,
                    entries: [], skipped: true, tonnage: 0 });
  logReadiness(computeReadiness());
  save();
  toast('Workout skipped. Readiness lowered', true);
  V.dayIdx = null;
  render();
}

// ------------------------------------------------------------
// CHECK-IN FLOW (4 steps)
// ------------------------------------------------------------
function checkinGroupsForDay(day) {
  const groups = new Map();
  for (const slot of day.slots) {
    const mv = slot.type === 'main' || slot.type === 'secondary'
      ? exById(slot.lift)?.movement : slot.cat;
    if (['bench','chest','tricep'].includes(mv)) groups.set('bench', CHECKIN_GROUPS.bench);
    else if (['press','shoulder'].includes(mv)) groups.set('press', CHECKIN_GROUPS.press);
    else if (['squat','quad','calf'].includes(mv)) groups.set('squat', CHECKIN_GROUPS.squat);
    else if (['deadlift','ham','glute'].includes(mv)) groups.set('deadlift', CHECKIN_GROUPS.deadlift);
    else if (['vpull','hpull','upperback','bicep'].includes(mv)) groups.set('upperpull', CHECKIN_GROUPS.upperpull);
    else if (['lowback'].includes(mv)) groups.set('lowback', CHECKIN_GROUPS.lowback);
  }
  if (groups.has('squat') || groups.has('deadlift')) groups.set('lowback', CHECKIN_GROUPS.lowback);
  return [...groups.values()];
}
const FEEL_WORDS = ['low', 'tired', 'normal', 'great', 'extra'];

function startCheckin(di) {
  const day = P().days[di];
  V.checkinData = { di, sleepHours: 7.5, sliders: {}, mindset: '', injuries: [],
                    groups: checkinGroupsForDay(day) };
  for (const g of V.checkinData.groups) V.checkinData.sliders[g.key] = 3;
  V.checkinStep = 0;
  nav('checkin');
}
function vCheckin() {
  const cd = V.checkinData;
  const block = curBlock();
  const totalSteps = 2 + cd.groups.length;
  const step = V.checkinStep;
  let body = '';
  const header = `
    <div class="checkin-step-label">◌ Step ${step + 1} of ${totalSteps}</div>
    <div class="checkin-title">${esc(block.label)} · Week ${globalWeekNum()}, Day ${cd.di + 1}</div>`;

  if (step === 0) {
    body = `${header}
      <div class="slider-card">
        <div class="q">How many hours did you sleep last night?</div>
        <div class="feeling"><b id="sleep-val">${cd.sleepHours}</b> hours</div>
        <input type="range" min="3" max="10" step="0.5" value="${cd.sleepHours}"
          oninput="cd_sleep(this.value)">
        <div class="range-labels"><span>3H</span><span>6H</span><span>10H</span></div>
        ${cd.sleepHours < 6 ? `<div class="banner-warn mt8">Under 6 hours. Today's session will flag extra-fatigue sets. Don't chase numbers.</div>` : ''}
      </div>
      <button class="btn btn-blue" onclick="cd_next()">Next</button>`;
  } else if (step <= cd.groups.length) {
    const g = cd.groups[step - 1];
    const val = cd.sliders[g.key];
    body = `${header}
      <div class="bodymap">🫀</div>
      <div class="slider-card">
        <div class="q">How are your ${esc(g.label)} feeling today?</div>
        <div class="feeling">They are feeling <b>${FEEL_WORDS[val - 1]}</b></div>
        <input type="range" min="1" max="5" step="1" value="${val}"
          oninput="cd_slider('${g.key}', this.value)">
        <div class="range-labels"><span>LOW</span><span>TIRED</span><span>NORMAL</span><span>GREAT</span><span>EXTRA</span></div>
      </div>
      <button class="btn btn-blue" onclick="cd_next()">Next</button>`;
  } else {
    body = `${header}
      <div class="subtle" style="margin-top:8px">Mindset Preparation</div>
      <p class="faint">Time to get focused. What is something you hope to achieve today?
      For example: today I am going to focus on consistent technique in all sets.</p>
      <input class="checkin-input" id="ci-mindset" placeholder="Today I am going to…" value="${esc(cd.mindset)}">
      <div class="card mt16">
        <div style="font-weight:600;margin-bottom:6px">🩹 Are you currently rehabbing any injuries?</div>
        ${['Squat','Bench','Deadlift'].map(l => `
          <label class="check-row"><input type="checkbox" ${cd.injuries.includes(l) ? 'checked' : ''}
            onchange="cd_injury('${l}', this.checked)"> ${l}</label>`).join('')}
      </div>
      <button class="btn btn-green mt16" onclick="beginSession()">Start Workout</button>`;
  }
  return `<header class="topbar"><button class="btn-ghost" onclick="nav('workout')">‹</button>
    <span style="font-weight:700">Workout Readiness Checkin</span><span></span></header>
    <div class="view">${body}</div>`;
}
function cd_sleep(v) { V.checkinData.sleepHours = parseFloat(v);
  document.getElementById('sleep-val').textContent = v;
  if ((v < 6) !== !!document.querySelector('.banner-warn')) render(); }
function cd_slider(key, v) { V.checkinData.sliders[key] = parseInt(v); render(); }
function cd_injury(l, on) {
  const arr = V.checkinData.injuries;
  if (on && !arr.includes(l)) arr.push(l);
  if (!on) V.checkinData.injuries = arr.filter(x => x !== l);
}
function cd_next() {
  if (V.checkinStep === 0) { /* sleep already stored */ }
  V.checkinStep++; render();
}
function bindRangeLabels() { /* placeholder for future slider niceties */ }

// ------------------------------------------------------------
// SESSION (active workout logging)
// ------------------------------------------------------------
function beginSession() {
  const cd = V.checkinData;
  cd.mindset = document.getElementById('ci-mindset')?.value || '';
  S.checkins.push({ ts: Date.now(), sleepHours: cd.sleepHours,
    sliders: { ...cd.sliders }, mindset: cd.mindset, injuries: [...cd.injuries] });
  logReadiness(computeReadiness());

  const p = P();
  const di = cd.di, b = p.pointer.block, w = p.pointer.week;
  // resolveDayEntries applies muscle focus and fits the time cap (rest
  // compression then coherent pruning) so the logged session matches the plan.
  const built = resolveDayEntries(di, b, w);
  const entries = built.items.map(x => ({
    si: x.si, exId: x.rs.exId, name: x.rs.name,
    isMain: !!x.rs.isMain, isSecondary: !!x.rs.isSecondary, wmKey: x.rs.wmKey || null,
    notes: '', notesOpen: false,
    sets: x.rs.sets.map(t => ({
      targetWeight: t.weight ?? null, targetReps: t.reps, targetRpe: t.rpe ?? null,
      amrap: !!t.amrap, ramp: !!t.ramp, calib: !!t.calib, note: t.note || null,
      weight: null, reps: null, rpe: null, done: false,
    })),
  }));
  V.draft = { id: 's' + Date.now(), ts: Date.now(), b, w, d: di, entries,
              sleepHours: cd.sleepHours, mindset: cd.mindset, sliders: { ...cd.sliders } };
  if (built.pruned.length) toast(`Trimmed to fit ${built.capMin} min: ${built.pruned.join(', ')}`);
  save();
  nav('session');
}

function ratingsStripHTML(sliders) {
  const map = [['squat','Squat'],['bench','Bench'],['deadlift','Deadlift'],['upperpull','Upper Pull'],['press','Press'],['lowback','Low Back']];
  const shown = map.filter(([k]) => sliders[k] != null).slice(0, 4);
  if (!shown.length) return '';
  return `<div class="section-title" style="font-size:1.25rem">Daily Readiness Ratings <span class="faint">ⓘ</span></div>
  <div class="ratings-strip">${shown.map(([k, l]) =>
    `<div class="r"><div class="k">${l}</div><div class="v">${sliders[k]}</div></div>`).join('')}</div>`;
}

function lastSetInfo(exId) {
  const recs = recordsFor(exId);
  if (!recs.length) return '';
  const r = recs[recs.length - 1];
  return `<div class="lastset">Last Set ${new Date(r.ts).toLocaleDateString()}<br>
    ${r.reps} reps x ${fmtW(exId, r.weight)} @ RPE ${r.rpe} ›</div>`;
}

function setTargetLabel(st, exId) {
  if (st.amrap) return `${fmtW(exId, st.targetWeight)} × AMRAP <small>standard ${st.targetReps}</small>`;
  if (st.calib) return `${st.targetReps} reps @ ${st.targetRpe} RPE <small>calibration, eyeball the weight</small>`;
  if (st.targetWeight != null && st.targetRpe != null)
    return `${fmtW(exId, st.targetWeight)} × ${st.targetReps} <small>cap at ${st.targetRpe} RPE</small>`;
  if (st.targetWeight != null) return `${fmtW(exId, st.targetWeight)} × ${st.targetReps}`;
  return `${st.targetReps} reps @ ${st.targetRpe} RPE`;
}

function vSession() {
  const dr = V.draft;
  if (!dr) return vWorkout();
  const block = blockOf(dr.b);
  const shortSleep = dr.sleepHours < 6;
  const cards = dr.entries.map((e, ei) => {
    const setRows = e.sets.map((st, si2) => {
      const perfLabel = st.done
        ? `${fmtW(e.exId, st.weight)} x ${st.reps} @ ${st.rpe} RPE`
        : 'Performance';
      const fatigueFlag = shortSleep && !st.ramp && si2 >= e.sets.length - 1 && !e.isMain
        ? `<div class="flag">⚠ optional today, short sleep</div>` : '';
      return `<div class="set-row ${st.done ? 'done' : ''} ${st.amrap ? 'amrap' : ''}">
          <span class="num">${si2 + 1}</span>
          <span class="target">${setTargetLabel(st, e.exId)}${st.note ? `<small>${esc(st.note)}</small>` : ''}</span>
          <button class="perf ${st.done ? 'filled' : ''}" onclick="openPerf(${ei},${si2})">${perfLabel}</button>
        </div>${fatigueFlag}`;
    }).join('');
    const schemeWork = e.sets.filter(s => !s.ramp);
    const schemeTxt = schemeWork.length
      ? `${schemeWork.length} sets x ${schemeWork[0].targetReps} reps` : '';
    const top = topWorkWeight(e);
    return `<div class="lift-card">
      <h3>${esc(e.name)}</h3>
      ${lastSetInfo(e.exId)}
      <div class="head-actions">
        <button onclick="openExDetail('${e.exId}')">ⓘ</button>
      </div>
      ${top && loadingFor(e.exId).showPlates ? `<button class="warmup-btn" onclick="openWarmup(${top},'${e.exId}')"><b>＋</b> Warmup</button>` : ''}
      <div class="scheme">${schemeTxt}</div>
      ${setRows}
      <button class="notes-link" onclick="toggleNotes(${ei})">Notes ✎</button>
      ${e.notesOpen ? `<textarea class="notes-area" oninput="setNotes(${ei}, this.value)" placeholder="Session notes…">${esc(e.notes)}</textarea>` : ''}
    </div>`;
  }).join('');

  return `<header class="topbar">
      <button class="btn-ghost" onclick="abandonSession()">‹</button>
      <div class="col center"><span style="color:var(--blue);font-weight:600">${esc(block.label)}</span>
      <span style="font-weight:700">Week ${dr.b * P().weeksPerBlock + dr.w + 1}, Day ${dr.d + 1}</span></div>
      <span></span></header>
    <div class="view">
      ${shortSleep ? `<div class="banner-warn">Short sleep last night (${dr.sleepHours}h). Sets flagged ⚠ carry extra fatigue risk. Skipping them today is smart, not soft.</div>` : ''}
      ${dr.mindset ? `<div class="card accent"><span class="faint">Today's focus</span><div style="font-weight:600">${esc(dr.mindset)}</div></div>` : ''}
      ${ratingsStripHTML(dr.sliders)}
      ${cards}
      <button class="btn btn-green mt16" onclick="openSessionRating()">Finish Workout</button>
    </div>`;
}
function topWorkWeight(e) {
  const work = e.sets.filter(s => !s.ramp && s.targetWeight);
  return work.length ? Math.max(...work.map(s => s.targetWeight)) : 0;
}
function toggleNotes(ei) { V.draft.entries[ei].notesOpen = !V.draft.entries[ei].notesOpen; render(); }
function setNotes(ei, v) { V.draft.entries[ei].notes = v; }
function abandonSession() {
  confirmModal({
    title: 'Leave this session?',
    message: 'Your logged sets stay saved in the draft, so you can pick this session back up.',
    confirmLabel: 'Leave session',
  }, () => nav('workout'));
}

// ------------------------------------------------------------
// PERFORMANCE MODAL
// ------------------------------------------------------------
let PM = null; // {ei, si, weight, reps, rpe}
function openPerf(ei, si) {
  const st = V.draft.entries[ei].sets[si];
  const e = V.draft.entries[ei];
  let w = st.done ? st.weight : (st.targetWeight ?? lastWeightFor(e.exId) ?? 0);
  PM = { ei, si, weight: w, reps: st.done ? st.reps : st.targetReps,
         rpe: st.done ? st.rpe : (st.targetRpe ?? 8) };
  showModal(renderPerfModal);
}
function lastWeightFor(exId) {
  const r = recordsFor(exId);
  return r.length ? r[r.length - 1].weight : null;
}
function plateVizHTML(weight, exId) {
  const L = loadingFor(exId);
  if (!L.showPlates) {
    if (L.mode === 'dumbbell') {
      const txt = L.count === 2
        ? `${kg(weight / 2)} kg per hand, ${kg(weight)} kg total`
        : `${kg(weight)} kg dumbbell`;
      return { viz: `<span class="faint">${txt}</span>`, note: '' };
    }
    const label = (L.mode === 'machine' || L.mode === 'cable') ? 'machine load' : 'added load';
    return { viz: `<span class="faint">${label}</span>`, note: '' };
  }
  const bar = L.barWeight;
  const { plates, achieved } = Engine.plateMath(weight, bar, S.profile.plates);
  const viz = plates.length
    ? plates.map(p => `<div class="plate" style="background:${p.color};color:${PLATE_TEXT[String(p.w)] || '#fff'};height:${36 + p.w * 2.2}px">${kg(p.w)}</div>`).join('')
    : '<span class="faint">bar only</span>';
  const mismatch = Math.abs(achieved - weight) > 0.01;
  const note = `(${kg(bar)}kg bar + ${kg(Math.max(0, achieved - bar))}kg)` +
    (mismatch ? `<br><span style="color:var(--amber)">closest loadable: ${kg(achieved)}kg</span>` : '');
  return { viz, note };
}
function renderPerfModal(anim) {
  const pm = PM;
  const exId = V.draft.entries[pm.ei].exId;
  const L = loadingFor(exId);
  const disp = displayWeight(exId, pm.weight);
  const unitLabel = disp.unit === 'kg per hand' ? 'kg/hand' : 'kg';
  const { viz, note } = plateVizHTML(pm.weight, exId);
  $modal.innerHTML = modalShell(anim, 'Performance', `
        <div class="stepper">
          <div class="lbl">Weight</div>
          <div class="ctr">
            <button class="pm" onclick="pmW(-1)">−</button>
            <span class="val"><input id="pm-weight" type="number" inputmode="decimal"
              value="${kg(disp.value)}" onchange="pmWSet(this.value)"><small>${unitLabel}</small></span>
            <button class="pm" onclick="pmW(1)">＋</button>
          </div>
          <div class="plate-viz" id="pm-plateviz">${viz}</div>
          <div class="plate-math-note" id="pm-platenote">${note}</div>
          ${L.showPlates ? `<button class="btn-ghost" onclick="openPlateConfig()">Configure Plates ›</button>` : ''}
        </div>
        <div class="stepper">
          <div class="lbl">Reps</div>
          <div class="ctr">
            <button class="pm" onclick="pmR(-1)">−</button>
            <span class="val" id="pm-reps">${pm.reps}</span>
            <button class="pm" onclick="pmR(1)">＋</button>
          </div>
        </div>
        <div class="stepper" style="border-bottom:none">
          <div class="lbl">Rate of Perceived Exertion</div>
          <div class="ctr">
            <button class="pm" onclick="pmP(-0.5)">−</button>
            <span class="val" id="pm-rpe">${pm.rpe}</span>
            <button class="pm" onclick="pmP(0.5)">＋</button>
          </div>
          <div class="rpe-desc" id="pm-rpe-desc">${RPE_DESCRIPTIONS[pm.rpe] || ''}</div>
        </div>
        <div class="btn-row">
          <button class="btn btn-outline" onclick="clearPerf()">CLEAR</button>
          <button class="btn btn-green" onclick="donePerf()">DONE</button>
        </div>`, 'closePerf()');
}
// Targeted updates — the modal itself never rebuilds, only the numbers move
function nudge(el, dir) {
  if (!el || !dir) return;
  el.classList.remove('nudge-up', 'nudge-down');
  void el.offsetWidth; // restart animation
  el.classList.add(dir > 0 ? 'nudge-up' : 'nudge-down');
}
function perfUpdateWeight(dir) {
  const exId = V.draft.entries[PM.ei].exId;
  const disp = displayWeight(exId, PM.weight);
  const inp = byId('pm-weight');
  if (inp) { inp.value = kg(disp.value); nudge(inp, dir); }
  const { viz, note } = plateVizHTML(PM.weight, exId);
  const pv = byId('pm-plateviz'); if (pv) pv.innerHTML = viz;
  const pn = byId('pm-platenote'); if (pn) pn.innerHTML = note;
}
function pmW(dir) {
  const exId = V.draft.entries[PM.ei].exId;
  PM.weight = Math.max(0, PM.weight + dir * loadingFor(exId).totalInc);
  perfUpdateWeight(dir);
}
function pmWSet(v) {
  const exId = V.draft.entries[PM.ei].exId;
  const L = loadingFor(exId);
  const parsed = Math.max(0, parseFloat(v) || 0);
  PM.weight = (L.mode === 'dumbbell' && L.count === 2) ? parsed * 2 : parsed; // typed value is per hand for two-DB
  perfUpdateWeight(0);
}
function pmR(d) {
  PM.reps = Math.max(0, PM.reps + d);
  const el = byId('pm-reps'); el.textContent = PM.reps; nudge(el, d);
}
function pmP(d) {
  PM.rpe = Math.min(10, Math.max(5, PM.rpe + d));
  const el = byId('pm-rpe'); el.textContent = PM.rpe;
  byId('pm-rpe-desc').textContent = RPE_DESCRIPTIONS[PM.rpe] || '';
  nudge(el, d);
}
function closePerf() { PM = null; closeModal(); }
function clearPerf() {
  const st = V.draft.entries[PM.ei].sets[PM.si];
  st.done = false; st.weight = st.reps = st.rpe = null;
  closePerf(); render();
}
function donePerf() {
  const e = V.draft.entries[PM.ei];
  const st = e.sets[PM.si];
  st.weight = PM.weight; st.reps = PM.reps; st.rpe = PM.rpe; st.done = true;
  pushRecord(e.exId, { ts: Date.now(), weight: st.weight, reps: st.reps, rpe: st.rpe });

  // AMRAP on a main lift → adjust working max (the JM 2.0 engine).
  // A swapped-in variation logs normally but never moves the base lift's WM.
  if (st.amrap && e.isMain && e.wmKey && P().wm[e.wmKey]) {
    if (e.exId === e.wmKey) {
      const wave = WAVES[blockOf(V.draft.b).wave];
      const res = Engine.amrapAdjust(P().wm[e.wmKey], st.reps, wave.standard, P().increments[e.wmKey]);
      if (res.delta > 0) {
        P().wm[e.wmKey] = res.newWM;
        V.draft.wmChange = { name: e.name, from: res.newWM - res.delta, to: res.newWM, delta: res.delta, capped: res.capped };
        toast(`${e.name}: working max ${kg(res.newWM - res.delta)} → ${kg(res.newWM)} kg ${res.capped ? '(capped at +10 reps)' : ''}`);
      } else toast(res.msg, true);
    } else {
      toast('AMRAP logged. Variation lift, working max unchanged');
    }
  }
  // Calibration sets → bold recalibration of WM / future set weights
  if (st.calib) {
    const loggedCalib = e.sets.filter(s => s.calib && s.done);
    if ((e.isMain || e.isSecondary) && e.wmKey) {
      const newWM = Engine.recalibratedWM(P().wm[e.wmKey], loggedCalib);
      if (newWM) {
        P().wm[e.wmKey] = Engine.roundLoad(newWM, 1.25);
        toast(`${e.name}: working max calibrated to ${kg(P().wm[e.wmKey])} kg`);
      }
    } else if (loggedCalib.length >= e.sets.filter(s => s.calib).length) {
      toast(`${e.name} calibrated. Weights will be prescribed from your next session`);
    }
  }
  save();
  closePerf(); render();
}

// ------------------------------------------------------------
// WARMUP MODAL
// ------------------------------------------------------------
function openWarmup(top, exId) {
  const bar = (exId && loadingFor(exId).barWeight) || S.profile.barWeight;
  const sets = Engine.warmupSets(top, bar, S.profile.rounding);
  showModal(anim => {
    $modal.innerHTML = modalShell(anim, 'Warmup', `
        <div class="card"><div class="row"><span>Target Top Set</span><b>${kg(top)} kg</b></div>
        <div class="divider"></div>
        <div class="row"><span>Bar Weight</span><b style="color:var(--blue)">${kg(bar)}kg</b></div></div>
        ${sets.map((s, i) => `<div class="set-row"><span class="num">${i + 1}</span>
          <span class="target">${kg(s.weight)}kg × ${s.reps}</span></div>`).join('')}
        <p class="faint">Build GPP in the warmup. Bar speed crisp, rest short.</p>`);
  });
}
// --- modal stack: closing a stacked modal returns to the one beneath it ---
let MSTACK = [];
function showModal(renderFn) { MSTACK.push(renderFn); renderFn(true); }
function rerenderTop() { const t = MSTACK[MSTACK.length - 1]; if (t) t(false); }
function closeModal() {
  MSTACK.pop();
  const t = MSTACK[MSTACK.length - 1];
  if (t) t(false); else $modal.innerHTML = '';
}
function closeAllModals() { MSTACK = []; $modal.innerHTML = ''; }
function modalShell(anim, title, body, oncloseJs) {
  const close = oncloseJs || 'closeModal()';
  return `<div class="modal-wrap" onclick="if(event.target===this)${close}">
    <div class="modal"${anim ? '' : ' style="animation:none"'}>
      <div class="modal-head"><span class="t">${title}</span>
        <button class="btn-ghost" onclick="${close}">✕</button></div>
      <div class="modal-body">${body}</div>
    </div></div>`;
}

// ------------------------------------------------------------
// CONFIRM DIALOG
// In-app replacement for native window.confirm(). Rides the modal
// stack, so it layers over an open modal (e.g. delete from the
// exercise-detail sheet) and returns to it on cancel. The X button
// and backdrop tap both count as cancel. Set opts.danger for a red
// primary button and warning icon on destructive actions.
// ------------------------------------------------------------
let CONFIRM = null;
function confirmModal(opts, onConfirm, onCancel) {
  CONFIRM = { onConfirm, onCancel };
  CONFIRM.opts = opts;
  showModal(renderConfirm);
}
function renderConfirm(anim) {
  const o = CONFIRM.opts;
  const danger = !!o.danger;
  $modal.innerHTML = modalShell(anim, o.title || 'Confirm', `
        <div class="confirm-body">
          <div class="confirm-icon ${danger ? 'danger' : ''}">${danger ? '⚠' : '?'}</div>
          <p class="confirm-msg">${esc(o.message)}</p>
        </div>
        <button class="btn ${danger ? 'btn-red' : 'btn-blue'}" onclick="confirmResolve(true)">${esc(o.confirmLabel || 'Confirm')}</button>
        <button class="btn btn-outline mt8" onclick="confirmResolve(false)">${esc(o.cancelLabel || 'Cancel')}</button>`,
    'confirmResolve(false)');
}
function confirmResolve(yes) {
  const c = CONFIRM;
  CONFIRM = null;
  closeModal();
  if (!c) return;
  if (yes) { if (c.onConfirm) c.onConfirm(); }
  else if (c.onCancel) c.onCancel();
}

// ------------------------------------------------------------
// SESSION RATING + FINISH
// ------------------------------------------------------------
let SR = 7;
const SR_WORDS = { 5: 'Felt like a warmup', 6: 'Comfortably hard', 7: 'Solid work',
                   8: 'Very demanding', 9: 'Brutal', 10: 'Hardest session ever' };
function openSessionRating() {
  const dr = V.draft;
  const loggedAny = dr.entries.some(e => e.sets.some(s => s.done));
  if (!loggedAny) {
    confirmModal({
      title: 'Finish with no sets?',
      message: 'You have not logged any sets for this session. You can finish it anyway.',
      confirmLabel: 'Finish anyway',
    }, showSessionRating);
    return;
  }
  showSessionRating();
}
function showSessionRating() {
  SR = 7;
  showModal(renderSR);
}
function renderSR(anim) {
  $modal.innerHTML = modalShell(anim, 'Session Rating', `
        <div class="slider-card">
          <div class="q">How tough was the session?</div>
          <div class="feeling" style="font-size:2.4rem;font-weight:800" id="sr-val">${SR}</div>
          <input type="range" min="5" max="10" step="1" value="${SR}" oninput="srSet(this.value)">
          <div class="range-labels"><span>5 · WARMUP</span><span>10 · HARDEST EVER</span></div>
          <p class="faint mt8" id="sr-desc">${SR_WORDS[SR]}</p>
        </div>
        <button class="btn btn-green" onclick="finishSession()">Complete Session</button>`);
}
function srSet(v) {
  SR = parseInt(v);
  byId('sr-val').textContent = SR;
  byId('sr-desc').textContent = SR_WORDS[SR];
}
function finishSession() {
  const dr = V.draft;
  dr.rating = SR;
  dr.tonnage = Engine.tonnage(dr.entries);
  dr.readiness = computeReadiness();
  dr.entries.forEach(e => delete e.notesOpen);
  S.sessions.push(dr);
  P().completedDays[dayKey(dr.b, dr.w, dr.d)] = dr.id;
  logReadiness(dr.readiness);
  V.summaryId = dr.id;
  V.draft = null; V.dayIdx = null;
  save();
  closeAllModals();
  toast(`Session saved, ${dr.tonnage.toLocaleString()} kg total tonnage`);
  V.tab = 'dashboard';
  nav('summary');
}

// ------------------------------------------------------------
// PREVIEW MODAL
// ------------------------------------------------------------
function openPreview(di) {
  const built = resolveDayEntries(di, P().pointer.block, P().pointer.week);
  const blocks = built.items.map(x => x.rs);
  const timeNote = built.capMin
    ? `<p class="faint" style="margin-bottom:10px">Projected ${built.estMin} min, cap ${built.capMin} min.${built.pruned.length ? ' Trimmed to fit: ' + esc(built.pruned.join(', ')) + '.' : ''}</p>`
    : '';
  showModal(anim => {
    $modal.innerHTML = modalShell(anim, 'Preview', timeNote +
      blocks.map(rs => {
        const work = rs.sets.filter(s => !s.ramp);
        return `<div class="lift-card"><h3 style="font-size:1.2rem">${esc(rs.name)}</h3>
          <div class="scheme">${work.length} sets x ${work[0]?.reps ?? ''} reps</div>
          ${rs.sets.map((s, i) => `<div class="set-row"><span class="num">${i + 1}</span>
            <span class="target">${s.weight != null ? fmtW(rs.exId, s.weight) + ' × ' : ''}${s.amrap ? 'AMRAP' : s.reps}${s.rpe ? ' @ ' + s.rpe + ' RPE' : ''}</span>
          </div>`).join('')}
        </div>`;
      }).join(''));
  });
}

// ------------------------------------------------------------
// SWAP / SELECT / ADD EXERCISE
// ------------------------------------------------------------
function openSwap(di, si) {
  const slot = P().days[di].slots[si];
  const cat = slot.cat || exById(slot.ex || slot.def || slot.lift)?.movement;
  const current = slot.ex || slot.def || slot.lift;
  showModal(anim => {
    const used = new Set(Object.keys(S.records));
    const candidates = allExercises()
      .filter(e => e.movement === cat && e.id !== current)
      .sort((a, b) => (used.has(b.id) - used.has(a.id)) || a.name.localeCompare(b.name));
    const note = (slot.type === 'main' || slot.type === 'secondary')
      ? `<p class="faint" style="margin-bottom:8px">Variations run the same wave percentages off the ${esc(exName(slot.baseLift || slot.lift))} working max. AMRAPs on a variation won't move that max.</p>` : '';
    $modal.innerHTML = modalShell(anim, slot.type === 'select' ? 'Select Exercise' : 'Swap Exercise',
      `${note}<div class="section-title" style="margin-top:4px">Recommended</div>` +
      candidates.map(e => `<div class="ex-card">
          <span class="name">${esc(e.name)}</span>
          <span class="actions">
            <button class="icon-btn" onclick="openExDetail('${e.id}')"><span class="ic">ⓘ</span>Info</button>
            <button class="icon-btn" onclick="doSwap(${di},${si},'${e.id}')"><span class="ic">☐</span>Select</button>
          </span></div>`).join(''));
  });
}
function doSwap(di, si, exId) {
  const slot = P().days[di].slots[si];
  slot.ex = exId;
  if (slot.type === 'select') slot.type = 'acc';
  save(); closeAllModals(); render();
  toast(exName(exId) + ' set for ' + P().days[di].name);
}
function openAddExercise(di) {
  V.addTarget = di;
  showModal(anim => {
    $modal.innerHTML = modalShell(anim, 'Add Exercise', `
        <input class="search-input" placeholder="Search…" oninput="filterAdd(this.value)">
        <div id="add-list">${addListHTML('')}</div>`);
  });
}
function addListHTML(q) {
  const ql = q.toLowerCase();
  return allExercises()
    .filter(e => !ql || e.name.toLowerCase().includes(ql))
    .slice(0, 40)
    .map(e => `<button class="lib-item" onclick="doAddExercise('${e.id}')">
      <span>${esc(e.name)}<span class="sub">${MOVEMENTS[e.movement]?.label || ''}</span></span><span>＋</span>
    </button>`).join('');
}
function filterAdd(q) { document.getElementById('add-list').innerHTML = addListHTML(q); }
function doAddExercise(exId) {
  const ex = exById(exId);
  P().days[V.addTarget].slots.push({ type: 'acc', cat: ex.movement, ex: exId, added: true });
  save(); closeAllModals(); render();
  toast(ex.name + ' added');
}

// ------------------------------------------------------------
// VIEW: HISTORY (tonnage by date, horizontal bars)
// ------------------------------------------------------------
function vHistory() {
  if (!P()) return vOnboarding();
  const sessions = [...S.sessions].reverse();
  let body;
  if (!sessions.length) {
    body = `<div class="card mt16"><b>No sessions yet.</b>
      <p class="subtle mt8">Finish your first workout and your tonnage shows up here, session by session.</p></div>`;
  } else {
    const maxT = Math.max(...sessions.map(s => s.tonnage || 0), 1);
    body = sessions.map(s => {
      const pct = Math.max(8, (s.tonnage || 0) / maxT * 100);
      const label = `${blockOf(s.b)?.label || ''} · W${s.b * P().weeksPerBlock + s.w + 1} D${s.d + 1}`;
      return `<button class="hist-row ${s.skipped ? 'skipped' : ''}" style="display:block;width:100%;text-align:left" onclick="openSessionDetail('${s.id}')">
        <div class="meta"><span>${fmtDate(s.ts)} · ${esc(label)}</span><span>${s.skipped ? 'Skipped' : (s.rating ? 'RPE ' + s.rating : '')}</span></div>
        <div class="bar-track"><div class="bar" style="width:${s.skipped ? 100 : pct}%">${s.skipped ? '—' : (s.tonnage || 0).toLocaleString() + ' kg'}</div></div>
      </button>`;
    }).join('');
  }
  return `${topbar('History')}<div class="view">
    <div class="section-title">Total Session Tonnage</div>
    <p class="faint" style="margin-bottom:14px">Sum of weight × reps across every logged set.</p>
    ${body}</div>${tabbar()}`;
}
// Shared per-lift rendering for the history modal and the post-workout summary.
function sessionSetRowsHTML(e, withTarget) {
  const done = e.sets.filter(x => x.done);
  if (!done.length) return '<p class="faint">No sets logged</p>';
  return done.map((x, i) => {
    const actual = `${fmtW(e.exId, x.weight)} × ${x.reps} @ ${x.rpe} RPE`;
    let tgt = '';
    if (withTarget) {
      tgt = x.targetWeight != null
        ? ` <small>target ${fmtW(e.exId, x.targetWeight)} × ${x.targetReps}${x.targetRpe ? ' @ ' + x.targetRpe + ' RPE' : ''}</small>`
        : (x.targetReps ? ` <small>target ${x.targetReps} reps${x.targetRpe ? ' @ ' + x.targetRpe + ' RPE' : ''}</small>` : '');
    }
    return `<div class="set-row"><span class="num">${i + 1}</span>
      <span class="target">${actual}${x.amrap ? ' <small>AMRAP</small>' : ''}${tgt}</span></div>`;
  }).join('');
}
function sessionLiftCardHTML(e, withTarget) {
  return `<div class="lift-card"><h3 style="font-size:1.15rem">${esc(e.name)}</h3>
    ${sessionSetRowsHTML(e, withTarget)}
    ${e.notes ? `<p class="faint mt8">✎ ${esc(e.notes)}</p>` : ''}</div>`;
}
function openSessionDetail(id) {
  const s = S.sessions.find(x => x.id === id);
  if (!s || s.skipped) return;
  showModal(anim => {
    $modal.innerHTML = modalShell(anim, fmtDate(s.ts), `
        <div class="row" style="margin-bottom:10px"><span class="subtle">Tonnage</span><b>${(s.tonnage || 0).toLocaleString()} kg</b></div>
        ${s.rating ? `<div class="row" style="margin-bottom:10px"><span class="subtle">Session rating</span><b>${s.rating} / 10</b></div>` : ''}
        ${s.mindset ? `<div class="card accent"><span class="faint">Focus</span><div>${esc(s.mindset)}</div></div>` : ''}
        ${s.entries.map(e => sessionLiftCardHTML(e, false)).join('')}`);
  });
}

// ------------------------------------------------------------
// VIEW: POST-WORKOUT SUMMARY (Change 3)
// ------------------------------------------------------------
function openSummaryFor(id) {
  if (!S.sessions.some(x => x.id === id)) { toast('Summary not found', true); return; }
  V.summaryId = id;
  nav('summary');
}
function vSummary() {
  if (!P()) return vOnboarding();
  const s = S.sessions.find(x => x.id === V.summaryId);
  if (!s || s.skipped) { V.view = 'dashboard'; return vDashboard(); }
  const block = blockOf(s.b);
  const wmc = s.wmChange;
  return `${topbar('Summary')}
  <div class="view">
    <div class="mt8">
      <div style="color:${BLOCK_COLORS[block?.type] || 'var(--blue)'};font-weight:600">${esc(block?.label || '')}</div>
      <div style="font-size:1.6rem;font-weight:800">Week ${s.b * P().weeksPerBlock + s.w + 1}, Day ${s.d + 1} complete ✓</div>
    </div>
    <div class="card accent mt8">
      <div class="row"><span class="subtle">Total tonnage</span><b>${(s.tonnage || 0).toLocaleString()} kg</b></div>
      <div class="row mt8"><span class="subtle">Session rating</span><b>${s.rating ? s.rating + ' / 10' : '—'}</b></div>
      <div class="row mt8"><span class="subtle">Readiness</span><b>${s.readiness != null ? s.readiness.toFixed(2) : '—'}</b></div>
      ${wmc ? `<div class="row mt8"><span class="subtle">${esc(wmc.name)} working max</span><b style="color:var(--blue)">${kg(wmc.from)} → ${kg(wmc.to)} kg${wmc.capped ? ' (capped)' : ''}</b></div>` : ''}
    </div>
    <div class="section-title" style="font-size:1.2rem">Sets logged <span class="faint">actual vs target</span></div>
    ${s.entries.map(e => sessionLiftCardHTML(e, true)).join('')}
    <button class="btn btn-green mt16" onclick="nav('dashboard')">Back to dashboard</button>
    <button class="btn btn-outline mt8" onclick="V.tab='history';nav('history')">View history</button>
  </div>${tabbar()}`;
}
function redoDay(i) {
  const p = P();
  const k = dayKey(p.pointer.block, p.pointer.week, i);
  const sid = p.completedDays[k];
  if (!sid || sid === 'skipped') { startCheckin(i); return; }
  confirmModal({
    title: 'Redo this day?',
    message: 'The logged session for this day will be removed and replaced from scratch.',
    confirmLabel: 'Redo day',
    danger: true,
  }, () => {
    S.sessions = S.sessions.filter(x => x.id !== sid); // drop the prior session so nothing is orphaned
    delete p.completedDays[k];
    save();
    startCheckin(i);
  });
}

// ------------------------------------------------------------
// VIEW: EXERCISES LIBRARY
// ------------------------------------------------------------
function vExercises() {
  const q = V.libSearch.toLowerCase();
  let list = allExercises().filter(e => !q || e.name.toLowerCase().includes(q));
  let body = '';
  if (V.libTab === 'alpha') {
    list.sort((a, b) => a.name.localeCompare(b.name));
    let letter = '';
    body = list.map(e => {
      const L = e.name[0].toUpperCase();
      const head = L !== letter ? `<div class="lib-letter">${L}</div>` : '';
      letter = L;
      return head + libItemHTML(e);
    }).join('');
  } else if (V.libTab === 'movements') {
    body = Object.entries(MOVEMENTS).map(([mv, m]) => {
      const items = list.filter(e => e.movement === mv);
      if (!items.length) return '';
      return `<div class="lib-letter">${m.label}</div>` +
        items.sort((a, b) => a.name.localeCompare(b.name)).map(libItemHTML).join('');
    }).join('');
  } else {
    const used = new Set(Object.keys(S.records));
    const mine = list.filter(e => used.has(e.id) || S.customEx.some(c => c.id === e.id));
    body = mine.length ? mine.sort((a, b) => a.name.localeCompare(b.name)).map(libItemHTML).join('')
      : `<div class="card mt16"><b>Nothing here yet.</b><p class="subtle mt8">Exercises you've logged or created appear here.</p></div>`;
    body += `<button class="btn btn-blue mt16" onclick="openCustomEx()">＋ Create Custom Exercise</button>`;
  }
  return `${topbar('Exercises')}<div class="view">
    <div class="tabs">
      <button class="${V.libTab === 'alpha' ? 'on' : ''}" onclick="libTab('alpha')">Alphabetical</button>
      <button class="${V.libTab === 'movements' ? 'on' : ''}" onclick="libTab('movements')">Movements</button>
      <button class="${V.libTab === 'mine' ? 'on' : ''}" onclick="libTab('mine')">My Exercises</button>
    </div>
    <input class="search-input" placeholder="Search ${allExercises().length} exercises…" value="${esc(V.libSearch)}"
      oninput="V.libSearch=this.value;render();this.focus();this.setSelectionRange(this.value.length,this.value.length)">
    ${body}
  </div>${tabbar()}`;
}
function libTab(t) { V.libTab = t; render(); }
function libItemHTML(e) {
  const eq = { bb: 'Barbell', db: 'Dumbbell', mc: 'Machine', cb: 'Cable', bw: 'Bodyweight', bd: 'Band', kb: 'Kettlebell' }[e.equipment] || '';
  const best = Engine.bestE1RM(recordsFor(e.id));
  return `<button class="lib-item" onclick="openExDetail('${e.id}')">
    <span>${esc(e.name)}${e.isMain ? ' <span style="color:var(--blue)">★</span>' : ''}
      <span class="sub">${MOVEMENTS[e.movement]?.label || ''} · ${eq}${best ? ' · e1RM ' + kg(Engine.roundLoad(best, 0.5)) + 'kg' : ''}</span></span>
    <span>›</span></button>`;
}

// Custom exercise creation (with optional 10RM / 1RM seeding)
function openCustomEx() {
  showModal(anim => {
    $modal.innerHTML = modalShell(anim, 'Custom Exercise', `
        <div class="field"><label>Name</label><input id="cx-name" placeholder="e.g. Cambered Bar Squat"></div>
        <div class="field"><label>Movement category</label>
          <select id="cx-mv">${Object.entries(MOVEMENTS).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join('')}</select></div>
        <div class="field"><label>Equipment</label>
          <select id="cx-eq"><option value="bb">Barbell</option><option value="db">Dumbbell</option>
          <option value="mc">Machine</option><option value="cb">Cable</option><option value="bw">Bodyweight</option><option value="bd">Band</option></select></div>
        <div class="field"><label>Known 1RM (kg, optional)</label><input id="cx-1rm" type="number" inputmode="decimal" placeholder="Seeds the weight engine"></div>
        <div class="field"><label>Known 10RM (kg, optional)</label><input id="cx-10rm" type="number" inputmode="decimal" placeholder="Also seeds the engine"></div>
        <button class="btn btn-green" onclick="saveCustomEx()">Create</button>`);
  });
}
function saveCustomEx() {
  const name = document.getElementById('cx-name').value.trim();
  if (!name) { toast('Give it a name', true); return; }
  const id = 'cx-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);
  S.customEx.push({ id, name, movement: document.getElementById('cx-mv').value,
    equipment: document.getElementById('cx-eq').value, isMain: false, custom: true });
  const r1 = parseFloat(document.getElementById('cx-1rm').value);
  const r10 = parseFloat(document.getElementById('cx-10rm').value);
  if (r1 > 0) pushRecord(id, { ts: Date.now(), weight: r1, reps: 1, rpe: 10, seed: true });
  if (r10 > 0) pushRecord(id, { ts: Date.now(), weight: r10, reps: 10, rpe: 10, seed: true });
  save(); closeAllModals(); render();
  toast(name + ' created' + (r1 || r10 ? ', weights will be prescribed from your maxes' : ''));
}

// ------------------------------------------------------------
// EXERCISE DETAIL MODAL (Info / History / Maxes / Settings)
// ------------------------------------------------------------
let XD = { id: null, tab: 'info' };
const CUES = {
  squat: ['Big air into your belt, brace 360°.', 'Knees out, spread the floor.', 'Hit depth every rep, every rep identical.'],
  bench: ['Pin the shoulder blades down and back.', 'Leg drive into the floor, butt on the bench.', 'Touch the same spot every rep.'],
  deadlift: ['Wedge in, take the slack out of the bar.', 'Push the floor away, bar tight to the legs.', 'Lock out with the glutes, not the lower back.'],
  press: ['Squeeze the glutes, ribs down.', 'Bar travels in a straight line, head through at the top.'],
  default: ['Move with intent, every rep crisp and identical.', 'Leave technique breakdown out of it; quality over grind.'],
};
function openExDetail(id, tab) {
  XD = { id, tab: tab || 'info' };
  showModal(renderExDetail);
}
function renderExDetail(anim) {
  const e = exById(XD.id);
  if (!e) { closeModal(); return; }
  const recs = recordsFor(XD.id);
  const inc = P()?.increments?.[XD.id] ?? Engine.defaultIncrement(XD.id);
  const tabBtn = t => `<button class="${XD.tab === t ? 'on' : ''}" onclick="XD.tab='${t}';rerenderTop()">${t[0].toUpperCase() + t.slice(1)}</button>`;
  let body = '';
  if (XD.tab === 'info') {
    const cues = CUES[e.movement] || CUES.default;
    body = `<div class="placeholder-media">🏋</div>
      <p class="subtle">${MOVEMENTS[e.movement]?.label || ''} · ${{bb:'Barbell',db:'Dumbbell',mc:'Machine',cb:'Cable',bw:'Bodyweight',bd:'Band'}[e.equipment] || ''}${e.isMain ? ' · Main lift' : ''}</p>
      <div class="section-title" style="font-size:1.1rem">Coaching cues</div>
      ${cues.map(c => `<div class="check-row">▸ ${c}</div>`).join('')}`;
  } else if (XD.tab === 'history') {
    body = recs.length ? [...recs].reverse().slice(0, 40).map(r =>
      `<div class="row" style="padding:9px 0;border-bottom:1px solid var(--line)">
        <span class="subtle">${fmtDate(r.ts)}${r.seed ? ' · seeded' : ''}</span>
        <b>${fmtW(XD.id, r.weight)} × ${r.reps} @ ${r.rpe ?? '–'}</b></div>`).join('')
      : '<p class="faint mt16">No logged sets yet.</p>';
  } else if (XD.tab === 'maxes') {
    const best = Engine.bestE1RM(recs);
    const wm = P()?.wm?.[XD.id];
    body = `
      ${wm ? `<div class="card accent"><div class="row"><span>Working Max</span><b>${kg(wm)} kg</b></div>
        <p class="faint mt8">All wave percentages run off this number (90% of your real 1RM).</p></div>` : ''}
      <div class="card"><div class="row"><span>Estimated 1RM</span><b>${best ? kg(Engine.roundLoad(best, 0.5)) + ' kg' : '—'}</b></div>
        <p class="faint mt8">Computed from your recent logged sets (weight, reps, RPE).</p></div>
      ${recs.length ? `<div class="section-title" style="font-size:1.05rem">Best recent sets</div>` +
        [...recs].sort((a, b) => Engine.e1rm(b.weight, b.reps, b.rpe) - Engine.e1rm(a.weight, a.reps, a.rpe)).slice(0, 5)
          .map(r => `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)">
            <span class="subtle">${fmtDate(r.ts)}</span>
            <span>${fmtW(XD.id, r.weight)} × ${r.reps} @ ${r.rpe ?? '–'} <b style="color:var(--blue)">→ ${kg(Engine.roundLoad(Engine.e1rm(r.weight, r.reps, r.rpe), 0.5))}</b></span></div>`).join('') : ''}`;
  } else {
    const isMainLift = P()?.wm && XD.id in P().wm;
    // Change 1: loading-mode control for every exercise, with a transient draft so the
    // count / bar-weight fields appear immediately as the mode select changes.
    if (!XD.load || XD.load.id !== XD.id) {
      const stored = (S.loadingProfiles || {})[XD.id] || {};
      const def = defaultLoadingFor(XD.id);
      XD.load = { id: XD.id, mode: stored.mode || def.mode, count: stored.count ?? def.count ?? 2, barWeight: stored.barWeight ?? 10 };
    }
    const Ld = XD.load;
    const modeOpts = [['barbell', 'Barbell'], ['lightbar', 'Light bar'], ['dumbbell', 'Dumbbell'],
                      ['machine', 'Machine'], ['cable', 'Cable'], ['bodyweight', 'Bodyweight'], ['band', 'Band']];
    const loadingUI = `
      <div class="section-title" style="font-size:1.05rem">Loading</div>
      <div class="field"><label>How is this loaded?</label>
        <select id="xd-mode" onchange="xdSetMode(this.value)">${modeOpts.map(([v, l]) => `<option value="${v}" ${Ld.mode === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      ${Ld.mode === 'dumbbell' ? `<div class="field"><label>Dumbbells used</label>
        <select id="xd-count">${[[2, 'Two (one per hand)'], [1, 'One (single dumbbell)']].map(([v, l]) => `<option value="${v}" ${Ld.count === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>` : ''}
      ${Ld.mode === 'lightbar' ? `<div class="field"><label>Bar weight (kg)</label>
        <input id="xd-bar" type="number" inputmode="decimal" value="${Ld.barWeight}"></div>` : ''}
      <p class="faint">Weights are stored as the total load moved; dumbbells display per hand. This setting persists across programs.</p>
      <button class="btn btn-blue mt8" onclick="saveExLoading()">Save loading</button>`;
    body = `
      ${isMainLift ? `
        <div class="field"><label>Working max (kg)</label>
          <input id="xd-wm" type="number" inputmode="decimal" value="${P().wm[XD.id] ?? ''}" placeholder="Not set, calibrates in week 1"></div>
        <div class="field"><label>Working-max increment per AMRAP rep (kg)</label>
          <input id="xd-inc" type="number" inputmode="decimal" step="0.25" value="${inc}"></div>
        <p class="faint">Book guidance: 2.5 kg/rep lower body, 1.25 kg/rep upper body. Halve it if progress stalls.</p>
        <button class="btn btn-blue mt8" onclick="saveExSettings()">Save</button>` :
        `<p class="subtle">Accessory weights are computed from your logged history (e1RM). Log honestly, the engine follows you.</p>`}
      ${loadingUI}
      ${e.custom ? `<button class="btn btn-outline mt16" style="color:var(--red);border-color:var(--red)" onclick="deleteCustomEx('${e.id}')">Delete custom exercise</button>` : ''}`;
  }
  $modal.innerHTML = modalShell(anim, esc(e.name),
    `<div class="tabs">${tabBtn('info')}${tabBtn('history')}${tabBtn('maxes')}${tabBtn('settings')}</div>${body}`);
}
function saveExSettings() {
  const wmv = parseFloat(document.getElementById('xd-wm').value);
  const incv = parseFloat(document.getElementById('xd-inc').value);
  if (wmv > 0) P().wm[XD.id] = wmv;
  if (incv > 0) P().increments[XD.id] = incv;
  save(); toast('Saved'); rerenderTop();
}
function xdSetMode(m) { if (XD.load) XD.load.mode = m; rerenderTop(); }
function saveExLoading() {
  const mode = document.getElementById('xd-mode').value;
  const prof = { mode };
  if (mode === 'dumbbell') prof.count = parseInt(document.getElementById('xd-count').value) || 2;
  if (mode === 'lightbar') prof.barWeight = parseFloat(document.getElementById('xd-bar').value) || 10;
  S.loadingProfiles = S.loadingProfiles || {};
  S.loadingProfiles[XD.id] = prof;
  XD.load = null; // re-init from the saved profile on next render
  save(); toast('Loading saved'); rerenderTop();
}
function deleteCustomEx(id) {
  confirmModal({
    title: 'Delete exercise?',
    message: 'This removes the custom exercise and every set logged against it. This cannot be undone.',
    confirmLabel: 'Delete exercise',
    danger: true,
  }, () => {
    S.customEx = S.customEx.filter(e => e.id !== id);
    delete S.records[id];
    save(); closeAllModals(); render();
  });
}

// ------------------------------------------------------------
// VIEW: MORE (hub) / PROGRAM / SETTINGS
// ------------------------------------------------------------
function vMore() {
  const link = (label, ic, fn) => `<button class="lib-item" onclick="${fn}">
    <span><span style="margin-right:10px">${ic}</span>${label}</span><span>›</span></button>`;
  return `${topbar('More')}<div class="view">
    <div class="section-title">${esc(S.profile.name || 'Lifter')}</div>
    <p class="faint" style="margin-bottom:14px">IRONWAVE · Juggernaut Method 2.0 engine</p>
    ${link('My Program', '📈', "nav('program')")}
    ${link('Exercises', '🏋', "nav('exercises')")}
    ${link('Settings & Data', '⚙', "nav('settings')")}
  </div>${tabbar()}`;
}

function vProgram() {
  if (!P()) return vOnboarding();
  const p = P();
  const lifts = ['comp-squat', 'comp-bench', 'comp-deadlift', 'military-press'];
  const blockRows = p.blocks.map((b, i) => {
    const startW = i * p.weeksPerBlock + 1;
    const status = i < p.pointer.block ? '✓' : i === p.pointer.block && !programDone() ? '●' : '○';
    const sch = Engine.schemeFor(b);
    return `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)">
      <span><b style="color:${BLOCK_COLORS[b.type]}">${status}</b> ${esc(b.label)}
        <span class="faint">· ${b.wave} wave · ${esc(sch.short || sch.label)}</span></span>
      <span class="subtle">W${startW}–${startW + p.weeksPerBlock - 1}</span></div>`;
  }).join('');
  return `${topbar('My Program')}<div class="view">
    <div class="section-title">Powerbuilding</div>
    <p class="faint" style="margin:-4px 0 10px">Methodology: ${esc(p.methodology || 'Juggernaut + Bodybuilding')}: ascending-volume hypertrophy blocks, book-wave strength blocks. Schemes never mix.</p>
    <div class="card">
      <div class="row"><span class="subtle">Test date</span><b>${fmtDateLong(p.testDate)}</b></div>
      <div class="row mt8"><span class="subtle">Days out</span><b>${daysOut()}</b></div>
      <div class="row mt8"><span class="subtle">Training days / week</span><b>${p.daysPerWeek}</b></div>
    </div>
    ${timelineHTML()}
    <div class="section-title" style="font-size:1.15rem">Blocks</div>
    ${blockRows}
    <p class="faint mt8">Hypertrophy blocks build volume week over week (sets climb, reps in reserve tighten) into the deload. Strength blocks run the book's waves, volume drops as intensity rises. Both end their last work week with an AMRAP on the mains that moves your working max, exactly like the book's formula.</p>
    <div class="section-title" style="font-size:1.15rem">Working Maxes</div>
    ${lifts.map(l => `<button class="lib-item" onclick="openExDetail('${l}','settings')">
      <span>${exName(l)}</span><b>${p.wm[l] ? kg(p.wm[l]) + ' kg' : 'Calibrating'}</b></button>`).join('')}
    <button class="btn btn-outline mt24" style="color:var(--red);border-color:var(--red)" onclick="confirmNewProgram()">Start New Program</button>
  </div>${tabbar()}`;
}
function confirmNewProgram() {
  confirmModal({
    title: 'Start a new program?',
    message: 'Your history, records and maxes stay. The current program pointer resets to week 1.',
    confirmLabel: 'Start new program',
  }, doNewProgram);
}
function doNewProgram() {
  const keepMaxes = {};
  for (const l of ['comp-squat', 'comp-bench', 'comp-deadlift', 'military-press']) {
    if (P()?.wm?.[l]) keepMaxes[l] = P().wm[l] / 0.9; // back to ~1RM for re-seed
  }
  // Carry the athlete's track and focus into the new cycle (landmarks/trainingAge
  // persist on profile and keep evolving; we do not reseed them here).
  const tr = S.profile.training || {};
  V.ob = { name: S.profile.name, bodyweight: S.profile.bodyweight,
           daysPerWeek: P()?.daysPerWeek || 4, maxes: keepMaxes,
           track: tr.track || 'powerbuilding',
           experience: S.profile.experience || 'intermediate',
           timeMode: tr.timeMode || 'unlimited',
           timeCapMin: tr.timeCapMin || '',
           muscleFocus: Object.assign({ arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 }, tr.muscleFocus || {}) };
  S.program = makeProgram(V.ob);
  save(); toast('New cycle created. Working maxes carried over');
  V.tab = 'dashboard'; nav('dashboard');
}

function vSettings() {
  const p = S.profile;
  return `${topbar('Settings')}<div class="view">
    <div class="section-title">Profile</div>
    <div class="field"><label>Name</label><input id="st-name" value="${esc(p.name)}"></div>
    <div class="field"><label>Bodyweight (kg)</label><input id="st-bw" type="number" inputmode="decimal" value="${p.bodyweight ?? ''}"></div>
    <div class="section-title">Barbell</div>
    <div class="field"><label>Bar weight (kg)</label><input id="st-bar" type="number" inputmode="decimal" value="${p.barWeight}"></div>
    <div class="field"><label>Load rounding (kg)</label>
      <select id="st-round">${[1.25, 2.5, 5].map(r => `<option ${p.rounding === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
    <div class="section-title">Dumbbells &amp; machines</div>
    <div class="field"><label>Dumbbell increment (kg per hand)</label>
      <select id="st-dbinc">${[1, 2, 2.5].map(r => `<option ${(p.dbIncrement ?? 2.5) === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
    <div class="field"><label>Machine / cable step (kg)</label>
      <select id="st-mcstep">${[2.5, 5, 10].map(r => `<option ${(p.machineStep ?? 5) === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
    <button class="btn btn-outline" onclick="openPlateConfig()">Configure Plates ›</button>
    <button class="btn btn-blue mt8" onclick="saveSettings()">Save Settings</button>
    <div class="section-title">Data</div>
    <p class="faint" style="margin-bottom:10px">iOS can evict browser storage after ~7 days of not visiting the site. Export a backup regularly.</p>
    <div class="btn-row">
      <button class="btn btn-outline" onclick="exportData()">Export JSON</button>
      <button class="btn btn-outline" onclick="document.getElementById('import-file').click()">Import JSON</button>
    </div>
    <input type="file" id="import-file" accept=".json,application/json" style="display:none" onchange="importData(this)">
    <button class="btn btn-outline mt16" style="color:var(--red);border-color:var(--red)" onclick="fullReset()">Erase everything</button>
  </div>${tabbar()}`;
}
function saveSettings() {
  S.profile.name = document.getElementById('st-name').value.trim();
  S.profile.bodyweight = parseFloat(document.getElementById('st-bw').value) || null;
  S.profile.barWeight = parseFloat(document.getElementById('st-bar').value) || 20;
  S.profile.rounding = parseFloat(document.getElementById('st-round').value) || 2.5;
  S.profile.dbIncrement = parseFloat(document.getElementById('st-dbinc').value) || 2.5;
  S.profile.machineStep = parseFloat(document.getElementById('st-mcstep').value) || 5;
  save(); toast('Settings saved');
}
function openPlateConfig() { showModal(renderPlateConfig); }
function renderPlateConfig(anim) {
  const rows = S.profile.plates.map((pl, i) => `
    <div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)">
      <span><i style="display:inline-block;width:14px;height:22px;border-radius:3px;background:${PLATE_COLORS[String(pl.w)] || '#6b7280'};vertical-align:middle;margin-right:10px"></i><b>${kg(pl.w)} kg</b></span>
      <span class="row" style="gap:14px">
        <button class="pm btn-ghost" style="font-size:1.4rem" onclick="plateCount(${i},-2)">−</button>
        <b id="pc-count-${i}">${pl.count}</b>
        <button class="pm btn-ghost" style="font-size:1.4rem" onclick="plateCount(${i},2)">＋</button>
      </span></div>`).join('');
  $modal.innerHTML = modalShell(anim, 'Configure Plates',
    `<p class="faint" style="margin-bottom:10px">Total plates you own per weight (pairs are used per side). The plate-math visual only suggests loads you can actually build.</p>${rows}`);
}
function plateCount(i, d) {
  S.profile.plates[i].count = Math.max(0, S.profile.plates[i].count + d);
  save();
  const el = byId('pc-count-' + i);
  if (el) { el.textContent = S.profile.plates[i].count; nudge(el, d); }
}
function exportData() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ironwave-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Backup exported');
}
function importData(input) {
  const f = input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || data.v !== 1) throw new Error('not an IRONWAVE backup');
      S = Object.assign(defaultState(), data);
      save();
      toast('Backup restored');
      V = { view: S.program ? 'dashboard' : 'onboarding', tab: 'dashboard', dayIdx: null,
            libTab: 'alpha', libSearch: '', obStep: 0, ob: null, draft: null };
      render();
    } catch (e) { toast('Import failed: ' + e.message, true); }
  };
  reader.readAsText(f);
  input.value = '';
}
function fullReset() {
  // Two-stage confirm for the most destructive action in the app.
  confirmModal({
    title: 'Erase everything?',
    message: 'This erases all of your data: program, history and records. This cannot be undone.',
    confirmLabel: 'Continue',
    danger: true,
  }, () => confirmModal({
    title: 'Last chance',
    message: 'Really erase everything? There is no way to recover this once it is gone.',
    confirmLabel: 'Erase everything',
    danger: true,
  }, doFullReset));
}
function doFullReset() {
  S = defaultState();
  save();
  V = { view: 'onboarding', tab: 'dashboard', dayIdx: null, libTab: 'alpha', libSearch: '', obStep: 0, ob: null, draft: null };
  render();
}

// ------------------------------------------------------------
// BOOT
// State now lives on the server (GET/POST /api/state), so the initial
// load is asynchronous. We must await it before computing the first
// view or rendering — otherwise S is a pending Promise and every view
// reads undefined off it.
// ------------------------------------------------------------
async function boot() {
  console.log('IRONWAVE build 2026-06-18b (server-storage, async-boot fix)');
  S = await loadState();
  V = { view: S.program ? 'dashboard' : 'onboarding', tab: 'dashboard',
        dayIdx: null, checkinStep: 0, checkinData: null, draft: null,
        libTab: 'alpha', libSearch: '', obStep: 0, ob: null };
  render();
}
boot();

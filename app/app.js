/* ============================================================
   IRONWAVE — app.js
   State, navigation, and all views. Vanilla JS, server-backed state
   via GET/POST /api/state (see server.js).
   ============================================================ */

'use strict';

// ------------------------------------------------------------
// STATE
// ------------------------------------------------------------
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
               phase: 'lean-gain', // [Cluster F] current training phase
               lang: 'auto',       // [i18n] app language, 'auto' = device
               landmarks: {} },
    program: null,
    bodyweight: [],   // [Cluster F] [{ts, kg}] light trend, no macro tracking
    records: {},      // exId -> [{ts, weight, reps, rpe, pump?, technique?}] (last 3 optional, Cluster A)
    loadingProfiles: {}, // exId -> { mode, count, barWeight } — per-exercise loading, persists across programs
    techniques: {},   // exId -> intensity technique id (e.g. 'drop'), Cluster B; empty = none
    flags: {},        // one-time UI flags (e.g. rirSeen), additive
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
// On-device persistence. The phone is the source of truth: state lives in
// localStorage so the installed PWA works fully offline (a gym with no signal).
// A reachable server (/api/state) is only a best-effort convenience for first
// install and desktop use; it is never required.
const LS_KEY = 'ironwave-state';
function localLoad() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { console.warn('local load failed', e); return null; }
}
function localSave(s) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(LS_KEY, JSON.stringify(s));
    return true;
  } catch (e) { console.warn('local save failed', e); return false; }
}
async function loadState() {
  // 1) On-device store wins (offline-first, phone is source of truth).
  const local = localLoad();
  if (local) {
    const s = Object.assign(defaultState(), local);
    migrateState(s);
    return s;
  }
  // 2) First run on this device: seed from the server if one is reachable.
  try {
    const res = await fetch('/api/state');
    if (res.ok) {
      const s = Object.assign(defaultState(), await res.json());
      migrateState(s);
      localSave(s); // adopt it locally so future loads are offline-capable
      return s;
    }
  } catch (e) { console.warn('state load failed', e); }
  // 3) Nothing anywhere: a fresh default.
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
    if (s.program.blocks.some(b => b.phase == null)) stampBlockPhase(s.program.blocks); // [Epic G1]
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
  if (!s.techniques) s.techniques = {}; // Cluster B opt-in map, additive and inert when empty
  if (!s.flags) s.flags = {};           // one-time UI flags, additive
  if (!p.phase) p.phase = 'lean-gain';  // [Cluster F] training phase
  if (!p.lang) p.lang = 'auto';         // [i18n] app language, 'auto' = device
  if (p.restNotify == null) p.restNotify = false; // rest-done notification opt-in
  if (!Array.isArray(s.bodyweight)) s.bodyweight = []; // [Cluster F] bodyweight trend
  if (s.program && !s.program.volAdj) s.program.volAdj = {}; // [Cluster E] per-muscle autoreg
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
  // On-device write first: this is the durable store, and it is synchronous so
  // it succeeds with no network. Only a genuine local-write failure (e.g. quota)
  // is real data loss worth surfacing.
  const persisted = localSave(S);
  if (!persisted && typeof toast === 'function') toast('Save failed, data not persisted', true);
  // Best-effort mirror to the server when one is reachable. Failure here is
  // expected offline and is NOT data loss, so it stays silent.
  _saveChain = _saveChain.then(async () => {
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(S)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
    } catch (e) {
      console.warn('server mirror failed (using local store)', e);
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
const fmtDate = ts => new Date(ts).toLocaleDateString(I18N.dateLocale(), { weekday:'short', month:'short', day:'numeric' });
const fmtDateLong = ts => new Date(ts).toLocaleDateString(I18N.dateLocale(), { weekday:'long', month:'long', day:'numeric', year:'numeric' });
const kg = w => (w % 1 === 0 ? w : w.toFixed(1));
// [Cluster A] RIR-first display. The athlete sees reps-in-reserve everywhere;
// the stored intensity stays RPE (rir = 10 - rpe), so the engine is untouched.
const fmtRir = rpe => (rpe == null ? '–' : t('unit.rir', { n: kg(Engine.rpeToRir(rpe)) }));
// One icon per pump level so a glance at history tells the level apart.
const PUMP_ICONS = { 1: '👍', 2: '💪', 3: '🔥' };
// Translated effort description for an RPE value; unknown values render empty.
const rpeDesc = rpe => (RPE_DESCRIPTIONS[rpe] ? t('rpe.' + rpe) : '');
const pumpBadge = p => (p ? ` <small class="faint">${PUMP_ICONS[p] || '🔥'} ${esc(PUMP_LABELS[p] ? t('pump.' + p) : t('pump.generic'))}</small>` : '');
const techniqueBadge = tech => (tech && tech !== 'straight' ? ` <small class="faint">${esc(TECHNIQUE_LABELS[tech] ? t('tech.' + tech) : tech)}</small>` : '');
// [Cluster B] "70kg×8, 56kg×8" rendering of a set's child mini-sets (drop or myo).
const dropDetail = (exId, drops) => (drops || []).map(d => `${fmtW(exId, d.weight)}×${d.reps}`).join(', ');
// Label for the logged child mini-sets, by technique.
const childWord = tech => t('tech.word_' + (['myo', 'restpause', 'partials'].includes(tech) ? tech : 'drop'));
// Heading for the perf-modal child-set section, by technique.
const childSectionLabel = tech => {
  const k = ['myo', 'restpause', 'partials'].includes(tech) ? tech : 'drop';
  return `${esc(t(`tech.child_${k}_title`))} <small class="faint">${esc(t(`tech.child_${k}_hint`))}</small>`;
};
// [Cluster C] Compact picker badges: muscle region (head), a loaded-stretch flag,
// and a non-default SFR so the high-value and high-cost picks stand out at a glance.
function exTagsHTML(e) {
  if (!e) return '';
  let out = '';
  if (e.head && HEAD_LABELS[e.head]) out += `<span class="ex-tag head">${HEAD_LABELS[e.head]}</span>`;
  if (e.stretch) out += `<span class="ex-tag stretch">Stretch</span>`;
  if (e.sfr && e.sfr !== 2) out += `<span class="ex-tag sfr s${e.sfr}">SFR ${SFR_LABELS[e.sfr]}</span>`;
  return out ? `<span class="ex-tags">${out}</span>` : '';
}
// [Cluster C] Fuller stimulus block for the exercise detail Info tab.
function exMetaCardHTML(e) {
  if (!e) return '';
  const rows = [`<div class="row"><span class="subtle">Stimulus to fatigue</span><b>${SFR_LABELS[e.sfr] || 'Moderate'}</b></div>`];
  if (e.head && HEAD_LABELS[e.head]) rows.push(`<div class="row"><span class="subtle">Region bias</span><b>${HEAD_LABELS[e.head]}</b></div>`);
  if (e.stretch) rows.push(`<div class="row"><span class="subtle">Emphasis</span><b>Loaded stretch</b></div>`);
  return `<div class="section-title" style="font-size:1.1rem">Stimulus</div>
    <div class="card">${rows.join('<div class="divider"></div>')}</div>
    <p class="faint">SFR is our own read of growth stimulus per unit of fatigue. Higher means more reward for less systemic cost, handy when you are adding volume late in a block. A loaded stretch tends to grow muscle well for the fatigue it costs.</p>`;
}

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
// Athlete-facing equipment labels and a stable display order for the
// equipment filter chips on the swap / select / add-exercise pickers.
const EQUIP_LABEL = { bb: 'Barbell', db: 'Dumbbell', mc: 'Machine', cb: 'Cable', bw: 'Bodyweight', bd: 'Band', kb: 'Kettlebell' };
const EQUIP_ORDER = ['bb', 'db', 'mc', 'cb', 'bw', 'bd', 'kb'];
// One filter-chip row shared by every exercise picker. `fnName` is the
// global handler invoked with the chosen equipment id (or 'all').
function equipChips(equips, current, fnName) {
  const chip = (val, label) => `<button class="fchip ${current === val ? 'on' : ''}" onclick="${fnName}('${val}')">${label}</button>`;
  return `<div class="filter-chips">${chip('all', 'All')}${equips.map(eq => chip(eq, EQUIP_LABEL[eq] || eq)).join('')}</div>`;
}

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
  return d.unit === 'kg per hand' ? `${kg(d.value)}${t('unit.kg_hand')}` : `${kg(d.value)}${t('unit.kg')}`;
}

function toast(msg, warn) {
  const root = document.getElementById('toast-root');
  const t = document.createElement('div');
  t.className = 'toast' + (warn ? ' warn' : '');
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
// Toast with a single tappable action (e.g. Undo). Stays up a little longer so
// the action is reachable.
function toastAction(msg, label, fn) {
  const root = document.getElementById('toast-root');
  const t = document.createElement('div');
  t.className = 'toast has-action';
  const span = document.createElement('span');
  span.textContent = msg;
  const btn = document.createElement('button');
  btn.className = 'toast-action';
  btn.textContent = label;
  btn.onclick = () => { t.remove(); fn(); };
  t.appendChild(span);
  t.appendChild(btn);
  root.appendChild(t);
  setTimeout(() => t.remove(), 6000);
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
// [Epic G1] Stamp each block's default training phase from its type, so the
// macrocycle timeline can group and color blocks by phase. Additive and
// display-only for now (does not feed prescription); later epics let the athlete
// set richer per-block phases and wire them into the autoregulator.
function stampBlockPhase(blocks) {
  blocks.forEach(b => { if (b.phase == null) b.phase = DEFAULT_BLOCK_PHASE[b.type] || 'lean-gain'; });
}
// [Epic G6] Overwrite each block's phase from a goal archetype's phase cycle
// (cycled across however many blocks there are). Bodybuilding-only at the call
// site, so the default/powerbuilding golden master is untouched.
function applyArchetypePhases(blocks, archetypeId) {
  const arch = GOAL_ARCHETYPES[archetypeId];
  if (!arch || !arch.phaseCycle || !arch.phaseCycle.length) return;
  blocks.forEach((b, i) => { b.phase = arch.phaseCycle[i % arch.phaseCycle.length]; });
}
// [Realism] The final strength block is the taper/peak into the meet, so a
// strength-ending track (powerlifting / powerbuilding) reads as Peak at the end,
// matching the run-in shown in the mockups. Creation-time only (migration stays
// conservative, and the plan editor lets the athlete set phases explicitly).
function markPeakBlock(blocks) {
  const last = blocks[blocks.length - 1];
  if (last && last.type === 'strength') last.phase = 'peak';
}
// [Epic G2] Build a block list of `targetCount` blocks by cycling the template's
// block pattern, then renumber the per-type labels so they read 1..N. Used only
// when the athlete picks a custom macrocycle length; the default path passes the
// template blocks through untouched, so the golden master is unaffected. (Variable
// per-block week counts are a deeper, scheme-level change and stay future work;
// this slice varies the block COUNT at the fixed weeks-per-block.)
function extendBlocks(tplBlocks, targetCount) {
  const out = [];
  for (let i = 0; i < targetCount; i++) {
    out.push(JSON.parse(JSON.stringify(tplBlocks[i % tplBlocks.length])));
  }
  return relabelBlocks(out);
}
// [Epic G2/G4] Renumber per-type block labels so they read 1..N in order.
function relabelBlocks(blocks) {
  const counts = {};
  blocks.forEach(b => {
    const base = b.type === 'hypertrophy' ? 'Hypertrophy' : b.type === 'strength' ? 'Strength' : (b.label || b.type);
    counts[base] = (counts[base] || 0) + 1;
    b.label = base + ' ' + counts[base];
  });
  return blocks;
}
// [Epic G4] A fresh block for the plan editor (athlete then sets type/wave/phase).
function newPlanBlock() {
  return { type: 'hypertrophy', scheme: 'jbb-hyp', wave: '8s', label: 'Hypertrophy', phase: 'lean-gain' };
}
// [Epic G4] Recompute a program's blocks after the plan editor edits the future:
// the locked (already started) blocks are kept verbatim, the edited draft is
// appended, then mesoIdx/phase/labels are re-stamped across the whole list and the
// test date is recomputed from the new block count (startDate preserved).
function commitPlan(program, lockedBlocks, draftBlocks) {
  const blocks = lockedBlocks.concat(draftBlocks).map(b => JSON.parse(JSON.stringify(b)));
  stampMesoIdx(blocks);
  stampBlockPhase(blocks); // fills any missing phase; explicit ones are kept
  relabelBlocks(blocks);
  const testDate = program.startDate + blocks.length * program.weeksPerBlock * 7 * 864e5;
  return { blocks, testDate };
}
// [Epic G2] How many fixed-length blocks best fit a target macrocycle length in
// weeks, clamped to a sane range (a short cut up to a long planned macro).
function blocksForWeeks(weeks, weeksPerBlock) {
  const n = Math.round(weeks / weeksPerBlock);
  return Math.max(2, Math.min(12, n));
}
function makeProgram(ob) {
  // Track selects the block periodization; day layouts are shared. Defaults to
  // powerbuilding so an onboarding without a track behaves exactly as before.
  const track = ob.track || 'powerbuilding';
  const tpl = PROGRAM_TEMPLATES[track] || PROGRAM_TEMPLATES.powerbuilding;
  // [Epic G2] A custom macrocycle length (weeks) rebuilds the block list to fit;
  // no length keeps the template verbatim, so the default path stays byte-identical.
  const blocks = ob.macroWeeks
    ? extendBlocks(tpl.blocks, blocksForWeeks(ob.macroWeeks, tpl.weeksPerBlock))
    : JSON.parse(JSON.stringify(tpl.blocks));
  stampMesoIdx(blocks);
  stampBlockPhase(blocks);
  markPeakBlock(blocks); // [Realism] strength-ending tracks taper into a peak
  // [Epic G6] A bodybuilding goal archetype overrides the default per-block phases
  // with its own sequence (lean-fast vs serious macro). Inert on other tracks.
  if (track === 'bodybuilding' && ob.goalArchetype) applyArchetypePhases(blocks, ob.goalArchetype);
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
  // Bodybuilding: generate the split from the athlete's muscle focus (frequency
  // driven, region days proportional to slider points). Falls back to the fixed
  // hypertrophy templates if generation cannot produce a full week. Other tracks
  // keep the strength-oriented shared templates untouched.
  let days;
  if (track === 'bodybuilding') {
    days = generateBodybuildingDays(focus, ob.daysPerWeek);
    if (!days || days.length !== ob.daysPerWeek) {
      days = JSON.parse(JSON.stringify((BB_DAY_TEMPLATES[ob.daysPerWeek] || DAY_TEMPLATES[ob.daysPerWeek])));
    }
  } else {
    days = JSON.parse(JSON.stringify(DAY_TEMPLATES[ob.daysPerWeek]));
  }
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
    volAdj: {},    // [Cluster E] per-muscle accumulated set adjustment from feedback
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
// [Cluster C] Head/SFR-aware accessory selection shared by the generator and the
// cross-meso rotation. All bodybuilding-only callers, so the default routine
// never reaches this and the golden master holds.
function accHead(id) { return (exById(id) || {}).head || null; }
function muscleOfAcc(id) {
  for (const m of Object.keys(DEFAULT_ACC)) if (DEFAULT_ACC[m].includes(id)) return m;
  return null;
}
// Pick from a muscle's ordered pool: prefer the first not-yet-used exercise that
// covers a head we have not hit for this muscle (so frequency spreads across
// regions), then any unused, then the head of the pool. `rot` rotates the pool's
// start so successive mesos surface different exercises (cross-meso rotation).
// Pure given exById.
function pickAccessory(pool, used, usedHeads, rot = 0) {
  if (!pool || !pool.length) return null;
  const n = pool.length, off = ((rot % n) + n) % n;
  const order = pool.map((_, i) => pool[(i + off) % n]);
  const newHead = id => { const h = accHead(id); return !h || !usedHeads.has(h); };
  return order.find(id => !used.has(id) && newHead(id))
      || order.find(id => !used.has(id))
      || order[0];
}
// ------------------------------------------------------------
// BODYBUILDING SPLIT GENERATOR (frequency-driven)
// Builds the week from the muscle-focus sliders: focus = frequency. Region day
// counts are proportional to slider points (upper vs lower); each muscle's
// weekly frequency (SPLIT_FREQ) is spread across its region's days; the highest-
// ranked muscle on a day becomes its primary focus and gets a compound anchor.
// Runs once at program creation; sliders are fixed for the cycle.
// ------------------------------------------------------------
function generateBodybuildingDays(focus, N) {
  const freq = {};
  for (const m of FOCUS_KEYS) if (SPLIT_FREQ[focus[m]]) freq[m] = SPLIT_FREQ[focus[m]];
  const pts = ms => ms.reduce((s, m) => s + (focus[m] || 0), 0);
  const upPts = pts(UPPER_MUSCLES), loPts = pts(LOWER_MUSCLES);
  if (upPts + loPts === 0) return []; // everything removed -> fall back / empty-day guard
  const upHas = UPPER_MUSCLES.some(m => freq[m]), loHas = LOWER_MUSCLES.some(m => freq[m]);
  let upDays = Math.round(N * upPts / (upPts + loPts));
  let loDays = N - upDays;
  // Do not strand a region that has trained muscles, and do not spend days on an
  // empty region.
  if (!upHas) { upDays = 0; loDays = N; }
  else if (!loHas) { upDays = N; loDays = 0; }
  else { if (upDays === 0) { upDays = 1; loDays = N - 1; } if (loDays === 0) { loDays = 1; upDays = N - 1; } }

  const used = new Set();
  const headsUsed = {};
  const usedMains = new Set();
  // [Cluster C] Head-aware pick: a muscle trained 2-3x spreads across its heads
  // (e.g. upper then mid/lower chest) instead of doubling one region.
  const pick = m => {
    const hs = headsUsed[m] || (headsUsed[m] = new Set());
    const id = pickAccessory(DEFAULT_ACC[m] || [], used, hs);
    if (id) { used.add(id); const h = accHead(id); if (h) hs.add(h); }
    return id;
  };
  const accSlot = m => { const id = pick(m); return id ? { type: 'acc', cat: (exById(id) || {}).movement, def: id } : null; };

  function buildRegion(muscles, nDays) {
    if (nDays <= 0) return [];
    const rms = muscles.filter(m => freq[m]);
    if (!rms.length) return [];
    // 1. Assign a PRIMARY (the day's focus + anchor) to each day, rotating across
    //    the anchor-capable muscles so leadership spreads (a Chest day, a Shoulder
    //    day, a Back day) rather than the top slider leading every day.
    // A muscle can lead a day if it is anchor-capable (rank >= 2). Glutes is gated
    // on being trained twice or more a week so a de-emphasized (1x) glute does not
    // claim a whole day; this gives the lower region a second lead besides Legs.
    const canLead = m => ANCHOR_RANK[m] >= 2 && (m !== 'glutes' || freq[m] >= 2);
    const anchorM = rms.filter(canLead);
    const leadPool = (anchorM.length ? anchorM : rms);
    const primaryOf = [], primCount = {};
    for (let i = 0; i < nDays; i++) {
      const cand = leadPool.slice().sort((a, b) =>
        ((primCount[a] || 0) - (primCount[b] || 0)) || (focus[b] - focus[a]));
      const m = cand[0];
      primaryOf.push(m); primCount[m] = (primCount[m] || 0) + 1;
    }
    // 2. Spread each muscle's remaining frequency (beyond its primary days) as
    //    accessories across the least-loaded days, avoiding repeats on a day.
    const day = primaryOf.map(p => ({ primary: p, acc: [], load: 1 }));
    for (const m of rms.slice().sort((a, b) => focus[b] - focus[a])) {
      let r = freq[m] - (primCount[m] || 0);
      while (r-- > 0) {
        const avail = day.map((d, i) => i).filter(i => day[i].primary !== m && !day[i].acc.includes(m));
        const pool = (avail.length ? avail : day.map((d, i) => i)).sort((a, b) => day[a].load - day[b].load);
        const di = pool[0]; day[di].acc.push(m); day[di].load++;
      }
    }
    // 3. Build slots: primary anchor (a working-max main the first time that lift
    //    appears, a secondary volume exposure after), then one accessory per other
    //    muscle, an extra for an emphasized (>=5) primary, padded to >= 3.
    return day.map(d => {
      const slots = [];
      const a = PRIMARY_ANCHOR[d.primary];
      if (a && a.main) {
        if (!usedMains.has(a.main)) { usedMains.add(a.main); slots.push({ type: 'main', lift: a.main }); }
        else slots.push({ type: 'secondary', lift: a.main, baseLift: a.main });
      } else if (a && a.acc && !used.has(a.acc)) { used.add(a.acc); slots.push({ type: 'acc', cat: (exById(a.acc) || {}).movement, def: a.acc }); }
      else { const s = accSlot(d.primary); if (s) slots.push(s); }
      for (const m of d.acc) { const s = accSlot(m); if (s) slots.push(s); }
      if (focus[d.primary] >= 5) { const s = accSlot(d.primary); if (s) slots.push(s); }
      let g = 0;
      while (slots.length < 3 && g++ < 6) { const s = accSlot(d.primary); if (!s) break; slots.push(s); }
      const region = UPPER_MUSCLES.includes(d.primary) ? 'Upper' : 'Lower';
      // `primary` is carried for the same-muscle spacing pass below; render reads
      // only name + slots, so the extra field is inert everywhere else.
      return { name: `${region} · ${FOCUS_LABELS[d.primary] || d.primary}`, slots, primary: d.primary };
    });
  }
  const up = buildRegion(UPPER_MUSCLES, upDays);
  const lo = buildRegion(LOWER_MUSCLES, loDays);
  // Interleave so the smaller region's days are spread out, not clustered.
  const total = up.length + lo.length;
  const small = up.length >= lo.length ? lo : up;
  const big = small === lo ? up : lo;
  const pos = new Set();
  for (let j = 0; j < small.length; j++) pos.add(Math.min(total - 1, Math.round((j + 1) * total / (small.length + 1)) - 1));
  const out = []; let bi = 0, si = 0;
  for (let i = 0; i < total; i++) {
    if (pos.has(i) && si < small.length) out.push(small[si++]);
    else if (bi < big.length) out.push(big[bi++]);
    else out.push(small[si++]);
  }
  return spaceSameMuscle(out);
}
// When one muscle leads two days, the region build + interleave can leave them
// adjacent. This greedy pass pulls a later, differently-themed day up between
// them so repeated focus days get a recovery gap. Unavoidable cases (a region of
// a single lead) are left as-is.
function spaceSameMuscle(days) {
  for (let i = 1; i < days.length; i++) {
    const dup = days[i].primary;
    if (!dup || dup !== days[i - 1].primary) continue;
    for (let j = i + 1; j < days.length; j++) {
      const cand = days[j].primary;
      if (cand === dup || cand === days[i - 1].primary) continue; // would not break it
      // Do not create a fresh adjacency where the duplicate lands (slot j).
      const jl = days[j - 1] && days[j - 1].primary, jr = days[j + 1] && days[j + 1].primary;
      if (dup === jl || dup === jr) continue;
      [days[i], days[j]] = [days[j], days[i]];
      break;
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
// Day theme label (e.g. "Upper A", "Push") shown as a subtitle. Empty for the
// plain "Day N" templates so we never render "Day 1 · Day 1".
function dayTheme(d) { return (d && d.name && !/^Day \d+$/.test(d.name)) ? d.name : ''; }

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
  // [Cluster D] An early (autoregulated) deload remaps this one triggered week to
  // the deload slot so the scheme prescribes it exactly like the scheduled week-5
  // deload. Inert off the bodybuilding track and absent by default, so every other
  // slot is byte-identical (golden master safe). weekMod still keys off the real
  // week index below.
  const eIdx = effectiveWeekIdx(blockIdx, wIdx);
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
    let sets = sch.main(block, eIdx, P().wm[wmKey], r, modPct, S.profile.experience);
    if (mod) sets = applySetDelta(sets, mod.mainSetDelta || 0);
    return { exId, name: exName(exId), sets, isMain: true, wmKey };
  }
  if (slot.type === 'secondary') {
    const wmKey = slot.baseLift || slot.lift;
    const exId = slot.ex || slot.lift;
    const rm = bbLiftRemoval(exId);
    if (rm) return { exId, name: exName(exId), sets: [], isSecondary: true, wmKey, isRemoved: true, removedReason: rm };
    const r = loadingFor(exId).totalInc;
    let sets = sch.secondary(block, eIdx, P().wm[wmKey], r, (slot.pctMod || 1) * modPct, S.profile.experience);
    // [Cluster D] Extend the autoregulated deload depth/intensity to the secondary
    // on the deload week (it previously only reached accessories). Inert off the
    // bodybuilding track / off the deload week, so the golden master is unchanged.
    const sdld = deloadDepthDelta(blockIdx, eIdx);
    if (sdld) sets = applySetDelta(sets, sdld);
    const srpd = deloadIntensityDelta(blockIdx, eIdx);
    if (srpd) sets = applyDeloadIntensity(sets, srpd);
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
  let sets = sch.accessory(block, eIdx, recordsFor(exId), r, S.profile.experience);
  const dld = deloadDepthDelta(blockIdx, eIdx); // [Cluster D] autoregulated deload depth (sets)
  if (dld) sets = applySetDelta(sets, dld);
  const rpd = deloadIntensityDelta(blockIdx, eIdx); // [Cluster D] deeper deload also eases effort
  if (rpd) sets = applyDeloadIntensity(sets, rpd);
  if (mod) sets = applySetDelta(sets, mod.accSetDelta || 0);
  const focus = focusForAccessory(exId, sets);
  if (focus.removed) return { exId, name: exName(exId), sets: [], cat: slot.cat, isRemoved: true };
  if (focus.delta) sets = applySetDelta(sets, focus.delta);
  const adj = autoregForAccessory(exId, sets, eIdx);
  if (adj) sets = applySetDelta(sets, adj);
  // [Cluster D] Per-muscle early deload: pull this muscle back on any work week
  // until cleared or block end. A deloaded muscle skips its finisher technique (a
  // finisher would fight the deload). Redundant on the actual deload week, so it
  // only applies off it. Inert off the bodybuilding track and with no deload list.
  if (Engine.weekType(eIdx) !== 'deload' && isAccessoryMuscleDeloaded(exId)) {
    sets = applyMuscleDeload(sets);
  } else {
    sets = applyTechnique(exId, sets, r);
  }
  return { exId, name: exName(exId), sets, cat: slot.cat };
}
// [Cluster D] Autoregulated deload depth applied to a bodybuilding accessory on
// the deload week: the per-block plan (sized to accumulated fatigue at the end of
// the peak week, stored on P().deloadPlan) deepens or lightens the scheme's
// already-halved deload by a set. Inert off the bodybuilding track, off the
// deload week, or without a plan, so the default routine is byte-identical.
function deloadDepthDelta(blockIdx, wIdx) {
  const p = P();
  const tc = p && p.trainingConfig;
  if (!tc || tc.track !== 'bodybuilding') return 0;
  if (Engine.weekType(wIdx) !== 'deload') return 0;
  return (p.deloadPlan && p.deloadPlan.setDelta) || 0;
}
// [Cluster D] Intensity half of the autoregulated deload: a DEEPER deload also
// eases effort (the plan's rpeDelta, negative = more reps in reserve), not just
// set count. Same gates as the depth delta (bodybuilding, deload week, a plan), so
// the default routine is byte-identical. 0 for a standard/light deload.
function deloadIntensityDelta(blockIdx, wIdx) {
  const p = P();
  const tc = p && p.trainingConfig;
  if (!tc || tc.track !== 'bodybuilding') return 0;
  if (Engine.weekType(wIdx) !== 'deload') return 0;
  return (p.deloadPlan && p.deloadPlan.rpeDelta) || 0;
}
// Apply an RPE delta to the plain working sets only (never an amrap, ramp, or
// calibration set, nor a weightless/RPE-less set), clamped to a sane range so a
// deload set stays light but real. Returns a new array; never mutates inputs.
function applyDeloadIntensity(sets, rpeDelta) {
  if (!rpeDelta) return sets;
  return sets.map(s => (s.amrap || s.ramp || s.calib || s.rpe == null)
    ? s
    : Object.assign({}, s, { rpe: Math.max(5, Math.min(10, s.rpe + rpeDelta)) }));
}
// [Cluster D] Per-muscle early deload: the athlete (or the overreach prompt) can
// pull back a single fatigued muscle for the rest of the block WITHOUT deloading
// everything. Transient on the program (`program.muscleDeload`, a list of muscle
// keys), cleared at block end, so no migration. Bodybuilding-only.
function muscleDeloadList() { const p = P(); return (p && p.muscleDeload) || []; }
function isMuscleDeloaded(mv) {
  const tc = P() && P().trainingConfig;
  return !!(tc && tc.track === 'bodybuilding' && muscleDeloadList().indexOf(mv) >= 0);
}
// The single landmark muscle an accessory belongs to: its own movement when that
// is a landmark, otherwise the muscle it covers most (so e.g. an incline bench
// rolls up to chest). Used to decide whether a per-muscle deload touches it.
function accessoryPrimaryMuscle(exId) {
  const e = exById(exId);
  if (!e) return null;
  if (VOLUME_LANDMARKS[e.movement]) return e.movement;
  const cov = SYNERGIST_COVERAGE[e.movement];
  if (!cov) return null;
  return Object.keys(cov).reduce((best, m) => (cov[m] > ((best && cov[best]) || 0) ? m : best), null);
}
function isAccessoryMuscleDeloaded(exId) {
  const mv = accessoryPrimaryMuscle(exId);
  return mv != null && isMuscleDeloaded(mv);
}
// Pull a deloaded muscle's accessory back: halve the plain working sets (floor at
// one) and ease effort by one RIR. Applied on any work week until cleared or block
// end. Returns a new array; never mutates inputs.
function applyMuscleDeload(sets) {
  const plain = sets.filter(s => !s.amrap && !s.ramp && !s.calib).length;
  let out = sets;
  if (plain > 1) out = applySetDelta(out, -Math.floor(plain / 2));
  return applyDeloadIntensity(out, -1);
}
// Toggle a muscle's per-block deload from the volume screen.
function toggleMuscleDeload(mv) {
  const p = P();
  if (!p.muscleDeload) p.muscleDeload = [];
  const i = p.muscleDeload.indexOf(mv);
  const label = MOVEMENTS[mv] ? MOVEMENTS[mv].label : mv;
  if (i >= 0) { p.muscleDeload.splice(i, 1); toast(`${label}: back to full volume`); }
  else { p.muscleDeload.push(mv); toast(`${label}: deloaded for the rest of this block`); }
  save(); render();
}
// [Cluster D] Early-deload state (transient on the program, like deloadPlan, so no
// migration). `earlyDeload = { block, week }` marks the one work week the athlete
// converted to a deload. These helpers are the single source of truth for "is the
// current week an early deload" and "what week index should the engine prescribe".
function isEarlyDeloadActive() {
  const p = P();
  const tc = p && p.trainingConfig;
  if (!tc || tc.track !== 'bodybuilding') return false; // bodybuilding-only, per the invariant
  const ed = p.earlyDeload;
  return !!(ed && ed.block === p.pointer.block && ed.week === p.pointer.week);
}
function effectiveWeekIdx(blockIdx, wIdx) {
  const p = P();
  const tc = p && p.trainingConfig;
  if (tc && tc.track === 'bodybuilding') {
    const ed = p.earlyDeload;
    if (ed && ed.block === blockIdx && ed.week === wIdx) return p.weeksPerBlock - 1; // deload slot
  }
  return wIdx;
}
// The fatigue read behind the early-deload suggestion, reused so the banner copy
// and the depth sizing on accept use the same inputs. Null unless the athlete is
// on a mid-block work week of a bodybuilding block (intro/realization/deload are
// not eligible) and not already in an early deload.
function earlyDeloadAdvice() {
  const p = P();
  const tc = p && p.trainingConfig;
  if (!tc || tc.track !== 'bodybuilding') return null;
  const wt = Engine.weekType(p.pointer.week);
  if (wt !== 'accumulation' && wt !== 'intensification') return null;
  if (isEarlyDeloadActive()) return null;
  return Engine.earlyDeloadAdvised(fatigueStatuses(), readinessTrendingDown());
}
// Per-muscle volumeStatus objects for the muscles trained this week, the shared
// input to the deload depth sizing and the early-deload trigger.
function fatigueStatuses() {
  const lm = (S.profile && S.profile.landmarks) || {};
  const tally = weeklyVolumeByMuscle();
  return VOL_ORDER.filter(mv => tally[mv] > 0)
    .map(mv => Engine.volumeStatus(tally[mv], lm[mv] || VOLUME_LANDMARKS[mv]));
}
// Pull the current block's deload in early: size the deload depth from this
// block's fatigue (same as advanceWeek does entering a scheduled deload) and mark
// the week. Completing this week then ends the block resensitized.
function acceptEarlyDeload() {
  const p = P();
  p.deloadPlan = Engine.deloadDepth(fatigueStatuses(), readinessTrendingDown());
  p.earlyDeload = { block: p.pointer.block, week: p.pointer.week };
  save(); closeAllModals();
  toast('Deload pulled in early. This week is now a deload, then your next block starts resensitized.');
  render();
}
function confirmEarlyDeload() {
  confirmModal({
    title: 'Deload now?',
    message: 'This converts the rest of this week into a deload and ends the block early, so the remaining weeks are skipped and your next block starts fresh (resensitized). You can resume the normal block until you complete this week.',
    confirmLabel: 'Deload now',
  }, acceptEarlyDeload);
}
function cancelEarlyDeload() {
  const p = P();
  p.earlyDeload = null;
  p.deloadPlan = null; // a mid-block week carries no scheduled deload plan otherwise
  save(); render();
}
function dismissEarlyDeloadSuggestion() {
  const p = P();
  p.earlyDeloadDismissedWeek = globalWeekNum(); // self-invalidates next week
  save(); render();
}
// Dashboard surface for the early-deload trigger: the active note while a deload
// is pulled in, otherwise the fatigue-driven suggestion (unless dismissed this
// week). Empty whenever no early deload applies, so other tracks/weeks render
// nothing. No em dashes (athlete-facing).
function earlyDeloadBannerHTML() {
  const p = P();
  if (isEarlyDeloadActive()) {
    return `<div class="card accent mt8" style="border-left:3px solid var(--amber)">
      <div style="font-weight:700">⚡ Early deload this week</div>
      <p class="faint mt8">Pulled in early to shed fatigue. Finish this lighter week, then your next block starts fresh. <button class="link-btn" onclick="cancelEarlyDeload()">Resume normal block</button></p></div>`;
  }
  const adv = earlyDeloadAdvice();
  if (!adv || !adv.advised) return '';
  if (p.earlyDeloadDismissedWeek === globalWeekNum()) return '';
  return `<div class="card accent mt8" style="border-left:3px solid var(--amber)">
    <div style="font-weight:700">⚡ Fatigue says deload now</div>
    <p class="faint mt8">${esc(adv.reason)}. You can pull this block's deload in early, recover, and start your next block resensitized instead of grinding to week 5.</p>
    <div class="btn-row mt8">
      <button class="btn btn-outline" onclick="dismissEarlyDeloadSuggestion()">Keep pushing</button>
      <button class="btn btn-blue" onclick="confirmEarlyDeload()">Deload now</button>
    </div></div>`;
}
// [Cluster E] Per-muscle autoregulation applied to prescribed accessory volume.
// Reads the accumulated, feedback-driven offset on P().volAdj (updated weekly),
// bounded by the same per-session landmark cap focus uses. Bodybuilding-only and
// inert when there is no offset, so other tracks and a fresh program (no logged
// feedback) stay byte-identical to the pre-autoreg routine (golden master safe).
function autoregForAccessory(exId, sets, wIdx) {
  const tc = P() && P().trainingConfig;
  if (!tc || tc.track !== 'bodybuilding') return 0;
  const e = exById(exId);
  const offset = e && P().volAdj && P().volAdj[e.movement];
  if (!offset) return 0;
  // [Cluster D] Never ADD volume on the deload week: the accumulated autoreg
  // offset would fight the deload-depth pullback (volAdj only resets at block end,
  // after the deload is trained). A negative offset is allowed through, since it
  // only reinforces the deload.
  if (offset > 0 && wIdx != null && Engine.weekType(wIdx) === 'deload') return 0;
  const plain = sets.filter(s => !s.amrap && !s.ramp && !s.calib).length;
  if (!plain) return 0;
  const lm = (S.profile.landmarks && S.profile.landmarks[e.movement]) || VOLUME_LANDMARKS[e.movement];
  const cap = lm ? Math.max(1, Math.round(lm.mrv / 2)) : 8;   // ~2 sessions/wk/muscle
  const target = Math.max(1, Math.min(plain + offset, cap));
  return target - plain;
}
// [Cluster B] Turn an accessory's last real working set into its opted-in
// intensity technique (today: drop set). Bodybuilding-only and only when the
// athlete has tagged this exercise, so every other track and an untagged
// exercise are byte-identical (golden master holds). Calibration / AMRAP / ramp
// and weightless sets are never modified.
function applyTechnique(exId, sets, rounding) {
  const tc = P() && P().trainingConfig;
  if (!tc || tc.track !== 'bodybuilding') return sets;
  const tech = (S.techniques || {})[exId];
  if (!FINISHER_TECHS.includes(tech)) return sets;
  for (let i = sets.length - 1; i >= 0; i--) {
    const s = sets[i];
    if (s.amrap || s.ramp || s.calib || !(s.weight > 0)) continue;
    const built = buildTechnique(tech, s, rounding);
    if (built !== s) sets = sets.slice(0, i).concat([built], sets.slice(i + 1));
    break;
  }
  return sets;
}
// The opt-in finishers and which keep the working weight (only drop strips it).
const FINISHER_TECHS = ['drop', 'myo', 'restpause', 'partials'];
const SAME_WEIGHT_TECHS = ['myo', 'restpause', 'partials'];
// Finishers whose child sets carry an intrinsic intra-set REST that gets a timed
// in-modal cue. Partials flow straight out of the set with no real rest, so they
// keep the working weight (above) but get no mini-rest button.
const TIMED_REST_TECHS = ['myo', 'restpause'];
function buildTechnique(tech, set, rounding) {
  if (tech === 'myo') return Engine.buildMyoReps(set);
  if (tech === 'restpause') return Engine.buildRestPause(set);
  if (tech === 'partials') return Engine.buildPartials(set);
  return Engine.buildDropSet(set, { rounding });
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
    const equip = (exById(rs.exId) || {}).equipment;
    t += TM.setupSec[equip] != null ? TM.setupSec[equip] : TM.setupSecDefault; // per-exercise setup
    // [Cluster B] A supersetted accessory shares one rest per round with the other
    // members of its group, so each of its sets carries roughly 1/size the rest
    // (half for a pair, a third for a triple, ...).
    const restSec = rs.superset ? Math.round(rest[kind] / (rs.supersetSize || 2)) : rest[kind];
    for (const st of rs.sets) {
      t += Engine.setTimeSec(st, TM, kind, restSec); // exec + rest, drop-aware
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
// Keep priority for the core/optional split. LOWER = kept in core first.
// Specialized muscles (slider >= 4) score negative so they are kept hardest, but
// they are not immune: if the mains alone already fill the cap, even specialized
// accessories fall to the optional tail (shown, not deleted) so the model never
// claims a session fits when it cannot.
function prunePriority(rs, mainMovs, tc) {
  const mov = (exById(rs.exId) || {}).movement;
  let cov = 0;
  for (const mm of mainMovs) { const c = (SYNERGIST_COVERAGE[mm] || {})[mov]; if (c > cov) cov = c; }
  let deprior = 0;
  if (tc && tc.track === 'bodybuilding' && tc.muscleFocus) {
    const key = MOVEMENT_SLIDER[mov];
    const v = key != null ? tc.muscleFocus[key] : null;
    if (v != null) {
      if (v >= 4) return -(v - 3);          // specialized: kept first (more emphasis = harder)
      deprior = (3 - v) / 3;
    }
  }
  return cov + deprior;
}
// Build a day's training entries with FOCUS applied (via resolveSlot), then
// split into CORE and OPTIONAL for a time-capped athlete. Core = mains,
// secondaries, and the highest-priority accessories that fit the cap; it is
// never trimmed. Optional = the lower-priority tail that runs over the limit;
// it is shown and trainable, just flagged. No cap -> everything is core.
// Returns { items:[{si,rs}], coreItems, optItems, coreMin, fullMin, capMin, optionalNames }.
function resolveDayEntries(di, bi, wi) {
  const p = P();
  const items = p.days[di].slots
    .map((slot, si) => ({ si, rs: resolveSlot(slot, bi, wi) }))
    .filter(x => !x.rs.isSelect && !x.rs.isRemoved && x.rs.sets.length);
  const tc = p.trainingConfig;
  // [Cluster B] Superset / giant-set grouping: a maximal run of consecutive
  // accessories linked by the `superset` flag (each member except the last links
  // to the next) is performed as one alternating group, sharing one rest per
  // round. Tag every member with its group head, index, size and the member
  // names, so the time estimate charges a shared rest, the cap keeps the group
  // together, and the session UI can render the rounds. Bodybuilding-only and
  // absent by default (golden master holds).
  if (tc && tc.track === 'bodybuilding') {
    const accs = items.filter(x => !x.rs.isMain && !x.rs.isSecondary);
    const slots = p.days[di].slots;
    let k = 0;
    while (k < accs.length) {
      if (k + 1 < accs.length && slots[accs[k].si] && slots[accs[k].si].superset) {
        let j = k;
        while (j + 1 < accs.length && slots[accs[j].si] && slots[accs[j].si].superset) j++;
        const members = accs.slice(k, j + 1);
        const names = members.map(m => m.rs.name);
        const headSi = accs[k].si;
        members.forEach((m, idx) => {
          m.rs.superset = true;
          m.rs.supersetGroup = headSi;
          m.rs.supersetIndex = idx;
          m.rs.supersetSize = members.length;
          m.rs.supersetNames = names;
          m.rs.supersetRole = idx === 0 ? 'head' : 'member';
          m.rs.supersetPartner = names.filter((_, i) => i !== idx).join(', ');
        });
        k = j + 1;
      } else k++;
    }
  }
  const capMin = (tc && tc.timeMode === 'custom' && tc.timeCapMin) ? tc.timeCapMin : null;
  if (capMin) {
    const mains = items.filter(x => x.rs.isMain).map(x => (exById(x.rs.exId) || {}).movement);
    const core = items.filter(x => x.rs.isMain || x.rs.isSecondary); // always core
    const accs = items.filter(x => !x.rs.isMain && !x.rs.isSecondary);
    // Group consecutive superset members into one cap UNIT so a pair / giant set is
    // kept together (added or dropped as a whole); a standalone accessory is its
    // own unit. Score a unit by its strongest (lowest) member and treat it as
    // "added" only if every member was an explicit add (so it falls to the tail).
    const units = []; const seen = new Set();
    for (const x of accs) {
      const gid = x.rs.supersetGroup;
      if (gid != null) { if (seen.has(gid)) continue; seen.add(gid); units.push(accs.filter(a => a.rs.supersetGroup === gid)); }
      else units.push([x]);
    }
    const scored = units.map(u => ({
      u,
      added: u.every(m => !!p.days[di].slots[m.si].added),
      score: Math.min(...u.map(m => prunePriority(m.rs, mains, tc))),
    })).sort((a, b) => (a.added - b.added) || (a.score - b.score));
    let full = false;
    for (const s of scored) {
      if (!full && estimateSessionSec(core.concat(s.u).map(t => t.rs), false) <= capMin * 60) {
        core.push(...s.u);
      } else { s.u.forEach(m => { m.rs.optional = true; }); full = true; }
    }
  }
  const coreItems = items.filter(x => !x.rs.optional);
  const optItems = items.filter(x => x.rs.optional);
  return {
    items, coreItems, optItems, capMin,
    coreMin: Math.round(estimateSessionSec(coreItems.map(x => x.rs), false) / 60),
    fullMin: Math.round(estimateSessionSec(items.map(x => x.rs), false) / 60),
    optionalNames: optItems.map(x => x.rs.name),
  };
}
// [Cluster B] Ordered accessory slot indices on a day (resolved + trainable), the
// sequence supersets pair along.
function accessorySiOrder(di, bi, wi) {
  return resolveDayEntries(di, bi, wi).items
    .filter(x => !x.rs.isMain && !x.rs.isSecondary)
    .map(x => x.si);
}
// [Cluster B] Superset layout for a day, read from the one resolveDayEntries
// grouping so the overview controls, the time estimate and the cap all agree. Per
// grouped accessory si: { role, size, others, names }. `eligible` is every
// accessory that has a following accessory (so it can link into a group).
function supersetLayout(di, bi, wi) {
  const items = resolveDayEntries(di, bi, wi).items;
  const accOrder = items.filter(x => !x.rs.isMain && !x.rs.isSecondary).map(x => x.si);
  const byId = {};
  for (const x of items) {
    if (x.rs.superset) byId[x.si] = { role: x.rs.supersetRole, index: x.rs.supersetIndex, size: x.rs.supersetSize, others: x.rs.supersetPartner, names: x.rs.supersetNames };
  }
  const eligible = new Set();
  for (let k = 0; k < accOrder.length - 1; k++) eligible.add(accOrder[k]);
  return { byId, eligible };
}
// [Cluster B] Toggle whether this accessory links to the NEXT accessory on the
// day. Consecutive links form a giant set (3+); breaking a middle link splits one
// group into two. Bodybuilding-only via the slot flag never being set elsewhere.
function toggleSuperset(di, si) {
  const p = P();
  const slots = p.days[di].slots;
  const slot = slots[si];
  if (!slot) return;
  if (slot.superset) { slot.superset = false; }
  else {
    const order = accessorySiOrder(di, p.pointer.block, p.pointer.week);
    const pos = order.indexOf(si);
    if (pos < 0 || pos >= order.length - 1) { toast('Add an exercise after this one to superset it', true); return; }
    slot.superset = true;                            // links to the next; chains form giant sets
  }
  save(); render();
  toast(slot.superset ? 'Linked into a superset' : 'Superset link removed');
}
// [Cluster B] Reorder an exercise within its superset group (dir -1 up / +1 down)
// while keeping the group intact. Swaps the two members' slots, then relinks every
// group position to the next (the last position is the tail), so the group stays a
// contiguous run regardless of which member moved. Bodybuilding-only via the flag.
function moveSupersetMember(di, si, dir) {
  const p = P();
  const built = resolveDayEntries(di, p.pointer.block, p.pointer.week);
  const me = built.items.find(x => x.si === si && x.rs.superset);
  if (!me) return;
  const groupSis = built.items.filter(x => x.rs.supersetGroup === me.rs.supersetGroup).map(x => x.si);
  const pos = groupSis.indexOf(si);
  const tgt = pos + dir;
  if (tgt < 0 || tgt >= groupSis.length) return;       // already at a group end
  const slots = p.days[di].slots;
  const a = groupSis[pos], b = groupSis[tgt];
  const tmp = slots[a]; slots[a] = slots[b]; slots[b] = tmp; // swap the two members
  groupSis.forEach((s, i) => { slots[s].superset = i < groupSis.length - 1; }); // relink the run
  save(); render();
}
// Heads-up banner in the workout view for athletes with a time cap.
function timeBannerHTML(di) {
  const p = P();
  const tc = p && p.trainingConfig;
  if (!tc || tc.timeMode !== 'custom' || !tc.timeCapMin) return '';
  const built = resolveDayEntries(di, p.pointer.block, p.pointer.week);
  if (built.coreMin > tc.timeCapMin) {
    // Even the unavoidable core (mains + top priorities) runs over the limit.
    return `<div class="banner-warn mt8">Your core work is about ${built.coreMin} min, over your ${tc.timeCapMin} min limit. Main lifts come first and are never cut, so to fit you would need to raise your time limit or ease a muscle focus.${built.optItems.length ? ' Optional extras: ' + esc(built.optionalNames.join(', ')) + '.' : ''}</div>`;
  }
  if (built.optItems.length) {
    return `<div class="banner-warn mt8">Core fits your ${tc.timeCapMin} min limit (about ${built.coreMin} min). Optional, if you have time: ${esc(built.optionalNames.join(', '))} (about ${built.fullMin - built.coreMin} min more). Skip it and you stay on time. Keep skipping it all block and it gets dropped next block.</div>`;
  }
  return `<div class="card mt8"><span class="faint">This day is about ${built.coreMin} min, within your ${tc.timeCapMin} min limit.</span></div>`;
}
// Rough marginal cost of adding one accessory to this day, in minutes. Uses the
// day's own accessories as the sample, or a nominal 4x12 accessory if none.
function accessoryCostMin(di, bi, wi) {
  const accs = resolveDayEntries(di, bi, wi).items
    .filter(x => !x.rs.isMain && !x.rs.isSecondary).map(x => x.rs);
  const sec = accs.length
    ? (estimateSessionSec(accs, false) - TIME_MODEL.sessionOverheadSec) / accs.length
    : 4 * (12 * TIME_MODEL.execSecPerRep.accessory + TIME_MODEL.restSec.accessory) + TIME_MODEL.setupSecDefault;
  return Math.max(1, Math.round(sec / 60));
}
// Budget line shown near Add Exercise for a capped athlete: room left and the
// rough cost of adding one more exercise.
function timeBudgetHTML(di) {
  const p = P();
  const tc = p && p.trainingConfig;
  if (!tc || tc.timeMode !== 'custom' || !tc.timeCapMin) return '';
  const built = resolveDayEntries(di, p.pointer.block, p.pointer.week);
  const room = tc.timeCapMin - built.coreMin;
  const cost = accessoryCostMin(di, p.pointer.block, p.pointer.week);
  if (room <= 1) {
    return `<p class="faint" style="margin:8px 2px 0">You are at your ${tc.timeCapMin} min limit. Anything you add is about +${cost} min and will be marked optional.</p>`;
  }
  return `<p class="faint" style="margin:8px 2px 0">About ${room} min before your ${tc.timeCapMin} min limit. Each added exercise is roughly +${cost} min.</p>`;
}
// The athlete's time cap in minutes, or null when they train without one. Used to
// decide whether the swap/add pickers should show per-candidate time costs.
function timeCapMin() {
  const tc = P() && P().trainingConfig;
  return (tc && tc.timeMode === 'custom' && tc.timeCapMin) ? tc.timeCapMin : null;
}
// Rough marginal cost, in minutes, of running one specific exercise as an
// accessory in the current week. Mirrors resolveSlot's accessory path so the
// number matches what the athlete would actually be prescribed. Returns null if
// focus would drop it (slider 0). Powers the per-candidate cost in the pickers.
function candidateCostMin(exId) {
  const p = P();
  if (!p) return null;
  const block = blockOf(p.pointer.block);
  const sch = Engine.schemeFor(block);
  const r = loadingFor(exId).totalInc;
  let sets = sch.accessory(block, p.pointer.week, recordsFor(exId), r);
  const focus = focusForAccessory(exId, sets);
  if (focus.removed) return null;
  if (focus.delta) sets = applySetDelta(sets, focus.delta);
  const rs = { exId, sets, cat: (exById(exId) || {}).movement };
  const sec = estimateSessionSec([rs], false) - TIME_MODEL.sessionOverheadSec;
  return Math.max(1, Math.round(sec / 60));
}
// Modal: how this day's time changes across the block (the tail grows toward
// the peak week). Informative; available with or without a time cap.
function openTimeByWeek(di) {
  const p = P(), bi = p.pointer.block;
  const cap = (p.trainingConfig && p.trainingConfig.timeMode === 'custom') ? p.trainingConfig.timeCapMin : null;
  const rows = [];
  for (let wk = 0; wk < p.weeksPerBlock; wk++) {
    const b = resolveDayEntries(di, bi, wk);
    const over = cap && b.coreMin > cap;
    const cur = wk === p.pointer.week;
    rows.push(`<div class="row" style="padding:9px 0;border-bottom:1px solid var(--line)${cur ? ';font-weight:700' : ''}">
      <span>${weekLabelFor(blockOf(bi), wk)}${cur ? ' ·' : ''}</span>
      <span>${b.coreMin} min${b.optItems.length ? ` <span style="color:var(--amber)">+${b.fullMin - b.coreMin} opt</span>` : ''}${over ? ' <span style="color:var(--red)">over</span>' : ''}</span></div>`);
  }
  showModal(anim => {
    $modal.innerHTML = modalShell(anim, 'Time by week',
      `<p class="subtle" style="margin-bottom:8px">How Day ${di + 1} changes across this block${cap ? `, against your ${cap} min limit` : ''}. Volume climbs toward the peak week, then the deload drops it.</p>${rows.join('')}`);
  });
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
  // Error boundary: a thrown view function used to leave $app empty, which on a
  // standalone PWA shows as a blank (black) screen with no way out. Catch it and
  // paint a recovery screen with the actual error instead, so the app is never a
  // dead black rectangle and we get the message needed to diagnose.
  try {
    const views = {
      onboarding: vOnboarding, dashboard: vDashboard, workout: vWorkout,
      checkin: vCheckin, session: vSession, history: vHistory, summary: vSummary,
      more: vMore, exercises: vExercises, program: vProgram, settings: vSettings,
    };
    $app.innerHTML = (views[V.view] || vDashboard)();
    bindRangeLabels();
  } catch (e) {
    console.error('render failed', e);
    try { renderErrorScreen(e); }
    catch (_) { $app.innerHTML = '<div class="view"><p>Something went wrong drawing the screen. Reload the app.</p></div>'; }
  }
}
// Recovery UI shown when render (or boot) throws. Keeps the athlete's data safe
// on-device and offers the three useful escapes: reload, export a backup, and
// force an update (a stale cached build is a common cause after a version bump).
function renderErrorScreen(err) {
  const detail = esc((err && (err.stack || err.message)) || String(err));
  $app.innerHTML = `<div class="view">
    <div class="section-title">Something went wrong</div>
    <p class="faint" style="margin-bottom:10px">The app hit an error while drawing the screen. Your data is still saved on this device. Try reloading. If it keeps happening, export a backup, then check for updates.</p>
    <div class="btn-row">
      <button class="btn btn-blue" onclick="location.reload()">Reload</button>
      <button class="btn btn-outline" onclick="exportData()">Export backup</button>
    </div>
    <button class="btn btn-outline mt8" onclick="checkForUpdate()">Check for updates</button>
    <div class="section-title">Error detail</div>
    <pre class="faint" style="white-space:pre-wrap;word-break:break-word;font-size:.72rem;overflow:auto">${detail}</pre>
  </div>`;
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
// Bodybuilding leads (owner call: it is the app's primary audience) and the
// copy stays to one short line per card; the picker does the explaining.
// Track and experience copy lives in the i18n catalogs ('track.<id>' /
// 'track.<id>_desc', 'exp.<id>' / 'exp.<id>_desc'); these keep only the order.
const OB_TRACKS = ['bodybuilding', 'powerbuilding', 'powerlifting'];
const OB_EXP = ['beginner', 'intermediate', 'advanced'];
// The main lifts whose 1RM onboarding collects. The bodybuilding generator
// never programs the deadlift (see removeBigLift, "not used in hypertrophy"),
// so obMainLifts drops it from that track and we never ask for its 1RM.
const OB_MAIN_LIFTS = [['comp-squat','Comp Squat'],['comp-bench','Comp Bench'],['comp-deadlift','Comp Deadlift'],['military-press','Military Press']];
function obMainLifts(track) {
  return track === 'bodybuilding' ? OB_MAIN_LIFTS.filter(([id]) => id !== 'comp-deadlift') : OB_MAIN_LIFTS;
}
const FOCUS_KEYS = ['arms', 'chest', 'back', 'shoulders', 'glutes', 'legs', 'calves'];
const FOCUS_LABELS = { arms: 'Arms', chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
                       glutes: 'Glutes', legs: 'Legs', calves: 'Calves' };

// Fresh onboarding pre-selects NOTHING (owner call): every discrete choice
// (days, track, goal, experience, time) starts empty and its step's Continue
// stays disabled until the athlete picks. The one exception is program length,
// which defaults to the track's standard and hides under Advanced options.
function obDefaults() {
  return { name: '', bodyweight: '', daysPerWeek: null, track: null,
           experience: null, timeMode: null, timeCapMin: '',
           macroWeeks: null, // [Epic G2] null = standard template length
           goalArchetype: null, // [Epic G6] bodybuilding only
           showAdvanced: false, // program-length presets tucked away
           muscleFocus: { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 },
           maxes: {} };
}
// Warning copy for any slider at the extremes (0 = removed, 6 = maxed).
function obFocusWarning(focus) {
  const removed = FOCUS_KEYS.filter(k => focus[k] === 0).map(k => t('muscle.' + k));
  const maxed = FOCUS_KEYS.filter(k => focus[k] === 6).map(k => t('muscle.' + k));
  if (!removed.length && !maxed.length) return '';
  const parts = [];
  if (removed.length) parts.push(t('ob.focus_removed', { list: removed.join(', ') }));
  if (maxed.length) parts.push(t('ob.focus_maxed', { list: maxed.join(', ') }));
  parts.push(t('ob.focus_rebalance'));
  return `<div class="banner-warn mt8">${esc(parts.join(' '))}</div>`;
}
// Informative only: median training-day length for the current focus. Builds a
// throwaway bodybuilding program from the onboarding answers and times each day
// (rest + execution + warmup + overhead). Computed with calibration-level loads
// since maxes come on the next step; touches nothing persistent.
// Median session length (min) for the program ob would build, on the athlete's
// own track. Used to give an onboarding ballpark; restores S afterward so it has
// no side effects. Track-aware so powerbuilding/powerlifting get an estimate too,
// not just bodybuilding.
function estimateMedianSessionMin(ob) {
  if (typeof estimateSessionSec !== 'function') return null;
  const savedProg = S.program, savedLm = S.profile.landmarks;
  try {
    if (!savedLm || !Object.keys(savedLm).length) S.profile.landmarks = Engine.seedLandmarks(ob.experience || 'intermediate');
    const tmp = makeProgram(Object.assign({}, ob, { maxes: ob.maxes || {} }));
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
  const m = estimateMedianSessionMin(ob);
  if (!m) return '';
  const cap = (ob.timeMode === 'custom' && ob.timeCapMin) ? parseInt(ob.timeCapMin) : null;
  if (cap) {
    return m > cap
      ? t('ob.est_over', { m, cap })
      : t('ob.est_within', { m, cap });
  }
  return t('ob.est_plain', { m });
}

function vOnboarding() {
  if (!V.ob) V.ob = obDefaults();
  const ob = V.ob;
  const step = V.obStep;
  let body = '';

  if (step === 0) {
    body = `
      <div class="ob-title">${esc(t('ob.welcome'))}<br>IRON<span style="color:var(--blue)">WAVE</span></div>
      <p class="subtle">${esc(t('ob.welcome_sub'))}</p>
      <div class="field"><label>${esc(t('ob.your_name'))}</label>
        <input id="ob-name" value="${esc(ob.name)}" placeholder="${esc(t('ob.name_ph'))}"></div>
      <div class="field"><label>${esc(t('ob.bodyweight'))}</label>
        <input id="ob-bw" type="number" inputmode="decimal" value="${esc(ob.bodyweight)}" placeholder="100"></div>
      <button class="btn btn-green mt16" onclick="obNext(0)">${esc(t('ob.continue'))}</button>`;
  } else if (step === 1) {
    body = `
      <div class="ob-title">${esc(t('ob.days_title'))}</div>
      <p class="subtle">${esc(t('ob.days_sub'))}</p>
      <div class="seg mt16">
        ${[3,4,5,6].map(n => `<button class="${ob.daysPerWeek===n?'on':''}" onclick="obDays(${n})">${n}</button>`).join('')}
      </div>
      <p class="faint mt16">${esc([3,4,5,6].includes(ob.daysPerWeek) ? t('ob.days_' + ob.daysPerWeek) : t('ob.days_pick'))}</p>
      <button class="btn btn-green mt24" onclick="obNext(1)" ${ob.daysPerWeek ? '' : 'disabled'}>${esc(t('ob.continue'))}</button>`;
  } else if (step === 2) {
    const goalReady = ob.track && (ob.track !== 'bodybuilding' || ob.goalArchetype);
    body = `
      <div class="ob-title">${esc(t('ob.goal_title'))}</div>
      <p class="subtle">${esc(t('ob.goal_sub'))}</p>
      ${OB_TRACKS.map(id => `
        <button class="pick-card ${ob.track===id?'on':''}" onclick="obTrack('${id}')">
          <b>${esc(t('track.' + id))}</b><span class="faint">${esc(t('track.' + id + '_desc'))}</span></button>`).join('')}
      ${ob.track === 'bodybuilding' ? `
        <div class="ob-sub mt16">${esc(t('ob.bb_goal'))}</div>
        ${Object.keys(GOAL_ARCHETYPES).map(id => `
          <button class="pick-card ${ob.goalArchetype===id?'on':''}" onclick="obArchetype('${id}')">
            <b>${esc(t('goal.' + id))}</b><span class="faint">${esc(t('goal.' + id + '_desc'))}</span></button>`).join('')}
        ${GOAL_ARCHETYPES[ob.goalArchetype] && GOAL_ARCHETYPES[ob.goalArchetype].warn
          ? `<div class="banner-warn mt8">${esc(t('goal.' + ob.goalArchetype + '_warn'))}</div>` : ''}` : ''}
      ${ob.track ? `
        <button class="browse-toggle mt16" onclick="V.ob.showAdvanced=!V.ob.showAdvanced;render()">${esc(t('ob.advanced'))} ${ob.showAdvanced ? '▴' : '▾'}</button>
        ${ob.showAdvanced ? `
          <div class="ob-sub mt8">${esc(t('ob.length_title'))}</div>
          <p class="faint">${esc(t('ob.length_sub'))}</p>
          <div class="seg mt8">
            <button class="${ob.macroWeeks==null?'on':''}" onclick="obMacro(null)">${esc(t('ob.standard'))}</button>
            ${[12,18,24,36].map(w => `<button class="${ob.macroWeeks===w?'on':''}" onclick="obMacro(${w})">${esc(t('ob.wk', { w }))}</button>`).join('')}
          </div>
          <div class="focus-time">${esc(obMacroLine(ob))}</div>` : ''}` : ''}
      <button class="btn btn-green mt16" onclick="obNext(2)" ${goalReady ? '' : 'disabled'}>${esc(t('ob.continue'))}</button>`;
  } else if (step === 3) {
    body = `
      <div class="ob-title">${esc(t('ob.exp_title'))}</div>
      <p class="subtle">${esc(t('ob.exp_sub'))}</p>
      ${OB_EXP.map(id => `
        <button class="pick-card ${ob.experience===id?'on':''}" onclick="obExp('${id}')">
          <b>${esc(t('exp.' + id))}</b><span class="faint">${esc(t('exp.' + id + '_desc'))}</span></button>`).join('')}
      <button class="btn btn-green mt16" onclick="obNext(3)" ${ob.experience ? '' : 'disabled'}>${esc(t('ob.continue'))}</button>`;
  } else if (step === 4) {
    body = `
      <div class="ob-title">${esc(t('ob.time_title'))}</div>
      <p class="subtle">${esc(t('ob.time_sub'))}</p>
      <div class="seg mt16">
        <button class="${ob.timeMode==='unlimited'?'on':''}" onclick="obTimeMode('unlimited')">${esc(t('ob.time_unlimited'))}</button>
        <button class="${ob.timeMode==='custom'?'on':''}" onclick="obTimeMode('custom')">${esc(t('ob.time_custom'))}</button>
      </div>
      ${ob.timeMode==='custom' ? `<div class="field mt16"><label>${esc(t('ob.time_minutes'))}</label>
        <input id="ob-time" type="number" inputmode="numeric" value="${esc(ob.timeCapMin)}" placeholder="60" oninput="obTimeInput(this.value)"></div>` : ''}
      <div id="ob-time-est" class="focus-time">${ob.timeMode ? esc(focusTimeLine(ob)) : ''}</div>
      <button class="btn btn-green mt24" onclick="obNext(4)" ${ob.timeMode ? '' : 'disabled'}>${esc(t('ob.continue'))}</button>`;
  } else if (step === 5) {
    body = `
      <div class="ob-title">${esc(t('ob.focus_title'))}</div>
      <p class="subtle">${esc(t('ob.focus_sub'))}</p>
      ${FOCUS_KEYS.map(k => `
        <div class="focus-row">
          <div class="row"><span>${esc(t('muscle.' + k))}</span><b id="mf-val-${k}">${ob.muscleFocus[k]}</b></div>
          <input type="range" min="0" max="6" step="1" value="${ob.muscleFocus[k]}" oninput="obSlider('${k}', this.value)">
        </div>`).join('')}
      <div id="mf-warn">${obFocusWarning(ob.muscleFocus)}</div>
      <div id="mf-time" class="focus-time">${esc(focusTimeLine(ob))}</div>
      <button class="btn btn-green mt16" onclick="obNext(5)">${esc(t('ob.continue'))}</button>`;
  } else if (step === 6) {
    const lifts = obMainLifts(ob.track);
    body = `
      <div class="ob-title">${esc(t('ob.maxes_title'))}</div>
      <p class="subtle">${esc(t('ob.maxes_sub'))}</p>
      ${lifts.map(([id,label]) => `
        <div class="field"><label>${esc(t('ob.rm_label', { name: label }))}</label>
          <input id="ob-max-${id}" type="number" inputmode="decimal"
            value="${ob.maxes[id] ?? ''}" placeholder="${esc(t('ob.calib_ph'))}"></div>`).join('')}
      <button class="btn btn-green mt16" onclick="obNext(6)">${esc(t('ob.create'))}</button>`;
  }
  return `${topbar()}<div class="view">${body}</div>`;
}
function obDays(n) { V.ob.daysPerWeek = n; render(); }
function obTrack(id) { V.ob.track = id; render(); }
function obMacro(weeks) { V.ob.macroWeeks = weeks; render(); }
// [Epic G6] Picking a goal archetype also seeds its default length (the athlete
// can still override the length presets afterward).
function obArchetype(id) {
  V.ob.goalArchetype = id;
  const a = GOAL_ARCHETYPES[id];
  if (a) V.ob.macroWeeks = a.weeks;
  render();
}
// [Epic G2] One-line summary of the macrocycle the current length choice builds.
function obMacroLine(ob) {
  const tpl = PROGRAM_TEMPLATES[ob.track] || PROGRAM_TEMPLATES.powerbuilding;
  const blocks = ob.macroWeeks ? blocksForWeeks(ob.macroWeeks, tpl.weeksPerBlock) : tpl.blocks.length;
  return t('ob.macro_line', { blocks, weeks: blocks * tpl.weeksPerBlock });
}
function obExp(id) { V.ob.experience = id; render(); }
function obTimeMode(mode) { V.ob.timeMode = mode; render(); }
// Live-update the time estimate as the cap is typed, without a full re-render
// (which would blur the number input mid-entry). Mirrors obSlider's pattern.
function obTimeInput(v) {
  V.ob.timeCapMin = v === '' ? '' : (parseInt(v) || '');
  const el = byId('ob-time-est'); if (el) el.textContent = focusTimeLine(V.ob);
}
// Update slider value + warning live, without a full re-render (keeps the drag smooth).
function obSlider(k, v) {
  V.ob.muscleFocus[k] = parseInt(v);
  const el = byId('mf-val-' + k); if (el) el.textContent = v;
  const wn = byId('mf-warn'); if (wn) wn.innerHTML = obFocusWarning(V.ob.muscleFocus);
  const tl = byId('mf-time'); if (tl) tl.textContent = focusTimeLine(V.ob);
}
function obNext(step) {
  const ob = V.ob;
  // Belt and braces with the disabled Continue buttons: nothing advances past a
  // choice step without an explicit pick (owner call: no silent defaults).
  if (step === 0) {
    ob.name = document.getElementById('ob-name').value.trim();
    ob.bodyweight = parseFloat(document.getElementById('ob-bw').value) || null;
    V.obStep = 1;
  } else if (step === 1) {
    if (!ob.daysPerWeek) { toast(t('ob.pick_days'), true); return; }
    V.obStep = 2;
  } else if (step === 2) {
    if (!ob.track) { toast(t('ob.pick_goal'), true); return; }
    if (ob.track === 'bodybuilding' && !ob.goalArchetype) { toast(t('ob.pick_bb_goal'), true); return; }
    V.obStep = 3;
  } else if (step === 3) {
    if (!ob.experience) { toast(t('ob.pick_exp'), true); return; }
    V.obStep = 4;
  } else if (step === 4) {
    if (!ob.timeMode) { toast(t('ob.pick_time'), true); return; }
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
      for (const [id] of obMainLifts(ob.track)) {
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
      // [Epic G6] Seed the current training phase from the first block so the
      // autoregulator (Cluster F) knows a lean-fast plan starts in a deficit.
      if (S.program.blocks[0] && S.program.blocks[0].phase) S.profile.phase = S.program.blocks[0].phase;
      logReadiness(computeReadiness());
      save().then(() => {
        V.tab = 'dashboard';
        toast(t('ob.created', { weeks: P().blocks.length * P().weeksPerBlock }));
        nav('dashboard');
      }).catch(() => {
        toast(t('ob.save_failed'), true);
      });
    } catch (e) {
      console.error('create program failed', e);
      toast(t('ob.create_failed', { err: (e && e.message) || e }), true);
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
// [Cluster A] Generic progression sparkline for a [{ts, value}] series (e1RM or
// volume load). Auto-scales to the series range; shows first -> last with a
// direction marker. Colors are literals so it does not depend on theme vars.
function trendChartHTML(points, color, fmt) {
  if (!points || !points.length) return '<p class="faint">No data yet.</p>';
  if (points.length === 1) return `<p class="faint">${fmt(points[0].value)} · one session so far</p>`;
  const W = 300, H = 64, pad = 8;
  const vals = points.map(p => p.value);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = i => pad + i * (W - 2 * pad) / (points.length - 1);
  const y = v => H - pad - ((v - lo) / span) * (H - 2 * pad);
  const pts = points.map((p, i) => [x(i), y(p.value)]);
  const first = points[0].value, last = points[points.length - 1].value, delta = last - first;
  const mark = delta > 0 ? '▲' : delta < 0 ? '▼' : '·';
  const col = delta > 0 ? '#37c978' : delta < 0 ? '#e2557b' : '#8a93a6';
  return `<svg class="spark-line" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <polyline points="${pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}"
        fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      ${pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.4" fill="${color}"/>`).join('')}
    </svg>
    <div class="row faint" style="margin:-2px 0 12px"><span>${fmt(first)}</span>
      <span style="color:${col}">${mark} ${fmt(last)}</span></div>`;
}
// Tentative weekly volume index — routed through the block's scheme
function weekVolume(block, w) {
  return Engine.schemeFor(block).weekVolume(block, w);
}
function weekLabelFor(block, w) {
  // [Cluster D] The one week converted to an early deload reads as a deload
  // everywhere it is labeled (dashboard, workout header, timeline preview).
  const p = P();
  const ed = p && p.earlyDeload;
  if (ed && ed.week === w && block === blockOf(ed.block)) return 'Deload (early)';
  const sch = Engine.schemeFor(block);
  return sch.weekLabel ? sch.weekLabel(w) : Engine.weekTypeLabel(w);
}
// [Epic G1] The block's phase (display label + tint), backfilled if a legacy
// save predates the field.
function blockPhase(block) { return block.phase || DEFAULT_BLOCK_PHASE[block.type] || 'lean-gain'; }
// [Epic G3] Bar color = training emphasis: a strength block is always orange; an
// energy-deficit phase (cut/minicut) reads teal and a peak reads red regardless
// of the underlying hypertrophy scheme; everything else (building/maintenance
// hypertrophy) is the hypertrophy blue. This is what the timeline legend lists.
function barColorFor(block) {
  if (blockScheme(block) === 'jm2-wave') return BLOCK_COLORS.strength;
  const ph = blockPhase(block);
  if (ph === 'peak') return BLOCK_COLORS.peaking;
  if (PHASE_DEFICIT[ph]) return BLOCK_COLORS.bridge;
  return BLOCK_COLORS.hypertrophy;
}
// [Epic G5] Glyphs for a scheduled intensity technique on the timeline.
const TECH_MARK = { myo: '◆', drop: '»', restpause: '‖' };
// [Epic G5] Which technique (if any) the schedule places on this block's week.
// Bodybuilding-track hypertrophy blocks only, so other tracks show no markers and
// the prescription is untouched (display-first: the athlete still opts a finisher
// in). A deficit phase holds the added myo back.
function scheduledTechForBlock(block, w, bbTrack) {
  if (!bbTrack || blockScheme(block) !== 'jbb-hyp') return null;
  const experience = (typeof S !== 'undefined' && S && S.profile && S.profile.experience) || 'intermediate';
  return Engine.scheduledTech(w, block.mesoIdx, { deficit: !!PHASE_DEFICIT[blockPhase(block)], experience });
}
// [Epic G3] Macrocycle timeline v2: blocks grouped into phase-tinted containers
// with a phase label, week bars colored by training emphasis (deload weeks
// hatched), the current week glowing and past weeks dimmed. Heights share one
// scale so blocks are comparable. Technique markers were dropped (owner
// feedback: the athlete may run a different finisher, so ◆/» in the bars was
// noise); the week preview still names the scheduled finisher when tapped.
// `editable: false` renders the read-only variant for the dashboard, without
// the "+" plan-editor tile; editing lives on My Program only.
function timelineHTML(opts) {
  const editable = !opts || opts.editable !== false;
  const p = P();
  let maxV = 1;
  p.blocks.forEach(b => { for (let w = 0; w < p.weeksPerBlock; w++) maxV = Math.max(maxV, weekVolume(b, w)); });
  const emphases = {}; // which legend swatches this program actually uses
  const ed = p.earlyDeload;
  const bar = (b, bi, w) => {
    const passed = bi < p.pointer.block || (bi === p.pointer.block && w < p.pointer.week);
    const cur = bi === p.pointer.block && w === p.pointer.week;
    // [Cluster D] The early-deload week wears a deload hatch (denser/amber variant);
    // the weeks it skips in that block are dimmed since they will not be trained.
    const early = !!(ed && ed.block === bi && ed.week === w);
    const skipped = !!(ed && ed.block === bi && w > ed.week);
    const deload = Engine.weekType(w) === 'deload' || early;
    const h = Math.max(10, weekVolume(b, w) / maxV * 100);
    return `<i class="${passed ? 'done' : ''}${cur ? ' current' : ''}${deload ? ' deload' : ''}${early ? ' deload-early' : ''}${skipped ? ' skipped' : ''}"
      onclick="openWeekPreview(${bi},${w})"
      style="height:${h.toFixed(0)}%;background:${barColorFor(b)}"></i>`;
  };
  // Group consecutive blocks that share a phase under one labeled, tinted
  // container (two back-to-back lean-gain blocks read as one phase, not two).
  const out = [];
  for (let bi = 0; bi < p.blocks.length;) {
    const phase = blockPhase(p.blocks[bi]);
    const bars = [];
    do {
      const b = p.blocks[bi];
      if (blockScheme(b) === 'jm2-wave') emphases.strength = 1;
      else if (phase === 'peak') emphases.peak = 1;
      else if (PHASE_DEFICIT[phase]) emphases.cut = 1;
      else emphases.hypertrophy = 1;
      for (let w = 0; w < p.weeksPerBlock; w++) bars.push(bar(b, bi, w));
      bi++;
    } while (bi < p.blocks.length && blockPhase(p.blocks[bi]) === phase);
    const pc = PHASE_COLORS[phase] || 'var(--blue)';
    // flex-grow tracks the week count so bars stay equal width across phases of
    // different lengths; the whole row shrinks to fit (no scroll until very long).
    out.push(`<div class="tl-block" style="--phase:${pc};flex-grow:${bars.length}">
      <span class="tl-phase">${esc(PHASE_LABELS[phase] || phase)}</span>
      <div class="tl-bars">${bars.join('')}</div>
    </div>`);
  }
  const groups = out.join('');
  const leg = [];
  if (emphases.hypertrophy) leg.push(`<span><i style="background:${BLOCK_COLORS.hypertrophy}"></i>Hypertrophy</span>`);
  if (emphases.strength) leg.push(`<span><i style="background:${BLOCK_COLORS.strength}"></i>Strength</span>`);
  if (emphases.cut) leg.push(`<span><i style="background:${BLOCK_COLORS.bridge}"></i>Cut</span>`);
  if (emphases.peak) leg.push(`<span><i style="background:${BLOCK_COLORS.peaking}"></i>Peak</span>`);
  // [Epic G4] A "+" tile opens the block-plan editor (customize the macrocycle).
  // Editable surface only (My Program); the dashboard shows the plan, not edits it.
  const add = editable ? `<button class="tl-add" onclick="openPlanEditor()" aria-label="Customize blocks">+</button>` : '';
  return `<div class="timeline-v2">${groups}${add}</div>
    <div class="legend">${leg.join('')}<span class="faint">tap a week to preview</span></div>`;
}
function openWeekPreview(bi, wi) {
  const p = P();
  const b = p.blocks[bi];
  showModal(anim => {
    const days = p.days.map((d, di) => {
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
      return `<div class="card"><b>Day ${di + 1}</b>${dayTheme(d) ? ` <span class="faint">${esc(dayTheme(d))}</span>` : ''}${rows}</div>`;
    }).join('');
    const bbTrack = (p.trainingConfig && p.trainingConfig.track) === 'bodybuilding';
    const tech = scheduledTechForBlock(b, wi, bbTrack);
    const techNote = tech
      ? `<p class="tl-finisher">${TECH_MARK[tech] || ''} Finisher this week: ${TECHNIQUE_LABELS[tech] || tech}. Add it on an accessory's last set.</p>`
      : '';
    $modal.innerHTML = modalShell(anim, `${esc(b.label)} · Week ${bi * p.weeksPerBlock + wi + 1}`,
      `<p class="subtle" style="margin-bottom:10px">${weekLabelFor(b, wi)} · projected with current working maxes</p>${techNote}${days}`);
  });
}

// ------------------------------------------------------------
// [Epic G4] Block plan editor: customize the macrocycle's future blocks.
// Already-trained blocks are locked (history is preserved); the athlete edits,
// reorders, adds and removes the blocks from the current one onward. Saving
// re-stamps mesoIdx/phase/labels and recomputes the test date.
// ------------------------------------------------------------
const PLAN_TYPES = [['hypertrophy', 'jbb-hyp', 'Hypertrophy'], ['strength', 'jm2-wave', 'Strength']];
const PLAN_WAVES = { 'jbb-hyp': ['10s', '8s'], 'jm2-wave': ['5s', '3s'] };
// How many leading blocks are locked because training has started in them.
function lockedPlanCount() {
  const p = P();
  let n = p.pointer.block;
  const started = p.pointer.week > 0 ||
    Object.keys(p.completedDays || {}).some(k => k.startsWith(p.pointer.block + '-'));
  if (started) n = p.pointer.block + 1;
  return Math.min(n, p.blocks.length);
}
function openPlanEditor() {
  const p = P();
  if (!p) return;
  const locked = lockedPlanCount();
  // Draft = the editable (future) portion, deep-cloned so Cancel is lossless.
  V.planDraft = p.blocks.slice(locked).map(b => JSON.parse(JSON.stringify(b)));
  V.planLocked = locked;
  showModal(anim => renderPlanEditor(anim));
}
function renderPlanEditor(anim) {
  const p = P();
  const locked = V.planLocked;
  const lockedRows = p.blocks.slice(0, locked).map((b, i) =>
    `<div class="plan-row locked"><span class="plan-lock">🔒</span>
      <span class="plan-name">${esc(b.label)}</span>
      <span class="faint">${esc(PHASE_LABELS[blockPhase(b)] || '')} · trained</span></div>`).join('');
  const draft = V.planDraft;
  const rows = draft.map((b, i) => {
    const waves = PLAN_WAVES[blockScheme(b)] || ['8s'];
    return `<div class="plan-row">
      <div class="plan-main">
        <select onchange="planSetType(${i}, this.value)">
          ${PLAN_TYPES.map(([ty, , lbl]) => `<option value="${ty}" ${b.type === ty ? 'selected' : ''}>${lbl}</option>`).join('')}
        </select>
        <select onchange="planSetWave(${i}, this.value)">
          ${waves.map(w => `<option value="${w}" ${b.wave === w ? 'selected' : ''}>${w} wave</option>`).join('')}
        </select>
        <select onchange="planSetPhase(${i}, this.value)">
          ${Object.keys(PHASE_LABELS).map(ph => `<option value="${ph}" ${blockPhase(b) === ph ? 'selected' : ''}>${PHASE_LABELS[ph]}</option>`).join('')}
        </select>
      </div>
      <div class="plan-ops">
        <button onclick="planMove(${i},-1)" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
        <button onclick="planMove(${i},1)" ${i === draft.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
        <button onclick="planRemove(${i})" ${draft.length + locked <= 1 ? 'disabled' : ''} aria-label="Remove" class="plan-del">✕</button>
      </div>
    </div>`;
  }).join('');
  const weeks = (locked + draft.length) * p.weeksPerBlock;
  const body = `
    <p class="subtle">Edit the blocks from here to your goal date. Trained blocks are locked. Saving updates your test date.</p>
    ${lockedRows}
    ${rows}
    <button class="btn btn-outline mt8" onclick="planAdd()">+ Add block</button>
    <div class="focus-time mt8">${locked + draft.length} blocks, about ${weeks} weeks total.</div>
    <div class="row mt16" style="gap:10px">
      <button class="btn btn-outline" style="flex:1" onclick="closeAllModals()">Cancel</button>
      <button class="btn btn-green" style="flex:1" onclick="planSave()" ${draft.length ? '' : 'disabled'}>Save plan</button>
    </div>`;
  $modal.innerHTML = modalShell(anim, 'Customize blocks', body);
}
function planSetType(i, ty) {
  const row = PLAN_TYPES.find(t => t[0] === ty); if (!row) return;
  const b = V.planDraft[i];
  b.type = ty; b.scheme = row[1];
  if (!(PLAN_WAVES[b.scheme] || []).includes(b.wave)) b.wave = PLAN_WAVES[b.scheme][0];
  rerenderTop();
}
function planSetWave(i, w) { V.planDraft[i].wave = w; }
function planSetPhase(i, ph) { V.planDraft[i].phase = ph; }
function planMove(i, dir) {
  const d = V.planDraft, j = i + dir;
  if (j < 0 || j >= d.length) return;
  const t = d[i]; d[i] = d[j]; d[j] = t;
  rerenderTop();
}
function planRemove(i) {
  if (V.planDraft.length + V.planLocked <= 1) return;
  V.planDraft.splice(i, 1); rerenderTop();
}
function planAdd() { V.planDraft.push(newPlanBlock()); rerenderTop(); }
function planSave() {
  const p = P();
  const locked = p.blocks.slice(0, V.planLocked);
  const { blocks, testDate } = commitPlan(p, locked, V.planDraft);
  p.blocks = blocks; p.testDate = testDate;
  V.planDraft = null; V.planLocked = null;
  save(); closeAllModals(); toast('Plan updated, ' + blocks.length * p.weeksPerBlock + ' weeks to test day'); render();
}

// Explainer for the "Waiting for calibration" state. Stacks over the preview,
// closes back to it. Plain language for the athlete, no jargon dumps.
function openCalibrationInfo() {
  showModal(anim => {
    $modal.innerHTML = modalShell(anim, 'Waiting for calibration', `
      <div class="card">
        <p>This lift does not have a reference number yet, so the app cannot
        prescribe exact weights or a target RIR for it. Until it does, you will
        see "Waiting for calibration" instead of a set and weight scheme.</p>

        <p class="mt16"><b>What calibration is.</b> The app builds every working
        weight from an anchor. For your main lifts that anchor is the working
        max, set to 90 percent of the 1RM you enter. For accessories the anchor
        is your first logged set, since you do not enter a max for those.</p>

        <p class="mt16"><b>How to calibrate it.</b> Train the lift in week 1 and
        log what you actually did. The week 1 plan gives you a short ramp of
        easy to moderate sets (leaving about 2 to 4 reps in reserve) so you can
        find a weight that feels right without grinding. Log those sets and the
        app reads your effort to set the anchor.</p>

        <p class="mt16"><b>What happens next.</b> Once the anchor exists, this
        lift starts showing real weights and a target RIR that tightens week to
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
        <span class="mark">${mark}</span> <span>Day ${i + 1}${dayTheme(d) ? ` <span class="faint">${esc(dayTheme(d))}</span>` : ''}</span> <span class="chev">›</span></button>`;
    }).join('');
    const allDone = p.days.every((d, i) => p.completedDays[dayKey(p.pointer.block, w, i)]);
    weekSection = `
      <div class="mt16">
        <div style="color:${BLOCK_COLORS[block.type]};font-weight:600">${esc(block.label)} · ${block.wave} wave</div>
        <div style="font-size:1.7rem;font-weight:800">Week ${globalWeekNum()}</div>
        <div class="subtle">${weekLabelFor(block, w)}</div>
      </div>
      ${earlyDeloadBannerHTML()}
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
    ${timelineHTML({ editable: false })}
    ${weekSection}
    ${done ? '' : `<button class="btn btn-outline mt16" onclick="openVolumeDashboard()">📊 Weekly volume per muscle</button>`}
    ${(done || (p.trainingConfig && p.trainingConfig.track === 'bodybuilding')) ? '' : `<button class="phase-chip mt8" onclick="openPhase()">🍽 Phase: ${PHASE_LABELS[currentPhase()] || currentPhase()}</button>`}
  </div>${tabbar()}`;
}
// [Cluster D] Estimated direct working sets per muscle for the current week,
// keyed by movement like the landmark grid. Read-only: resolves each day (focus
// and techniques applied) and tallies non-warmup sets. Landmark-keyed movements
// (chest, quad, ...) count directly; the big compounds (squat/bench/deadlift/
// press) attribute to the muscles they train via SYNERGIST_COVERAGE.
function weeklyVolumeByMuscle() {
  const p = P();
  if (!p) return {};
  const bi = p.pointer.block, wi = p.pointer.week;
  const tally = {};
  const add = (mv, n) => { if (VOLUME_LANDMARKS[mv]) tally[mv] = (tally[mv] || 0) + n; };
  for (let di = 0; di < p.days.length; di++) {
    for (const x of resolveDayEntries(di, bi, wi).items) {
      const ex = exById(x.rs.exId);
      if (!ex) continue;
      const sets = x.rs.sets.filter(s => !s.ramp).length; // warmups are not working sets
      if (!sets) continue;
      if (VOLUME_LANDMARKS[ex.movement]) add(ex.movement, sets);
      else {
        const cov = SYNERGIST_COVERAGE[ex.movement];
        if (cov) for (const mv in cov) add(mv, sets * cov[mv]);
      }
    }
  }
  for (const mv in tally) tally[mv] = Math.round(tally[mv] * 2) / 2; // nearest half set
  return tally;
}
// [Cluster C] How one exercise's head-tagged work rolls up to a muscle row, with
// the weight to apply: { muscle, head, frac } or null. A head on a landmark
// movement (e.g. a lateral raise on `shoulder`) counts in full against that
// muscle. A head on a PATTERN movement (bench / press / deadlift carry no
// landmark) rolls up to the muscle the head names (HEAD_MUSCLE) at the same
// SYNERGIST_COVERAGE fraction the muscle bar uses, so the head numbers stay
// consistent with the (fractionally attributed) muscle bar. Shared by the head
// tally and muscleHeads so the split and its landmarks agree. Pure given globals.
function exHeadAttribution(ex) {
  if (!ex || !ex.head) return null;
  if (VOLUME_LANDMARKS[ex.movement]) return { muscle: ex.movement, head: ex.head, frac: 1 };
  const muscle = HEAD_MUSCLE[ex.head];
  if (!muscle || !VOLUME_LANDMARKS[muscle]) return null;
  const frac = (SYNERGIST_COVERAGE[ex.movement] || {})[muscle] || 0;
  return frac > 0 ? { muscle, head: ex.head, frac } : null;
}
// [Cluster C/D] Per-head working-set split, nested under each muscle. Uses the
// same set count and (for pattern movements) the same coverage fraction those
// exercises contribute to weeklyVolumeByMuscle, so the head numbers stay
// consistent with the muscle bar. Read-only; bodybuilding-surfaced.
function weeklyVolumeByHead() {
  const p = P();
  if (!p) return {};
  const bi = p.pointer.block, wi = p.pointer.week;
  const tally = {}; // { muscle: { head: sets } }
  for (let di = 0; di < p.days.length; di++) {
    for (const x of resolveDayEntries(di, bi, wi).items) {
      const a = exHeadAttribution(exById(x.rs.exId));
      if (!a) continue;
      const sets = x.rs.sets.filter(s => !s.ramp).length;
      if (!sets) continue;
      (tally[a.muscle] || (tally[a.muscle] = {}));
      tally[a.muscle][a.head] = (tally[a.muscle][a.head] || 0) + sets * a.frac;
    }
  }
  for (const mv in tally) for (const h in tally[mv]) tally[mv][h] = Math.round(tally[mv][h] * 2) / 2;
  return tally;
}
// [Cluster C] The distinct muscle heads a muscle row is split into (via the same
// rollup the tally uses, so e.g. Chest includes the upper-chest work that lives on
// the bench pattern). Lets a per-head landmark divide the muscle landmark across
// them. Cached: the exercise set is static within a session.
let _MUSCLE_HEADS = null;
function muscleHeads(movement) {
  if (!_MUSCLE_HEADS) {
    _MUSCLE_HEADS = {};
    for (const e of allExercises()) {
      const a = exHeadAttribution(e);
      if (!a) continue;
      (_MUSCLE_HEADS[a.muscle] || (_MUSCLE_HEADS[a.muscle] = new Set())).add(a.head);
    }
  }
  const s = _MUSCLE_HEADS[movement];
  return s ? [...s] : [];
}
// [Cluster C] Per-head landmark for a movement: the athlete's whole-muscle
// landmark (seeded/evolved, falling back to the default) split across the
// movement's heads via Engine.headLandmark. Null when the movement has no
// landmark. Used for the per-head over-MRV signal on the volume screen and pickers.
function headLandmarkFor(movement) {
  const lm = (S.profile && S.profile.landmarks && S.profile.landmarks[movement]) || VOLUME_LANDMARKS[movement];
  if (!lm) return null;
  return Engine.headLandmark(lm, muscleHeads(movement).length);
}
// [Cluster C] Is this muscle head already at or over its per-head MRV this week?
// Drives the "region maxed" hint in the swap/add pickers and the volume-screen
// flag. Bodybuilding-surfaced and read-only.
function headVolumeOverMrv(movement, head, headTally) {
  if (!head) return false;
  const hlm = headLandmarkFor(movement);
  if (!hlm || !hlm.mrv) return false;
  const ht = headTally || weeklyVolumeByHead();
  const cur = (ht[movement] && ht[movement][head]) || 0;
  return cur >= hlm.mrv;
}
// [Cluster C] Flat set of every head at or over its per-head MRV this week, across
// all muscles (head keys are globally unique). Resolves the week once; the pickers
// stash it so each candidate card is a cheap lookup.
function overMrvHeadSet() {
  const ht = weeklyVolumeByHead();
  const over = new Set();
  for (const mv in ht) for (const h in ht[mv]) if (headVolumeOverMrv(mv, h, ht)) over.add(h);
  return over;
}
const VOL_ORDER = ['chest', 'shoulder', 'tricep', 'bicep', 'upperback', 'vpull', 'hpull',
                   'quad', 'ham', 'glute', 'calf', 'abs', 'lowback'];
// [Cluster E] Map a movement to its broad check-in group (same grouping the
// readiness check-in uses), so a muscle's recovery read comes from the slider
// the athlete already answered.
function checkinGroupForMovement(mv) {
  if (['bench', 'chest', 'tricep'].includes(mv)) return 'bench';
  if (['press', 'shoulder'].includes(mv)) return 'press';
  if (['squat', 'quad', 'calf'].includes(mv)) return 'squat';
  if (['deadlift', 'ham', 'glute'].includes(mv)) return 'deadlift';
  if (['vpull', 'hpull', 'upperback', 'bicep'].includes(mv)) return 'upperpull';
  if (['lowback'].includes(mv)) return 'lowback';
  return null;
}
// [Cluster E] Derive a per-muscle feedback signal from data already captured:
// recovery from the latest check-in slider for the muscle's group (1..5), and
// pump + performance (reps vs target) from the muscle's most recent logged
// session. Returns null when there is no logged session for the muscle yet.
function muscleSignal(mv) {
  const sess = [...(S.sessions || [])].reverse()
    .find(s => !s.skipped && (s.entries || []).some(e => (exById(e.exId) || {}).movement === mv));
  if (!sess) return null;
  let repDiff = 0, repN = 0, pumpSum = 0, pumpN = 0;
  for (const e of sess.entries) {
    if ((exById(e.exId) || {}).movement !== mv) continue;
    for (const st of e.sets) {
      if (!st.done || st.ramp || st.calib) continue;
      if (st.reps != null && st.targetReps != null) { repDiff += st.reps - st.targetReps; repN++; }
      if (st.pump != null) { pumpSum += st.pump; pumpN++; }
    }
  }
  const avgDiff = repN ? repDiff / repN : 0;
  const performance = avgDiff >= 1 ? 1 : avgDiff <= -1 ? -1 : 0;
  const grp = checkinGroupForMovement(mv);
  const last = (S.checkins || []).length ? S.checkins[S.checkins.length - 1] : null;
  const recovery = (last && grp && last.sliders && last.sliders[grp] != null) ? last.sliders[grp] : null;
  return { recovery, performance, pump: pumpN ? Math.round(pumpSum / pumpN) : null };
}
function volumeDashboardHTML() {
  const lm = (S.profile && S.profile.landmarks) || {};
  const tally = weeklyVolumeByMuscle();
  const tc = P() && P().trainingConfig;
  const autoreg = tc && tc.track === 'bodybuilding'; // hypertrophy-focused guidance
  const headTally = autoreg ? weeklyVolumeByHead() : {};
  const phase = currentPhase();
  // [Cluster D] On a deload week, texture every muscle bar so the athlete sees at a
  // glance that volume is pulled back this week. An early (autoregulated) deload
  // uses the same denser amber weave as its timeline marker; a scheduled deload
  // uses the lighter weave. Empty (no texture) on any work week or other track.
  const deloadTex = isEarlyDeloadActive() ? ' deload-tex deload-early'
    : (autoreg && Engine.weekType(P().pointer.week) === 'deload' ? ' deload-tex' : '');
  const statuses = [];
  const rows = VOL_ORDER.filter(mv => lm[mv] || VOLUME_LANDMARKS[mv]).map(mv => {
    const L = lm[mv] || VOLUME_LANDMARKS[mv];
    const sets = tally[mv] || 0;
    const st = Engine.volumeStatus(sets, L);
    if (sets > 0) statuses.push(st);
    const mevPct = L.mrv > 0 ? Math.min(100, Math.round(L.mev / L.mrv * 100)) : 0;
    let rec = '';
    if (autoreg && sets > 0) {
      const sig = muscleSignal(mv);
      if (sig) {
        const r = Engine.autoregVolume(sig, sets, L, phase);
        const arrow = r.action === 'add' ? '▲' : r.action === 'cut' ? '▼' : '＝';
        rec = `<div class="vol-rec k-rec-${r.action}">${arrow} ${esc(r.reason)}</div>`;
      }
    }
    // [Cluster C/D] Per-head split, where this muscle has head-tagged work, so an
    // athlete can spot a region they are under- or over-training (e.g. all upper
    // chest, no mid/lower).
    let heads = '';
    const hd = headTally[mv];
    if (hd) {
      // [Cluster C] Flag a head sitting over its per-head MRV (e.g. all the chest
      // volume piled on one region): an even split of the muscle landmark gives
      // each head its target, so an over-stuffed region stands out in amber.
      const hlm = headLandmarkFor(mv);
      const parts = Object.keys(hd).sort((a, b) => hd[b] - hd[a]).map(h => {
        const over = hlm && hd[h] > hlm.mrv;
        const txt = `${HEAD_LABELS[h] || h} ${kg(hd[h])}`;
        return over ? `<b style="color:var(--amber)">${txt} ⚠</b>` : txt;
      });
      if (parts.length) heads = `<div class="vol-heads faint">Regions: ${parts.join(' · ')}</div>`;
    }
    // [Cluster D] Per-muscle early deload: a deloaded muscle's bar is textured and
    // offers Resume; an over-MRV muscle offers to deload just that muscle (pull it
    // back for the rest of the block without deloading everything).
    const deloaded = autoreg && isMuscleDeloaded(mv);
    const rowTex = deloadTex || (deloaded ? ' deload-tex' : '');
    let mdCtl = '';
    if (autoreg) {
      if (deloaded) mdCtl = `<span class="vol-md faint">Muscle deload on · <button class="link-btn" onclick="toggleMuscleDeload('${mv}')">resume ›</button></span>`;
      else if (st.key === 'over') mdCtl = `<button class="link-btn vol-md" onclick="toggleMuscleDeload('${mv}')">deload this muscle ›</button>`;
    }
    return `<div class="vol-row">
      <div class="vol-head"><span>${MOVEMENTS[mv]?.label || mv}</span>
        <span class="vol-status k-${st.key}">${st.label} · ${kg(sets)} sets</span></div>
      <div class="vol-track"><div class="vol-fill k-${st.key}${rowTex}" style="width:${st.pct}%"></div>
        <div class="vol-mark" style="left:${mevPct}%"></div></div>
      <div class="vol-scale faint"><span>MEV ${L.mev}</span><span>MRV ${L.mrv}</span></div>
      ${heads}
      ${rec}
      ${mdCtl}
    </div>`;
  }).join('');
  // [Cluster D] Overreach warning: strictly over MRV (past recoverable volume),
  // sharper than the minicut nudge. Points at the per-muscle deload links or the
  // whole-block early deload on the dashboard.
  let overreach = '';
  if (autoreg) {
    const ovr = Engine.overreaching(statuses, readinessTrendingDown());
    if (ovr.overreaching) {
      overreach = `<div class="card accent" style="border-left:3px solid var(--red)">
        <div style="font-weight:700">⚠ Overreaching</div>
        <p class="faint mt8">${esc(ovr.reason)} - past what you can recover from. Ease the worst muscles back with the deload links below, or pull the whole block's deload in early from the dashboard.</p></div>`;
    }
  }
  // [Cluster D] Recovery / fatigue trend: the readiness series the deload logic
  // already reads. A downward slope means fatigue is outpacing recovery.
  let trend = '';
  if (autoreg) {
    const pts = (S.readinessLog || []).slice(-14).map(r => ({ ts: r.ts, value: r.score }));
    if (pts.length >= 2) {
      trend = `<div class="section-title" style="font-size:1rem">Recovery trend</div>
        <p class="faint" style="margin:-2px 0 6px">Your readiness over recent sessions. A downward slope means fatigue is outpacing recovery, and it pulls your deload in deeper.</p>
        ${trendChartHTML(pts, '#4b8df8', v => v.toFixed(1))}`;
    }
  }
  // [Cluster F] Minicut suggestion when fatigue saturates and we are not already cutting.
  let minicut = '';
  if (autoreg) {
    const sat = Engine.fatigueSaturated(statuses);
    if (sat.saturated && !PHASE_DEFICIT[phase]) {
      minicut = `<div class="card accent" style="border-left:3px solid var(--amber)">
        <div style="font-weight:700">Fatigue is piling up</div>
        <p class="faint mt8">${sat.over} muscles are at or near MRV. A short minicut (about 2 to 4 weeks in a deficit) would shed fatigue and resensitize you to volume.</p>
        <button class="btn btn-outline mt8" onclick="openPhase()">Plan a minicut ›</button></div>`;
    }
  }
  // [Cluster D] On the deload week, show how the deload was sized to the block's
  // accumulated fatigue (autoregulated depth).
  let deloadNote = '';
  if (autoreg && isEarlyDeloadActive()) {
    deloadNote = `<div class="card accent" style="border-left:3px solid var(--amber)">
      <div style="font-weight:700">Early deload this week</div>
      <p class="faint mt8">This block's deload was pulled in early to shed fatigue. Finish this lighter week, then your next block starts resensitized from MEV. <button class="link-btn" onclick="cancelEarlyDeload()">Resume normal block</button></p></div>`;
  } else if (autoreg && Engine.weekType(P().pointer.week) === 'deload' && P().deloadPlan && P().deloadPlan.level !== 'standard') {
    const dp = P().deloadPlan;
    deloadNote = `<div class="card accent" style="border-left:3px solid ${dp.level === 'deep' ? 'var(--amber)' : 'var(--green)'}">
      <div style="font-weight:700">${dp.level === 'deep' ? 'Deeper deload' : 'Lighter deload'}</div>
      <p class="faint mt8">${esc(dp.reason)}. Accessory volume is ${dp.level === 'deep' ? 'pulled back further' : 'kept a touch higher'} this week, then your volume resensitizes from MEV next block.</p></div>`;
  }
  return `<p class="subtle">Estimated direct working sets per muscle this week, against your own volume landmarks. The big compounds count toward the muscles they train.</p>
    ${autoreg ? `<div class="vol-phase faint">Phase: <b>${PHASE_LABELS[phase] || phase}</b>${PHASE_DEFICIT[phase] ? ' · recovery is lower, volume holds' : ''} <button class="link-btn" onclick="openPhase()">change ›</button></div>` : ''}
    ${overreach}
    ${deloadNote}
    ${minicut}
    ${trend}
    <div class="vol-legend faint">
      <span><i class="dot k-maint"></i>Maintenance</span>
      <span><i class="dot k-productive"></i>Productive</span>
      <span><i class="dot k-over"></i>Over MRV</span></div>
    ${rows}
    ${autoreg ? '<p class="faint mt16">The ▲ ▼ ＝ notes read your recovery check-ins and last sessions to suggest adding, holding, or cutting a muscle\'s sets, and they feed next week\'s volume automatically.</p>'
      : '<p class="faint mt16">MEV is the least that grows you, MRV the most you can recover from. A block should climb from MEV toward MRV, then deload.</p>'}`;
}
function openVolumeDashboard() {
  if (!P()) { toast('Start a program first', true); return; }
  showModal(anim => { $modal.innerHTML = modalShell(anim, 'Weekly volume', volumeDashboardHTML()); });
}
// [Cluster F] Current training phase, with a safe default.
function currentPhase() { return (S.profile && S.profile.phase) || 'lean-gain'; }
// [Cluster F] Phase & bodyweight screen: pick a training phase (it tunes the
// autoregulator's recovery read) and log a light bodyweight trend. No calories or
// macros: this is a training-coupled phase tag, not a nutrition tracker.
function bodyweightTrendHTML() {
  const bw = (S.bodyweight || []).filter(x => x.kg > 0).slice(-30);
  if (bw.length < 2) return '<p class="faint">Log your bodyweight a few times to see the trend.</p>';
  const pts = bw.map(x => ({ ts: x.ts, value: x.kg }));
  return trendChartHTML(pts, '#67a3ff', v => kg(v) + ' kg');
}
function phaseScreenHTML() {
  const cur = currentPhase();
  const last = (S.bodyweight || []).length ? S.bodyweight[S.bodyweight.length - 1].kg : (S.profile.bodyweight || '');
  const phases = ['lean-gain', 'maintenance', 'cut', 'minicut'].map(ph =>
    `<button class="phase-opt ${cur === ph ? 'on' : ''}" onclick="setPhase('${ph}')">
      <b>${PHASE_LABELS[ph]}</b><span class="faint">${esc(PHASE_BLURB[ph])}</span></button>`).join('');
  return `<div class="section-title" style="font-size:1.1rem">Training phase</div>
    <div class="phase-opts">${phases}</div>
    <div class="section-title" style="font-size:1.1rem">Bodyweight trend</div>
    <div class="field"><label>Log today's bodyweight (kg)</label>
      <input id="bw-input" type="number" inputmode="decimal" step="0.1" value="${last || ''}" placeholder="e.g. 82.5"></div>
    <button class="btn btn-blue mt8" onclick="logBodyweight()">Log bodyweight</button>
    <div class="mt16">${bodyweightTrendHTML()}</div>
    <p class="faint mt16">Trend only, to inform when to switch phases. No calorie or macro tracking.</p>`;
}
function openPhase() {
  showModal(anim => { $modal.innerHTML = modalShell(anim, 'Phase & bodyweight', phaseScreenHTML()); });
}
function setPhase(ph) {
  if (!PHASE_LABELS[ph]) return;
  S.profile.phase = ph;
  save(); toast('Phase set to ' + PHASE_LABELS[ph]); rerenderTop();
}
function logBodyweight() {
  const v = parseFloat(byId('bw-input') && byId('bw-input').value);
  if (!(v > 0)) { toast('Enter a bodyweight', true); return; }
  S.bodyweight = S.bodyweight || [];
  S.bodyweight.push({ ts: Date.now(), kg: v });
  S.profile.bodyweight = v;
  save(); toast('Bodyweight logged'); rerenderTop();
}
// [Cluster E] Update the per-muscle autoreg offset from the week just trained.
// Runs each week advance for a bodybuilding athlete; phase (Cluster F) tunes how
// readily volume climbs. A muscle with no logged session is left untouched, and a
// non-bodybuilding program never enters here, so the default routine is unchanged.
function updateAutoreg() {
  const p = P();
  if (!p || !p.trainingConfig || p.trainingConfig.track !== 'bodybuilding') return;
  p.volAdj = p.volAdj || {};
  const tally = weeklyVolumeByMuscle();
  const lm = S.profile.landmarks || {};
  const phase = currentPhase();
  for (const mv of VOL_ORDER) {
    const L = lm[mv] || VOLUME_LANDMARKS[mv];
    if (!L) continue;
    const sig = muscleSignal(mv);
    if (!sig) continue;
    const r = Engine.autoregVolume(sig, tally[mv] || 0, L, phase);
    const step = r.action === 'add' ? 1 : r.action === 'cut' ? -1 : 0;
    if (step) p.volAdj[mv] = Math.max(-2, Math.min(2, (p.volAdj[mv] || 0) + step));
  }
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
  // [Cluster D] An early deload ends the block, so the next week is a fresh block's
  // intro, never a work week: skip the week-feel prompt and just advance.
  if (!isEarlyDeloadActive()) {
    const up = nextPointer(p.pointer.block, p.pointer.week);
    // Change 2: only autoregulate into a genuine work week (accumulation / intensification / realization).
    if (up.block < p.blocks.length) {
      const t = Engine.weekType(up.week);
      if (t === 'accumulation' || t === 'intensification' || t === 'realization') { openWeekFeel(up); return; }
    }
  }
  p.weekMod = null; // calibration or deload week ahead, or program finishing: no modifier
  advanceWeek();
}
function advanceWeek() {
  const p = P();
  const finishedBlock = p.pointer.block;
  const bb = (p.trainingConfig || {}).track === 'bodybuilding';
  updateAutoreg(); // [Cluster E] fold the week's feedback into per-muscle volume
  // [Cluster D] An early (autoregulated) deload ends the block now: the week just
  // trained was the deload, so resensitize and roll to the next block instead of
  // advancing to week+1 (the remaining weeks are skipped). The deload plan was
  // already sized when the athlete accepted, so we do not resize it here.
  if (isEarlyDeloadActive()) { endBlock(finishedBlock, bb); return; }
  // [Cluster D] About to enter the scheduled deload week: size the deload to
  // accumulated fatigue now, while the pointer still sits on the peak week, so
  // resolveSlot can stay pure and just read the stored plan. Bodybuilding only.
  if (bb && Engine.weekType(p.pointer.week + 1) === 'deload') {
    p.deloadPlan = Engine.deloadDepth(fatigueStatuses(), readinessTrendingDown());
  }
  p.pointer.week++;
  if (p.pointer.week >= p.weeksPerBlock) endBlock(finishedBlock, bb);
  else { V.dayIdx = null; save(); render(); }
}
// [Cluster D] Close out a finished block: evolve the athlete's volume landmarks
// from how the block actually went (Step 5), drop never-trained optional
// accessories (carryover), resensitize (reset the per-muscle autoreg offset toward
// MEV so the next meso re-ramps from a clean base), spend the deload + early-deload
// plans, advance the pointer to the next block, and rotate bodybuilding accessories
// for variety. Shared by the scheduled week-5 deload and an early deload so both
// resensitize identically.
function endBlock(finishedBlock, bb) {
  const p = P();
  recalibrateLandmarks(finishedBlock);
  const dropped = carryoverOptionalDrops(finishedBlock);
  if (dropped.length) toast(`Dropped from your routine: ${dropped.join(', ')} (you skipped it all block)`);
  if (bb && p.volAdj) for (const mv in p.volAdj) p.volAdj[mv] = 0;
  p.deloadPlan = null;
  p.earlyDeload = null; // spent with the block
  p.muscleDeload = []; // [Cluster D] per-muscle deloads end with the block (resensitize)
  p.pointer.week = 0;
  p.pointer.block++;
  if (p.pointer.block < p.blocks.length) {
    // Clear block-scoped accessory selections so the user picks fresh each block.
    // [Cluster C] For bodybuilding, also rotate each generator-default accessory
    // to a fresh head-diverse pick from its muscle pool, so a new meso varies the
    // exercises (staleness/fatigue management). Athlete swaps (sl.ex) are cleared
    // as before; an explicit pick is reselected via the select slot.
    for (const day of p.days) {
      day.slots = day.slots.filter(sl => !sl.added);
      const used = new Set(), headsUsed = {}; // per-day, to keep rotated picks distinct
      for (const sl of day.slots) {
        if (sl.type === 'main' || sl.type === 'secondary') continue;
        delete sl.ex;
        if (!sl.def) { sl.type = 'select'; continue; }
        const m = bb ? muscleOfAcc(sl.def) : null;
        if (m) {
          const hs = headsUsed[m] || (headsUsed[m] = new Set());
          const id = pickAccessory(DEFAULT_ACC[m], used, hs, p.pointer.block);
          if (id) { sl.def = id; used.add(id); const h = accHead(id); if (h) hs.add(h); }
        }
      }
    }
    toast(`New block: ${p.blocks[p.pointer.block].label}`);
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
// Carryover (one block): an accessory that was offered as optional (over the
// time limit) at least twice in the block and was never trained once is dropped
// from the routine, so a time-capped athlete stops being shown work they keep
// skipping. Anything they did at least once is kept. Mains/secondaries never drop.
function carryoverOptionalDrops(blockIdx) {
  const sessions = S.sessions.filter(s => !s.skipped && s.b === blockIdx && s.entries);
  if (!sessions.length) return [];
  const stat = {};
  for (const s of sessions) for (const e of s.entries) {
    if (e.isMain || e.isSecondary || !e.exId) continue;
    const st = stat[e.exId] = stat[e.exId] || { opt: 0, done: 0 };
    if (e.optional) st.opt++;
    if (e.sets && e.sets.some(x => x.done)) st.done++;
  }
  const drop = Object.keys(stat).filter(id => stat[id].opt >= 2 && stat[id].done === 0);
  if (!drop.length) return [];
  for (const d of P().days) {
    d.slots = d.slots.filter(sl => {
      if (sl.type === 'main' || sl.type === 'secondary') return true;
      const id = sl.ex || sl.def;
      return !(id && drop.includes(id));
    });
  }
  return drop.map(exName);
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
  const dayBuilt = resolveDayEntries(di, p.pointer.block, w);
  const emptyDay = !locked && dayBuilt.items.length === 0;
  const optSi = new Set(dayBuilt.optItems.map(x => x.si));
  // [Cluster B] Superset layout for the day (bodybuilding only); drives the link
  // badge and the toggle on each accessory card.
  const bbTrack = p.trainingConfig && p.trainingConfig.track === 'bodybuilding';
  const ss = bbTrack ? supersetLayout(di, p.pointer.block, w) : { byId: {}, eligible: new Set() };

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
    const opt = optSi.has(si);
    // [Cluster B] Superset / giant-set link badge + toggle (accessories only). The
    // toggle reflects whether THIS slot links to the next; chaining links forms a
    // giant set. Every accessory with a following accessory can link.
    const ssInfo = ss.byId[si];
    const ssTag = ssInfo ? ` <span class="ss-tag">⛓ ${ssInfo.size > 2 ? 'giant set' : 'superset'} with ${esc(ssInfo.others)}</span>` : '';
    const ssBtn = (!rs.isMain && !rs.isSecondary && bbTrack && ss.eligible.has(si))
      ? `<button class="icon-btn" onclick="toggleSuperset(${di},${si})"><span class="ic">⛓</span>${slot.superset ? 'Unlink' : 'Superset'}</button>`
      : '';
    // [Cluster B] Within a group, compact up/down controls reorder the member while
    // keeping the group intact (disabled at the group's ends).
    const ssMove = ssInfo ? `${ssInfo.index > 0 ? `<button class="icon-btn ss-move" onclick="moveSupersetMember(${di},${si},-1)" aria-label="Move up in superset"><span class="ic">▲</span></button>` : ''}${ssInfo.index < ssInfo.size - 1 ? `<button class="icon-btn ss-move" onclick="moveSupersetMember(${di},${si},1)" aria-label="Move down in superset"><span class="ic">▼</span></button>` : ''}` : '';
    // Main and secondary lifts anchor the program (and the working max), so they
    // are swap-only. Accessories and anything the athlete added can be removed by
    // swiping the card left to reveal a Remove action.
    const card = `<div class="ex-card ${opt ? 'optional' : ''}${ssInfo ? ' superset' : ''}" data-si="${si}">
      ${grip}
      <span class="name">${esc(rs.name)}${opt ? ' <span class="opt-tag">optional</span>' : ''}${ssTag}</span>
      <span class="actions">
        <button class="icon-btn" onclick="openExDetail('${rs.exId}')"><span class="ic">ⓘ</span>Info</button>
        ${ssMove}${ssBtn}
        <button class="icon-btn" onclick="openSwap(${di},${si})"><span class="ic">⇄</span>Swap</button>
      </span>
    </div>`;
    if (rs.isMain || rs.isSecondary) return card;
    return `<div class="ex-swipe" data-si="${si}" onpointerdown="exSwipeDown(event,${di},${si})">
      <button class="ex-remove" onclick="removeSlot(${di},${si})" aria-label="Remove ${esc(rs.name)}"><span class="ic">🗑</span>Remove</button>
      ${card}
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
      <div class="subtle">${dayTheme(day) ? esc(dayTheme(day)) + ' · ' : ''}${weekLabelFor(block, w)}${doneState ? ' · ' + (doneState === 'skipped' ? 'Skipped' : 'Completed ✓') : ''}</div>
    </div>
    ${timeBannerHTML(di)}
    <button class="btn-ghost" style="margin:4px 2px" onclick="openTimeByWeek(${di})">See time by week ›</button>
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
    ${timeBudgetHTML(di)}
    <button class="btn btn-outline" style="border-radius:24px" onclick="openAddExercise(${di})">＋ Add Exercise</button>
  </div>${tabbar()}`;
}
function prevDay() { V.dayIdx = Math.max(0, currentDayIdx() - 1); render(); }
function nextDay() { V.dayIdx = Math.min(P().days.length - 1, currentDayIdx() + 1); render(); }

// --- drag-to-reorder exercises (hold the ⠿ grip) ---
let DRAG = null;
function gripDown(ev, di, si) {
  ev.preventDefault();
  // Removable rows are wrapped in .ex-swipe; that wrapper is the direct child of
  // the list, so reorder must move it (not the inner .ex-card).
  const card = ev.target.closest('.ex-swipe') || ev.target.closest('.ex-card');
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

// --- swipe-left-to-remove (accessories + added exercises) ---
// Drag the card left past a threshold to reveal the Remove action behind it.
// Vertical drags fall through to native scroll (and to the grip's reorder),
// so this never fights page scrolling or the reorder gesture.
const SWIPE_REVEAL = 92; // px; must match .ex-swipe.open .ex-card transform
let SWP = null;
function exSwipeDown(ev, di, si) {
  // Let the grip (reorder) and the row's own buttons keep their own gestures.
  if (ev.target.closest('.grip') || ev.target.closest('.icon-btn') || ev.target.closest('.ex-remove')) return;
  const wrap = ev.currentTarget;
  const card = wrap.querySelector('.ex-card');
  if (!card) return;
  // A tap on a row while another is open just closes the open one.
  closeOpenSwipes(wrap);
  SWP = { di, si, wrap, card, x0: ev.clientX, y0: ev.clientY,
          open: wrap.classList.contains('open'), decided: false };
  document.addEventListener('pointermove', exSwipeMove, { passive: false });
  document.addEventListener('pointerup', exSwipeUp, { once: true });
  document.addEventListener('pointercancel', exSwipeUp, { once: true });
}
function exSwipeMove(ev) {
  if (!SWP) return;
  const dx = ev.clientX - SWP.x0, dy = ev.clientY - SWP.y0;
  if (!SWP.decided) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
    if (Math.abs(dy) >= Math.abs(dx)) { endSwipe(); return; } // vertical -> let it scroll / reorder
    SWP.decided = true;
    SWP.wrap.classList.add('swiping');
  }
  ev.preventDefault();
  let t = (SWP.open ? -SWIPE_REVEAL : 0) + dx;
  t = Math.max(-SWIPE_REVEAL - 16, Math.min(0, t)); // only opens leftward, slight overscroll
  SWP.card.style.transform = `translateX(${t}px)`;
}
function exSwipeUp(ev) {
  if (!SWP) return;
  const { wrap, card, open, decided } = SWP;
  const dx = ev.clientX - SWP.x0;
  wrap.classList.remove('swiping');
  card.style.transform = '';
  const nowOpen = decided ? (open ? dx < SWIPE_REVEAL / 2 : dx < -SWIPE_REVEAL / 2) : false;
  wrap.classList.toggle('open', nowOpen);
  endSwipe();
}
function endSwipe() {
  document.removeEventListener('pointermove', exSwipeMove);
  SWP = null;
}
function closeOpenSwipes(except) {
  document.querySelectorAll('.ex-swipe.open').forEach(w => { if (w !== except) w.classList.remove('open'); });
}
let LAST_REMOVED = null;
function removeSlot(di, si) {
  const p = P();
  const slot = p.days[di].slots[si];
  if (!slot) return;
  const name = resolveSlot(slot, p.pointer.block, p.pointer.week).name || 'Exercise';
  LAST_REMOVED = { di, si, slot };
  p.days[di].slots.splice(si, 1);
  save(); render();
  toastAction(name + ' removed', 'Undo', undoRemove);
}
function undoRemove() {
  if (!LAST_REMOVED) return;
  const { di, si, slot } = LAST_REMOVED;
  const slots = P().days[di].slots;
  slots.splice(Math.min(si, slots.length), 0, slot);
  LAST_REMOVED = null;
  save(); render();
  toast('Removal undone');
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
  const bi = P().pointer.block, wi = P().pointer.week;
  for (const slot of day.slots) {
    // Skip slots a focus slider (set to 0) or a track rule has removed: a muscle
    // with no scheduled work needs no readiness slider. resolveSlot is the same
    // source of truth the workout view uses, so the check-in matches what renders.
    if (resolveSlot(slot, bi, wi).isRemoved) continue;
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
  // resolveDayEntries applies muscle focus and classifies each exercise as core
  // or optional for a time-capped athlete. All are logged; optional ones are
  // flagged so the session shows them and the block-end carryover can learn.
  const built = resolveDayEntries(di, b, w);
  const entries = built.items.map(sessionEntryFrom);
  V.draft = { id: 's' + Date.now(), ts: Date.now(), b, w, d: di, entries,
              sleepHours: cd.sleepHours, mindset: cd.mindset, sliders: { ...cd.sliders } };
  clearRestTimer();
  save();
  nav('session');
}
// Build one session entry (logging shape) from a resolveDayEntries item. Shared by
// session start and the mid-session swap rebuild so both stay in sync.
function sessionEntryFrom(x) {
  return {
    si: x.si, exId: x.rs.exId, name: x.rs.name,
    isMain: !!x.rs.isMain, isSecondary: !!x.rs.isSecondary, wmKey: x.rs.wmKey || null,
    optional: !!x.rs.optional,
    superset: !!x.rs.superset, supersetRole: x.rs.supersetRole || null, supersetPartner: x.rs.supersetPartner || null,
    supersetGroup: x.rs.supersetGroup != null ? x.rs.supersetGroup : null,
    supersetIndex: x.rs.supersetIndex != null ? x.rs.supersetIndex : null,
    supersetSize: x.rs.supersetSize || null, supersetNames: x.rs.supersetNames || null,
    notes: '', notesOpen: false,
    sets: x.rs.sets.map(t => ({
      targetWeight: t.weight ?? null, targetReps: t.reps, targetRpe: t.rpe ?? null,
      amrap: !!t.amrap, ramp: !!t.ramp, calib: !!t.calib, note: t.note || null,
      technique: t.technique || null, dropTargets: t.drops || null,
      weight: null, reps: null, rpe: null, drops: null, done: false,
    })),
  };
}

function ratingsStripHTML(sliders) {
  const map = ['squat', 'bench', 'deadlift', 'upperpull', 'press', 'lowback'];
  const shown = map.filter(k => sliders[k] != null).slice(0, 4);
  if (!shown.length) return '';
  return `<div class="section-title" style="font-size:1.25rem">${esc(t('session.readiness_title'))} <span class="faint">ⓘ</span></div>
  <div class="ratings-strip">${shown.map(k =>
    `<div class="r"><div class="k">${esc(t('lift.' + k))}</div><div class="v">${sliders[k]}</div></div>`).join('')}</div>`;
}

function lastSetInfo(exId) {
  const recs = recordsFor(exId);
  if (!recs.length) return '';
  const r = recs[recs.length - 1];
  return `<div class="lastset">${esc(t('session.last_set'))} ${new Date(r.ts).toLocaleDateString(I18N.dateLocale())}<br>
    ${r.reps} reps x ${fmtW(exId, r.weight)} · ${fmtRir(r.rpe)}${pumpBadge(r.pump)} ›</div>`;
}

function setTargetLabel(st, exId) {
  const tech = techniqueBadge(st.technique) +
    (st.dropTargets ? ` <small class="faint">${esc(t('set.then', { detail: dropDetail(exId, st.dropTargets) }))}</small>` : '');
  if (st.amrap) return `${fmtW(exId, st.targetWeight)} × AMRAP <small>${esc(t('set.amrap_standard', { reps: st.targetReps }))}</small>${tech}`;
  // Calibration rows stay bare; the card carries the one-line explainer.
  if (st.calib) return `${esc(t('set.reps_at_rir', { reps: st.targetReps, rir: fmtRir(st.targetRpe) }))}${tech}`;
  if (st.targetWeight != null && st.targetRpe != null)
    return `${fmtW(exId, st.targetWeight)} × ${st.targetReps} <small>${esc(t('set.cap_at', { rir: fmtRir(st.targetRpe) }))}</small>${tech}`;
  if (st.targetWeight != null) return `${fmtW(exId, st.targetWeight)} × ${st.targetReps}${tech}`;
  return `${esc(t('set.reps_at_rir', { reps: st.targetReps, rir: fmtRir(st.targetRpe) }))}${tech}`;
}

// De-verbose the session card (owner feedback): the same boilerplate repeated
// on every set row reads three times as long as it needs to. The shared line
// (calibration explainer, deload copy) hoists to ONE card-level hint; rows keep
// only what differs per set ('build up', 'top set'). Display-only: the engine's
// set objects and notes are untouched, so nothing prescription-side moves.
function cardHintFor(sets) {
  const work = sets.filter(s => !s.ramp);
  if (!work.length) return null;
  if (work.every(s => s.calib)) return t('session.calibration_hint');
  const notes = [...new Set(work.map(s => s.note).filter(Boolean))];
  return (notes.length === 1 && work.every(s => s.note)) ? notes[0] : null;
}
function displaySetNote(st, cardHint) {
  if (!st.note) return null;
  if (cardHint && st.note === cardHint) return null; // hoisted to the card line
  if (st.calib) return st.note.replace(/^Calibration(\s*·\s*)?/, '') || null;
  return st.note;
}

// [Cluster B] One-time "we switched to RIR" note, dismissed for good once read.
function rirIntroHTML() {
  if (S.flags && S.flags.rirSeen) return '';
  return `<div class="card accent rir-intro">
    <div style="font-weight:700">${esc(t('rir.intro_title'))}</div>
    <p class="faint mt8">${esc(t('rir.intro_body'))}</p>
    <button class="btn btn-outline mt8" onclick="dismissRir()">${esc(t('rir.got_it'))}</button></div>`;
}
function dismissRir() { S.flags = S.flags || {}; S.flags.rirSeen = true; save(); render(); }

// [Cluster B] Surface the drop set right where the athlete trains, not buried in
// settings. The chip toggles the technique live on this entry's last working set
// and remembers the choice (S.techniques) for next time. Bodybuilding accessories
// only, so it never appears on the default/powerbuilding path.
function lastWorkingSetIdx(sets) {
  for (let i = sets.length - 1; i >= 0; i--) {
    const s = sets[i];
    if (s.amrap || s.ramp || s.calib || s.skipped) continue;
    if ((s.done ? s.weight : s.targetWeight) > 0) return i;
  }
  return -1;
}
// The finisher currently on an entry's sets ('drop' | 'myo' | 'restpause'), or
// null. Only one finisher lives on an exercise at a time.
function entryTech(e) {
  const s = e.sets.find(s => FINISHER_TECHS.includes(s.technique));
  return s ? s.technique : null;
}
function entryHasDrop(e) { return entryTech(e) === 'drop'; } // kept for existing tests
function canDropEntry(e) {
  const tc = P() && P().trainingConfig;
  if (!tc || tc.track !== 'bodybuilding') return false;
  if (e.isMain || e.isSecondary || !e.exId) return false;
  return lastWorkingSetIdx(e.sets) >= 0;
}
// Chip icons per finisher; labels and the how-to toast live in the i18n
// catalog ('tech.<id>' / 'tech.<id>_how'), athlete-facing, no em dashes.
const FINISHER_ICONS = { drop: '🔥', myo: '🔁', restpause: '⏸', partials: '📐' };
function techChipHTML(e, ei) {
  if (!canDropEntry(e)) return '';
  const cur = entryTech(e);
  const chip = (tech) =>
    `<button class="tech-chip ${cur === tech ? 'on' : ''}" onclick="toggleTechInSession(${ei},'${tech}')">${FINISHER_ICONS[tech]} ${esc(t('tech.chip_' + tech))}${cur === tech ? ' ✓' : ''}</button>`;
  // Tie the chips to the one set they run on, and settle the effort question
  // right where it comes up: the set stops at its RIR cap, the finisher is the
  // part that goes near failure.
  const onIdx = e.sets.findIndex(s => FINISHER_TECHS.includes(s.technique));
  const note = cur
    ? `<small class="faint tech-note">${esc(t('tech.runs_on_set', { n: onIdx + 1, tech: t('tech.' + cur).toLowerCase() }))}</small>`
    : '';
  return `<div class="tech-row">
    <span class="tech-row-label">${esc(t('tech.add_finisher'))} <small class="faint">${esc(t('tech.optional_last_set'))}</small>
      <button class="info-dot" onclick="openFinisherInfo()" aria-label="${esc(t('tech.what_is'))}">ⓘ</button></span>
    <div class="tech-chips">${FINISHER_TECHS.map(chip).join('')}</div>
    ${note}
  </div>`;
}
// What finishers are and how to run/log each one. Opened from the ⓘ on the
// finisher chip row; the athlete question it settles: "cap the set at its RIR,
// or take it to failure before the finisher?" (Answer: cap the set.)
function openFinisherInfo() {
  const card = tech => `<div class="card"><b>${FINISHER_ICONS[tech]} ${esc(t('tech.chip_' + tech))}</b><p class="faint mt8">${esc(t('tech.info_' + tech))}</p></div>`;
  showModal(anim => {
    $modal.innerHTML = modalShell(anim, t('tech.info_title'), `
      <p class="subtle">${t('tech.info_intro')}</p>
      ${FINISHER_TECHS.map(card).join('')}
      <p class="faint">${esc(t('tech.info_logging'))}</p>`);
  });
}
function clearEntryTechnique(e) {
  e.sets.forEach(s => {
    if (FINISHER_TECHS.includes(s.technique)) {
      s.technique = null; s.dropTargets = null;
      if (!s.done) s.drops = null; // keep already-logged mini-sets
    }
  });
}
function toggleTechInSession(ei, tech) {
  const e = V.draft.entries[ei];
  const cur = entryTech(e);
  clearEntryTechnique(e); // only one finisher per exercise
  if (cur === tech) {
    if (S.techniques) delete S.techniques[e.exId];
    toast(t('tech.removed', { name: t('tech.' + tech) }));
  } else {
    const i = lastWorkingSetIdx(e.sets);
    if (i < 0) { toast(t('tech.need_weight'), true); return; }
    const s = e.sets[i];
    const baseW = s.done ? s.weight : s.targetWeight;
    const built = buildTechnique(tech, { weight: baseW, reps: s.targetReps || s.reps || 8 }, loadingFor(e.exId).totalInc);
    s.technique = tech; s.dropTargets = built.drops;
    S.techniques = S.techniques || {}; S.techniques[e.exId] = tech;
    toast(t('tech.' + tech + '_how'));
  }
  save(); render();
}

function vSession() {
  const dr = V.draft;
  if (!dr) return vWorkout();
  const block = blockOf(dr.b);
  const shortSleep = dr.sleepHours < 6;
  const cards = sessionCardsHTML(dr, shortSleep);

  return `<header class="topbar">
      <button class="btn-ghost" onclick="abandonSession()">‹</button>
      <div class="col center"><span style="color:var(--blue);font-weight:600">${esc(block.label)}</span>
      <span style="font-weight:700">${esc(t('session.week_day', { week: dr.b * P().weeksPerBlock + dr.w + 1, day: dr.d + 1 }))}</span></div>
      <span></span></header>
    <div class="view">
      ${restTimerHTML()}
      ${shortSleep ? `<div class="banner-warn">${esc(t('session.short_sleep', { hours: dr.sleepHours }))}</div>` : ''}
      ${rirIntroHTML()}
      ${dr.mindset ? `<div class="card accent"><span class="faint">${esc(t('session.todays_focus'))}</span><div style="font-weight:600">${esc(dr.mindset)}</div></div>` : ''}
      ${ratingsStripHTML(dr.sliders)}
      ${cards}
      <button class="btn btn-green mt16" onclick="openSessionRating()">${esc(t('session.finish_workout'))}</button>
    </div>`;
}
// [Cluster B] Members of a draft entry's superset group, in order.
function supersetGroupMembers(entries, e) {
  return entries.filter(x => x.superset && x.supersetGroup === e.supersetGroup);
}
// [Cluster B] True once every member of the group has logged its set for round r
// (a member with no set at r counts as done), so the shared per-round rest can
// arm. Pure (operates on draft entries), so it unit-tests without the perf modal.
function supersetRoundComplete(entries, e, r) {
  return supersetGroupMembers(entries, e).every(m => r >= m.sets.length || m.sets[r].done || m.sets[r].skipped);
}
// [Cluster B] The next member still owing a set in round r (the one to alternate
// to), or undefined when the round is complete.
function supersetNextInRound(entries, e, r) {
  return supersetGroupMembers(entries, e).find(m => r < m.sets.length && !m.sets[r].done && !m.sets[r].skipped);
}
// [Cluster B] Build the session cards, grouping consecutive superset members into
// one alternating round-based card. Non-grouped entries render as the standard
// single-exercise card. Group members are contiguous in dr.entries (slot order).
function sessionCardsHTML(dr, shortSleep) {
  const out = [];
  for (let ei = 0; ei < dr.entries.length; ei++) {
    const e = dr.entries[ei];
    if (e.superset && e.supersetRole === 'head') {
      const members = [];
      let j = ei;
      while (j < dr.entries.length && dr.entries[j].superset && dr.entries[j].supersetGroup === e.supersetGroup) {
        members.push({ e: dr.entries[j], ei: j }); j++;
      }
      out.push(supersetGroupCardHTML(members, dr));
      ei = j - 1;
    } else {
      out.push(liftCardHTML(e, ei, dr, shortSleep));
    }
  }
  return out.join('');
}
// One logged set row (shared by the single card and, in compact form, the
// superset round cells).
function setRowHTML(e, ei, st, si2, shortSleep, cardHint) {
  const perfLabel = st.done ? `${fmtW(e.exId, st.weight)} x ${st.reps} · ${fmtRir(st.rpe)}` : st.skipped ? esc(t('session.skipped')) : esc(t('session.performance'));
  const fatigueFlag = shortSleep && !st.ramp && si2 >= e.sets.length - 1 && !e.isMain
    ? `<div class="flag">${esc(t('session.short_sleep_flag'))}</div>` : '';
  const loggedDrops = (st.done && st.drops && st.drops.length)
    ? `<small class="faint">${childWord(st.technique)} ${dropDetail(e.exId, st.drops)}</small>` : '';
  const hasTech = FINISHER_TECHS.includes(st.technique);
  const note = displaySetNote(st, cardHint);
  return `<div class="set-row ${st.done ? 'done' : ''} ${st.amrap ? 'amrap' : ''} ${st.skipped ? 'skipped' : ''} ${hasTech ? 'tech' : ''}">
      <span class="num">${st.skipped ? '–' : si2 + 1}</span>
      <span class="target">${setTargetLabel(st, e.exId)}${note ? `<small>${esc(note)}</small>` : ''}${loggedDrops}</span>
      <button class="perf ${st.done ? 'filled' : ''}" onclick="openPerf(${ei},${si2})">${perfLabel}</button>
    </div>${fatigueFlag}`;
}
// The standard single-exercise session card.
function liftCardHTML(e, ei, dr, shortSleep) {
  const cardHint = cardHintFor(e.sets);
  const setRows = e.sets.map((st, si2) => setRowHTML(e, ei, st, si2, shortSleep, cardHint)).join('');
  const schemeWork = e.sets.filter(s => !s.ramp);
  const schemeTxt = schemeWork.length ? esc(t('session.sets_x_reps', { sets: schemeWork.length, reps: schemeWork[0].targetReps })) : '';
  const top = topWorkWeight(e);
  return `<div class="lift-card ${e.optional ? 'optional' : ''}">
      <h3>${esc(e.name)}${e.optional ? ` <span class="opt-tag">${esc(t('session.optional_tag'))}</span>` : ''}</h3>
      ${e.optional ? `<p class="faint" style="margin:-4px 0 6px">${esc(t('session.over_time_limit'))}</p>` : ''}
      ${lastSetInfo(e.exId)}
      <div class="head-actions">
        <button onclick="openSwap(${dr.d},${e.si})" aria-label="${esc(t('session.swap_exercise'))}">⇄</button>
        <button onclick="openExDetail('${e.exId}')">ⓘ</button>
      </div>
      ${top && loadingFor(e.exId).showPlates ? `<button class="warmup-btn" onclick="openWarmup(${top},'${e.exId}')"><b>＋</b> ${esc(t('session.warmup'))}</button>` : ''}
      <div class="scheme">${schemeTxt}</div>
      ${cardHint ? `<p class="faint" style="margin:2px 0 6px;font-size:.78rem">${esc(cardHint)}</p>` : ''}
      ${techChipHTML(e, ei)}
      ${setRows}
      <button class="notes-link" onclick="toggleNotes(${ei})">${esc(t('session.notes'))} ✎</button>
      ${e.notesOpen ? `<textarea class="notes-area" oninput="setNotes(${ei}, this.value)" placeholder="${esc(t('session.notes_placeholder'))}">${esc(e.notes)}</textarea>` : ''}
    </div>`;
}
// [Cluster B] The combined superset / giant-set card: a compact controls row per
// member (swap / info / finisher / notes), then the work logged ROUND by round
// (one set of each member, then rest). Each cell opens the same perf modal as a
// normal set, so logging is unchanged underneath.
function supersetGroupCardHTML(members, dr) {
  const title = members.length > 2 ? t('session.giant_set') : t('session.superset');
  const anyOptional = members.some(m => m.e.optional);
  const maxRounds = Math.max(...members.map(m => m.e.sets.length));
  const controls = members.map(({ e, ei }) => `
      <div class="ss-member">
        <div class="ss-member-row">
          <span class="ss-member-name">${esc(e.name)}</span>
          <span class="head-actions">
            <button onclick="openSwap(${dr.d},${e.si})" aria-label="${esc(t('session.swap_exercise'))}">⇄</button>
            <button onclick="openExDetail('${e.exId}')">ⓘ</button>
            <button onclick="toggleNotes(${ei})" aria-label="${esc(t('session.notes'))}">✎</button>
          </span>
        </div>
        ${techChipHTML(e, ei)}
        ${e.notesOpen ? `<textarea class="notes-area" oninput="setNotes(${ei}, this.value)" placeholder="${esc(t('session.notes_placeholder'))}">${esc(e.notes)}</textarea>` : ''}
      </div>`).join('');
  const rounds = [];
  for (let r = 0; r < maxRounds; r++) {
    const cells = members.map(({ e, ei }) => {
      if (r >= e.sets.length) return `<div class="ss-set-row empty"><span class="ss-set-ex faint">${esc(e.name)}</span><span class="faint">${esc(t('session.member_done'))}</span></div>`;
      const st = e.sets[r];
      const perfLabel = st.done ? `${fmtW(e.exId, st.weight)} x ${st.reps} · ${fmtRir(st.rpe)}` : st.skipped ? esc(t('session.skipped')) : esc(t('session.log'));
      const loggedDrops = (st.done && st.drops && st.drops.length)
        ? ` <small class="faint">${childWord(st.technique)} ${dropDetail(e.exId, st.drops)}</small>` : '';
      return `<div class="ss-set-row ${st.done ? 'done' : ''} ${st.skipped ? 'skipped' : ''}">
          <span class="ss-set-ex">${esc(e.name)}</span>
          <span class="target">${setTargetLabel(st, e.exId)}${loggedDrops}</span>
          <button class="perf ${st.done ? 'filled' : ''}" onclick="openPerf(${ei},${r})">${perfLabel}</button>
        </div>`;
    }).join('');
    rounds.push(`<div class="ss-round"><div class="ss-round-n">${esc(t('session.round', { n: r + 1 }))}</div>${cells}</div>`);
  }
  return `<div class="lift-card superset-group ${anyOptional ? 'optional' : ''}">
      <h3>⛓ ${esc(title)} <span class="ss-tag">${members.map(m => esc(m.e.name)).join(' + ')}</span></h3>
      <p class="faint" style="margin:-2px 0 8px">${esc(t('session.superset_how'))}</p>
      ${anyOptional ? `<p class="faint" style="margin:-4px 0 6px">${esc(t('session.over_time_limit'))}</p>` : ''}
      <div class="ss-members">${controls}</div>
      <div class="ss-rounds">${rounds.join('')}</div>
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
    title: t('session.leave_title'),
    message: t('session.leave_message'),
    confirmLabel: t('session.leave_confirm'),
  }, () => nav('workout'));
}

// ------------------------------------------------------------
// IN-APP REST TIMER (Polish)
// A per-set countdown surfaced on the active session view, seeded from the
// prescribed rest that already lives in TIME_MODEL (Engine.restSecFor). It is
// ephemeral V state only: no persisted field, no set-object change, read-only on
// the engine, so the default/powerbuilding golden master is untouched. Copy is
// athlete-facing, so no em dashes.
// ------------------------------------------------------------
let REST_TICK = null;
function sessionTight() {
  // A time-capped athlete trains on the compressed rest table, so the timer
  // counts down what they actually rest, matching estimateSessionSec's input.
  const tc = P() && P().trainingConfig;
  return !!(tc && tc.timeMode === 'custom' && tc.timeCapMin);
}
// A brief, gentle two-tone chime when a timer finishes. Synthesized with Web
// Audio so there is no asset file to ship (matches the no-build ethos): two
// soft sine notes at low volume with a quick fade, so it stays tolerable.
// Silent where audio is unavailable or blocked. Pairs with the existing vibrate.
let AUDIO_CTX = null;
function audioCtx() {
  if (AUDIO_CTX) return AUDIO_CTX;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { AUDIO_CTX = new AC(); } catch (_) { return null; }
  return AUDIO_CTX;
}
// Call inside a user gesture so the later chime is allowed to play. iOS (and the
// standalone PWA in particular) needs more than resume(): the context only truly
// unlocks once an audio node has actually played inside a gesture, so we also
// start a one-sample silent buffer. Cheap and idempotent, so it is safe to call
// on every timer start and from the first-tap listener wired in boot().
let AUDIO_UNLOCKED = false;
function primeAudio() {
  const c = audioCtx();
  if (!c) return;
  try {
    if (c.state === 'suspended') c.resume();
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
    AUDIO_UNLOCKED = true;
  } catch (_) {}
}
// The installed PWA (iOS especially) silences synthesized Web Audio, because that
// rides the ringer channel the hardware mute switch cuts, but it plays an <audio>
// element on the media channel. The athlete confirmed the WAV/<audio> path is
// audible there (Settings > Debug), so the timer chime uses it.
//
// CRUCIAL for iOS: the unlock is PER ELEMENT, so the same <audio> instance that was
// played inside a user gesture must be the one replayed later when the timer ends
// (outside any gesture). A fresh `new Audio()` per chime is blocked even after a
// gesture, which is why the debug button (played in a tap) worked but the timer did
// not. So we keep ONE persistent element, unlock it on a gesture (primeHtmlAudio),
// and replay it (playChime). Its blob URL is kept alive for the whole session.
let CHIME_EL = null;
let CHIME_UNLOCKED = false;
function chimeEl() {
  if (CHIME_EL) return CHIME_EL;
  try {
    CHIME_EL = new Audio(buildBeepWavUrl([880, 1320], 0.18, 0.5)); // two soft ascending notes
    CHIME_EL.preload = 'auto';
  } catch (_) { CHIME_EL = null; }
  return CHIME_EL;
}
// Unlock the persistent chime element from inside a user gesture by playing it
// muted once, then resetting. Idempotent; safe to call on every gesture (it no-ops
// after the first successful unlock).
function primeHtmlAudio() {
  const a = chimeEl();
  if (!a || CHIME_UNLOCKED) return;
  try {
    a.muted = true;
    const p = a.play();
    if (p && p.then) p.then(() => { a.pause(); try { a.currentTime = 0; } catch (_) {} a.muted = false; CHIME_UNLOCKED = true; })
                      .catch(() => { a.muted = false; });
  } catch (_) {}
}
function playChime() {
  const a = chimeEl();
  if (a) {
    try {
      a.muted = false;
      try { a.currentTime = 0; } catch (_) {}
      const p = a.play();
      if (p && p.catch) p.catch(() => playWebAudioTones([880, 1320], 'sine', 0.12)); // blocked: fall back
      return;
    } catch (_) {}
  }
  playWebAudioTones([880, 1320], 'sine', 0.12);
}
// ----- Chime debug harness -------------------------------------------------
// The synthesized Web Audio chime is silent in some standalone PWAs (notably
// iOS, which routes Web Audio through the ringer channel that the hardware mute
// switch silences, while <audio> media playback uses a separate channel). To
// find what actually sounds on a given device, Settings > Debug exposes a button
// per config below; the athlete taps each and reports which one rings.
const CHIME_CONFIGS = [
  { id: 'webaudio', label: 'Web Audio sine (old)',
    desc: 'The previous chime. Two soft sine notes (silent in this PWA).' },
  { id: 'webaudio-loud', label: 'Web Audio square, loud',
    desc: 'Same path, louder and harsher (square wave).' },
  { id: 'htmlaudio', label: 'Audio file (WAV, current)',
    desc: 'What the timer uses now: a beep through an <audio> element (media channel).' },
  { id: 'htmlaudio-loud', label: 'Audio file, loud + long',
    desc: 'Same media path, louder and longer.' },
  { id: 'vibrate', label: 'Vibrate only',
    desc: 'No sound. Confirms haptics fire (a baseline sanity check).' },
];
// Build a one-shot WAV blob URL for a sequence of tones, so we can play it via an
// HTMLAudioElement (a different audio path than Web Audio). Caller revokes.
function buildBeepWavUrl(freqs, noteSec, vol) {
  const rate = 44100, per = Math.floor(noteSec * rate), n = per * freqs.length;
  const buf = new ArrayBuffer(44 + n * 2), view = new DataView(buf);
  const txt = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); view.setUint32(4, 36 + n * 2, true); txt(8, 'WAVE');
  txt(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  txt(36, 'data'); view.setUint32(40, n * 2, true);
  let off = 44;
  freqs.forEach((f, k) => {
    for (let i = 0; i < per; i++) {
      const t = i / per;
      const env = Math.min(1, t / 0.04) * Math.min(1, (1 - t) / 0.3); // attack + fade
      const s = Math.sin(2 * Math.PI * f * (i / rate)) * vol * env;
      view.setInt16(off, Math.max(-1, Math.min(1, s)) * 0x7fff, true);
      off += 2;
    }
  });
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
// Web Audio tones with a configurable waveform and gain (generalizes playChime).
function playWebAudioTones(freqs, type, peak) {
  const c = audioCtx();
  if (!c) return false;
  try {
    if (c.state === 'suspended') c.resume();
    const now = c.currentTime;
    freqs.forEach((f, k) => {
      const osc = c.createOscillator(), gain = c.createGain(), start = now + k * 0.16;
      osc.type = type; osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain).connect(c.destination);
      osc.start(start); osc.stop(start + 0.24);
    });
    return true;
  } catch (_) { return false; }
}
// Play a generated WAV through an <audio> element (the media channel path).
function playHtmlAudio(freqs, noteSec, vol) {
  try {
    const url = buildBeepWavUrl(freqs, noteSec, vol);
    const a = new Audio(url);
    a.volume = 1;
    a.addEventListener('ended', () => URL.revokeObjectURL(url));
    const p = a.play();
    if (p && p.catch) p.catch(e => { console.warn('html audio play blocked', e); URL.revokeObjectURL(url); });
    return true;
  } catch (e) { console.warn('html audio failed', e); return false; }
}
function playTestChime(id) {
  primeAudio(); // we are inside the button tap, so this unlock counts
  switch (id) {
    case 'webaudio':      playWebAudioTones([880, 1320], 'sine', 0.12); break;
    case 'webaudio-loud': playWebAudioTones([880, 1320], 'square', 0.4); break;
    case 'htmlaudio':     playHtmlAudio([880, 1320], 0.18, 0.5); break;
    case 'htmlaudio-loud':playHtmlAudio([784, 1175], 0.32, 0.9); break;
    case 'vibrate': break;
  }
  if (navigator.vibrate) { try { navigator.vibrate(150); } catch (_) {} }
  const cfg = CHIME_CONFIGS.find(c => c.id === id);
  toast('Played: ' + (cfg ? cfg.label : id));
}
function startRestTimer(kind, exId) {
  const dur = Engine.restSecFor(kind, sessionTight(), TIME_MODEL);
  V.restTimer = { endTs: Date.now() + dur * 1000, durSec: dur, exId, rung: false };
  primeAudio(); primeHtmlAudio();
  stopRestTick();
  REST_TICK = setInterval(restTick, 250);
}
function restRemainingSec() {
  return V.restTimer ? Math.max(0, Math.round((V.restTimer.endTs - Date.now()) / 1000)) : 0;
}
function fmtClock(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function restTick() {
  const bar = byId('rest-timer');
  if (!V.restTimer || !bar) { stopRestTick(); return; } // bar gone (navigated away)
  const left = restRemainingSec();
  const disp = byId('rest-timer-time'); if (disp) disp.textContent = left > 0 ? fmtClock(left) : t('rest.done');
  const fill = byId('rest-timer-fill'); if (fill) fill.style.width = `${100 * (1 - left / V.restTimer.durSec)}%`;
  const skip = byId('rest-timer-skip'); if (skip && left <= 0) skip.textContent = t('rest.done_btn');
  if (left <= 0) {
    if (!V.restTimer.rung) {
      V.restTimer.rung = true;
      bar.classList.add('done');
      playChime();
      if (navigator.vibrate) { try { navigator.vibrate(200); } catch (_) {} }
      // In another app or on the lock screen the chime is not enough (or never
      // plays): surface a system notification. In the foreground the bar and
      // chime already announce it, so no banner noise there.
      if (document.hidden) showRestNotification();
    }
    stopRestTick();
  }
}
function stopRestTick() { if (REST_TICK) { clearInterval(REST_TICK); REST_TICK = null; } }
// ---- Rest-done notification (opt-in, Settings > Rest timer) ----
// A system banner when the rest countdown finishes while the athlete is in
// another app or on the lock screen, so the phone can go away between sets.
// This is a LOCAL notification through the service worker registration, no
// push server: it fires as long as the page's timer still ticks in the
// background (Android and desktop do; a backgrounded iOS PWA is frozen, so
// there the alert lands the moment the app is reopened instead). The athlete
// opts in from Settings, inside a tap, which is when permission is requested.
function restNotifySupported() {
  return typeof Notification !== 'undefined' && typeof Notification.requestPermission === 'function';
}
async function toggleRestNotify(on) {
  if (!on) { S.profile.restNotify = false; save(); toast(t('rest.alerts_off')); render(); return; }
  if (!restNotifySupported()) {
    S.profile.restNotify = false;
    toast(t('rest.notify_unavailable'), true);
    render(); return;
  }
  let perm = Notification.permission;
  if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch (_) { perm = 'denied'; } }
  if (perm !== 'granted') {
    S.profile.restNotify = false;
    toast(t('rest.notify_blocked'), true);
    render(); return;
  }
  S.profile.restNotify = true; save(); toast(t('rest.alerts_on')); render();
}
// Show the banner. Prefers the service worker registration (required on an
// installed PWA, and its notificationclick in sw.js refocuses the app); falls
// back to a page-level Notification where no worker is registered (plain tab).
// The fixed tag replaces an unseen previous banner instead of stacking them.
async function showRestNotification() {
  if (!S || !S.profile || !S.profile.restNotify) return false;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  const opts = { body: t('rest.notify_body'), tag: 'ironwave-rest',
                 icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) { await reg.showNotification('IRONWAVE', opts); return true; }
    }
  } catch (_) {}
  try { new Notification('IRONWAVE', opts); return true; } catch (_) { return false; }
}
function addRest(sec) {
  if (!V.restTimer) return;
  V.restTimer.endTs = Math.max(Date.now(), V.restTimer.endTs + sec * 1000);
  V.restTimer.durSec = Math.max(1, V.restTimer.durSec + sec);
  V.restTimer.rung = false;
  const b = byId('rest-timer'); if (b) b.classList.remove('done');
  const skip = byId('rest-timer-skip'); if (skip) skip.textContent = t('rest.skip');
  stopRestTick(); REST_TICK = setInterval(restTick, 250); restTick();
}
function dismissRestTimer() { stopRestTick(); V.restTimer = null; render(); }
function clearRestTimer() { stopRestTick(); if (V) V.restTimer = null; }
function restTimerHTML() {
  if (!V.restTimer) return '';
  const left = restRemainingSec();
  const done = left <= 0;
  const pct = 100 * (1 - Math.min(1, left / V.restTimer.durSec));
  return `<div class="rest-timer ${done ? 'done' : ''}" id="rest-timer">
    <div class="rest-timer-fill" id="rest-timer-fill" style="width:${pct}%"></div>
    <div class="rest-timer-body">
      <span class="rest-timer-label">${esc(t('rest.label'))}</span>
      <span class="rest-timer-time" id="rest-timer-time">${done ? esc(t('rest.done')) : fmtClock(left)}</span>
      <button class="rest-timer-btn" onclick="addRest(-15)">-15s</button>
      <button class="rest-timer-btn" onclick="addRest(30)">+30s</button>
      <button class="rest-timer-btn primary" id="rest-timer-skip" onclick="dismissRestTimer()">${done ? esc(t('rest.done_btn')) : esc(t('rest.skip'))}</button>
    </div>
  </div>`;
}

// ------------------------------------------------------------
// PERFORMANCE MODAL
// ------------------------------------------------------------
let PM = null; // {ei, si, weight, reps, rpe}
function openPerf(ei, si) {
  const st = V.draft.entries[ei].sets[si];
  const e = V.draft.entries[ei];
  let w = st.done ? st.weight : (st.targetWeight ?? suggestedWeight(e.exId, st) ?? 0);
  const dropSrc = (st.done && st.drops) ? st.drops : st.dropTargets; // logged minis, else prescribed
  const hasKids = FINISHER_TECHS.includes(st.technique) && dropSrc;
  PM = { ei, si, weight: w, reps: st.done ? st.reps : st.targetReps,
         rpe: st.done ? st.rpe : (st.targetRpe ?? 8),
         pump: st.done ? (st.pump ?? null) : null, tech: st.technique || null,
         drops: hasKids ? dropSrc.map(d => ({ weight: d.weight, reps: d.reps })) : null };
  // A double-tap on a Performance button lands here twice: reuse the open modal
  // instead of stacking a second one (a stacked duplicate re-renders against a
  // cleared PM after DONE and wedges the modal stack).
  if (MSTACK[MSTACK.length - 1] === renderPerfModal) rerenderTop();
  else showModal(renderPerfModal);
}
// Prefill for an unlogged set with no prescribed weight: the last weight the
// athlete actually lifted; failing that, a weight derived from a seeded max at
// the set's reps/effort (so a pre-calibrated lift suggests a sane number
// instead of dumping the raw 1RM into a 12-rep calibration set).
function suggestedWeight(exId, st) {
  const recs = recordsFor(exId);
  for (let i = recs.length - 1; i >= 0; i--) if (!recs[i].seed) return recs[i].weight;
  const e1 = Engine.bestE1RM(recs);
  if (!e1) return null;
  return Engine.weightFor(e1, st.targetReps || 8, st.targetRpe ?? 8, loadingFor(exId).totalInc);
}
function plateVizHTML(weight, exId) {
  const L = loadingFor(exId);
  if (!L.showPlates) {
    if (L.mode === 'dumbbell') {
      const txt = L.count === 2
        ? t('load.per_hand', { half: kg(weight / 2), total: kg(weight) })
        : t('load.dumbbell', { w: kg(weight) });
      return { viz: `<span class="faint">${esc(txt)}</span>`, note: '' };
    }
    const label = (L.mode === 'machine' || L.mode === 'cable') ? t('load.machine') : t('load.added');
    return { viz: `<span class="faint">${esc(label)}</span>`, note: '' };
  }
  const bar = L.barWeight;
  const { plates, achieved } = Engine.plateMath(weight, bar, S.profile.plates);
  const viz = plates.length
    ? plates.map(p => `<div class="plate" style="background:${p.color};color:${PLATE_TEXT[String(p.w)] || '#fff'};height:${36 + p.w * 2.2}px">${kg(p.w)}</div>`).join('')
    : `<span class="faint">${esc(t('plates.bar_only'))}</span>`;
  const mismatch = Math.abs(achieved - weight) > 0.01;
  const note = esc(t('plates.note', { bar: kg(bar), plates: kg(Math.max(0, achieved - bar)) })) +
    (mismatch ? `<br><span style="color:var(--amber)">${esc(t('plates.closest', { w: kg(achieved) }))}</span>` : '');
  return { viz, note };
}
function renderPerfModal(anim) {
  const pm = PM;
  // Stale re-render after the state was cleared (e.g. a ghost duplicate on the
  // modal stack): fold this layer away instead of throwing mid-render.
  if (!pm) { closeModal(); return; }
  const exId = V.draft.entries[pm.ei].exId;
  const L = loadingFor(exId);
  const disp = displayWeight(exId, pm.weight);
  const unitLabel = disp.unit === 'kg per hand' ? t('unit.kg_hand') : t('unit.kg');
  const { viz, note } = plateVizHTML(pm.weight, exId);
  // On a bodyweight/band lift the number is ADDED load, and athletes who miss
  // that type in their own bodyweight, which wrecks the e1RM. Say it in place.
  const bwMode = L.mode === 'bodyweight' || L.mode === 'band';
  const bwNote = bwMode
    ? `<div class="faint" style="font-size:.78rem;margin-top:2px">${esc(t('perf.bw_note'))}</div>` : '';
  $modal.innerHTML = modalShell(anim, t('perf.title'), `
        <div class="stepper">
          <div class="lbl">${esc(bwMode ? t('perf.added_weight') : t('perf.weight'))}</div>
          <div class="ctr">
            <button class="pm" onclick="pmW(-1)">−</button>
            <span class="val"><input id="pm-weight" type="number" inputmode="decimal"
              value="${kg(disp.value)}" onchange="pmWSet(this.value)"><small>${unitLabel}</small></span>
            <button class="pm" onclick="pmW(1)">＋</button>
          </div>
          <div class="plate-viz" id="pm-plateviz">${viz}</div>
          ${bwNote}
          <div class="plate-math-note" id="pm-platenote">${note}</div>
          ${L.showPlates ? `<button class="btn-ghost" onclick="openPlateConfig()">${esc(t('plates.configure'))}</button>` : ''}
        </div>
        <div class="stepper">
          <div class="lbl">${esc(t('perf.reps'))}</div>
          <div class="ctr">
            <button class="pm" onclick="pmR(-1)">−</button>
            <span class="val" id="pm-reps">${pm.reps}</span>
            <button class="pm" onclick="pmR(1)">＋</button>
          </div>
        </div>
        <div class="stepper">
          <div class="lbl">${esc(t('perf.rir_label'))}</div>
          <div class="ctr">
            <button class="pm" onclick="pmRir(-0.5)">−</button>
            <span class="val" id="pm-rir">${kg(Engine.rpeToRir(pm.rpe))}</span>
            <button class="pm" onclick="pmRir(0.5)">＋</button>
          </div>
          <div class="rpe-desc" id="pm-rpe-desc">${esc(rpeDesc(pm.rpe))}</div>
          <div class="faint" style="font-size:.78rem;margin-top:2px">${esc(t('perf.rir_hint'))}</div>
        </div>
        <div class="stepper" ${pm.drops ? '' : 'style="border-bottom:none"'}>
          <div class="lbl">${esc(t('perf.pump'))} <small class="faint">${esc(t('perf.optional'))}</small></div>
          <div class="pump-row">
            ${[1, 2, 3].map(n => `<button class="btn ${pm.pump === n ? 'btn-blue' : 'btn-outline'}" onclick="pmPump(${n})">${PUMP_ICONS[n]} ${esc(t('pump.' + n))}</button>`).join('')}
          </div>
        </div>
        ${pm.drops ? `<div class="stepper" style="border-bottom:none">
          <div class="lbl">${childSectionLabel(pm.tech)}</div>
          ${pm.drops.map((d, i) => `<div class="drop-row">
            <span class="drop-w" id="pm-dropw-${i}">${fmtW(exId, d.weight)}</span>
            <button class="pm sm" onclick="pmDropReps(${i},-1)">−</button>
            <span class="val sm" id="pm-drop-${i}">${d.reps}</span>
            <button class="pm sm" onclick="pmDropReps(${i},1)">＋</button>
          </div>`).join('')}
          ${TIMED_REST_TECHS.includes(pm.tech) ? `<button class="btn btn-outline mt8" id="pm-minirest" onclick="startMiniRest()">${esc(pm.tech === 'restpause' ? t('perf.pause') : t('perf.minirest'))} ${fmtClock(Engine.techTransitionSec(pm.tech, TIME_MODEL))}</button>` : ''}
        </div>` : ''}
        <div class="btn-row">
          <button class="btn btn-outline" onclick="clearPerf()">${esc(t('perf.clear'))}</button>
          <button class="btn btn-outline" onclick="skipSet()">${esc(t('perf.skip'))}</button>
          <button class="btn btn-green" onclick="donePerf()">${esc(t('perf.done'))}</button>
        </div>
        <p class="faint" style="font-size:.74rem;margin-top:2px">${esc(t('perf.skip_hint'))}</p>`, 'closePerf()');
}
// Targeted updates — the modal itself never rebuilds, only the numbers move
function nudge(el, dir) {
  if (!el || !dir) return;
  el.classList.remove('nudge-up', 'nudge-down');
  void el.offsetWidth; // restart animation
  el.classList.add(dir > 0 ? 'nudge-up' : 'nudge-down');
}
function perfUpdateWeight(dir) {
  if (!PM) return;
  const exId = V.draft.entries[PM.ei].exId;
  const disp = displayWeight(exId, PM.weight);
  const inp = byId('pm-weight');
  if (inp) { inp.value = kg(disp.value); nudge(inp, dir); }
  const { viz, note } = plateVizHTML(PM.weight, exId);
  const pv = byId('pm-plateviz'); if (pv) pv.innerHTML = viz;
  const pn = byId('pm-platenote'); if (pn) pn.innerHTML = note;
  // Same-weight finishers (myo / rest-pause) ride the working weight as it changes.
  if (SAME_WEIGHT_TECHS.includes(PM.tech) && PM.drops) {
    PM.drops.forEach((d, i) => {
      d.weight = PM.weight;
      const el = byId(`pm-dropw-${i}`); if (el) el.textContent = fmtW(exId, d.weight);
    });
  }
}
function pmW(dir) {
  if (!PM) return;
  const exId = V.draft.entries[PM.ei].exId;
  PM.weight = Math.max(0, PM.weight + dir * loadingFor(exId).totalInc);
  perfUpdateWeight(dir);
}
function pmWSet(v) {
  if (!PM) return;
  const exId = V.draft.entries[PM.ei].exId;
  const L = loadingFor(exId);
  const parsed = Math.max(0, parseFloat(v) || 0);
  PM.weight = (L.mode === 'dumbbell' && L.count === 2) ? parsed * 2 : parsed; // typed value is per hand for two-DB
  perfUpdateWeight(0);
}
function pmR(d) {
  if (!PM) return;
  PM.reps = Math.max(0, PM.reps + d);
  const el = byId('pm-reps'); if (el) { el.textContent = PM.reps; nudge(el, d); }
}
// RIR stepper: the athlete edits reps-in-reserve, we store the inverse RPE.
// Adding RIR (easier) lowers RPE and vice versa, clamped to RPE 5..10 (RIR 0..5).
function pmRir(d) {
  if (!PM) return;
  PM.rpe = Math.min(10, Math.max(5, PM.rpe - d));
  const el = byId('pm-rir'); if (el) el.textContent = kg(Engine.rpeToRir(PM.rpe));
  const desc = byId('pm-rpe-desc'); if (desc) desc.textContent = rpeDesc(PM.rpe);
  nudge(el, d);
}
// Optional pump quick-tap: tapping the active level clears it (stays optional).
function pmPump(n) { if (!PM) return; PM.pump = PM.pump === n ? null : n; rerenderTop(); }
// Drop-set mini-set reps: weight stays the prescribed strip, the athlete logs reps.
function pmDropReps(i, d) {
  if (!PM || !PM.drops || !PM.drops[i]) return;
  PM.drops[i].reps = Math.max(0, PM.drops[i].reps + d);
  const el = byId(`pm-drop-${i}`); if (el) { el.textContent = PM.drops[i].reps; nudge(el, d); }
}
// Technique-aware timer (Cluster B): a myo mini-rest or a rest-pause pause is
// intrinsic to the set, so it is cued inside the perf modal (the modal covers
// the session rest bar). A short countdown on the prescribed value
// (Engine.techTransitionSec); buzzes at zero where supported. No em dashes.
let MINI_TICK = null;
function startMiniRest() {
  if (!PM) return;
  primeAudio(); primeHtmlAudio();
  stopMiniRest();
  const word = PM.tech === 'restpause' ? t('perf.pause') : t('perf.minirest');
  const end = Date.now() + Engine.techTransitionSec(PM.tech, TIME_MODEL) * 1000;
  const tick = () => {
    const el = byId('pm-minirest');
    if (!el) { stopMiniRest(); return; }
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    el.textContent = left > 0 ? `${word} ${fmtClock(left)}` : t('perf.go_again');
    if (left <= 0) { stopMiniRest(); playChime(); if (navigator.vibrate) { try { navigator.vibrate(150); } catch (_) {} } }
  };
  MINI_TICK = setInterval(tick, 250); tick();
}
function stopMiniRest() { if (MINI_TICK) { clearInterval(MINI_TICK); MINI_TICK = null; } }
function closePerf() { stopMiniRest(); PM = null; closeModal(); }
function clearPerf() {
  if (!PM) return;
  const st = V.draft.entries[PM.ei].sets[PM.si];
  st.done = false; st.weight = st.reps = st.rpe = null; st.pump = null; st.drops = null;
  delete st.skipped;
  closePerf(); render();
}
// Skip a set the athlete cannot or should not do today (cardio gone, a tweak,
// confidence, time). Nothing is logged: no record, no tonnage, and the volume
// autoregulator simply sees one less logged set, which is the honest signal.
function skipSet() {
  if (!PM) return;
  const st = V.draft.entries[PM.ei].sets[PM.si];
  st.done = false; st.weight = st.reps = st.rpe = null; st.pump = null; st.drops = null;
  st.skipped = true;
  toast(t('perf.set_skipped'));
  closePerf(); render();
}
function donePerf() {
  if (!PM) return;
  const e = V.draft.entries[PM.ei];
  const st = e.sets[PM.si];
  // Outlier net: a weight far above this lift's history is usually a typo (the
  // classic: entering your bodyweight on a bodyweight lift). One bad record
  // inflates the e1RM and poisons every future prescription, so confirm first.
  if (!PM.outlierOk && Engine.weightOutlier(recordsFor(e.exId), PM.weight)) {
    const anchors = recordsFor(e.exId).filter(r => r.weight > 0);
    const best = Math.max(...anchors.map(r => r.weight));
    confirmModal({
      title: t('perf.big_jump_title'),
      message: t('perf.big_jump_msg', { new: fmtW(e.exId, PM.weight), name: e.name, best: fmtW(e.exId, best) }),
      confirmLabel: t('perf.big_jump_confirm'),
      cancelLabel: t('perf.big_jump_cancel'),
    }, () => { if (PM) { PM.outlierOk = true; donePerf(); } });
    return;
  }
  st.weight = PM.weight; st.reps = PM.reps; st.rpe = PM.rpe; st.pump = PM.pump; st.done = true;
  delete st.skipped; // logging a set un-skips it
  if (PM.drops) st.drops = PM.drops.map(d => ({ weight: d.weight, reps: d.reps }));
  // Optional Cluster A/B fields are only written when set, so a plain straight set
  // logs the same record shape as before (persistence / golden master unaffected).
  const rec = { ts: Date.now(), weight: st.weight, reps: st.reps, rpe: st.rpe };
  if (st.pump != null) rec.pump = st.pump;
  if (st.technique) rec.technique = st.technique;
  if (st.drops) rec.drops = st.drops;
  pushRecord(e.exId, rec);

  // AMRAP on a main lift → adjust working max (the JM 2.0 engine).
  // A swapped-in variation logs normally but never moves the base lift's WM.
  if (st.amrap && e.isMain && e.wmKey && P().wm[e.wmKey]) {
    if (e.exId === e.wmKey) {
      const wave = WAVES[blockOf(V.draft.b).wave];
      const res = Engine.amrapAdjust(P().wm[e.wmKey], st.reps, wave.standard, P().increments[e.wmKey]);
      if (res.delta > 0) {
        P().wm[e.wmKey] = res.newWM;
        V.draft.wmChange = { name: e.name, from: res.newWM - res.delta, to: res.newWM, delta: res.delta, capped: res.capped };
        toast(t('perf.wm_up', { name: e.name, from: kg(res.newWM - res.delta), to: kg(res.newWM) }) + (res.capped ? ' ' + t('perf.wm_capped') : ''));
      } else toast(res.msg, true);
    } else {
      toast(t('perf.amrap_variation'));
    }
  }
  // Calibration sets → bold recalibration of WM / future set weights
  if (st.calib) {
    const loggedCalib = e.sets.filter(s => s.calib && s.done);
    if ((e.isMain || e.isSecondary) && e.wmKey) {
      const newWM = Engine.recalibratedWM(P().wm[e.wmKey], loggedCalib);
      if (newWM) {
        P().wm[e.wmKey] = Engine.roundLoad(newWM, 1.25);
        toast(t('perf.wm_calibrated', { name: e.name, w: kg(P().wm[e.wmKey]) }));
      }
    } else if (loggedCalib.length >= e.sets.filter(s => s.calib).length) {
      toast(t('perf.calibrated_next', { name: e.name }));
    }
  }
  // Start the rest countdown for a real working set (ramp/warmup sets have their
  // own short rest and the warmup modal, so they do not arm the timer).
  if (!st.ramp) {
    const kind = e.isMain ? 'main' : e.isSecondary ? 'secondary' : 'accessory';
    if (e.superset) {
      // [Cluster B] A superset shares one rest per ROUND: arm the full rest only
      // once every member has logged this round's set; before that, cue the next
      // exercise to alternate (no long rest between members of a round).
      if (supersetRoundComplete(V.draft.entries, e, PM.si)) startRestTimer(kind, e.exId);
      else {
        clearRestTimer();
        const next = supersetNextInRound(V.draft.entries, e, PM.si);
        if (next) toast(t('perf.superset_next', { name: next.name }));
      }
    } else {
      startRestTimer(kind, e.exId);
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
    $modal.innerHTML = modalShell(anim, t('warmup.title'), `
        <div class="card"><div class="row"><span>${esc(t('warmup.target_top'))}</span><b>${kg(top)} kg</b></div>
        <div class="divider"></div>
        <div class="row"><span>${esc(t('warmup.bar_weight'))}</span><b style="color:var(--blue)">${kg(bar)}kg</b></div></div>
        ${sets.map((s, i) => `<div class="set-row"><span class="num">${i + 1}</span>
          <span class="target">${kg(s.weight)}kg × ${s.reps}</span></div>`).join('')}
        <p class="faint">${esc(t('warmup.hint'))}</p>`);
  });
}
// --- modal stack: closing a stacked modal returns to the one beneath it ---
let MSTACK = [];
function showModal(renderFn) { MSTACK.push(renderFn); renderFn(true); }
function rerenderTop() { const t = MSTACK[MSTACK.length - 1]; if (t) t(false); }
function closeModal() {
  MSTACK.pop();
  const t = MSTACK[MSTACK.length - 1];
  if (t) t(false); else { $modal.innerHTML = ''; armTapGuard(); }
}
function closeAllModals() { MSTACK = []; $modal.innerHTML = ''; armTapGuard(); }
// Ghost-tap guard: when a fast double-tap closes a modal, the second tap of the
// pair lands on whatever the closed modal was covering (a Performance button, a
// +/- stepper) and silently acts on it. Swallow clicks outside the modal layer
// for a beat after a close; a deliberate next tap takes longer than this.
let TAP_GUARD_UNTIL = 0;
function armTapGuard() { TAP_GUARD_UNTIL = Date.now() + 350; }
function tapGuardActive(target) {
  return Date.now() < TAP_GUARD_UNTIL && !($modal && $modal.contains && $modal.contains(target));
}
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
  $modal.innerHTML = modalShell(anim, o.title || t('confirm.title'), `
        <div class="confirm-body">
          <div class="confirm-icon ${danger ? 'danger' : ''}">${danger ? '⚠' : '?'}</div>
          <p class="confirm-msg">${esc(o.message)}</p>
        </div>
        <button class="btn ${danger ? 'btn-red' : 'btn-blue'}" onclick="confirmResolve(true)">${esc(o.confirmLabel || t('confirm.ok'))}</button>
        <button class="btn btn-outline mt8" onclick="confirmResolve(false)">${esc(o.cancelLabel || t('confirm.cancel'))}</button>`,
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
function openSessionRating() {
  const dr = V.draft;
  const loggedAny = dr.entries.some(e => e.sets.some(s => s.done));
  if (!loggedAny) {
    confirmModal({
      title: t('sr.none_title'),
      message: t('sr.none_msg'),
      confirmLabel: t('sr.none_confirm'),
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
  $modal.innerHTML = modalShell(anim, t('sr.title'), `
        <div class="slider-card">
          <div class="q">${esc(t('sr.question'))}</div>
          <div class="feeling" style="font-size:2.4rem;font-weight:800" id="sr-val">${SR}</div>
          <input type="range" min="5" max="10" step="1" value="${SR}" oninput="srSet(this.value)">
          <div class="range-labels"><span>${esc(t('sr.low'))}</span><span>${esc(t('sr.high'))}</span></div>
          <p class="faint mt8" id="sr-desc">${esc(t('sr.' + SR))}</p>
        </div>
        <button class="btn btn-green" onclick="finishSession()">${esc(t('sr.complete'))}</button>`);
}
function srSet(v) {
  SR = parseInt(v);
  byId('sr-val').textContent = SR;
  byId('sr-desc').textContent = t('sr.' + SR);
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
  clearRestTimer();
  save();
  closeAllModals();
  toast(t('sr.saved', { tonnage: dr.tonnage.toLocaleString(I18N.dateLocale()) }));
  V.tab = 'dashboard';
  nav('summary');
}

// ------------------------------------------------------------
// PREVIEW MODAL
// ------------------------------------------------------------
function openPreview(di) {
  const built = resolveDayEntries(di, P().pointer.block, P().pointer.week);
  const timeNote = built.capMin
    ? `<p class="faint" style="margin-bottom:10px">Core about ${built.coreMin} min, within your ${built.capMin} min limit.${built.optItems.length ? ' Optional, if you have time: ' + esc(built.optionalNames.join(', ')) + ' (about ' + (built.fullMin - built.coreMin) + ' min more).' : ''}</p>`
    : '';
  showModal(anim => {
    $modal.innerHTML = modalShell(anim, 'Preview', timeNote +
      built.items.map(x => {
        const rs = x.rs, work = rs.sets.filter(s => !s.ramp);
        return `<div class="lift-card ${rs.optional ? 'optional' : ''}"><h3 style="font-size:1.2rem">${esc(rs.name)}${rs.optional ? ' <span class="opt-tag">optional</span>' : ''}</h3>
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
// Swap / select picker state. Lives at module scope so the equipment
// filter, search box and "browse other groups" toggle survive re-renders
// of just the list body (the search input stays focused while you type).
let SW = null;
function openSwap(di, si) {
  const slot = P().days[di].slots[si];
  const cat = slot.cat || exById(slot.ex || slot.def || slot.lift)?.movement;
  const current = slot.ex || slot.def || slot.lift;
  // Main/secondary slots stay inside their movement: their variations run the
  // same wave math off the working max, so cross-group picks make no sense there.
  const isMain = slot.type === 'main' || slot.type === 'secondary';
  SW = { di, si, cat, current, isMain, equip: 'all', q: '', showOther: false };
  showModal(renderSwap);
}
function renderSwap(anim) {
  const slot = P().days[SW.di].slots[SW.si];
  const note = SW.isMain
    ? `<p class="faint" style="margin-bottom:8px">Variations run the same wave percentages off the ${esc(exName(slot.baseLift || slot.lift))} working max. AMRAPs on a variation won't move that max.</p>`
    : (timeCapMin() ? timeBudgetHTML(SW.di) : '');
  $modal.innerHTML = modalShell(anim, slot.type === 'select' ? 'Select Exercise' : 'Swap Exercise',
    `${note}
     <input class="search-input" placeholder="Search any exercise…" value="${esc(SW.q)}" oninput="SW.q=this.value;refreshSwapBody()">
     <div id="swap-body">${swapBodyHTML()}</div>`);
}
// [Cluster C] Muscle heads already trained on a day, for the same movement group
// as the slot being swapped (the swapped slot itself excluded). Lets the picker
// flag a candidate that covers a region the day is missing.
function dayHeadsCovered(di, exceptSi, cat) {
  const heads = new Set();
  const day = P().days[di];
  if (!day) return heads;
  day.slots.forEach((sl, j) => {
    if (j === exceptSi) return;
    const id = sl.ex || sl.def || sl.lift;
    const e = id && exById(id);
    if (e && e.movement === cat && e.head) heads.add(e.head);
  });
  return heads;
}
function swapBodyHTML() {
  const used = new Set(Object.keys(S.records));
  const ql = SW.q.trim().toLowerCase();
  const matchText = e => !ql || e.name.toLowerCase().includes(ql);
  const matchEquip = e => SW.equip === 'all' || e.equipment === SW.equip;
  const all = allExercises().filter(e => e.id !== SW.current);
  // [Cluster C] On accessory slots, bias the order toward better stimulus:
  // first the athlete's familiar/used lifts, then exercises that cover a muscle
  // head the day is missing (so a swap broadens coverage), then higher SFR. The
  // head/SFR/stretch badges explain the pick. Main slots are wave-math
  // variations, so neither bias applies there.
  const sfrBias = !SW.isMain;
  const dayHeads = sfrBias ? dayHeadsCovered(SW.di, SW.si, SW.cat) : new Set();
  // A swap replaces the current exercise rather than adding one, so the head it
  // already covers is not a gap a candidate "adds". Count the outgoing exercise's
  // head as covered: a like-for-like swap (e.g. one mid/lower chest move for
  // another) then reads as a swap, not "Adds Mid/lower chest". Select slots have
  // no current exercise, so they keep the additive framing.
  const replacing = sfrBias && SW.current ? exById(SW.current) : null;
  if (replacing && replacing.head) dayHeads.add(replacing.head);
  const fillsGap = e => !!(e.head && !dayHeads.has(e.head));
  // For a swap, per-candidate time is the NET change vs the current exercise, not
  // the full additive cost (the slot's time is already in the day). Computed once.
  SW.curCost = (replacing && timeCapMin()) ? candidateCostMin(SW.current) : null;
  // [Cluster C] Heads already at or over their per-head MRV this week, so a
  // candidate that piles onto a maxed region gets a "region maxed" hint. Computed
  // once per render (it resolves every day). Accessory slots, bodybuilding only.
  const bbTrack = P() && P().trainingConfig && P().trainingConfig.track === 'bodybuilding';
  SW.overHeads = (sfrBias && bbTrack) ? overMrvHeadSet() : new Set();
  const sortFn = (a, b) => (used.has(b.id) - used.has(a.id))
    || (sfrBias ? (fillsGap(b) - fillsGap(a)) : 0)
    || (sfrBias ? ((b.sfr || 2) - (a.sfr || 2)) : 0)
    || a.name.localeCompare(b.name);

  // Chips reflect the pool the athlete can actually browse: just the
  // recommended movement for a main slot, every exercise otherwise.
  const pool = SW.isMain ? all.filter(e => e.movement === SW.cat) : all;
  const equips = [...new Set(pool.map(e => e.equipment))].sort((a, b) => EQUIP_ORDER.indexOf(a) - EQUIP_ORDER.indexOf(b));
  const chips = equipChips(equips, SW.equip, 'setSwapEquip');

  const recommended = all.filter(e => e.movement === SW.cat && matchEquip(e) && matchText(e)).sort(sortFn);
  const recHTML = recommended.length
    ? recommended.map(e => swapCardHTML(e, false, fillsGap(e))).join('')
    : `<p class="faint mt8">No matches in this group${SW.equip === 'all' ? '' : ' for ' + EQUIP_LABEL[SW.equip].toLowerCase()}.</p>`;

  // Out-of-group browsing lets an athlete fine tune freely: a machine they
  // like, or a muscle they want to bias, regardless of the slot's category.
  let otherSection = '';
  if (!SW.isMain) {
    const others = all.filter(e => e.movement !== SW.cat && matchEquip(e) && matchText(e))
      .sort((a, b) => (MOVEMENTS[a.movement]?.label || '').localeCompare(MOVEMENTS[b.movement]?.label || '') || sortFn(a, b));
    if (ql) {
      // A name search spans everything, since the athlete may not know which
      // muscle group the machine they are looking for lives under.
      otherSection = others.length ? `<div class="section-title" style="margin-top:14px">Other muscle groups</div>${others.map(e => swapCardHTML(e, true)).join('')}` : '';
    } else {
      otherSection = `<button class="browse-toggle" onclick="SW.showOther=!SW.showOther;refreshSwapBody()" style="margin-top:12px">${SW.showOther ? 'Hide' : 'Browse'} other muscle groups ${SW.showOther ? '▴' : '▾'}</button>`;
      if (SW.showOther) otherSection += `<div class="section-title" style="margin-top:12px">Other muscle groups</div>${others.map(e => swapCardHTML(e, true)).join('')}`;
    }
  }
  return `${chips}<div class="section-title" style="margin-top:4px">Recommended</div>${recHTML}${otherSection}`;
}
function refreshSwapBody() { const el = byId('swap-body'); if (el) el.innerHTML = swapBodyHTML(); }
function setSwapEquip(v) { SW.equip = v; refreshSwapBody(); }
function swapCardHTML(e, showGroup, gap) {
  // Per-candidate time cost: only meaningful for a capped athlete, and only on
  // accessory slots (main/secondary variations all run the same wave math, so
  // their cost is identical and would just be noise).
  const cost = (!SW.isMain && timeCapMin()) ? candidateCostMin(e.id) : null;
  // On a swap, show the net minutes vs the exercise being replaced ("same time",
  // "+2 min", "−1 min"); on a select/add slot, show the full additive cost.
  let costTag = '';
  if (cost != null) {
    if (SW.curCost != null) {
      const net = cost - SW.curCost;
      costTag = net === 0
        ? ` <span class="cost-tag">same time</span>`
        : ` <span class="cost-tag">${net > 0 ? '+' : '−'}${Math.abs(net)} min</span>`;
    } else {
      costTag = ` <span class="cost-tag">+${cost} min</span>`;
    }
  }
  // [Cluster C] When this exercise covers a head the day is missing, say so.
  const gapTag = (gap && e.head && HEAD_LABELS[e.head]) ? ` <span class="ex-tag gap">Adds ${HEAD_LABELS[e.head]}</span>` : '';
  // [Cluster C] Conversely, warn when its region is already at/over its per-head
  // MRV this week, so piling on is the wrong pick. Suppressed when the candidate
  // also fills a gap (it cannot both max a region and fill a missing one).
  const overTag = (!gap && e.head && SW.overHeads && SW.overHeads.has(e.head) && HEAD_LABELS[e.head])
    ? ` <span class="ex-tag over">${HEAD_LABELS[e.head]} maxed</span>` : '';
  return `<div class="ex-card">
      <span class="name">${esc(e.name)}${costTag}${gapTag}${overTag}${showGroup ? `<span class="sub">${MOVEMENTS[e.movement]?.label || ''}</span>` : ''}${exTagsHTML(e)}</span>
      <span class="actions">
        <button class="icon-btn" onclick="openExDetail('${e.id}')"><span class="ic">ⓘ</span>Info</button>
        <button class="icon-btn" onclick="doSwap(${SW.di},${SW.si},'${e.id}')"><span class="ic">☐</span>Select</button>
      </span></div>`;
}
function doSwap(di, si, exId) {
  const slot = P().days[di].slots[si];
  slot.ex = exId;
  if (slot.type === 'select') slot.type = 'acc';
  // Mid-session swap: rebuild the affected draft entry so the live session shows
  // the new exercise immediately (the draft is a snapshot taken at session start).
  // Any logged sets on the swapped slot reset, which is correct: it is a different
  // lift. Other entries keep their progress.
  const dr = V.draft;
  if (dr && dr.d === di) {
    const built = resolveDayEntries(di, dr.b, dr.w);
    const item = built.items.find(x => x.si === si);
    const ei = dr.entries.findIndex(e => e.si === si);
    if (item && ei >= 0) dr.entries[ei] = sessionEntryFrom(item);
  }
  save(); closeAllModals(); render();
  toast(exName(exId) + ' set for ' + P().days[di].name);
}
let ADDF = { equip: 'all', q: '' };
function openAddExercise(di) {
  V.addTarget = di;
  ADDF = { equip: 'all', q: '' };
  showModal(anim => {
    $modal.innerHTML = modalShell(anim, 'Add Exercise', `
        ${timeCapMin() ? timeBudgetHTML(di) : ''}
        <input class="search-input" placeholder="Search…" oninput="ADDF.q=this.value;refreshAddBody()">
        <div id="add-body">${addBodyHTML()}</div>`);
  });
}
function addBodyHTML() {
  const ql = ADDF.q.trim().toLowerCase();
  const matchText = e => !ql || e.name.toLowerCase().includes(ql);
  const matchEquip = e => ADDF.equip === 'all' || e.equipment === ADDF.equip;
  const equips = [...new Set(allExercises().map(e => e.equipment))].sort((a, b) => EQUIP_ORDER.indexOf(a) - EQUIP_ORDER.indexOf(b));
  const list = allExercises().filter(e => matchEquip(e) && matchText(e)).slice(0, 60);
  const capped = timeCapMin();
  // [Cluster C] Heads already at/over per-head MRV this week, so adding more direct
  // work there gets a "region maxed" hint. Bodybuilding-surfaced (empty otherwise).
  const overHeads = (P() && P().trainingConfig && P().trainingConfig.track === 'bodybuilding') ? overMrvHeadSet() : new Set();
  const items = list.length
    ? list.map(e => {
      const cost = capped ? candidateCostMin(e.id) : null;
      const costTxt = cost ? ` · ~${cost} min` : '';
      const overTag = (e.head && overHeads.has(e.head) && HEAD_LABELS[e.head]) ? ` <span class="ex-tag over">${HEAD_LABELS[e.head]} maxed</span>` : '';
      return `<button class="lib-item" onclick="doAddExercise('${e.id}')">
      <span>${esc(e.name)}<span class="sub">${MOVEMENTS[e.movement]?.label || ''} · ${EQUIP_LABEL[e.equipment] || ''}${costTxt}</span>${exTagsHTML(e)}${overTag}</span><span>＋</span>
    </button>`;
    }).join('')
    : '<p class="faint mt8">No matches.</p>';
  return `${equipChips(equips, ADDF.equip, 'setAddEquip')}${items}`;
}
function refreshAddBody() { const el = byId('add-body'); if (el) el.innerHTML = addBodyHTML(); }
function setAddEquip(v) { ADDF.equip = v; refreshAddBody(); }
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
        <div class="meta"><span>${fmtDate(s.ts)} · ${esc(label)}</span><span>${s.skipped ? 'Skipped' : (s.rating ? 'rated ' + s.rating + '/10' : '')}</span></div>
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
    const actual = `${fmtW(e.exId, x.weight)} × ${x.reps} · ${fmtRir(x.rpe)}`;
    let tgt = '';
    if (withTarget) {
      tgt = x.targetWeight != null
        ? ` <small>target ${fmtW(e.exId, x.targetWeight)} × ${x.targetReps}${x.targetRpe ? ' · ' + fmtRir(x.targetRpe) : ''}</small>`
        : (x.targetReps ? ` <small>target ${x.targetReps} reps${x.targetRpe ? ' · ' + fmtRir(x.targetRpe) : ''}</small>` : '');
    }
    const drops = (x.drops && x.drops.length) ? ` <small class="faint">${childWord(x.technique)} ${dropDetail(e.exId, x.drops)}</small>` : '';
    return `<div class="set-row"><span class="num">${i + 1}</span>
      <span class="target">${actual}${x.amrap ? ' <small>AMRAP</small>' : ''}${techniqueBadge(x.technique)}${drops}${pumpBadge(x.pump)}${tgt}</span></div>`;
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
      <span class="sub">${MOVEMENTS[e.movement]?.label || ''} · ${eq}${best ? ' · e1RM ' + kg(Engine.roundLoad(best, 0.5)) + 'kg' : ''}</span>${exTagsHTML(e)}</span>
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
// Broad per-movement fallback cues. The primary source is the per-exercise
// EX_CUES map (data.js); these only fire for an exercise with no entry there
// (e.g. a user-created custom lift), and CUES.default is the last resort.
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
    const cues = EX_CUES[e.id] || CUES[e.movement] || CUES.default;
    body = `<div class="placeholder-media">🏋</div>
      <p class="subtle">${MOVEMENTS[e.movement]?.label || ''} · ${EQUIP_LABEL[e.equipment] || ''}${e.isMain ? ' · Main lift' : ''}</p>
      ${exMetaCardHTML(e)}
      <div class="section-title" style="font-size:1.1rem">Coaching cues</div>
      ${cues.map(c => `<div class="check-row">▸ ${c}</div>`).join('')}`;
  } else if (XD.tab === 'history') {
    // Newest first; ✕ deletes a wrong log (a typo here poisons the e1RM that
    // prescribes future weights, so the athlete can clean their own history).
    body = recs.length ? ([...recs].reverse().slice(0, 40).map((r, i) => {
      const idx = recs.length - 1 - i; // index in the stored array
      return `<div class="row" style="padding:9px 0;border-bottom:1px solid var(--line)">
        <span class="subtle">${fmtDate(r.ts)}${r.seed ? ' · entered max' : ''}${techniqueBadge(r.technique)}${pumpBadge(r.pump)}</span>
        <span><b>${fmtW(XD.id, r.weight)} × ${r.reps} · ${fmtRir(r.rpe)}</b>
          <button class="rec-del" onclick="deleteRecord('${XD.id}',${idx})" aria-label="Delete logged set">✕</button></span></div>`;
    }).join('') + '<p class="faint mt8">Tap ✕ to remove a wrongly logged set. Prescribed weights follow your remaining history.</p>')
      : '<p class="faint mt16">No logged sets yet.</p>';
  } else if (XD.tab === 'trend') {
    const e1Series = Engine.e1rmTrend(recs);
    const vlSeries = Engine.volumeLoadTrend(recs);
    body = (e1Series.length < 2 && vlSeries.length < 2)
      ? '<p class="faint mt16">Log a few sessions to see your e1RM and volume-load trends.</p>'
      : `<div class="section-title" style="font-size:1.05rem">Estimated 1RM</div>
        ${trendChartHTML(e1Series, '#67a3ff', v => kg(Engine.roundLoad(v, 0.5)) + ' kg')}
        <div class="section-title" style="font-size:1.05rem">Volume load <small class="faint">weight × reps per day</small></div>
        ${trendChartHTML(vlSeries, '#4ad6a0', v => Math.round(v).toLocaleString() + ' kg')}
        <p class="faint">Both trends read straight from your logged sets over the last few months.</p>`;
  } else if (XD.tab === 'maxes') {
    const best = Engine.bestE1RM(recs);
    const wm = P()?.wm?.[XD.id];
    // The reference UI: estimated-max curve on top, then dated max milestones
    // (new estimated highs and athlete-entered maxes), then the detail cards.
    const e1Series = Engine.e1rmTrend(recs, 365);
    const chart = e1Series.length >= 2
      ? trendChartHTML(e1Series, '#67a3ff', v => kg(Engine.roundLoad(v, 0.5)) + ' kg')
      : '';
    const miles = Engine.maxMilestones(recs).slice(0, 8);
    const milesHTML = miles.map(m => `
      <div class="max-milestone">
        <div class="row"><span class="subtle">${m.kind === 'entered' ? 'Max you entered' : 'New estimated max'}</span>
          <span class="subtle">${fmtDate(m.ts)}</span></div>
        <div class="max-val">${kg(Engine.roundLoad(m.value, 0.5))}<small> kg</small></div>
      </div>`).join('');
    body = `
      ${chart}
      ${wm ? `<div class="card accent"><div class="row"><span>Working Max</span><b>${kg(wm)} kg</b></div>
        <p class="faint mt8">All wave percentages run off this number (90% of your real 1RM).</p></div>` : ''}
      <div class="card"><div class="row"><span>Estimated 1RM</span><b>${best ? kg(Engine.roundLoad(best, 0.5)) + ' kg' : '—'}</b></div>
        <p class="faint mt8">Computed from your recent logged sets (weight, reps, RIR). Know it already? Enter it under Settings.</p></div>
      ${milesHTML}
      ${recs.length ? `<div class="section-title" style="font-size:1.05rem">Best recent sets</div>` +
        [...recs].sort((a, b) => Engine.e1rm(b.weight, b.reps, b.rpe) - Engine.e1rm(a.weight, a.reps, a.rpe)).slice(0, 5)
          .map(r => `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)">
            <span class="subtle">${fmtDate(r.ts)}</span>
            <span>${fmtW(XD.id, r.weight)} × ${r.reps} · ${fmtRir(r.rpe)} <b style="color:var(--blue)">→ ${kg(Engine.roundLoad(Engine.e1rm(r.weight, r.reps, r.rpe), 0.5))}</b></span></div>`).join('') : ''}`;
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
    // [Cluster B] Intensity technique opt-in. Bodybuilding accessories only, so
    // it never reaches the default/powerbuilding path. Today: a finishing drop set.
    const tcd = P() && P().trainingConfig;
    const canTech = tcd && tcd.track === 'bodybuilding' && !isMainLift;
    const techUI = canTech ? `
      <div class="section-title" style="font-size:1.05rem">Intensity technique</div>
      <label class="check-row"><input type="checkbox" ${(S.techniques || {})[XD.id] === 'drop' ? 'checked' : ''}
        onchange="toggleDropSet('${XD.id}', this.checked)"> Finish with a drop set</label>
      <p class="faint">Adds two lighter strips after your last working set, run to the same rep target. Counts toward your session time.</p>` : '';
    // Known maxes: seed a 1RM/10RM so the engine prescribes real weights right
    // away (no calibration week) and the athlete can correct a bad anchor.
    // Saving replaces the previous entry of the same type, so this reads as an
    // editable field, not an append-only log.
    const seed1 = [...recs].reverse().find(r => r.seed && r.reps === 1);
    const seed10 = [...recs].reverse().find(r => r.seed && r.reps === 10);
    const maxesUI = `
      <div class="section-title" style="font-size:1.05rem">Known maxes</div>
      <p class="faint">Already know your strength here? Enter one or both and weights are prescribed right away, no calibration needed.${isMainLift ? ' A 1RM also sets the working max (90% of it) if it is empty.' : ''}</p>
      <div class="field"><label>1 rep max (kg)</label>
        <input id="xd-1rm" type="number" inputmode="decimal" value="${seed1 ? kg(seed1.weight) : ''}" placeholder="e.g. 120"></div>
      <div class="field"><label>10 rep max (kg, optional)</label>
        <input id="xd-10rm" type="number" inputmode="decimal" value="${seed10 ? kg(seed10.weight) : ''}" placeholder="e.g. 90"></div>
      <button class="btn btn-blue mt8" onclick="saveExMaxes('${e.id}')">Save maxes</button>`;
    body = `
      ${isMainLift ? `
        <div class="field"><label>Working max (kg)</label>
          <input id="xd-wm" type="number" inputmode="decimal" value="${P().wm[XD.id] ?? ''}" placeholder="Not set, calibrates in week 1"></div>
        <div class="field"><label>Working-max increment per AMRAP rep (kg)</label>
          <input id="xd-inc" type="number" inputmode="decimal" step="0.25" value="${inc}"></div>
        <p class="faint">Book guidance: 2.5 kg/rep lower body, 1.25 kg/rep upper body. Halve it if progress stalls.</p>
        <button class="btn btn-blue mt8" onclick="saveExSettings()">Save</button>` :
        `<p class="subtle">Weights are computed from your logged history (e1RM). Log honestly, the engine follows you.</p>`}
      ${maxesUI}
      ${techUI}
      ${loadingUI}
      ${e.custom ? `<button class="btn btn-outline mt16" style="color:var(--red);border-color:var(--red)" onclick="deleteCustomEx('${e.id}')">Delete custom exercise</button>` : ''}`;
  }
  $modal.innerHTML = modalShell(anim, esc(e.name),
    `<div class="tabs">${tabBtn('info')}${tabBtn('history')}${tabBtn('trend')}${tabBtn('maxes')}${tabBtn('settings')}</div>${body}`);
}
function saveExSettings() {
  const wmv = parseFloat(document.getElementById('xd-wm').value);
  const incv = parseFloat(document.getElementById('xd-inc').value);
  if (wmv > 0) P().wm[XD.id] = wmv;
  if (incv > 0) P().increments[XD.id] = incv;
  save(); toast('Saved'); rerenderTop();
}
// Seed / edit known maxes for any exercise. Stored as seeded records (the same
// shape custom-exercise seeding writes), so bestE1RM anchors on them and the
// calibration ramp steps aside from the next session on. Saving replaces the
// previous seed of the same type, which makes the field editable, and an empty
// field clears that seed.
function saveExMaxes(id) {
  const r1 = parseFloat(byId('xd-1rm') && byId('xd-1rm').value);
  const r10 = parseFloat(byId('xd-10rm') && byId('xd-10rm').value);
  if (!(r1 > 0) && !(r10 > 0)) { toast('Enter a 1RM or a 10RM', true); return; }
  if (r1 > 0 && r10 > 0 && r10 >= r1) { toast('Your 10RM should be below your 1RM', true); return; }
  S.records[id] = recordsFor(id).filter(r => !r.seed); // replace, not append
  if (r1 > 0) pushRecord(id, { ts: Date.now(), weight: r1, reps: 1, rpe: 10, seed: true });
  if (r10 > 0) pushRecord(id, { ts: Date.now(), weight: r10, reps: 10, rpe: 10, seed: true });
  // A main lift's wave weights hang off the working max, so an empty one is
  // seeded too (book guidance: train off about 90 percent of your real max).
  let wmNote = '';
  const p = P();
  if (p && p.wm && id in p.wm && !p.wm[id] && r1 > 0) {
    p.wm[id] = Engine.roundLoad(r1 * 0.9, 1.25);
    wmNote = `, working max set to ${kg(p.wm[id])} kg`;
  }
  save();
  toast('Maxes saved' + wmNote + '. Weights are prescribed from your next session');
  rerenderTop();
}
// Remove one wrongly logged set from an exercise's history (by stored index,
// since two records can share a timestamp). The e1RM and every prescribed
// weight recompute from what remains.
function deleteRecord(id, idx) {
  const recs = S.records[id];
  const r = recs && recs[idx];
  if (!r) return;
  confirmModal({
    title: 'Delete this set?',
    message: `${fmtW(id, r.weight)} × ${r.reps} logged ${fmtDate(r.ts)} will be removed from this exercise's history. Prescribed weights follow the remaining sets.`,
    confirmLabel: 'Delete set',
    danger: true,
  }, () => { recs.splice(idx, 1); save(); toast('Set deleted'); rerenderTop(); });
}
function toggleDropSet(id, on) {
  S.techniques = S.techniques || {};
  if (on) S.techniques[id] = 'drop'; else delete S.techniques[id];
  save(); toast(on ? 'Drop set added to this exercise' : 'Drop set removed'); rerenderTop();
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
    ${link('Weekly Volume', '📊', 'openVolumeDashboard()')}
    ${link('Phase & Bodyweight', '🍽', 'openPhase()')}
    ${link('Exercises', '🏋', "nav('exercises')")}
    ${link('Settings & Data', '⚙', "nav('settings')")}
    <p class="faint" style="margin-top:18px;text-align:center;font-size:12px">Version ${esc(APP_VERSION)}</p>
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
    // Same emphasis color as the timeline bars (a cut block reads teal, a peak
    // red), plus the phase word, so the list and the chart tell one story.
    const c = barColorFor(b);
    const ph = blockPhase(b);
    return `<div class="row" style="padding:10px 0 10px 8px;border-bottom:1px solid var(--line);border-left:3px solid ${c}">
      <span><b style="color:${c}">${status}</b> ${esc(b.label)}
        <span class="faint">· ${b.wave} wave · ${esc(sch.short || sch.label)} · <span style="color:${c}">${esc(PHASE_LABELS[ph] || ph)}</span></span></span>
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
  const langOptions = [`<option value="auto" ${(p.lang || 'auto') === 'auto' ? 'selected' : ''}>${esc(t('settings.language_auto'))}</option>`]
    .concat(Object.values(I18N.catalogs).map(c =>
      `<option value="${c.code}" ${p.lang === c.code ? 'selected' : ''}>${esc(c.name)}</option>`)).join('');
  return `${topbar('Settings')}<div class="view">
    <div class="section-title">${esc(t('settings.language'))}</div>
    <div class="field"><label>${esc(t('settings.language'))}</label>
      <select id="st-lang" onchange="setAppLang(this.value)">${langOptions}</select></div>
    <p class="faint" style="margin-bottom:10px">${esc(t('settings.language_hint'))}</p>
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
    <div class="section-title">Rest timer</div>
    <label class="check-row"><input type="checkbox" ${p.restNotify ? 'checked' : ''} onchange="toggleRestNotify(this.checked)"> Notify me when rest ends</label>
    <p class="faint" style="margin-bottom:10px">Shows a notification when the rest countdown finishes while you are in another app, on top of the in-app chime. On iPhone this needs the installed app (Add to Home Screen), and if iOS pauses the app in the background the alert arrives the moment you come back to it.</p>
    <div class="section-title">About</div>
    <p class="faint" style="margin-bottom:10px">IRONWAVE version ${esc(APP_VERSION)}. If a feature you expect is missing, the installed app may be caching an older build. Check for updates, then relaunch.</p>
    <button class="btn btn-outline" onclick="checkForUpdate()">Check for updates</button>
    <div class="section-title">Debug: timer chime</div>
    <p class="faint" style="margin-bottom:10px">The rest-timer chime can be silent on some installed (PWA) devices even when it works in a browser. Tap each option below and note which one you actually hear, then tell me. On iPhone, also check your ring/silent switch is on.</p>
    ${CHIME_CONFIGS.map(c => `
      <button class="btn btn-outline mt8" onclick="playTestChime('${c.id}')">${esc(c.label)}</button>
      <p class="faint" style="margin:4px 0 0">${esc(c.desc)}</p>`).join('')}
  </div>${tabbar()}`;
}
// Force the service worker to look for a newer build and, if one installs, take
// over and reload so the athlete is on the latest code. Without this an installed
// PWA only updates on its own schedule, which is why a fix can seem "not there yet".
async function checkForUpdate() {
  if (!('serviceWorker' in navigator)) { toast('Updates are managed by your browser here'); return; }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) { toast('No installed app to update'); return; }
    toast('Checking for updates...');
    await reg.update();
    const incoming = reg.installing || reg.waiting;
    if (incoming) {
      incoming.addEventListener('statechange', () => {
        if (incoming.state === 'installed' || incoming.state === 'activated') location.reload();
      });
      if (incoming.state === 'installed' || incoming.state === 'activated') location.reload();
    } else {
      toast(`You are on the latest (v${APP_VERSION})`);
    }
  } catch (_) { toast('Could not check for updates'); }
}
// [i18n] Language switch: store the preference, re-resolve the active catalog,
// and re-render so the whole UI follows immediately.
function setAppLang(v) {
  S.profile.lang = v;
  I18N.setLang(v);
  save();
  render();
  toast(t('settings.language_saved'));
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
  console.log(`IRONWAVE v${APP_VERSION}`);
  S = await loadState();
  I18N.setLang(S.profile.lang); // resolve the app language before the first render
  V = { view: S.program ? 'dashboard' : 'onboarding', tab: 'dashboard',
        dayIdx: null, checkinStep: 0, checkinData: null, draft: null,
        libTab: 'alpha', libSearch: '', obStep: 0, ob: null };
  // Unlock audio on the very first interaction so the timer chime can sound even
  // when the timer was started by something other than a tap (or on iOS, where a
  // standalone PWA will not play synthesized audio until a gesture unlocks it).
  const unlock = () => { primeAudio(); primeHtmlAudio(); if (AUDIO_UNLOCKED) {
    document.removeEventListener('touchend', unlock);
    document.removeEventListener('pointerup', unlock);
    document.removeEventListener('click', unlock);
  } };
  document.addEventListener('touchend', unlock, { passive: true });
  document.addEventListener('pointerup', unlock, { passive: true });
  document.addEventListener('click', unlock);
  // Ghost-tap net (capture phase, so it runs before any inline onclick): eat the
  // stray second click of a double-tap that closed a modal. See armTapGuard.
  document.addEventListener('click', (e) => {
    if (tapGuardActive(e.target)) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  // Coming back to a frozen/throttled tab (iOS PWA especially): catch the rest
  // timer up immediately so a countdown that expired while away rings now
  // instead of on the next throttled tick.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && V && V.restTimer && !V.restTimer.rung) restTick();
  });
  render();
}
// Last-resort net for anything that throws before/around the first render (load,
// migration, boot): show the recovery screen instead of a black PWA window.
boot().catch(e => {
  console.error('boot failed', e);
  try { renderErrorScreen(e); } catch (_) {}
});

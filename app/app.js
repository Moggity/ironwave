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
               lang: 'en',         // [i18n] app language, English by default (owner call)
               units: 'kg',        // [Epic H1] display units; storage is always kg
               intensityDisplay: 'rir', // [Epic H1] effort display; storage stays RPE
               landmarks: {} },
    program: null,
    bodyweight: [],   // [Cluster F] [{ts, kg}] light trend, no macro tracking
    landmarkLog: [],  // [Epic H3] [{ts, block, landmarks}] per-block snapshots (evolution history)
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
  if (!s.debugTier) s.debugTier = 'coach'; // [Tier debug] free/coach preview, coach = today's behavior
  if (!p.phase) p.phase = 'lean-gain';  // [Cluster F] training phase
  if (!p.lang) p.lang = 'en';           // [i18n] app language, English by default
  if (!p.units) p.units = 'kg';         // [Epic H1] display units (storage stays kg)
  if (!p.intensityDisplay) p.intensityDisplay = 'rir'; // [Epic H1] effort display
  if (p.restNotify == null) p.restNotify = false; // rest-done notification opt-in
  if (!Array.isArray(s.bodyweight)) s.bodyweight = []; // [Cluster F] bodyweight trend
  if (!Array.isArray(s.landmarkLog)) s.landmarkLog = []; // [Epic H3] landmark snapshots
  if (s.program && !s.program.volAdj) s.program.volAdj = {}; // [Cluster E] per-muscle autoreg
  if (s.program && !s.program.belowStd) s.program.belowStd = {}; // [Epic H2] below-standard AMRAP counters
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
  if (!persisted && typeof toast === 'function') toast(t('common.save_failed'), true);
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
// [Epic H1] Unit display. kg stays the only stored unit; pounds are a
// render/input skin. Every weight render goes out through toDispW/dispW/fmtWU
// and every weight input comes back through fromDispW, so the engine, records
// and the golden master never see lb.
const isLb = () => S && S.profile && S.profile.units === 'lb';
const toDispW = v => (v == null ? null : (isLb() ? Engine.kgToLb(v) : v));
const fromDispW = v => (v == null || isNaN(v) ? null : (isLb() ? Engine.lbToKg(v) : v));
const wUnit = () => t(isLb() ? 'unit.lb' : 'unit.kg');
// Display-unit number formatting: a value sitting on the quarter grid keeps
// both decimals (a 1.25 plate face must not read 1.3); anything else rounds to
// one decimal, which also snaps float dust (45.000000000004 reads 45).
const fmtNumW = v => {
  const q = Math.round(v * 4) / 4;
  if (Math.abs(v - q) < 5e-3) return q % 1 === 0 ? q : parseFloat(q.toFixed(2));
  return parseFloat(v.toFixed(1));
};
// Stored-kg weight -> display-unit number string / "number unit" string.
const dispW = v => (v == null ? '' : fmtNumW(toDispW(v)));
const fmtWU = v => `${dispW(v)} ${wUnit()}`;
// Tonnage in display units, rounded to whole units (a lb total is not a load
// someone sets on a bar, so decimals are noise).
const fmtTonnage = v => `${Math.round(toDispW(v || 0)).toLocaleString(I18N.dateLocale())} ${wUnit()}`;
// [Cluster A] RIR-first display. The athlete sees reps-in-reserve everywhere;
// the stored intensity stays RPE (rir = 10 - rpe), so the engine is untouched.
// [Epic H1] RPE-native athletes can flip the display; storage stays RPE.
const isRpe = () => S && S.profile && S.profile.intensityDisplay === 'rpe';
const fmtRir = rpe => (rpe == null ? '–'
  : isRpe() ? t('unit.rpe', { n: kg(rpe) })
  : t('unit.rir', { n: kg(Engine.rpeToRir(rpe)) }));
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
// Translated display label for a movement id (the MOVEMENTS table keeps the
// English name as the fallback for anything not in a catalog).
const mvLabel = mv => (MOVEMENTS[mv] ? t('mv.' + mv) : mv);
// Translated display label for a training phase id.
const phaseLabel = ph => (PHASES.includes(ph) ? t('phase.' + ph) : ph);
// Translated display label for a muscle head / region id.
const headLabel = h => (HEAD_LABELS[h] ? t('head.' + h) : h);
// [Cluster C] Compact picker badges: muscle region (head), a loaded-stretch flag,
// and a non-default SFR so the high-value and high-cost picks stand out at a glance.
function exTagsHTML(e) {
  if (!e) return '';
  let out = '';
  if (e.head && HEAD_LABELS[e.head]) out += `<span class="ex-tag head">${esc(headLabel(e.head))}</span>`;
  if (e.stretch) out += `<span class="ex-tag stretch">${esc(t('ex.tag_stretch'))}</span>`;
  if (e.sfr && e.sfr !== 2) out += `<span class="ex-tag sfr s${e.sfr}">${esc(t('ex.tag_sfr', { level: t('sfr.' + e.sfr) }))}</span>`;
  return out ? `<span class="ex-tags">${out}</span>` : '';
}
// [Cluster C] Fuller stimulus block for the exercise detail Info tab.
function exMetaCardHTML(e) {
  if (!e) return '';
  const rows = [`<div class="row"><span class="subtle">${esc(t('ex.sfr_row'))}</span><b>${esc(SFR_LABELS[e.sfr] ? t('sfr.' + e.sfr) : t('sfr.2'))}</b></div>`];
  if (e.head && HEAD_LABELS[e.head]) rows.push(`<div class="row"><span class="subtle">${esc(t('ex.region_row'))}</span><b>${esc(headLabel(e.head))}</b></div>`);
  if (e.stretch) rows.push(`<div class="row"><span class="subtle">${esc(t('ex.emphasis_row'))}</span><b>${esc(t('ex.loaded_stretch'))}</b></div>`);
  return `<div class="section-title" style="font-size:1.1rem">${esc(t('ex.stimulus_title'))}</div>
    <div class="card">${rows.join('<div class="divider"></div>')}</div>
    <p class="faint">${esc(t('ex.sfr_footer'))}</p>`;
}

function allExercises() { return EXERCISES.concat(S.customEx); }
function exById(id) { return allExercises().find(e => e.id === id); }
// [i18n phase 4] Translated exercise display name: an 'exn.<id>' catalog key
// layered over EXERCISES, falling back to the English name for any id a
// catalog does not cover. Custom exercises are the athlete's own text and are
// never translated. Names already stored in sessions/records stay verbatim.
function exDisplayName(e) {
  if (!e) return '';
  if (e.custom) return e.name;
  const cat = I18N.catalogs[I18N.lang];
  return (cat && cat.strings['exn.' + e.id]) || e.name;
}
function exName(id) { const e = exById(id); return e ? exDisplayName(e) : id; }
// Search matcher: a query hits the translated display name or the English one,
// so "sentadilla" and "squat" both find the squat in a Spanish UI.
function exMatches(e, q) {
  if (!q) return true;
  return e.name.toLowerCase().includes(q) || exDisplayName(e).toLowerCase().includes(q);
}
function recordsFor(id) { return S.records[id] || []; }
function pushRecord(id, rec) { (S.records[id] = S.records[id] || []).push(rec); }

// ------------------------------------------------------------
// [Tier debug] The free/coach entitlement seam, debug edition.
// hasCoach() is the ONE gate every coach surface checks. Today its truth is
// the Settings tier-preview toggle (S.debugTier); the monetization epic's M1
// swaps this body for the real billing adapter without touching a call site.
// 'coach' is the default and the migration backfill, so every existing save
// and the whole test suite behave exactly as before this feature.
// Boundary source of truth: docs/tier-usage-analysis.md (the surface map) and
// docs/monetization-operations-report.md section 2.
// ------------------------------------------------------------
function hasCoach() { return !S || S.debugTier !== 'free'; }
function setDebugTier(v) {
  S.debugTier = v === 'free' ? 'free' : 'coach';
  save(); render();
  toast(t(S.debugTier === 'free' ? 'tier.free_on' : 'tier.coach_on'));
}
// The lock treatment: an honest card, no blur tricks (identity report rule).
function coachLockHTML() {
  return `<div class="card accent"><b>${esc(t('tier.locked_title'))}</b>
    <p class="subtle" style="margin-top:6px">${esc(t('tier.locked_note'))}</p></div>`;
}
function coachLockView(title) {
  return `${topbar(title)}<div class="view">${coachLockHTML()}</div>${tabbar()}`;
}

// ------------------------------------------------------------
// LOADING PROFILES (Change 1)
// Stored weight on a set is ALWAYS the total load moved, so all
// existing math (e1RM, wave %, tonnage, plate inventory) is untouched.
// We only change how the total is rounded and how it is displayed.
// ------------------------------------------------------------
// Dumbbell entries that use a single implement at a time.
const SINGLE_DB = new Set(['goblet-squat', 'db-row', 'kroc-row', 'single-leg-rdl', 'db-side-bend', 'suitcase-carry', 'db-pullover', 'concentration-curl', 'db-kickback']);
// A kettlebell loads like a single fixed implement: dumbbell-mode math (the
// athlete's dumbbell increment), one bell, no plate math.
const EQUIP_MODE = { bb: 'barbell', db: 'dumbbell', mc: 'machine', cb: 'cable', bw: 'bodyweight', bd: 'band', kb: 'dumbbell' };
// Athlete-facing equipment labels and a stable display order for the
// equipment filter chips on the swap / select / add-exercise pickers.
const EQUIP_LABEL = { bb: 'Barbell', db: 'Dumbbell', mc: 'Machine', cb: 'Cable', bw: 'Bodyweight', bd: 'Band', kb: 'Kettlebell' };
const EQUIP_ORDER = ['bb', 'db', 'mc', 'cb', 'bw', 'bd', 'kb'];
// One filter-chip row shared by every exercise picker. `fnName` is the
// global handler invoked with the chosen equipment id (or 'all').
function equipChips(equips, current, fnName) {
  const chip = (val, label) => `<button class="fchip ${current === val ? 'on' : ''}" onclick="${fnName}('${val}')">${label}</button>`;
  return `<div class="filter-chips">${chip('all', esc(t('equip.all')))}${equips.map(eq => chip(eq, EQUIP_LABEL[eq] ? esc(t('equip.' + eq)) : eq)).join('')}</div>`;
}

// Default loading derived from the exercise's equipment tag.
function defaultLoadingFor(exId) {
  const e = exById(exId);
  const eq = e ? e.equipment : 'bb';
  if (eq === 'db') return { mode: 'dumbbell', count: SINGLE_DB.has(exId) ? 1 : 2 };
  if (eq === 'kb') return { mode: 'dumbbell', count: 1 };
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

// Display a stored total in the exercise's own units. Stored numbers stay kg
// totals; only the shown number divides (two dumbbells) and converts (lb mode).
// Returns { value: display-unit number, perHand: bool }.
function displayWeight(exId, totalWeight) {
  const L = loadingFor(exId);
  if (L.mode === 'dumbbell' && L.count === 2) {
    return { value: totalWeight == null ? null : toDispW(totalWeight / 2), perHand: true };
  }
  return { value: toDispW(totalWeight), perHand: false }; // single dumbbell: the number is the dumbbell itself
}
// Unit suffix matching a displayWeight result: kg / kg/hand / lb / lb/hand.
function wUnitFor(d) {
  return t(isLb() ? (d.perHand ? 'unit.lb_hand' : 'unit.lb')
                  : (d.perHand ? 'unit.kg_hand' : 'unit.kg'));
}

// Compact weight string for set rows: "40kg" or "20kg/hand" (lb mode: "88lb").
function fmtW(exId, totalWeight) {
  const d = displayWeight(exId, totalWeight);
  if (d.value == null) return '';
  return `${fmtNumW(d.value)}${wUnitFor(d)}`;
}

// Plate visual colors resolve by the plate's face value in the athlete's
// display unit (a 45 stored as 20.41 kg keys the lb map as '45').
const plateFace = w => String(Math.round(toDispW(w) * 100) / 100);
const plateColorFor = w => (isLb() ? PLATE_COLORS_LB : PLATE_COLORS)[plateFace(w)] || '#6b7280';
const plateTextFor = w => (isLb() ? PLATE_TEXT_LB : PLATE_TEXT)[plateFace(w)] || '#fff';

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
  const testDate = program.startDate +
    blocks.reduce((a, b) => a + (b.weeks || program.weeksPerBlock), 0) * 7 * 864e5;
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
  const start = Date.now();
  // [Epic H6] A meet date on a strength-ending track plans BACKWARD from the
  // date: enough standard blocks to fill the runway, then a real 2-week taper
  // (scheme jm2-peak, block.weeks = 2) placed last, and the test date IS the
  // meet date. Gated on ob.meetDate, so the default path is byte-identical.
  let meetTs = null;
  if (ob.meetDate && track !== 'bodybuilding') {
    const ts = typeof ob.meetDate === 'number' ? ob.meetDate : Date.parse(ob.meetDate);
    if (ts > start + 21 * 864e5) meetTs = ts; // needs at least a short block + taper
  }
  // [Epic G2] A custom macrocycle length (weeks) rebuilds the block list to fit;
  // no length keeps the template verbatim, so the default path stays byte-identical.
  // [Epic I5] A meet runway is arbitrated by the master coach: strength blocks
  // fill backward from the meet, hypertrophy fills the front, leftover weeks
  // become a short volume lead-in (2 weeks at most on a <= 75 day runway), and
  // the plan never extends past the meet (the old rounding scheduled the taper
  // AFTER a short meet, intake-QA F1/F2).
  const blocks = meetTs
    ? relabelBlocks(Engine.coach.meetBlockPlan(
        Math.floor((meetTs - start) / 864e5), tpl.blocks, tpl.weeksPerBlock))
    : ob.macroWeeks
      ? extendBlocks(tpl.blocks, blocksForWeeks(ob.macroWeeks, tpl.weeksPerBlock))
      : JSON.parse(JSON.stringify(tpl.blocks));
  stampMesoIdx(blocks);
  stampBlockPhase(blocks);
  markPeakBlock(blocks); // [Realism] strength-ending tracks taper into a peak
  // [Epic G6] A bodybuilding goal archetype overrides the default per-block phases
  // with its own sequence (lean-fast vs serious macro). Inert on other tracks.
  if (track === 'bodybuilding' && ob.goalArchetype) applyArchetypePhases(blocks, ob.goalArchetype);
  if (meetTs) {
    blocks.push({ label: 'Meet taper', type: 'peaking', wave: '3s',
      scheme: 'jm2-peak', weeks: 2, phase: 'peak', mesoIdx: 0 });
  }
  const totalWeeks = blocks.reduce((a, b) => a + (b.weeks || tpl.weeksPerBlock), 0);
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
  // [Calendar days] Weekday mapping, index-aligned with days[] (day i trains on
  // schedule[i].wd; 0 = Monday). `sport` marks a competitive-sport day (captured
  // now, consumed by the future sport-aware scheduling epic). Only written when
  // onboarding supplied weekdays IN calendar mode, so a count-only ob (count
  // mode, tests, legacy, golden master) builds a byte-identical program with no
  // schedule key at all, even if a stale weekday pick lingers on the draft.
  const schedule = ob.daysMode !== 'count'
    && Array.isArray(ob.trainingDays) && ob.trainingDays.length
    && ob.trainingDays.length === days.length
    ? ob.trainingDays.map(wd => ({ wd, sport: (ob.sportDays || []).includes(wd) }))
    : null;
  return {
    template: tpl.id, daysPerWeek: ob.daysPerWeek,
    methodology: tpl.methodology || 'Juggernaut + Bodybuilding',
    startDate: start,
    testDate: ob.testDate || meetTs || start + totalWeeks * 7 * 864e5,
    ...(meetTs ? { meetDate: meetTs } : {}),
    ...(schedule ? { schedule } : {}),
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
      // The bodybuilding goal drives the block display name (blockDisplayLabel);
      // older saves lack it and fall back to the generic track word.
      goalArchetype: track === 'bodybuilding' ? (ob.goalArchetype || null) : null,
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
// [2-day] Full-body mode. An upper/lower split at N <= 2 silently drops every
// muscle to 1x/week and piles a week's whole per-muscle volume into one
// session (which the per-session cap then trims with no other day to catch
// it). Standard practice at that frequency is full-body days: each trained
// muscle appears on min(freq, N) days, the two days lead with compounds from
// DIFFERENT regions, and a 2x muscle's weekly sets naturally split across
// both sessions.
function generateFullBodyDays(focus, N) {
  const freq = {};
  for (const m of FOCUS_KEYS) if (SPLIT_FREQ[focus[m]]) freq[m] = Math.min(SPLIT_FREQ[focus[m]], N);
  const ms = FOCUS_KEYS.filter(m => freq[m]);
  if (!ms.length) return [];
  const used = new Set(), headsUsed = {}, usedMains = new Set();
  const pick = m => {
    const hs = headsUsed[m] || (headsUsed[m] = new Set());
    const id = pickAccessory(DEFAULT_ACC[m] || [], used, hs);
    if (id) { used.add(id); const h = accHead(id); if (h) hs.add(h); }
    return id;
  };
  const accSlot = m => { const id = pick(m); return id ? { type: 'acc', cat: (exById(id) || {}).movement, def: id } : null; };
  // One lead per day, from different regions when both have one: the strongest
  // anchor-capable upper muscle and the strongest lower one.
  const canLead = m => ANCHOR_RANK[m] >= 2 && freq[m];
  const best = arr => arr.filter(canLead).sort((a, b) => focus[b] - focus[a])[0];
  const leads = [];
  const upLead = best(UPPER_MUSCLES), loLead = best(LOWER_MUSCLES);
  if (upLead) leads.push(upLead);
  if (loLead && leads.length < N) leads.push(loLead);
  while (leads.length < N) {
    leads.push(FOCUS_KEYS.filter(canLead).find(m => !leads.includes(m)) || ms[0]);
  }
  const days = leads.slice(0, N).map(p => ({ primary: p, muscles: [], load: 1 }));
  // Spread every muscle's frequency across the days, least-loaded first, never
  // twice on one day (the lead day counts as one appearance).
  for (const m of ms.slice().sort((a, b) => focus[b] - focus[a])) {
    let r = freq[m] - days.filter(d => d.primary === m).length;
    while (r-- > 0) {
      const avail = days.map((_, i) => i).filter(i => days[i].primary !== m && !days[i].muscles.includes(m));
      if (!avail.length) break;
      const di = avail.sort((a, b) => days[a].load - days[b].load)[0];
      days[di].muscles.push(m); days[di].load++;
    }
  }
  return days.map(d => {
    const slots = [];
    const a = PRIMARY_ANCHOR[d.primary];
    if (a && a.main) {
      if (!usedMains.has(a.main)) { usedMains.add(a.main); slots.push({ type: 'main', lift: a.main }); }
      else slots.push({ type: 'secondary', lift: a.main, baseLift: a.main });
    } else if (a && a.acc && !used.has(a.acc)) {
      used.add(a.acc); slots.push({ type: 'acc', cat: (exById(a.acc) || {}).movement, def: a.acc });
    } else { const s = accSlot(d.primary); if (s) slots.push(s); }
    for (const m of d.muscles) { const s = accSlot(m); if (s) slots.push(s); }
    let g = 0;
    while (slots.length < 4 && g++ < 6) { const s = accSlot(d.primary); if (!s) break; slots.push(s); }
    return { name: `Full Body · ${FOCUS_LABELS[d.primary] || d.primary}`,
             theme: { region: 'full', primary: d.primary },
             slots, primary: d.primary };
  });
}
// [1/7-day] Slider -> weekly frequency, day-count aware: a 7-day week unlocks a
// fourth weekly exposure for a maxed (slider 6) muscle. Gated on N >= 7 so every
// existing 2-6 day program keeps the plain SPLIT_FREQ table (byte-identical).
function splitFreqFor(sliderVal, N) {
  return (SPLIT_FREQ[sliderVal] || 0) + (N >= 7 && sliderVal === 6 ? 1 : 0);
}
// [7-day] The generated pump day: light isolation work for the highest-focus
// muscles, no mains. Used when a 7-day week has no slider at 6 (no muscle earns
// a fourth exposure), so the seventh day becomes the week's fatigue valve.
function generatePumpDay(focus) {
  const used = new Set(), headsUsed = {};
  const ms = FOCUS_KEYS.filter(m => SPLIT_FREQ[focus[m]])
    .sort((a, b) => focus[b] - focus[a]).slice(0, 5);
  const slots = [];
  for (const m of ms) {
    const hs = headsUsed[m] || (headsUsed[m] = new Set());
    const id = pickAccessory(DEFAULT_ACC[m] || [], used, hs);
    if (id) {
      used.add(id); const h = accHead(id); if (h) hs.add(h);
      slots.push({ type: 'acc', cat: (exById(id) || {}).movement, def: id });
    }
  }
  return { name: 'Pump', nameKey: 'pump', slots };
}
function generateBodybuildingDays(focus, N) {
  if (N <= 2) return generateFullBodyDays(focus, N); // [2-day] full-body, not upper/lower
  // [7-day] Without a slider-6 muscle nothing trains 4x, so a 7th split day would
  // only thin the week out; generate the 6-day split and close with a pump day.
  if (N >= 7 && !FOCUS_KEYS.some(m => focus[m] === 6 && SPLIT_FREQ[focus[m]])) {
    const week = generateBodybuildingDays(focus, N - 1);
    if (!week || !week.length) return week;
    week.push(generatePumpDay(focus));
    return week;
  }
  const freq = {};
  for (const m of FOCUS_KEYS) if (splitFreqFor(focus[m], N)) freq[m] = splitFreqFor(focus[m], N);
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
      // [7-day] Thin days are the point at 7/week (frequency spreads, volume does
      // not inflate), so the pad floor drops to 2; N <= 6 keeps the floor of 3.
      const floor = N >= 7 ? 2 : 3;
      while (slots.length < floor && g++ < 6) { const s = accSlot(d.primary); if (!s) break; slots.push(s); }
      const upper = UPPER_MUSCLES.includes(d.primary);
      const region = upper ? 'Upper' : 'Lower';
      // `primary` is carried for the same-muscle spacing pass below; render reads
      // name + slots (and now `theme`), so the extra field is inert everywhere
      // else. [i18n phase 3] `theme` is the structured, render-translated form of
      // the name; the English `name` string stays for back-compat and exports.
      return { name: `${region} · ${FOCUS_LABELS[d.primary] || d.primary}`,
               theme: { region: upper ? 'upper' : 'lower', primary: d.primary },
               slots, primary: d.primary };
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
// The one gate most non-default behavior hangs off: is this a bodybuilding program?
function bbTrack() { const tc = P() && P().trainingConfig; return !!(tc && tc.track === 'bodybuilding'); }
function dayKey(b, w, d) { return `${b}-${w}-${d}`; }
// [Epic H6] Per-block week count: a block may carry its own `weeks` (the meet
// taper is 2), everything else keeps the program-wide weeksPerBlock, so every
// existing program computes exactly as before.
function blockWeeks(b) { return (b && b.weeks) || P().weeksPerBlock; }
function weeksBefore(bi) {
  let n = 0;
  for (let i = 0; i < bi && i < P().blocks.length; i++) n += blockWeeks(P().blocks[i]);
  return n;
}
function totalProgramWeeks() { return weeksBefore(P().blocks.length); }
function blockOf(i) { return P().blocks[i]; }
function curBlock() { return blockOf(P().pointer.block); }
function weekIdx() { return P().pointer.week; }
function programDone() { return P().pointer.block >= P().blocks.length; }
function daysOut() { return Math.max(0, Math.ceil((P().testDate - Date.now()) / 864e5)); }
function globalWeekNum() { return weeksBefore(P().pointer.block) + P().pointer.week + 1; }
// Day theme label (e.g. "Upper A", "Push") shown as a subtitle. Empty for the
// plain "Day N" templates so we never render "Day 1 · Day 1".
// [i18n phase 3] Day display theme. Preference order: a structured generator
// theme (region + primary muscle, translated), a template nameKey (translated),
// then a legacy stored name verbatim ('Day N' placeholders show nothing).
function dayTheme(d) {
  if (!d) return '';
  if (d.theme && d.theme.primary) {
    // [2-day] A full-body day says so; the lead muscle alone would mislead.
    if (d.theme.region === 'full') return `${t('day.full_body')} · ${t('muscle.' + d.theme.primary)}`;
    // Owner feedback: the Upper/Lower region tag reads as noise next to the
    // primary muscle, so themed days show the muscle alone.
    return t('muscle.' + d.theme.primary);
  }
  if (d.nameKey) return t('day.' + d.nameKey);
  return (d.name && !/^Day \d+$/.test(d.name)) ? d.name : '';
}
// Athlete-facing block name. The stored label stays English ('Hypertrophy 2',
// state and history keep their shape); display translates it and, on the
// bodybuilding track, uses the athlete's own goal word instead of the jargon
// (owner feedback: most athletes do not know "hypertrophy").
function blockDisplayLabel(block) {
  const m = /^(Hypertrophy|Strength) (\d+)$/.exec(block && block.label || '');
  if (!m) return (block && block.label) || '';
  let base;
  if (m[1] === 'Strength') {
    base = t('timeline.strength');
  } else {
    const tc = P() && P().trainingConfig;
    if (tc && tc.track === 'bodybuilding') {
      base = tc.goalArchetype === 'serious-macro' ? t('block.bb_serious') : t('track.bodybuilding');
    } else {
      base = t('timeline.hypertrophy');
    }
  }
  return `${base} ${m[2]}`;
}

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
    for (let k = 0; k < delta; k++) { sets.splice(at, 0, Object.assign({}, src, { note: null, noteKey: null, noteParams: null })); at++; }
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
// [7-day] Per-session landmark cap divisor. The historical mrv/2 assumes ~2
// sessions/wk/muscle; a muscle trained 4x or more (only reachable on a 7-day
// week with a slider at 6) divides by its real frequency so the weekly total
// stays at or under MRV. Below 4x the divisor stays 2, byte-identical to every
// existing program.
function perSessionCapDiv(sliderKey) {
  const p = P();
  if (!sliderKey || !p || !Array.isArray(p.days)) return 2;
  const wf = p.days.filter(d => splitDayMuscles(d).has(sliderKey)).length;
  return wf >= 4 ? wf : 2;
}
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
  const perSessionCap = lm ? Math.max(1, Math.round(lm.mrv / perSessionCapDiv(key))) : 8;
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
  const gWeek = weeksBefore(blockIdx) + wIdx + 1;
  const mod = (P().weekMod && P().weekMod.appliesToGlobalWeek === gWeek) ? P().weekMod : null;
  const modPct = mod ? mod.pctMod : 1;
  if (slot.type === 'main') {
    const wmKey = slot.lift;                  // wave math always keys off the base lift's WM
    const exId = slot.ex || slot.lift;        // …but the performed exercise can be swapped
    const rm = bbLiftRemoval(exId);
    if (rm) return { exId, name: exName(exId), sets: [], isMain: true, wmKey, isRemoved: true, removedReason: rm };
    const r = loadingFor(exId).totalInc;      // Change 1: round the total to this implement's increment
    // [Epic H4] Bodybuilding: a swapped-in lead (DB/machine compound) prices
    // off its OWN e1RM and peaks on a rep-PR top set; the barbell WM wave (and
    // its calibrating AMRAP) applies only while the barbell anchors the day.
    // Other tracks and un-swapped mains take the WM path, byte-identical.
    if (exId !== wmKey && bbTrack() && sch.mainE1RM) {
      let sets = sch.mainE1RM(block, eIdx, recordsFor(exId), r, S.profile.experience);
      if (mod) sets = applySetDelta(sets, mod.mainSetDelta || 0);
      return { exId, name: exName(exId), sets, isMain: true, wmKey, e1Anchor: true };
    }
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
  // [Epic H4] Bodybuilding accessories train a real rep range (movement + SFR
  // band, shifted per meso) with double progression inside it. Passed into the
  // scheme as an optional input, so the default/powerbuilding path (no range)
  // stays byte-identical - the golden-master contract.
  let range = null;
  if (bbTrack()) {
    const ex = exById(exId);
    if (ex) range = Engine.mesoRepRange(Engine.repRangeFor(ex.movement, ex.sfr), block.mesoIdx || 0);
  }
  let sets = sch.accessory(block, eIdx, recordsFor(exId), r, S.profile.experience, range);
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
    sets = applyTechnique(exId, sets, r, blockIdx, wIdx);
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
  const label = mvLabel(mv);
  if (i >= 0) { p.muscleDeload.splice(i, 1); toast(t('vol.md_full_toast', { muscle: label })); }
  else { p.muscleDeload.push(mv); toast(t('vol.md_deloaded_toast', { muscle: label })); }
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
    if (ed && ed.block === blockIdx && ed.week === wIdx) return blockWeeks(blockOf(blockIdx)) - 1; // deload slot
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
  toast(t('deload.accepted_toast'));
  render();
}
function confirmEarlyDeload() {
  confirmModal({
    title: t('deload.confirm_title'),
    message: t('deload.confirm_msg'),
    confirmLabel: t('deload.deload_now'),
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
      <div style="font-weight:700">${esc(t('deload.early_active_title'))}</div>
      <p class="faint mt8">${esc(t('deload.early_active_body'))} <button class="link-btn" onclick="cancelEarlyDeload()">${esc(t('deload.resume_block'))}</button></p></div>`;
  }
  const adv = earlyDeloadAdvice();
  if (!adv || !adv.advised) return '';
  if (p.earlyDeloadDismissedWeek === globalWeekNum()) return '';
  // Rebuild the engine's advice sentence from its parts so it translates.
  const reason = t(readinessTrendingDown() ? 'deload.reason_near_mrv_sliding' : 'deload.reason_near_mrv', { n: adv.over });
  return `<div class="card accent mt8" style="border-left:3px solid var(--amber)">
    <div style="font-weight:700">${esc(t('deload.advise_title'))}</div>
    <p class="faint mt8">${esc(t('deload.advise_body', { reason }))}</p>
    <div class="btn-row mt8">
      <button class="btn btn-outline" onclick="dismissEarlyDeloadSuggestion()">${esc(t('deload.keep_pushing'))}</button>
      <button class="btn btn-blue" onclick="confirmEarlyDeload()">${esc(t('deload.deload_now'))}</button>
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
  const cap = lm ? Math.max(1, Math.round(lm.mrv / perSessionCapDiv(MOVEMENT_SLIDER[e.movement]))) : 8;
  const target = Math.max(1, Math.min(plain + offset, cap));
  return target - plain;
}
// [Cluster B] Turn an accessory's last real working set into its opted-in
// intensity technique (today: drop set). Bodybuilding-only and only when the
// athlete has tagged this exercise, so every other track and an untagged
// exercise are byte-identical (golden master holds). Calibration / AMRAP / ramp
// and weightless sets are never modified.
// Finishers belong to the back half of a meso, the same rule Engine.scheduledTech
// encodes (book: intensity techniques demand 0-3 RIR, incompatible with the high
// RIR intro week, and have no place on a deload): intensification/realization
// work weeks only, bodybuilding track, non-beginner. effectiveWeekIdx makes an
// early (pulled-in) deload suppress them too.
function finisherAllowed(blockIdx, wIdx) {
  const tc = P() && P().trainingConfig;
  if (!tc || tc.track !== 'bodybuilding') return false;
  if ((S.profile.experience || 'intermediate') === 'beginner') return false;
  const t = Engine.weekType(effectiveWeekIdx(blockIdx, wIdx));
  return t === 'intensification' || t === 'realization';
}
function applyTechnique(exId, sets, rounding, blockIdx, wIdx) {
  if (!finisherAllowed(blockIdx, wIdx)) return sets;
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
    if (pos < 0 || pos >= order.length - 1) { toast(t('workout.ss_need_next'), true); return; }
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
    return `<div class="banner-warn mt8">${esc(t('time.core_over', { core: built.coreMin, cap: tc.timeCapMin }))}${built.optItems.length ? ' ' + esc(t('time.optional_extras', { list: built.optionalNames.join(', ') })) : ''}</div>`;
  }
  if (built.optItems.length) {
    return `<div class="banner-warn mt8">${esc(t('time.core_fits', { cap: tc.timeCapMin, core: built.coreMin, list: built.optionalNames.join(', '), extra: built.fullMin - built.coreMin }))}</div>`;
  }
  return `<div class="card mt8"><span class="faint">${esc(t('time.day_within', { core: built.coreMin, cap: tc.timeCapMin }))}</span></div>`;
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
    return `<p class="faint" style="margin:8px 2px 0">${esc(t('time.at_limit', { cap: tc.timeCapMin, cost }))}</p>`;
  }
  return `<p class="faint" style="margin:8px 2px 0">${esc(t('time.room', { room, cap: tc.timeCapMin, cost }))}</p>`;
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
  for (let wk = 0; wk < blockWeeks(blockOf(bi)); wk++) {
    const b = resolveDayEntries(di, bi, wk);
    const over = cap && b.coreMin > cap;
    const cur = wk === p.pointer.week;
    rows.push(`<div class="row" style="padding:9px 0;border-bottom:1px solid var(--line)${cur ? ';font-weight:700' : ''}">
      <span>${weekLabelFor(blockOf(bi), wk)}${cur ? ' ·' : ''}</span>
      <span>${esc(t('unit.min', { n: b.coreMin }))}${b.optItems.length ? ` <span style="color:var(--amber)">${esc(t('time.opt_suffix', { n: b.fullMin - b.coreMin }))}</span>` : ''}${over ? ` <span style="color:var(--red)">${esc(t('time.over'))}</span>` : ''}</span></div>`);
  }
  showModal(anim => {
    $modal.innerHTML = modalShell(anim, t('time.by_week_title'),
      `<p class="subtle" style="margin-bottom:8px">${esc(t('time.by_week_intro', { day: di + 1 }))}${cap ? ' ' + esc(t('time.by_week_cap', { cap })) : ''} ${esc(t('time.by_week_shape'))}</p>${rows.join('')}`);
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
// Copy lives in the i18n catalogs ('week.feel_1'..'week.feel_5').
const weekFeelLegend = v => t('week.feel_' + v);
function nextPointer(b, w) {
  let nb = b, nw = w + 1;
  if (nw >= blockWeeks(blockOf(b))) { nw = 0; nb = b + 1; }
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

  return { appliesToGlobalWeek: weeksBefore(upBi) + upWi + 1, pctMod, accSetDelta, mainSetDelta };
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
      progress: vProgress, report: vReport, meet: vMeet,
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
    <div class="section-title">${esc(t('err.title'))}</div>
    <p class="faint" style="margin-bottom:10px">${esc(t('err.body'))}</p>
    <div class="btn-row">
      <button class="btn btn-blue" onclick="location.reload()">${esc(t('err.reload'))}</button>
      <button class="btn btn-outline" onclick="exportData()">${esc(t('err.export'))}</button>
    </div>
    <button class="btn btn-outline mt8" onclick="checkForUpdate()">${esc(t('set.check_updates'))}</button>
    <div class="section-title">${esc(t('err.detail'))}</div>
    <pre class="faint" style="white-space:pre-wrap;word-break:break-word;font-size:.72rem;overflow:auto">${detail}</pre>
  </div>`;
}
function tabbar() {
  const tab = (id, ic) => `
    <button class="${V.tab === id ? 'on' : ''}" onclick="setTab('${id}')">
      <span class="ic">${ic}</span>${esc(t('tab.' + id))}</button>`;
  return `<nav class="tabbar">
    ${tab('dashboard','▥')}${tab('workout','🏋')}
    ${tab('history','🗂')}${tab('more','☰')}
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
// [Epic I2] The step pipeline is data-driven from the track contract
// (TRACK_SPEC in data.js): after the shared head (welcome -> goal) each
// track walks its own declared step list, so a track that needs a question
// (the strength-track meet date, the bodybuilding focus sliders) declares
// it there instead of branching a hardcoded index chain. V.obStep indexes
// into obStepList(ob). Intake gates run through Engine.validateIntake
// (I1): an error blocks Continue loudly, nothing is filtered silently.
// Bodybuilding leads (owner call: it is the app's primary audience) and the
// copy stays to one short line per card; the picker does the explaining.
// Track and experience copy lives in the i18n catalogs ('track.<id>' /
// 'track.<id>_desc', 'exp.<id>' / 'exp.<id>_desc'); these keep only the order.
// [Epic H2] All three tracks pickable, including the app's own default
// (powerbuilding was unreachable from a fresh install).
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
  return { name: '', bodyweight: '', daysPerWeek: null,
           // [Calendar days] Weekday indices (0 = Monday .. 6 = Sunday) the athlete
           // trains, plus the subset flagged as competitive-sport days. daysPerWeek
           // stays the derived count so everything downstream is untouched.
           // daysMode 'calendar' (default) picks specific days; 'count' keeps the
           // plain how-many row and builds a floating, unscheduled week.
           trainingDays: [], sportDays: [], daysMode: 'calendar',
           track: null,
           experience: null, timeMode: null, timeCapMin: '',
           macroWeeks: null, // [Epic G2] null = standard template length
           goalArchetype: null, // [Epic G6] bodybuilding only
           // [Epic I2] The strength-track meet step: an explicit answer is
           // required ('none' or 'date' + a validated meetDate). Starts
           // unanswered like every other choice step.
           meetChoice: null, meetDate: null,
           showAdvanced: false, // program-length presets tucked away
           muscleFocus: { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 },
           maxes: {} };
}
// [Epic I2] The onboarding step pipeline for the draft's track, from the
// track contract. Before a track is picked only the shared head of the flow
// (welcome -> goal) is reachable, so the fallback tail is never rendered; it
// exists so a step id always resolves (defensive renders, tests).
const OB_FALLBACK_STEPS = ['welcome', 'goal', 'days', 'experience', 'time', 'maxes'];
function obStepList(ob) {
  const spec = ob && TRACK_SPEC[ob.track];
  return (spec && spec.obSteps) || OB_FALLBACK_STEPS;
}
function obStepId(ob) {
  const list = obStepList(ob);
  return list[Math.min(V.obStep, list.length - 1)];
}
// [Epic I1] Intake issues for the current draft against its track contract,
// optionally filtered to one field. Engine.validateIntake is pure; the app
// supplies the spec and the clock and translates the returned keys at render.
function obIntakeIssues(ob, field) {
  // [Epic I5] Before a track is picked only the shared head of the flow is
  // reachable; the fallback spec carries the track-independent rules
  // (bodyweight) so the welcome gate works on step 0 too.
  const spec = TRACK_SPEC[ob.track] || { obSteps: OB_FALLBACK_STEPS, intake: {} };
  const all = Engine.validateIntake(ob, spec, Date.now()).map(i => {
    // [Epic I5] Weight-typed params come back in kg (storage canon); show
    // them in the athlete's unit, and name the lift where one is flagged.
    if (!i.params || !i.params.wKg) return i;
    const p = Object.assign({}, i.params, {
      lo: dispW(i.params.lo), hi: dispW(i.params.hi), u: wUnit() });
    if (p.lift) p.name = exName(p.lift);
    return Object.assign({}, i, { params: p });
  });
  return field ? all.filter(i => i.field === field) : all;
}
function obIssueBanners(issues) {
  return issues.map(i => `<div class="banner-warn mt8">${esc(t(i.key, i.params))}</div>`).join('');
}
// Warning copy for any slider at the extremes (0 = removed, 6 = maxed).
// [Epic I5] All zeros is not a warning, it is a blocked program (nothing to
// train); the master coach's error renders instead and Continue refuses.
function obFocusWarning(focus) {
  if (Engine.coach.checkFocus(focus)) {
    return `<div class="banner-warn mt8">${esc(t('val.focus_all_zero'))}</div>`;
  }
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
  const id = obStepId(ob);
  let body = '';

  if (id === 'welcome') {
    body = `
      <div class="ob-title">${esc(t('ob.welcome'))}<br>IRON<span style="color:var(--blue)">WAVE</span></div>
      <p class="subtle">${esc(t('ob.welcome_sub'))}</p>
      <div class="field"><label>${esc(t('settings.language'))}</label>
        <select id="ob-lang" onchange="obLang(this.value)">
          ${Object.values(I18N.catalogs).map(c =>
            `<option value="${c.code}" ${I18N.lang === c.code ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select></div>
      <div class="field"><label>${esc(t('ob.units'))}</label>
        <div class="seg">
          <button class="${!isLb() ? 'on' : ''}" onclick="obUnits('kg')">${esc(t('unit.kg'))}</button>
          <button class="${isLb() ? 'on' : ''}" onclick="obUnits('lb')">${esc(t('unit.lb'))}</button>
        </div></div>
      <div class="field"><label>${esc(t('ob.your_name'))}</label>
        <input id="ob-name" value="${esc(ob.name)}" placeholder="${esc(t('ob.name_ph'))}"></div>
      <div class="field"><label>${esc(t('ob.bodyweight', { u: wUnit() }))}</label>
        <input id="ob-bw" type="number" inputmode="decimal" value="${esc(ob.bodyweight)}" placeholder="${isLb() ? 220 : 100}"></div>
      <button class="btn btn-green mt16" onclick="obNext(${step})">${esc(t('ob.continue'))}</button>`;
  } else if (id === 'days') {
    // [Calendar days] Two modes, Fitbod-style: 'Specific days' (default; a
    // vertical weekday list, square selectors, whole row is the tap target, a
    // selected row progressively discloses the competitive-sport pill) and
    // 'Days per week' (the plain 1..7 count row for athletes who prefer a
    // floating week; a count-mode program carries no weekday schedule).
    const calMode = ob.daysMode !== 'count';
    const tds = Array.isArray(ob.trainingDays) ? ob.trainingDays : [];
    const sds = Array.isArray(ob.sportDays) ? ob.sportDays : [];
    const picker = calMode ? `
      <div class="wd-list mt16">
        ${[0,1,2,3,4,5,6].map(wd => {
          const on = tds.includes(wd), sport = sds.includes(wd);
          return `<div class="wd-row ${on ? 'on' : ''}" role="checkbox" aria-checked="${on}" onclick="obToggleDay(${wd})">
            <span class="wd-box">${on ? '✓' : ''}</span>
            <span class="wd-name">${esc(t('wd.' + wd))}</span>
            ${on ? `<button class="wd-pill ${sport ? 'on' : ''}" aria-pressed="${sport}"
              onclick="obToggleSport(event, ${wd})">${sport ? '⚑ ' : ''}${esc(t('ob.sport_pill'))}</button>` : ''}
          </div>`;
        }).join('')}
      </div>
      ${sds.length ? '' : `<p class="faint mt8">${esc(t('ob.sport_hint'))}</p>`}` : `
      <div class="seg mt16">
        ${[1,2,3,4,5,6,7].map(n => `<button class="${ob.daysPerWeek===n?'on':''}" onclick="obDays(${n})">${n}</button>`).join('')}
      </div>`;
    body = `
      <div class="ob-title">${esc(t('ob.days_title'))}</div>
      <p class="subtle">${esc(t(calMode ? 'ob.days_sub' : 'ob.days_sub_count'))}</p>
      <div class="seg seg-sm mt16">
        <button class="${calMode ? 'on' : ''}" onclick="obDaysMode('calendar')">${esc(t('ob.mode_calendar'))}</button>
        <button class="${calMode ? '' : 'on'}" onclick="obDaysMode('count')">${esc(t('ob.mode_count'))}</button>
      </div>
      ${picker}
      ${ob.daysPerWeek === 2 ? `<p class="faint mt8">${esc(t('ob.two_day_note'))}</p>` : ''}
      <button class="btn btn-green mt24" onclick="obNext(${step})" ${ob.daysPerWeek ? '' : 'disabled'}>${esc(t('ob.continue'))}</button>`;
  } else if (id === 'goal') {
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
      <button class="btn btn-green mt16" onclick="obNext(${step})" ${goalReady ? '' : 'disabled'}>${esc(t('ob.continue'))}</button>`;
  } else if (id === 'meet') {
    // [Epic I2] The meet question, explicit and gated (it used to hide under
    // Advanced on the goal step, where a powerlifter could finish onboarding
    // without ever seeing it). An answer is required: no meet, or a date the
    // validator accepts. A too-soon date blocks here with the reason instead
    // of being silently dropped by makeProgram downstream.
    const meetIssues = ob.meetChoice === 'date'
      ? obIntakeIssues(ob, 'meet').filter(i => i.key !== 'val.meet_choice') : [];
    const meetReady = ob.meetChoice === 'none'
      || (ob.meetChoice === 'date' && ob.meetDate && !meetIssues.length);
    body = `
      <div class="ob-title">${esc(t('ob.meet_title'))}</div>
      <p class="subtle">${esc(t('ob.meet_sub'))}</p>
      <button class="pick-card ${ob.meetChoice==='none'?'on':''}" onclick="obMeetChoice('none')">
        <b>${esc(t('ob.meet_none'))}</b><span class="faint">${esc(t('ob.meet_none_desc'))}</span></button>
      <button class="pick-card ${ob.meetChoice==='date'?'on':''}" onclick="obMeetChoice('date')">
        <b>${esc(t('ob.meet_have'))}</b><span class="faint">${esc(t('ob.meet_have_desc'))}</span></button>
      ${ob.meetChoice === 'date' ? `
        <div class="field mt16"><label>${esc(t('ob.meet_title'))}</label>
          <input type="date" id="ob-meet" value="${esc(ob.meetDate || '')}" onchange="obMeet(this.value)"></div>
        ${obIssueBanners(meetIssues)}
        ${ob.meetDate && !meetIssues.length ? `<div class="focus-time">${esc(obMeetLine(ob))}</div>` : ''}` : ''}
      <button class="btn btn-green mt16" onclick="obNext(${step})" ${meetReady ? '' : 'disabled'}>${esc(t('ob.continue'))}</button>`;
  } else if (id === 'experience') {
    body = `
      <div class="ob-title">${esc(t('ob.exp_title'))}</div>
      <p class="subtle">${esc(t('ob.exp_sub'))}</p>
      ${OB_EXP.map(x => `
        <button class="pick-card ${ob.experience===x?'on':''}" onclick="obExp('${x}')">
          <b>${esc(t('exp.' + x))}</b><span class="faint">${esc(t('exp.' + x + '_desc'))}</span></button>`).join('')}
      <button class="btn btn-green mt16" onclick="obNext(${step})" ${ob.experience ? '' : 'disabled'}>${esc(t('ob.continue'))}</button>`;
  } else if (id === 'time') {
    // [Epic I1] A custom cap is validated against the track's floor live (a
    // 10 minute powerlifting session is refused, not accepted), and the
    // session estimate renders here for every track, so the athlete sees
    // what their cap means before committing.
    const timeIssues = ob.timeMode === 'custom'
      ? obIntakeIssues(ob, 'time').filter(i => i.key !== 'val.time_required') : [];
    body = `
      <div class="ob-title">${esc(t('ob.time_title'))}</div>
      <p class="subtle">${esc(t('ob.time_sub'))}</p>
      <div class="seg mt16">
        <button class="${ob.timeMode==='unlimited'?'on':''}" onclick="obTimeMode('unlimited')">${esc(t('ob.time_unlimited'))}</button>
        <button class="${ob.timeMode==='custom'?'on':''}" onclick="obTimeMode('custom')">${esc(t('ob.time_custom'))}</button>
      </div>
      ${ob.timeMode==='custom' ? `<div class="field mt16"><label>${esc(t('ob.time_minutes'))}</label>
        <input id="ob-time" type="number" inputmode="numeric" value="${esc(ob.timeCapMin)}" placeholder="60" oninput="obTimeInput(this.value)"></div>
        <div id="ob-time-val">${obIssueBanners(timeIssues)}</div>
        <div id="ob-time-est" class="focus-time">${esc(focusTimeLine(ob))}</div>` : ''}
      <button class="btn btn-green mt24" onclick="obNext(${step})" ${ob.timeMode ? '' : 'disabled'}>${esc(t('ob.continue'))}</button>`;
  } else if (id === 'focus') {
    body = `
      <div class="ob-title">${esc(t('ob.focus_title'))}</div>
      ${FOCUS_KEYS.map(k => `
        <div class="focus-row">
          <div class="row"><span>${esc(t('muscle.' + k))}</span><b id="mf-val-${k}">${ob.muscleFocus[k]}</b></div>
          <input type="range" min="0" max="6" step="1" value="${ob.muscleFocus[k]}" oninput="obSlider('${k}', this.value)">
        </div>`).join('')}
      <div id="mf-warn">${obFocusWarning(ob.muscleFocus)}</div>
      <div id="mf-time" class="focus-time">${esc(focusTimeLine(ob))}</div>
      <button class="btn btn-green mt16" onclick="obNext(${step})">${esc(t('ob.continue'))}</button>`;
  } else if (id === 'maxes') {
    const lifts = obMainLifts(ob.track);
    body = `
      <div class="ob-title">${esc(t('ob.maxes_title'))}</div>
      <p class="subtle">${esc(t('ob.maxes_sub'))}</p>
      ${lifts.map(([id]) => `
        <div class="field"><label>${esc(t('ob.rm_label', { name: exName(id), u: wUnit() }))}</label>
          <input id="ob-max-${id}" type="number" inputmode="decimal"
            value="${ob.maxes[id] != null ? dispW(ob.maxes[id]) : ''}" placeholder="${esc(t('ob.calib_ph'))}"></div>`).join('')}
      <button class="btn btn-green mt16" onclick="obNext(${step})">${esc(t('ob.create'))}</button>`;
  }
  return `${topbar()}<div class="view">${body}</div>`;
}
// Explicit language pick on the first onboarding screen (owner call: no more
// auto-detect, English is the default). Applies immediately so the rest of
// onboarding reads in the chosen language; anything already typed is kept.
function obLang(v) {
  if (V.ob) {
    const n = byId('ob-name'), b = byId('ob-bw');
    if (n) V.ob.name = n.value.trim();
    if (b) V.ob.bodyweight = b.value;
  }
  S.profile.lang = v;
  I18N.setLang(v);
  save(); render();
}
// [Epic H1] Explicit unit pick next to the language, same pattern: applies
// immediately (equipment defaults follow via applyUnits) so every later step's
// weights read in the athlete's unit. A number already typed keeps its digits
// and now means the new unit; it is on screen right next to the toggle.
function obUnits(u) {
  if (V.ob) {
    const n = byId('ob-name'), b = byId('ob-bw');
    if (n) V.ob.name = n.value.trim();
    if (b) V.ob.bodyweight = b.value;
  }
  applyUnits(u);
  save(); render();
}
// [Calendar days] Count mode: pick a plain number of days (the floating week).
function obDays(n) { V.ob.daysPerWeek = n; render(); }
// [Calendar days] Switch between 'calendar' (specific days) and 'count' modes.
// Each mode keeps its own selection: entering calendar re-derives the count from
// the picked weekdays; entering count seeds from whatever count is already set
// (which IS the derived count when coming from calendar), so nothing is lost by
// flipping back and forth.
function obDaysMode(mode) {
  const ob = V.ob;
  if (ob.daysMode === mode) return;
  ob.daysMode = mode;
  if (mode === 'calendar') ob.daysPerWeek = (ob.trainingDays || []).length || null;
  render();
}
// [Calendar days] Toggle a weekday on/off. The day count stays a derived value
// (trainingDays.length, null when empty) so the continue gate, the templates,
// and the generator all keep reading ob.daysPerWeek exactly as before.
function obToggleDay(wd) {
  const ob = V.ob;
  if (!Array.isArray(ob.trainingDays)) ob.trainingDays = [];
  if (!Array.isArray(ob.sportDays)) ob.sportDays = [];
  const i = ob.trainingDays.indexOf(wd);
  if (i >= 0) {
    ob.trainingDays.splice(i, 1);
    ob.sportDays = ob.sportDays.filter(d => d !== wd); // a deselected day loses its flag
  } else {
    ob.trainingDays.push(wd);
    ob.trainingDays.sort((a, b) => a - b);
  }
  ob.daysPerWeek = ob.trainingDays.length || null;
  render();
}
// [Calendar days] Toggle the competitive-sport flag on a selected day. Stops the
// click from bubbling to the row so flagging never deselects the day.
function obToggleSport(ev, wd) {
  if (ev && ev.stopPropagation) ev.stopPropagation();
  const ob = V.ob;
  if (!Array.isArray(ob.sportDays)) ob.sportDays = [];
  const i = ob.sportDays.indexOf(wd);
  if (i >= 0) ob.sportDays.splice(i, 1); else ob.sportDays.push(wd);
  render();
}
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
// [Epic H6] Meet date (strength tracks): backward planning replaces the length
// presets; a set date wins over macroWeeks in makeProgram.
function obMeet(v) {
  V.ob.meetDate = v || null;
  if (v) V.ob.macroWeeks = null;
  render();
}
// [Epic I2] The explicit meet answer. 'none' keeps the standard length;
// 'date' discloses the date field (validated by Engine.validateIntake).
function obMeetChoice(c) {
  V.ob.meetChoice = c;
  if (c === 'none') V.ob.meetDate = null;
  render();
}
// One-line summary of the plan a valid meet date builds. Validation (too
// soon, too far) lives in Engine.validateIntake [Epic I1], not here.
function obMeetLine(ob) {
  const ts = Date.parse(ob.meetDate);
  if (!(ts > 0)) return '';
  const tpl = PROGRAM_TEMPLATES[ob.track] || PROGRAM_TEMPLATES.powerbuilding;
  // [Epic I5] Preview the same plan the master coach will build, so the
  // summary line and makeProgram can never disagree.
  const days = Math.floor((ts - Date.now()) / 864e5);
  const plan = Engine.coach.meetBlockPlan(days, tpl.blocks, tpl.weeksPerBlock);
  const weeks = plan.reduce((a, b) => a + (b.weeks || tpl.weeksPerBlock), 0)
    + Engine.coach.bounds.meetTaperWeeks;
  return t('ob.meet_line', { blocks: plan.length, weeks });
}
function obExp(id) { V.ob.experience = id; render(); }
function obTimeMode(mode) { V.ob.timeMode = mode; render(); }
// Store the cap as typed without a full re-render (which would blur the
// number input mid-entry); refresh the inline floor warning and session
// estimate imperatively [Epic I1], same pattern as the focus sliders.
function obTimeInput(v) {
  V.ob.timeCapMin = v === '' ? '' : (parseInt(v) || '');
  const val = byId('ob-time-val');
  if (val) val.innerHTML = obIssueBanners(
    obIntakeIssues(V.ob, 'time').filter(i => i.key !== 'val.time_required'));
  const est = byId('ob-time-est');
  if (est) est.textContent = focusTimeLine(V.ob);
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
  if (step !== V.obStep) return; // a stale button never advances another step
  const id = obStepList(ob)[step];
  // Belt and braces with the disabled Continue buttons: nothing advances past a
  // choice step without an explicit pick (owner call: no silent defaults), and
  // [Epic I1] no step advances past an intake error. The step order itself is
  // the track contract's obSteps list; there is no skip arithmetic here.
  if (id === 'welcome') {
    const nameEl = document.getElementById('ob-name');
    if (nameEl) ob.name = nameEl.value.trim();
    // [Epic I5] Bodyweight is required and bounded (master coach: 25-300 kg).
    // A typed value is kept even when absurd so the range error can name it;
    // an empty input leaves the draft's value standing (harness runs and the
    // athlete stepping back through a finished welcome).
    const bwEl = document.getElementById('ob-bw');
    if (bwEl && bwEl.value !== '') {
      const typed = fromDispW(parseFloat(bwEl.value));
      ob.bodyweight = Number.isFinite(typed) ? typed : null;
    } else if (ob.bodyweight === '') {
      ob.bodyweight = null;
    }
    const issues = obIntakeIssues(ob, 'welcome');
    if (issues.length) { toast(t(issues[0].key, issues[0].params), true); return; }
  } else if (id === 'goal') {
    if (!ob.track) { toast(t('ob.pick_goal'), true); return; }
    if (ob.track === 'bodybuilding' && !ob.goalArchetype) { toast(t('ob.pick_bb_goal'), true); return; }
  } else if (id === 'days') {
    if (!ob.daysPerWeek) { toast(t('ob.pick_days'), true); return; }
  } else if (id === 'meet') {
    const issues = obIntakeIssues(ob, 'meet');
    if (issues.length) { toast(t(issues[0].key, issues[0].params), true); return; }
  } else if (id === 'experience') {
    if (!ob.experience) { toast(t('ob.pick_exp'), true); return; }
  } else if (id === 'time') {
    if (!ob.timeMode) { toast(t('ob.pick_time'), true); return; }
    if (ob.timeMode === 'custom') {
      // Re-read the input as belt and braces; obTimeInput already synced the
      // draft on every keystroke, which also covers DOM-less harness runs.
      const el = document.getElementById('ob-time');
      const typed = el ? parseInt(el.value) : NaN;
      ob.timeCapMin = typed > 0 ? typed : (parseInt(ob.timeCapMin) || '');
      const issues = obIntakeIssues(ob, 'time');
      if (issues.length) { toast(t(issues[0].key, issues[0].params), true); return; }
    }
  } else if (id === 'focus') {
    // [Epic I5] All sliders at zero is a program with nothing in it: the
    // master coach blocks it here instead of building a 0-exercise week.
    const issues = obIntakeIssues(ob, 'focus');
    if (issues.length) { toast(t(issues[0].key, issues[0].params), true); return; }
  } else if (id === 'maxes') {
    try {
      for (const [id] of obMainLifts(ob.track)) {
        const el = document.getElementById('ob-max-' + id);
        // An empty input leaves the draft's value standing (harness runs);
        // a typed value is kept as typed so the coach can refuse it below.
        if (!el || el.value === '') continue;
        const v = fromDispW(parseFloat(el.value));
        ob.maxes[id] = Number.isFinite(v) ? v : NaN; // NaN: unreadable, refused
      }
      // [Epic I5] The last gate before the program is built: any implausible
      // 1RM (master coach bounds) or an issue that slipped an earlier step
      // blocks creation with the reason.
      const issues = obIntakeIssues(ob);
      if (issues.length) { toast(t(issues[0].key, issues[0].params), true); return; }
      S.profile.name = ob.name;
      S.profile.bodyweight = ob.bodyweight;
      S.profile.experience = ob.experience;
      S.profile.training = {
        track: ob.track,
        goalArchetype: ob.track === 'bodybuilding' ? (ob.goalArchetype || null) : null,
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
        toast(t('ob.created', { weeks: totalProgramWeeks() }));
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
  V.obStep = step + 1;
  render();
}

// ------------------------------------------------------------
// VIEW: DASHBOARD
// ------------------------------------------------------------
const BLOCK_COLORS = { hypertrophy: '#5aa2f7', strength: '#e8883a', peaking: '#e2483d', bridge: '#2d9d8f' };

// Readiness stays computed and keeps affecting prescriptions (check-ins, skip
// penalties, autoregulation, early deload); only its verbose score/trend UI is
// hidden (docs/hidden-ui.md). Flip to true to restore every surface.
const SHOW_READINESS_UI = false;
// [Epic H2] The lighter cut of that hero: one chip, score colored and arrowed
// against the athlete's own 28-day baseline. No prose; tap opens the volume
// screen where the recovery trend chart lives. Empty until a first check-in,
// so a fresh install shows nothing.
function readinessChipHTML() {
  if (!(S.readinessLog || []).length) return '';
  const score = computeReadiness();
  const ctx = readinessContext();
  const dir = !ctx.hasBaseline ? 0 : score >= ctx.baseAvg * 1.02 ? 1 : score <= ctx.baseAvg * 0.95 ? -1 : 0;
  return `<button class="readiness-chip${dir > 0 ? ' up' : dir < 0 ? ' down' : ''}" onclick="openVolumeDashboard()">
    ⚡ ${esc(t('dash.readiness'))} <b>${score.toFixed(1)}</b>${dir > 0 ? ' ▲' : dir < 0 ? ' ▼' : ''}</button>`;
}

function sparklineHTML() {
  const log = S.readinessLog.slice(-30);
  if (log.length < 2) return `<div class="faint">${esc(t('dash.readiness_empty'))}</div>`;
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
  if (!points || !points.length) return `<p class="faint">${esc(t('chart.empty'))}</p>`;
  if (points.length === 1) return `<p class="faint">${esc(t('chart.one', { v: fmt(points[0].value) }))}</p>`;
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
// [Epic H3] Weekly-sets line drawn inside the landmark band of the time.
// points: [{value, lo, hi}] per program week (lo/hi = MEV/MRV then in force).
function bandChartHTML(points, color, fmt) {
  if (!points || points.length < 2) return trendChartHTML(points, color, fmt);
  const W = 300, H = 84, pad = 8;
  const vals = points.flatMap(p => [p.value, p.lo, p.hi]).filter(v => v != null);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = i => pad + i * (W - 2 * pad) / (points.length - 1);
  const y = v => H - pad - ((v - lo) / span) * (H - 2 * pad);
  const banded = points.every(p => p.lo != null && p.hi != null);
  const band = banded
    ? `<path d="M ${points.map((p, i) => `${x(i).toFixed(1)} ${y(p.hi).toFixed(1)}`).join(' L ')}
        L ${points.map((p, i) => `${x(i).toFixed(1)} ${y(p.lo).toFixed(1)}`).reverse().join(' L ')} Z"
        fill="${color}" opacity="0.13"/>` : '';
  const pts = points.map((p, i) => [x(i), y(p.value)]);
  return `<svg class="spark-line" style="height:84px" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${band}
      <polyline points="${pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')}"
        fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      ${pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.4" fill="${color}"/>`).join('')}
    </svg>
    <div class="row faint" style="margin:-2px 0 4px"><span>${fmt(points[0].value)}</span>
      <span>${fmt(points[points.length - 1].value)}</span></div>`;
}
// [Epic H3] Several [{ts, value}] series on one time axis (the big-lift e1RM
// overlay). Shared x (time) and y (value) scales; a legend chip per series.
function overlayChartHTML(seriesList, fmt) {
  const live = (seriesList || []).filter(s => s.points.length >= 2);
  if (!live.length) return `<p class="faint">${esc(t('chart.empty'))}</p>`;
  const W = 300, H = 90, pad = 8;
  const allPts = live.flatMap(s => s.points);
  const t0 = Math.min(...allPts.map(p => p.ts)), t1 = Math.max(...allPts.map(p => p.ts));
  const lo = Math.min(...allPts.map(p => p.value)), hi = Math.max(...allPts.map(p => p.value));
  const spanT = t1 - t0 || 1, spanV = hi - lo || 1;
  const x = ts => pad + (ts - t0) / spanT * (W - 2 * pad);
  const y = v => H - pad - ((v - lo) / spanV) * (H - 2 * pad);
  const lines = live.map(s => `<polyline points="${s.points.map(p =>
      `${x(p.ts).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')}"
      fill="none" stroke="${s.color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  const legend = live.map(s => `<span class="ovl-key"><i style="background:${s.color}"></i>${esc(s.name)}
      <b>${fmt(s.points[s.points.length - 1].value)}</b></span>`).join('');
  return `<svg class="spark-line" style="height:90px" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${lines}</svg>
    <div class="ovl-legend">${legend}</div>`;
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
  if (ed && ed.week === w && block === blockOf(ed.block)) return t('week.deload_early');
  // Translated per-scheme week labels ('week.hyp_0'.. / 'week.jm2_0'..); the
  // engine's own weekLabel/weekTypeLabel strings stay as the untranslated source.
  if (blockScheme(block) === 'jm2-peak') return w <= 1 ? t(`week.peak_${w}`) : '';
  if (w >= 0 && w <= 4) return t(`week.${blockScheme(block) === 'jbb-hyp' ? 'hyp' : 'jm2'}_${w}`);
  return '';
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
  p.blocks.forEach(b => { for (let w = 0; w < blockWeeks(b); w++) maxV = Math.max(maxV, weekVolume(b, w)); });
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
      for (let w = 0; w < blockWeeks(b); w++) bars.push(bar(b, bi, w));
      bi++;
    } while (bi < p.blocks.length && blockPhase(p.blocks[bi]) === phase);
    const pc = PHASE_COLORS[phase] || 'var(--blue)';
    // flex-grow tracks the week count so bars stay equal width across phases of
    // different lengths; the whole row shrinks to fit (no scroll until very long).
    out.push(`<div class="tl-block" style="--phase:${pc};flex-grow:${bars.length}">
      <span class="tl-phase">${esc(phaseLabel(phase))}</span>
      <div class="tl-bars">${bars.join('')}</div>
    </div>`);
  }
  const groups = out.join('');
  const leg = [];
  if (emphases.hypertrophy) leg.push(`<span><i style="background:${BLOCK_COLORS.hypertrophy}"></i>${esc(t('timeline.hypertrophy'))}</span>`);
  if (emphases.strength) leg.push(`<span><i style="background:${BLOCK_COLORS.strength}"></i>${esc(t('timeline.strength'))}</span>`);
  if (emphases.cut) leg.push(`<span><i style="background:${BLOCK_COLORS.bridge}"></i>${esc(t('timeline.cut'))}</span>`);
  if (emphases.peak) leg.push(`<span><i style="background:${BLOCK_COLORS.peaking}"></i>${esc(t('timeline.peak'))}</span>`);
  // [Epic G4] A "+" tile opens the block-plan editor (customize the macrocycle).
  // Editable surface only (My Program); the dashboard shows the plan, not edits it.
  const add = editable ? `<button class="tl-add" onclick="openPlanEditor()" aria-label="${esc(t('plan.title'))}">+</button>` : '';
  return `<div class="timeline-v2">${groups}${add}</div>
    <div class="legend">${leg.join('')}</div>`;
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
          <span class="subtle">${esc(t('preview.select_cat', { cat: mvLabel(rs.cat) }))}</span><span class="faint">—</span></div>`;
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
          right = `<span class="subtle calib-tag">${esc(t('calib.waiting'))} <button class="info-dot" onclick="event.stopPropagation();openCalibrationInfo()" aria-label="${esc(t('calib.what_aria'))}">ⓘ</button></span>`;
        } else {
          const scheme = f ? `${(work.length || rs.sets.length)}×${f.reps}${f.weight != null ? ' @ ' + dispW(f.weight) + wUnit() : (f.rpe ? ' @ ' + fmtRir(f.rpe) : '')}` : '';
          right = `<span class="subtle">${scheme}</span>`;
        }
        return `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)">
          <span>${esc(rs.name)}${am ? ' <b style="color:var(--red)">AMRAP</b>' : ''}</span>
          ${right}</div>`;
      }).join('');
      return `<div class="card"><b>${esc(t('common.day_n', { n: di + 1 }))}</b>${dayTheme(d) ? ` <span class="faint">${esc(dayTheme(d))}</span>` : ''}${rows}</div>`;
    }).join('');
    const bbTrack = (p.trainingConfig && p.trainingConfig.track) === 'bodybuilding';
    const tech = scheduledTechForBlock(b, wi, bbTrack);
    const techNote = tech
      ? `<p class="tl-finisher">${TECH_MARK[tech] || ''} ${esc(t('timeline.finisher_week', { tech: TECHNIQUE_LABELS[tech] ? t('tech.' + tech) : tech }))}</p>`
      : '';
    $modal.innerHTML = modalShell(anim, `${esc(blockDisplayLabel(b))} · ${esc(t('common.week_n', { n: weeksBefore(bi) + wi + 1 }))}`,
      `<p class="subtle" style="margin-bottom:10px">${weekLabelFor(b, wi)} · ${esc(t('preview.projected'))}</p>${techNote}${days}`);
  });
}

// ------------------------------------------------------------
// [Epic G4] Block plan editor: customize the macrocycle's future blocks.
// Already-trained blocks are locked (history is preserved); the athlete edits,
// reorders, adds and removes the blocks from the current one onward. Saving
// re-stamps mesoIdx/phase/labels and recomputes the test date.
// ------------------------------------------------------------
// Labels live in the catalogs ('plan.type_<id>'); the table keeps ids + schemes.
const PLAN_TYPES = [['hypertrophy', 'jbb-hyp'], ['strength', 'jm2-wave']];
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
      <span class="plan-name">${esc(blockDisplayLabel(b))}</span>
      <span class="faint">${esc(phaseLabel(blockPhase(b)))} · ${esc(t('plan.trained'))}</span></div>`).join('');
  const draft = V.planDraft;
  const rows = draft.map((b, i) => {
    const waves = PLAN_WAVES[blockScheme(b)] || ['8s'];
    return `<div class="plan-row">
      <div class="plan-main">
        <select onchange="planSetType(${i}, this.value)">
          ${PLAN_TYPES.map(([ty]) => `<option value="${ty}" ${b.type === ty ? 'selected' : ''}>${esc(t('plan.type_' + ty))}</option>`).join('')}
        </select>
        <select onchange="planSetWave(${i}, this.value)">
          ${waves.map(w => `<option value="${w}" ${b.wave === w ? 'selected' : ''}>${esc(t('common.wave', { w }))}</option>`).join('')}
        </select>
        <select onchange="planSetPhase(${i}, this.value)">
          ${PHASES.map(ph => `<option value="${ph}" ${blockPhase(b) === ph ? 'selected' : ''}>${esc(phaseLabel(ph))}</option>`).join('')}
        </select>
      </div>
      <div class="plan-ops">
        <button onclick="planMove(${i},-1)" ${i === 0 ? 'disabled' : ''} aria-label="${esc(t('a11y.move_up'))}">↑</button>
        <button onclick="planMove(${i},1)" ${i === draft.length - 1 ? 'disabled' : ''} aria-label="${esc(t('a11y.move_down'))}">↓</button>
        <button onclick="planRemove(${i})" ${draft.length + locked <= 1 ? 'disabled' : ''} aria-label="${esc(t('common.remove'))}" class="plan-del">✕</button>
      </div>
    </div>`;
  }).join('');
  const weeks = p.blocks.slice(0, locked).concat(draft).reduce((a, b) => a + blockWeeks(b), 0);
  const body = `
    <p class="subtle">${esc(t('plan.intro'))}</p>
    ${lockedRows}
    ${rows}
    <button class="btn btn-outline mt8" onclick="planAdd()">${esc(t('plan.add_block'))}</button>
    <div class="focus-time mt8">${esc(t('plan.total_line', { blocks: locked + draft.length, weeks }))}</div>
    <div class="row mt16" style="gap:10px">
      <button class="btn btn-outline" style="flex:1" onclick="closeAllModals()">${esc(t('confirm.cancel'))}</button>
      <button class="btn btn-green" style="flex:1" onclick="planSave()" ${draft.length ? '' : 'disabled'}>${esc(t('plan.save'))}</button>
    </div>`;
  $modal.innerHTML = modalShell(anim, t('plan.title'), body);
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
  save(); closeAllModals(); toast(t('plan.updated_toast', { weeks: blocks.reduce((a, b) => a + blockWeeks(b), 0) })); render();
}

// Explainer for the "Waiting for calibration" state. Stacks over the preview,
// closes back to it. Plain language for the athlete, no jargon dumps.
function openCalibrationInfo() {
  showModal(anim => {
    $modal.innerHTML = modalShell(anim, t('calib.waiting'), `
      <div class="card">
        <p>${esc(t('calib.info_p1'))}</p>
        <p class="mt16"><b>${esc(t('calib.info_what_title'))}</b> ${esc(t('calib.info_what'))}</p>
        <p class="mt16"><b>${esc(t('calib.info_how_title'))}</b> ${esc(t('calib.info_how'))}</p>
        <p class="mt16"><b>${esc(t('calib.info_next_title'))}</b> ${esc(t('calib.info_next'))}</p>
        <p class="mt16 faint">${esc(t('calib.info_tip'))}</p>
      </div>
      <button class="btn btn-blue" onclick="closeModal()">${esc(t('common.got_it'))}</button>`);
  });
}
function vDashboard() {
  if (!P()) return vOnboarding();
  const p = P();
  const done = programDone();
  let weekSection = '';
  if (done) {
    weekSection = `<div class="card accent">
      <h3 style="font-size:1.3rem;margin-bottom:6px">${esc(t('dash.done_title'))}</h3>
      <p class="subtle">${esc(t('dash.done_body'))}</p>
      <button class="btn btn-blue mt16" onclick="confirmNewProgram()">${esc(t('dash.plan_next'))}</button>
    </div>`;
  } else {
    const block = curBlock();
    const w = weekIdx();
    const dayRows = p.days.map((d, i) => {
      const k = dayKey(p.pointer.block, w, i);
      const st = p.completedDays[k];
      const cls = st ? 'done' : '';
      const mark = st === 'skipped' ? '⤼' : st ? '✓' : '○';
      // [Calendar days] A scheduled program names its days by weekday (with a
      // flag on competitive-sport days); an unscheduled one keeps 'Day n'.
      const sch = Array.isArray(p.schedule) ? p.schedule[i] : null;
      const dayLabel = sch && sch.wd != null
        ? `${t('wd.s' + sch.wd)}${sch.sport ? ' ⚑' : ''}`
        : t('common.day_n', { n: i + 1 });
      return `<button class="day-row ${cls}" onclick="openDay(${i})">
        <span class="mark">${mark}</span> <span>${esc(dayLabel)}${dayTheme(d) ? ` <span class="faint">${esc(dayTheme(d))}</span>` : ''}</span> <span class="chev">›</span></button>`;
    }).join('');
    const allDone = p.days.every((d, i) => p.completedDays[dayKey(p.pointer.block, w, i)]);
    weekSection = `
      <div class="mt16">
        <div style="font-size:1.7rem;font-weight:800">${esc(t('common.week_n', { n: globalWeekNum() }))}</div>
        <div class="subtle">${weekLabelFor(block, w)}</div>
      </div>
      ${earlyDeloadBannerHTML()}
      ${dayRows}
      <button class="btn ${allDone ? 'btn-blue' : 'btn-outline'} mt16" onclick="completeWeek(${allDone})">${esc(t('week.complete'))}</button>`;
  }
  return `${topbar()}
  <div class="view">
    ${hasCoach() ? '' : `<div class="banner-warn">${esc(t('tier.free_banner'))}</div>`}
    ${SHOW_READINESS_UI ? `<div class="readiness-hero">
      <div class="row">
        <span class="label">${esc(t('dash.readiness'))} <span class="faint">ⓘ 0–30</span></span>
        <span class="score-sm">${computeReadiness().toFixed(2)}</span>
      </div>
      ${sparklineHTML()}
    </div>` : readinessChipHTML()}
    <div class="section-title mt24">${esc(t('dash.my_program'))}</div>
    <div style="font-size:2rem;font-weight:800">${esc(t('dash.days_out', { n: daysOut() }))}</div>
    <div class="subtle">${fmtDateLong(p.testDate)}</div>
    ${timelineHTML({ editable: false })}
    ${weekSection}
    ${!done && blockScheme(curBlock()) === 'jm2-peak' ? `<button class="btn btn-outline mt16" onclick="nav('meet')">🏆 ${esc(t('meet.title'))}</button>` : ''}
    ${done ? '' : `<button class="btn btn-outline mt16" onclick="openVolumeDashboard()">${esc(t('dash.weekly_volume_btn'))}</button>`}
    ${(done || (p.trainingConfig && p.trainingConfig.track === 'bodybuilding')) ? '' : `<button class="phase-chip mt8" onclick="openPhase()">${esc(t('dash.phase_chip', { phase: phaseLabel(currentPhase()) }))}</button>`}
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
  // [Epic H2] Muscle-keyed sliders (bodybuilding check-in) win; the broad
  // pattern group stays as the fallback for older check-ins and other tracks.
  const sl = (last && last.sliders) || {};
  const recovery = sl[mv] != null ? sl[mv] : (grp && sl[grp] != null ? sl[grp] : null);
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
        rec = `<div class="vol-rec k-rec-${r.action}">${arrow} ${esc(t('vol.rec_' + (r.reasonKey || 'on_track')))}</div>`;
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
        const txt = `${esc(headLabel(h))} ${kg(hd[h])}`;
        return over ? `<b style="color:var(--amber)">${txt} ⚠</b>` : txt;
      });
      if (parts.length) heads = `<div class="vol-heads faint">${esc(t('vol.regions'))} ${parts.join(' · ')}</div>`;
    }
    // [Cluster D] Per-muscle early deload: a deloaded muscle's bar is textured and
    // offers Resume; an over-MRV muscle offers to deload just that muscle (pull it
    // back for the rest of the block without deloading everything).
    const deloaded = autoreg && isMuscleDeloaded(mv);
    const rowTex = deloadTex || (deloaded ? ' deload-tex' : '');
    let mdCtl = '';
    if (autoreg) {
      if (deloaded) mdCtl = `<span class="vol-md faint">${esc(t('vol.md_on'))} · <button class="link-btn" onclick="toggleMuscleDeload('${mv}')">${esc(t('vol.md_resume'))}</button></span>`;
      else if (st.key === 'over') mdCtl = `<button class="link-btn vol-md" onclick="toggleMuscleDeload('${mv}')">${esc(t('vol.md_deload'))}</button>`;
    }
    return `<div class="vol-row">
      <div class="vol-head"><span>${esc(mvLabel(mv))}</span>
        <span class="vol-status k-${st.key}">${esc(t('vol.status_sets', { status: t('vol.status_' + st.key), n: kg(sets) }))}</span></div>
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
    const down = readinessTrendingDown();
    const ovr = Engine.overreaching(statuses, down);
    if (ovr.overreaching) {
      // Rebuild the engine's reason from its parts so it translates.
      const rk = ovr.over === 1
        ? (down ? 'vol.overreach_one_sliding' : 'vol.overreach_one')
        : (down ? 'vol.overreach_many_sliding' : 'vol.overreach_many');
      overreach = `<div class="card accent" style="border-left:3px solid var(--red)">
        <div style="font-weight:700">${esc(t('vol.overreach_title'))}</div>
        <p class="faint mt8">${esc(t('vol.overreach_body', { reason: t(rk, { n: ovr.over }) }))}</p></div>`;
    }
  }
  // [Cluster D] Recovery / fatigue trend: the readiness series the deload logic
  // already reads. A downward slope means fatigue is outpacing recovery.
  let trend = '';
  if (autoreg) {
    const pts = (S.readinessLog || []).slice(-14).map(r => ({ ts: r.ts, value: r.score }));
    if (pts.length >= 2) {
      trend = `<div class="section-title" style="font-size:1rem">${esc(t('vol.trend_title'))}</div>
        <p class="faint" style="margin:-2px 0 6px">${esc(t('vol.trend_body'))}</p>
        ${trendChartHTML(pts, '#4b8df8', v => v.toFixed(1))}`;
    }
  }
  // [Cluster F] Minicut suggestion when fatigue saturates and we are not already cutting.
  let minicut = '';
  if (autoreg) {
    const sat = Engine.fatigueSaturated(statuses);
    if (sat.saturated && !PHASE_DEFICIT[phase]) {
      minicut = `<div class="card accent" style="border-left:3px solid var(--amber)">
        <div style="font-weight:700">${esc(t('vol.minicut_title'))}</div>
        <p class="faint mt8">${esc(t('vol.minicut_body', { n: sat.over }))}</p>
        <button class="btn btn-outline mt8" onclick="openPhase()">${esc(t('vol.minicut_cta'))}</button></div>`;
    }
  }
  // [Cluster D] On the deload week, show how the deload was sized to the block's
  // accumulated fatigue (autoregulated depth).
  let deloadNote = '';
  if (autoreg && isEarlyDeloadActive()) {
    deloadNote = `<div class="card accent" style="border-left:3px solid var(--amber)">
      <div style="font-weight:700">${esc(t('vol.early_deload_title'))}</div>
      <p class="faint mt8">${esc(t('vol.early_deload_body'))} <button class="link-btn" onclick="cancelEarlyDeload()">${esc(t('deload.resume_block'))}</button></p></div>`;
  } else if (autoreg && Engine.weekType(P().pointer.week) === 'deload' && P().deloadPlan && P().deloadPlan.level !== 'standard') {
    const dp = P().deloadPlan;
    deloadNote = `<div class="card accent" style="border-left:3px solid ${dp.level === 'deep' ? 'var(--amber)' : 'var(--green)'}">
      <div style="font-weight:700">${esc(t(dp.level === 'deep' ? 'vol.deload_deeper' : 'vol.deload_lighter'))}</div>
      <p class="faint mt8">${esc(t(dp.level === 'deep' ? 'vol.deload_deep_body' : 'vol.deload_light_body', { n: dp.over }))}</p></div>`;
  }
  return `<p class="subtle">${esc(t('vol.intro'))}</p>
    ${autoreg ? `<div class="vol-phase faint">${esc(t('vol.phase_word'))} <b>${esc(phaseLabel(phase))}</b>${PHASE_DEFICIT[phase] ? ' · ' + esc(t('vol.deficit_note')) : ''} <button class="link-btn" onclick="openPhase()">${esc(t('vol.change'))}</button></div>` : ''}
    ${overreach}
    ${deloadNote}
    ${minicut}
    ${trend}
    <div class="vol-legend faint">
      <span><i class="dot k-maint"></i>${esc(t('vol.status_maint'))}</span>
      <span><i class="dot k-productive"></i>${esc(t('vol.status_productive'))}</span>
      <span><i class="dot k-over"></i>${esc(t('vol.status_over'))}</span></div>
    ${rows}
    ${autoreg ? `<p class="faint mt16">${esc(t('vol.footer_autoreg'))}</p>`
      : `<p class="faint mt16">${esc(t('vol.footer_landmarks'))}</p>`}`;
}
function openVolumeDashboard() {
  if (!P()) { toast(t('common.start_program_first'), true); return; }
  // [Tier debug] The volume dashboard is the paid tier's control panel.
  showModal(anim => { $modal.innerHTML = modalShell(anim, t('vol.title'),
    hasCoach() ? volumeDashboardHTML() : coachLockHTML()); });
}
// [Cluster F] Current training phase, with a safe default.
function currentPhase() { return (S.profile && S.profile.phase) || 'lean-gain'; }
// [Cluster F] Phase & bodyweight screen: pick a training phase (it tunes the
// autoregulator's recovery read) and log a light bodyweight trend. No calories or
// macros: this is a training-coupled phase tag, not a nutrition tracker.
function bodyweightTrendHTML() {
  const bw = (S.bodyweight || []).filter(x => x.kg > 0).slice(-30);
  if (bw.length < 2) return `<p class="faint">${esc(t('phase.bw_empty'))}</p>`;
  const pts = bw.map(x => ({ ts: x.ts, value: x.kg }));
  return trendChartHTML(pts, '#67a3ff', v => fmtWU(v));
}
function phaseScreenHTML() {
  const cur = currentPhase();
  const last = (S.bodyweight || []).length ? S.bodyweight[S.bodyweight.length - 1].kg : (S.profile.bodyweight || '');
  const phases = ['lean-gain', 'maintenance', 'cut', 'minicut'].map(ph =>
    `<button class="phase-opt ${cur === ph ? 'on' : ''}" onclick="setPhase('${ph}')">
      <b>${esc(phaseLabel(ph))}</b><span class="faint">${esc(t('phase.' + ph + '_desc'))}</span></button>`).join('');
  return `<div class="section-title" style="font-size:1.1rem">${esc(t('phase.section'))}</div>
    <div class="phase-opts">${phases}</div>
    <div class="section-title" style="font-size:1.1rem">${esc(t('phase.bw_section'))}</div>
    <div class="field"><label>${esc(t('phase.bw_label', { u: wUnit() }))}</label>
      <input id="bw-input" type="number" inputmode="decimal" step="0.1" value="${last ? dispW(last) : ''}" placeholder="${esc(t('phase.bw_ph', { n: isLb() ? 180 : 82.5 }))}"></div>
    <button class="btn btn-blue mt8" onclick="logBodyweight()">${esc(t('phase.bw_btn'))}</button>
    <div class="mt16">${bodyweightTrendHTML()}</div>
    <p class="faint mt16">${esc(t('phase.bw_note'))}</p>`;
}
function openPhase() {
  // [Tier debug] Phase drives the autoregulator: coach tier.
  showModal(anim => { $modal.innerHTML = modalShell(anim, t('phase.screen_title'),
    hasCoach() ? phaseScreenHTML() : coachLockHTML()); });
}
function setPhase(ph) {
  if (!PHASES.includes(ph)) return;
  S.profile.phase = ph;
  save(); toast(t('phase.set_toast', { phase: phaseLabel(ph) })); rerenderTop();
}
function logBodyweight() {
  const v = fromDispW(parseFloat(byId('bw-input') && byId('bw-input').value));
  if (!Number.isFinite(v)) { toast(t('phase.bw_enter'), true); return; }
  // [Epic I5] Same master-coach bounds as onboarding: every surface that
  // logs or changes bodyweight refuses an implausible value.
  const bad = Engine.coach.checkBodyweight(v);
  if (bad) {
    toast(t(bad.key, { lo: dispW(bad.params.lo), hi: dispW(bad.params.hi), u: wUnit() }), true);
    return;
  }
  S.bodyweight = S.bodyweight || [];
  S.bodyweight.push({ ts: Date.now(), kg: v });
  S.profile.bodyweight = v;
  save(); toast(t('phase.bw_logged')); rerenderTop();
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
      title: t('week.complete_title'),
      message: t('week.complete_msg'),
      confirmLabel: t('week.complete'),
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
  if (p.pointer.week >= blockWeeks(blockOf(finishedBlock))) endBlock(finishedBlock, bb);
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
  if (dropped.length) toast(t('week.dropped_toast', { list: dropped.join(', ') }));
  if (bb && p.volAdj) for (const mv in p.volAdj) p.volAdj[mv] = 0;
  p.deloadPlan = null;
  p.earlyDeload = null; // spent with the block
  p.muscleDeload = []; // [Cluster D] per-muscle deloads end with the block (resensitize)
  p.pointer.week = 0;
  p.pointer.block++;
  if (p.pointer.block < p.blocks.length) {
    // [Epic H5] Mid-macro focus re-spec lands HERE, at the block boundary: the
    // split regenerates from the edited sliders. Working maxes and landmarks are
    // untouched; volAdj was reset above, so the new split re-ramps from MEV. The
    // fresh generation supersedes the accessory rotation below for this boundary.
    if (bb && p.pendingFocus) {
      const days = generateBodybuildingDays(p.pendingFocus, p.daysPerWeek);
      if (days && days.length === p.daysPerWeek) {
        p.days = days;
        p.trainingConfig.muscleFocus = Object.assign({}, p.pendingFocus);
        if (S.profile.training) S.profile.training.muscleFocus = Object.assign({}, p.pendingFocus);
        p.pendingFocus = null;
        toast(t('fe.applied'));
        toast(t('week.new_block_toast', { label: blockDisplayLabel(p.blocks[p.pointer.block]) }));
        V.dayIdx = null;
        save(); render();
        return;
      }
      p.pendingFocus = null; // generation could not fill the week: keep the old split
    }
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
    toast(t('week.new_block_toast', { label: blockDisplayLabel(p.blocks[p.pointer.block]) }));
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
// [Epic H3] Landmark evolution history: without a snapshot, each block's
// recalibration overwrites the past and the "landmarks of the time" are lost.
// One small record per finished block; additive (backfilled in migrateState).
function logLandmarkSnapshot(blockIdx) {
  if (!S.profile.landmarks) return;
  S.landmarkLog = S.landmarkLog || [];
  S.landmarkLog.push({ ts: Date.now(), block: blockIdx,
    landmarks: JSON.parse(JSON.stringify(S.profile.landmarks)) });
}
function recalibrateLandmarks(blockIdx) {
  const lm = S.profile.landmarks;
  if (!lm) { bumpTrainingAge(); return; }
  const sessions = S.sessions.filter(s => !s.skipped && s.b === blockIdx && s.entries && s.entries.length);
  if (!sessions.length) { logLandmarkSnapshot(blockIdx); bumpTrainingAge(); return; }
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
  // [B1/SS1] Peak achieved weekly sets per landmark muscle this block: evidence
  // that the current ceiling was actually tested. Done non-warmup sets, direct
  // or synergist-fractional, mirroring weeklyVolumeByMuscle's attribution.
  const wkVol = {};
  for (const s of sessions) for (const e of s.entries) {
    const ex = exById(e.exId);
    if (!ex || !e.sets) continue;
    const n = e.sets.filter(st => st.done && !st.ramp).length;
    if (!n) continue;
    const t = wkVol[s.w] = wkVol[s.w] || {};
    const add = (m, v) => { if (lm[m]) t[m] = (t[m] || 0) + v; };
    if (lm[ex.movement]) add(ex.movement, n);
    else {
      const cov = SYNERGIST_COVERAGE[ex.movement];
      if (cov) for (const m in cov) add(m, n * cov[m]);
    }
  }
  const peak = {};
  for (const w in wkVol) for (const m in wkVol[w]) peak[m] = Math.max(peak[m] || 0, wkVol[w][m]);
  for (const mv in agg) {
    if (agg[mv].n < 3) continue;                       // not enough signal to move a landmark
    const delta = agg[mv].sum / agg[mv].n;             // <0 easier than target, >0 harder
    const L = lm[mv];
    const seed = VOLUME_LANDMARKS[mv] || L;
    const ceil = Math.round(seed.mrv * 1.4);           // do not let it run away
    // [B1/SS1] Strong signal moves the landmark 2 sets instead of 1, so the
    // athlete's own data dominates the seeded prior within about two mesos.
    const step = Engine.landmarkStep(agg[mv].n, peak[mv] || 0, L.mrv);
    if (delta <= 0.5 && !down) {                        // tolerated: room to grow
      L.mrv = Math.min(ceil, L.mrv + step);
      if (L.mrv - L.mev > 12) L.mev = L.mev + 1;        // let the productive window follow up slowly
    } else if (delta >= 1.0 || down) {                  // overreached: back off
      L.mrv = Math.max(L.mev + 1, L.mrv - step);
    }
  }
  logLandmarkSnapshot(blockIdx); // [Epic H3] after evolution: the values now in force
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
  // The readiness numbers stay hidden with the rest of the readiness UI; the
  // card keeps only the next-week line.
  let ctxCard = '';
  if (SHOW_READINESS_UI) {
    const ctx = readinessContext();
    const ctxLine = ctx.hasBaseline
      ? t('week.ctx_baseline', { avg: ctx.weekAvg, base: ctx.baseAvg })
      : t('week.ctx_building', { avg: ctx.weekAvg });
    ctxCard = `<span class="faint">${esc(t('week.readiness_ctx'))}</span>
          <div class="subtle mt8">${esc(ctxLine)}</div>`;
  }
  $modal.innerHTML = modalShell(anim, t('week.complete'), `
        <div class="slider-card">
          <div class="q">${esc(t('week.feel_q'))}</div>
          <div class="feeling" style="font-size:2.2rem;font-weight:800" id="wf-val">${WF}</div>
          <p class="faint" id="wf-desc" style="min-height:34px;margin-bottom:6px">${esc(weekFeelLegend(WF))}</p>
          <input type="range" min="1" max="5" step="1" value="${WF}" oninput="wfSet(this.value)">
          <div class="range-labels"><span>${esc(t('week.feel_low'))}</span><span>${esc(t('week.feel_mid'))}</span><span>${esc(t('week.feel_high'))}</span></div>
        </div>
        <div class="card">${ctxCard}
          <p class="faint${SHOW_READINESS_UI ? ' mt8' : ''}">${esc(t('week.next_up', { block: blockDisplayLabel(upBlock), week: weekLabelFor(upBlock, up.week) }))}</p></div>
        <button class="btn btn-green" onclick="confirmWeekFeel()">${esc(t('week.advance_btn'))}</button>
        <button class="btn btn-outline mt8" onclick="closeModal()">${esc(t('confirm.cancel'))}</button>`, 'closeModal()');
}
function wfSet(v) {
  WF = parseInt(v);
  byId('wf-val').textContent = WF;
  byId('wf-desc').textContent = weekFeelLegend(WF);
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
  if (programDone()) return `${topbar(t('tab.workout'))}<div class="view">
    <div class="card accent mt16"><b>${esc(t('workout.done_title'))}</b><p class="subtle mt8">${esc(t('workout.done_body'))}</p></div>
    ${macroReportHTML()}
    <button class="btn btn-outline mt16" onclick="nav('progress')">📈 ${esc(t('px.title'))}</button></div>${tabbar()}`;
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
      // resolveSlot's removedReason strings are part of its tested output, so
      // they map to catalog keys here instead of changing at the source.
      const reasonKey = rs.removedReason === 'not used in hypertrophy' ? 'workout.removed_hypertrophy' : 'workout.removed_focus';
      return `<div class="ex-card" data-si="${si}" style="opacity:.5">
        ${grip}<span class="name">${esc(rs.name)}</span>
        <span class="faint" style="font-size:.78rem">${esc(t(reasonKey))}</span></div>`;
    }
    if (rs.isSelect) {
      return `<div class="ex-card" data-si="${si}">
        ${grip}
        <button class="name select" onclick="openSwap(${di},${si})">${esc(t('workout.select_cat', { cat: mvLabel(rs.cat) }))}</button>
      </div>`;
    }
    const opt = optSi.has(si);
    // [Cluster B] Superset / giant-set link badge + toggle (accessories only). The
    // toggle reflects whether THIS slot links to the next; chaining links forms a
    // giant set. Every accessory with a following accessory can link.
    const ssInfo = ss.byId[si];
    const ssTag = ssInfo ? ` <span class="ss-tag">⛓ ${esc(t('workout.ss_tag', { kind: t(ssInfo.size > 2 ? 'session.giant_set' : 'session.superset').toLowerCase(), names: ssInfo.others }))}</span>` : '';
    const ssBtn = (!rs.isMain && !rs.isSecondary && bbTrack && ss.eligible.has(si))
      ? `<button class="icon-btn" onclick="toggleSuperset(${di},${si})"><span class="ic">⛓</span>${esc(t(slot.superset ? 'workout.unlink' : 'session.superset'))}</button>`
      : '';
    // [Cluster B] Within a group, compact up/down controls reorder the member while
    // keeping the group intact (disabled at the group's ends).
    const ssMove = ssInfo ? `${ssInfo.index > 0 ? `<button class="icon-btn ss-move" onclick="moveSupersetMember(${di},${si},-1)" aria-label="${esc(t('a11y.move_up'))}"><span class="ic">▲</span></button>` : ''}${ssInfo.index < ssInfo.size - 1 ? `<button class="icon-btn ss-move" onclick="moveSupersetMember(${di},${si},1)" aria-label="${esc(t('a11y.move_down'))}"><span class="ic">▼</span></button>` : ''}` : '';
    // Main and secondary lifts anchor the program (and the working max), so they
    // are swap-only. Accessories and anything the athlete added can be removed by
    // swiping the card left to reveal a Remove action.
    const card = `<div class="ex-card ${opt ? 'optional' : ''}${ssInfo ? ' superset' : ''}" data-si="${si}">
      ${grip}
      <span class="name">${esc(rs.name)}${opt ? ` <span class="opt-tag">${esc(t('session.optional_tag'))}</span>` : ''}${ssTag}</span>
      <span class="actions">
        <button class="icon-btn" onclick="openExDetail('${rs.exId}')"><span class="ic">ⓘ</span>${esc(t('common.info'))}</button>
        ${ssMove}${ssBtn}
        <button class="icon-btn" onclick="openSwap(${di},${si})"><span class="ic">⇄</span>${esc(t('common.swap'))}</button>
      </span>
    </div>`;
    if (rs.isMain || rs.isSecondary) return card;
    return `<div class="ex-swipe" data-si="${si}" onpointerdown="exSwipeDown(event,${di},${si})">
      <button class="ex-remove" onclick="removeSlot(${di},${si})" aria-label="${esc(t('common.remove'))} ${esc(rs.name)}"><span class="ic">🗑</span>${esc(t('common.remove'))}</button>
      ${card}
    </div>`;
  }).join('');

  return `${topbar(t('tab.workout'))}
  <div class="view">
    <div class="mt8">
      <div style="color:${BLOCK_COLORS[block.type]};font-weight:600">${esc(blockDisplayLabel(block))}</div>
      <div style="font-size:1.4rem;font-weight:700">${esc(t('common.week_n', { n: globalWeekNum() }))}</div>
      <div class="row">
        <div style="font-size:2.4rem;font-weight:800">${esc(t('common.day_n', { n: di + 1 }))}</div>
        <div>
          <button class="day-nav" onclick="prevDay()">‹</button>
          <button class="day-nav" onclick="nextDay()">›</button>
        </div>
      </div>
      <div class="subtle">${dayTheme(day) ? esc(dayTheme(day)) + ' · ' : ''}${weekLabelFor(block, w)}${doneState ? ' · ' + esc(t(doneState === 'skipped' ? 'session.skipped' : 'workout.completed')) : ''}</div>
    </div>
    ${timeBannerHTML(di)}
    <button class="btn-ghost" style="margin:4px 2px" onclick="openTimeByWeek(${di})">${esc(t('time.by_week_btn'))}</button>
    ${locked ? `
    <div class="card accent mt16"><b>${esc(t('workout.day_complete'))}</b>
      <p class="subtle mt8">${esc(t('workout.day_complete_body'))}</p>
      <button class="btn btn-blue mt8" onclick="openSummaryFor('${doneState}')">${esc(t('workout.view_summary'))}</button>
      <button class="btn btn-outline mt8" onclick="redoDay(${di})">${esc(t('workout.redo_day'))}</button>
    </div>` : emptyDay ? `
    <div class="card accent mt16"><b>${esc(t('workout.empty_title'))}</b>
      <p class="subtle mt8">${esc(t('workout.empty_body'))}</p>
      <button class="btn btn-outline mt8" onclick="openAddExercise(${di})">${esc(t('workout.add_exercise'))}</button>
    </div>` : `
    <button class="btn btn-green mt16" onclick="startCheckin(${di})">${esc(t('workout.start_training'))}</button>
    <div class="btn-row">
      <button class="btn btn-outline" onclick="skipWorkout(${di})">${esc(t('workout.skip'))}</button>
      <button class="btn btn-outline" onclick="openPreview(${di})">${esc(t('workout.preview'))}</button>
    </div>`}
    <div class="section-title">${esc(t('workout.overview'))}</div>
    <div id="ex-list">${cards}</div>
    ${timeBudgetHTML(di)}
    <button class="btn btn-outline" style="border-radius:24px" onclick="openAddExercise(${di})">${esc(t('workout.add_exercise'))}</button>
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
  toast(t('workout.order_toast'), true);
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
  const name = resolveSlot(slot, p.pointer.block, p.pointer.week).name || t('common.exercise');
  LAST_REMOVED = { di, si, slot };
  p.days[di].slots.splice(si, 1);
  save(); render();
  toastAction(t('tech.removed', { name }), t('common.undo'), undoRemove);
}
function undoRemove() {
  if (!LAST_REMOVED) return;
  const { di, si, slot } = LAST_REMOVED;
  const slots = P().days[di].slots;
  slots.splice(Math.min(si, slots.length), 0, slot);
  LAST_REMOVED = null;
  save(); render();
  toast(t('workout.removal_undone'));
}

function skipWorkout(di) {
  confirmModal({
    title: t('workout.skip_title'),
    message: t('workout.skip_msg'),
    confirmLabel: t('workout.skip_confirm'),
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
  toast(t('workout.skipped_toast'), true);
  V.dayIdx = null;
  render();
}

// ------------------------------------------------------------
// CHECK-IN FLOW (4 steps)
// ------------------------------------------------------------
function checkinGroupsForDay(day) {
  const groups = new Map();
  const bi = P().pointer.block, wi = P().pointer.week;
  // [Epic H2] A generated bodybuilding day asks soreness by the day's actual
  // muscles (the lift-pattern groups like "upper pull" read wrong on a split);
  // strength tracks keep the pattern groups that match their day themes.
  const tc = P().trainingConfig;
  if (tc && tc.track === 'bodybuilding') {
    const MAIN_MUSCLE = { bench: 'chest', press: 'shoulder', squat: 'quad', deadlift: 'ham' };
    for (const slot of day.slots) {
      if (resolveSlot(slot, bi, wi).isRemoved) continue;
      const mv = slot.type === 'main' || slot.type === 'secondary'
        ? exById(slot.lift)?.movement : slot.cat;
      const m = MAIN_MUSCLE[mv] || (VOL_ORDER.includes(mv) ? mv : null);
      if (m) groups.set(m, { key: m, muscle: true });
    }
    return [...groups.values()];
  }
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
// Copy lives in the i18n catalogs ('ci.feel_1'..'ci.feel_5').
const feelWord = v => t('ci.feel_' + v);

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
    <div class="checkin-step-label">◌ ${esc(t('ci.step', { n: step + 1, total: totalSteps }))}</div>
    <div class="checkin-title">${esc(blockDisplayLabel(block))} · ${esc(t('session.week_day', { week: globalWeekNum(), day: cd.di + 1 }))}</div>`;

  if (step === 0) {
    body = `${header}
      <div class="slider-card">
        <div class="q">${esc(t('ci.sleep_q'))}</div>
        <div class="feeling">${t('ci.hours', { h: `<b id="sleep-val">${cd.sleepHours}</b>` })}</div>
        <input type="range" min="3" max="10" step="0.5" value="${cd.sleepHours}"
          oninput="cd_sleep(this.value)">
        <div class="range-labels"><span>${esc(t('ci.hours_short', { n: 3 }))}</span><span>${esc(t('ci.hours_short', { n: 6 }))}</span><span>${esc(t('ci.hours_short', { n: 10 }))}</span></div>
        ${cd.sleepHours < 6 ? `<div class="banner-warn mt8">${esc(t('ci.short_sleep_warn'))}</div>` : ''}
      </div>
      <button class="btn btn-blue" onclick="cd_next()">${esc(t('common.next'))}</button>`;
  } else if (step <= cd.groups.length) {
    const g = cd.groups[step - 1];
    const val = cd.sliders[g.key];
    body = `${header}
      <div class="bodymap">🫀</div>
      <div class="slider-card">
        <div class="q">${esc(t('ci.group_q', { group: g.muscle ? mvLabel(g.key) : t('ci.group_' + g.key) }))}</div>
        <div class="feeling">${t('ci.feeling', { word: `<b>${esc(feelWord(val))}</b>` })}</div>
        <input type="range" min="1" max="5" step="1" value="${val}"
          oninput="cd_slider('${g.key}', this.value)">
        <div class="range-labels">${[1, 2, 3, 4, 5].map(v => `<span>${esc(feelWord(v).toUpperCase())}</span>`).join('')}</div>
      </div>
      <button class="btn btn-blue" onclick="cd_next()">${esc(t('common.next'))}</button>`;
  } else {
    body = `${header}
      <div class="subtle" style="margin-top:8px">${esc(t('ci.mindset_title'))}</div>
      <p class="faint">${esc(t('ci.mindset_body'))}</p>
      <input class="checkin-input" id="ci-mindset" placeholder="${esc(t('ci.mindset_ph'))}" value="${esc(cd.mindset)}">
      <div class="card mt16">
        <div style="font-weight:600;margin-bottom:6px">${esc(t('ci.injury_q'))}</div>
        ${[['squat', 'Squat'], ['bench', 'Bench'], ['deadlift', 'Deadlift']].map(([key, l]) => `
          <label class="check-row"><input type="checkbox" ${cd.injuries.includes(l) ? 'checked' : ''}
            onchange="cd_injury('${l}', this.checked)"> ${esc(t('lift.' + key))}</label>`).join('')}
      </div>
      <button class="btn btn-green mt16" onclick="beginSession()">${esc(t('ci.start_workout'))}</button>`;
  }
  return `<header class="topbar"><button class="btn-ghost" onclick="nav('workout')">‹</button>
    <span style="font-weight:700">${esc(t('ci.title'))}</span><span></span></header>
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
  const entries = built.items.map(x => applyInjuryEasing(sessionEntryFrom(x), cd.injuries));
  V.draft = { id: 's' + Date.now(), ts: Date.now(), b, w, d: di, entries,
              sleepHours: cd.sleepHours, mindset: cd.mindset, sliders: { ...cd.sliders } };
  // Optional field, only written when used (session record marks the flags).
  if (cd.injuries.length) V.draft.injuries = [...cd.injuries];
  clearRestTimer();
  save();
  nav('session');
}
// [Epic H2] A lift flagged at check-in still trains, but eased: the AMRAP
// becomes a straight set (no grinding on a tweak), weighted sets drop 10%,
// effort caps gain one RIR. Session-draft only, unlogged sets only, and inert
// with no flags, so prescriptions and the golden master never move.
const INJURY_MV = { Squat: 'squat', Bench: 'bench', Deadlift: 'deadlift' };
function applyInjuryEasing(e, injuries) {
  const flagged = (injuries || []).map(l => INJURY_MV[l]).filter(Boolean);
  if (!flagged.includes((exById(e.exId) || {}).movement)) return e;
  e.injured = true;
  for (const st of e.sets) {
    if (st.done || st.skipped || st.ramp) continue;
    if (st.amrap) st.amrap = false;
    if (st.targetRpe != null) st.targetRpe = Math.max(5, st.targetRpe - 1);
    if (st.targetWeight != null) {
      st.targetWeight = Engine.roundLoad(st.targetWeight * 0.9, loadingFor(e.exId).totalInc || 2.5);
    }
  }
  return e;
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
    sets: x.rs.sets.map(t => (Object.assign({
      targetWeight: t.weight ?? null, targetReps: t.reps, targetRpe: t.rpe ?? null,
      amrap: !!t.amrap, ramp: !!t.ramp, calib: !!t.calib, note: t.note || null,
      noteKey: t.noteKey || null, noteParams: t.noteParams || null,
      technique: t.technique || null, dropTargets: t.drops || null,
      weight: null, reps: null, rpe: null, drops: null, done: false,
    }, // [Epic H4] optional fields, written only when the range/e1RM path set them
    t.repRange ? { repRange: t.repRange } : null,
    t.repPR ? { repPR: true } : null))),
  };
}
// A corrected max (1RM/10RM seed, working max, or a deleted record) should move
// the weights the athlete is looking at RIGHT NOW, not just the next session:
// the active draft snapshots its targets at session start, so re-prescribe the
// affected entries in place. Un-logged sets pick up the fresh targets; sets
// already logged (or skipped) keep exactly what was performed. Notes stay.
function refreshDraftTargets(exId) {
  const dr = V && V.draft;
  if (!dr) return;
  const built = resolveDayEntries(dr.d, dr.b, dr.w);
  dr.entries.forEach((e, i) => {
    // The exercise itself, plus any main/secondary whose wave math keys off it.
    if (e.exId !== exId && e.wmKey !== exId) return;
    const item = built.items.find(x => x.si === e.si && x.rs.exId === e.exId);
    if (!item) return;
    const fresh = applyInjuryEasing(sessionEntryFrom(item), dr.injuries);
    fresh.notes = e.notes; fresh.notesOpen = e.notesOpen;
    fresh.sets = fresh.sets.map((s, j) => {
      const old = e.sets[j];
      return old && (old.done || old.skipped) ? old : s;
    });
    // Logged sets beyond the fresh prescription's length are performed work;
    // never drop them.
    for (let j = fresh.sets.length; j < e.sets.length; j++) {
      if (e.sets[j].done) fresh.sets.push(e.sets[j]);
    }
    dr.entries[i] = fresh;
  });
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
  // Partials get no per-row detail (owner feedback): they ride the working
  // weight and run to near failure, so a "then 22.5kg×6" target is noise. The
  // chip row and the runs-on-set note already say the finisher is on.
  const tech = st.technique === 'partials' ? '' : techniqueBadge(st.technique) +
    (st.dropTargets ? ` <small class="faint">${esc(t('set.then', { detail: dropDetail(exId, st.dropTargets) }))}</small>` : '');
  if (st.amrap) return `${fmtW(exId, st.targetWeight)} × AMRAP <small>${esc(t('set.amrap_standard', { reps: st.targetReps }))}</small>${tech}`;
  // [Epic H4] Rep-PR top set: the e1RM-anchored day's peak. The + says it all;
  // the row note (note.rep_pr) carries the one-liner.
  if (st.repPR) return `${fmtW(exId, st.targetWeight)} × ${st.targetReps}+${tech}`;
  // Calibration rows stay bare; the card carries the one-line explainer.
  if (st.calib) return `${esc(t('set.reps_at_rir', { reps: st.targetReps, rir: fmtRir(st.targetRpe) }))}${tech}`;
  // [Epic H4] A ranged set shows today's double-progression target with its
  // band right on the row: "40kg × 9 (8-12)".
  const rng = st.repRange ? ` <small class="faint">(${st.repRange[0]}-${st.repRange[1]})</small>` : '';
  // The per-set RIR cap moved up to the card's scheme line (owner feedback:
  // repeating it on every row is noise); rows show weight × reps only.
  if (st.targetWeight != null) return `${fmtW(exId, st.targetWeight)} × ${st.targetReps}${rng}${tech}`;
  return `${esc(t('set.reps_at_rir', { reps: st.targetReps, rir: fmtRir(st.targetRpe) }))}${tech}`;
}

// De-verbose the session card (owner feedback): the same boilerplate repeated
// on every set row reads three times as long as it needs to. The shared line
// (calibration explainer, deload copy) hoists to ONE card-level hint; rows keep
// only what differs per set ('build up', 'top set'). Display-only: the engine's
// set objects and notes are untouched, so nothing prescription-side moves.
// [i18n phase 3] Resolve a set's note to display text: a keyed note translates
// through the catalogs ('note.<key>'); a legacy stored English `note` string
// (pre-phase-3 sessions and drafts) renders verbatim, no migration.
function setNoteText(st) {
  if (st.noteKey) return t('note.' + st.noteKey, st.noteParams || undefined);
  return st.note || null;
}
function cardHintFor(sets) {
  const work = sets.filter(s => !s.ramp);
  if (!work.length) return null;
  if (work.every(s => s.calib)) return t('session.calibration_hint');
  const notes = [...new Set(work.map(setNoteText).filter(Boolean))];
  return (notes.length === 1 && work.every(s => setNoteText(s))) ? notes[0] : null;
}
function displaySetNote(st, cardHint) {
  const txt = setNoteText(st);
  if (!txt) return null;
  if (cardHint && txt === cardHint) return null; // hoisted to the card line
  if (st.calib) {
    // Keyed calibration notes have explicit short display forms; the bare
    // middle set ('calib') shows nothing. Legacy strings strip their prefix.
    if (st.noteKey) return st.noteKey === 'calib' ? null : t('note.' + st.noteKey + '_short');
    return st.note.replace(/^Calibration(\s*·\s*)?/, '') || null;
  }
  return txt;
}

// [Cluster B] The one-time "we switched to RIR" card is retired (owner
// feedback: too verbose). The S.flags.rirSeen flag stays in old saves, unused.

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
function techChipHTML(e, ei, dr) {
  if (!canDropEntry(e)) return '';
  // Hard periodization gate (owner call, no placeholder hint): outside the
  // intensification/realization weeks the chips simply do not exist.
  if (!dr || !finisherAllowed(dr.b, dr.w)) return '';
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
  // The chips are hidden outside eligible weeks; this guard covers stale DOM,
  // since this path writes the sets and S.techniques directly.
  if (!V.draft || !finisherAllowed(V.draft.b, V.draft.w)) return;
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
      <div class="col center"><span style="color:var(--blue);font-weight:600">${esc(blockDisplayLabel(block))}</span>
      <span style="font-weight:700">${esc(t('session.week_day', { week: weeksBefore(dr.b) + dr.w + 1, day: dr.d + 1 }))}</span></div>
      <span></span></header>
    <div class="view">
      ${restTimerHTML()}
      ${shortSleep ? `<div class="banner-warn">${esc(t('session.short_sleep', { hours: dr.sleepHours }))}</div>` : ''}
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
function setRowHTML(e, ei, st, si2, shortSleep) {
  const perfLabel = st.done ? `${fmtW(e.exId, st.weight)} x ${st.reps} · ${fmtRir(st.rpe)}` : st.skipped ? esc(t('session.skipped')) : esc(t('session.performance'));
  const fatigueFlag = shortSleep && !st.ramp && si2 >= e.sets.length - 1 && !e.isMain
    ? `<div class="flag">${esc(t('session.short_sleep_flag'))}</div>` : '';
  const loggedDrops = (st.done && st.drops && st.drops.length && st.technique !== 'partials')
    ? `<small class="faint">${childWord(st.technique)} ${dropDetail(e.exId, st.drops)}</small>` : '';
  const hasTech = FINISHER_TECHS.includes(st.technique);
  // Per-set prescription notes are no longer rendered (owner feedback: noise);
  // displaySetNote/cardHintFor stay for tests and possible detail surfaces.
  return `<div class="set-row ${st.done ? 'done' : ''} ${st.amrap ? 'amrap' : ''} ${st.skipped ? 'skipped' : ''} ${hasTech ? 'tech' : ''}">
      <span class="num">${st.skipped ? '–' : si2 + 1}</span>
      <span class="target">${setTargetLabel(st, e.exId)}${loggedDrops}</span>
      <button class="perf ${st.done ? 'filled' : ''}" onclick="openPerf(${ei},${si2})">${perfLabel}</button>
    </div>${fatigueFlag}`;
}
// The standard single-exercise session card.
function liftCardHTML(e, ei, dr, shortSleep) {
  const setRows = e.sets.map((st, si2) => setRowHTML(e, ei, st, si2, shortSleep)).join('');
  const schemeWork = e.sets.filter(s => !s.ramp);
  // When every working set shares one RIR cap it reads once up here, next to
  // the sets x reps scheme, instead of repeating on each row.
  const rpes = [...new Set(schemeWork.filter(s => !s.amrap && s.targetRpe != null).map(s => s.targetRpe))];
  const uniformRir = rpes.length === 1 && schemeWork.every(s => s.amrap || s.targetRpe != null) ? rpes[0] : null;
  const schemeTxt = schemeWork.length
    ? esc(uniformRir != null
        ? t('session.sets_x_reps_rir', { sets: schemeWork.length, reps: schemeWork[0].targetReps, rir: fmtRir(uniformRir) })
        : t('session.sets_x_reps', { sets: schemeWork.length, reps: schemeWork[0].targetReps }))
    : '';
  const top = topWorkWeight(e);
  return `<div class="lift-card ${e.optional ? 'optional' : ''}">
      <h3>${esc(e.name)}${e.optional ? ` <span class="opt-tag">${esc(t('session.optional_tag'))}</span>` : ''}</h3>
      ${e.optional ? `<p class="faint" style="margin:-4px 0 6px">${esc(t('session.over_time_limit'))}</p>` : ''}
      ${e.injured ? `<div class="injury-strip">🩹 ${esc(t('session.injury_eased'))}<button onclick="openSwap(${dr.d},${e.si})">⇄ ${esc(t('common.swap'))}</button></div>` : ''}
      ${lastSetInfo(e.exId)}
      <div class="head-actions">
        <button onclick="openSwap(${dr.d},${e.si})" aria-label="${esc(t('session.swap_exercise'))}">⇄</button>
        <button onclick="openExDetail('${e.exId}')">ⓘ</button>
      </div>
      ${top && loadingFor(e.exId).showPlates ? `<button class="warmup-btn" onclick="openWarmup(${top},'${e.exId}')"><b>＋</b> ${esc(t('session.warmup'))}</button>` : ''}
      <div class="scheme">${schemeTxt}</div>
      ${techChipHTML(e, ei, dr)}
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
        ${techChipHTML(e, ei, dr)}
        ${e.notesOpen ? `<textarea class="notes-area" oninput="setNotes(${ei}, this.value)" placeholder="${esc(t('session.notes_placeholder'))}">${esc(e.notes)}</textarea>` : ''}
      </div>`).join('');
  const rounds = [];
  for (let r = 0; r < maxRounds; r++) {
    const cells = members.map(({ e, ei }) => {
      if (r >= e.sets.length) return `<div class="ss-set-row empty"><span class="ss-set-ex faint">${esc(e.name)}</span><span class="faint">${esc(t('session.member_done'))}</span></div>`;
      const st = e.sets[r];
      const perfLabel = st.done ? `${fmtW(e.exId, st.weight)} x ${st.reps} · ${fmtRir(st.rpe)}` : st.skipped ? esc(t('session.skipped')) : esc(t('session.log'));
      const loggedDrops = (st.done && st.drops && st.drops.length && st.technique !== 'partials')
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
  toast(t('set.chime_played', { label: cfg ? cfg.label : id }));
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
         // Bodyweight counted by default; reopening a logged set restores what
         // was stored. Only bodyweight-mode lifts ever read or write this.
         bwCount: st.done ? st.bw != null : true,
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
      const kbell = (exById(exId) || {}).equipment === 'kb';
      const txt = L.count === 2
        ? t('load.per_hand', { half: dispW(weight / 2), total: dispW(weight), u: wUnit() })
        : t(kbell ? 'load.kettlebell' : 'load.dumbbell', { w: dispW(weight), u: wUnit() });
      return { viz: `<span class="faint">${esc(txt)}</span>`, note: '' };
    }
    const label = (L.mode === 'machine' || L.mode === 'cable') ? t('load.machine') : t('load.added');
    return { viz: `<span class="faint">${esc(label)}</span>`, note: '' };
  }
  const bar = L.barWeight;
  const { plates, achieved } = Engine.plateMath(weight, bar, S.profile.plates);
  const viz = plates.length
    ? plates.map(p => `<div class="plate" style="background:${plateColorFor(p.w)};color:${plateTextFor(p.w)};height:${36 + p.w * 2.2}px">${dispW(p.w)}</div>`).join('')
    : `<span class="faint">${esc(t('plates.bar_only'))}</span>`;
  const mismatch = Math.abs(achieved - weight) > 0.01;
  const note = esc(t('plates.note', { bar: dispW(bar), plates: dispW(Math.max(0, achieved - bar)), u: wUnit() })) +
    (mismatch ? `<br><span style="color:var(--amber)">${esc(t('plates.closest', { w: dispW(achieved), u: wUnit() }))}</span>` : '');
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
  const unitLabel = wUnitFor(disp);
  const { viz, note } = plateVizHTML(pm.weight, exId);
  // On a bodyweight/band lift the number is ADDED load, and athletes who miss
  // that type in their own bodyweight, which wrecks the e1RM. Say it in place.
  const bwMode = L.mode === 'bodyweight' || L.mode === 'band';
  const bwNote = bwMode
    ? `<div class="faint" style="font-size:.78rem;margin-top:2px">${esc(t('perf.bw_note'))}</div>` : '';
  // Bodyweight-count toggle: on by default, tap to leave the body out of the
  // tonnage for this set. Bodyweight mode only (bands do not load the body),
  // and only when a bodyweight is on file so there is a number to count.
  const bwToggle = L.mode === 'bodyweight' && S.profile.bodyweight > 0
    ? `<button class="btn ${pm.bwCount ? 'btn-blue' : 'btn-outline'} mt8" id="pm-bw-toggle" onclick="pmBw()">${esc(t('perf.bw_toggle'))}</button>` : '';
  $modal.innerHTML = modalShell(anim, t('perf.title'), `
        <div class="stepper">
          <div class="lbl">${esc(bwMode ? t('perf.added_weight') : t('perf.weight'))}</div>
          <div class="ctr">
            <button class="pm" onclick="pmW(-1)">−</button>
            <span class="val"><input id="pm-weight" type="number" inputmode="decimal"
              value="${fmtNumW(disp.value)}" onchange="pmWSet(this.value)"><small>${unitLabel}</small></span>
            <button class="pm" onclick="pmW(1)">＋</button>
          </div>
          <div class="plate-viz" id="pm-plateviz">${viz}</div>
          ${bwNote}
          ${bwToggle}
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
          <div class="lbl">${esc(t(isRpe() ? 'perf.rpe_label' : 'perf.rir_label'))}</div>
          <div class="ctr">
            <button class="pm" onclick="pmEffort(-0.5)">−</button>
            <span class="val" id="pm-rir">${kg(isRpe() ? pm.rpe : Engine.rpeToRir(pm.rpe))}</span>
            <button class="pm" onclick="pmEffort(0.5)">＋</button>
          </div>
          <div class="rpe-desc" id="pm-rpe-desc">${esc(rpeDesc(pm.rpe))}</div>
          <div class="faint" style="font-size:.78rem;margin-top:2px">${esc(t(isRpe() ? 'perf.rpe_hint' : 'perf.rir_hint'))}</div>
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
  if (inp) { inp.value = fmtNumW(disp.value); nudge(inp, dir); }
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
  const parsed = Math.max(0, fromDispW(parseFloat(v)) || 0); // typed in display units
  PM.weight = (L.mode === 'dumbbell' && L.count === 2) ? parsed * 2 : parsed; // typed value is per hand for two-DB
  perfUpdateWeight(0);
}
function pmR(d) {
  if (!PM) return;
  PM.reps = Math.max(0, PM.reps + d);
  const el = byId('pm-reps'); if (el) { el.textContent = PM.reps; nudge(el, d); }
}
// Effort stepper: the athlete edits the DISPLAYED scale (RIR by default, RPE
// when flipped in Settings); we always store RPE. `d` moves the displayed
// number: adding RIR (easier) lowers RPE, adding RPE (harder) raises it,
// clamped to RPE 5..10 (RIR 0..5).
function pmEffort(d) {
  if (!PM) return;
  PM.rpe = Math.min(10, Math.max(5, PM.rpe + (isRpe() ? d : -d)));
  const el = byId('pm-rir'); if (el) el.textContent = kg(isRpe() ? PM.rpe : Engine.rpeToRir(PM.rpe));
  const desc = byId('pm-rpe-desc'); if (desc) desc.textContent = rpeDesc(PM.rpe);
  nudge(el, d);
}
// Optional pump quick-tap: tapping the active level clears it (stays optional).
function pmPump(n) { if (!PM) return; PM.pump = PM.pump === n ? null : n; rerenderTop(); }
// Bodyweight-count toggle (bodyweight-mode lifts only): flips whether this
// set's tonnage counts the athlete's bodyweight. Targeted update, no rebuild.
function pmBw() {
  if (!PM) return;
  PM.bwCount = !PM.bwCount;
  const btn = byId('pm-bw-toggle');
  if (btn) {
    btn.classList.toggle('btn-blue', PM.bwCount);
    btn.classList.toggle('btn-outline', !PM.bwCount);
  }
}
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
  delete st.skipped; delete st.bw;
  closePerf(); render();
}
// Skip a set the athlete cannot or should not do today (cardio gone, a tweak,
// confidence, time). Nothing is logged: no record, no tonnage, and the volume
// autoregulator simply sees one less logged set, which is the honest signal.
function skipSet() {
  if (!PM) return;
  const st = V.draft.entries[PM.ei].sets[PM.si];
  st.done = false; st.weight = st.reps = st.rpe = null; st.pump = null; st.drops = null;
  st.skipped = true; delete st.bw;
  toast(t('perf.set_skipped'));
  closePerf(); render();
}
// [Epic H2] Two consecutive below-standard AMRAPs mean the working max is
// ahead of the athlete. Offer (never force) a reset to 90% of what the AMRAP
// actually implied; declining re-arms the counter. Additive per-lift counter.
function trackBelowStandard(e, st) {
  const p = P();
  p.belowStd = p.belowStd || {};
  p.belowStd[e.wmKey] = (p.belowStd[e.wmKey] || 0) + 1;
  if (p.belowStd[e.wmKey] < 2) return;
  p.belowStd[e.wmKey] = 0;
  const implied = Engine.roundLoad(Engine.e1rm(st.weight, st.reps, st.rpe ?? 10) * 0.9, 1.25);
  if (!(implied > 0) || implied >= p.wm[e.wmKey]) return;
  confirmModal({
    title: t('perf.wm_reset_title'),
    message: t('perf.wm_reset_msg', { name: e.name, from: fmtWU(p.wm[e.wmKey]), to: fmtWU(implied) }),
    confirmLabel: t('perf.wm_reset_confirm'),
  }, () => {
    p.wm[e.wmKey] = implied;
    refreshDraftTargets(e.wmKey);
    save();
    toast(t('perf.wm_calibrated', { name: e.name, w: dispW(implied), u: wUnit() }));
    render(); rerenderTop();
  });
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
  // Freeze the counted bodyweight into the set so historical tonnage never
  // shifts when the athlete's weight changes. Optional field, written only
  // when counted; weight stays ADDED load only (e1RM contract unchanged).
  if (loadingFor(e.exId).mode === 'bodyweight' && PM.bwCount && S.profile.bodyweight > 0) st.bw = S.profile.bodyweight;
  else delete st.bw;
  // Optional Cluster A/B fields are only written when set, so a plain straight set
  // logs the same record shape as before (persistence / golden master unaffected).
  const rec = { ts: Date.now(), weight: st.weight, reps: st.reps, rpe: st.rpe };
  if (st.pump != null) rec.pump = st.pump;
  if (st.technique) rec.technique = st.technique;
  if (st.drops) rec.drops = st.drops;
  if (st.bw) rec.bw = st.bw;
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
        toast(t('perf.wm_up', { name: e.name, from: dispW(res.newWM - res.delta), to: dispW(res.newWM), u: wUnit() }) + (res.capped ? ' ' + t('perf.wm_capped') : ''));
        if (P().belowStd) P().belowStd[e.wmKey] = 0;
      } else if (st.reps < wave.standard) {
        toast(t('perf.wm_below_standard'), true);
        trackBelowStandard(e, st);
      } else {
        toast(t('perf.wm_standard_met'), true);
        if (P().belowStd) P().belowStd[e.wmKey] = 0;
      }
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
        toast(t('perf.wm_calibrated', { name: e.name, w: dispW(P().wm[e.wmKey]), u: wUnit() }));
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
        <div class="card"><div class="row"><span>${esc(t('warmup.target_top'))}</span><b>${fmtWU(top)}</b></div>
        <div class="divider"></div>
        <div class="row"><span>${esc(t('warmup.bar_weight'))}</span><b style="color:var(--blue)">${dispW(bar)}${wUnit()}</b></div></div>
        ${sets.map((s, i) => `<div class="set-row"><span class="num">${i + 1}</span>
          <span class="target">${dispW(s.weight)}${wUnit()} × ${s.reps}</span></div>`).join('')}
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
  toast(t('sr.saved', { tonnage: Math.round(toDispW(dr.tonnage)).toLocaleString(I18N.dateLocale()), u: wUnit() }));
  V.tab = 'dashboard';
  nav('summary');
}

// ------------------------------------------------------------
// PREVIEW MODAL
// ------------------------------------------------------------
// One preview set row's text. Effort reads as RIR here like everywhere the
// athlete sees it (RPE stays the stored value; owner feedback: the preview was
// the one surface still speaking RPE).
function previewSetLabel(s, exId) {
  return `${s.weight != null ? fmtW(exId, s.weight) + ' × ' : ''}${s.amrap ? 'AMRAP' : s.reps}${s.rpe ? ' @ ' + fmtRir(s.rpe) : ''}`;
}
function openPreview(di) {
  const built = resolveDayEntries(di, P().pointer.block, P().pointer.week);
  const timeNote = built.capMin
    ? `<p class="faint" style="margin-bottom:10px">${esc(t('preview.core_within', { core: built.coreMin, cap: built.capMin }))}${built.optItems.length ? ' ' + esc(t('preview.optional_note', { list: built.optionalNames.join(', '), extra: built.fullMin - built.coreMin })) : ''}</p>`
    : '';
  showModal(anim => {
    $modal.innerHTML = modalShell(anim, t('preview.title'), timeNote +
      built.items.map(x => {
        const rs = x.rs, work = rs.sets.filter(s => !s.ramp);
        return `<div class="lift-card ${rs.optional ? 'optional' : ''}"><h3 style="font-size:1.2rem">${esc(rs.name)}${rs.optional ? ` <span class="opt-tag">${esc(t('session.optional_tag'))}</span>` : ''}</h3>
          <div class="scheme">${esc(t('session.sets_x_reps', { sets: work.length, reps: work[0]?.reps ?? '' }))}</div>
          ${rs.sets.map((s, i) => `<div class="set-row"><span class="num">${i + 1}</span>
            <span class="target">${previewSetLabel(s, rs.exId)}</span>
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
    ? `<p class="faint" style="margin-bottom:8px">${esc(t('swap.main_note', { name: exName(slot.baseLift || slot.lift) }))}</p>`
    : (timeCapMin() ? timeBudgetHTML(SW.di) : '');
  $modal.innerHTML = modalShell(anim, t(slot.type === 'select' ? 'swap.select_title' : 'swap.title'),
    `${note}
     <input class="search-input" placeholder="${esc(t('swap.search_ph'))}" value="${esc(SW.q)}" oninput="SW.q=this.value;refreshSwapBody()">
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
  const matchText = e => exMatches(e, ql);
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
    || exDisplayName(a).localeCompare(exDisplayName(b));

  // Chips reflect the pool the athlete can actually browse: just the
  // recommended movement for a main slot, every exercise otherwise.
  const pool = SW.isMain ? all.filter(e => e.movement === SW.cat) : all;
  const equips = [...new Set(pool.map(e => e.equipment))].sort((a, b) => EQUIP_ORDER.indexOf(a) - EQUIP_ORDER.indexOf(b));
  const chips = equipChips(equips, SW.equip, 'setSwapEquip');

  const recommended = all.filter(e => e.movement === SW.cat && matchEquip(e) && matchText(e)).sort(sortFn);
  const recHTML = recommended.length
    ? recommended.map(e => swapCardHTML(e, false, fillsGap(e))).join('')
    : `<p class="faint mt8">${esc(SW.equip === 'all' ? t('swap.no_matches') : t('swap.no_matches_equip', { equip: t('equip.' + SW.equip).toLowerCase() }))}</p>`;

  // Out-of-group browsing lets an athlete fine tune freely: a machine they
  // like, or a muscle they want to bias, regardless of the slot's category.
  let otherSection = '';
  if (!SW.isMain) {
    const others = all.filter(e => e.movement !== SW.cat && matchEquip(e) && matchText(e))
      .sort((a, b) => (MOVEMENTS[a.movement]?.label || '').localeCompare(MOVEMENTS[b.movement]?.label || '') || sortFn(a, b));
    if (ql) {
      // A name search spans everything, since the athlete may not know which
      // muscle group the machine they are looking for lives under.
      otherSection = others.length ? `<div class="section-title" style="margin-top:14px">${esc(t('swap.other_groups'))}</div>${others.map(e => swapCardHTML(e, true)).join('')}` : '';
    } else {
      otherSection = `<button class="browse-toggle" onclick="SW.showOther=!SW.showOther;refreshSwapBody()" style="margin-top:12px">${esc(t(SW.showOther ? 'swap.hide_other' : 'swap.browse_other'))} ${SW.showOther ? '▴' : '▾'}</button>`;
      if (SW.showOther) otherSection += `<div class="section-title" style="margin-top:12px">${esc(t('swap.other_groups'))}</div>${others.map(e => swapCardHTML(e, true)).join('')}`;
    }
  }
  return `${chips}<div class="section-title" style="margin-top:4px">${esc(t('swap.recommended'))}</div>${recHTML}${otherSection}`;
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
        ? ` <span class="cost-tag">${esc(t('swap.same_time'))}</span>`
        : ` <span class="cost-tag">${esc(t(net > 0 ? 'swap.plus_min' : 'swap.minus_min', { n: Math.abs(net) }))}</span>`;
    } else {
      costTag = ` <span class="cost-tag">${esc(t('swap.plus_min', { n: cost }))}</span>`;
    }
  }
  // [Cluster C] When this exercise covers a head the day is missing, say so.
  const gapTag = (gap && e.head && HEAD_LABELS[e.head]) ? ` <span class="ex-tag gap">${esc(t('swap.adds_head', { head: headLabel(e.head) }))}</span>` : '';
  // [Cluster C] Conversely, warn when its region is already at/over its per-head
  // MRV this week, so piling on is the wrong pick. Suppressed when the candidate
  // also fills a gap (it cannot both max a region and fill a missing one).
  const overTag = (!gap && e.head && SW.overHeads && SW.overHeads.has(e.head) && HEAD_LABELS[e.head])
    ? ` <span class="ex-tag over">${esc(t('swap.head_maxed', { head: headLabel(e.head) }))}</span>` : '';
  return `<div class="ex-card">
      <span class="name">${esc(exDisplayName(e))}${costTag}${gapTag}${overTag}${showGroup ? `<span class="sub">${esc(mvLabel(e.movement))}</span>` : ''}${exTagsHTML(e)}</span>
      <span class="actions">
        <button class="icon-btn" onclick="openExDetail('${e.id}')"><span class="ic">ⓘ</span>${esc(t('common.info'))}</button>
        <button class="icon-btn" onclick="doSwap(${SW.di},${SW.si},'${e.id}')"><span class="ic">☐</span>${esc(t('common.select'))}</button>
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
    if (item && ei >= 0) dr.entries[ei] = applyInjuryEasing(sessionEntryFrom(item), dr.injuries);
  }
  save(); closeAllModals(); render();
  toast(t('swap.set_for', { name: exName(exId), day: dayTheme(P().days[di]) || t('common.day_n', { n: di + 1 }) }));
}
let ADDF = { equip: 'all', q: '' };
function openAddExercise(di) {
  V.addTarget = di;
  ADDF = { equip: 'all', q: '' };
  showModal(anim => {
    $modal.innerHTML = modalShell(anim, t('add.title'), `
        ${timeCapMin() ? timeBudgetHTML(di) : ''}
        <input class="search-input" placeholder="${esc(t('add.search_ph'))}" oninput="ADDF.q=this.value;refreshAddBody()">
        <div id="add-body">${addBodyHTML()}</div>`);
  });
}
function addBodyHTML() {
  const ql = ADDF.q.trim().toLowerCase();
  const matchText = e => exMatches(e, ql);
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
      const costTxt = cost ? ` · ${esc(t('add.cost', { n: cost }))}` : '';
      const overTag = (e.head && overHeads.has(e.head) && HEAD_LABELS[e.head]) ? ` <span class="ex-tag over">${esc(t('swap.head_maxed', { head: headLabel(e.head) }))}</span>` : '';
      return `<button class="lib-item" onclick="doAddExercise('${e.id}')">
      <span>${esc(exDisplayName(e))}<span class="sub">${esc(mvLabel(e.movement))} · ${EQUIP_LABEL[e.equipment] ? esc(t('equip.' + e.equipment)) : ''}${costTxt}</span>${exTagsHTML(e)}${overTag}</span><span>＋</span>
    </button>`;
    }).join('')
    : `<p class="faint mt8">${esc(t('add.no_matches'))}</p>`;
  return `${equipChips(equips, ADDF.equip, 'setAddEquip')}${items}`;
}
function refreshAddBody() { const el = byId('add-body'); if (el) el.innerHTML = addBodyHTML(); }
function setAddEquip(v) { ADDF.equip = v; refreshAddBody(); }
function doAddExercise(exId) {
  const ex = exById(exId);
  P().days[V.addTarget].slots.push({ type: 'acc', cat: ex.movement, ex: exId, added: true });
  save(); closeAllModals(); render();
  toast(t('add.added_toast', { name: ex.name }));
}

// ------------------------------------------------------------
// VIEW: HISTORY (tonnage by date, horizontal bars)
// ------------------------------------------------------------
function vHistory() {
  if (!P()) return vOnboarding();
  const sessions = [...S.sessions].reverse();
  let body;
  if (!sessions.length) {
    body = `<div class="card mt16"><b>${esc(t('hist.empty_title'))}</b>
      <p class="subtle mt8">${esc(t('hist.empty_body'))}</p></div>`;
  } else {
    const maxT = Math.max(...sessions.map(s => s.tonnage || 0), 1);
    body = sessions.map(s => {
      const pct = Math.max(8, (s.tonnage || 0) / maxT * 100);
      const label = `${blockOf(s.b)?.label || ''} · ${t('hist.wd', { w: weeksBefore(s.b) + s.w + 1, d: s.d + 1 })}`;
      return `<button class="hist-row ${s.skipped ? 'skipped' : ''}" style="display:block;width:100%;text-align:left" onclick="openSessionDetail('${s.id}')">
        <div class="meta"><span>${fmtDate(s.ts)} · ${esc(label)}</span><span>${s.skipped ? esc(t('session.skipped')) : (s.rating ? esc(t('hist.rated', { n: s.rating })) : '')}</span></div>
        <div class="bar-track"><div class="bar" style="width:${s.skipped ? 100 : pct}%">${s.skipped ? '—' : fmtTonnage(s.tonnage)}</div></div>
      </button>`;
    }).join('');
  }
  return `${topbar(t('tab.history'))}<div class="view">
    <div class="section-title">${esc(t('hist.title'))}</div>
    <p class="faint" style="margin-bottom:14px">${esc(t('hist.sub'))}</p>
    ${programDone() ? `<button class="btn btn-outline" style="margin-bottom:12px" onclick="nav('report')">🏁 ${esc(t('rp.title'))}</button>` : ''}
    ${body}</div>${tabbar()}`;
}
// [Epic H2] The flags a session was trained under, as compact chips. Empty
// string when none, so old sessions render exactly as before.
function injuryChips(s) {
  if (!s.injuries || !s.injuries.length) return '';
  return `<div class="injury-chips">${s.injuries.map(l =>
    `<span class="injury-chip">🩹 ${esc(t('lift.' + (INJURY_MV[l] || l)))}</span>`).join('')}</div>`;
}
// Shared per-lift rendering for the history modal and the post-workout summary.
function sessionSetRowsHTML(e, withTarget) {
  const done = e.sets.filter(x => x.done);
  if (!done.length) return `<p class="faint">${esc(t('sum.no_sets'))}</p>`;
  return done.map((x, i) => {
    const actual = `${fmtW(e.exId, x.weight)} × ${x.reps} · ${fmtRir(x.rpe)}`;
    let tgt = '';
    if (withTarget) {
      tgt = x.targetWeight != null
        ? ` <small>${esc(t('sum.target_w', { w: fmtW(e.exId, x.targetWeight), reps: x.targetReps }))}${x.targetRpe ? ' · ' + fmtRir(x.targetRpe) : ''}</small>`
        : (x.targetReps ? ` <small>${esc(t('sum.target_reps', { reps: x.targetReps }))}${x.targetRpe ? ' · ' + fmtRir(x.targetRpe) : ''}</small>` : '');
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
        <div class="row" style="margin-bottom:10px"><span class="subtle">${esc(t('sum.tonnage'))}</span><b>${fmtTonnage(s.tonnage)}</b></div>
        ${s.rating ? `<div class="row" style="margin-bottom:10px"><span class="subtle">${esc(t('sum.rating'))}</span><b>${s.rating} / 10</b></div>` : ''}
        ${injuryChips(s)}
        ${s.mindset ? `<div class="card accent"><span class="faint">${esc(t('sum.focus'))}</span><div>${esc(s.mindset)}</div></div>` : ''}
        ${s.entries.map(e => sessionLiftCardHTML(e, false)).join('')}`);
  });
}

// ------------------------------------------------------------
// VIEW: POST-WORKOUT SUMMARY (Change 3)
// ------------------------------------------------------------
function openSummaryFor(id) {
  if (!S.sessions.some(x => x.id === id)) { toast(t('sum.not_found'), true); return; }
  V.summaryId = id;
  nav('summary');
}
function vSummary() {
  if (!P()) return vOnboarding();
  const s = S.sessions.find(x => x.id === V.summaryId);
  if (!s || s.skipped) { V.view = 'dashboard'; return vDashboard(); }
  const block = blockOf(s.b);
  const wmc = s.wmChange;
  return `${topbar(t('sum.title'))}
  <div class="view">
    <div class="mt8">
      <div style="color:${BLOCK_COLORS[block?.type] || 'var(--blue)'};font-weight:600">${esc(block?.label || '')}</div>
      <div style="font-size:1.6rem;font-weight:800">${esc(t('sum.day_done', { week: weeksBefore(s.b) + s.w + 1, day: s.d + 1 }))}</div>
    </div>
    <div class="card accent mt8">
      <div class="row"><span class="subtle">${esc(t('sum.total_tonnage'))}</span><b>${fmtTonnage(s.tonnage)}</b></div>
      <div class="row mt8"><span class="subtle">${esc(t('sum.rating'))}</span><b>${s.rating ? s.rating + ' / 10' : '—'}</b></div>
      ${SHOW_READINESS_UI ? `<div class="row mt8"><span class="subtle">${esc(t('dash.readiness'))}</span><b>${s.readiness != null ? s.readiness.toFixed(2) : '—'}</b></div>` : ''}
      ${wmc ? `<div class="row mt8"><span class="subtle">${esc(t('sum.wm_row', { name: wmc.name }))}</span><b style="color:var(--blue)">${dispW(wmc.from)} → ${fmtWU(wmc.to)}${wmc.capped ? ' ' + esc(t('sum.capped')) : ''}</b></div>` : ''}
    </div>
    ${injuryChips(s)}
    <div class="section-title" style="font-size:1.2rem">${esc(t('sum.sets_logged'))} <span class="faint">${esc(t('sum.actual_vs_target'))}</span></div>
    ${s.entries.map(e => sessionLiftCardHTML(e, true)).join('')}
    <button class="btn btn-green mt16" onclick="nav('dashboard')">${esc(t('sum.back_dash'))}</button>
    <button class="btn btn-outline mt8" onclick="V.tab='history';nav('history')">${esc(t('sum.view_history'))}</button>
  </div>${tabbar()}`;
}
function redoDay(i) {
  const p = P();
  const k = dayKey(p.pointer.block, p.pointer.week, i);
  const sid = p.completedDays[k];
  if (!sid || sid === 'skipped') { startCheckin(i); return; }
  confirmModal({
    title: t('workout.redo_title'),
    message: t('workout.redo_msg'),
    confirmLabel: t('workout.redo_day'),
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
  let list = allExercises().filter(e => exMatches(e, q));
  let body = '';
  if (V.libTab === 'alpha') {
    list.sort((a, b) => exDisplayName(a).localeCompare(exDisplayName(b)));
    let letter = '';
    body = list.map(e => {
      const L = exDisplayName(e)[0].toUpperCase();
      const head = L !== letter ? `<div class="lib-letter">${L}</div>` : '';
      letter = L;
      return head + libItemHTML(e);
    }).join('');
  } else if (V.libTab === 'movements') {
    body = Object.entries(MOVEMENTS).map(([mv, m]) => {
      const items = list.filter(e => e.movement === mv);
      if (!items.length) return '';
      return `<div class="lib-letter">${esc(mvLabel(mv))}</div>` +
        items.sort((a, b) => exDisplayName(a).localeCompare(exDisplayName(b))).map(libItemHTML).join('');
    }).join('');
  } else {
    const used = new Set(Object.keys(S.records));
    const mine = list.filter(e => used.has(e.id) || S.customEx.some(c => c.id === e.id));
    body = mine.length ? mine.sort((a, b) => exDisplayName(a).localeCompare(exDisplayName(b))).map(libItemHTML).join('')
      : `<div class="card mt16"><b>${esc(t('lib.mine_empty_title'))}</b><p class="subtle mt8">${esc(t('lib.mine_empty_body'))}</p></div>`;
    body += `<button class="btn btn-blue mt16" onclick="openCustomEx()">${esc(t('lib.create_custom'))}</button>`;
  }
  return `${topbar(t('lib.title'))}<div class="view">
    <div class="tabs">
      <button class="${V.libTab === 'alpha' ? 'on' : ''}" onclick="libTab('alpha')">${esc(t('lib.tab_alpha'))}</button>
      <button class="${V.libTab === 'movements' ? 'on' : ''}" onclick="libTab('movements')">${esc(t('lib.tab_movements'))}</button>
      <button class="${V.libTab === 'mine' ? 'on' : ''}" onclick="libTab('mine')">${esc(t('lib.tab_mine'))}</button>
    </div>
    <input class="search-input" placeholder="${esc(t('lib.search_ph', { n: allExercises().length }))}" value="${esc(V.libSearch)}"
      oninput="V.libSearch=this.value;render();this.focus();this.setSelectionRange(this.value.length,this.value.length)">
    ${body}
  </div>${tabbar()}`;
}
function libTab(t) { V.libTab = t; render(); }
function libItemHTML(e) {
  const eq = EQUIP_LABEL[e.equipment] ? t('equip.' + e.equipment) : '';
  const best = Engine.bestE1RM(recordsFor(e.id));
  return `<button class="lib-item" onclick="openExDetail('${e.id}')">
    <span>${esc(exDisplayName(e))}${e.isMain ? ' <span style="color:var(--blue)">★</span>' : ''}
      <span class="sub">${esc(mvLabel(e.movement))} · ${esc(eq)}${best ? ' · e1RM ' + dispW(Engine.roundLoad(best, 0.5)) + wUnit() : ''}</span>${exTagsHTML(e)}</span>
    <span>›</span></button>`;
}

// Custom exercise creation (with optional 10RM / 1RM seeding)
function openCustomEx() {
  showModal(anim => {
    $modal.innerHTML = modalShell(anim, t('cx.title'), `
        <div class="field"><label>${esc(t('cx.name'))}</label><input id="cx-name" placeholder="${esc(t('cx.name_ph'))}"></div>
        <div class="field"><label>${esc(t('cx.movement'))}</label>
          <select id="cx-mv">${Object.keys(MOVEMENTS).map(k => `<option value="${k}">${esc(mvLabel(k))}</option>`).join('')}</select></div>
        <div class="field"><label>${esc(t('cx.equipment'))}</label>
          <select id="cx-eq">${['bb', 'db', 'mc', 'cb', 'bw', 'bd'].map(eq => `<option value="${eq}">${esc(t('equip.' + eq))}</option>`).join('')}</select></div>
        <div class="field"><label>${esc(t('cx.rm1', { u: wUnit() }))}</label><input id="cx-1rm" type="number" inputmode="decimal" placeholder="${esc(t('cx.rm1_ph'))}"></div>
        <div class="field"><label>${esc(t('cx.rm10', { u: wUnit() }))}</label><input id="cx-10rm" type="number" inputmode="decimal" placeholder="${esc(t('cx.rm10_ph'))}"></div>
        <button class="btn btn-green" onclick="saveCustomEx()">${esc(t('cx.create'))}</button>`);
  });
}
function saveCustomEx() {
  const name = document.getElementById('cx-name').value.trim();
  if (!name) { toast(t('cx.need_name'), true); return; }
  const id = 'cx-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);
  S.customEx.push({ id, name, movement: document.getElementById('cx-mv').value,
    equipment: document.getElementById('cx-eq').value, isMain: false, custom: true });
  const r1 = fromDispW(parseFloat(document.getElementById('cx-1rm').value));
  const r10 = fromDispW(parseFloat(document.getElementById('cx-10rm').value));
  if (r1 > 0) pushRecord(id, { ts: Date.now(), weight: r1, reps: 1, rpe: 10, seed: true });
  if (r10 > 0) pushRecord(id, { ts: Date.now(), weight: r10, reps: 10, rpe: 10, seed: true });
  save(); closeAllModals(); render();
  toast(t(r1 || r10 ? 'cx.created_seeded_toast' : 'cx.created_toast', { name }));
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
// [i18n phase 5] Coaching cues translate like exercise names: 'cue.<id>_<n>'
// keys (per-exercise) and 'cues.<movement>_<n>' keys (the generic fallback
// above) are layered over the English text at render. The keys are
// deliberately absent from en.js, so English reads straight from data.js and
// an untranslated cue degrades to English, sentence by sentence.
function exCues(e) {
  const perEx = EX_CUES[e.id];
  const base = perEx || CUES[e.movement] || CUES.default;
  const cat = I18N.catalogs[I18N.lang];
  if (!cat) return base;
  const pfx = perEx ? `cue.${e.id}_` : `cues.${CUES[e.movement] ? e.movement : 'default'}_`;
  return base.map((c, i) => cat.strings[pfx + i] || c);
}
// ------------------------------------------------------------
// [Epic H8] EXERCISE MEDIA. A short one-rep clip per exercise id, listed in
// media/manifest.json and lazy-fetched only when a detail modal opens. The
// service worker keeps clips in a separate size-capped cache, NEVER the app
// shell, so the shell stays instant and offline-safe. No manifest, no file,
// or no network: the emoji placeholder stands in, exactly as before.
// Recording/compression/upload guide: docs/exercise-media.md.
// ------------------------------------------------------------
let MEDIA = null; // null = not fetched yet; { items } after (possibly empty)
function ensureMediaManifest() {
  if (MEDIA) return;
  MEDIA = { items: {} }; // set first so a failed fetch never re-loops
  fetch('media/manifest.json')
    .then(r => (r.ok ? r.json() : null))
    .then(m => {
      if (m && m.schemaVersion === 1 && m.items && typeof m.items === 'object') {
        MEDIA = { items: m.items };
        rerenderTop(); // an open detail modal picks its clip up
      }
    })
    .catch(() => {});
}
// media/<file> for a listed id; null otherwise. The filename is validated to a
// plain basename so a hostile manifest can never path-traverse.
function exMediaSrc(id) {
  const f = MEDIA && MEDIA.items && MEDIA.items[id];
  return (typeof f === 'string' && /^[\w][\w.-]*$/.test(f)) ? 'media/' + f : null;
}
// The clip, or '' so the caller keeps the emoji placeholder. A broken file
// removes itself and the placeholder behind it stays the visible state.
function exMediaHTML(id) {
  const src = exMediaSrc(id);
  if (!src) return '';
  return `<video class="ex-media" src="${src}" autoplay muted loop playsinline preload="metadata" onerror="this.remove()"></video>`;
}
function openExDetail(id, tab) {
  XD = { id, tab: tab || 'info' };
  ensureMediaManifest();
  showModal(renderExDetail);
}
function renderExDetail(anim) {
  const e = exById(XD.id);
  if (!e) { closeModal(); return; }
  const recs = recordsFor(XD.id);
  const inc = P()?.increments?.[XD.id] ?? Engine.defaultIncrement(XD.id);
  const tabBtn = id => `<button class="${XD.tab === id ? 'on' : ''}" onclick="XD.tab='${id}';rerenderTop()">${esc(t('xd.tab_' + id))}</button>`;
  let body = '';
  if (XD.tab === 'info') {
    const cues = exCues(e);
    body = `${exMediaHTML(e.id) || '<div class="placeholder-media">🏋</div>'}
      <p class="subtle">${esc(mvLabel(e.movement))} · ${EQUIP_LABEL[e.equipment] ? esc(t('equip.' + e.equipment)) : ''}${e.isMain ? ' · ' + esc(t('xd.main_lift')) : ''}</p>
      ${exMetaCardHTML(e)}
      <div class="section-title" style="font-size:1.1rem">${esc(t('xd.cues_title'))}</div>
      ${cues.map(c => `<div class="check-row">▸ ${c}</div>`).join('')}`;
  } else if (XD.tab === 'history') {
    // Newest first; ✕ deletes a wrong log (a typo here poisons the e1RM that
    // prescribes future weights, so the athlete can clean their own history).
    body = recs.length ? ([...recs].reverse().slice(0, 40).map((r, i) => {
      const idx = recs.length - 1 - i; // index in the stored array
      return `<div class="row" style="padding:9px 0;border-bottom:1px solid var(--line)">
        <span class="subtle">${fmtDate(r.ts)}${r.seed ? ' · ' + esc(t('xd.entered_max')) : ''}${techniqueBadge(r.technique)}${pumpBadge(r.pump)}</span>
        <span><b>${fmtW(XD.id, r.weight)} × ${r.reps} · ${fmtRir(r.rpe)}</b>
          <button class="rec-del" onclick="deleteRecord('${XD.id}',${idx})" aria-label="${esc(t('xd.del_aria'))}">✕</button></span></div>`;
    }).join('') + `<p class="faint mt8">${esc(t('xd.history_hint'))}</p>`)
      : `<p class="faint mt16">${esc(t('xd.no_sets'))}</p>`;
  } else if (XD.tab === 'trend') {
    const e1Series = Engine.e1rmTrend(recs);
    const vlSeries = Engine.volumeLoadTrend(recs);
    body = (e1Series.length < 2 && vlSeries.length < 2)
      ? `<p class="faint mt16">${esc(t('xd.trend_empty'))}</p>`
      : `<div class="section-title" style="font-size:1.05rem">${esc(t('xd.e1rm'))}</div>
        ${trendChartHTML(e1Series, '#67a3ff', v => fmtWU(Engine.roundLoad(v, 0.5)))}
        <div class="section-title" style="font-size:1.05rem">${esc(t('xd.volume_load'))} <small class="faint">${esc(t('xd.vl_sub'))}</small></div>
        ${trendChartHTML(vlSeries, '#4ad6a0', v => fmtTonnage(v))}
        <p class="faint">${esc(t('xd.trend_footer'))}</p>`;
  } else if (XD.tab === 'maxes') {
    const best = Engine.bestE1RM(recs);
    const wm = P()?.wm?.[XD.id];
    // The reference UI: estimated-max curve on top, then dated max milestones
    // (new estimated highs and athlete-entered maxes), then the detail cards.
    const e1Series = Engine.e1rmTrend(recs, 365);
    const chart = e1Series.length >= 2
      ? trendChartHTML(e1Series, '#67a3ff', v => fmtWU(Engine.roundLoad(v, 0.5)))
      : '';
    const miles = Engine.maxMilestones(recs).slice(0, 8);
    const milesHTML = miles.map(m => `
      <div class="max-milestone">
        <div class="row"><span class="subtle">${esc(t(m.kind === 'entered' ? 'xd.max_entered' : 'xd.max_estimated'))}</span>
          <span class="subtle">${fmtDate(m.ts)}</span></div>
        <div class="max-val">${dispW(Engine.roundLoad(m.value, 0.5))}<small> ${wUnit()}</small></div>
      </div>`).join('');
    body = `
      ${chart}
      ${wm ? `<div class="card accent"><div class="row"><span>${esc(t('xd.working_max'))}</span><b>${fmtWU(wm)}</b></div>
        <p class="faint mt8">${esc(t('xd.wm_note'))}</p></div>` : ''}
      <div class="card"><div class="row"><span>${esc(t('xd.e1rm'))}</span><b>${best ? fmtWU(Engine.roundLoad(best, 0.5)) : '—'}</b></div>
        <p class="faint mt8">${esc(t('xd.e1rm_note'))}</p></div>
      ${milesHTML}
      ${recs.length ? `<div class="section-title" style="font-size:1.05rem">${esc(t('xd.best_sets'))}</div>` +
        [...recs].sort((a, b) => Engine.e1rm(b.weight, b.reps, b.rpe) - Engine.e1rm(a.weight, a.reps, a.rpe)).slice(0, 5)
          .map(r => `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)">
            <span class="subtle">${fmtDate(r.ts)}</span>
            <span>${fmtW(XD.id, r.weight)} × ${r.reps} · ${fmtRir(r.rpe)} <b style="color:var(--blue)">→ ${dispW(Engine.roundLoad(Engine.e1rm(r.weight, r.reps, r.rpe), 0.5))}</b></span></div>`).join('') : ''}`;
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
    const modeOpts = ['barbell', 'lightbar', 'dumbbell', 'machine', 'cable', 'bodyweight', 'band'];
    const loadingUI = `
      <div class="section-title" style="font-size:1.05rem">${esc(t('xd.loading_title'))}</div>
      <div class="field"><label>${esc(t('xd.loading_q'))}</label>
        <select id="xd-mode" onchange="xdSetMode(this.value)">${modeOpts.map(v => `<option value="${v}" ${Ld.mode === v ? 'selected' : ''}>${esc(t('load.mode_' + v))}</option>`).join('')}</select></div>
      ${Ld.mode === 'dumbbell' ? `<div class="field"><label>${esc(t('xd.db_used'))}</label>
        <select id="xd-count">${[[2, t('xd.db_two')], [1, t('xd.db_one')]].map(([v, l]) => `<option value="${v}" ${Ld.count === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>` : ''}
      ${Ld.mode === 'lightbar' ? `<div class="field"><label>${esc(t('set.bar_weight'))}</label>
        <input id="xd-bar" type="number" inputmode="decimal" value="${dispW(Ld.barWeight)}"></div>` : ''}
      <p class="faint">${esc(t('xd.loading_note'))}</p>
      <button class="btn btn-blue mt8" onclick="saveExLoading()">${esc(t('xd.save_loading'))}</button>`;
    // [Cluster B] Intensity technique opt-in. Bodybuilding accessories only, so
    // it never reaches the default/powerbuilding path. Today: a finishing drop set.
    const tcd = P() && P().trainingConfig;
    const canTech = tcd && tcd.track === 'bodybuilding' && !isMainLift;
    const techUI = canTech ? `
      <div class="section-title" style="font-size:1.05rem">${esc(t('xd.tech_title'))}</div>
      <label class="check-row"><input type="checkbox" ${(S.techniques || {})[XD.id] === 'drop' ? 'checked' : ''}
        onchange="toggleDropSet('${XD.id}', this.checked)"> ${esc(t('xd.tech_check'))}</label>
      <p class="faint">${esc(t('xd.tech_note'))}</p>` : '';
    // Known maxes: seed a 1RM/10RM so the engine prescribes real weights right
    // away (no calibration week) and the athlete can correct a bad anchor.
    // Saving replaces the previous entry of the same type, so this reads as an
    // editable field, not an append-only log.
    const seed1 = [...recs].reverse().find(r => r.seed && r.reps === 1);
    const seed10 = [...recs].reverse().find(r => r.seed && r.reps === 10);
    const maxesUI = `
      <div class="section-title" style="font-size:1.05rem">${esc(t('xd.known_maxes'))}</div>
      <p class="faint">${esc(t('xd.known_maxes_note'))}${isMainLift ? ' ' + esc(t('xd.known_maxes_main')) : ''}</p>
      <div class="field"><label>${esc(t('xd.rm1_label', { u: wUnit() }))}</label>
        <input id="xd-1rm" type="number" inputmode="decimal" value="${seed1 ? dispW(seed1.weight) : ''}" placeholder="${esc(t('xd.rm1_ph', { n: isLb() ? 265 : 120 }))}"></div>
      <div class="field"><label>${esc(t('xd.rm10_label', { u: wUnit() }))}</label>
        <input id="xd-10rm" type="number" inputmode="decimal" value="${seed10 ? dispW(seed10.weight) : ''}" placeholder="${esc(t('xd.rm10_ph', { n: isLb() ? 200 : 90 }))}"></div>
      <button class="btn btn-blue mt8" onclick="saveExMaxes('${e.id}')">${esc(t('xd.save_maxes'))}</button>`;
    body = `
      ${isMainLift ? `
        <div class="field"><label>${esc(t('xd.wm_label', { u: wUnit() }))}</label>
          <input id="xd-wm" type="number" inputmode="decimal" value="${P().wm[XD.id] != null ? dispW(P().wm[XD.id]) : ''}" placeholder="${esc(t('xd.wm_ph'))}"></div>
        <div class="field"><label>${esc(t('xd.inc_label', { u: wUnit() }))}</label>
          <input id="xd-inc" type="number" inputmode="decimal" step="0.25" value="${dispW(inc)}"></div>
        <p class="faint">${esc(t('xd.inc_note', { low: isLb() ? '5 lb' : '2.5 kg', up: isLb() ? '2.5 lb' : '1.25 kg' }))}</p>
        <button class="btn btn-blue mt8" onclick="saveExSettings()">${esc(t('common.save'))}</button>` :
        `<p class="subtle">${esc(t('xd.e1rm_follow'))}</p>`}
      ${maxesUI}
      ${techUI}
      ${loadingUI}
      ${e.custom ? `<button class="btn btn-outline mt16" style="color:var(--red);border-color:var(--red)" onclick="deleteCustomEx('${e.id}')">${esc(t('xd.delete_custom'))}</button>` : ''}`;
  }
  $modal.innerHTML = modalShell(anim, esc(exDisplayName(e)),
    `<div class="tabs">${tabBtn('info')}${tabBtn('history')}${tabBtn('trend')}${tabBtn('maxes')}${tabBtn('settings')}</div>${body}`);
}
function saveExSettings() {
  const wmv = fromDispW(parseFloat(document.getElementById('xd-wm').value));
  const incv = fromDispW(parseFloat(document.getElementById('xd-inc').value));
  if (wmv > 0) P().wm[XD.id] = wmv;
  if (incv > 0) P().increments[XD.id] = incv;
  refreshDraftTargets(XD.id);
  save(); toast(t('common.saved')); render(); rerenderTop();
}
// Seed / edit known maxes for any exercise. Stored as seeded records (the same
// shape custom-exercise seeding writes), so bestE1RM anchors on them and the
// calibration ramp steps aside from the next session on. Saving replaces the
// previous seed of the same type, which makes the field editable, and an empty
// field clears that seed.
function saveExMaxes(id) {
  const r1 = fromDispW(parseFloat(byId('xd-1rm') && byId('xd-1rm').value));
  const r10 = fromDispW(parseFloat(byId('xd-10rm') && byId('xd-10rm').value));
  if (!(r1 > 0) && !(r10 > 0)) { toast(t('xd.need_rm'), true); return; }
  if (r1 > 0 && r10 > 0 && r10 >= r1) { toast(t('xd.rm_order'), true); return; }
  S.records[id] = recordsFor(id).filter(r => !r.seed); // replace, not append
  if (r1 > 0) pushRecord(id, { ts: Date.now(), weight: r1, reps: 1, rpe: 10, seed: true });
  if (r10 > 0) pushRecord(id, { ts: Date.now(), weight: r10, reps: 10, rpe: 10, seed: true });
  // A main lift's wave weights hang off the working max, so an empty one is
  // seeded too (book guidance: train off about 90 percent of your real max).
  let wmNote = '';
  const p = P();
  if (p && p.wm && id in p.wm && !p.wm[id] && r1 > 0) {
    p.wm[id] = Engine.roundLoad(r1 * 0.9, 1.25);
    wmNote = t('xd.wm_set_note', { w: dispW(p.wm[id]), u: wUnit() });
  }
  refreshDraftTargets(id);
  save();
  toast(t('xd.maxes_saved', { wm: wmNote }));
  render(); rerenderTop();
}
// Remove one wrongly logged set from an exercise's history (by stored index,
// since two records can share a timestamp). The e1RM and every prescribed
// weight recompute from what remains.
function deleteRecord(id, idx) {
  const recs = S.records[id];
  const r = recs && recs[idx];
  if (!r) return;
  confirmModal({
    title: t('xd.del_set_title'),
    message: t('xd.del_set_msg', { set: `${fmtW(id, r.weight)} × ${r.reps}`, date: fmtDate(r.ts) }),
    confirmLabel: t('xd.del_set_confirm'),
    danger: true,
  }, () => { recs.splice(idx, 1); refreshDraftTargets(id); save(); toast(t('xd.set_deleted')); render(); rerenderTop(); });
}
function toggleDropSet(id, on) {
  S.techniques = S.techniques || {};
  if (on) S.techniques[id] = 'drop'; else delete S.techniques[id];
  save(); toast(t(on ? 'xd.drop_on' : 'xd.drop_off')); rerenderTop();
}
function xdSetMode(m) { if (XD.load) XD.load.mode = m; rerenderTop(); }
function saveExLoading() {
  const mode = document.getElementById('xd-mode').value;
  const prof = { mode };
  if (mode === 'dumbbell') prof.count = parseInt(document.getElementById('xd-count').value) || 2;
  if (mode === 'lightbar') prof.barWeight = fromDispW(parseFloat(document.getElementById('xd-bar').value)) || (isLb() ? 25 * KG_PER_LB : 10);
  S.loadingProfiles = S.loadingProfiles || {};
  S.loadingProfiles[XD.id] = prof;
  XD.load = null; // re-init from the saved profile on next render
  save(); toast(t('xd.loading_saved')); rerenderTop();
}
function deleteCustomEx(id) {
  confirmModal({
    title: t('xd.delete_title'),
    message: t('xd.delete_msg'),
    confirmLabel: t('xd.delete_confirm'),
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
// ------------------------------------------------------------
// [Epic H3] VIEW: PROGRESS (longitudinal charts, all derived from logs)
// ------------------------------------------------------------
const BIG_LIFTS = [['comp-squat', '#e8883a'], ['comp-bench', '#4b8df8'],
                   ['comp-deadlift', '#e2483d'], ['military-press', '#3e9a4d']];
// The same fractional attribution the weekly volume bar uses, per exercise id:
// a landmark movement counts in full, a compound spreads via SYNERGIST_COVERAGE.
function exVolumeAttribution(exId) {
  const ex = exById(exId);
  if (!ex) return [];
  if (VOLUME_LANDMARKS[ex.movement]) return [{ mv: ex.movement, f: 1 }];
  const cov = SYNERGIST_COVERAGE[ex.movement];
  return cov ? Object.entries(cov).map(([mv, f]) => ({ mv, f })) : [];
}
// Landmarks in force DURING block b: the snapshot taken at the end of the
// previous block, else the earliest snapshot (closest known past), else the
// live values when no history has accrued yet.
function landmarksForBlock(b) {
  const log = S.landmarkLog || [];
  let best = null;
  for (const snap of log) if (snap.block < b && (!best || snap.block > best.block)) best = snap;
  if (best) return best.landmarks;
  return log.length ? log[0].landmarks : (S.profile.landmarks || {});
}
function pxPick(mv) { V.pxMv = mv; render(); }
function vProgress() {
  if (!P()) return vOnboarding();
  const overlay = overlayChartHTML(BIG_LIFTS.map(([id, color]) => ({
    name: exDisplayName(exById(id)), color,
    points: Engine.e1rmTrend(recordsFor(id), 3650).map(pt => ({ ts: pt.ts, value: Engine.roundLoad(pt.value, 0.5) })),
  })), v => dispW(v));
  const weeks = Engine.actualWeeklySets(S.sessions, exVolumeAttribution);
  const muscles = VOL_ORDER.filter(m => weeks.some(wk => wk.tally[m]));
  const mv = muscles.includes(V.pxMv) ? V.pxMv : muscles[0];
  let setsCard = '';
  if (mv && !hasCoach()) {
    // [Tier debug] The landmark band reads MEV/MRV data only the coach
    // computes; the PR feed and e1RM overlay above/below stay free.
    setsCard = `<div class="section-title">${esc(t('px.sets'))}</div>${coachLockHTML()}`;
  } else if (mv) {
    const chips = muscles.map(m => `<button class="px-chip ${m === mv ? 'on' : ''}" onclick="pxPick('${m}')">${esc(mvLabel(m))}</button>`).join('');
    const pts = weeks.map(wk => {
      const L = landmarksForBlock(wk.b)[mv] || {};
      return { value: wk.tally[mv] || 0, lo: L.mev ?? null, hi: L.mrv ?? null };
    });
    setsCard = `<div class="section-title">${esc(t('px.sets'))} <span class="faint">${esc(t('px.band'))}</span></div>
      <div class="px-chips">${chips}</div>
      <div class="card">${bandChartHTML(pts, '#5aa2f7', v => kg(v))}</div>`;
  }
  // PR feed: every set that put a lift's estimated 1RM at a new all-time high.
  const prs = [];
  for (const e of allExercises()) {
    for (const m of Engine.maxMilestones(recordsFor(e.id))) {
      if (m.kind === 'new') prs.push({ ts: m.ts, value: m.value, name: exDisplayName(e) });
    }
  }
  prs.sort((a, b) => b.ts - a.ts);
  const prRows = prs.slice(0, 8).map(m => `<div class="row" style="padding:7px 0;border-bottom:1px solid var(--line)">
      <span>🏅 ${esc(m.name)}</span><b>${fmtWU(Engine.roundLoad(m.value, 0.5))} <span class="faint">${fmtDate(m.ts)}</span></b></div>`).join('');
  const pump = Engine.pumpSeries(S.sessions);
  const sore = Engine.sorenessSeries(S.checkins);
  return `${topbar(t('px.title'))}<div class="view">
    <div class="section-title">${esc(t('px.e1rm'))} <span class="faint">${wUnit()}</span></div>
    <div class="card">${overlay}</div>
    ${setsCard}
    ${prRows ? `<div class="section-title">${esc(t('px.prs'))}</div><div class="card">${prRows}</div>` : ''}
    ${pump.length ? `<div class="section-title">${esc(t('perf.pump'))}</div><div class="card">${trendChartHTML(pump, '#e2557b', v => v)}</div>` : ''}
    ${sore.length ? `<div class="section-title">${esc(t('px.recovery'))}</div><div class="card">${trendChartHTML(sore, '#4ad6a0', v => v)}</div>` : ''}
  </div>${tabbar()}`;
}
// [Epic H3] Macro-end report: the whole cycle in numbers, all derived from
// records/sessions/snapshots. Shown on the finished-program workout tab and on
// its own view (reachable from History once done).
function macroReportHTML() {
  const p = P();
  const done = S.sessions.filter(s => !s.skipped).length;
  const skipped = S.sessions.filter(s => s.skipped).length;
  const tonnage = S.sessions.reduce((a, s) => a + (s.tonnage || 0), 0);
  const liftRows = BIG_LIFTS.map(([id, color]) => {
    const tr = Engine.e1rmTrend(recordsFor(id).filter(r => r.ts >= p.startDate), 3650);
    if (tr.length < 2) return '';
    const a = Engine.roundLoad(tr[0].value, 0.5), b = Engine.roundLoad(tr[tr.length - 1].value, 0.5);
    return `<div class="row" style="padding:5px 0"><span style="color:${color}">${esc(exDisplayName(exById(id)))}</span>
      <b>${dispW(a)} → ${fmtWU(b)} <span style="color:${b >= a ? '#37c978' : '#e2557b'}">${b >= a ? '▲' : '▼'}</span></b></div>`;
  }).filter(Boolean).join('');
  const amraps = {};
  for (const s of S.sessions) {
    if (s.skipped) continue;
    for (const e of s.entries || []) for (const st of e.sets || []) {
      if (st.amrap && st.done && e.wmKey) {
        const a = amraps[e.wmKey] = amraps[e.wmKey] || { n: 0, best: null };
        a.n++;
        const e1 = Engine.e1rm(st.weight, st.reps, st.rpe);
        if (!a.best || e1 > a.best.e1) a.best = { w: st.weight, r: st.reps, e1 };
      }
    }
  }
  const amrapRows = Object.entries(amraps).map(([id, a]) => `<div class="row" style="padding:5px 0">
      <span>${esc(exDisplayName(exById(id)))}</span><b>${a.n} × AMRAP · ${fmtW(id, a.best.w)} × ${a.best.r}</b></div>`).join('');
  const log = S.landmarkLog || [];
  const lm = S.profile.landmarks || {};
  const mrvRows = log.length ? Object.keys(lm).map(m => {
    const a = log[0].landmarks[m], b = lm[m];
    if (!a || !b || a.mrv === b.mrv) return '';
    return `<div class="row" style="padding:5px 0"><span>${esc(mvLabel(m))}</span>
      <b>MRV ${a.mrv} → ${b.mrv} <span style="color:${b.mrv >= a.mrv ? '#37c978' : '#e2557b'}">${b.mrv >= a.mrv ? '▲' : '▼'}</span></b></div>`;
  }).filter(Boolean).join('') : '';
  return `
    <div class="card accent mt8">
      <div class="row"><span class="subtle">${esc(t('rp.sessions'))}</span><b>${done}${skipped ? ` <span class="faint">· ${esc(t('rp.skipped', { n: skipped }))}</span>` : ''}</b></div>
      <div class="row mt8"><span class="subtle">${esc(t('sum.total_tonnage'))}</span><b>${fmtTonnage(tonnage)}</b></div>
    </div>
    ${liftRows ? `<div class="section-title">${esc(t('rp.e1rm'))} <span class="faint">${wUnit()}</span></div><div class="card">${liftRows}</div>` : ''}
    ${amrapRows ? `<div class="section-title">${esc(t('rp.amraps'))}</div><div class="card">${amrapRows}</div>` : ''}
    ${mrvRows ? `<div class="section-title">${esc(t('rp.mrv'))}</div><div class="card">${mrvRows}</div>` : ''}`;
}
function vReport() {
  if (!P()) return vOnboarding();
  return `${topbar(t('rp.title'))}<div class="view">${macroReportHTML()}
    <button class="btn btn-outline mt16" onclick="nav('progress')">📈 ${esc(t('px.title'))}</button>
  </div>${tabbar()}`;
}

// ------------------------------------------------------------
// [Epic H6] VIEW: MEET DAY. Attempts from the athlete's own e1RM data
// (Engine.attempts), warmups built to the opener with the same plate-aware
// math sessions use, one rest hint. Reachable while a taper block runs.
// ------------------------------------------------------------
function vMeet() {
  if (!P()) return vOnboarding();
  if (!hasCoach()) return coachLockView(t('meet.title')); // [Tier debug]
  const p = P();
  const cards = ['comp-squat', 'comp-bench', 'comp-deadlift'].map(id => {
    const e1 = Engine.bestE1RM(recordsFor(id)) || (p.wm[id] ? p.wm[id] / 0.9 : null);
    if (!e1) return '';
    const L = loadingFor(id);
    const at = Engine.attempts(e1, L.totalInc);
    const wus = Engine.warmupSets(at.opener, L.barWeight || S.profile.barWeight, S.profile.rounding);
    return `<div class="card">
      <div class="row"><b>${esc(exDisplayName(exById(id)))}</b>
        <span class="faint">e1RM ${fmtWU(Engine.roundLoad(e1, 0.5))}</span></div>
      <div class="meet-attempts">
        ${[at.opener, at.second, at.third].map((w, i) => `
          <div class="meet-attempt ${i === 0 ? 'opener' : ''}"><span>${i + 1}</span><b>${dispW(w)}</b></div>`).join('')}
        <span class="faint">${wUnit()}</span>
      </div>
      <div class="faint">↳ ${wus.map(s => `${dispW(s.weight)}×${s.reps}`).join(' · ')}</div>
    </div>`;
  }).filter(Boolean).join('');
  return `${topbar(t('meet.title'))}<div class="view">
    ${p.meetDate ? `<div class="subtle" style="margin:4px 0 2px">${fmtDateLong(p.meetDate)}</div>` : ''}
    <p class="faint" style="margin-bottom:12px">${esc(t('meet.rest_hint'))}</p>
    ${cards || `<p class="faint">${esc(t('chart.empty'))}</p>`}
  </div>${tabbar()}`;
}

function vMore() {
  const link = (label, ic, fn) => `<button class="lib-item" onclick="${fn}">
    <span><span style="margin-right:10px">${ic}</span>${esc(label)}</span><span>›</span></button>`;
  return `${topbar(t('tab.more'))}<div class="view">
    <div class="section-title">${esc(S.profile.name || t('more.lifter'))}</div>
    <p class="faint" style="margin-bottom:14px">${esc(t('more.tagline'))}</p>
    ${link(t('dash.my_program'), '📈', "nav('program')")}
    ${link(t('px.title'), '🏅', "nav('progress')")}
    ${link(t('vol.title'), '📊', 'openVolumeDashboard()')}
    ${link(t('phase.screen_title'), '🍽', 'openPhase()')}
    ${link(t('lib.title'), '🏋', "nav('exercises')")}
    ${link(t('more.settings'), '⚙', "nav('settings')")}
    <p class="faint" style="margin-top:18px;text-align:center;font-size:12px">${esc(t('more.version', { v: APP_VERSION }))}</p>
  </div>${tabbar()}`;
}

// ------------------------------------------------------------
// [Epic H5] SPLIT EDITOR (bodybuilding): the generated split is editable, not
// disposable. Edits the SAME days[].slots[] shape the generator emits (no
// parallel format), validated live: per-muscle weekly frequency vs the slider
// target and a per-day time estimate. Mains/secondaries stay anchored (they
// theme the day and key the working max); accessories move freely.
// ------------------------------------------------------------
// Slider-keyed muscles present on a day (same reverse map the generator uses).
function splitDayMuscles(d) {
  const out = new Set();
  for (const sl of d.slots) {
    const mv = (sl.type === 'main' || sl.type === 'secondary')
      ? (exById(sl.ex || sl.lift) || {}).movement : sl.cat;
    const key = MOVEMENT_SLIDER[mv];
    if (key) out.add(key);
  }
  return out;
}
// Per-muscle chips: trained days vs the slider's frequency target, amber when short.
function seFreqChips() {
  const p = P();
  const focus = (p.trainingConfig && p.trainingConfig.muscleFocus) || {};
  const perDay = p.days.map(splitDayMuscles);
  return `<div class="px-chips">${FOCUS_KEYS.filter(k => SPLIT_FREQ[focus[k]]).map(k => {
    const target = splitFreqFor(focus[k], p.daysPerWeek || p.days.length);
    const actual = perDay.filter(s => s.has(k)).length;
    return `<span class="px-chip ${actual < target ? 'warn' : ''}">${esc(t('muscle.' + k))} ${actual}/${target}x</span>`;
  }).join('')}</div>`;
}
function openSplitEditor() { showModal(renderSplitEditor); }
function renderSplitEditor(anim) {
  const p = P();
  const b = p.pointer.block, w = p.pointer.week;
  const cards = p.days.map((d, di) => {
    const est = Math.round(estimateSessionSec(resolveDayEntries(di, b, w).items.map(x => x.rs), false) / 60);
    const rows = d.slots.map((sl, si) => {
      const rs = resolveSlot(sl, b, w);
      if (rs.isRemoved) return '';
      const nm = rs.exId ? exDisplayName(exById(rs.exId)) : mvLabel(sl.cat);
      const anchored = sl.type === 'main' || sl.type === 'secondary';
      const mover = anchored ? '<span class="faint">⚓</span>'
        : `<select class="se-move" onchange="seMove(${di},${si},this.value)">
            ${p.days.map((_, dj) => `<option value="${dj}" ${dj === di ? 'selected' : ''}>${esc(t('common.day_n', { n: dj + 1 }))}</option>`).join('')}
          </select>`;
      return `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--line)">
        <span>${esc(nm)}</span>${mover}</div>`;
    }).join('');
    return `<div class="card">
      <div class="row" style="gap:8px">
        <input class="se-name" value="${esc(dayTheme(d) || '')}" placeholder="${esc(t('common.day_n', { n: di + 1 }))}"
          onchange="seRename(${di}, this.value)">
        <span class="faint" style="white-space:nowrap">~${est}m</span>
        ${p.days.length > 1 ? `<button class="btn-ghost" style="color:var(--red)" onclick="seRemoveDay(${di})">✕</button>` : ''}
      </div>
      ${rows}</div>`;
  }).join('');
  $modal.innerHTML = modalShell(anim, t('se.title'),
    `${bbTrack() ? seFreqChips() : ''}${cards}
     ${p.days.length < 7 ? `<button class="btn btn-outline" onclick="seAddDay()">＋ ${esc(t('se.add_day'))}</button>` : ''}`);
}
function seMove(di, si, dj) {
  dj = parseInt(dj);
  if (dj === di) return;
  const p = P();
  const [sl] = p.days[di].slots.splice(si, 1);
  p.days[dj].slots.push(sl);
  save(); rerenderTop();
}
function seRename(di, v) {
  const d = P().days[di];
  d.name = v.trim();
  delete d.theme; delete d.nameKey; // the typed name wins everywhere dayTheme reads
  save();
}
function seAddDay() {
  const p = P();
  if (p.days.length >= 7) { toast(t('se.max_days'), true); return; }
  p.days.push({ name: '', slots: [] });
  p.daysPerWeek = p.days.length;
  // [Calendar days] Keep the weekday map index-aligned; a hand-added day starts
  // unscheduled (wd null) until the sports epic gives it a placement UI.
  if (Array.isArray(p.schedule)) p.schedule.push({ wd: null, sport: false });
  save(); rerenderTop();
}
function seRemoveDay(di) {
  const p = P();
  const doIt = () => {
    p.days.splice(di, 1);
    p.daysPerWeek = p.days.length;
    if (Array.isArray(p.schedule)) p.schedule.splice(di, 1); // [Calendar days] stay index-aligned
    // Re-key the current week's completion marks past the removed index so a
    // finished day stays locked as the days shift left.
    const b = p.pointer.block, w = p.pointer.week;
    delete p.completedDays[dayKey(b, w, di)];
    for (let i = di + 1; i <= p.days.length; i++) {
      const v = p.completedDays[dayKey(b, w, i)];
      delete p.completedDays[dayKey(b, w, i)];
      if (v) p.completedDays[dayKey(b, w, i - 1)] = v;
    }
    if (V.dayIdx != null && V.dayIdx >= p.days.length) V.dayIdx = 0;
    save(); rerenderTop();
  };
  if (!p.days[di].slots.length) return doIt();
  confirmModal({ title: t('se.remove_title'), message: t('se.remove_msg'), danger: true,
    confirmLabel: t('se.remove_confirm') }, doIt);
}
// ------------------------------------------------------------
// [Epic H5] MID-MACRO FOCUS RE-SPEC: sliders are editable again. The new focus
// is stored on the program (transient, like deloadPlan) and applied at the next
// block boundary, where endBlock regenerates the split: working maxes and
// landmarks are untouched, volAdj was just reset (resensitization), so the new
// split re-ramps from MEV. No mid-block day mutation.
// ------------------------------------------------------------
function openFocusEditor() {
  V.feDraft = Object.assign({}, (P().pendingFocus || P().trainingConfig.muscleFocus));
  showModal(renderFocusEditor);
}
function renderFocusEditor(anim) {
  const rows = FOCUS_KEYS.map(k => `
    <div class="focus-row">
      <div class="row"><span>${esc(t('muscle.' + k))}</span><b id="fe-val-${k}">${V.feDraft[k]}</b></div>
      <input type="range" min="0" max="6" step="1" value="${V.feDraft[k]}" oninput="feSlider('${k}', this.value)">
    </div>`).join('');
  $modal.innerHTML = modalShell(anim, t('fe.title'), `
    ${rows}
    <p class="faint">${esc(t('fe.next_block'))}</p>
    <button class="btn btn-blue" onclick="feSave()">${esc(t('common.save'))}</button>`);
}
function feSlider(k, v) {
  V.feDraft[k] = parseInt(v);
  const el = byId('fe-val-' + k); if (el) el.textContent = v;
}
function feSave() {
  P().pendingFocus = Object.assign({}, V.feDraft);
  V.feDraft = null;
  save(); closeAllModals(); render();
  toast(t('fe.saved'));
}

// ------------------------------------------------------------
// [Epic H7] PROGRAM TEMPLATES: sharing a program is sharing a file. A
// versioned JSON describes blocks (scheme / wave / weeks / phase) and
// day/slot layouts and NOTHING else: templates CONFIGURE registered schemes,
// set math never travels in a file (a new methodology is still a code-level
// registerScheme), and there is no wm/records field by design, so a shared
// template never carries someone else's numbers.
// ------------------------------------------------------------
const TEMPLATE_SCHEMA_VERSION = 1;
// The template object for the CURRENT program (pure; the export button wraps
// it in a file download).
function programTemplate() {
  const p = P();
  const track = (p.trainingConfig && p.trainingConfig.track) || 'powerbuilding';
  return {
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    name: `${t('track.' + track)} · ${p.daysPerWeek}d`,
    track,
    weeksPerBlock: p.weeksPerBlock,
    blocks: p.blocks.map(b => Object.assign(
      { type: b.type, wave: b.wave },
      b.scheme ? { scheme: b.scheme } : {},
      b.weeks ? { weeks: b.weeks } : {},
      b.phase ? { phase: b.phase } : {},
      b.label ? { label: b.label } : {})),
    days: p.days.map(d => ({
      name: dayTheme(d) || '',
      slots: d.slots.map(sl => {
        if (sl.type === 'main' || sl.type === 'secondary') {
          return Object.assign({ type: sl.type, lift: sl.lift },
            sl.baseLift ? { baseLift: sl.baseLift } : {}, sl.pctMod ? { pctMod: sl.pctMod } : {});
        }
        return Object.assign({ type: sl.type === 'select' ? 'select' : 'acc' },
          sl.cat ? { cat: sl.cat } : {}, (sl.ex || sl.def) ? { def: sl.ex || sl.def } : {});
      }),
    })),
  };
}
function exportProgramTemplate() {
  const tpl = programTemplate();
  const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ironwave-template-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(t('tpl.exported'));
}
// Imports validate against the schema version and the REGISTERED scheme ids /
// wave tables / exercise catalog, and reject the rest with the reason.
function validateTemplate(tpl) {
  const bad = reason => ({ error: reason });
  if (!tpl || typeof tpl !== 'object' || Array.isArray(tpl)) return bad('not a template object');
  if (tpl.schemaVersion !== TEMPLATE_SCHEMA_VERSION) return bad(`schemaVersion ${tpl.schemaVersion}, expected ${TEMPLATE_SCHEMA_VERSION}`);
  if (!Array.isArray(tpl.blocks) || !tpl.blocks.length || tpl.blocks.length > 24) return bad('blocks: 1 to 24 required');
  for (const b of tpl.blocks) {
    if (!b || typeof b !== 'object') return bad('block shape');
    if (b.scheme && !Engine.schemes[b.scheme]) return bad(`unknown scheme "${b.scheme}"`);
    if (!b.scheme && b.type !== 'hypertrophy' && b.type !== 'strength') return bad(`block type "${b.type}" needs an explicit scheme`);
    if (!WAVES[b.wave]) return bad(`unknown wave "${b.wave}"`);
    if (b.weeks != null && !(Number.isInteger(b.weeks) && b.weeks >= 1 && b.weeks <= 8)) return bad(`block weeks ${b.weeks}`);
    if (b.phase && !PHASES.includes(b.phase) && b.phase !== 'peak' && b.phase !== 'gain') return bad(`unknown phase "${b.phase}"`);
  }
  if (!Array.isArray(tpl.days) || !tpl.days.length || tpl.days.length > 7) return bad('days: 1 to 7 required');
  for (const d of tpl.days) {
    if (!d || !Array.isArray(d.slots) || d.slots.length > 12) return bad('day slots: up to 12');
    for (const sl of d.slots) {
      if (!sl || typeof sl !== 'object') return bad('slot shape');
      if (sl.type === 'main' || sl.type === 'secondary') {
        if (!exById(sl.lift)) return bad(`unknown lift "${sl.lift}"`);
      } else if (sl.type === 'acc' || sl.type === 'select') {
        if (sl.def && !exById(sl.def)) return bad(`unknown exercise "${sl.def}"`);
        if (sl.cat && !MOVEMENTS[sl.cat]) return bad(`unknown movement "${sl.cat}"`);
        if (!sl.def && !sl.cat) return bad('slot needs def or cat');
      } else return bad(`slot type "${sl.type}"`);
    }
  }
  return { ok: true };
}
// A NEW program from a validated template plus the athlete's own profile.
// Records and landmarks stay (they are the athlete's); working maxes start
// null and recalibrate, exactly like a fresh onboarding without maxes.
function programFromTemplate(tpl) {
  const blocks = tpl.blocks.map(b => Object.assign(
    { type: b.type, wave: b.wave },
    b.scheme ? { scheme: b.scheme } : {},
    b.weeks ? { weeks: b.weeks } : {},
    b.phase ? { phase: b.phase } : {},
    b.label ? { label: b.label } : {}));
  stampMesoIdx(blocks);
  stampBlockPhase(blocks);
  relabelBlocks(blocks);
  const start = Date.now();
  const days = tpl.days.map((d, i) => ({ name: d.name || `Day ${i + 1}`,
    slots: d.slots.map(sl => Object.assign({}, sl)) }));
  const wm = {}, increments = {};
  for (const lift of ['comp-squat', 'comp-bench', 'comp-deadlift', 'military-press']) {
    wm[lift] = null;
    increments[lift] = Engine.defaultIncrement(lift);
  }
  const track = OB_TRACKS.includes(tpl.track) ? tpl.track : 'powerbuilding';
  const wpb = Number.isInteger(tpl.weeksPerBlock) && tpl.weeksPerBlock >= 2 && tpl.weeksPerBlock <= 8
    ? tpl.weeksPerBlock : 5;
  return {
    template: 'custom', daysPerWeek: days.length,
    methodology: 'Juggernaut + Bodybuilding',
    startDate: start,
    testDate: start + blocks.reduce((a, b) => a + (b.weeks || wpb), 0) * 7 * 864e5,
    blocks, weeksPerBlock: wpb,
    pointer: { block: 0, week: 0 },
    days, wm, increments,
    completedDays: {}, weekMod: null, volAdj: {}, belowStd: {},
    trainingConfig: {
      track, goalArchetype: null, timeMode: 'unlimited', timeCapMin: null,
      muscleFocus: Object.assign({ arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 },
        (S.profile.training && S.profile.training.muscleFocus) || {}),
    },
  };
}
function importTemplate(input) {
  const f = input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const tpl = JSON.parse(reader.result);
      const v = validateTemplate(tpl);
      if (v.error) { toast(t('tpl.invalid', { err: v.error }), true); return; }
      confirmModal({
        title: t('tpl.import_title'),
        message: t('tpl.import_msg', { name: tpl.name || '?', blocks: tpl.blocks.length, days: tpl.days.length }),
        confirmLabel: t('tpl.import_confirm'), danger: true,
      }, () => {
        S.program = programFromTemplate(tpl);
        V.dayIdx = null; V.draft = null;
        save(); render();
        toast(t('tpl.imported'));
      });
    } catch (e) { toast(t('tpl.invalid', { err: e.message }), true); }
  };
  reader.readAsText(f);
  input.value = '';
}

function vProgram() {
  if (!P()) return vOnboarding();
  if (!hasCoach()) return coachLockView(t('dash.my_program')); // [Tier debug]
  const p = P();
  const lifts = ['comp-squat', 'comp-bench', 'comp-deadlift', 'military-press'];
  const blockRows = p.blocks.map((b, i) => {
    const startW = weeksBefore(i) + 1;
    const status = i < p.pointer.block ? '✓' : i === p.pointer.block && !programDone() ? '●' : '○';
    const sch = Engine.schemeFor(b);
    // Same emphasis color as the timeline bars (a cut block reads teal, a peak
    // red), plus the phase word, so the list and the chart tell one story.
    const c = barColorFor(b);
    const ph = blockPhase(b);
    return `<div class="row" style="padding:10px 0 10px 8px;border-bottom:1px solid var(--line);border-left:3px solid ${c}">
      <span><b style="color:${c}">${status}</b> ${esc(b.label)}
        <span class="faint">· ${esc(t('common.wave', { w: b.wave }))} · ${esc(sch.short || sch.label)} · <span style="color:${c}">${esc(phaseLabel(ph))}</span></span></span>
      <span class="subtle">${esc(t('prog.week_range', { a: startW, b: startW + blockWeeks(b) - 1 }))}</span></div>`;
  }).join('');
  const track = (p.trainingConfig && p.trainingConfig.track) || 'powerbuilding';
  return `${topbar(t('dash.my_program'))}<div class="view">
    <div class="section-title">${esc(t('track.' + track))}</div>
    <p class="faint" style="margin:-4px 0 10px">${esc(t('prog.methodology', { m: p.methodology || 'Juggernaut + Bodybuilding' }))}</p>
    <div class="card">
      <div class="row"><span class="subtle">${esc(t('prog.test_date'))}</span><b>${fmtDateLong(p.testDate)}</b></div>
      <div class="row mt8"><span class="subtle">${esc(t('prog.days_out_row'))}</span><b>${daysOut()}</b></div>
      <div class="row mt8"><span class="subtle">${esc(t('prog.days_week'))}</span><b>${p.daysPerWeek}</b></div>
    </div>
    <div class="btn-row mt8">
      <button class="btn btn-outline" onclick="openSplitEditor()">✎ ${esc(t('se.title'))}</button>
      ${track === 'bodybuilding' ? `<button class="btn btn-outline" onclick="openFocusEditor()">${esc(t('fe.title'))}${p.pendingFocus ? ' ●' : ''}</button>` : ''}
    </div>
    <div class="btn-row">
      <button class="btn btn-outline" onclick="exportProgramTemplate()">${esc(t('tpl.export'))}</button>
      <button class="btn btn-outline" onclick="document.getElementById('tpl-file').click()">${esc(t('tpl.import'))}</button>
    </div>
    <input type="file" id="tpl-file" accept=".json,application/json" style="display:none" onchange="importTemplate(this)">
    ${timelineHTML()}
    <div class="section-title" style="font-size:1.15rem">${esc(t('prog.blocks'))}</div>
    ${blockRows}
    <p class="faint mt8">${esc(t('prog.blocks_note'))}</p>
    <div class="section-title" style="font-size:1.15rem">${esc(t('prog.working_maxes'))}</div>
    ${lifts.map(l => `<button class="lib-item" onclick="openExDetail('${l}','settings')">
      <span>${esc(exName(l))}</span><b>${p.wm[l] ? fmtWU(p.wm[l]) : esc(t('prog.calibrating'))}</b></button>`).join('')}
    <button class="btn btn-outline mt24" style="color:var(--red);border-color:var(--red)" onclick="confirmNewProgram()">${esc(t('dash.new_program_confirm'))}</button>
  </div>${tabbar()}`;
}
function confirmNewProgram() {
  confirmModal({
    title: t('dash.new_program_title'),
    message: t('dash.new_program_msg'),
    confirmLabel: t('dash.new_program_confirm'),
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
  // [Calendar days] Carry the weekday map and sport flags into the new cycle,
  // like the day count; a legacy program without one stays count-only.
  const sched = Array.isArray(P()?.schedule) ? P().schedule.filter(x => x && x.wd != null) : [];
  V.ob = { name: S.profile.name, bodyweight: S.profile.bodyweight,
           daysPerWeek: P()?.daysPerWeek || 4, maxes: keepMaxes,
           trainingDays: sched.map(x => x.wd),
           sportDays: sched.filter(x => x.sport).map(x => x.wd),
           daysMode: sched.length ? 'calendar' : 'count',
           track: tr.track || 'powerbuilding',
           goalArchetype: tr.goalArchetype || null,
           experience: S.profile.experience || 'intermediate',
           timeMode: tr.timeMode || 'unlimited',
           timeCapMin: tr.timeCapMin || '',
           muscleFocus: Object.assign({ arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 }, tr.muscleFocus || {}) };
  S.program = makeProgram(V.ob);
  save(); toast(t('dash.new_cycle_toast'));
  V.tab = 'dashboard'; nav('dashboard');
}

function vSettings() {
  const p = S.profile;
  const langOptions = [`<option value="auto" ${(p.lang || 'auto') === 'auto' ? 'selected' : ''}>${esc(t('settings.language_auto'))}</option>`]
    .concat(Object.values(I18N.catalogs).map(c =>
      `<option value="${c.code}" ${p.lang === c.code ? 'selected' : ''}>${esc(c.name)}</option>`)).join('');
  return `${topbar(t('set.title'))}<div class="view">
    <div class="section-title">${esc(t('settings.language'))}</div>
    <div class="field"><label>${esc(t('settings.language'))}</label>
      <select id="st-lang" onchange="setAppLang(this.value)">${langOptions}</select></div>
    <p class="faint" style="margin-bottom:10px">${esc(t('settings.language_hint'))}</p>
    <div class="section-title">${esc(t('set.units_section'))}</div>
    <div class="field"><label>${esc(t('set.units'))}</label>
      <select id="st-units" onchange="setUnits(this.value)">
        <option value="kg" ${!isLb() ? 'selected' : ''}>${esc(t('set.units_kg'))}</option>
        <option value="lb" ${isLb() ? 'selected' : ''}>${esc(t('set.units_lb'))}</option>
      </select></div>
    <div class="field"><label>${esc(t('set.intensity'))}</label>
      <select id="st-int" onchange="setIntensityDisplay(this.value)">
        <option value="rir" ${!isRpe() ? 'selected' : ''}>${esc(t('set.intensity_rir'))}</option>
        <option value="rpe" ${isRpe() ? 'selected' : ''}>${esc(t('set.intensity_rpe'))}</option>
      </select></div>
    <p class="faint" style="margin-bottom:10px">${esc(t('set.units_hint'))}</p>
    <div class="section-title">${esc(t('set.profile'))}</div>
    <div class="field"><label>${esc(t('cx.name'))}</label><input id="st-name" value="${esc(p.name)}"></div>
    <div class="field"><label>${esc(t('ob.bodyweight', { u: wUnit() }))}</label><input id="st-bw" type="number" inputmode="decimal" value="${p.bodyweight != null ? dispW(p.bodyweight) : ''}"></div>
    <div class="section-title">${esc(t('equip.bb'))}</div>
    <div class="field"><label>${esc(t('set.bar_weight', { u: wUnit() }))}</label><input id="st-bar" type="number" inputmode="decimal" value="${dispW(p.barWeight)}"></div>
    <div class="field"><label>${esc(t('set.rounding', { u: wUnit() }))}</label>
      <select id="st-round">${presetOptions('rounding', p.rounding)}</select></div>
    <div class="section-title">${esc(t('set.db_mc'))}</div>
    <div class="field"><label>${esc(t('set.db_inc', { u: wUnit() }))}</label>
      <select id="st-dbinc">${presetOptions('dbIncrement', p.dbIncrement ?? 2.5)}</select></div>
    <div class="field"><label>${esc(t('set.mc_step', { u: wUnit() }))}</label>
      <select id="st-mcstep">${presetOptions('machineStep', p.machineStep ?? 5)}</select></div>
    <button class="btn btn-outline" onclick="openPlateConfig()">${esc(t('plates.configure'))}</button>
    <button class="btn btn-blue mt8" onclick="saveSettings()">${esc(t('set.save'))}</button>
    <div class="section-title">${esc(t('set.data'))}</div>
    <p class="faint" style="margin-bottom:10px">${esc(t('set.data_note'))}</p>
    <div class="btn-row">
      <button class="btn btn-outline" onclick="exportData()">${esc(t('set.export'))}</button>
      <button class="btn btn-outline" onclick="document.getElementById('import-file').click()">${esc(t('set.import'))}</button>
    </div>
    <input type="file" id="import-file" accept=".json,application/json" style="display:none" onchange="importData(this)">
    <button class="btn btn-outline mt16" style="color:var(--red);border-color:var(--red)" onclick="fullReset()">${esc(t('set.erase'))}</button>
    <div class="section-title">${esc(t('set.rest_timer'))}</div>
    <label class="check-row"><input type="checkbox" ${p.restNotify ? 'checked' : ''} onchange="toggleRestNotify(this.checked)"> ${esc(t('set.rest_notify'))}</label>
    <p class="faint" style="margin-bottom:10px">${esc(t('set.rest_notify_note'))}</p>
    <div class="section-title">${esc(t('set.about'))}</div>
    <p class="faint" style="margin-bottom:10px">${esc(t('set.about_note', { v: APP_VERSION }))}</p>
    <button class="btn btn-outline" onclick="checkForUpdate()">${esc(t('set.check_updates'))}</button>
    <div class="section-title">${esc(t('set.debug_chime'))}</div>
    <p class="faint" style="margin-bottom:10px">${esc(t('set.debug_chime_note'))}</p>
    ${CHIME_CONFIGS.map(c => `
      <button class="btn btn-outline mt8" onclick="playTestChime('${c.id}')">${esc(c.label)}</button>
      <p class="faint" style="margin:4px 0 0">${esc(c.desc)}</p>`).join('')}
    <div class="section-title">${esc(t('set.dev_tier'))}</div>
    <p class="faint" style="margin-bottom:10px">${esc(t('set.dev_tier_note'))}</p>
    <div class="seg seg-sm">
      <button class="${hasCoach() ? 'on' : ''}" onclick="setDebugTier('coach')">${esc(t('tier.coach'))}</button>
      <button class="${hasCoach() ? '' : 'on'}" onclick="setDebugTier('free')">${esc(t('tier.free'))}</button>
    </div>
  </div>${tabbar()}`;
}
// Force the service worker to look for a newer build and, if one installs, take
// over and reload so the athlete is on the latest code. Without this an installed
// PWA only updates on its own schedule, which is why a fix can seem "not there yet".
async function checkForUpdate() {
  if (!('serviceWorker' in navigator)) { toast(t('set.upd_browser')); return; }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) { toast(t('set.upd_none')); return; }
    toast(t('set.upd_checking'));
    await reg.update();
    const incoming = reg.installing || reg.waiting;
    if (incoming) {
      incoming.addEventListener('statechange', () => {
        if (incoming.state === 'installed' || incoming.state === 'activated') location.reload();
      });
      if (incoming.state === 'installed' || incoming.state === 'activated') location.reload();
    } else {
      toast(t('set.upd_latest', { v: APP_VERSION }));
    }
  } catch (_) { toast(t('set.upd_failed')); }
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
// [Epic H1] Preset <option>s for the equipment steps. The lists live in
// UNIT_PRESETS in DISPLAY units; the option value is the display number and the
// stored kg value is matched by converting back. A customized stored value that
// matches no preset gets its own option, so opening Settings never silently
// re-rounds someone's equipment.
function presetOptions(key, storedKg) {
  const list = UNIT_PRESETS[isLb() ? 'lb' : 'kg'][key];
  const near = (a, b) => Math.abs(a - b) < 0.005;
  const opts = list.map(r =>
    `<option value="${r}" ${near(fromDispW(r), storedKg) ? 'selected' : ''}>${r}</option>`);
  if (!list.some(r => near(fromDispW(r), storedKg))) {
    opts.unshift(`<option value="${toDispW(storedKg)}" selected>${dispW(storedKg)}</option>`);
  }
  return opts.join('');
}
// [Epic H1] Switch display units. Storage stays kg: only rendering and input
// parsing change. Equipment values still sitting at the OLD unit's defaults
// follow to the new unit's defaults (an lb athlete almost certainly lifts with
// a 45 lb bar and lb plates); anything customized is kept and renders converted.
function applyUnits(u) {
  const p = S.profile;
  const from = UNIT_EQUIP_DEFAULTS[p.units === 'lb' ? 'lb' : 'kg'];
  const to = UNIT_EQUIP_DEFAULTS[u];
  if (!to || (p.units || 'kg') === u) return false;
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  let swapped = false;
  if (near(p.barWeight, from.barWeight)) { p.barWeight = to.barWeight; swapped = true; }
  if (near(p.rounding, from.rounding)) { p.rounding = to.rounding; swapped = true; }
  if (near(p.dbIncrement ?? 2.5, from.dbIncrement)) { p.dbIncrement = to.dbIncrement; swapped = true; }
  if (near(p.machineStep ?? 5, from.machineStep)) { p.machineStep = to.machineStep; swapped = true; }
  const samePlates = Array.isArray(p.plates) && p.plates.length === from.plates.length &&
    p.plates.every((pl, i) => near(pl.w, from.plates[i].w) && pl.count === from.plates[i].count);
  if (samePlates) { p.plates = JSON.parse(JSON.stringify(to.plates)); swapped = true; }
  p.units = u;
  return swapped;
}
function setUnits(u) {
  if ((S.profile.units || 'kg') === u) return;
  const swapped = applyUnits(u);
  save(); render();
  toast(t(swapped ? 'set.units_swapped' : 'set.units_saved', { u: t(u === 'lb' ? 'unit.lb' : 'unit.kg') }));
}
// [Epic H1] Effort display: RIR (default) or RPE. Storage stays RPE either way.
function setIntensityDisplay(v) {
  S.profile.intensityDisplay = v === 'rpe' ? 'rpe' : 'rir';
  save(); render();
  toast(t('set.intensity_saved'));
}
function saveSettings() {
  const D = UNIT_EQUIP_DEFAULTS[isLb() ? 'lb' : 'kg'];
  S.profile.name = document.getElementById('st-name').value.trim();
  S.profile.bodyweight = fromDispW(parseFloat(document.getElementById('st-bw').value)) || null;
  S.profile.barWeight = fromDispW(parseFloat(document.getElementById('st-bar').value)) || D.barWeight;
  S.profile.rounding = fromDispW(parseFloat(document.getElementById('st-round').value)) || D.rounding;
  S.profile.dbIncrement = fromDispW(parseFloat(document.getElementById('st-dbinc').value)) || D.dbIncrement;
  S.profile.machineStep = fromDispW(parseFloat(document.getElementById('st-mcstep').value)) || D.machineStep;
  save(); toast(t('set.saved_toast'));
}
function openPlateConfig() { showModal(renderPlateConfig); }
function renderPlateConfig(anim) {
  const rows = S.profile.plates.map((pl, i) => `
    <div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)">
      <span><i style="display:inline-block;width:14px;height:22px;border-radius:3px;background:${plateColorFor(pl.w)};vertical-align:middle;margin-right:10px"></i><b>${fmtWU(pl.w)}</b></span>
      <span class="row" style="gap:14px">
        <button class="pm btn-ghost" style="font-size:1.4rem" onclick="plateCount(${i},-2)">−</button>
        <b id="pc-count-${i}">${pl.count}</b>
        <button class="pm btn-ghost" style="font-size:1.4rem" onclick="plateCount(${i},2)">＋</button>
      </span></div>`).join('');
  $modal.innerHTML = modalShell(anim, t('plates.title'),
    `<p class="faint" style="margin-bottom:10px">${esc(t('plates.config_note'))}</p>${rows}`);
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
  toast(t('set.backup_exported'));
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
      toast(t('set.backup_restored'));
      V = { view: S.program ? 'dashboard' : 'onboarding', tab: 'dashboard', dayIdx: null,
            libTab: 'alpha', libSearch: '', obStep: 0, ob: null, draft: null };
      render();
    } catch (e) { toast(t('set.import_failed', { err: e.message }), true); }
  };
  reader.readAsText(f);
  input.value = '';
}
function fullReset() {
  // Two-stage confirm for the most destructive action in the app.
  confirmModal({
    title: t('set.erase_title'),
    message: t('set.erase_msg'),
    confirmLabel: t('set.continue'),
    danger: true,
  }, () => confirmModal({
    title: t('set.erase_title2'),
    message: t('set.erase_msg2'),
    confirmLabel: t('set.erase'),
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

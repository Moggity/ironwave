/* ============================================================
   IRONWAVE — test/load-app.js
   Loads the three browser scripts (data.js, engine.js, app.js) so
   tests can call the engine directly, with no build step and no real
   DOM.

   The app is plain non-module browser JS: every file shares one
   global scope. We reproduce that by wrapping the concatenated
   sources in a single function and compiling it in the *current*
   realm (vm.runInThisContext), so cross-file references (Engine,
   WAVES, EXERCISES, S, ...) resolve as they do in the browser AND the
   objects the engine returns are this-realm native — so node:test's
   deepStrictEqual compares them by structure, not across realms.

   The browser globals the app touches at load time (window, document,
   fetch) are passed in as function parameters rather than leaked onto
   the process global. Only the handful of load-time DOM references
   ($app, $modal) need them; nothing on the resolveSlot path touches
   the DOM. The trailing boot() call is stripped so no rendering or
   network runs on load.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// A minimal DOM node: every method is a no-op so load-time DOM lookups
// ($app = getElementById('app'), toast's createElement, etc.) never throw.
function elStub() {
  return {
    appendChild() {}, removeChild() {}, remove() {}, setAttribute() {},
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: {}, dataset: {}, innerHTML: '', textContent: '', value: '',
  };
}

// The engine surface returned to tests. The S/V getter/setter close over the
// app's own `let S` / `let V`, so a test installs program state by assigning S.
const EXPORTS = `return {
  defaultState, makeProgram, resolveSlot, migrateState, resolveDayEntries,
  estimateSessionSec, candidateCostMin, accessoryCostMin,
  supersetLayout, toggleSuperset, accessorySiOrder, moveSupersetMember,
  supersetRoundComplete, supersetNextInRound,
  exById, exName, loadingFor,
  focusForAccessory, bbLiftRemoval, generateBodybuildingDays, spaceSameMuscle, carryoverOptionalDrops,
  pickAccessory, accHead, muscleOfAcc, advanceWeek, DEFAULT_ACC, dayHeadsCovered,
  checkinGroupsForDay, estimateMedianSessionMin,
  Engine, PROGRAM_TEMPLATES, DAY_TEMPLATES, WAVES, TIME_MODEL,
  ACC_SCHEMES, SECONDARY_SCHEMES, JBB_HYP, DELOAD_SETS,
  PUMP_LABELS, TECHNIQUE_LABELS, DROP_DEFAULTS, MYO_DEFAULTS, RESTPAUSE_DEFAULTS, PARTIAL_DEFAULTS,
  applyTechnique, buildTechnique, lastWorkingSetIdx, entryHasDrop, entryTech, canDropEntry, finisherAllowed,
  armTapGuard, tapGuardActive,
  pumpBadge, PUMP_ICONS, cardHintFor, displaySetNote, setNoteText, dayTheme, blockDisplayLabel, suggestedWeight,
  openPerf, donePerf, clearPerf, skipSet, pmBw,
  get PM() { return PM; }, set PM(v) { PM = v; },
  recordsFor, pushRecord, deleteRecord, confirmResolve, setTargetLabel,
  sessionEntryFrom, refreshDraftTargets, previewSetLabel,
  restNotifySupported, showRestNotification, toggleRestNotify,
  obDefaults, OB_TRACKS, timelineHTML, exDisplayName, exMatches, exCues, EX_CUES,
  FINISHER_TECHS, SAME_WEIGHT_TECHS, TIMED_REST_TECHS,
  EXERCISES, SFR_LABELS, HEAD_LABELS, EX_META,
  weeklyVolumeByMuscle, weeklyVolumeByHead, SYNERGIST_COVERAGE,
  muscleHeads, headLandmarkFor, headVolumeOverMrv, exHeadAttribution, HEAD_MUSCLE,
  muscleSignal, checkinGroupForMovement,
  toggleMuscleDeload, isMuscleDeloaded, accessoryPrimaryMuscle, isAccessoryMuscleDeloaded, fatigueStatuses,
  autoregForAccessory, updateAutoreg, currentPhase,
  PHASES, phaseLabel, mvLabel, headLabel, PHASE_DEFICIT, PHASE_COLORS, DEFAULT_BLOCK_PHASE, BLOCK_COLORS,
  stampBlockPhase, blockPhase, barColorFor,
  extendBlocks, blocksForWeeks, scheduledTechForBlock, TECH_MARK,
  GOAL_ARCHETYPES, applyArchetypePhases, markPeakBlock,
  relabelBlocks, newPlanBlock, commitPlan,
  VOLUME_LANDMARKS, EXPERIENCE_FACTOR, DEFAULT_PLATES,
  KG_PER_LB, DEFAULT_PLATES_LB, PLATE_COLORS_LB, UNIT_EQUIP_DEFAULTS, UNIT_PRESETS,
  isLb, isRpe, toDispW, fromDispW, dispW, fmtWU, fmtTonnage, fmtW, fmtRir,
  displayWeight, wUnitFor, plateColorFor, plateTextFor,
  applyUnits, setUnits, setIntensityDisplay, presetOptions, pmEffort,
  DEFAULT_ACC, SPLIT_FREQ, FOCUS_FACTOR, MOVEMENT_SLIDER,
  UPPER_MUSCLES, LOWER_MUSCLES, FOCUS_KEYS,
  t, I18N,
  get S() { return S; }, set S(v) { S = v; },
  get V() { return V; }, set V(v) { V = v; },
};`;

function loadApp() {
  const appDir = path.join(__dirname, '..');
  const read = f => fs.readFileSync(path.join(appDir, f), 'utf8');

  // The i18n runtime + catalogs load before data.js, matching index.html.
  const i18n = ['i18n/i18n.js', 'i18n/en.js', 'i18n/es.js'].map(read).join('\n;\n');
  const data = read('data.js');
  const engine = read('engine.js');
  // Drop the boot() invocation at the end of app.js so loading does not kick
  // off async state loading or a render pass. The file ends with
  // `boot().catch(...)`, so the whole trailing statement is stripped; the old
  // `boot();` pattern silently stopped matching when the catch was added, which
  // let boot run async in tests and replace an injected S mid-test.
  const app = read('app.js').replace(/\bboot\(\)(\.catch\([\s\S]*?\))?;\s*$/, '');

  // Build a wrapper IIFE by string concatenation (not a template literal) so the
  // backticks inside the app's own template strings can't terminate it early.
  const wrapper =
    '(function (window, self, globalThis, document, fetch) {\n' +
    i18n + '\n;\n' + data + '\n;\n' + engine + '\n;\n' + app + '\n;\n' + EXPORTS + '\n})';

  const factory = vm.runInThisContext(wrapper, { filename: 'ironwave-combined.js' });

  const win = {
    scrollTo() {},
    addEventListener() {}, removeEventListener() {},
  };
  const documentStub = {
    getElementById() { return elStub(); },
    createElement() { return elStub(); },
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    body: elStub(),
  };
  // No network in tests: any fetch (loadState/save) rejects cleanly.
  const noNetwork = () => Promise.reject(new Error('no network in tests'));

  return factory(win, win, win, documentStub, noNetwork);
}

module.exports = { loadApp };

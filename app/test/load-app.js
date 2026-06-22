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
  exById, exName, loadingFor,
  focusForAccessory, bbLiftRemoval, generateBodybuildingDays, carryoverOptionalDrops,
  checkinGroupsForDay, estimateMedianSessionMin,
  Engine, PROGRAM_TEMPLATES, DAY_TEMPLATES, WAVES, TIME_MODEL,
  ACC_SCHEMES, SECONDARY_SCHEMES, JBB_HYP, DELOAD_SETS,
  VOLUME_LANDMARKS, EXPERIENCE_FACTOR, DEFAULT_PLATES,
  DEFAULT_ACC, SPLIT_FREQ, FOCUS_FACTOR, MOVEMENT_SLIDER,
  UPPER_MUSCLES, LOWER_MUSCLES, FOCUS_KEYS,
  get S() { return S; }, set S(v) { S = v; },
  get V() { return V; }, set V(v) { V = v; },
};`;

function loadApp() {
  const appDir = path.join(__dirname, '..');
  const read = f => fs.readFileSync(path.join(appDir, f), 'utf8');

  const data = read('data.js');
  const engine = read('engine.js');
  // Drop the boot() invocation at the end of app.js so loading does not kick
  // off async state loading or a render pass.
  const app = read('app.js').replace(/\bboot\(\);\s*$/, '');

  // Build a wrapper IIFE by string concatenation (not a template literal) so the
  // backticks inside the app's own template strings can't terminate it early.
  const wrapper =
    '(function (window, self, globalThis, document, fetch) {\n' +
    data + '\n;\n' + engine + '\n;\n' + app + '\n;\n' + EXPORTS + '\n})';

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

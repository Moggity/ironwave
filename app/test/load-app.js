/* ============================================================
   IRONWAVE — test/load-app.js
   Loads the three browser scripts (data.js, engine.js, app.js)
   into a single vm sandbox so tests can call the engine directly,
   with no build step and no real DOM.

   The app is plain non-module browser JS: every file shares one
   global scope. We reproduce that by concatenating the sources and
   running them once in a vm context, so cross-file references
   (Engine, WAVES, EXERCISES, S, ...) resolve exactly as they do in
   the browser. A tiny document/fetch stub satisfies the handful of
   load-time DOM references ($app, $modal); nothing on the
   resolveSlot path touches the DOM. The trailing boot() call is
   stripped so no rendering or network runs on load.
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

function loadApp() {
  const appDir = path.join(__dirname, '..');
  const read = f => fs.readFileSync(path.join(appDir, f), 'utf8');

  const data = read('data.js');
  const engine = read('engine.js');
  // Drop the boot() invocation at the end of app.js so loading the script
  // does not kick off async state loading or a render pass.
  const app = read('app.js').replace(/\bboot\(\);\s*$/, '');

  // Exposed surface for tests. Defined in the same lexical scope as the app,
  // so the S getter/setter read and write the app's own `let S` binding.
  const shim = `
;globalThis.__APP__ = {
  defaultState, makeProgram, resolveSlot, migrateState, resolveDayEntries,
  exById, exName, loadingFor,
  Engine, PROGRAM_TEMPLATES, DAY_TEMPLATES, WAVES,
  get S() { return S; }, set S(v) { S = v; },
  get V() { return V; }, set V(v) { V = v; },
};`;

  const documentStub = {
    getElementById() { return elStub(); },
    createElement() { return elStub(); },
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    body: elStub(),
  };

  const sandbox = {
    console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    document: documentStub,
    // No network in tests: any fetch (e.g. loadState/save) rejects cleanly.
    fetch() { return Promise.reject(new Error('no network in tests')); },
    JSON, Math, Date, Object, Array, Number, String, Boolean, Set, Map,
    RegExp, parseInt, parseFloat, isNaN, isFinite,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window.scrollTo = () => {};

  vm.createContext(sandbox);
  const combined = [data, engine, app, shim].join('\n;\n');
  vm.runInContext(combined, sandbox, { filename: 'ironwave-combined.js' });
  return sandbox.__APP__;
}

module.exports = { loadApp };

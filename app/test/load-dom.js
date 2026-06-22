/* ============================================================
   IRONWAVE — test/load-dom.js
   Loads the three browser scripts into a real (jsdom) DOM so the
   render/view layer can be smoke-tested. Unlike load-app.js (which
   runs the engine against a stub DOM), this gives the app an actual
   document with #app / #modal-root / #toast-root so every view can
   render into it.

   The scripts are run via window.eval, so they share the jsdom
   window's global scope exactly as the <script> tags do in the
   browser. The trailing boot() is stripped so nothing auto-renders or
   hits the network on load; an export shim hands the test the render
   entry points and S / V setters.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Surface the smoke test drives. render() is the single entry point; the rest
// build authentic transient state (a check-in, a live session) the way the UI
// does, so the views render against real data rather than hand-rolled stubs.
const EXPORTS = `
;window.__APP__ = {
  render, makeProgram, defaultState, obDefaults, startCheckin, beginSession,
  get S() { return S; }, set S(v) { S = v; },
  get V() { return V; }, set V(v) { V = v; },
};`;

function loadDom() {
  const appDir = path.join(__dirname, '..');
  const read = f => fs.readFileSync(path.join(appDir, f), 'utf8');

  const dom = new JSDOM(
    '<!DOCTYPE html><html><body>' +
    '<div id="app"></div><div id="modal-root"></div><div id="toast-root"></div>' +
    '</body></html>',
    { runScripts: 'outside-only', url: 'http://localhost/' }
  );
  const { window } = dom;
  window.console = console;
  window.scrollTo = () => {};
  // No real network: save()/loadState() resolve to an empty OK so nothing throws.
  window.fetch = () => Promise.resolve({ ok: true, json: async () => ({}) });

  const data = read('data.js');
  const engine = read('engine.js');
  const app = read('app.js').replace(/\bboot\(\);\s*$/, '');

  window.eval([data, engine, app, EXPORTS].join('\n;\n'));
  return { window, document: window.document, app: window.__APP__ };
}

module.exports = { loadDom };

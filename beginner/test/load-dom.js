/* Loads beginner/index.html into jsdom and evals its scripts in order, sharing one
   global scope like the browser. jsdom is required lazily so Node 18 can load this.
   Every top-level declaration in the beginner scripts is exposed on app. */
'use strict';
const fs = require('fs');
const path = require('path');
const { SHARED_FROM_APP } = require('../../scripts/assemble-beginner.js');
const { topLevelNames, exportShim, SHARED_NAMES } = require('./load-beginner.js');

function loadDom(opts) {
  const { JSDOM } = require('jsdom');
  const appDir = path.join(__dirname, '..', '..', 'app');
  const bDir = (opts && opts.beginnerDir) || path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(bDir, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["']/g)].map(m => m[1]);
  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [, ''])[1]
    .replace(/<script[\s\S]*?<\/script>/gi, '');
  const dom = new JSDOM('<!DOCTYPE html><html><body>' + body + '</body></html>',
    { runScripts: 'outside-only', url: 'http://localhost/' });
  const { window } = dom;
  window.console = console;
  window.scrollTo = () => {};
  // Never the real network: record every attempt, then fail loudly.
  const calls = window.__netCalls = [];
  window.fetch = function (...args) {
    calls.push({ type: 'fetch', args });
    return Promise.reject(new Error('network is forbidden in tests'));
  };
  window.XMLHttpRequest = function XMLHttpRequest() {
    calls.push({ type: 'xhr' });
    throw new Error('network is forbidden in tests');
  };
  const read = f => {
    const p = path.join(SHARED_FROM_APP.includes(f) ? appDir : bDir, f);
    return fs.readFileSync(fs.existsSync(p) ? p : path.join(__dirname, '..', f), 'utf8');
  };
  const sources = srcs.map(read);
  const names = [...new Set([...SHARED_NAMES, ...srcs.filter(f => !SHARED_FROM_APP.includes(f)).flatMap(f => topLevelNames(read(f)))])];
  // Rule: beginner top-level globals are single plain declarations at column zero,
  // one name per declaration, no destructuring. const/let are not window properties,
  // so the live guarded getters are evaluated in the same script scope.
  const exp = exportShim(names, ';window.__APP__ =');
  window.eval([...sources, exp].join('\n;\n'));
  return { window, document: window.document, app: window.__APP__ };
}

module.exports = { loadDom };

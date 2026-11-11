/* Loads beginner/index.html into jsdom and evals its scripts in order, sharing one
   global scope like the browser. jsdom is required lazily so Node 18 can load this. */
'use strict';
const fs = require('fs');
const path = require('path');

const EXPORTS = `;window.__APP__ = { Engine, BEGINNER_CONFIG, BEGINNER_EXERCISES, Coach, Store, UI };`;

function loadDom() {
  const { JSDOM } = require('jsdom');
  const bDir = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(bDir, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["']/g)].map(m => m[1]);
  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [, ''])[1]
    .replace(/<script[\s\S]*?<\/script>/gi, '');
  const dom = new JSDOM('<!DOCTYPE html><html><body>' + body + '</body></html>',
    { runScripts: 'outside-only', url: 'http://localhost/' });
  const { window } = dom;
  window.console = console;
  window.scrollTo = () => {};
  // Never the real network.
  window.fetch = () => Promise.resolve({ ok: true, json: async () => ({}) });
  const read = f => fs.readFileSync(
    path.join(f === 'data.js' || f === 'engine.js' ? path.join(bDir, '..', 'app') : bDir, f), 'utf8');
  window.eval([...srcs.map(read), EXPORTS].join('\n;\n'));
  return { window, document: window.document, app: window.__APP__ };
}

module.exports = { loadDom };

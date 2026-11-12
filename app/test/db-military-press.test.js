/* ============================================================
   IRONWAVE — test/db-military-press.test.js
   The two dumbbell overhead presses are named "military" so a
   search for it finds them, in English and Spanish. The rename is
   display only: ids, movement, equipment and cues are unchanged,
   and no third dumbbell military press exists.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const IDS = ['seated-db-press', 'db-shoulder-press'];
const hits = q => {
  app.S = app.defaultState();
  return app.EXERCISES.filter(e => app.exMatches(e, q)).map(e => e.id);
};

test('a search for "military" finds the barbell press and both dumbbell presses', () => {
  const found = hits('military');
  assert.deepStrictEqual(found.slice().sort(), ['military-press', ...IDS].sort());
  assert.deepStrictEqual(hits('db military').sort(), IDS.slice().sort());
});

test('a Spanish search for "militar" finds the same three', () => {
  app.I18N.setLang('es');
  try {
    assert.deepStrictEqual(hits('militar').sort(), ['military-press', ...IDS].sort());
    assert.strictEqual(app.exName('seated-db-press'), 'Press militar con mancuernas sentado');
    assert.strictEqual(app.exName('db-shoulder-press'), 'Press militar con mancuernas de pie');
  } finally { app.I18N.setLang('en'); }
});

test('the rename is display only: ids, movement, equipment and cues are unchanged', () => {
  app.S = app.defaultState();
  for (const id of IDS) {
    const e = app.exById(id);
    assert.ok(e, id + ' exists');
    assert.strictEqual(e.movement, 'press');
    assert.strictEqual(e.equipment, 'db');
    assert.ok(!e.isMain);
    assert.strictEqual(app.EX_CUES[id].length, 4);
    assert.ok(!/[–—]/.test(e.name), 'no dashes');
  }
  assert.strictEqual(app.exById('seated-db-press').name, 'DB Military Press (Seated)');
  assert.strictEqual(app.exById('db-shoulder-press').name, 'DB Military Press (Standing)');
});

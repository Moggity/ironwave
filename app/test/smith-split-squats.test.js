/* ============================================================
   IRONWAVE — test/smith-split-squats.test.js
   Library-only additions: Smith Machine Split Squat (Glute / Quad
   Emphasis). Both ids exist with the intended movement and
   equipment, carry four cues, have Spanish names and cues, have no
   em dashes, and resolve to sets in an accessory slot.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const CASES = [
  ['smith-split-squat-glute', 'glute', 'Smith Machine Split Squat (Glute Emphasis)'],
  ['smith-split-squat-quad', 'quad', 'Smith Machine Split Squat (Quad Emphasis)'],
];

function bbProgram(exId, cat) {
  app.S = app.defaultState();
  app.S.program = app.makeProgram({
    daysPerWeek: 4, track: 'bodybuilding', timeMode: 'unlimited',
    muscleFocus: { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 }, maxes: {},
  });
  app.S.records[exId] = [{ ts: Date.now(), weight: 40, reps: 10, rpe: 8 }];
  app.S.program.days[0] = { name: 'Legs', slots: [{ type: 'acc', cat, def: exId, ex: exId }] };
  return app.S.program;
}

for (const [id, movement, name] of CASES) {
  test(`${id}: registered with movement, machine equipment, cues and Spanish name`, () => {
    app.S = app.defaultState();
    const e = app.exById(id);
    assert.ok(e, 'exists');
    assert.strictEqual(e.name, name);
    assert.strictEqual(e.movement, movement);
    assert.strictEqual(e.equipment, 'mc');
    assert.ok(!e.isMain, 'accessory, not a main');
    assert.strictEqual(app.EX_CUES[id].length, 4);
    app.I18N.setLang('es');
    try {
      assert.notStrictEqual(app.exName(id), name, 'Spanish name differs from English');
      const es = app.exCues(e);
      assert.strictEqual(es.length, 4);
      es.forEach((c, i) => assert.notStrictEqual(c, app.EX_CUES[id][i], `cue ${i} translated`));
      for (const s of [app.exName(id), ...es]) assert.ok(!/[–—]/.test(s), 'no dashes');
    } finally { app.I18N.setLang('en'); }
    for (const c of app.EX_CUES[id]) assert.ok(!/[–—]/.test(c), 'no dashes');
  });

  test(`${id}: resolveSlot prescribes sets in an accessory slot`, () => {
    const prog = bbProgram(id, movement === 'glute' ? 'glute' : 'quad');
    const rs = app.resolveSlot(prog.days[0].slots[0], 0, 1);
    assert.ok(rs.sets && rs.sets.length > 0, 'has sets');
  });
}

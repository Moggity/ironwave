/* ============================================================
   IRONWAVE — test/time-estimate.test.js
   Session-time estimator: per-exercise setup is equipment-aware (a barbell
   costs real plate-loading/warmup time, a machine almost none), and the
   marginal cost helpers (candidateCostMin / accessoryCostMin) include that
   setup so the swap/add pickers read realistically for a capped athlete.
   All through the load-app harness (no jsdom).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();

function fresh() {
  const s = app.defaultState();
  app.S = s;
  app.V = { dayIdx: 0 };
  s.program = app.makeProgram({
    daysPerWeek: 4, track: 'bodybuilding', timeMode: 'custom', timeCapMin: 50,
    muscleFocus: { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 },
    maxes: {},
  });
  return s;
}

test('estimate: setup is equipment-aware (barbell costs more than a machine)', () => {
  fresh();
  const sets = [{ reps: 10 }, { reps: 10 }, { reps: 10 }];
  const bb = { exId: 'bb-curl', sets };          // barbell accessory
  const mc = { exId: 'leg-extensions', sets };   // machine accessory
  const diff = app.estimateSessionSec([bb], false) - app.estimateSessionSec([mc], false);
  // Same sets/reps/rest, so the whole difference is the equipment setup gap.
  assert.strictEqual(diff, app.TIME_MODEL.setupSec.bb - app.TIME_MODEL.setupSec.mc);
  assert.ok(diff > 0, 'barbell setup should exceed machine setup');
});

test('estimate: a single exercise includes both session overhead and its setup', () => {
  fresh();
  const rs = { exId: 'leg-extensions', sets: [{ reps: 10 }, { reps: 10 }] };
  const TM = app.TIME_MODEL;
  const setsTime = rs.sets.reduce((t, st) => t + st.reps * TM.execSecPerRep.accessory + TM.restSec.accessory, 0);
  const expected = TM.sessionOverheadSec + TM.setupSec.mc + setsTime;
  assert.strictEqual(app.estimateSessionSec([rs], false), expected);
});

test('candidateCostMin: a sane per-add cost, higher for barbell than machine', () => {
  fresh();
  // Marginal cost of adding the exercise must be a sane handful of minutes.
  const cost = app.candidateCostMin('bb-curl');
  assert.ok(cost >= 1 && cost <= 30, 'an added accessory costs a sane handful of minutes');
  // Barbell marginal cost outruns a machine one for the same kind of accessory.
  assert.ok(app.candidateCostMin('bb-curl') >= app.candidateCostMin('leg-extensions'));
});

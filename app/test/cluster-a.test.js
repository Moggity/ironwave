/* ============================================================
   IRONWAVE — test/cluster-a.test.js
   Cluster A (logging & data foundation):
   - RIR <-> RPE interconversion (presentation only; engine stays RPE).
   - e1rmTrend / volumeLoadTrend progression series (pure, deterministic).
   - the optional set-object / record fields (pump, technique) are inert:
     a plain record still estimates the same e1RM, and the labels exist.
   Through the existing test/load-app.js harness (no jsdom).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const { Engine } = app;

const DAY = 864e5;

// ---------------------------------------------------------------------------
// RIR <-> RPE
// ---------------------------------------------------------------------------
test('rpeToRir / rirToRpe are the 10-complement and round-trip', () => {
  assert.strictEqual(Engine.rpeToRir(8), 2);
  assert.strictEqual(Engine.rpeToRir(10), 0);
  assert.strictEqual(Engine.rpeToRir(7.5), 2.5);
  assert.strictEqual(Engine.rirToRpe(2), 8);
  for (const rpe of [5, 6.5, 7, 8.5, 9, 10]) {
    assert.strictEqual(Engine.rirToRpe(Engine.rpeToRir(rpe)), rpe);
  }
});

test('rpeToRir never goes negative and defaults a missing rpe to RIR 2', () => {
  assert.strictEqual(Engine.rpeToRir(12), 0);   // clamped
  assert.strictEqual(Engine.rpeToRir(undefined), 2);
});

test('the RIR switch does not change e1RM (still computed from stored RPE)', () => {
  // 100 kg x 5 @ RPE 8 (RIR 2) -> total reps 7 -> Epley.
  assert.strictEqual(Engine.e1rm(100, 5, 8), 100 * (1 + 7 / 30));
});

// ---------------------------------------------------------------------------
// Progression trends
// ---------------------------------------------------------------------------
function rec(daysAgo, weight, reps, rpe, extra) {
  return Object.assign({ ts: Date.now() - daysAgo * DAY, weight, reps, rpe }, extra || {});
}

test('e1rmTrend gives one ascending point per day, best set per day', () => {
  const recs = [
    rec(10, 100, 5, 8),            // day A
    rec(10, 110, 5, 8),            // day A, heavier -> should win
    rec(3, 120, 3, 9),             // day B
  ];
  const t = Engine.e1rmTrend(recs);
  assert.strictEqual(t.length, 2, 'two distinct days');
  assert.ok(t[0].ts < t[1].ts, 'ascending by time');
  assert.strictEqual(t[0].value, Engine.e1rm(110, 5, 8), 'day A keeps the higher e1RM');
  assert.strictEqual(t[1].value, Engine.e1rm(120, 3, 9));
});

test('volumeLoadTrend sums weight*reps per day', () => {
  const recs = [
    rec(10, 100, 5, 8),            // 500
    rec(10, 50, 10, 8),            // 500  -> day A total 1000
    rec(2, 80, 8, 8),              // 640  -> day B
  ];
  const t = Engine.volumeLoadTrend(recs);
  assert.deepStrictEqual(t.map(p => p.value), [1000, 640]);
});

test('trends ignore warmup-shaped / out-of-window / empty records', () => {
  assert.deepStrictEqual(Engine.e1rmTrend([]), []);
  assert.deepStrictEqual(Engine.e1rmTrend(null), []);
  const recs = [
    rec(10, 0, 5, 8),              // weight 0 -> skipped
    rec(10, 100, 0, 8),            // reps 0 -> skipped
    rec(400, 100, 5, 8),          // outside default 120-day window
    rec(5, 100, 5, 8),             // the only real point
  ];
  assert.strictEqual(Engine.e1rmTrend(recs).length, 1);
  assert.strictEqual(Engine.volumeLoadTrend(recs).length, 1);
});

// ---------------------------------------------------------------------------
// Optional fields are inert
// ---------------------------------------------------------------------------
test('pump / technique on a record do not affect e1RM or the trends', () => {
  const plain = rec(5, 100, 5, 8);
  const tagged = rec(5, 100, 5, 8, { pump: 3, technique: 'drop' });
  assert.strictEqual(Engine.e1rm(plain.weight, plain.reps, plain.rpe),
                     Engine.e1rm(tagged.weight, tagged.reps, tagged.rpe));
  assert.strictEqual(Engine.e1rmTrend([tagged])[0].value, Engine.e1rmTrend([plain])[0].value);
});

test('pump and technique label tables exist for the logging UI', () => {
  assert.strictEqual(app.PUMP_LABELS[2], 'Solid');
  assert.strictEqual(app.TECHNIQUE_LABELS.straight, 'Straight set');
  assert.strictEqual(app.TECHNIQUE_LABELS.myo, 'Myo-reps');
  // Athlete-facing labels must not carry em dashes (CONTRIBUTING style rule).
  for (const v of Object.values(app.PUMP_LABELS).concat(Object.values(app.TECHNIQUE_LABELS))) {
    assert.ok(!v.includes('—'), `no em dash in "${v}"`);
  }
});

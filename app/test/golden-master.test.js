/* ============================================================
   IRONWAVE — test/golden-master.test.js
   C1 golden-master: snapshot the resolved routine for the default
   Powerbuilding program (every block/week/day/slot's resolveSlot
   output) and assert it never changes.

   This is the automated form of the "default users stay
   byte-identical" contract that every engine change is hand-checked
   against. Two scenarios are snapshotted from a fresh default
   onboarding: uncalibrated (no 1RMs entered yet -> calibration
   ramps) and calibrated (1RMs entered -> wave/AMRAP weights).

   To intentionally update the golden file after a deliberate change:
     UPDATE_GOLDEN=1 node --test test/golden-master.test.js
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadApp } = require('./load-app');

const GOLDEN_PATH = path.join(__dirname, 'golden-master.json');

// The default powerbuilding onboarding (obDefaults), held fixed so the
// snapshot is deterministic. Calibrated maxes are a fixed, representative set.
const DEFAULT_FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };
const CALIBRATED_MAXES = {
  'comp-squat': 140, 'comp-bench': 100, 'comp-deadlift': 180, 'military-press': 60,
};

// Deterministic, key-sorted stringify so the golden file is stable and
// diff-friendly regardless of property insertion order.
function canonical(value) {
  return JSON.stringify(sortKeys(value), null, 2);
}
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  return v;
}

// Resolve every slot of the default Powerbuilding program into a flat,
// position-keyed list. resolveSlot is deterministic given (S, slot, block,
// week): it depends only on working maxes, block scheme, and week index —
// never on dates or wall-clock — so the snapshot is reproducible.
function buildSnapshot(app, maxes) {
  const S = app.defaultState();
  S.program = app.makeProgram({
    daysPerWeek: 4,
    track: 'powerbuilding',
    experience: 'intermediate',
    timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS },
    maxes: { ...maxes },
  });
  app.S = S;

  const p = S.program;
  const slots = [];
  for (let bi = 0; bi < p.blocks.length; bi++) {
    for (let wi = 0; wi < p.weeksPerBlock; wi++) {
      for (let di = 0; di < p.days.length; di++) {
        p.days[di].slots.forEach((slot, si) => {
          const rs = app.resolveSlot(slot, bi, wi);
          slots.push({ block: bi, week: wi, day: di, slot: si, resolved: rs });
        });
      }
    }
  }
  return { wm: p.wm, slots };
}

function buildAll() {
  const app = loadApp();
  return {
    uncalibrated: buildSnapshot(app, {}),
    calibrated: buildSnapshot(app, CALIBRATED_MAXES),
  };
}

if (process.env.UPDATE_GOLDEN) {
  fs.writeFileSync(GOLDEN_PATH, canonical(buildAll()) + '\n');
  console.log('Golden master written to ' + GOLDEN_PATH);
}

test('default Powerbuilding routine matches the golden master', () => {
  assert.ok(
    fs.existsSync(GOLDEN_PATH),
    'golden-master.json is missing. Generate it with UPDATE_GOLDEN=1 node --test test/golden-master.test.js'
  );
  const golden = fs.readFileSync(GOLDEN_PATH, 'utf8').trim();
  const actual = canonical(buildAll()).trim();
  assert.strictEqual(
    actual,
    golden,
    'Resolved Powerbuilding routine changed. If this change is intentional, ' +
    'regenerate with UPDATE_GOLDEN=1 node --test test/golden-master.test.js'
  );
});

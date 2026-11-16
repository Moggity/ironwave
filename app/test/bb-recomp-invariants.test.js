/* ============================================================
   IRONWAVE — test/bb-recomp-invariants.test.js
   Reproduction for the "atypical week 2+ prescriptions" report:
   bodybuilding + goal 'recomp' ("Look good, stay healthy"),
   4 days, intermediate, sliders at 2, no 1RMs, weeks 1-4.

   Asserts invariants I1-I6 through test/bb-invariants-helper.js
   (the assertions live there). Written BEFORE the fix: it failed
   on all six on v1.23.0. Do not edit the assertions to make it
   pass; see docs/week2-prescriptions/decisions.md.

   Two athlete styles, because they take different branches of the
   old Engine.doubleProgression: 'ascending' produced the 11s and
   13s, 'flat' produced the sets of 6.
   ============================================================ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { simulate, CHECKS } = require('./bb-invariants-helper');

const RUNS = ['ascending', 'flat'].map(style => simulate({ style, days: 4, experience: 'intermediate', weeks: 4 }));

const TITLES = {
  I1: 'rep format: whitelisted range or whitelisted fixed target, with a stored rationale',
  I2: 'effort: every working set carries an RIR target inside its category bounds',
  I3: 'continuity: week over week only load, sets and RIR move; the rep category holds',
  I4: 'explainability: every week-over-week change carries a reason code from the closed enum',
  I5: 'set homogeneity: one rep prescription and RIR per exercise unless a named scheme is declared',
  I6: 'weekly volume: 10 to 20 hard sets per muscle group on work weeks',
};

for (const id of Object.keys(CHECKS)) {
  test(`${id} ${TITLES[id]}`, () => {
    const bad = RUNS.flatMap(run => CHECKS[id](run));
    assert.strictEqual(bad.length, 0, `${id}: ${bad.length} violation(s)\n  ` + bad.slice(0, 25).join('\n  ') +
      (bad.length > 25 ? `\n  ... and ${bad.length - 25} more` : ''));
  });
}

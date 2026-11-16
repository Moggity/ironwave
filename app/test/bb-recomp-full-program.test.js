/* ============================================================
   IRONWAVE — test/bb-recomp-full-program.test.js
   Bodybuilding + recomp over the WHOLE program (every block to
   the end), not just the first eight weeks. Added in Phase 3
   after the survey found the weekly ceiling broken in block 2
   week 4 on 5 and 6 day plans (arms 20.5 sets: pressing credits
   the arms, and the main lifts add sets late in a block).
   Assertions are the shared ones in bb-invariants-helper.js.
   ============================================================ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { simulate, CHECKS } = require('./bb-invariants-helper');

const MAXES = { 'comp-squat': 140, 'comp-bench': 100, 'military-press': 60 };

for (const days of [4, 5, 6]) {
  for (const maxes of [{}, MAXES]) {
    const label = `${days} days, ${Object.keys(maxes).length ? 'entered 1RMs' : 'no 1RMs'}`;
    test(`full program (${label}, intermediate, both styles): I1-I6 on every week`, () => {
      for (const style of ['ascending', 'flat']) {
        const run = simulate({ style, days, experience: 'intermediate', weeks: 60, maxes });
        assert.ok(run.program.pointer.block >= run.program.blocks.length - 1, 'the run reaches the last block');
        for (const id of Object.keys(CHECKS)) {
          const bad = CHECKS[id](run);
          assert.strictEqual(bad.length, 0, `${id} [${style}]: ${bad.length} violation(s)\n  ` + bad.slice(0, 10).join('\n  '));
        }
      }
    });
  }
}

/* ============================================================
   IRONWAVE — test/acceptance-matrix.test.js
   The named tests docs/week2-prescriptions/acceptance_criteria.md
   maps its criteria to, for the combinations beyond recomp.

   Owner ruling (2026-11-16): extend the fix to the other two
   bodybuilding goals only. The strength tracks (powerbuilding,
   powerlifting, with or without a meet) keep their math exactly
   as it is; the only thing required of them is that no accessory
   gains a rep "out of nowhere" from one week to the next
   (AC-ST-1 below, a guard on existing behavior).

   Bodybuilding + recomp is asserted in bb-recomp-*.test.js,
   bb-progress-rules.test.js and bb-single-writer.test.js.
   Shared assertions: bb-invariants-helper.js.
   ============================================================ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { simulate, CHECKS, isWorking } = require('./bb-invariants-helper');

const DEFICIT = ['cut', 'minicut'];
const WORK_WEEKS = ['accumulation', 'intensification', 'realization'];
const phaseOf = (run, wk) => run.program.blocks[wk.b].phase;

function runsFor(goal, macroWeeks) {
  const out = [];
  for (const days of [3, 4, 5]) for (const style of ['ascending', 'flat']) {
    out.push(simulate({ goal, macroWeeks, style, days, experience: 'intermediate', weeks: 60 }));
  }
  return out;
}
const RUNS = { 'serious-macro': runsFor('serious-macro', null), 'lean-asap': runsFor('lean-asap', 12) };

function invariant(goal, id) {
  const bad = RUNS[goal].flatMap(run => CHECKS[id](run));
  assert.strictEqual(bad.length, 0, `${id}: ${bad.length} violation(s)\n  ` + bad.slice(0, 15).join('\n  '));
}

// After a week in which every working set was logged clearly easier than its
// target (2 RIR beyond the top of the range), complete the week and return the
// reason codes the next week carries, per exercise.
function reasonsAfterEasyWeek(goal, macroWeeks) {
  const run = simulate({ goal, macroWeeks, style: 'ascending', days: 4, experience: 'intermediate', weeks: 3 });
  const { app, program: p } = run;
  const b = p.pointer.block, w = p.pointer.week;
  for (const s of app.S.sessions) {
    if (s.b !== b || s.w !== w) continue;
    for (const e of s.entries) for (const st of e.sets) {
      if (st.calib || st.amrap || !st.rirRange) continue;
      st.rpe = 10 - (st.rirRange[1] + 2);
      st.reps = st.repRange ? st.repRange[0] + 1 : st.reps; // in range, not at the top
    }
  }
  app.advanceWeek();
  return { run, byEx: (p.planReasons && p.planReasons.byEx) || {}, phase: p.blocks[b].phase };
}

// ---- bodybuilding + serious-macro (AC-SM-*) --------------------------------
test('AC-SM-0 serious-macro runs reach the last block and include gain and deficit blocks', () => {
  const run = RUNS['serious-macro'][0];
  const phases = new Set(run.weeks.map(wk => phaseOf(run, wk)));
  assert.ok(run.program.pointer.block >= run.program.blocks.length - 1);
  assert.ok(phases.has('minicut') && (phases.has('gain') || phases.has('lean-gain')), [...phases].join(','));
});
test('AC-SM-1 serious-macro: rep format follows the hypertrophy whitelist (I1)', () => invariant('serious-macro', 'I1'));
test('AC-SM-2 serious-macro: RIR targets by kind and block week (I2)', () => invariant('serious-macro', 'I2'));
test('AC-SM-3 serious-macro: continuity, load at most 5% a week (I3)', () => invariant('serious-macro', 'I3'));
test('AC-SM-4 serious-macro: every change carries a reason code (I4)', () => invariant('serious-macro', 'I4'));
test('AC-SM-5 serious-macro: named schemes for mixed sets (I5)', () => invariant('serious-macro', 'I5'));
test('AC-SM-6 serious-macro: 10 to 20 weekly sets on work weeks (I6)', () => invariant('serious-macro', 'I6'));
test('AC-SM-7 serious-macro: ADD_SET allowed up to 3 in gain blocks, never in cut or minicut blocks', () => {
  const { run, byEx, phase } = reasonsAfterEasyWeek('serious-macro', null);
  assert.ok(!DEFICIT.includes(phase), `block 1 is a gain block (${phase})`);
  const added = Object.keys(byEx).filter(id => byEx[id].includes('ADD_SET') && !run.app.exById(id).isMain);
  assert.ok(added.length > 0, 'an easy week in a gain block adds a set somewhere');
  const prof = run.app.bbGoalProfile;
  assert.strictEqual(typeof prof, 'function', 'bbGoalProfile is exported');
  for (const blk of run.program.blocks) {
    assert.strictEqual(prof(blk).maxSetAdj, DEFICIT.includes(blk.phase) ? 0 : 3, `maxSetAdj in a ${blk.phase} block`);
  }
});

// ---- bodybuilding + lean-asap (AC-LA-*) ------------------------------------
test('AC-LA-1 lean-asap: rep format follows the hypertrophy whitelist (I1)', () => invariant('lean-asap', 'I1'));
test('AC-LA-2 lean-asap: RIR never below 1 while in a deficit block (I2)', () => {
  invariant('lean-asap', 'I2');
  const bad = [];
  let deficitWeeks = 0;
  for (const run of RUNS['lean-asap']) for (const wk of run.weeks) {
    if (!DEFICIT.includes(phaseOf(run, wk))) continue;
    deficitWeeks++;
    for (const r of wk.rows) for (const s of r.rs.sets.filter(isWorking)) {
      if (s.amrap && r.rs.setScheme === 'AMRAP_FINISH') continue; // the declared all-out exception
      const lo = s.rirRange ? s.rirRange[0] : (s.rpe != null ? 10 - s.rpe : null);
      if (lo == null || lo < 1) bad.push(`b${wk.b + 1}w${wk.w + 1} ${r.exId}: RIR ${JSON.stringify(s.rirRange || null)}`);
    }
  }
  assert.ok(deficitWeeks > 0, 'the runs include deficit blocks');
  assert.strictEqual(bad.length, 0, `${bad.length} set(s) at RIR 0 in a deficit\n  ` + bad.slice(0, 10).join('\n  '));
});
test('AC-LA-3 lean-asap: continuity, load at most 5% a week (I3)', () => invariant('lean-asap', 'I3'));
test('AC-LA-4 lean-asap: every change carries a reason code (I4)', () => invariant('lean-asap', 'I4'));
test('AC-LA-5 lean-asap: named schemes for mixed sets (I5)', () => invariant('lean-asap', 'I5'));
test('AC-LA-6 lean-asap: 10 to 16 weekly sets on work weeks (I6)', () => {
  invariant('lean-asap', 'I6'); // the floor (and the general ceiling of 20)
  const bad = [];
  for (const run of RUNS['lean-asap']) for (const wk of run.weeks) {
    if (!WORK_WEEKS.includes(wk.weekType)) continue;
    for (const key in wk.volume) if (wk.volume[key] > 16) bad.push(`${run.opts.days}d b${wk.b + 1}w${wk.w + 1} ${key}: ${wk.volume[key]} sets`);
  }
  assert.strictEqual(bad.length, 0, `${bad.length} group-week(s) over 16 sets\n  ` + bad.slice(0, 10).join('\n  '));
});
test('AC-LA-7 lean-asap: progress() never returns ADD_SET in a deficit block', () => {
  const { run, byEx, phase } = reasonsAfterEasyWeek('lean-asap', 12);
  assert.ok(DEFICIT.includes(phase), `block 1 is a deficit block (${phase})`);
  const added = Object.keys(byEx).filter(id => byEx[id].includes('ADD_SET') && !run.app.exById(id).isMain);
  assert.deepStrictEqual(added, [], 'no accessory gains a set after an easy week in a deficit');
  for (const blk of run.program.blocks) {
    if (DEFICIT.includes(blk.phase)) assert.strictEqual(run.app.bbGoalProfile(blk).maxSetAdj, 0);
  }
});

// ---- strength tracks: unchanged math, one guard (AC-ST-1) -------------------
// Powerbuilding and powerlifting keep their prescriptions exactly as they are
// (the golden master pins the default track byte for byte). The guard: inside
// a block, an accessory's rep target never moves from one week to the next.
for (const track of ['powerbuilding', 'powerlifting']) {
  for (const meet of [false, true]) {
    test(`AC-ST-1 ${track}${meet ? ' with a meet' : ''}: no accessory rep target changes week to week inside a block`, () => {
      const bad = [];
      let compared = 0;
      for (const style of ['ascending', 'flat']) {
        const run = simulate({ track, style, days: 4, experience: 'intermediate', weeks: 60,
          meetDate: meet ? Date.now() + 84 * 864e5 : null });
        run.weeks.forEach((wk, i) => {
          if (i === 0 || run.weeks[i - 1].b !== wk.b) return;
          for (const r of wk.rows) {
            if (r.rs.isMain || r.rs.isSecondary) continue;
            const prev = run.weeks[i - 1].rows.find(x => x.di === r.di && x.si === r.si && x.exId === r.exId);
            if (!prev) continue;
            const reps = rs => [...new Set(rs.sets.filter(s => !s.ramp && !s.calib && !s.amrap).map(s => s.reps))];
            const a = reps(prev.rs), b = reps(r.rs);
            if (!a.length || !b.length) continue; // a calibration week has no working reps yet
            compared++;
            if (a.length !== 1 || b.length !== 1 || a[0] !== b[0]) bad.push(`[${style}] b${wk.b + 1}w${wk.w + 1} ${r.exId}: reps ${a.join('/')} -> ${b.join('/')}`);
          }
        });
      }
      assert.ok(compared > 0, 'the run compared accessory weeks');
      assert.strictEqual(bad.length, 0, `${bad.length} rep change(s)\n  ` + bad.slice(0, 10).join('\n  '));
    });
  }
}

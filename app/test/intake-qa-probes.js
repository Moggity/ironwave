/* ============================================================
   IRONWAVE — test/intake-qa-probes.js
   The adversarial intake-QA persona's standing probe kit
   (docs/intake-qa-simulation.md, call sheet entry 12). NOT part of
   npm test: these are judgment probes, not assertions. Run them by
   hand whenever onboarding or the split generator changes, read the
   output like a coach, and update the report.

   Usage:
     node test/intake-qa-probes.js spec            all seven muscles
     node test/intake-qa-probes.js spec arms       one muscle
     node test/intake-qa-probes.js spec arms 6     one muscle, N days

   The specialization probe (owner grant, 2026-07-17): one slider at
   6, every other slider at 0, N training days (default 6). For each
   generated day it prints the resolved exercises with movement/head
   tags, then three coach checks:
     FREQ    how many days the muscle leads vs its SPLIT_FREQ target
             (a lead surplus means zero recovery days were planned)
     VARIETY the worst same-exercise repeat across the week, plus any
             within-day duplicates (a lazy generator repeats; a smart
             one varies or stops)
     HEADS   the per-day movement/head mix (for arms: do biceps and
             triceps days alternate so each head recovers, or does
             one head absorb the whole week?)
   ============================================================ */
'use strict';
const { loadApp } = require('./load-app');

const app = loadApp();
const KEYS = ['arms', 'chest', 'back', 'shoulders', 'glutes', 'legs', 'calves'];

function specFocus(k) {
  const f = {};
  for (const m of KEYS) f[m] = m === k ? 6 : 0;
  return f;
}

function specializationProbe(muscle, nDays) {
  app.S = app.defaultState();
  app.S.profile.landmarks = app.Engine.seedLandmarks('intermediate');
  const focus = specFocus(muscle);
  const p = app.makeProgram({ daysPerWeek: nDays, track: 'bodybuilding',
    goalArchetype: 'recomp', experience: 'intermediate', timeMode: 'unlimited',
    muscleFocus: focus, maxes: {} });
  app.S.program = p;
  app.S.profile.training = { track: 'bodybuilding', muscleFocus: focus, timeMode: 'unlimited' };

  console.log(`\n===== ${muscle.toUpperCase()} = 6, everything else 0, ${nDays} days =====`);
  const week = [];
  let withinDayDups = 0;
  for (let di = 0; di < p.days.length; di++) {
    const r = app.resolveDayEntries(di, 0, 2); // meso 0, a mid build week
    const kept = r.items.filter(x => x.rs && !x.rs.isRemoved && (x.rs.sets || []).length);
    const seen = new Set();
    const parts = kept.map(x => {
      const ex = app.exById(x.rs.exId) || {};
      if (seen.has(x.rs.exId)) withinDayDups++;
      seen.add(x.rs.exId);
      week.push({ di, id: x.rs.exId, mv: ex.movement, head: ex.head || null });
      return `${x.rs.exId}(${ex.movement || '?'}${ex.head ? '/' + ex.head : ''} x${x.rs.sets.length})`;
    });
    console.log(`  d${di} [${app.dayTheme(p.days[di]) || '-'}]: ${parts.join(', ') || 'EMPTY'}`);
  }

  const leadDays = p.days.filter(d => d.primary === muscle || (d.theme && d.theme.primary === muscle)).length;
  const target = app.splitFreqFor(6, nDays);
  console.log(`  FREQ: leads ${leadDays} of ${nDays} days, SPLIT_FREQ target ${target}` +
    (leadDays > target ? ' <<< no recovery days planned' : ' ok'));

  const counts = {};
  for (const e of week) counts[e.id] = (counts[e.id] || 0) + 1;
  const worst = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || ['-', 0];
  console.log(`  VARIETY: ${Object.keys(counts).length} distinct across ${week.length} slots; ` +
    `worst repeat ${worst[0]} x${worst[1]}; within-day duplicates ${withinDayDups}` +
    (worst[1] > nDays || withinDayDups ? ' <<< lazy repetition' : ' ok'));

  const byDay = {};
  for (const e of week) {
    const tag = e.head || e.mv || '?';
    (byDay[e.di] = byDay[e.di] || {})[tag] = (byDay[e.di][tag] || 0) + 1;
  }
  console.log('  HEADS: ' + Object.keys(byDay).map(di =>
    `d${di}{${Object.entries(byDay[di]).map(([t, n]) => `${t}:${n}`).join(' ')}}`).join(' '));
}

const [, , cmd, arg1, arg2] = process.argv;
if (cmd === 'spec') {
  const nDays = parseInt(arg2) || 6;
  const muscles = arg1 && arg1 !== 'all' ? [arg1] : KEYS;
  for (const m of muscles) {
    if (!KEYS.includes(m)) { console.error(`unknown muscle: ${m} (use ${KEYS.join('|')})`); process.exit(1); }
    specializationProbe(m, nDays);
  }
} else {
  console.log('usage: node test/intake-qa-probes.js spec [muscle|all] [days]');
  console.log('The F1-F6 intake repros from the first run live in test/intake.test.js.');
}

/* ============================================================
   IRONWAVE — test/feedback-round4.test.js
   User-feedback round 4 (verbosity pass): athlete-facing block
   names (goal word instead of "Hypertrophy"), themed day labels
   without the Upper/Lower region tag, per-set RIR caps hoisted
   off the rows, and the trimmed catalogs. Pure / stub-safe.
   ============================================================ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();

function programWith(track, goalArchetype) {
  const ob = app.obDefaults();
  Object.assign(ob, {
    name: 'T', bodyweight: 80, daysPerWeek: 4, track,
    goalArchetype, experience: 'intermediate', timeMode: 'unlimited',
  });
  const s = app.defaultState();
  app.S = s; // makeProgram reads S (custom exercises) while picking accessories
  s.program = app.makeProgram(ob);
  return s;
}

// ------------------------------------------------------------
// blockDisplayLabel: the stored label stays English, display maps it
// ------------------------------------------------------------
test('blockDisplayLabel keeps the stored label English and shows the goal word', () => {
  app.S = programWith('bodybuilding', 'serious-macro');
  const block = app.S.program.blocks[0];
  assert.match(block.label, /^Hypertrophy \d+$/, 'stored label untouched');
  assert.strictEqual(app.blockDisplayLabel(block), block.label.replace('Hypertrophy', 'Bodybuilding'));
});

test('blockDisplayLabel: Spanish catalog shows Fisicoculturismo / Musculación / Fuerza', () => {
  app.I18N.setLang('es');
  try {
    app.S = programWith('bodybuilding', 'serious-macro');
    assert.match(app.blockDisplayLabel(app.S.program.blocks[0]), /^Fisicoculturismo \d+$/);

    app.S = programWith('bodybuilding', 'recomp');
    assert.match(app.blockDisplayLabel(app.S.program.blocks[0]), /^Musculación \d+$/);

    app.S = programWith('powerbuilding', null);
    const strength = app.S.program.blocks.find(b => b.type === 'strength');
    const hyp = app.S.program.blocks.find(b => b.type === 'hypertrophy');
    assert.match(app.blockDisplayLabel(strength), /^Fuerza \d+$/);
    assert.match(app.blockDisplayLabel(hyp), /^Hipertrofia \d+$/, 'non-bodybuilding tracks keep the generic word');
  } finally {
    app.I18N.setLang('en');
  }
});

test('blockDisplayLabel passes a custom label through verbatim', () => {
  app.S = programWith('powerbuilding', null);
  assert.strictEqual(app.blockDisplayLabel({ label: 'My Block' }), 'My Block');
});

test('the bodybuilding goal is snapshotted on the program for display', () => {
  app.S = programWith('bodybuilding', 'serious-macro');
  assert.strictEqual(app.S.program.trainingConfig.goalArchetype, 'serious-macro');
  app.S = programWith('powerbuilding', 'serious-macro');
  assert.strictEqual(app.S.program.trainingConfig.goalArchetype, null, 'non-bodybuilding tracks store no goal');
});

// ------------------------------------------------------------
// dayTheme: themed days show the primary muscle only, no region tag
// ------------------------------------------------------------
test('dayTheme drops the Upper/Lower region tag on themed days', () => {
  assert.strictEqual(app.dayTheme({ theme: { region: 'upper', primary: 'shoulders' } }), 'Shoulders');
  assert.strictEqual(app.dayTheme({ theme: { region: 'lower', primary: 'legs' } }), 'Legs');
  assert.strictEqual(app.dayTheme({ nameKey: 'upper_a' }), 'Upper A', 'template day names untouched');
});

// ------------------------------------------------------------
// setTargetLabel: the per-set RIR cap is gone from weighted rows
// ------------------------------------------------------------
test('a weighted set row shows weight × reps without the per-set RIR cap', () => {
  const label = app.setTargetLabel({ targetWeight: 52.5, targetReps: 10, targetRpe: 7 }, 'comp-bench');
  assert.ok(!/cap at/.test(label), 'no per-row cap copy');
  assert.match(label, /52\.5.*× 10/);
});

// ------------------------------------------------------------
// Catalog trims: both languages dropped the same copy
// ------------------------------------------------------------
test('trimmed catalogs: EN and ES both lost the removed sentences', () => {
  const en = app.I18N.catalogs.en.strings;
  const es = app.I18N.catalogs.es.strings;
  assert.strictEqual(en['perf.rir_hint'], 'RIR is how many reps you could still do.');
  assert.strictEqual(es['perf.rir_hint'], 'RIR es cuántas reps podrías hacer todavía.');
  assert.ok(!/confidently/.test(en['rpe.7']) && !/con confianza/.test(es['rpe.7']));
  assert.ok(!/trimmed to fit/.test(en['ob.est_over']) && !/recortarán/.test(es['ob.est_over']));
  assert.strictEqual(es['track.bodybuilding'], 'Musculación');
  assert.strictEqual(es['goal.serious-macro'], 'Fisicoculturismo');
  // The uniform-RIR scheme line exists in both catalogs with all placeholders.
  for (const c of [en, es]) {
    assert.match(c['session.sets_x_reps_rir'], /\{sets\}.*\{reps\}.*\{rir\}/);
  }
});

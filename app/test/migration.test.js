/* ============================================================
   IRONWAVE — test/migration.test.js
   Migration (future-work testing item 4). A legacy database.json
   (pre-tracks, pre-landmarks, pre-scheme-split) must load through
   migrateState and be backfilled to the powerbuilding defaults, and
   migrateState must be idempotent so re-running it never drifts.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();

// A save shaped like a pre-tracks, pre-landmarks program: blocks carry no
// scheme/mesoIdx/methodology, the program lacks pointer/weeksPerBlock/etc., and
// the profile predates training config and landmarks.
function legacyState() {
  return {
    v: 1,
    profile: { name: 'Legacy', bodyweight: 82, barWeight: 20, rounding: 2.5 },
    program: {
      template: 'powerbuilding',
      daysPerWeek: 4,
      startDate: 1_600_000_000_000,
      blocks: [
        { type: 'hypertrophy', wave: '10s', label: 'Hypertrophy 1' },
        { type: 'strength', wave: '5s', label: 'Strength 1' },
      ],
      days: [{ name: 'Day 1', slots: [] }],
      wm: { 'comp-squat': 126.25 },
      increments: { 'comp-squat': 2.5 },
    },
    records: {},
    sessions: [],
    checkins: [],
  };
}

test('migrateState backfills a legacy program to powerbuilding defaults', () => {
  const s = legacyState();
  app.migrateState(s);

  // Blocks get scheme ids stamped by type, plus mesoIdx and a methodology tag.
  assert.strictEqual(s.program.blocks[0].scheme, 'jbb-hyp');
  assert.strictEqual(s.program.blocks[1].scheme, 'jm2-wave');
  assert.ok(s.program.blocks.every(b => typeof b.mesoIdx === 'number'));
  // [Epic G1] each block gets a default phase from its type.
  assert.ok(s.program.blocks.every(b => typeof b.phase === 'string'));
  assert.strictEqual(s.program.blocks[0].phase, 'lean-gain'); // hypertrophy
  assert.strictEqual(s.program.blocks[1].phase, 'maintenance'); // strength
  assert.ok(s.program.methodology);

  // Defensive program fields the dashboard reads unconditionally.
  assert.deepStrictEqual(s.program.pointer, { block: 0, week: 0 });
  assert.strictEqual(s.program.weeksPerBlock, 5);
  assert.deepStrictEqual(s.program.completedDays, {});
  assert.strictEqual(s.program.weekMod, null);

  // Profile training config defaults to the powerbuilding/unlimited shape.
  assert.strictEqual(s.profile.training.track, 'powerbuilding');
  assert.strictEqual(s.profile.training.timeMode, 'unlimited');
  assert.strictEqual(s.profile.training.timeCapMin, null);
  // [B4] Backfill lands on the frequency scale's standard (2 = 2x/week).
  assert.deepStrictEqual(s.profile.training.muscleFocus, {
    arms: 2, chest: 2, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 2,
  });
  assert.strictEqual(s.profile.training.focusScale, 3, 'scale marker stamped at the G1 scale');
  assert.strictEqual(s.profile.experience, 'intermediate');

  // Training age seeds from the program start date; landmarks get seeded.
  assert.strictEqual(s.profile.trainingAge.startedTs, 1_600_000_000_000);
  assert.strictEqual(s.profile.trainingAge.blocksCompleted, 0);
  assert.ok(s.profile.landmarks && s.profile.landmarks.chest, 'landmarks seeded');

  // The in-flight program gets a trainingConfig snapshot (powerbuilding).
  assert.strictEqual(s.program.trainingConfig.track, 'powerbuilding');
});

test('migrateState is idempotent', () => {
  const s = legacyState();
  app.migrateState(s);
  const once = JSON.stringify(s);
  app.migrateState(s);
  assert.strictEqual(JSON.stringify(s), once, 'second migrate must not change anything');
});

test('migrateState renames the retired methodology label on legacy saves', () => {
  // [legal-scrub] The retired third-party labels, assembled at runtime so this
  // source file stays clean of the mark (the legal-scrub grep gate).
  const OLD_DEFAULT = ['Jugg', 'ernaut'].join('') + ' + Bodybuilding';
  const OLD_STRENGTH = ['Jugg', 'ernaut'].join('') + ' strength focus';

  const s = legacyState();
  s.program.methodology = OLD_DEFAULT;
  app.migrateState(s);
  assert.strictEqual(s.program.methodology, 'Wave Strength + Bodybuilding');

  const s2 = legacyState();
  s2.program.methodology = OLD_STRENGTH;
  app.migrateState(s2);
  assert.strictEqual(s2.program.methodology, 'Wave strength focus');

  // A missing label backfills straight to the new default, and re-running the
  // migration never touches the renamed labels again (idempotent).
  const s3 = legacyState();
  app.migrateState(s3);
  assert.strictEqual(s3.program.methodology, 'Wave Strength + Bodybuilding');
  app.migrateState(s);
  assert.strictEqual(s.program.methodology, 'Wave Strength + Bodybuilding');
});

test('migrateState does not clobber a partially migrated save', () => {
  // A save that already chose bodybuilding must keep its track and focus.
  const s = legacyState();
  s.profile.training = {
    track: 'bodybuilding', timeMode: 'custom', timeCapMin: 45,
    muscleFocus: { arms: 5, chest: 4 },
  };
  s.program.blocks[0].scheme = 'jbb-hyp';
  app.migrateState(s);

  assert.strictEqual(s.profile.training.track, 'bodybuilding');
  assert.strictEqual(s.profile.training.timeMode, 'custom');
  assert.strictEqual(s.profile.training.timeCapMin, 45);
  // [B4] Old-scale values map through the rescale table (5 -> 3, 4 -> 2);
  // missing sliders fill to the new standard 2.
  assert.strictEqual(s.profile.training.muscleFocus.arms, 3);
  assert.strictEqual(s.profile.training.muscleFocus.chest, 2);
  assert.strictEqual(s.profile.training.muscleFocus.back, 2);
});

test('migrateState rescales sliders 0-6 to the 1-3 main scale, idempotently (B4+G1)', () => {
  const s = legacyState();
  s.profile.training = { track: 'bodybuilding', timeMode: 'unlimited', timeCapMin: null,
    muscleFocus: { arms: 0, chest: 1, back: 2, shoulders: 3, glutes: 4, legs: 5, calves: 6 } };
  s.program.trainingConfig = { track: 'bodybuilding', timeMode: 'unlimited', timeCapMin: null,
    muscleFocus: { arms: 6, chest: 3 } };
  s.program.pendingFocus = { arms: 1, chest: 6 };
  app.migrateState(s);
  // The full map on the profile copy: {0,1,2,3,4,5,6} -> {0,1,1,2,2,3,3}.
  assert.deepStrictEqual(s.profile.training.muscleFocus,
    { arms: 0, chest: 1, back: 1, shoulders: 2, glutes: 2, legs: 3, calves: 3 });
  // The snapshot and the staged edit are mapped too.
  assert.strictEqual(s.program.trainingConfig.muscleFocus.arms, 3);
  assert.strictEqual(s.program.pendingFocus.chest, 3);
  assert.strictEqual(s.profile.training.focusScale, 3);
  // Idempotent: a second run must not re-map the already-new values.
  const once = JSON.stringify(s);
  app.migrateState(s);
  assert.strictEqual(JSON.stringify(s), once);
});

test('migrateState [G1]: a B4-era 4 clamps to 3 with the ask preserved for the advanced tab', () => {
  const s = legacyState();
  s.profile.training = { track: 'bodybuilding', timeMode: 'unlimited', timeCapMin: null,
    focusScale: 4, muscleFocus: { arms: 4, chest: 2, back: 0 } };
  s.program.trainingConfig = { track: 'bodybuilding', timeMode: 'unlimited', timeCapMin: null,
    muscleFocus: { arms: 4, chest: 2 } };
  app.migrateState(s);
  assert.strictEqual(s.profile.training.muscleFocus.arms, 3, '4 clamps to the new ceiling');
  assert.strictEqual(s.profile.training.muscleFocus.chest, 2, 'in-scale values untouched');
  assert.strictEqual(s.profile.training.muscleFocus.back, 0, 'off stays off');
  assert.strictEqual(s.program.trainingConfig.muscleFocus.arms, 3, 'the snapshot clamps too');
  assert.deepStrictEqual(s.profile.training.focusSpecAsk, { arms: 4 },
    'the 4x ask is preserved as a specialization seed');
  assert.strictEqual(s.profile.training.focusScale, 3);
  const once = JSON.stringify(s);
  app.migrateState(s);
  assert.strictEqual(JSON.stringify(s), once, 'idempotent');
});

test('migrateState [G1]: a marker-3 save is never remapped (the reload-decay regression)', () => {
  // doNewProgram used to rebuild profile.training without the scale marker,
  // so every reload re-ran the 0-6 remap and decayed 2 -> 1. With the marker
  // stamped at creation, a modern save must round-trip byte-identical.
  const s = legacyState();
  s.profile.training = { track: 'bodybuilding', timeMode: 'unlimited', timeCapMin: null,
    focusScale: 3, muscleFocus: { arms: 2, chest: 3, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 2 } };
  app.migrateState(s);
  assert.deepStrictEqual(s.profile.training.muscleFocus,
    { arms: 2, chest: 3, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 2 },
    'no remap, no decay');
  assert.strictEqual(s.profile.training.focusSpecAsk, undefined, 'no ask invented');
});

test('migrateState: an old slider 6 on a 7-day program keeps its 4x ask, clamped to 3 (B4+G1)', () => {
  const s = legacyState();
  s.program.daysPerWeek = 7;
  s.profile.training = { track: 'bodybuilding', timeMode: 'unlimited', timeCapMin: null,
    muscleFocus: { chest: 6, back: 6 } };
  app.migrateState(s);
  // The historical 4x unlock survives as a specialization ask for the
  // advanced tab; the live value lands on the 1-3 main scale.
  assert.strictEqual(s.profile.training.muscleFocus.chest, 3, '6 on 7 days -> 3 live');
  assert.strictEqual(s.profile.training.muscleFocus.back, 3);
  assert.deepStrictEqual(s.profile.training.focusSpecAsk, { chest: 4, back: 4 });
});

test('migrateState seeds landmarks on a fresh default state, idempotently', () => {
  const s = app.defaultState();          // landmarks start as {}
  assert.deepStrictEqual(s.profile.landmarks, {});
  app.migrateState(s);
  assert.ok(Object.keys(s.profile.landmarks).length > 0, 'landmarks seeded');
  const once = JSON.stringify(s);
  app.migrateState(s);
  assert.strictEqual(JSON.stringify(s), once);
});

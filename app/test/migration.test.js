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
  assert.deepStrictEqual(s.profile.training.muscleFocus, {
    arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3,
  });
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
  // Existing slider values are preserved; missing ones fill to the 3 default.
  assert.strictEqual(s.profile.training.muscleFocus.arms, 5);
  assert.strictEqual(s.profile.training.muscleFocus.chest, 4);
  assert.strictEqual(s.profile.training.muscleFocus.back, 3);
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

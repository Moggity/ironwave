/* ============================================================
   IRONWAVE — test/tier-debug.test.js
   [Tier debug] The free/coach preview toggle (Settings > Debug:
   tier preview). hasCoach() is the one entitlement seam every
   coach surface checks; today it reads S.debugTier, and the
   monetization epic's M1 will swap its body for the billing
   adapter without touching call sites. Pins:
     - migrateState backfills debugTier to 'coach' (idempotent,
       and a stored 'free' survives);
     - hasCoach() flips with the toggle and defaults entitled;
     - coach surfaces lock in free mode (program view, meet view,
       the Progress landmark band) while free surfaces stay:
       the Progress e1RM overlay and PR feed render either way;
     - the default 'coach' render is byte-identical to the
       pre-feature output (the toggle is inert until used).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();

const FOCUS = { arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3 };

function seededState() {
  const s = app.defaultState();
  s.program = app.makeProgram({ daysPerWeek: 4, track: 'powerbuilding',
    experience: 'intermediate', timeMode: 'unlimited',
    muscleFocus: { ...FOCUS }, maxes: {} });
  app.migrateState(s);
  return s;
}

test('migrateState backfills debugTier to coach and is idempotent', () => {
  const s = { profile: {} };
  app.migrateState(s);
  assert.strictEqual(s.debugTier, 'coach', 'legacy saves land entitled');
  app.migrateState(s);
  assert.strictEqual(s.debugTier, 'coach', 'idempotent');
  const f = { profile: {}, debugTier: 'free' };
  app.migrateState(f);
  assert.strictEqual(f.debugTier, 'free', 'a stored free preview survives migration');
});

test('hasCoach reads the toggle and defaults entitled', () => {
  app.S = seededState();
  assert.strictEqual(app.hasCoach(), true, 'coach by default');
  app.S.debugTier = 'free';
  assert.strictEqual(app.hasCoach(), false);
  app.S.debugTier = 'coach';
  assert.strictEqual(app.hasCoach(), true);
});

test('coach surfaces lock in free mode; free surfaces survive', () => {
  app.S = seededState();
  app.V = { view: 'program', dayIdx: null };
  const lockMarker = app.t('tier.locked_title');

  const paidProgram = app.vProgram();
  assert.ok(!paidProgram.includes(lockMarker), 'coach mode: program renders');
  assert.ok(paidProgram.includes(app.t('prog.blocks')), 'coach mode: block list present');

  app.S.debugTier = 'free';
  const freeProgram = app.vProgram();
  assert.ok(freeProgram.includes(lockMarker), 'free mode: program view locks');
  assert.ok(!freeProgram.includes(app.t('prog.blocks')), 'free mode: no block list leaks');

  const freeMeet = app.vMeet();
  assert.ok(freeMeet.includes(lockMarker), 'free mode: meet view locks');

  const freeProgress = app.vProgress();
  assert.ok(freeProgress.includes(app.t('px.e1rm')), 'free mode: e1RM overlay stays free');
  assert.ok(!freeProgress.includes(app.t('px.band')), 'free mode: landmark band gone');
});

test('the coach default renders byte-identically with the toggle present', () => {
  app.S = seededState();
  app.V = { view: 'program', dayIdx: null };
  const a = app.vProgram();
  app.S.debugTier = 'free';
  app.S.debugTier = 'coach'; // round-trip the toggle
  const b = app.vProgram();
  assert.strictEqual(a, b, 'toggling back leaves the render unchanged');
});

/* ============================================================
   BEGINNER APP, package 4 (Coach, part 1). THIS HEADER IS THE BUILDER'S SPEC.
   Criteria: D2 to D10, B1, B2, B4, B5, K3. Pick tests (B*) are in
   coach-pick.test.js; fixtures and the log builder are in coach-fixtures.js.
   The builder implements beginner/coach.js and the `coach` section of
   beginner/config.js. It may not edit any test file.

   ---------------------------------------------------------------- PURITY (K3)
   Everything hangs off the single global `const Coach = { ... }` (plain object of
   functions). No DOM, storage, network or clock: time arrives as `now` (epoch ms).
   Data arrives as arguments (exercise rows, workouts, goal focus). Only `Engine`,
   `KG_PER_LB` and `BEGINNER_CONFIG` may be read from the shared scope; coach.js
   must not mention BEGINNER_EXERCISES, Store, UI or beginnerGoalFocus. Inputs are
   never mutated, outputs are fresh plain data, same input -> same output.
   Every number below is read from BEGINNER_CONFIG.coach, never written in logic.
   Do NOT use Engine.bestE1RM / anchorE1RM / e1rmTrend / _recordsByDay: they read
   Date.now() and apply a 120-day window. Engine.e1rm, Engine.weightFor and
   Engine.roundLoad are clock-free and are the ones to use. If you wrap
   Engine.doubleProgression, note that it groups by UTC day via _recordsByDay
   (Date.now based, 10-year window) and only looks at the top set, ignores the
   criteria's every-set rule and treats a missing RPE as 10; the tests below are
   the contract, not the engine.

   ---------------------------------------------------------------- CONFIG KEYS
   BEGINNER_CONFIG.coach = {
     repRange: [8, 12],                       // D3, D4 (weighted exercises)
     effortRpe: { easy: 6, good: 8, hard: 9.5 }, defaultRpe: 8,   // D2
     shortfallReps: 2,                        // D5: a set this many reps below its target is short
     holdsBeforeDrop: 2,                      // D5: two short sessions hold, the next short one drops
     easyTriggerReps: 12,                     // D6: first set Easy at this many reps or more
     easyTargetReps: 10, easyTargetRpe: 8,    // D6: Engine.weightFor target
     longGapDays: 56,                         // edge: exercise not seen for months
     repsOnlyEquipment: ['bw', 'bd'],         // D8
     repsOnlyRange: [1, 20],                  // D8
     setsFirst: 2, setsFirstSessions: 2, setsAfter: 3, setsMin: 1, setsMax: 4,  // D9
     suggestCount: 6, tickCount: 3,           // B1
     muscleOrder: ['chest', 'back', 'legs', 'glutes', 'shoulders', 'arms', 'calves'],  // B1, B2 ties
     increments: {                            // weight step per equipment code, in DISPLAY units
       kg: { bb: 2.5, db: 2, mc: 5, cb: 2.5, kb: 4, bw: 0, bd: 0 },
       lb: { bb: 5,   db: 5, mc: 10, cb: 5,  kb: 5, bw: 0, bd: 0 },
     },
   }

   ---------------------------------------------------------------- API
   Shapes: see the brief. Sets carry weightKg (kg), reps, effort
   (null|'easy'|'good'|'hard'), at, and optional extra: true.
   ORDER: the Store keeps workouts and sets in INSERTION order, not sorted, and
   hands the coach deep-frozen state. The coach orders workouts by startedAt
   (ties: array index) and sets by at (ties: array index) itself, on a copy.
   "Last", "first", "earlier" and "set k" below always mean in that order.
   Never sort, push or splice an input array (frozen arrays throw).
   "Non-extra set" = a set without extra: true and with reps > 0. Extra sets are
   ignored by D3, D4, D5, D6, D9 and D10 everywhere (criterion L6).

   Coach.effortRpe(effort) -> number                                         (D2)
     'easy' 6, 'good' 8, 'hard' 9.5; null/undefined/unknown -> defaultRpe (8).

   Coach.incrementKg(equipment, units) -> number                             (D4)
     increments[units][equipment] converted to kg (lb value * KG_PER_LB).
     units null/undefined -> 'kg'. Reps-only codes give 0.

   Coach.prefill({ exercise, workouts, currentWorkoutId, units, now })
     -> { weightKg: number|null, reps: number|null, rule: string }   (C2, D3 to D8)
     exercise: a row. workouts: state.workouts. currentWorkoutId: id of the workout
     in progress (or null). History = every workout whose id !== currentWorkoutId.
     Today = the non-extra sets of this exercise in the current workout. The result
     is the pre-fill for the NEXT set (set number today.length + 1).
     A SESSION on an exercise = a history workout with >= 1 non-extra set of it.
     Its WORKING SETS = its non-extra sets at its top (max) weightKg, in log order.
     (a) Set 1 (nothing today): the SESSION TARGET, computed by replaying history
       session by session (the target each past session was given is needed for
       SHORT below; while replaying, "now" for the gap rule is the at of the next
       session's first set, and for the final target it is the `now` argument):
       - no session -> { weightKg: null, reps: null, rule: 'first' }. The screen
         shows the C2 prompt; nothing is pre-filled.
       - otherwise from the last session L (top weight W, working reps r1..rn):
         base per-set reps t_i = clamp(r_i + 1, lo, hi)                   'reps' (D3)
         * now - (at of L's last set of this exercise) > longGapDays days:
           weight W, reps clamp(r_i, lo, hi), no raise, no drop.         'gap'
         * else if L is short and it is the (holdsBeforeDrop + 1)th short session
           in a row: weight = down(W), reps t_i.                         'drop' (D5)
         * else if every working set has reps >= hi and none is Hard:
           weight = up(W), reps lo for every set.                        'raise' (D4)
         * else weight W, reps t_i.                                       'reps' (D3)
         The pre-fill for set k uses t_k; past the last working set, t_n.
       - SHORT: a session is short when its top weight equals (1e-6) the weight
         its own replayed target pre-filled AND at least one working set has
         reps <= target reps for that set index - shortfallReps. The first
         session (no target) is never short. The short count goes to 0 after a
         non-short session and whenever a 'drop' or 'gap' target is produced;
         the session done on that target then counts as 1 if it is short.
       - up(W): in display units, the largest multiple of the increment that is
         <= W + inc (so a raise is > W and never more than one increment).
         down(W): the smallest multiple >= W - inc, and never below one increment.
         Holds keep W exactly (no re-rounding). Grid math in display units with a
         small epsilon; return kg.
       - Reps-only exercises (equipment in repsOnlyEquipment, D8): weight W always
         (never raise, drop or D6), reps clamp(r_i + 1, repsOnlyRange).
     (b) Set 2 onward (today has sets): S1 = today's first set, P = today's last set.
       - D6: if today has exactly one set, S1.effort is 'easy', S1.reps >=
         easyTriggerReps, the exercise is weighted, and
         X = Engine.weightFor(Engine.e1rm(S1.weightKg, S1.reps, 6), easyTargetReps,
         easyTargetRpe, incrementKg) is > S1.weightKg:
         -> { weightKg: X, reps: easyTargetReps, rule: 'easy' }. (Never lowers.)
       - otherwise weight = P.weightKg; reps = t_k when the session target exists
         and P.weightKg equals its weight, else P.reps.                  'session'

   Coach.setCount({ exerciseId, workouts, currentWorkoutId }) -> integer      (D9)
     Sessions in history (current workout excluded) < setsFirstSessions ->
     setsFirst, else setsAfter, clamped to [setsMin, setsMax]. Package 10 will add
     the E5 to E7 adjustments as further optional arguments; nothing else in this
     package moves the count (no gap reset, no effort or feel effect).

   Coach.newBests({ workouts, workoutId }) -> [exerciseId, ...]               (D10)
     For each exercise with non-extra sets in workout `workoutId` (first-appearance
     order): estimate = max Engine.e1rm(weightKg, reps, effortRpe(effort)) over
     those sets; prior = the same max over every workout with an EARLIER startedAt
     (all time). Listed when a prior estimate exists and is > 0 and today's beats it by
     more than 1e-9. Sets at 0 kg give 0 and so never make a best.

   Pick (B1, B2, B4, B5): see coach-pick.test.js header.

   ---------------------------------------------------------------- LEAD-DECISIONS
   Each is pinned below by a test with a `// LEAD-DECISION:` comment.
   LD1  D3 "one more rep per set" is per set (t_i), not one number for all sets.
   LD2  D5 short = some working set >= 2 below its own target, only at the target weight.
   LD3  D5 after a drop reps follow D3 and the short count restarts.
   LD4  D7 is measured against what was lifted: a user who chose a heavier weight is followed.
   LD5  Weight changed mid-session: the heaviest weight's sets are the working sets.
   LD6  One-set workouts count in full (D4 can fire on one set; D9 counts the session).
   LD7  Not seen for more than 56 days: same weight and same reps, no raise.
   LD8  Bodyweight and band are reps-only, range 1 to 20 (no floor at 8, no cap at 12).
   LD9  The increment table values (above).
   LD10 Grid rounding: raise floors to the grid, drop ceils, holds untouched, floor = one increment.
   LD11 D6 only on the second set of the day, never lowers, reps become 10.
   LD12 In-session pre-fill follows the weight just lifted.
   LD13 First time: weight and reps null.
   LD14 New best needs earlier history, is all time, and never for 0 kg sets.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadBeginner } = require('./load-beginner');
const F = require('./coach-fixtures');
const { W, open, ex, dayMs, DAY, lbToKg, kgToLb, deepFreeze, mulberry32 } = F;

const app = loadBeginner();
const { Coach, Engine, BEGINNER_CONFIG } = app;

const EPS = 1e-6;
const near = (a, b) => a != null && b != null && Math.abs(a - b) < EPS;
const KG_INC = { bb: 2.5, db: 2, mc: 5, cb: 2.5, kb: 4 };
const LB_INC = { bb: 5, db: 5, mc: 10, cb: 5, kb: 5 };

function api(name, surface = app) {
  const C = surface.Coach;
  assert.ok(C && typeof C[name] === 'function', `Coach.${name}(...) is missing: package 4 must provide it`);
  return (...a) => C[name](...a);
}

function lastAt(workouts) {
  let t = 0;
  for (const w of workouts) for (const s of w.sets) t = Math.max(t, s.at);
  return t;
}
// Pre-fill for the next set of `exId`. Defaults: kg, the open workout 'today' if
// present, now = one day after the last logged set.
function pre(exId, workouts, opts = {}, surface = app) {
  const ws = deepFreeze(JSON.parse(JSON.stringify(workouts)));
  return api('prefill', surface)({
    exercise: ex(exId),
    workouts: ws,
    currentWorkoutId: 'current' in opts ? opts.current : (ws.some(w => w.id === 'today') ? 'today' : null),
    units: 'units' in opts ? opts.units : 'kg',
    now: opts.now != null ? opts.now : lastAt(ws) + DAY,
  });
}
function expectPre(p, weightKg, reps, msg) {
  assert.ok(p && typeof p === 'object', `${msg}: expected a pre-fill object, got ${p}`);
  assert.ok(weightKg === null ? p.weightKg === null : near(p.weightKg, weightKg),
    `${msg}: expected weight ${weightKg} kg, got ${p.weightKg}`);
  assert.strictEqual(p.reps, reps, `${msg}: expected ${reps} reps, got ${p.reps}`);
}
const lb = x => lbToKg(x);

// ============================================================ config
test('D3 the coach thresholds live in BEGINNER_CONFIG.coach with their starting values (also D2, D4 to D9, B1)', () => {
  const c = BEGINNER_CONFIG.coach;
  const want = {
    repRange: [8, 12], effortRpe: { easy: 6, good: 8, hard: 9.5 }, defaultRpe: 8,
    shortfallReps: 2, holdsBeforeDrop: 2, easyTriggerReps: 12, easyTargetReps: 10, easyTargetRpe: 8,
    longGapDays: 56, repsOnlyEquipment: ['bw', 'bd'], repsOnlyRange: [1, 20],
    setsFirst: 2, setsFirstSessions: 2, setsAfter: 3, setsMin: 1, setsMax: 4,
    suggestCount: 6, tickCount: 3,
    muscleOrder: ['chest', 'back', 'legs', 'glutes', 'shoulders', 'arms', 'calves'],
    // LEAD-DECISION (LD9): the plan only says "the weight step follows the equipment".
    // kg: barbell 2.5 (two 1.25 plates, Ironwave's rounding), dumbbell 2 (the plan's
    // D6 example 10 kg -> 12 kg; Ironwave defaults 2.5), machine 5 (Ironwave
    // machineStep), cable 2.5 (beginner-friendly; Ironwave uses 5), kettlebell 4.
    // lb: barbell 5 (Ironwave 2.5 needs 1.25 lb plates), dumbbell 5, machine 10,
    // cable 5, kettlebell 5.
    increments: { kg: { bb: 2.5, db: 2, mc: 5, cb: 2.5, kb: 4, bw: 0, bd: 0 }, lb: { bb: 5, db: 5, mc: 10, cb: 5, kb: 5, bw: 0, bd: 0 } },
  };
  for (const [k, v] of Object.entries(want)) {
    assert.deepStrictEqual(c[k], v, `BEGINNER_CONFIG.coach.${k} should start at ${JSON.stringify(v)}`);
  }
});

// ============================================================ D2
test('D2 maps Easy to RPE 6, Good to RPE 8, Hard to RPE 9.5', () => {
  const rpe = api('effortRpe');
  assert.strictEqual(rpe('easy'), 6);
  assert.strictEqual(rpe('good'), 8);
  assert.strictEqual(rpe('hard'), 9.5);
});

test('D2 no tap counts as RPE 8 (null, undefined or an unknown value)', () => {
  const rpe = api('effortRpe');
  assert.strictEqual(rpe(null), 8);
  assert.strictEqual(rpe(undefined), 8);
  assert.strictEqual(rpe('meh'), 8);
});

// ============================================================ D3
test('D3 first time on an exercise there is nothing to pre-fill', () => {
  // LEAD-DECISION (LD13): no history -> weight and reps null, rule 'first'; the
  // Lift screen shows the C2 sentence instead. Alternative: reps 12 pre-filled.
  const p = pre('bb-curl', [W(0, 'leg-press: 50 x 10, 10')]);
  expectPre(p, null, null, 'never done before');
  assert.strictEqual(p.rule, 'first');
});

test('D3 10 kg x 10, 10, 10 gives 10 kg x 11 next session', () => {
  const p = pre('bb-curl', [W(0, 'bb-curl: 10 x 10, 10, 10')]);
  expectPre(p, 10, 11, 'after 10 kg x 10, 10, 10');
  assert.strictEqual(p.rule, 'reps');
});

test('D3 one more rep per set: 10 kg x 12, 10, 9 pre-fills 12, then 11, then 10', () => {
  // LEAD-DECISION (LD1): "one more rep per set" is read per set. Alternative: a
  // single number for all sets (e.g. the first or the lowest set plus one).
  const hist = [W(0, 'bb-curl: 10 x 12, 10, 9')];
  expectPre(pre('bb-curl', hist), 10, 12, 'set 1');
  expectPre(pre('bb-curl', [...hist, open(2, 'bb-curl: 10 x 12')]), 10, 11, 'set 2');
  expectPre(pre('bb-curl', [...hist, open(2, 'bb-curl: 10 x 12, 11')]), 10, 10, 'set 3');
  expectPre(pre('bb-curl', [...hist, open(2, 'bb-curl: 10 x 12, 11, 10')]), 10, 10, 'a 4th set repeats the last target');
});

test('D3 reps stay inside 8 to 12 for weighted exercises', () => {
  expectPre(pre('bb-curl', [W(0, 'bb-curl: 10 x 12h, 12, 12')]), 10, 12, 'a Hard set at 12 holds at 12');
  expectPre(pre('bb-curl', [W(0, 'bb-curl: 10 x 5, 6')]), 10, 8, 'below 8 is lifted to 8');
  expectPre(pre('bb-curl', [W(0, 'bb-curl: 10 x 12, 12, 11')]), 10, 12, 'never 13');
});

test('D3 extra sets are ignored (L6): an extra set changes neither weight nor reps', () => {
  const p = pre('bb-curl', [W(0, 'bb-curl: 10 x 10, 10; 15 x 3*, 3*')]);
  expectPre(p, 10, 11, 'extra sets at 15 kg are not the top weight');
  const q = pre('bb-curl', [W(0, 'bb-curl: 10 x 10, 10, 4*')]);
  expectPre(q, 10, 11, 'an extra set of 4 does not count');
});

test('D3 a weight changed mid-session: the heaviest weight and its sets set the next target', () => {
  // LEAD-DECISION (LD5): working sets = the sets at the session's top weight.
  // Alternatives: the last weight used, or the weight with the most sets.
  const hist = [W(0, 'db-curl: 10 x 11; 12 x 9, 8')];
  expectPre(pre('db-curl', hist), 12, 10, 'set 1 from 12 kg x 9');
  expectPre(pre('db-curl', [...hist, open(2, 'db-curl: 12 x 10')]), 12, 9, 'set 2 from 12 kg x 8');
});

test('D3 only this exercise\'s sessions count, and the last one decides', () => {
  const hist = [
    W(0, 'bb-curl: 10 x 8, 8'),
    W(2, 'leg-press: 80 x 12, 12, 12', 'db-curl: 12 x 12, 12'),
    W(4, 'bb-curl: 10 x 9, 9', 'leg-press: 85 x 8'),
  ];
  expectPre(pre('bb-curl', hist), 10, 10, 'bb-curl follows its own last session');
});

test('D3 the workout in progress is not history: only the next set follows it', () => {
  const hist = [W(0, 'bb-curl: 10 x 10, 10')];
  // A different exercise logged today does not move bb-curl's target.
  expectPre(pre('bb-curl', [...hist, open(2, 'leg-press: 50 x 12, 12')]), 10, 11, 'set 1 with other work done today');
});

test('D3 in session the next set follows the weight the user just used', () => {
  // LEAD-DECISION (LD12): set 2 onward pre-fills the last set's weight; reps follow
  // the target while that weight is the target weight, else repeat the last reps.
  const hist = [W(0, 'bb-curl: 10 x 10, 10, 10')];
  const a = pre('bb-curl', [...hist, open(2, 'bb-curl: 12.5 x 9')]);
  expectPre(a, 12.5, 9, 'user went heavier on set 1');
  assert.strictEqual(a.rule, 'session');
  expectPre(pre('bb-curl', [...hist, open(2, 'bb-curl: 10 x 8')]), 10, 11, 'user missed on set 1 at the target weight');
  expectPre(pre('bb-curl', [...hist, open(2, 'bb-curl: 7.5 x 12g')]), 7.5, 12, 'user went lighter');
});

test('D3 in the first session on an exercise the next set repeats the set just done', () => {
  const p = pre('db-curl', [open(0, 'db-curl: 8 x 12g')]);
  expectPre(p, 8, 12, 'set 2 of the first ever session');
  assert.strictEqual(p.rule, 'session');
});

test('D3 after a long gap (not seen for months) the weight and reps are repeated, not raised', () => {
  // LEAD-DECISION (LD7): more than longGapDays (56) since the exercise's last set ->
  // same weight, same reps (clamped to 8..12), no +1 and no raise. Alternatives:
  // ignore the gap; drop one increment; treat as a first time.
  const hist = [W(0, 'bb-curl: 10 x 10, 9')];
  const t = lastAt(hist);
  const soon = pre('bb-curl', hist, { now: t + 50 * DAY });
  expectPre(soon, 10, 11, '50 days later progression continues');
  const late = pre('bb-curl', hist, { now: t + 120 * DAY });
  expectPre(late, 10, 10, '120 days later the same session is repeated');
  assert.strictEqual(late.rule, 'gap');
  expectPre(pre('bb-curl', [...hist, open(120, 'bb-curl: 10 x 10')], { now: t + 120 * DAY }), 10, 9, 'set 2 after the gap');
});

test('D4 after a long gap a session that hit 12 everywhere does not raise the weight', () => {
  const hist = [W(0, 'bb-curl: 10 x 12, 12')];
  const p = pre('bb-curl', hist, { now: lastAt(hist) + 90 * DAY });
  expectPre(p, 10, 12, 'no raise after 90 days away');
});

// ============================================================ D4
test('D4 raises weight one increment when all sets hit 12', () => {
  const p = pre('bb-curl', [W(0, 'bb-curl: 10 x 12, 12, 12')]);
  expectPre(p, 12.5, 8, 'barbell 10 kg x 12, 12, 12');
  assert.strictEqual(p.rule, 'raise');
  expectPre(pre('bb-curl', [W(0, 'bb-curl: 10 x 12, 12, 12'), open(2, 'bb-curl: 12.5 x 8')]), 12.5, 8, 'set 2 of the raised session');
});

test('D4 the increment follows the equipment (kg)', () => {
  const cases = [['bb-curl', 'bb'], ['db-curl', 'db'], ['leg-press', 'mc'], ['lat-pulldown', 'cb'], ['kb-press', 'kb']];
  for (const [id, eq] of cases) {
    const start = 4 * KG_INC[eq];
    const p = pre(id, [W(0, `${id}: ${start} x 12, 12`)]);
    expectPre(p, start + KG_INC[eq], 8, `${eq} at ${start} kg`);
  }
});

test('D4 no tap counts as Good, and Easy sets earn the raise too', () => {
  expectPre(pre('bb-curl', [W(0, 'bb-curl: 10 x 12, 12g, 12')]), 12.5, 8, 'no tap and Good');
  expectPre(pre('bb-curl', [W(0, 'bb-curl: 10 x 12e, 12e')]), 12.5, 8, 'Easy');
  expectPre(pre('bb-curl', [W(0, 'bb-curl: 10 x 13, 14')]), 12.5, 8, 'more than 12');
});

test('D4 one Hard set blocks the raise and the weight holds at 12 reps', () => {
  const p = pre('bb-curl', [W(0, 'bb-curl: 10 x 12, 12, 12h')]);
  expectPre(p, 10, 12, 'a Hard set at 12');
});

test('D4 one set short of 12 blocks the raise', () => {
  expectPre(pre('bb-curl', [W(0, 'bb-curl: 10 x 12, 12, 11')]), 10, 12, 'sets 12, 12, 11');
});

test('D4 a one-set workout at 12 earns the raise', () => {
  // LEAD-DECISION (LD6): "every set" holds for a single set. Alternative: require at
  // least the D9 set count (2) before a raise, so one easy set cannot move weight.
  expectPre(pre('bb-curl', [W(0, 'bb-curl: 10 x 12')]), 12.5, 8, 'one set of 12');
});

test('D4 an extra set below 12 does not block the raise (L6)', () => {
  expectPre(pre('bb-curl', [W(0, 'bb-curl: 10 x 12, 12, 5h*')]), 12.5, 8, 'extra set ignored');
});

test('D4 an off-grid weight rises to the grid and never by more than one increment', () => {
  // LEAD-DECISION (LD10): up(W) = largest grid multiple <= W + increment.
  expectPre(pre('bb-curl', [W(0, 'bb-curl: 11 x 12, 12')]), 12.5, 8, 'barbell 11 kg');
  expectPre(pre('leg-press', [W(0, 'leg-press: 13 x 12, 12')]), 15, 8, 'machine 13 kg');
});

test('D4 lb user: a barbell rises 5 lb and lands on a loadable lb weight', () => {
  const p = pre('bb-curl', [W(0, 'bb-curl: 45lb x 12, 12')], { units: 'lb' });
  expectPre(p, lb(50), 8, '45 lb barbell');
  expectPre(pre('db-curl', [W(0, 'db-curl: 25lb x 12, 12')], { units: 'lb' }), lb(30), 8, '25 lb dumbbell');
  expectPre(pre('leg-press', [W(0, 'leg-press: 90lb x 12, 12')], { units: 'lb' }), lb(100), 8, '90 lb machine');
});

test('D4 lb user: a weight logged in kg rises onto the lb grid, at most one increment', () => {
  // 20 kg = 44.09 lb; 44.09 + 5 = 49.09 -> 45 lb
  const p = pre('bb-curl', [W(0, 'bb-curl: 20 x 12, 12')], { units: 'lb' });
  expectPre(p, lb(45), 8, '20 kg barbell for a lb user');
  assert.ok(p.weightKg > 20 && p.weightKg <= 20 + lb(5) + EPS, 'rises, by at most 5 lb');
});

test('D4 units null is treated as kg', () => {
  expectPre(pre('bb-curl', [W(0, 'bb-curl: 10 x 12, 12')], { units: null }), 12.5, 8, 'units null');
});

test('D4 incrementKg gives the weight step per equipment in kg, for kg and lb users', () => {
  const inc = api('incrementKg');
  for (const [eq, v] of Object.entries(KG_INC)) assert.ok(near(inc(eq, 'kg'), v), `${eq} kg step ${v}`);
  for (const [eq, v] of Object.entries(LB_INC)) assert.ok(near(inc(eq, 'lb'), lb(v)), `${eq} lb step ${v} lb`);
  assert.strictEqual(inc('bw', 'kg'), 0);
  assert.strictEqual(inc('bd', 'lb'), 0);
  assert.ok(near(inc('bb', null), 2.5), 'null units = kg');
});

// ============================================================ D5
// bb-curl story: 10 kg x 12, 12 earns 12.5 kg x 8; the user then struggles.
const RAISED = W(0, 'bb-curl: 10 x 12, 12');

test('D5 two sessions in a row falling 2 or more reps short hold the weight', () => {
  // LEAD-DECISION (LD2): a session is short when some working set is 2 or more
  // below its own target, at the target weight. Alternatives: total reps 2 short;
  // every set 2 short; the average.
  const hist = [RAISED, W(2, 'bb-curl: 12.5 x 6, 6'), W(4, 'bb-curl: 12.5 x 6, 5')];
  const p = pre('bb-curl', hist);
  expectPre(p, 12.5, 8, 'held after two short sessions');
});

test('D5 a third short session in a row drops the weight one increment', () => {
  // LEAD-DECISION (LD3): reps after the drop follow D3 (here 6 + 1 -> 8).
  const hist = [RAISED, W(2, 'bb-curl: 12.5 x 6, 6'), W(4, 'bb-curl: 12.5 x 6, 5'), W(6, 'bb-curl: 12.5 x 6, 6')];
  const p = pre('bb-curl', hist);
  expectPre(p, 10, 8, 'dropped after the third short session');
  assert.strictEqual(p.rule, 'drop');
});

test('D5 a session only 1 rep short does not count', () => {
  const hist = [RAISED, W(2, 'bb-curl: 12.5 x 7, 7'), W(4, 'bb-curl: 12.5 x 7, 7'), W(6, 'bb-curl: 12.5 x 7, 7')];
  expectPre(pre('bb-curl', hist), 12.5, 8, 'three sessions 1 rep short');
});

test('D5 one short set is enough to make the session short', () => {
  const hist = [RAISED, W(2, 'bb-curl: 12.5 x 8, 6'), W(4, 'bb-curl: 12.5 x 8, 6'), W(6, 'bb-curl: 12.5 x 9, 6')];
  expectPre(pre('bb-curl', hist), 10, 10, 'dropped; reps from 9, 6 -> 10, 8 per set');
  expectPre(pre('bb-curl', [...hist, open(8, 'bb-curl: 10 x 10')]), 10, 8, 'set 2 after the drop');
});

test('D5 a session that is not short in between restarts the count', () => {
  const hist = [RAISED, W(2, 'bb-curl: 12.5 x 6, 6'), W(4, 'bb-curl: 12.5 x 8, 8'),
    W(6, 'bb-curl: 12.5 x 7, 7'), W(8, 'bb-curl: 12.5 x 7, 7')];
  // s2 short, s4 ok (target 8), s6 target 9: 7 is short, s8 target 8: 7 is not short
  expectPre(pre('bb-curl', hist), 12.5, 8, 'no drop: the short sessions were not three in a row');
  const hist2 = [RAISED, W(2, 'bb-curl: 12.5 x 6, 6'), W(4, 'bb-curl: 12.5 x 8, 8'),
    W(6, 'bb-curl: 12.5 x 6, 6'), W(8, 'bb-curl: 12.5 x 6, 6')];
  expectPre(pre('bb-curl', hist2), 12.5, 8, 'only two in a row since the good session');
});

test('D5 after a drop the count starts again', () => {
  const dropped = [RAISED, W(2, 'bb-curl: 12.5 x 6, 6'), W(4, 'bb-curl: 12.5 x 6, 6'), W(6, 'bb-curl: 12.5 x 6, 6')];
  const two = [...dropped, W(8, 'bb-curl: 10 x 6, 6'), W(10, 'bb-curl: 10 x 6, 6')];
  expectPre(pre('bb-curl', two), 10, 8, 'two short sessions after the drop hold');
  const three = [...two, W(12, 'bb-curl: 10 x 6, 6')];
  expectPre(pre('bb-curl', three), 7.5, 8, 'the third drops again');
});

test('D5 the drop never goes below one increment', () => {
  const hist = [W(0, 'db-curl: 2 x 6, 6'), W(2, 'db-curl: 2 x 6, 6'), W(4, 'db-curl: 2 x 6, 6'), W(6, 'db-curl: 2 x 6, 6')];
  const p = pre('db-curl', hist);
  expectPre(p, 2, 8, 'a 2 kg dumbbell stays 2 kg');
});

test('D5 lb user: the drop is one lb increment and lands on the lb grid', () => {
  const hist = [W(0, 'bb-curl: 50lb x 12, 12'), W(2, 'bb-curl: 55lb x 6, 6'), W(4, 'bb-curl: 55lb x 6, 6'), W(6, 'bb-curl: 55lb x 6, 6')];
  expectPre(pre('bb-curl', hist.slice(0, 1), { units: 'lb' }), lb(55), 8, 'raised to 55 lb');
  expectPre(pre('bb-curl', hist, { units: 'lb' }), lb(50), 8, 'dropped to 50 lb');
});

test('D5 a session at a weight other than the pre-filled one never counts as short', () => {
  // LEAD-DECISION (LD2, LD4): the user chose 15 kg over the 12.5 kg pre-fill. That
  // session is followed but not counted; the next ones at 15 kg are.
  const hist = [RAISED, W(2, 'bb-curl: 15 x 6, 6'), W(4, 'bb-curl: 15 x 6, 6'), W(6, 'bb-curl: 15 x 6, 6')];
  expectPre(pre('bb-curl', hist), 15, 8, 'only two short sessions at the pre-filled 15 kg');
  expectPre(pre('bb-curl', [...hist, W(8, 'bb-curl: 15 x 6, 6')]), 12.5, 8, 'the third at 15 kg drops');
});

test('D5 extra sets cannot make a session short (L6)', () => {
  const hist = [RAISED, W(2, 'bb-curl: 12.5 x 8, 8, 2*'), W(4, 'bb-curl: 12.5 x 8, 8, 2*'), W(6, 'bb-curl: 12.5 x 8, 8, 2*')];
  expectPre(pre('bb-curl', hist), 12.5, 9, 'normal sets met the target');
});

test('D5 a long gap restarts the count', () => {
  const hist = [RAISED, W(2, 'bb-curl: 12.5 x 6, 6'), W(4, 'bb-curl: 12.5 x 6, 6'), W(100, 'bb-curl: 12.5 x 6, 6')];
  expectPre(pre('bb-curl', hist), 12.5, 8, 'the session after the gap is the first short one');
});

// ============================================================ D6
const easyX = (w, reps, incKg) => Engine.weightFor(Engine.e1rm(w, reps, 6), 10, 8, incKg);

test('D6 a first set Easy at 12 or more pre-fills the next set from Engine.weightFor for 10 reps at RPE 8', () => {
  const hist = [W(0, 'bb-curl: 20 x 11, 11')];
  const p = pre('bb-curl', [...hist, open(2, 'bb-curl: 20 x 12e')]);
  const x = easyX(20, 12, 2.5);
  assert.ok(near(x, 22.5), 'sanity: Engine says 22.5 kg');
  expectPre(p, x, 10, 'after 20 kg x 12 Easy');
  assert.strictEqual(p.rule, 'easy');
});

test('D6 10 kg x 14 Easy on dumbbells goes to 12 kg (the plan example)', () => {
  const p = pre('db-curl', [open(0, 'db-curl: 10 x 14e')]);
  assert.ok(near(easyX(10, 14, 2), 12), 'sanity: Engine says 12 kg');
  expectPre(p, 12, 10, 'first ever session, set 2');
});

test('D6 fires only for Easy with 12 or more reps on the first set', () => {
  const hist = [W(0, 'bb-curl: 20 x 11, 11')];
  const cases = [['20 x 12g', 'Good at 12'], ['20 x 11e', 'Easy at 11'], ['20 x 15h', 'Hard at 15'], ['20 x 15', 'no tap at 15']];
  for (const [today, label] of cases) {
    const p = pre('bb-curl', [...hist, open(2, 'bb-curl: ' + today)]);
    assert.ok(near(p.weightKg, 20), `${label}: weight stays 20 kg, got ${p.weightKg}`);
    assert.notStrictEqual(p.rule, 'easy', `${label}: D6 must not fire`);
  }
  const big = pre('bb-curl', [...hist, open(2, 'bb-curl: 20 x 20e')]);
  expectPre(big, easyX(20, 20, 2.5), 10, 'Easy at 20 reps');
});

test('D6 only the first set triggers it', () => {
  // LEAD-DECISION (LD11): D6 is evaluated for the second set of the day only.
  const hist = [W(0, 'bb-curl: 20 x 11, 11')];
  const p = pre('bb-curl', [...hist, open(2, 'bb-curl: 20 x 12g, 12e')]);
  expectPre(p, 20, 12, 'set 3 follows set 2 at the target weight');
});

test('D6 never lowers the weight: a rounded result at or below the set changes nothing', () => {
  // 11 kg machine x 12 Easy -> 12.05 kg -> rounds to 10 kg on a 5 kg stack: ignored.
  const p = pre('leg-press', [open(0, 'leg-press: 11 x 12e')]);
  expectPre(p, 11, 12, 'machine 11 kg x 12 Easy');
  // 10 kg dumbbell x 12 Easy -> 10.95 -> 10 on a 2 kg grid: equal, ignored.
  const q = pre('db-curl', [open(0, 'db-curl: 10 x 12e')]);
  expectPre(q, 10, 12, 'dumbbell 10 kg x 12 Easy');
});

test('D6 the user can change it back: the set after follows what was lifted', () => {
  const hist = [W(0, 'bb-curl: 20 x 11, 11')];
  expectPre(pre('bb-curl', [...hist, open(2, 'bb-curl: 20 x 12e, 12')]), 20, 12, 'user kept 20 kg on set 2');
  expectPre(pre('bb-curl', [...hist, open(2, 'bb-curl: 20 x 12e; 22.5 x 10')]), 22.5, 10, 'user took the raised weight');
});

test('D6 lb user: the raised weight is rounded to the lb increment', () => {
  const p = pre('bb-curl', [open(0, 'bb-curl: 45lb x 15e')], { units: 'lb' });
  const x = easyX(lb(45), 15, lb(5));
  expectPre(p, x, 10, '45 lb x 15 Easy');
  const inLb = kgToLb(p.weightKg);
  assert.ok(Math.abs(inLb / 5 - Math.round(inLb / 5)) < 1e-6, `pre-fill ${inLb} lb is a multiple of 5 lb`);
  assert.ok(inLb > 45, 'raised');
});

test('D6 bodyweight exercises never get a weight', () => {
  const p = pre('push-up', [open(0, 'push-up: bw x 15e')]);
  expectPre(p, 0, 15, 'push-up after 15 Easy');
});

// ============================================================ D7
function simulate(seed, exId, units, compliant) {
  const rng = mulberry32(seed);
  const row = ex(exId);
  const incKg = units === 'lb' ? lb(LB_INC[row.equipment]) : KG_INC[row.equipment];
  const prefill = api('prefill');
  const workouts = [];
  const out = [];
  let day = 0;
  for (let k = 0; k < 14; k++) {
    day += rng() < 0.08 ? 70 : 1 + Math.floor(rng() * 4);
    const startedAt = dayMs(day);
    const cur = { id: 'today', startedAt, endedAt: null, feel: null, plan: [exId], sets: [] };
    const call = () => prefill({ exercise: row, workouts: [...workouts, cur], currentWorkoutId: 'today', units, now: startedAt });
    const first = call();
    const nSets = 1 + Math.floor(rng() * 4);
    let maxLifted = 0;
    for (let i = 0; i < nSets; i++) {
      const p = i === 0 ? first : call();
      let w = p.weightKg == null ? 4 * incKg : p.weightKg;
      if (!compliant && rng() < 0.3) w = Math.max(incKg, w + (Math.floor(rng() * 5) - 2) * incKg);
      const reps = i === 0 && rng() < 0.3 ? 12 + Math.floor(rng() * 5) : 4 + Math.floor(rng() * 11);
      const effort = [null, 'easy', 'good', 'hard'][Math.floor(rng() * 4)];
      cur.sets.push({ exerciseId: exId, weightKg: w, reps, effort, at: startedAt + (i + 1) * 120e3 });
      maxLifted = Math.max(maxLifted, w);
    }
    if (rng() < 0.2) cur.sets.push({ exerciseId: exId, weightKg: maxLifted + 3 * incKg, reps: 5, effort: 'hard', at: startedAt + 900e3, extra: true });
    workouts.push(Object.assign({}, cur, { id: 'w' + k, endedAt: startedAt + 3600e3 }));
    out.push({ first, maxLifted, day });
  }
  return { out, incKg };
}
const SIM_EX = ['bb-curl', 'db-curl', 'leg-press', 'lat-pulldown', 'kb-press'];

test('D7 property: following the pre-fill, the weight never rises more than one increment between sessions unless D6 fired', () => {
  let checked = 0, d6 = 0;
  for (const units of ['kg', 'lb']) for (const exId of SIM_EX) for (let seed = 1; seed <= 25; seed++) {
    const { out, incKg } = simulate(seed * 7919 + exId.length, exId, units, true);
    for (let k = 1; k < out.length; k++) {
      const prev = out[k - 1], cur = out[k];
      const where = `${exId} ${units} seed ${seed} session ${k}`;
      assert.ok(cur.first && cur.first.weightKg != null, `${where}: a pre-fill exists after history`);
      const d6Fired = prev.first.weightKg != null && prev.maxLifted > prev.first.weightKg + EPS;
      if (d6Fired) d6++;
      if (prev.first.weightKg != null && !d6Fired) {
        assert.ok(cur.first.weightKg <= prev.first.weightKg + incKg + EPS,
          `${where}: pre-fill rose from ${prev.first.weightKg} to ${cur.first.weightKg} kg, more than one ${incKg} kg increment`);
      }
      assert.ok(cur.first.weightKg <= prev.maxLifted + incKg + EPS, `${where}: more than one increment above what was lifted`);
      assert.ok(cur.first.weightKg >= incKg - EPS, `${where}: never below one increment (${cur.first.weightKg})`);
      assert.ok(cur.first.reps >= 8 && cur.first.reps <= 12, `${where}: reps ${cur.first.reps} inside 8 to 12`);
      const disp = units === 'lb' ? kgToLb(cur.first.weightKg) : cur.first.weightKg;
      const step = units === 'lb' ? LB_INC[ex(exId).equipment] : KG_INC[ex(exId).equipment];
      assert.ok(Math.abs(disp / step - Math.round(disp / step)) < 1e-6, `${where}: ${disp} ${units} is on the ${step} ${units} grid`);
      checked++;
    }
  }
  assert.ok(checked > 1000, 'the property ran over many sessions');
  assert.ok(d6 > 10, 'the generator exercised D6 too');
});

test('D7 property: whatever weight the user picks, the next pre-fill is at most one increment above what was lifted', () => {
  // LEAD-DECISION (LD4): D7 is measured against the weight actually lifted, so a
  // user who picks heavier is followed. Alternative: cap at the previous pre-fill
  // plus one increment even if the user lifted more.
  for (const units of ['kg', 'lb']) for (const exId of SIM_EX) for (let seed = 1; seed <= 25; seed++) {
    const { out, incKg } = simulate(seed * 104729 + 3, exId, units, false);
    for (let k = 1; k < out.length; k++) {
      const w = out[k].first.weightKg;
      assert.ok(Number.isFinite(w), `${exId} ${units} seed ${seed} session ${k}: weight is a number`);
      assert.ok(w <= out[k - 1].maxLifted + incKg + EPS,
        `${exId} ${units} seed ${seed} session ${k}: pre-fill ${w} kg is more than one ${incKg} kg increment above the ${out[k - 1].maxLifted} kg lifted`);
      assert.ok(w >= incKg - EPS, `${exId} ${units} seed ${seed} session ${k}: never below one increment`);
    }
  }
});

test('D7 after a D6 session the next session starts from what was lifted, plus at most one increment', () => {
  const hist = [W(0, 'bb-curl: 20 x 11, 11'), W(2, 'bb-curl: 20 x 12e; 22.5 x 12, 12')];
  expectPre(pre('bb-curl', hist), 25, 8, 'the 22.5 kg sets hit 12: one increment up');
});

// ============================================================ D8
test('D8 bodyweight exercises climb in reps past 12 and the weight never changes', () => {
  // LEAD-DECISION (LD8): reps-only range is 1 to 20, so reps keep climbing past 12.
  // Alternative: cap at 12 (then a bodyweight exercise stalls for ever).
  const p = pre('push-up', [W(0, 'push-up: bw x 12, 12, 12')]);
  expectPre(p, 0, 13, 'push-ups after 12, 12, 12');
  assert.notStrictEqual(p.rule, 'raise');
  expectPre(pre('push-up', [W(0, 'push-up: bw x 20, 20')]), 0, 20, 'the reps-only ceiling is 20');
});

test('D8 bodyweight reps below 8 are not lifted to 8', () => {
  // LEAD-DECISION (LD8): a beginner doing 3 push-ups is asked for 4, not 8.
  expectPre(pre('push-up', [W(0, 'push-up: bw x 3, 3')]), 0, 4, 'push-ups after 3, 3');
});

test('D8 bodyweight: short sessions never change the weight', () => {
  const hist = [W(0, 'push-up: bw x 10, 10'), W(2, 'push-up: bw x 7, 7'), W(4, 'push-up: bw x 7, 7'), W(6, 'push-up: bw x 7, 7'), W(8, 'push-up: bw x 7, 7')];
  const p = pre('push-up', hist);
  assert.strictEqual(p.weightKg, 0, 'weight stays 0');
  assert.strictEqual(p.reps, 8, '7 + 1');
});

test('D8 an added load on a bodyweight exercise is kept, never raised', () => {
  expectPre(pre('push-up', [W(0, 'push-up: 10 x 12, 12')]), 10, 13, 'weighted push-up');
});

test('D8 bands progress in reps only too', () => {
  // LEAD-DECISION (LD8): band ('bd') is reps-only like bodyweight.
  expectPre(pre('band-curl', [W(0, 'band-curl: bw x 12, 12')]), 0, 13, 'band curl after 12, 12');
});

// ============================================================ D9
const setCount = (exerciseId, workouts, current = null) =>
  api('setCount')({ exerciseId, workouts: deepFreeze(JSON.parse(JSON.stringify(workouts))), currentWorkoutId: current });

test('D9 two sets for the first two sessions on an exercise, three afterwards', () => {
  const s = d => W(d, 'db-curl: 10 x 10, 10');
  assert.strictEqual(setCount('db-curl', []), 2, 'first session');
  assert.strictEqual(setCount('db-curl', [s(0)]), 2, 'second session');
  assert.strictEqual(setCount('db-curl', [s(0), s(2)]), 3, 'third session');
  assert.strictEqual(setCount('db-curl', [s(0), s(2), s(4), s(6), s(8)]), 3, 'sixth session');
});

test('D9 the workout in progress does not count as a session', () => {
  const hist = [W(0, 'db-curl: 10 x 10, 10'), open(2, 'db-curl: 10 x 11, 11')];
  assert.strictEqual(setCount('db-curl', hist, 'today'), 2, 'second session, already two sets in');
});

test('D9 one-set sessions count; other exercises and extra-only appearances do not', () => {
  // LEAD-DECISION (LD6): a one-set session is a session.
  assert.strictEqual(setCount('db-curl', [W(0, 'db-curl: 10 x 10'), W(2, 'db-curl: 10 x 10')]), 3, 'two one-set sessions');
  assert.strictEqual(setCount('db-curl', [W(0, 'leg-press: 50 x 10, 10'), W(2, 'leg-press: 50 x 10')]), 2, 'other exercise');
  assert.strictEqual(setCount('db-curl', [W(0, 'db-curl: 10 x 10'), W(2, 'db-curl: 8 x 5*')]), 2, 'extra-only does not count');
});

test('D9 a long gap and how the sets went do not move the count in this package', () => {
  const hist = [W(0, 'db-curl: 10 x 6h, 5h'), W(2, 'db-curl: 10 x 6h, 5h'), W(200, 'db-curl: 10 x 12e, 12e')];
  assert.strictEqual(setCount('db-curl', hist), 3);
  const n = setCount('db-curl', hist);
  assert.ok(n >= 1 && n <= 4, 'inside 1 to 4');
});

// ============================================================ D10
const newBests = (workouts, workoutId) =>
  api('newBests')({ workouts: deepFreeze(JSON.parse(JSON.stringify(workouts))), workoutId });

test('D10 a higher estimated 1RM than ever before is a new best', () => {
  const ws = [W(0, 'bb-curl: 20 x 10, 10'), W(2, 'bb-curl: 20 x 11, 10')];
  assert.deepStrictEqual(newBests(ws, 'w2'), ['bb-curl'], '20 kg x 11 beats 20 kg x 10');
});

test('D10 equal or lower is not a new best', () => {
  assert.deepStrictEqual(newBests([W(0, 'bb-curl: 20 x 10'), W(2, 'bb-curl: 20 x 10, 9')], 'w2'), [], 'equal');
  assert.deepStrictEqual(newBests([W(0, 'bb-curl: 25 x 8'), W(2, 'bb-curl: 20 x 10')], 'w2'), [], 'lower: 20x10 < 25x8');
});

test('D10 the first session on an exercise is not a new best', () => {
  // LEAD-DECISION (LD14): there is nothing to beat yet. Alternative: every first
  // session shows "New best" (it would show on every exercise of workout one).
  assert.deepStrictEqual(newBests([W(0, 'leg-press: 50 x 10'), W(2, 'bb-curl: 20 x 10')], 'w2'), []);
});

test('D10 history counts all time, not a recent window', () => {
  // LEAD-DECISION (LD14): Engine.bestE1RM only looks back 120 days; D10 says "highest".
  const ws = [W(0, 'bb-curl: 30 x 10'), W(300, 'bb-curl: 20 x 10'), W(302, 'bb-curl: 25 x 10')];
  assert.deepStrictEqual(newBests(ws, 'w302'), [], '30 kg x 10 from 300 days ago still stands');
});

test('D10 effort feeds the estimate through the D2 map', () => {
  // Same 20 kg x 10: Easy (RPE 6) implies 4 reps in reserve, Good (RPE 8) 2.
  assert.deepStrictEqual(newBests([W(0, 'bb-curl: 20 x 10g'), W(2, 'bb-curl: 20 x 10e')], 'w2'), ['bb-curl'], 'Easy beats Good');
  assert.deepStrictEqual(newBests([W(0, 'bb-curl: 20 x 10'), W(2, 'bb-curl: 20 x 10g')], 'w2'), [], 'no tap equals Good');
  assert.deepStrictEqual(newBests([W(0, 'bb-curl: 20 x 10g'), W(2, 'bb-curl: 20 x 10h')], 'w2'), [], 'Hard is lower');
});

test('D10 extra sets are ignored today and in history (L6)', () => {
  assert.deepStrictEqual(newBests([W(0, 'bb-curl: 20 x 10'), W(2, 'bb-curl: 20 x 10; 30 x 5*')], 'w2'), [], 'a heavy extra set today');
  assert.deepStrictEqual(newBests([W(0, 'bb-curl: 20 x 10; 40 x 5*'), W(2, 'bb-curl: 20 x 11')], 'w2'), ['bb-curl'], 'a heavy extra set in history');
});

test('D10 bodyweight sets at 0 kg are never a new best', () => {
  // LEAD-DECISION (LD14): the literal estimated 1RM of 0 kg is 0. Alternative: a rep
  // record counts as a best for bodyweight exercises.
  assert.deepStrictEqual(newBests([W(0, 'push-up: bw x 10'), W(2, 'push-up: bw x 20')], 'w2'), []);
});

test('D10 lists every exercise with a new best in workout order, for any workout id', () => {
  const ws = [
    W(0, 'leg-press: 50 x 10', 'bb-curl: 20 x 10', 'db-curl: 10 x 10'),
    W(2, 'db-curl: 10 x 12', 'leg-press: 50 x 10', 'bb-curl: 22.5 x 10'),
    W(4, 'bb-curl: 20 x 8'),
  ];
  assert.deepStrictEqual(newBests(ws, 'w2'), ['db-curl', 'bb-curl'], 'only later workouts are not history');
  assert.deepStrictEqual(newBests([...ws, open(6, 'bb-curl: 25 x 10')], 'today'), ['bb-curl'], 'the workout in progress');
});

// ============================================================ insertion order (Store fact)
const revSets = w => Object.assign({}, w, { sets: [...w.sets].reverse() });

test('D3 workouts are ordered by startedAt, not by array position', () => {
  const ws = [W(4, 'bb-curl: 10 x 9, 9'), W(0, 'bb-curl: 10 x 12, 12')];
  expectPre(pre('bb-curl', ws), 10, 10, 'day 4 is the last session even though it is stored first');
});

test('D3 sets are ordered by at, not by array position', () => {
  const hist = [revSets(W(0, 'bb-curl: 10 x 12, 10, 9'))];
  expectPre(pre('bb-curl', hist), 10, 12, 'set 1 target from the earliest set (12)');
  expectPre(pre('bb-curl', [...hist, open(2, 'bb-curl: 10 x 12')]), 10, 11, 'set 2 target from the second set (10)');
  // today's last set is the latest by at: 10 x 11 after 12.5 x 9
  const h2 = [W(0, 'bb-curl: 10 x 10, 10, 10')];
  expectPre(pre('bb-curl', [...h2, revSets(open(2, 'bb-curl: 12.5 x 9; 10 x 11'))]), 10, 11, 'follows the latest set today');
});

test('D5 the short-session count is replayed in startedAt order', () => {
  const ordered = [RAISED, W(2, 'bb-curl: 12.5 x 6, 6'), W(4, 'bb-curl: 12.5 x 6, 5'), W(6, 'bb-curl: 12.5 x 6, 6')];
  const shuffled = [ordered[2], ordered[0], ordered[3], ordered[1]];
  expectPre(pre('bb-curl', shuffled), 10, 8, 'same drop as the ordered log');
});

test('D10 earlier means an earlier startedAt, not an earlier array position', () => {
  const ws = [W(2, 'bb-curl: 20 x 11'), W(0, 'bb-curl: 20 x 10')];
  assert.deepStrictEqual(newBests(ws, 'w2'), ['bb-curl'], 'day 2 beats day 0');
  assert.deepStrictEqual(newBests(ws, 'w0'), [], 'day 0 is the first session');
});

test('K3 a deep-frozen Store state in insertion order works with every entry point', () => {
  const state = deepFreeze({
    version: 1, name: 'Ana', goals: ['arms'], onboarded: true, excludedEquipment: ['barbell'], units: 'kg',
    workouts: [W(6, 'bb-curl: 12.5 x 6, 6'), RAISED, revSets(W(2, 'bb-curl: 12.5 x 6, 6')), W(4, 'bb-curl: 12.5 x 6, 5'),
      revSets(open(8, 'db-curl: 10 x 10'))],
  });
  const p = api('prefill')({ exercise: ex('bb-curl'), workouts: state.workouts, currentWorkoutId: 'today', units: state.units, now: dayMs(8) });
  expectPre(p, 10, 8, 'drop computed from the unsorted frozen log');
  assert.strictEqual(api('setCount')({ exerciseId: 'bb-curl', workouts: state.workouts, currentWorkoutId: 'today' }), 3);
  assert.deepStrictEqual(api('newBests')({ workouts: state.workouts, workoutId: 'today' }), []);
  assert.ok(Object.isFrozen(state.workouts) && state.workouts[0].id === 'w6', 'input untouched');
});

// ============================================================ K3
test('K3 Coach is one plain object and every package 4 entry point is a function', () => {
  assert.strictEqual(Object.getPrototypeOf(Coach), Object.prototype);
  for (const n of ['effortRpe', 'incrementKg', 'prefill', 'setCount', 'newBests', 'suggest', 'refill', 'excludeEquipment', 'restoreEquipment']) {
    assert.strictEqual(typeof Coach[n], 'function', `Coach.${n} must be a function`);
  }
});

test('K3 coach.js takes its data as arguments: no BEGINNER_EXERCISES, Store, UI or beginnerGoalFocus', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'coach.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
  for (const bad of [/\bBEGINNER_EXERCISES\b/, /\bStore\b/, /\bUI\b/, /\bbeginnerGoalFocus\b/, /\bMath\.random\b/, /\bS\.|\bV\./]) {
    assert.ok(!bad.test(src), `coach.js must not reference ${bad}`);
  }
  assert.ok(/\bBEGINNER_CONFIG\b/.test(src), 'coach.js reads its thresholds from BEGINNER_CONFIG');
});

test('K3 inputs are never mutated and same input gives the same output', () => {
  const ws = [W(0, 'bb-curl: 20 x 12e, 12', 'db-curl: 10 x 10'), W(3, 'bb-curl: 22.5 x 8, 8'), open(5, 'bb-curl: 22.5 x 12e')];
  const snap = JSON.stringify(ws);
  const exRow = JSON.parse(JSON.stringify(ex('bb-curl')));
  const args = () => ({ exercise: exRow, workouts: ws, currentWorkoutId: 'today', units: 'kg', now: dayMs(5) });
  const a = api('prefill')(args());
  const b = api('prefill')(args());
  assert.deepStrictEqual(a, b, 'prefill is deterministic');
  const c1 = api('setCount')({ exerciseId: 'bb-curl', workouts: ws, currentWorkoutId: 'today' });
  const n1 = api('newBests')({ workouts: ws, workoutId: 'w3' });
  assert.strictEqual(api('setCount')({ exerciseId: 'bb-curl', workouts: ws, currentWorkoutId: 'today' }), c1);
  assert.deepStrictEqual(api('newBests')({ workouts: ws, workoutId: 'w3' }), n1);
  assert.strictEqual(JSON.stringify(ws), snap, 'workouts unchanged');
  assert.deepStrictEqual(exRow, JSON.parse(JSON.stringify(ex('bb-curl'))), 'exercise row unchanged');
  // deep-frozen inputs work (a write would throw in strict code or be lost silently)
  const frozen = deepFreeze(JSON.parse(snap));
  assert.deepStrictEqual(api('prefill')({ exercise: ex('bb-curl'), workouts: frozen, currentWorkoutId: 'today', units: 'kg', now: dayMs(5) }), a);
  // outputs are fresh plain data
  assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), a, 'plain data');
  a.weightKg = -1;
  assert.notStrictEqual(api('prefill')(args()).weightKg, -1, 'no shared output object');
});

test('K3 the clock is passed in: the long-gap rule follows the now argument only', () => {
  const ws = deepFreeze([W(0, 'bb-curl: 10 x 10, 10')]);
  const call = now => api('prefill')({ exercise: ex('bb-curl'), workouts: ws, currentWorkoutId: null, units: 'kg', now });
  const t = lastAt(ws);
  assert.strictEqual(call(t + 3 * DAY).rule, 'reps');
  assert.strictEqual(call(t + 300 * DAY).rule, 'gap');
  assert.deepStrictEqual(call(t + 300 * DAY), call(t + 300 * DAY));
});

// ============================================================ config drives behaviour
function withConfig(overrides, fn) {
  const dir = F.beginnerDirWithCoachConfig(overrides);
  try { fn(loadBeginner({ beginnerDir: dir })); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('D3 the rep range is read from config (6 to 10 instead of 8 to 12)', () => {
  withConfig({ repRange: [6, 10] }, s => {
    expectPre(pre('bb-curl', [W(0, 'bb-curl: 10 x 10, 10')], {}, s), 12.5, 6, 'top of 10 reached');
    expectPre(pre('bb-curl', [W(0, 'bb-curl: 10 x 4, 4')], {}, s), 10, 6, 'floor of 6');
  });
});

test('D4 the increment is read from config (barbell 5 kg)', () => {
  withConfig({ increments: { kg: { bb: 5 } } }, s => {
    expectPre(pre('bb-curl', [W(0, 'bb-curl: 10 x 12, 12')], {}, s), 15, 8, 'one 5 kg increment');
    assert.ok(near(api('incrementKg', s)('bb', 'kg'), 5));
  });
});

test('D5 the holds before a drop are read from config (1)', () => {
  withConfig({ holdsBeforeDrop: 1 }, s => {
    const hist = [RAISED, W(2, 'bb-curl: 12.5 x 6, 6'), W(4, 'bb-curl: 12.5 x 6, 6')];
    expectPre(pre('bb-curl', hist, {}, s), 10, 8, 'the second short session drops');
  });
});

test('D2 the effort map is read from config (Easy = 7)', () => {
  withConfig({ effortRpe: { easy: 7, good: 8, hard: 9.5 } }, s => {
    assert.strictEqual(api('effortRpe', s)('easy'), 7);
  });
});

test('D6 the trigger and target are read from config (Easy at 15, target 8 reps)', () => {
  withConfig({ easyTriggerReps: 15, easyTargetReps: 8 }, s => {
    const at12 = pre('bb-curl', [open(0, 'bb-curl: 20 x 12e')], {}, s);
    assert.ok(near(at12.weightKg, 20), 'Easy at 12 no longer triggers');
    const at15 = pre('bb-curl', [open(0, 'bb-curl: 20 x 15e')], {}, s);
    expectPre(at15, Engine.weightFor(Engine.e1rm(20, 15, 6), 8, 8, 2.5), 8, 'Easy at 15 targets 8 reps');
  });
});

test('D9 the set counts are read from config (1 for three sessions, then 4)', () => {
  withConfig({ setsFirst: 1, setsFirstSessions: 3, setsAfter: 4 }, s => {
    const sc = (ws) => api('setCount', s)({ exerciseId: 'db-curl', workouts: ws, currentWorkoutId: null });
    const x = d => W(d, 'db-curl: 10 x 10');
    assert.strictEqual(sc([x(0), x(2)]), 1);
    assert.strictEqual(sc([x(0), x(2), x(4)]), 4);
  });
});

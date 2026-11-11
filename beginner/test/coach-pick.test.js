/* ============================================================
   BEGINNER APP, package 4 (Coach, part 1): the coach side of Pick.
   Criteria B1, B2, B4, B5. Config keys and purity rules: coach.test.js header.

   Coach.suggest({ exercises, goalFocuses, excludedEquipment }) -> { list: [id], ticked: [id] }
     exercises: rows (a FROZEN array: copy before sorting, never push/sort in place).
     goalFocuses: one focus object per selected goal, in selection order (the caller
       maps each goal key through package 2's beginnerGoalFocus). [] behaves as
       Look fit: every muscle 2. Muscle missing from a focus object -> 0.
     excludedEquipment: equipKeys. 'none' can never be excluded.
     Later arguments (workouts, now) will be added by package 10 (E1 to E4), which
     replaces the ranking step only; callers do not change. Ignore unknown fields.
     1. eligible = rows whose equipKey is 'none' or not in excludedEquipment.
     2. pool = eligible rows with starter: true; if none, eligible non-starters
        (LEAD-DECISION LD18). Never assume every muscle has an exercise.
     3. focus[m] = max over goalFocuses of focus[m].
     4. RANK (copy of pool) by: round asc, focus[muscle] desc, index of muscle in
        muscleOrder asc (unknown muscles last), input index asc. round = the row's
        position among pool rows of the same muscle, in input order (0, 1, ...).
     5. list = the first suggestCount ids of RANK (fewer when fewer exist).
     6. ticked: for each goal in order that has a muscle at 3 and is not yet served
        by a ticked row (served = row.muscle is at 3 in that goal's focus), tick the
        earliest list row serving it, if any. Then tick further list rows in list
        order up to tickCount. Return ticked in list order. A goal with no muscle at
        3 (Look fit) is served by anything.
   Coach.refill({ exercises, goalFocuses, excludedEquipment, current: { list, ticked } })
     -> { list, ticked }. excludedEquipment already holds the new key. Candidates =
     RANK ids not in current.list, in order. Walk current.list: an id whose row is
     still eligible stays where it is with its tick state (user picks found by search,
     starter or not, stay); an id that is unknown or no longer eligible is replaced IN
     PLACE by the next candidate, which inherits its tick state; with no candidate
     left the slot is dropped. Then append unticked candidates while the list is
     shorter than suggestCount. A list longer than six is not trimmed.
   Coach.excludeEquipment(excluded, key) -> new array (key appended once; 'none' no-op)
   Coach.restoreEquipment(excluded, key) -> new array without key
   LEAD-DECISIONS: LD15 ranking (one exercise per muscle per round, muscleOrder for
   ties, Look fit order); LD16 tick rule; LD17 refill in place with tick inheritance;
   LD18 non-starter fallback; LD19 'none' cannot be excluded.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { loadBeginner } = require('./load-beginner');
const F = require('./coach-fixtures');
const { EXERCISES, ex, ALL_KEYS, GOAL_TABLE, goalFocuses, deepFreeze } = F;

const app = loadBeginner();

function api(name, surface = app) {
  const C = surface.Coach;
  assert.ok(C && typeof C[name] === 'function', `Coach.${name}(...) is missing: package 4 must provide it`);
  return (...a) => C[name](...a);
}
const suggest = (goals, excluded = [], exercises = EXERCISES, surface = app) =>
  api('suggest', surface)({ exercises, goalFocuses: goalFocuses(...goals), excludedEquipment: deepFreeze([...excluded]) });
const refill = (goals, excluded, current, exercises = EXERCISES) =>
  api('refill')({ exercises, goalFocuses: goalFocuses(...goals), excludedEquipment: deepFreeze([...excluded]), current: deepFreeze(current) });
const ONLY_NONE = ALL_KEYS.filter(k => k !== 'none');
const GOALS = ['arms', 'chest', 'legs', 'fit', 'strong'];
function subsets(xs) {
  const out = [];
  for (let m = 1; m < 1 << xs.length; m++) out.push(xs.filter((_, i) => m & (1 << i)));
  return out;
}
const serves = (goal, id) => GOAL_TABLE[goal][ex(id).muscle] === 3;
const hasGoalMuscle = goal => Object.values(GOAL_TABLE[goal]).includes(3);

// ============================================================ B1
test('B1 a ready workout of six exercises with three pre-ticked', () => {
  // LEAD-DECISION (LD15): with no goal muscle (Look fit) the order is muscleOrder:
  // chest, back, legs, glutes, shoulders, arms (calves seventh).
  const r = suggest(['fit']);
  assert.deepStrictEqual(r.list, ['chest-press', 'lat-pulldown', 'leg-press', 'hip-thrust', 'lateral-raise', 'db-curl']);
  assert.deepStrictEqual(r.ticked, ['chest-press', 'lat-pulldown', 'leg-press']);
});

test('B1 starter: false exercises are never suggested unprompted, for any goals', () => {
  for (const goals of subsets(GOALS)) {
    const r = suggest(goals);
    assert.strictEqual(r.list.length, 6, `${goals}: six`);
    assert.strictEqual(r.ticked.length, 3, `${goals}: three ticked`);
    assert.strictEqual(new Set(r.list).size, 6, `${goals}: no duplicates`);
    for (const id of r.ticked) assert.ok(r.list.includes(id), `${goals}: ticked ${id} is in the list`);
    for (const id of r.list) assert.ok(ex(id).starter, `${goals}: ${id} is not a starter exercise`);
  }
});

test('B1 a bodyweight-only user gets fewer than six without failing, and no leg exercise is invented', () => {
  const fit = suggest(['fit'], ONLY_NONE);
  assert.deepStrictEqual(fit.list, ['push-up', 'glute-bridge', 'bw-calf-raise']);
  assert.deepStrictEqual(fit.ticked, ['push-up', 'glute-bridge', 'bw-calf-raise']);
  const legs = suggest(['legs'], ONLY_NONE);
  assert.deepStrictEqual(legs.list, ['glute-bridge', 'push-up', 'bw-calf-raise'], 'legs goal: glutes first, no legs row exists');
  assert.deepStrictEqual(legs.ticked, ['glute-bridge', 'push-up', 'bw-calf-raise']);
});

test('B1 two eligible exercises: both listed and both ticked', () => {
  const two = deepFreeze([ex('db-curl'), ex('leg-press'), ex('chest-press')]);
  const r = suggest(['arms'], ['chest-press'], two);
  assert.deepStrictEqual(r.list, ['db-curl', 'leg-press']);
  assert.deepStrictEqual(r.ticked, ['db-curl', 'leg-press']);
});

test('B1 when no starter exercise is eligible the non-starters fill the list', () => {
  // LEAD-DECISION (LD18): never an empty list while anything is eligible.
  // Alternative: non-starters also top up any list shorter than six.
  const small = deepFreeze([ex('bb-bench'), ex('chest-press'), ex('bb-squat')]);
  const r = suggest(['fit'], ['chest-press'], small);
  assert.deepStrictEqual(r.list, ['bb-bench', 'bb-squat']);
  assert.deepStrictEqual(r.ticked, ['bb-bench', 'bb-squat']);
  const none = suggest(['fit'], ['chest-press', 'barbell'], small);
  assert.deepStrictEqual(none, { list: [], ticked: [] }, 'nothing eligible: an honest empty result, not an error');
});

test('B1 a frozen exercise list and frozen inputs are accepted, untouched, and give the same answer twice', () => {
  assert.ok(Object.isFrozen(EXERCISES));
  const before = JSON.stringify(EXERCISES);
  const a = suggest(['arms', 'legs'], ['dumbbells']);
  const b = suggest(['arms', 'legs'], ['dumbbells']);
  assert.deepStrictEqual(a, b);
  assert.strictEqual(JSON.stringify(EXERCISES), before);
  a.list.push('x');
  assert.notStrictEqual(suggest(['arms', 'legs'], ['dumbbells']).list.length, a.list.length, 'fresh output each call');
});

test('B1 the six and the three are read from config (four and two)', () => {
  const dir = F.beginnerDirWithCoachConfig({ suggestCount: 4, tickCount: 2 });
  try {
    const s = loadBeginner({ beginnerDir: dir });
    const r = suggest(['fit'], [], EXERCISES, s);
    assert.deepStrictEqual(r.list, ['chest-press', 'lat-pulldown', 'leg-press', 'hip-thrust']);
    assert.deepStrictEqual(r.ticked, ['chest-press', 'lat-pulldown']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ============================================================ B2
test('B2 goal muscles come first: Bigger arms', () => {
  const r = suggest(['arms']);
  assert.deepStrictEqual(r.list, ['db-curl', 'chest-press', 'lat-pulldown', 'leg-press', 'hip-thrust', 'lateral-raise']);
  assert.deepStrictEqual(r.ticked, ['db-curl', 'chest-press', 'lat-pulldown']);
});

test('B2 goal muscles come first: Legs and glutes, and Look strong', () => {
  const legs = suggest(['legs']);
  assert.deepStrictEqual(legs.list, ['leg-press', 'hip-thrust', 'chest-press', 'lat-pulldown', 'lateral-raise', 'db-curl']);
  assert.deepStrictEqual(legs.ticked, ['leg-press', 'hip-thrust', 'chest-press']);
  const strong = suggest(['strong']);
  assert.deepStrictEqual(strong.list, ['chest-press', 'lat-pulldown', 'leg-press', 'lateral-raise', 'hip-thrust', 'db-curl']);
  assert.deepStrictEqual(strong.ticked, ['chest-press', 'lat-pulldown', 'leg-press']);
});

test('B2 with several goals each goal has a pre-ticked exercise', () => {
  // LEAD-DECISION (LD16): goals are served in selection order, then ticks fill in list order.
  const two = suggest(['arms', 'chest']);
  assert.deepStrictEqual(two.list, ['chest-press', 'db-curl', 'lat-pulldown', 'leg-press', 'hip-thrust', 'lateral-raise']);
  assert.deepStrictEqual(two.ticked, ['chest-press', 'db-curl', 'lat-pulldown']);
  const three = suggest(['arms', 'legs', 'chest']);
  assert.deepStrictEqual(three.list, ['chest-press', 'leg-press', 'hip-thrust', 'db-curl', 'lat-pulldown', 'lateral-raise']);
  assert.deepStrictEqual(three.ticked, ['chest-press', 'leg-press', 'db-curl']);
});

test('B2 property: for every goal combination goal muscles lead and every goal is served', () => {
  for (const excluded of [[], ['dumbbells'], ['cable-station', 'leg-press']]) {
    for (const goals of subsets(GOALS)) {
      const r = suggest(goals, excluded);
      const where = `goals ${goals} excluding ${excluded}`;
      const isGoal = id => goals.some(g => serves(g, id));
      const firstOther = r.list.findIndex(id => !isGoal(id));
      const goalMuscles = new Set(r.list.filter(isGoal).map(id => ex(id).muscle));
      const wanted = new Set();
      for (const g of goals) for (const [m, v] of Object.entries(GOAL_TABLE[g])) if (v === 3) wanted.add(m);
      const available = [...wanted].filter(m => EXERCISES.some(e => e.starter && e.muscle === m && (e.equipKey === 'none' || !excluded.includes(e.equipKey))));
      if (available.length <= 6) {
        for (const m of available) assert.ok(goalMuscles.has(m), `${where}: goal muscle ${m} is in the six`);
        if (firstOther >= 0) {
          const before = new Set(r.list.slice(0, firstOther).map(id => ex(id).muscle));
          for (const m of available) assert.ok(before.has(m), `${where}: ${m} comes before the first non-goal exercise`);
        }
      }
      for (const g of goals) {
        if (!hasGoalMuscle(g)) continue;
        if (!r.list.some(id => serves(g, id))) continue;
        assert.ok(r.ticked.some(id => serves(g, id)), `${where}: goal ${g} has a pre-ticked exercise (ticked ${r.ticked})`);
      }
    }
  }
});

test('B2 an empty goal selection behaves as Look fit', () => {
  const empty = api('suggest')({ exercises: EXERCISES, goalFocuses: deepFreeze([]), excludedEquipment: deepFreeze([]) });
  assert.deepStrictEqual(empty, suggest(['fit']));
});

// ============================================================ B4
const ARMS_SIX = { list: ['db-curl', 'chest-press', 'lat-pulldown', 'leg-press', 'hip-thrust', 'lateral-raise'], ticked: ['db-curl', 'chest-press', 'lat-pulldown'] };

test('B4 "I don\'t have that here" on dumbbells removes every dumbbell exercise and refills to six in place', () => {
  // LEAD-DECISION (LD17): replacements take the removed card's place and tick state.
  const excluded = api('excludeEquipment')(deepFreeze([]), ex('db-curl').equipKey);
  assert.deepStrictEqual(excluded, ['dumbbells']);
  const r = refill(['arms'], excluded, ARMS_SIX);
  assert.deepStrictEqual(r.list, ['pushdown', 'chest-press', 'lat-pulldown', 'leg-press', 'hip-thrust', 'shoulder-press']);
  assert.deepStrictEqual(r.ticked, ['pushdown', 'chest-press', 'lat-pulldown']);
});

test('B4 for every piece of equipment the refill leaves six with none of it', () => {
  for (const goals of [['fit'], ['arms'], ['legs', 'chest']]) {
    const start = suggest(goals);
    for (const key of ONLY_NONE) {
      const r = refill(goals, [key], start);
      const where = `${goals} without ${key}`;
      assert.strictEqual(r.list.length, 6, `${where}: six again`);
      assert.strictEqual(new Set(r.list).size, 6, `${where}: no duplicates`);
      for (const id of r.list) assert.notStrictEqual(ex(id).equipKey, key, `${where}: ${id} needs ${key}`);
      for (const id of r.ticked) assert.ok(r.list.includes(id), `${where}: ticked ${id} is listed`);
      assert.strictEqual(r.ticked.length, start.ticked.length, `${where}: same number ticked`);
    }
  }
});

test('B4 refill keeps the user\'s own choices: order, ticks and searched-in exercises', () => {
  const current = { list: [...ARMS_SIX.list, 'bb-bench'], ticked: ['db-curl', 'hip-thrust', 'bb-bench'] };
  const r = refill(['arms'], ['lat-pulldown'], current);
  assert.deepStrictEqual(r.list, ['db-curl', 'chest-press', 'seated-row', 'leg-press', 'hip-thrust', 'lateral-raise', 'bb-bench']);
  assert.deepStrictEqual(r.ticked, ['db-curl', 'hip-thrust', 'bb-bench']);
});

test('B4 refill with too few candidates shrinks the list instead of failing', () => {
  const start = suggest(['fit']);
  const r = refill(['fit'], ONLY_NONE, start);
  assert.deepStrictEqual(r.list, ['push-up', 'glute-bridge', 'bw-calf-raise']);
  assert.deepStrictEqual(r.ticked, ['push-up', 'glute-bridge', 'bw-calf-raise']);
});

test('B4 refill tops a short list back up to six', () => {
  const r = refill(['fit'], [], { list: ['db-curl'], ticked: ['db-curl'] });
  assert.deepStrictEqual(r.list, ['db-curl', 'chest-press', 'lat-pulldown', 'leg-press', 'hip-thrust', 'lateral-raise']);
  assert.deepStrictEqual(r.ticked, ['db-curl']);
});

// ============================================================ B5
test('B5 excluded equipment is never suggested', () => {
  for (const goals of [['fit'], ['arms'], ['strong'], ['legs', 'arms']]) {
    for (const key of ONLY_NONE) {
      for (const id of suggest(goals, [key]).list) assert.notStrictEqual(ex(id).equipKey, key, `${goals}: ${id} uses excluded ${key}`);
    }
    const many = ['dumbbells', 'cable-station', 'leg-press', 'chest-press'];
    for (const id of suggest(goals, many).list) assert.ok(!many.includes(ex(id).equipKey), `${goals}: ${id} uses an excluded key`);
  }
});

test('B5 restoring equipment makes its exercises eligible again', () => {
  const exclude = api('excludeEquipment'), restore = api('restoreEquipment');
  let list = exclude(deepFreeze([]), 'dumbbells');
  list = exclude(deepFreeze(list), 'cable-station');
  assert.deepStrictEqual(list, ['dumbbells', 'cable-station']);
  assert.ok(!suggest(['arms'], list).list.includes('db-curl'));
  const back = restore(deepFreeze(list), 'dumbbells');
  assert.deepStrictEqual(back, ['cable-station']);
  assert.deepStrictEqual(suggest(['arms'], back).list[0], 'db-curl', 'the dumbbell curl leads again');
  assert.deepStrictEqual(restore(deepFreeze(back), 'cable-station'), []);
});

test('B5 exclude and restore are pure: idempotent, new arrays, and bodyweight cannot be excluded', () => {
  // LEAD-DECISION (LD19): 'none' is not equipment, so excluding it is a no-op.
  const exclude = api('excludeEquipment'), restore = api('restoreEquipment');
  const base = deepFreeze(['barbell']);
  const once = exclude(base, 'dumbbells');
  assert.deepStrictEqual(exclude(deepFreeze(once), 'dumbbells'), ['barbell', 'dumbbells'], 'no duplicate');
  assert.deepStrictEqual(base, ['barbell'], 'input untouched');
  assert.notStrictEqual(exclude(base, 'barbell'), base, 'always a new array');
  assert.deepStrictEqual(exclude(base, 'none'), ['barbell'], "'none' is never excluded");
  assert.deepStrictEqual(restore(base, 'kettlebell'), ['barbell'], 'restoring a key not excluded changes nothing');
  assert.ok(suggest(['fit'], ['none']).list.length === 6, "a stray 'none' in the list does not hide bodyweight work");
  assert.ok(suggest(['fit'], [...ONLY_NONE, 'none']).list.includes('push-up'));
});

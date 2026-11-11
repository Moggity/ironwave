/* ============================================================
   BEGINNER APP, package 2 (Exercise data), criteria B3 (data side) and A5.
   THIS FILE IS THE SPEC. The builder edits ONLY beginner/exercises.js, the
   `exercises` section of BEGINNER_CONFIG in beginner/config.js, and new files
   under beginner/media/. It may not edit tests, harnesses or anything else.
   Top-level globals must be single plain declarations at column zero, one name
   per declaration (the harness auto-exports them).

   const BEGINNER_EXERCISES  array of 36..44 objects; the array AND every row are
     Object.freeze()d. Each row has exactly these fields:
     id         string, an id of a row in EXERCISE_LIST, unique
     name       non-empty string, no em dash, no forbidden term (see cue), unique, never
                containing the word "Competition". The four barbell lifts are named
                exactly: comp-squat "Barbell Squat", comp-bench "Barbell Bench Press",
                comp-deadlift "Barbell Deadlift", military-press "Barbell Overhead Press".
     movement   equals that EXERCISE_LIST row's movement
     muscle     one of arms, chest, back, shoulders, glutes, legs, calves.
                Equals MOVEMENT_SLIDER[movement]. RULE CHOSEN for movements with no
                slider (core: abs, lowback, mc, and deadlift): they are NOT allowed
                in the list, with ONE exception: movement 'deadlift' (needed for the
                barbell deadlift) must use muscle 'back'.
     equipment  the coarse code, equals that row's code (bb db mc cb bw kb bd)
     equipKey   kebab-case key (lowercase letters, digits, single hyphens) naming the
                one piece of equipment the user would lack. Must be a key of
                BEGINNER_EQUIPMENT, or 'none' (bodyweight needing nothing; 'none' is
                only legal when equipment is 'bw').
     cue        exactly one form cue: non-empty string, at most
                BEGINNER_CONFIG.exercises.cueMaxLength (90) characters, one sentence
                (no newline, at most one of . ! ?, and only as the last character), no
                em dash, none of: RPE, RIR, 1RM, MEV, MRV, deload, volume, %, missed,
                streak, drop set, myo (case-insensitive).
     demo       a string starting 'media/', ending '.mp4' and containing the id; use
                exactly 'media/' + id + '.mp4' for now (real clips arrive in package 13)
     starter    boolean. true = the app may suggest it unprompted, false = search-only.
                Every bb exercise is starter:false. At least 24 are starter:true.
                The exercise with id 'pullup', if present, is starter:false.
   const BEGINNER_EQUIPMENT  frozen object, equipKey -> { label } (label non-empty, no
     em dash, no forbidden term). 'none' is NOT a key. Every key is used by at least one
     exercise, and all exercises of one key share the same coarse `equipment` code. No key
     covers more than BEGINNER_CONFIG.exercises.equipKeyMaxExercises (8) exercises, except
     the key 'dumbbells'. If lat-pulldown and cable-row are in the list, each has its own
     key, different from each other and from the general cable key.
   const BEGINNER_GOALS  frozen object, exactly keys arms chest legs fit strong, each
     { label, focus }. Labels: Bigger arms, Bigger chest, Legs and glutes, Look fit,
     Look strong. Labels carry no forbidden term (see cue). focus has exactly the seven keys, integers 0..FOCUS_MAX (3).
     arms: arms 3, rest 2. chest: chest 3, rest 2. legs: legs 3 and glutes 3, rest 2.
     fit: all 2. strong: chest, back, shoulders, legs 3, rest 2. Freeze deeply.
   const BEGINNER_DEFAULT_GOAL = 'fit'
   function beginnerGoalFocus(goalKeys)  per focus key the max across selected goals;
     empty, missing or all-unknown selection gives exactly BEGINNER_GOALS.fit.focus;
     unknown keys ignored; returns a fresh plain object each call.

   HOW TO CHOOSE THE 40: pick beginner-friendly moves a first-timer can learn in a
   minute. Lean on machines, dumbbells and cables, add a handful of bodyweight moves
   (push-up, bodyweight squat, glute bridge, and so on), and include the four barbell
   lifts (comp-squat, comp-bench, comp-deadlift, military-press) present but
   starter:false. Spread evenly across the seven focus keys (every key at least 3
   starters, at least 2 of them on different equipKeys so removing one piece of
   equipment never empties a muscle), with extra depth for arms, chest, legs and
   glutes (any muscle a goal sets to 3 needs at least 4 exercises). At least 3 starters
   are equipKey 'none'. HOME USER: the starters with equipKey 'none' must number at least
   6 and cover at least 5 of the 7 muscles (legs may be missing; the real list has no good
   legs bodyweight row; pike-pushup, inverted-row, glute-bridge, frog-pumps, pushup,
   close-grip-pushup, sl-calf-raise are bodyweight rows with a muscle). Pull-ups are
   search-only. Use EXERCISE_LIST ids only; look up the movement and the
   coarse code for each id there. Do not use core movements (abs, lowback).

   goalDepthMin counts STARTERS only: every muscle a goal sets to 3 needs at least
   goalDepthMin starter exercises.
   Cues for db-rdl and leg-press, if present, must mention the back (/back/i).

   BEGINNER_CONFIG.exercises must hold these tunables, each a positive integer (the tests
   read them, and do not pin their values, so tuning needs no test edit). Starting values:
     cueMaxLength 90, exerciseCountMin 36, exerciseCountMax 44, starterMin 24,
     perMuscleStarterMin 3, perMuscleStarterKeysMin 2, goalDepthMin 4,
     noneStarterMin 6, homeStarterMin 6, equipKeyMaxExercises 8, placeholderMaxBytes 4096

   MEDIA: beginner/media/manifest.json = { "schemaVersion": 1, "items": {} } (items
     only for ids in the list, each value a non-empty string naming a file that exists
     under beginner/media/). beginner/media/placeholder.svg:
     non-empty, under 4096 bytes, must carry xmlns="http://www.w3.org/2000/svg"; apart from that no http, no href, no <script, no <text/<tspan/<title/<desc.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { loadBeginner } = require('./load-beginner.js');
const { assemble } = require('../../scripts/assemble-beginner.js');

const B = loadBeginner();
const FOCUS_KEYS = ['arms', 'chest', 'back', 'shoulders', 'glutes', 'legs', 'calves'];
const GOAL_KEYS = ['arms', 'chest', 'legs', 'fit', 'strong'];
const MEDIA_DIR = path.join(__dirname, '..', 'media');

// Row lookup straight from the real Ironwave data (shared, loaded by the harness).
const ROWS = new Map(B.EXERCISE_LIST.map(r => [r[0], { id: r[0], movement: r[2], equipment: r[3] }]));
// MOVEMENT_SLIDER and FOCUS_MAX are not exported by the harness; read them from the same data.js.
const DATA_SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'data.js'), 'utf8');
const MOVEMENT_SLIDER = vm.runInNewContext(DATA_SRC + '\n;MOVEMENT_SLIDER');
const FOCUS_MAX = vm.runInNewContext(DATA_SRC + '\n;FOCUS_MAX');

const EX = () => B.BEGINNER_EXERCISES;
const CFG = () => B.BEGINNER_CONFIG.exercises;
function cfg(name) {
  const v = CFG()[name];
  assert.ok(typeof v === 'number', 'BEGINNER_CONFIG.exercises.' + name + ' must be a number (add it to beginner/config.js), got ' + v);
  return v;
}
function need(name) {
  assert.ok(B[name] !== undefined, name + ' is not defined; declare it at column zero in beginner/exercises.js');
  return B[name];
}
function eachEx(fn) { EX().forEach((e, i) => fn(e, (e && e.id) || ('index ' + i))); }
const isStr = s => typeof s === 'string' && s.trim().length > 0;
const EM = /—/;
const FORBIDDEN = [
  [/\bRPE\b/i, 'RPE'], [/\bRIR\b/i, 'RIR'], [/\b1RM\b/i, '1RM'], [/\bMEV\b/i, 'MEV'], [/\bMRV\b/i, 'MRV'],
  [/deload/i, 'deload'], [/volume/i, 'volume'], [/%/, '%'], [/\bmissed\b/i, 'missed'],
  [/\bstreak\b/i, 'streak'], [/drop\s*set/i, 'drop set'], [/\bmyo/i, 'myo'],
];

const TUNABLES = ['cueMaxLength', 'exerciseCountMin', 'exerciseCountMax', 'starterMin', 'perMuscleStarterMin',
  'perMuscleStarterKeysMin', 'goalDepthMin', 'noneStarterMin', 'homeStarterMin', 'equipKeyMaxExercises', 'placeholderMaxBytes'];

test('B3 config holds every exercise tunable as a positive integer', () => {
  for (const k of TUNABLES) {
    const v = CFG()[k];
    assert.ok(Number.isInteger(v) && v > 0, 'BEGINNER_CONFIG.exercises.' + k + ' must be a positive integer, got ' + v);
  }
});

test('B3 BEGINNER_EXERCISES is a list of 36 to 44 frozen objects', () => {
  assert.ok(Array.isArray(EX()), 'BEGINNER_EXERCISES must be an array');
  assert.ok(EX().length >= cfg('exerciseCountMin') && EX().length <= cfg('exerciseCountMax'),
    'BEGINNER_EXERCISES has ' + EX().length + ' items, need ' + cfg('exerciseCountMin') + ' to ' + cfg('exerciseCountMax'));
  assert.ok(Object.isFrozen(EX()), 'the BEGINNER_EXERCISES array itself must be Object.freeze()d');
  eachEx((e, id) => assert.ok(e && typeof e === 'object' && Object.isFrozen(e), id + ': each exercise must be Object.freeze()d'));
});

test('B3 every exercise has exactly the schema fields and unique id and name', () => {
  assert.ok(EX().length > 0, 'BEGINNER_EXERCISES is empty');
  const keys = ['cue', 'demo', 'equipKey', 'equipment', 'id', 'movement', 'muscle', 'name', 'starter'];
  const ids = new Set(), names = new Set();
  eachEx((e, id) => {
    assert.deepEqual(Object.keys(e).sort(), keys, id + ': fields must be exactly ' + keys.join(', '));
    assert.ok(!ids.has(e.id), id + ': duplicate id'); ids.add(e.id);
    assert.ok(isStr(e.name), id + ': name must be a non-empty string');
    assert.ok(!names.has(e.name), id + ': duplicate name "' + e.name + '"'); names.add(e.name);
    assert.ok(!EM.test(e.name), id + ': name must not contain an em dash');
    assert.ok(!/competition/i.test(e.name), id + ': name "' + e.name + '" must not contain the word Competition');
    for (const [re, word] of FORBIDDEN) assert.ok(!re.test(e.name), id + ': name "' + e.name + '" contains forbidden term "' + word + '"');
  });
});

test('B3 every id, movement and equipment code matches its EXERCISE_LIST row', () => {
  assert.ok(EX().length > 0, 'BEGINNER_EXERCISES is empty');
  eachEx((e, id) => {
    const row = ROWS.get(e.id);
    assert.ok(row, id + ': id is not in EXERCISE_LIST');
    assert.equal(e.movement, row.movement, id + ': movement must be "' + row.movement + '", got "' + e.movement + '"');
    assert.equal(e.equipment, row.equipment, id + ': equipment must be "' + row.equipment + '", got "' + e.equipment + '"');
  });
});

test('B3 every muscle is a focus key matching MOVEMENT_SLIDER (core excluded, deadlift is back)', () => {
  assert.ok(EX().length > 0, 'BEGINNER_EXERCISES is empty');
  eachEx((e, id) => {
    assert.ok(FOCUS_KEYS.includes(e.muscle), id + ': muscle "' + e.muscle + '" must be one of ' + FOCUS_KEYS.join(', '));
    const slider = MOVEMENT_SLIDER[e.movement];
    if (slider) assert.equal(e.muscle, slider, id + ': muscle must be "' + slider + '" for movement "' + e.movement + '", got "' + e.muscle + '"');
    else if (e.movement === 'deadlift') assert.equal(e.muscle, 'back', id + ': deadlift movement must use muscle "back"');
    else assert.fail(id + ': movement "' + e.movement + '" has no focus slider (core or similar) and is not allowed in the list');
  });
});

test('B3 every equipKey is kebab-case, in BEGINNER_EQUIPMENT or "none" on a bodyweight move', () => {
  const eq = need('BEGINNER_EQUIPMENT');
  assert.ok(EX().length > 0, 'BEGINNER_EXERCISES is empty');
  eachEx((e, id) => {
    assert.ok(typeof e.equipKey === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.equipKey), id + ': equipKey "' + e.equipKey + '" must be kebab-case');
    if (e.equipKey === 'none') assert.equal(e.equipment, 'bw', id + ': equipKey "none" is only legal for equipment "bw", got "' + e.equipment + '"');
    else assert.ok(Object.prototype.hasOwnProperty.call(eq, e.equipKey), id + ': equipKey "' + e.equipKey + '" is not a key of BEGINNER_EQUIPMENT');
  });
});

test('B3 BEGINNER_EQUIPMENT is frozen, labelled, used, and one coarse code per key', () => {
  const eq = need('BEGINNER_EQUIPMENT');
  assert.ok(Object.isFrozen(eq), 'BEGINNER_EQUIPMENT must be frozen');
  assert.ok(Object.keys(eq).length > 0, 'BEGINNER_EQUIPMENT is empty');
  assert.ok(!('none' in eq), 'BEGINNER_EQUIPMENT must not have a "none" key');
  for (const k of Object.keys(eq)) {
    assert.ok(isStr(eq[k] && eq[k].label), 'equipment "' + k + '": label must be a non-empty string');
    assert.ok(!EM.test(eq[k].label), 'equipment "' + k + '": label must not contain an em dash');
    for (const [re, word] of FORBIDDEN) assert.ok(!re.test(eq[k].label), 'equipment "' + k + '": label "' + eq[k].label + '" contains forbidden term "' + word + '"');
    const users = EX().filter(e => e.equipKey === k);
    assert.ok(users.length >= 1, 'equipment "' + k + '" is not used by any exercise; remove it');
    const codes = [...new Set(users.map(e => e.equipment))];
    if (k !== 'dumbbells') assert.ok(users.length <= cfg('equipKeyMaxExercises'), 'equipment "' + k + '" covers ' + users.length + ' exercises (' + users.map(e => e.id).join(', ') + '), max ' + cfg('equipKeyMaxExercises') + ' (only "dumbbells" is exempt); split it into specific equipment');
    assert.equal(codes.length, 1, 'equipment "' + k + '" mixes coarse codes ' + codes.join(', ') + ' (' + users.map(e => e.id + ':' + e.equipment).join(', ') + ')');
  }
});

test('B3 every exercise has exactly one valid form cue', () => {
  const max = cfg('cueMaxLength');
  assert.ok(EX().length > 0, 'BEGINNER_EXERCISES is empty');
  eachEx((e, id) => {
    assert.ok(isStr(e.cue), id + ': cue must be a non-empty string');
    assert.ok(e.cue.length <= max, id + ': cue is ' + e.cue.length + ' characters, max ' + max);
    assert.ok(!/[\r\n]/.test(e.cue), id + ': cue must be one line');
    assert.ok(!EM.test(e.cue), id + ': cue must not contain an em dash');
    const enders = (e.cue.match(/[.!?]/g) || []);
    assert.ok(enders.length <= 1, id + ': cue must be one sentence, found ' + enders.length + ' sentence terminators');
    if (enders.length === 1) assert.ok(/[.!?]$/.test(e.cue), id + ': the sentence terminator must be the last character');
    for (const [re, word] of FORBIDDEN) assert.ok(!re.test(e.cue), id + ': cue contains forbidden term "' + word + '"');
  });
});

test('B3 every demo path is media/...<id>...mp4', () => {
  assert.ok(EX().length > 0, 'BEGINNER_EXERCISES is empty');
  eachEx((e, id) => assert.ok(typeof e.demo === 'string' && e.demo.startsWith('media/') && e.demo.endsWith('.mp4') && e.demo.includes(e.id),
    id + ': demo must start with "media/", end with ".mp4" and contain the id (use "media/' + e.id + '.mp4"), got "' + e.demo + '"'));
});

test('B3 starter is boolean, barbell lifts are search-only, at least 24 are starters', () => {
  eachEx((e, id) => {
    assert.equal(typeof e.starter, 'boolean', id + ': starter must be true or false');
    if (e.equipment === 'bb') assert.equal(e.starter, false, id + ': barbell exercises must be starter:false');
  });
  const n = EX().filter(e => e.starter).length;
  assert.ok(n >= cfg('starterMin'), 'only ' + n + ' starter exercises, need at least ' + cfg('starterMin'));
});

test('B3 pull-ups are search-only', () => {
  eachEx((e, id) => { if (e.id === 'pullup') assert.equal(e.starter, false, 'pullup: must be starter:false (most beginners cannot do one)'); });
});

test('B3 the four barbell lifts are named Barbell ...', () => {
  const want = { 'comp-squat': 'Barbell Squat', 'comp-bench': 'Barbell Bench Press', 'comp-deadlift': 'Barbell Deadlift', 'military-press': 'Barbell Overhead Press' };
  for (const id of Object.keys(want)) {
    const e = EX().find(x => x.id === id);
    assert.ok(e, id + ': must be in the list');
    assert.equal(e && e.name, want[id], id + ': name must be "' + want[id] + '", got "' + (e && e.name) + '"');
  }
});

test('B3 the four barbell lifts are present and search-only', () => {
  for (const id of ['comp-squat', 'comp-bench', 'comp-deadlift', 'military-press'])
    assert.ok(EX().some(e => e.id === id && e.equipment === 'bb' && e.starter === false), id + ': must be in the list as a bb, starter:false exercise');
});

test('B3 every muscle has enough starters on different equipment', () => {
  for (const m of FOCUS_KEYS) {
    const st = EX().filter(e => e.muscle === m && e.starter);
    assert.ok(st.length >= cfg('perMuscleStarterMin'), m + ': ' + st.length + ' starters (' + st.map(e => e.id).join(', ') + '), need ' + cfg('perMuscleStarterMin'));
    const keys = new Set(st.map(e => e.equipKey));
    assert.ok(keys.size >= cfg('perMuscleStarterKeysMin'), m + ': starters use only ' + keys.size + ' equipKey(s) (' + [...keys].join(', ') + '), need ' + cfg('perMuscleStarterKeysMin'));
  }
});

test('B3 a home user with no equipment still has enough starters across muscles', () => {
  const home = EX().filter(e => e.starter && e.equipKey === 'none');
  const need = Math.max(cfg('homeStarterMin'), cfg('noneStarterMin'), 6);
  assert.ok(home.length >= need, 'only ' + home.length + ' starters with equipKey "none" (' + home.map(e => e.id).join(', ') + '), need ' + need);
  const muscles = [...new Set(home.map(e => e.muscle))];
  assert.ok(muscles.length >= 5, 'no-equipment starters cover only ' + muscles.length + ' muscles (' + muscles.join(', ') + '), need at least 5 of the 7 (legs may be missing)');
});

test('B3 cues for db-rdl and leg-press mention the back', () => {
  for (const e of EX()) if (e.id === 'db-rdl' || e.id === 'leg-press') assert.ok(/back/i.test(e.cue), e.id + ': cue "' + e.cue + '" must mention the back');
});

test('B3 lat-pulldown and cable-row have their own equipment keys', () => {
  const k = id => { const e = EX().find(x => x.id === id); return e && e.equipKey; };
  const ld = k('lat-pulldown'), cr = k('cable-row');
  const general = EX().filter(e => e.equipment === 'cb' && !['lat-pulldown', 'cable-row'].includes(e.id)).map(e => e.equipKey);
  if (ld) assert.ok(!general.includes(ld), 'lat-pulldown: equipKey "' + ld + '" is shared with other cable exercises; give it its own key');
  if (cr) assert.ok(!general.includes(cr), 'cable-row: equipKey "' + cr + '" is shared with other cable exercises; give it its own key');
  if (ld && cr) assert.notEqual(ld, cr, 'lat-pulldown and cable-row must have different equipKeys');
});

test('B3 every goal muscle at focus 3 has enough starter exercises', () => {
  const goals = need('BEGINNER_GOALS');
  for (const g of GOAL_KEYS) for (const m of FOCUS_KEYS) if (goals[g] && goals[g].focus && goals[g].focus[m] === 3) {
    const n = EX().filter(e => e.muscle === m && e.starter).length;
    assert.ok(n >= cfg('goalDepthMin'), 'goal "' + g + '" sets ' + m + ' to 3 but only ' + n + ' STARTER exercises have muscle "' + m + '", need ' + cfg('goalDepthMin'));
  }
});

test('A5 BEGINNER_GOALS has exactly the five goals with exact labels and frozen focus maps', () => {
  const goals = need('BEGINNER_GOALS');
  assert.ok(Object.isFrozen(goals), 'BEGINNER_GOALS must be frozen');
  assert.deepEqual(Object.keys(goals).sort(), [...GOAL_KEYS].sort(), 'BEGINNER_GOALS keys');
  const labels = { arms: 'Bigger arms', chest: 'Bigger chest', legs: 'Legs and glutes', fit: 'Look fit', strong: 'Look strong' };
  for (const g of GOAL_KEYS) {
    assert.equal(goals[g].label, labels[g], 'goal "' + g + '": label must be "' + labels[g] + '"');
    assert.ok(!EM.test(goals[g].label), 'goal "' + g + '": label must not contain an em dash');
    for (const [re, word] of FORBIDDEN) assert.ok(!re.test(goals[g].label), 'goal "' + g + '": label contains forbidden term "' + word + '"');
    assert.deepEqual(Object.keys(goals[g].focus).sort(), [...FOCUS_KEYS].sort(), 'goal "' + g + '": focus must have exactly the seven keys');
    for (const m of FOCUS_KEYS) {
      const v = goals[g].focus[m];
      assert.ok(Number.isInteger(v) && v >= 0 && v <= FOCUS_MAX, 'goal "' + g + '": focus.' + m + ' must be an integer 0..' + FOCUS_MAX + ', got ' + v);
    }
    assert.ok(Object.isFrozen(goals[g]) && Object.isFrozen(goals[g].focus), 'goal "' + g + '": must be frozen');
  }
});

test('A5 BEGINNER_GOALS focus values are the agreed ones', () => {
  const goals = need('BEGINNER_GOALS');
  const make = hi => Object.fromEntries(FOCUS_KEYS.map(m => [m, hi.includes(m) ? 3 : 2]));
  const want = { arms: make(['arms']), chest: make(['chest']), legs: make(['legs', 'glutes']), fit: make([]), strong: make(['chest', 'back', 'shoulders', 'legs']) };
  for (const g of GOAL_KEYS) assert.deepEqual({ ...goals[g].focus }, want[g], 'goal "' + g + '" focus');
});

test('A5 BEGINNER_DEFAULT_GOAL is fit, so a skipped goal is Look fit', () => {
  assert.equal(need('BEGINNER_DEFAULT_GOAL'), 'fit');
  assert.equal(need('BEGINNER_GOALS').fit.label, 'Look fit');
});

test('A5 beginnerGoalFocus takes the per-muscle maximum across selected goals', () => {
  assert.equal(typeof need('beginnerGoalFocus'), 'function');
  const f = B.beginnerGoalFocus(['arms', 'legs']);
  assert.deepEqual({ ...f }, { arms: 3, chest: 2, back: 2, shoulders: 2, glutes: 3, legs: 3, calves: 2 });
  assert.deepEqual({ ...B.beginnerGoalFocus(['strong', 'chest']) }, { ...B.BEGINNER_GOALS.strong.focus });
  assert.deepEqual({ ...B.beginnerGoalFocus(['arms']) }, { ...B.BEGINNER_GOALS.arms.focus });
});

test('A5 beginnerGoalFocus with nothing selected behaves as Look fit', () => {
  const fit = { ...need('BEGINNER_GOALS').fit.focus };
  assert.equal(typeof need('beginnerGoalFocus'), 'function');
  for (const input of [[], undefined, null, ['nope'], ['nope', 'also-bad'], 'arms', {}])
    assert.deepEqual({ ...B.beginnerGoalFocus(input) }, fit, 'beginnerGoalFocus(' + JSON.stringify(input) + ') must equal the fit focus');
});

test('A5 beginnerGoalFocus ignores unknown keys among valid ones and returns a fresh plain object', () => {
  assert.equal(typeof need('beginnerGoalFocus'), 'function');
  assert.deepEqual({ ...B.beginnerGoalFocus(['chest', 'bogus']) }, { ...B.BEGINNER_GOALS.chest.focus });
  const a = B.beginnerGoalFocus(['arms']), b = B.beginnerGoalFocus(['arms']);
  assert.notEqual(a, b, 'each call must return a new object');
  assert.equal(Object.getPrototypeOf(a), Object.prototype, 'must be a plain object');
  a.arms = 0; a.extra = 1;
  assert.equal(B.beginnerGoalFocus(['arms']).arms, 3, 'mutating a result must not change later results');
  assert.equal(B.BEGINNER_GOALS.arms.focus.arms, 3, 'mutating a result must not change BEGINNER_GOALS');
  const c = B.beginnerGoalFocus([]); c.arms = 0;
  assert.equal(B.BEGINNER_GOALS.fit.focus.arms, 2, 'the empty-selection result must not alias BEGINNER_GOALS.fit.focus');
});

test('B3 media manifest has the app schema and lists only real exercises with real files', () => {
  const p = path.join(MEDIA_DIR, 'manifest.json');
  assert.ok(fs.existsSync(p), 'beginner/media/manifest.json must exist');
  const m = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.equal(m.schemaVersion, 1, 'manifest schemaVersion must be 1');
  assert.ok(m.items && typeof m.items === 'object' && !Array.isArray(m.items), 'manifest items must be an object');
  const ids = new Set(EX().map(e => e.id));
  for (const id of Object.keys(m.items)) {
    assert.ok(ids.has(id), 'manifest lists "' + id + '", which is not in BEGINNER_EXERCISES');
    const v = m.items[id];
    assert.ok(typeof v === 'string' && v.trim().length > 0, 'manifest item "' + id + '" must be a non-empty string file name');
    assert.ok(typeof v === 'string' && fs.existsSync(path.join(MEDIA_DIR, v)), 'manifest item "' + id + '" names "' + v + '" but beginner/media/' + v + ' does not exist');
  }
});

test('B3 media placeholder.svg is a small, silent, self-contained SVG', () => {
  const p = path.join(MEDIA_DIR, 'placeholder.svg');
  assert.ok(fs.existsSync(p), 'beginner/media/placeholder.svg must exist');
  const buf = fs.readFileSync(p), s = buf.toString('utf8');
  assert.ok(buf.length > 0 && buf.length < cfg('placeholderMaxBytes'), 'placeholder.svg is ' + buf.length + ' bytes, need 1 to ' + (cfg('placeholderMaxBytes') - 1));
  assert.ok(/<svg[\s>]/.test(s), 'placeholder.svg must contain an <svg> element');
  const NS = 'xmlns="http://www.w3.org/2000/svg"';
  assert.ok(s.includes(NS), 'placeholder.svg must carry ' + NS + ' (an <img> will not render it otherwise)');
  const rest = s.split(NS).join('');
  assert.ok(!/http/i.test(rest), 'placeholder.svg must not contain "http" apart from the xmlns namespace');
  assert.ok(!/href/i.test(rest), 'placeholder.svg must not contain href');
  assert.ok(!/<script/i.test(rest), 'placeholder.svg must not contain <script');
  assert.ok(!/<(text|tspan|title|desc)[\s>]/i.test(rest), 'placeholder.svg must not contain text elements (text, tspan, title, desc)');
});

function listFiles(dir, base) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? listFiles(path.join(dir, d.name), base) : [path.relative(base, path.join(dir, d.name))]);
}

test('B3 assemble copies every file under beginner/media into the output byte-identical', () => {
  assert.ok(fs.existsSync(MEDIA_DIR), 'beginner/media/ must exist');
  const files = listFiles(MEDIA_DIR, MEDIA_DIR);
  assert.ok(files.includes('manifest.json') && files.includes('placeholder.svg'), 'media must hold manifest.json and placeholder.svg');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-p2-'));
  try {
    assemble({ outDir: out });
    for (const f of files) {
      const dst = path.join(out, 'media', f);
      assert.ok(fs.existsSync(dst), 'assembled output is missing media/' + f);
      assert.ok(fs.readFileSync(dst).equals(fs.readFileSync(path.join(MEDIA_DIR, f))), 'media/' + f + ' differs after assemble');
    }
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

/* ============================================================
   BEGINNER APP, package 5 (Screens): schema test for the strings table. THIS FILE IS
   THE SPEC for the Haiku clerk. Pure Node (runs on Node 18).

   Write beginner/strings.js: `const BEGINNER_STRINGS = ...` (top-level, column zero),
   deeply frozen, nested plain objects of strings. Pure data, no logic. Loaded after
   exercises.js and before coach.js (index.html and the harnesses are the UI builder's job;
   this test reads the file directly and evaluates it in a vm).

   REQUIRED KEYS. EXACT means the criteria or lead fix the wording; otherwise any wording
   that meets the constraints below passes, and `suggest` is the lead's suggestion.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILE = path.join(__dirname, '..', 'strings.js');
const FIRST = 'Pick a weight you could lift for 12 repetitions. Stop when it gets hard.';

// path -> exact text, or { suggest, has: [placeholders] } when the wording is free.
const REQUIRED = {
  'goal.heading': { suggest: 'Pick your goals' },
  'goal.nameLabel': "What's your name?",
  'goal.continue': { suggest: 'Continue' },
  'goal.skip': { suggest: 'Skip' },
  'routine.title': 'Your routine',
  'routine.titleNamed': { exact: "{name}'s routine", has: ['name'] },
  'pick.start': 'Start',
  'pick.missing': "I don't have that here",
  'pick.repeat': 'Repeat last workout',
  'pick.searchLabel': { suggest: 'Search all exercises' },
  'pick.noMatches': { suggest: 'No exercises found' },
  'pick.restoreHeading': { suggest: "Equipment you don't have" },
  'pick.restoreItem': { suggest: 'Put back {item}', has: ['item'] },
  'pick.demoAlt': { suggest: 'Exercise demo' },
  'lift.first': FIRST,
  'lift.setOf': { exact: 'Set {n} of {m}', has: ['n', 'm'] },
  'lift.done': 'Done',
  'lift.oneMore': 'One more',
  'lift.nextExercise': 'Next exercise',
  'lift.finish': { suggest: 'Finish' },
  'lift.swap': { suggest: 'Swap' },
  'lift.swapHeading': { suggest: 'Swap for' },
  'lift.add': { suggest: 'Add exercise' },
  'lift.addHeading': { suggest: 'Add an exercise' },
  'lift.end': { suggest: 'End workout' },
  'lift.weight': { suggest: 'Weight' },
  'lift.reps': { suggest: 'Reps' },
  'lift.weightLess': { suggest: 'Less weight' },
  'lift.weightMore': { suggest: 'More weight' },
  'lift.repsLess': { suggest: 'Fewer reps' },
  'lift.repsMore': { suggest: 'More reps' },
  'lift.rest': { suggest: 'Rest' },
  'units.kg': 'kg',
  'units.lb': 'lb',
  'faces.easy': 'Easy',
  'faces.good': 'Good',
  'faces.hard': 'Hard',
  // One template, four word forms chosen by count == 1: "1 exercise, 1 set", "2 exercises, 3 sets".
  'done.summary': { suggest: '{exercises} {exerciseWord}, {sets} {setWord}', has: ['exercises', 'exerciseWord', 'sets', 'setWord'] },
  'done.exerciseOne': { suggest: 'exercise' },
  'done.exerciseMany': { suggest: 'exercises' },
  'done.setOne': { suggest: 'set' },
  'done.setMany': { suggest: 'sets' },
  'done.newBest': 'New best',
  'done.question': 'How was that?',
  'done.easy': 'Too easy',
  'done.right': 'Just right',
  'done.much': 'Too much',
  'done.back': { suggest: 'Back to my routine' },
  'data.export': { suggest: 'Export my data' },
  'data.import': { suggest: 'Import data' },
  'data.confirm': { suggest: 'Importing replaces everything on this phone. Continue?' },
  'data.yes': { suggest: 'Yes, import' },
  'data.no': { suggest: 'Cancel' },
  'errors.save': { suggest: 'That did not save. Tap Done again.' },
  'errors.action': { suggest: 'That did not save. Tap again.' },
  'errors.import': { suggest: 'That file did not work. Nothing was changed.' },
  'errors.storage': { suggest: 'This device cannot save your workouts.' },
};

// G2 forbidden words and D1 phrases (whole words / phrases, case-insensitive).
const FORBIDDEN = [/\bRPE\b/i, /\bRIR\b/i, /\b1RM\b/i, /\bMEV\b/i, /\bMRV\b/i, /\bdeload\b/i, /\bvolume\b/i, /%/, /\bmissed\b/i, /\bstreak\b/i, /drop set/i, /\bmyo\b/i,
  /\btry\b/i, /last time/i, /time to go up/i];
const MAX_LEN = 80;
const EXTRA_KEYS_ALLOWED = 10;

function load() {
  assert.ok(fs.existsSync(FILE), 'beginner/strings.js does not exist yet');
  const src = fs.readFileSync(FILE, 'utf8');
  assert.match(src, /^const BEGINNER_STRINGS\b/m, 'strings.js must declare top-level const BEGINNER_STRINGS');
  return vm.runInThisContext('(function(){\n' + src + '\n;return BEGINNER_STRINGS;\n})', { filename: 'strings.js' })();
}
function leaves(o, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object') leaves(v, prefix + k + '.', out);
    else out[prefix + k] = v;
  }
  return out;
}
function deepFrozen(o) {
  return Object.isFrozen(o) && Object.values(o).every(v => !v || typeof v !== 'object' || deepFrozen(v));
}

test('G3 BEGINNER_STRINGS is a deeply frozen plain object', () => {
  const S = load();
  assert.ok(S && typeof S === 'object' && !Array.isArray(S));
  assert.ok(deepFrozen(S), 'every nested object must be frozen');
});

test('A1 every required key exists and every value is a non-empty string', () => {
  const L = leaves(load());
  for (const key of Object.keys(REQUIRED)) {
    assert.strictEqual(typeof L[key], 'string', 'missing string at ' + key);
    assert.ok(L[key].trim().length > 0, 'empty string at ' + key);
  }
  for (const [k, v] of Object.entries(L)) assert.strictEqual(typeof v, 'string', 'non-string at ' + k);
});

test('A2 criterion-fixed wording is exact', () => {
  const L = leaves(load());
  for (const [key, want] of Object.entries(REQUIRED)) {
    const exact = typeof want === 'string' ? want : want.exact;
    if (exact !== undefined) assert.strictEqual(L[key], exact, key);
  }
});

test('C6 errors.action does not tell the user to tap Done (it serves every failed write but Done)', () => {
  const L = leaves(load());
  assert.strictEqual(typeof L['errors.action'], 'string', 'errors.action is missing');
  assert.ok(!/\bDone\b/i.test(L['errors.action']), L['errors.action']);
  assert.notStrictEqual(L['errors.action'], L['errors.save']);
});

test('D10 the singular and plural word forms differ and are single lowercase words', () => {
  const L = leaves(load());
  for (const [one, many] of [['done.exerciseOne', 'done.exerciseMany'], ['done.setOne', 'done.setMany']]) {
    assert.notStrictEqual(L[one], L[many], one + ' must differ from ' + many);
    assert.match(L[one], /^[a-z]+$/, one);
    assert.match(L[many], /^[a-z]+$/, many);
  }
});

test('C1 button names are single strings, never built from two keys', () => {
  const L = leaves(load());
  assert.ok(!('lift.less' in L) && !('lift.more' in L), 'lift.less and lift.more are replaced by the four named keys');
  assert.ok(!('pick.restore' in L), 'pick.restore is replaced by pick.restoreItem');
});

test('G3 templates keep their placeholders', () => {
  const L = leaves(load());
  for (const [key, want] of Object.entries(REQUIRED)) {
    for (const p of (want && want.has) || []) assert.ok(L[key].includes('{' + p + '}'), key + ' needs {' + p + '}');
  }
});

test('G3 no string contains an em dash or an en dash', () => {
  for (const [k, v] of Object.entries(leaves(load()))) assert.ok(!/[—–]/.test(v), k);
});

test('G2 no string contains a forbidden word, a percent sign or a target phrase (D1)', () => {
  for (const [k, v] of Object.entries(leaves(load()))) {
    for (const re of FORBIDDEN) assert.ok(!re.test(v), k + ' matches ' + re + ': ' + v);
  }
});

test('D1 the table stays small: no value over 80 characters except the 12 repetitions sentence', () => {
  for (const [k, v] of Object.entries(leaves(load()))) {
    if (k === 'lift.first') continue;
    assert.ok(v.length <= MAX_LEN, k + ' is ' + v.length + ' characters');
  }
});

test('D1 no unlisted keys beyond a small allowance (the product says only what is needed)', () => {
  const L = leaves(load());
  const extra = Object.keys(L).filter(k => !(k in REQUIRED));
  assert.ok(extra.length <= EXTRA_KEYS_ALLOWED, 'unexpected keys: ' + extra.join(', '));
});

test('G3 sentences never use a straight double hyphen as a dash', () => {
  for (const [k, v] of Object.entries(leaves(load()))) assert.ok(!/ -+ /.test(v), k);
});

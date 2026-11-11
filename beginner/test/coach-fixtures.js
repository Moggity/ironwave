/* Fixtures for the package 4 coach tests (coach.test.js, coach-pick.test.js).
   Everything here is test data and tiny builders. It never reads the real
   BEGINNER_EXERCISES or the real goal table: package 2 builds those in parallel,
   so the coach is always handed this fixture list as an argument.

   Log builder: a session is written the way the criteria read.
     W(day, 'leg-press: 10 x 10, 10, 10')
       -> one finished workout on fixture day `day` with three sets of 10 kg x 10.
     Set tokens:  12   -> 12 reps, no face tapped (effort null)
                  12e  -> Easy, 12g -> Good, 12h -> Hard
                  5*   -> an intensity extra set (extra: true); may combine: 5h*
     Weight:      '10 x ...' is kg, '45lb x ...' is pounds (stored converted to kg),
                  'bw x ...' is 0 kg (bodyweight).
     Several weight groups in one exercise: 'db-curl: 10 x 11; 12 x 9, 8'
     Several exercises: W(3, 'leg-press: 10 x 10', 'db-curl: 8 x 12')
   open(day, ...) builds the workout in progress (id 'today', endedAt null).
*/
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const DAY = 864e5;
const DAY0 = Date.UTC(2026, 0, 5, 9, 0, 0); // a Monday, 09:00 UTC
const dayMs = d => DAY0 + d * DAY;
const KG_PER_LB = 0.45359237;
const lbToKg = lb => lb * KG_PER_LB;
const kgToLb = kg => kg / KG_PER_LB;

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

// ---------- fixture exercise list (deliberately NOT grouped by muscle) ----------
function row(id, muscle, equipment, equipKey, starter = true, movement = 'x') {
  return { id, name: id.replace(/-/g, ' '), movement, muscle, equipment, equipKey, cue: 'Move slowly.', demo: id + '.mp4', starter };
}
const EXERCISES = deepFreeze([
  row('bb-bench', 'chest', 'bb', 'barbell', false, 'bench'),
  row('db-curl', 'arms', 'db', 'dumbbells', true, 'bicep'),
  row('leg-press', 'legs', 'mc', 'leg-press', true, 'quad'),
  row('lat-pulldown', 'back', 'cb', 'lat-pulldown', true, 'vpull'),
  row('chest-press', 'chest', 'mc', 'chest-press', true, 'chest'),
  row('calf-raise', 'calves', 'mc', 'calf-raise', true, 'calf'),
  row('lateral-raise', 'shoulders', 'db', 'dumbbells', true, 'shoulder'),
  row('hip-thrust', 'glutes', 'mc', 'hip-thrust-machine', true, 'glute'),
  row('pushdown', 'arms', 'cb', 'cable-station', true, 'tricep'),
  row('db-bench', 'chest', 'db', 'dumbbells', true, 'chest'),
  row('goblet-squat', 'legs', 'db', 'dumbbells', true, 'quad'),
  row('seated-row', 'back', 'cb', 'cable-station', true, 'hpull'),
  row('shoulder-press', 'shoulders', 'mc', 'shoulder-press', true, 'press'),
  row('glute-bridge', 'glutes', 'bw', 'none', true, 'glute'),
  row('push-up', 'chest', 'bw', 'none', true, 'chest'),
  row('band-curl', 'arms', 'bd', 'band', true, 'bicep'),
  row('leg-extension', 'legs', 'mc', 'leg-extension', true, 'quad'),
  row('db-row', 'back', 'db', 'dumbbells', true, 'hpull'),
  row('kb-swing', 'glutes', 'kb', 'kettlebell', true, 'glute'),
  row('bb-squat', 'legs', 'bb', 'barbell', false, 'squat'),
  row('bw-calf-raise', 'calves', 'bw', 'none', true, 'calf'),
  row('cable-fly', 'chest', 'cb', 'cable-station', true, 'chest'),
  row('bb-row', 'back', 'bb', 'barbell', false, 'hpull'),
  // extra rows used only by the progression tests (one per equipment code)
  row('bb-curl', 'arms', 'bb', 'barbell', false, 'bicep'),
  row('kb-press', 'shoulders', 'kb', 'kettlebell', false, 'press'),
  // a weighted exercise whose equipment code has no entry in the increments table
  row('sled-push', 'legs', 'xx', 'sled', false, 'quad'),
]);
const byId = Object.fromEntries(EXERCISES.map(e => [e.id, e]));
const ex = id => { if (!byId[id]) throw new Error('no fixture exercise ' + id); return byId[id]; };
const ALL_KEYS = [...new Set(EXERCISES.map(e => e.equipKey))];

// ---------- fixture goal table (shape of package 2's beginnerGoalFocus output) ----------
const MUSCLES = ['arms', 'chest', 'back', 'shoulders', 'glutes', 'legs', 'calves'];
function focusWith(threes) {
  const f = {};
  for (const m of MUSCLES) f[m] = threes.includes(m) ? 3 : 2;
  return f;
}
const GOAL_TABLE = deepFreeze({
  arms: focusWith(['arms']),
  chest: focusWith(['chest']),
  legs: focusWith(['legs', 'glutes']),
  fit: focusWith([]),
  strong: focusWith(['chest', 'back', 'shoulders', 'legs']),
});
const goalFocuses = (...keys) => deepFreeze(keys.map(k => GOAL_TABLE[k]));

// ---------- log builder ----------
function parseSets(exerciseId, text, startAt) {
  const sets = [];
  let at = startAt;
  for (const group of text.split(';')) {
    const m = group.trim().match(/^(bw|[\d.]+(?:lb)?)\s*x\s*(.+)$/);
    if (!m) throw new Error('bad set group: ' + group);
    const wTok = m[1];
    const weightKg = wTok === 'bw' ? 0 : wTok.endsWith('lb') ? lbToKg(parseFloat(wTok)) : parseFloat(wTok);
    for (const tok of m[2].split(',').map(t => t.trim()).filter(Boolean)) {
      const t = tok.match(/^(\d+)([egh]?)(\*?)$/);
      if (!t) throw new Error('bad set token: ' + tok);
      const effort = { e: 'easy', g: 'good', h: 'hard' }[t[2]] || null;
      const s = { exerciseId, weightKg, reps: Number(t[1]), effort, at };
      if (t[3]) s.extra = true;
      sets.push(s);
      at += 2 * 60e3;
    }
  }
  return sets;
}
function buildWorkout(id, day, finished, specs) {
  const startedAt = dayMs(day);
  const plan = [];
  let sets = [];
  for (const spec of specs) {
    const i = spec.indexOf(':');
    const exerciseId = spec.slice(0, i).trim();
    if (!plan.includes(exerciseId)) plan.push(exerciseId);
    sets = sets.concat(parseSets(exerciseId, spec.slice(i + 1), startedAt + 60e3 + sets.length * 2 * 60e3));
  }
  return { id, startedAt, endedAt: finished ? startedAt + 3600e3 : null, feel: null, plan, sets };
}
const W = (day, ...specs) => buildWorkout('w' + day, day, true, specs);
const open = (day, ...specs) => buildWorkout('today', day, false, specs);

// ---------- seeded generator (no Math.random) ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- a copy of the beginner sources with coach config overridden ----------
// Renames the real config const, then rebuilds BEGINNER_CONFIG from it with the
// overrides deep-merged into the coach section. Independent of the builder's
// formatting: only needs the column-zero `const BEGINNER_CONFIG =` line.
function beginnerDirWithCoachConfig(overrides) {
  const src = path.join(__dirname, '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-coachcfg-'));
  // Copy every beginner source, not a fixed list, so a new source file (strings.js) is included.
  for (const f of fs.readdirSync(src).filter(n => n.endsWith('.js') || n === 'index.html')) {
    fs.copyFileSync(path.join(src, f), path.join(dir, f));
  }
  const cfgPath = path.join(dir, 'config.js');
  let cfg = fs.readFileSync(cfgPath, 'utf8');
  if (!/^const BEGINNER_CONFIG\s*=/m.test(cfg)) throw new Error('config.js lost its column-zero BEGINNER_CONFIG');
  cfg = cfg.replace(/^const BEGINNER_CONFIG\s*=/m, 'const BEGINNER_CONFIG_BASE_FOR_TEST =');
  cfg += '\nconst BEGINNER_CONFIG = (function () {\n' +
    '  const c = JSON.parse(JSON.stringify(BEGINNER_CONFIG_BASE_FOR_TEST));\n' +
    '  const o = ' + JSON.stringify(overrides) + ';\n' +
    '  c.coach = c.coach || {};\n' +
    '  (function merge(t, s) { for (const k of Object.keys(s)) {\n' +
    '    if (s[k] && typeof s[k] === "object" && !Array.isArray(s[k]) && t[k] && typeof t[k] === "object") merge(t[k], s[k]);\n' +
    '    else t[k] = s[k]; } })(c.coach, o);\n' +
    '  (function fr(x) { if (x && typeof x === "object") { Object.values(x).forEach(fr); Object.freeze(x); } })(c);\n' +
    '  return c;\n' +
    '})();\n';
  fs.writeFileSync(cfgPath, cfg);
  return dir;
}

module.exports = {
  DAY, DAY0, dayMs, KG_PER_LB, lbToKg, kgToLb, deepFreeze,
  EXERCISES, ex, ALL_KEYS, MUSCLES, GOAL_TABLE, goalFocuses,
  parseSets, W, open, mulberry32, beginnerDirWithCoachConfig,
};

/* Loads data.js, engine.js (from app/) plus the beginner scripts (not ui.js) in the
   current realm, with no DOM, so pure tests can call them directly. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const EXPORTS = `return {
  Engine, EXERCISES, EXERCISE_LIST, EX_META, EX_CUES, VOLUME_LANDMARKS,
  EXPERIENCE_FACTOR, TIME_MODEL, BEGINNER_CONFIG, BEGINNER_EXERCISES, Coach, Store,
};`;

function loadBeginner() {
  const root = path.join(__dirname, '..', '..');
  const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
  const src = [
    read('app', 'data.js'), read('app', 'engine.js'),
    read('beginner', 'config.js'), read('beginner', 'exercises.js'),
    read('beginner', 'coach.js'), read('beginner', 'store.js'),
  ].join('\n;\n');
  const fn = vm.runInThisContext('(function(){\n' + src + '\n;\n' + EXPORTS + '\n})', { filename: 'beginner-bundle.js' });
  return fn();
}

module.exports = { loadBeginner };

/* Loads the shared app scripts (data.js, engine.js) plus the beginner scripts (not
   ui.js) in the current realm, with no DOM, so pure tests can call them directly.
   Every top-level declaration in the beginner files is exposed automatically. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { SHARED_FROM_APP } = require('../../scripts/assemble-beginner.js');

const SHARED_NAMES = ['Engine', 'EXERCISES', 'EXERCISE_LIST', 'EX_META', 'EX_CUES', 'VOLUME_LANDMARKS', 'EXPERIENCE_FACTOR', 'TIME_MODEL'];
const PURE_FILES = ['config.js', 'exercises.js', 'coach.js', 'store.js'];

// Column-zero top-level declaration names found in a source text.
function topLevelNames(src) {
  const names = [];
  const re = /^(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(src))) names.push(m[1]);
  return names;
}

function loadBeginner(opts) {
  const appDir = path.join(__dirname, '..', '..', 'app');
  const bDir = (opts && opts.beginnerDir) || path.join(__dirname, '..');
  const rd = (dir, f) => fs.readFileSync(path.join(dir, f), 'utf8');
  const own = PURE_FILES.map(f => rd(bDir, f));
  const names = [...new Set([...SHARED_NAMES, ...own.flatMap(topLevelNames)])];
  const src = [...SHARED_FROM_APP.map(f => rd(appDir, f)), ...own].join('\n;\n');
  const exp = 'return {' + names.join(', ') + '};';
  return vm.runInThisContext('(function(){\n' + src + '\n;\n' + exp + '\n})', { filename: 'beginner-bundle.js' })();
}

module.exports = { loadBeginner, topLevelNames, SHARED_NAMES };

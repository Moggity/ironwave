/* Loads the shared app scripts (data.js, engine.js) plus the beginner scripts (not
   ui.js) in the current realm, with no DOM, so pure tests can call them directly.
   Every top-level declaration in the beginner files is exposed automatically. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { SHARED_FROM_APP } = require('../../scripts/assemble-beginner.js');

const SHARED_NAMES = ['Engine', 'EXERCISES', 'EXERCISE_LIST', 'EX_META', 'EX_CUES', 'VOLUME_LANDMARKS', 'EXPERIENCE_FACTOR', 'TIME_MODEL'];
const PURE_FILES = ['config.js', 'exercises.js', 'strings.js', 'coach.js', 'store.js'];

// Rule: beginner top-level globals are single plain declarations at column zero,
// one name per declaration, no destructuring. A lookalike line inside a template
// string or comment yields a name that simply reads undefined (guarded getter).
const RESERVED = new Set(['for', 'if', 'in', 'of', 'new', 'this', 'return', 'class', 'function', 'const', 'let', 'var', 'do', 'while', 'else', 'switch', 'case', 'default', 'try', 'catch', 'finally', 'throw', 'typeof', 'delete', 'void', 'with', 'break', 'continue', 'null', 'true', 'false', 'super', 'import', 'export', 'extends', 'instanceof', 'yield', 'await', 'enum', 'static', 'debugger']);
// Column-zero top-level declaration names found in a source text.
function topLevelNames(src) {
  const names = [];
  const re = /^(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(src))) if (!RESERVED.has(m[1])) names.push(m[1]);
  return names;
}

// One guarded, live getter per name; emitted in the scope where the scripts ran.
function exportShim(names, lead) {
  return lead + ' {' + names.map(n => 'get ' + n + '() { return typeof ' + n + " !== 'undefined' ? " + n + " : undefined; }").join(', ') + '};';
}

function loadBeginner(opts) {
  const appDir = path.join(__dirname, '..', '..', 'app');
  const bDir = (opts && opts.beginnerDir) || path.join(__dirname, '..');
  const rd = (dir, f) => {
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) throw new Error('Missing beginner file ' + f + ' in ' + dir);
    return fs.readFileSync(p, 'utf8');
  };
  // Package 7: platform.js (BeginnerPlatform) is pure (it only touches the window object it is
  // handed), so it loads here too. It is optional in the harness so a custom beginnerDir
  // without it still loads; android.test.js asserts the real file exists.
  const files = PURE_FILES.concat(fs.existsSync(path.join(bDir, 'platform.js')) ? ['platform.js'] : []);
  const own = files.map(f => rd(bDir, f));
  const names = [...new Set([...SHARED_NAMES, ...own.flatMap(topLevelNames)])];
  const src = [...SHARED_FROM_APP.map(f => rd(appDir, f)), ...own].join('\n;\n');
  const exp = exportShim(names, 'return');
  return vm.runInThisContext('(function(){\n' + src + '\n;\n' + exp + '\n})', { filename: 'beginner-bundle.js' })();
}

module.exports = { loadBeginner, topLevelNames, exportShim, SHARED_NAMES };

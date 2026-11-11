// Assembles the beginner app into a flat folder (a copy, not a build).
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// Scripts shared from app/, copied byte-identical. Add a shared script here only.
const SHARED_FROM_APP = ['data.js', 'engine.js'];
// Beginner-owned files and folders, copied when present.
const BEGINNER_FILES = ['index.html', 'styles.css', 'config.js', 'exercises.js', 'coach.js', 'store.js', 'ui.js', 'media'];

function assemble(opts) {
  const outDir = (opts && opts.outDir) || path.join(ROOT, 'beginner', 'www');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of BEGINNER_FILES) {
    const src = path.join(ROOT, 'beginner', f);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(outDir, f), { recursive: true });
  }
  for (const f of SHARED_FROM_APP) fs.copyFileSync(path.join(ROOT, 'app', f), path.join(outDir, f));
  return outDir;
}

if (require.main === module) console.log('Assembled to ' + assemble({}));

module.exports = { assemble, SHARED_FROM_APP, BEGINNER_FILES };

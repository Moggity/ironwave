// Assembles the beginner app into a flat folder (a copy, not a build).
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OWN = ['index.html', 'styles.css', 'config.js', 'exercises.js', 'coach.js', 'store.js', 'ui.js'];
const SHARED = ['engine.js', 'data.js'];

function assemble(opts) {
  const outDir = (opts && opts.outDir) || path.join(ROOT, 'beginner', 'www');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of OWN) fs.copyFileSync(path.join(ROOT, 'beginner', f), path.join(outDir, f));
  for (const f of SHARED) fs.copyFileSync(path.join(ROOT, 'app', f), path.join(outDir, f));
  const media = path.join(ROOT, 'beginner', 'media');
  if (fs.existsSync(media)) fs.cpSync(media, path.join(outDir, 'media'), { recursive: true });
  return outDir;
}

if (require.main === module) console.log('Assembled to ' + assemble({}));

module.exports = { assemble };

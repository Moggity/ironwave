// Assembles the beginner app into a flat folder (a copy, not a build).
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// Scripts shared from app/, copied byte-identical. Add a shared script here only.
const SHARED_FROM_APP = ['data.js', 'engine.js'];
// Beginner-owned files and folders, copied when present.
const BEGINNER_FILES = ['index.html', 'styles.css', 'config.js', 'exercises.js', 'strings.js', 'coach.js', 'store.js', 'ui.js', 'platform.js', 'boot.js', 'manifest.json', 'sw.js', 'icons', 'media'];

function assemble(opts) {
  const outDir = (opts && opts.outDir) || path.join(ROOT, 'beginner', 'www');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of BEGINNER_FILES) {
    const src = path.join(ROOT, 'beginner', f);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(outDir, f), { recursive: true });
  }
  for (const f of SHARED_FROM_APP) fs.copyFileSync(path.join(ROOT, 'app', f), path.join(outDir, f));
  stampWorker(outDir);
  return outDir;
}

function listAll(dir, base) {
  const out = [];
  for (const name of fs.readdirSync(path.join(dir, base || '')).sort()) {
    const rel = base ? base + '/' + name : name;
    if (fs.statSync(path.join(dir, rel)).isDirectory()) out.push(...listAll(dir, rel));
    else out.push(rel);
  }
  return out;
}

// The worker version is a hash of every other file (path and bytes), and the worker
// carries the list of files to precache. Same input gives the same worker.
function stampWorker(outDir) {
  const swPath = path.join(outDir, 'sw.js');
  if (!fs.existsSync(swPath)) return;
  const files = listAll(outDir).filter(f => f !== 'sw.js');
  const h = crypto.createHash('sha256');
  for (const f of files) { h.update(f); h.update('\0'); h.update(fs.readFileSync(path.join(outDir, f))); h.update('\0'); }
  const hash = h.digest('hex').slice(0, 16);
  const src = fs.readFileSync(swPath, 'utf8')
    .split('__SHELL_HASH__').join(hash)
    .replace('[/*__SHELL_FILES__*/]', JSON.stringify(files));
  fs.writeFileSync(swPath, src);
}

if (require.main === module) console.log('Assembled to ' + assemble({}));

module.exports = { assemble, SHARED_FROM_APP, BEGINNER_FILES };

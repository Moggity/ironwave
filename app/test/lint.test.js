/* ============================================================
   IRONWAVE — test/lint.test.js
   Project-specific formatting lint (future-work testing item:
   "line endings / indentation"). Enforces the contract declared in
   .gitattributes and .editorconfig across every tracked text file:
     - .bat launchers stay CRLF (Windows needs it);
     - every other text file is LF-only;
     - indentation is spaces, never tabs (indent_style = space);
     - no trailing whitespace;
     - a final newline ends the file.
   No dependency and no build step: the file set comes from
   `git ls-files`, binaries are skipped by a NUL-byte heuristic, and
   the checks are plain buffer/string scans. Runs under `npm test`,
   so a violation fails CI like any other test.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Repo root, resolved from git so the check covers the whole tree
// (not just app/, which is the test runner's cwd).
const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();

// Every tracked file, NUL-delimited so paths with spaces survive.
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const isBat = f => f.toLowerCase().endsWith('.bat');

// Text files only: read each once, skip anything with a NUL byte (the
// .pdf and any future binary). Returns { file, buf, text } records.
const textFiles = tracked
  .map(file => ({ file, buf: fs.readFileSync(path.join(ROOT, file)) }))
  .filter(r => !r.buf.includes(0))
  .map(r => ({ ...r, text: r.buf.toString('utf8') }));

// Report helper: collect "file:line reason" strings and assert none.
function assertNone(violations, label) {
  assert.strictEqual(
    violations.length, 0,
    `${label}:\n  ${violations.join('\n  ')}`
  );
}

test('.bat files are CRLF, every other text file is LF-only', () => {
  const bad = [];
  for (const { file, buf } of textFiles) {
    if (isBat(file)) {
      // Each LF must be preceded by CR.
      for (let i = 0; i < buf.length; i++) {
        if (buf[i] === 0x0a && (i === 0 || buf[i - 1] !== 0x0d)) {
          bad.push(`${file}: bare LF (must be CRLF)`); break;
        }
      }
    } else if (buf.includes(0x0d)) {
      bad.push(`${file}: contains CR (must be LF-only)`);
    }
  }
  assertNone(bad, 'Line-ending violations');
});

test('indentation uses spaces, never tabs', () => {
  const bad = [];
  for (const { file, text } of textFiles) {
    text.split('\n').forEach((line, i) => {
      const lead = line.match(/^[ \t]*/)[0];
      if (lead.includes('\t')) bad.push(`${file}:${i + 1}: tab in indentation`);
    });
  }
  assertNone(bad, 'Tab-indentation violations');
});

test('no trailing whitespace', () => {
  const bad = [];
  for (const { file, text } of textFiles) {
    // Strip CR first so .bat lines are judged on content, not the CRLF.
    text.split('\n').forEach((line, i) => {
      if (/[ \t]$/.test(line.replace(/\r$/, ''))) {
        bad.push(`${file}:${i + 1}: trailing whitespace`);
      }
    });
  }
  assertNone(bad, 'Trailing-whitespace violations');
});

test('every text file ends with a final newline', () => {
  const bad = [];
  for (const { file, buf } of textFiles) {
    if (buf.length && buf[buf.length - 1] !== 0x0a) bad.push(`${file}: missing final newline`);
  }
  assertNone(bad, 'Final-newline violations');
});

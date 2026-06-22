/* ============================================================
   IRONWAVE — test/persistence.test.js
   Persistence round-trip (future-work testing item 7). Starts the
   real server.js as a child process against a throwaway database
   file (IRONWAVE_DB), then exercises GET/POST /api/state over real
   HTTP: the data file is created on boot, GET returns the default
   state, and a POSTed state round-trips through GET and to disk.

   No jsdom and no clobbering of a developer's real database.json:
   the server is pointed at a temp file via the IRONWAVE_DB override.
   ============================================================ */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PORT = 31987; // fixed, unlikely-to-collide test port
const BASE = `http://127.0.0.1:${PORT}`;
const DB_PATH = path.join(os.tmpdir(), `ironwave-test-db-${process.pid}.json`);
const APP_DIR = path.join(__dirname, '..');

let server;

// Minimal JSON HTTP helper over the built-in http module (no fetch, so no
// experimental-warning noise on Node 18).
function req(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body != null ? Buffer.from(JSON.stringify(body)) : null;
    const headers = payload
      ? { 'content-type': 'application/json', 'content-length': payload.length }
      : {};
    const r = http.request(BASE + urlPath, { method, headers }, res => {
      let buf = '';
      res.on('data', c => (buf += c));
      res.on('end', () => resolve({ status: res.statusCode, json: buf ? JSON.parse(buf) : null }));
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function waitReady(timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await req('GET', '/api/state');
      if (r.status === 200) return;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server did not become ready in time');
}

before(async () => {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH); // start from a clean slate
  server = spawn('node', ['server.js'], {
    cwd: APP_DIR,
    env: { ...process.env, PORT: String(PORT), IRONWAVE_DB: DB_PATH },
    stdio: 'ignore',
  });
  await waitReady();
});

after(() => {
  if (server) server.kill();
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
});

test('boot creates the data file and GET returns the default state', async () => {
  assert.ok(fs.existsSync(DB_PATH), 'database file created on boot');
  const r = await req('GET', '/api/state');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.json.v, 1);
  assert.strictEqual(r.json.program, null);
  assert.ok(r.json.profile && Array.isArray(r.json.profile.plates), 'default profile present');
});

test('POST then GET round-trips the state, and it persists to disk', async () => {
  const state = {
    v: 1,
    profile: { name: 'Tester', barWeight: 20, rounding: 2.5 },
    program: null,
    records: { 'comp-squat': [{ ts: 1, weight: 100, reps: 5, rpe: 8 }] },
    sessions: [{ id: 's1', tonnage: 1234, entries: [] }],
    nested: { a: [1, 2, 3], b: { c: true } },
  };
  const post = await req('POST', '/api/state', state);
  assert.strictEqual(post.status, 200);
  assert.deepStrictEqual(post.json, { ok: true });

  // Round-trips through the API...
  const get = await req('GET', '/api/state');
  assert.strictEqual(get.status, 200);
  assert.deepStrictEqual(get.json, state);

  // ...and is the same bytes-worth on disk.
  const onDisk = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  assert.deepStrictEqual(onDisk, state);
});

/* ============================================================
   BEGINNER APP, package 7 (Android APK): static checks of the Capacitor project, the workflow,
   the signing key and the J1/J5 pins. THIS FILE IS THE SPEC (with platform.test.js, whose header
   holds the documentation facts and URLs, and screens-back.test.js). Pure Node, runs on Node 18.
   No test requires a Capacitor package. Nothing here talks to a network or a device.

   ---------- FILES the builder creates ----------
   beginner/platform.js                    const BeginnerPlatform (see platform.test.js), listed in
                                           index.html between ui.js and boot.js, and in BEGINNER_FILES.
   beginner/capacitor.config.json          { appId 'com.example.ironwavebeginner', appName 'Ironwave Beginner',
                                           webDir 'www' }. LD (J5): NO server.url, server.androidScheme or
                                           server.hostname (defaults https and localhost are what the WebView
                                           origin, and so the IndexedDB data, is keyed on: changing them loses
                                           the user's data). Capacitor reads capacitor.config.json (also .ts
                                           and .js exist: UNVERIFIED by a docs page, json chosen on purpose).
   beginner/android/                       the Capacitor Android project from `npx cap add android`, committed
                                           EXCEPT generated copies of the web files (the folder
                                           android/app/src/main/assets/public must be git-ignored, so the APK
                                           can only ever contain what assemble produced: J1).
   beginner/android/app/build.gradle       applicationId = the appId; versionCode from the CI run number
                                           (GITHUB_RUN_NUMBER, or a Gradle property that android.yml sets from
                                           github.run_number); a signingConfigs entry whose storeFile is
                                           test-signing/test.keystore (relative to android/); the release
                                           buildType uses it. The key and its passwords are public.
   beginner/android/test-signing/test.keystore  ONE fixed keystore, committed (LD path), plus README.md
                                           beside it saying it is a public test key that must never sign a
                                           store release. Not ignored by any .gitignore rule.
   beginner/android/app/src/main/AndroidManifest.xml  LD: declares VIBRATE, POST_NOTIFICATIONS and an exact
                                           alarm permission (USE_EXACT_ALARM, which Android 14+ grants with
                                           no prompt; SCHEDULE_EXACT_ALARM with maxSdkVersion 32 may sit beside
                                           it) so the locked-phone rest signal is on time. Duplicates with a
                                           plugin's own merged manifest are harmless. UNVERIFIED on a device.
                                           INTERNET is the template default; this suite does not judge it.
   beginner/package.json + package-lock.json  dependencies @capacitor/core, @capacitor/android, @capacitor/app,
                                           @capacitor/haptics, @capacitor/filesystem, @capacitor/share,
                                           @capacitor/local-notifications, and @capacitor/cli (dev dependency
                                           is fine), ALL on the same major (8 today). The lock must match
                                           (`npm ci`). The Node version of android.yml must satisfy the
                                           engines.node of @capacitor/cli recorded in the lock (Capacitor 8:
                                           >=22; the beginner CI job on Node 18 and 20 then only sees an npm
                                           EBADENGINE warning, not a failure). Keep "test" as it is.
   .github/workflows/android.yml           see LD F below.
   beginner/CHANGELOG.md                   a "Package 7" entry.

   ---------- LD F: android.yml ----------
   Block-style YAML (the tests read lines). Triggers: push to main limited to paths 'beginner/**',
   'app/engine.js', 'app/data.js', 'scripts/assemble-beginner.js', '.github/workflows/android.yml',
   plus workflow_dispatch, plus pull_request on the same five paths (never 'app/**': that is Ironwave).
   Top-level permissions: contents: read only. Two jobs (names free):
     BUILD  runs on push, dispatch and pull_request. Steps in this order: actions/checkout, actions/setup-node,
            actions/setup-java, `npm ci` in beginner, `node scripts/assemble-beginner.js` from the repo root
            (exactly the command pages.yml runs, which is how J1 "same web files as the Pages build" is
            guaranteed: nothing edits beginner/www afterwards in either workflow), `cap sync android`
            (npx, in beginner), `./gradlew assembleRelease` in beginner/android (a SIGNED apk), then
            actions/upload-artifact of the .apk under app/build/outputs/apk/release/ (the standard AGP
            output path). On pull_request this is all that happens: no release, read-only.
     PUBLISH (needs BUILD, job-level `if` excludes pull_request, the ONLY place with `contents: write`):
            downloads the artifact and publishes a GitHub PRE-release titled "Latest test build" on ONE fixed
            literal tag, replacing the previous APK asset (--clobber, delete-asset or overwrite_files must
            appear explicitly). Never a tag built from the run number or the commit.
   LD: a `concurrency:` group serialises publishing and never cancels a running publish, because an older
   run finishing late would replace the newest APK with one whose versionCode is lower, and Android
   refuses to install that over the newer one.
   No secrets: the only secrets.* allowed is secrets.GITHUB_TOKEN. The workflow prints no env block, no
   token, and never turns on shell tracing.
   JDK: setup-java java-version must be at least the JavaVersion in the generated
   beginner/android/app/capacitor.build.gradle (Capacitor 8 projects: 21; checked only when that file exists).
   VERSION CODE: strictly rises with every build (run number). The run number restarts if the workflow
   file is ever renamed or recreated: keep the name android.yml.

   ---------- LD G: offline (J1) ----------
   assemble({ outDir }) output contains platform.js, index.html references no http(s) or protocol-relative
   URL, the CSP keeps script-src 'self' without 'unsafe-inline' (an inline script cannot run; see the loud
   warning in platform.test.js about the Capacitor fallback injection), capacitor.config.json has no
   server.url.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { assemble, BEGINNER_FILES } = require('../../scripts/assemble-beginner.js');
const { loadBeginner } = require('./load-beginner');

const REPO = path.resolve(__dirname, '..', '..');
const B = path.join(REPO, 'beginner');
const ANDROID = path.join(B, 'android');
const rd = (...p) => fs.readFileSync(path.join(REPO, ...p), 'utf8').replace(/\r/g, '');
const ex = (...p) => fs.existsSync(path.join(REPO, ...p));
const tmp = tag => fs.mkdtempSync(path.join(os.tmpdir(), 'bg-and-' + tag + '-'));
const rm = d => fs.rmSync(d, { recursive: true, force: true });

// ======================= J1: same files, offline =======================
let assembled = null;
const asm = () => { if (!assembled) assembled = assemble({ outDir: tmp('asm') }); return assembled; };
test.after(() => { if (assembled) rm(assembled); });

const scriptSrcs = html => [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(m => m[1]);

test('J1 platform.js is listed in index.html after ui.js and before boot.js, which stays last', () => {
  const s = scriptSrcs(rd('beginner', 'index.html'));
  assert.ok(s.includes('platform.js'), 'index.html does not load platform.js');
  assert.ok(s.indexOf('ui.js') < s.indexOf('platform.js') && s.indexOf('platform.js') < s.indexOf('boot.js'), s.join(', '));
  assert.strictEqual(s[s.length - 1], 'boot.js');
});
test('J1 platform.js is in BEGINNER_FILES and in the assembled folder, byte-identical', () => {
  assert.ok(BEGINNER_FILES.includes('platform.js'));
  const out = asm();
  assert.ok(fs.existsSync(path.join(out, 'platform.js')), 'assemble did not copy platform.js');
  assert.ok(fs.readFileSync(path.join(out, 'platform.js')).equals(fs.readFileSync(path.join(B, 'platform.js'))));
});
test('J1 the assembled folder contains every script index.html loads, so the shell needs no network', () => {
  const out = asm();
  for (const s of scriptSrcs(fs.readFileSync(path.join(out, 'index.html'), 'utf8'))) assert.ok(fs.existsSync(path.join(out, s)), 'missing ' + s);
});
test('J1 the assembled index.html references no http(s) or protocol-relative URL and keeps a strict script policy', () => {
  const h = fs.readFileSync(path.join(asm(), 'index.html'), 'utf8');
  assert.ok(!/https?:\/\//i.test(h), 'an absolute URL in index.html');
  assert.ok(!/(src|href)\s*=\s*["']\/\//i.test(h), 'a protocol-relative URL in index.html');
  const m = h.match(/Content-Security-Policy"[^>]*content="([^"]*)"/i);
  assert.ok(m, 'CSP meta missing');
  const script = (m[1].split(';').map(x => x.trim()).find(x => x.startsWith('script-src')) || '');
  assert.ok(script.includes("'self'") && !/unsafe-inline|unsafe-eval|https?:|\*/.test(script), 'script-src must stay strict: ' + script);
});
test('J1 capacitor.config.json exists with the documented keys and loads no remote app (no server.url)', () => {
  assert.ok(ex('beginner', 'capacitor.config.json'), 'beginner/capacitor.config.json is missing');
  const c = JSON.parse(rd('beginner', 'capacitor.config.json'));
  assert.strictEqual(c.webDir, 'www');
  assert.strictEqual(c.appName, 'Ironwave Beginner');
  assert.ok(!(c.server && Object.prototype.hasOwnProperty.call(c.server, 'url')), 'server.url would load the app from the network');
  assert.ok(!/https?:\/\//i.test(JSON.stringify(c)), 'a URL in the Capacitor config');
});
test('J1 the Capacitor config and android folder are not part of the assembled web folder', () => {
  const out = asm();
  for (const f of ['capacitor.config.json', 'android', 'node_modules', 'package.json']) assert.ok(!fs.existsSync(path.join(out, f)), f + ' must not be assembled');
});
test('J1 the Android asset copy of the web files is git-ignored, so the APK holds only what assemble produced', () => {
  const g = spawnSync('git', ['check-ignore', '-q', 'beginner/android/app/src/main/assets/public/index.html'], { cwd: REPO });
  if (g.error || (g.status !== 0 && g.status !== 1)) return; // git unavailable: nothing to check
  assert.strictEqual(g.status, 0, 'beginner/android/app/src/main/assets/public must be ignored');
});
test('J1 the Gradle project files themselves are not git-ignored', () => {
  for (const f of ['app/build.gradle', 'build.gradle', 'variables.gradle', 'gradlew', 'gradle/wrapper/gradle-wrapper.properties', 'gradle/wrapper/gradle-wrapper.jar', 'app/src/main/AndroidManifest.xml']) {
    const g = spawnSync('git', ['check-ignore', '-q', 'beginner/android/' + f], { cwd: REPO });
    if (g.error || (g.status !== 0 && g.status !== 1)) return;
    assert.strictEqual(g.status, 1, 'beginner/android/' + f + ' is ignored by git');
  }
});
test('J1 the android folder has the generated Capacitor project files', () => {
  for (const f of ['build.gradle', 'variables.gradle', 'app/build.gradle', 'app/src/main/AndroidManifest.xml', 'gradlew', 'gradle/wrapper/gradle-wrapper.properties']) {
    assert.ok(fs.existsSync(path.join(ANDROID, f)), 'beginner/android/' + f + ' is missing (npx cap add android)');
  }
});

// ======================= packages and lock =======================
const PLUGINS = ['@capacitor/core', '@capacitor/android', '@capacitor/app', '@capacitor/haptics', '@capacitor/filesystem', '@capacitor/share', '@capacitor/local-notifications', '@capacitor/cli'];
const pkg = () => JSON.parse(rd('beginner', 'package.json'));
const lock = () => JSON.parse(rd('beginner', 'package-lock.json'));
const major = v => Number(String(v).replace(/^[^\d]*/, '').split('.')[0]);

test('J1 the Capacitor packages are declared in beginner/package.json on one major', () => {
  const p = pkg();
  const all = Object.assign({}, p.dependencies, p.devDependencies);
  for (const n of PLUGINS) assert.ok(all[n], n + ' is not declared');
  const majors = new Set(PLUGINS.map(n => major(all[n])));
  assert.strictEqual(majors.size, 1, 'mixed Capacitor majors: ' + PLUGINS.map(n => n + '@' + all[n]).join(', '));
  assert.ok([...majors][0] >= 7, 'the docs checked on 2026-11-11 name Capacitor 8 as current');
  assert.strictEqual(p.scripts.test, 'node --test test/*.test.js', 'the test script must stay');
});
test('J1 package-lock.json matches package.json for npm ci and records every Capacitor package', () => {
  const l = lock();
  const root = l.packages[''];
  const p = pkg();
  assert.deepStrictEqual(root.dependencies || {}, p.dependencies || {});
  assert.deepStrictEqual(root.devDependencies || {}, p.devDependencies || {});
  for (const n of PLUGINS) assert.ok(l.packages['node_modules/' + n], n + ' is missing from the lock');
});
test('J2 the Node version of android.yml satisfies the engines of @capacitor/cli in the lock', () => {
  const eng = (lock().packages['node_modules/@capacitor/cli'] || {}).engines;
  const m = eng && /(\d+)/.exec(eng.node || '');
  assert.ok(m, '@capacitor/cli has no engines.node in the lock');
  const v = /node-version:\s*['"]?(\d+)/.exec(wf());
  assert.ok(v, 'android.yml sets no node-version');
  assert.ok(Number(v[1]) >= Number(m[1]), 'Node ' + v[1] + ' is below the CLI minimum ' + eng.node);
});

// ======================= J2: the workflow =======================
const WF = path.join(REPO, '.github', 'workflows', 'android.yml');
function wf() {
  assert.ok(fs.existsSync(WF), '.github/workflows/android.yml does not exist yet');
  return fs.readFileSync(WF, 'utf8').replace(/\r/g, '');
}
const noComments = t => t.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
// Lines of a top-level key's block (until the next line at column zero).
function topBlock(text, key) {
  const lines = text.split('\n');
  const i = lines.findIndex(l => l.replace(/\s+$/, '') === key + ':' || l.startsWith(key + ':'));
  if (i < 0) return null;
  let end = lines.length;
  for (let j = i + 1; j < lines.length; j++) if (/^\S/.test(lines[j])) { end = j; break; }
  return lines.slice(i + 1, end).join('\n');
}
// Sub-blocks at two-space indent inside a block (jobs, on).
function subBlocks(block) {
  const out = {};
  const lines = block.split('\n');
  let name = null;
  for (const l of lines) {
    const m = /^  ([A-Za-z0-9_-]+):/.exec(l);
    if (m) { name = m[1]; out[name] = ''; }
    if (name) out[name] += l + '\n';
  }
  return out;
}
const jobs = () => subBlocks(topBlock(noComments(wf()), 'jobs') || '');
const buildJob = () => { const e = Object.entries(jobs()).find(([, t]) => /gradlew/.test(t)); assert.ok(e, 'no job runs gradlew'); return e; };
const publishJob = () => { const e = Object.entries(jobs()).filter(([, t]) => /contents:\s*write/.test(t)); assert.strictEqual(e.length, 1, 'exactly one job may have contents: write'); return e[0]; };

const PRODUCT_PATHS = ['beginner/**', 'app/engine.js', 'app/data.js', 'scripts/assemble-beginner.js', '.github/workflows/android.yml'];
test('J2 android.yml triggers on push to main and pull_request for the product paths only, plus workflow_dispatch', () => {
  const on = subBlocks(topBlock(noComments(wf()), 'on') || '');
  assert.ok(on.push && on.pull_request && on.workflow_dispatch !== undefined, 'on: needs push, pull_request and workflow_dispatch, as blocks');
  assert.match(on.push, /branches:\s*\[\s*main\s*\]|-\s*main\b/);
  for (const sec of [on.push, on.pull_request]) {
    for (const p of PRODUCT_PATHS) assert.ok(new RegExp('-\\s*[\'"]?' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\'"]?\\s*$', 'm').test(sec), 'path missing: ' + p);
    const listed = [...sec.matchAll(/^\s+-\s*['"]?([^'"\s]+)['"]?\s*$/gm)].map(m => m[1]).filter(x => x !== 'main');
    assert.deepStrictEqual(listed.sort(), PRODUCT_PATHS.slice().sort(), 'only the product paths may trigger a build');
  }
});
test('J2 top-level permissions are read-only and exactly one job can write contents', () => {
  const perm = topBlock(noComments(wf()), 'permissions');
  assert.ok(perm, 'no top-level permissions');
  assert.deepStrictEqual(perm.split('\n').map(l => l.trim()).filter(Boolean), ['contents: read']);
  assert.strictEqual((noComments(wf()).match(/contents:\s*write/g) || []).length, 1);
});
test('J2 the build job runs the steps in order: checkout, node, jdk, npm ci, assemble, cap sync, gradle, upload', () => {
  const [, t] = buildJob();
  const order = [/actions\/checkout@/, /actions\/setup-node@/, /actions\/setup-java@/, /\bnpm ci\b/, /node scripts\/assemble-beginner\.js/, /cap sync android/, /\.\/gradlew[^\n]*assembleRelease/, /actions\/upload-artifact@/];
  let at = -1;
  for (const re of order) {
    const m = re.exec(t);
    assert.ok(m, 'step missing: ' + re);
    assert.ok(m.index > at, 'step out of order: ' + re);
    at = m.index;
  }
  assert.match(t, /working-directory:\s*beginner\b/, 'npm ci and cap sync run in beginner');
  assert.match(t, /build\/outputs\/apk\/release\/[^\s]*\.apk/, 'the uploaded file is the release apk');
});
test('J1 both workflows run the same assemble script and neither edits beginner/www afterwards', () => {
  for (const file of ['pages.yml', 'android.yml']) {
    const t = noComments(file === 'android.yml' ? wf() : rd('.github', 'workflows', file));
    const i = t.indexOf('node scripts/assemble-beginner.js');
    assert.ok(i !== -1, file + ' must call node scripts/assemble-beginner.js');
    const after = t.slice(i).split('\n').slice(1);
    for (const l of after) {
      if (!/www/.test(l)) continue;
      assert.ok(!/\b(rm|mv|sed|tee|touch|truncate|ln)\b/.test(l), file + ' modifies www: ' + l.trim());
      assert.ok(!/>>?\s*\S*www/.test(l), file + ' writes into www: ' + l.trim());
      assert.ok(!/\bcp\b[^\n]*\s\S*www\/?["']?\s*$/.test(l), file + ' copies into www: ' + l.trim());
    }
  }
});
test('J2 the jdk is at least what the generated Capacitor project needs', () => {
  const [, t] = buildJob();
  const j = /java-version:\s*['"]?(\d+)/.exec(t);
  assert.ok(j, 'setup-java needs an explicit java-version');
  assert.match(t, /distribution:\s*\S+/);
  const f = path.join(ANDROID, 'app', 'capacitor.build.gradle');
  if (fs.existsSync(f)) {
    const need = /JavaVersion\.VERSION_(\d+)/.exec(fs.readFileSync(f, 'utf8'));
    if (need) assert.ok(Number(j[1]) >= Number(need[1]), 'JDK ' + j[1] + ' is below the project level ' + need[1]);
  }
});
test('J2 pull requests only build and upload: the publish job is skipped for them and the build job cannot release', () => {
  const [, b] = buildJob();
  const [, p] = publishJob();
  assert.ok(!/gh release|action-gh-release|contents:\s*write/.test(b), 'the build job must not publish');
  assert.match(p, /\n\s{4}if:[^\n]*(github\.event_name\s*!=\s*'pull_request'|github\.event_name\s*==\s*'push'|github\.event_name\s*==\s*'workflow_dispatch')/);
  assert.match(p, /needs:\s*\[?\s*[\w-]+/);
  assert.match(p, /actions\/download-artifact@/);
  assert.ok(!/\bnpm\b|gradlew|actions\/checkout/.test(p), 'the publishing job must not run repository code');
  assert.ok(!/\n\s{4}if:[^\n]*pull_request/.test(b), 'the build job must not skip pull requests');
});
test('J2 the release is a pre-release named Latest test build on one fixed literal tag, replacing the old apk', () => {
  const [, p] = publishJob();
  assert.ok(p.includes('Latest test build'), 'release title');
  assert.match(p, /--prerelease|prerelease:\s*true/);
  assert.match(p, /--clobber|delete-asset|overwrite_files:\s*true|overwrite:\s*true/, 'replacing the old asset must be explicit');
  assert.match(p, /\.apk/);
  const tags = [...p.matchAll(/gh release (?:create|edit|upload|view|delete-asset)\s+["']?([^\s"'\\]+)/g)].map(m => m[1])
    .concat([...p.matchAll(/tag_name:\s*["']?([^\s"']+)/g)].map(m => m[1]));
  assert.ok(tags.length > 0, 'no tag found');
  for (const t of tags) assert.ok(!/run_|run_number|run_id|sha|\$\{\{\s*github\./i.test(t), 'the tag must not vary per build: ' + t);
});
test('J2 publishing is serialised and never cancelled mid-way (an older run must not overwrite a newer apk)', () => {
  const t = noComments(wf());
  assert.match(t, /concurrency:/);
  const blocks = t.split('concurrency:').slice(1).map(s => s.split('\n').slice(0, 4).join('\n'));
  assert.ok(blocks.some(b => /cancel-in-progress:\s*false/.test(b)), 'a concurrency group with cancel-in-progress: false');
});
test('J2 no signing secrets: the only secret that may appear is GITHUB_TOKEN', () => {
  const t = noComments(wf());
  for (const m of t.matchAll(/secrets\.([A-Za-z0-9_]+)/g)) assert.strictEqual(m[1], 'GITHUB_TOKEN', 'secrets.' + m[1]);
  assert.ok(!/(STORE|KEY)_?(PASSWORD|PASS)\s*:\s*\$\{\{/i.test(t));
});
test('J2 the workflow prints no environment, token or trace', () => {
  const t = noComments(wf());
  assert.ok(!/^\s*(run:\s*)?(env|printenv|export)\s*$/m.test(t), 'prints the environment');
  assert.ok(!/\bset\s+-[a-z]*x|xtrace|ACTIONS_STEP_DEBUG|ACTIONS_RUNNER_DEBUG/.test(t), 'shell tracing or debug logging');
  for (const l of t.split('\n')) if (/\b(echo|printf)\b/.test(l)) assert.ok(!/secrets\.|github\.token|GITHUB_TOKEN|GH_TOKEN/.test(l), 'prints a token: ' + l.trim());
});

// ======================= J2/J5: gradle and signing =======================
const gradle = () => {
  const f = path.join(ANDROID, 'app', 'build.gradle');
  assert.ok(fs.existsSync(f), 'beginner/android/app/build.gradle is missing');
  return fs.readFileSync(f, 'utf8').replace(/\r/g, '');
};
test('J2 versionCode comes from the CI run number so every build is higher than the last', () => {
  const g = gradle();
  const line = (g.match(/^\s*versionCode\b.*$/m) || [''])[0];
  assert.ok(line, 'no versionCode line');
  assert.ok(!/^\s*versionCode\s*=?\s*\d+\s*$/.test(line), 'versionCode is a fixed number: ' + line.trim());
  const fromEnv = /GITHUB_RUN_NUMBER/.test(line);
  const fromProp = /(findProperty|getProperty|hasProperty|project\.|rootProject\.)/.test(line) && /github\.run_number/.test(wf());
  assert.ok(fromEnv || fromProp, 'versionCode must read GITHUB_RUN_NUMBER, or a property android.yml sets from github.run_number: ' + line.trim());
});
test('J2 the release build is signed with the fixed test keystore through a Gradle signing config', () => {
  const g = gradle();
  assert.match(g, /signingConfigs\s*\{[\s\S]*storeFile[^\n]*test-signing\/test\.keystore/);
  assert.match(g, /buildTypes\s*\{[\s\S]*release\s*\{[\s\S]*signingConfig\s*=?\s*signingConfigs\.\w+/);
});
test('J5 the application id is the one in capacitor.config.json (a different id is a different app with no old data)', () => {
  const id = JSON.parse(rd('beginner', 'capacitor.config.json')).appId;
  // PIN: changing the appId installs a NEW app next to the old one. Only change it before real use.
  assert.strictEqual(id, 'com.example.ironwavebeginner');
  assert.match(gradle(), new RegExp('applicationId\\s*=?\\s*["\']' + id.replace(/\./g, '\\.') + '["\']'));
});

const KS = path.join(ANDROID, 'test-signing', 'test.keystore');
test('J2 the fixed test keystore is committed, non-empty and a real keystore file', () => {
  assert.ok(fs.existsSync(KS), 'beginner/android/test-signing/test.keystore is missing');
  const b = fs.readFileSync(KS);
  assert.ok(b.length > 500, 'keystore too small: ' + b.length + ' bytes');
  const jks = b.readUInt32BE(0) === 0xFEEDFEED;
  const p12 = b[0] === 0x30;
  assert.ok(jks || p12, 'not a JKS or PKCS12 keystore');
});
test('J2 no .gitignore rule excludes the keystore (an ignored key would build a different signature in CI)', () => {
  const g = spawnSync('git', ['check-ignore', '-q', 'beginner/android/test-signing/test.keystore'], { cwd: REPO });
  if (g.error || (g.status !== 0 && g.status !== 1)) return;
  assert.strictEqual(g.status, 1, 'the keystore path is ignored by git');
});
test('J2 a README beside the keystore says it is a public test key that must never sign a store release', () => {
  const f = path.join(ANDROID, 'test-signing', 'README.md');
  assert.ok(fs.existsSync(f), 'test-signing/README.md is missing');
  const t = fs.readFileSync(f, 'utf8');
  assert.match(t, /public/i);
  assert.match(t, /test/i);
  assert.match(t, /never/i);
  assert.match(t, /store|play/i);
});

// ======================= manifest =======================
test('J4 the manifest declares vibrate, notification and exact-alarm permissions (LD)', () => {
  const f = path.join(ANDROID, 'app', 'src', 'main', 'AndroidManifest.xml');
  assert.ok(fs.existsSync(f), 'AndroidManifest.xml is missing');
  const t = fs.readFileSync(f, 'utf8');
  assert.match(t, /android\.permission\.VIBRATE/);
  assert.match(t, /android\.permission\.POST_NOTIFICATIONS/);
  assert.match(t, /android\.permission\.(USE_EXACT_ALARM|SCHEDULE_EXACT_ALARM)/);
});

// ======================= J5: data survives an update =======================
test('J5 the storage names are pinned: changing any of them loses every user\'s data on update', () => {
  // PIN: the IndexedDB database, object store and key are how saved workouts are found. A change here
  // means an updated app opens an empty database. Add a migration instead of renaming.
  const { BEGINNER_CONFIG } = loadBeginner();
  assert.strictEqual(BEGINNER_CONFIG.store.dbName, 'ironwave-beginner');
  assert.strictEqual(BEGINNER_CONFIG.store.storeName, 'kv');
  assert.strictEqual(BEGINNER_CONFIG.store.key, 'ironwave-beginner-state');
});
test('J5 the WebView origin is the Capacitor default: no custom androidScheme or hostname, no server block that changes it', () => {
  // PIN: IndexedDB is keyed on the origin (https://localhost by default). Changing it starts an empty store.
  const c = JSON.parse(rd('beginner', 'capacitor.config.json'));
  const s = c.server || {};
  for (const k of ['androidScheme', 'hostname', 'url', 'iosScheme']) assert.ok(!Object.prototype.hasOwnProperty.call(s, k), 'server.' + k + ' is set');
});
test('J5 the manifest does not turn off app backup rules or clear data on launch (data must survive an update)', () => {
  const f = path.join(ANDROID, 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!fs.existsSync(f)) return assert.fail('AndroidManifest.xml is missing');
  const t = fs.readFileSync(f, 'utf8');
  assert.ok(!/clearTaskOnLaunch\s*=\s*"true"|android:allowClearUserData\s*=\s*"true"/.test(t));
});

// ======================= changelog =======================
test('J1 the beginner changelog has a Package 7 entry', () => {
  assert.match(rd('beginner', 'CHANGELOG.md'), /^## Package 7/m);
});

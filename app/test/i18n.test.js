/* ============================================================
   IRONWAVE — test/i18n.test.js
   Guardrails for the translation layer (docs/pending-future-work.md,
   i18n plan):
     - catalog completeness: an unknown/extra key in a non-English
       catalog FAILS (typo net); a missing key only WARNS (runtime
       falls back to English);
     - placeholders in every translation match en.js;
     - no em dashes in catalog values (athlete-facing strings);
     - t() lookup order and interpolation;
     - language resolution and the migrateState backfill;
     - every catalog on disk is wired into index.html and sw.js so
       a new language actually loads (and works offline).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp } = require('./load-app');

const app = loadApp();
const { I18N, t } = app;

const nonEnglish = () => Object.entries(I18N.catalogs).filter(([code]) => code !== 'en');
const placeholders = s => (String(s).match(/\{\w+\}/g) || []).sort().join(',');

test('the English catalog is registered and non-empty', () => {
  assert.ok(I18N.catalogs.en, 'en catalog registered');
  assert.ok(Object.keys(I18N.catalogs.en.strings).length > 50, 'en catalog has content');
});

test('non-English catalogs have no unknown keys (typo net, fails)', () => {
  const en = I18N.catalogs.en.strings;
  // [phase 4] 'exn.<id>' exercise-name keys are layered over EXERCISES and
  // deliberately absent from en.js (English falls back to the data.js name),
  // so they validate against real exercise ids instead of the en key set.
  const exIds = new Set(app.EXERCISES.map(e => e.id));
  for (const [code, cat] of nonEnglish()) {
    const extra = Object.keys(cat.strings).filter(k =>
      !(k in en) && !(k.startsWith('exn.') && exIds.has(k.slice(4))));
    assert.deepStrictEqual(extra, [], `${code}.js has keys that do not exist in en.js (or exn.* keys with no matching exercise)`);
  }
});

test('exercise names translate through exn.* keys and fall back to English', () => {
  app.S = app.defaultState(); // exName resolves through allExercises (S.customEx)
  I18N.setLang('es');
  try {
    assert.strictEqual(app.exName('comp-squat'), 'Sentadilla de competencia');
    assert.strictEqual(app.exName('lat-pulldown'), 'Polea al pecho');
    // A custom exercise is the athlete's own text, never translated.
    app.S.customEx.push({ id: 'cx-test', name: 'My Special Lift', movement: 'squat', equipment: 'bb', custom: true });
    assert.strictEqual(app.exName('cx-test'), 'My Special Lift');
    app.S.customEx.pop();
  } finally {
    I18N.setLang('en');
  }
  assert.strictEqual(app.exName('comp-squat'), 'Comp Squat', 'English uses the data.js name');
});

test('missing keys in a non-English catalog warn but do not fail', () => {
  const en = I18N.catalogs.en.strings;
  for (const [code, cat] of nonEnglish()) {
    const missing = Object.keys(en).filter(k => !(k in cat.strings));
    if (missing.length) {
      console.warn(`[i18n] ${code}.js is missing ${missing.length} key(s), they fall back to English:\n  ${missing.join('\n  ')}`);
    }
  }
});

test('placeholders in every translation match the English string', () => {
  const en = I18N.catalogs.en.strings;
  const bad = [];
  for (const [code, cat] of nonEnglish()) {
    for (const [k, v] of Object.entries(cat.strings)) {
      if (k in en && placeholders(v) !== placeholders(en[k])) bad.push(`${code}.js: ${k}`);
    }
  }
  assert.deepStrictEqual(bad, [], 'placeholder mismatch vs en.js');
});

test('catalog values carry no em dashes (athlete-facing strings)', () => {
  const bad = [];
  for (const [code, cat] of Object.entries(I18N.catalogs)) {
    for (const [k, v] of Object.entries(cat.strings)) {
      if (String(v).includes('—')) bad.push(`${code}.js: ${k}`);
    }
  }
  assert.deepStrictEqual(bad, [], 'em dash in catalog value');
});

test('t() looks up active language, falls back to English, then the key', () => {
  I18N.setLang('es');
  try {
    assert.strictEqual(t('rest.done'), 'Descanso listo');
    // Simulate a missing translation: the English value shows instead.
    const es = I18N.catalogs.es.strings;
    const saved = es['rest.done'];
    delete es['rest.done'];
    assert.strictEqual(t('rest.done'), 'Rest done');
    es['rest.done'] = saved;
    // A key that exists nowhere degrades to the key itself (visible in dev).
    assert.strictEqual(t('no.such.key'), 'no.such.key');
  } finally {
    I18N.setLang('en');
  }
});

test('t() interpolates {name} params and leaves unknown placeholders visible', () => {
  I18N.setLang('en');
  assert.strictEqual(t('session.week_day', { week: 3, day: 2 }), 'Week 3, Day 2');
  assert.strictEqual(t('session.week_day', { week: 3 }), 'Week 3, Day {day}');
  assert.strictEqual(t('session.round', { n: 0 }), 'Round 0');
});

test('language resolution: explicit choice, device language, unknown falls back to English', () => {
  try {
    assert.strictEqual(I18N.setLang('es', 'en-US'), 'es', 'explicit choice wins over the device');
    assert.strictEqual(I18N.setLang('auto', 'es-MX'), 'es', 'auto derives from the device language');
    assert.strictEqual(I18N.setLang('auto', 'fr-FR'), 'en', 'unshipped device language falls back to English');
    assert.strictEqual(I18N.setLang('xx', 'fr-FR'), 'en', 'unknown stored code falls back like auto');
  } finally {
    I18N.setLang('en');
  }
});

test('dateLocale follows an explicit choice and defers to the device on auto', () => {
  try {
    I18N.setLang('es');
    assert.strictEqual(I18N.dateLocale(), 'es');
    I18N.setLang('auto', 'fr-FR');
    assert.strictEqual(I18N.dateLocale(), undefined);
  } finally {
    I18N.setLang('en');
  }
});

test('migrateState backfills profile.lang to auto, idempotently', () => {
  const s = app.defaultState();
  delete s.profile.lang;
  app.migrateState(s);
  assert.strictEqual(s.profile.lang, 'auto');
  s.profile.lang = 'es';
  app.migrateState(s);
  assert.strictEqual(s.profile.lang, 'es', 'an existing choice is never overwritten');
});

test('every catalog on disk is loaded by index.html and cached by sw.js', () => {
  const appDir = path.join(__dirname, '..');
  const catalogs = fs.readdirSync(path.join(appDir, 'i18n'))
    .filter(f => f.endsWith('.js') && f !== 'i18n.js');
  const index = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(appDir, 'sw.js'), 'utf8');
  for (const f of ['i18n.js', ...catalogs]) {
    assert.ok(index.includes(`i18n/${f}`), `index.html loads i18n/${f}`);
    assert.ok(sw.includes(`./i18n/${f}`), `sw.js SHELL caches i18n/${f} for offline`);
  }
});

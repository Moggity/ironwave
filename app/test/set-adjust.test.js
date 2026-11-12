/* ============================================================
   IRONWAVE — test/set-adjust.test.js
   The athlete adds or removes sets on an exercise ([set-adjust]):
   - resolveSlot honours slot.setAdj as its last step (plain sets only,
     a trailing AMRAP stays last) and is untouched when it is absent;
   - in a live session ＋ inserts one unlogged plain set where
     applySetDelta would, leaving logged sets exactly as they were;
   - swipe-remove of a set, with Undo restoring set, data and setAdj;
     the last plain set and special sets are not removable;
   - the finisher moves to the new last working set when its set goes;
   - calibration weeks (no plain set) still get a set for today;
   - setAdj ends with the block and with a swap; templates never carry it;
   - the preview controls change the count;
   - jsdom: a swipe on a set row opens that row only, a swipe elsewhere
     on the card still opens the card.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const NODE_MAJOR = Number(process.versions.node.split('.')[0]);
const FOCUS = { arms: 2, chest: 2, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 2 };
const MAXES = { 'comp-squat': 140, 'comp-bench': 100, 'comp-deadlift': 180, 'military-press': 60 };

// A calibrated powerbuilding program: day 0 is bench (main) + db-row (acc,
// calibrated by one recent record) + dips (acc, still calibrating).
function freshProgram(opts = {}) {
  app.S = app.defaultState();
  app.S.program = app.makeProgram({
    daysPerWeek: 4, track: opts.track || 'powerbuilding', timeMode: 'unlimited',
    experience: 'intermediate', muscleFocus: { ...FOCUS }, maxes: opts.uncalibrated ? {} : { ...MAXES },
  });
  if (!opts.uncalibrated) app.pushRecord('db-row', { ts: Date.now(), weight: 30, reps: 10, rpe: 8 });
  app.V = { view: 'workout', tab: 'workout', dayIdx: 0, draft: null };
  return app.S.program;
}
function startDraft(di = 0) {
  const p = app.S.program;
  const b = p.pointer.block, w = p.pointer.week;
  const entries = app.resolveDayEntries(di, b, w).items.map(x => app.applyInjuryEasing(app.sessionEntryFrom(x), []));
  app.V = { view: 'session', tab: 'workout', dayIdx: di, draft: { id: 's1', ts: 1, b, w, d: di, entries,
    sleepHours: 7.5, mindset: '', sliders: {} } };
  return app.V.draft;
}
const slotIdx = (p, pred) => p.days[0].slots.findIndex(pred);
const plainCount = sets => sets.filter(app.isPlainSet).length;
// The prescription fields of a draft set (what a fresh session would show).
const targets = s => ({ targetWeight: s.targetWeight, targetReps: s.targetReps, targetRpe: s.targetRpe,
  amrap: s.amrap, ramp: s.ramp, calib: s.calib, technique: s.technique, dropTargets: s.dropTargets });
function freshEntrySets(di, si) {
  const dr = app.V.draft;
  const item = app.resolveDayEntries(di, dr.b, dr.w).items.find(x => x.si === si);
  return app.sessionEntryFrom(item).sets;
}

// ------------------------------------------------------------
// resolveSlot
// ------------------------------------------------------------
test('resolveSlot: setAdj adds/removes plain accessory sets; absent is unchanged', () => {
  const p = freshProgram();
  const si = slotIdx(p, s => (s.ex || s.def) === 'db-row');
  const slot = p.days[0].slots[si];
  const base = app.resolveSlot(slot, 0, 1);
  assert.ok(base.sets.length >= 2 && plainCount(base.sets) === base.sets.length, 'calibrated accessory, plain sets');
  assert.deepStrictEqual(app.resolveSlot(slot, 0, 1), base, 'deterministic without setAdj');

  slot.setAdj = 1;
  const up = app.resolveSlot(slot, 0, 1).sets;
  assert.strictEqual(up.length, base.sets.length + 1);
  const last = base.sets[base.sets.length - 1];
  assert.deepStrictEqual(up[up.length - 1], Object.assign({}, last, { note: null, noteKey: null, noteParams: null }));

  slot.setAdj = -1;
  assert.strictEqual(app.resolveSlot(slot, 0, 1).sets.length, base.sets.length - 1);
  slot.setAdj = -20;
  assert.strictEqual(app.resolveSlot(slot, 0, 1).sets.length, 1, 'never below one plain set');

  delete slot.setAdj;
  assert.deepStrictEqual(app.resolveSlot(slot, 0, 1), base, 'absent again: identical');
});

test('resolveSlot: a main with a trailing AMRAP keeps the AMRAP last', () => {
  const p = freshProgram();
  const si = slotIdx(p, s => s.type === 'main');
  const slot = p.days[0].slots[si];
  const base = app.resolveSlot(slot, 0, 3).sets;
  assert.ok(base[base.length - 1].amrap, 'week 4 ends on the AMRAP');
  const plain = plainCount(base);

  slot.setAdj = 2;
  const up = app.resolveSlot(slot, 0, 3).sets;
  assert.strictEqual(up.length, base.length + 2);
  assert.ok(up[up.length - 1].amrap, 'AMRAP still last');
  assert.strictEqual(plainCount(up), plain + 2);
  assert.strictEqual(up.filter(s => s.amrap).length, 1);

  slot.setAdj = -1;
  const down = app.resolveSlot(slot, 0, 3).sets;
  assert.strictEqual(down.length, base.length - 1);
  assert.ok(down[down.length - 1].amrap, 'AMRAP still last');
  assert.strictEqual(plainCount(down), plain - 1);
});

test('applySlotSetAdj: added sets carry no finisher; a removed finisher is re-placed', () => {
  const sets = [{ weight: 40, reps: 10 }, { weight: 40, reps: 10 }, { weight: 40, reps: 10, technique: 'drop', drops: [{ weight: 32.5, reps: 10 }] }];
  const up = app.applySlotSetAdj({ setAdj: 1 }, sets.slice());
  assert.strictEqual(up.length, 4);
  assert.strictEqual(up[2].technique, 'drop', 'finisher stays where the coach put it');
  assert.ok(!('technique' in up[3]) && !('drops' in up[3]), 'the added set is a plain straight set');
  let reTeched = 0;
  const down = app.applySlotSetAdj({ setAdj: -1 }, sets.slice(), s => {
    reTeched++;
    return s.map((x, i) => i === s.length - 1 ? Object.assign({}, x, { technique: 'drop' }) : x);
  });
  assert.strictEqual(down.length, 2);
  assert.strictEqual(reTeched, 1);
  assert.strictEqual(down[1].technique, 'drop', 'finisher moved to the new last working set');
  assert.strictEqual(app.applySlotSetAdj({}, sets), sets, 'no setAdj: same array back');
});

// ------------------------------------------------------------
// live session
// ------------------------------------------------------------
test('adding a set keeps logged sets and inserts one unlogged plain set; twice gives two', () => {
  const p = freshProgram();
  p.pointer.week = 3; // main ends on an AMRAP
  const dr = startDraft(0);
  const ei = dr.entries.findIndex(e => e.isMain);
  const e = dr.entries[ei];
  const n = e.sets.length;
  const logged = Object.assign(e.sets[0], { done: true, weight: 60, reps: 10, rpe: 8 });
  const loggedCopy = JSON.parse(JSON.stringify(logged));

  app.addSessionSet(ei);
  assert.strictEqual(e.sets.length, n + 1);
  assert.strictEqual(e.sets[0], logged, 'logged set is the same object');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(e.sets[0])), loggedCopy, 'and unchanged');
  assert.ok(e.sets[e.sets.length - 1].amrap, 'AMRAP still last');
  const added = e.sets[e.sets.length - 2];
  assert.ok(!added.done && !added.amrap && !added.technique && added.weight == null);
  const slot = p.days[0].slots[e.si];
  assert.strictEqual(slot.setAdj, 1);
  assert.deepStrictEqual(e.sets.map(targets), freshEntrySets(0, e.si).map(targets),
    'the live entry matches what a fresh session would prescribe');

  app.addSessionSet(ei);
  assert.strictEqual(e.sets.length, n + 2);
  assert.strictEqual(slot.setAdj, 2);
  assert.deepStrictEqual(e.sets.map(targets), freshEntrySets(0, e.si).map(targets));
  assert.strictEqual(app.S.draft, app.V.draft, 'persisted');
});

test('removing a logged set then Undo restores it exactly (records untouched)', () => {
  const p = freshProgram();
  const dr = startDraft(0);
  const ei = dr.entries.findIndex(e => e.exId === 'db-row');
  const e = dr.entries[ei];
  const n = e.sets.length;
  assert.ok(n >= 2);
  const st = Object.assign(e.sets[1], { done: true, weight: 30, reps: 12, rpe: 8.5, pump: 2 });
  const copy = JSON.parse(JSON.stringify(st));
  const recs = app.recordsFor('db-row').length;

  app.removeSessionSet(ei, 1);
  assert.strictEqual(e.sets.length, n - 1);
  assert.ok(!e.sets.includes(st));
  const slot = p.days[0].slots[e.si];
  assert.strictEqual(slot.setAdj, -1);
  assert.strictEqual(app.recordsFor('db-row').length, recs, 'like clearPerf: the record stays');

  app.undoRemoveSet();
  assert.strictEqual(e.sets.length, n);
  assert.strictEqual(e.sets[1], st, 'same set back at its position');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(e.sets[1])), copy, 'logged data intact');
  assert.ok(!('setAdj' in slot), 'setAdj back to zero (field deleted)');
  app.undoRemoveSet(); // a second Undo is a no-op
  assert.strictEqual(e.sets.length, n);
});

test('the last plain set and special sets cannot be removed', () => {
  const p = freshProgram();
  p.pointer.week = 3;
  const dr = startDraft(0);
  const ei = dr.entries.findIndex(e => e.isMain);
  const e = dr.entries[ei];
  const amrapIdx = e.sets.findIndex(s => s.amrap);
  assert.strictEqual(app.canRemoveDraftSet(e, amrapIdx), false, 'AMRAP is not removable');
  while (plainCount(e.sets) > 1) app.removeSessionSet(ei, 0);
  const before = e.sets.length;
  const only = e.sets.findIndex(app.isPlainSet);
  assert.strictEqual(app.canRemoveDraftSet(e, only), false);
  app.removeSessionSet(ei, only);
  app.removeLastSessionSet(ei);
  assert.strictEqual(e.sets.length, before, 'nothing removed');
  assert.strictEqual(app.lastRemovableSetIdx(e), -1);
});

test('"−" removes the last unlogged plain set, else the last plain set', () => {
  freshProgram();
  const dr = startDraft(0);
  const ei = dr.entries.findIndex(e => e.isMain);
  const e = dr.entries[ei];
  app.addSessionSet(ei); // 4 plain sets
  const last = e.sets.length - 1;
  e.sets[last].done = true;
  assert.strictEqual(app.lastRemovableSetIdx(e), last - 1, 'skips the logged last set');
  e.sets.forEach(s => { s.done = true; });
  assert.strictEqual(app.lastRemovableSetIdx(e), last, 'all logged: the last plain set');
});

test('removing the finisher set moves the finisher to the new last working set; Undo puts it back', () => {
  freshProgram();
  const dr = startDraft(0);
  const ei = dr.entries.findIndex(e => e.exId === 'db-row');
  const e = dr.entries[ei];
  const last = e.sets.length - 1;
  Object.assign(e.sets[last], { technique: 'drop', dropTargets: [{ weight: 22.5, reps: 12 }] });
  const fin = e.sets[last];
  app.removeSessionSet(ei, last);
  assert.strictEqual(app.entryTech(e), 'drop', 'finisher kept on the exercise');
  assert.strictEqual(e.sets[e.sets.length - 1].technique, 'drop', 'on the new last working set');
  assert.ok(e.sets[e.sets.length - 1].dropTargets);
  app.undoRemoveSet();
  assert.strictEqual(e.sets[last], fin);
  assert.strictEqual(e.sets.filter(s => s.technique).length, 1, 'one finisher, on its original set');
  assert.strictEqual(e.sets[last - 1].technique, null);
});

test('calibration week: ＋ still adds a plain set today and records setAdj', () => {
  const p = freshProgram({ uncalibrated: true });
  const dr = startDraft(0);
  const ei = dr.entries.findIndex(e => e.isMain);
  const e = dr.entries[ei];
  assert.ok(e.sets.every(s => s.calib), 'all calibration sets');
  const n = e.sets.length;
  const src = e.sets[n - 1];
  app.addSessionSet(ei);
  assert.strictEqual(e.sets.length, n + 1);
  const added = e.sets[n];
  assert.ok(!added.calib && !added.amrap && !added.ramp && !added.done);
  assert.strictEqual(added.targetReps, src.targetReps);
  assert.strictEqual(added.targetWeight, src.targetWeight);
  assert.strictEqual(p.days[0].slots[e.si].setAdj, 1);
  // The calibration sets themselves are still not removable; the added one is
  // the only plain set, so it is not removable either.
  assert.strictEqual(app.lastRemovableSetIdx(e), -1);
  // resolveSlot has nothing plain to clone this week, so the prescription is
  // the calibration ramp; the set applies on later plain weeks.
  assert.strictEqual(app.resolveSlot(p.days[0].slots[e.si], dr.b, dr.w).sets.length, n);
});

// ------------------------------------------------------------
// lifetime
// ------------------------------------------------------------
test('setAdj is cleared at block end and on a swap; templates do not carry it', () => {
  for (const track of ['powerbuilding', 'bodybuilding']) {
    const p = freshProgram({ track });
    p.days.forEach(d => d.slots.forEach(sl => { sl.setAdj = 1; }));
    assert.ok(!JSON.stringify(app.programTemplate()).includes('setAdj'), 'export never carries it');
    app.endBlock(0, track === 'bodybuilding');
    assert.ok(p.days.every(d => d.slots.every(sl => !('setAdj' in sl))), `${track}: cleared at block end`);
    assert.ok(app.S.program.days.every(d => d.slots.every(sl => !('setAdj' in sl))));
  }
  const p = freshProgram();
  const si = slotIdx(p, s => (s.ex || s.def) === 'db-row');
  p.days[0].slots[si].setAdj = 2;
  app.doSwap(0, si, 'db-row'); // same lift: kept
  assert.strictEqual(p.days[0].slots[si].setAdj, 2);
  app.doSwap(0, si, 'cable-row');
  assert.ok(!('setAdj' in p.days[0].slots[si]), 'a different lift starts clean');
});

// ------------------------------------------------------------
// preview + tag
// ------------------------------------------------------------
test('preview controls change the count (no draft) and route through the draft when live', () => {
  const p = freshProgram();
  const si = slotIdx(p, s => (s.ex || s.def) === 'db-row');
  const slot = p.days[0].slots[si];
  const count = () => app.resolveSlot(slot, p.pointer.block, p.pointer.week).sets.length;
  const n = count();
  app.previewSetAdj(0, si, 1);
  assert.strictEqual(slot.setAdj, 1);
  assert.strictEqual(count(), n + 1);
  app.previewSetAdj(0, si, -1);
  assert.ok(!('setAdj' in slot));
  assert.strictEqual(count(), n);
  for (let k = 0; k < 10; k++) app.previewSetAdj(0, si, -1);
  assert.strictEqual(count(), 1, 'stops at one plain set');
  assert.strictEqual(slot.setAdj, 1 - n, 'and does not keep counting down');
  delete slot.setAdj;

  const dr = startDraft(0);
  const e = dr.entries.find(x => x.si === si);
  const m = e.sets.length;
  app.previewSetAdj(0, si, 1);
  assert.strictEqual(e.sets.length, m + 1, 'live entry follows');
  assert.strictEqual(slot.setAdj, 1);
  app.previewSetAdj(0, si, -1);
  assert.strictEqual(e.sets.length, m);
  assert.ok(!('setAdj' in slot));
});

test('the overview tag reads +n / -n sets in both languages', () => {
  assert.strictEqual(app.setAdjTagHTML({}), '');
  assert.ok(app.setAdjTagHTML({ setAdj: 1 }).includes(app.t('setadj.adj_plus_one', { n: 1 })));
  assert.ok(app.setAdjTagHTML({ setAdj: -2 }).includes(app.t('setadj.adj_minus_other', { n: 2 })));
  const en = app.I18N.catalogs.en.strings, es = app.I18N.catalogs.es.strings;
  for (const k of Object.keys(en).filter(k => k.startsWith('setadj.'))) {
    assert.ok(es[k], `es has ${k}`);
    assert.ok(!/—/.test(en[k] + es[k]), `${k}: no em dash`);
  }
});

// ------------------------------------------------------------
// jsdom: the nested swipe
// ------------------------------------------------------------
if (NODE_MAJOR < 20) {
  test('set-row swipe (skipped: jsdom requires Node >= 20)', { skip: true }, () => {});
} else {
  test('a swipe on a set row opens that row only; a swipe elsewhere still opens the card', () => {
    const { loadDom } = require('./load-dom');
    const ctx = loadDom();
    const { app: a, document: d, window: w } = ctx;
    a.S = a.defaultState();
    a.V = { view: 'dashboard', tab: 'dashboard', dayIdx: null, libTab: 'alpha', libSearch: '',
      obStep: 0, ob: null, checkinStep: 0, checkinData: null, draft: null };
    a.S.program = a.makeProgram({ daysPerWeek: 4, track: 'powerbuilding', timeMode: 'unlimited',
      experience: 'intermediate', muscleFocus: { ...FOCUS }, maxes: { ...MAXES } });
    a.startCheckin(0); a.beginSession();
    const html = d.getElementById('app').innerHTML;
    assert.ok(html.includes(a.t('setadj.add')), 'the card has ＋ Add set');

    // Inline handlers do not run in jsdom: wire both levels by hand.
    const wrap = d.querySelector('.ex-swipe.live');
    wrap.addEventListener('pointerdown', e => a.exSwipeDown(e, 0, +wrap.dataset.si));
    const rows = [...wrap.querySelectorAll('.set-swipe')];
    assert.ok(rows.length >= 2, 'plain set rows are swipeable');
    rows.forEach(r => r.addEventListener('pointerdown', e => a.setSwipeDown(e)));
    const PE = w.PointerEvent || w.MouseEvent;
    const ev = (type, x, y) => new PE(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    const swipe = (el, y) => {
      el.dispatchEvent(ev('pointerdown', 300, y));
      d.dispatchEvent(ev('pointermove', 270, y + 1));
      d.dispatchEvent(ev('pointermove', 190, y + 2));
      d.dispatchEvent(ev('pointerup', 190, y + 2));
    };
    const btn = rows[1].querySelector('button.perf');
    let clicks = 0;
    btn.addEventListener('click', () => clicks++);

    swipe(btn, 200);
    btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
    assert.ok(rows[1].classList.contains('open'), 'the row opens');
    assert.ok(!wrap.classList.contains('open'), 'the card does not');
    assert.ok(!rows[0].classList.contains('open'));
    assert.strictEqual(clicks, 0, 'the click after the swipe is eaten');
    assert.ok(rows[1].querySelector('.set-remove'), 'its own Remove? is there');

    // A vertical drag on a row scrolls (nothing opens).
    rows[0].querySelector('.set-row').dispatchEvent(ev('pointerdown', 300, 100));
    d.dispatchEvent(ev('pointermove', 302, 160));
    d.dispatchEvent(ev('pointerup', 302, 160));
    assert.ok(!rows[0].classList.contains('open'));
    assert.ok(!rows[1].classList.contains('open'), 'touching another row closes the open one');

    // A swipe that starts on the card title opens the card.
    swipe(wrap.querySelector('h3'), 50);
    assert.ok(wrap.classList.contains('open'), 'the card opens');
    assert.ok(rows.every(r => !r.classList.contains('open')));

    // Tapping the Remove? of a row removes that set (via the real handler).
    const ei = 0;
    const n = a.V.draft.entries[ei].sets.length;
    a.removeSessionSet(ei, 1);
    assert.strictEqual(a.V.draft.entries[ei].sets.length, n - 1);
    assert.ok(d.getElementById('toast-root').textContent.includes(a.t('common.undo')), 'Undo toast');
    a.undoRemoveSet();
    assert.strictEqual(a.V.draft.entries[ei].sets.length, n);
  });

  test('preview modal: ＋/− re-render the count and the overview shows the tag', () => {
    const { loadDom } = require('./load-dom');
    const ctx = loadDom();
    const { app: a, document: d } = ctx;
    a.S = a.defaultState();
    a.V = { view: 'workout', tab: 'workout', dayIdx: 0, libTab: 'alpha', libSearch: '',
      obStep: 0, ob: null, checkinStep: 0, checkinData: null, draft: null };
    a.S.program = a.makeProgram({ daysPerWeek: 4, track: 'powerbuilding', timeMode: 'unlimited',
      experience: 'intermediate', muscleFocus: { ...FOCUS }, maxes: { ...MAXES } });
    a.render();
    a.openPreview(0);
    const modal = () => d.getElementById('modal-root').innerHTML;
    assert.ok(modal().includes(a.t('setadj.add')) && modal().includes(a.t('setadj.remove')));
    const si = a.S.program.days[0].slots.findIndex(s => s.type === 'main');
    const rows = () => d.getElementById('modal-root').querySelectorAll('.lift-card')[0].querySelectorAll('.set-row').length;
    const n = rows();
    a.previewSetAdj(0, si, 1);
    assert.strictEqual(rows(), n + 1, 'preview re-rendered with the new count');
    assert.ok(modal().includes(a.t('setadj.adj_plus_one', { n: 1 })), 'tag in the preview');
    assert.ok(d.getElementById('app').innerHTML.includes(a.t('setadj.adj_plus_one', { n: 1 })), 'tag on the overview card');
  });

  test('superset card: each member has ＋/− set controls', () => {
    const { loadDom } = require('./load-dom');
    const ctx = loadDom();
    const { app: a, document: d } = ctx;
    a.S = a.defaultState();
    a.V = { view: 'dashboard', tab: 'dashboard', dayIdx: null, libTab: 'alpha', libSearch: '',
      obStep: 0, ob: null, checkinStep: 0, checkinData: null, draft: null };
    a.S.program = a.makeProgram({ daysPerWeek: 4, track: 'bodybuilding', timeMode: 'unlimited',
      experience: 'intermediate', muscleFocus: { ...FOCUS }, maxes: { ...MAXES } });
    const slots = a.S.program.days[0].slots;
    slots.push({ type: 'acc', cat: 'bicep', ex: 'db-curl', added: true, superset: true });
    slots.push({ type: 'acc', cat: 'bicep', ex: 'hammer-curl', added: true });
    a.S.records['db-curl'] = [{ ts: Date.now(), weight: 14, reps: 12, rpe: 8 }]; // calibrated: plain sets
    a.startCheckin(0); a.beginSession();
    const card = d.querySelector('.superset-group');
    assert.ok(card, 'superset card rendered');
    const curl = a.V.draft.entries.findIndex(e => e.exId === 'db-curl');
    const name = a.V.draft.entries[curl].name;
    assert.ok(card.querySelector(`button[aria-label="${a.t('setadj.add_a11y', { name })}"]`), 'labelled ＋');
    assert.ok(card.querySelector(`button[aria-label="${a.t('setadj.remove_a11y', { name })}"]`), 'labelled −');
    const n = a.V.draft.entries[curl].sets.length;
    assert.ok(a.V.draft.entries[curl].sets.every(s => !s.calib && !s.amrap && !s.ramp), 'plain sets');
    a.addSessionSet(curl);
    assert.strictEqual(a.V.draft.entries[curl].sets.length, n + 1);
    a.removeLastSessionSet(curl);
    assert.strictEqual(a.V.draft.entries[curl].sets.length, n);
    // The uncalibrated partner (all calibration sets) has nothing removable: − is disabled.
    const ham = a.V.draft.entries.find(e => e.exId === 'hammer-curl');
    const minus = d.querySelector(`button[aria-label="${a.t('setadj.remove_a11y', { name: ham.name })}"]`);
    assert.ok(minus && minus.disabled);
  });
}

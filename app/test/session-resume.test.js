/* ============================================================
   IRONWAVE — test/session-resume.test.js
   Session quality of life:
   - the in-progress workout (V.draft) persists as the optional S.draft
     through save(), is validated on restore (draftIsValid), and is gone
     after finishSession;
   - syncDraftSlots keeps the live session in step with the day's slots
     (reorder / remove / add) without touching logged sets;
   - remove + undo mid-session restores the entry exactly, in place;
   - main lifts are removable and the day still resolves and renders;
   - jsdom: the session shows "Add exercise", the overview shows
     "Resume workout" while a draft exists.
   Engine-side through test/load-app.js, views through test/load-dom.js.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp } = require('./load-app');

const app = loadApp();
const NODE_MAJOR = Number(process.versions.node.split('.')[0]);
const DEFAULT_FOCUS = { arms: 2, chest: 2, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 2 };

function freshProgram(track = 'powerbuilding') {
  app.S = app.defaultState();
  app.S.program = app.makeProgram({
    daysPerWeek: 4, track, timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  });
  return app.S.program;
}
// A draft the way beginSession builds one.
function startDraft(di = 0) {
  const p = app.S.program;
  const b = p.pointer.block, w = p.pointer.week;
  const entries = app.resolveDayEntries(di, b, w).items.map(x => app.applyInjuryEasing(app.sessionEntryFrom(x), []));
  app.V = { view: 'session', tab: 'workout', dayIdx: di, draft: { id: 's1', ts: 1, b, w, d: di, entries,
    sleepHours: 7.5, mindset: '', sliders: {} } };
  return app.V.draft;
}
function logSet(e, j, weight = 50) {
  Object.assign(e.sets[j], { done: true, weight, reps: 5, rpe: 8 });
  return e.sets[j];
}

// ------------------------------------------------------------
// persistence
// ------------------------------------------------------------
test('save() mirrors the draft into S.draft and drops it after finishSession', () => {
  freshProgram();
  const dr = startDraft(0);
  logSet(dr.entries[0], 0);
  app.save();
  assert.strictEqual(app.S.draft, dr, 'draft written into the stored state');
  const json = JSON.parse(JSON.stringify(app.S));
  assert.strictEqual(json.draft.entries[0].sets[0].done, true, 'logged set survives serialization');

  const before = app.S.sessions.length;
  app.finishSession();
  assert.ok(!('draft' in app.S), 'no draft left behind after finishing');
  assert.strictEqual(app.V.draft, null);
  assert.strictEqual(app.S.sessions.length, before + 1);
  const s = app.S.sessions[app.S.sessions.length - 1];
  assert.deepStrictEqual(Object.keys(s).sort(),
    ['b', 'd', 'entries', 'id', 'mindset', 'rating', 'readiness', 'sleepHours', 'sliders', 'tonnage', 'ts', 'w'],
    'session record keeps its shape');
  assert.ok(s.entries.every(e => !('notesOpen' in e)));
});

test('save() with no draft leaves no draft field', () => {
  freshProgram();
  app.V = { draft: null };
  app.S.draft = { stale: true };
  app.save();
  assert.ok(!('draft' in app.S));
});

test('draftIsValid accepts a matching draft and rejects stale ones', () => {
  const p = freshProgram();
  const dr = startDraft(1);
  assert.strictEqual(app.draftIsValid(dr, app.S), true);
  assert.strictEqual(app.draftIsValid(null, app.S), false);
  assert.strictEqual(app.draftIsValid(Object.assign({}, dr, { d: 99 }), app.S), false, 'missing day');
  assert.strictEqual(app.draftIsValid(Object.assign({}, dr, { w: dr.w + 1 }), app.S), false, 'different week');
  assert.strictEqual(app.draftIsValid(Object.assign({}, dr, { b: dr.b + 1 }), app.S), false, 'different block');
  p.completedDays[`${dr.b}-${dr.w}-${dr.d}`] = 'skipped';
  assert.strictEqual(app.draftIsValid(dr, app.S), false, 'completed (skipped) day');
  p.completedDays[`${dr.b}-${dr.w}-${dr.d}`] = 's0';
  assert.strictEqual(app.draftIsValid(dr, app.S), false, 'completed day');
  assert.strictEqual(app.draftIsValid(dr, { program: null }), false, 'no program');
});

test('skipping the draft day and advancing the week clear the draft', () => {
  freshProgram();
  startDraft(0);
  app.doSkipWorkout(0);
  assert.strictEqual(app.V.draft, null);
  assert.ok(!('draft' in app.S));

  freshProgram();
  startDraft(1);
  app.doSkipWorkout(0); // a different day keeps the workout in progress
  assert.ok(app.V.draft && app.V.draft.d === 1);
  app.advanceWeek();
  assert.strictEqual(app.V.draft, null, 'week advance drops it');
  assert.ok(!('draft' in app.S));
});

test('abandonSession keeps the draft and lands on its day', () => {
  freshProgram();
  const dr = startDraft(2);
  app.V.dayIdx = null;
  app.abandonSession();
  assert.strictEqual(app.V.draft, dr);
  assert.strictEqual(app.V.dayIdx, 2);
  assert.strictEqual(app.V.view, 'workout');
  assert.strictEqual(app.S.draft, dr);
});

// ------------------------------------------------------------
// syncDraftSlots
// ------------------------------------------------------------
test('syncDraftSlots: logged sets survive a reorder', () => {
  const p = freshProgram();
  const dr = startDraft(0);
  const first = dr.entries[0], last = dr.entries[dr.entries.length - 1];
  const s0 = logSet(first, 0), s1 = logSet(last, 0, 20);
  first.notes = 'felt fast';
  const n = p.days[0].slots.length;
  const order = [...Array(n).keys()].reverse();
  app.commitReorder(0, order);
  const now = app.V.draft.entries;
  assert.strictEqual(now[now.length - 1], first, 'first entry moved to the end, same object');
  assert.strictEqual(now[0], last);
  assert.strictEqual(first.sets[0], s0);
  assert.strictEqual(last.sets[0], s1);
  assert.strictEqual(first.notes, 'felt fast');
  // si follows the slot's new index
  for (const e of now) assert.strictEqual(p.days[0].slots[e.si] && app.resolveSlot(p.days[0].slots[e.si], dr.b, dr.w).exId, e.exId);
});

test('syncDraftSlots: removing another exercise keeps logged sets', () => {
  const p = freshProgram();
  const dr = startDraft(0);
  const keep = dr.entries[0];
  const logged = logSet(keep, 0);
  const victim = dr.entries[1];
  const count = dr.entries.length;
  p.days[0].slots.splice(victim.si, 1);
  app.syncDraftSlots(0);
  assert.strictEqual(app.V.draft.entries.length, count - 1);
  assert.ok(!app.V.draft.entries.includes(victim));
  assert.strictEqual(app.V.draft.entries[0], keep);
  assert.strictEqual(keep.sets[0], logged);
});

test('syncDraftSlots: an add appends a fresh entry', () => {
  const p = freshProgram();
  const dr = startDraft(0);
  const logged = logSet(dr.entries[0], 0);
  const count = dr.entries.length;
  p.days[0].slots.push({ type: 'acc', cat: 'bicep', ex: 'db-curl', added: true });
  app.syncDraftSlots(0);
  const now = app.V.draft.entries;
  assert.strictEqual(now.length, count + 1);
  assert.strictEqual(now[0].sets[0], logged);
  assert.strictEqual(now[now.length - 1].exId, 'db-curl');
  assert.ok(now[now.length - 1].sets.length > 0 && now[now.length - 1].sets.every(s => !s.done));
});

test('syncDraftSlots is a no-op for another day or no draft', () => {
  freshProgram();
  const dr = startDraft(0);
  const entries = dr.entries;
  app.syncDraftSlots(1);
  assert.strictEqual(app.V.draft.entries, entries);
  app.V = { draft: null };
  app.syncDraftSlots(0); // must not throw
});

// ------------------------------------------------------------
// remove / undo / add during a session
// ------------------------------------------------------------
test('remove then undo in a session restores the entry with its sets, in place', () => {
  const p = freshProgram();
  const dr = startDraft(0);
  const ei = 1;
  const target = dr.entries[ei];
  const logged = logSet(target, 0, 40);
  target.notes = 'grip slipping';
  const other = dr.entries[0];
  const otherLogged = logSet(other, 0);
  const slotsBefore = p.days[0].slots.length;
  app.removeSlot(0, target.si);
  assert.strictEqual(p.days[0].slots.length, slotsBefore - 1);
  assert.ok(!app.V.draft.entries.includes(target), 'gone from the live session');
  assert.strictEqual(app.V.draft.entries[0].sets[0], otherLogged);
  app.undoRemove();
  assert.strictEqual(p.days[0].slots.length, slotsBefore);
  assert.strictEqual(app.V.draft.entries[ei], target, 'back at its original position');
  assert.strictEqual(target.sets[0], logged);
  assert.strictEqual(target.notes, 'grip slipping');
  assert.strictEqual(app.V.draft.entries[0].sets[0], otherLogged);
  assert.strictEqual(app.S.draft, app.V.draft, 'persisted');
});

test('a main lift can be removed; the day still resolves', () => {
  const p = freshProgram();
  const si = p.days[0].slots.findIndex(s => s.type === 'main');
  assert.ok(si >= 0, 'day 0 has a main');
  const lift = p.days[0].slots[si].lift;
  const wm = p.wm[lift];
  app.V = { draft: null, view: 'workout', dayIdx: 0 };
  app.removeSlot(0, si);
  assert.ok(!p.days[0].slots.some(s => s.type === 'main'));
  const built = app.resolveDayEntries(0, p.pointer.block, p.pointer.week);
  assert.ok(Array.isArray(built.items));
  assert.ok(built.items.every(x => !x.rs.isMain));
  assert.strictEqual(p.wm[lift], wm, 'working max untouched');
  assert.ok(Array.isArray(app.checkinGroupsForDay(p.days[0])));
  // Removing every slot leaves an empty but valid live session.
  startDraft(0);
  while (p.days[0].slots.length) app.removeSlot(0, 0);
  assert.deepStrictEqual(app.V.draft.entries, []);
});

test('adding an exercise during a session appends an entry and keeps logged sets', () => {
  const p = freshProgram();
  const dr = startDraft(0);
  const logged = logSet(dr.entries[0], 0);
  const count = dr.entries.length;
  app.V.addTarget = 0;
  app.doAddExercise('db-curl');
  assert.strictEqual(p.days[0].slots[p.days[0].slots.length - 1].ex, 'db-curl');
  assert.strictEqual(app.V.draft.entries.length, count + 1);
  assert.strictEqual(app.V.draft.entries[count].exId, 'db-curl');
  assert.strictEqual(app.V.draft.entries[0].sets[0], logged);
  assert.strictEqual(app.S.draft, app.V.draft);
});

test('removing a superset tail does not chain the group onto the next accessory', () => {
  const p = freshProgram('bodybuilding');
  app.V = { draft: null, view: 'workout', dayIdx: 0 };
  for (const ex of ['db-curl', 'hammer-curl', 'db-curl']) p.days[0].slots.push({ type: 'acc', cat: 'bicep', ex, added: true });
  const order = app.accessorySiOrder(0, p.pointer.block, p.pointer.week);
  assert.ok(order.length >= 3, 'day 0 has three accessories');
  const [a, b] = order.slice(-3);
  app.toggleSuperset(0, a);
  const head = p.days[0].slots[a];
  assert.strictEqual(head.superset, true);
  startDraft(0);
  app.removeSlot(0, b);
  assert.strictEqual(head.superset, false, 'link broken with its tail gone');
  assert.ok(app.V.draft.entries.every(e => !e.superset), 'live session regrouped');
  app.undoRemove();
  assert.strictEqual(head.superset, true, 'undo relinks');
  assert.ok(app.V.draft.entries.some(e => e.superset && e.supersetRole === 'head'));
});

// ------------------------------------------------------------
// views (jsdom)
// ------------------------------------------------------------
if (NODE_MAJOR < 20) {
  test('session views (skipped: jsdom requires Node >= 20)', { skip: true }, () => {});
} else {
  const domFresh = (track = 'powerbuilding') => {
    const { loadDom } = require('./load-dom');
    const ctx = loadDom();
    const s = ctx.app.defaultState();
    ctx.app.S = s;
    ctx.app.V = { view: 'dashboard', tab: 'dashboard', dayIdx: null, libTab: 'alpha', libSearch: '',
      obStep: 0, ob: null, checkinStep: 0, checkinData: null, draft: null };
    s.program = ctx.app.makeProgram({ daysPerWeek: 4, track, timeMode: 'unlimited',
      muscleFocus: { ...DEFAULT_FOCUS }, maxes: {} });
    return ctx;
  };
  const html = ctx => ctx.document.getElementById('app').innerHTML;

  for (const track of ['powerbuilding', 'bodybuilding']) {
    test(`${track}: session shows Add exercise and swipeable cards; overview shows Resume`, () => {
      const ctx = domFresh(track);
      const { app: a, document } = ctx;
      a.startCheckin(0);
      a.beginSession();
      assert.strictEqual(a.V.view, 'session');
      const add = a.t('workout.add_exercise');
      assert.ok(html(ctx).includes(add), 'session has the add button');
      assert.ok(document.querySelector('.ex-swipe.live .ex-remove'), 'a session card has the remove action');
      assert.ok(html(ctx).includes(a.t('workout.remove_q')));
      a.abandonSession();
      assert.strictEqual(a.V.view, 'workout');
      assert.ok(html(ctx).includes(a.t('workout.resume')), 'overview offers Resume');
      assert.ok(!html(ctx).includes(a.t('workout.start_training')), 'no fresh start while in progress');
      assert.ok(html(ctx).includes(a.t('workout.discard_draft')));
      // Mains are swipeable on the overview too.
      const mainSi = a.S.program.days[0].slots.findIndex(s => s.type === 'main');
      if (mainSi >= 0) assert.ok(document.querySelector(`.ex-swipe[data-si="${mainSi}"]`), 'main lift is removable');
      // Dashboard marks the day in progress.
      a.V.view = 'dashboard'; a.render();
      assert.ok(html(ctx).includes(a.t('dash.in_progress')));
      a.resumeSession();
      assert.strictEqual(a.V.view, 'session');
    });
  }

  test('boot reopens a stored valid draft on the session view, and drops a stale one', async () => {
    for (const stale of [false, true]) {
      const ctx = domFresh();
      const a = ctx.app;
      a.startCheckin(1);
      a.beginSession();
      a.V.draft.entries[0].sets[0].done = true;
      a.save();
      const stored = JSON.parse(JSON.stringify(a.S));
      assert.ok(stored.draft, 'draft persisted');
      if (stale) stored.program.completedDays[`${stored.draft.b}-${stored.draft.w}-${stored.draft.d}`] = 'skipped';
      ctx.window.localStorage.setItem('ironwave-state', JSON.stringify(stored));
      a.V = null; a.S = null;
      await a.boot();
      if (stale) {
        assert.strictEqual(a.V.draft, null);
        assert.ok(!('draft' in a.S));
        assert.strictEqual(a.V.view, 'dashboard');
      } else {
        assert.strictEqual(a.V.view, 'session');
        assert.strictEqual(a.V.draft.d, 1);
        assert.strictEqual(a.V.draft.entries[0].sets[0].done, true, 'logged set restored');
      }
    }
  });

  test('a day with its main and secondary removed renders, checks in and starts', () => {
    const ctx = domFresh();
    const a = ctx.app;
    const day = a.S.program.days[0];
    for (let si = day.slots.length - 1; si >= 0; si--) {
      if (day.slots[si].type === 'main' || day.slots[si].type === 'secondary') a.removeSlot(0, si);
    }
    assert.ok(!day.slots.some(s => s.type === 'main' || s.type === 'secondary'));
    a.V.view = 'workout'; a.V.dayIdx = 0; a.render();
    assert.ok(html(ctx).includes(a.t('workout.overview')), 'overview rendered (no error screen)');
    a.startCheckin(0);
    a.beginSession();
    assert.strictEqual(a.V.view, 'session');
    assert.ok(html(ctx).includes(a.t('session.finish_workout')), 'session rendered');
  });

  test('removing every exercise mid-session still renders the session', () => {
    const ctx = domFresh();
    const a = ctx.app;
    a.startCheckin(0);
    a.beginSession();
    while (a.S.program.days[0].slots.length) a.removeSlot(0, 0);
    a.render();
    assert.ok(html(ctx).includes(a.t('session.no_exercises')));
    a.abandonSession();
    assert.ok(html(ctx).includes(a.t('workout.resume')));
  });
}

// ------------------------------------------------------------
// The swipe gesture on a live session card (pointer events in jsdom; inline
// handlers do not run there, so the wrapper's pointerdown is wired by hand).
// ------------------------------------------------------------
if (NODE_MAJOR >= 20) {
  test('session swipe: a left swipe from a set button reveals Remove? and eats the click; taps still work', () => {
    const { loadDom } = require('./load-dom');
    const ctx = loadDom();
    const { app: a, document: d, window: w } = ctx;
    a.S = a.defaultState();
    a.V = { view: 'dashboard', tab: 'dashboard', dayIdx: null, libTab: 'alpha', libSearch: '',
      obStep: 0, ob: null, checkinStep: 0, checkinData: null, draft: null };
    a.S.program = a.makeProgram({ daysPerWeek: 4, track: 'powerbuilding', timeMode: 'unlimited',
      muscleFocus: { ...DEFAULT_FOCUS }, maxes: {} });
    a.startCheckin(0); a.beginSession();
    const PE = w.PointerEvent || w.MouseEvent;
    const ev = (type, x, y) => new PE(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
    const wraps = [...d.querySelectorAll('.ex-swipe.live')];
    assert.ok(wraps.length >= 2, 'needs two session cards');
    wraps.forEach(x => x.addEventListener('pointerdown', e => a.exSwipeDown(e, 0, +x.dataset.si)));
    const counter = wrap => {
      const b = wrap.querySelector('button.perf');
      const c = { b, n: 0 };
      b.addEventListener('click', () => c.n++);
      return c;
    };
    const c0 = counter(wraps[0]), c1 = counter(wraps[1]);

    // Horizontal swipe that starts on the set button.
    c0.b.dispatchEvent(ev('pointerdown', 300, 100));
    d.dispatchEvent(ev('pointermove', 270, 102));
    d.dispatchEvent(ev('pointermove', 200, 103));
    d.dispatchEvent(ev('pointerup', 200, 103));
    click(c0.b);
    assert.ok(wraps[0].classList.contains('open'), 'card opens');
    assert.strictEqual(c0.n, 0, 'the click after a swipe never reaches the set button');

    // A vertical drag on another card scrolls (no open) and closes the open one.
    c1.b.dispatchEvent(ev('pointerdown', 300, 300));
    d.dispatchEvent(ev('pointermove', 302, 360));
    d.dispatchEvent(ev('pointerup', 302, 360));
    assert.ok(!wraps[1].classList.contains('open'));
    assert.ok(!wraps[0].classList.contains('open'), 'touching another card closes the open one');

    // A plain tap still logs.
    c1.b.dispatchEvent(ev('pointerdown', 300, 300));
    d.dispatchEvent(ev('pointerup', 300, 300));
    click(c1.b);
    assert.strictEqual(c1.n, 1, 'a plain tap reaches the set button');
  });
}

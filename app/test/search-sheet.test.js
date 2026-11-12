/* ============================================================
   IRONWAVE — test/search-sheet.test.js
   The swap and add-exercise pickers render as a "search sheet" (full
   visible height, header + search field pinned, only the results
   scroll) so the on-screen keyboard cannot bury the results. Plain
   modals keep the ordinary bottom sheet. Also covers the visual
   viewport tracker that feeds --vvh / --vv-top to the modal layer.
   jsdom needs Node >= 20, so this file self-skips below that floor
   (same as render-smoke.test.js).
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

const NODE_MAJOR = Number(process.versions.node.split('.')[0]);
const DEFAULT_FOCUS = { arms: 2, chest: 2, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 2 };

function fresh(track) {
  const { loadDom } = require('./load-dom'); // lazy: only on Node >= 20
  const ctx = loadDom();
  const s = ctx.app.defaultState();
  ctx.app.S = s;
  ctx.app.V = {
    view: 'workout', tab: 'workout', dayIdx: 0,
    libTab: 'alpha', libSearch: '', obStep: 0, ob: null,
    checkinStep: 0, checkinData: null, draft: null,
  };
  s.program = ctx.app.makeProgram({
    daysPerWeek: 4, track: track || 'powerbuilding', timeMode: 'unlimited',
    muscleFocus: { ...DEFAULT_FOCUS }, maxes: {},
  });
  return ctx;
}

const modalRoot = ctx => ctx.document.getElementById('modal-root');

function assertSearchSheet(ctx, bodyId) {
  const root = modalRoot(ctx);
  const sheet = root.querySelector('.modal');
  assert.ok(sheet, 'a modal rendered');
  assert.ok(sheet.classList.contains('search-sheet'), 'picker uses the search-sheet variant');
  const input = sheet.querySelector('.sheet-search input.search-input');
  assert.ok(input, 'search input sits in the pinned .sheet-search block');
  const results = sheet.querySelector('.sheet-results');
  assert.ok(results, 'a scrolling results region exists');
  assert.ok(!results.contains(input), 'the search input is outside the scrolling results');
  assert.ok(results.querySelector('#' + bodyId), `#${bodyId} lives inside the results region`);
  assert.ok(results.querySelector('.filter-chips'), 'equipment chips scroll with the results');
  assert.strictEqual(input.getAttribute('enterkeyhint'), 'search');
  assert.strictEqual(input.getAttribute('autocomplete'), 'off');
  assert.strictEqual(input.getAttribute('autocorrect'), 'off');
  assert.strictEqual(input.getAttribute('autocapitalize'), 'off');
  assert.strictEqual(input.getAttribute('spellcheck'), 'false');
  assert.strictEqual(input.hasAttribute('autofocus'), false, 'the picker does not auto-focus the field');
  return { input, results };
}

if (NODE_MAJOR < 20) {
  test('search sheet (skipped: jsdom requires Node >= 20)', { skip: true }, () => {});
} else {
  test('swap picker renders as a search sheet; typing keeps the field and filters the list', () => {
    const ctx = fresh();
    const day = ctx.app.S.program.days[0];
    const si = day.slots.findIndex(sl => sl.type === 'acc') >= 0 ? day.slots.findIndex(sl => sl.type === 'acc') : 0;
    ctx.app.openSwap(0, si);
    const { input } = assertSearchSheet(ctx, 'swap-body');
    // jsdom (runScripts: 'outside-only') does not run inline handlers, so drive
    // what oninput does: only the results body re-renders, the very same input
    // node survives and keeps focus.
    assert.ok(/refreshSwapBody\(\)/.test(input.getAttribute('oninput')), 'oninput refreshes only the body');
    input.focus();
    ctx.app.refreshSwapBody();
    const after = modalRoot(ctx).querySelector('.sheet-search input.search-input');
    assert.strictEqual(after, input, 'the search input node is not replaced while typing');
    assert.strictEqual(ctx.document.activeElement, input, 'focus stays in the field');
    // Enter blurs the field so the keyboard closes. The handler only touches
    // `event` and `this`, so it can be run directly.
    const onkey = new ctx.window.Function('event', input.getAttribute('onkeydown'));
    const ev = new ctx.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    onkey.call(input, ev);
    assert.notStrictEqual(ctx.document.activeElement, input, 'Enter blurs the search field');
    assert.ok(ev.defaultPrevented, 'Enter does not submit anything');
    // Any other key leaves focus alone.
    input.focus();
    onkey.call(input, new ctx.window.KeyboardEvent('keydown', { key: 'a' }));
    assert.strictEqual(ctx.document.activeElement, input);
  });

  test('add-exercise picker renders as a search sheet', () => {
    const ctx = fresh();
    ctx.app.openAddExercise(0);
    const { input } = assertSearchSheet(ctx, 'add-body');
    assert.ok(/refreshAddBody\(\)/.test(input.getAttribute('oninput')), 'oninput refreshes only the body');
    input.focus();
    ctx.app.refreshAddBody();
    assert.strictEqual(modalRoot(ctx).querySelector('.sheet-search input.search-input'), input);
    assert.strictEqual(ctx.document.activeElement, input, 'focus stays in the field');
  });

  test('a plain modal (workout preview) keeps the ordinary bottom sheet', () => {
    const ctx = fresh();
    ctx.app.openPreview(0);
    const sheet = modalRoot(ctx).querySelector('.modal');
    assert.ok(sheet, 'preview modal rendered');
    assert.ok(!sheet.classList.contains('search-sheet'), 'preview is not a search sheet');
    assert.strictEqual(sheet.querySelector('.sheet-results'), null);
  });

  test('visual viewport tracker: no-op without visualViewport, sets the custom properties with one', () => {
    const ctx = fresh();
    const w = ctx.app;
    // jsdom has no visualViewport: must not throw, just report false.
    assert.strictEqual(ctx.window.visualViewport, undefined);
    assert.strictEqual(w.syncVisualViewport(), false);
    assert.strictEqual(w.initVisualViewport(), false);
    // A fake visual viewport, as on a phone with the keyboard open.
    const listeners = {};
    const fakeVV = {
      height: 412.4, offsetTop: 230.6,
      addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    };
    const fakeWin = {
      visualViewport: fakeVV, document: ctx.document,
      requestAnimationFrame: fn => fn(),
      addEventListener() {},
    };
    assert.strictEqual(w.initVisualViewport(fakeWin), true);
    const style = ctx.document.documentElement.style;
    assert.strictEqual(style.getPropertyValue('--vvh'), '412px');
    assert.strictEqual(style.getPropertyValue('--vv-top'), '231px');
    assert.ok(listeners.resize && listeners.scroll, 'listens to resize and scroll');
    // Keyboard closes: the next resize event updates the properties.
    fakeVV.height = 800; fakeVV.offsetTop = 0;
    listeners.resize[0]();
    assert.strictEqual(style.getPropertyValue('--vvh'), '800px');
    assert.strictEqual(style.getPropertyValue('--vv-top'), '0px');
  });

  test('boot() wires the tracker without throwing when visualViewport is missing', async () => {
    const ctx = fresh();
    await assert.doesNotReject(() => ctx.app.boot());
  });
}

/* ============================================================
   IRONWAVE — test/swap-any.test.js
   Swapping a main/secondary slot to ANY exercise: an out-of-movement pick
   converts the slot in place to an accessory (keeping `orig`), and a swap
   back to the original movement restores the exact slot.
   ============================================================ */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

const NODE_MAJOR = Number(process.versions.node.split('.')[0]);
const FOCUS = { arms: 2, chest: 2, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 2 };

function setup() {
  const { loadDom } = require('./load-dom');
  const ctx = loadDom();
  const a = ctx.app;
  a.S = a.defaultState();
  a.V = { view: 'dashboard', tab: 'dashboard', dayIdx: null, libTab: 'alpha', libSearch: '',
    obStep: 0, ob: null, checkinStep: 0, checkinData: null, draft: null };
  a.S.program = a.makeProgram({ daysPerWeek: 4, track: 'powerbuilding', timeMode: 'unlimited',
    muscleFocus: { ...FOCUS }, maxes: {} });
  return ctx;
}
function find(a, type, pred) {
  const days = a.S.program.days;
  for (let di = 0; di < days.length; di++) {
    const si = days[di].slots.findIndex(s => s.type === type && (!pred || pred(s)));
    if (si >= 0) return { di, si, slot: days[di].slots[si] };
  }
  return null;
}
function otherMovement(a, slot) {
  const mv = a.exById(slot.baseLift || slot.lift).movement;
  return a.allExercises().find(e => e.movement !== mv);
}

if (NODE_MAJOR < 20) {
  test('swap-any (skipped: jsdom requires Node >= 20)', { skip: true }, () => {});
} else {
  test('main -> out-of-movement converts in place; swap back restores exactly', () => {
    const { app: a } = setup();
    const { di, si, slot } = find(a, 'main');
    const before = JSON.parse(JSON.stringify(slot));
    const alt = otherMovement(a, slot);
    a.doSwap(di, si, alt.id);
    const s = a.S.program.days[di].slots[si];
    assert.strictEqual(s, slot, 'same object');
    assert.strictEqual(s.type, 'acc');
    assert.strictEqual(s.ex, alt.id);
    assert.strictEqual(s.cat, alt.movement);
    assert.ok(!('lift' in s) && !('baseLift' in s) && !('pctMod' in s));
    assert.deepStrictEqual(JSON.parse(JSON.stringify(s.orig)), { type: 'main', lift: before.lift });
    const rs = a.resolveSlot(s, 0, 0);
    assert.ok(!rs.isMain && !rs.isSecondary);
    assert.ok(rs.sets.length > 0);
    a.doSwap(di, si, before.lift);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(a.S.program.days[di].slots[si])), before);
  });

  test('main -> same-movement variation stays main', () => {
    const { app: a } = setup();
    const { di, si, slot } = find(a, 'main');
    const mv = a.exById(slot.lift).movement;
    const alt = a.allExercises().find(e => e.movement === mv && e.id !== slot.lift);
    const wm = a.resolveSlot(slot, 0, 0).wmKey;
    a.doSwap(di, si, alt.id);
    const s = a.S.program.days[di].slots[si];
    assert.strictEqual(s.type, 'main');
    assert.strictEqual(s.ex, alt.id);
    assert.ok(!s.orig);
    assert.strictEqual(a.resolveSlot(s, 0, 0).wmKey, wm);
  });

  test('secondary with baseLift/pctMod round-trips; variation restore keeps ex', () => {
    const { app: a } = setup();
    let f = find(a, 'secondary');
    if (!f) { // the default 4-day program has none: add one off the first main lift
      const m = find(a, 'main');
      a.S.program.days[m.di].slots.push({ type: 'secondary', lift: m.slot.lift, baseLift: m.slot.lift });
      f = find(a, 'secondary');
    }
    f.slot.pctMod = 0.9;
    if (!f.slot.baseLift) f.slot.baseLift = f.slot.lift;
    const before = JSON.parse(JSON.stringify(f.slot));
    a.doSwap(f.di, f.si, otherMovement(a, f.slot).id);
    const s = a.S.program.days[f.di].slots[f.si];
    assert.deepStrictEqual(JSON.parse(JSON.stringify(s.orig)), { type: 'secondary', lift: before.lift, baseLift: before.baseLift, pctMod: 0.9 });
    a.doSwap(f.di, f.si, before.lift);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(s)), before);
    // Convert again, then restore via a same-movement variation.
    a.doSwap(f.di, f.si, otherMovement(a, before).id);
    const mv = a.exById(before.baseLift).movement;
    const variation = a.allExercises().find(e => e.movement === mv && e.id !== before.lift);
    a.doSwap(f.di, f.si, variation.id);
    assert.strictEqual(s.type, 'secondary');
    assert.strictEqual(s.ex, variation.id);
    assert.strictEqual(s.lift, before.lift);
    assert.ok(!s.orig && !s.cat);
  });

  test('accessory with orig swapped to another foreign movement stays accessory', () => {
    const { app: a } = setup();
    const { di, si, slot } = find(a, 'main');
    const first = otherMovement(a, slot);
    a.doSwap(di, si, first.id);
    const second = a.allExercises().find(e => e.movement !== first.movement &&
      e.movement !== a.exById(slot.orig.lift).movement);
    a.doSwap(di, si, second.id);
    assert.strictEqual(slot.type, 'acc');
    assert.strictEqual(slot.cat, second.movement);
    assert.ok(slot.orig, 'orig kept');
  });

  test('in-progress draft entry follows conversion in both directions', () => {
    const { app: a } = setup();
    a.startCheckin(0);
    a.beginSession();
    const dr = a.V.draft;
    const entry = dr.entries.find(e => e.isMain);
    assert.ok(entry);
    const slot = a.S.program.days[dr.d].slots[entry.si];
    const lift = slot.lift;
    a.doSwap(dr.d, entry.si, otherMovement(a, slot).id);
    let e = a.V.draft.entries.find(x => x.si === entry.si);
    assert.ok(!e.isMain && !e.isSecondary);
    a.doSwap(dr.d, entry.si, lift);
    e = a.V.draft.entries.find(x => x.si === entry.si);
    assert.ok(e.isMain);
    assert.strictEqual(e.wmKey, lift);
  });

  test('picker for a main slot offers browse-other and the Original card', () => {
    const { app: a } = setup();
    const { di, si, slot } = find(a, 'main');
    a.openSwap(di, si);
    let html = a.swapBodyHTML();
    assert.ok(html.includes('browse-toggle'), 'browse toggle present');
    assert.ok(!html.includes('>Original<'));
    const lift = slot.lift;
    a.doSwap(di, si, otherMovement(a, slot).id);
    a.openSwap(di, si);
    html = a.swapBodyHTML();
    assert.ok(html.includes(`doSwap(${di},${si},'${lift}')`), 'original lift offered');
    assert.ok(html.includes('>Original<'), 'Original tag');
  });
}

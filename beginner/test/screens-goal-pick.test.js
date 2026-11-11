/* Package 5 flow tests, part 1: goal screen (A1-A5) and Pick (B1-B6).
   The contract (boot options, test ids, lead decisions) is in screens-helpers.js.
   DOM tests self-skip on Node < 20 (jsdom), like the scaffold DOM tests. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const H = require('./screens-helpers');
const { boot, seedState, workout, history, suggestFor, ex, Coach, BEGINNER_EXERCISES, BEGINNER_GOALS, BEGINNER_EQUIPMENT, beginnerGoalFocus, KEY, T0, DAY } = H;

if (H.NODE_MAJOR < 20) {
  test('screens goal and pick DOM tests (skipped: jsdom requires Node >= 20)', { skip: true }, () => {});
} else {
  const fresh = () => boot();
  const goalKeys = Object.keys(BEGINNER_GOALS);
  const onboarded = (o = {}) => boot({ seed: seedState(o) });

  // ---------- A: first open ----------
  test('A1 a fresh install shows the goal screen with exactly five tiles labelled from the goal table', async () => {
    const h = await fresh();
    assert.strictEqual(h.screen(), 'goal');
    const tiles = h.all('goal-tile');
    assert.deepStrictEqual(tiles.map(t => t.getAttribute('data-goal')), goalKeys);
    assert.deepStrictEqual(tiles.map(t => t.textContent.trim()), goalKeys.map(k => BEGINNER_GOALS[k].label));
  });

  test('A1 goal tiles are multi-select and toggle off again', async () => {
    const h = await fresh();
    const [a, b] = h.all('goal-tile');
    await h.click(a); await h.click(b);
    assert.deepStrictEqual(h.all('goal-tile').map(t => t.getAttribute('aria-pressed')), ['true', 'true', 'false', 'false', 'false']);
    await h.click(a);
    assert.strictEqual(h.all('goal-tile')[0].getAttribute('aria-pressed'), 'false');
  });

  test('A1 the goal screen can be skipped and leads to Pick', async () => {
    const h = await fresh();
    await h.click('goal-skip');
    assert.strictEqual(h.screen(), 'pick');
  });

  test('A2 the goal screen has one optional name field labelled "What\'s your name?"', async () => {
    const h = await fresh();
    const f = h.q('name-input');
    assert.ok(f, 'name field missing');
    assert.strictEqual(f.labels[0].textContent.trim(), "What's your name?");
    await h.click('goal-skip');
    assert.strictEqual(h.screen(), 'pick', 'leaving the name empty must not block');
  });

  test('A2 with a name the routine header reads "Ana\'s routine"', async () => {
    const h = await fresh();
    await h.type('name-input', 'Ana');
    await h.click('goal-continue');
    assert.strictEqual(h.val('routine-header'), "Ana's routine");
  });

  test('A2 without a name the routine header reads "Your routine"', async () => {
    const h = await fresh();
    await h.click('goal-skip');
    assert.strictEqual(h.val('routine-header'), 'Your routine');
  });

  test('A2 (LD) a name ending in s still gets \'s and the name is trimmed', async () => {
    const h = await fresh();
    await h.type('name-input', '  Carlos ');
    await h.click('goal-continue');
    assert.strictEqual(h.val('routine-header'), "Carlos's routine");
  });

  test('A2 (LD) a name of only spaces counts as no name', async () => {
    const h = await fresh();
    await h.type('name-input', '   ');
    await h.click('goal-continue');
    assert.strictEqual(h.val('routine-header'), 'Your routine');
  });

  test('A2 continuing persists goals, name and onboarded', async () => {
    const h = await fresh();
    await h.click(h.all('goal-tile')[0]); await h.click(h.all('goal-tile')[2]);
    await h.type('name-input', 'Ana');
    await h.click('goal-continue');
    const s = await h.state();
    assert.deepStrictEqual(s.goals, [goalKeys[0], goalKeys[2]]);
    assert.strictEqual(s.name, 'Ana');
    assert.strictEqual(s.onboarded, true);
  });

  test('A3 the goal screen asks nothing but the optional name', async () => {
    const h = await fresh();
    const inputs = h.rootInputs();
    assert.strictEqual(inputs.length, 1, 'only one field may exist on the goal screen');
    assert.strictEqual(inputs[0], h.q('name-input'));
  });

  test('A3 no question is asked before the first set (Pick has only ticks and search, Lift no fields)', async () => {
    const h = await fresh();
    await h.click('goal-skip');
    const ok = new Set([h.q('pick-search'), ...h.all('pick-tick')]);
    assert.deepStrictEqual(h.rootInputs().filter(i => !ok.has(i)).length, 0, 'unexpected field on Pick');
    await h.click('pick-start');
    assert.strictEqual(h.screen(), 'lift');
    assert.strictEqual(h.rootInputs().length, 0, 'unexpected field on Lift');
  });

  test('A4 from a fresh install three clicks (goal, continue, Start) reach the Lift screen', async () => {
    const h = await fresh();
    await h.click(h.all('goal-tile')[0]);
    await h.click('goal-continue');
    await h.click('pick-start');
    assert.strictEqual(h.clicks, 3);
    assert.strictEqual(h.screen(), 'lift');
  });

  test('A5 skipping stores no goals and Pick equals the Look fit suggestion', async () => {
    const h = await fresh();
    await h.click('goal-skip');
    const s = await h.state();
    assert.deepStrictEqual(s.goals, []);
    assert.strictEqual(s.onboarded, true);
    const want = Coach.suggest({ exercises: BEGINNER_EXERCISES, goalFocuses: [beginnerGoalFocus(['fit'])], excludedEquipment: [], workouts: [], now: h.clock() });
    assert.deepStrictEqual(h.cardIds(), want.list);
    assert.deepStrictEqual(h.tickedIds(), want.ticked);
  });

  test('A1 the goal screen never appears again after a reboot on the same adapter', async () => {
    const h = await fresh();
    await h.click('goal-skip');
    const h2 = await boot({ adapter: h.adapter, clock: h.clock });
    assert.strictEqual(h2.screen(), 'pick');
  });

  // ---------- B: Pick ----------
  test('B1 Pick shows six cards, three ticked, in the order Coach.suggest returns', async () => {
    const h = await fresh();
    await h.click(h.all('goal-tile')[1]);
    await h.click('goal-continue');
    const s = await h.state();
    const want = suggestFor(s, [], h.clock());
    assert.strictEqual(h.cardIds().length, 6);
    assert.deepStrictEqual(h.cardIds(), want.list);
    assert.deepStrictEqual(h.tickedIds(), want.ticked);
    assert.strictEqual(want.ticked.length, 3);
  });

  test('B1 exactly one Start button', async () => {
    const h = await onboarded();
    assert.strictEqual(h.all('pick-start').length, 1);
  });

  test('B1 on a later open Pick shows a ready list with one Start, never an empty list', async () => {
    const s = seedState({ workouts: [workout('w1', T0 - 2 * DAY, [['db-curl', 10, 10], ['pushup', 0, 10]])] });
    const h = await boot({ seed: s });
    assert.strictEqual(h.screen(), 'pick');
    const want = suggestFor(s, [], h.clock());
    assert.deepStrictEqual(h.cardIds(), want.list);
    assert.strictEqual(h.tickedIds().length, 3);
    assert.strictEqual(h.all('pick-start').length, 1);
  });

  test('B2 with several goals Pick follows the coach list and ticks for those goals', async () => {
    const h = await fresh();
    await h.click(h.all('goal-tile')[0]); await h.click(h.all('goal-tile')[2]);
    await h.click('goal-continue');
    const s = await h.state();
    const want = suggestFor(s, [], h.clock());
    assert.deepStrictEqual(h.cardIds(), want.list);
    assert.deepStrictEqual(h.tickedIds(), want.ticked);
  });

  test('B3 every card has a demo element and exactly one cue equal to the exercise cue', async () => {
    const h = await onboarded();
    assert.strictEqual(h.all('pick-card').length, 6);
    for (const c of h.all('pick-card')) {
      const id = c.getAttribute('data-exercise');
      assert.ok(c.querySelector('[data-testid="pick-demo"]'), 'no demo on ' + id);
      const cues = c.querySelectorAll('[data-testid="pick-cue"]');
      assert.strictEqual(cues.length, 1, 'cue count on ' + id);
      assert.strictEqual(cues[0].textContent.trim(), ex(id).cue);
    }
  });

  test('B3 (LD) with an empty manifest every demo is the placeholder image', async () => {
    const h = await onboarded();
    for (const c of h.all('pick-card')) {
      const d = c.querySelector('[data-testid="pick-demo"]');
      assert.strictEqual(d.tagName, 'IMG');
      assert.match(d.getAttribute('src'), /media\/placeholder\.svg$/);
    }
  });

  test('B3 (LD) an exercise listed in the manifest gets a looping muted inline autoplay video', async () => {
    const s = seedState();
    const id = suggestFor(s, [], H.T0).list[0];
    const h = await boot({ seed: s, media: { items: { [id]: { file: ex(id).demo } } } });
    const d = h.card(id).querySelector('[data-testid="pick-demo"]');
    assert.strictEqual(d.tagName, 'VIDEO');
    for (const a of ['loop', 'muted', 'playsinline', 'autoplay']) assert.ok(d.hasAttribute(a), 'video lacks ' + a);
    const other = h.cardIds().find(x => x !== id);
    assert.strictEqual(h.card(other).querySelector('[data-testid="pick-demo"]').tagName, 'IMG');
  });

  const missingKeyCard = h => {
    const counts = {};
    for (const id of h.cardIds()) if (ex(id).equipKey !== 'none') counts[ex(id).equipKey] = (counts[ex(id).equipKey] || 0) + 1;
    const keys = Object.keys(counts);
    return keys.find(k => counts[k] > 1) || keys[0];
  };

  test('B4 "I don\'t have that here" persists the exclusion, removes that equipment and refills to six at once', async () => {
    const s = seedState();
    const h = await boot({ seed: s });
    const key = missingKeyCard(h);
    const before = { list: h.cardIds(), ticked: h.tickedIds() };
    const card = h.all('pick-card').find(c => ex(c.getAttribute('data-exercise')).equipKey === key);
    await h.click(card.querySelector('[data-testid="pick-missing"]'));
    const want = Coach.refill({ exercises: BEGINNER_EXERCISES, goalFocuses: s.goals.map(k => beginnerGoalFocus([k])), excludedEquipment: [key], workouts: [], now: h.clock(), current: before });
    assert.deepStrictEqual((await h.state()).excludedEquipment, [key]);
    assert.strictEqual(h.cardIds().length, 6);
    assert.ok(h.cardIds().every(id => ex(id).equipKey !== key), 'a card for the removed equipment remains');
    assert.deepStrictEqual(h.cardIds(), want.list);
    assert.deepStrictEqual(h.tickedIds(), want.ticked);
  });

  test('B4 cards that need no equipment have no "I don\'t have that here" button', async () => {
    const h = await onboarded({ goals: ['fit'] });
    await h.onlyTick(['pushup']);
    const c = h.card('pushup');
    assert.ok(c, 'pushup card missing');
    assert.strictEqual(c.querySelector('[data-testid="pick-missing"]'), null);
    const withKey = h.all('pick-card').filter(x => ex(x.getAttribute('data-exercise')).equipKey !== 'none');
    assert.ok(withKey.length > 0 && withKey.every(x => x.querySelector('[data-testid="pick-missing"]')), 'equipment cards need the button');
    assert.strictEqual(withKey[0].querySelector('[data-testid="pick-missing"]').textContent.trim(), "I don't have that here");
  });

  test('B5 excluded equipment is never suggested again, also after a reboot', async () => {
    const h = await onboarded();
    const key = missingKeyCard(h);
    const card = h.all('pick-card').find(c => ex(c.getAttribute('data-exercise')).equipKey === key);
    await h.click(card.querySelector('[data-testid="pick-missing"]'));
    const h2 = await boot({ adapter: h.adapter, clock: h.clock });
    const s = await h2.state();
    assert.deepStrictEqual(h2.cardIds(), suggestFor(s, [key], h2.clock()).list);
    assert.ok(h2.cardIds().every(id => ex(id).equipKey !== key));
  });

  test('B5 the restore list shows each excluded key by label and restoring makes it eligible again', async () => {
    const s = seedState({ excluded: ['dumbbells', 'barbell'] });
    const h = await boot({ seed: s });
    const items = h.all('restore-item');
    assert.deepStrictEqual(items.map(i => i.getAttribute('data-equip')).sort(), ['barbell', 'dumbbells']);
    for (const i of items) assert.ok(i.textContent.includes(BEGINNER_EQUIPMENT[i.getAttribute('data-equip')].label));
    await h.click(items.find(i => i.getAttribute('data-equip') === 'dumbbells'));
    assert.deepStrictEqual((await h.state()).excludedEquipment, ['barbell']);
    assert.strictEqual(h.all('restore-item').length, 1);
    const h2 = await boot({ adapter: h.adapter, clock: h.clock });
    assert.deepStrictEqual(h2.cardIds(), suggestFor(await h2.state(), ['barbell'], h2.clock()).list);
  });

  test('B6 cards can be unticked and ticked again', async () => {
    const h = await onboarded();
    const id = h.tickedIds()[0];
    await h.click(h.tickOf(id));
    assert.ok(!h.tickedIds().includes(id));
    await h.click(h.tickOf(id));
    assert.ok(h.tickedIds().includes(id));
  });

  test('B6 search filters the full list by name, case-insensitive, including non-starters', async () => {
    const h = await onboarded();
    await h.type('pick-search', 'BARBELL');
    const want = BEGINNER_EXERCISES.filter(e => e.name.toLowerCase().includes('barbell') && !h.cardIds().includes(e.id)).map(e => e.id);
    assert.ok(want.some(id => !ex(id).starter), 'precondition: a non-starter matches');
    assert.deepStrictEqual(h.all('pick-result').map(r => r.getAttribute('data-exercise')).sort(), want.sort());
  });

  test('B6 search leaves out excluded equipment', async () => {
    const h = await onboarded({ excluded: ['barbell'] });
    await h.type('pick-search', 'Barbell');
    assert.strictEqual(h.all('pick-result').length, 0);
  });

  test('B6 a search result can be added to today\'s workout as a ticked card', async () => {
    const h = await onboarded();
    await h.type('pick-search', 'Barbell Squat');
    const r = h.all('pick-result').find(x => x.getAttribute('data-exercise') === 'comp-squat');
    assert.ok(r, 'barbell squat not offered');
    await h.click(r);
    assert.ok(h.cardIds().includes('comp-squat'));
    assert.ok(h.tickedIds().includes('comp-squat'));
  });

  test('B6 "Repeat last workout" is absent when no workout has finished', async () => {
    const h = await onboarded();
    assert.strictEqual(h.q('pick-repeat'), null);
  });

  test('B6 "Repeat last workout" ticks exactly the last finished workout\'s exercises still eligible', async () => {
    const s = seedState({
      excluded: ['pull-up-bar'],
      workouts: [
        workout('w1', T0 - 9 * DAY, [['leg-press', 40, 10]]),
        workout('w2', T0 - 2 * DAY, [['lat-pulldown', 30, 10], ['pushup', 0, 10], ['pullup', 0, 5]]),
      ],
    });
    const h = await boot({ seed: s });
    assert.strictEqual(h.q('pick-repeat').textContent.trim(), 'Repeat last workout');
    await h.click('pick-repeat');
    assert.deepStrictEqual(h.tickedIds().sort(), ['lat-pulldown', 'pushup']);
  });

  test('B6 Start is disabled when nothing is ticked', async () => {
    const h = await onboarded();
    for (const id of h.tickedIds()) await h.click(h.tickOf(id));
    assert.strictEqual(h.q('pick-start').disabled, true);
  });

  test('B6 (LD) Start begins a workout whose plan is the ticked ids in card order', async () => {
    const h = await onboarded();
    const want = h.cardIds().filter(id => h.tickedIds().includes(id));
    await h.click('pick-start');
    const w = await h.active();
    assert.deepStrictEqual(w.plan, want);
    assert.strictEqual(h.screen(), 'lift');
  });
}

/* Package 5 flow tests, part 3: Done screen (D10), tone (D1, G3), no network (H1),
   export and import controls (H3). Contract in screens-helpers.js.
   DOM tests self-skip on Node < 20. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const H = require('./screens-helpers');
const { boot, seedState, workout, history, ex, fmt, Coach, Store, KEY, T0 } = H;

if (H.NODE_MAJOR < 20) {
  test('screens done and data DOM tests (skipped: jsdom requires Node >= 20)', { skip: true }, () => {});
} else {
  const finishTwo = async h => {
    await h.toLift(['db-curl', 'db-bench']);
    await h.logSets(2);
    await h.click('next-exercise');
    await h.logSets(2);
    await h.click('lift-finish');
  };

  test('D10 the Done screen summarises what was done without weight totals', async () => {
    const h = await boot({ seed: seedState() });
    await finishTwo(h);
    assert.strictEqual(h.screen(), 'done');
    const w = (await h.state()).workouts[0];
    const want = fmt(h.S.done.summary, { exercises: new Set(w.sets.map(s => s.exerciseId)).size, sets: w.sets.length });
    assert.strictEqual(h.val('done-summary'), want);
    assert.ok(!/kg|lb/.test(h.val('done-summary')));
  });

  test('D10 no "New best" on a first workout', async () => {
    const h = await boot({ seed: seedState() });
    await finishTwo(h);
    assert.strictEqual(h.q('done-best'), null);
    assert.ok(!h.text().includes('New best'));
  });

  test('D10 a new highest estimate shows one "New best" line even for several exercises', async () => {
    const wk = [...history('db-curl', 10, [10, 10]), ...history('db-bench', 10, [10, 10])];
    const h = await boot({ seed: seedState({ workouts: wk }) });
    await h.toLift(['db-curl', 'db-bench']);
    for (let i = 0; i < 2; i++) {
      await h.clickN('reps-plus', 4);
      await h.click('lift-done');
      if (i === 0) await h.click('next-exercise');
    }
    await h.click('lift-end');
    const s = await h.state();
    const done = s.workouts.find(w => w.id !== undefined && w.endedAt !== null && !w.id.startsWith('h-'));
    assert.strictEqual(Coach.newBests({ workouts: s.workouts, workoutId: done.id }).length, 2, 'precondition: two exercises improved');
    assert.strictEqual(h.all('done-best').length, 1);
    assert.ok(h.val('done-best').includes('New best'));
    assert.ok(h.root.querySelectorAll('[data-line]').length <= 2, 'at most two lines');
  });

  for (const [id, feel] of [['feel-easy', 'easy'], ['feel-right', 'right'], ['feel-much', 'much']]) {
    test('D10 the Done question stores "' + feel + '" through ' + id, async () => {
      const h = await boot({ seed: seedState() });
      await h.toLift(['db-curl']);
      await h.logSets(1);
      await h.click('lift-end');
      assert.ok(h.text().includes('How was that?'));
      assert.deepStrictEqual(['feel-easy', 'feel-right', 'feel-much'].map(x => h.val(x)), ['Too easy', 'Just right', 'Too much']);
      await h.click(id);
      assert.strictEqual((await h.state()).workouts[0].feel, feel);
    });
  }

  test('D10 not answering the question is fine and a control returns to Pick with a ready list', async () => {
    const h = await boot({ seed: seedState() });
    await h.toLift(['db-curl']);
    await h.logSets(1);
    await h.click('lift-end');
    assert.strictEqual((await h.state()).workouts[0].feel, null);
    await h.click('done-back');
    assert.strictEqual(h.screen(), 'pick');
    assert.strictEqual(h.cardIds().length, 6);
    assert.strictEqual(h.all('pick-start').length, 1);
  });

  // ---------- tour: tone and network ----------
  async function tour() {
    const h = await boot();
    const texts = [h.allText()];
    await h.click(h.all('goal-tile')[0]);
    await h.type('name-input', 'Ana');
    texts.push(h.allText());
    await h.click('goal-continue');
    await h.type('pick-search', 'a');
    texts.push(h.allText());
    await h.type('pick-search', '');
    h.setPick('not a backup');
    await h.click('import-btn');
    texts.push(h.allText());
    await h.click('confirm-no');
    const keyed = h.all('pick-card').find(c => ex(c.getAttribute('data-exercise')).equipKey !== 'none');
    await h.click(keyed.querySelector('[data-testid="pick-missing"]'));
    texts.push(h.allText());
    await h.toLift(['db-curl', 'db-bench']);
    texts.push(h.allText());
    await h.logSets(1);
    texts.push(h.allText());
    await h.logSets(1);
    texts.push(h.allText());
    await h.click('lift-swap');
    texts.push(h.allText());
    await h.click(h.all('swap-option')[0]);
    await h.click('lift-end');
    texts.push(h.allText());
    return { h, texts };
  }

  test('G3 no rendered text, alt, label or placeholder on any screen contains an em or en dash', async () => {
    const { texts } = await tour();
    for (const t of texts) assert.ok(!/[—–]/.test(t), 'dash in: ' + t.slice(0, 200));
  });

  test('G3 no BEGINNER_STRINGS value contains an em or en dash', async () => {
    const h = await boot();
    const walk = (o, p) => Object.entries(o).forEach(([k, v]) => typeof v === 'string' ? assert.ok(!/[—–]/.test(v), p + k) : walk(v, p + k + '.'));
    walk(h.S, '');
  });

  test('D1 no screen states a target: no "try", "last time" or "time to go up"', async () => {
    const { texts } = await tour();
    for (const t of texts) {
      assert.ok(!/\btry\b/i.test(t), 'found "try" in: ' + t.slice(0, 200));
      assert.ok(!/last time/i.test(t), 'found "last time"');
      assert.ok(!/time to go up/i.test(t), 'found "time to go up"');
    }
  });

  test('D1 a returning exercise shows steppers and no sentence about what to lift', async () => {
    const h = await boot({ seed: seedState({ workouts: history('db-curl', 10, [10, 10]) }) });
    await h.toLift(['db-curl']);
    const t = h.allText();
    assert.strictEqual(h.q('lift-prompt'), null);
    assert.ok(!/\b(target|aim|goal for)\b/i.test(h.text()), 'target wording: ' + h.text());
  });

  test('H1 the whole tour makes no network request', async () => {
    const { h } = await tour();
    assert.deepStrictEqual(h.window.__netCalls, []);
  });

  // ---------- H3 ----------
  test('H3 export hands the full export text to platform.saveFile', async () => {
    const s = seedState({ name: 'Ana', workouts: [workout('w1', T0 - 86400000, [['db-curl', 10, 10]])] });
    const h = await boot({ seed: s });
    await h.click('export-btn');
    assert.strictEqual(h.saved.length, 1);
    assert.strictEqual(typeof h.saved[0].name, 'string');
    assert.ok(h.saved[0].name.length > 0);
    const f = JSON.parse(h.saved[0].text);
    assert.strictEqual(f.app, H.BEGINNER_CONFIG.store.exportApp);
    assert.strictEqual(f.exportedAt, h.clock());
    assert.deepStrictEqual(f.state, await h.state());
  });

  const backupOf = async state => {
    const db = await Store.open(Store.memoryAdapter({ [KEY]: state }));
    return db.exportData({ now: T0 });
  };

  test('H3 import asks for one confirmation, then replaces everything', async () => {
    const h = await boot({ seed: seedState({ name: 'Ana' }) });
    h.setPick(await backupOf(seedState({ name: 'Zed', goals: ['arms'] })));
    await h.click('import-btn');
    assert.strictEqual(h.all('confirm-dialog').length, 1);
    assert.strictEqual((await h.state()).name, 'Ana', 'nothing may change before confirming');
    await h.click('confirm-yes');
    const s = await h.state();
    assert.strictEqual(s.name, 'Zed');
    assert.deepStrictEqual(s.goals, ['arms']);
    assert.strictEqual(h.val('routine-header'), "Zed's routine");
  });

  test('H3 cancelling the confirmation imports nothing', async () => {
    const h = await boot({ seed: seedState({ name: 'Ana' }) });
    h.setPick(await backupOf(seedState({ name: 'Zed' })));
    await h.click('import-btn');
    await h.click('confirm-no');
    assert.strictEqual((await h.state()).name, 'Ana');
    assert.strictEqual(h.q('confirm-dialog'), null);
  });

  test('H3 a failed import leaves everything as it was and says so', async () => {
    const before = seedState({ name: 'Ana', workouts: [workout('w1', T0 - 86400000, [['db-curl', 10, 10]])] });
    const h = await boot({ seed: before });
    h.setPick('this is not a backup');
    await h.click('import-btn');
    await h.click('confirm-yes');
    assert.deepStrictEqual(await h.state(), before);
    assert.strictEqual(h.val('import-error'), h.S.errors.import);
    assert.strictEqual(h.val('routine-header'), "Ana's routine");
  });
}

/* ============================================================
   BEGINNER APP, package 5 (Screens). THIS FILE IS PART OF THE SPEC: it holds the
   complete UI contract (boot options, test ids, lead decisions) and the helpers the
   flow tests share. The Sonnet builder implements exactly this and may not edit tests.
   Flow tests: screens-goal-pick.test.js, screens-lift.test.js, screens-done-data.test.js.
   Strings schema test: strings.test.js (pure Node).

   Criteria: A1-A5, B1-B6 (screen side), C1-C6, D1, D10, G3, G4, H3 (screen side).
   Every `LD` below is a lead decision where the criteria are silent.

   ---------- FILES ----------
   beginner/strings.js (new): `const BEGINNER_STRINGS`, deeply frozen, nested objects of
     strings (keys and wording in strings.test.js). Loaded after exercises.js, before
     coach.js. Every word the user reads comes from BEGINNER_STRINGS, an exercise
     name/cue, a BEGINNER_EQUIPMENT label or a BEGINNER_GOALS label; ui.js has no other
     user-facing literal. Builder adds strings.js to index.html and to the harnesses so
     loadBeginner() and loadDom().app expose BEGINNER_STRINGS.
   beginner/ui.js: the single global `UI`. beginner/styles.css, index.html.
   BEGINNER_CONFIG.ui must define: restSec (LD 90), staleWorkoutHours (LD 6).

   ---------- BOOT ----------
   UI.boot(opts) -> Promise resolving once the first screen is rendered. opts:
     root     element to render into (default #app)
     adapter  Store adapter (tests: Store.memoryAdapter, sometimes wrapped)
     clock    () => epoch ms. The ONLY clock the UI may read (no Date.now, no new Date())
     locale   BCP 47 string (default: browser). Drives the display unit (G4)
     timers   optional { setInterval(fn, ms) -> id, clearInterval(id) }. The UI must use
              these for the rest-timer tick and NOT use real timers elsewhere. Tests fire
              ticks by hand, with no real time passing.
     platform optional { vibrate(ms), saveFile(name, text), pickFile() -> Promise<string|null> }
              with safe browser defaults.
     media    optional parsed media manifest, default { items: {} }. The UI never fetches it.
   There are no optimistic updates: the UI awaits every Store call, then renders.
   The UI must not depend on macrotask timers (setTimeout, setImmediate, rAF) to finish a
   step: tests only flush microtasks (settle() = 200 turns of `await Promise.resolve()`).
   index.html: how it calls UI.boot() is the builder's choice (the DOM harness strips
   inline scripts and never runs it); a small external bootstrap script is fine. The
   harness window has no structuredClone; the test helper installs Node's before boot.
   Exactly one element with attribute data-screen ("goal" | "pick" | "lift" | "done")
   exists inside root at any time.

   ---------- TEST IDS (data-testid) ----------
   Goal screen (data-screen="goal"):
     goal-tile        x5, data-goal=<key>, text = BEGINNER_GOALS label, in key order,
                      aria-pressed "true"/"false"; click toggles (multi-select)
     name-input       the ONLY input/select/textarea on the screen; its <label> text is
                      "What's your name?" (element.labels[0])
     goal-continue    button. LD: with no tile selected it behaves like skip
     goal-skip        button
     Continue or skip: db.setProfile({ goals, name (trimmed), onboarded:true }), then
     Pick. Skip stores goals [] (the name is still stored if typed; LD).
   Pick (data-screen="pick"):
     routine-header   "Ana's routine" / "Your routine". LD: always `'s` (Carlos's
                      routine); name trimmed; spaces-only name counts as none
     pick-card        data-exercise=<id>, in Coach.suggest list order. Inside each:
       pick-name      exercise name
       pick-tick      <input type=checkbox>; .checked is the tick state; click toggles
       pick-demo      the demo element itself. LD: <video loop muted playsinline autoplay>
                      (attributes present) when opts.media.items has OWN property <id>,
                      else <img src ending "media/placeholder.svg" alt=pick.demoAlt>
       pick-cue       exactly one per card, text = exercise.cue
       pick-missing   button "I don't have that here"; NOT rendered when equipKey 'none'
     pick-start       exactly one, a button; .disabled when nothing is ticked. LD: Start
                      begins a workout with plan = ticked ids in card order (startWorkout)
     pick-search      text input. Typing filters FULL BEGINNER_EXERCISES by name,
                      case-insensitive substring, starter:false included, excluded
                      equipment omitted. LD: ids already shown as cards are omitted from results
     pick-result      one per match, data-exercise=<id>; click appends a ticked card
                      (LD: at the end) and the result goes away
     pick-repeat      only when a finished workout exists. Click: ticks exactly the unique
                      exercises of the most recently started FINISHED workout (set order)
                      that are still eligible (adding cards for ones not shown, LD appended)
                      and unticks everything else
     restore-item     button, one per excluded equipment key, data-equip=<key>, text
                      includes the BEGINNER_EQUIPMENT label; click restores it
                      (db.restoreEquipment). LD: present only while something is excluded;
                      restoring does not reshuffle the current cards
     export-btn, import-btn   (H3, LD on Pick)
     confirm-dialog (exactly one while asking), confirm-yes, confirm-no
     import-error     shown after a failed import
     Exclude ("I don't have that here"): db.excludeEquipment(key), then
     Coach.refill({ exercises, goalFocuses, excludedEquipment, workouts, now, current:
     { list, ticked } }); no network. Pick on every open recomputes via Coach.suggest.
   Lift (data-screen="lift"): ONE exercise at a time.
     lift-name, lift-demo (same contract as pick-demo), lift-cue (exercise cue)
     lift-prompt      only when Coach.prefill rule is 'first'; text exactly
                      "Pick a weight you could lift for 12 repetitions. Stop when it gets hard."
     weight-minus, weight-plus, weight-value, weight-unit   NOT rendered for equipment 'bw'
     reps-minus, reps-plus, reps-value
       ROUND 2 (LD): weight-value and reps-value are editable <input> elements (NOT
       type=number, so a comma works), inputmode="decimal" (weight) / "numeric" (reps),
       whose .value is the number ('' when empty); plus and minus still step them. A typed
       weight is read in the DISPLAY unit (point or comma), stored as kg = typed * factor,
       NO snapping to the grid (the user typed what they did); a typed reps value must be an
       integer >= 0. Invalid or negative input is ignored and the previous value is restored
       on `change`. Done is enabled once reps >= 1.
       A3 (LD): the only inputs on Lift are weight-value and reps-value (typing what you did is
       the product, not a question); no select, no textarea, and no label, placeholder or
       aria-label asks about account, experience, body data, 1RM or training days. Plus/minus after a typed off-grid value
       step from the typed value. weight-unit is the unit string.
       Accessible names (aria-label, or text when absent) come from single strings:
       weight-minus lift.weightLess, weight-plus lift.weightMore, reps-minus lift.repsLess,
       reps-plus lift.repsMore. restore-item's accessible name is pick.restoreItem with {item}
       = the equipment label (no concatenation in code).
       NO REBUILD (LD): a stepper tap, typing, or ticking a Pick card must not replace the
       DOM of the unaffected parts: the same lift-demo node stays in the document, the clicked
       button (or typed input, or tick) is the same node and keeps focus; on Pick the other
       cards' pick-demo nodes keep identity.
       DOUBLE TAP (LD): a Done click within BEGINNER_CONFIG.ui.doubleTapMs (start 500) of the
       previous LOGGED set (injected clock, set.at) logs nothing; lift-done is `disabled`
       while a save is pending.
       REST AFTER KILL (LD): on boot, if the latest set of the open workout is within restSec,
       the Lift screen shows rest-timer with remaining = restSec - (clock - lastSet.at), and it
       vibrates once at the end; if the rest already ended, no rest-timer and no vibration.
       VIBRATION (LD): only the tick (or the visibilitychange handler) vibrates, exactly once
       per rest; a re-render must never swallow or fire it.
       FAILED WRITES (LD): ANY failed db write (Start, End workout, Finish, Swap, Add, exclude,
       restore, goal continue or skip, a Done-screen feel answer, logSet) shows an element
       testid save-error with role="alert" on the current screen (same testid everywhere), keeps
       the user on that screen with nothing lost, and a retry works; it clears on success.
       Wording: a failed Done shows errors.save (it says to tap Done again); every OTHER failed
       write shows errors.action (no mention of Done), both in the save-error alert.
       DOUBLE TAP gap (LD): a Done at a gap of 0 ms, 1 ms or doubleTapMs - 1 from the newest
       logged set logs nothing; at doubleTapMs it logs. h.logSets advances the fake clock by
       doubleTapMs + 100 before each Done, so consecutive sets are never in the window.
       UNKNOWN IDS (LD): plan or set ids not in BEGINNER_EXERCISES are skipped everywhere a plan
       or log is read (resume, next, swap, repeat last workout, Done summary), never throw.
     set-counter      "Set {n} of {m}": n = sets of this exercise already logged in this
                      workout + 1, m = Coach.setCount
     lift-done        button. Disabled until reps >= 1. LD: weight empty counts as 0.
                      Click: await db.logSet({ exerciseId, weightKg, reps, effort:null,
                      now:clock() }), THEN render (C6). On rejection: nothing counted,
                      steppers keep values, element save-error shows errors.save (cleared by
                      the next success). Retry by clicking Done again.
     face-easy, face-good, face-hard   appear after a successful Done (labels Easy, Good,
                      Hard); click -> db.setEffort({ index: that set, effort }) with effort
                      easy/good/hard. LD: tapping recomputes the NEXT set's pre-fill unless
                      the user already stepped it. They stay until the next Done.
     rest-timer       appears after a successful Done and starts by itself. data-remaining =
                      whole seconds left = max(0, ceil((doneAt + restSec*1000 - clock())/1000)),
                      recomputed from the clock on every tick (opts.timers) and on a
                      `visibilitychange` event on document. Text is m:ss (LD). At zero:
                      platform.vibrate called exactly once, element stays showing 0, no negative.
                      The timer never blocks logging.
     one-more, next-exercise, lift-finish   after the last planned set (sets logged >= m)
                      lift-done and the steppers are replaced by: one-more (shows the
                      steppers and lift-done again for set m+1) and, when another exercise
                      is planned, next-exercise, else lift-finish (ends the workout).
                      LD: next-exercise (when another exercise exists) and lift-finish (on
                      the last) are ALSO available at any earlier point, so fewer sets work.
     lift-swap -> swap-option[data-exercise] list. LD: same muscle, eligible equipment,
                      not already in the plan. Click: db.updatePlan with the exercise replaced
                      (logged sets kept), screen shows the new exercise.
     lift-add  -> add-option[data-exercise] list (LD: every eligible exercise not in the
                      plan). Click: db.updatePlan(plan + id); the screen stays put.
     lift-end         ends the workout at any point: db.endWorkout({ now, feel:null }) then Done
                      screen (LD: a workout with no sets is dropped by the store; go to Pick).
     Resume (C6, LD): the current exercise is that of the most recent logged set (first
       plan exercise when none). A workout whose last activity (latest set, else start) is
       older than staleWorkoutHours is ended silently on boot (kept in the log if it has sets)
       and Pick is shown. Open workouts resume at Lift.
     Weight display (G4): kg or lb. state.units wins; else locale region US, LR, MM -> lb,
       anything else (and no region) -> kg. In lb the stepper steps Coach.incrementKg(equip,
       'lb')/KG_PER_LB lb; shown values are rounded to the lb grid; LD: the logged weightKg is
       the kg equivalent of the DISPLAYED value. LD: first plus on an empty weight goes to one
       increment, first plus on empty reps goes to 1, minus never goes below empty/0.
       ROUND 4 (LD) NO SILENT CHANGE (N1): a typed weight is never altered. In lb display, if
       the stored kg value is within 1e-6 of a value with at most two decimals in lb, that lb
       value is shown (typed 47 shows 47, 47.5 shows 47.5, never 45); otherwise (a kg-native
       value such as 22.5 kg) it is rounded to the lb grid (shows 50, never 49.6). A following
       set logged without touching the weight stores exactly the same kg as the previous one;
       the same holds in kg (typed 12.3 stays 12.3).
       CLOCK GUARDS (N2): the double-tap guard applies only when 0 <= gap < doubleTapMs, so a
       clock that moved BACK never blocks Done; a newest set in the future never blocks Done; a
       rest is resumed after a kill only when 0 <= now - lastSet.at < restSec * 1000, and a shown
       rest never exceeds restSec.
       CAPS (N3): BEGINNER_CONFIG.ui.maxWeightKg (start 500, compared in kg whatever the
       display unit) and ui.maxReps (start 100). A typed value above a cap is invalid (restored
       on change); a value equal to the cap is valid; plus stops at the cap.
   Done (data-screen="done"):
     done-summary     data-line; text = done.summary with {exercises}, {exerciseWord}, {sets},
                      {setWord}; the words are done.exerciseOne/exerciseMany and
                      done.setOne/setMany chosen by count == 1: "1 exercise, 1 set",
                      "2 exercises, 3 sets"; no weight totals
     done-best        data-line; ONLY when Coach.newBests is non-empty; ONE element in all
                      (LD), text contains "New best"
     feel-easy, feel-right, feel-much   "Too easy", "Just right", "Too much" ->
                      db.setFeel(workoutId, easy|right|much). At most 2 data-line elements.
     done-back        returns to Pick.
   ---------- TONE ----------
   No rendered text, alt, aria-label, placeholder or title contains an em or en dash (G3),
   "try", "last time", "time to go up" (D1), or any target wording. The page makes no network
   request (window.__netCalls stays empty).
   ============================================================ */
'use strict';
const NODE_MAJOR = Number(process.versions.node.split('.')[0]);
const { loadBeginner } = require('./load-beginner');

// Real Coach, Store and data in the Node realm: expectations are computed with them.
const N = loadBeginner();
const { Coach, Store, BEGINNER_CONFIG, BEGINNER_EXERCISES, BEGINNER_GOALS, BEGINNER_EQUIPMENT, beginnerGoalFocus } = N;
const KEY = BEGINNER_CONFIG.store.key;
const KG_PER_LB = 0.45359237;
const DAY = 864e5;
const HOUR = 36e5;
const T0 = Date.UTC(2026, 5, 10, 12, 0, 0);
const ex = id => BEGINNER_EXERCISES.find(e => e.id === id);

// ---------- fakes ----------
function fakeClock(start = T0) {
  let t = start;
  const f = () => t;
  f.advance = ms => { t += ms; };
  return f;
}
function fakeTimers() {
  let id = 0;
  const m = new Map();
  return {
    setInterval: fn => { m.set(++id, fn); return id; },
    clearInterval: i => { m.delete(i); },
    tick() { [...m.values()].forEach(f => f()); },
    active: () => m.size,
  };
}
// Adapter wrapper: hold() parks writes until release(); failNext rejects the next n writes.
function gatedAdapter(base) {
  const g = {
    hold: false, failNext: 0, pending: [],
    get: k => base.get(k),
    set: (k, v) => {
      if (g.failNext > 0) { g.failNext--; return Promise.reject(new Error('disk full')); }
      if (g.hold) return new Promise(res => { g.pending.push(() => res(base.set(k, v))); });
      return base.set(k, v);
    },
    release() { g.hold = false; g.pending.splice(0).forEach(f => f()); },
  };
  return g;
}

// ---------- state seeding ----------
// sets: [exerciseId, weightKg, reps, effort?]
function workout(id, startedAt, sets, o = {}) {
  const ss = sets.map(([exerciseId, weightKg, reps, effort], i) => ({ exerciseId, weightKg, reps, effort: effort || null, at: startedAt + i * 60000 }));
  const plan = [...new Set(ss.map(s => s.exerciseId))];
  return { id, startedAt, endedAt: o.open ? null : startedAt + sets.length * 60000 + 60000, feel: null, plan: o.plan || plan, sets: ss };
}
// n finished sessions of one exercise, oldest first, ending `lastDaysAgo` days ago.
function history(id, kg, repsList, n = 3, lastDaysAgo = 6) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const start = T0 - (lastDaysAgo + (n - 1 - i) * 7) * DAY;
    out.push(workout('h-' + id + '-' + i, start, repsList.map(r => [id, kg, r])));
  }
  return out;
}
function seedState(o = {}) {
  const s = Store.defaultState();
  s.onboarded = o.onboarded !== undefined ? o.onboarded : true;
  s.goals = o.goals || ['fit'];
  s.name = o.name || '';
  s.units = o.units || null;
  s.excludedEquipment = o.excluded || [];
  s.workouts = o.workouts || [];
  return s;
}
// A temp copy of the beginner sources: EVERY *.js and index.html (so a new file such as
// strings.js is never forgotten), minus the names in `omit`. The caller removes the folder.
function copyBeginnerDir(omit = []) {
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const src = path.join(__dirname, '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-screens-'));
  for (const f of fs.readdirSync(src)) {
    if ((f.endsWith('.js') || f === 'index.html') && !omit.includes(f)) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  }
  return dir;
}
const fmt = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k]));

// ---------- the harness ----------
async function boot(o = {}) {
  const { loadDom } = require('./load-dom');
  const { window, document, app } = loadDom();
  window.structuredClone = window.structuredClone || structuredClone;
  if (!app.UI || typeof app.UI.boot !== 'function') throw new Error('UI.boot is missing: the screens are not built yet');
  const base = o.adapter || Store.memoryAdapter(o.seed ? { [KEY]: o.seed } : undefined);
  const adapter = o.gated ? gatedAdapter(base) : base;
  const clock = o.clock || fakeClock();
  const timers = o.timers || fakeTimers();
  const vib = [];
  const saved = [];
  let picked = null;
  const platform = {
    vibrate: ms => { vib.push(ms); },
    saveFile: (name, text) => { saved.push({ name, text }); },
    pickFile: async () => picked,
  };
  const root = document.getElementById('app');
  const h = {
    window, document, app, root, adapter, clock, timers, vib, saved, clicks: 0, base,
    S: app.BEGINNER_STRINGS,
    setPick: t => { picked = t; },
  };
  h.settle = async () => { for (let i = 0; i < 200; i++) await Promise.resolve(); };
  h.q = id => root.querySelector('[data-testid="' + id + '"]');
  h.all = id => [...root.querySelectorAll('[data-testid="' + id + '"]')];
  h.screen = () => {
    const els = root.querySelectorAll('[data-screen]');
    if (els.length !== 1) return 'count:' + els.length;
    return els[0].getAttribute('data-screen');
  };
  h.text = () => root.textContent.replace(/\s+/g, ' ').trim();
  h.val = id => { const el = h.q(id); return el ? (el.tagName === 'INPUT' ? el.value : el.textContent).trim() : undefined; };
  h.errors = [];
  window.addEventListener('error', e => { h.errors.push(e.error || e.message); });
  h.focusClick = async target => {
    const el = typeof target === 'string' ? h.q(target) : target;
    el.focus();
    await h.click(el);
  };
  h.accName = el => (el.getAttribute('aria-label') || el.textContent).trim();
  h.num = id => { const t = h.val(id); return t === undefined || t === '' ? null : Number(t); };
  h.click = async target => {
    const el = typeof target === 'string' ? h.q(target) : target;
    if (!el) throw new Error('nothing to click: ' + target);
    h.clicks++;
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await h.settle();
  };
  h.clickN = async (id, n) => { for (let i = 0; i < n; i++) await h.click(id); };
  h.type = async (id, value) => {
    const el = h.q(id);
    if (!el) throw new Error('no field: ' + id);
    el.value = value;
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
    el.dispatchEvent(new window.Event('change', { bubbles: true }));
    await h.settle();
  };
  h.state = async () => base.get(KEY);
  h.active = async () => { const s = await h.state(); return s.workouts.find(w => w.endedAt === null) || null; };
  h.cardIds = () => h.all('pick-card').map(c => c.getAttribute('data-exercise'));
  h.tickedIds = () => h.all('pick-card').filter(c => c.querySelector('[data-testid="pick-tick"]').checked).map(c => c.getAttribute('data-exercise'));
  h.card = id => h.all('pick-card').find(c => c.getAttribute('data-exercise') === id);
  h.tickOf = id => h.card(id).querySelector('[data-testid="pick-tick"]');
  h.rootInputs = () => [...root.querySelectorAll('input, select, textarea')];
  // Make exactly `ids` the ticked cards (adding cards through search when absent).
  h.onlyTick = async ids => {
    for (const id of h.tickedIds()) if (!ids.includes(id)) await h.click(h.tickOf(id));
    for (const id of ids) {
      if (!h.card(id)) {
        await h.type('pick-search', ex(id).name);
        const r = h.all('pick-result').find(x => x.getAttribute('data-exercise') === id);
        if (!r) throw new Error('search did not offer ' + id);
        await h.click(r);
        await h.type('pick-search', '');
      } else if (!h.tickOf(id).checked) await h.click(h.tickOf(id));
    }
  };
  // Open Pick on an onboarded seed, tick only ids, Start. Returns on the Lift screen.
  h.toLift = async ids => { await h.onlyTick(ids); await h.click('pick-start'); };
  // Fill the steppers when empty, then Done, n times.
  h.logSets = async n => {
    for (let i = 0; i < n; i++) {
      if (h.q('reps-value') && h.val('reps-value') === '') await h.clickN('reps-plus', 10);
      if (h.q('weight-plus') && h.val('weight-value') === '') await h.click('weight-plus');
      h.gap();
      await h.click('lift-done');
    }
  };
  h.attrTexts = () => {
    const out = [];
    for (const el of root.querySelectorAll('*')) for (const a of ['alt', 'aria-label', 'title', 'placeholder']) if (el.getAttribute(a)) out.push(el.getAttribute(a));
    return out;
  };
  // Advance the fake clock past the double-tap window (BEGINNER_CONFIG.ui.doubleTapMs).
  h.gap = () => clock.advance((BEGINNER_CONFIG.ui.doubleTapMs || 500) + 100);
  h.hiddenNote = () => {
    const w = new window.Event('visibilitychange', { bubbles: true });
    document.dispatchEvent(w);
    return h.settle();
  };
  // Everything a user can read in root: text plus alt, aria-label, placeholder, title.
  h.allText = () => {
    const bits = [root.textContent];
    for (const el of root.querySelectorAll('*')) for (const a of ['alt', 'aria-label', 'placeholder', 'title']) if (el.getAttribute(a)) bits.push(el.getAttribute(a));
    return bits.join(' | ');
  };
  const opts = { root, adapter, clock, locale: o.locale || 'en-GB', timers, platform };
  if (o.media) opts.media = o.media;
  await app.UI.boot(opts);
  await h.settle();
  h.opts = opts;
  return h;
}

const suggestFor = (state, excluded, now) => Coach.suggest({
  exercises: BEGINNER_EXERCISES,
  goalFocuses: state.goals.map(k => beginnerGoalFocus([k])),
  excludedEquipment: excluded === undefined ? state.excludedEquipment : excluded,
  workouts: state.workouts,
  now,
});

module.exports = {
  NODE_MAJOR, N, Coach, Store, BEGINNER_CONFIG, BEGINNER_EXERCISES, BEGINNER_GOALS, BEGINNER_EQUIPMENT, beginnerGoalFocus,
  KEY, KG_PER_LB, DAY, HOUR, T0, ex, fakeClock, fakeTimers, gatedAdapter, copyBeginnerDir, workout, history, seedState, fmt, boot, suggestFor,
};

// Screens: goal, pick, lift, done. The only file allowed to touch the DOM.
// Silent product: every word shown comes from BEGINNER_STRINGS, an exercise name or
// cue, a BEGINNER_EQUIPMENT label or a BEGINNER_GOALS label. State changes go through
// the Store session (awaited, then render). Time only through opts.clock, ticks only
// through opts.timers, device features only through opts.platform.
const UI = (function () {
  'use strict';

  const cfg = () => BEGINNER_CONFIG.ui;
  const STR = () => BEGINNER_STRINGS;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const HOUR_MS = 36e5;
  const DAY_MS = 864e5;

  let db = null;
  let root = null;
  let opt = null;
  let byId = {};
  let timerId = null;

  // Ephemeral view state. Losing it only resets the UI.
  const V = {
    screen: '', goals: [], name: '',
    list: [], ticked: [], search: '', confirm: null, importError: false, profileError: false,
    curId: null, w: null, r: null, rule: '', touched: false, busy: false, saveError: false,
    lastIndex: null, restStart: null, vibrated: false, moreFor: null, panel: null,
    doneId: null,
  };

  // ---------- helpers ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k]));
  const round2 = x => Math.round(x * 100) / 100;
  const round6 = x => Math.round(x * 1e6) / 1e6;
  const numText = v => (v === null || v === undefined ? '' : String(round2(v)));
  const eligible = (e, excluded) => e.equipKey === 'none' || excluded.indexOf(e.equipKey) === -1;
  const now = () => opt.clock();

  function regionOf(locale) {
    const parts = String(locale || '').split(/[-_]/);
    for (let i = 1; i < parts.length; i++) if (/^[A-Za-z]{2}$/.test(parts[i])) return parts[i].toUpperCase();
    return '';
  }
  function unitsNow() {
    const u = db.state.units;
    if (u === 'kg' || u === 'lb') return u;
    return cfg().lbRegions.indexOf(regionOf(opt.locale)) !== -1 ? 'lb' : 'kg';
  }
  const factor = units => (units === 'lb' ? KG_PER_LB : 1);
  function stepOf(e, units) {
    const inc = Coach.incrementKg(e.equipment, units) / factor(units);
    return inc > 0 ? inc : cfg().fallbackStep;
  }
  function toDisp(kg, e, units) {
    if (units !== 'lb') return round2(kg);
    const inc = Coach.incrementKg(e.equipment, units) / factor(units);
    const x = kg / KG_PER_LB;
    return inc > 0 ? Math.round(x / inc) * inc : round2(x);
  }
  const toKg = (v, units) => v * factor(units);

  // Civil date from epoch ms (no Date object), for the export file name.
  function dayText(ms) {
    const z = Math.floor(ms / DAY_MS) + 719468;
    const era = Math.floor(z / 146097);
    const doe = z - era * 146097;
    const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    const mp = Math.floor((5 * doy + 2) / 153);
    const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    const m = mp < 10 ? mp + 3 : mp - 9;
    const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
    const p2 = n => (n < 10 ? '0' : '') + n;
    return y + '-' + p2(m) + '-' + p2(d);
  }

  // ---------- default platform and timers ----------
  function defaultPlatform(win) {
    const doc = win.document;
    return {
      vibrate: ms => { try { if (win.navigator && win.navigator.vibrate) win.navigator.vibrate(ms); } catch (e) { /* no vibration */ } },
      saveFile: (name, text) => {
        const url = win.URL.createObjectURL(new win.Blob([text], { type: 'application/json' }));
        const a = doc.createElement('a');
        a.href = url;
        a.download = name;
        doc.body.appendChild(a);
        a.click();
        doc.body.removeChild(a);
        win.URL.revokeObjectURL(url);
      },
      pickFile: () => new Promise(resolve => {
        const i = doc.createElement('input');
        i.type = 'file';
        i.accept = 'application/json,.json';
        i.addEventListener('change', () => {
          const f = i.files && i.files[0];
          if (!f) { resolve(null); return; }
          f.text().then(resolve, () => resolve(null));
        });
        i.addEventListener('cancel', () => resolve(null));
        i.click();
      }),
    };
  }

  // ---------- plans, exercises ----------
  const exOf = id => byId[id] || null;
  function goalFocuses(st) { return st.goals.map(k => beginnerGoalFocus([k])); }

  // ---------- rendering ----------
  function demoHTML(e, testid) {
    const items = (opt.media && opt.media.items) || {};
    if (has(items, e.id)) {
      const it = items[e.id];
      const src = (it && it.file) || e.demo;
      return '<video class="demo" data-testid="' + testid + '" src="' + esc(src) + '" loop muted playsinline autoplay preload="metadata" aria-label="' + esc(STR().pick.demoAlt) + '"></video>';
    }
    return '<img class="demo" data-testid="' + testid + '" src="' + esc(cfg().placeholder) + '" alt="' + esc(STR().pick.demoAlt) + '" loading="lazy">';
  }

  function goalHTML() {
    const S = STR();
    const tiles = Object.keys(BEGINNER_GOALS).map(k => {
      const on = V.goals.indexOf(k) !== -1;
      return '<button type="button" class="tile" data-testid="goal-tile" data-goal="' + esc(k) + '" data-act="tile" aria-pressed="' + on + '">' + esc(BEGINNER_GOALS[k].label) + '</button>';
    }).join('');
    return '<main data-screen="goal" class="screen">' +
      '<h1>' + esc(S.goal.heading) + '</h1>' +
      '<div class="tiles">' + tiles + '</div>' +
      '<div class="field"><label for="name-input">' + esc(S.goal.nameLabel) + '</label>' +
      '<input id="name-input" data-testid="name-input" type="text" autocomplete="given-name" value="' + esc(V.name) + '"></div>' +
      (V.profileError ? '<p class="error" role="alert">' + esc(S.errors.storage) + '</p>' : '') +
      '<div class="actions"><button type="button" class="primary" data-testid="goal-continue" data-act="continue">' + esc(S.goal.continue) + '</button>' +
      '<button type="button" class="quiet" data-testid="goal-skip" data-act="skip">' + esc(S.goal.skip) + '</button></div>' +
      '</main>';
  }

  function resultsHTML() {
    const S = STR();
    const q = V.search.trim().toLowerCase();
    if (!q) return '';
    const ex = db.state.excludedEquipment;
    const hits = BEGINNER_EXERCISES.filter(e => e.name.toLowerCase().indexOf(q) !== -1 && eligible(e, ex) && V.list.indexOf(e.id) === -1);
    if (!hits.length) return '<p class="muted">' + esc(S.pick.noMatches) + '</p>';
    return '<ul class="results">' + hits.map(e =>
      '<li><button type="button" class="result" data-testid="pick-result" data-exercise="' + esc(e.id) + '" data-act="result" data-id="' + esc(e.id) + '">' + esc(e.name) + '</button></li>').join('') + '</ul>';
  }

  function pickHTML() {
    const S = STR();
    const st = db.state;
    const name = st.name.trim();
    const header = name ? fmt(S.routine.titleNamed, { name }) : S.routine.title;
    const cards = V.list.map(id => {
      const e = exOf(id);
      if (!e) return '';
      const on = V.ticked.indexOf(id) !== -1;
      return '<article class="card" data-testid="pick-card" data-exercise="' + esc(id) + '">' +
        '<label class="tick"><input type="checkbox" data-testid="pick-tick" data-act="tick" data-id="' + esc(id) + '"' + (on ? ' checked' : '') + '>' +
        '<span class="name" data-testid="pick-name">' + esc(e.name) + '</span></label>' +
        demoHTML(e, 'pick-demo') +
        '<p class="cue" data-testid="pick-cue">' + esc(e.cue) + '</p>' +
        (e.equipKey !== 'none' ? '<button type="button" class="quiet" data-testid="pick-missing" data-act="missing" data-id="' + esc(id) + '">' + esc(S.pick.missing) + '</button>' : '') +
        '</article>';
    }).join('');
    const finished = st.workouts.some(w => w.endedAt !== null);
    const restore = st.excludedEquipment.length
      ? '<section class="restore"><h2>' + esc(S.pick.restoreHeading) + '</h2>' + st.excludedEquipment.map(k =>
        '<button type="button" class="quiet" data-testid="restore-item" data-equip="' + esc(k) + '" data-act="restore" data-key="' + esc(k) + '">' +
        esc(S.pick.restore) + ' ' + esc(has(BEGINNER_EQUIPMENT, k) ? BEGINNER_EQUIPMENT[k].label : k) + '</button>').join('') + '</section>'
      : '';
    const confirm = V.confirm !== null
      ? '<div class="confirm" data-testid="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-text">' +
        '<p id="confirm-text">' + esc(S.data.confirm) + '</p>' +
        '<div class="actions"><button type="button" class="primary" data-testid="confirm-yes" data-act="confirm-yes">' + esc(S.data.yes) + '</button>' +
        '<button type="button" class="quiet" data-testid="confirm-no" data-act="confirm-no">' + esc(S.data.no) + '</button></div></div>'
      : '';
    return '<main data-screen="pick" class="screen">' +
      '<h1 data-testid="routine-header">' + esc(header) + '</h1>' +
      (finished ? '<button type="button" class="quiet" data-testid="pick-repeat" data-act="repeat">' + esc(S.pick.repeat) + '</button>' : '') +
      '<div class="cards">' + cards + '</div>' +
      '<div class="startbar"><button type="button" class="primary" data-testid="pick-start" data-act="start"' + (V.ticked.length ? '' : ' disabled') + '>' + esc(S.pick.start) + '</button></div>' +
      '<section class="search"><div class="field"><label for="pick-search">' + esc(S.pick.searchLabel) + '</label>' +
      '<input id="pick-search" data-testid="pick-search" type="text" autocomplete="off" value="' + esc(V.search) + '"></div>' +
      '<div data-region="results">' + resultsHTML() + '</div></section>' +
      restore +
      '<section class="data"><button type="button" class="quiet" data-testid="export-btn" data-act="export">' + esc(S.data.export) + '</button>' +
      '<button type="button" class="quiet" data-testid="import-btn" data-act="import">' + esc(S.data.import) + '</button>' +
      (V.importError ? '<p class="error" data-testid="import-error" role="alert">' + esc(S.errors.import) + '</p>' : '') + '</section>' +
      confirm +
      '</main>';
  }

  function remainingNow() {
    if (V.restStart === null) return null;
    return Math.max(0, Math.ceil((V.restStart + cfg().restSec * 1000 - now()) / 1000));
  }
  function clockText(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function stepperHTML(kind, label, value, minusAct, plusAct, unit) {
    const S = STR();
    return '<div class="stepper" role="group" aria-label="' + esc(label) + '">' +
      '<span class="steplabel">' + esc(label) + '</span>' +
      '<button type="button" class="step" data-testid="' + kind + '-minus" data-act="' + minusAct + '" aria-label="' + esc(label + ' ' + S.lift.less) + '">-</button>' +
      '<span class="value"><span data-testid="' + kind + '-value">' + esc(numText(value)) + '</span>' +
      (unit ? ' <span class="unit" data-testid="weight-unit">' + esc(unit) + '</span>' : '') + '</span>' +
      '<button type="button" class="step" data-testid="' + kind + '-plus" data-act="' + plusAct + '" aria-label="' + esc(label + ' ' + S.lift.more) + '">+</button>' +
      '</div>';
  }

  function liftHTML() {
    const S = STR();
    const w = db.activeWorkout();
    const e = exOf(V.curId);
    const st = db.state;
    const units = unitsNow();
    const plan = w.plan;
    const idx = plan.indexOf(e.id);
    const logged = w.sets.filter(s => s.exerciseId === e.id).length;
    const m = Coach.setCount({ exerciseId: e.id, exercise: e, workouts: st.workouts, currentWorkoutId: w.id, now: now() });
    const inputMode = logged < m || V.moreFor === logged;
    const hasNext = idx !== -1 && idx < plan.length - 1;

    let main = '';
    if (inputMode) {
      main += '<p class="counter" data-testid="set-counter">' + esc(fmt(S.lift.setOf, { n: logged + 1, m: Math.max(m, logged + 1) })) + '</p>';
      if (V.rule === 'first') main += '<p class="prompt" data-testid="lift-prompt">' + esc(S.lift.first) + '</p>';
      if (e.equipment !== 'bw') main += stepperHTML('weight', S.lift.weight, V.w, 'w-', 'w+', S.units[units]);
      main += stepperHTML('reps', S.lift.reps, V.r, 'r-', 'r+', '');
      if (V.saveError) main += '<p class="error" data-testid="save-error" role="alert">' + esc(S.errors.save) + '</p>';
      main += '<button type="button" class="primary big" data-testid="lift-done" data-act="done-set"' + (V.r >= 1 ? '' : ' disabled') + '>' + esc(S.lift.done) + '</button>';
    } else {
      main += '<button type="button" class="primary big" data-testid="one-more" data-act="one-more">' + esc(S.lift.oneMore) + '</button>';
    }
    main += hasNext
      ? '<button type="button" class="secondary" data-testid="next-exercise" data-act="next">' + esc(S.lift.nextExercise) + '</button>'
      : '<button type="button" class="secondary" data-testid="lift-finish" data-act="finish">' + esc(S.lift.finish) + '</button>';

    let after = '';
    const lastSet = V.lastIndex !== null ? w.sets[V.lastIndex] : null;
    if (lastSet && lastSet.exerciseId === e.id) {
      after += '<div class="faces" role="group">' + ['easy', 'good', 'hard'].map(f =>
        '<button type="button" class="face" data-testid="face-' + f + '" data-act="face" data-effort="' + f + '" aria-pressed="' + (lastSet.effort === f) + '">' + esc(S.faces[f]) + '</button>').join('') + '</div>';
    }
    const rem = remainingNow();
    if (rem !== null) {
      if (rem === 0) V.vibrated = true;
      after += '<p class="rest" data-testid="rest-timer" role="timer" data-remaining="' + rem + '">' + esc(S.lift.rest) + ' <span data-role="time">' + clockText(rem) + '</span></p>';
    }

    let panel = '';
    if (V.panel === 'swap' || V.panel === 'add') {
      const ex = st.excludedEquipment;
      let opts = BEGINNER_EXERCISES.filter(x => plan.indexOf(x.id) === -1 && eligible(x, ex));
      if (V.panel === 'swap') opts = opts.filter(x => x.muscle === e.muscle);
      opts = opts.filter(x => x.starter).concat(opts.filter(x => !x.starter));
      const act = V.panel === 'swap' ? 'swap-pick' : 'add-pick';
      const tid = V.panel === 'swap' ? 'swap-option' : 'add-option';
      panel = '<section class="panel"><h2>' + esc(V.panel === 'swap' ? S.lift.swapHeading : S.lift.addHeading) + '</h2><ul class="results">' +
        opts.map(x => '<li><button type="button" class="result" data-testid="' + tid + '" data-exercise="' + esc(x.id) + '" data-act="' + act + '" data-id="' + esc(x.id) + '">' + esc(x.name) + '</button></li>').join('') +
        '</ul></section>';
    }

    return '<main data-screen="lift" class="screen">' +
      '<h1 data-testid="lift-name">' + esc(e.name) + '</h1>' +
      demoHTML(e, 'lift-demo') +
      '<p class="cue" data-testid="lift-cue">' + esc(e.cue) + '</p>' +
      main + after +
      '<div class="actions row">' +
      '<button type="button" class="quiet" data-testid="lift-swap" data-act="swap-toggle">' + esc(S.lift.swap) + '</button>' +
      '<button type="button" class="quiet" data-testid="lift-add" data-act="add-toggle">' + esc(S.lift.add) + '</button>' +
      '<button type="button" class="quiet" data-testid="lift-end" data-act="end">' + esc(S.lift.end) + '</button></div>' +
      panel +
      '</main>';
  }

  function doneHTML() {
    const S = STR();
    const st = db.state;
    const w = st.workouts.find(x => x.id === V.doneId);
    if (!w) return '<main data-screen="done" class="screen"></main>';
    const exCount = new Set(w.sets.map(s => s.exerciseId)).size;
    const best = Coach.newBests({ workouts: st.workouts, workoutId: w.id });
    const feels = [['easy', 'easy'], ['right', 'right'], ['much', 'much']];
    return '<main data-screen="done" class="screen">' +
      '<p class="summary" data-testid="done-summary" data-line>' + esc(fmt(S.done.summary, { exercises: exCount, sets: w.sets.length })) + '</p>' +
      (best.length ? '<p class="best" data-testid="done-best" data-line>' + esc(S.done.newBest) + '</p>' : '') +
      '<p id="feel-q">' + esc(S.done.question) + '</p>' +
      '<div class="faces" role="group" aria-labelledby="feel-q">' + feels.map(f =>
        '<button type="button" class="face" data-testid="feel-' + f[0] + '" data-act="feel" data-feel="' + f[1] + '" aria-pressed="' + (w.feel === f[1]) + '">' + esc(S.done[f[1]]) + '</button>').join('') + '</div>' +
      '<button type="button" class="primary" data-testid="done-back" data-act="back">' + esc(S.done.back) + '</button>' +
      '</main>';
  }

  function render() {
    let html = '';
    if (V.screen === 'goal') html = goalHTML();
    else if (V.screen === 'pick') html = pickHTML();
    else if (V.screen === 'lift') html = liftHTML();
    else if (V.screen === 'done') html = doneHTML();
    else html = '<main data-screen="error" class="screen"><p class="error" role="alert">' + esc(STR().errors.storage) + '</p></main>';
    root.innerHTML = html;
  }

  // ---------- rest timer ----------
  function stopTimer() {
    if (timerId !== null) { opt.timers.clearInterval(timerId); timerId = null; }
  }
  function updateTimer() {
    if (V.screen !== 'lift' || V.restStart === null) return;
    const rem = remainingNow();
    const el = root.querySelector('[data-testid="rest-timer"]');
    if (el) {
      el.setAttribute('data-remaining', String(rem));
      const t = el.querySelector('[data-role="time"]');
      if (t) t.textContent = clockText(rem);
    }
    if (rem === 0) {
      if (!V.vibrated) { V.vibrated = true; try { opt.platform.vibrate(cfg().vibrateMs); } catch (e) { /* ignore */ } }
      stopTimer();
    }
  }
  function startTimer() {
    stopTimer();
    timerId = opt.timers.setInterval(updateTimer, cfg().tickMs);
  }

  // ---------- screen changes ----------
  function showGoal() {
    stopTimer();
    V.screen = 'goal';
    V.goals = [];
    V.name = '';
    V.profileError = false;
    render();
  }
  function showPick() {
    stopTimer();
    const st = db.state;
    const r = Coach.suggest({ exercises: BEGINNER_EXERCISES, goalFocuses: goalFocuses(st), excludedEquipment: st.excludedEquipment, workouts: st.workouts, now: now() });
    V.list = r.list.slice();
    V.ticked = r.ticked.slice();
    V.search = '';
    V.confirm = null;
    V.importError = false;
    V.screen = 'pick';
    render();
  }
  function showDone(id) {
    stopTimer();
    V.doneId = id;
    V.screen = 'done';
    render();
  }

  function computePrefill() {
    const w = db.activeWorkout();
    const e = exOf(V.curId);
    const units = unitsNow();
    const p = Coach.prefill({ exercise: e, workouts: db.state.workouts, currentWorkoutId: w.id, units, now: now() });
    V.rule = p.rule;
    V.w = p.weightKg === null || p.weightKg === undefined ? null : toDisp(p.weightKg, e, units);
    V.r = p.reps === null || p.reps === undefined ? null : p.reps;
    V.touched = false;
  }
  function resumeId(w) {
    let best = null;
    w.sets.forEach(s => { if (w.plan.indexOf(s.exerciseId) !== -1 && (best === null || s.at >= best.at)) best = s; });
    return best ? best.exerciseId : (w.plan[0] || null);
  }
  function showLift() {
    const w = db.activeWorkout();
    const id = w ? resumeId(w) : null;
    if (!id || !exOf(id)) { showPick(); return; }
    V.curId = id;
    V.lastIndex = null;
    V.restStart = null;
    V.vibrated = false;
    V.panel = null;
    V.moreFor = null;
    V.saveError = false;
    computePrefill();
    stopTimer();
    V.screen = 'lift';
    render();
  }

  async function route() {
    const st = db.state;
    if (!st.onboarded) { showGoal(); return; }
    let w = db.activeWorkout();
    if (w) {
      const last = w.sets.reduce((a, s) => Math.max(a, s.at), w.startedAt);
      if (now() - last > cfg().staleWorkoutHours * HOUR_MS) {
        try { await db.endWorkout({ now: now(), feel: null }); } catch (e) { /* keep it open and resume */ }
        w = db.activeWorkout();
      }
    }
    if (w) showLift(); else showPick();
  }

  // ---------- actions ----------
  async function finishGoal(useGoals) {
    const keys = Object.keys(BEGINNER_GOALS);
    const goals = useGoals ? keys.filter(k => V.goals.indexOf(k) !== -1) : [];
    try {
      await db.setProfile({ goals, name: V.name.trim(), onboarded: true });
    } catch (e) {
      V.profileError = true;
      render();
      return;
    }
    showPick();
  }

  const cardOrder = () => V.list.filter(id => V.ticked.indexOf(id) !== -1);

  async function startWorkout() {
    const plan = cardOrder();
    if (!plan.length) return;
    try { await db.startWorkout({ plan, now: now() }); } catch (e) { render(); return; }
    showLift();
  }

  async function missing(id) {
    const e = exOf(id);
    if (!e || e.equipKey === 'none') return;
    try { await db.excludeEquipment(e.equipKey); } catch (err) { render(); return; }
    const st = db.state;
    const r = Coach.refill({
      exercises: BEGINNER_EXERCISES, goalFocuses: goalFocuses(st), excludedEquipment: st.excludedEquipment,
      workouts: st.workouts, now: now(), current: { list: V.list.slice(), ticked: cardOrder() },
    });
    V.list = r.list.slice();
    V.ticked = r.ticked.slice();
    render();
  }

  function repeatLast() {
    const st = db.state;
    const fin = st.workouts.map((w, i) => ({ w, i })).filter(x => x.w.endedAt !== null)
      .sort((a, b) => (a.w.startedAt - b.w.startedAt) || (a.i - b.i));
    if (!fin.length) return;
    const last = fin[fin.length - 1].w;
    const sets = last.sets.map((s, i) => ({ s, i })).sort((a, b) => (a.s.at - b.s.at) || (a.i - b.i)).map(x => x.s);
    const ids = [];
    sets.forEach(s => { if (ids.indexOf(s.exerciseId) === -1) ids.push(s.exerciseId); });
    const ok = ids.filter(id => exOf(id) && eligible(exOf(id), st.excludedEquipment));
    ok.forEach(id => { if (V.list.indexOf(id) === -1) V.list.push(id); });
    V.ticked = ok;
    render();
  }

  async function doExport() {
    try {
      await opt.platform.saveFile(BEGINNER_CONFIG.store.exportApp + '-' + dayText(now()) + '.json', db.exportData({ now: now() }));
    } catch (e) { /* nothing was saved; nothing changes */ }
  }
  async function doImportPick() {
    let text = null;
    try { text = await opt.platform.pickFile(); } catch (e) { text = null; }
    if (typeof text !== 'string') return;
    V.confirm = text;
    V.importError = false;
    render();
  }
  async function doImportYes() {
    const text = V.confirm;
    V.confirm = null;
    try {
      await db.importData(text);
    } catch (e) {
      V.importError = true;
      render();
      return;
    }
    V.importError = false;
    await route();
  }

  async function logDone() {
    if (V.busy || !(V.r >= 1)) return;
    const e = exOf(V.curId);
    const units = unitsNow();
    V.busy = true;
    try {
      const at = now();
      await db.logSet({ exerciseId: e.id, weightKg: toKg(V.w || 0, units), reps: V.r, effort: null, now: at });
      V.saveError = false;
      V.restStart = at;
      V.vibrated = false;
      V.lastIndex = db.activeWorkout().sets.length - 1;
      V.moreFor = null;
      computePrefill();
      startTimer();
    } catch (err) {
      V.saveError = true;
    }
    V.busy = false;
    render();
  }

  async function setFace(effort) {
    if (V.lastIndex === null) return;
    try { await db.setEffort({ index: V.lastIndex, effort }); } catch (e) { render(); return; }
    if (!V.touched) computePrefill();
    render();
  }

  function stepWeight(dir) {
    const e = exOf(V.curId);
    const inc = stepOf(e, unitsNow());
    V.w = dir > 0 ? round6((V.w || 0) + inc) : (V.w === null ? null : Math.max(0, round6(V.w - inc)));
    V.touched = true;
    render();
  }
  function stepReps(dir) {
    V.r = dir > 0 ? (V.r || 0) + 1 : (V.r === null ? null : Math.max(0, V.r - 1));
    V.touched = true;
    render();
  }

  function nextExercise() {
    const w = db.activeWorkout();
    const idx = w.plan.indexOf(V.curId);
    if (idx === -1 || idx >= w.plan.length - 1) return;
    V.curId = w.plan[idx + 1];
    V.moreFor = null;
    V.panel = null;
    V.saveError = false;
    computePrefill();
    render();
  }

  async function endAndShow() {
    const w = db.activeWorkout();
    if (!w) { showPick(); return; }
    const id = w.id;
    try { await db.endWorkout({ now: now(), feel: null }); } catch (e) { render(); return; }
    if (db.state.workouts.some(x => x.id === id)) showDone(id); else showPick();
  }

  async function swapPick(id) {
    const w = db.activeWorkout();
    const plan = w.plan.map(x => (x === V.curId ? id : x));
    try { await db.updatePlan(plan); } catch (e) { render(); return; }
    V.curId = id;
    V.panel = null;
    V.moreFor = null;
    computePrefill();
    render();
  }
  async function addPick(id) {
    const w = db.activeWorkout();
    try { await db.updatePlan(w.plan.concat(id)); } catch (e) { render(); return; }
    V.panel = null;
    render();
  }

  async function handle(act, el) {
    switch (act) {
      case 'tile': {
        const k = el.getAttribute('data-goal');
        V.goals = V.goals.indexOf(k) === -1 ? V.goals.concat(k) : V.goals.filter(x => x !== k);
        // In place: tiles keep their identity so quick taps never hit a replaced node.
        el.setAttribute('aria-pressed', String(V.goals.indexOf(k) !== -1));
        return;
      }
      case 'continue': return finishGoal(true);
      case 'skip': return finishGoal(false);
      case 'tick': {
        const id = el.getAttribute('data-id');
        V.ticked = el.checked ? V.ticked.concat(id) : V.ticked.filter(x => x !== id);
        render();
        return;
      }
      case 'missing': return missing(el.getAttribute('data-id'));
      case 'start': return startWorkout();
      case 'repeat': return repeatLast();
      case 'result': {
        const id = el.getAttribute('data-id');
        if (V.list.indexOf(id) === -1) V.list.push(id);
        if (V.ticked.indexOf(id) === -1) V.ticked.push(id);
        render();
        return;
      }
      case 'restore': {
        try { await db.restoreEquipment(el.getAttribute('data-key')); } catch (e) { /* unchanged */ }
        render();
        return;
      }
      case 'export': return doExport();
      case 'import': return doImportPick();
      case 'confirm-yes': return doImportYes();
      case 'confirm-no': V.confirm = null; render(); return;
      case 'w-': return stepWeight(-1);
      case 'w+': return stepWeight(1);
      case 'r-': return stepReps(-1);
      case 'r+': return stepReps(1);
      case 'done-set': return logDone();
      case 'face': return setFace(el.getAttribute('data-effort'));
      case 'one-more': {
        const w = db.activeWorkout();
        V.moreFor = w.sets.filter(s => s.exerciseId === V.curId).length;
        render();
        return;
      }
      case 'next': return nextExercise();
      case 'finish':
      case 'end': return endAndShow();
      case 'swap-toggle': V.panel = V.panel === 'swap' ? null : 'swap'; render(); return;
      case 'add-toggle': V.panel = V.panel === 'add' ? null : 'add'; render(); return;
      case 'swap-pick': return swapPick(el.getAttribute('data-id'));
      case 'add-pick': return addPick(el.getAttribute('data-id'));
      case 'feel': {
        try { await db.setFeel(V.doneId, el.getAttribute('data-feel')); } catch (e) { /* unchanged */ }
        render();
        return;
      }
      case 'back': showPick(); return;
      default: return;
    }
  }

  function onClick(ev) {
    const t = ev.target;
    const el = t && t.closest ? t.closest('[data-act]') : null;
    if (!el || el.disabled) return;
    handle(el.getAttribute('data-act'), el).catch(() => { /* a failed write leaves the screen as it was */ });
  }
  function onInput(ev) {
    const t = ev.target;
    if (!t || !t.getAttribute) return;
    const id = t.getAttribute('data-testid');
    if (id === 'name-input') V.name = t.value;
    else if (id === 'pick-search') {
      V.search = t.value;
      const region = root.querySelector('[data-region="results"]');
      if (region) region.innerHTML = resultsHTML();
    }
  }

  // ---------- boot ----------
  async function boot(opts) {
    const o = opts || {};
    if (typeof BEGINNER_GOALS === 'undefined' || typeof BEGINNER_EXERCISES === 'undefined' || typeof BEGINNER_STRINGS === 'undefined') {
      throw new Error('Beginner data files are missing; not opening the store');
    }
    const win = (o.root && o.root.ownerDocument && o.root.ownerDocument.defaultView) || window;
    const doc = win.document;
    root = o.root || doc.getElementById('app');
    const dflt = defaultPlatform(win);
    opt = {
      clock: o.clock || (() => win.Date.now()),
      locale: o.locale || (win.navigator && win.navigator.language) || '',
      timers: o.timers || { setInterval: (fn, ms) => win.setInterval(fn, ms), clearInterval: id => win.clearInterval(id) },
      platform: Object.assign({}, dflt, o.platform || {}),
      media: o.media || { items: {} },
    };
    byId = {};
    BEGINNER_EXERCISES.forEach(e => { byId[e.id] = e; });
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    doc.addEventListener('visibilitychange', updateTimer);
    try {
      db = await Store.open(o.adapter || Store.idbAdapter());
    } catch (e) {
      V.screen = 'error';
      render();
      return;
    }
    await route();
  }

  return { boot };
})();

// Pure coaching logic: inputs in, results out. No browser, storage or clock access.
// Time arrives as `now` (epoch ms). Every threshold is read from BEGINNER_CONFIG.coach
// at call time. Inputs may be deep-frozen: nothing here mutates an input.
const Coach = (function () {
  const MS_PER_DAY = 864e5;
  const EPS = 1e-9;
  const cfg = () => BEGINNER_CONFIG.coach;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  // ---------- small helpers ----------
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  // Stable order on a copy: by key, ties by array index.
  function ordered(list, keyOf) {
    return (list || [])
      .map((v, i) => ({ v, i, k: keyOf(v) || 0 }))
      .sort((a, b) => (a.k - b.k) || (a.i - b.i))
      .map(x => x.v);
  }
  const workoutsInOrder = ws => ordered(ws, w => w.startedAt);
  const isWorking = s => !s.extra && s.reps > 0;

  function effortRpe(effort) {
    const m = cfg().effortRpe;
    return typeof effort === 'string' && has(m, effort) ? m[effort] : cfg().defaultRpe;
  }

  const factorFor = units => (units === 'lb' ? KG_PER_LB : 1);
  function stepDisplay(equipment, units) {
    const t = cfg().increments[units === 'lb' ? 'lb' : 'kg'] || {};
    return has(t, equipment) ? t[equipment] : 0;
  }
  function incrementKg(equipment, units) {
    return stepDisplay(equipment, units) * factorFor(units);
  }

  // Grid math happens in display units; the result goes back to kg.
  function gridUp(wKg, equipment, units) {
    const inc = stepDisplay(equipment, units), f = factorFor(units);
    if (!(inc > 0)) return wKg;
    return Math.floor((wKg / f + inc) / inc + EPS) * inc * f;
  }
  function gridDown(wKg, equipment, units) {
    const inc = stepDisplay(equipment, units), f = factorFor(units);
    if (!(inc > 0)) return wKg;
    return Math.max(inc, Math.ceil((wKg / f - inc) / inc - EPS) * inc) * f;
  }

  const isRepsOnly = equipment => cfg().repsOnlyEquipment.indexOf(equipment) !== -1;

  // Sessions of one exercise from ordered workouts. Each has its ordered non-extra
  // sets, its top weight, the working sets at that weight and first/last set times.
  function sessionsOf(exerciseId, workouts) {
    const out = [];
    for (const w of workouts) {
      const sets = ordered((w.sets || []).filter(s => s.exerciseId === exerciseId && isWorking(s)), s => s.at);
      if (!sets.length) continue;
      const top = Math.max(...sets.map(s => s.weightKg));
      out.push({
        sets, top,
        working: sets.filter(s => Math.abs(s.weightKg - top) < 1e-6),
        firstAt: sets[0].at,
        lastAt: sets[sets.length - 1].at,
      });
    }
    return out;
  }

  const repsAt = (reps, k) => reps[Math.min(k, reps.length - 1)];

  // The target a session earns for the next time. `nowAt` is the clock for the gap rule.
  function targetAfter(sess, shortCount, nowAt, exercise, units) {
    const c = cfg();
    const [lo, hi] = c.repRange;
    const [rlo, rhi] = c.repsOnlyRange;
    const eq = exercise.equipment;
    const r = sess.working.map(s => s.reps);
    const gap = nowAt - sess.lastAt > c.longGapDays * MS_PER_DAY;
    if (isRepsOnly(eq)) {
      return gap
        ? { weight: sess.top, reps: r.map(x => clamp(x, rlo, rhi)), rule: 'gap' }
        : { weight: sess.top, reps: r.map(x => clamp(x + 1, rlo, rhi)), rule: 'reps' };
    }
    if (gap) return { weight: sess.top, reps: r.map(x => clamp(x, lo, hi)), rule: 'gap' };
    const t = r.map(x => clamp(x + 1, lo, hi));
    if (shortCount >= c.holdsBeforeDrop + 1) {
      return { weight: gridDown(sess.top, eq, units), reps: t, rule: 'drop' };
    }
    if (sess.working.every(s => s.reps >= hi && s.effort !== 'hard')) {
      return { weight: gridUp(sess.top, eq, units), reps: r.map(() => lo), rule: 'raise' };
    }
    return { weight: sess.top, reps: t, rule: 'reps' };
  }

  // Replays the history session by session and returns the target for the next one.
  function sessionTarget(exercise, histSessions, units, now) {
    let target = null, shortCount = 0;
    for (let j = 0; j < histSessions.length; j++) {
      const sess = histSessions[j];
      let isShort = false;
      if (target && Math.abs(sess.top - target.weight) < 1e-6) {
        isShort = sess.working.some((s, i) => s.reps <= repsAt(target.reps, i) - cfg().shortfallReps);
      }
      const before = target && (target.rule === 'drop' || target.rule === 'gap') ? 0 : shortCount;
      shortCount = isShort ? before + 1 : 0;
      const nowAt = j + 1 < histSessions.length ? histSessions[j + 1].firstAt : now;
      target = targetAfter(sess, shortCount, nowAt, exercise, units);
    }
    return target;
  }

  function prefill(args) {
    const c = cfg();
    const exercise = args.exercise;
    const units = args.units;
    const cur = args.currentWorkoutId;
    const ws = workoutsInOrder(args.workouts);
    const histSessions = sessionsOf(exercise.id, ws.filter(w => w.id !== cur));
    const todayW = cur == null ? null : ws.find(w => w.id === cur);
    const today = todayW ? sessionsOf(exercise.id, [todayW]) : [];
    const todaySets = today.length ? today[0].sets : [];
    const target = sessionTarget(exercise, histSessions, units, args.now);

    if (!todaySets.length) {
      if (!target) return { weightKg: null, reps: null, rule: 'first' };
      return { weightKg: target.weight, reps: target.reps[0], rule: target.rule };
    }

    const first = todaySets[0];
    const last = todaySets[todaySets.length - 1];
    if (todaySets.length === 1 && first.effort === 'easy' && first.reps >= c.easyTriggerReps
        && !isRepsOnly(exercise.equipment)) {
      const inc = incrementKg(exercise.equipment, units);
      if (inc > 0) {
        const x = Engine.weightFor(Engine.e1rm(first.weightKg, first.reps, effortRpe('easy')),
          c.easyTargetReps, c.easyTargetRpe, inc);
        if (x > first.weightKg) return { weightKg: x, reps: c.easyTargetReps, rule: 'easy' };
      }
    }
    const reps = target && Math.abs(last.weightKg - target.weight) < 1e-6
      ? repsAt(target.reps, todaySets.length) : last.reps;
    return { weightKg: last.weightKg, reps, rule: 'session' };
  }

  function setCount(args) {
    const c = cfg();
    const hist = (args.workouts || []).filter(w => w.id !== args.currentWorkoutId);
    const n = sessionsOf(args.exerciseId, hist).length;
    return clamp(n < c.setsFirstSessions ? c.setsFirst : c.setsAfter, c.setsMin, c.setsMax);
  }

  function newBests(args) {
    const ws = workoutsInOrder(args.workouts);
    const target = ws.find(w => w.id === args.workoutId);
    if (!target) return [];
    const est = s => Engine.e1rm(s.weightKg, s.reps, effortRpe(s.effort));
    const prior = {};
    for (const w of ws) {
      if (!(w.startedAt < target.startedAt)) continue;
      for (const s of w.sets || []) {
        if (!isWorking(s)) continue;
        prior[s.exerciseId] = Math.max(has(prior, s.exerciseId) ? prior[s.exerciseId] : 0, est(s));
      }
    }
    const today = {}, order = [];
    for (const s of ordered((target.sets || []).filter(isWorking), s => s.at)) {
      if (!has(today, s.exerciseId)) { today[s.exerciseId] = 0; order.push(s.exerciseId); }
      today[s.exerciseId] = Math.max(today[s.exerciseId], est(s));
    }
    return order.filter(id => has(prior, id) && prior[id] > 0 && today[id] - prior[id] > 1e-9);
  }

  // ---------- Pick ----------
  const isEligible = (row, excluded) => row.equipKey === 'none' || excluded.indexOf(row.equipKey) === -1;

  // Eligible starters (or, when there are none, eligible rows) ranked: round, goal
  // focus, muscle order, input order.
  function rank(args) {
    const c = cfg();
    const excluded = args.excludedEquipment || [];
    const rows = (args.exercises || []).filter(r => isEligible(r, excluded));
    const starters = rows.filter(r => r.starter);
    const pool = starters.length ? starters : rows;
    const goals = args.goalFocuses || [];
    const focusOf = m => {
      if (!goals.length) return 2;
      return Math.max(...goals.map(g => (g && has(g, m) ? g[m] : 0)));
    };
    const seen = {};
    const items = pool.map((r, i) => {
      const round = has(seen, r.muscle) ? seen[r.muscle] : 0;
      seen[r.muscle] = round + 1;
      const mo = c.muscleOrder.indexOf(r.muscle);
      return { r, i, round, focus: focusOf(r.muscle), mo: mo === -1 ? c.muscleOrder.length : mo };
    });
    items.sort((a, b) => (a.round - b.round) || (b.focus - a.focus) || (a.mo - b.mo) || (a.i - b.i));
    return items.map(x => x.r);
  }

  function suggest(args) {
    const c = cfg();
    const list = rank(args).slice(0, c.suggestCount);
    const ticked = new Set();
    for (const g of args.goalFocuses || []) {
      if (ticked.size >= c.tickCount) break;
      if (!g || !Object.keys(g).some(m => g[m] === 3)) continue;
      const serves = r => g[r.muscle] === 3;
      if (list.some(r => ticked.has(r.id) && serves(r))) continue;
      const hit = list.find(serves);
      if (hit) ticked.add(hit.id);
    }
    for (const r of list) {
      if (ticked.size >= c.tickCount) break;
      ticked.add(r.id);
    }
    return { list: list.map(r => r.id), ticked: list.filter(r => ticked.has(r.id)).map(r => r.id) };
  }

  function refill(args) {
    const c = cfg();
    const excluded = args.excludedEquipment || [];
    const eligible = new Set((args.exercises || []).filter(r => isEligible(r, excluded)).map(r => r.id));
    const curList = (args.current && args.current.list) || [];
    const tickSet = new Set((args.current && args.current.ticked) || []);
    const candidates = rank(args).map(r => r.id).filter(id => curList.indexOf(id) === -1);
    const list = [], ticked = new Set();
    for (const id of curList) {
      if (eligible.has(id)) {
        list.push(id);
        if (tickSet.has(id)) ticked.add(id);
      } else if (candidates.length) {
        const n = candidates.shift();
        list.push(n);
        if (tickSet.has(id)) ticked.add(n);
      }
    }
    while (list.length < c.suggestCount && candidates.length) list.push(candidates.shift());
    return { list, ticked: list.filter(id => ticked.has(id)) };
  }

  function excludeEquipment(excluded, key) {
    const out = (excluded || []).slice();
    if (key !== 'none' && out.indexOf(key) === -1) out.push(key);
    return out;
  }
  function restoreEquipment(excluded, key) {
    return (excluded || []).filter(k => k !== key);
  }

  return { effortRpe, incrementKg, prefill, setCount, newBests, suggest, refill, excludeEquipment, restoreEquipment };
})();

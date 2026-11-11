// Persistence layer (package 3): versioned state, migration, adapters, session,
// export and import. No DOM, no network. Storage is reached only through an adapter
// with two async methods, get(key) and set(key, value). Config comes from
// BEGINNER_CONFIG.store (schemaVersion, key, dbName, storeName, exportApp,
// memoKeys, writeTimeoutMs).
const Store = (function () {
  const goalKeys = () => (typeof BEGINNER_GOALS !== 'undefined' ? Object.keys(BEGINNER_GOALS) : []);
  const EFFORTS = ['easy', 'good', 'hard'];
  const FEELS = ['easy', 'right', 'much'];
  const UNITS = ['kg', 'lb'];

  const cfg = () => BEGINNER_CONFIG.store;
  const fail = (code, message) => { const e = new Error(message || code); e.code = code; return e; };
  const noStorage = cause => { const e = fail('E_NO_STORAGE', 'Storage is not available'); e.cause = cause; return e; };
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const isStr = v => typeof v === 'string';
  const isNum = v => typeof v === 'number' && Number.isFinite(v);
  const isScalar = v => v === null || isStr(v) || typeof v === 'boolean' || isNum(v);
  const uniq = a => Array.from(new Set(a));
  const noNegZero = n => (n === 0 ? 0 : n);
  const defProp = (o, k, v) => Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });

  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.values(o).forEach(deepFreeze); Object.freeze(o); }
    return o;
  }

  function defaultState() {
    return { version: cfg().schemaVersion, name: '', goals: [], onboarded: false, excludedEquipment: [], units: null, memo: {}, workouts: [] };
  }

  function cleanSet(s) {
    if (!isObj(s) || !isStr(s.exerciseId) || !isNum(s.weightKg) || s.weightKg < 0 || !Number.isInteger(s.reps) || s.reps < 0) return null;
    const out = { exerciseId: s.exerciseId, weightKg: noNegZero(s.weightKg), reps: s.reps, effort: EFFORTS.includes(s.effort) ? s.effort : null, at: isNum(s.at) ? noNegZero(s.at) : 0 };
    if (s.extra === true) out.extra = true;
    return out;
  }

  const lastAt = w => w.sets.reduce((m, x) => Math.max(m, x.at), w.startedAt);

  // endedAt is null only for a null or missing endedAt; anything else is closed.
  function cleanWorkout(w) {
    if (!isObj(w) || !isStr(w.id) || w.id === '' || !isNum(w.startedAt)) return null;
    const c = {
      id: w.id,
      startedAt: noNegZero(w.startedAt),
      endedAt: null,
      feel: FEELS.includes(w.feel) ? w.feel : null,
      plan: Array.isArray(w.plan) ? w.plan.filter(isStr) : [],
      sets: Array.isArray(w.sets) ? w.sets.map(cleanSet).filter(Boolean) : [],
    };
    if (w.endedAt !== null && w.endedAt !== undefined) c.endedAt = noNegZero(isNum(w.endedAt) ? Math.max(w.endedAt, c.startedAt) : lastAt(c));
    return c;
  }

  // Pure core: never mutates raw, shares no references with it, throws only
  // E_NEWER_VERSION. Also counts what was dropped (for the import summary).
  function migrateCounted(raw) {
    const out = defaultState();
    let droppedWorkouts = 0;
    let droppedSets = 0;
    if (!isObj(raw)) return { state: out, droppedWorkouts, droppedSets };
    if (Number.isInteger(raw.version) && raw.version > cfg().schemaVersion) throw fail('E_NEWER_VERSION', 'Saved data is from a newer version');
    if (isStr(raw.name)) out.name = raw.name;
    if (Array.isArray(raw.goals)) out.goals = uniq(raw.goals.filter(g => goalKeys().includes(g)));
    if (typeof raw.onboarded === 'boolean') out.onboarded = raw.onboarded;
    if (Array.isArray(raw.excludedEquipment)) out.excludedEquipment = uniq(raw.excludedEquipment.filter(isStr));
    if (UNITS.includes(raw.units)) out.units = raw.units;
    if (isObj(raw.memo)) {
      // Walk the whitelist, never the raw keys, so a hostile key is never touched.
      for (const k of cfg().memoKeys) {
        const v = Object.prototype.hasOwnProperty.call(raw.memo, k) ? raw.memo[k] : undefined;
        if (isScalar(v)) defProp(out.memo, k, isNum(v) ? noNegZero(v) : v);
      }
    }
    if (Array.isArray(raw.workouts)) {
      const list = raw.workouts.map(cleanWorkout).filter(Boolean);
      // One open workout survives: the latest-started (a tie goes to the later in the list).
      let keep = null;
      for (const w of list) if (w.endedAt === null && (!keep || w.startedAt >= keep.startedAt)) keep = w;
      const used = new Set(list.map(w => w.id));
      const seen = new Set();
      const counter = new Map();
      for (const w of list) {
        if (w.endedAt === null && w !== keep) {
          if (w.sets.length === 0) continue;
          w.endedAt = noNegZero(lastAt(w));
          w.feel = null;
        }
        if (seen.has(w.id)) {
          // A running counter per base id keeps renaming linear.
          let n = counter.get(w.id) || 0;
          let id;
          do { n++; id = w.id + '-' + n; } while (used.has(id) || seen.has(id));
          counter.set(w.id, n);
          w.id = id;
        }
        seen.add(w.id);
        out.workouts.push(w);
      }
      const rawSets = raw.workouts.reduce((n, w) => n + (isObj(w) && Array.isArray(w.sets) ? w.sets.length : 0), 0);
      droppedWorkouts = raw.workouts.length - out.workouts.length;
      droppedSets = rawSets - out.workouts.reduce((n, w) => n + w.sets.length, 0);
    }
    return { state: out, droppedWorkouts, droppedSets };
  }

  const migrate = raw => migrateCounted(raw).state;

  function memoryAdapter(initial) {
    const m = new Map();
    if (initial) for (const k of Object.keys(initial)) m.set(k, structuredClone(initial[k]));
    return {
      get: async k => (m.has(k) ? structuredClone(m.get(k)) : undefined),
      set: async (k, v) => { m.set(k, structuredClone(v)); },
    };
  }

  // Real IndexedDB: one database, one object store, opened lazily on first use.
  function idbAdapter(opts) {
    const name = (opts && opts.name) || cfg().dbName;
    const storeName = (opts && opts.storeName) || cfg().storeName;
    let dbp = null;
    function db() {
      if (dbp) return dbp;
      const p = new Promise((resolve, reject) => {
        const idb = globalThis.indexedDB;
        if (!idb) { reject(noStorage()); return; }
        let rq;
        try { rq = idb.open(name, 1); } catch (e) { reject(noStorage(e)); return; }
        rq.onupgradeneeded = () => { rq.result.createObjectStore(storeName); };
        rq.onsuccess = () => {
          const d = rq.result;
          const drop = () => { try { d.close(); } catch (e) { /* already closed */ } if (dbp === p) dbp = null; };
          d.onclose = drop;
          d.onversionchange = drop;
          resolve(d);
        };
        rq.onerror = () => reject(noStorage(rq.error));
        rq.onblocked = () => reject(noStorage());
      });
      dbp = p;
      p.catch(() => { if (dbp === p) dbp = null; });
      return p;
    }
    function attempt(d, mode, op) {
      return new Promise((resolve, reject) => {
        let tx;
        let rq;
        const timer = setTimeout(() => {
          // If abort throws the commit is under way: let complete or abort decide.
          try { tx.abort(); } catch (e) { return; }
          reject(fail('E_STORAGE', 'Storage timed out'));
        }, cfg().writeTimeoutMs);
        const end = (f, v) => { clearTimeout(timer); f(v); };
        try {
          if (mode === 'readwrite') {
            try { tx = d.transaction(storeName, mode, { durability: 'strict' }); } catch (e) { tx = d.transaction(storeName, mode); }
          } else {
            tx = d.transaction(storeName, mode);
          }
          rq = op(tx.objectStore(storeName));
        } catch (e) { end(reject, e); return; }
        tx.oncomplete = () => end(resolve, rq.result);
        tx.onerror = () => end(reject, tx.error || fail('E_STORAGE', 'Storage error'));
        tx.onabort = () => end(reject, tx.error || fail('E_STORAGE', 'Write aborted'));
      });
    }
    // A closed connection cannot start a transaction: reopen and retry once.
    function run(mode, op, retried) {
      return db().then(d => attempt(d, mode, op)).catch(e => {
        if (!retried && e && e.name === 'InvalidStateError') { dbp = null; return run(mode, op, true); }
        throw e;
      });
    }
    return {
      get: key => run('readonly', s => s.get(key)),
      set: (key, value) => run('readwrite', s => s.put(value, key)).then(() => undefined),
    };
  }

  async function open(adapter) {
    const key = cfg().key;
    let state = deepFreeze(migrate(await adapter.get(key)));
    let chain = Promise.resolve();

    // Serialised in call order. The change is built on a copy and committed in
    // memory (frozen) only after adapter.set resolved, so a failed write leaves
    // state intact.
    function mutate(fn) {
      const run = chain.then(async () => {
        let next = structuredClone(state);
        const r = fn(next);
        if (r && r.state) next = r.state;
        if (r && r.skipWrite) return r.result;
        await adapter.set(key, structuredClone(next));
        state = deepFreeze(next);
        return r ? r.result : undefined;
      });
      chain = run.then(() => undefined, () => undefined);
      return run;
    }

    const active = s => s.workouts.find(w => w.endedAt === null) || null;
    const needActive = s => { const w = active(s); if (!w) throw fail('E_NO_WORKOUT', 'No workout in progress'); return w; };
    const goodPlan = p => Array.isArray(p) && p.every(isStr);

    return {
      get state() { return state; },
      activeWorkout: () => active(state),

      setProfile: patch => mutate(s => {
        const p = patch || {};
        const has = k => Object.prototype.hasOwnProperty.call(p, k);
        if (has('name') && !isStr(p.name)) throw fail('E_BAD_PROFILE', 'Bad name');
        if (has('goals') && !Array.isArray(p.goals)) throw fail('E_BAD_PROFILE', 'Bad goals');
        if (has('onboarded') && typeof p.onboarded !== 'boolean') throw fail('E_BAD_PROFILE', 'Bad onboarded flag');
        if (has('units') && p.units !== null && !UNITS.includes(p.units)) throw fail('E_BAD_PROFILE', 'Bad units');
        for (const k of ['name', 'goals', 'onboarded', 'units']) if (has(k)) s[k] = p[k];
        return { state: migrate(s) };
      }),

      setMemo: (k, v) => mutate(s => {
        if (!isStr(k) || !cfg().memoKeys.includes(k) || !isScalar(v)) throw fail('E_BAD_MEMO', 'Bad memo');
        defProp(s.memo, k, v);
      }),

      excludeEquipment: item => mutate(s => {
        if (!isStr(item) || item === '') throw fail('E_BAD_EQUIPMENT', 'Bad equipment');
        s.excludedEquipment = uniq(s.excludedEquipment.concat(item));
      }),

      restoreEquipment: item => mutate(s => {
        s.excludedEquipment = s.excludedEquipment.filter(e => e !== item);
      }),

      startWorkout: o => mutate(s => {
        const cur = active(s);
        if (cur) return { skipWrite: true, result: cur.id };
        if (!o || !goodPlan(o.plan) || !isNum(o.now)) throw fail('E_BAD_WORKOUT', 'Bad workout');
        const base = 'w' + o.now.toString(36);
        let id = base;
        for (let n = 1; s.workouts.some(w => w.id === id); n++) id = base + '-' + n;
        s.workouts.push({ id, startedAt: o.now, endedAt: null, feel: null, plan: o.plan.slice(), sets: [] });
        return { result: id };
      }),

      logSet: o => mutate(s => {
        const w = needActive(s);
        const x = o || {};
        const effort = x.effort === undefined ? null : x.effort;
        if (!isStr(x.exerciseId) || x.exerciseId === '' || !isNum(x.weightKg) || x.weightKg < 0 ||
            !Number.isInteger(x.reps) || x.reps < 0 || !isNum(x.now) || (effort !== null && !EFFORTS.includes(effort))) {
          throw fail('E_BAD_SET', 'Bad set');
        }
        const set = { exerciseId: x.exerciseId, weightKg: noNegZero(x.weightKg), reps: x.reps, effort, at: x.now };
        if (x.extra === true) set.extra = true;
        w.sets.push(set);
      }),

      setEffort: o => mutate(s => {
        const w = needActive(s);
        const x = o || {};
        if (!Number.isInteger(x.index) || x.index < 0 || x.index >= w.sets.length || (x.effort !== null && !EFFORTS.includes(x.effort))) {
          throw fail('E_BAD_SET', 'Bad effort');
        }
        w.sets[x.index].effort = x.effort;
      }),

      updatePlan: plan => mutate(s => {
        const w = needActive(s);
        if (!goodPlan(plan)) throw fail('E_BAD_WORKOUT', 'Bad plan');
        w.plan = plan.slice();
      }),

      endWorkout: o => mutate(s => {
        const w = needActive(s);
        const x = o || {};
        const feel = x.feel === undefined ? null : x.feel;
        if (!isNum(x.now) || (feel !== null && !FEELS.includes(feel))) throw fail('E_BAD_WORKOUT', 'Bad workout end');
        if (w.sets.length === 0) { s.workouts = s.workouts.filter(v => v !== w); return; }
        w.endedAt = Math.max(x.now, w.startedAt);
        w.feel = feel;
      }),

      setFeel: (id, feel) => mutate(s => {
        const w = s.workouts.find(v => v.id === id);
        if (!w) throw fail('E_NO_WORKOUT', 'No such workout');
        if (feel !== null && !FEELS.includes(feel)) throw fail('E_BAD_WORKOUT', 'Bad feel');
        w.feel = feel;
      }),

      exportData: o => {
        if (!o || !isNum(o.now)) throw fail('E_BAD_EXPORT', 'Export needs the current time');
        return JSON.stringify({ app: cfg().exportApp, exportedAt: o.now, state });
      },

      importData: text => mutate(() => {
        let parsed;
        try { parsed = JSON.parse(text); } catch (e) { throw fail('E_BAD_IMPORT', 'Not a valid file'); }
        if (!isStr(text) || !isObj(parsed) || parsed.app !== cfg().exportApp || !isObj(parsed.state)) throw fail('E_BAD_IMPORT', 'Not a valid file');
        let m;
        try { m = migrateCounted(parsed.state); } catch (e) { throw fail('E_BAD_IMPORT', 'Not a valid file'); }
        const sets = m.state.workouts.reduce((n, w) => n + w.sets.length, 0);
        return { state: m.state, result: { workouts: m.state.workouts.length, sets, droppedWorkouts: m.droppedWorkouts, droppedSets: m.droppedSets } };
      }),
    };
  }

  return { defaultState, migrate, memoryAdapter, idbAdapter, open };
})();

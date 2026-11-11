// Persistence layer (package 3): versioned state, migration, adapters, session,
// export and import. No DOM, no network. Storage is reached only through an adapter
// with two async methods, get(key) and set(key, value). Config comes from
// BEGINNER_CONFIG.store (schemaVersion, key, dbName, storeName, exportApp).
const Store = (function () {
  const GOALS = ['arms', 'chest', 'legs', 'fit', 'strong'];
  const EFFORTS = ['easy', 'good', 'hard'];
  const FEELS = ['easy', 'right', 'much'];
  const UNITS = ['kg', 'lb'];

  const cfg = () => BEGINNER_CONFIG.store;
  const fail = (code, message) => { const e = new Error(message || code); e.code = code; return e; };
  const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const isStr = v => typeof v === 'string';
  const isNum = v => typeof v === 'number' && Number.isFinite(v);
  const uniq = a => a.filter((v, i) => a.indexOf(v) === i);

  function defaultState() {
    return { version: cfg().schemaVersion, name: '', goals: [], onboarded: false, excludedEquipment: [], units: null, workouts: [] };
  }

  function cleanSet(s) {
    if (!isObj(s) || !isStr(s.exerciseId) || !isNum(s.weightKg) || s.weightKg < 0 || !Number.isInteger(s.reps) || s.reps < 0) return null;
    const out = { exerciseId: s.exerciseId, weightKg: s.weightKg, reps: s.reps, effort: EFFORTS.includes(s.effort) ? s.effort : null, at: isNum(s.at) ? s.at : 0 };
    if (s.extra === true) out.extra = true;
    return out;
  }

  function cleanWorkout(w) {
    if (!isObj(w) || !isStr(w.id) || w.id === '' || !isNum(w.startedAt)) return null;
    return {
      id: w.id,
      startedAt: w.startedAt,
      endedAt: isNum(w.endedAt) ? w.endedAt : null,
      feel: FEELS.includes(w.feel) ? w.feel : null,
      plan: Array.isArray(w.plan) ? w.plan.filter(isStr) : [],
      sets: Array.isArray(w.sets) ? w.sets.map(cleanSet).filter(Boolean) : [],
    };
  }

  // Pure: never mutates raw, shares no references with it, throws only E_NEWER_VERSION.
  function migrate(raw) {
    const cur = cfg().schemaVersion;
    const out = defaultState();
    if (!isObj(raw)) return out;
    if (Number.isInteger(raw.version) && raw.version > cur) throw fail('E_NEWER_VERSION', 'Saved data is from a newer version');
    if (isStr(raw.name)) out.name = raw.name;
    if (Array.isArray(raw.goals)) out.goals = uniq(raw.goals.filter(g => GOALS.includes(g)));
    if (typeof raw.onboarded === 'boolean') out.onboarded = raw.onboarded;
    if (Array.isArray(raw.excludedEquipment)) out.excludedEquipment = uniq(raw.excludedEquipment.filter(isStr));
    if (UNITS.includes(raw.units)) out.units = raw.units;
    if (Array.isArray(raw.workouts)) {
      let open = false;
      for (const w of raw.workouts) {
        const c = cleanWorkout(w);
        if (!c) continue;
        if (c.endedAt === null) { if (open) continue; open = true; }
        out.workouts.push(c);
      }
    }
    return out;
  }

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
        if (!idb) { reject(fail('E_NO_STORAGE', 'Storage is not available')); return; }
        let rq;
        try { rq = idb.open(name, 1); } catch (e) { reject(e); return; }
        rq.onupgradeneeded = () => { rq.result.createObjectStore(storeName); };
        rq.onsuccess = () => resolve(rq.result);
        rq.onerror = () => reject(rq.error);
      });
      dbp = p;
      p.catch(() => { if (dbp === p) dbp = null; });
      return p;
    }
    function run(mode, op) {
      return db().then(d => new Promise((resolve, reject) => {
        let tx, rq;
        try {
          tx = d.transaction(storeName, mode);
          rq = op(tx.objectStore(storeName));
        } catch (e) { reject(e); return; }
        tx.oncomplete = () => resolve(rq.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || fail('E_STORAGE', 'Write aborted'));
      }));
    }
    return {
      get: key => run('readonly', s => s.get(key)),
      set: (key, value) => run('readwrite', s => s.put(value, key)).then(() => undefined),
    };
  }

  async function open(adapter) {
    const key = cfg().key;
    let state = migrate(await adapter.get(key));
    let chain = Promise.resolve();

    // Serialised in call order. The change is built on a copy and committed in
    // memory only after adapter.set resolved, so a failed write leaves state intact.
    function mutate(fn) {
      const run = chain.then(async () => {
        let next = structuredClone(state);
        const r = fn(next);
        if (r && r.state) next = r.state;
        if (r && r.skipWrite) return r.result;
        await adapter.set(key, structuredClone(next));
        state = next;
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

      excludeEquipment: item => mutate(s => {
        if (!isStr(item) || item === '') throw fail('E_BAD_EQUIPMENT', 'Bad equipment');
        if (!s.excludedEquipment.includes(item)) s.excludedEquipment.push(item);
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
        const set = { exerciseId: x.exerciseId, weightKg: x.weightKg, reps: x.reps, effort, at: x.now };
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
        w.endedAt = x.now;
        w.feel = feel;
      }),

      setFeel: (id, feel) => mutate(s => {
        const w = s.workouts.find(v => v.id === id);
        if (!w) throw fail('E_NO_WORKOUT', 'No such workout');
        if (feel !== null && !FEELS.includes(feel)) throw fail('E_BAD_WORKOUT', 'Bad feel');
        w.feel = feel;
      }),

      exportData: o => JSON.stringify({ app: cfg().exportApp, exportedAt: o && o.now, state }),

      importData: text => mutate(() => {
        let parsed;
        try { parsed = JSON.parse(text); } catch (e) { throw fail('E_BAD_IMPORT', 'Not a valid file'); }
        if (!isStr(text) || !isObj(parsed) || parsed.app !== cfg().exportApp || !isObj(parsed.state)) throw fail('E_BAD_IMPORT', 'Not a valid file');
        try { return { state: migrate(parsed.state) }; } catch (e) { throw fail('E_BAD_IMPORT', 'Not a valid file'); }
      }),
    };
  }

  return { defaultState, migrate, memoryAdapter, idbAdapter, open };
})();

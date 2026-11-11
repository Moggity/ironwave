/* Minimal controllable fake IndexedDB for the beginner store tests. Supports only
   what Store.idbAdapter uses: open (onupgradeneeded, onsuccess, onerror, onblocked),
   createObjectStore, objectStoreNames.contains, transaction(store, mode, options),
   objectStore().get/put, request onsuccess, transaction oncomplete/onerror/onabort,
   abort(), connection close/onclose/onversionchange. Everything is asynchronous
   (promise microtasks, never timers) and deterministic.

   Controls (fake.controls):
     mode        'normal' | 'holdActive' | 'holdCommitting' (readwrite transactions only)
                 holdActive: the transaction never progresses; abort() succeeds.
                 holdCommitting: requests succeed, then the transaction sits in the
                   committing state: abort() throws InvalidStateError and the data is
                   not on disk until held[i].complete() (oncomplete) or held[i].fail(err).
     abortThrows abort() always throws InvalidStateError.
     autoAbort   the next readwrite transactions abort by themselves (onabort, error set).
     failOpen    open() fires onerror.      blockOpen  open() fires onblocked.
   Observables: fake.opens (count), fake.held (held transactions), fake.data (Map of
   dbName -> Map of storeName -> Map key -> value), fake.stats.requestSuccess.
   fake.closeConnections() fires onclose on every live connection.
   fake.install() / fake.restore() swap globalThis.indexedDB. */
'use strict';

const defer = fn => Promise.resolve().then(fn);
const clone = v => (v === undefined ? undefined : structuredClone(v));
const stateError = msg => { const e = new Error(msg); e.name = 'InvalidStateError'; return e; };

function createFakeIdb() {
  const data = new Map();
  const conns = [];
  const fake = {
    data, held: [], opens: 0,
    stats: { requestSuccess: 0 },
    controls: { mode: 'normal', abortThrows: false, autoAbort: false, failOpen: false, blockOpen: false },
  };
  const ctl = fake.controls;

  function makeTx(conn, storeName, mode) {
    const tx = { state: 'active', error: null, oncomplete: null, onerror: null, onabort: null, writes: [], reqs: [], scheduled: false };
    const store = () => conn._db.get(storeName);
    const schedule = () => { if (!tx.scheduled) { tx.scheduled = true; defer(run); } };
    const request = fn => { const r = { result: undefined, error: null, onsuccess: null, onerror: null }; tx.reqs.push({ r, fn }); schedule(); return r; };
    const commit = () => {
      if (tx.state !== 'committing') return;
      for (const [k, v] of tx.writes) store().set(k, v);
      tx.state = 'finished';
      if (tx.oncomplete) tx.oncomplete({ target: tx });
    };
    const kill = err => {
      if (tx.state === 'finished' || tx.state === 'aborted') return;
      tx.state = 'aborted';
      tx.error = err || null;
      if (tx.onabort) tx.onabort({ target: tx });
    };
    function run() {
      if (tx.state !== 'active') return;
      const rw = mode === 'readwrite';
      if (rw && ctl.mode === 'holdActive') { fake.held.push(tx); return; }
      if (rw && ctl.autoAbort) { kill(new Error('transaction aborted')); return; }
      for (const { r, fn } of tx.reqs) {
        r.result = fn();
        fake.stats.requestSuccess++;
        if (r.onsuccess) r.onsuccess({ target: r });
      }
      tx.state = 'committing';
      if (rw && ctl.mode === 'holdCommitting') { fake.held.push(tx); return; }
      commit();
    }
    tx.objectStore = n => {
      if (n !== storeName) throw new Error('NotFoundError');
      return {
        get: key => request(() => clone(store().get(key))),
        put: (v, key) => { tx.writes.push([key, clone(v)]); return request(() => key); },
      };
    };
    tx.abort = () => {
      if (ctl.abortThrows || tx.state !== 'active') throw stateError('abort() on a transaction that is not active');
      tx.state = 'aborted';
      defer(() => { if (tx.onabort) tx.onabort({ target: tx }); });
    };
    tx.complete = commit;          // test control: let a held commit finish
    tx.fail = err => kill(err);    // test control: make a held commit fail
    return tx;
  }

  function makeConn(db) {
    const conn = {
      _db: db, closed: false, onclose: null, onversionchange: null,
      objectStoreNames: { contains: n => db.has(n) },
      createObjectStore: n => { db.set(n, new Map()); },
      transaction: (n, mode) => {
        if (conn.closed) throw stateError('connection is closed');
        if (!db.has(n)) throw new Error('NotFoundError');
        return makeTx(conn, n, mode);
      },
      close: () => { conn.closed = true; },
    };
    conns.push(conn);
    return conn;
  }

  fake.indexedDB = {
    open(name) {
      fake.opens++;
      const rq = { result: undefined, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      defer(() => {
        if (ctl.blockOpen) { if (rq.onblocked) rq.onblocked({}); return; }
        if (ctl.failOpen) { rq.error = new Error('open failed'); if (rq.onerror) rq.onerror({}); return; }
        const fresh = !data.has(name);
        if (fresh) data.set(name, new Map());
        const conn = makeConn(data.get(name));
        rq.result = conn;
        if (fresh && rq.onupgradeneeded) rq.onupgradeneeded({ target: rq });
        if (rq.onsuccess) rq.onsuccess({ target: rq });
      });
      return rq;
    },
  };

  fake.closeConnections = () => {
    for (const c of conns) if (!c.closed) { c.closed = true; if (c.onclose) c.onclose({}); }
  };
  let saved = null;
  fake.install = () => {
    saved = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB') || null;
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, writable: true, value: fake.indexedDB });
  };
  fake.restore = () => {
    if (saved) Object.defineProperty(globalThis, 'indexedDB', saved); else delete globalThis.indexedDB;
  };
  return fake;
}

module.exports = { createFakeIdb };

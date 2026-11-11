// Tunable constants for the beginner app. Deeply frozen. Each section below is
// owned by one package area; keep every section on its own block so parallel
// packages edit different lines.
function beginnerDeepFreeze(o) {
  Object.values(o).forEach(v => { if (v && typeof v === 'object') beginnerDeepFreeze(v); });
  return Object.freeze(o);
}

const BEGINNER_CONFIG = beginnerDeepFreeze({
  // exercises: owned by the exercise-data package
  exercises: {
  },

  // store: owned by the persistence package
  store: {
    schemaVersion: 1,
    key: 'ironwave-beginner-state',
    dbName: 'ironwave-beginner',
    storeName: 'kv',
    exportApp: 'ironwave-beginner',
  },

  // coach: owned by the coaching-logic package
  coach: {
  },

  // ui: owned by the screens package
  ui: {
  },
});

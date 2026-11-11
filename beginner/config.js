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
    cueMaxLength: 90,
    exerciseCountMin: 36,
    exerciseCountMax: 44,
    starterMin: 24,
    perMuscleStarterMin: 3,
    perMuscleStarterKeysMin: 2,
    goalDepthMin: 4,
    noneStarterMin: 6,
    homeStarterMin: 6,
    equipKeyMaxExercises: 8,
    placeholderMaxBytes: 4096,
  },

  // store: owned by the persistence package
  store: {
    schemaVersion: 1,
    key: 'ironwave-beginner-state',
    dbName: 'ironwave-beginner',
    storeName: 'kv',
    exportApp: 'ironwave-beginner',
    memoKeys: [],
    writeTimeoutMs: 5000,
  },

  // coach: owned by the coaching-logic package
  coach: {
  },

  // ui: owned by the screens package
  ui: {
  },
});

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
    repRange: [8, 12],
    effortRpe: { easy: 6, good: 8, hard: 9.5 },
    defaultRpe: 8,
    shortfallReps: 2,
    holdsBeforeDrop: 2,
    easyTriggerReps: 12,
    easyTargetReps: 10,
    easyTargetRpe: 8,
    longGapDays: 56,
    repsOnlyEquipment: ['bw', 'bd'],
    repsOnlyRange: [1, 20],
    setsFirst: 2,
    setsFirstSessions: 2,
    setsAfter: 3,
    setsMin: 1,
    setsMax: 4,
    suggestCount: 6,
    tickCount: 3,
    goalFocus: 3,
    defaultFocus: 2,
    muscleOrder: ['chest', 'back', 'legs', 'glutes', 'shoulders', 'arms', 'calves'],
    increments: {
      kg: { bb: 2.5, db: 2, mc: 5, cb: 2.5, kb: 4, bw: 0, bd: 0 },
      lb: { bb: 5, db: 5, mc: 10, cb: 5, kb: 5, bw: 0, bd: 0 },
    },
  },

  // ui: owned by the screens package
  ui: {
    restSec: 90,
    staleWorkoutHours: 6,
    vibrateMs: 200,
    tickMs: 1000,
    lbRegions: ['US', 'LR', 'MM'],
    fallbackStep: 1,
    doubleTapMs: 500,
    revokeMs: 4000,
    maxWeightKg: 500,
    maxReps: 100,
    placeholder: 'media/placeholder.svg',
  },
});

/* ============================================================
   IRONWAVE — data.js
   Exercise catalog, movement taxonomy, day templates,
   Juggernaut Method 2.0 wave tables (Chad Wesley Smith).
   ============================================================ */

// Movement categories (used for "Select X Exercise" slots & swaps)
const MOVEMENTS = {
  squat:   { label: 'Squat',            group: 'lower' },
  bench:   { label: 'Bench',            group: 'upper' },
  deadlift:{ label: 'Deadlift',         group: 'lower' },
  press:   { label: 'Overhead Press',   group: 'upper' },
  vpull:   { label: 'Vertical Pull',    group: 'upper' },
  hpull:   { label: 'Horizontal Pull',  group: 'upper' },
  quad:    { label: 'Quads',            group: 'lower' },
  ham:     { label: 'Hamstrings',       group: 'lower' },
  glute:   { label: 'Glutes',           group: 'lower' },
  calf:    { label: 'Calves',           group: 'lower' },
  chest:   { label: 'Chest',            group: 'upper' },
  shoulder:{ label: 'Shoulders',        group: 'upper' },
  tricep:  { label: 'Triceps',          group: 'upper' },
  bicep:   { label: 'Biceps',           group: 'upper' },
  upperback:{label: 'Upper Back/Traps', group: 'upper' },
  lowback: { label: 'Lower Back',       group: 'lower' },
  abs:     { label: 'Abs/Core',         group: 'core'  },
};

// Equipment: bb=barbell, db=dumbbell, mc=machine, cb=cable, bw=bodyweight, kb=kettlebell, bd=band
// Format: [id, name, movement, equipment, isMain]
const EXERCISE_LIST = [
  // ===== COMPETITION / BIG 4 (mains) =====
  ['comp-squat','Comp Squat','squat','bb',1],
  ['comp-bench','Comp Bench','bench','bb',1],
  ['comp-deadlift','Comp Deadlift','deadlift','bb',1],
  ['military-press','Military Press','press','bb',1],

  // ===== SQUAT VARIATIONS =====
  ['high-bar-squat','High Bar Squat','squat','bb',0],
  ['low-bar-squat','Low Bar Squat','squat','bb',0],
  ['front-squat','Front Squat','squat','bb',0],
  ['pause-squat','Pause Squat','squat','bb',0],
  ['pin-squat','Pin Squat','squat','bb',0],
  ['box-squat','Box Squat','squat','bb',0],
  ['tempo-squat','Tempo Squat (3-0-3)','squat','bb',0],
  ['ssb-squat','SSB Squat','squat','bb',0],
  ['belt-squat','Belt Squat','mc','mc',0],
  ['one-half-squat','1.5 Rep Squat','squat','bb',0],
  ['dead-squat','Dead Squat','squat','bb',0],
  ['goblet-squat','Goblet Squat','squat','db',0],

  // ===== BENCH VARIATIONS =====
  ['close-grip-bench','Close Grip Bench','bench','bb',0],
  ['wide-grip-bench','Wide Grip Bench','bench','bb',0],
  ['tng-bench','Touch & Go Bench','bench','bb',0],
  ['spoto-press','Spoto Press','bench','bb',0],
  ['larsen-press','Larsen Press','bench','bb',0],
  ['incline-bench','Incline Bench','bench','bb',0],
  ['decline-bench','Decline Bench','bench','bb',0],
  ['floor-press','Floor Press','bench','bb',0],
  ['board-press','2-Board Press','bench','bb',0],
  ['pin-press','Pin Press','bench','bb',0],
  ['tempo-bench','Tempo Bench (3-1-0)','bench','bb',0],
  ['one-half-bench','1.5 Rep Bench','bench','bb',0],
  ['db-bench','DB Bench Press','bench','db',0],
  ['db-incline-bench','DB Incline Bench','bench','db',0],

  // ===== DEADLIFT VARIATIONS =====
  ['conv-deadlift','Conventional Deadlift','deadlift','bb',0],
  ['sumo-deadlift','Sumo Deadlift','deadlift','bb',0],
  ['deficit-deadlift-1','1" Deficit Deadlift','deadlift','bb',0],
  ['deficit-deadlift-2','2" Deficit Deadlift','deadlift','bb',0],
  ['block-pull','Block Pull','deadlift','bb',0],
  ['rack-pull','Rack Pull','deadlift','bb',0],
  ['pause-deadlift','Pause Deadlift','deadlift','bb',0],
  ['tempo-deadlift','Tempo Deadlift','deadlift','bb',0],
  ['snatch-grip-deadlift','Snatch Grip Deadlift','deadlift','bb',0],
  ['trap-bar-deadlift','Trap Bar Deadlift','deadlift','bb',0],
  ['stiff-leg-deadlift','Stiff Leg Deadlift','deadlift','bb',0],

  // ===== OVERHEAD PRESS VARIATIONS =====
  ['push-press','Push Press','press','bb',0],
  ['z-press','Z Press','press','bb',0],
  ['seated-db-press','Seated DB Press','press','db',0],
  ['db-shoulder-press','Standing DB Press','press','db',0],
  ['arnold-press','Arnold Press','press','db',0],
  ['landmine-press','Landmine Press','press','bb',0],
  ['machine-shoulder-press','Machine Shoulder Press','press','mc',0],
  ['pike-pushup','Pike Push-up','press','bw',0],
  ['handstand-pushup','Handstand Push-up','press','bw',0],

  // ===== VERTICAL PULL =====
  ['pullup','Pull-up','vpull','bw',0],
  ['chinup','Chin-up','vpull','bw',0],
  ['weighted-pullup','Weighted Pull-up','vpull','bw',0],
  ['neutral-pullup','Neutral Grip Pull-up','vpull','bw',0],
  ['lat-pulldown','Lat Pulldown','vpull','cb',0],
  ['close-grip-pulldown','Close Grip Pulldown','vpull','cb',0],
  ['straight-arm-pulldown','Straight Arm Pulldown','vpull','cb',0],

  // ===== HORIZONTAL PULL =====
  ['barbell-row','Barbell Row','hpull','bb',0],
  ['pendlay-row','Pendlay Row','hpull','bb',0],
  ['db-row','DB Row','hpull','db',0],
  ['kroc-row','Kroc Row','hpull','db',0],
  ['chest-supported-row','Chest Supported Row','hpull','db',0],
  ['seal-row','Seal Row','hpull','bb',0],
  ['tbar-row','T-Bar Row','hpull','bb',0],
  ['cable-row','Seated Cable Row','hpull','cb',0],
  ['meadows-row','Meadows Row','hpull','bb',0],
  ['inverted-row','Inverted Row','hpull','bw',0],

  // ===== UPPER BACK / TRAPS / REAR DELT =====
  ['bb-shrug','Barbell Shrug','upperback','bb',0],
  ['db-shrug','DB Shrug','upperback','db',0],
  ['face-pull','Face Pull','upperback','cb',0],
  ['band-pullapart','Band Pull-apart','upperback','bd',0],
  ['rear-delt-fly','Rear Delt Fly','upperback','db',0],
  ['reverse-pec-deck','Reverse Pec Deck','upperback','mc',0],

  // ===== QUADS =====
  ['leg-extensions','Leg Extensions','quad','mc',0],
  ['leg-press','Leg Press','quad','mc',0],
  ['hack-squat-machine','Hack Squat (Machine)','quad','mc',0],
  ['reverse-hack-squat','Reverse Hack Squat','quad','mc',0],
  ['bulgarian-split-squat','Bulgarian Split Squat','quad','db',0],
  ['split-squat-glute','Split Squat (Glute Emphasis)','glute','db',0],
  ['ffe-split-squat','Front Foot Elevated Split Squat','quad','db',0],
  ['walking-lunge','Walking Lunge','quad','db',0],
  ['reverse-lunge','Reverse Lunge','quad','db',0],
  ['barbell-stepup','Barbell Step-up','quad','bb',0],
  ['db-stepup','DB Step-up','quad','db',0],
  ['pistol-squat','Pistol Squat','quad','bw',0],
  ['sissy-squat','Sissy Squat','quad','bw',0],
  ['wall-sit','Wall Sit','quad','bw',0],

  // ===== HAMSTRINGS / POSTERIOR =====
  ['romanian-deadlift','Romanian Deadlift','ham','bb',0],
  ['db-rdl','DB Romanian Deadlift','ham','db',0],
  ['single-leg-rdl','Single Leg RDL','ham','db',0],
  ['good-mornings','Good Mornings','ham','bb',0],
  ['hamstring-curls','Hamstring Curls','ham','mc',0],
  ['seated-leg-curl','Seated Leg Curl','ham','mc',0],
  ['ghr','Glute Ham Raise','ham','bw',0],
  ['nordic-curl','Nordic Curl','ham','bw',0],
  ['pull-throughs','Pull Throughs','glute','cb',0],
  ['back-extension','Back Extension','lowback','bw',0],
  ['reverse-hyper','Reverse Hyper','lowback','mc',0],
  ['sl-reverse-hyper','Single Leg Reverse Hyper','lowback','mc',0],

  // ===== GLUTES =====
  ['bb-hip-thrust','BB Hip Thrust','glute','bb',0],
  ['sl-hip-thrust','SL Hip Thrust','glute','bw',0],
  ['glute-bridge','Glute Bridge','glute','bw',0],
  ['frog-pumps','Frog Pumps','glute','bw',0],
  ['cable-kickback','Cable Kickback','glute','cb',0],
  ['curtsy-lunge','Curtsy Lunge','glute','db',0],

  // ===== CALVES =====
  ['standing-calf-raise','Standing Calf Raise','calf','mc',0],
  ['seated-calf-raise','Seated Calf Raise','calf','mc',0],
  ['sl-calf-raise','Single Leg Calf Raise','calf','bw',0],
  ['leg-press-calf-raise','Leg Press Calf Raise','calf','mc',0],
  ['donkey-calf-raise','Donkey Calf Raise','calf','mc',0],

  // ===== CHEST ACCESSORY =====
  ['dips','Dips','chest','bw',0],
  ['weighted-dips','Weighted Dips','chest','bw',0],
  ['pushup','Push-up','chest','bw',0],
  ['deficit-pushup','Deficit Push-up','chest','bw',0],
  ['machine-chest-press','Machine Chest Press','chest','mc',0],
  ['cable-fly','Cable Fly','chest','cb',0],
  ['db-fly','DB Fly','chest','db',0],
  ['pec-deck','Pec Deck','chest','mc',0],

  // ===== SHOULDER ACCESSORY =====
  ['lateral-raise','DB Lateral Raise','shoulder','db',0],
  ['cable-lateral-raise','Cable Lateral Raise','shoulder','cb',0],
  ['front-raise','Front Raise','shoulder','db',0],
  ['upright-row','Upright Row','shoulder','bb',0],

  // ===== TRICEPS =====
  ['triceps-pushdown','Triceps Pushdown','tricep','cb',0],
  ['overhead-triceps-ext','Overhead Triceps Extension','tricep','cb',0],
  ['skullcrusher','Skullcrusher','tricep','bb',0],
  ['jm-press','JM Press','tricep','bb',0],
  ['db-triceps-ext','DB Triceps Extension','tricep','db',0],
  ['close-grip-pushup','Close Grip Push-up','tricep','bw',0],
  ['bench-dips','Bench Dips','tricep','bw',0],

  // ===== BICEPS =====
  ['bb-curl','Barbell Curl','bicep','bb',0],
  ['ez-curl','EZ Bar Curl','bicep','bb',0],
  ['db-curl','DB Curl','bicep','db',0],
  ['hammer-curl','Hammer Curl','bicep','db',0],
  ['incline-db-curl','Incline DB Curl','bicep','db',0],
  ['preacher-curl','Preacher Curl','bicep','mc',0],
  ['cable-curl','Cable Curl','bicep','cb',0],

  // ===== ABS / CORE =====
  ['ab-wheel','Ab Wheel','abs','bw',0],
  ['hanging-leg-raise','Hanging Leg Raise','abs','bw',0],
  ['decline-situp','Decline Sit-up','abs','bw',0],
  ['cable-crunch','Cable Crunch','abs','cb',0],
  ['plank','Plank','abs','bw',0],
  ['side-plank','Side Plank','abs','bw',0],
  ['pallof-press','Pallof Press','abs','cb',0],
  ['db-side-bend','DB Side Bend','abs','db',0],
  ['dead-bug','Dead Bug','abs','bw',0],
  ['l-sit','L-Sit','abs','bw',0],
  ['farmer-carry','Farmer Carry','abs','db',0],
  ['suitcase-carry','Suitcase Carry','abs','db',0],
];

const EXERCISES = EXERCISE_LIST.map(e => ({
  id: e[0], name: e[1], movement: e[2], equipment: e[3], isMain: !!e[4],
}));

// ============================================================
// JUGGERNAUT METHOD 2.0 — WAVE TABLES (percentages of Working Max)
// Working Max = 90% of a recent true 1RM.
// Week map inside each 5-week block:
//   w0 intro/calibration · w1 accumulation · w2 intensification
//   w3 realization (AMRAP) · w4 deload
// ============================================================
const WAVES = {
  '10s': {
    label: '10s', standard: 10,
    acc:  { sets: 5, reps: 10, pct: 0.60 },
    int:  { ramp: [[0.55,5],[0.625,5]], work: { sets: 3, reps: 10, pct: 0.675 } },
    real: { ramp: [[0.50,5],[0.60,3],[0.70,1]], amrap: { pct: 0.75 } },
  },
  '8s': {
    label: '8s', standard: 8,
    acc:  { sets: 5, reps: 8, pct: 0.65 },
    int:  { ramp: [[0.60,3],[0.675,3]], work: { sets: 3, reps: 8, pct: 0.725 } },
    real: { ramp: [[0.50,5],[0.60,3],[0.70,2],[0.75,1]], amrap: { pct: 0.80 } },
  },
  '5s': {
    label: '5s', standard: 5,
    acc:  { sets: 6, reps: 5, pct: 0.70 },
    int:  { ramp: [[0.65,2],[0.725,2]], work: { sets: 4, reps: 5, pct: 0.775 } },
    real: { ramp: [[0.50,5],[0.60,3],[0.70,2],[0.75,1],[0.80,1]], amrap: { pct: 0.85 } },
  },
  '3s': {
    label: '3s', standard: 3,
    acc:  { sets: 7, reps: 3, pct: 0.75 },
    int:  { ramp: [[0.70,1],[0.775,1]], work: { sets: 5, reps: 3, pct: 0.825 } },
    real: { ramp: [[0.50,5],[0.60,3],[0.70,2],[0.75,1],[0.80,1],[0.85,1]], amrap: { pct: 0.90 } },
  },
};

const DELOAD_SETS = [[0.40,5],[0.50,5],[0.60,5]]; // pct of *current* WM

// ============================================================
// POWERBUILDING PROGRAM TEMPLATE
// Methodology tag: [Juggernaut + Bodybuilding]
// Hypertrophy blocks run the 'jbb-hyp' scheme (ascending volume,
// MEV→MRV style, mirroring the modern JuggernautAI behaviour).
// Strength blocks run the 'jm2-wave' scheme (the 2012 book:
// descending volume, rising intensity, AMRAP-driven working max).
// Each block declares its scheme explicitly — the engine never
// mixes methodologies, so a future pure-hypertrophy program just
// registers its own scheme id. See CHANGELOG.md.
// ============================================================
const PROGRAM_TEMPLATES = {
  powerbuilding: {
    id: 'powerbuilding',
    label: 'Powerbuilding',
    methodology: 'Juggernaut + Bodybuilding',
    blocks: [
      { type: 'hypertrophy', wave: '10s', label: 'Hypertrophy 1', scheme: 'jbb-hyp' },
      { type: 'hypertrophy', wave: '8s',  label: 'Hypertrophy 2', scheme: 'jbb-hyp' },
      { type: 'hypertrophy', wave: '8s',  label: 'Hypertrophy 3', scheme: 'jbb-hyp' },
      { type: 'strength',    wave: '5s',  label: 'Strength 1',    scheme: 'jm2-wave' },
      { type: 'strength',    wave: '3s',  label: 'Strength 2',    scheme: 'jm2-wave' },
    ],
    weeksPerBlock: 5,
  },
  // Pure-appearance track: all hypertrophy blocks (jbb-hyp). Triggers the
  // muscle-focus slider system. Reuses the same day templates; only the block
  // periodization differs. mesoIdx clamps at 3 rows, so blocks 4-5 reuse the top.
  bodybuilding: {
    id: 'bodybuilding',
    label: 'Bodybuilding',
    methodology: 'Bodybuilding (ascending volume)',
    blocks: [
      { type: 'hypertrophy', wave: '10s', label: 'Hypertrophy 1', scheme: 'jbb-hyp' },
      { type: 'hypertrophy', wave: '8s',  label: 'Hypertrophy 2', scheme: 'jbb-hyp' },
      { type: 'hypertrophy', wave: '8s',  label: 'Hypertrophy 3', scheme: 'jbb-hyp' },
      { type: 'hypertrophy', wave: '10s', label: 'Hypertrophy 4', scheme: 'jbb-hyp' },
      { type: 'hypertrophy', wave: '8s',  label: 'Hypertrophy 5', scheme: 'jbb-hyp' },
    ],
    weeksPerBlock: 5,
  },
  // Strength track: one hypertrophy base block then four book-wave strength
  // blocks (jm2-wave). No slider system. Lowest-risk: reuses both schemes.
  powerlifting: {
    id: 'powerlifting',
    label: 'Powerlifting',
    methodology: 'Juggernaut strength focus',
    blocks: [
      { type: 'hypertrophy', wave: '8s', label: 'Hypertrophy Base', scheme: 'jbb-hyp' },
      { type: 'strength',    wave: '5s', label: 'Strength 1',        scheme: 'jm2-wave' },
      { type: 'strength',    wave: '5s', label: 'Strength 2',        scheme: 'jm2-wave' },
      { type: 'strength',    wave: '3s', label: 'Strength 3',        scheme: 'jm2-wave' },
      { type: 'strength',    wave: '3s', label: 'Strength 4',        scheme: 'jm2-wave' },
    ],
    weeksPerBlock: 5,
  },
};

// [Juggernaut + Bodybuilding] ascending-volume hypertrophy config.
// Two-level progression:
//   · within a meso: sets climb week over week, RIR tightens (RPE 7 → 9)
//   · across the macrocycle (mesoIdx 0/1/2): each meso starts a bit
//     higher and peaks higher than the last (MEV rises as you adapt),
//     so the single hardest week of the whole hypertrophy macrocycle
//     is the last work week of the final meso, right before its deload.
// Week 4 of every meso ends with the AMRAP at the book's realization %
// so the working-max progression formula stays correctly calibrated.
const JBB_HYP = {
  dPct: [-0.025, 0, 0.025, 0.05],
  rpe:  [7, 8, 8, 9],
  // [mesoIdx][workWeek] — sets per exercise
  mainSets: [ [3, 4, 5, 4],
              [3, 4, 5, 5],
              [4, 5, 6, 5] ],   // + AMRAP set appended in week 4
  accSets:  [ [2, 3, 4, 5],
              [3, 4, 5, 6],
              [3, 5, 6, 7] ],
  accRpe:   [7, 7.5, 8, 9],
  accReps:  12,
  secSets:  [ [3, 4, 5, 5],
              [3, 4, 5, 6],
              [4, 5, 6, 6] ],
  secPct:   0.60, secStep: 0.025, secReps: 5,
  deload:   { accSets: 2, accRpe: 6, secSets: 2, secPct: 0.45 },
};

// Accessory prescriptions by block type
const ACC_SCHEMES = {
  hypertrophy: { sets: 4, reps: 12, rpe: 8 },
  strength:    { sets: 3, reps: 8,  rpe: 7 },
};

// Secondary main-lift slots (Inverted Juggernaut style volume work)
const SECONDARY_SCHEMES = {
  hypertrophy: { sets: 4, reps: 5, pct: 0.625 },
  strength:    { sets: 3, reps: 3, pct: 0.70 },
};

// Day templates per training frequency.
// slot types: main (wave math) · secondary (volume % work) ·
//             acc (fixed default exercise, swappable) ·
//             select (empty "Select X Exercise" slot)
const DAY_TEMPLATES = {
  3: [
    { name: 'Day 1', slots: [
      { type:'main', lift:'comp-squat' },
      { type:'acc', cat:'quad',  def:'leg-extensions' },
      { type:'acc', cat:'ham',   def:'hamstring-curls' },
      { type:'select', cat:'abs' },
    ]},
    { name: 'Day 2', slots: [
      { type:'main', lift:'comp-bench' },
      { type:'acc', cat:'hpull', def:'chest-supported-row' },
      { type:'select', cat:'shoulder' },
      { type:'select', cat:'tricep' },
    ]},
    { name: 'Day 3', slots: [
      { type:'main', lift:'comp-deadlift' },
      { type:'secondary', lift:'military-press' },
      { type:'acc', cat:'vpull', def:'lat-pulldown' },
      { type:'select', cat:'glute' },
      { type:'select', cat:'abs' },
    ]},
  ],
  4: [
    { name: 'Day 1', slots: [
      { type:'main', lift:'comp-bench' },
      { type:'acc', cat:'hpull', def:'db-row' },
      { type:'acc', cat:'chest', def:'dips' },
      { type:'select', cat:'tricep' },
      { type:'select', cat:'abs' },
    ]},
    { name: 'Day 2', slots: [
      { type:'main', lift:'comp-squat' },
      { type:'acc', cat:'quad', def:'leg-extensions' },
      { type:'acc', cat:'ham',  def:'hamstring-curls' },
      { type:'select', cat:'glute' },
      { type:'select', cat:'calf' },
    ]},
    { name: 'Day 3', slots: [
      { type:'main', lift:'military-press' },
      { type:'acc', cat:'vpull', def:'chinup' },
      { type:'select', cat:'shoulder' },
      { type:'select', cat:'bicep' },
    ]},
    { name: 'Day 4', slots: [
      { type:'main', lift:'comp-deadlift' },
      { type:'acc', cat:'ham',  def:'good-mornings' },
      { type:'acc', cat:'hpull', def:'barbell-row' },
      { type:'select', cat:'quad' },
      { type:'select', cat:'abs' },
    ]},
  ],
  5: [
    { name: 'Day 1', slots: [
      { type:'main', lift:'comp-bench' },
      { type:'acc', cat:'hpull', def:'db-row' },
      { type:'select', cat:'tricep' },
      { type:'select', cat:'abs' },
    ]},
    { name: 'Day 2', slots: [
      { type:'main', lift:'comp-squat' },
      { type:'acc', cat:'quad', def:'leg-extensions' },
      { type:'acc', cat:'ham',  def:'hamstring-curls' },
      { type:'select', cat:'calf' },
    ]},
    { name: 'Day 3', slots: [
      { type:'main', lift:'military-press' },
      { type:'acc', cat:'vpull', def:'chinup' },
      { type:'select', cat:'shoulder' },
      { type:'select', cat:'bicep' },
    ]},
    { name: 'Day 4', slots: [
      { type:'main', lift:'comp-deadlift' },
      { type:'acc', cat:'ham', def:'good-mornings' },
      { type:'acc', cat:'hpull', def:'barbell-row' },
      { type:'select', cat:'abs' },
    ]},
    { name: 'Day 5', slots: [
      { type:'secondary', lift:'comp-bench' },
      { type:'acc', cat:'chest', def:'db-incline-bench' },
      { type:'select', cat:'shoulder' },
      { type:'select', cat:'tricep' },
      { type:'select', cat:'bicep' },
    ]},
  ],
  6: [
    { name: 'Day 1', slots: [
      { type:'main', lift:'comp-bench' },
      { type:'acc', cat:'hpull', def:'db-row' },
      { type:'select', cat:'tricep' },
      { type:'select', cat:'abs' },
    ]},
    { name: 'Day 2', slots: [
      { type:'main', lift:'comp-squat' },
      { type:'acc', cat:'quad', def:'leg-extensions' },
      { type:'select', cat:'ham' },
      { type:'select', cat:'calf' },
    ]},
    { name: 'Day 3', slots: [
      { type:'main', lift:'military-press' },
      { type:'acc', cat:'vpull', def:'chinup' },
      { type:'select', cat:'shoulder' },
      { type:'select', cat:'bicep' },
    ]},
    { name: 'Day 4', slots: [
      { type:'main', lift:'comp-deadlift' },
      { type:'acc', cat:'hpull', def:'barbell-row' },
      { type:'select', cat:'upperback' },
      { type:'select', cat:'abs' },
    ]},
    { name: 'Day 5', slots: [
      { type:'secondary', lift:'close-grip-bench', baseLift:'comp-bench', pctMod: 0.90 },
      { type:'acc', cat:'chest', def:'db-incline-bench' },
      { type:'select', cat:'shoulder' },
      { type:'select', cat:'tricep' },
    ]},
    { name: 'Day 6', slots: [
      { type:'secondary', lift:'deficit-deadlift-1', baseLift:'comp-deadlift', pctMod: 0.90 },
      { type:'secondary', lift:'comp-squat', pctMod: 0.85 },
      { type:'acc', cat:'quad', def:'leg-extensions' },
      { type:'acc', cat:'ham', def:'hamstring-curls' },
      { type:'select', cat:'glute' },
      { type:'select', cat:'calf' },
    ]},
  ],
};

// Muscle-group check-in questions per main movement on the day
const CHECKIN_GROUPS = {
  bench:    { key:'bench', label:'Pecs / Shoulders / Triceps' },
  press:    { key:'press', label:'Shoulders / Triceps' },
  squat:    { key:'squat', label:'Quads / Glutes' },
  deadlift: { key:'deadlift', label:'Hamstrings / Glutes' },
  lowback:  { key:'lowback', label:'Lower Back' },
  upperpull:{ key:'upperpull', label:'Lats / Upper Back / Biceps' },
};

// IPF-style kg plate colors for the plate-math visual
const PLATE_COLORS = {
  '25': '#e2483d', '20': '#3b6fe0', '15': '#f0b429', '10': '#3ba55d',
  '5': '#e8e8ec', '2.5': '#d23c3c', '1.25': '#9aa0ae', '0.5': '#9aa0ae',
};

// Light plates need dark numbers (5kg white, 1.25kg chrome, 0.5kg white)
const PLATE_TEXT = { '5': '#10162b', '1.25': '#10162b', '0.5': '#10162b' };

const DEFAULT_PLATES = [
  { w: 25, count: 4 }, { w: 20, count: 2 }, { w: 15, count: 2 },
  { w: 10, count: 2 }, { w: 5, count: 2 }, { w: 2.5, count: 2 }, { w: 1.25, count: 2 },
];

const RPE_DESCRIPTIONS = {
  10:  'Could not do any more reps',
  9.5: 'Maybe could have done 1 more rep',
  9:   'Could do 1 more rep',
  8.5: 'Could do 1, maybe 2 more reps',
  8:   'Could do 2 more reps',
  7.5: 'Could do 2, maybe 3 more reps',
  7:   'Could confidently do 3 more reps',
  6.5: 'Could do 3, maybe 4 more reps',
  6:   'Could do 4 more reps',
  5.5: 'Could do 4, maybe 5 more reps',
  5:   'Could do 5+ more reps, felt like a warmup',
};

/* ============================================================
   DYNAMIC ROUTINE ADAPTATION ENGINE — config tables
   See docs/dynamic-routine-engine-design.md. All of this is data,
   not logic: the engine functions (engine.js) read these. None of
   it affects a default user (Powerbuilding, unlimited time), so the
   legacy routine output is byte-identical.
   ============================================================ */

// The bodybuilding focus sliders aggregate the finer MOVEMENTS categories.
// Note: a few accessories are tagged by lift PATTERN (bench, press) rather than
// the muscle they build, so those patterns are mapped into the matching slider
// (e.g. a DB Incline Bench accessory is controlled by the Chest slider). Main
// and secondary lifts are never focus-scaled, so the comp-bench main is unaffected.
const SLIDER_MOVEMENTS = {
  arms:      ['bicep', 'tricep'],
  chest:     ['chest', 'bench'],
  back:      ['vpull', 'hpull', 'upperback'],
  shoulders: ['shoulder', 'press'],
  glutes:    ['glute'],
  legs:      ['quad', 'ham', 'squat'],   // squat pattern -> Legs (so Legs 0 also drops the squat main)
  calves:    ['calf'],
};
// Reverse lookup: movement category -> slider key (lowback/abs/forearm have none).
const MOVEMENT_SLIDER = (() => {
  const m = {};
  for (const k in SLIDER_MOVEMENTS) for (const mv of SLIDER_MOVEMENTS[k]) m[mv] = k;
  return m;
})();

// Per-muscle weekly working-set landmarks. SOURCE: Renaissance Periodization's
// classic published "Training Tips for Hypertrophy" grid (rpstrength.com),
// EXTERNAL to the 2020 book. Intermediate/advanced baseline; used only as a
// SEED — each athlete's evolving copy lives in profile.landmarks (see engine.js).
const VOLUME_LANDMARKS = {
  chest:     { mv: 8, mev: 10, mrv: 22 },
  vpull:     { mv: 8, mev: 10, mrv: 25 },   // RP "Back" applied across the back movements
  hpull:     { mv: 8, mev: 10, mrv: 25 },
  upperback: { mv: 8, mev: 10, mrv: 25 },
  quad:      { mv: 6, mev: 8,  mrv: 20 },
  ham:       { mv: 4, mev: 6,  mrv: 20 },
  glute:     { mv: 0, mev: 0,  mrv: 16 },   // MEV 0: covered indirectly by squats/deadlifts
  bicep:     { mv: 4, mev: 8,  mrv: 26 },
  tricep:    { mv: 4, mev: 6,  mrv: 18 },
  shoulder:  { mv: 6, mev: 8,  mrv: 26 },   // side delts (main aesthetic head)
  calf:      { mv: 6, mev: 8,  mrv: 20 },
  abs:       { mv: 0, mev: 0,  mrv: 25 },   // MEV 0: covered by bracing on compounds
  lowback:   { mv: 0, mev: 0,  mrv: 12 },   // covered by squats/deadlifts; rarely direct
};

// Seeds the landmark grid by training experience (the RP grid is intermediate+).
const EXPERIENCE_FACTOR = { beginner: 0.65, intermediate: 0.85, advanced: 1.0 };

// Movement categories a compound already trains indirectly, with a coverage
// weight 0..1 (1 = fully covers the muscle for that day). Drives coherent
// accessory pruning under a time deficit. Grounded in the book (p29-30, p159-160):
// squats already hit glutes/erectors; presses hit triceps/front delts; rows hit
// rear delts/forearms (NOT biceps). Keyed by the main/secondary lift's movement.
const SYNERGIST_COVERAGE = {
  squat:    { quad: 1.0, glute: 0.7, lowback: 0.5, ham: 0.3 },
  deadlift: { ham: 0.8, glute: 0.8, lowback: 1.0, upperback: 0.4 },
  bench:    { chest: 1.0, tricep: 0.7, shoulder: 0.4 },
  press:    { shoulder: 1.0, tricep: 0.7 },
  hpull:    { hpull: 1.0, upperback: 1.0, shoulder: 0.3 },  // rear delt, not bicep
  vpull:    { vpull: 1.0, upperback: 0.6, bicep: 0.5 },
};

// "Eyeballed" time constants for the session-time estimator (see engine.js).
// execSecPerRep: brainstorm "1-2 min / 10 reps" = 6-12 s/rep; book "3-9 s/rep"
// controlled (p65). Mains slower (heavier, unrack/rerack), accessories faster.
const TIME_MODEL = {
  execSecPerRep: { main: 12, secondary: 10, accessory: 6 },
  restSec:       { main: 120, secondary: 120, accessory: 90 },
  restSecTight:  { main: 90,  secondary: 90,  accessory: 60 },  // after rest compression
  warmupSecPerSet: 45,   // light warmup set + change plates
  sessionOverheadSec: 180,
};

// Bodybuilding muscle-focus slider (0..6) -> accessory set-count multiplier vs
// the scheme baseline (slider 3 = 1.0 = unchanged). 0 removes the exercise.
// Result is clamped to a per-session cap derived from the muscle's MRV, so an
// emphasized muscle never blows past its landmark in one session.
const FOCUS_FACTOR = { 0: 0, 1: 0.5, 2: 0.75, 3: 1, 4: 1.34, 5: 1.67, 6: 2.0 };

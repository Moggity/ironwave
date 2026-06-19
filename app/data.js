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

/* ============================================================
   IRONWAVE — data.js
   Exercise catalog, movement taxonomy, day templates,
   Juggernaut Method 2.0 wave tables (Chad Wesley Smith).
   ============================================================ */

// Single source of truth for the build the athlete is running. Shown in the
// More hub and Settings so the version on-screen can be checked against the
// repo, and it must be kept in step with CACHE_VERSION in sw.js (the service
// worker only ships new code to installed PWAs when that cache name changes).
// Bump this on any shell change (data/engine/app/styles/index/sw).
const APP_VERSION = '1.15.0';

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
  ['zercher-squat','Zercher Squat','squat','bb',0],
  ['smith-squat','Smith Machine Squat','squat','mc',0],

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
  ['smith-bench','Smith Machine Bench Press','bench','mc',0],

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
  ['assisted-pullup','Assisted Pull-up (Machine)','vpull','mc',0],
  ['muscle-up','Muscle-up','vpull','bw',0],
  ['db-pullover','DB Pullover','vpull','db',0],

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
  ['machine-row','Machine Row','hpull','mc',0],

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
  ['pendulum-squat','Pendulum Squat','quad','mc',0],
  ['hip-adduction-machine','Hip Adduction Machine','quad','mc',0],

  // ===== HAMSTRINGS / POSTERIOR =====
  ['romanian-deadlift','Romanian Deadlift','ham','bb',0],
  ['db-rdl','DB Romanian Deadlift','ham','db',0],
  ['single-leg-rdl','Single Leg RDL','ham','db',0],
  ['good-mornings','Good Mornings','ham','bb',0],
  ['hamstring-curls','Hamstring Curls','ham','mc',0],
  ['seated-leg-curl','Seated Leg Curl','ham','mc',0],
  ['standing-leg-curl','Standing Leg Curl','ham','mc',0],
  ['kb-swing','Kettlebell Swing','ham','kb',0],
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
  ['hip-abduction-machine','Hip Abduction Machine','glute','mc',0],

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
  ['machine-incline-press','Machine Incline Press','chest','mc',0],
  ['cable-fly','Cable Fly','chest','cb',0],
  ['db-fly','DB Fly','chest','db',0],
  ['pec-deck','Pec Deck','chest','mc',0],
  ['assisted-dip','Assisted Dip (Machine)','chest','mc',0],
  ['archer-pushup','Archer Push-up','chest','bw',0],
  ['pseudo-planche-pushup','Pseudo Planche Push-up','chest','bw',0],

  // ===== SHOULDER ACCESSORY =====
  ['lateral-raise','DB Lateral Raise','shoulder','db',0],
  ['cable-lateral-raise','Cable Lateral Raise','shoulder','cb',0],
  ['machine-lateral-raise','Machine Lateral Raise','shoulder','mc',0],
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
  ['db-kickback','DB Triceps Kickback','tricep','db',0],

  // ===== BICEPS =====
  ['bb-curl','Barbell Curl','bicep','bb',0],
  ['ez-curl','EZ Bar Curl','bicep','bb',0],
  ['db-curl','DB Curl','bicep','db',0],
  ['hammer-curl','Hammer Curl','bicep','db',0],
  ['incline-db-curl','Incline DB Curl','bicep','db',0],
  ['preacher-curl','Preacher Curl','bicep','mc',0],
  ['cable-curl','Cable Curl','bicep','cb',0],
  ['concentration-curl','Concentration Curl','bicep','db',0],
  ['spider-curl','Spider Curl','bicep','db',0],
  ['bayesian-curl','Bayesian Cable Curl','bicep','cb',0],
  ['reverse-curl','Reverse EZ Bar Curl','bicep','bb',0],

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
  ['crunch','Crunch','abs','bw',0],
  ['ab-crunch-machine','Machine Crunch','abs','mc',0],
  ['russian-twist','Russian Twist','abs','bw',0],
  ['cable-woodchop','Cable Woodchop','abs','cb',0],
  ['hanging-knee-raise','Hanging Knee Raise','abs','bw',0],
  ['hollow-hold','Hollow Body Hold','abs','bw',0],
  ['copenhagen-plank','Copenhagen Plank','abs','bw',0],
  ['dragon-flag','Dragon Flag','abs','bw',0],
  ['turkish-getup','Turkish Get-up','abs','kb',0],
];

// ============================================================
// [Cluster C] Head/region + stimulus metadata (Epic 3).
// Our OWN ratings and taxonomy, authored here (training opinions/facts, safe to
// write); we deliberately do NOT reproduce any product's exercise database or
// numeric SFR tables. Everything is OPTIONAL and INERT: no prescription code in
// engine.js reads these fields, so the golden master is untouched. The picker
// and the exercise detail surface them; a later slice lets the generator rotate
// and bias by head/SFR.
//   sfr     1..3 stimulus-to-fatigue read (1 lower, 2 moderate, 3 high)
//   stretch true when the exercise loads the lengthened position hard
//   head    a finer muscle region, only where heads genuinely differ
// ============================================================
const SFR_LABELS = { 1: 'Lower', 2: 'Moderate', 3: 'High' };
const HEAD_LABELS = {
  'delt-front': 'Front delt', 'delt-side': 'Side delt', 'delt-rear': 'Rear delt',
  'chest-upper': 'Upper chest', 'chest-lower': 'Mid/lower chest',
  'tri-long': 'Long head', 'tri-lateral': 'Lateral head',
  'back-lat': 'Lats', 'back-upper': 'Upper back',
  'ham-hip': 'Hip flexion', 'ham-knee': 'Knee flexion',
  'bi-long': 'Long head', 'bi-short': 'Short head',
};
// [Cluster C] Which muscle (the volume-screen row / landmark movement) each head
// rolls up to. Used to attribute heads that live on PATTERN movements (bench /
// press / deadlift carry no landmark of their own) to the muscle they build, so
// the per-head split is complete (e.g. an incline bench's upper-chest work shows
// under Chest). delt-rear rolls up to Upper back, matching where the rear-delt
// exercises already sit. The attribution is weighted by SYNERGIST_COVERAGE so the
// head numbers stay consistent with the (fractionally attributed) muscle bar.
const HEAD_MUSCLE = {
  'chest-upper': 'chest', 'chest-lower': 'chest',
  'delt-front': 'shoulder', 'delt-side': 'shoulder', 'delt-rear': 'upperback',
  'tri-long': 'tricep', 'tri-lateral': 'tricep',
  'bi-long': 'bicep', 'bi-short': 'bicep',
  'back-lat': 'vpull', 'back-upper': 'hpull',
  'ham-hip': 'ham', 'ham-knee': 'ham',
};
const EX_META_DEFAULT = { sfr: 2, stretch: false, head: null };

// [Cluster F] Training-phase / energy-balance taxonomy. Public concepts, our own
// copy. A deficit (cut/minicut) tells the autoregulator recovery is lower. No
// calorie/macro database: this is a training-coupled phase tag, not a nutrition
// tracker. Logic-only id list: the athlete-facing label and blurb live in the
// i18n catalogs ('phase.<id>' / 'phase.<id>_desc'), same pattern as GOAL_ARCHETYPES.
const PHASES = ['lean-gain', 'gain', 'maintenance', 'cut', 'minicut', 'peak'];
const PHASE_DEFICIT = { cut: true, minicut: true };
// [Epic G1/G3] Per-block phase colors for the macrocycle timeline. The container
// tint groups a block by phase; the legend reuses these. Our own palette (blues
// for building, teal for a cut, brown for maintenance, red for a peak), not a
// reproduction of any one app's scheme.
const PHASE_COLORS = {
  'lean-gain':  '#4b8df8',
  'gain':       '#3f6fe0',
  'maintenance': '#c98a3a',
  'cut':        '#2d9d8f',
  'minicut':   '#2d9d8f',
  'peak':       '#e2483d',
};
// [Epic G1] Default phase per block when none is stamped (legacy saves and the
// fixed templates). Mapped from the block's training type: hypertrophy builds
// (lean-gain), strength holds (maintenance), a peaking block sharpens (peak).
const DEFAULT_BLOCK_PHASE = {
  hypertrophy: 'lean-gain',
  strength:    'maintenance',
  peaking:     'peak',
  bridge:      'gain',
};
// [Epic G6] Hypertrophy goal archetypes. A bodybuilding athlete picks how they
// want to run the macrocycle: get lean fast for a near date, or build muscle over
// a long planned macro. The archetype sets a default length and a per-block phase
// sequence (cycled to the block count). Our own simple shapes, athlete-facing copy
// with no em dashes. Inert for non-bodybuilding tracks, so the default golden
// master is untouched.
// Copy is deliberately terse (owner feedback: nobody reads long option text);
// one line per card, the phase plan itself does the explaining on the timeline.
// Athlete-facing copy lives in the i18n catalogs ('goal.<id>', 'goal.<id>_desc',
// 'goal.<id>_warn'); this table keeps only the logic each archetype drives.
const GOAL_ARCHETYPES = {
  'serious-macro': {
    weeks: null, // null keeps the track's standard length
    phaseCycle: ['lean-gain', 'lean-gain', 'minicut', 'gain', 'gain', 'cut'],
  },
  // [Realism] Recomp / look-good: the middle ground (matches the early mockup of
  // two lean-gain blocks then a cut). Build a little, then lean down into the date.
  // The broadly-applicable pick, and the right call for newer lifters who can
  // build and lean at once.
  'recomp': {
    weeks: 18,
    phaseCycle: ['lean-gain', 'lean-gain', 'cut'],
  },
  'lean-asap': {
    weeks: 12,
    // A maintenance diet break every third block keeps a longer run from being one
    // unbroken deficit (you cannot cut hard indefinitely).
    phaseCycle: ['minicut', 'cut', 'maintenance'],
    warn: true, // an aggressive deficit gets a serious onboarding warning
  },
};
const EX_META = {
  // Big compounds: huge stimulus, high systemic fatigue -> lower SFR.
  'comp-squat': { sfr: 1 }, 'comp-bench': { sfr: 1, head: 'chest-lower' },
  'comp-deadlift': { sfr: 1 }, 'military-press': { sfr: 1, head: 'delt-front' },
  'conv-deadlift': { sfr: 1 }, 'sumo-deadlift': { sfr: 1 },
  'front-squat': { sfr: 2 }, 'close-grip-bench': { sfr: 2, head: 'tri-lateral' },
  // Hamstrings: RDL family is the loaded-stretch hip-flexion work; curls are knee.
  'romanian-deadlift': { sfr: 2, stretch: true, head: 'ham-hip' },
  'db-rdl': { sfr: 2, stretch: true, head: 'ham-hip' },
  'single-leg-rdl': { sfr: 2, stretch: true, head: 'ham-hip' },
  'stiff-leg-deadlift': { sfr: 2, stretch: true, head: 'ham-hip' },
  'good-mornings': { sfr: 2, stretch: true, head: 'ham-hip' },
  'hamstring-curls': { sfr: 3, head: 'ham-knee' },
  'seated-leg-curl': { sfr: 3, stretch: true, head: 'ham-knee' },
  'ghr': { sfr: 2, stretch: true, head: 'ham-knee' },
  'nordic-curl': { sfr: 2, stretch: true, head: 'ham-knee' },
  // Quads
  'leg-extensions': { sfr: 3 }, 'leg-press': { sfr: 2 },
  'hack-squat-machine': { sfr: 2, stretch: true }, 'sissy-squat': { sfr: 2, stretch: true },
  'bulgarian-split-squat': { sfr: 2, stretch: true },
  // Chest: incline = upper, dips/decline = lower; flyes load the stretch.
  'incline-bench': { sfr: 2, head: 'chest-upper' },
  'db-incline-bench': { sfr: 2, stretch: true, head: 'chest-upper' },
  'decline-bench': { sfr: 2, head: 'chest-lower' },
  'db-bench': { sfr: 2, stretch: true, head: 'chest-lower' },
  'dips': { sfr: 2, stretch: true, head: 'chest-lower' },
  'weighted-dips': { sfr: 2, stretch: true, head: 'chest-lower' },
  'cable-fly': { sfr: 3, stretch: true }, 'db-fly': { sfr: 2, stretch: true },
  'pec-deck': { sfr: 3 }, 'machine-chest-press': { sfr: 3, head: 'chest-lower' },
  'deficit-pushup': { sfr: 2, stretch: true, head: 'chest-lower' },
  // Shoulders by head.
  'lateral-raise': { sfr: 3, head: 'delt-side' },
  'cable-lateral-raise': { sfr: 3, stretch: true, head: 'delt-side' },
  'front-raise': { sfr: 2, head: 'delt-front' }, 'upright-row': { sfr: 2, head: 'delt-side' },
  'rear-delt-fly': { sfr: 3, head: 'delt-rear' }, 'reverse-pec-deck': { sfr: 3, head: 'delt-rear' },
  'face-pull': { sfr: 3, head: 'delt-rear' }, 'seated-db-press': { sfr: 2, head: 'delt-front' },
  'arnold-press': { sfr: 2, head: 'delt-front' }, 'machine-shoulder-press': { sfr: 3, head: 'delt-front' },
  // Triceps: overhead/skull hit the long head at length; pushdowns the lateral.
  'triceps-pushdown': { sfr: 3, head: 'tri-lateral' },
  'overhead-triceps-ext': { sfr: 3, stretch: true, head: 'tri-long' },
  'skullcrusher': { sfr: 2, stretch: true, head: 'tri-long' },
  'db-triceps-ext': { sfr: 2, stretch: true, head: 'tri-long' },
  'jm-press': { sfr: 2, head: 'tri-lateral' },
  // Biceps: incline curls bias the long head at length.
  'incline-db-curl': { sfr: 3, stretch: true, head: 'bi-long' },
  'preacher-curl': { sfr: 3, head: 'bi-short' }, 'cable-curl': { sfr: 3 },
  'bb-curl': { sfr: 2 }, 'db-curl': { sfr: 2 }, 'hammer-curl': { sfr: 2 },
  // Back: pulldowns/straight-arm bias the lats; rows the upper back.
  'lat-pulldown': { sfr: 3, head: 'back-lat' },
  'straight-arm-pulldown': { sfr: 3, stretch: true, head: 'back-lat' },
  'close-grip-pulldown': { sfr: 3, head: 'back-lat' },
  'pullup': { sfr: 2, stretch: true, head: 'back-lat' },
  'chinup': { sfr: 2, stretch: true, head: 'back-lat' },
  'barbell-row': { sfr: 2, head: 'back-upper' }, 'pendlay-row': { sfr: 2, head: 'back-upper' },
  'db-row': { sfr: 2, head: 'back-upper' }, 'chest-supported-row': { sfr: 3, head: 'back-upper' },
  'cable-row': { sfr: 3, head: 'back-upper' }, 'tbar-row': { sfr: 2, head: 'back-upper' },
  // Glutes / calves / abs: SFR and stretch where it matters, head left general.
  'bb-hip-thrust': { sfr: 2 }, 'cable-kickback': { sfr: 3 },
  'standing-calf-raise': { sfr: 3, stretch: true }, 'seated-calf-raise': { sfr: 3, stretch: true },
  'cable-crunch': { sfr: 3 }, 'hanging-leg-raise': { sfr: 2, stretch: true },
  // 2026-07 library expansion: machines, calisthenics, kettlebell, gaps.
  'zercher-squat': { sfr: 1 }, 'smith-squat': { sfr: 2 },
  'smith-bench': { sfr: 2, head: 'chest-lower' },
  'machine-incline-press': { sfr: 3, head: 'chest-upper' },
  'assisted-dip': { sfr: 3, stretch: true, head: 'chest-lower' },
  'archer-pushup': { sfr: 2, head: 'chest-lower' },
  'pseudo-planche-pushup': { sfr: 1 },
  'machine-lateral-raise': { sfr: 3, head: 'delt-side' },
  'assisted-pullup': { sfr: 3, stretch: true, head: 'back-lat' },
  'muscle-up': { sfr: 1 },
  'db-pullover': { sfr: 2, stretch: true, head: 'back-lat' },
  'machine-row': { sfr: 3, head: 'back-upper' },
  'pendulum-squat': { sfr: 3, stretch: true },
  'hip-adduction-machine': { sfr: 3 },
  'standing-leg-curl': { sfr: 3, head: 'ham-knee' },
  'kb-swing': { sfr: 2, head: 'ham-hip' },
  'hip-abduction-machine': { sfr: 3 },
  'crunch': { sfr: 3 }, 'ab-crunch-machine': { sfr: 3 },
  'russian-twist': { sfr: 2 }, 'cable-woodchop': { sfr: 2 },
  'hanging-knee-raise': { sfr: 3 }, 'hollow-hold': { sfr: 2 },
  'copenhagen-plank': { sfr: 2 }, 'dragon-flag': { sfr: 1 },
  'turkish-getup': { sfr: 1 },
  'concentration-curl': { sfr: 3, head: 'bi-short' },
  'spider-curl': { sfr: 3, head: 'bi-short' },
  'bayesian-curl': { sfr: 3, stretch: true, head: 'bi-long' },
  'reverse-curl': { sfr: 2 },
  'db-kickback': { sfr: 2, head: 'tri-lateral' },
};

const EXERCISES = EXERCISE_LIST.map(e => {
  const m = EX_META[e[0]] || EX_META_DEFAULT;
  return {
    id: e[0], name: e[1], movement: e[2], equipment: e[3], isMain: !!e[4],
    sfr: m.sfr ?? EX_META_DEFAULT.sfr, stretch: !!m.stretch, head: m.head || null,
  };
});

// ============================================================
// COACHING CUES — per exercise (3 to 6 short bullets each).
// Athlete-facing prose: keep it real and useful, no em dashes.
// app.js looks up EX_CUES[id] first, then falls back to the broad
// per-movement CUES map, then a generic default.
// ============================================================
const EX_CUES = {
  // ===== COMPETITION / BIG 4 =====
  'comp-squat': ['Take a big breath into the belly and brace your whole midsection before you unrack.', 'Set your stance and screw your feet into the floor to spread your knees out.', 'Break at the hips and knees together and sit between your legs to depth.', 'Keep the bar stacked over mid foot and drive your upper back into the bar out of the hole.', 'Stand by pushing the floor away, finishing hips and chest together.'],
  'comp-bench': ['Pull your shoulder blades down and back and pin them into the bench.', 'Set a moderate arch and plant your feet for leg drive without losing your butt.', 'Grip just outside shoulder width and stack your wrists over your elbows.', 'Lower the bar under control to the same point on your lower chest each rep.', 'Press up and slightly back toward your face, keeping your shoulders packed.'],
  'comp-deadlift': ['Set the bar over mid foot, about an inch from your shins.', 'Take the slack out of the bar and pull your chest up to set a flat back.', 'Push the floor away rather than yanking the bar off the ground.', 'Keep the bar dragging close to your legs the whole way up.', 'Finish by squeezing the glutes, not by leaning back or hyperextending.'],
  'military-press': ['Grip just outside the shoulders with the forearms vertical.', 'Brace your abs and squeeze your glutes so you do not lean back.', 'Keep the bar over mid foot and move your head back to clear the chin.', 'Press up and bring your head through once the bar clears your face.', 'Finish with the bar stacked over your ears and shoulders.'],

  // ===== SQUAT VARIATIONS =====
  'high-bar-squat': ['Rest the bar on the traps, just below the base of the neck.', 'Keep a tall, upright torso and let the knees travel forward.', 'Brace hard and descend to at least parallel with control.', 'Drive straight up through mid foot, keeping the chest tall.'],
  'low-bar-squat': ['Set the bar across the rear delts on the spine of the shoulder blades.', 'Grip tight and pull your elbows down to build a solid shelf.', 'Push your hips back more and keep your shins closer to vertical.', 'Lead the ascent with the hips while keeping the chest from dropping.'],
  'front-squat': ['Rack the bar on the front delts with a high elbow position.', 'Keep the elbows up and chest tall the entire rep.', 'Sit straight down with an upright torso.', 'Drive the elbows up hard as you stand to stop the chest caving.'],
  'pause-squat': ['Descend under control to your target depth.', 'Hold the bottom for a full count with no bouncing or relaxing.', 'Stay braced and keep tension through the pause.', 'Explode up out of the hole without shifting forward.'],
  'pin-squat': ['Set the pins to your target depth in the rack.', 'Lower under control and settle the bar fully onto the pins.', 'Kill all momentum, then drive up from a dead stop.', 'Stay tight on the pins so the bar does not shift or tip.'],
  'box-squat': ['Set a box that puts you at or just below parallel.', 'Sit back onto the box, pushing the hips rearward.', 'Pause briefly on the box without rocking or losing tightness.', 'Drive off the box by spreading the knees and pushing the floor away.'],
  'tempo-squat': ['Lower over a full three count, controlled the whole way.', 'Hit depth, then stand without any pause at the bottom.', 'Keep tension and position identical on every slow rep.', 'Use the slow eccentric to groove technique, not to grind.'],
  'ssb-squat': ['Let the bar settle on the upper back and brace against the pad.', 'Fight to keep the chest up; the bar wants to tip you forward.', 'Sit between the legs and squat to depth.', 'Drive up keeping the chest from collapsing forward.'],
  'belt-squat': ['Hang the load from the hips and stand tall with a braced trunk.', 'Let the hips do the work with no spinal loading.', 'Squat to depth with the knees tracking over the toes.', 'Drive up through mid foot without leaning hard on the handles.'],
  'one-half-squat': ['Squat to full depth, then come up only halfway.', 'Drop back to full depth, then stand all the way up for one rep.', 'Keep constant tension and never relax at the bottom.', 'Stay braced and upright through both portions.'],
  'dead-squat': ['Start from a dead stop with the bar on the pins at the bottom.', 'Brace fully before initiating, with no stretch reflex to help.', 'Drive up explosively from the dead position.', 'Reset tightness on the pins between each rep.'],
  'goblet-squat': ['Hold a dumbbell or kettlebell against your chest, elbows tucked.', 'Sit straight down between your knees, keeping the chest tall.', 'Use your elbows to gently push the knees out at the bottom.', 'Drive up through mid foot, staying upright the whole way.'],

  // ===== BENCH VARIATIONS =====
  'close-grip-bench': ['Grip roughly shoulder width, not super narrow, to spare the wrists.', 'Keep the elbows tucked closer to the body on the descent.', 'Touch lower on the chest, near the bottom of the sternum.', 'Press by driving the triceps to lockout.'],
  'wide-grip-bench': ['Take a grip wider than your competition setup.', 'Keep the shoulder blades retracted to protect the shoulders.', 'Lower to the chest through a shorter range of motion.', 'Avoid flaring the elbows excessively at the bottom.'],
  'tng-bench': ['Lower under control and touch the chest without bouncing hard.', 'Keep the touch light and reverse smoothly without losing tightness.', 'Maintain your arch and shoulder position through the turnaround.', 'Do not let the bar sink or crash into the chest.'],
  'spoto-press': ['Lower the bar to about an inch above the chest.', 'Pause in mid air for a full count, staying tight.', 'Hold position without letting the bar drift or sink.', 'Press from the dead pause straight back up.'],
  'larsen-press': ['Press with the legs straight and feet flat, no leg drive.', 'Keep the glutes and upper back tight on the bench.', 'Stay balanced; the core does the stabilizing here.', 'Touch and press from a stable, flat torso position.'],
  'incline-bench': ['Set the bench to about thirty to forty five degrees.', 'Pull the shoulder blades back and down before unracking.', 'Lower the bar to the upper chest, just below the collarbone.', 'Press up and slightly back over the shoulders.'],
  'decline-bench': ['Lock your legs in and set a stable base on the decline.', 'Retract the shoulder blades to protect the shoulders.', 'Lower the bar to the lower chest under control.', 'Press straight up over the lower-chest line.'],
  'floor-press': ['Lie on the floor with the knees bent or legs straight.', 'Lower until the triceps lightly touch the floor.', 'Pause briefly on the floor, keeping tension.', 'Press up by driving the triceps, with no leg drive.'],
  'board-press': ['Set the board on the chest and lower the bar to it.', 'Touch the board under control without bouncing.', 'Pause on the board, then press to lockout.', 'Use it to overload and train the mid to top range.'],
  'pin-press': ['Set the pins at your sticking-point height.', 'Lower or start the bar dead on the pins.', 'Kill the momentum, then press from a dead stop.', 'Stay tight so the bar does not shift on the pins.'],
  'tempo-bench': ['Lower over a controlled three count to the chest.', 'Pause one count on the chest with full tension.', 'Press up smoothly without losing position.', 'Use the slow tempo to build control and stability.'],
  'one-half-bench': ['Lower the bar fully to the chest.', 'Press halfway up, then lower back to the chest.', 'Press all the way to lockout to finish the rep.', 'Keep constant tension through both portions.'],
  'db-bench': ['Set the dumbbells over the shoulders with the wrists stacked.', 'Pull the shoulder blades back and down into the bench.', 'Lower to chest level with a controlled stretch.', 'Press up and slightly together without clanking the bells.'],
  'db-incline-bench': ['Set the bench to about thirty degrees.', 'Keep the shoulder blades retracted and down.', 'Lower the dumbbells to the upper chest for a full stretch.', 'Press up over the upper chest, controlling the bells.'],

  // ===== DEADLIFT VARIATIONS =====
  'conv-deadlift': ['Stance about hip width with the hands just outside the legs.', 'Take the slack out and set the lats and a flat back.', 'Push the floor away and keep the bar against the shins.', 'Lock out with the glutes, finishing tall and braced.'],
  'sumo-deadlift': ['Take a wide stance with the toes flared and shins near vertical.', 'Grip inside the legs and open the hips by spreading the knees.', 'Drop the hips, set the lats, and pull the slack out.', 'Push the floor apart and keep the bar tight to the body.'],
  'deficit-deadlift-1': ['Stand on a one inch platform to increase the range.', 'Set the same tight start position despite the lower hips.', 'Push through the floor and control the longer pull.', 'Use it to build speed and strength off the floor.'],
  'deficit-deadlift-2': ['Stand on a two inch platform for a larger deficit.', 'Expect lower hips and a tougher start, so brace hard.', 'Keep the bar close and drive through the whole foot.', 'Reserve this for off-the-floor weakness and use lighter loads.'],
  'block-pull': ['Set the bar on blocks just below the knee or as programmed.', 'Set your back and lats before pulling from the raised start.', 'Drive through the floor and finish with the glutes.', 'Use it to overload the lockout and upper range.'],
  'rack-pull': ['Set the pins just below or at the knee.', 'Brace and pull the slack out against the bar.', 'Push the floor away and lock out hard with the glutes.', 'Keep the bar dragging up the thighs to the finish.'],
  'pause-deadlift': ['Pull the bar a couple inches off the floor and stop.', 'Hold the pause while staying tight with the lats engaged.', 'Continue the pull without losing back position.', 'Use the pause to fix early positioning and tightness.'],
  'tempo-deadlift': ['Lower the bar slowly over a controlled count.', 'Keep the bar close and the back flat on the way down.', 'Reset or touch and go as programmed.', 'Use the slow eccentric to reinforce position.'],
  'snatch-grip-deadlift': ['Take a wide, snatch-width grip on the bar.', 'Set the hips a touch lower with the chest up.', 'Drive through the floor over the longer range.', 'Expect heavy upper-back and grip demand.'],
  'trap-bar-deadlift': ['Stand centered in the trap bar with a tall chest.', 'Grip the handles and take the slack out.', 'Push the floor away with a more upright torso.', 'Lock out tall, squeezing the glutes.'],
  'stiff-leg-deadlift': ['Keep the legs nearly straight with a soft knee.', 'Push the hips back to load the hamstrings.', 'Lower the bar along the legs until you feel a strong stretch.', 'Drive the hips forward to stand, not the lower back.'],

  // ===== OVERHEAD PRESS VARIATIONS =====
  'push-press': ['Set a tall braced position with the bar on the front delts.', 'Dip straight down a few inches with the torso vertical.', 'Drive up explosively with the legs and punch the bar overhead.', 'Lock out with the bar over the ears and finish braced.'],
  'z-press': ['Sit on the floor with the legs straight out in front.', 'Brace the core and sit tall with no back support.', 'Press the bar straight up over the head.', 'Keep the torso upright; the core controls the balance.'],
  'seated-db-press': ['Sit tall with back support and dumbbells at shoulder height.', 'Brace the abs and avoid arching off the bench.', 'Press up and slightly in until the bells nearly meet.', 'Lower under control to ear level for a full stretch.'],
  'db-shoulder-press': ['Stand tall with a braced trunk and tight glutes.', 'Start with the dumbbells at shoulder height, palms forward.', 'Press overhead without leaning back.', 'Lower under control to the shoulders.'],
  'arnold-press': ['Start with palms facing you and dumbbells in front of the shoulders.', 'Rotate the palms outward as you press overhead.', 'Keep the core braced and avoid leaning back.', 'Reverse the rotation smoothly on the way down.'],
  'landmine-press': ['Hold the bar end at shoulder height with a staggered stance.', 'Brace the core and press up and forward along the bar arc.', 'Keep the shoulder packed and avoid shrugging.', 'Lower under control back to the shoulder.'],
  'machine-shoulder-press': ['Set the seat so the handles sit at shoulder height.', 'Keep the back against the pad and the core braced.', 'Press up smoothly without locking out aggressively.', 'Lower under control for a full stretch at the shoulders.'],
  'pike-pushup': ['Start in a downward dog position with the hips high.', 'Lower the crown of the head toward the floor between the hands.', 'Keep the elbows tracking back at a moderate angle.', 'Press back up to the start, keeping the hips stacked.'],
  'handstand-pushup': ['Kick up to a handstand against a wall for support.', 'Brace the core and squeeze the glutes to stay rigid.', 'Lower under control until the head nears the floor.', 'Press back to full lockout, keeping the body straight.'],

  // ===== VERTICAL PULL =====
  'pullup': ['Grip slightly wider than shoulder width, palms away.', 'Start from a full hang with the shoulders set down.', 'Pull the elbows down and drive the chest to the bar.', 'Lower under control to a full stretch each rep.'],
  'chinup': ['Grip shoulder width with the palms facing you.', 'Set the shoulders down and start from a dead hang.', 'Pull the chest to the bar by driving the elbows down.', 'Lower under control to a full stretch.'],
  'weighted-pullup': ['Add load with a belt or held dumbbell.', 'Start from a controlled dead hang with the shoulders set.', 'Pull smoothly to the bar without kipping.', 'Lower under control over the full range.'],
  'neutral-pullup': ['Use parallel handles with the palms facing each other.', 'Start from a dead hang with the shoulders packed.', 'Pull the chest toward the hands, elbows driving down.', 'Lower under control to a full stretch.'],
  'lat-pulldown': ['Set the thigh pad and grip slightly wider than the shoulders.', 'Start with the lats stretched and the arms fully extended.', 'Pull the bar to the upper chest by driving the elbows down.', 'Control the bar back up to a full stretch, no swinging.'],
  'close-grip-pulldown': ['Use a close or neutral grip attachment.', 'Start from a full stretch with the arms extended.', 'Pull to the upper chest, leading with the elbows.', 'Control the return to a full overhead stretch.'],
  'straight-arm-pulldown': ['Stand tall and grip the bar with nearly straight arms.', 'Keep a soft elbow and hinge slightly at the hips.', 'Pull the bar to the thighs using the lats, not the triceps.', 'Control the bar back up to a full stretch overhead.'],

  // ===== HORIZONTAL PULL =====
  'barbell-row': ['Hinge to a torso angle around forty five degrees.', 'Set a flat back and engage the lats.', 'Row the bar to the lower chest or upper stomach.', 'Control the bar down without standing up or jerking.'],
  'pendlay-row': ['Set a flat back with the torso roughly parallel to the floor.', 'Start each rep from a dead stop on the floor.', 'Row explosively to the lower chest.', 'Lower under control and reset on the floor each rep.'],
  'db-row': ['Brace one hand and knee on a bench, back flat.', 'Let the dumbbell hang for a full stretch.', 'Row to the hip by driving the elbow back.', 'Lower under control and avoid twisting the torso.'],
  'kroc-row': ['Use heavy dumbbell rows for higher reps.', 'Brace on a bench or rack with a flat back.', 'Allow a little body english but keep the spine safe.', 'Get a full stretch and a strong squeeze each rep.'],
  'chest-supported-row': ['Lie chest down on an incline bench.', 'Let the arms hang for a full stretch.', 'Row by driving the elbows back and squeezing the back.', 'Lower under control with no torso movement.'],
  'seal-row': ['Lie face down on a flat bench raised off the floor.', 'Let the bar hang at a full stretch.', 'Row the bar to the bench, elbows driving back.', 'Pause and squeeze, then lower under control.'],
  'tbar-row': ['Straddle the bar with a flat back and braced trunk.', 'Let the weight hang for a full stretch.', 'Row to the chest by pulling the elbows back.', 'Lower under control without rounding the back.'],
  'cable-row': ['Sit tall with a slight forward lean to start the stretch.', 'Keep the chest up and pull the handle to the stomach.', 'Drive the elbows back and squeeze the shoulder blades.', 'Return under control to a full stretch without slumping.'],
  'meadows-row': ['Stand perpendicular to a landmine bar with a staggered stance.', 'Grip the bar end and let it hang for a full stretch.', 'Row up and back, driving the elbow high.', 'Lower under control, keeping the back braced.'],
  'inverted-row': ['Set a bar at hip height and hang underneath it.', 'Keep the body rigid in a straight line, glutes tight.', 'Pull the chest to the bar, driving the elbows back.', 'Lower under control to a full stretch.'],

  // ===== UPPER BACK / TRAPS / REAR DELT =====
  'bb-shrug': ['Hold the bar with a tall posture and braced core.', 'Shrug the shoulders straight up toward the ears.', 'Pause and squeeze the traps at the top.', 'Lower under control through a full range.'],
  'db-shrug': ['Hold dumbbells at the sides with a tall posture.', 'Shrug straight up, squeezing the traps at the top.', 'Avoid rolling the shoulders.', 'Lower under control to a full stretch.'],
  'face-pull': ['Set a rope at upper-chest to face height.', 'Pull the rope toward the face, hands splitting apart.', 'Lead with the elbows high and squeeze the rear delts.', 'Control the return without shrugging the traps.'],
  'band-pullapart': ['Hold a band at shoulder height with the arms extended.', 'Pull the band apart by squeezing the shoulder blades.', 'Keep the arms straight and lead with the upper back.', 'Return under control, resisting the band.'],
  'rear-delt-fly': ['Hinge over or sit bent with the dumbbells hanging.', 'Keep a soft elbow and raise the arms out to the sides.', 'Lead with the elbows and squeeze the rear delts.', 'Lower under control, avoiding momentum.'],
  'reverse-pec-deck': ['Set the seat so the handles are at shoulder height.', 'Keep a soft elbow and the chest against the pad.', 'Open the arms back, squeezing the rear delts.', 'Control the return without letting the weight crash.'],

  // ===== QUADS =====
  'leg-extensions': ['Set the pad just above the ankles and align the knee with the pivot.', 'Extend the knees fully and squeeze the quads at the top.', 'Pause briefly at full extension.', 'Lower under control through a full range.'],
  'leg-press': ['Set the feet mid platform about shoulder width.', 'Lower until the knees reach about ninety degrees or your safe depth.', 'Keep the lower back flat against the pad, no rounding.', 'Press through the whole foot without locking out hard.'],
  'hack-squat-machine': ['Set the shoulders and back against the pads.', 'Place the feet mid platform for balanced quad loading.', 'Lower under control to a deep but safe knee bend.', 'Drive up through the whole foot, keeping the back flat.'],
  'reverse-hack-squat': ['Face the pad with the shoulders under the supports.', 'Set the feet for an upright, quad-focused position.', 'Lower to depth keeping the chest against the pad.', 'Drive up through mid foot without losing position.'],
  'bulgarian-split-squat': ['Place the rear foot on a bench and find a stable stride.', 'Keep most of the weight on the front leg.', 'Lower straight down until the front thigh is parallel.', 'Drive up through the front foot, staying tall.'],
  'split-squat-glute': ['Take a longer stride to bias the glute.', 'Keep a slight forward torso lean over the front leg.', 'Lower straight down with the weight on the front heel.', 'Drive up through the front heel, squeezing the glute.'],
  'ffe-split-squat': ['Elevate the front foot on a small plate or wedge.', 'Keep the torso fairly upright over the front leg.', 'Lower into a deep stretch on the front quad.', 'Drive up through the front foot under control.'],
  'walking-lunge': ['Step forward into a stride and lower the back knee toward the floor.', 'Keep the front shin fairly vertical and the torso tall.', 'Drive through the front foot to step into the next rep.', 'Control each step and do not let the knee cave in.'],
  'reverse-lunge': ['Step backward into a stride under control.', 'Lower the back knee toward the floor, torso tall.', 'Keep the weight on the front foot.', 'Drive through the front heel to return to standing.'],
  'barbell-stepup': ['Set a box near knee height with the bar on the back.', 'Plant the whole front foot on the box.', 'Drive through the front heel to stand fully on top.', 'Lower under control without pushing off the bottom leg.'],
  'db-stepup': ['Hold dumbbells at the sides and set a knee-height box.', 'Plant the whole front foot on the box.', 'Drive through the front heel to stand tall on top.', 'Lower under control, minimizing push from the trailing leg.'],
  'pistol-squat': ['Stand on one leg with the other extended in front.', 'Sit back and down under control, keeping the heel down.', 'Reach the arms forward for balance.', 'Drive up through the whole foot without losing balance.'],
  'sissy-squat': ['Hold a support and rise onto the balls of the feet.', 'Lean back and bend the knees, driving them forward.', 'Lower until you feel a deep quad stretch.', 'Pull yourself back up using the quads.'],
  'wall-sit': ['Slide down a wall until the thighs are parallel.', 'Keep the knees over the ankles and the shins vertical.', 'Press the whole back into the wall and brace.', 'Hold for time, breathing steadily.'],

  // ===== HAMSTRINGS / POSTERIOR =====
  'romanian-deadlift': ['Start standing tall with the bar at the hips.', 'Push the hips back with a soft knee bend.', 'Lower the bar along the legs until you feel a hamstring stretch.', 'Drive the hips forward to stand, keeping the bar close.'],
  'db-rdl': ['Hold the dumbbells in front of the thighs.', 'Push the hips back with soft knees.', 'Lower the bells along the legs to a strong stretch.', 'Drive the hips forward to stand tall.'],
  'single-leg-rdl': ['Balance on one leg with a soft knee.', 'Hinge at the hip, extending the free leg behind.', 'Lower under control to a hamstring stretch, hips square.', 'Return by driving the hip forward, staying balanced.'],
  'good-mornings': ['Set the bar on the back as in a squat.', 'Soften the knees and push the hips back.', 'Hinge forward with a flat back until you feel the hamstrings.', 'Drive the hips forward to return to standing.'],
  'hamstring-curls': ['Set the pad just above the heels.', 'Curl the heels toward the glutes, squeezing the hamstrings.', 'Pause briefly at peak contraction.', 'Lower under control through a full range.'],
  'seated-leg-curl': ['Set the pad on the lower calves with the thighs locked down.', 'Curl the heels under by driving with the hamstrings.', 'Squeeze hard at the bottom of the curl.', 'Return under control to a full stretch.'],
  'ghr': ['Lock the feet and set the knees on the pad.', 'Keep the body straight from knee to head.', 'Lower under control by extending at the knees.', 'Pull yourself back up using the hamstrings.'],
  'nordic-curl': ['Anchor the ankles and kneel tall with a braced trunk.', 'Lower the body forward as slowly as you can.', 'Keep the hips extended and the body straight.', 'Catch and push back up, or use the hands to assist.'],
  'pull-throughs': ['Face away from a low cable with the rope between the legs.', 'Hinge at the hips, letting the rope travel back.', 'Drive the hips forward to stand and squeeze the glutes.', 'Keep the arms relaxed; the hips do the work.'],
  'back-extension': ['Set the pad at the hip crease so you can hinge freely.', 'Lower by bending at the hips with a flat back.', 'Raise until the body is in a straight line.', 'Squeeze the glutes at the top without overextending.'],
  'reverse-hyper': ['Lie face down with the hips at the edge of the pad.', 'Let the legs hang and swing down under control.', 'Raise the legs to about hip height using the glutes and hamstrings.', 'Avoid throwing the legs or overextending the spine.'],
  'sl-reverse-hyper': ['Set up as for the reverse hyper but use one leg.', 'Raise the single leg to hip height with control.', 'Squeeze the glute at the top.', 'Keep the hips square and avoid twisting.'],

  // ===== GLUTES =====
  'bb-hip-thrust': ['Set the upper back on a bench and the bar over the hips.', 'Tuck the chin and keep the ribs down.', 'Drive through the heels and squeeze the glutes to lockout.', 'Reach a flat-table position, then lower under control.'],
  'sl-hip-thrust': ['Set the upper back on a bench and extend one leg.', 'Drive through the planted heel.', 'Squeeze the glute to full hip extension.', 'Keep the hips level and lower under control.'],
  'glute-bridge': ['Lie on the floor with the knees bent and feet flat.', 'Drive through the heels to lift the hips.', 'Squeeze the glutes hard at the top.', 'Lower under control without arching the lower back.'],
  'frog-pumps': ['Lie on your back with the soles of the feet together, knees out.', 'Drive through the outer edges of the feet to lift the hips.', 'Squeeze the glutes hard at the top.', 'Lower under control and repeat for high reps.'],
  'cable-kickback': ['Attach a cuff to the ankle facing the low cable.', 'Brace the trunk and keep a slight hinge.', 'Kick the leg back by squeezing the glute.', 'Return under control without arching the lower back.'],
  'curtsy-lunge': ['Step one leg back and across behind the other.', 'Lower under control, keeping the front knee tracking.', 'Feel the stretch in the glute of the front leg.', 'Drive through the front heel to return.'],

  // ===== CALVES =====
  'standing-calf-raise': ['Stand with the balls of the feet on the platform.', 'Let the heels drop for a full stretch at the bottom.', 'Rise onto the toes as high as possible.', 'Pause and squeeze at the top, then lower under control.'],
  'seated-calf-raise': ['Set the pad on the lower thighs with the balls of the feet on the platform.', 'Drop the heels for a full stretch.', 'Raise onto the toes and squeeze the calves.', 'Lower under control through a full range.'],
  'sl-calf-raise': ['Balance on one foot with the ball on a step.', 'Drop the heel for a full stretch.', 'Rise onto the toes as high as possible.', 'Squeeze at the top and lower under control.'],
  'leg-press-calf-raise': ['Place the balls of the feet on the bottom of the platform.', 'Keep a soft knee and push through the toes.', 'Press the platform up by extending the ankles.', 'Lower under control to a deep stretch.'],
  'donkey-calf-raise': ['Bend at the hips with the balls of the feet on a platform.', 'Let the heels drop for a deep stretch.', 'Drive up onto the toes and squeeze.', 'Lower under control through a full range.'],

  // ===== CHEST ACCESSORY =====
  'dips': ['Start at the top with the arms locked and shoulders down.', 'Lean the torso forward slightly for the chest.', 'Lower until the upper arms reach about parallel.', 'Press back to lockout, squeezing the chest and triceps.'],
  'weighted-dips': ['Add load with a belt and start locked out, shoulders set.', 'Lower under control to a comfortable shoulder depth.', 'Keep a slight forward lean for the chest.', 'Press to lockout without flaring the shoulders.'],
  'pushup': ['Set the hands about shoulder width with a rigid body.', 'Brace the abs and squeeze the glutes to stay in a straight line.', 'Lower the chest to just above the floor.', 'Press up while keeping the elbows at a moderate angle.'],
  'deficit-pushup': ['Elevate the hands on plates or handles for more range.', 'Keep the body rigid in a straight line.', 'Lower deep until the chest passes the hands.', 'Press back up under control.'],
  'machine-chest-press': ['Set the seat so the handles align with the mid chest.', 'Keep the shoulder blades back and down.', 'Press the handles forward without locking out hard.', 'Return under control to a full stretch.'],
  'cable-fly': ['Set the cables and take a staggered stance with a soft elbow.', 'Bring the hands together in an arc in front of the chest.', 'Squeeze the chest at the midpoint.', 'Open the arms under control to a stretch, keeping the elbow angle fixed.'],
  'db-fly': ['Lie on a flat bench with the dumbbells over the chest, soft elbows.', 'Open the arms out in a wide arc to a chest stretch.', 'Keep the elbow angle fixed throughout.', 'Bring the bells back together, squeezing the chest.'],
  'pec-deck': ['Set the seat so the handles are at chest height.', 'Keep the back on the pad and a soft elbow.', 'Bring the pads together, squeezing the chest.', 'Return under control to a stretch.'],

  // ===== SHOULDER ACCESSORY =====
  'lateral-raise': ['Hold dumbbells at the sides with a slight elbow bend.', 'Raise the arms out to the sides to about shoulder height.', 'Lead with the elbows, not the hands.', 'Lower under control without swinging.'],
  'cable-lateral-raise': ['Stand side-on to a low cable and grip the handle.', 'Raise the arm out to the side to shoulder height.', 'Lead with the elbow and keep the cable path smooth.', 'Lower under control against the cable.'],
  'front-raise': ['Hold the weight in front of the thighs.', 'Raise to shoulder height with a soft elbow.', 'Avoid swinging or leaning back.', 'Lower under control.'],
  'upright-row': ['Grip the bar about shoulder width.', 'Pull the bar up the body, leading with the elbows.', 'Raise to about chest height, keeping the bar close.', 'Lower under control, and avoid pulling too high if the shoulders pinch.'],

  // ===== TRICEPS =====
  'triceps-pushdown': ['Set a bar or rope at the top of a cable.', 'Keep the elbows pinned to the sides.', 'Extend the arms fully and squeeze the triceps.', 'Return under control without letting the elbows drift.'],
  'overhead-triceps-ext': ['Set a rope or bar and face away with the arms overhead.', 'Keep the elbows in and pointed forward.', 'Extend the arms fully overhead, squeezing the triceps.', 'Lower under control to a deep stretch.'],
  'skullcrusher': ['Lie on a bench with the bar over the forehead, elbows in.', 'Lower the bar toward the forehead or behind the head.', 'Keep the upper arms still and elbows pointing up.', 'Extend to lockout, squeezing the triceps.'],
  'jm-press': ['Set up like a close-grip bench with the elbows tucked.', 'Lower the bar toward the upper neck, bending mostly at the elbow.', 'Keep the forearms tight to the biceps at the bottom.', 'Press up by extending the triceps powerfully.'],
  'db-triceps-ext': ['Hold a dumbbell overhead or lie back with the elbows in.', 'Keep the upper arms still and elbows pointed up.', 'Lower to a deep triceps stretch.', 'Extend to lockout, squeezing the triceps.'],
  'close-grip-pushup': ['Set the hands close, near shoulder width or narrower.', 'Keep the elbows tucked close to the body.', 'Lower the chest to the hands with a rigid body.', 'Press up by driving the triceps to lockout.'],
  'bench-dips': ['Set the hands on a bench behind you, legs out front.', 'Lower by bending the elbows straight back.', 'Keep the hips close to the bench.', 'Press back to lockout through the triceps.'],

  // ===== BICEPS =====
  'bb-curl': ['Stand tall with the bar at shoulder width.', 'Keep the elbows pinned at the sides.', 'Curl the bar up by contracting the biceps.', 'Lower under control to a full stretch, no swinging.'],
  'ez-curl': ['Grip the angled bar where the wrists feel comfortable.', 'Keep the elbows at the sides and the torso still.', 'Curl up, squeezing the biceps at the top.', 'Lower under control to a full stretch.'],
  'db-curl': ['Hold dumbbells at the sides, palms forward or neutral to start.', 'Keep the elbows pinned and curl up, supinating the wrist.', 'Squeeze the biceps at the top.', 'Lower under control to a full stretch.'],
  'hammer-curl': ['Hold dumbbells with a neutral grip, palms facing in.', 'Keep the elbows at the sides.', 'Curl up without rotating the wrists.', 'Lower under control, hitting the brachialis and forearm.'],
  'incline-db-curl': ['Sit back on an incline bench with the arms hanging.', 'Keep the elbows back to maximize the stretch.', 'Curl up, squeezing the biceps at the top.', 'Lower under control to a full stretch.'],
  'preacher-curl': ['Set the arms on the pad with the armpits over the top.', 'Keep the upper arms flat on the pad.', 'Curl up, squeezing the biceps at the top.', 'Lower under control without fully relaxing at the bottom.'],
  'cable-curl': ['Stand facing a low cable with a bar or handle.', 'Keep the elbows pinned at the sides.', 'Curl up against constant cable tension.', 'Lower under control to a full stretch.'],

  // ===== ABS / CORE =====
  'ab-wheel': ['Start on the knees gripping the wheel under the shoulders.', 'Brace the abs and tuck the pelvis to flatten the back.', 'Roll out under control without letting the hips sag.', 'Pull back with the abs, keeping the spine neutral.'],
  'hanging-leg-raise': ['Hang from a bar with the shoulders active.', 'Brace the core and avoid swinging.', 'Raise the legs by curling the pelvis up.', 'Lower under control without rocking.'],
  'decline-situp': ['Lock the legs in on a decline bench.', 'Brace the abs and curl up, leading with the chest.', 'Avoid yanking with the neck or arms.', 'Lower under control, keeping tension on the abs.'],
  'cable-crunch': ['Kneel facing the cable with the rope by the head.', 'Crunch the rib cage toward the pelvis by flexing the spine.', 'Keep the hips fixed; only the spine moves.', 'Return under control, resisting the cable.'],
  'plank': ['Set the forearms under the shoulders, body in a straight line.', 'Brace the abs and squeeze the glutes.', 'Keep the hips level, neither sagging nor piking.', 'Breathe steadily and hold for time.'],
  'side-plank': ['Stack the body on one forearm, feet stacked or staggered.', 'Lift the hips so the body forms a straight line.', 'Brace the obliques and keep the hips up.', 'Hold for time, then switch sides.'],
  'pallof-press': ['Stand side-on to a cable at chest height.', 'Brace the core against the cable pull.', 'Press the hands straight out and resist the rotation.', 'Return under control without letting the torso twist.'],
  'db-side-bend': ['Hold a dumbbell at one side, standing tall.', 'Bend laterally toward the weight under control.', 'Return by contracting the opposite obliques.', 'Avoid leaning forward or back; stay in one plane.'],
  'dead-bug': ['Lie on the back with the arms up and knees bent at ninety.', 'Press the lower back into the floor and brace.', 'Lower the opposite arm and leg without arching.', 'Return under control and alternate sides.'],
  'l-sit': ['Support the body on the hands or parallettes.', 'Brace the core and lift the legs to horizontal.', 'Keep the legs straight and the toes pointed.', 'Hold for time, keeping the shoulders down.'],
  'farmer-carry': ['Pick up the load with a flat back and tall posture.', 'Brace the core and keep the shoulders back.', 'Walk with controlled steps, staying tall.', 'Keep the weights from swinging.'],
  'suitcase-carry': ['Hold one weight at one side, standing tall.', 'Brace hard to resist leaning toward the weight.', 'Walk with level shoulders and hips.', 'Keep the trunk upright and controlled.'],

  // ===== 2026-07 LIBRARY EXPANSION =====
  'zercher-squat': ['Cradle the bar in the crook of the elbows, hands clasped.', 'Keep the elbows high and the chest tall against the load.', 'Sit between the legs to depth with a braced trunk.', 'Drive up through mid foot without letting the bar roll down the arms.'],
  'smith-squat': ['Set your feet slightly ahead of the bar path.', 'Unrack and let the fixed path take the balance work away.', 'Squat to depth with the knees tracking over the toes.', 'Drive up smoothly; use the fixed path to push the quads hard.'],
  'smith-bench': ['Set the bench so the bar meets your lower chest.', 'Pull the shoulder blades back and down into the bench.', 'Lower under control to the same spot each rep.', 'Press along the fixed path and stop shy of harsh lockouts.'],
  'machine-incline-press': ['Set the seat so the handles start at upper-chest height.', 'Keep the shoulder blades back against the pad.', 'Press up and together without shrugging.', 'Lower under control for a full stretch on the upper chest.'],
  'assisted-dip': ['Set the counterweight so you can hit the target reps cleanly.', 'Lean slightly forward with the shoulders down.', 'Lower until you feel a deep stretch across the chest.', 'Press back up without locking out harshly.'],
  'archer-pushup': ['Take a wide push-up stance with one arm out to the side.', 'Lower toward the working arm, keeping the other nearly straight.', 'Keep the hips square and the core braced.', 'Press back to center and alternate sides.'],
  'pseudo-planche-pushup': ['Set the hands at waist level with the fingers turned out.', 'Lean the shoulders far forward past the hands.', 'Keep the elbows tucked and the body rigid.', 'Press back up while holding the forward lean.'],
  'machine-lateral-raise': ['Set the seat so the pads sit just above the elbows.', 'Raise the arms out to the sides up to shoulder height.', 'Lead with the elbows, not the hands.', 'Lower under control, keeping tension on the side delts.'],
  'assisted-pullup': ['Set the counterweight so you can finish every prescribed rep.', 'Start from a full hang with the shoulders set down.', 'Pull the chest to the bar by driving the elbows down.', 'Lower under control to a full stretch each rep.'],
  'muscle-up': ['Start from a dead hang with a false grip if you can.', 'Pull explosively high toward the sternum.', 'Lean forward and punch the chest over the bar in one motion.', 'Press out to lockout, then lower under control.'],
  'db-pullover': ['Lie across or along a bench holding one dumbbell over the chest.', 'Keep a slight elbow bend and lower the bell back overhead.', 'Stop at a deep lat stretch without flaring the ribs.', 'Pull the weight back over the chest with the lats.'],
  'machine-row': ['Set the chest pad so the handles are at full reach.', 'Pull the handles to the torso, driving the elbows back.', 'Squeeze the shoulder blades together at the back.', 'Return under control to a full stretch.'],
  'pendulum-squat': ['Set the shoulders under the pads and the feet high on the plate.', 'Lower along the arc to a deep, controlled bottom.', 'Let the knees travel and keep the hips against the pad.', 'Drive up without slamming the top of the stroke.'],
  'hip-adduction-machine': ['Sit tall with the pads inside the knees.', 'Open to a comfortable stretch to start.', 'Squeeze the legs together under control.', 'Return slowly, resisting the pads on the way out.'],
  'standing-leg-curl': ['Set the pad just above the ankle of the working leg.', 'Keep the hips pinned; only the knee moves.', 'Curl the heel toward the glute and squeeze.', 'Lower under control to a full stretch.'],
  'kb-swing': ['Hinge at the hips and hike the bell back between the legs.', 'Snap the hips forward hard to float the bell to chest height.', 'Keep the back flat and the arms relaxed; the hips do the work.', 'Let the bell swing back and hinge again without squatting.'],
  'hip-abduction-machine': ['Sit tall with the pads outside the knees.', 'Push the legs apart under control.', 'Pause briefly at the widest point and squeeze the glutes.', 'Return slowly without letting the stack slam.'],
  'crunch': ['Lie on your back with the knees bent and feet flat.', 'Curl the rib cage toward the pelvis, peeling the upper back off the floor.', 'Keep the lower back down and the neck relaxed.', 'Lower under control, keeping tension on the abs.'],
  'ab-crunch-machine': ['Set the seat so the pad sits at chest height.', 'Crunch the rib cage toward the pelvis against the load.', 'Keep the hips fixed; only the spine flexes.', 'Return under control, resisting the stack.'],
  'russian-twist': ['Sit back to about forty five degrees with the knees bent.', 'Hold the weight in front of the chest.', 'Rotate the torso side to side under control.', 'Keep the chest tall and move from the trunk, not the arms.'],
  'cable-woodchop': ['Stand side-on to a high cable with straight arms.', 'Pull the handle down and across the body to the opposite hip.', 'Rotate from the trunk with the hips following.', 'Return under control along the same arc.'],
  'hanging-knee-raise': ['Hang from a bar with the shoulders active.', 'Brace the core and avoid swinging.', 'Raise the knees toward the chest by curling the pelvis up.', 'Lower under control without rocking.'],
  'hollow-hold': ['Lie on your back and press the lower back into the floor.', 'Lift the shoulders and legs a few inches off the ground.', 'Reach the arms overhead without arching.', 'Hold the shape and breathe steadily.'],
  'copenhagen-plank': ['Set one foot or knee on a bench, body side-on like a side plank.', 'Lift the hips so the body forms a straight line.', 'Squeeze the inner thigh of the top leg to hold.', 'Keep the hips stacked and hold for time.'],
  'dragon-flag': ['Lie on a bench and grip it firmly behind your head.', 'Press the body up so only the upper back stays on the bench.', 'Keep the body rigid in one straight line.', 'Lower under control without letting the hips break.'],
  'turkish-getup': ['Press the bell overhead lying down and lock the eyes on it.', 'Move through each position slowly: roll to the elbow, the hand, then the hips.', 'Keep the arm vertical and the shoulder packed the whole way.', 'Stand tall, then reverse each step under control.'],
  'concentration-curl': ['Sit with the working elbow braced against the inner thigh.', 'Curl the dumbbell up without swinging the torso.', 'Squeeze the biceps hard at the top.', 'Lower slowly to a full stretch.'],
  'spider-curl': ['Lie chest-down on an incline bench with the arms hanging.', 'Curl the weight up without moving the upper arms.', 'Squeeze at the top with the shoulders staying down.', 'Lower slowly to a dead hang each rep.'],
  'bayesian-curl': ['Stand facing away from a low cable, arm behind the body.', 'Start from a deep stretch with the shoulder extended back.', 'Curl through to full flexion without drifting the elbow forward.', 'Return slowly, feeling the long head stretch at the bottom.'],
  'reverse-curl': ['Grip the bar overhand at shoulder width.', 'Curl up keeping the wrists straight and knuckles up.', 'Keep the elbows pinned at the sides.', 'Lower slowly, resisting through the forearms.'],
  'db-kickback': ['Hinge over with the upper arm parallel to the floor.', 'Extend the elbow until the arm is straight back.', 'Squeeze the triceps hard at lockout.', 'Return under control without dropping the elbow.'],
};

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
  // Secondary anchor exposure: moderate reps priced off the working max to hit
  // a real RIR ramp (book: 5-10 rep work is only effective near failure, at
  // roughly 75-85% 1RM; the old 5 reps at 60% of WM sat ~20 RIR from failure).
  secReps:  8, secRpe: [7, 7.5, 8, 9],
  deload:   { accSets: 2, accRpe: 6, secSets: 2, secPct: 0.45 },
};

// [Epic H4] Rep ranges by movement (our own numbers: big compound patterns
// low, most direct muscle work moderate, arms/delts higher, metabolic work
// high). A high-SFR pick (3, typically machines/isolation that tolerate reps
// cheaply) trains 2 reps above its movement band; see Engine.repRangeFor.
// Bodybuilding-track-only: the flat JBB_HYP.accReps stays the default-path
// prescription, so the golden master never reads this table.
const REP_RANGES = {
  default:  [10, 15],
  bench: [6, 10], press: [6, 10], squat: [6, 10], deadlift: [6, 10],
  vpull: [8, 12], hpull: [8, 12], upperback: [8, 12],
  chest: [8, 12], quad: [8, 12], ham: [8, 12], glute: [8, 12], lowback: [8, 12],
  shoulder: [10, 15], bicep: [10, 15], tricep: [10, 15],
  calf: [12, 20], abs: [12, 20],
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
  // [2-day] Paired mains (owner-approved pairing: squat+bench / deadlift+press):
  // two waves in one session, two AMRAPs on realization day, one pull accessory
  // each, trimmed selects. The minimum effective strength dose.
  2: [
    { name: 'Day 1', slots: [
      { type:'main', lift:'comp-squat' },
      { type:'main', lift:'comp-bench' },
      { type:'acc', cat:'hpull', def:'chest-supported-row' },
      { type:'select', cat:'abs' },
    ]},
    { name: 'Day 2', slots: [
      { type:'main', lift:'comp-deadlift' },
      { type:'main', lift:'military-press' },
      { type:'acc', cat:'vpull', def:'lat-pulldown' },
      { type:'select', cat:'bicep' },
    ]},
  ],
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

// ============================================================
// BODYBUILDING DAY TEMPLATES (hypertrophy splits)
// Used for the bodybuilding track instead of the strength-oriented
// DAY_TEMPLATES above. Splits: 3 = full body x3, 4 = upper/lower x2,
// 5 = push/pull/legs/upper/lower, 6 = push/pull/legs x2. No deadlift.
// The barbell compounds (bench/squat/press) remain the working-max
// anchors (the wave/AMRAP math needs the real lift for correct weights);
// they are swappable. Non-anchor days lead with a big bodybuilding
// movement (a pulldown or row, a leg press), with barbell as a swap.
// ============================================================
const BB_DAY_TEMPLATES = {
  // [2-day] Fallback full-body pair if the generator cannot fill the week.
  2: [
    { name: 'Full Body A', nameKey: 'full_body_a', slots: [
      { type:'main', lift:'comp-bench' },
      { type:'acc', cat:'quad', def:'leg-press' },
      { type:'acc', cat:'vpull', def:'lat-pulldown' },
      { type:'acc', cat:'ham', def:'seated-leg-curl' },
      { type:'select', cat:'shoulder' },
    ]},
    { name: 'Full Body B', nameKey: 'full_body_b', slots: [
      { type:'main', lift:'comp-squat' },
      { type:'acc', cat:'bench', def:'db-incline-bench' },
      { type:'acc', cat:'hpull', def:'chest-supported-row' },
      { type:'acc', cat:'calf', def:'standing-calf-raise' },
      { type:'select', cat:'bicep' },
    ]},
  ],
  3: [
    { name: 'Full Body A', nameKey: 'full_body_a', slots: [
      { type:'main', lift:'comp-bench' },
      { type:'acc', cat:'vpull', def:'lat-pulldown' },
      { type:'acc', cat:'quad',  def:'leg-press' },
      { type:'acc', cat:'ham',   def:'seated-leg-curl' },
      { type:'select', cat:'shoulder' },
    ]},
    { name: 'Full Body B', nameKey: 'full_body_b', slots: [
      { type:'main', lift:'comp-squat' },
      { type:'acc', cat:'hpull', def:'chest-supported-row' },
      { type:'acc', cat:'bench', def:'db-incline-bench' },
      { type:'acc', cat:'calf',  def:'standing-calf-raise' },
      { type:'select', cat:'bicep' },
    ]},
    { name: 'Full Body C', nameKey: 'full_body_c', slots: [
      { type:'main', lift:'military-press' },
      { type:'acc', cat:'vpull', def:'pullup' },
      { type:'acc', cat:'ham',   def:'romanian-deadlift' },
      { type:'acc', cat:'tricep', def:'triceps-pushdown' },
      { type:'select', cat:'bicep' },
    ]},
  ],
  4: [
    { name: 'Upper A', nameKey: 'upper_a', slots: [
      { type:'main', lift:'comp-bench' },
      { type:'acc', cat:'vpull', def:'lat-pulldown' },
      { type:'acc', cat:'hpull', def:'chest-supported-row' },
      { type:'acc', cat:'shoulder', def:'lateral-raise' },
      { type:'select', cat:'tricep' },
    ]},
    { name: 'Lower A', nameKey: 'lower_a', slots: [
      { type:'main', lift:'comp-squat' },
      { type:'acc', cat:'ham',  def:'romanian-deadlift' },
      { type:'acc', cat:'quad', def:'leg-extensions' },
      { type:'acc', cat:'calf', def:'standing-calf-raise' },
      { type:'select', cat:'glute' },
    ]},
    { name: 'Upper B', nameKey: 'upper_b', slots: [
      { type:'main', lift:'military-press' },
      { type:'acc', cat:'vpull', def:'pullup' },
      { type:'acc', cat:'bench', def:'db-incline-bench' },
      { type:'acc', cat:'upperback', def:'face-pull' },
      { type:'select', cat:'bicep' },
    ]},
    { name: 'Lower B', nameKey: 'lower_b', slots: [
      { type:'acc', cat:'quad', def:'leg-press' },
      { type:'acc', cat:'ham',  def:'seated-leg-curl' },
      { type:'acc', cat:'glute', def:'bb-hip-thrust' },
      { type:'acc', cat:'calf', def:'seated-calf-raise' },
      { type:'select', cat:'abs' },
    ]},
  ],
  5: [
    { name: 'Push', nameKey: 'push', slots: [
      { type:'main', lift:'comp-bench' },
      { type:'acc', cat:'bench', def:'db-incline-bench' },
      { type:'acc', cat:'shoulder', def:'lateral-raise' },
      { type:'acc', cat:'tricep', def:'triceps-pushdown' },
      { type:'select', cat:'chest' },
    ]},
    { name: 'Pull', nameKey: 'pull', slots: [
      { type:'acc', cat:'vpull', def:'lat-pulldown' },
      { type:'acc', cat:'hpull', def:'barbell-row' },
      { type:'acc', cat:'upperback', def:'face-pull' },
      { type:'acc', cat:'bicep', def:'ez-curl' },
      { type:'select', cat:'bicep' },
    ]},
    { name: 'Legs', nameKey: 'legs', slots: [
      { type:'main', lift:'comp-squat' },
      { type:'acc', cat:'ham',  def:'romanian-deadlift' },
      { type:'acc', cat:'quad', def:'leg-extensions' },
      { type:'acc', cat:'calf', def:'standing-calf-raise' },
      { type:'select', cat:'glute' },
    ]},
    { name: 'Upper', nameKey: 'upper', slots: [
      { type:'main', lift:'military-press' },
      { type:'acc', cat:'vpull', def:'chinup' },
      { type:'acc', cat:'hpull', def:'chest-supported-row' },
      { type:'acc', cat:'bench', def:'machine-chest-press' },
      { type:'select', cat:'tricep' },
    ]},
    { name: 'Lower', nameKey: 'lower', slots: [
      { type:'acc', cat:'quad', def:'leg-press' },
      { type:'acc', cat:'ham',  def:'seated-leg-curl' },
      { type:'acc', cat:'glute', def:'bb-hip-thrust' },
      { type:'acc', cat:'calf', def:'seated-calf-raise' },
      { type:'select', cat:'abs' },
    ]},
  ],
  6: [
    { name: 'Push A', nameKey: 'push_a', slots: [
      { type:'main', lift:'comp-bench' },
      { type:'acc', cat:'bench', def:'db-incline-bench' },
      { type:'acc', cat:'shoulder', def:'lateral-raise' },
      { type:'acc', cat:'tricep', def:'triceps-pushdown' },
    ]},
    { name: 'Pull A', nameKey: 'pull_a', slots: [
      { type:'acc', cat:'vpull', def:'lat-pulldown' },
      { type:'acc', cat:'hpull', def:'barbell-row' },
      { type:'acc', cat:'upperback', def:'face-pull' },
      { type:'acc', cat:'bicep', def:'ez-curl' },
    ]},
    { name: 'Legs A', nameKey: 'legs_a', slots: [
      { type:'main', lift:'comp-squat' },
      { type:'acc', cat:'ham',  def:'romanian-deadlift' },
      { type:'acc', cat:'quad', def:'leg-extensions' },
      { type:'acc', cat:'calf', def:'standing-calf-raise' },
    ]},
    { name: 'Push B', nameKey: 'push_b', slots: [
      { type:'main', lift:'military-press' },
      { type:'acc', cat:'bench', def:'machine-chest-press' },
      { type:'acc', cat:'shoulder', def:'cable-lateral-raise' },
      { type:'acc', cat:'tricep', def:'overhead-triceps-ext' },
    ]},
    { name: 'Pull B', nameKey: 'pull_b', slots: [
      { type:'acc', cat:'vpull', def:'pullup' },
      { type:'acc', cat:'hpull', def:'cable-row' },
      { type:'acc', cat:'upperback', def:'rear-delt-fly' },
      { type:'acc', cat:'bicep', def:'hammer-curl' },
    ]},
    { name: 'Legs B', nameKey: 'legs_b', slots: [
      { type:'acc', cat:'quad', def:'leg-press' },
      { type:'acc', cat:'ham',  def:'seated-leg-curl' },
      { type:'acc', cat:'glute', def:'bb-hip-thrust' },
      { type:'acc', cat:'calf', def:'seated-calf-raise' },
    ]},
  ],
};

// Muscle-group check-in questions per main movement on the day. Logic-only
// keys: the athlete-facing group label lives in the i18n catalogs
// ('ci.group_<key>'), so the table stays translation-free.
const CHECKIN_GROUPS = {
  bench:    { key:'bench' },
  press:    { key:'press' },
  squat:    { key:'squat' },
  deadlift: { key:'deadlift' },
  lowback:  { key:'lowback' },
  upperpull:{ key:'upperpull' },
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

// [Epic H1] Unit display. kg is the ONLY stored unit everywhere (records, maxes,
// plates, tonnage); pounds are a render/input skin. One pound is exactly
// 0.45359237 kg, so a weight entered in lb converts to kg and back losslessly.
const KG_PER_LB = 0.45359237;

// Common US lb plate colors (rubber-plate convention), keyed by the plate's lb
// face value for the plate-math visual.
const PLATE_COLORS_LB = {
  '55': '#e2483d', '45': '#3b6fe0', '35': '#f0b429', '25': '#3ba55d',
  '10': '#e8e8ec', '5': '#d23c3c', '2.5': '#9aa0ae', '1.25': '#9aa0ae',
};
const PLATE_TEXT_LB = { '10': '#10162b', '2.5': '#10162b', '1.25': '#10162b' };

// A standard lb plate set, stored (like everything) in kg.
const DEFAULT_PLATES_LB = [
  { w: 45 * KG_PER_LB, count: 4 }, { w: 35 * KG_PER_LB, count: 2 },
  { w: 25 * KG_PER_LB, count: 2 }, { w: 10 * KG_PER_LB, count: 2 },
  { w: 5 * KG_PER_LB, count: 2 }, { w: 2.5 * KG_PER_LB, count: 2 },
];

// Equipment defaults per unit: what a fresh install uses, and what a unit
// switch moves still-untouched equipment values to. All values in kg.
const UNIT_EQUIP_DEFAULTS = {
  kg: { barWeight: 20, rounding: 2.5, dbIncrement: 2.5, machineStep: 5,
        plates: DEFAULT_PLATES },
  lb: { barWeight: 45 * KG_PER_LB, rounding: 2.5 * KG_PER_LB,
        dbIncrement: 5 * KG_PER_LB, machineStep: 10 * KG_PER_LB,
        plates: DEFAULT_PLATES_LB },
};

// Settings preset lists per unit, in DISPLAY units (stored converted to kg).
const UNIT_PRESETS = {
  kg: { rounding: [1.25, 2.5, 5], dbIncrement: [1, 2, 2.5], machineStep: [2.5, 5, 10] },
  lb: { rounding: [1.25, 2.5, 5], dbIncrement: [2.5, 5], machineStep: [5, 10, 15] },
};

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

// [Cluster A] Optional per-set pump quick-tap. A coarse 3-point stimulus read the
// athlete can leave blank; nothing depends on it yet (it feeds Epic 1 feedback
// later). Athlete-facing labels, so no em dashes.
const PUMP_LABELS = { 1: 'Light', 2: 'Solid', 3: 'Skin splitting' };

// [Cluster A] Set-modifier taxonomy. The `technique` field on a set object is
// schema groundwork for Epic 2 (advanced intensity techniques); only `straight`
// is used today, the rest are reserved so logging/rendering already understand
// them when the prescription side lands. Athlete-facing labels, no em dashes.
const TECHNIQUE_LABELS = {
  straight:  'Straight set',
  drop:      'Drop set',
  myo:       'Myo-reps',
  restpause: 'Rest-pause',
  partials:  'Lengthened partials',
  superset:  'Superset',
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
  restSec:       { main: 210, secondary: 180, accessory: 120 },  // real rest on hard sets
  restSecTight:  { main: 150, secondary: 135, accessory: 90 },   // after rest compression
  warmupSecPerSet: 90,   // a warmup ramp set with its short rest
  sessionOverheadSec: 180,  // arrive, change, water: the genuinely once-per-session cost
  // Per-exercise setup/transition: walk to the station, load/grab the implement,
  // adjust the machine, take a feeler. This is what makes adding an exercise cost
  // real time, and it varies by equipment: a barbell means plate-loading and a
  // warmup ramp, a machine is a pin and a seat adjustment, bodyweight is nothing.
  // Keyed by exercise.equipment; setupSecDefault covers anything unmapped.
  setupSec: { bb: 120, db: 70, kb: 70, cb: 40, mc: 20, bd: 20, bw: 10 },
  setupSecDefault: 40,
  // [Cluster B] A drop set is one hard set then immediate strips: no real rest
  // between drops, just the time to pull plates / move the pin and keep going.
  // estimateSessionSec charges one full rest after the whole drop set plus this
  // per-drop transition, instead of a full rest per mini-set.
  dropTransitionSec: 15,
  // [Cluster B] Myo-reps keep the same weight: one activation set near failure,
  // then short mini-sets with an intrinsic mini-rest (a few breaths) between
  // them. estimateSessionSec charges this mini-rest per mini-set plus one full
  // rest after the whole cluster. This is the intrinsic rest the technique-aware
  // timer surfaces to the athlete.
  myoRestSec: 18,
  // [Cluster B] Rest-pause: a set to failure, then a short pause (rack the load,
  // a few breaths) and squeeze out another small burst at the same weight, a few
  // times. The pause is intrinsic to the prescription, so the timer surfaces it.
  restPauseSec: 20,
  // [Cluster B] Lengthened partials: after the last full rep, keep going with
  // partial-ROM reps in the stretched position at the SAME weight. They flow
  // straight out of the set with no real pause, so the per-partial-burst
  // transition is small (just the slowdown), and there is no intrinsic rest cue
  // to time (unlike myo / rest-pause).
  partialsSec: 6,
};

// [Cluster B] Drop-set construction defaults. A working set carries N child
// mini-sets, each a step lighter; the athlete runs each to roughly the same rep
// target. Bodybuilding-only and opt-in, so nothing here touches a default user.
const DROP_DEFAULTS = { drops: 2, dropPct: 0.2, repFactor: 1 };

// [Cluster B] Myo-reps construction defaults: the activation set is the working
// set itself; it then carries N short mini-sets at the SAME weight (no strip),
// each a few reps. Our own simple numbers, not any product's exact parameters.
const MYO_DEFAULTS = { minis: 3, miniReps: 5 };

// [Cluster B] Rest-pause defaults: the working set is taken to failure, then a
// couple of short bursts at the SAME weight, each only a few reps as fatigue
// climbs. Fewer, smaller bursts than myo-reps; our own numbers.
const RESTPAUSE_DEFAULTS = { bursts: 2, burstReps: 3 };

// [Cluster B] Lengthened-partials defaults: after the working set, one burst of
// partial-ROM reps in the stretched position at the SAME weight. One burst keeps
// it simple and distinct from rest-pause (which is multiple same-weight bursts).
const PARTIAL_DEFAULTS = { sets: 1, partialReps: 6 };

// Bodybuilding muscle-focus slider (0..6) -> accessory set-count multiplier vs
// the scheme baseline (slider 3 = 1.0 = unchanged). 0 removes the exercise.
// Emphasis (4-6) is expressed by ADDING exercises (refill, see app.js), not by
// inflating set counts, so only de-emphasis (1-2) scales sets here.
const FOCUS_FACTOR = { 0: 0, 1: 0.5, 2: 0.75, 3: 1, 4: 1, 5: 1, 6: 1 };

// Default accessory pools per focus muscle, used to refill freed/empty slots and
// to give a select-only emphasized muscle (glutes, calves) real exercises.
const DEFAULT_ACC = {
  chest:     ['dips', 'db-incline-bench', 'cable-fly', 'machine-chest-press', 'pec-deck', 'db-fly'],
  back:      ['lat-pulldown', 'cable-row', 'chest-supported-row', 'barbell-row', 'face-pull', 'db-row'],
  arms:      ['ez-curl', 'triceps-pushdown', 'db-curl', 'overhead-triceps-ext', 'hammer-curl', 'skullcrusher'],
  shoulders: ['lateral-raise', 'db-shoulder-press', 'rear-delt-fly', 'cable-lateral-raise', 'front-raise'],
  glutes:    ['bb-hip-thrust', 'glute-bridge', 'cable-kickback', 'frog-pumps'],
  legs:      ['leg-extensions', 'hamstring-curls', 'leg-press', 'bulgarian-split-squat', 'walking-lunge', 'seated-leg-curl'],
  calves:    ['standing-calf-raise', 'seated-calf-raise', 'leg-press-calf-raise'],
};

// Focus muscles that have a barbell main lift, for the slider-6 "extra main dose".
const MUSCLE_MAIN = { chest: 'comp-bench', legs: 'comp-squat', shoulders: 'military-press' };

// ---- Frequency-driven split generator (bodybuilding) ----
// Slider -> weekly training frequency (days the muscle is trained). Per product:
// focus is frequency. 3 = 2x/week baseline; 4 = 2x but a day's primary focus with
// more volume; 5-6 = 3x. 0 removes the muscle.
const SPLIT_FREQ = { 0: 0, 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3 };
const UPPER_MUSCLES = ['chest', 'back', 'shoulders', 'arms'];
const LOWER_MUSCLES = ['legs', 'glutes', 'calves'];
// A day is themed/anchored by its highest-ranked muscle. Rank >= 2 can lead a
// day; arms/calves (rank < 2) only fill when nothing bigger is present. Glutes is
// rank 2 so it can lead a hip-thrust day, but only when trained twice or more a
// week (see canLead in generateBodybuildingDays) so a de-emphasized glute does not
// claim a whole day. This gives the lower region a second anchor besides Legs.
const ANCHOR_RANK = { chest: 3, back: 3, legs: 3, shoulders: 2, glutes: 2, arms: 1, calves: 0 };
// Lead movement for a day whose primary focus is this muscle. `main` = a working-
// max barbell anchor (correct wave/AMRAP weights); `acc` = a big lead accessory
// (used when the muscle has no barbell working-max compound, e.g. glutes).
const PRIMARY_ANCHOR = {
  chest:     { main: 'comp-bench' },
  shoulders: { main: 'military-press' },
  legs:      { main: 'comp-squat' },
  back:      { acc: 'lat-pulldown' },
  glutes:    { acc: 'bb-hip-thrust' },
};

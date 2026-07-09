/* ============================================================
   IRONWAVE — i18n/en.js
   English catalog, the source of truth for every translatable
   string. Translators: copy this file, rename it to your language
   code (es.js, de.js, ...), translate the VALUES only, never the
   keys, and keep {name}-style placeholders intact. See README.md
   in this folder. Athlete-facing strings: no em dashes.
   ============================================================ */

'use strict';

const I18N_EN = {
  // --- shared units and small words ---
  'unit.rir': '{n} RIR',
  'unit.kg': 'kg',
  'unit.kg_hand': 'kg/hand',

  // --- confirm dialog defaults ---
  'confirm.title': 'Confirm',
  'confirm.ok': 'Confirm',
  'confirm.cancel': 'Cancel',

  // --- session view ---
  'session.week_day': 'Week {week}, Day {day}',
  'session.short_sleep': 'Short sleep last night ({hours}h). Sets flagged ⚠ carry extra fatigue risk. Skipping them today is smart, not soft.',
  'session.todays_focus': 'Today\'s focus',
  'session.finish_workout': 'Finish Workout',
  'session.readiness_title': 'Daily Readiness Ratings',
  'session.last_set': 'Last Set',
  'session.optional_tag': 'optional',
  'session.over_time_limit': 'Over your time limit. Do it if you have time, otherwise skip it.',
  'session.sets_x_reps': '{sets} sets x {reps} reps',
  'session.notes': 'Notes',
  'session.notes_placeholder': 'Session notes…',
  'session.warmup': 'Warmup',
  'session.skipped': 'Skipped',
  'session.performance': 'Performance',
  'session.log': 'Log',
  'session.short_sleep_flag': '⚠ optional today, short sleep',
  'session.superset': 'Superset',
  'session.giant_set': 'Giant set',
  'session.superset_how': 'One set of each in order, then rest. Repeat each round.',
  'session.round': 'Round {n}',
  'session.member_done': 'done',
  'session.leave_title': 'Leave this session?',
  'session.leave_message': 'Your logged sets stay saved in the draft, so you can pick this session back up.',
  'session.leave_confirm': 'Leave session',
  'session.calibration_hint': 'Calibration: eyeball the weight and build up. What you log here sets your future weights.',
  'session.swap_exercise': 'Swap exercise',

  // --- readiness lift labels ---
  'lift.squat': 'Squat',
  'lift.bench': 'Bench',
  'lift.deadlift': 'Deadlift',
  'lift.upperpull': 'Upper Pull',
  'lift.press': 'Press',
  'lift.lowback': 'Low Back',

  // --- set target labels ---
  'set.amrap_standard': 'standard {reps}',
  'set.cap_at': 'cap at {rir}',
  'set.then': 'then {detail}',
  'set.reps_at_rir': '{reps} reps @ {rir}',

  // --- RIR intro card (one-time) ---
  'rir.intro_title': 'New: effort is logged as RIR',
  'rir.intro_body': 'RIR is reps left in reserve, the flip side of RPE. Lower RIR means closer to failure, and 0 is all out. Your weights and history did not change, just the wording.',
  'rir.got_it': 'Got it',

  // --- intensity techniques (finishers) ---
  'tech.straight': 'Straight set',
  'tech.drop': 'Drop set',
  'tech.myo': 'Myo-reps',
  'tech.restpause': 'Rest-pause',
  'tech.partials': 'Lengthened partials',
  'tech.superset': 'Superset',
  'tech.chip_drop': 'Drop set',
  'tech.chip_myo': 'Myo-reps',
  'tech.chip_restpause': 'Rest-pause',
  'tech.chip_partials': 'Partials',
  'tech.drop_how': 'Drop set added. Hit your last set, then strip and go',
  'tech.myo_how': 'Myo-reps added. Hit the activation set, then short mini-rests and mini-sets',
  'tech.restpause_how': 'Rest-pause added. Hit failure, then pause and squeeze out a few more',
  'tech.partials_how': 'Lengthened partials added. After your last full rep, keep going with partial reps in the stretch',
  'tech.removed': '{name} removed',
  'tech.need_weight': 'Set a working weight first',
  'tech.add_finisher': 'Add a finisher',
  'tech.optional_last_set': 'optional, last set',
  'tech.runs_on_set': 'Runs on set {n}: do the set to its RIR cap as written, the {tech} after it is what goes near failure.',
  'tech.what_is': 'What is a finisher?',
  'tech.info_title': 'Finishers',
  'tech.info_intro': 'A finisher extends your <b>last working set</b> of an exercise. Do that set exactly as written and stop at its RIR cap, do not take it to failure. The finisher after it is what pushes the muscle near failure, at a fraction of the fatigue of extra straight sets.',
  'tech.info_drop': 'Finish the set, strip to the lighter weight shown, and go again with no rest. Log the reps of each strip in its own mini-set row.',
  'tech.info_myo': 'Finish the set, rest about 20 seconds, then hit short mini-sets at the same weight. Repeat until the mini-set reps drop off. Log each mini-set\'s reps.',
  'tech.info_restpause': 'Finish the set, pause about 15 seconds, then squeeze out a few more reps at the same weight. Log the extra reps in the mini-set rows.',
  'tech.info_partials': 'After your last full rep, keep going with partial reps in the stretched half of the movement. Count only full reps in the set\'s rep count, judge your RIR on full reps before the partials start, and log the partial reps in their own row.',
  'tech.info_logging': 'Logging: enter the set\'s weight, reps and RIR first, as if you had stopped there. The mini-set rows below are for the finisher\'s reps.',
  'tech.word_drop': 'drops',
  'tech.word_myo': 'myo',
  'tech.word_restpause': 'rest-pause',
  'tech.word_partials': 'partials',
  'tech.child_drop_title': 'Drops',
  'tech.child_drop_hint': 'strip and go, log reps',
  'tech.child_myo_title': 'Mini-sets',
  'tech.child_myo_hint': 'same weight, short mini-rests, log reps',
  'tech.child_restpause_title': 'Bursts',
  'tech.child_restpause_hint': 'same weight, pause then go again, log reps',
  'tech.child_partials_title': 'Partials',
  'tech.child_partials_hint': 'same weight, partial reps in the stretch, log reps',

  // --- rest timer ---
  'rest.label': 'Rest',
  'rest.done': 'Rest done',
  'rest.skip': 'Skip',
  'rest.done_btn': 'Done',
  'rest.notify_body': 'Rest done. Next set.',
  'rest.alerts_on': 'Rest alerts on',
  'rest.alerts_off': 'Rest alerts off',
  'rest.notify_unavailable': 'Notifications are not available here. On iPhone, install the app first: Share, then Add to Home Screen',
  'rest.notify_blocked': 'Notifications are blocked. Allow them for IRONWAVE in your device settings',

  // --- performance modal ---
  'perf.title': 'Performance',
  'perf.weight': 'Weight',
  'perf.added_weight': 'Added weight',
  'perf.bw_note': 'Bodyweight lift. Count only weight you add (vest, belt, dumbbell). Leave 0 for bodyweight only.',
  'perf.reps': 'Reps',
  'perf.rir_label': 'Reps In Reserve (RIR)',
  'perf.rir_hint': 'RIR is how many reps you could still do. 0 is all out.',
  'perf.pump': 'Pump',
  'perf.optional': 'optional',
  'perf.clear': 'CLEAR',
  'perf.skip': 'SKIP',
  'perf.done': 'DONE',
  'perf.skip_hint': 'Skip parks the set with nothing logged. Cardio, a tweak, no gas today, all fine reasons.',
  'perf.pause': 'Pause',
  'perf.minirest': 'Mini-rest',
  'perf.go_again': 'Go again',
  'perf.big_jump_title': 'Big weight jump',
  'perf.big_jump_msg': 'You are logging {new} on {name}, far above your best {best}. A common slip is typing your bodyweight into a bodyweight lift, where only added load counts. Future weights are prescribed from what you log.',
  'perf.big_jump_confirm': 'Log it, it is real',
  'perf.big_jump_cancel': 'Go back',
  'perf.wm_up': '{name}: working max {from} → {to} kg',
  'perf.wm_capped': '(capped at +10 reps)',
  'perf.amrap_variation': 'AMRAP logged. Variation lift, working max unchanged',
  'perf.wm_calibrated': '{name}: working max calibrated to {w} kg',
  'perf.calibrated_next': '{name} calibrated. Weights will be prescribed from your next session',
  'perf.superset_next': 'Next: {name}. Superset, rest after the round',
  'perf.set_skipped': 'Set skipped, nothing logged',

  // --- loading / plate math ---
  'plates.configure': 'Configure Plates ›',
  'plates.bar_only': 'bar only',
  'plates.closest': 'closest loadable: {w}kg',
  'plates.note': '({bar}kg bar + {plates}kg)',
  'load.machine': 'machine load',
  'load.added': 'added load',
  'load.per_hand': '{half} kg per hand, {total} kg total',
  'load.dumbbell': '{w} kg dumbbell',

  // --- pump quick-tap ---
  'pump.1': 'Light',
  'pump.2': 'Solid',
  'pump.3': 'Skin splitting',
  'pump.generic': 'pump',

  // --- RIR/RPE effort descriptions (perf modal) ---
  'rpe.10': 'Could not do any more reps',
  'rpe.9.5': 'Maybe could have done 1 more rep',
  'rpe.9': 'Could do 1 more rep',
  'rpe.8.5': 'Could do 1, maybe 2 more reps',
  'rpe.8': 'Could do 2 more reps',
  'rpe.7.5': 'Could do 2, maybe 3 more reps',
  'rpe.7': 'Could confidently do 3 more reps',
  'rpe.6.5': 'Could do 3, maybe 4 more reps',
  'rpe.6': 'Could do 4 more reps',
  'rpe.5.5': 'Could do 4, maybe 5 more reps',
  'rpe.5': 'Could do 5+ more reps, felt like a warmup',

  // --- warmup modal ---
  'warmup.title': 'Warmup',
  'warmup.target_top': 'Target Top Set',
  'warmup.bar_weight': 'Bar Weight',
  'warmup.hint': 'Build GPP in the warmup. Bar speed crisp, rest short.',

  // --- session rating + finish ---
  'sr.title': 'Session Rating',
  'sr.question': 'How tough was the session?',
  'sr.low': '5 · WARMUP',
  'sr.high': '10 · HARDEST EVER',
  'sr.5': 'Felt like a warmup',
  'sr.6': 'Comfortably hard',
  'sr.7': 'Solid work',
  'sr.8': 'Very demanding',
  'sr.9': 'Brutal',
  'sr.10': 'Hardest session ever',
  'sr.complete': 'Complete Session',
  'sr.none_title': 'Finish with no sets?',
  'sr.none_msg': 'You have not logged any sets for this session. You can finish it anyway.',
  'sr.none_confirm': 'Finish anyway',
  'sr.saved': 'Session saved, {tonnage} kg total tonnage',

  // --- settings: language ---
  'settings.language': 'Language',
  'settings.language_auto': 'Automatic (device language)',
  'settings.language_hint': 'Applies right away. Anything not yet translated shows in English.',
  'settings.language_saved': 'Language updated',
};

I18N.register('en', 'English', I18N_EN);

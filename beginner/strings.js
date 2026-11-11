/* ============================================================
   BEGINNER APP, package 5 (Screens): the user-facing strings table.
   Pure data. Every athlete-facing string lives here, nested by screen.
   No em dashes, no targets, no jargon (see beginner/test/strings.test.js).
   Frozen inline (not via config.js) so this file loads on its own in the test vm.
   ============================================================ */
const BEGINNER_STRINGS = (function beginnerStringsFreeze(o) {
  Object.values(o).forEach(v => { if (v && typeof v === 'object') beginnerStringsFreeze(v); });
  return Object.freeze(o);
})({
  goal: {
    heading: 'Pick your goals',
    nameLabel: "What's your name?",
    continue: 'Continue',
    skip: 'Skip',
  },
  routine: {
    title: 'Your routine',
    titleNamed: "{name}'s routine",
  },
  pick: {
    start: 'Start',
    missing: "I don't have that here",
    repeat: 'Repeat last workout',
    searchLabel: 'Search all exercises',
    noMatches: 'No exercises found',
    restoreHeading: "Equipment you don't have",
    restore: 'Put back',
    demoAlt: 'Exercise demo',
  },
  lift: {
    first: 'Pick a weight you could lift for 12 repetitions. Stop when it gets hard.',
    setOf: 'Set {n} of {m}',
    done: 'Done',
    oneMore: 'One more',
    nextExercise: 'Next exercise',
    finish: 'Finish',
    swap: 'Swap',
    swapHeading: 'Swap for',
    add: 'Add exercise',
    addHeading: 'Add an exercise',
    end: 'End workout',
    weight: 'Weight',
    reps: 'Reps',
    less: 'Less',
    more: 'More',
    rest: 'Rest',
  },
  units: {
    kg: 'kg',
    lb: 'lb',
  },
  faces: {
    easy: 'Easy',
    good: 'Good',
    hard: 'Hard',
  },
  done: {
    summary: '{exercises} exercises, {sets} sets',
    newBest: 'New best',
    question: 'How was that?',
    easy: 'Too easy',
    right: 'Just right',
    much: 'Too much',
    back: 'Back to my routine',
  },
  data: {
    export: 'Export my data',
    import: 'Import data',
    confirm: 'Importing replaces everything on this phone. Continue?',
    yes: 'Yes, import',
    no: 'Cancel',
  },
  errors: {
    save: 'That did not save. Tap Done again.',
    import: 'That file did not work. Nothing was changed.',
    storage: 'This device cannot save your workouts.',
  },
});

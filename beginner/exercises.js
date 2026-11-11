// Beginner exercise library: 41 exercises, the equipment they need, and the goals.
// Every id, movement and equipment code is copied from a row of EXERCISE_LIST.

const BEGINNER_EXERCISES = [
  Object.freeze({ id: 'triceps-pushdown', name: 'Triceps Pushdown', movement: 'tricep', muscle: 'arms', equipment: 'cb', equipKey: 'cable-station', cue: 'Keep your elbows tucked at your sides and push the bar down until your arms are straight.', demo: 'media/triceps-pushdown.mp4', starter: true }),
  Object.freeze({ id: 'overhead-triceps-ext', name: 'Overhead Triceps Extension', movement: 'tricep', muscle: 'arms', equipment: 'cb', equipKey: 'cable-station', cue: 'Face away from the cable, keep your elbows near your ears, and straighten your arms.', demo: 'media/overhead-triceps-ext.mp4', starter: true }),
  Object.freeze({ id: 'db-triceps-ext', name: 'Dumbbell Triceps Extension', movement: 'tricep', muscle: 'arms', equipment: 'db', equipKey: 'dumbbells', cue: 'Hold one dumbbell overhead with both hands, bend your elbows, then straighten your arms.', demo: 'media/db-triceps-ext.mp4', starter: true }),
  Object.freeze({ id: 'close-grip-pushup', name: 'Close Grip Push-up', movement: 'tricep', muscle: 'arms', equipment: 'bw', equipKey: 'none', cue: 'Place your hands close under your chest, lower your body, then push back up.', demo: 'media/close-grip-pushup.mp4', starter: true }),
  Object.freeze({ id: 'db-curl', name: 'Dumbbell Curl', movement: 'bicep', muscle: 'arms', equipment: 'db', equipKey: 'dumbbells', cue: 'Keep your elbows at your sides and curl the dumbbells up toward your shoulders.', demo: 'media/db-curl.mp4', starter: true }),
  Object.freeze({ id: 'hammer-curl', name: 'Hammer Curl', movement: 'bicep', muscle: 'arms', equipment: 'db', equipKey: 'dumbbells', cue: 'Hold the dumbbells with your thumbs up and curl them without moving your elbows.', demo: 'media/hammer-curl.mp4', starter: true }),
  Object.freeze({ id: 'cable-curl', name: 'Cable Curl', movement: 'bicep', muscle: 'arms', equipment: 'cb', equipKey: 'cable-station', cue: 'Stand tall, keep your elbows still, and pull the handle up toward your shoulders.', demo: 'media/cable-curl.mp4', starter: true }),

  Object.freeze({ id: 'machine-chest-press', name: 'Machine Chest Press', movement: 'chest', muscle: 'chest', equipment: 'mc', equipKey: 'chest-press-machine', cue: 'Sit with your back on the pad and push the handles forward until your arms are straight.', demo: 'media/machine-chest-press.mp4', starter: true }),
  Object.freeze({ id: 'cable-fly', name: 'Cable Fly', movement: 'chest', muscle: 'chest', equipment: 'cb', equipKey: 'cable-station', cue: 'Step forward, keep a slight bend in your elbows, and bring the handles together in front.', demo: 'media/cable-fly.mp4', starter: true }),
  Object.freeze({ id: 'db-bench', name: 'Dumbbell Bench Press', movement: 'bench', muscle: 'chest', equipment: 'db', equipKey: 'dumbbells', cue: 'Lie on the bench and press the dumbbells up over your chest, then lower them slowly.', demo: 'media/db-bench.mp4', starter: true }),
  Object.freeze({ id: 'pushup', name: 'Push-up', movement: 'chest', muscle: 'chest', equipment: 'bw', equipKey: 'none', cue: 'Keep your body in a straight line, lower your chest to the floor, then push back up.', demo: 'media/pushup.mp4', starter: true }),
  Object.freeze({ id: 'pec-deck', name: 'Pec Deck', movement: 'chest', muscle: 'chest', equipment: 'mc', equipKey: 'pec-deck-machine', cue: 'Sit tall, rest your forearms on the pads, and bring them together in front of your chest.', demo: 'media/pec-deck.mp4', starter: true }),
  Object.freeze({ id: 'comp-bench', name: 'Competition Bench Press', movement: 'bench', muscle: 'chest', equipment: 'bb', equipKey: 'barbell', cue: 'Lie on the bench, lower the bar to your chest, then press it straight up.', demo: 'media/comp-bench.mp4', starter: false }),

  Object.freeze({ id: 'lat-pulldown', name: 'Lat Pulldown', movement: 'vpull', muscle: 'back', equipment: 'cb', equipKey: 'cable-station', cue: 'Sit with your thighs under the pad, pull the bar to your chest, then let it rise slowly.', demo: 'media/lat-pulldown.mp4', starter: true }),
  Object.freeze({ id: 'cable-row', name: 'Seated Cable Row', movement: 'hpull', muscle: 'back', equipment: 'cb', equipKey: 'cable-station', cue: 'Sit tall, pull the handle to your belly button, and squeeze your shoulder blades together.', demo: 'media/cable-row.mp4', starter: true }),
  Object.freeze({ id: 'db-row', name: 'Dumbbell Row', movement: 'hpull', muscle: 'back', equipment: 'db', equipKey: 'dumbbells', cue: 'Brace one hand on a bench, pull the dumbbell up toward your hip, then lower it slowly.', demo: 'media/db-row.mp4', starter: true }),
  Object.freeze({ id: 'pullup', name: 'Pull-up', movement: 'vpull', muscle: 'back', equipment: 'bw', equipKey: 'pull-up-bar', cue: 'Hang with your arms straight, pull your chest toward the bar, then lower yourself slowly.', demo: 'media/pullup.mp4', starter: true }),
  Object.freeze({ id: 'face-pull', name: 'Face Pull', movement: 'upperback', muscle: 'back', equipment: 'cb', equipKey: 'cable-station', cue: 'Pull the rope toward your face, elbows high, and squeeze your shoulder blades back.', demo: 'media/face-pull.mp4', starter: true }),
  Object.freeze({ id: 'comp-deadlift', name: 'Competition Deadlift', movement: 'deadlift', muscle: 'back', equipment: 'bb', equipKey: 'barbell', cue: 'Grip the bar just outside your legs, keep your back flat, and stand up tall.', demo: 'media/comp-deadlift.mp4', starter: false }),

  Object.freeze({ id: 'machine-shoulder-press', name: 'Machine Shoulder Press', movement: 'press', muscle: 'shoulders', equipment: 'mc', equipKey: 'shoulder-press-machine', cue: 'Sit with your back against the pad and press the handles up until your arms are straight.', demo: 'media/machine-shoulder-press.mp4', starter: true }),
  Object.freeze({ id: 'seated-db-press', name: 'Seated Dumbbell Press', movement: 'press', muscle: 'shoulders', equipment: 'db', equipKey: 'dumbbells', cue: 'Sit upright with a dumbbell in each hand and press them up over your head.', demo: 'media/seated-db-press.mp4', starter: true }),
  Object.freeze({ id: 'lateral-raise', name: 'Dumbbell Lateral Raise', movement: 'shoulder', muscle: 'shoulders', equipment: 'db', equipKey: 'dumbbells', cue: 'Raise the dumbbells out to your sides to shoulder height with elbows slightly bent.', demo: 'media/lateral-raise.mp4', starter: true }),
  Object.freeze({ id: 'cable-lateral-raise', name: 'Cable Lateral Raise', movement: 'shoulder', muscle: 'shoulders', equipment: 'cb', equipKey: 'cable-station', cue: 'Stand side on to the cable and raise your arm out to shoulder height.', demo: 'media/cable-lateral-raise.mp4', starter: true }),
  Object.freeze({ id: 'military-press', name: 'Military Press', movement: 'press', muscle: 'shoulders', equipment: 'bb', equipKey: 'barbell', cue: 'Hold the bar at shoulder height, press it straight overhead, then lower it slowly.', demo: 'media/military-press.mp4', starter: false }),

  Object.freeze({ id: 'glute-bridge', name: 'Glute Bridge', movement: 'glute', muscle: 'glutes', equipment: 'bw', equipKey: 'none', cue: 'Lie on your back, push through your heels, and squeeze your glutes at the top.', demo: 'media/glute-bridge.mp4', starter: true }),
  Object.freeze({ id: 'hip-abduction-machine', name: 'Hip Abduction Machine', movement: 'glute', muscle: 'glutes', equipment: 'mc', equipKey: 'hip-abduction-machine', cue: 'Sit tall and push your knees outward against the pads, then slowly come back in.', demo: 'media/hip-abduction-machine.mp4', starter: true }),
  Object.freeze({ id: 'cable-kickback', name: 'Cable Kickback', movement: 'glute', muscle: 'glutes', equipment: 'cb', equipKey: 'cable-station', cue: 'Keep your back flat and kick your leg straight back, squeezing your glute at the top.', demo: 'media/cable-kickback.mp4', starter: true }),
  Object.freeze({ id: 'curtsy-lunge', name: 'Curtsy Lunge', movement: 'glute', muscle: 'glutes', equipment: 'db', equipKey: 'dumbbells', cue: 'Step one foot behind and across your body, bend both knees, then stand back up.', demo: 'media/curtsy-lunge.mp4', starter: true }),
  Object.freeze({ id: 'bb-hip-thrust', name: 'Barbell Hip Thrust', movement: 'glute', muscle: 'glutes', equipment: 'bb', equipKey: 'barbell', cue: 'Rest your upper back on a bench, drive your hips up, and squeeze your glutes at the top.', demo: 'media/bb-hip-thrust.mp4', starter: false }),

  Object.freeze({ id: 'leg-press', name: 'Leg Press', movement: 'quad', muscle: 'legs', equipment: 'mc', equipKey: 'leg-press-machine', cue: 'Lower the platform until your knees bend, then press back up without locking your knees.', demo: 'media/leg-press.mp4', starter: true }),
  Object.freeze({ id: 'leg-extensions', name: 'Leg Extension', movement: 'quad', muscle: 'legs', equipment: 'mc', equipKey: 'leg-extension-machine', cue: 'Sit with your back against the pad and straighten your legs up to the top.', demo: 'media/leg-extensions.mp4', starter: true }),
  Object.freeze({ id: 'seated-leg-curl', name: 'Seated Leg Curl', movement: 'ham', muscle: 'legs', equipment: 'mc', equipKey: 'leg-curl-machine', cue: 'Sit tall, curl your heels back under the pad, and return slowly.', demo: 'media/seated-leg-curl.mp4', starter: true }),
  Object.freeze({ id: 'goblet-squat', name: 'Goblet Squat', movement: 'squat', muscle: 'legs', equipment: 'db', equipKey: 'dumbbells', cue: 'Hold one dumbbell at your chest, sit down between your knees, and stand back up.', demo: 'media/goblet-squat.mp4', starter: true }),
  Object.freeze({ id: 'walking-lunge', name: 'Walking Lunge', movement: 'quad', muscle: 'legs', equipment: 'db', equipKey: 'dumbbells', cue: 'Step forward, lower your back knee toward the floor, then step through to the next lunge.', demo: 'media/walking-lunge.mp4', starter: true }),
  Object.freeze({ id: 'db-rdl', name: 'Dumbbell Romanian Deadlift', movement: 'ham', muscle: 'legs', equipment: 'db', equipKey: 'dumbbells', cue: 'Hold the dumbbells in front of your thighs, push your hips back, and stand up tall.', demo: 'media/db-rdl.mp4', starter: true }),
  Object.freeze({ id: 'hack-squat-machine', name: 'Hack Squat Machine', movement: 'quad', muscle: 'legs', equipment: 'mc', equipKey: 'hack-squat-machine', cue: 'Place your feet shoulder width apart on the platform, bend your knees, and press back up.', demo: 'media/hack-squat-machine.mp4', starter: true }),
  Object.freeze({ id: 'comp-squat', name: 'Competition Squat', movement: 'squat', muscle: 'legs', equipment: 'bb', equipKey: 'barbell', cue: 'Rest the bar on your upper back, sit down between your hips, and stand back up.', demo: 'media/comp-squat.mp4', starter: false }),

  Object.freeze({ id: 'standing-calf-raise', name: 'Standing Calf Raise', movement: 'calf', muscle: 'calves', equipment: 'mc', equipKey: 'standing-calf-raise-machine', cue: 'Stand on the pad, rise up onto your toes, then lower your heels slowly.', demo: 'media/standing-calf-raise.mp4', starter: true }),
  Object.freeze({ id: 'seated-calf-raise', name: 'Seated Calf Raise', movement: 'calf', muscle: 'calves', equipment: 'mc', equipKey: 'seated-calf-raise-machine', cue: 'Sit with the pad on your knees, press up onto your toes, then lower slowly.', demo: 'media/seated-calf-raise.mp4', starter: true }),
  Object.freeze({ id: 'sl-calf-raise', name: 'Single Leg Calf Raise', movement: 'calf', muscle: 'calves', equipment: 'bw', equipKey: 'none', cue: 'Stand on one leg at the edge of a step, rise onto your toes, then lower slowly.', demo: 'media/sl-calf-raise.mp4', starter: true }),
  Object.freeze({ id: 'leg-press-calf-raise', name: 'Leg Press Calf Raise', movement: 'calf', muscle: 'calves', equipment: 'mc', equipKey: 'leg-press-machine', cue: 'Sit in the leg press, push with the balls of your feet, then lower your heels slowly.', demo: 'media/leg-press-calf-raise.mp4', starter: true }),
];

const BEGINNER_EQUIPMENT = Object.freeze({
  'cable-station': Object.freeze({ label: 'Cable station' }),
  'dumbbells': Object.freeze({ label: 'Dumbbells' }),
  'chest-press-machine': Object.freeze({ label: 'Chest press machine' }),
  'pec-deck-machine': Object.freeze({ label: 'Pec deck machine' }),
  'barbell': Object.freeze({ label: 'Barbell and rack' }),
  'pull-up-bar': Object.freeze({ label: 'Pull-up bar' }),
  'shoulder-press-machine': Object.freeze({ label: 'Shoulder press machine' }),
  'hip-abduction-machine': Object.freeze({ label: 'Hip abduction machine' }),
  'leg-press-machine': Object.freeze({ label: 'Leg press machine' }),
  'leg-extension-machine': Object.freeze({ label: 'Leg extension machine' }),
  'leg-curl-machine': Object.freeze({ label: 'Leg curl machine' }),
  'hack-squat-machine': Object.freeze({ label: 'Hack squat machine' }),
  'standing-calf-raise-machine': Object.freeze({ label: 'Standing calf raise machine' }),
  'seated-calf-raise-machine': Object.freeze({ label: 'Seated calf raise machine' }),
});

const BEGINNER_GOALS = Object.freeze({
  arms: Object.freeze({ label: 'Bigger arms', focus: Object.freeze({ arms: 3, chest: 2, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 2 }) }),
  chest: Object.freeze({ label: 'Bigger chest', focus: Object.freeze({ arms: 2, chest: 3, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 2 }) }),
  legs: Object.freeze({ label: 'Legs and glutes', focus: Object.freeze({ arms: 2, chest: 2, back: 2, shoulders: 2, glutes: 3, legs: 3, calves: 2 }) }),
  fit: Object.freeze({ label: 'Look fit', focus: Object.freeze({ arms: 2, chest: 2, back: 2, shoulders: 2, glutes: 2, legs: 2, calves: 2 }) }),
  strong: Object.freeze({ label: 'Look strong', focus: Object.freeze({ arms: 2, chest: 3, back: 3, shoulders: 3, glutes: 2, legs: 3, calves: 2 }) }),
});

const BEGINNER_DEFAULT_GOAL = 'fit';

// Per muscle, the highest focus any selected goal asks for. An empty, missing or
// all-unknown selection falls back to the default goal (Look fit).
function beginnerGoalFocus(goalKeys) {
  const known = Array.isArray(goalKeys)
    ? goalKeys.filter(k => Object.prototype.hasOwnProperty.call(BEGINNER_GOALS, k))
    : [];
  const picks = known.length ? known : [BEGINNER_DEFAULT_GOAL];
  const out = {};
  for (const muscle of Object.keys(BEGINNER_GOALS.fit.focus)) {
    out[muscle] = Math.max(...picks.map(k => BEGINNER_GOALS[k].focus[muscle]));
  }
  return out;
}

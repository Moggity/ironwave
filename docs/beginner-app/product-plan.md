# Ironwave for Beginners — Product Plan

Nov 10, 2026 · @Martin Arocha

## The bet

Build a workout logger that quietly turns into a coach. The app hands the user a short workout, they tap Start and are lifting within a minute. Ironwave's engine runs underneath from the first logged set. It never explains itself: it simply fills in the next weight, reps and sets.

The plan rests on the four things your research says about super beginners:

- **They do not want onboarding.** So there is one optional tap before the first exercise, and nothing else.
- **They want a visible goal**, such as bigger arms. So the goal is the only thing we ask, and everything the app suggests is framed around it.
- **They want to do the exercise now and never see the math.** So the engine's results are applied silently. The next weight and reps are already filled in, with no message about why.
- **Most would train with no plan, and a logger is enough for them.** They also rarely know what to do. So the app always opens with a workout ready to start and stays a simple logger underneath. A weekly plan is offered later, built from what the user already does.

Ironwave asks the athlete to describe themselves and then hands them a 25-week plan. This app does the reverse: it watches what the beginner does and grows a plan out of it.

## Product principles

Six rules decide every feature argument. If a proposed feature breaks one, it does not ship.

1. **First set inside 60 seconds.** No account, no profile, no 1RM, no experience question, no days-per-week question. Everything Ironwave asks at onboarding is either assumed (beginner) or inferred later from behaviour.
2. **The user only ever types what they did.** Weight and reps. The one optional extra is a single tap on how the set felt.
3. **No number appears that the user did not type.** No RPE, RIR, percentages, 1RM, volume counts or readiness scores. The engine does not speak. If the app can do the math, it applies the result and says nothing. The one outcome it announces is "new best".
4. **Suggest, never assign.** Everything the app fills in can be changed or skipped with one tap. Doing so has no cost and leaves no trace on screen.
5. **The calendar belongs to the user.** There is no missed workout, no streak to break and no week to fall behind on. The engine measures time in sessions done and in a rolling 7 days, not in plan weeks.
6. **Complexity is earned.** A feature appears only after the user's own log makes it useful. A plan is offered after there is a habit to plan around.

## The experience

The whole app is three screens: Pick, Lift and Done. A fourth, Progress, appears once there is something to show.

### First open

1. **One question: "What do you want?"** Five big tiles: Bigger arms, Bigger chest, Legs and glutes, Look fit, Look strong. Several can be selected. The same screen has one optional field, "What's your name?". With a name, the home screen is titled "Ana's routine", which makes it feel made for them. All of it is skippable, and it is the entire onboarding.
2. **Pick.** The app shows a ready workout of six exercises for those goals, each with a short looping demo. Three are pre-ticked. The user can untick, tick others, or search the full list. Every exercise has a button, "I don't have that here". Tapping it rules out every exercise that needs that machine or bar, and the list refills to six straight away. The exclusion is remembered and can be undone.
3. **Start.** One button. No summary screen, no "your plan is ready".

A user who taps the goal, accepts the three ticked exercises and hits Start has made three taps.

### Lift

One exercise fills the screen. It shows the name, the demo, one form cue, and two steppers for weight and reps.

- **First time on an exercise**: the prompt is "Pick a weight you could lift for 12 repetitions. Stop when it gets hard." That is calibration without the word.
- **After each set**: a big Done button, then three optional faces: Easy, Good, Hard. The rest timer starts by itself.
- **If the first set was clearly too light** (Easy, 12 or more reps): the next set's weight is already raised, for example to 12 kg. No message. The user can change it back.
- **Sets**: the screen says "Set 1 of 2". After the last one it offers "One more" or "Next exercise". Doing more or fewer is fine and is simply logged.
- **Returning to an exercise**: weight and reps are pre-filled with today's target. Nothing is said about last time or about what to beat.
- **Extra sets, months in**: on some exercises the counter is one or two sets longer, and those last sets come pre-filled after a very short rest. This is how intensity techniques appear. They have no name on screen.
- **Changing course**: swap an exercise, add one, or end the workout at any point. Whatever was logged counts.

### Done

One screen, two lines at most: what was done, and any new best. One optional question: "How was that?" with Too easy, Just right, Too much.

### Coming back

The app opens straight on Pick with today's workout ready: six exercises, three ticked, one Start button. "Repeat last workout" sits beside it. A returning user is lifting in two taps and never has to decide what to do.

## The hidden engine

Every exercise in this app is treated as what Ironwave calls an accessory: loaded from logged sets, with no working max, no waves and no AMRAP test. That one decision removes most of Ironwave's visible complexity and keeps most of its adaptive machinery.

### What carries over

| Ironwave piece | Role in the beginner app | Change needed |
| --- | --- | --- |
| Estimated 1RM (`e1rm`, `bestE1RM`) | The hidden measure of progress per exercise. Feeds "new best" and the progress screen | None |
| Weight for a target (`weightFor`) | Silently raises the pre-filled weight of the next set when the first was too easy. Also sets the starting weight after a swap | None |
| Calibration ramp | The first-time prompt on any exercise. Beginner top set already stops at 3 reps in reserve | Shown as one sentence, not three feeler sets |
| RPE per set | The Easy, Good, Hard tap | Easy = RPE 6, Good = 8, Hard = 9.5. No tap = 8, which is already the engine default |
| Focus sliders | Set by the goal tiles. Bigger arms sets arms to 5 and the rest to 3. Several goals combine | Later nudged by what the user actually picks |
| Volume landmarks at the beginner factor (0.65) | Decides which muscles the Today suggestion should cover | Counted over a rolling 7 days instead of a plan week |
| Synergist coverage | Lets a row count toward arms, so suggestions stay honest about what is already trained | None |
| Volume autoregulation (`autoregVolume`) | Adds or removes a set per muscle | Recovery signal comes from the faces and rep trend, not a check-in slider |
| Accessory set ramp (2, 3, 4, 5) | Sets per exercise start at 2 and climb | Advances by sessions done, capped at 4 |
| Week-feel modifier | The "How was that?" answer at the end of a workout | Applies to the next session, not the next week |
| Deload trigger | A lighter week, applied without comment | Triggered by falling reps and repeated Hard taps, never by the calendar |
| Accessory picker (head coverage, rotation) | Orders the suggestions on Pick and rotates stale exercises | Prefers exercises the user has done before |
| Split generator | Builds the plan once the user asks for one | Days per week is read from the log, not asked |
| Time model | Keeps a suggested workout near 30 minutes | Used silently to size the suggestion |
| Intensity techniques (drop set and myo-reps builders) | Extra sets added silently to goal-muscle exercises from about two months in | Chosen by the app, never by the user. Smaller starting dose than Ironwave |
| Rounding, rest times, exercise cues | Used as they are | Rest shown as a timer only |

One Ironwave quirk becomes a feature here. A muscle with no recovery input sits at neutral, so volume climbs to the minimum effective dose and holds. For a beginner that is the right ceiling.

### The one new algorithm: next target

Ironwave solves each accessory weight from the estimated 1RM. That is accurate for an experienced lifter and jumpy for a beginner whose effort ratings are rough. The beginner app adds a thin rule on top, the standard double progression:

1. Each exercise has a rep range of 8 to 12.
2. Next time, the target is the same weight and one more rep.
3. When every set reaches 12 and none was Hard, the weight goes up by one increment and reps return to 8.
4. Two sessions in a row that fall 2 or more reps short hold the weight. A third drops it one increment.
5. Bodyweight exercises progress in reps only.

The estimated 1RM still runs underneath as a check and as the progress measure. The user sees no instruction. The stepper already reads 11.

### Silent intensity techniques

Two of Ironwave's four techniques can be applied without a word, because on screen they are nothing more than extra sets. They give the goal muscle more hard reps in about one extra minute, and they bring back the feeling of having trained hard at the point where a beginner's early gains slow down.

| Technique | Used on | What the user gets |
| --- | --- | --- |
| Drop set | Machines, cables and dumbbells, where the weight changes in seconds | One extra set, 20% lighter, same reps, after a 15 second rest |
| Myo-reps | Any other weighted exercise | Two extra sets of 5 reps at the same weight, 18 seconds apart |

Rest-pause is left out because it looks the same as myo-reps. Lengthened partials are left out because they cannot be done without an explanation.

**How it looks.** The counter reads "Set 1 of 4" where it would have read 3. The extra set arrives pre-filled, and the rest timer before it is short. There is no name, label or explanation.

**When the app adds one.** All of these must be true:

1. The user has trained for at least 8 weeks and logged at least 16 workouts.
2. The exercise trains a goal muscle and the user has done it in at least 6 workouts.
3. It is not a heavy barbell lift: squat, deadlift, bench press or overhead press.
4. It is the last exercise for that muscle in the workout.
5. No other exercise in this workout has one, and the muscle has had fewer than two in the last 7 days.
6. The muscle is not close to its recoverable limit, it is not a lighter week, and the last answer to "How was that?" was not Too much.

If the normal sets fall 2 or more reps short on the day, the extra set is quietly dropped.

**How it stays safe and honest in the numbers.**

- The extra sets count as one set toward the muscle's weekly total, so the volume ceiling still holds.
- They are ignored by the next-target rule, by "new best" and by the fatigue check. A lighter, tired set must not look like a bad day.
- Skipping the extra set three times in a row switches the feature off for 8 weeks. That is the opt-out, and it needs no setting.
- After four completed uses on an exercise, the dose grows to Ironwave's default: two drops, or three short sets.

### What is switched off

Juggernaut waves, working max, AMRAP tests, 1RM entry, the fixed 5-week block, the 25-week macrocycle, nutrition phases, goal archetypes, plate math, the readiness score and its skip penalties, the time cap setting, and the pre-session check-in.

## How the routine improves over time

The app moves through six stages, and each one unlocks from the user's own log, never from a date. A user who trains once a fortnight simply stays longer in the early stages.

| Stage | Unlocks when | What the user notices | What the engine is doing |
| --- | --- | --- | --- |
| 1. A workout, handed over | First open | It gives me a workout and remembers what I did | Ranking six exercises by goal and available equipment. Storing sets, estimating a starting strength per exercise |
| 2. Silent progression | Second time on any exercise | The numbers are already filled in, a little higher than before | Next-target rule per exercise. Sets per exercise climb from 2 to 3 |
| 3. Today | About 3 workouts logged | The workout it gives me fits what I have already done this week | Counting sets per muscle over 7 days against beginner landmarks. Goal muscle first, then whatever is furthest behind and not trained in the last 48 hours |
| 4. Balance | About 6 workouts logged | Workouts include things I would have skipped, and get lighter when I am tired | Per-muscle add, hold or cut. A lighter week when reps fall on several exercises. Stale exercises rotated after about 8 weeks or a stall |
| 5. My plan | About 8 workouts and a steady rhythm | It offers to line up my week | Split generator run on the observed days per week and the exercises the user already likes |
| 6. Intensity | 8 weeks and about 16 workouts | Some exercises end with a short, tough extra set | Drop sets and myo-reps on goal-muscle exercises, within the weekly volume ceiling |

Three behaviours matter most in this progression.

- **The goal stays in front.** A "bigger arms" user always sees arm work first. Balance arrives as one more exercise in the list, with no comment. There is never a lecture about leg day.
- **The plan is the user's own habits, tidied.** Stage 5 does not replace their exercises with a template. It keeps what they do, fills the gaps and orders the week.
- **Nothing regresses for a user who declines.** Someone who ignores every suggestion still has a logger that remembers everything and sets a next target. That is the floor, and your research says it is enough for many of them.

Beyond stage 5 there is a natural exit: a user with months of logged history can move to Ironwave proper. Their estimated maxes seed the working maxes, so they skip Ironwave's calibration.

## What the user sees instead of math

Most engine outputs have no words at all. They change what is pre-filled on screen and nothing else. If an output has no row here, it stays invisible.

| The engine knows | The user sees |
| --- | --- |
| Next-target result | Nothing. The steppers are pre-filled |
| Load increase earned | Nothing. The heavier weight is pre-filled |
| First set was too easy | Nothing. The next set's weight is pre-filled higher |
| Autoregulation adds a set | Nothing. The set counter is one higher |
| Autoregulation cuts a set, or a lighter week is due | Nothing. The set counter is lower |
| An intensity technique is due | Nothing. One or two more sets on the counter, pre-filled, after a short rest |
| A neglected muscle is below maintenance | One more exercise in the list, with no reason given |
| Exercise rotation | A different exercise for that muscle appears in the list |
| Session time estimate | Nothing. It is used to keep the workout near 30 minutes |
| Estimated 1RM reached a new high | "New best" on the Done screen |
| Estimated 1RM trend over weeks | A rising line per exercise on Progress |
| Weekly sets for a goal muscle against its landmarks | Three dots on Progress |

Three rules for tone. Any wording that can be skipped is skipped: if the app can apply the math, it does so and says nothing. Progress is always shown against the user's own past, never against a standard. And the app never reports an absence: no "you missed", no broken streak, no red.

The Progress screen appears after the third workout. It holds the goal muscle's three dots, the line for each exercise, and a count of workouts this month. Nothing else.

## What we deliberately leave out

Each of these is a reasonable feature that would break a principle for this audience.

- **Accounts and sign-up.** Data lives on the phone. Backup is offered later, once there is something worth keeping.
- **Any profile form.** No age, body weight, experience level or training days.
- **A settings screen at launch.** Units follow the phone's region. The weight step follows the equipment.
- **Streaks, reminders by default, and missed-workout states.** Reminders are opt-in and offered only after a rhythm exists.
- **Barbell-first programming.** Suggestions lead with machines, dumbbells and cables, which are easier to learn alone. Barbell lifts are in the list for those who search for them.
- **Nutrition, body measurements and photos.** A different product.
- **Social features and leaderboards.** Comparison is what puts beginners off.
- **Explanations of training theory.** One form cue per exercise is the full teaching load.

## Build phases

Build it as a new app beside Ironwave that shares the engine, in four phases that match the stages above. Each phase is a usable product, and each has a gate that decides whether the next is worth building.

### How it is put together

- **Shared**: `ironwave/app/engine.js` is one pure `Engine` object with no state, so it can be loaded as it is. The landmark, coverage, time-model and cue tables in `data.js` are reused too.
- **Extracted**: the volume count, accessory picker and split generator currently live in the stateful `app.js`. They need to be lifted into a pure module both apps can load. Ironwave's 209 tests guard that move.
- **New**: a small coach module holding the next-target rule and the Today suggestion, a trimmed exercise list of about 40 beginner-friendly movements with demo media, and the three screens.
- **State**: one flat log of workouts and sets, plus the goal. There is no program tree. Every suggestion is derived from the log each time, which keeps it testable and means there is no plan to fall out of sync.
- **Delivery**: one set of web files served two ways. GitHub Pages hosts it as an installable web app, and the same files are wrapped into an Android APK for installing directly on a phone. It is not published to a store for now. Both work offline and keep data on the device. Ironwave's Node server is not needed.

### Phases

| Phase | Ships | Gate to the next phase |
| --- | --- | --- |
| 1. A workout, handed over and remembered | Goal tiles and name, the ready workout of six, the equipment button, Lift, Done, rest timer, silent next target, the three faces, "new best", the trimmed exercise list with demos. On the web and as an Android APK | You complete several workouts on your own phone without wondering what any screen wants from you |
| 2. Today and balance | Progress screen, rolling volume count, ranked workouts, silent add and cut, lighter weeks, "How was that?" | The workout is started as offered more often than it is edited |
| 3. My plan | Plan offer from the split generator, exercise rotation, plan-aware home screen | Users who accept a plan train more regularly than those who do not |
| 4. Intensity | Silent drop sets and myo-reps | The extra sets are completed more often than skipped |

Phase 1 is deliberately the product your research already supports. Phases 2 to 4 are where the engine has to prove it adds something a plain logger does not.

The largest non-code cost is the demo media for the 40 exercises. It is needed in phase 1 and should be sourced first.

## Judgement calls made

These are the decisions I took without asking. I have not seen the testimonials themselves, only the four findings you summarised, so each call lists what in your data would overturn it.

| Call | Why | What would change it |
| --- | --- | --- |
| A separate app, not a beginner mode inside Ironwave | Ironwave's structure is a program tree. A mode would inherit its onboarding and its vocabulary | Evidence that beginners want to grow into the same app they started in |
| One goal question with five tiles, several allowed, plus an optional name | You said they want to hit a goal. It is the only input that makes suggestions feel personal | Testers skipping the tile most of the time. Then drop it and infer the goal from picks |
| The Easy, Good, Hard tap is kept, optional | It is the cheapest signal that lets the engine tell a stall from a light day | Fewer than about a third of sets getting a tap. Then remove it and rely on rep trends |
| Gym equipment is the default, home is a filter | "Bigger arms" reads as a gym goal | Testimonials that skew toward home training |
| Rep range 8 to 12, sets starting at 2 | Matches the beginner end of Ironwave's accessory ramp and keeps first sessions short | Testers finding first workouts too short to feel worthwhile |
| Stage thresholds of 3, 6 and 8 workouts | Round starting values, chosen to be early enough to see within a month | Real retention curves. Set each threshold just before the point where users drift away |
| On-device storage, no account | Sign-up is onboarding | A need for marketing contact or multi-device use from day one |
| A ready workout from the first open. The weekly plan stays an offer at stage 5 | You confirmed they rarely know what to do. A weekly plan still needs a rhythm to build on | Testers asking for a full week up front. Then offer the plan after the first workout |
| Only drop sets and myo-reps, starting two months in | They are the two techniques that look like ordinary extra sets, so they need no words. Ironwave gives beginners none, so the delay is the safeguard | Extra sets skipped more often than done. Then start later or remove them |

Settled since the first draft: these users more often than not have no idea what to do. So Pick never opens on an empty list. It always opens on a ready workout.

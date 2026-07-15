# Simulated athlete feedback: two 20-year veterans run IRONWAVE end to end

Date: 2026-07-15, against v1.9.0. This is a simulated end-to-end review by two
expert personas, grounded in the actual code paths: onboarding
(`vOnboarding`/`obNext`/`makeProgram`), the split generator
(`generateBodybuildingDays`), both schemes (`jm2-wave`, `jbb-hyp`), the session
flow (check-in -> session -> perf modal -> summary), the week/block advance
(`advanceWeek`/`endBlock`), the Cluster A-F volume/fatigue tooling, and the
analytics surfaces (`renderExDetail`, `vHistory`). The roadmap that came out of
it lives in `pending-future-work.md` (the Epic H series).

Personas:

- **"M", bodybuilder, 20+ years.** Competes in classic physique. Two years on
  the RP Hypertrophy app, tried Alpha Progression, logs in Hevy when coaching
  himself. Thinks in MEV/MRV, rep ranges, SFR, and mesocycle feedback loops.
- **"V", powerlifter, 20+ years.** Raw national-level masters lifter. Grew up
  on the Juggernaut Method book, runs JuggernautAI between meets, has used
  KeyLifts and Boostcamp. Thinks in RPE, working maxes, meet dates, and
  attempt selection.

Both run the app from a fresh install to a finished macrocycle.

---

## Part 1: V, the powerlifter

### Onboarding (zero to program)

**Praise.**

- "No account, no subscription, no ads, my data in a JSON file I control.
  After JuggernautAI's subscription price this is refreshing." (Self-hosted
  PWA, export/import in Settings.)
- The flow is short and honest: days, goal, experience, time, maxes. Nothing
  is pre-selected, so he cannot fat-finger past a decision (`obDefaults`
  starts every choice empty and Continue stays disabled).
- Entering 1RMs and getting a working max at 90% is exactly the book
  (`makeProgram`: `wm = 1RM * 0.9`). The calibration ramp for a lift with no
  max (descending reps at RIR 4/3/2) is smarter than the old "guess a weight"
  approach: "this is how a coach would find a training max."
- A session-length estimate on the time step, live as he types the cap, is a
  touch JuggernautAI does not have.

**Criticism.**

- **The app's own flagship track is not offered.** Onboarding shows only
  Bodybuilding and Powerlifting (`OB_TRACKS`), yet the codebase's default and
  golden-master template is Powerbuilding. A 20-year lifter who wants the
  hybrid (most masters lifters do) cannot pick it from a fresh install.
  JuggernautAI and Boostcamp both offer hybrid tracks up front.
- **kg only.** No pound support anywhere (plates, maxes, logging). For the US
  market this is disqualifying on day one; every competitor (Juggernaut,
  Hevy, Strong, KeyLifts) toggles kg/lb.
- **No meet date.** The program counts down to a "test date" computed as
  `start + weeks`; he cannot enter his actual meet date and have the macro
  arrange itself backward from it. JuggernautAI's whole onboarding pivots on
  the meet date.
- 2 training days per week is not offered (the template does not exist;
  already documented in pending work). At his age he sometimes runs 2x/week
  between meets.
- He can pick how many days he trains, not WHICH weekdays. No calendar
  awareness at all (the long-deferred sport-aware scheduling epic).

### Macro planning (the timeline)

**Praise.**

- The timeline with per-block phase tints, deload hatching, the glowing
  current week, and tap-to-preview any week's actual prescription is
  genuinely better than Boostcamp's flat spreadsheet view. "I can see my
  whole 25 weeks and tap week 23 to see the exact realization ramp."
- The block builder ("+" tile, `openPlanEditor`) lets him reorder, retype,
  and re-wave future blocks while trained blocks lock. A power-user feature
  Juggernaut hides behind support tickets.
- The final strength block is marked as a peak automatically
  (`markPeakBlock`).

**Criticism.**

- Blocks are hard-locked at 5 weeks (`weeksPerBlock`). He cannot run a 3-week
  wave or a 1-week taper; a real peak into a meet is 1-2 weeks, not a 5-week
  block. Per-block week counts are on the roadmap (Epic G2) but absent.
- "Peak" is a phase label and a color. There is no peaking prescription
  distinct from the 3s wave, no opener/attempt-selection tooling, no taper
  logic. **The app counts down to a test date it never programs.** KeyLifts
  and JuggernautAI both hand him openers from his recent AMRAPs.

### Day planning and the session

**Praise.**

- The wave math is the 2012 book, verbatim, and he checked: 5s week at
  70% x 6 x 5, the intensification ramp, the realization AMRAP at 85%, deload
  40/50/60. "Whoever built this read the book, not a blog post about the
  book."
- AMRAP-driven working-max progression, capped at +10 reps, with the
  below-standard "hold and consider recovery" message: faithful and honest.
  The toast showing "+7.5 kg working max" the second he logs the AMRAP is the
  dopamine JuggernautAI buries in a weekly report.
- Plate math with IPF colors per side, the warmup generator, per-lift
  rounding and increments, bar-weight config: gym-floor details most apps
  skimp on. The "closest achievable load" note when his inventory cannot
  build the number is a detail even Hevy lacks.
- The rest timer arms itself when a working set is logged, reads the
  prescribed rest for main vs accessory work, and chimes. The outlier guard
  ("that is double your best ever, sure?") saved his log twice.
- A corrected working max re-prescribes the sets he is looking at
  mid-session (`refreshDraftTargets`), not next week. "That is coach
  behavior."
- Swapped variations log normally but never move the comp lift's working max
  (`donePerf` gates on `e.exId === e.wmKey`). Correct, and he verified it.

**Criticism.**

- **RIR-first display with no RPE option.** He has logged RPE for 15 years;
  the perf modal steppers and every label read RIR. RPE is what is stored,
  but there is no "show me RPE" toggle. Minor but constant friction for his
  generation.
- The pre-session check-in (sleep + soreness sliders + mindset + injury
  checkboxes) feeds a readiness score that is **never shown anywhere**
  (`SHOW_READINESS_UI = false`). "You ask me five questions before every
  session and I never see what they did. Either show me the number or stop
  asking." The injury checkboxes (squat/bench/deadlift) visibly do nothing to
  the prescription.
- A below-standard AMRAP holds the working max but never suggests lowering
  it; after two straight misses he wants the app to propose a reset, the way
  JuggernautAI recalculates.
- History is a tonnage-bar list. No PR feed, no week-over-week comparison
  screen, no e1RM overlay across the big three on one chart. The
  per-exercise trend and dated max milestones are good, but he has to open
  lifts one at a time.

### Macro finish

**Praise.** The "program complete, plan the next macro" card carries his
working maxes forward (back-computed to ~1RM seeds) plus his track and focus.
Landmarks and training age persist and keep evolving. Clean.

**Criticism.** No cycle report. After 25 weeks he wants one screen: starting
vs ending e1RMs on the big four, total tonnage, AMRAP history, weeks missed.
The data exists in `S.records`/`S.sessions`; nothing renders it.

### V's "absolutely lacking" list

1. **Pounds.** Non-negotiable for half the market.
2. **Meet-day tooling:** meet date input, backward planning, a taper/peak
   week that is actually shorter, opener and attempt suggestions from the
   AMRAP data the app already collects.
3. **Custom programming:** he cannot build or import his own template (5/3/1,
   Sheiko, a coach's spreadsheet). One methodology, take it or leave it.
   Boostcamp's entire moat is this.
4. **Flexible block length / weekday scheduling.**
5. A macro-end report.

**Verdict.** "The best free self-hosted implementation of the Juggernaut
method I have seen, with gym-floor polish the paid apps lack. But it is a
Juggernaut engine, not a powerlifting platform: no pounds, no meet, no custom
programs. I would run it between meets and switch apps twelve weeks out."

---

## Part 2: M, the bodybuilder

### Onboarding (zero to program)

**Praise.**

- The goal archetypes (recomp default, serious macro, lean ASAP with a real
  warning that an aggressive deficit is an advanced tool) show actual
  coaching judgment. RP does not ask; Alpha does not ask.
- The muscle-focus sliders with a live session-time estimate, warnings when
  he zeroes or maxes a muscle, and slider-driven FREQUENCY (not just volume)
  is a genuinely original onboarding. The generated split survives his
  scrutiny (anchors rotating across chest/back/shoulder days, glutes able to
  lead a day at 2x, same-muscle days spaced apart): "I gave it arms 5, chest
  4, legs 2 and it built a sane week. I have paid coaches who do worse."
- Not being asked for a deadlift 1RM on the bodybuilding track: "someone
  actually thought about this."
- Volume landmarks seeded by experience and then EVOLVED per block from his
  logged RPE vs target (`recalibrateLandmarks`) rather than fixed tables.
  This is the RP idea with an adaptation loop most clones skip.

**Criticism.**

- Sliders are frozen for the whole macro (the generator runs once at program
  creation). Mid-cycle he decides to prioritize delts; his only option is a
  whole new program, losing block progress. RP lets him re-spec per
  mesocycle.
- The split is generated but not EDITABLE as a split: he can swap, add,
  remove, and reorder exercises within a day, but he cannot rename a day,
  move a muscle from Tuesday to Thursday, or hand-build his own PPL variant.
  Alpha Progression and Boostcamp both have real split editors.

### The training week (day planning, volume management)

**Praise.**

- The Weekly Volume screen is the control panel he expects: per-muscle
  working sets vs his OWN MV/MEV/MRV, per-head splits (upper vs mid chest,
  three delt heads, long vs lateral triceps), compound attribution through
  synergist fractions, per-muscle add/hold/cut recommendations with
  plain-language reasons, a recovery trend chart, and over-MRV warnings.
  "This is 90% of why I pay RP $35 a month, and the head-level split is
  something RP does not even show."
- The autoregulation actually closes the loop: weekly feedback nudges a
  per-muscle volume offset (`updateAutoreg` -> `volAdj` -> prescribed sets),
  clamped so it converges; deloads size themselves to accumulated fatigue,
  can arrive EARLY when he is fried (banner offer), can target one muscle
  (per-muscle deload halves sets and eases RIR), and each block resensitizes
  back toward MEV. He stress-tested it for two mesos and it behaved.
- Finishers (drop sets, myo-reps, rest-pause, lengthened partials) as
  one-tap chips on an accessory's last set, with the mini-rest actually cued
  and timed in the logging modal, counted in tonnage and in the session time
  estimate. Supersets and giant sets are first-class: round-based logging,
  one shared rest per round armed only when the round completes, a toast
  cueing the next exercise. "Hevy still logs a superset as two separate
  exercises. This is the best superset UX I have used."
- Exercise intelligence in the pickers: SFR badges, stretch flags, "adds
  upper chest" hints when a day is missing a head, "delts maxed this week"
  warnings, per-candidate time cost under a cap, and automatic head-diverse
  exercise rotation each meso.
- The phase layer: a cut holds volume instead of adding, backs off sooner,
  suggests a minicut when enough muscles saturate, and the timeline shows
  the phase plan. Bodyweight sparkline included, no macro-counting bloat.

**Criticism.**

- **Every accessory is 12 reps.** `JBB_HYP.accReps = 12`, every week, every
  exercise: lateral raises 12, calves 12, curls 12, leg press 12. No rep
  ranges, no double progression, no per-exercise rep targets, no rep
  variation across mesos. His single loudest complaint: "RP gives me 5-10,
  10-20, 20-30 by exercise. Alpha progresses my reps inside a range before
  adding weight. Here every accessory is the same 12s forever." (It is the
  top of the app's own pending list, and he found it in week one.)
- **Barbell percentage anchors on a physique program.** Push day is led by
  comp bench because the wave/AMRAP math needs a barbell max. He wants a
  machine press or DB incline to LEAD with correct e1RM-based loads, not be
  the swap (the documented e1RM-anchors gap). The week-4 AMRAP on a
  hypertrophy main also reads powerlifter-brained to him, though he concedes
  it keeps the loads calibrated.
- Accessory weight prescriptions come off Epley across rep ranges. The
  anchor-e1RM mitigation (prefer records near the target reps) is smart, but
  the first week on a new machine still occasionally suggests a silly number
  until a couple of logs land.
- The check-in soreness sliders are keyed to lift patterns
  (squat/bench/press/pull), not muscles. On a Pull B day he wants "how are
  your lats / rear delts", not "how is your upper pull".
- The pump quick-tap is collected but pump history is viewable nowhere.

### Exercise started to finished (the logging loop)

**Praise.**

- Fast: tap a set, weight pre-filled from prescription or last real log,
  plate viz updates live, per-hand display for dumbbells, "added load"
  framing for weighted pull-ups with the bodyweight-count toggle frozen into
  tonnage at log time. RIR stepper with plain-language descriptions. Two
  taps to log a set that matched the target.
- The "last set" line under each lift (date, weight x reps, RIR, pump) is
  exactly the reference he needs mid-set.
- Skipped sets are honest: nothing logged, the autoregulator just sees less
  volume. Undoable removes, redo-day, per-exercise notes. The 720-sentence
  coaching-cue library in two languages beats Strong's.

**Criticism.**

- No exercise media. The detail modal shows an emoji placeholder. RP, Alpha,
  and even free Hevy ship video demos for every movement; his training
  partner (5 years experience) would be lost on "Bayesian curl" with text
  cues alone.
- No per-exercise rest customization; the timer reads the global time model.
- History analytics are current-week only for volume. There is no per-muscle
  weekly-sets TREND across the macro ("show me chest sets/week over 18 weeks
  against my MRV"), no pump/soreness history, no aggregate e1RM dashboard.
  The per-exercise trend charts are good; the longitudinal story is missing.

### Macro finish

**Praise.** Landmark evolution and training age persist into the next macro;
carryover drops accessories he never touched; the archetype's phase sequence
ended him on the cut he planned.

**Criticism.** Same as V: no macro report. He wants before/after volume
tolerance ("your chest MRV moved 20 -> 23"), bodyweight vs phase overlay, and
best-set PRs per muscle. The landmarks DID evolve; the app never tells him.

### M's "absolutely lacking" list

1. **Rep ranges + double progression** (and per-exercise rep targets).
2. **Exercise video/media.**
3. **Editable split / re-runnable sliders mid-macro.**
4. **Longitudinal analytics:** per-muscle volume trend, landmark history,
   pump history, a macro-end report.
5. Light nutrition targets. He accepts the "not a macro tracker" boundary
   but wants at least a target weight-change rate per phase and an alert
   when his bodyweight trend disagrees with the phase.

**Verdict.** "Under the hood this is the most complete volume-autoregulation
engine outside RP, and several things (per-head volume, superset UX, deload
depth, honest time budgeting) are better than RP. But it prescribes like a
strength app wearing a bodybuilding shirt: barbell percent anchors and a flat
12 reps on everything. Fix reps and anchors and I would drop my RP
subscription."

---

## Part 3: Synthesis

### What both athletes praised (the moat, defend it)

- Ownership: self-hosted, offline PWA, no account, export/import.
- Gym-floor fidelity: plate math, loading modes, warmups, rest timer,
  outlier guard, mid-session re-prescription.
- The timeline/planner and the honesty of the copy (warnings, "hold and
  recover", deload explanations).
- Methodology fidelity on both schemes; the two never blending.

### Criticisms already on the roadmap (independently validated, in persona-pain order)

1. Rep ranges + double progression (M's number one).
2. e1RM-driven hypertrophy anchors (M's number two).
3. Weekday scheduling / calendar (V; the sport-aware scheduling epic).
4. Per-block week counts + a real peak/taper (V; the Epic G2 remainder).
5. 2-day templates (V; pending, assessed).
6. Measurement trend beyond bodyweight (M; Cluster F open item).

### New findings not previously in pending-future-work.md

1. **Unit support (lb).** The biggest single market blocker; touches
   display, plate inventory, rounding tables.
2. **Powerbuilding is unreachable from fresh onboarding** (`OB_TRACKS` omits
   it) even though it is the default template and the golden-master
   contract.
3. **Check-in data is collected but invisible** (`SHOW_READINESS_UI =
   false`) and the injury checkboxes are dead weight.
4. **Macro-end report** (both personas, independently). Cheap win: the data
   already exists in records/sessions/landmark history.
5. **Longitudinal analytics:** per-muscle weekly-volume trend across the
   macro, landmark evolution history, a multi-lift e1RM view.
6. **Exercise media** (even licensed line art or short clips; the emoji
   placeholder undermines an otherwise pro-grade exercise library).
7. **Mid-macro focus re-spec** (re-run the split generator at a block
   boundary, preserving working maxes and landmarks).
8. **RPE/RIR display toggle** (trivial; `rpeToRir` is already two-way).
9. **Working-max down-adjustment suggestion** after repeated below-standard
   AMRAPs.
10. **Muscle-named soreness check-ins on the bodybuilding track** (the
    pattern-keyed groups read wrong on generated bodybuilding days).

These findings are turned into the Epic H series in
`pending-future-work.md`.

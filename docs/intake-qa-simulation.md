# Adversarial intake QA: onboarding every track toward a nonsense program

Consultation #12 on the launch call sheet (adversaries worth simulating),
run 2026-07-17 against v1.18.0, immediately after Epic I slices I1+I2
landed (track contracts + intake validation). Method: every probe was
executed against the real code through the test harness
(`test/load-app.js`), driving the actual onboarding handlers
(`obNext`/`obMeetChoice`/`obMeet`), `Engine.validateIntake`, `makeProgram`,
and `resolveSlot`/`resolveDayEntries` output. Nothing below is speculation;
every finding reproduces.

## The persona

A QA engineer who also lifts. They do not read the marketing copy; they
read the input fields. Their only job is to finish onboarding on each track
with a program a real coach would refuse to write: a meet they cannot peak
for, loads no human can (or would need to) lift, a week with nothing in it.
Where the RP-style and Juggernaut-style incumbents mostly survive this
persona through server-side plan generation and rigid pickers, a
local-first app takes every keystroke straight into the engine, so intake
IS the trust boundary.

## What held (run this list again after any onboarding change)

The Epic I1/I2 gates all did their job. These attacks now fail loudly, at
the step, with the reason:

- A 10 minute powerlifting session cap: refused (45 min floor; 30 min on
  bodybuilding). A 20 minute bodybuilding cap: refused.
- "Enter time" chosen with the minutes left blank: refused (it used to
  fall through as unlimited).
- Negative minutes: refused.
- A meet date tomorrow, yesterday, or 500 days out: refused with the
  runway reason. An unparseable date: refused.
- Skipping the meet question entirely: impossible on strength tracks; the
  step requires "No meet planned" or a valid date.
- Double-tapping Continue or firing a stale button for another step: no-op.
- Negative or zero 1RMs: dropped (the `v > 0` guard), leaving the week-1
  calibration path.
- All seven sliders at 6 on a 7-day bodybuilding split: the landmark caps
  hold it to ~105 weekly sets with the longest day ~64 min. Not nonsense;
  genuinely well-bounded.
- A 45 min cap against a maxed-slider day: the time model trims without
  gutting the day (core tier protected).
- 1 training day per week + a valid meet: builds and renders a coherent
  taper.

## Findings (ranked)

### F1. A meet 28-48 days out builds a taper that lands AFTER the meet

`validateIntake` floors the runway at 28 days, but the shortest plan
`makeProgram` can build is one 5-week block plus the 2-week taper = 7
weeks. For any accepted date closer than 49 days the plan overshoots the
runway: at 28 days out the athlete gets a 7-week plan whose `jm2-peak`
taper is scheduled for weeks 6-7, two to three weeks after they are
already standing on the platform. The countdown says 4 weeks; the timeline
says 7. Repro: powerlifting, meet +28d -> blocks `[jbb-hyp:5, jm2-peak:2]`,
plan 7wk vs runway 4wk. The I1 floor closed the silent-drop hole but
inherited H6's coherence hole.

### F2. A short-runway meet plan contains zero strength blocks

`extendBlocks` cycles the template pattern from the START, and the
powerlifting template opens with the Hypertrophy Base block. So the
shortest valid meet plan (49-83 days) is hypertrophy base -> taper: a
"meet prep" with no strength block at all, no heavy wave work, straight
from 8s into openers. No coach peaks a lifter off a hypertrophy base.
Repro: meet +49d -> `[jbb-hyp:5, jm2-peak:2]`; +84d is the first runway
that earns a `jm2-wave` block.

### F3. Maxes accept any positive number and prescribe from it

A 1000 kg bench 1RM is accepted, becomes a 900 kg working max, and week 2
of the strength block prescribes 630 kg x5. A 2 kg squat 1RM is accepted,
becomes a 1.25 kg working max, and every prescribed set renders as
**0 kg x5** after rounding, warmups included. Both are complete programs
the athlete can start logging. There is no plausibility band, no
below-the-bar check, no cross-lift sanity (a 300 kg press over a 60 kg
squat raises no eyebrow).

### F4. All-zero focus sliders build a program with nothing in it

Bodybuilding, every slider at 0: onboarding shows the existing removal
warning banner but Continue is not gated, and the result is a 4-day
program where every day resolves to **0 exercises, 0 sets** (the
generator's region days all fall to the removal pass). The athlete
finishes onboarding owning a week of empty screens. The warning copy
("expect to lose some size") is also comically wrong for removing
everything.

### F5. Bodyweight accepts any number, including negative

`-100` and `10000` both pass the welcome step unchecked and land on
`S.profile.bodyweight`, which feeds bodyweight-exercise tonnage and the
Cluster F bodyweight trend. Low severity (nothing crashes), but it is
stored nonsense in the one profile field the phase layer will
increasingly reason from.

### F6. Beginner + "Look lean ASAP" still walks through on a banner

Re-validated, already known: the realism pass (2026-06-24) left "a hard
confirm (not just a banner) if a beginner insists on lean-asap" open. The
persona confirms the banner stops nobody: two taps and a beginner is in an
aggressive-deficit plan. Not re-counted as a new finding; re-affirmed with
a repro.

## Second run (owner grant, 2026-07-17): the specialization split power

The owner extended the persona's powers the same day: set ONE slider to 6
and every other slider to 0, pick 6 days, then read each generated day
like a coach and judge two things. One, does the algorithm understand
fatigue: for arms, are there biceps days, triceps days, and hybrid days so
each head recovers, or does one head absorb the whole week? Two, does the
algorithm run out of ideas and lazily repeat the same exercise, or does it
go find variations? The power is standing: run it for any muscle group
whenever it is relevant, via the committed probe kit
(`node test/intake-qa-probes.js spec [muscle|all] [days]`), which prints
each day plus FREQ / VARIETY / HEADS verdict lines.

First run of the power, all seven groups, 6 days each. The pattern is
identical everywhere: the first 1-2 days are genuinely good (head-diverse,
varied, exactly what Cluster C's `pickAccessory` promises), then the
generator collapses.

- **arms:** d0 `ez-curl, triceps-pushdown, db-curl` and d1
  `overhead-ext, hammer-curl, skullcrusher` are real hybrid arm days.
  Days 2-5 are each `ez-curl x3, ez-curl x3, ez-curl x3`: nine sets of
  one biceps curl, four days in a row. Triceps get 2 exposures all week;
  biceps get 6 straight days. ez-curl appears 13 times in 18 slots.
- **back:** same shape; `lat-pulldown` 13 of 18 slots, days 2-5 all-lats.
- **glutes:** `bb-hip-thrust` 15 of 18. **calves:** `standing-calf-raise`
  16 of 18. **shoulders:** `lateral-raise` 8 plus `military-press` as the
  anchor six days running. **chest:** `comp-bench` anchors all six days
  (a 6x/week barbell bench for an intermediate is its own fatigue
  problem) with `dips` 7 as filler. **legs:** `comp-squat` anchors six
  days with `leg-extensions` 7 as filler.

Answers to the owner's two questions: **no and no.** The head/fatigue
awareness is real but only lasts as long as the muscle's planned
`SPLIT_FREQ` exposures; there is no week-level alternation design (no
bi/tri day rotation), and beyond the planned exposures the routine is
structurally senseless. And the generator is lazy by construction once
its curated pool runs dry: it does not consult the ~179-exercise library
at all.

### F7. Single-muscle specialization breaks the frequency contract: no recovery days

`SPLIT_FREQ[6] = 3`: a maxed muscle is designed to train 3x/week (the
7-day feature deliberately unlocks only a 4th exposure). But
`buildRegion` assigns a PRIMARY to every day with no frequency cap
(`app.js`, step 1 of the region build), so the only muscle with points
leads all 6 days: six consecutive sessions of one muscle, zero recovery
days, and after the first exposures every day is the same single head
(arms days 2-5 are 100% biceps). The generator's own frequency model says
this week should not exist.

### F8. Pool exhaustion repeats one exercise forever, including within a day

`pickAccessory`'s exhaustion fallback is `|| order[0]`: once the 3-6
curated `DEFAULT_ACC` ids are used (week-global), every later pick
returns the pool's first entry, ignoring both the used-set and the
same-day duplicates (hence `ez-curl x3` three times in ONE day). The
pools never extend to the full exercise library, so "out of ideas" hits
after two days even for muscles with a dozen shipped variations
(preacher/incline/cable/concentration/Bayesian curls all exist and are
never used).

## Why this matters for the launch

The GTM premise is "the coaching engine is the paid differentiator" and
T1's thesis is "no silent decisions." F1-F4 are exactly the demos a
paywall-cynical reviewer (call sheet #9) would screen-record: "I told the
'coach' my meet is in a month and it scheduled my taper for after it."
Each is cheap to close because I1 built the chokepoint: they are new rules
in `validateIntake` / `TRACK_SPEC` plus one generator fix, not new
architecture.

## Owner tasks

- [ ] **F1 ruling:** raise the validator floor to the coherent minimum
      (one block + taper, 49 days) and keep it simple, OR keep 28 days and
      have `makeProgram` shorten the first block via `block.weeks` (H6
      already supports per-block weeks). Floor-raise is one number; the
      shrunk block is better coaching but changes prescription for short
      runways (deliberate golden-master-adjacent review).
- [ ] **F2 ruling:** confirm meet runways should fill strength-first
      (cycle the template from the end, or prefer `jm2-wave` blocks when
      the runway is short). This changes which blocks short meet plans get.
- [ ] **F3 bounds:** pick the plausibility band per lift (suggestion:
      hard-error at or below the empty bar and above 500 kg, warn outside
      30-400 kg). Warn-level keeps real outliers unblocked.
- [ ] **F4 ruling:** confirm an all-zero focus should hard-block Continue
      (require at least one slider > 0). Hard to argue otherwise.
- [ ] **F5 bounds:** bodyweight sanity band (suggestion: error outside
      25-350 kg).
- [ ] **F6:** schedule the already-open hard confirm for beginner +
      lean-asap (Cluster F's deeper onboarding item covers the full
      version; a typed confirm is a cheap interim).
- [ ] **F7 ruling:** what should "one muscle at 6, 6 days" build? Two
      directions, combinable: (a) intake honesty at the focus/days steps
      (warn or gate: "one trained muscle fills 3 of your 6 days; pick 3
      days or add muscles"), which is cheap and Epic I5 flavored; (b) the
      coach-grade fix: a head-alternating specialization week (arms:
      biceps day / triceps day rotation; back: lat width / upper
      thickness; chest: upper / lower emphasis) that respects per-head
      recovery while honoring the requested day count. Recommendation:
      (a) now, (b) as the Cluster C item below.
- [ ] **F8 ruling:** confirm the variety direction: never duplicate an
      exercise within a day, exhaustion cycles the pool instead of
      constant-repeating its first entry, and pools extend past
      `DEFAULT_ACC` into the library's muscle-matching exercises ordered
      by SFR (the swap picker's machinery, already built).

## Engineer notes (absorb into Epic I as slice I5)

- **IQ1 (F1):** derive `meetMinDaysOut` from the template
  (`(weeksPerBlock + 2) * 7`) instead of a constant, or implement the
  block-shrink path per the owner ruling. Extend `test/intake.test.js`
  with the 28-48 day band and assert plan weeks <= runway weeks.
- **IQ2 (F2):** meet-aware block selection in `makeProgram`: when a meet
  date sets the block count, fill from the strength end of the template.
  Assert the last pre-taper block is `jm2-wave` for every valid runway.
- **IQ3 (F3):** add a `maxes` rule to `validateIntake` reading per-lift
  bounds from `TRACK_SPEC` (or a shared `INTAKE_BOUNDS` table in data.js);
  the maxes step gains inline banners like the time step. Include the
  0 kg x5 repro as a regression test.
- **IQ4 (F4):** gate the focus step: at least one slider > 0, error-level
  (`val.focus_empty`), and fix the warning copy for the all-removed case.
- **IQ5 (F5):** bodyweight range rule in `validateIntake`, welcome step
  inline banner. Warn tier per owner ruling.
- **IQ6 (F7, intake half -> Epic I5):** a specialization-week sanity rule
  in `validateIntake` / the focus step: when the muscles with points
  cannot fill the chosen day count without breaking `splitFreqFor`, warn
  or gate with the arithmetic ("N days, but your sliders fill only M").
  Pairs with IQ4 (all-zero gate) as the two focus-step rules.
- **IQ7 (F7, generator half -> Cluster C):** cap lead-day assignment at
  the muscle's `splitFreqFor` target and, for a multi-head muscle asked
  to specialize, rotate day emphasis across its heads
  (`muscleHeads`/`HEAD_MUSCLE` already exist) so each head gets at least
  one rest day between exposures; arms alternates biceps/triceps days the
  way a coach writes an arm block.
- **IQ8 (F8 -> Cluster C):** `pickAccessory` fixes: never return an id
  already used on the SAME day; on pool exhaustion cycle least-recently-
  used instead of `order[0]`; and extend the candidate pool past
  `DEFAULT_ACC` with library exercises for the muscle, SFR-ordered,
  before any repeat. All bodybuilding-generator-only, golden master
  untouched; cover in `focus-generator.test.js` with the one-slider-six
  seeds.
- IQ1-IQ5 are additive validation/generation rules behind the I1
  chokepoint; the default powerbuilding path never sets these values, so
  the golden master is untouched except IQ1/IQ2's deliberate short-runway
  meet changes (meet programs are not in the golden master; cover with
  `test/h6.test.js` extensions instead).

## Re-run protocol

This report is repeatable, and the persona's powers are committed tools:

- The F1-F6 intake repros from the first run are pinned as assertions in
  `test/intake.test.js` (the gates) and documented above (the open holes).
- The specialization split power lives in `test/intake-qa-probes.js`
  (`node test/intake-qa-probes.js spec [muscle|all] [days]`), runnable
  for any muscle group whenever it is relevant: after any change to the
  split generator, `pickAccessory`, `DEFAULT_ACC`, `SPLIT_FREQ`, or the
  focus sliders. It is a judgment probe, deliberately not a CI test;
  when IQ6-IQ8 land, their regressions become `focus-generator.test.js`
  assertions and the probe stays as the coach's-eye review.

When Epic I5 or the Cluster C fixes land (or any onboarding change
ships), re-run the battery and update this report rather than writing a
new one. Slice I4 will turn the surviving rules into permanent CI checks.

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
- All five are additive validation/generation rules behind the I1
  chokepoint; the default powerbuilding path never sets these values, so
  the golden master is untouched except IQ1/IQ2's deliberate short-runway
  meet changes (meet programs are not in the golden master; cover with
  `test/h6.test.js` extensions instead).

## Re-run protocol

This report is repeatable: the "what held" list plus F1-F5 repro steps are
encoded as harness probes. When Epic I5 lands (or any onboarding change
ships), re-run the battery and update this report rather than writing a
new one. Slice I4 will turn the surviving rules into permanent CI checks.

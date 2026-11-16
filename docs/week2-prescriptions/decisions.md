# Decisions and tradeoffs

Each entry: what was chosen, what was rejected, why. "D" entries are choices I
made to get Phase 1 done. "Q" entries are yours; where I have a
recommendation it is stated, but nothing is implemented on them.

Labels on training claims: CONSENSUS, CONTESTED, or "no source found".

## Choices made in Phase 1

### D1. Where the test reads prescriptions
- Chosen: `resolveDayEntries(di, 0, w)` (`app.js:1919-1994`), the same call
  the session and the preview use (`app.js:4918`, `app.js:6259`).
- Rejected: calling scheme functions directly. That skips the app-side layers
  (focus, autoreg, deload, set adjust) that also write set counts.

### D2. How the simulated athlete logs
- Chosen: every prescribed set is logged exactly as written. Calibration sets
  have no weight, so two styles are simulated: `ascending` (heavier each
  feeler set) and `flat` (same weight on all three).
- Rejected: one style only. The two styles take different branches of
  `Engine.doubleProgression` (`engine.js:509-513`): `ascending` produces the
  11s and 13s, `flat` produces the 6s. One style would miss half the report.
- Records are stamped one day apart per training day, because
  `doubleProgression` groups by calendar day (`engine.js:433-443`) and same-day
  stamps would merge weeks.

### D3. Fields a valid prescription must carry (the contract the test checks)
None of these exist today, which is part of the diagnosis (1.6).

| Where | Field | Meaning | Invariant |
|---|---|---|---|
| exercise | `kind` | `'compound'` or `'isolation'` | I1, I2 |
| set | `repForm` | `'range'` or `'fixed'` | I1 |
| set | `repRange` | `[lo, hi]`, must be on the whitelist for the exercise kind | I1 |
| set | `reps` | optional integer; if present must be in {6, 8, 10, 12, 15} and inside `repRange` | I1 |
| set | `repRationale` | non-empty string naming the principle | I1 |
| set | `rirRange` `[lo, hi]`, or `rpe` (RIR = 10 - rpe) | effort target | I2 |
| resolved slot | `reasons` | array of codes, each a value of `Engine.REASON_CODES` | I4 |
| resolved slot | `setScheme` | name of a declared mixed-set scheme | I5 |

- Rejected: checking rendered HTML strings. It would tie the test to copy and
  to both languages.
- Tradeoff: these names fix part of the Phase 2 data model. If you want other
  names, say so before approving, since Phase 2 may not edit the assertions.

### D4. "Any other value is invalid" applies to every integer a set carries
- Chosen: even in range form, a `reps` integer must be one of
  {6, 8, 10, 12, 15}. So "9 reps (8-12)" fails, as "11" and "13" do.
- Rejected: accepting any integer inside the range. That would pass today's
  "45 kg x 13 (10-14)" if the range were whitelisted, which is the exact
  output you reported as wrong.

### D5. I3 load step
- Chosen: an increase passes if it is at most
  `max(one implement step, floor(5% of last load / step) * step)`.
- Rejected: the literal "2.5% to 5%, rounded down". On a 2.5 kg step that is
  zero below 50 kg and on a 5 kg step zero below 100 kg, so light lifts could
  never progress. See Q3.
- No lower bound is asserted (a hold is legal).

### D6. I3 rep category
- Chosen: category = form plus range (or the fixed target). When a set
  declares no form (today), the test reads what the set carries: the range if
  present, else its integer. That is why week 1 to week 2 fails today
  ("fixed:14 -> range:10-14").
- The integer inside a range may move only with a reason code (checked by I4).

### D7. I5 working sets
- Chosen: every set that is not a warm-up ramp (`ramp: true`) counts,
  including calibration and AMRAP sets. Mixed sets pass only with a
  `setScheme` name.
- Rejected: exempting calibration sets silently. You wrote that the algorithm
  must understand calibration sets are not the norm; a declared scheme is how
  it says so.

### D8. I6 counting
- Chosen: `weeklyVolumeByMuscle()` (`app.js:3609-3631`), which counts
  non-ramp sets and credits compounds to muscles by the fractions in
  `SYNERGIST_COVERAGE` (`data.js:1472-1479`), rolled up to the seven focus
  slider groups through `MOVEMENT_SLIDER` (`data.js:1411-1415`).
- Rejected: the 13 landmark muscles. 13 muscles x 10 sets is 130 sets a week,
  which no 4-day plan can hold.
- Principle: weekly sets per muscle as the volume unit. CONSENSUS that about
  10+ weekly sets beats fewer on average (Schoenfeld, Ogborn, Krieger 2017,
  J Sports Sci, dose-response meta-analysis). The upper bound of 20 is
  CONTESTED. Fractional credit for synergists: CONTESTED, the fractions here
  are the app's own.

### D9. Docs location and branch
- Chosen: `docs/week2-prescriptions/` and local branch
  `fix/bb-week2-prescriptions`, uncommitted.
- Rejected: repo root (clutters it) and committing a red test to a pushed
  branch (blocks CI).

## Questions for you

### Q1. I6 volume floor (blocking)
Measured, 4 days, sliders at 2, intermediate, sets per group per week:

| Group | Wk 1 | Wk 2 | Wk 3 | Wk 4 |
|---|---|---|---|---|
| arms | in range | in range | in range | in range |
| back | 6 | 6 | 8 | in range |
| calves | 6 | 6 | 8 | in range |
| chest | 6 | 7 | 9 | in range |
| glutes | 8 | 9 | in range | in range |
| legs | 7 | 8 | in range | in range |
| shoulders | 7 | 7.5 | in range | in range |

Source: test output, `I6: 30 violation(s)` over the two styles.

The cause is not the rep logic. It is the starting dose: 2 accessory sets in
week 1 and 3 in week 2 (`JBB_HYP.accSets[0] = [2, 3, 4, 5]`,
`data.js:820`), on a split of 14 exercise slots. Options:

- (a) Keep I6 as written. Then Phase 2 must retune `JBB_HYP.accSets` or the
  split generator, which changes session length for every bodybuilding
  athlete and breaks your rule 4 unless gated by goal.
- (b) Apply 10 to 20 to weeks 2-4 only, at slider Standard or High, and scale
  the floor for short weeks. My recommendation.
- (c) Report I6 but do not gate Phase 2 on it; handle it in Phase 3.

Principle: starting a block near the minimum effective dose and adding sets
is CONTESTED (popular in practice, no source found showing it beats a fixed
dose). 10 sets as a floor in every week including the first: no source found.

### Q2. The 1.5 proposed column versus I3
- Sets: the table adds +1 set on every logged week. I3 says +1 only if session
  effort was low, hold if high.
- Load: the table says "two increments" at the top of the range. Two 5 kg
  steps on a 45 kg pulldown is +22%. I3 caps at 5%.

Which rule wins? My recommendation: I3 wins; the table's "two increments"
becomes "one increment, or up to 5% if that is more than one step".
Progressive overload is CONSENSUS; the size of the jump is CONTESTED.

### Q3. I3 rounding (see D5)
Confirm one step is always allowed, or tell me light lifts should progress by
reps or sets only until 5% reaches a step.

### Q4. I2 on special sets
Read literally, I2 fails these, which exist today:
- Calibration feelers at RIR 4 and 3 (`engine.js:127-134`).
- The week 4 AMRAP at RIR 0 on a compound (`engine.js:1121`).
- Deload sets at RIR 4 (`data.js:832`), outside weeks 1-4 so not in this test
  yet, but inside the weeks 1-8 test you asked for in Phase 2.

The test applies I2 literally. My recommendation: exempt sets inside a
declared `CALIBRATION` or `DELOAD` scheme, and decide the AMRAP separately.
Principle: sets within about 0-3 RIR drive hypertrophy, CONSENSUS (Refalo et
al. 2023, Sports Med). Rep-in-reserve estimates get less accurate further
from failure, CONSENSUS (Halperin et al. 2022, Sports Med), which argues
against RIR 4 feelers as the basis for loads. A deload being easier than
RIR 3: no source found for a specific number.

### Q5. UI scope
Phase 2 says UI is out of scope, but the visible symptom is a label.
`setTargetLabel` (`app.js:5031-5034`) prints "45kg x 13 (10-14)" and
`previewSetLabel` (`app.js:6252-6254`) prints "45kg x 13 @ 2 RIR" with no
range. To show "10 to 15 reps @ RIR 1 to 2" those two functions, the scheme
line (`app.js:5270-5271`, `6274`) and their strings in both catalogs must
change. I recommend allowing exactly that and nothing else in the UI.

### Q6. Goal gating
`goalArchetype` is read in two places only: the phase cycle in `makeProgram`
(`app.js:597`) and a block label (`app.js:1413`). So "Look good, stay
healthy", "serious-macro" and "lean-asap" get the same prescriptions and the
same bug. Fixing only `recomp` in Phase 2 follows your rule 4 but leaves the
other two goals wrong until Phase 3. The gate will be one predicate so Phase
3 can widen it in one line.

### Q7. Default profile (see plan.md)

### Q8. Calibration sets and I1
Week 1 already prescribes 11, 13, 17, 18, 20 and 22 rep feeler sets
(`calibrationRamp(range[1])`, `engine.js:1155`). You said week 1 looks
reasonable. The test treats them as working sets, so they fail I1. Confirm,
or tell me to exempt a declared calibration scheme from I1.

### Q9. Two rows of the 1.5 proposal I would not implement as written
- "Not logged: +1 set". An exercise that was never logged has no load to
  build on; today it repeats the calibration ramp. Adding a set to something
  the athlete is skipping pushes them further from doing it. No source found.
- "Deload: previous week's weights -25%, 3 sets". Peak week has up to 5
  accessory sets, so 3 is reasonable, but today's deload is 2 sets. Whether
  deloads help hypertrophy at all is CONTESTED (Coleman et al. 2024 found no
  benefit from a one-week deload). The exact -25% and 3 sets: no source found.

These are your rows; I am flagging them, not overriding them.

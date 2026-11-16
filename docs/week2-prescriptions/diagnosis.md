# Diagnosis: atypical week 2+ prescriptions

Scope: track `bodybuilding`, goal `recomp` ("Look good, stay healthy"),
block 1, weeks 1-4. Code state: `main` at `8c3e5f2` (v1.23.0). No production
code was changed. Reproduction: `app/test/bb-recomp-invariants.test.js`.

Anything not confirmed by reading or running code is marked NOT VERIFIED.

## (a) What is wrong, in plain language

**In `engine.js` and `data.js`.** Accessory reps are calculated, not chosen.
Three calculations stack:

1. The rep range is a table value plus 2 for "high SFR" exercises, and plus 2
   again in odd blocks. That creates ranges like 10-14, 12-17 and 14-22.
2. Week 1 is a calibration ramp counted down from the top of that range in
   steps of 2 (14, 12, 10 or 15, 13, 11).
3. From week 2, "double progression" takes the heaviest set you logged last
   time and prescribes one more rep. It treats the week 1 feeler sets as real
   performance, so 10 becomes 11 and 12 becomes 13. If you used the same
   weight on all three feelers, it reads the first, easy set as "top of the
   range reached", raises the weight and resets every set to the bottom of
   the range: several sets of 6.

**In the coach.** `Engine.coach` has no progression logic at all. It checks
onboarding inputs, budgets and meet plans. Nothing reviews a week-over-week
change, nothing explains it, and set counts are adjusted by six separate
layers in `app.js` that do not know about each other.

## 1.1 Pipeline map

### From selection to prescription (call order)

| # | file:function (lines) | What it does |
|---|---|---|
| 1 | `app.js:obTrack` (2973), `obArchetype` (2977-2982) | Stores track and goal; the goal seeds `macroWeeks = 18` |
| 2 | `engine.js:Engine.validateIntake` (978-1045) calling `Engine.coach.checkGoal` (748-755) and other coach checks | Intake plausibility only |
| 3 | `app.js:obNext` (3058-3187) | Builds profile, calls `makeProgram` |
| 4 | `app.js:makeProgram` (564-679) | Blocks from `PROGRAM_TEMPLATES.bodybuilding` (`data.js:743-755`), `stampMesoIdx`, `applyArchetypePhases` (597), working maxes from entered 1RMs (603-608) |
| 5 | `app.js:generateBodybuildingDays` (937-1131) with `Engine.coach.sessionTargetSec` (823-831) | The weekly split: days, main slots, accessory slots |
| 6 | `app.js:resolveDayEntries` (1919-1994) | One day's entries for block b, week w |
| 7 | `app.js:resolveSlot` (1497-1596) | The choke point; picks the scheme and applies the app-side layers |
| 8 | `engine.js:Engine.schemeFor` (1266-1269) | Always `jbb-hyp` on this track |
| 9 | `engine.js:repRangeFor` (480-483), `mesoRepRange` (486-488) | Accessory rep range (called from `app.js:1569`) |
| 10 | `engine.js:jbb-hyp.main` (1102-1125) or `mainE1RM` (1192-1211) | Main lift sets |
| 11 | `engine.js:jbb-hyp.accessory` (1151-1185) | Accessory sets; calls `anchorE1RM` (69-77), `calibrationRamp` (126-138), `weightFor` (47-51), `doubleProgression` (505-514), `impliedRpe` (494-497) |
| 12 | `app.js:deloadDepthDelta` (1628-1634), `deloadIntensityDelta` (1639-1645) | Deload week only |
| 13 | `app.js` weekMod via `computeWeekMod` (2233-2262), applied at 1576 | End-of-week "feel" slider: +/- sets, +/- 5% on mains |
| 14 | `app.js:focusForAccessory` (1465-1483) | Slider scaling of set count |
| 15 | `app.js:autoregForAccessory` (1797-1814), fed by `updateAutoreg` (3950-3966) and `Engine.autoregVolume` (`engine.js:1349-1385`) | Per-muscle set offset, -2 to +2 |
| 16 | `app.js:applyMuscleDeload` (1682-1687) or `applyTechnique` (1832-1844) | Per-muscle deload, or finisher |
| 17 | `app.js:applySlotSetAdj` (1604-1619) | Athlete's own added or removed sets |
| 18 | `app.js:sessionEntryFrom` (4950-4970) | Copies `reps` to `targetReps`, `rpe` to `targetRpe` |
| 19 | `app.js:setTargetLabel` (5017-5036), `previewSetLabel` (6252-6254) | The text you read |
| 20 | `app.js:donePerf` (5948-6057) | Logging: writes `{ts, weight, reps, rpe}` (5976-5981), which step 11 reads next week |

### Coach algorithms involved

All in `app/engine.js`, object `Engine.coach` (572-977): `bounds` (573),
`checkBodyweight` (724), `checkMax` (729), `checkGoal` (748),
`sessionTargetSec` (823), `checkSessionEstimate` (832), `focusSpend` (843),
`focusBudget` (854), `checkFocusBudget` (877), `rebalanceFocus` (888),
`checkFocus` (926), plus the advanced-frequency helpers (644-717).

None of them takes a week index, a set or a log. **The coach does not take
part in week-over-week prescription.** The functions that behave like a coach
(`Engine.autoregVolume`, `Engine.deloadDepth`, `computeWeekMod`) sit outside
`Engine.coach`.

### Who decides each variable

| Variable | Decided by | Then modified by |
|---|---|---|
| Rep target, accessories | `repRangeFor` + `mesoRepRange` (range), `calibrationRamp` (week 1), `doubleProgression` (week 2+) | Nothing |
| Rep target, mains | `WAVES[block.wave].standard` (`data.js:686-711`), read at `engine.js:1117` | Nothing |
| Sets | `JBB_HYP.mainSets` / `accSets` by block and week (`data.js:817-822`) | Deload depth, weekMod, focus, autoreg, muscle deload, athlete set adjust (steps 12-17) |
| Load, accessories | `doubleProgression` when records exist (`engine.js:1175-1177`), else no load | Nothing |
| Load, mains | Working max x (`W.acc.pct + JBB_HYP.dPct[week]`) (`engine.js:1117`) | `weekMod.pctMod` (0.95 or 1.05) |
| RIR / RPE | `JBB_HYP.rpe` / `accRpe` (`data.js:815, 823`) | Overwritten by `impliedRpe` on ranged accessories (`engine.js:1178`); deload intensity; muscle deload |
| Week-over-week change | Reps and load: `doubleProgression`. Sets: the fixed table plus the layers above | No single owner |

### Overwrites and contradictions

1. **RIR is overwritten inside the engine.** `jbb-hyp.accessory` reads the
   week's target from `JBB_HYP.accRpe` (`engine.js:1167`) and replaces it
   with `impliedRpe(...)` (1178). Measured results in week 2: RPE 6 (RIR 4)
   for `ez-curl` and RPE 10 (RIR 0) for `cable-row`, both in the `flat` run.
2. **Two volume controllers for the same muscle.** `JBB_HYP.accSets` adds a
   set every week regardless of performance (`data.js:820`).
   `autoregForAccessory` then adds or removes up to 2 more from feedback
   (`app.js:1812`). `weekMod.accSetDelta` adds or removes another
   (`app.js:1576`). All three can move the same exercise in the same week.
3. **The engine comment and the engine disagree on who owns what.** The
   comment says "volume autoreg owns SETS, double progression owns REPS"
   (`engine.js:1148-1149`), but the set count still comes from the fixed
   table first.
4. **Two labels disagree.** The session row prints the range
   (`app.js:5031`); the preview does not (`app.js:6252-6254`).
5. **`Engine.coach` versus the engine: no conflict found, because the coach
   never writes a prescription.** That absence is the finding.

## 1.2 Reproduction

File: `app/test/bb-recomp-invariants.test.js`. Input: bodybuilding, `recomp`,
18 weeks, 4 days, intermediate, sliders at 2, no 1RMs, block 1 weeks 1-4.

**Randomness: none.** `grep Math.random app/app.js app/engine.js app/data.js`
returns nothing. The only clock dependence is `Date.now()` in the record
recency windows (`engine.js:71, 434`); the test stamps its own timestamps.

Result (run on this checkout):

| Invariant | Result | Violations |
|---|---|---|
| I1 rep format | FAIL | 1469 |
| I2 effort | FAIL | 70 |
| I3 continuity | FAIL | 24 |
| I4 explainability | FAIL | 85 |
| I5 homogeneity | FAIL | 32 |
| I6 weekly volume | FAIL | 30 |

Full suite: 621 tests, 615 pass, 6 fail (the six above).

### Actual output, weeks 1 and 2, every exercise

Format: `load x reps @ RPE`. `?` = no load (calibration). `[lo,hi]` = the
range tag on the set. RIR = 10 - RPE.

**Week 1 (identical in both styles)**

| Day | Exercise | Sets |
|---|---|---|
| 1 | comp-squat (main) | ?x10@6, ?x8@7, ?x6@8 |
| 1 | bb-hip-thrust | ?x12@6, ?x10@7, ?x8@8 |
| 1 | standing-calf-raise | ?x22@6, ?x20@7, ?x18@8 |
| 2 | comp-bench (main) | ?x10@6, ?x8@7, ?x6@8 |
| 2 | ez-curl | ?x15@6, ?x13@7, ?x11@8 |
| 2 | lat-pulldown | ?x14@6, ?x12@7, ?x10@8 |
| 2 | lateral-raise | ?x17@6, ?x15@7, ?x13@8 |
| 3 | glute-bridge | ?x12@6, ?x10@7, ?x8@8 |
| 3 | leg-extensions | ?x14@6, ?x12@7, ?x10@8 |
| 3 | seated-calf-raise | ?x22@6, ?x20@7, ?x18@8 |
| 4 | cable-row | ?x14@6, ?x12@7, ?x10@8 |
| 4 | triceps-pushdown | ?x17@6, ?x15@7, ?x13@8 |
| 4 | dips | ?x12@6, ?x10@7, ?x8@8 |
| 4 | db-shoulder-press | ?x10@6, ?x8@7, ?x6@8 |

**Week 2** (loads come from the simulated athlete's hidden strength, so only
reps, sets and RPE matter here)

| Exercise | Style `ascending` | Style `flat` |
|---|---|---|
| comp-squat (main) | 4 x 27.5x10@8 | 4 x 25x10@8 |
| bb-hip-thrust | 3 x 52.5x**9**@7.5 [8,12] | 3 x 50x8@6 [8,12] |
| standing-calf-raise | 3 x 35x**14**@10 [14,22] | 3 x 35x**14**@10 [14,22] |
| comp-bench (main) | 4 x 27.5x10@8 | 4 x 25x10@8 |
| ez-curl | 3 x 62.5x12@9 [10,15] | 3 x 57.5x10@6 [10,15] |
| lat-pulldown | 3 x 45x**13**@8 [10,14] | 3 x 45x10@7.5 [10,14] |
| lateral-raise | 3 x 45x**16**@8 [12,17] | 3 x 45x12@9.5 [12,17] |
| glute-bridge | 3 x 47.5x**9**@8 [8,12] | 3 x 45x8@6 [8,12] |
| leg-extensions | 3 x 55x**11**@7.5 [10,14] | 3 x 55x10@6.5 [10,14] |
| seated-calf-raise | 3 x 60x**19**@7.5 [14,22] | 3 x 60x**14**@8 [14,22] |
| cable-row | 3 x 30x**13**@8 [10,14] | 3 x 30x10@10 [10,14] |
| triceps-pushdown | 3 x 60x**16**@8 [12,17] | 3 x 60x12@8 [12,17] |
| dips | 3 x 50x**9**@7.5 [8,12] | 3 x 47.5x8@6 [8,12] |
| db-shoulder-press | 3 x 80x**7**@8.5 [6,10] | 3 x 75x**6**@6 [6,10] |

Bold = a rep count outside {6, 8, 10, 12, 15}, or the reported "6".

The same pattern continues: `ascending` week 3 gives 10, 15, 13, 14, 17, 10,
12, 20, 14, 17, 10, 8 and week 4 gives 11, 16, 14, 10, 12, 11, 13, 21, 10,
12, 11, 9 (accessories in table order), one rep up each week until the top of
the range, then a load jump and a reset to the bottom.

**If week 1 is not logged**, week 2 repeats the week 1 calibration ramp
unchanged (run with no logging: every row of week 2 equals week 1). That is a
second way to see "sets of 6" in week 2: `comp-squat`, `comp-bench` and
`db-shoulder-press` each end on a 6.

## 1.3 Traces

### Trace A: "13 reps", lat-pulldown, week 2, style `ascending`

| Step | file:function:line | Input | Output |
|---|---|---|---|
| 1 | `data.js:REP_RANGES:844` | movement `vpull` | [8, 12] |
| 2 | `engine.js:repRangeFor:480-483` | [8, 12], sfr 3 | **[10, 14]** |
| 3 | `engine.js:mesoRepRange:486-488` | [10, 14], mesoIdx 0 | [10, 14] |
| 4 | `app.js:resolveSlot:1566-1571` | range [10, 14], no records | calls `jbb-hyp.accessory` |
| 5 | `engine.js:jbb-hyp.accessory:1153-1156` | no e1RM | `calibrationRamp(14)` |
| 6 | `engine.js:calibrationRamp:126-138` | 14 | 14@RPE6, 12@RPE7, 10@RPE8, no load |
| 7 | `app.js:donePerf:5976-5981` (simulated) | athlete logs the ramp | records 40x14@6, 45x12@7, 45x10@8 |
| 8 | `engine.js:jbb-hyp.accessory:1153, 1167` | records, week 2 | e1RM 67.5, target RPE 7.5 |
| 9 | `engine.js:doubleProgression:506-508` | last day's records | heaviest = 45x12@7 (first of the tie at 45) |
| 10 | `engine.js:doubleProgression:513` | 12 < hi 14 | `{weight: 45, reps: 12 + 1 = 13}` |
| 11 | `engine.js:jbb-hyp.accessory:1177-1178` | 45 x 13 | RPE overwritten to 8 by `impliedRpe` |
| 12 | `engine.js:jbb-hyp.accessory:1182-1184` | `JBB_HYP.accSets[0][1] = 3` | 3 sets of 45x13@8, tag [10,14] |
| 13 | `app.js:sessionEntryFrom:4960-4967` | reps 13 | `targetReps: 13`, `repRange: [10,14]` |
| 14 | `app.js:setTargetLabel:5031-5034` | | "45kg x 13 (10-14)" |
| 14b | `app.js:previewSetLabel:6252-6254` | | "45kg x 13 @ 2 RIR" |

**Root cause for this value: step 2.** The range leaves the I1 whitelist
(10-14 is not a compound or isolation range) at `engine.js:482`, already in
week 1. Step 10 (`engine.js:513`) is the second, independent exit: it would
produce an off-list integer even from a whitelisted range. Proof: `ez-curl`
has the whitelisted range [10, 15] (sfr 2, no shift), week 1 is 15, 13, 11
(`calibrationRamp`, step 6, exits at `engine.js:133`), and the athlete's
heaviest set of 11 becomes 12 in week 2, then 13, then 14.

### Trace B: "several sets of 6 reps", db-shoulder-press, week 2, style `flat`

| Step | file:function:line | Input | Output |
|---|---|---|---|
| 1 | `data.js:REP_RANGES:843` | movement `press` | [6, 10] |
| 2 | `engine.js:repRangeFor:480-483` | [6, 10], sfr 2 | [6, 10] |
| 3 | `engine.js:calibrationRamp:126-138` | 10 | 10@RPE6, 8@RPE7, 6@RPE8 |
| 4 | `app.js:donePerf:5976-5981` (simulated) | same dumbbells on all three | records 70x10@6, 70x8@7, 70x6@8 |
| 5 | `engine.js:doubleProgression:508` | three records at 70 | "heaviest" = the first one, 70x10@6 (`b.weight > a.weight` keeps the first on a tie) |
| 6 | `engine.js:doubleProgression:509-510` | reps 10 >= hi 10, RPE 6 <= target 7.5 | **`{weight: 70 + 5, reps: lo = 6, moved: 'weight'}`** |
| 7 | `engine.js:jbb-hyp.accessory:1178` | 75 x 6 | RPE overwritten to 6 (RIR 4) |
| 8 | `engine.js:jbb-hyp.accessory:1182-1184` | 3 sets | 3 x 75x6@6, tag [6,10] |
| 9 | `app.js:setTargetLabel:5031-5034` | | "37.5kg/hand x 6 (6-10)" |

**Root cause: step 5 to 6.** A calibration feeler set at RIR 4 is read as a
working set that reached the top of the range. 6 is a whitelisted number, so
I1 passes on the integer; the value leaves the valid domain on **I2** (RIR 4
on a compound, limit 1-3) and **I3** (week 1 to week 2 is a rep reshuffle,
"fixed:10 -> range:6-10"), both at `engine.js:510`.

The other two sources of a 6 are in 1.4 (h).

## 1.4 Hypotheses

| | Hypothesis | Verdict | Evidence |
|---|---|---|---|
| a | Reps computed arithmetically and not chosen from a range | **CONFIRMED** | `last.reps + 1` (`engine.js:513`); `baseReps - 2 * i` (`engine.js:133`); `[lo + 2, hi + 2]` (`engine.js:482, 487`) |
| b | Progression applied to reps instead of load or sets | **CONFIRMED** | `doubleProgression` moves reps first by design (`engine.js:498-514`); traces A and B |
| c | Goal mapped to the wrong template or a fallback | **RULED OUT** | `goalArchetype` is read only for the phase cycle (`app.js:597`) and a label (`app.js:1413`). All bodybuilding goals get the same blocks (`data.js:743-755`) and the same prescriptions. Side finding: the goal does not shape training at all |
| d | Week off by one, or week 2 treated as a new block | **RULED OUT** | Week 2 is index 1, `accumulation` (`engine.js:80-82`); `mesoRepRange` depends on `block.mesoIdx` only (`engine.js:487`); test output shows the range tag constant across weeks 2-4. What does happen: week 1 to 2 switches from the calibration regime to the working regime, which feels like a new block |
| e | A variation routine randomizing reps | **RULED OUT** | No `Math.random` in the three scripts; two runs give identical output |
| f | Engine and coach both progress the same variable | **RULED OUT for reps and load** (single writer: `engine.js:1175-1177`). **CONFIRMED for sets**: table ramp `data.js:820` + autoreg `app.js:1580-1581` + weekMod `app.js:1576`, no arbitration. Not the cause of the rep symptom |
| g | RIR/RPE converted to reps, or reps to %1RM, yielding off-range integers | **RULED OUT for reps. CONFIRMED for effort**: `impliedRpe` (`engine.js:494-497`) turns reps and load back into an RPE and overwrites the target (`engine.js:1178`), giving RIR 0 and RIR 4 in week 2 |
| h | The 6s leak from a strength or top-set scheme | **RULED OUT** | The block scheme is `jbb-hyp` and `resolveSlot` routes on it alone (`app.js:1499`). The 6s have three in-scheme sources: the third calibration set of any 6-10 lift or 10s main (10 - 4, `engine.js:133`); the reset to `lo` after a load jump (`engine.js:510`); an unlogged week 1 repeating the ramp |
| i | (added) Calibration feelers are read as performance, and ties pick the easiest set | **CONFIRMED** | `doubleProgression` filters `seed` records only, not calibration ones (`engine.js:506`); records carry no `calib` flag (`app.js:5976`); tie rule at `engine.js:508`; trace B |
| j | (added) SFR and block shifts create ranges nobody would write | **CONFIRMED** | 10-14, 12-17, 14-22 in the week 2 table; odd blocks add 2 more (`engine.js:487`), NOT VERIFIED by a run past block 1 |
| k | (added) An exercise that is never logged never leaves calibration | **CONFIRMED** | `engine.js:1154-1156`; no-logging run |
| l | (added) The two labels show different things | **CONFIRMED** | `app.js:5031-5034` versus `app.js:6252-6254` |

## 1.5 Current behavior per branch

Accessories on this track unless stated. "Proposed" is your column, unchanged.

| Week N-1 data | Performance vs target | Current behavior | Proposed behavior |
|---|---|---|---|
| Logged | Top of range hit on all sets above target RIR | Only the heaviest set of the last logged day is read, not all sets (`engine.js:508`). If its reps >= hi and RPE <= the week's target: load + one implement step, reps reset to `lo` (`engine.js:509-510`). Sets follow the table, +1 per week (`data.js:820`), plus autoreg | Load up two increments, add +1 set |
| Logged | Within range | Same load, heaviest set's reps + 1 (`engine.js:513`). Sets +1 per week from the table | Load up one increment, add +1 set |
| Logged | Below range or RIR target missed | Below range: same load, reps = `lo` (`engine.js:513`). Top reached but RPE over target: same load, reps = `hi` (`engine.js:511`). No count of consecutive misses and no load reduction for accessories. `autoregVolume` cuts one set if logged reps average 1 or more under target (`engine.js:1360-1364`, `app.js:3746-3747`). Mains only: two below-standard AMRAPs offer a working-max reset (`app.js:5928-5947`) | Hold load; if missed 2 consecutive weeks, reduce load one increment |
| Not logged | n/a | Never logged: the calibration ramp repeats every week (`engine.js:1154-1156`). Logged earlier but not last week: the last logged day is reused as if it were last week (`engine.js:506-508`, window 3650 days). Sets still +1 per week. Nothing is removed inside a block; at block end only optional, time-capped accessories never trained are dropped (`app.js:4206-4227`) | +1 set increase, remove exercise if it's not logged for two weeks |
| Deload week | n/a | Accessories: 2 sets at `lo` reps, load priced for RPE 6 from the e1RM, not from last week's load (`engine.js:1160-1164`, `data.js:832`), then +/- 1 set and -1 RPE from `Engine.deloadDepth` (`engine.js:1419-1433`). Mains: 40/50/60% of working max x 5 (`data.js:713`, `engine.js:1108-1110`). Measured: `db-shoulder-press` 80x9 in week 4, 2 x 80x6 in week 5 (same load, fewer reps) | All weights from previous week, but -25%, 3 sets |
| Block / mesocycle transition | n/a | `endBlock` (`app.js:4033-4118`): autoreg offsets reset to 0 (4038), athlete set adjustments cleared (4044), every default accessory rotated to another exercise by `pickAccessory` (4099-4113), landmarks recalibrated (4035). Next block: range + 2 if the block index is odd (`engine.js:487`), main reps from the new wave (10s then 8s, `data.js:748-752`), set table row for the new block. No coach function is consulted and no reason is recorded. NOT VERIFIED by a run; read from code | Coach must decide how much variation is needed |

## 1.6 Data model

- A set is a plain object: `{ weight?, reps, rpe?, calib?, amrap?, ramp?,
  noteKey?, technique?, drops?, repRange?, repPR? }` (`engine.js:141`,
  `1182-1184`).
- `reps` is always **one integer**. `repRange` exists as an optional
  `[lo, hi]` tag on ranged accessories only (`engine.js:1159`); it is display
  metadata, the prescription is still the integer.
- Effort is **one number** (`rpe`). There is no RIR range. Some sets have no
  effort at all (main deload sets, `engine.js:1109`).
- The session copy keeps the same shape: `targetReps`, `targetRpe`,
  `repRange` (`app.js:4960-4968`).
- A logged record is `{ ts, weight, reps, rpe }` plus optional fields
  (`app.js:5976-5980`). It does **not** record whether the set was a
  calibration set, which is why hypothesis (i) happens.
- An exercise has `movement`, `equipment`, `sfr`, `stretch`, `head`
  (`data.js:446-452`). There is **no compound / isolation field**.
- There is no rationale field, no reason code and no named set scheme
  anywhere.

**Conclusion: the model cannot express I1, I2, I4 or I5 today. Extending it
is part of the fix.**

## (e) Proposed fix

Every change is gated to bodybuilding + `recomp` behind one predicate, and
inert otherwise, so the golden master and the other goals do not move.
Items marked (needs Q) depend on an open question in `decisions.md`.

| # | Change | file:function | Restores |
|---|---|---|---|
| 1 | Add `kind` (`compound` / `isolation`) to every exercise | `data.js:EX_META` and `EXERCISES` (446-452) | I1, I2 |
| 2 | New table mapping movement + kind to one whitelisted range (6-10, 8-12, 10-15, 12-20) with a rationale string; the gated path stops using the +2 shifts | `data.js` new table; `app.js:resolveSlot` (1566-1570); `engine.js:repRangeFor`, `mesoRepRange` left as they are for other paths | I1, I3 |
| 3 | Closed enum `Engine.REASON_CODES` | `engine.js` | I4 |
| 4 | One pure decision function, `Engine.coach.progress(...)`: input = last week's logged **working** sets, the range, the week type; output = load, set delta, RIR target, reason codes, following the approved 1.5 table. This is the single writer for week-over-week change | `engine.js:Engine.coach` | I3, I4 |
| 5 | Gated accessory prescription emits homogeneous range-form sets (`repForm`, `repRange`, `repRationale`, `rirRange`); no `doubleProgression`, no `impliedRpe` on this path | `engine.js:jbb-hyp.accessory` (1151-1185) | I1, I2, I5 |
| 6 | Calibration becomes a declared scheme with whitelisted reps, and logged calibration sets are flagged so progression ignores them (needs Q4, Q8) | `engine.js:calibrationRamp` call sites (1155, 1104); `app.js:donePerf` (5976) | I1, I5, cause (i) |
| 7 | Mains declare their form (`fixed`, 10 or 8) and the week 4 AMRAP declares a named scheme (needs Q4) | `engine.js:jbb-hyp.main` (1102-1125) | I1, I5 |
| 8 | `resolveSlot` attaches `reasons` and `setScheme`; each set-count layer contributes its reason code, and the table ramp, autoreg and weekMod go through item 4 instead of stacking (needs Q2) | `app.js:resolveSlot` (1571-1594) | I3, I4, contradiction 2 |
| 9 | Show the range and RIR in both labels and the scheme line (needs Q5) | `app.js:setTargetLabel` (5017-5036), `previewSetLabel` (6252-6254), 5270-5271, 6274; `i18n/en.js`, `i18n/es.js` | The visible symptom |
| 10 | Weekly volume floor (needs Q1) | `data.js:JBB_HYP.accSets` (820) and/or `app.js:generateBodybuildingDays` | I6 |
| 11 | Export new functions to tests | `test/load-app.js` | Testability |

Known cost, NOT VERIFIED in detail: `reps` is read in about 75 places
(`grep -c "\.reps\b"`: 39 in `app.js`, 36 in `engine.js`), including the time
estimate and tonnage. The plan is to keep `reps` as a whitelisted integer
anchor (the bottom of the range) so those readers keep working, which D4 in
`decisions.md` allows.

## Self-check

Every section above cites a file and line, pastes output from this codebase,
or is marked NOT VERIFIED. STOP: waiting for approval before Phase 2.

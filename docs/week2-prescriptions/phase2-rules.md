# Owner rulings (2026-11-16) and final rules for Phase 2

Continues `decisions.md` (questions Q1-Q9 are defined there).

## Rulings

| Q | Ruling | Effect |
|---|---|---|
| Q1 | Go with the recommendation | I6 applies on work weeks only (not calibration, not deload), to groups at slider 2 or 3, floor = 10 x min(1, days / 4), ceiling 20 |
| Q2 | I3 wins | Sets rise by one only after a low-effort week. Load rises by at most 5% |
| Q3 | The literal rule is essentially right | A step bigger than 5% is not automatic. The coach decides; sometimes the next load waits for the next block (R4 below) |
| Q4 | Exemptions accepted, plus a new requirement | Calibration and deload schemes are exempt from I2. New: an athlete may skip calibration by entering a 1RM / 10RM at any time and the routine must adapt at once (R7) |
| Q5 | Lead's call | The two set labels and the scheme line may change, with their strings in both catalogs. Nothing else in the UI |
| Q6 | Granted | "Not logged: +1 set" and "deload -25%, 3 sets" are not implemented as written (R5, R8) |
| Q7 | Onboarding always asks days and experience | There is no default profile; the user case is 4 days, intermediate, and the sweep covers every combination |
| Q8 | Calibration reps count | Calibration sets must use whitelisted reps |

Owner's note: an earlier brief said "reps" where "sets" was meant, which is how
rep-based double progression got built. The intent is: reps stay inside a fixed
range, progression happens through load and sets.

Changes to the reproduction test made BEFORE Phase 2 because of these rulings
(assertions now live in `app/test/bb-invariants-helper.js`): the I2 exemptions,
the I3 load rule, the I6 scope, and the athlete now completes weeks through
`advanceWeek()` and performs range sets to the target RIR. It still fails on all
six invariants against v1.23.0 (I1 1700, I2 78, I3 38, I4 86, I5 32, I6 12).

## Final rules (the Phase 2 specification)

All of this is gated to track `bodybuilding` + goal `recomp` behind ONE
predicate in `app.js`. Off that path every function must return what it
returns today (golden master byte-identical, existing tests untouched).

### R1. Exercise kind and rep range (I1)
- Every exercise gets `kind`: `'compound'` or `'isolation'` (default by
  movement, with per-exercise overrides where a movement holds both, e.g.
  dips vs cable fly, leg press vs leg extension, RDL vs leg curl).
- Range by kind and movement, from the whitelist only:
  - compound, movements squat / bench / press / deadlift: 6-10
  - compound, everything else: 8-12
  - isolation, movements calf / abs: 12-20
  - isolation, everything else: 10-15
- Accessories are range form: `repForm: 'range'`, `repRange`, `reps` = the
  bottom of the range (the integer anchor older readers use), and
  `repRationale`. Mains keep their wave reps (10 or 8) as `repForm: 'fixed'`
  with `repRange: [6, 10]`.
- No +2 shifts on this path. Principle: similar hypertrophy across roughly
  6-20+ reps when sets are taken near failure, CONSENSUS (Schoenfeld et al.
  2017, 2021); which band suits which lift is practice, CONTESTED.

### R2. Effort (I2)
`rirRange` by kind and week of the block; `rpe` stays on the set as
`10 - rirRange[1]`.

| Week | compound | isolation |
|---|---|---|
| 1 | 2-3 | 1-2 |
| 2 | 2-3 | 1-2 |
| 3 | 1-2 | 1-2 |
| 4 | 1-2 | 0-1 |

Principle: proximity to failure, CONSENSUS for 0-3 RIR being effective
(Refalo et al. 2023); tightening across a block is practice, CONTESTED.

### R3. Named set schemes (I5)
`setScheme` on the resolved slot: `CALIBRATION`, `AMRAP_FINISH` (main lift,
week 4), `DELOAD`. Everything else is homogeneous.
Calibration reps by range: 6-10 -> 10, 8, 6; 8-12 -> 12, 10, 8;
10-15 -> 15, 12, 10; 12-20 -> 15, 15, 12. RIR 4, 3, 2 as today.

### R4. Weekly progression: one writer (I3, I4)
`Engine.coach.progress(prev, logged, spec, ctx)` is pure and is the only code
that changes an accessory's load or its performance-based set count from one
week to the next. It runs once per exercise in `advanceWeek()` and its result
is stored on the program (`program.plan[exId]`), so `resolveSlot` only reads.

- `prev`: `{ load, setAdj, miss }` or null. `logged`: last week's done sets
  for the exercise `[{ reps, rpe, calib }]`. `spec`: `{ range, rir, inc, e1,
  maxSetAdj }` where `rir` is the target the logged sets were prescribed at.
  `ctx`: `{ weekType }` of the week being entered.
- Returns `{ load, setAdj, miss, reasons }`.

| Case | Result | Codes |
|---|---|---|
| Nothing logged last week | Unchanged | none |
| Only calibration sets logged, or no load yet but an e1RM exists | Load priced from the e1RM for the middle of the range at the top of the RIR target | `CALIBRATED` |
| Every set at or above the top of the range, none harder than the RIR target | Load up by the largest whole number of steps that is at most 5% | `LOAD_UP` |
| Same, but one step is more than 5% and at most 10% | One step | `LOAD_UP_EARNED` |
| Same, but one step is more than 10% | Hold; the jump waits for the block transition | `HOLD`, `STEP_TOO_BIG` |
| Any set under the bottom of the range, or harder than the RIR target | Hold; second consecutive miss: load down one step | `HOLD`, then `LOAD_DOWN` |
| In range | No load change | none |
| Not a miss, no load rise, and every set easier than the RIR target by 1 or more | One more set, up to `maxSetAdj` | `ADD_SET` |

"Harder than the RIR target" means logged RIR (10 - rpe) below `rir[0]`.
"Easier by 1 or more" means logged RIR at or above `rir[1] + 1`.

Principles: progressive overload, CONSENSUS; the 5% cap and the 10% earned
step are the app's own judgment, no source found; adding a set after an easy
week (volume autoregulation), CONTESTED.

Closed enum `Engine.REASON_CODES` (key equals value): `CALIBRATED`, `LOAD_UP`,
`LOAD_UP_EARNED`, `LOAD_DOWN`, `HOLD`, `STEP_TOO_BIG`, `ADD_SET`,
`REMOVE_SET`, `RIR_TIGHTEN`, `RIR_EASE`, `PEAK_SET`, `DELOAD`,
`BLOCK_TRANSITION`, `MAX_UPDATED`.

Reasons shown on a resolved slot for the current week (`rs.reasons`) = the
decision codes plus the codes for what else changed against the week just
finished (`RIR_TIGHTEN`, `ADD_SET` / `REMOVE_SET` on a main's scheduled set
count, `LOAD_UP` on a main, `PEAK_SET`, `DELOAD`, `BLOCK_TRANSITION`),
computed once in `advanceWeek()` by comparing the outgoing and the incoming
week and stored on the program.

### R5. Not logged
An exercise with logs keeps last week's plan (hold). An exercise never logged
and with no entered max stays on the calibration scheme. Nothing is removed
for being skipped (the existing block-end rule for optional time-capped
accessories is unchanged).

### R6. Base sets and volume (I6), single owner
On this path an accessory's set count = allocator base + `plan.setAdj`, then
the deload rule, then the athlete's own add/remove (`slot.setAdj`). The table
ramp (`JBB_HYP.accSets`), `weekMod.accSetDelta`, the focus set scaling and
the `volAdj` autoreg do NOT apply here (`updateAutoreg` skips this path). A
slider at 0 still removes the exercise; a slider at 1 gets 2 sets per
exercise and is outside I6.

Allocator: start every accessory at 3 sets; credit sets to the seven groups
exactly as `weeklyVolumeByMuscle` does (mains and secondaries included, by
`SYNERGIST_COVERAGE`, rolled up through `MOVEMENT_SLIDER`); while a group at
slider 2 or 3 is under `10 x min(1, days / 4)`, add one set to that group's
accessory with the fewest sets, cap 6 per exercise; never push a group past
20. The calibration week keeps its 3 feeler sets.

Main lift set counts and the week 4 AMRAP stay as they are (the mains
re-anchor is an open owner decision noted in `prescription-sanity.test.js`).
Main lift load: a week's load may not exceed last week's by more than 5%
rounded down to whole steps; if that is zero the load holds.

### R7. Maxes on the fly
A saved 1RM / 10RM (existing `saveExMaxes`, `saveCustomEx`) clears that
exercise's plan, so the next resolve prices the range from the entered max
with no calibration week, code `MAX_UPDATED`. Works before week 1 and
mid-block.

### R8. Deload and block transition
- Deload week: `setScheme: 'DELOAD'`, same range, load = last working load
  x 0.9 rounded down to a step, sets = half rounded up (minimum 2), RIR 4-5.
  Principle: reduce volume, keep the movement; whether deloads help
  hypertrophy is CONTESTED (Coleman et al. 2024); the 0.9 is the app's own
  number, no source found.
- Block transition: plans are cleared, exercises rotate as today, the range
  comes from R1 again, sets restart from the allocator, code
  `BLOCK_TRANSITION`.

### R9. Labels (Q5)
Range sets render as load x "lo-hi" with the RIR range, e.g. "45 kg x 8-12"
and "3 x 8-12 · 1-2 RIR", in `setTargetLabel`, `previewSetLabel` and the two
scheme lines, English and Spanish. No em dashes.

## Implementation notes (where the build went beyond R1-R9)

Found while reviewing the build and sweeping every days x experience
combination. Each is a judgment call by the lead and open to change.

1. **One allocation per block.** The first build re-ran the allocator every
   week, so accessories lost sets in week 3 as the main lifts gained theirs
   (lateral raise 5 to 3 on 5 and 6 day plans, an I3 failure). The allocation
   is now taken once per block at the first work week, and `plan.setAdj` is
   added on top. Weekly volume therefore rises slightly through the block with
   the scheduled sets of the main lifts (measured, 4 days: chest 10, 11, 11).
2. **Main lift top-up.** On a 7 day plan the chest is trained only through two
   bench exposures (8 sets in week 2) and has no accessory to absorb the
   floor. A main or secondary lift may take one extra set
   (`BB_MAIN_MAX_EXTRA`) when its group has no accessory left. This is the
   one place main lift set counts change.
3. **Main and secondary deload.** R8 only described accessories. Mains follow
   the same rule on this path: week 4 load x 0.9, half the sets (minimum 2),
   RIR 4-5, replacing the 40/50/60% x 5 ramp. The autoregulated deload depth
   layers do not apply here.
4. **Rep-PR top set.** A swapped lead (dumbbell or machine) ends week 4 on a
   rep-PR set. It calibrates nothing, so it targets RIR 1 under its own scheme
   `REP_PR_FINISH`. The barbell AMRAP stays all-out under `AMRAP_FINISH`.
5. **Secondaries** get the same 5% load ramp as mains.
6. **Plans for exercises with history.** An exercise with an entered max, or
   logged in an earlier block, is priced from that (no second calibration).
   The price uses seed records, or records older than the current block, so it
   does not drift while the block is being logged.
7. **Slider at 1 (Light)** is a flat 2 sets per exercise and ignores
   `plan.setAdj`.
8. **Version.** `APP_VERSION` and the service worker cache went to 1.24.0,
   following the repo rule that any shell change bumps both.

Known and left alone: with a very light main lift (the simulated athlete
squats 27.5 kg) one 2.5 kg step is 9%, so the 5% rule holds that lift at the
same load for the whole block. That is the Q3 ruling working as written; at
loads above 50 kg the weekly step fits.

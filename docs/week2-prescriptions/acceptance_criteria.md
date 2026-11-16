# Acceptance criteria per track and goal (Phase 3)

Status after the owner ruling of 2026-11-16: **all three bodybuilding goals
(sections A, B, C) are implemented and passing. The strength tracks (sections
D, E, F) are NOT changed, by decision: their math stays exactly as it is. The
only requirement on them is that no accessory gains a rep from one week to the
next, which already holds and is now guarded by test AC-ST-1.** Sections D, E
and F are kept below as a record of what was proposed and declined.

Legacy note: a bodybuilding program with no goal at all (a save from before
goals existed, or an imported template) stays on the old engine. Onboarding
has required a goal since goals were added, so no new program can be in that
state.

Test files are in `app/test/`. The tests for sections B and C are in
`acceptance-matrix.test.js`; they were written first and failed (14 of 14)
before the code changed.

Labels: CONSENSUS, CONTESTED, or "no source found".

## 3.1 Survey: the hypertrophy invariants on every combination

The app offers three tracks (`OB_TRACKS`, `app.js`): bodybuilding with three
goals (`GOAL_ARCHETYPES`, `data.js:334-354`), powerbuilding and powerlifting,
the last two with or without a meet date. Seven combinations.

Each row: the full program, 3, 4 and 5 days, intermediate, both athlete
styles, with and without entered 1RMs (12 runs), checked with I1 to I6 exactly
as written for the hypertrophy case. Counts are violations summed over the
runs.

| Combination | Weeks | I1 | I2 | I3 | I4 | I5 | I6 | Example offending prescription |
|---|---|---|---|---|---|---|---|---|
| bodybuilding / recomp | 20 | 0 | 0 | 0 | 0 | 0 | 0 | none (see the note below) |
| bodybuilding / serious-macro | 25 | 63056 | 6846 | 1913 | 3458 | 574 | 124 | week 1 `ez-curl` 13 reps; week 2 rep category "fixed:15 -> range:10-15"; block 2 week 3 arms 22 sets |
| bodybuilding / lean-asap | 10 | 22480 | 3082 | 721 | 1416 | 238 | 80 | same as serious-macro |
| powerbuilding, no meet | 25 | 37938 | 3096 | 1016 | 2814 | 404 | 808 | week 1 `military-press` 4 reps; week 2 arms 5.5 sets; squat 27.5 -> 30 kg (+9.1%) with no reason |
| powerlifting, no meet | 25 | 35948 | 3600 | 755 | 2648 | 492 | 820 | week 1 `comp-squat` 8, 6, 4 reps at RIR 4, 3, 2 with no declared scheme |
| powerbuilding, meet in 12 weeks | 11 | 14470 | 1268 | 285 | 999 | 316 | 396 | as powerbuilding, plus the taper's singles |
| powerlifting, meet in 12 weeks | 11 | 14492 | 1268 | 267 | 998 | 316 | 396 | as powerlifting, plus the taper's singles |

How to read the numbers:

- I1 is large everywhere off recomp because no set carries a form, a
  rationale or a whitelisted range. That is a missing data model, not tens of
  thousands of separate bugs.
- The two other bodybuilding goals show the original bug unchanged (11s, 13s,
  the rep reshuffle), as expected: the goal never influenced prescriptions
  (`diagnosis.md`, hypothesis c).
- The strength tracks fail for a different reason. Their strength blocks are
  built on 5s, 3s, ramp sets and percentages of a working max. The hypertrophy
  whitelist does not fit them, so they need their own (section 3.2).

**Note on recomp.** This survey found a defect in the Phase 2 fix: on 5 and 6
day plans, block 2 week 4, arms reached 20.5 weekly sets against the ceiling
of 20 (pressing credits the arms and the main lifts add sets late in a
block). The Phase 2 tests stopped at 8 weeks and missed it. Fixed in this
phase (the ceiling is now checked against the block's heaviest week, and a
trim never pushes another group under its floor), and covered by the new
`bb-recomp-full-program.test.js`. After the fix: 84 full-program runs (1 to 7
days, 3 experience levels, both styles, with and without 1RMs), 84 clean.

## 3.2 and 3.3 Criteria per combination

---

### A. Bodybuilding / recomp ("Look good, stay healthy"): IMPLEMENTED

Rules: `phase2-rules.md` R1 to R9.

| # | Criterion (testable assertion) | Principle | Label | Test |
|---|---|---|---|---|
| AC-RC-1 | Every working set is range form with a range from {6-10, 8-12} for compounds or {10-15, 12-20} for isolations, or fixed form with reps in {6, 8, 10, 12, 15} inside that range, and stores a rationale | Similar hypertrophy across about 6 to 20+ reps when sets are near failure | CONSENSUS (Schoenfeld et al. 2017, 2021) | `bb-recomp-regression`: "user case (...): I1"; "sweep: ... I1-I6 on every week" |
| AC-RC-2 | Every working set carries an RIR target: compound 1-3, isolation 0-2; sets in CALIBRATION or DELOAD and the AMRAP set of AMRAP_FINISH are exempt | Proximity to failure | CONSENSUS for 0-3 RIR (Refalo et al. 2023) | "user case (...): I2" |
| AC-RC-3 | Inside a block the rep range never changes; a load rise is at most 5% rounded down to whole steps, or one step of at most 10% carrying LOAD_UP_EARNED; plain sets change by at most one a week | Progressive overload | CONSENSUS; the 5% and 10% numbers: no source found | "user case (...): I3"; "loads that progress (...)" |
| AC-RC-4 | Every week-over-week change carries a code from `Engine.REASON_CODES` | Explainability (product rule) | no source needed | "user case (...): I4"; `bb-progress-rules`: "every code progress() can return is a member of REASON_CODES" |
| AC-RC-5 | All sets of an exercise share reps and RIR unless the slot declares a named scheme | Product rule | no source needed | "user case (...): I5" |
| AC-RC-6 | On work weeks each group at slider 2 or 3 gets 10 x min(1, days / 4) to 20 weekly sets | Weekly sets per muscle | CONSENSUS for about 10+ (Schoenfeld, Ogborn, Krieger 2017); ceiling 20 CONTESTED | "user case (...): I6"; `bb-recomp-full-program`: "full program (...)" |
| AC-RC-7 | Each row of the progression table returns its documented load, set change and codes | See R4 | mixed, see `phase2-rules.md` | `bb-progress-rules` (22 tests, one or more per row) |
| AC-RC-8 | No second layer changes an accessory's sets, load, reps or RIR | Single owner (product rule) | no source needed | `bb-single-writer` (11 tests) |
| AC-RC-9 | An entered 1RM / 10RM prices the exercise at once, with no calibration week | Athlete-supplied estimate replaces the feeler sets | no source found | "R7 (a) ..."; "R7 (b) ..." |
| AC-RC-10 | The deload is the last working load x 0.9, half the sets (minimum 2), RIR 4-5; a new block restarts from the R1 range | Reduce volume, keep the movement | CONTESTED (Coleman et al. 2024); 0.9: no source found | "R8 deload week: ..."; "R8 block transition: ..." |
| AC-RC-11 | Other goals and tracks get none of the new fields | Scope (your rule 4) | no source needed | "scope guard: ..." (2 tests) |

All passing. Suite after sections B and C: 717 pass, 0 fail.

---

### B. Bodybuilding / serious-macro: IMPLEMENTED

Blocks: five hypertrophy blocks, phases lean-gain, lean-gain, minicut, gain,
gain (`data.js:337`). Today: the old engine, original bug present.

Proposal: the same rules as recomp, with the phase of the block deciding how
readily volume grows.

- Rep ranges: the recomp whitelist, unchanged.
- RIR: the recomp table, unchanged.
- Progression: `Engine.coach.progress` unchanged, except `maxSetAdj` is 3 in
  gain and lean-gain blocks and 0 in cut and minicut blocks.

| # | Criterion | Principle | Label | Test (`acceptance-matrix`, passing) |
|---|---|---|---|---|
| AC-SM-1 to 6 | I1 to I6 exactly as AC-RC-1 to 6 | as recomp | as recomp | "AC-SM-1 ..." to "AC-SM-6 ..." |
| AC-SM-7 | `progress()` may add up to 3 sets per exercise in gain blocks and never returns ADD_SET in a cut or minicut block | More volume gives more growth up to a point when recovery allows; in a deficit recovery is lower so volume is held | Dose-response: CONSENSUS on direction, CONTESTED on amount. Holding volume in a deficit: CONTESTED (Helms et al. 2014 review) | "AC-SM-7 ..." |

Built as `BB_GOAL_PROFILE` (`data.js`) read through `bbGoalProfile(block)`
(`app.js`). 84 full-program runs (1 to 7 days, 3 experience levels, both
styles, with and without 1RMs): 84 clean.

---

### C. Bodybuilding / lean-asap: IMPLEMENTED

Blocks: minicut, cut, maintenance cycle, 12 weeks (`data.js:347-353`). An
aggressive deficit.

Proposal: keep the load on the bar, hold volume, stay one rep further from
failure.

- Rep ranges: the recomp whitelist.
- RIR: never 0 while the block is cut or minicut (isolation week 4 becomes
  1-2). Compounds as recomp.
- Progression: load rules as recomp; no ADD_SET in deficit blocks.
- Volume: floor 10 x min(1, days / 4), ceiling 16.

| # | Criterion | Principle | Label | Test (passing) |
|---|---|---|---|---|
| AC-LA-1, 3, 4, 5 | I1, I3, I4, I5 as recomp | as recomp | as recomp | "AC-LA-1 ...", "AC-LA-3 ...", "AC-LA-4 ...", "AC-LA-5 ..." |
| AC-LA-2 | No working set targets RIR 0 in a cut or minicut block | Keep intensity (load) to retain muscle in a deficit; recovery is reduced | Keeping load: CONSENSUS in practice (Helms et al. 2014). Avoiding RIR 0 specifically: no source found | "AC-LA-2 ..." |
| AC-LA-6 | Weekly sets per group between the floor and 16 on work weeks | Volume near the low end of the productive range is enough to retain | CONTESTED; 16: no source found | "AC-LA-6 ..." |
| AC-LA-7 | `progress()` never returns ADD_SET in a deficit block | as AC-SM-7 | CONTESTED | "AC-LA-7 ..." |

Same mechanism as B. The AMRAP set of a main lift stays all-out in a deficit
(the declared `AMRAP_FINISH` exception). 84 full-program runs: 84 clean.

---

### Strength tracks: what is asserted

| # | Criterion | Test (passing) |
|---|---|---|
| AC-ST-1 | Inside a block, an accessory's rep target never changes from one week to the next, on powerbuilding and powerlifting, with and without a meet | `acceptance-matrix`: "AC-ST-1 ... no accessory rep target changes week to week inside a block" (4 tests) |
| (existing) | Every prescribed number on the default track is unchanged | `golden-master.test.js` |

Why it already held: the "+1 rep" step (`Engine.doubleProgression`) only ever
ran when `resolveSlot` passed a rep range, and it passed one only on the
bodybuilding track (`app.js`, the `bbTrack()` check). Strength-track
accessories use a flat rep target (12 in hypertrophy blocks, 8 in strength
blocks).

### D. Powerbuilding, no meet: PROPOSED, DECLINED

Blocks: three hypertrophy blocks (`jbb-hyp` 10s, 8s, 8s) then two strength
blocks (`jm2-wave` 5s, 3s) (`data.js:731-737`). This is the default track and
the one the golden master snapshots.

The hypertrophy whitelist fits the hypertrophy blocks. It does not fit the
strength blocks, which need their own.

**Hypertrophy blocks.** Accessories get the recomp rules (ranges, RIR,
`progress`, named schemes). Main lifts stay on the wave percentages.

**Strength blocks: proposed whitelist.**

| Element | Proposed rule |
|---|---|
| Main lift working sets | Fixed reps 5 (5s wave) or 3 (3s wave), `repForm: 'fixed'`, range 3-5 |
| Main lift ramp sets | 1 to 5 reps under a named scheme `RAMP_TO_TOP` (already flagged `ramp`, not working sets) |
| Main lift effort | RIR 1 to 3 on working sets (the wave's RPE 7 to 9, `engine.js:158-172`); the AMRAP exempt under `AMRAP_FINISH` |
| Main lift load | Exactly the wave table share of the working max, rounded to the step. NOT the 5% rule: the wave steps from 70% to 77.5% by design |
| Working max | Changes only after an AMRAP, by at most 10 increments (`amrapAdjust`, `engine.js:229-236`) |
| Accessories | Compound 6-10, isolation 10-15, range form, RIR as recomp, `progress` as recomp |
| Volume | No floor in strength blocks; ceiling 20 per group. Hypertrophy blocks: floor 8 x min(1, days / 4) |
| New reason codes | `WAVE_STEP` (scheduled percentage change), `WM_UP`, `WM_RESET` |

| # | Criterion | Principle | Label | Test (todo) |
|---|---|---|---|---|
| AC-PB-1 | Hypertrophy blocks: accessories meet AC-RC-1 | as recomp | CONSENSUS | "AC-PB-1 ..." |
| AC-PB-2 | Strength blocks: main working sets are fixed 5s or 3s; accessories 6-10 or 10-15 | Heavy loads (about 1 to 5 reps) are superior for maximal strength | CONSENSUS (Schoenfeld et al. 2017, 2021) | "AC-PB-2 ..." |
| AC-PB-3 | Working sets RIR 1 to 3 (isolation 0 to 2); named schemes exempt | Strength work does not need failure; most sets submaximal | CONSENSUS on not needing failure (Davies et al. 2016); the exact band CONTESTED | "AC-PB-3 ..." |
| AC-PB-4 | Strength blocks: main load = round(working max x wave percentage) for every set | Percentage-based periodization | CONTESTED (one of several valid models); the percentages are the source program's | "AC-PB-4 ..." |
| AC-PB-5 | The working max moves only after an AMRAP, by min(reps over standard, 10) x increment | Autoregulated progression from a rep-max test | CONTESTED (Mann et al. 2010, APRE); the cap of 10: no source found | "AC-PB-5 ..." |
| AC-PB-6 | Accessory load rises at most 5% a week (AC-RC-3) | Progressive overload | as recomp | "AC-PB-6 ..." |
| AC-PB-7 | Every change carries a reason code, including `WAVE_STEP` and `WM_UP` | Explainability | no source needed | "AC-PB-7 ..." |
| AC-PB-8 | Ramp-to-top-set, AMRAP, calibration and deload are named schemes; everything else homogeneous | Product rule | no source needed | "AC-PB-8 ..." |
| AC-PB-9 | Hypertrophy blocks: 8 to 20 weekly sets per group on work weeks; strength blocks: at most 20 | Volume is secondary to intensity for strength; a lower floor leaves room for the main lifts | CONTESTED; 8: no source found | "AC-PB-9 ..." |

Cost: **large, and it moves the golden master.** Powerbuilding is the default
path, so any change to its accessories changes the snapshot that
`golden-master.test.js` protects. Doing this means regenerating it on purpose
and reviewing the diff. The main lift criteria (AC-PB-2, 4, 5, 8) can be met
by adding fields only, with no change to any prescribed number.

---

### E. Powerlifting, no meet: PROPOSED, DECLINED

Blocks: one hypertrophy base block (`jbb-hyp` 8s) then four strength blocks
(5s, 5s, 3s, 3s) (`data.js:762-768`).

Proposal: identical to D for both block types, with one difference in volume.

| # | Criterion | Principle | Label | Test (todo) |
|---|---|---|---|---|
| AC-PL-1 to 8 | As AC-PB-1 to 8 | as D | as D | "AC-PL-1 ..." to "AC-PL-8 ..." |
| AC-PL-9 | At most 20 weekly sets per group; no floor; each competition lift trained at least once a week | Specificity: strength is skill on the tested lifts | Specificity: CONSENSUS. Once a week as a minimum: CONTESTED | "AC-PL-9 ..." |

Cost: as D. The accessory change is smaller (one hypertrophy block).

---

### F. Meet variants (powerbuilding or powerlifting with a meet date): PROPOSED, DECLINED

Same as D or E up to the meet, then a 2-week taper block (`jm2-peak`,
`engine.js:1241-1264`): week 1 builds to an opener single, meet week is a
light primer, no accessories.

Proposed taper whitelist: sets of 1, 2 or 3 reps under a named scheme `TAPER`,
percentage-based, exempt from the RIR rule and from the volume floor.

| # | Criterion | Principle | Label | Test (todo) |
|---|---|---|---|---|
| AC-MT-1 | Taper sets are singles, doubles or triples under `TAPER`; no accessories | Taper: cut volume, keep intensity | CONSENSUS (Pritchard et al. 2015; Travis et al. 2020) | "AC-MT-1 ..." |
| AC-MT-2 | The heaviest taper set is the opener at 91% of the implied max, never more | Opener selection | Coaching practice; no source found for 91% | "AC-MT-2 ..." |
| AC-MT-3 | Weekly sets fall by at least 30% against the last strength work week | Volume reduction of roughly 30 to 70% in a taper | CONSENSUS on direction; the size CONTESTED | "AC-MT-3 ..." |
| AC-MT-4 | The plan ends on the meet date; the blocks before it meet AC-PB or AC-PL | Planning backward from the date | no source needed | "AC-MT-4 ..." |
| AC-MT-5 | Entering the taper carries the reason code `TAPER` | Explainability | no source needed | "AC-MT-5 ..." |

Cost: small for the taper itself (fields only, no number changes).

---

## Recommended order, if you approve

1. **B and C (the other two bodybuilding goals).** Cheapest, and it removes
   the original bug for every bodybuilding athlete. No golden master change.
2. **Strength-side metadata (AC-PB-2, 4, 5, 7, 8; AC-PL equivalents; F).**
   Fields, schemes and reason codes only. No prescribed number changes, so the
   golden master's numbers hold; whether the snapshot file itself changes
   depends on whether new fields are serialized into it (NOT VERIFIED).
3. **Accessories on the strength tracks (AC-PB-1, 6, 9; AC-PL-1, 6, 9).**
   The only step that changes what a default-track athlete is prescribed. It
   needs a deliberate golden master regeneration.

## Open questions for you

1. Approve B and C as written, or do you want the other bodybuilding goals to
   differ more from recomp than the phase modifiers above?
2. Strength blocks: is "main load is exactly the wave table" the right
   criterion, accepting that it steps more than 5% between weeks by design?
3. Powerbuilding volume floor of 8 per group in hypertrophy blocks: this is my
   number with no source. Keep, change, or drop the floor on strength tracks?
4. Step 3 changes the default track for every existing user. Do you want it at
   all, or should the strength tracks keep their current accessories?

Resolved 2026-11-16: question 1 approved as written; questions 2 to 4 closed
by the decision to leave the strength tracks alone. The AC-PB, AC-PL and AC-MT
test names in sections D to F were never given bodies and were removed from
`acceptance-matrix.test.js`.

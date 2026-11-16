# Plan: atypical week 2+ prescriptions (bodybuilding, "Look good, stay healthy")

Status: **Phase 1 approved 2026-11-16; rulings and the final Phase 2 rules are
in `phase2-rules.md`. Phase 2 done (692 green at hand-off). Phase 3 delivered
2026-11-16 in `acceptance_criteria.md`. Owner ruling the same day: extend to
the other two bodybuilding goals (done, 717 green), leave the strength tracks
untouched.** During Phase 1 nothing in `app/data.js`,
`app/engine.js` or `app/app.js` has been changed. Branch (local, nothing
committed or pushed): `fix/bb-week2-prescriptions`.

Scope: track `bodybuilding`, goal archetype `recomp` (label "Look good, stay
healthy", `app/i18n/en.js:325`). Every other track and goal stays untouched
until Phase 3 is approved.

## Phases

| Phase | What | State |
|---|---|---|
| 1 | Map the pipeline, write a failing reproduction test, trace the bad values, rule hypotheses in or out, document current behavior, deliver `diagnosis.md` | Done, awaiting approval |
| 2 | Implement only what is approved in `diagnosis.md` section (e); make the reproduction test pass without editing its assertions; add regression tests; verification table | Not started |
| 3 | Run the invariant suite on every track x goal; propose per-combination criteria; deliver `acceptance_criteria.md` | Not started |

## Files involved

Read in Phase 1 (no changes):

- `app/data.js`: `GOAL_ARCHETYPES` (334-354), `EXERCISES` (446-452), `WAVES`
  (686-711), `PROGRAM_TEMPLATES.bodybuilding` (743-755), `JBB_HYP` (813-833),
  `REP_RANGES` (841-848), `SLIDER_MOVEMENTS` (1401-1409), `VOLUME_LANDMARKS`
  (1436-1461), `SYNERGIST_COVERAGE` (1472-1479).
- `app/engine.js`: `anchorE1RM` (69-77), `weekType` (80-82),
  `calibrationRamp` (126-138), `repRangeFor` (480-483), `mesoRepRange`
  (486-488), `impliedRpe` (494-497), `doubleProgression` (505-514),
  `Engine.coach` (572-977), scheme `jbb-hyp` (1092-1221),
  `Engine.autoregVolume` (1349-1385), `Engine.deloadDepth` (1419-1433).
- `app/app.js`: `makeProgram` (564-679), `generateBodybuildingDays`
  (937-1131), `focusForAccessory` (1465-1483), `resolveSlot` (1497-1596),
  `applySlotSetAdj` (1604-1619), deload helpers (1628-1654),
  `autoregForAccessory` (1797-1814), `resolveDayEntries` (1919-1994),
  `computeWeekMod` (2233-2262), `weeklyVolumeByMuscle` (3609-3631),
  `muscleSignal` (3733-3755), `updateAutoreg` (3950-3966), `advanceWeek`
  (4003-4025), `endBlock` (4033-4118), `carryoverOptionalDrops` (4206-4227),
  `sessionEntryFrom` (4950-4970), `setTargetLabel` (5017-5036), `donePerf`
  (5948-6057), `previewSetLabel` (6252-6254).

Added in Phase 1:

- `app/test/bb-recomp-invariants.test.js`: the reproduction test (fails on
  purpose: 6 of 6 invariants red).
- `docs/week2-prescriptions/plan.md`, `decisions.md`, `diagnosis.md`.

Likely touched in Phase 2 (only after approval; see `diagnosis.md` (e)):
`app/data.js`, `app/engine.js`, `app/app.js`, `app/i18n/en.js`,
`app/i18n/es.js`, `app/test/load-app.js`, new test files, `app/CHANGELOG.md`.

## Side effect to know about

The reproduction test lives in `app/test/`, so `npm test` is now red locally
(621 tests, 615 pass, 6 fail; the 6 are the new invariants). CI runs the same
suite and `main` is protected, so this branch must not be pushed for merge
until Phase 2 turns it green.

## How the work is split across models

- Phase 1 (this phase) was done directly by the lead model: the diagnosis
  needs one continuous read of the pipeline and there was nothing to build.
- Phase 2 plan: Opus agent writes the decision-table unit tests and reviews
  the diff; Sonnet agent implements the approved changes; Haiku agent runs
  the suites and fills the verification table. The lead reviews every result
  before it is reported.

## Open questions (yours to decide; details in `decisions.md`)

Blocking for Phase 2:

1. **I6 cannot hold for this profile as written.** Weeks 1-4 give 6 to 9 sets
   for most groups (see `diagnosis.md`), and reaching 10 for all seven groups
   means retuning the split generator and `JBB_HYP.accSets`, not the rep
   logic. Decide: keep 10 to 20 for every week and every group, or narrow it
   (Q1 in `decisions.md`).
2. **The 1.5 proposed column contradicts I3 in two places** (sets and load
   size). Decide which wins (Q2).
3. **I3 "2.5% to 5%, rounded down"** gives a zero increase for any lift under
   50 kg on a 2.5 kg step. The test allows one step as the floor. Confirm (Q3).
4. **I2 on calibration sets, the week 4 AMRAP and deloads** (Q4).
5. **"UI out of scope" versus showing a range.** One label function has to
   change or the athlete still sees a single integer (Q5).
6. **Goal gating.** The goal has no effect on prescriptions today, so the bug
   is identical for all three bodybuilding goals. Phase 2 will gate on
   `recomp` behind one predicate, as your rule 4 requires (Q6).
7. **"Default profile".** Onboarding has no default for days per week or
   experience (`app.js:2352-2371`). The test uses 4 days, intermediate, no
   1RMs entered, all sliders at 2. Confirm or give me your real profile (Q7).
8. **Is a calibration set a "working set" for I1?** Today week 1 already
   shows 11, 13, 17 and 22 rep feeler sets (Q8).

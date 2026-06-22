# Pending / future work (next branches)

Current as of the end of the `Onboarding-improvements` branch. None of these
block what shipped; they are enhancements, tuning, and known rough edges. Group
them into focused branches rather than one large one (see the retrospective).

## Larger features (each its own branch)

- **Sport-aware scheduling** (the long-deferred epic): a sport -> muscle-fatigue
  dataset, "pick which weekdays you train" instead of a day count, calendar
  placement so high-fatigue sessions avoid game day, and named/dated days.
- **e1RM-driven hypertrophy anchors.** Today a bodybuilding day's working-max
  anchor stays a barbell compound (bench/squat/press) because the wave/AMRAP
  weights are percentages of that lift's max. To let a day default to a DB or
  machine compound *with correct weights*, anchors would need an e1RM-based
  prescription path instead of barbell percentages. Would make the bodybuilding
  default fully non-barbell, barbell as a swap.
- **Full cross-muscle zero-sum weekly volume budget.** The split generator now
  handles frequency, and de-emphasis scales sets, but total weekly sets are not
  strictly conserved/redistributed across muscles. Bounded today by per-muscle
  landmark clamps.
- **Carryover graduation.** The block-end carryover drops an optional accessory
  never trained; the inverse (an optional consistently completed gets promoted
  into core / nudged up) is not built.

## Split-generator tuning

- **Balanced multi-day over-allocates lower.** On a balanced 6-day the point
  ratio rounds to 3 upper / 3 lower, and since Legs is the only lower muscle that
  can anchor a day, you get 3 leg-led days. Options: weight region days by muscle
  count as well as points, or add a secondary lower anchor.
- **Lower region themes only around Legs.** Glutes and calves never lead a day
  (no compound lead). Consider a glute-led day (hip thrust) when glutes is high.
- **Same-muscle day spacing.** When a muscle leads two days, they can land close
  together; add a spacing pass so repeated focus days are separated for recovery.

## Polish / smaller

- **Per-day time caps** (one global cap vs a longer cap for a naturally longer
  day such as legs).
- **Budget-aware swap/select list:** the Add button shows remaining time and
  per-add cost; the per-candidate cost is not yet shown inside the swap list.
- **Check-in references removed muscles:** `checkinGroupsForDay` reads slots
  structurally, so a muscle set to 0 could still surface a check-in slider.
- **Onboarding still asks for a deadlift 1RM on the bodybuilding track**, even
  though the bodybuilding generator never uses the deadlift; could skip it.
- **Onboarding time estimate is bodybuilding-only** (it lives on the slider
  step); powerbuilding/powerlifting athletes with a time cap get no onboarding
  estimate. Could add one on the time step for all tracks.

## Tuning (safe to revisit anytime)

- Landmark evolution step/cadence, experience seed factors (0.65 / 0.85 / 1.0),
  and the classic-vs-RP-App landmark dataset.
- The `SPLIT_FREQ` map (3->2x, 4->2x, 5-6->3x) and `TIME_MODEL` constants.

## Process

- Real-browser QA pass (the engine is harness-verified; UI verified via
  screenshots).
- After merge, delete the branch and start the next item on its own branch.

## Testing & CI

The whole engine has only ever been verified by **throwaway** JSDOM harnesses
written ad hoc during development. The highest-leverage infrastructure work is to
make that automatic. Recommended, roughly in priority order.

### Set up CI (one small `chore/` branch)
- A **GitHub Actions** workflow (`.github/workflows/ci.yml`) that runs on every
  push and pull request. Keep it fast (well under a minute) so it is not friction.
- It needs no build step: IRONWAVE is plain Node + vanilla JS. The runner just
  does `cd app && npm ci` (or `npm install`) and runs the checks below.
- Turn on **branch protection** for `main` so a red check blocks merge. That is
  what makes CI worth having: you cannot accidentally merge a regression.

### Automated tests worth writing (promote the harnesses into a real suite)
Use Node's built-in test runner (`node:test`) plus `jsdom` so there is still no
build step. Commit them under `app/test/` and wire an `npm test` script.

1. **C1 golden-master (highest value).** Snapshot the resolved routine for the
   default Powerbuilding program (every block/week/day/slot's `resolveSlot`
   output) and assert it never changes. This is the automated version of the
   "default users stay byte-identical" contract that every change in this branch
   was hand-checked against.
2. **Engine unit tests** (pure, deterministic, cheap): `Engine.e1rm`,
   `weightFor`, `amrapAdjust` (including the +10-rep cap and the below-standard
   hold), `plateMath`, `warmupSets`, `readinessScore`, `seedLandmarks`, and the
   per-week ramps of `prescribeMain` / `jbb-hyp` for both a calibrated and an
   uncalibrated lift.
3. **Scheme isolation:** assert `jm2-wave` and `jbb-hyp` never blend, and that
   `schemeFor` routes only by `block.scheme`.
4. **Migration tests:** a legacy `database.json` (pre-tracks, pre-landmarks)
   loads via `migrateState` and is backfilled, and `migrateState` is idempotent.
5. **Focus / generator behavior:** slider 0 removes, 1-2 de-emphasize, the split
   generator's region allocation and frequency, core/optional tiers, and the
   carryover drop/keep. (These already exist as harnesses; commit them.)
6. **Boot / render smoke:** load the three scripts in jsdom and render every view
   for a default and a bodybuilding program without throwing.
7. **Persistence round-trip:** start `server.js`, `POST` then `GET /api/state`,
   assert it round-trips and that `database.json` is created.

### Project-specific lint checks (great CI fit)
- **No em dashes in athlete-facing strings.** This is a hard style rule in
  `CONTRIBUTING.md` and is currently enforced only by reviewer memory. A tiny
  script that greps the user-visible string literals for `—` (em dash) and
  fails CI would enforce it for free. (Code comments are exempt, so scope it to
  template strings / labels, not `//` lines.)
- **Line endings / indentation:** a check that `.bat` files stay CRLF and
  everything else is LF + two-space indent, matching `.gitattributes` /
  `.editorconfig`.
- A lightweight **ESLint** pass (no framework, just `no-undef`, `no-unused-vars`,
  basic correctness) catches the class of bug that only shows up at runtime in a
  no-build vanilla-JS project.

### Practices
- **Fast and deterministic.** No network in tests; stub `fetch` as the harnesses
  do. Seed any time-dependent logic.
- **Test the pure engine heavily, the UI lightly.** The math in `engine.js` is
  where correctness matters and is trivial to unit-test; the DOM only needs smoke
  coverage.
- **A red check should be rare and meaningful.** If CI flaps, people learn to
  ignore it. Keep it tight.
- Optionally add a **local pre-commit hook** that runs `node --check` + `npm
  test`, but CI on the PR is the real gate.


## Resolved on this branch (no longer pending)

- Strength-philosophy leak in bodybuilding (Good-Mornings lead, deadlift day) ->
  dedicated templates + frequency generator.
- Sliders not affecting the split shape -> frequency-driven generator.
- Silent time trimming -> Core/Optional tiers.
- Empty days, select-slot leftovers, the chest/shoulder pressing-accessory bug,
  generous time estimates, and the Day-title vs theme display.

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
  landmark clamps. (Now folded into **Epic 4 / Cluster D** below as the
  specialization-with-maintenance mechanism.)
- **Carryover graduation.** The block-end carryover drops an optional accessory
  never trained; the inverse (an optional consistently completed gets promoted
  into core / nudged up) is not built. (Pairs with **Epic 4 / Cluster D** under
  one volume-management roof.)
- **Calibration redesign (RIR-first, reduced-fatigue ramp).** From athlete
  feedback: prescribe the calibration ramp in RIR rather than RPE (RIR reads
  easier for novices) and lower its fatigue cost with a descending rep scheme
  (e.g. 12/10/8 at RIR 4/3/2) instead of today's flat-ish 14/12/12 at RPE 5/7/8.
  Beginners' meso 1 should also read in RIR. **High-impact / golden-master-
  affecting and NOT bodybuilding-only:** calibration is prescribed on the shared
  `prescribeMain` path (`engine.js:76-80`) plus the `jbb-hyp`/accessory ramp
  (`engine.js:147-149`), and the *uncalibrated* Powerbuilding golden master IS the
  calibration ramp, so this deliberately regenerates the snapshot and changes
  every track. RPE and RIR are interconvertible in the math (`rir = 10 - rpe`), so
  the RIR switch is presentation; the rep scheme and the light-set intensity
  (RPE 5 -> RIR 4 / RPE 6) are the real prescription change. Its own branch after
  Cluster A, with owner sign-off on the exact rep/RIR targets and experience
  gating, plus new prescription unit tests and a reviewed golden-master regen.
  Cluster A should land RIR as the primary logged scale first so this builds on
  existing RIR plumbing.

## Hardcore hypertrophy roadmap (epics, clusters, dependencies)

From a domain review: what a professional hypertrophy athlete (think a Mike
Israetel type) would find lacking, training methods only. The app already has a
legitimate RP-flavored core (ascending-volume `jbb-hyp`, per-muscle MV/MEV/MRV
landmarks that evolve via `recalibrateLandmarks`, readiness + soreness check-ins,
a coarse end-of-week autoregulator). These epics deepen that core rather than
start from scratch.

**Owner sequencing decision:** scale slowly in the order **Epic 2 -> Epic 3 ->
Epic 4**, with Cluster A (logging) underpinning everything, the nutrition/phase
layer (Cluster F) growing alongside Epic 4, and **Epic 1 as the gated capstone**.

### Guiding constraint: inspired, not cloned (IP / differentiation)

We do NOT want a 1:1 clone of the RP Hypertrophy app or the Juggernaut app. At
some point we deliberately make things simpler or different. The legal posture
and the product moat are the same move.

- **No trademarked names** in UI, code, or marketing (Renaissance Periodization,
  "RP", Juggernaut Method, or those app names). Internal scheme ids are already
  neutral (`jbb-hyp`, `jm2-wave`); keep that.
- **Training science is not protectable.** Volume landmarks, RIR, SFR, and
  feedback autoregulation are ideas/facts; implementing them is safe. The risk
  lives in copying a *specific company's expression*: their exact datasets/tables
  verbatim, their feedback wording/UI, their precise numeric mappings.
- **Migrate off the seeded RP grid.** `VOLUME_LANDMARKS` currently ships the RP
  published grid as an external seed (noted in `data.js`). Move toward our own
  blended/derived values so we are not redistributing their table; keep any
  citation as "reference, not reproduction."
- **Differentiate by simplifying:** fewer feedback signals, our own scales and
  copy, our own exercise ratings, our own UI. "Simpler and different" is both the
  legal cover and the differentiation.

### Cluster A - Logging & data foundation (enabler, do first, low IP risk)

- **What:** per-set logging of actual reps + RIR (not just RPE, surfaced
  RIR-first since RIR reads easier for novices), an optional pump/burn quick-tap,
  a `technique` field on set objects, and per-exercise progression views (e1RM and
  volume-load trend, both already computable).
- **Why:** nothing autoregulates without honest per-set data; charts are
  table-stakes for a serious lifter.
- **Enables:** Epic 1 (feedback signals), Epic 2 (technique-tagged sets), Epic 4
  (volume accounting), and the rep-range / double-progression feature.
- **Dependencies:** none upstream. Touches the set-object schema, so new fields
  must be optional and inert when absent to keep the default/powerbuilding path
  byte-identical (golden master).
- **IP:** none; generic logging.

### Cluster B - Epic 2: advanced intensity techniques (priority 1)

- **What:** myo-reps, drop sets, rest-pause, lengthened partials, supersets/giant
  sets as first-class, prescribable set modifiers, with set/volume/time-model
  accounting and logging.
- **Why:** the tools a hardcore lifter uses to push past fatigue-limited volume,
  especially late in a meso.
- **Scale slowly:** ship ONE technique end-to-end first (a drop set is simplest:
  a working set carrying child mini-sets), prove prescription + logging + time
  accounting, then add myo-reps, rest-pause, partials, supersets. **Drop set
  shipped (2026-06-23):** `Engine.buildDropSet` + an opt-in `S.techniques` map
  applied via `applyTechnique` on a bodybuilding accessory's last working set,
  logged in the perf modal, timed via `Engine.setTimeSec` /
  `TIME_MODEL.dropTransitionSec`, and counted in `Engine.tonnage`. Next: myo-reps
  (its mini-rest is the first technique that needs the timer slice below).
- **Dependencies:** Cluster A's `technique` field + logging; `estimateSessionSec`
  must learn each technique's time cost; how a drop set counts toward weekly sets
  feeds Epic 4.
- **In-app timer (technique-aware slice):** a technique whose rest interval is
  *intrinsic* (myo-reps mini-rest, rest-pause pause, drop-set transition) is not
  done until its timing cue is surfaced to the athlete. Treat the timer as part of
  "end-to-end" for any such technique rather than a separate item; it consumes the
  same `technique` set structure this cluster introduces and builds on the generic
  rest timer shipped under Polish (the "Prescribed rest periods / in-app timer"
  item). A technique-aware timer cannot precede this cluster because the set
  structure it counts down does not exist until then.
- **IP:** low. Public methods with generic names; do not copy any one company's
  UI or exact parameter defaults.
- **Tests:** bodybuilding-only, default path inert. New engine math (technique set
  construction) gets unit tests; golden master should stay unchanged.

### Cluster C - Epic 3: head/region exercise model + SFR (priority 2)

- **What:** extend the taxonomy from movement-pattern to muscle heads/regions
  (triceps long vs lateral, upper vs lower chest, all three delts), add a
  per-exercise SFR rating and a stretch-emphasis tag, and cross-meso exercise
  rotation in the generator.
- **Why:** pros program by heads and by stimulus quality, and rotate exercises to
  manage staleness/fatigue.
- **Data slice shipped (2026-06-23):** `EX_META` adds per-exercise `sfr` (1..3
  stimulus-to-fatigue), `stretch` (loaded-stretch flag), and `head` (muscle region
  where heads differ), merged into `EXERCISES` with neutral defaults, plus
  `SFR_LABELS` / `HEAD_LABELS`. Surfaced as badges in the swap/add/library pickers
  (`exTagsHTML`) and a Stimulus card in the exercise detail (`exMetaCardHTML`).
  Additive and golden-master-safe (no prescription code reads it). **Next slice
  (own branch):** the generator and swap picker consuming `head`/`sfr` for
  head-aware selection and cross-meso exercise rotation.
- **Dependencies:** mostly a data lift in `data.js` (`EXERCISES`/`MOVEMENTS`); the
  generator and swap picker consume the new metadata. Sharpens Epic 4's per-muscle
  counting and the split generator's selection. Independent of Epic 2.
- **IP:** medium-careful. Author our OWN SFR ratings and head taxonomy (facts and
  opinions, fine to write); do not lift a specific company's exercise database or
  numeric SFR tables verbatim.
- **Tests:** new data + selection logic -> `focus-generator` tests; bodybuilding-
  only-safe for the golden master.

### Cluster D - Epic 4: volume & fatigue dashboard + autoregulated deload (priority 3)

- **What:** surface weekly sets per muscle vs MV/MEV/MRV, a fatigue trend, and
  MRV-hit / overreach detection that triggers an autoregulated deload (timing +
  depth) and resensitization back to MEV. Adds a specialization / maintenance(MV)
  phase on top.
- **Why:** the visible control panel a serious lifter expects; deload-by-fatigue
  beats the fixed week-5 halving.
- **Volume dashboard shipped (2026-06-23):** `Engine.volumeStatus` +
  `weeklyVolumeByMuscle` surface weekly direct working sets per muscle vs the
  athlete's MV/MEV/MRV (compounds attribute through `SYNERGIST_COVERAGE`), on a
  "Weekly volume" screen reached from the dashboard and the More hub. Read-only,
  golden-master-safe. **Still open in this cluster (own slices):** the fatigue
  trend, MRV-hit / overreach detection, the autoregulated deload + resensitization
  (these change deload behavior), and the absorbed zero-sum budget + specialization
  phase.
- **Dependencies:** Cluster A logging + (ideally) Cluster C granularity for
  accurate counts. Reuses `seedLandmarks`/`recalibrateLandmarks` and readiness.
  The specialization phase depends on the zero-sum budget (below) so non-priority
  muscles drop to MV.
- **Cross-link:** **absorbs the existing "Full cross-muscle zero-sum weekly volume
  budget"** item, and pairs with **"Carryover graduation"** (promotion) under one
  volume-management roof.
- **IP:** low-medium. Volume-vs-landmark views are generic; just do not reproduce
  a specific product's landmark numbers or dashboard layout (use our migrated
  values).

### Cluster E - Epic 1: per-muscle feedback autoregulation (gated capstone)

- **What:** after a muscle is trained, capture a small set of recovery/stimulus
  signals (our own minimal taxonomy, e.g. pump + soreness-cleared + reps-vs-last)
  and add/hold/cut that muscle's sets next session, ramping each muscle from MEV
  toward MRV. Replaces the fixed `JBB_HYP` set tables and the whole-body
  `computeWeekMod` with true per-muscle autoreg, finally using the check-in
  soreness for *volume*, not just readiness.
- **Why:** the defining feature of a serious hypertrophy app.
- **Feedback model + recommendation shipped (2026-06-23):** `Engine.autoregVolume`
  decides add/hold/cut per muscle from our own signal (recovery 1..5, performance,
  pump) vs MV/MEV/MRV; `muscleSignal` derives it from check-ins + logged sets. The
  Weekly volume screen surfaces the per-muscle recommendation.
- **Auto-application shipped (2026-06-23):** `P().volAdj` (per-muscle offset,
  updated each week by `updateAutoreg` from `muscleSignal`) now feeds prescribed
  bodybuilding accessory volume via `autoregForAccessory` in `resolveSlot`,
  bounded by the per-session landmark cap and clamped so the loop converges.
  Bodybuilding-only and inert without feedback (golden master safe). **Still open:**
  this layers on top of `weekMod`/`computeWeekMod` rather than replacing them, and
  does not yet rewrite the fixed `JBB_HYP` main-set tables; full replacement +
  per-head distribution remain future work.
- **Can it be lawsuit-risk-free? Yes.** Autoregulating volume from athlete
  feedback is general training science, not protectable. The risk lives entirely
  in cloning a specific company's named system: their exact signal set, wording,
  0-3 scales, and the precise feedback->set mapping. Build our OWN simpler model
  (fewer signals, our scale, our copy, our mapping) and it is both differentiated
  and safe. So Epic 1 is gated on design discipline, not on the idea, and could in
  principle move earlier if that differentiated model is designed first.
- **Dependencies:** Cluster A (feedback capture) and Cluster D (volume accounting +
  landmarks) should land first; that is also why it sits last in the sequence.
- **Tests:** large. Hypertrophy set counts become dynamic, so engine unit tests
  with *seeded* feedback (keep deterministic). Bodybuilding-only; default golden
  master unaffected.

### Cluster F - Training phase & energy-balance layer (nutrition, intertwined)

Cuts and minicuts are part of hypertrophy training, so this is a training-coupled
layer, NOT a macro tracker. Keep it light and differentiated.

- **First slice shipped (2026-06-23):** a `profile.phase` (lean-gain /
  maintenance / cut / minicut) on a Phase & Bodyweight screen; `Engine.autoregVolume`
  takes the phase so a deficit holds volume rather than adding and backs off
  sooner; `Engine.fatigueSaturated` drives a minicut suggestion on the volume
  dashboard; and a light `S.bodyweight` trend (sparkline, no calories/macros).
  **Still open:** phase per block/meso (currently one current phase), shortening
  the deload/minicut interval (needs Epic 4's deload slice), and a measurement
  trend beyond bodyweight.

- **What:**
  - A **phase tag** per block/meso: lean-gain (surplus), maintenance, cut,
    minicut.
  - **Recovery modulation:** in a deficit, recovery capacity drops, so the phase
    scales volume progression more conservatively and shortens the deload/minicut
    interval. This modulates Epic 1's autoreg and Epic 4's deload trigger.
  - **Minicut auto-suggestion:** when Epic 4 detects accumulated fatigue / MRV
    saturation, suggest a short (about 2-4 week) minicut aligned with a deload /
    resensitization.
  - A **light bodyweight + optional measurement trend** to inform phase
    transitions (trend only). **No calorie/macro database in v1** - this is where
    we stay simpler than a full nutrition app and avoid scope creep.
- **Why:** training volume and energy balance are inseparable; a minicut timed to
  a fatigue peak is standard practice.
- **Dependencies:** Epic 4 (fatigue/MRV detection) for the minicut trigger and the
  autoregulated deload; modulates Epic 1. Can begin early as a passive phase tag +
  bodyweight trend, then deepen.
- **IP:** the phase concepts (minicut, maintenance, resensitization) are public;
  safe. Avoid copying any company's specific calculators or copy.
- **Boundary:** explicitly NOT a calorie/macro tracker in the near term. Full
  nutrition, if ever wanted, is its own epic with its own legal review.

### Dependency map (quick reference)

```
Cluster A (logging) -- underpins --> B, D, E, and rep-range/double-progression
Epic 2  (B) -- needs A --> feeds D's volume accounting
Epic 3  (C) -- data lift --> sharpens D + the generator; independent of B
Epic 4  (D) -- needs A (and C for accuracy) --> absorbs zero-sum budget;
                pairs with carryover graduation; gates F's minicut trigger
Epic 1  (E) -- needs A + D --> gated on the differentiated-feedback design; capstone
Phase   (F) -- needs D --> modulates E and the deload; starts light
```

### Supporting features and polishes

- **Double progression + explicit rep ranges + per-meso rep-range variation**
  (foundation: Cluster A). [feature]
- **Autoregulated deload** timing/depth (part of Epic 4). [feature]
- **Frequency autoregulation** from how fast soreness clears (needs Epic 1
  feedback). [feature]
- **Prescribed rest periods / in-app timer**, surfaced to the athlete. Two
  slices with different dependencies:
  - *Generic rest timer (independent, shippable now).* A per-set countdown on the
    workout view, seeded from the `TIME_MODEL.restSec` / `restSecTight` values that
    already exist in `data.js` (today they only feed `estimateSessionSec`; nothing
    surfaces them to the athlete). No dependency on Cluster A or Epic 2: it is UI
    over data that exists, read-only on the engine. Any new optional set-object
    field (e.g. a per-set rest override) must stay inert when absent so the
    default/powerbuilding golden master holds; timer copy is athlete-facing, so no
    em dashes.
  - *Technique-aware timer (gated on Epic 2 / Cluster B).* Myo-reps, rest-pause,
    and drop sets carry an intrinsic intra-set rest that is part of the
    prescription, not generic recovery, so it cannot be timed until Cluster B
    builds the `technique` set structure. Scoped there as an acceptance criterion
    per technique, not scheduled ahead of it. [polish -> feature]
- **Show a target rep range** instead of a single number. [polish]
- **Per-muscle weekly set counter** on the workout view (early slice of
  Epic 4). [polish]
- **Tempo as a prescribable field** on any exercise, not only the named
  `tempo-*` variants. [polish]
- **Stretch-focused badge** in the picker; **over-MRV warning** when sliders push
  a muscle past its landmark (needs Epic 3 tags / landmarks). [polish]

### Roadmap notes

- Every cluster stays **bodybuilding-track-only** so the default/powerbuilding
  golden master holds; new set-object fields must be optional and inert when
  absent.
- Keep the **"inspired, not cloned"** constraint visible in each PR: our own data,
  our own copy, our own UI, simpler where possible.
- Branch discipline (see the retrospective): one cluster, ideally one
  technique/feature, per branch.

## Quality of life UI improvements

Small surfacing/clarity polishes that make existing features easier to read at a
glance. None change prescription math, so they are golden-master-irrelevant.

- **Make a deficit phase obvious on the dashboard.** The dashboard phase chip
  (`🍽 Phase: ...`, `vDashboard` in `app.js`) is text only today, so a cut/minicut
  reads the same as lean-gain at a glance. Color the chip (e.g. amber) and add a
  short "deficit" tag when `PHASE_DEFICIT[phase]`, so an energy deficit is
  unmistakable without reading the word. The "recovery is lower, volume holds"
  explainer currently lives only on the Weekly volume screen; consider echoing a
  one-word cue on the dashboard too.



- ~~**Balanced multi-day over-allocates lower.**~~ ~~**Lower region themes only
  around Legs.**~~ ~~**Same-muscle day spacing.**~~ DONE (2026-06-22, see Resolved
  below): Glutes is now a second lower anchor (gated on >=2x/week), which both
  broadens lower themes and stops a balanced week collapsing onto Legs, and a
  `spaceSameMuscle` pass separates repeated-lead days. The "weight region days by
  muscle count" alternative was not taken; the secondary-anchor route covered the
  same symptom. Calves still never lead (no compound lead) by design.

## Polish / smaller

- **Per-day time caps** (one global cap vs a longer cap for a naturally longer
  day such as legs).
- ~~**Budget-aware swap/select list:** the Add button shows remaining time and
  per-add cost; the per-candidate cost is not yet shown inside the swap list.~~
  DONE: the swap and add pickers now show each candidate's approximate time cost
  (`candidateCostMin`) for a capped athlete, plus a remaining-room header.
- ~~**Check-in references removed muscles:** `checkinGroupsForDay` reads slots
  structurally, so a muscle set to 0 could still surface a check-in slider.~~
  DONE: `checkinGroupsForDay` now resolves each slot and skips the removed ones,
  so a muscle set to 0 surfaces no readiness slider (same source of truth as the
  workout view).
- ~~**Onboarding time estimate is bodybuilding-only** (it lives on the slider
  step); powerbuilding/powerlifting athletes with a time cap get no onboarding
  estimate. Could add one on the time step for all tracks.~~ DONE: the estimate
  (`estimateMedianSessionMin`, track-aware) now also shows on the time step for
  every track, updating live as the cap is typed.

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

### Set up CI (one small `chore/` branch) — DONE
- ~~A **GitHub Actions** workflow (`.github/workflows/ci.yml`) that runs on every
  push and pull request.~~ Shipped: runs in `app/` on Node 18 + 20, `npm ci` ->
  `node --check` on every source/test file -> `npm test --if-present`. Runs in
  ~15 to 18s. The `--if-present` guard kept it green before the test suite landed
  and made the two PRs order-independent.
- **Branch protection** for `main` is configured via a ruleset requiring the
  `check (18)` and `check (20)` statuses, so a red check blocks merge.

### Automated tests worth writing (promote the harnesses into a real suite)
Use Node's built-in test runner (`node:test`), committed under `app/test/` and
wired to `npm test`. `test/load-app.js` already loads the three browser scripts
into a `vm` sandbox (no `jsdom`, no build step), so items 2 to 5 can call the
engine directly through it; only the boot/render smoke test (item 6) needs a
real DOM.

1. ~~**C1 golden-master (highest value).** Snapshot the resolved routine for the
   default Powerbuilding program (every block/week/day/slot's `resolveSlot`
   output) and assert it never changes.~~ DONE (`test/golden-master.test.js`,
   uncalibrated + calibrated, 475 slots each, vs committed `golden-master.json`).
   The automated version of the "default users stay byte-identical" contract.
2. ~~**Engine unit tests** (pure, deterministic, cheap): `Engine.e1rm`,
   `weightFor`, `amrapAdjust` (including the +10-rep cap and the below-standard
   hold), `plateMath`, `warmupSets`, `readinessScore`, `seedLandmarks`, and the
   per-week ramps of `prescribeMain` / `jbb-hyp` for both a calibrated and an
   uncalibrated lift.~~ DONE (`test/engine.test.js`).
3. ~~**Scheme isolation:** assert `jm2-wave` and `jbb-hyp` never blend, and that
   `schemeFor` routes only by `block.scheme`.~~ DONE (`test/scheme-isolation.test.js`).
4. ~~**Migration tests:** a legacy `database.json` (pre-tracks, pre-landmarks)
   loads via `migrateState` and is backfilled, and `migrateState` is idempotent.~~
   DONE (`test/migration.test.js`).
5. ~~**Focus / generator behavior:** slider 0 removes, 1-2 de-emphasize, the split
   generator's region allocation and frequency, core/optional tiers, and the
   carryover drop/keep.~~ DONE (`test/focus-generator.test.js`).
6. ~~**Boot / render smoke:** load the three scripts in jsdom and render every view
   for a default and a bodybuilding program without throwing.~~ DONE
   (`test/render-smoke.test.js`, self-skips on Node < 20).
7. ~~**Persistence round-trip:** start `server.js`, `POST` then `GET /api/state`,
   assert it round-trips and that `database.json` is created.~~ DONE
   (`test/persistence.test.js`). A separate `test/time-estimate.test.js` also
   covers the session time model beyond the original list.

### Project-specific lint checks (great CI fit)
- ~~**Line endings / indentation:** a check that `.bat` files stay CRLF and
  everything else is LF + two-space indent, matching `.gitattributes` /
  `.editorconfig`.~~ DONE (`app/test/lint.test.js`): a dependency-free `node:test`
  that scans every tracked text file (binaries skipped by a NUL-byte heuristic)
  for `.bat`-CRLF / LF-only line endings, space-only indentation, no trailing
  whitespace, and a final newline. Runs under `npm test`, so it gates CI with no
  workflow change.
- A lightweight **ESLint** pass (no framework, just `no-undef`, `no-unused-vars`,
  basic correctness) catches the class of bug that only shows up at runtime in a
  no-build vanilla-JS project. Deferred to its own branch: the three scripts share
  one global scope (`engine.js` references `data.js` symbols), so a faithful
  `no-undef` needs ESLint configured for that shared-global browser environment
  plus a real dependency tree, which is at odds with the one-devDependency ethos.

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


## Resolved (2026-06-22, split-generator tuning)

The three **Split-generator tuning** items, landed together on
`feat/split-generator-tuning` (they share `generateBodybuildingDays` and the
anchor tables, so one branch was cleaner than three).

- **Glute-led days / lower themes beyond Legs.** `ANCHOR_RANK.glutes` is now 2
  and `PRIMARY_ANCHOR.glutes` leads with a hip thrust. A new `canLead` gate in
  `generateBodybuildingDays` only lets Glutes anchor when it is trained twice or
  more a week, so a de-emphasized (1x) glute fills days but never claims one.
- **Balanced multi-day over-allocation.** Giving the lower region a second
  possible lead (Glutes) means a balanced 6-day spreads its lower days across
  Legs and Glutes instead of three Legs-led days. Chosen over the muscle-count
  region re-weighting alternative, which is left unimplemented as it would also
  shift day *counts* and is not needed to fix the symptom.
- **Same-muscle day spacing.** A `spaceSameMuscle` post-pass (run after the
  region interleave) swaps a later differently-themed day between two days led by
  the same muscle. Unavoidable single-lead regions are left intact.
- Tests: `focus-generator.test.js` gains glute-lead, 1x-glute-does-not-lead,
  no-adjacent-theme, and direct `spaceSameMuscle` cases. The golden master is
  untouched (all changes are bodybuilding-only; the default is Powerbuilding).

## Resolved (2026-06-22, polish bundle)

- **Check-in references removed muscles.** `checkinGroupsForDay` now resolves
  each slot via `resolveSlot` and skips any `isRemoved` one, so a muscle set to 0
  (or a track-removed lift) no longer surfaces a readiness slider. The check-in
  now matches exactly what the workout view renders.
- **Onboarding session estimate on every track.** `estimateFocusMedianMin` is now
  `estimateMedianSessionMin` (track-aware, no longer hard-coded to bodybuilding)
  and a `focusTimeLine` estimate renders on the time step for all tracks, updating
  live as the cap is typed (`obTimeInput`). Powerbuilding/powerlifting athletes
  with a time cap now get the same ballpark bodybuilding always had.
- Per-day time caps deferred to its own branch (it is a model + UI feature, not
  polish).

## Resolved (2026-06-22, formatting lint check)

- **Line-endings / indentation lint** (`app/test/lint.test.js`): a dependency-free
  `node:test` enforcing the `.gitattributes` / `.editorconfig` contract across
  every tracked text file (`.bat` CRLF, everything else LF-only, space-only
  indentation, no trailing whitespace, final newline). Binaries are skipped by a
  NUL-byte heuristic and the file set comes from `git ls-files`, so it stays
  build-free and runs under `npm test`. Fixed two pre-existing violations in
  `app/server.js` (a trailing-whitespace line and a missing final newline). The
  ESLint half of the lint item is deferred to its own branch (shared-global scope
  + dependency-tree tradeoff).

## Resolved (2026-06-22, remove exercises + budget-aware pickers)

- **Remove exercises from a day.** The workout overview now supports swipe-left
  to reveal a Remove action on any accessory or added exercise (mains and
  secondaries stay swap-only since they anchor the working max). Removal is
  undoable via a toast action. Fixes the report of an added exercise that could
  not be taken back off the day.
- **Budget-aware swap/select list** (see Polish above): per-candidate time cost
  in the swap and add pickers for time-capped athletes.
- **Equipment-aware setup time.** `TIME_MODEL` gained a per-exercise, equipment
  keyed setup cost (`setupSec`: bb 120 / db,kb 70 / cb 40 / mc,bd 20 / bw 10 s)
  applied in `estimateSessionSec`, with the once-per-session overhead dropped to
  180 s. Marginal add costs now include real setup and differentiate barbell from
  machine; full-session estimates stay close for typical days.

## Resolved (2026-06-22, test + CI foundation)

- **CI** (`.github/workflows/ci.yml`): npm ci + `node --check` + `npm test` on
  Node 18/20 for every push and PR, with branch protection on `main`.
- **C1 golden-master** (`app/test/golden-master.test.js`) plus the `vm` harness
  loader (`app/test/load-app.js`) and the `npm test` script.

Next up from the testing list: the remaining project-specific lint check (the
ESLint pass). Items 2 to 7 (engine unit tests, scheme isolation, migration,
focus/generator behavior, boot/render smoke, persistence round-trip) and the
line-endings/indentation lint check have all shipped (see `app/test/`).

## Resolved (2026-06-22, onboarding polish)

- **Deadlift 1RM no longer asked on the bodybuilding track.** The maxes step
  now skips `comp-deadlift` for bodybuilding, since that generator never
  programs the deadlift. Other tracks are unchanged.

## Resolved on the Onboarding-improvements branch (no longer pending)

- Strength-philosophy leak in bodybuilding (Good-Mornings lead, deadlift day) ->
  dedicated templates + frequency generator.
- Sliders not affecting the split shape -> frequency-driven generator.
- Silent time trimming -> Core/Optional tiers.
- Empty days, select-slot leftovers, the chest/shoulder pressing-accessory bug,
  generous time estimates, and the Day-title vs theme display.

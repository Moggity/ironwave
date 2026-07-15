# Pending / future work (next branches)

Current as of the end of the `Onboarding-improvements` branch. None of these
block what shipped; they are enhancements, tuning, and known rough edges. Group
them into focused branches rather than one large one (see the retrospective).

## Larger features (each its own branch)

- **Sport-aware scheduling** (the long-deferred epic): a sport -> muscle-fatigue
  dataset, "pick which weekdays you train" instead of a day count, calendar
  placement so high-fatigue sessions avoid game day, and named/dated days.
- ~~**2 training days per week**~~ DONE (2026-07-15, shipped with Epic H7):
  `generateFullBodyDays` (two full-body days, leads from different regions,
  each muscle on min(freq, 2) days), `DAY_TEMPLATES[2]` with the approved
  paired mains (Day A squat + bench, Day B deadlift + press; two AMRAPs on
  realization day), `BB_DAY_TEMPLATES[2]` fallback, onboarding picker 2..6
  with a minimum-dose note. Simulated two-block run + eccentric edge tests;
  the 4-day golden master untouched.
- **e1RM-driven hypertrophy anchors.** Today a bodybuilding day's working-max
  anchor stays a barbell compound (bench/squat/press) because the wave/AMRAP
  weights are percentages of that lift's max. To let a day default to a DB or
  machine compound *with correct weights*, anchors would need an e1RM-based
  prescription path instead of barbell percentages. Would make the bodybuilding
  default fully non-barbell, barbell as a swap. (Now absorbed into
  **Epic H4** below; the 2026-07 athlete feedback ranked it the bodybuilder's
  second-loudest complaint.)
- **Full cross-muscle zero-sum weekly volume budget.** The split generator now
  handles frequency, and de-emphasis scales sets, but total weekly sets are not
  strictly conserved/redistributed across muscles. Bounded today by per-muscle
  landmark clamps. (Now folded into **Epic 4 / Cluster D** below as the
  specialization-with-maintenance mechanism.)
- **Carryover graduation.** The block-end carryover drops an optional accessory
  never trained; the inverse (an optional consistently completed gets promoted
  into core / nudged up) is not built. (Pairs with **Epic 4 / Cluster D** under
  one volume-management roof.)
- ~~**Calibration redesign (RIR-first, reduced-fatigue ramp).**~~ DONE
  (2026-06-23): `Engine.calibrationRamp(baseReps, experience)` is one shared ramp
  with descending reps `R, R-2, R-4` floored at 3 and effort in RIR 4/3/2
  (beginners stop at RIR 3). The inflated accessory lead-in (14/12/12 at RIR
  5/3/2) is gone, now 12/10/8 at RIR 4/3/2; a 10s main goes 10/10/10 -> 10/8/6.
  `experience` is threaded through the scheme entry points and `resolveSlot`
  (default intermediate = RIR 4/3/2). Golden master regenerated and reviewed:
  calibration-only, zero weight changes, calibrated snapshot untouched. Owner
  signed off on the rep/RIR targets and the beginner cap. Rationale: e1RM
  estimation degrades past ~10 reps, so a moderate top set near failure is both
  lower-fatigue and a cleaner read (JM 2.0 itself runs off a training max + AMRAP
  auto-correction rather than an RIR feeler ramp; ours is the bridge for athletes
  without a known max).

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
  `TIME_MODEL.dropTransitionSec`, and counted in `Engine.tonnage`. **Myo-reps
  shipped (2026-06-23):** `Engine.buildMyoReps` reuses the same child-set
  plumbing at a fixed activation weight; `setTimeSec` is now technique-aware
  (`TIME_MODEL.myoRestSec` per mini-set); a second in-session chip
  (`toggleTechInSession` / `entryTech`, drop and myo mutually exclusive); and the
  intrinsic myo mini-rest is cued in the perf modal (the technique-aware timer
  slice, built on the generic rest timer). **Rest-pause shipped (2026-06-23):**
  `Engine.buildRestPause` (same-weight bursts), `Engine.techTransitionSec` as the
  one source for each technique's intrinsic intra-set rest, and a consolidated
  "Add a finisher" chip row (drop / myo / rest-pause, mutually exclusive) with a
  technique-aware perf modal + pause cue. **Lengthened partials shipped
  (2026-06-25):** `Engine.buildPartials` reuses the same-weight child-set plumbing
  (one partial burst in the stretch); a `partials` finisher chip joins the row
  (now four, mutually exclusive); `TIME_MODEL.partialsSec` / `techTransitionSec`
  charge the small slowdown; and partials ride the working weight
  (`SAME_WEIGHT_TECHS`) but carry NO timed rest cue (a new `TIMED_REST_TECHS`
  gates the perf-modal mini-rest button, since partials flow straight out of the
  set). **Supersets (first slice) shipped (2026-06-25):** an accessory can be
  paired with the NEXT accessory on a day (`slot.superset`); `resolveDayEntries`
  tags both resolved entries head/tail, `estimateSessionSec` charges a shared rest
  (half per supersetted set, one rest per round) so a supersetted day estimates
  shorter, and the workout overview gets a per-accessory Superset/Unlink toggle
  (`supersetLayout` / `toggleSuperset`) plus a link badge on the overview and
  session cards. Bodybuilding-only, additive (`slot.superset` absent by default),
  golden master untouched. **Giant sets + alternating UI + cap unit shipped
  (2026-06-25):** a maximal run of accessories linked by the flag is one group;
  `resolveDayEntries` tags every member (group head / index / size / names) and
  `estimateSessionSec` charges 1/size the rest per supersetted set; the overview
  toggle allows chains (the badge reads superset / giant set); a group renders in
  the session as one combined card with a per-member controls strip and the work
  logged ROUND by round (`supersetGroupCardHTML`; `liftCardHTML` / `setRowHTML`
  extracted), each cell opening the same perf modal; and the time cap treats a
  group as one unit so a pair / giant set is kept or dropped whole. **Polish
  shipped (2026-06-25):** the rest timer is now per ROUND, not per set
  (`supersetRoundComplete` / `supersetNextInRound` gate `donePerf` so the full
  rest arms only once every member has logged the round, with a toast cueing the
  next exercise to alternate to), and grouped accessories get up/down controls on
  the overview (`moveSupersetMember`) that reorder a member within its group while
  keeping the run intact. **Cluster B / Epic 2 is COMPLETE** (drop / myo /
  rest-pause / partials finishers + supersets / giant sets with an alternating
  round-based logger, shared per-round rest, and in-group reordering).
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
  Additive and golden-master-safe (no prescription code reads it). **Selection
  slice shipped (2026-06-23):** `pickAccessory` (shared head-aware selection)
  makes `generateBodybuildingDays` spread a muscle across its heads; a cross-meso
  rotation in the block-advance rebuild rotates each generator-default accessory
  to a fresh head-diverse pick per meso; and the swap picker orders accessory
  candidates by SFR (higher stimulus first). Bodybuilding-only, golden-master-safe.
  **Head-aware swap ordering shipped (2026-06-23):** `dayHeadsCovered` plus a
  fills-a-gap sort tier and an "Adds <head>" hint surface a candidate that covers
  a region the day is missing. **Per-head volume shipped (2026-06-23):**
  `weeklyVolumeByHead` plus a "Regions" line on the Weekly volume screen split a
  muscle's direct work by head. **Per-head landmarks shipped (2026-06-25):**
  `Engine.headLandmark` derives a per-head target by an even split of the muscle
  landmark across its heads (floored, capped at the whole-muscle MRV; a single-head
  movement is a no-op). The Weekly-volume "Regions" line now flags a head sitting
  over its per-head MRV in amber, and the swap/add pickers show a "<region> maxed"
  hint on a candidate whose head is already at/over its per-head MRV this week
  (`headLandmarkFor` / `headVolumeOverMrv` / `overMrvHeadSet`, bodybuilding-only).
  **Pattern-movement heads shipped (2026-06-25):** `HEAD_MUSCLE` rolls each head up
  to the muscle it builds, and `exHeadAttribution` attributes a head on a PATTERN
  movement (`bench` / `press` / `deadlift`, which carry no landmark) to that muscle
  at the same `SYNERGIST_COVERAGE` fraction the muscle bar uses, so the head split
  is complete and stays consistent with the muscle bar. Chest now splits into
  upper / mid-lower (upper used to be invisible), shoulders gain front-delt from
  the press pattern, hamstrings gain hip-flexion from the deadlift pattern.
  `weeklyVolumeByHead` and `muscleHeads` share the one rollup, so the per-head
  landmarks track it. **Still open:** per-head landmark *tuning* (the even split is
  a first cut; some heads tolerate more than an even share), and a deeper
  delt-rear-vs-shoulders grouping (rear delts currently roll up to Upper back,
  matching where those exercises already sit).
  *Note (found while building rotation):* "cross-meso rotation for athlete-picked
  (select) slots" is near-empty as scoped: `generateBodybuildingDays` assigns a
  `def` to every accessory slot, so def-less select slots do not occur on a
  generated bodybuilding program and there is nothing to rotate. Only revisit it
  if select slots are reintroduced (e.g. a template path that leaves a category
  unfilled for the athlete to pick).
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
  golden-master-safe. **Autoregulated deload DEPTH + resensitization shipped
  (2026-06-23):** `Engine.deloadDepth` sizes the deload to accumulated fatigue
  (MRV saturation + readiness trend); `advanceWeek` stores the plan entering the
  deload week and resets `P().volAdj` to MEV on block end; `resolveSlot` deepens
  or lightens a bodybuilding accessory's deload accordingly (bb-only, deload-week
  only). Per-head volume also shipped (`weeklyVolumeByHead`, see Cluster C).
  **Early-deload TIMING trigger shipped (2026-06-24):** `Engine.earlyDeloadAdvised`
  decides mid-block (saturated, or 2+ muscles near MRV with readiness sliding); a
  dashboard banner offers it on a work week, accepting marks `P().earlyDeload`
  (transient) and `resolveSlot` remaps that one week to the deload slot
  (`effectiveWeekIdx`), with `advanceWeek` ending the block early and resensitizing
  via a shared `endBlock`. Denser amber hatch on the timeline + skipped-week
  dimming, and a volume-screen note. Bodybuilding-only, golden master untouched
  (`test/early-deload.test.js`). **Fatigue dashboard + per-muscle deload shipped
  (2026-06-26):** a recovery/fatigue **trend chart** on the volume screen
  (`trendChartHTML` over the readiness series); **`Engine.overreaching`** (strictly
  over MRV, sharper than the minicut's near-MRV saturation) drives an **overreach
  warning** banner; and **per-muscle early deload** lands as the lighter version of
  the "own epic" idea - `program.muscleDeload` (transient, cleared at block end)
  lets the athlete (or the over-MRV prompt) pull a single muscle back: `resolveSlot`
  halves that muscle's accessory sets and eases one RIR on any work week (skipping
  its finisher), keyed by each accessory's primary muscle (`accessoryPrimaryMuscle`,
  so an incline bench rolls up to chest). **Still open in this cluster:** the
  absorbed zero-sum budget + specialization phase (left to its own epic; overlaps
  Cluster E). A fuller per-muscle deload that also reshapes mains/secondaries
  beyond the deload week could extend this.
- **Deload-depth refinements (found while building the deload, own small
  branch):**
  - ~~*Suppress autoreg adds on the deload week.*~~ DONE (2026-06-25):
    `autoregForAccessory` now takes the effective week and returns 0 for a positive
    `volAdj` offset on the deload week, so the accumulated autoreg add no longer
    fights the `deloadDepth` pullback. A negative offset still passes through (it
    only reinforces the deload).
  - ~~*Modulate intensity, not just sets.*~~ DONE (2026-06-25): `deloadDepth` now
    carries an `rpeDelta` (a deeper deload is `-1`, i.e. one more rep in reserve);
    `deloadIntensityDelta` / `applyDeloadIntensity` ease the plain working sets'
    RPE on the deload week (clamped to >= 5), so a deeper deload pulls back both
    volume and intensity. Standard/light deloads are `rpeDelta: 0` (unchanged).
  - ~~*Extend depth to secondary.*~~ DONE (2026-06-26): `resolveSlot` now applies
    `deloadDepthDelta` / `deloadIntensityDelta` to the secondary lift on the deload
    week too. The main `DELOAD_SETS` is still left alone (already minimal on a
    deload); reshaping it is low priority and open.
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
  the deload/minicut interval (needs Epic 4's deload slice), a measurement
  trend beyond bodyweight, and (from the 2026-07 athlete feedback, Epic H
  series) a target rate-of-change per phase plus an alert when the bodyweight
  trend disagrees with the phase. Still explicitly NOT a macro tracker.

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
  (foundation: Cluster A). Now absorbed into **Epic H4** (the 2026-07 athlete
  feedback ranked it the single loudest gap). [feature]
- **Autoregulated deload** timing/depth (part of Epic 4). [feature]
- **Frequency autoregulation** from how fast soreness clears (needs Epic 1
  feedback). [feature]
- **Prescribed rest periods / in-app timer**, surfaced to the athlete. Two
  slices with different dependencies:
  - ~~*Generic rest timer (independent, shippable now).* A per-set countdown on the
    workout view, seeded from the `TIME_MODEL.restSec` / `restSecTight` values that
    already exist in `data.js`.~~ DONE (2026-06-23): `Engine.restSecFor(kind, tight,
    TM)` reads the prescribed rest the time estimate already uses; a sticky rest bar
    on the session view starts a countdown when a real working set is logged
    (`donePerf`, warmups excluded), with -15s / +30s / Skip and a done state. No new
    persisted/set-object field (ephemeral `V.restTimer` only), so the
    default/powerbuilding golden master is untouched. Unblocks the technique-aware
    timer below.
  - *Technique-aware timer (gated on Epic 2 / Cluster B).* Myo-reps, rest-pause,
    and drop sets carry an intrinsic intra-set rest that is part of the
    prescription, not generic recovery, so it cannot be timed until Cluster B
    builds the `technique` set structure. Scoped there as an acceptance criterion
    per technique, not scheduled ahead of it. **Myo-reps slice shipped
    (2026-06-23):** the myo mini-rest is cued by a short countdown in the perf
    modal (`startMyoRest`, `TIME_MODEL.myoRestSec`). Rest-pause adds its own pause
    cue when that technique lands. [polish -> feature]
- **Show a target rep range** instead of a single number. [polish]
- **Per-muscle weekly set counter** on the workout view (early slice of
  Epic 4). [polish]
- **Tempo as a prescribable field** on any exercise, not only the named
  `tempo-*` variants. [polish]
- **Stretch-focused badge** in the picker; **over-MRV warning** when sliders push
  a muscle past its landmark (needs Epic 3 tags / landmarks). A per-HEAD over-MRV
  hint in the swap/add pickers shipped (2026-06-25, Cluster C); a whole-muscle,
  slider-driven over-MRV warning is still open. [polish]

### Roadmap notes

- Every cluster stays **bodybuilding-track-only** so the default/powerbuilding
  golden master holds; new set-object fields must be optional and inert when
  absent.
- Keep the **"inspired, not cloned"** constraint visible in each PR: our own data,
  our own copy, our own UI, simpler where possible.
- Branch discipline (see the retrospective): one cluster, ideally one
  technique/feature, per branch.

## Gym side final state (macrocycle planning epic group)

From an owner design review (Figma mockups, 2026-06-24): the "final state" of the
gym side is a rich macrocycle timeline that surfaces *phases* and *intensity
techniques* across the whole plan, plus athlete control over macrocycle length
and a build-your-own-from-blocks flow. The existing `timelineHTML` (one bar per
week, colored by scheme, tap-to-preview) is the seed; these epics grow it into
the mocked-up planner. Same constraints as the hypertrophy roadmap apply: keep
non-default tracks no-ops on the default path (golden master), and "inspired, not
cloned" (our own copy, colors, and simpler where possible).

Owner decisions captured: macrocycle length is controlled **both** ways (a simple
date-driven default that auto-arranges blocks, with the block builder as the
power-user override); the first implementation branch is **Epic G1 + G3 (phase
model + timeline v2)**.

- **Epic G1 - Per-block phase model.** Promote Cluster F's single global
  `profile.phase` to a per-block `block.phase` (lean-gain / gain / maintenance /
  cut / minicut / peak). Additive + migrated (backfill from block type/track),
  display-only at first; later it replaces the global phase as the input to
  `autoregVolume` (bodybuilding-only, so golden-master-safe). Foundation for
  everything below.
- **Epic G2 - Variable macrocycle length.** *Block-count slice shipped
  (2026-06-24):* an onboarding "Program length" choice (`ob.macroWeeks`) rebuilds
  the block list via `extendBlocks`/`blocksForWeeks` (cycle the template pattern to
  fit, renumber labels, re-stamp mesoIdx + phase); `testDate`/`daysOut`/the
  timeline derive from the result; the default (no choice) keeps the template
  verbatim, so the golden master is untouched. **Still open:** ~~variable *per-block*
  week count~~ (SHIPPED 2026-07-15 as Epic H6's enabling slice:
  `block.weeks`/`blockWeeks`), an
  explicit end-date picker (today it is weeks presets; H6's meet date covers the
  strength tracks), and smart phase auto-arrange (the cycled pattern is
  mechanical; intelligent phase placement is G4/G6 territory).
- **Epic G3 - Macrocycle timeline v2 (UI).** The mocked-up bar chart: per-block
  containers tinted by phase with a phase label, bars colored by training
  emphasis (hypertrophy blue / strength orange / cut teal / peak red), deload
  weeks hatched, current week glowing, richer legend. Depends on G1 (phase data)
  and reads G5's technique schedule for markers. *First branch ships G1 + the
  phase-coloring/labels half of G3; markers follow with G5.*
- **Epic G4 - Block builder ("+").** *Shipped (2026-06-24):* a "+" tile at the end
  of the timeline opens a "Customize blocks" editor. Already-trained blocks are
  locked (`lockedPlanCount`); the athlete edits type/wave/phase per block, reorders,
  removes and adds future blocks. `commitPlan` keeps the locked blocks, appends the
  edited draft, re-stamps mesoIdx/phase/labels (`relabelBlocks`) and recomputes the
  test date from the new block count. **Still open:** drag-to-reorder (today it is
  ↑/↓ buttons), editing the per-block week count (waits on G2's per-block-weeks
  slice), saved/named plan templates, and guard copy when an edit shortens a plan
  past the athlete's goal date.
- **Epic G5 - Technique periodization + markers.** *Schedule + markers shipped
  (2026-06-24):* `Engine.scheduledTech(weekIdx, mesoIdx, {deficit})` places a drop
  set on every meso's realization week and adds a myo-rep week in intensification
  once adapted (mesoIdx >= 1), held back in a deficit; none on intro/accumulation/
  deload. `scheduledTechForBlock` gates it to bodybuilding-track hypertrophy blocks
  (display-first: drives the timeline ◆/» markers and the week-preview "Finisher
  this week" note, not the prescription). **Still open:** auto-*application* of the
  scheduled technique (today the athlete still opts the finisher in per session;
  the schedule could pre-select it), rest-pause/partials in the schedule, and a
  peak-phase suppression once peak blocks actually program hypertrophy. Builds on
  the shipped Cluster B technique set structure.
- **Epic G6 - Goal archetype branch.** *Shipped (2026-06-24):* a bodybuilding-only
  onboarding fork (`GOAL_ARCHETYPES`: "Serious muscle macro" vs "Look lean ASAP")
  on the goal step. Each sets a default length and a per-block phase sequence
  applied via `applyArchetypePhases` (cycled to the block count): serious = lean-
  gain/gain blocks with periodic minicuts finishing on a cut; lean-asap = a short
  12wk minicut-into-cut. The first block's phase seeds `profile.phase` so the
  Cluster F autoregulator knows a lean-fast plan starts in a deficit, and the G5
  markers adapt automatically (deficit blocks hold the myo). Inert on other tracks,
  so the golden master is untouched. **Still open:** per-block phase editing beyond
  the preset cycles (that is G4's job), and intensity/volume differences between
  archetypes beyond the phase-driven autoreg.

- **Realism pass (2026-06-24, after simulating G1-G6 across personas).** Aligned
  the auto-generated plans with established practice. Added a third **"Look good
  (recomp)"** archetype (lean-gain blocks into a cut) as the default, since
  recomposition fits most lifters and newer ones especially. **Look lean ASAP** now
  interleaves a maintenance diet break every third block and carries a serious
  onboarding warning (an aggressive deficit is an intermediate/advanced tool;
  beginners should recomp). `Engine.scheduledTech` is experience-aware: beginners
  are never auto-scheduled intensity techniques, advanced get the myo earlier.
  Strength-ending tracks mark a final **peak** block (`markPeakBlock`). **Still
  open:** a hard confirm (not just a banner) if a beginner insists on lean-asap;
  archetype-specific volume/intensity beyond phase; per-block-weeks so a peak/taper
  block can be shorter than a 5-week meso.
  - **Deeper "Look lean ASAP" onboarding (ties to the nutrition layer, Cluster F).**
    The current guard is a single warning banner. When we tackle the nutrition/
    energy-balance layer, make this onboarding genuinely serious: actual dieting
    guidance (realistic rate of loss, why an aggressive deficit costs recovery and
    muscle, refeeds/diet breaks, who it is and is not for, a "are you already lean
    enough for this" gut check), not just a one-paragraph caution. The aggressive-
    deficit path should hand the athlete real expectations before they commit, and
    pair the phase plan with the bodyweight-trend and phase tooling from Cluster F.

```
G1 (phase model) -- foundation --> G3, G4, G6; later feeds autoregVolume
G2 (variable length) -- with G1 --> G4, G6; date-driven default + builder override
G3 (timeline v2) -- needs G1, reads G5 --> the visible deliverable (FIRST BRANCH: G1 + G3 colors/labels)
G4 (block builder) -- needs G1 + G2 --> the "+" power-user planner
G5 (technique periodization) -- builds on Cluster B --> lights up timeline markers
G6 (goal archetype) -- needs G1 + G2 --> ASAP vs serious-macro onboarding fork
```

Assets/fidelity notes: the timeline is pure CSS/inline SVG (bars, gradients,
deload hatch, markers) - no image files needed; exact Figma hex/gradient tokens
are a fidelity nice-to-have, not a blocker. No Figma connector in the build
environment, so reproduce from PNGs/tokens.

## Veteran athlete feedback roadmap (Epics H1-H8, 2026-07-15)

Source: a simulated end-to-end review by two 20+ year athletes (a classic
physique bodybuilder anchored to the RP Hypertrophy app / Alpha Progression /
Hevy, and a masters powerlifter anchored to JuggernautAI / KeyLifts /
Boostcamp), run against v1.9.0 from onboarding to macro finish. Full write-up
with per-stage praise and criticism: `docs/athlete-feedback-simulation.md`.

What both personas PRAISED is the moat, defend it in every change below:
ownership (self-hosted, offline, no account), gym-floor fidelity (plate math,
loading modes, warmups, rest timer, outlier guard, mid-session
re-prescription), the macro timeline/planner, honest copy, and strict scheme
isolation.

The epics below collect everything the simulation found LACKING plus the
polish items on criticized features, ordered by dependency and priority.
Pending items the feedback re-validated are ABSORBED into the epic that ships
them (marked "absorbs", same convention Cluster D used for the zero-sum
budget). The standing constraints hold throughout: the default/powerbuilding
golden master stays byte-identical unless a change is deliberate and
regenerated; new state is additive and backfilled in `migrateState`;
athlete-facing copy lands in BOTH i18n catalogs; "inspired, not cloned".

### Scalability ground rules (apply to every H epic)

- **Canonical units.** kg stays the ONLY stored unit everywhere (records,
  maxes, plates, tonnage). Unit preference (H1) is a display/input concern,
  never a data migration; anything else poisons history, the e1RM math, and
  the golden master.
- **Derive, do not duplicate.** Longitudinal analytics (H3) derive from
  `S.records` / `S.sessions` via pure, seeded `Engine` helpers (the
  `e1rmTrend` pattern), windowed by date. No parallel aggregate store that
  can drift. The ONE new persisted shape is the per-block landmark snapshot,
  because past landmark values are otherwise lost to evolution.
- **Versioned interchange.** Any new persisted or exported shape (unit
  preference, custom program templates in H7, a media manifest in H8)
  carries an explicit version and backfills in `migrateState`; template
  JSON gets a `schemaVersion` so a future import never guesses.
- **The scheme registry is the extension point.** H4 reshapes `jbb-hyp`
  internals; H6 adds a peaking scheme via `Engine.registerScheme`; H7
  templates may only REFERENCE registered schemes. Nothing ever forks
  `resolveSlot` or blends schemes.
- **Media stays out of the shell.** Exercise media (H8) never enters the
  sw.js SHELL cache: a separate size-capped cache, lazy fetch, emoji
  fallback. The app shell stays instant and offline-safe.

### ~~Epic H1 - Units and intensity display~~ DONE (2026-07-15)

Shipped as designed (see CHANGELOG). `profile.units` ('kg' | 'lb') and
`profile.intensityDisplay` ('rir' | 'rpe'), both additive + backfilled,
selectable on the FIRST onboarding step next to the language pick (owner
call) and in Settings under "Units and display". kg stays the only stored
unit: renders go out through `toDispW`/`dispW`/`fmtWU`/`fmtW`, inputs come
back through `fromDispW` (`Engine.kgToLb`/`lbToKg`). A unit switch moves
still-default equipment to the new unit's defaults (45 lb bar,
`DEFAULT_PLATES_LB` with lb-face colors, lb rounding/increment presets via
`UNIT_PRESETS`) and leaves customized values alone. Storage stays RPE; the
perf-modal stepper edits the displayed scale (`pmEffort`). New
`test/units.test.js` + an lb/RPE render-smoke pass; golden master
untouched. Note for later epics: the raw-state JSON export intentionally
stays kg (it is a backup, not a display surface); H3's macro report is
where display-unit export fields will matter.

### ~~Epic H2 - Onboarding completeness + check-in honesty~~ DONE (2026-07-15)

All five shipped in one branch (owner call: show, don't tell — compact UI,
no explanatory copy). See CHANGELOG for detail. Powerbuilding card restored
to `OB_TRACKS` with an onboarding-equals-golden-master parity smoke; a
one-chip readiness digest (score vs own 28-day baseline, tap for the trend)
replaced the hidden hero's void; injury flags ease the flagged lift's draft
(AMRAP off, -10%, +1 RIR) behind an amber strip with one-tap Swap and 🩹
session chips; bodybuilding check-ins ask soreness by the day's muscles
(`muscleSignal` reads muscle key first, pattern group fallback); and two
below-standard AMRAPs offer an athlete-confirmed WM reset to the implied
90% (`program.belowStd`, additive + migrated). `docs/hidden-ui.md` sections
1-2 updated. Tests: `test/h2.test.js` + parity smoke; golden master
untouched.

### ~~Epic H3 - Progress analytics + macro report~~ DONE (2026-07-15)

All six slices shipped (see CHANGELOG): `S.landmarkLog` per-block snapshots
(the one new stored shape, written by `recalibrateLandmarks`, additive +
migrated); a Progress screen (More hub) with the big-lift e1RM overlay,
per-muscle weekly-sets trend inside the MEV..MRV band of the time
(`Engine.actualWeeklySets` + `landmarksForBlock`), a PR feed, and pump +
recovery trends; and the macro-end report on the finished-program workout
tab (+ 🏁 from History): sessions/tonnage, start-to-finish e1RMs, AMRAP
history, MRV movement. Pure seeded Engine helpers, read-only, golden master
untouched. Landed before H4/H6 so snapshots accrue from now.

### ~~Epic H4 - Hypertrophy prescription depth~~ DONE (2026-07-15)

All three slices shipped (see CHANGELOG), bodybuilding-only via optional
scheme inputs (the `experience` threading pattern), golden master untouched:
`REP_RANGES` by movement + SFR (+2 per odd meso), band shown on the set row;
`Engine.doubleProgression` (reps climb in-band at the week's effort target
before weight climbs, from logged records) with DERIVED displayed effort
(`impliedRpe`, found by the prescription-sanity audit: the fixed ramp would
overstate a fresh weight jump); and `jbb-hyp.mainE1RM` (a swapped DB/machine
lead prices off its own e1RM, peaks on a rep-PR "× N+" top set; the AMRAP
survives only on the barbell WM anchor). Autoreg contract kept: sets =
autoreg, reps = double progression. NOT taken: flipping the generator's
default anchors to non-barbell (the swap now prices correctly, which is the
"may lead" contract; a default flip is an owner product call).

### ~~Epic H5 - Split editing + mid-macro re-spec~~ DONE (2026-07-15)

Shipped (see CHANGELOG): a split editor (rename days, move accessories
between days with mains/secondaries anchored, add/remove a day with
current-week completion re-keying, live per-muscle frequency chips + per-day
time estimates) editing the same `days[].slots[]` shape the generator emits;
and mid-macro focus re-spec via `program.pendingFocus` (transient), applied
by `endBlock` at the block boundary with wm/landmarks preserved and volAdj
resensitized as always.

### ~~Epic H6 - Meet prep: the powerlifting final state~~ DONE (2026-07-15)

Shipped (see CHANGELOG): per-block week counts (`block.weeks` +
`blockWeeks`/`weeksBefore`, closing Epic G2's open half; default math
byte-identical), a meet date on strength tracks planning backward with a
real 2-week `jm2-peak` taper placed last (registerScheme, isolation intact:
3/2/1/1 to a ~91% opener single, then a meet-week primer; no accessories,
no AMRAP), `Engine.attempts` (91/97/102% of own e1RM), and a meet-day
screen (attempt tiles + warmup ladder to the opener). Still open: warmup
TIMING on meet day (attempt tiles + rest hint shipped; a clock-driven
"warm up now" flow needs sport-aware scheduling's clock dependence).

### ~~Epic H7 - Custom programming platform~~ DONE (2026-07-15)

Shipped (see CHANGELOG): versioned template JSON (`schemaVersion: 1`, blocks
+ day/slot layouts only), Export/Import on My Program with full validation
against registered scheme ids / waves / the exercise catalog (reject the
rest, with the reason), `programFromTemplate` building a fresh program that
keeps the athlete's records/landmarks and recalibrates maxes, and the split
editor opened to every track (day-template-level builder). Boundary held:
templates configure schemes, set math stays code-level `registerScheme`.
Round-trip + reject battery + monster-template edge tests in
`test/h7-twoday.test.js`.

### Epic H8 - Exercise media (independent; content project more than code)

- **What:** a per-exercise visual (license-clean line art or short loops,
  our own or licensed assets, never scraped), keyed by exercise id in a
  small manifest; lazy-loaded into a separate size-capped cache (never the
  sw.js SHELL); the emoji placeholder stays the fallback so the library
  works media-less; custom exercises can attach their own image.
- **Why:** the emoji placeholder undermines an otherwise pro-grade library
  (720 bilingual cue sentences); every competitor ships demos, and text
  cues alone do not serve the less-experienced training partner.
- **Runs in parallel** with any other epic as assets become available.

### Folded into existing clusters (not new epics)

- **Nutrition-lite (-> Cluster F):** a target rate-of-change per phase and
  an alert when the bodyweight trend disagrees with the phase (extends the
  shipped sparkline; still explicitly NOT a macro tracker).
- **Per-exercise rest override (-> Polish list):** an optional per-exercise
  rest seconds, stored additively like `loadingProfiles` and read by
  `restSecFor`.
- **Pump history:** ships inside H3's analytics rather than as its own item.

### Dependency map + suggested order

```
H1 (units/display)   -- foundation; ship first, everything renders through it
H2 (onboarding/check-in) -- independent polish; small early branches
H3 (analytics/report)    -- needs only shipped Cluster A data; land early so
                            landmark snapshots start accruing
H4 (rep ranges + e1RM anchors) -- absorbs 2 pending items; feeds H5, sharpens E
H5 (split editing/re-spec)     -- needs the generator; better after H4
H6 (meet prep)   -- absorbs G2's per-block weeks; strength counterpart to H4
H7 (custom templates) -- capstone; needs G4 (shipped) + H6's per-block weeks
H8 (media)       -- independent, content-driven, parallel to anything
```

Suggested order: H1 -> H2 -> H3 -> H4, then H5 (physique track) and H6
(strength track) as parallel efforts, then H7; H8 runs alongside whenever
assets exist. One epic per branch group, one slice per branch, as usual.

## Internationalization (i18n) plan (owner request, 2026-07-08)

Goal: a language switch in Settings, and a translator workflow where one file is
copied and translated without touching app code. Designed for this codebase's
constraints: plain browser JS, no build step, PWA shell cached by sw.js.

**Status (2026-07-09): phase 1 (plumbing) and the two highest-exposure
phase-2 surfaces are SHIPPED** (branch `claude/translation-spanish-support`),
with Spanish as the first language: `app/i18n/` (i18n.js runtime, en.js source
of truth, es.js, translator README), `profile.lang` + Settings > Language,
sw.js SHELL caching, harness exports, and the guardrails below
(`test/i18n.test.js` + Spanish render-smoke passes). Extracted so far: the
live session view, rest timer, performance modal, warmup modal, session
rating, finisher UI, confirm-dialog defaults, and the full onboarding flow
(with `OB_TRACKS` / `OB_EXP` / `GOAL_ARCHETYPES` reduced to logic-only
tables).

**Queue for the next i18n branch (pick up here, in this order):**

1. ~~**Dashboard + workout overview surface**~~ DONE (2026-07-09, branch
   `claude/english-spanish-translation-cajw1r`): dashboard, timeline +
   week preview + plan editor + calibration explainer, early-deload banner,
   Weekly volume screen, Phase & bodyweight screen, workout overview, time
   banners/modal, check-in flow, swap/select/add pickers, and their toasts.
   `PHASES` replaced `PHASE_LABELS`/`PHASE_BLURB` (copy in `phase.*`);
   `CHECKIN_GROUPS`/`PLAN_TYPES`/`FEEL_WORDS`/`WEEK_FEEL_LEGEND` went
   logic-only; new `mv.*`/`head.*`/`sfr.*`/`equip.*`/`week.*` namespaces;
   `Engine.autoregVolume` gained an additive `reasonKey` so the volume
   screen translates recommendations at render. Also fixed the rest-timer
   bar overflowing with Spanish strings (label truncates, done state drops
   the redundant label). NOTE: `.claude/skills/copywriting/` (translation
   copy tooling) lives on this branch only; drop it before merging to main.
2. ~~**History, summary, More hub, exercise detail/library, remaining settings
   body**~~ DONE (2026-07-09, same branch): history + session detail, summary,
   More hub, My Program (now titled by the athlete's track), exercise library +
   custom-exercise modal, the full exercise detail modal, all settings sections
   + plate config, the boot error screen, and every leftover bare toast.
   Phase 2 is COMPLETE. Per-exercise coaching-cue TEXT (`EX_CUES`/`CUES`) was
   deliberately left English: cues are content like exercise names, so they
   belong to phase 4. ALSO: `es.js` is now **Latin American Spanish** (owner
   call, 2026-07-09); see the regional note in `app/i18n/README.md`. Keep new
   keys in that register; a Spain-Spanish `es-ES` can fork from git history
   (commit `85943f0`) if ever wanted.
3. ~~**Phase 3 (its OWN PR, golden master regenerates)**~~ DONE (2026-07-09,
   same branch): every scheme note-emission site emits `noteKey` (+
   `noteParams`); `setNoteText`/`displaySetNote` translate at render and
   legacy stored `note` strings render verbatim (no migration). Generated
   days store a structured `theme` (plus the legacy English `name` for
   back-compat) and `BB_DAY_TEMPLATES` days carry a `nameKey`; `dayTheme`
   prefers theme -> nameKey -> legacy name. Golden master regenerated; the
   reviewed diff is exclusively note -> noteKey/noteParams, zero
   weight/rep/set changes.
4. ~~**Phase 4 (optional)**~~ DONE (2026-07-09, same branch): `exDisplayName`
   layers `exn.<id>` keys over `EXERCISES` (fallback: the English data.js
   name; custom exercises never translate); all 148 names shipped in es.js;
   pickers/library/detail/search/sort/onboarding-maxes route through it and
   search matches both languages. The typo-net test validates `exn.*`
   against real exercise ids since these keys are deliberately not in en.js.
5. ~~**NEW: Spanish coaching-cue content.**~~ DONE (2026-07-13, phase 5,
   scope-expanded by owner request): the library first grew 31 exercises
   (148 → 179; machines incl. Smith/pendulum/abduction-adduction/assisted,
   calisthenics incl. muscle-up/dragon flag/Copenhagen plank, the first
   kettlebell exercises with proper single-implement loading, and gaps like
   DB pullover and Bayesian curl), all swap/add/library-pickable but in no
   generator pool, so existing routines are untouched. Then `exCues(e)`
   layers `cue.<id>_<n>` keys over `EX_CUES` (and `cues.<movement>_<n>` over
   the generic fallback), falling back to English per sentence; es.js ships
   all 720 sentences. The i18n typo net validates cue keys against the data
   and a coverage test pins full Spanish translation. A native-speaker
   review pass of the cue register is still welcome.

Conventions the shipped code established (follow them): keys are
`surface.snake_case` (`session.*`, `perf.*`, `ob.*`, shared `muscle.*` /
`unit.*` / `confirm.*`); render sites use `esc(t('key'))` unless the catalog
value deliberately carries HTML (only `tech.info_intro` today); params are
`{name}`-interpolated; data tables keep ids + logic, copy goes to the
catalogs; every new key lands in BOTH en.js and es.js (the completeness test
fails on extra keys, only warns on missing); no em dashes in values (tested);
new top-level functions go into the harness export shims.

### Architecture

- **One catalog file per language**: `app/i18n/en.js` is the source of truth,
  a flat map of stable keys to strings:
  ```js
  const I18N_EN = {
    'settings.title': 'Settings',
    'rest.done': 'Rest done. Next set.',
    'perf.rir.hint': 'RIR is how many reps you could still do. 0 is all out.',
    'onb.days.title': 'Training days',
    // ...
  };
  ```
  A translator copies `en.js` to `es.js`, translates VALUES only, never keys.
  Catalogs load as plain `<script>` tags before `data.js` (same pattern as the
  three app scripts) and register into one `I18N.catalogs` map; every shipped
  catalog is added to `SHELL` in sw.js so language switching works offline.
- **`t(key, params)` helper** (new `i18n.js`, ~40 lines, no dependency):
  lookup order is active language -> English -> the key itself (so a missing
  translation degrades to readable English, and a missing key is visible in
  dev). `{name}`-style placeholder interpolation from `params`. Plurals stay
  deliberately simple: explicit `_one` / `_other` key pairs chosen by the
  caller's count (no ICU engine; our strings are short and imperative).
- **Language setting**: `S.profile.lang`, default `'auto'` (resolve from
  `navigator.language`, fall back to English). A Settings > Language select
  lists the registered catalogs. Additive + backfilled in `migrateState`.
- **Dates and numbers**: the code already uses `toLocaleDateString`; pass the
  resolved language instead of `undefined` so dates follow the app language,
  not just the device. Weights stay numeric (kg), untouched.

### Migration strategy (phased, each phase shippable)

1. **Plumbing** - `i18n.js` + `en.js` + the Settings switch + `t()` exported
   through the test harnesses. Nothing translated yet; zero visible change.
2. **Extraction by surface**, highest athlete exposure first: session view and
   perf modal -> onboarding -> dashboard/workout -> settings/detail modals ->
   toasts. Mechanical `'text'` -> `t('key')` moves, reviewable per PR. Labels
   living in data tables (`PUMP_LABELS`, `PHASE_LABELS`, `TECHNIQUE_LABELS`,
   `FEEL_WORDS`, `RPE_DESCRIPTIONS`, day-theme names) become key lookups so
   the tables stay logic-only. Code comments and console output stay English.
3. **Stored-string decision (the one engine-touching step)**: prescribed set
   NOTES (e.g. 'Calibration · top set', 'Deload, move well and recover') are
   currently English strings baked into set objects, persisted in
   records/sessions, and part of the golden master. Going forward the engine
   should emit a `noteKey` (+ params) and the UI translate at render; legacy
   saved `note` strings keep rendering verbatim (no data migration). This
   changes `resolveSlot` output, so it is its OWN deliberate PR with a golden
   master regeneration and review - do not fold it into the mechanical phases.
4. **Exercise names** (optional, later): a `i18n` key per exercise id layered
   over `EXERCISES`; untranslated ids fall back to the English name. Custom
   exercises are user text and never translated.

### Guardrails

- A **catalog completeness test**: every non-English catalog's key set is
  compared against `en.js`; missing keys are listed (warning, not failure -
  runtime falls back to English) and unknown/extra keys fail (typo net).
- The **no-em-dash lint** extends to catalog files (athlete-facing strings).
- **render-smoke runs once under a non-English catalog** with a probe key, so
  a crash on a missing key or bad interpolation is caught in CI.
- Translator docs: one short `app/i18n/README.md` (copy `en.js`, rename,
  translate values, keep placeholders like `{name}` intact, send the file).

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
- **Per-exercise rest override** (from the 2026-07 athlete feedback): an
  optional rest-seconds field per exercise, stored additively like
  `loadingProfiles` and read by `Engine.restSecFor`, so one lift can rest
  longer than its kind's default without touching the global time model.
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


## iOS App Store build (far future)

Paving the way to ship IRONWAVE as a real iOS app. The app is a no-build PWA, so
the realistic path is to **wrap the existing PWA in a thin native shell** (Capacitor
or PWABuilder generate an Xcode/WKWebView project around `app/`) and submit that,
rather than a native rewrite. The engineering for that wrapper is its own future
branch; THIS section is the checklist of things the OWNER must do that are
**outside coding scope** - accounts, subscriptions, purchases, legal, and assets.
None of it can be done from this repo. Rough order:

### Accounts & subscriptions (do first, some have lead time)
- [ ] **Apple Account (Apple ID)** for the business, with **two-factor auth** on.
      Use a dedicated email you control long-term, not a personal throwaway.
- [ ] **Apple Developer Program membership - paid, ~US$99/year** (the gate for
      App Store distribution, TestFlight, signing, and App Store Connect). Renews
      annually; lapsing pulls the app from sale.
- [ ] **Decide the seller identity: individual vs organization.** Individual shows
      your personal/legal name as the seller; organization shows a company name but
      **requires a D-U-N-S number** (free from Dun & Bradstreet, allow ~5-30 days)
      and a legal entity. Pick before enrolling - changing later is painful.
- [ ] **A Mac with Xcode**, OR a **cloud-Mac / CI build service** (e.g. Xcode
      Cloud, Codemagic, MacStadium, MacinCloud). Xcode only runs on macOS and is
      required to archive/sign/upload. This is a real hardware-or-subscription cost
      if you do not own a Mac.

### Legal & business
- [ ] **Privacy Policy** (a public URL is **required** by App Store Connect even if
      you collect nothing). Must describe local storage + any self-hosted server.
- [ ] **Terms of Use / EULA** - Apple's standard EULA is fine unless you need
      custom terms.
- [ ] **Health/fitness disclaimer** - the app prescribes training loads; add a
      "not medical advice, train at your own risk, consult a professional" notice
      (helps with App Review guideline 1.4.1 and limits liability).
- [ ] **Name / trademark clearance for "IRONWAVE"** - confirm the App Store name is
      available and the mark is not already taken in the fitness category. Have a
      backup name ready (App Store names must be unique).
- [ ] **Tax & banking in App Store Connect** - accept the (free) **Apps
      Agreement**; if you ever charge or add in-app purchases, also the **Paid Apps
      Agreement** plus tax forms (W-9 / W-8BEN) and bank details. A free app still
      needs the free agreement accepted.
- [ ] **Export compliance** - the app uses standard HTTPS encryption, which is
      normally **exempt**; you still answer the encryption questions per release
      (usually self-classified exempt, no extra paperwork).

### App Store Connect setup & assets (mostly clickwork + design)
- [ ] **App record + bundle identifier** (e.g. `com.<you>.ironwave`) in App Store
      Connect / the Developer portal. Pick the bundle ID once; it is permanent.
- [ ] **App icon 1024x1024** (no alpha/transparency) and the in-app icon set.
- [ ] **Screenshots** for the required iPhone sizes (and iPad if you ship iPad).
      Capture from the wrapped app on a simulator/device.
- [ ] **Store listing copy**: name, subtitle, description, keywords, **support
      URL**, optional marketing URL.
- [ ] **Age rating questionnaire** and **App Privacy "nutrition label"** answers
      (declare local-only storage / any server sync; likely "data not collected"
      or "not linked to you").
- [ ] **App Review notes + demo path** - if a server login is involved, provide a
      **demo account / test instructions**; reviewers must reach full functionality.

### Known review risk to plan around (coding-adjacent, flagged here so it is not a surprise)
- Apple **guideline 4.2 "minimum functionality"** can reject a pure website
  wrapper. To pass, the shell should add native value - e.g. local **push
  notifications** for the rest timer, real offline behavior, and proper
  home-screen / status-bar integration - not just load a web page. Budget that
  into the wrapper branch. (Push notifications also need an **APNs key** generated
  in the Developer portal - another portal checkbox, not code.)

### Nice-to-haves once live
- [ ] **TestFlight** beta group (included with the Developer Program) before public
      release.
- [ ] Decide on **analytics/crash reporting** (and disclose it in App Privacy if added).


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

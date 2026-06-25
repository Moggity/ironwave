# IRONWAVE — Changelog

## [Cluster B: giant sets + alternating session UI] (2026-06-25)

Completes the supersets feature. Bodybuilding-track-only and additive
(`slot.superset` absent by default), so the Powerbuilding golden master is
byte-identical. Bumped `APP_VERSION`/`CACHE_VERSION` to `1.1.7`.

- **Giant sets (3+).** A maximal run of consecutive accessories linked by the
  `superset` flag is one group; `resolveDayEntries` tags every member with its
  group head, index, size and member names. `estimateSessionSec` charges 1/size
  the rest per supersetted set (half for a pair, a third for a triple). The
  overview toggle now allows chains (link/unlink each accessory to the next); the
  link badge reads "superset" or "giant set".
- **Alternating session UI.** A superset group renders as one combined card with a
  per-member controls strip (swap / info / finisher / notes) and the work logged
  ROUND by round (one set of each member, then rest). Each cell opens the same
  perf modal, so logging is unchanged underneath. Non-grouped exercises render as
  before (`liftCardHTML` / `setRowHTML` extracted, `supersetGroupCardHTML` added).
- **Cap keeps a group together.** The time-cap core/optional split now treats a
  superset group as one unit (scored by its strongest member), so a pair / giant
  set is kept or dropped as a whole instead of being split across the tiers.

## [Cluster B: supersets (first slice)] (2026-06-25)

Bodybuilding-track-only and additive (`slot.superset` absent by default), so the
Powerbuilding golden master is byte-identical. Bumped `APP_VERSION`/`CACHE_VERSION`
to `1.1.6`.

- Pair an accessory with the NEXT accessory on a day (alternating, one shared rest
  per round). `resolveDayEntries` tags both resolved entries head/tail with the
  partner name; `estimateSessionSec` charges a shared rest (half per supersetted
  set) so a supersetted day estimates shorter and fits more under a time cap. The
  workout overview gains a per-accessory **Superset / Unlink** toggle
  (`supersetLayout` / `toggleSuperset`), and both the overview and session cards
  show a link badge. Pairs only in this slice (a consumed tail cannot start a new
  pair, so no giant-set chains); the full alternating session-logging UI and giant
  sets remain follow-ups.

## [Timer chime uses the WAV/media-channel path] (2026-06-25)

App/UI only, no engine change, golden master untouched. Bumped
`APP_VERSION`/`CACHE_VERSION` to `1.1.5`.

- The rest-timer chime now plays through the `<audio>`-element WAV path
  (`playHtmlAudio`) instead of synthesized Web Audio. On the installed iOS PWA the
  Web Audio chime was silent (it rides the ringer channel the hardware mute switch
  cuts) while the media-channel `<audio>` element is audible, confirmed via the
  Settings > Debug chime tester. Web Audio remains a fallback where the media
  element is unavailable.
- Added `primeHtmlAudio`: a near-silent `<audio>` play on the first gesture and on
  starting a rest/mini-rest timer, so the media channel is unlocked and the chime
  (which fires later, outside any gesture) is allowed to sound on iOS.
- The Settings > Debug chime tester is kept, for trying other sounds later.

## [Cluster C: pattern-movement head attribution] (2026-06-25)

Bodybuilding-track-only, read-only (not on the prescription path), so the
Powerbuilding golden master is byte-identical. Bumped `APP_VERSION`/`CACHE_VERSION`
to `1.1.4`.

- Completes the per-head volume split: heads tagged on PATTERN movements (`bench`
  / `press` / `deadlift`, which carry no landmark of their own) are now attributed
  to the muscle they build instead of being skipped. New `HEAD_MUSCLE` rollup map
  + a shared `exHeadAttribution` helper apply the same `SYNERGIST_COVERAGE`
  fraction the muscle bar uses, so the head numbers stay consistent with the
  (fractionally attributed) muscle bar. Chest now splits into upper / mid-lower
  (upper chest used to be invisible because incline work rides the bench pattern);
  shoulders pick up front-delt from the press pattern; hamstrings pick up
  hip-flexion from the deadlift pattern. `weeklyVolumeByHead` and `muscleHeads`
  share the one rollup, so the per-head landmarks and the over-MRV hints track it.

## [Hypertrophy B/C/D slices: partials, per-head landmarks, deload refinements] (2026-06-25)

Three bodybuilding-track-only slices in one branch; all inert off the track and on
a fresh program, so the Powerbuilding golden master is byte-identical. Bumped
`APP_VERSION`/`CACHE_VERSION` to `1.1.3`.

- **Cluster B / Epic 2 - lengthened partials.** A fourth finisher, end-to-end:
  `Engine.buildPartials` (one same-weight partial burst in the stretch) reuses the
  shared child-set plumbing; a `partials` chip joins the "Add a finisher" row;
  `TIME_MODEL.partialsSec` / `techTransitionSec` charge the small slowdown.
  Partials ride the working weight (`SAME_WEIGHT_TECHS`) but get no timed rest cue
  (a new `TIMED_REST_TECHS` gates the perf-modal mini-rest button, since partials
  flow straight out of the set). New `test/cluster-b-partials.test.js`.
- **Cluster C / Epic 3 - per-head MEV/MRV landmarks.** `Engine.headLandmark`
  derives a per-head target by an even split of the muscle landmark across its
  heads (floored, capped at the whole-muscle MRV; single-head movements are a
  no-op). The Weekly-volume "Regions" line flags a head over its per-head MRV in
  amber, and the swap/add pickers show a "<region> maxed" hint on a candidate whose
  head is already at/over its per-head MRV this week. Meaningful for the
  multi-head landmark muscles (triceps / biceps / delts / hamstrings); pressing-
  pattern heads (upper chest, front delt) remain a documented follow-up.
- **Cluster D / Epic 4 - deload-depth refinements.** (1) `autoregForAccessory` no
  longer ADDS volume on the deload week (a positive `volAdj` offset is suppressed
  so it stops fighting the deload pullback; a negative offset still passes). (2)
  `Engine.deloadDepth` now carries an `rpeDelta`: a deeper deload eases effort by
  one RIR as well as a set (`deloadIntensityDelta` / `applyDeloadIntensity`,
  clamped to >= RPE 5), so a deep deload pulls back volume and intensity.

## [Add/swap time tiers + dashboard phase chip] (2026-06-25)

App/UI only, no engine or prescription change, golden master untouched. Bumped
`APP_VERSION`/`CACHE_VERSION` to `1.1.2`.

- Time tiers: an exercise the athlete explicitly adds (`slot.added`) now falls to
  the optional tail before any pre-existing default accessory. Previously adding
  an exercise to a time-capped day could push a default synergist accessory to
  optional instead of the discretionary add. `resolveDayEntries` sorts added
  accessories last; covered by a new focus-generator test.
- Swap picker now reads as a swap, not an add. On a swap (replacing an existing
  exercise) the per-candidate time tag shows the NET change vs the outgoing
  exercise ("same time", "+2 min", "−1 min") instead of the full additive cost,
  and the outgoing exercise's muscle head counts as covered so a like-for-like
  swap no longer shows a misleading "Adds <region>" badge. Select (placeholder)
  slots keep the additive framing, since those genuinely add work.
- Dashboard: removed the redundant "Phase" chip on the bodybuilding track, where
  the Weekly-volume overview already shows the phase with a change link. Other
  tracks keep the chip (their only access point).

## [Render error boundary + chime debug] (2026-06-25)

App-wide, no engine or prescription change, golden master untouched. Bumped
`APP_VERSION`/`CACHE_VERSION` to `1.1.1` so installed PWAs fetch this build.

- Render error boundary: `render()` and `boot()` now catch a thrown view and
  paint a recovery screen (`renderErrorScreen`) with the actual error, a Reload,
  an Export backup, and a Check for updates button. Previously a throw left
  `#app` empty, which on a standalone PWA shows as a blank/black screen with no
  way out. The screen now self-reports the cause for diagnosis, and a stale
  cached build (a common cause) is fixable in place.
- Settings > Debug: a "timer chime" section with one button per config
  (`CHIME_CONFIGS` / `playTestChime`) so a device that hears nothing in the PWA
  can be tested live. Covers the current Web Audio sine, a louder square, an
  `<audio>`-element WAV path (`buildBeepWavUrl`, media channel rather than the
  ringer-muted Web Audio channel), a louder/longer WAV, and a vibrate-only
  baseline. Diagnostic aid for the iOS standalone silent-chime case.

## [App version marker + iOS PWA timer sound] (2026-06-24)

App-wide, no engine or prescription change, golden master untouched.

- Added `APP_VERSION` (`data.js`, single source of truth), shown in the More hub
  footer and a new Settings "About" section, with a "Check for updates" button
  (`checkForUpdate`) that asks the service worker to fetch a newer build and
  reloads when one installs. So the running build is now visible and verifiable.
- Service worker: bumped `CACHE_VERSION` to `ironwave-shell-v1.1.0` (keep in step
  with `APP_VERSION`) and switched the shell fetch from cache-first to
  stale-while-revalidate, so an installed PWA refreshes its cached code in the
  background instead of being pinned to a stale build between version bumps. Still
  launches offline from cache.
- Timer chime now sounds in the iOS standalone PWA: `primeAudio` plays a
  one-sample silent buffer to truly unlock the Web Audio context (resume() alone
  is not enough on iOS), and `boot` unlocks on the first touch/click so the chime
  works regardless of which control started the timer. Note: iOS still mutes
  synthesized audio when the hardware ringer/silent switch is on; the vibrate
  fallback covers that case.

## [Early (autoregulated) deload timing] (2026-06-24)

Cluster D / Epic 4: the deload can now be pulled in *before* the scheduled week 5
when accumulated fatigue says so, instead of always grinding the full meso.
Bodybuilding-only and inert by absence, so the Powerbuilding golden master is
untouched.

- `Engine.earlyDeloadAdvised(statuses, trendDown)` decides mid-block whether to
  advise an early deload, from the same fatigue read as the depth sizing
  (`fatigueSaturated` + readiness trend): saturated, or several muscles near MRV
  with readiness sliding.
- The dashboard surfaces a suggestion banner on a mid-block work week
  (`earlyDeloadBannerHTML`); accepting (`acceptEarlyDeload`, behind a confirm)
  marks the week (`P().earlyDeload`, transient like `deloadPlan`, no migration)
  and sizes the deload depth. `resolveSlot` remaps that one week to the deload
  slot (`effectiveWeekIdx`) so the scheme prescribes it exactly like a scheduled
  deload; `advanceWeek` then ends the block early, resensitizing (offsets reset to
  MEV) and rolling to the next block. The block-end logic is extracted to a shared
  `endBlock` so a scheduled and an early deload resensitize identically. The
  athlete can `cancelEarlyDeload` (resume the normal block) until they complete the
  week.
- Timeline + volume dashboard: the early-deload week wears a denser amber hatch
  (`.tl-bars i.deload-early`) distinct from the routine deload weave, and the weeks
  it skips are dimmed (`.skipped`); the volume screen shows an "Early deload this
  week" note. On a deload week the per-muscle volume bars are also textured
  (`.vol-fill.deload-tex`, amber `.deload-early` for an early deload) so the athlete
  sees at a glance that every muscle is pulled back this week.
- Tests: `test/early-deload.test.js` (engine decision, the resolveSlot remap and
  its off-track inertness, and the block-end resensitization). Golden master
  unchanged.

## [Perf-modal RIR stepper fix + timer chime] (2026-06-24)

- Fixed the performance modal's RIR stepper "jumping" mid-tap. The effort
  description under the RIR +/- buttons (`RPE_DESCRIPTIONS`) wrapped to a
  different number of lines as the value changed; since the modal is
  bottom-anchored and grows upward, that height change shifted the buttons out
  from under the athlete's finger, so rapid taps landed on neighbouring controls
  (or fell through to the screen behind the modal) and appeared to refuse further
  steps. `.rpe-desc` now reserves two lines (`min-height`), so the layout is
  stable while stepping RIR.
- Added a brief, gentle two-tone chime when the rest timer (and the technique
  mini-rest / pause) finishes, alongside the existing vibrate. Synthesized via
  Web Audio (`playChime`), so no audio asset ships; primed on a user gesture
  (`primeAudio` when a timer starts) so mobile browsers allow it. Silent where
  audio is unavailable.

## [Installable offline PWA] (2026-06-24)

IRONWAVE is now a Progressive Web App that installs to the iPhone home screen and
runs fully offline, so it is usable at a gym with no internet. The phone is the
source of truth for data.

- `manifest.json` (standalone display, theme colors, icon set) and `sw.js`, a
  cache-first service worker that precaches the app shell (`index.html`, the
  three scripts, `styles.css`, icons) so the app launches with no network. The
  worker never intercepts `/api/state`, so a reachable server still works.
- `index.html` links the manifest + `apple-touch-icon` and registers the service
  worker (guarded to `http(s)` and supported browsers).
- Branded wave icons (`icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`)
  generated on-theme (blue/amber waves on the dark navy background).
- Persistence is now on-device first: `save()` writes state to `localStorage`
  (durable, synchronous, offline) and only mirrors to the server best-effort; a
  failed mirror while offline is silent and is not data loss. `loadState()` reads
  `localStorage` first, falling back to the server only to seed a fresh device,
  then adopts that copy locally. Removed the dead pre-server `LS_KEY` constant.
- Backups still use the in-app **Export / Import JSON** (now the recommended path
  since data lives on the device). No engine or prescription math changed; the
  golden master and full suite stay green.

## [Mid-session exercise swap] (2026-06-24)

A swap button on each in-session exercise card, so an athlete can change a lift
mid-workout when a machine is busy or the equipment is not available (the report
was a fixed-dumbbell goblet squat that could not be loaded).

- A `⇄` button sits next to the `ⓘ` in the session card's head actions, opening the
  existing Swap Exercise picker (`openSwap`) for that day/slot.
- `doSwap` now rebuilds the affected live draft entry when a session is in progress
  (the draft is a snapshot taken at session start), so the new exercise shows
  immediately. Any logged sets on the swapped slot reset, which is correct since it
  is a different lift; other entries keep their progress.
- The entry build is extracted to a shared `sessionEntryFrom` helper used by both
  session start and the swap rebuild.
- Tests: `render-smoke.test.js` gains a mid-session swap integration case per track
  (the live entry rebuilds to the chosen exercise, sets reset); the smoke harness
  surface exposes `doSwap`/`exById`/`allExercises`.

## [Realism pass: archetypes, beginner safety, peak taper] (2026-06-24)

A correctness/realism pass over the new macrocycle features after simulating
routines across tracks, experience levels, archetypes and lengths. Aligns the
auto-generated plans with established training practice (beginners recomp rather
than aggressively cut; intensity techniques and minicuts are intermediate/advanced
tools; you cannot cut hard indefinitely). All bodybuilding/display-side; the
golden master is unchanged (170 tests pass).

- **New "Look good (recomp)" archetype** (`recomp`): lean-gain blocks finishing on
  a cut (the build-then-lean middle ground from the early mockup). It is now the
  default bodybuilding archetype, since recomposition suits most lifters and is the
  right call for newer ones who can build and lean at once.
- **Look lean ASAP** now interleaves a **maintenance diet break** every third block
  (`['minicut','cut','maintenance']`), so a longer aggressive plan is no longer one
  unbroken deficit. It also carries a prominent onboarding **warning** that it is an
  aggressive deficit best for a leaner intermediate/advanced lifter, pointing newer
  lifters to recomp.
- **Beginner technique safety:** `Engine.scheduledTech` is experience-aware. A
  beginner is never auto-scheduled myo-reps or drop sets (build a base on straight
  sets first); an advanced lifter gets the myo from meso 0; intermediate is
  unchanged. `scheduledTechForBlock` reads the athlete's experience.
- **Peak taper:** a strength-ending track (powerlifting / powerbuilding) now marks
  its final block as `peak` (`markPeakBlock`, creation-time only), so the run-in to
  the meet reads as Peak on the timeline, matching the mockups. Migration stays
  conservative and the plan editor still lets the athlete set phases by hand.
- Tests: `test/timeline.test.js` gains recomp, lean-asap diet-break, beginner/
  advanced technique gating, and peak-taper cases. Golden master + render-smoke
  unchanged.

## [Epic G4: block plan editor] (2026-06-24)

A "+" tile at the end of the macrocycle timeline opens a "Customize blocks"
editor, so the athlete can plan the future of their macro by hand. Edits only the
future, so training history is preserved; display/plan only, no prescription-math
change, golden master unchanged (164 tests pass).

- `lockedPlanCount` finds the leading blocks that have been trained (past blocks,
  plus the current one once any week/day in it is logged); those are shown locked.
- The editor (`openPlanEditor`/`renderPlanEditor`) holds a draft of the editable
  blocks in `V.planDraft`. Each row edits type (Hypertrophy/Strength, which sets
  the scheme + valid waves), wave, and phase; rows reorder (↑/↓), remove (✕), and a
  "+ Add block" appends. A live "N blocks, ~W weeks total" summary updates as you go.
- `commitPlan` keeps the locked blocks verbatim, appends the draft (deep-cloned),
  re-stamps mesoIdx + phase + labels (`relabelBlocks`), and recomputes `testDate`
  from the new block count (startDate preserved).
- Tests: `test/timeline.test.js` gains relabelBlocks, commitPlan (keep/append/
  restamp/date) and a no-mutate-source case. Golden master + render-smoke unchanged.

## [Epic G6: hypertrophy goal archetypes] (2026-06-24)

A bodybuilding-only onboarding fork that shapes the macrocycle to the athlete's
goal. Inert on other tracks, so the golden master is unchanged (161 tests pass).

- `GOAL_ARCHETYPES` (data.js): "Serious muscle macro" (long, lean-gain/gain with
  periodic minicuts, finishing on a cut) and "Look lean ASAP" (short 12wk, minicut
  into a cut). Each carries a default length and a per-block `phaseCycle`.
- A "What is your goal?" card pair appears on the onboarding goal step only when
  the Hypertrophy track is selected (`obArchetype` seeds the matching length;
  athletes can still override the length presets).
- `applyArchetypePhases` overwrites the blocks' phases from the chosen cycle
  (bodybuilding-only call site in `makeProgram`). The first block's phase seeds
  `profile.phase`, so the Cluster F autoregulator knows a lean-fast plan starts in
  a deficit; the G5 timeline markers adapt automatically (deficit blocks hold the
  myo, keep the drop).
- Tests: `test/timeline.test.js` gains archetype cases (phase cycling, no-op on
  unknown / non-bb track, lean-asap shape). Golden master and render-smoke
  unchanged.

## [Epic G2 + G5: variable macrocycle length + technique periodization] (2026-06-24)

Two more slices of the gym-side planning epic group. Both keep non-default tracks
no-ops on the default path, so the golden master is unchanged (157 tests pass).

- **Variable macrocycle length (G2, block-count slice).** A "Program length"
  choice on the onboarding goal step (`ob.macroWeeks`: Standard / 12 / 18 / 24 /
  36 wk). When set, `makeProgram` rebuilds the block list with `extendBlocks`
  (cycle the template pattern to `blocksForWeeks` blocks, renumber per-type labels,
  re-stamp mesoIdx + phase); `testDate`/`daysOut`/the timeline all derive from it.
  No choice keeps the template verbatim, so the default program is byte-identical.
  Variable per-block week count stays future work (a scheme-level change).
- **Technique periodization + markers (G5).** `Engine.scheduledTech(weekIdx,
  mesoIdx, {deficit})`: our own simple schedule placing a drop set on each meso's
  realization week and a myo-rep week in intensification once adapted
  (mesoIdx >= 1), held back in a deficit, none on intro/accumulation/deload.
  `scheduledTechForBlock` gates it to bodybuilding hypertrophy blocks. Surfaced as
  ◆ (myo) / » (drop) markers on the timeline bars (with a legend) and a "Finisher
  this week" note in the week preview. Display-first: it does NOT change
  prescription; the athlete still opts a finisher in per session.
- Tests: `test/timeline.test.js` gains G2 (blocksForWeeks/extendBlocks/makeProgram
  length) and G5 (scheduledTech rules, bb-only gating) cases. Golden master and
  render-smoke unchanged.

## [Epic G1 + G3: per-block phase model + macrocycle timeline v2] (2026-06-24)

First slice of the "gym side final state" planning epic group (see
`docs/pending-future-work.md`). Surfaces the macrocycle as a phase-aware timeline.
Additive and display-only, so prescription and the golden master are unchanged.

- `block.phase` (lean-gain / gain / maintenance / cut / minicut / peak): a new
  additive, optional field. `stampBlockPhase` backfills it from the block type
  (hypertrophy -> lean-gain, strength -> maintenance, peaking -> peak) at program
  creation and in `migrateState` (idempotent, respects an explicit phase). It does
  NOT yet feed prescription; the global `profile.phase` still drives the
  autoregulator. Wiring per-block phase into `autoregVolume` is a later G-epic.
- Phase taxonomy extended: `PHASE_LABELS`/`PHASE_BLURB` gain `gain` and `peak`
  entries; new `PHASE_COLORS` (our own palette) and `DEFAULT_BLOCK_PHASE` in
  `data.js`. The Cluster F phase picker keeps its fixed four-option list, so its
  behavior is unchanged.
- `timelineHTML` rewritten to v2: blocks grouped into phase-tinted containers with
  a phase label, week bars colored by training emphasis (`barColorFor`: strength
  orange, deficit teal, peak red, else hypertrophy blue), deload weeks hatched,
  the current week glowing, past weeks dimmed, and a legend listing only the
  emphases present. New `.timeline-v2` / `.tl-block` / `.tl-bars` styles.
- Tests: `test/timeline.test.js` (phase backfill, idempotency, the emphasis-color
  rules, label/color completeness) and a phase-backfill assertion in
  `test/migration.test.js`. Golden master and render-smoke unchanged (151 pass).

## [Cluster D: autoregulated deload depth + resensitization] (2026-06-23)

Makes the deload respond to accumulated fatigue instead of a fixed halving, and
resensitizes volume back to MEV when a block ends. Bodybuilding-only and inert
without a fatigue signal, so the default/powerbuilding routine and the golden
master are unchanged.

- `Engine.deloadDepth(statuses, trendDown)`: sizes the deload from how saturated
  the athlete is (muscles at/near MRV via `fatigueSaturated`) and whether
  readiness is trending down. A fried athlete deloads DEEPER (one fewer set on top
  of the scheme's already-halved deload), a fresh one LIGHTER (one more set);
  "light" needs positive low-fatigue evidence, so no data defaults to standard.
- `advanceWeek` computes the plan as the athlete enters the deload week (pointer
  still on the peak week, so `resolveSlot` stays pure and just reads
  `P().deloadPlan`), and on block end resensitizes by resetting `P().volAdj` to 0
  and clearing the spent plan.
- `resolveSlot` applies the plan's set delta to a bodybuilding accessory on the
  deload week only (via `deloadDepthDelta`); off-track / off-week / no-plan is
  byte-identical.
- The Weekly volume screen shows a "Deeper / Lighter deload" note on the deload
  week explaining the sizing and the resensitization.
- Tests: `test/cluster-d-deload.test.js` (depth decisions, the no-data default,
  resolveSlot application + inertness, resensitization on block end, plan stored
  on entry). Golden master unchanged; full suite green.
- Still open in Cluster D (own branches): early-deload TIMING (trigger the deload
  before week 5 on mid-block MRV saturation, a block-engine change), a fatigue
  trend chart, and the zero-sum budget + specialization phase.

## [Calibration redesign: RIR-first, reduced-fatigue ramp] (2026-06-23)

Reworks the calibration ramp (the weightless feeler sets prescribed when there is
no working max / e1RM yet) to read in RIR and cost less fatigue. NOT
bodybuilding-only: calibration is on the shared `prescribeMain` / secondary /
accessory paths, and the uncalibrated Powerbuilding snapshot IS the calibration
ramp, so this deliberately regenerates the golden master. Only the weightless
calibration sets change; every prescribed-weight set is byte-identical (the diff
carries zero weight changes), and the calibrated snapshot is untouched.

- `Engine.calibrationRamp(baseReps, experience)`: one shared ramp. Reps DESCEND
  `R, R-2, R-4` floored at 3 (a moderate top set estimates e1RM better than a
  high-rep one and the conversion degrades past ~10 reps; the floor avoids a
  near-max single on a cold lift). Effort reads in RIR 4 / 3 / 2 (RPE stays the
  stored value, rir = 10 - rpe). Beginners stop at RIR 3, never close to failure
  on a guessed weight.
- Removes the inflated lead-in: the accessory ramp was 14/12/12 at RIR 5/3/2 and
  is now 12/10/8 at RIR 4/3/2; a 10s main goes 10/10/10 -> 10/8/6; a 5s main
  5/5/5 -> 5/3/3.
- `experience` is threaded through the scheme `main/secondary/accessory` entry
  points and `resolveSlot` reads `S.profile.experience`; default (intermediate)
  is RIR 4/3/2, so existing programs and the golden master use that.
- Tests: `calibrationRamp` cases in `engine.test.js` (descending reps, floor,
  RIR targets, beginner cap, routing through all three prescribe paths); golden
  master regenerated and reviewed (calibration-only, no weight changes).

## [Cluster C/D: per-head volume breakdown] (2026-06-23)

Bridges Cluster C heads into the Cluster D volume dashboard: each muscle row now
shows a per-head split of its direct work, so an athlete can spot a region they
are under- or over-training (e.g. all upper chest, no mid/lower). Read-only and
golden-master-safe; surfaced on the bodybuilding track.

- `weeklyVolumeByHead()`: nests head-tagged working sets under each muscle, using
  the same set count the exercise contributes to `weeklyVolumeByMuscle` (so the
  head numbers stay consistent with the muscle bar). Direct accessories only;
  headed compounds (attributed fractionally by coverage) are not split.
- The Weekly volume screen renders a "Regions: <head> n · ..." line under a
  muscle when it has head-tagged work.
- Tests: `weeklyVolumeByHead` cases in `test/cluster-d.test.js` (consistency with
  the muscle tally, headless exercises add no bucket, compounds are not split).
  Golden master unchanged; suite green.

## [Cluster C: head-aware swap ordering] (2026-06-23)

Extends the swap picker's SFR ordering so it also fills muscle-head gaps. On an
accessory swap, candidates that cover a head the current day is missing are
surfaced first (after the athlete's familiar lifts, ahead of the raw SFR bias),
each flagged with an "Adds <head>" hint. Bodybuilding-data-driven but harmless
elsewhere; swap is athlete-initiated and never touches `resolveSlot`, so the
golden master is unaffected.

- `dayHeadsCovered(di, exceptSi, cat)`: the heads already trained on a day for the
  swapped slot's movement group (that slot excluded).
- Swap ordering: used -> fills-a-gap -> higher SFR -> name. The recommended cards
  show an "Adds <head>" badge when the exercise covers a missing region.
- Tests: `dayHeadsCovered` case added to `test/cluster-c-selection.test.js`.
  Golden master unchanged; suite green.

## [Cluster C: head/SFR-aware selection + cross-meso rotation] (2026-06-23)

The selection slice of Epic 3, now that the head/SFR data shipped: the generator
and swap picker actually consume `head` / `sfr`. Bodybuilding-only and inert on
other tracks, so the default/powerbuilding routine and the golden master are
unchanged.

- `pickAccessory(pool, used, usedHeads, rot)`: shared head-aware selection. It
  prefers the first unused exercise covering a head not yet hit for that muscle
  (so a 2-3x muscle spreads across regions, e.g. upper then mid/lower chest),
  falling back to any unused, then the pool head. `rot` rotates the pool start.
- Generator: `generateBodybuildingDays` now picks accessories head-diverse per
  muscle instead of taking the pool in fixed order.
- Cross-meso rotation: on advancing to a new block, each generator-default
  bodybuilding accessory rotates to a fresh head-diverse pick from its muscle
  pool (offset by the meso index), kept distinct per day. Athlete swaps and other
  tracks are untouched. Hooks into the existing block-advance slot rebuild.
- Swap picker: on accessory slots, recommended candidates are ordered by SFR
  (higher stimulus first) after the athlete's familiar lifts; the SFR / head /
  stretch badges from the data slice explain the pick. Main slots (wave-math
  variations) are not SFR-biased.
- Tests: `test/cluster-c-selection.test.js` (pickAccessory head-diversity +
  rotation, generator head coverage, block-advance rotation, off-track inertness).
  Golden master unchanged; suite green.

## [Cluster B: rest-pause + finisher UI consolidation] (2026-06-23)

The third Epic 2 technique, plus a UI tidy now that there are three finishers.
Like myo-reps, rest-pause keeps the working weight (a set to failure, then short
bursts after an intrinsic pause), so it rides the shared child mini-set plumbing;
only the construction params and the pause length differ. Bodybuilding-only and
opt-in, so the default/powerbuilding routine and golden master are unchanged.

- `Engine.buildRestPause(set, opts)`: working set + `RESTPAUSE_DEFAULTS` bursts
  at the same weight. Pure; weightless / zero-burst sets unchanged, no mutation.
- `Engine.techTransitionSec(tech, TM)`: single source of truth for a technique's
  intrinsic intra-set rest (drop strip / myo mini-rest / rest-pause pause), used
  by both `setTimeSec` and the in-modal cue. A rest-pause burst now charges
  `TIME_MODEL.restPauseSec`.
- Finisher UI: the per-technique chips moved under one "Add a finisher" row with
  compact icon + name chips (drop / myo / rest-pause), mutually exclusive. The
  perf modal labels and the same-weight follow / pause cue are technique-aware
  (`buildTechnique`, `FINISHER_TECHS`, `SAME_WEIGHT_TECHS`, `childSectionLabel`).
- Tests: `test/cluster-b-restpause.test.js` (construction, the per-technique
  transition map, time cost, tonnage, routing + off-track inertness, the finisher
  constants). Golden master unchanged; suite green.

## [Cluster B: myo-reps, second intensity technique] (2026-06-23)

The next Epic 2 technique after the drop set, end-to-end. Myo-reps keep the same
weight: one activation set near failure, then short mini-sets with an intrinsic
mini-rest. Reuses the drop set's child mini-set plumbing (the `drops` field plus
the `technique` tag), so logging, tonnage, and time accounting were already in
place; the `technique` tag is what distinguishes the two. Bodybuilding-only and
opt-in, so the default/powerbuilding routine and golden master are unchanged.

- `Engine.buildMyoReps(set, opts)`: keeps the activation set, then `MYO_DEFAULTS`
  mini-sets at the SAME weight (no strip), each a few reps. Pure; a weightless or
  zero-mini set is returned unchanged and the input is never mutated.
- `Engine.setTimeSec` is now technique-aware: a myo mini-set charges the longer
  myo mini-rest (`TIME_MODEL.myoRestSec`) per child instead of the drop strip
  transition, with one full rest after the whole cluster.
- In-session surfacing: the technique row now offers a drop chip AND a myo chip,
  mutually exclusive per exercise (`toggleTechInSession`, `entryTech`,
  `clearEntryTechnique`). The perf modal logs myo mini-sets like drops, with the
  mini-sets riding the activation weight as it is adjusted.
- Technique-aware timer (the slice myo-reps needed): the intrinsic myo mini-rest
  is cued inside the perf modal with a short countdown on the same prescribed
  value, buzzing at zero where supported. Builds on the generic rest timer.
- Tests: `test/cluster-b-myo.test.js` (construction, the myo-vs-drop time cost,
  tonnage, applyTechnique routing + off-track inertness, `entryTech`). Golden
  master unchanged; suite green.

## [Generic rest timer] (2026-06-23)

The independent (non-technique) slice of the "prescribed rest periods / in-app
timer" item: surfaces the rest the engine already prescribes so the athlete sees
a live countdown between working sets, instead of it only feeding the time
estimate. Read-only on the engine and golden-master-safe; no persisted field.

- `Engine.restSecFor(kind, tight, TM)`: pure helper returning the prescribed rest
  (seconds) for a set kind from `TIME_MODEL.restSec` / `restSecTight` (the
  compressed table for a time-capped athlete), with an accessory fallback so an
  unknown kind never yields NaN. Same source `estimateSessionSec` reads.
- A sticky rest bar on the active session view: logging a real working set
  (`donePerf`, ramp/warmup sets excluded) starts a countdown for that lift's kind.
  Athlete controls -15s / +30s / Skip; it flips to "Rest done" and vibrates (when
  supported) at zero. Ephemeral `V.restTimer` state only, cleared when a session
  starts or finishes, so nothing persists and the default routine is unchanged.
- Unblocks the technique-aware timer (Cluster B) for myo-reps / rest-pause.
- Tests: `restSecFor` unit test (per-kind, tight table, fallback). Golden master
  unchanged; suite green.

## [Cluster E auto-application + Cluster F: training phase] (2026-06-23)

Turns the per-muscle autoregulation from advice into action, and adds the
training-phase / energy-balance layer. Bodybuilding-only and inert without
feedback, so the default/powerbuilding routine and the golden master are
unchanged (a cross-cluster integration test asserts this directly).

Cluster E (auto-application):
- `P().volAdj` (per-muscle accumulated set offset) now feeds prescribed
  bodybuilding accessory volume via `autoregForAccessory` in `resolveSlot`,
  bounded by the same per-session landmark cap focus uses.
- `updateAutoreg()` runs on each week advance: for every trained muscle it reads
  the week's feedback (`muscleSignal`) and nudges `volAdj` by the autoregulator's
  add / hold / cut, clamped to a small range so it converges instead of running
  away. The volume dashboard tally reflects the added sets (the D <-> E loop).

Cluster F (training phase & energy balance, no nutrition tracker):
- A training `phase` per athlete (lean-gain / maintenance / cut / minicut) on a
  new Phase & Bodyweight screen (More hub + a dashboard chip), with `PHASE_LABELS`
  / `PHASE_BLURB` / `PHASE_DEFICIT`.
- `Engine.autoregVolume` gains a `phase` argument: in a deficit recovery is lower,
  so it never adds volume (retain, not grow) and backs off one notch sooner.
- `Engine.fatigueSaturated` flags when enough muscles sit at/near MRV; the volume
  dashboard then suggests a minicut (when not already in a deficit).
- A light bodyweight trend (`S.bodyweight`, a sparkline). Trend only, no calories.
- Tests: `test/cluster-ef.test.js` and `test/cluster-integration.test.js` (A..F
  together: default path inert, the autoreg loop converges, drop set + autoreg
  coexist, the cut phase suppresses adds). Golden master unchanged; suite green.

## [Cluster E: per-muscle volume autoregulation, first slice] (2026-06-23)

First slice of Epic 1 (the gated capstone): the per-muscle feedback model, our own
simple taxonomy (not a clone of any product's signals/scale/mapping). This slice
RECOMMENDS only, so there is no prescription change and the golden master is
untouched; wiring the recommendation into actual set counts is the next slice.

- `Engine.autoregVolume(sig, sets, lm)` decides add / hold / cut for a muscle from
  a small seeded signal (recovery 1..5, performance -1/0/+1, pump advisory) vs its
  MV/MEV/MRV: ramp in below MEV, add when recovered and performing in the window,
  back off when under-recovered or reps drop, hold at the MRV ceiling. Pure and
  clamped to [MV, MRV].
- `muscleSignal(mv)` derives that signal from data already captured: recovery from
  the latest check-in slider for the muscle's group, performance from reps vs
  target, pump from logged sets. Null until a muscle has a logged session.
- The Weekly volume screen now shows a per-muscle add / hold / cut note with the
  reason (bodybuilding track), reading those check-ins and last sessions.
- Deferred to the next slice: feeding the recommendation into prescribed set
  counts (replacing the fixed JBB_HYP tables and whole-body computeWeekMod), still
  bodybuilding-only and inert without feedback.
- Tests: `test/cluster-e.test.js` (the add/hold/cut decision across cases, clamps,
  neutral defaults, and the signal derivation). Golden master unchanged; suite
  green.

## [Cluster D: per-muscle weekly volume dashboard, first slice] (2026-06-23)

First slice of Epic 4: the visible control panel. Surfaces weekly working sets
per muscle against the athlete's own MV/MEV/MRV landmarks. Read-only and
golden-master-safe: no prescription or deload behavior changes here.

- `Engine.volumeStatus(sets, lm)` classifies a muscle's weekly sets vs its
  landmarks (below maintenance / maintenance / productive MEV-MRV / over MRV) and
  returns a 0..100 fill for the bar. Pure.
- `weeklyVolumeByMuscle()` tallies the current week's non-warmup working sets per
  muscle, keyed like the landmark grid; direct movements count fully and the big
  compounds attribute to the muscles they train via `SYNERGIST_COVERAGE`.
- A "Weekly volume" screen (per-muscle bars with MEV/MRV markers and a status
  color) reachable from a dashboard button and the More hub, so it is visible,
  not buried.
- Deferred to later slices (own branches): the fatigue trend, MRV-hit / overreach
  detection, and the autoregulated deload + resensitization (those change deload
  behavior); plus the zero-sum cross-muscle budget and specialization phase.
- Tests: `test/cluster-d.test.js` (status classification, the weekly tally,
  compound-to-muscle attribution, warmups excluded). Golden master unchanged;
  full suite green.

## [Cluster C: head/region + SFR exercise model, data slice] (2026-06-23)

First slice of Epic 3: the exercise data lift plus surfacing, so the picker and
exercise detail show muscle region, stimulus-to-fatigue, and loaded-stretch. Our
own ratings and taxonomy (no product's table reproduced). Fully additive and
golden-master-safe: nothing in the prescription engine reads these fields.

- Data: `EX_META` (authored, curated) merges into every `EXERCISES` entry as
  `sfr` (1..3 stimulus-to-fatigue), `stretch` (loaded-stretch flag), and `head`
  (finer muscle region, only where heads genuinely differ: delts front/side/rear,
  chest upper/lower, triceps long/lateral, lats vs upper back, hamstring hip vs
  knee, biceps long/short). Untagged exercises take a neutral default.
- New `SFR_LABELS` / `HEAD_LABELS`.
- UI: compact region / Stretch / SFR badges in the swap, add, and library
  pickers (`exTagsHTML`), and a Stimulus card in the exercise detail Info tab
  (`exMetaCardHTML`) explaining SFR and the stretch emphasis.
- Deferred to the next slice (its own branch): the generator consuming this
  metadata for head-aware selection and cross-meso exercise rotation.
- Tests: `test/cluster-c.test.js` (field shape + defaults, authored values, head
  label integrity, and that resolveSlot output never carries the metadata).
  Golden master unchanged; full suite green.

## [Cluster B: intensity techniques, drop set] (2026-06-23)

First slice of Epic 2: one technique end-to-end, the drop set, proving the whole
loop (prescription, logging, time accounting, volume). Bodybuilding-only and
opt-in, so the default/powerbuilding routine and the golden master are unchanged.

- Prescription: new `Engine.buildDropSet` turns a working set into a top set plus
  N lighter mini-sets (defaults: 2 strips at 20%). A weightless (calibration /
  RIR-only) set is returned untouched, and the constructor never mutates its input.
- Opt-in: the exercise detail Settings tab gains a "Finish with a drop set" toggle
  for bodybuilding accessories, stored in `S.techniques` (exId -> 'drop'). A new
  `applyTechnique` converts the accessory's last real working set; every other
  track and untagged exercise stays byte-identical.
- Logging: the performance modal shows a Drops section (prescribed strip weights,
  reps logged per drop). Logged drops ride on the set and the record, and surface
  in the session view, summary, and history.
- Time accounting: `Engine.setTimeSec` (used by `estimateSessionSec`) charges each
  drop its execution plus a short transition (`TIME_MODEL.dropTransitionSec`, 15s)
  instead of a full rest, since a drop set is one hard set then immediate strips.
- Volume: `Engine.tonnage` now adds each logged drop's weight x reps.

Comprehension + discoverability pass (so the new features read clearly and the
engaging ones are surfaced, not buried):

- Drop sets are now offered right in the workout: a "Finish with a drop set" chip
  on each bodybuilding accessory card toggles the technique live on the last
  working set and remembers it for next time. The Settings-tab toggle stays as the
  persistent preference.
- One-time RIR note on the session view explaining the switch from RPE (dismissed
  for good once read, stored in `S.flags`), plus a permanent one-line RIR hint in
  the performance modal.
- Copy swept to RIR where it still said RPE (onboarding maxes step, the
  "Waiting for calibration" explainer) and the history session-rating chip
  relabeled from "RPE n" to "rated n/10" (it was the 1-10 session score, not RPE).
- Tests: `test/cluster-b.test.js` (construction, time cost, tonnage, opt-in
  routing, the surfacing helpers, and the additive flags/techniques maps). Golden
  master unchanged; full suite green.

## [Cluster A: logging & data foundation] (2026-06-23)

The first hypertrophy-roadmap enabler. All additive and golden-master-safe: no
prescription math changed, new record/set fields are optional and only written
when used, so the default/powerbuilding routine and the persisted shape of a
plain straight set are byte-identical.

- RIR-first logging. The performance modal now logs reps-in-reserve instead of
  RPE, and every intensity readout (targets, logged sets, history, maxes) shows
  RIR. RPE stays the stored/canonical value (rir = 10 - rpe), so e1rm and all
  prescription math are untouched. New Engine.rpeToRir / rirToRpe.
- Optional pump quick-tap on each logged set (Light / Solid / Skin splitting),
  carried onto the record. Leaveable blank; nothing depends on it yet (it feeds
  Epic 1 feedback later).
- technique field on set objects and records, plus a TECHNIQUE_LABELS table
  (straight / drop / myo / rest-pause / partials / superset). Schema groundwork
  for Epic 2; only straight is used today, others render a badge when present.
- Per-exercise progression trends: a new Trend tab in the exercise detail shows
  estimated-1RM and volume-load sparklines. New pure Engine.e1rmTrend /
  volumeLoadTrend (one point per day, windowed, deterministic).
- Tests: test/cluster-a.test.js covers RIR conversion, the two trend series, and
  that the optional fields are inert. Golden master unchanged.

## [Split-generator tuning: glute-led days + same-muscle spacing] (2026-06-22)

Three related fixes to the bodybuilding frequency-driven split generator
(`generateBodybuildingDays`). Bodybuilding-only, so default/powerbuilding output
is byte-identical (golden master unchanged).

- Glutes can now lead a day. Previously Legs was the only lower muscle able to
  anchor, so a balanced multi-day week put every lower day on Legs. Glutes is now
  an anchor (rank 2) with a hip-thrust lead (`PRIMARY_ANCHOR.glutes`), gated so it
  only leads when trained twice or more a week (a de-emphasized 1x glute still
  fills, it does not claim a day).
- Balanced lower no longer over-allocates to Legs. With Glutes as a second lower
  lead, a balanced 6-day spreads its lower days across Legs and Glutes instead of
  three Legs days. (This takes the "secondary lower anchor" option from the
  future-work note rather than re-weighting region day counts.)
- Same-muscle day spacing: a new `spaceSameMuscle` pass runs after the region
  interleave and pulls a differently-themed day between two days led by the same
  muscle, so repeated focus days get a recovery gap. Genuinely unavoidable cases
  (a region with a single possible lead) are left intact.

## [Remove exercises, budget-aware pickers, equipment-aware setup time] (2026-06-22)

Three changes to the workout overview and the time model.

- Remove exercises: the overview now supports swipe-left to reveal a Remove
  action on any accessory or added exercise (mains and secondaries stay
  swap-only, since they anchor the working max). Removal is undoable from a toast
  action. Fixes athletes being unable to take a mistakenly added exercise back
  off a day.
- Budget-aware pickers: the Swap / Select and Add Exercise pickers now show each
  candidate's approximate time cost for a time-capped athlete, plus a
  remaining-room header, so adds and swaps can be weighed against the cap.
- Equipment-aware setup time: the session-time estimator used to bundle all
  setup (plate-loading, station hops) into one flat per-session constant, so the
  marginal cost of adding an exercise omitted real setup entirely. Setup is now a
  per-exercise, equipment-keyed cost (`TIME_MODEL.setupSec`): a barbell pays
  ~2 min for loading and a warmup, a machine almost nothing, bodyweight nearly
  zero. The once-per-session overhead drops to 3 min (arrive, change, water).
  Net effect: full-session estimates are about the same for typical days, barbell
  days read a little longer, and the per-add/candidate costs are realistic and
  differentiate by equipment.

## [Equipment filters, free exercise selection, real coaching cues] (2026-06-22)

Three athlete-facing improvements to exercise selection and the exercise detail
sheet.

- Equipment filter chips (All, Barbell, Dumbbell, Machine, Cable, Bodyweight,
  Band) on the Swap / Select and Add Exercise pickers, so an athlete who has a
  machine but does not know its name can narrow the list by what is in front of
  them. Chips reflect only the equipment actually present in the pool being
  browsed. A shared `equipChips()` helper renders the row for every picker.
- The Swap / Select picker now lets you choose exercises outside the slot's
  recommended muscle group. A name search spans the whole catalog, and with no
  search there is a "Browse other muscle groups" toggle that lists everything
  else (each tagged with its muscle group). Main and secondary slots stay inside
  their movement, since their variations drive the wave math off the working
  max. Picker filter/search/toggle state lives in module-scoped `SW` / `ADDF` so
  only the list body re-renders and the search box keeps focus while typing.
- Real coaching cues for every catalog exercise. New `EX_CUES` map in `data.js`
  gives each of the 148 exercises 3 to 6 concise technique bullets; the detail
  sheet looks up `EX_CUES[id]` first and falls back to the old broad
  per-movement `CUES` only for exercises with no entry (e.g. custom lifts). No
  em dashes in the athlete-facing prose.

No engine math changed: prescriptions, the golden master, and scheme isolation
are untouched. This is catalog data plus picker UI.

## [Skip deadlift 1RM on the bodybuilding track] (2026-06-22)

Onboarding no longer asks for a Comp Deadlift 1RM when the chosen track is
Bodybuilding. That generator never programs the deadlift, so the field only
added noise. The maxes step and its save loop both drive off a shared
`obMainLifts(track)` list. Powerbuilding and powerlifting are unchanged and
still collect all four main lifts.

## [Persistence round-trip test] (2026-06-22)

`persistence.test.js` starts the real `server.js` as a child process against a
throwaway data file and exercises `GET`/`POST /api/state` over real HTTP: the
file is created on boot, `GET` returns the default state, and a POSTed state
round-trips through `GET` and to disk. Uses the built-in `http` module (no
jsdom, no fetch warning) and works on Node 18 and 20.

- `server.js` gains an `IRONWAVE_DB` env override for the data-file path
  (defaults to the original `app/database.json`, so existing setups are
  unchanged). This lets the test point at a temp file instead of clobbering a
  developer's real `database.json`, and lets deployments choose a data path.

## [Boot / render smoke tests] (2026-06-22)

`render-smoke.test.js` loads the three scripts into a real jsdom document and
renders every view for a default (Powerbuilding) and a Bodybuilding program,
asserting each render produces markup and never throws.

- New `test/load-dom.js` harness: runs the app in a jsdom window (real
  #app / #modal-root / #toast-root), `boot()` stripped, network stubbed, so the
  view layer renders without auto-booting.
- Covers all eleven views: the seven navigation views (dashboard, workout,
  history, more, exercises, program, settings), a live session and check-in
  driven through the real flow (startCheckin -> beginSession), the summary, and
  first-run onboarding.
- Adds `jsdom` as the first devDependency. The pure-engine suites still need no
  DOM; only this smoke layer pulls it in. Whole suite runs in ~2s.
- jsdom dropped Node 18 support, so this smoke test self-skips on Node < 20 (the
  jsdom require is deferred); the app runtime and engine suites still cover
  Node 18, so the CI matrix and branch protection are unchanged.

## [Focus / generator behavior tests] (2026-06-22)

`focus-generator.test.js` covers the bodybuilding focus + split machinery
through the same harness (no jsdom):

- **Focus reallocation:** slider 0 removes a muscle's accessory, 1-2 shed sets
  (FOCUS_FACTOR 0.5 / 0.75), 3+ leave the per-session count unchanged (emphasis
  is frequency, not session inflation), and it is a no-op on a calibration ramp
  and off the bodybuilding track.
- **Split generator:** region day counts are proportional to slider points
  (balanced 4-day = 2 upper / 2 lower; the upper-heavy CHANGELOG example =
  3 / 1), every day has >= 3 slots, a removed muscle never leads or fills a
  slot, leadership rotates, and an all-removed focus yields no days.
- **Core / optional tiers:** no cap keeps everything core; a tight cap pushes
  accessories optional while mains and secondaries stay core, with an exact
  partition.
- **Carryover:** an accessory offered optional twice and never trained is
  dropped at block end; anything trained at least once (or offered only once) is
  kept.

## [Engine unit tests: math, scheme isolation, migration] (2026-06-22)

Builds on the golden master with focused pure-engine tests (no jsdom), all
through the existing `test/load-app.js` harness.

- **`engine.test.js`** covers the deterministic math: `e1rm` / `weightFor`
  round-trip, `roundLoad`, `amrapAdjust` (the +10-rep cap and the
  below-standard hold), `plateMath`, `warmupSets`, `readinessScore` (composite
  and 0..30 clamp), `seedLandmarks` (experience scaling with the MEV-0 and
  mv<=mev<mrv invariants), and the per-week ramps of `prescribeMain` and the
  `jbb-hyp` scheme for both a calibrated and an uncalibrated lift.
- **`scheme-isolation.test.js`** asserts `schemeFor` routes only on
  `block.scheme` (type is a default only when scheme is absent, scheme wins over
  type, unknown falls back to `jm2-wave`) and that `jm2-wave` and `jbb-hyp` stay
  independent paths that never blend.
- **`migration.test.js`** loads a legacy (pre-tracks, pre-landmarks,
  pre-scheme-split) save through `migrateState`, asserts the powerbuilding
  backfill, partial-migration safety, and that `migrateState` is idempotent.
- **Harness fix:** `load-app.js` now compiles the app in the current realm
  (an IIFE via `runInThisContext`, browser globals passed as parameters) so the
  objects the engine returns are this-realm native and `deepStrictEqual` can
  compare them by structure. No global pollution.

## [Golden-master test for the default routine] (2026-06-22)

The engine has only ever been verified by throwaway JSDOM harnesses. This adds
the first automated test, promoting the "default users stay byte-identical"
contract into a real check.

- `app/test/` with Node's built-in `node:test` runner, wired to `npm test`. No
  build step and no new dependencies: `test/load-app.js` loads the three browser
  scripts into a `vm` sandbox (tiny `document`/`fetch` stub, `boot()` stripped)
  so the engine can be called directly with no real DOM.
- `golden-master.test.js` snapshots every block/week/day/slot's `resolveSlot`
  output for the default Powerbuilding program, both uncalibrated and calibrated,
  and asserts it never changes. Expected output is committed in
  `golden-master.json`; regenerate intentional changes with
  `UPDATE_GOLDEN=1 node --test test/golden-master.test.js`.

## [Frequency-driven bodybuilding split] (2026-06-19)

The bodybuilding split was a fixed template (upper/lower etc.) chosen by day
count; the sliders only adjusted volume within it, so the split shape ignored
the focus distribution (an upper-heavy lifter still got 2 upper / 2 lower).

- The bodybuilding week is now generated from the sliders. Focus = frequency:
  3 = 2x/week, 4 = 2x as a day's primary focus, 5-6 = 3x, 0 = removed.
- Region day counts are proportional to slider points: arms/chest/back/shoulders
  vs glutes/legs/calves. Example: arms3 chest3 back3 shoulders4 glutes1 legs2
  calves1 on 4 days now yields 3 upper + 1 lower (was 2/2), with a Shoulders day,
  a Chest day, a Back day, and a Legs day.
- Leadership rotates: each anchor-capable muscle (chest/back/legs/shoulders)
  leads a day in turn, so you get distinct themed days instead of one muscle
  leading every session. The day shows its theme ("Upper - Shoulders").
- One working-max main per lift drives the AMRAP/progression; extra weekly
  exposures of that lift are secondary volume (no second working-max move).
- Day titles are "Day N" with the theme as a subtitle (dashboard, preview,
  workout). Other tracks keep the strength templates and are byte-identical.

## [Dedicated bodybuilding day templates] (2026-06-19)

The bodybuilding track previously reused the strength-oriented shared day
templates (built around the four competition barbell lifts), so dropping the
deadlift for hypertrophy left an orphaned day led by Good Mornings, and the
exercise selection leaked a powerlifting philosophy.

- Bodybuilding now has its own hypertrophy splits: 3 = full body x3, 4 =
  upper/lower x2, 5 = push/pull/legs/upper/lower, 6 = push/pull/legs x2. No
  deadlift, no Good-Mornings-as-lead.
- Exercise selection leans bodybuilding: pull days lead with a pulldown/row,
  hamstrings are RDLs and leg curls (not Good Mornings), and machine/cable/
  isolation work fills the accessories.
- The barbell compounds (bench/squat/press) stay as the working-max anchors so
  the wave/AMRAP weights remain correct, and they are swappable. Non-anchor days
  (pull, second lower) lead with a bodybuilding movement, barbell available as a swap.
- Muscle focus, removal, refill, the extra-main-dose, time tiers, and the
  carryover all work unchanged on the new templates. Powerlifting and
  powerbuilding keep the strength templates, so they are byte-identical.

## [Core / Optional time tiers + onboarding clarity] (2026-06-19)

### Core vs Optional (replaces silent trimming)
- A time-capped day no longer silently drops accessories when you Start. Instead
  every exercise is classified: Core (main lifts, secondaries, and the highest
  priority accessories that fit your limit) is always shown and never cut;
  Optional (the lower-priority tail that runs over) is shown and trainable, just
  flagged amber with "optional, over your time limit, do it if you have time."
- Mains and secondaries are always Core. Specialized muscles (slider >= 4) are
  kept in Core hardest, but if the mains alone already fill the limit even they
  fall to Optional, so the app never claims a session fits when it cannot. A
  dedicated banner explains the "even your core is over the limit" case.
- The workout overview, preview, and live session all mark optional work; the
  banner states the core minutes vs your limit and the optional minutes on top.
- Carryover (one block): an accessory offered as optional at least twice in a
  block and never trained once is dropped from the routine, so you stop being
  shown work you keep skipping. Anything you do at least once is kept.
- Replaces the old rest-compression + prune mitigation. No time cap means
  everything is Core, so default and uncapped users are unaffected.

### Onboarding clarity
- The focus-step time estimate is now a legible card and compares to the limit
  the athlete set ("about 55 min, over your 45 min limit").

### Time polish
- Budget-aware Add: a capped athlete sees how much room is left before their
  limit and the rough cost of one more exercise ("about 4 min before your 45 min
  limit. Each added exercise is roughly +6 min").
- "See time by week" shows how a day's length changes across the block (core and
  optional minutes per week), so the athlete can see the tail grow toward the
  peak week and drop at the deload.

## [Dynamic engine: onboarding tracks, time, muscle focus] (2026-06-19) — in progress

Implements docs/dynamic-routine-engine-design.md. Shipped incrementally; each
commit keeps a default user (Powerbuilding, unlimited time) byte-identical.

### Foundation (this commit)
- New training tracks: Powerbuilding (existing), Powerlifting (hypertrophy base
  + four book-wave strength blocks), Bodybuilding (all hypertrophy, drives the
  muscle-focus sliders). Tracks only change block periodization; day layouts and
  the jm2-wave / jbb-hyp schemes are untouched.
- Onboarding gains goal (track), experience, time-per-session (unlimited or a
  minute cap), and, for Bodybuilding, seven 0-6 muscle-focus sliders (Arms,
  Chest, Back, Shoulders, Glutes, Legs, Calves; 3 = balanced). Sliders at 0
  (remove) or 6 (max) show a warning. Non-bodybuilding tracks skip the slider step.
- Per-athlete volume landmarks (MV/MEV/MRV) stored in profile.landmarks, seeded
  from the RP classic grid scaled by experience. Engine.seedLandmarks added.
- State, migration (backfills all new fields and seeds landmarks on old saves),
  and makeProgram (selects template by track, snapshots trainingConfig) updated.
  State version unchanged; old database.json and backups load unchanged.
- Verified: legacy resolveSlot output unchanged (calibrated and uncalibrated
  lifts), migration idempotent, and the full bodybuilding onboarding flow, all
  via a headless JSDOM harness.

### Muscle-focus reallocation (FOCUS)
- On the bodybuilding track, the focus sliders now reshape accessory volume:
  emphasized muscles gain sets (toward their MRV), de-emphasized lose sets, and
  a slider at 0 removes that muscle's accessories (shown muted in the workout
  overview, dropped from sessions and previews). Bounded by the athlete's
  per-session landmark cap. Main lifts and secondaries are never touched, so the
  wave math and working-max progression are unaffected.
- Strict no-op for the powerbuilding/powerlifting tracks and for any slider left
  at 3. Verified by harness: emphasize/de-emphasize/remove, mains untouched,
  calibration ramps unscaled, and byte-identical output off the bodybuilding track.

### Session time cap (estimate + mitigation)
- Per-session time estimate (execution + rest + warmup + overhead), scaling with
  the week's set counts so the late-meso volume creep is predicted, not a surprise.
- For a custom time cap, the session is fit to it: first rest is compressed, then
  coherent accessories are pruned (an accessory the day's main already trains, via
  SYNERGIST_COVERAGE, lowest training-priority first). Main lifts, secondaries,
  and specialized muscles (slider >= 4) are never pruned. The workout view shows a
  projection banner, the preview shows what was trimmed, and the live session is
  built from the fitted plan.
- A no-op for unlimited time, so default users are unaffected. Verified by harness:
  estimate magnitude, fit-without-prune, tight-cap pruning with mains kept, and
  coherent prune order (squat-covered leg extension before hamstring curl).

### Evolving volume landmarks
- Once per completed block, each muscle's landmarks adjust from how the block
  actually went: logged effort that stayed on target (room to grow) nudges MRV up,
  effort that ran hot or a falling readiness trend nudges it down. Capped at +/-1
  set per muscle per block and clamped, so volume drifts rather than jumps. Needs
  at least a few logged sets for a muscle before it moves. Training age increments.
- Landmarks only feed the bodybuilding focus endpoints, so this changes no routine
  off that track. Verified by harness: tolerated up, overreached down, weak signal
  held, rate-limited across blocks, empty block holds.

This completes the dynamic engine. Default users (Powerbuilding, unlimited time,
balanced sliders) remain byte-identical throughout; every new behavior is gated.

### Focus fine-tunes (from edge-case testing)
- Pressing accessories are tagged by lift pattern (bench, press) rather than the
  muscle they build, so the Chest and Shoulders sliders previously ignored them.
  Mapped bench -> Chest and press -> Shoulders so those sliders now control
  pressing accessory volume. Main and secondary lifts stay unaffected.
- A select ("Select X Exercise") slot for a muscle set to 0 no longer nags the
  athlete to fill it; it is shown removed instead. Found by simulating a
  Chest-6 / everything-else-0 athlete across a full mesocycle.
- Bodybuilding track now drops the deadlift entirely (the heavy deadlift main and
  its variations have no place in a hypertrophy routine; RDLs and good-mornings,
  which build hamstrings, are kept). A muscle slider at 0 now also removes that
  muscle's main and secondary lifts, not just its accessories: Chest 0 means no
  Comp Bench, Legs 0 means no Comp Squat, Shoulders 0 means no Military Press.
  This honors an injured athlete who cannot perform the lift. Mains are still
  never volume-scaled, and other tracks keep every lift (deadlift included).

### Full refill: focus-aware day rebuild (bodybuilding)
- The bodybuilding day layout is now rebuilt at program creation around the
  athlete's muscle focus, instead of editing a fixed template in place:
  - Emphasis (slider 4-6) now adds real exercises (more movements for that
    muscle, up to its landmark budget) rather than inflating one exercise's set
    count. This avoids overshooting MRV and matches how specialization works.
  - Select-only muscles (glutes, calves) that are emphasized now get real
    default exercises, so the slider is no longer a no-op for them.
  - Freed slots (from removals) and any emptied day are refilled with the
    athlete's top-priority muscles, so no chosen training day is left empty.
  - A muscle at 6 on a 5 or 6 day split gets an extra main dose: a second,
    spaced exposure of its main lift (chest -> bench, legs -> squat, shoulders
    -> press) as a secondary volume session, so it never adds a second
    working-max-moving AMRAP.
- If an athlete zeroes essentially every muscle, the only remaining empty day
  shows guidance to add an exercise or rebalance, instead of an empty session.
- Other tracks are untouched (rebuild is bodybuilding-only); default routines
  stay byte-identical. Verified by harness against the two reported degenerate
  configs (lower-only and upper-only), the extra-dose spacing, and all-zero.

### Informative session-time estimate on the focus step
- The muscle-focus step now shows a live "estimated median training session"
  in minutes, updating as sliders move, so the athlete sees how their focus
  affects session length before committing. It builds a throwaway program from
  the in-progress answers and medians the per-day time (rest + execution +
  warmup + overhead from TIME_MODEL), using a nominal working max so the number
  reflects a real working session rather than the week-1 calibration ramp.
- Purely informative: it touches no persistent state and needs no new inputs
  (uses the chosen days, sliders, and experience already collected). Verified by
  harness: shown and live-updating, plausible values across configs, and the
  program/landmarks left untouched.
- Recalibrated TIME_MODEL to match real training (the first pass ran generous):
  rest 3:30 main / 3:00 secondary / 2:00 accessory, warmup 90s per ramp set,
  session overhead 6 min; compressed (time-cap) rest scaled up to match. A
  balanced bodybuilding week-4 peak day now estimates ~73 min (squat day),
  ~56 min typical, versus ~54/40 before. This also feeds the time-cap mitigation.

## [In-app confirm dialogs] (2026-06-19)
- Replaced every native `window.confirm()` with an in-app confirm dialog so
  the app, not the browser, draws and triggers these prompts. They now match
  the dark theme, ride the existing modal stack, and animate like the rest of
  the UI (backdrop fade, bottom-sheet slide up, a small icon pop). Nine call
  sites converted: complete week, skip workout, leave session, finish with no
  sets, redo day, delete custom exercise, start new program, and the two-stage
  erase-everything reset.
- New `confirmModal({ title, message, confirmLabel, cancelLabel, danger }, onConfirm, onCancel)`
  helper. Destructive actions (skip, redo, delete, erase) set `danger` for a
  red primary button and a warning icon; the rest use the blue primary. The X
  button and a backdrop tap both count as cancel. Because it uses the modal
  stack, a confirm raised from inside another modal (delete from the exercise
  detail sheet) layers over it and returns to it on cancel.
- `fullReset` keeps its deliberate two-stage confirm, now as two chained
  dialogs. Engine, prescription, and persistence logic are untouched; this is
  the confirmation UI layer only.
- Also added a subtle backdrop fade-in to every modal (`.modal-wrap`), which
  improves all existing modals, not just the new dialogs.

## [Calibration-state preview display + em-dash cleanup] (2026-06-18)
- Week preview (`openWeekPreview`) now detects when a lift is uncalibrated
  (main lift with no working max, or accessory with no logged e1RM yet) and
  shows "Waiting for calibration" with a tappable info button, instead of the
  misleading flat "3×10 @ RPE 6" that read identically on every week. New
  `openCalibrationInfo()` modal explains the anchor concept (working max for
  mains, first logged set for accessories), how to calibrate in week 1, and
  what changes afterward.
- Removed em dashes from all athlete-facing strings across app.js, engine.js,
  and data.js (set notes, toasts, banners, labels, RPE legend, AMRAP notes).
  Only code comments retain them. Engine logic unchanged.
- Confirmed (not changed): accessory RPE ramps 7 / 7.5 / 8 / 9 with sets
  climbing 2 / 3 / 4 / 5, peaking RPE 9 in realization, once an e1RM exists.
  Accessories intentionally cap at RPE 9, not 10.

## [Server storage migration — bugfix] (2026-06-18)

### Why
A previous pass moved persistence from `localStorage` to a Node/Express backend (`server.js`, `GET`/`POST /api/state`, single `database.json`). The backend was correct, but the client was left half-converted and the app failed to launch.

### The bug
`loadState()` was made `async` (it now `await`s `fetch('/api/state')`), but the client still consumed it synchronously at module load:

```js
let S = loadState();                             // S = a pending Promise, not state
let V = { view: S.program ? 'dashboard' : ... }; // S.program === undefined
render();                                         // first paint runs against a Promise
```

Because an `async` function returns a Promise, `S` was never the state object. Every `S.<field>` read `undefined`, the first `render()` ran against garbage, and any subsequent `save()` POSTed a serialized Promise — corrupting `database.json`. A saved program could never appear; the app always fell through to onboarding.

Two smaller leftovers from the same half-migration: `fullReset()` still cleared the now-unused `localStorage` and never notified the server, and `save()` swallowed failures silently and could interleave concurrent writes to the file.

### What changed (client only — `app.js`; `server.js` untouched)
- **Async boot.** `let S = loadState()` + bottom-of-file `render()` replaced with an `async boot()` that `await`s the load, *then* computes `V`, *then* renders. `S` and `V` start `null` so a stray early access throws clearly instead of silently reading off a Promise.
- **Hardened `save()`.** Writes are chained through one promise (no interleaved POSTs racing on the file), `res.ok` is checked, and a real failure raises `toast('Save failed…', true)` instead of only a console warning.
- **`fullReset()`** now sets `S = defaultState()` and persists via `save()` to the server, instead of clearing `localStorage`.
- **Defensive migration defaults.** `migrateState` now also backfills `pointer`, `weeksPerBlock`, `completedDays`, and `weekMod` if absent, so a very old or hand-edited `database.json` can't crash the dashboard (`programDone()` reads `pointer.block` unconditionally). Real programs already create these in `makeProgram`; this only guards legacy/edited data.

### Isolation / scope
No engine, scheme, prescription, or UI-flow logic changed. The `jm2-wave` / `jbb-hyp` split and the existing scheme/`mesoIdx`/methodology migration are untouched and remain idempotent. The state version is unchanged, so export/import still works.

### Verified
Headless boot, persistence round-trip (client → `POST` → `database.json` → `GET`), and the legacy-program migration (hypertrophy→`jbb-hyp`, strength→`jm2-wave`, per-scheme `mesoIdx`, methodology tag, idempotent) all pass against the live server.


## [Juggernaut + Bodybuilding] — 2026-06-12

### Why
Visual comparison against the original JuggernautAI app exposed a methodology mismatch. The engine was built from the 2012 *Juggernaut Method 2.0* book, where **every** wave descends in volume (accumulation → intensification → one AMRAP set). The modern app instead runs RP-style volume landmarks (MEV→MRV) for hypertrophy: **ascending** volume across the mesocycle, deloading only after fatigue has been accumulated. The book and the app only agree about strength phases. The blue (hypertrophy) timeline bars made this discrepancy visible.

### What changed
- **Prescription scheme registry** (`Engine.schemes`). Every block now declares a `scheme` id and *all* prescriptions (main, secondary, accessory) plus the timeline volume index route through that block's scheme. Schemes are self-contained objects — no logic is shared or blended between methodologies.
  - `jm2-wave` — the 2012 book, verbatim. Unchanged behaviour. Used by strength blocks (5s, 3s waves): descending volume, rising intensity, realization AMRAP, working-max formula `[(reps − standard) × increment] + WM` capped at +10 reps.
  - `jbb-hyp` — new ascending-volume hypertrophy scheme. Used by hypertrophy blocks (10s, 8s waves):
    - **Main lifts:** 3 → 4 → 5 → 4 straight sets at the wave's rep target, percentage creeping up ~2.5%/week from the book's accumulation base. Week 4 appends an **AMRAP at the book's realization %** (75% / 80% of WM), so the working-max progression stays calibrated to the original formula.
    - **Accessories:** 2 → 3 → 4 → 5 sets of 12, RPE target 7 → 7.5 → 8 → 9 (RIR 3 tightening to 1). Weights computed from logged e1RM as before; calibration ramp unchanged for unknown exercises.
    - **Secondary lifts:** 3 → 4 → 5 → 5 sets of 5 at 60% + 2.5%/week.
    - **Deload:** main 40/50/60% × 5 (book), accessories and secondaries at half volume, RPE 6.
- **Timeline volume index** is now scheme-computed (main reps + per-exercise accessory reps), so hypertrophy bars ascend into the deload and strength bars descend — matching the original app's shape for both colors.
- **Week labels** are scheme-aware: hypertrophy weeks read "Build Volume / Peak Volume + AMRAP" instead of the book's "Accumulation / Intensification".
- **Migration:** programs saved before this change get scheme ids stamped per block type on load (hypertrophy → `jbb-hyp`, strength → `jm2-wave`). No data loss; prescriptions in the current hypertrophy block change to the ascending model immediately.
- **Program screen** now shows the methodology tag and each block's scheme.

### Isolation guarantee
A future pure-hypertrophy (or any other) methodology is added via `Engine.registerScheme('my-id', {...})` and a program template whose blocks reference that id. The resolver consults only `block.scheme`. Nothing in `jm2-wave` or `jbb-hyp` is touched, called, or blended when a different scheme is loaded.

### Out of scope (unchanged)
Readiness scoring, working-max calibration (90% of 1RM / week-1 ramp / e1RM auto-recalibration), AMRAP→WM updates and the variation-lift exclusion, plate math, exercise catalog, day templates, all UI flows.

### Update (same tag) — meso-progressive macrocycle — 2026-06-12

**Why.** First pass periodized correctly *within* each meso but not *across* them: every hypertrophy meso reset to the same set counts, and the rep-based volume index made the 10s meso look hardest. Per RP volume-landmark logic (and the original app's behaviour), MEV rises as you adapt — each meso should start and peak higher than the last, putting the single hardest week of the hypertrophy macrocycle in the last work week of the final meso, immediately before its deload and the volume-slashing strength phase.

**What.**
- `block.mesoIdx` — each block's 0-based position among same-scheme blocks, stamped at program creation and via migration on legacy saves. Clamped, so longer future programs reuse the top row.
- `JBB_HYP` tables are now `[mesoIdx][workWeek]`:
  - Mains: meso 1 `3/4/5/4` → meso 2 `3/4/5/5` → meso 3 `4/5/6/5` sets (+ the week-4 AMRAP, unchanged).
  - Accessories: meso 1 `2/3/4/5` → meso 2 `3/4/5/6` → meso 3 `3/5/6/7` sets.
  - Secondaries: `3/4/5/5` → `3/4/5/6` → `4/5/6/6`.
- Timeline now shows the sawtooth staircase: each meso dips at calibration, climbs past the previous meso's peak, with the global maximum at Hypertrophy 3 week 4. Strength blocks untouched and still descend.
- `jm2-wave` ignores `mesoIdx` entirely — isolation preserved.

## [Loading profiles, weekly autoregulation, summary screen, day-nav] (2026-06-16)

Four focused changes. Stored set weight stays the total load moved in every case, so all existing math (e1RM, wave percentages, tonnage, plate inventory, working-max updates) is untouched. The working max is still moved only by the realization AMRAP and by calibration; none of the new code writes it.

### 1. Per-exercise loading profiles
- Weights are now stored as totals but displayed in the exercise's own units. Two-dumbbell lifts show and accept weight per hand (the stored total is split for display, doubled on input); single-dumbbell lifts show the dumbbell itself.
- A loading mode per exercise: barbell, light bar, dumbbell, machine, cable, bodyweight, band. Set it under an exercise's Settings tab. A light-bar override (for example a fixed 10 kg bar on skullcrushers) keeps the plate visual but against the lighter bar.
- Rounding follows the implement: barbell and light bar use load rounding, dumbbells round per hand then double, machines and cables step by a configurable amount. Two new global settings under Settings: dumbbell increment per hand and machine/cable step.
- The plate visual and warmup ramp show only for barbell and light bar. Other modes show a plain readout (per-hand and total for dumbbells, "machine load" for machines, "added load" otherwise).

### 2. End-of-week autoregulation
- When you complete a week whose upcoming week is real work (accumulation, intensification or realization), a five-step slider asks how the block week felt. Calibration and deload weeks advance with no prompt.
- The answer tunes the upcoming week only, as a single-use modifier stored on the program. It can shift the working percentage for mains and secondaries (down 5% at the lowest, up 5% at the highest) and add or drop working-set count (accessories on every step, mains only on the most severe step).
- The readiness trend is a brake only. If your recent check-ins are trending below your own baseline, an optimistic pick is governed down: a top pick keeps the extra set but loses the percentage push, and a "felt strong" pick is treated as "as planned". The trend never adds load on its own and never fires without enough history. The modifier never edits the working max.

### 3. Post-workout summary screen
- Finishing a session now lands on a summary (tonnage, session rating, readiness, and any working-max change from a realization AMRAP) with every logged lift shown actual versus target. The session detail modal in History reuses the same rendering.
- Completed days are locked in the workout view: instead of Start Training they show a "Day complete" card with View summary and Redo day. Redoing a day removes the prior session for that day before restarting, so nothing is orphaned. Opening a completed day from the dashboard goes straight to its summary.

### 4. Larger day-navigation arrows
- The two day arrows in the workout header use a dedicated `.day-nav` style with a roughly 44 by 44 px tap target. The shared `.btn-ghost` style (back arrow, modal close, inline links) is untouched.

### Notes
- New state fields all have defaults in `defaultState()` and every reader tolerates their absence, so existing saved data and older backups load without migration. The state version is unchanged, so import/export still works.
- The two prescription schemes remain isolated: the weekly modifier is applied in the resolver after the scheme runs and is scoped to one global week, so it never blends `jm2-wave` and `jbb-hyp`.

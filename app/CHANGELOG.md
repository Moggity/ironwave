# IRONWAVE — Changelog

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

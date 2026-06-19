# IRONWAVE — Changelog

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

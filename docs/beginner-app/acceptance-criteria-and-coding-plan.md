# Ironwave for Beginners — Acceptance Criteria and Coding Plan

Nov 10, 2026 · @Martin Arocha

## Acceptance criteria

The product is done when all 67 criteria below pass. Each has an ID, and every automated test is named with the ID it proves. They include the edits made to the Product Plan on 10 Nov 2026. Where this list and the Product Plan disagree, this list wins.

Numeric thresholds are starting values. They live in one config file so they can be tuned without touching logic.

### A. First open

- **A1** A fresh install shows one screen with five goal tiles: Bigger arms, Bigger chest, Legs and glutes, Look fit, Look strong. Several can be selected. The screen can be skipped.
- **A2** The same screen has one optional field, "What's your name?". With a name, the home header reads "Ana's routine". Without one it reads "Your routine".
- **A3** No other question is asked before the first set: no account, experience, body data, 1RM or training days.
- **A4** From a fresh install, a user reaches the Lift screen in at most 3 taps (goal, continue, Start).
- **A5** Skipping the goal behaves as Look fit.

### B. Pick

- **B1** After the goal screen, and on every later open, the app shows a ready workout of six exercises with three pre-ticked and one Start button. The user never faces an empty list.
- **B2** Goal muscles come first in the six. With several goals, each goal has at least one of the three pre-ticked exercises where possible.
- **B3** Every exercise card has a looping demo and exactly one form cue.
- **B4** Every card has an "I don't have that here" button. Tapping it removes every exercise needing that piece of equipment and refills the list to six at once.
- **B5** Excluded equipment is remembered, is never suggested again, and can be restored from one list.
- **B6** The user can untick, tick others, search the full exercise list, or repeat the last workout.

### C. Lift

- **C1** One exercise fills the screen: name, demo, cue, weight stepper, reps stepper, set counter, Done button.
- **C2** The first time on an exercise the only prompt is "Pick a weight you could lift for 12 repetitions. Stop when it gets hard."
- **C3** After Done, three optional faces appear (Easy, Good, Hard) and the rest timer starts by itself.
- **C4** The rest timer is computed from timestamps, so it is still correct after the phone was locked or the app was in the background.
- **C5** The user can do more or fewer sets than shown, swap or add an exercise, and end the workout at any point. Everything logged is kept.
- **C6** Every completed set is saved before the next screen renders. Killing the app mid-workout loses nothing, and reopening resumes the workout.

### D. Silent math

- **D1** The app never states a target. Steppers are simply pre-filled. No "try", "last time" or "time to go up" text exists anywhere.
- **D2** Effort maps to Easy = RPE 6, Good = RPE 8, Hard = RPE 9.5. No tap = RPE 8.
- **D3** Next session on an exercise is pre-filled with the same weight and one more rep per set, inside a range of 8 to 12. Example: 10 kg × 10, 10, 10 gives 10 kg × 11.
- **D4** When every set reached 12 and none was Hard, the pre-fill is one increment heavier at 8 reps.
- **D5** Two sessions in a row falling 2 or more reps short hold the weight. A third drops it one increment.
- **D6** If a first set was Easy at 12 or more reps, the next set's weight is pre-filled from `Engine.weightFor` for 10 reps at RPE 8, with no message.
- **D7** Between two sessions the pre-filled weight never rises by more than one increment, except through D6.
- **D8** Bodyweight exercises progress in reps only.
- **D9** Sets per exercise are 2 for the first two sessions on it and 3 afterwards. Only E5, E6 and E7 can move that, within 1 to 4.
- **D10** A new highest estimated 1RM on an exercise shows "New best" on the Done screen. This is the only math-derived message in the app.

### E. Today, balance and recovery

- **E1** From the third workout, the suggested six are ranked from sets per muscle over a rolling 7 days against Ironwave's landmarks at the beginner factor (0.65).
- **E2** Order of preference: goal muscles below minimum effective volume, then the muscle furthest below maintenance, skipping muscles trained in the last 48 hours unless nothing else remains.
- **E3** Synergist coverage counts. A row adds to the arms total at Ironwave's coverage fraction.
- **E4** Exercises the user has logged before are preferred over new ones for the same muscle.
- **E5** A muscle below minimum effective volume gains a set. A muscle with falling reps or mostly Hard sets loses one. Both happen silently, through `Engine.autoregVolume`.
- **E6** "How was that?" on the Done screen (Too easy, Just right, Too much) changes the next workout by one set per exercise, up or down.
- **E7** A lighter week starts silently when reps fell on 3 or more exercises within 7 days, or half the sets of the last two workouts were Hard. For 7 days each exercise has one set fewer and weights do not rise.
- **E8** A suggested workout is estimated at 30 minutes or less with Ironwave's time model.
- **E9** After 8 weeks or 3 stalled sessions on an exercise, the list offers one alternative for that muscle.

### F. My plan

- **F1** The plan is offered once the user has 8 workouts and at least 2 a week for 3 weeks running.
- **F2** Days per week is the median of the last 4 weeks, between 2 and 6. It is never asked.
- **F3** The plan keeps every exercise logged 3 or more times in the last 4 weeks.
- **F4** Declining changes nothing else. The offer does not return for 8 workouts.
- **F5** With a plan, the home screen opens on the next planned day. Training on a different day or skipping one produces no message.

### G. Progress and tone

- **G1** The Progress screen appears after the third workout. It has three dots for each goal muscle, one strength line per exercise and a count of workouts this month.
- **G2** The rendered app never contains: RPE, RIR, 1RM, MEV, MRV, deload, volume, a percent sign, "missed", "streak", "drop set", "myo".
- **G3** No user-facing string contains an em dash (the Ironwave rule).
- **G4** Weights display in kg or lb from the phone's region and are stored in kg.

### H. Data

- **H1** All data stays on the device. After first load the app makes no network request.
- **H2** Saved state carries a version and loads through a migration that can be run twice with the same result.
- **H3** The user can export everything to one file and import it again, on web or Android.

### I. Web on GitHub Pages

- **I1** A push to `main` that touches the product deploys it to GitHub Pages through a workflow, without the tests or tooling.
- **I2** It installs to a home screen and works offline after the first visit.
- **I3** It is usable at 360 px wide with no horizontal scroll.
- **I4** Ironwave's deployment and its obscured path are unaffected.

### J. Android

- **J1** The Android app contains the same web files as the Pages build and runs with the network off from first launch.
- **J2** Every push to main that touches the product builds an installable APK in CI and attaches it to a test release on GitHub. It is signed with one fixed test key, so each new build installs over the last one. No store publishing is in scope.
- **J3** The Android back button closes the top layer or returns to Pick. It never discards logged sets.
- **J4** The end of a rest period vibrates the phone.
- **J5** Data survives an app update.

### K. No regressions

- **K1** Ironwave's existing suite stays green and its golden master stays byte-identical.
- **K2** The new product's suite runs in CI on Node 18 and 20, with the same rule as Ironwave for DOM tests on Node 18.
- **K3** The coach module is pure: no DOM, no storage, and the clock is passed in.

### L. Silent intensity

- **L1** No extra set is ever added before the user has 8 weeks since their first workout and 16 workouts logged.
- **L2** An extra set is added only to an exercise that trains a goal muscle, has been logged in 6 or more workouts, is not a barbell squat, deadlift, bench press or overhead press, and is the last exercise for that muscle in the workout.
- **L3** On machines, cables and dumbbells it is a drop set: one extra set at 20% less weight, rounded to the increment, same rep target, after a 15 second rest. On other weighted exercises it is myo-reps: two extra sets of 5 reps at the same weight, 18 seconds apart. Both come from `Engine.buildDropSet` and `Engine.buildMyoReps`. Bodyweight exercises never get one.
- **L4** At most one exercise per workout and two per muscle in 7 days. Never in a lighter week, never when the muscle is at 90% or more of its maximum recoverable volume, never in the workout after a Too much answer. If the normal sets fell 2 or more reps short that day, the extra set is removed.
- **L5** It appears only as a higher set count, pre-filled steppers and a short rest timer. No name, label or explanation exists anywhere in the app.
- **L6** Extra sets count as one set toward the muscle's weekly volume and in full toward tonnage. They are ignored by D3 to D5, by D10 and by the rep-trend checks in E5 and E7.
- **L7** Skipping the extra set three times in a row stops them for 8 weeks. After four completed uses on an exercise the dose becomes two drops, or three short sets.

## Technical decisions

One codebase of plain web files serves both targets: GitHub Pages publishes it as an installable web app, and Capacitor wraps the same files into the Android app.

| Decision | Choice | Reason |
| --- | --- | --- |
| Language and tooling | Vanilla JavaScript, no bundler, `node:test`, jsdom for DOM tests | Same conventions as Ironwave, so the engine loads unchanged and CI is copied, not invented |
| Location | A new `beginner/` folder beside `app/` in the Ironwave repository (working name) | The engine is shared from one source with no copy to drift |
| Shared code | `app/engine.js` and `app/data.js` as they are, plus a new pure `app/routine-core.js` lifted out of `app.js` | Ironwave keeps working from the same files, guarded by its golden master |
| Assembly | One small Node script copies the shared files and `beginner/` into `beginner/www/` | It is the single input for local dev, Pages and Android. It is a copy, not a build |
| State | One flat log of workouts and sets, the goals, the name and excluded equipment. No program tree | Every suggestion is derived from the log, so nothing can fall out of sync |
| Storage | A storage adapter with one implementation on IndexedDB | The same code runs in the browser and in the Android WebView |
| Web hosting | The existing `pages.yml` gains a second assembled folder | One Pages site per repository. Ironwave's path stays as it is |
| Android | Capacitor, with the web files bundled inside the app | Works offline from first launch and does not depend on the Pages site being up |

### Why Capacitor and not a Trusted Web Activity

A Trusted Web Activity is the lighter way to put a web app in the Play Store, but it must prove ownership of the site with a file at the root of the domain. A project site at `owner.github.io/repo/` does not own that root. It would need a separate `owner.github.io` repository or a custom domain. Capacitor avoids the problem, and adds vibration and back-button handling.

The cost is that the web app and the Android app keep separate data. Criterion H3 (export and import) is the bridge between them.

### Folder layout

```
app/                    Ironwave, unchanged apart from loading routine-core.js
  engine.js             shared
  data.js               shared
  routine-core.js       new, pure: volume count, exercise picker, split generator
beginner/
  index.html, styles.css, manifest.json, sw.js
  config.js             every tunable threshold
  exercises.js          trimmed list, equipment keys, goal table
  coach.js              pure: next target, suggestion, recovery, plan offer
  store.js              state shape, migration, storage adapter, export and import
  ui.js                 the screens
  media/                one demo per exercise
  test/                 node:test suites and harnesses
  android/              Capacitor project
scripts/assemble-beginner.js
.github/workflows/      ci.yml and pages.yml extended, android.yml new
```

## Model delegation

Nothing in this plan requires Fable. The lead session can run on Opus, and every work package names the model that writes its tests and the model that builds it.

| Role | Model | Owns | Does not do |
| --- | --- | --- | --- |
| Lead | Opus (Fable optional) | Runs the packages in order, writes each agent's brief, merges, keeps this doc's criteria as the source of truth | Write feature code |
| Spec and algorithm | Opus agents | Tests for `coach.js` and `routine-core.js` written from the criteria, the refactor out of `app.js`, the simulation test, review of every package before merge | Screens, data entry |
| Builder | Sonnet agents | Implementation to make failing tests pass, screens, storage, service worker, workflows, the Capacitor project, DOM tests | Change a test written by another agent |
| Clerk | Haiku agents | Exercise data and equipment tags, cue and label strings, fixtures, changelog, running both suites and reporting the result | Anything in `coach.js`, `routine-core.js` or `engine.js` |

### Rules

1. **Whoever writes the tests does not write the code.** For algorithm packages Opus writes the tests and Sonnet makes them pass. The stronger model fixes the meaning, the cheaper one does the typing.
2. **A builder may not edit a test file.** If a test looks wrong, the builder stops and reports. Only the test's author or the lead changes it.
3. **Each agent owns named files.** Two packages running at the same time never share a file, and each runs in its own worktree.
4. **Every brief has the same five parts**: package ID, criteria IDs, files owned, the test command, and the definition of done from the next section.
5. **Escalate by failure, not by guess.** Two failed attempts by Haiku go to Sonnet. Two failed attempts by Sonnet on the same red test go to Opus. A criterion that looks wrong or contradictory goes to Martin.
6. **Engine math is frozen.** No agent changes `engine.js` or Ironwave's golden master. A package that seems to need it stops and escalates.

### Where Fable would earn its place, if used at all

Two moments: reviewing the refactor in package 9, where a subtle change would alter Ironwave's prescriptions, and the final audit of all 67 criteria. Both can be done by Opus.

## TDD method

Yes, test-first is the right method here. Most of the product is silent math, and silent math can only be trusted through tests because there is no text on screen to check it against.

### Test layers

| Layer | Covers | Tool | Weight |
| --- | --- | --- | --- |
| Unit | `coach.js`, `routine-core.js`: every D, E and F criterion with seeded logs and an injected clock | `node:test` | Heavy |
| Data | Every exercise has a muscle, equipment key, cue and demo file. Goal table covers all five goals | `node:test` | One suite |
| Store | Migration, per-set saving, resume, export and import round trip | `node:test` with an in-memory adapter | Medium |
| Flow | Tap sequences in a real DOM: fresh install to first set, exclusion refill, back handling | jsdom, Node 20 and up | One test per A, B and C criterion |
| Lint | Forbidden words and em dashes across every rendered screen and string table | `node:test` | One suite |
| Simulation | A seeded synthetic user over 12 weeks. Weight never jumps more than one increment, goal-muscle volume reaches the minimum and never passes the maximum, the loop settles | `node:test` | One suite, written by Opus |
| Device | Offline launch, back button, vibration, update keeps data | Manual checklist on one Android phone | Before each release |

### The loop for every package

1. **Red.** The test author writes failing tests for the package's criteria. Each test name starts with its criterion ID, for example `D4 raises weight one increment when all sets hit 12`. The tests are committed while failing.
2. **Green.** A different agent writes the least code that passes them, touching only its own files.
3. **Review.** An Opus agent reads the diff against the criteria and looks for code that satisfies the test but not the intent.
4. **Regress.** A Haiku agent runs the full suites of both apps and reports pass or fail with the output.
5. **Merge.** The lead merges and ticks the criteria.

### Definition of done for a package

- Every criterion ID in its brief has at least one passing test named after it.
- `npm test` passes in `beginner/` and in `app/`, and Ironwave's golden master is untouched.
- No test was edited by the agent that wrote the code.
- Thresholds are read from `config.js`, not written into logic.
- `CHANGELOG.md` has a line for it.

## Work packages

Thirteen packages in four releases. Release 1 is a complete product on web and Android: a logger that suggests a workout and progresses it silently. Android comes in package 7, early, so WebView problems surface before most of the code exists.

| # | Package | Tests by | Built by | Criteria | Needs |
| --- | --- | --- | --- | --- | --- |
| 1 | **Scaffold.** `beginner/` skeleton, test harnesses that load engine, data and coach in one realm, the assemble script, `config.js`, a CI job for the new folder | Sonnet | Sonnet | K2 | none |
| 2 | **Exercise data.** About 40 movements chosen from `EXERCISE_LIST`, a specific equipment key each, the goal-to-focus table, cues, placeholder demos | Sonnet (schema tests) | Haiku | B3, A5 | 1 |
| 3 | **Store.** State shape, versioned migration, save per set, resume, export and import, storage adapter | Sonnet | Sonnet (second agent) | C6, H1, H2, H3 | 1 |
| 4 | **Coach, part 1.** Effort mapping, next target, easy-set correction, set count, new best, goal-first ranking of six, equipment exclusion and refill | Opus | Sonnet | D2 to D10, B1, B2, B4, B5, K3 | 1 |
| 5 | **Screens.** Goal and name, Pick, Lift, Done, rest timer | Sonnet (flow tests) | Sonnet (second agent), Haiku for strings | A1 to A5, B6, C1 to C5, D1, G3, G4 | 2, 3, 4 |
| 6 | **Web release.** Manifest, service worker, offline shell, `pages.yml` extended | Sonnet | Sonnet | I1 to I4 | 5 |
| 7 | **Android APK.** Capacitor project on the assembled folder, back button, vibration, `android.yml` that builds the APK with the fixed test key and attaches it to a GitHub test release | Sonnet | Sonnet | J1 to J5 | 6 |
|  | **Release 1: install the APK on your phone** |  |  |  |  |
| 8 | **Progress and tone.** Progress screen, forbidden-word and em-dash lint over every screen | Sonnet | Sonnet (second agent) | G1, G2 | 5 |
| 9 | **Core refactor.** Lift the volume count, accessory picker and split generator out of `app.js` into pure functions in `routine-core.js`. Ironwave calls them through thin wrappers | Sonnet writes characterization tests that pin today's outputs | Opus | K1 | 1 |
| 10 | **Coach, part 2.** Rolling volume, ranked suggestion, silent add and cut, session feel, lighter week, time fit, rotation, the 12-week simulation | Opus | Sonnet | E1 to E9 | 4, 9 |
|  | **Release 2** |  |  |  |  |
| 11 | **My plan.** Rhythm detection, plan from the split generator on observed days, the offer and decline, plan-aware home | Opus | Sonnet | F1 to F5 | 10 |
|  | **Release 3** |  |  |  |  |
| 12 | **Silent intensity.** Eligibility gate, technique choice by equipment, the extra sets in the Lift counter and rest timer, volume accounting, the skip opt-out. The simulation is extended to 24 weeks to prove volume stays under the ceiling with techniques on | Opus | Sonnet | L1 to L7 | 10 |
| 13 | **Hardening.** Audit of all 67 criteria against test names, 360 px pass, device checklist, real demo media swapped in | Haiku runs the audit | Sonnet, Opus reviews | all | 12 |
|  | **Release 4** |  |  |  |  |

### What can run at the same time

- Packages 2, 3 and 4 after package 1. They own different files.
- Packages 8 and 9 after release 1.
- Everything else is sequential.

### Notes for the trickier packages

- **Package 4** receives the D criteria as its whole specification. The examples in D3 to D6 become the first tests. Opus adds edge cases: one-set workouts, a changed weight mid-session, an exercise not seen for months, lb rounding.
- **Package 9** is the only one that touches Ironwave. The characterization tests are written and green on the current code before any line moves. The functions read the globals `S` and `V` today, so the pure versions take those values as arguments. If the golden master changes by a single byte, the refactor is wrong.
- **Package 10** cannot reuse Ironwave's weekly cadence. `autoregVolume` is called on a rolling 7-day window, and its offset resets when a lighter week ends, which replaces Ironwave's reset at block end.
- **Package 11** must check what `generateBodybuildingDays` does with 2 days. Ironwave only uses it for 3 to 6. If it fails, a two-day full-body fallback is added in `coach.js`, not in the shared generator.

## Android packaging and release

The Android app is the assembled web folder inside a Capacitor shell, built by GitHub Actions. No Android-specific product code is written beyond three small hooks.

### What package 7 builds

1. Capacitor is added inside `beginner/android/` with its web directory pointed at `beginner/www/`, the output of the assemble script.
2. A thin `platform.js` hides the differences. On Android it uses Capacitor's App plugin for the back button, Haptics for vibration, and Filesystem with Share for export. On the web it uses browser equivalents.
3. The service worker is registered on the web only. Inside the Android app the files are already local.
4. `android.yml` runs assemble, sync and an APK build on every push to main. It signs the APK with a fixed test key kept in the repository and attaches it to a GitHub pre-release called Latest test build. The fixed key matters: an APK signed with a different key will not install over the previous one, and the history would be lost.
5. The agent checks the current Capacitor documentation for versions, minimum Android version and plugin names before writing any of this. It should not rely on memory.

### What only you can do

- [ ] On the phone, allow your browser or file manager to install unknown apps. Android asks for this the first time.
- [ ] Open the Latest test build release on GitHub from the phone, download the APK and install it. If the repository is private, sign in to GitHub in the phone's browser first.
- [ ] For every later build, install the new APK over the old one. Your history stays.

Nothing else is needed for testing. The app uses a placeholder name and application ID until you choose real ones.

Publishing to the Play Store later is a separate step and is not planned here. It needs a developer account, a private signing key, the final application ID and a privacy page. The test build must be uninstalled before a store build can be installed, so export your history first (criterion H3).

### Device checklist before each release

- [ ] Install with the network off, complete a full workout.
- [ ] Lock the phone during a rest period. The timer is correct on unlock and the phone vibrates at the end.
- [ ] Press back on every screen. No set is lost.
- [ ] Force-stop mid-workout, reopen, and the workout resumes.
- [ ] Install the new version over the previous one. History is intact.
- [ ] Export on the web, import on Android, and the history matches.

## Starting the new session

Start the session inside the `ironwave/` folder, which is the repository with the workflows and `CLAUDE.md`. The `app/` folder one level up is the old v1.0.0 snapshot and should be ignored.

All three documents are saved next to this file in `docs/beginner-app/`: this one, `product-plan.md` and `ironwave-training-algorithms-report.md`. `README.md` in the same folder is the handoff note and holds the current first message. It reads along these lines:

```
You are the lead for building the beginner app described in docs/beginner-app/.
The Acceptance Criteria and Coding Plan is the source of truth. Where it and the Product
Plan disagree, the criteria win. Read docs/beginner-app/README.md and CLAUDE.md first.
Work on branches and open pull requests, because main is protected.

Work through the packages in order. For each one, spawn the agents named in the Work
packages table using the model listed (opus, sonnet or haiku), follow the five-step loop
in TDD method, and obey the six delegation rules. Do not write feature code yourself.
Start with package 1 and stop for my review after package 7 (Release 1).
```

### Open items

None of these blocks the build. Each has a default the agents will use.

| Item | Needed by | Default if unanswered |
| --- | --- | --- |
| App name and Android application ID | Before any store release | Placeholder name, folder stays `beginner/`, a placeholder ID for test builds |
| Source of the 40 exercise demos | Package 13 | Placeholder images until then |
| Same repository, or its own? Ironwave's Pages path is deliberately obscured | Package 6 | Same repository, in its own path |
| What Look fit and Look strong mean in muscle focus | Package 2 | Look fit: all muscles equal. Look strong: chest, back, shoulders and legs raised one step |
| The 8 weeks and 16 workouts before intensity techniques start | Package 12 | As written in L1. Both numbers sit in `config.js`, so you can lower them on your own phone to test sooner |
| Hand-off of history to Ironwave | After release 4 | Not built. The export file from H3 already holds what Ironwave would need |

The Product Plan was rewritten on 10 Nov 2026 to match these criteria, including the silent intensity techniques. The two documents now agree.

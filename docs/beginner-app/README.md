# Beginner app: start here

Handoff written on 10 Nov 2026 at the end of the planning session. Nothing has been
built yet. No code, folder or workflow for the beginner app exists. The next step is
package 1 of the coding plan.

## What this is

A second product in this repository: a very simple workout app for complete beginners,
built on Ironwave's engine. It lives in a new `beginner/` folder beside `app/`
(working name, not final). It ships as a web app on GitHub Pages and as an Android APK
for sideloading. It is not being published to a store.

## Read in this order

1. `acceptance-criteria-and-coding-plan.md` **Source of truth.** 67 acceptance
   criteria (A1 to L7), technical decisions, which model does what, the TDD loop, and
   13 work packages. Where anything disagrees with it, it wins.
2. `product-plan.md` The why: who the user is, the six principles, the screens, how
   the engine is used silently.
3. `ironwave-training-algorithms-report.md` How Ironwave's existing engine works.
   Reference only. Read the sections a package needs.
4. `../../CLAUDE.md` Repo conventions and the existing test suite.

The two plans also exist as live docs that Martin may edit:
[Product Plan](https://claude.ai/artifact/V7iS2evCKyTxgo64Q9YUZB) and
[Acceptance Criteria and Coding Plan](https://claude.ai/artifact/ENQZUZghfnaPhQPqC6yBjR).
The markdown files here are a snapshot from 10 Nov 2026. If Martin says he edited the
docs, re-export them over these files before continuing.

## How Martin wants this run

- **Do not lean on the top model.** The lead session orchestrates and delegates to
  Opus, Sonnet and Haiku agents as the Work packages table says. The lead does not
  write feature code.
- **Test first.** Tests are written and committed red by one agent, made green by a
  different one. A builder never edits a test file.
- **Silent product.** If the app can do the math, it applies the result and says
  nothing. No instructions, targets or explanations on screen. This is the rule most
  likely to be broken by a well-meaning agent adding a helpful label. Criteria D1, G2
  and L5 enforce it.
- **Stop for review after package 7** (Release 1: the APK on Martin's phone).

## Verified facts about the repo (checked 10 Nov 2026)

- Repository root is this `ironwave/` folder. Remote `origin` is on GitHub, branch
  `main`, working tree was clean before these docs were added.
- `main` is branch-protected and requires the `check (18)` and `check (20)` CI jobs.
  Work goes through branches and pull requests, never a direct push.
- Baseline: `cd app && npm test` gives 209 tests, 209 pass, 0 fail (Node 24 locally,
  dependencies already installed).
- `app/engine.js` is one pure `Engine` object (line 7). Confirmed present:
  `e1rm` (33), `weightFor` (41), `bestE1RM` (48), `calibrationRamp` (104),
  `warmupSets` (233), `tonnage` (262), `buildDropSet` (284), `buildMyoReps` (305),
  `buildRestPause` (318), `restSecFor` (371), `e1rmTrend` (400). The technique
  builders take an options argument, so a smaller dose (`drops: 1`, `minis: 2`) needs
  no engine change.
- `app/data.js` exercise rows are `[id, name, movement, equipment, isMain]` with
  equipment codes `bb, db, mc, cb, bw, kb, bd`. Those codes are too coarse for the
  "I don't have that here" button (criterion B4), which needs a specific key per
  machine. Package 2 adds that key in `beginner/exercises.js`. `EX_CUES` (line 410)
  already holds form cues, and `EX_META` (334) holds stimulus and muscle-head data.
- Functions that package 9 lifts out of `app/app.js`:
  `pickAccessory` (462) and `generateBodybuildingDays` (479 to 574) contain no direct
  reference to the globals `S`, `V` or `P()`. `weeklyVolumeByMuscle` (2076 to 2097)
  reads `P()` once. So the refactor is smaller than the coding plan assumes. Not
  checked: which other `app.js` helpers and `data.js` tables these three call. Map
  that before moving anything.
- `autoregVolume`, `volumeStatus`, `seedLandmarks` and `deloadDepth` are named in
  `CLAUDE.md` and the algorithms report as pure engine helpers. Their exact
  signatures were not opened in the planning session. Read them before writing tests
  against them.
- Tests reach the app through `app/test/load-app.js`, which concatenates the three
  scripts and compiles them in the current realm. The beginner app needs its own
  harness on the same pattern (package 1).
- `.github/workflows/pages.yml` assembles `app/` into `_site/<PAGES_DIR>/` and strips
  tests, server and packaging. `PAGES_DIR` is a repo variable used to obscure
  Ironwave's path. Package 6 adds a second folder to that assembly step and must not
  change Ironwave's path (criterion I4).
- `.github/workflows/ci.yml` runs in `app/` on Node 18 and 20. Package 1 adds a
  second job for `beginner/`. Keep the existing job names, because branch protection
  refers to them.
- House rule from `app/CONTRIBUTING.md`: no em dashes in user-facing strings.
- The folder one level above this repository holds an older `app/` snapshot
  (v1.0.0). Ignore it.

## Decisions already made (do not reopen)

- Separate app in `beginner/`, sharing `app/engine.js` and `app/data.js`. Vanilla
  JavaScript, no bundler, `node:test`.
- Android through Capacitor with the web files bundled in. Test builds only: an APK
  signed with one fixed test key committed to the repo, attached to a GitHub
  pre-release. That key must never be used for a store release.
- Intensity techniques are in scope, limited to drop sets and myo-reps, applied
  silently (criteria L1 to L7).
- Every numeric threshold lives in `beginner/config.js`.

## Still open (defaults are in the coding plan, none blocks the build)

App name and application ID, source of the exercise demo media, what "Look fit" and
"Look strong" mean in muscle focus, and whether the product later moves to its own
repository.

## First message for the new session

```
You are the lead for building the beginner app. Read docs/beginner-app/README.md
first, then the three documents it lists, then CLAUDE.md.

docs/beginner-app/acceptance-criteria-and-coding-plan.md is the source of truth.
Work through its packages in order. For each one, spawn the agents named in the
Work packages table with the model listed (opus, sonnet or haiku), follow the
five-step loop in "TDD method", and obey the six delegation rules. Do not write
feature code yourself. Work on branches and open pull requests, since main is
protected. Start with package 1 and stop for my review after package 7.
```

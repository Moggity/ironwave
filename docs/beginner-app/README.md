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

## What changed under the plans (read this before trusting any detail)

The planning session worked from a local checkout that was 111 commits behind
`main` (Ironwave v1.1.11, 209 tests). The algorithms report describes that old
version too. This was only noticed at the end. The plans were then checked against
current `main` (v1.19.0, 557 tests) for the points below, and corrected where a line
was plainly wrong. The acceptance criteria describe behaviour, so they still hold.
The parts that name Ironwave internals need a fresh look by whoever takes each
package.

- **Double progression already exists.** `Engine.doubleProgression(records, lo, hi,
  targetRpe, inc)` (engine.js 505) and `Engine.repRangeFor(movement, sfr)` (480).
  The "next target" rule in criteria D3 to D5 should wrap these, not reimplement
  them. If their behaviour differs from D3 to D5, raise it with Martin; do not
  change the engine.
- **The focus scale is 0 to 3, not 0 to 6.** `FOCUS_MAX = 3` (data.js 1540): 1 Light,
  2 Standard, 3 High, and the value is the weekly frequency. Goal tiles map to 3 for
  the goal muscle and 2 for the rest. The two plan files were corrected. The
  algorithms report still shows the old slider tables.
- **The split generator was rewritten.** It is now
  `generateBodybuildingDays(focus, N, opts)` (app.js 912 to 1094) under a frequency
  contract enforced by `validateFocusWeek` and `test/focus-honesty.test.js`, with
  short weeks allowed. Package 11's worry about 2 training days may already be
  solved. Check before adding a fallback.
- **`Engine.coach` exists** (engine.js 572): the arbitrator for plausibility and
  session budgets, including `focusBudget` and `checkSessionEstimate`. Criterion E8
  (a workout near 30 minutes) should consult it.
- **Exercise media plumbing exists.** `app/media/manifest.json` and
  `docs/exercise-media.md` define looping clips: one rep, 3 to 5 seconds, H.264 MP4
  under 500 KB, named by exercise id. Use the same format and files for the demos in
  criterion B3 instead of inventing one.
- **kg and lb are already handled** as a display skin over kg storage
  (`app/test/units.test.js`). Criterion G4 should reuse that code.
- The repo also gained many documents under `docs/` (launch, monetization, legal,
  release engineering, hidden UI). They were not read in the planning session.
  `docs/release-engineering-report.md` may bear on the Android decision.

## Verified facts about the repo (checked against main at v1.19.0, 10 Nov 2026)

- Repository root is this `ironwave/` folder. Remote `origin` is on GitHub, branch
  `main`. **Run `git pull` first.** The local checkout had been far behind.
- `main` is branch-protected and requires the `check (18)` and `check (20)` CI jobs.
  Work goes through branches and pull requests, never a direct push.
- This machine has no GitHub CLI. Git pushes work with
  `git -c credential.helper=manager push`.
- Baseline: `cd app && npm test` gives 557 tests, 557 pass, 0 fail (Node 24 locally).
- `app/engine.js` is one pure `Engine` object (line 7). Confirmed present:
  `e1rm` (39), `weightFor` (47), `bestE1RM` (54), `calibrationRamp` (126),
  `buildDropSet` (329), `buildMyoReps` (350), `restSecFor` (416), `e1rmTrend` (445),
  `repRangeFor` (480), `doubleProgression` (505), `coach` (572). The technique
  builders take an options argument, so a smaller dose (`drops: 1`, `minis: 2`) needs
  no engine change. Line numbers drift; search by name.
- `app/data.js` exercise rows are `[id, name, movement, equipment, isMain]` with
  equipment codes `bb, db, mc, cb, bw, kb, bd`. Those codes are too coarse for the
  "I don't have that here" button (criterion B4), which needs a specific key per
  machine. Package 2 adds that key in `beginner/exercises.js`. `EX_CUES` (455) holds
  form cues and `EX_META` (352) holds stimulus and muscle-head data.
- Functions that package 9 lifts out of `app/app.js`: `pickAccessory` (754) and
  `generateBodybuildingDays` (912 to 1094) contain no direct reference to the globals
  `S`, `V` or `P()`. `weeklyVolumeByMuscle` (3547 to 3568) reads `P()` once. So the
  refactor is smaller than the coding plan assumes. Not checked: which other `app.js`
  helpers and `data.js` tables these three call. Map that before moving anything.
- `autoregVolume`, `volumeStatus`, `seedLandmarks` and `deloadDepth` are named in
  `CLAUDE.md` as pure engine helpers. Their signatures were not opened in the
  planning session. Read them before writing tests against them.
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

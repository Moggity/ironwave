# CLAUDE.md

Guidance for Claude (and humans) working in this repo. Read `CONTRIBUTING.md`
for style and branching; this file focuses on what is easy to get wrong.

## Project shape

- Self-hosted powerbuilding web app. **Plain Node + vanilla JS, no build step.**
- The app lives in `app/`. `index.html` loads `data.js`, `engine.js`, `app.js`
  as plain `<script>` tags sharing **one global scope** (order matters: data,
  then engine, then app). `server.js` is a thin Express layer that persists
  state to `database.json` via `GET`/`POST /api/state`.
- The training brain is `engine.js`. Prescription schemes (`jm2-wave`,
  `jbb-hyp`) are registered there and **never mix**. Treat changes to
  prescription math as high-impact.
- Hard style rule: **no em dashes in athlete-facing strings** (notes, toasts,
  labels). Code comments are exempt. See `CONTRIBUTING.md`.

## Onboarding: how the app fits together

Read this once before your first change; it is the map the file names do not give
you.

### The three scripts (one shared global scope)

- **`data.js`** — pure data, no logic. Movement taxonomy (`MOVEMENTS`,
  `EXERCISES`/`EXERCISE_LIST`), the Juggernaut wave tables (`WAVES`,
  `DELOAD_SETS`), program/day templates (`PROGRAM_TEMPLATES`, `DAY_TEMPLATES`,
  `BB_DAY_TEMPLATES`), the bodybuilding tuning tables (`JBB_HYP`,
  `VOLUME_LANDMARKS`, `EXPERIENCE_FACTOR`, `TIME_MODEL`), and the split-generator
  tables (`SPLIT_FREQ`, `ANCHOR_RANK`, `PRIMARY_ANCHOR`, `DEFAULT_ACC`,
  `FOCUS_FACTOR`). If you are adding a lift, a template, or a constant, it goes
  here.
- **`engine.js`** — pure, stateless math (the `Engine` object) plus the
  **scheme registry** (`Engine.schemes`, `registerScheme`, `schemeFor`). Nothing
  here reads `S`/`V`; everything takes its inputs as arguments and returns set
  objects. This is the heavily-tested half. See `golden-master`/`engine` tests.
- **`app.js`** — everything stateful: migration, the routine generators, slot
  resolution, all rendering, and all event handlers. This is the lightly-tested
  half (smoke only).

### State: two globals, `S` and `V`

- **`S`** is the persisted athlete state (`S.program`, `S.profile`,
  `S.trainingConfig`, logs). It round-trips to `database.json` through
  `server.js` (`GET`/`POST /api/state`). `P()` is shorthand for `S.program`.
- **`V`** is ephemeral view state (current day index, onboarding draft `V.ob`,
  modal drafts). It is *not* persisted; losing it just resets the UI.
- Mutate `S`/`V`, then call **`render()`** — there is one render entry point and
  views are pure functions of state. Modals stack via `showModal`/`MSTACK`.

### The routine tree (how a workout is produced)

```
S.program
  .blocks[]          each block declares { scheme, type, wave, mesoIdx }
    .weeks (0..4)    week type via Engine.weekType: intro→deload
      .days[]        from a template OR generateBodybuildingDays()
        .slots[]     { type: main | secondary | acc | select }
```

`resolveSlot(slot, blockIdx, wIdx)` (app.js) is the choke point: it looks up the
block's scheme with `Engine.schemeFor(block)` and calls that scheme's
`main`/`secondary`/`accessory`. **Schemes never mix** (`jm2-wave` for strength,
`jbb-hyp` for hypertrophy) — this is enforced by `scheme-isolation.test.js`.
For bodybuilding, `focusForAccessory` / `bbLiftRemoval` reshape or drop slots
from the muscle-focus sliders *after* the scheme prescribes; they are a no-op for
every other track, which is why default/powerbuilding output stays byte-identical
(the golden-master contract).

### The bodybuilding split generator

`generateBodybuildingDays(focus, N)` in `app.js` builds a week from the seven
focus sliders: it splits N days into upper/lower by slider points, assigns each
day a **primary** (anchor) muscle rotating across anchor-capable muscles, spreads
remaining frequency as accessories, then interleaves the regions. The
split-generator tuning items in `docs/pending-future-work.md` all live in this
one function plus the `ANCHOR_RANK`/`PRIMARY_ANCHOR` tables.

### Adding a feature, in order

1. New data/table → `data.js`. New math → `engine.js` (add to a scheme, or the
   `Engine` object). New stateful behavior/UI → `app.js`.
2. If you add a top-level engine/generator function, **export it through the
   harness shim** (`test/load-app.js`) or tests cannot see it.
3. Keep non-default tracks no-ops on the default path, or regenerate the golden
   master and review the diff.
4. Extend the matching test file; run `npm test`; update `CHANGELOG.md`.

## Testing — this runs on EVERY pull request

There is an automated test suite under `app/test/` (Node's built-in
`node:test`, no build step). **CI runs `npm test` on every push and PR, on
Node 18 and 20, and `main` is branch-protected** requiring the `check (18)` and
`check (20)` status checks — so a red test blocks merge. Plan for this in every
change:

```sh
cd app
npm test            # run the whole suite locally before you push
```

**Run `npm install` in `app/` first in a fresh checkout.** `jsdom` is a
devDependency (the only one), and a clean container does not have it until you
install. Without it, `render-smoke.test.js` fails with `Cannot find module
'jsdom'` and `persistence.test.js` can fail too — these are setup failures, not
regressions in your change. If you see those two go red, run `npm install` and
re-run before debugging anything.

What the suite covers (keep it passing; extend it when you add behavior):

- **`golden-master.test.js`** — snapshots every `resolveSlot` output for the
  default Powerbuilding program (uncalibrated + calibrated) and asserts it never
  changes. **If you intentionally change engine output, regenerate the snapshot
  and review the diff:**
  ```sh
  UPDATE_GOLDEN=1 node --test test/golden-master.test.js
  ```
  A failure with no intended engine change is a regression.
- **`engine.test.js`** — pure math: `e1rm`/`weightFor`, `roundLoad`,
  `amrapAdjust`, `plateMath`, `warmupSets`, `readinessScore`, `seedLandmarks`,
  and `prescribeMain` / `jbb-hyp` ramps.
- **`scheme-isolation.test.js`** — `schemeFor` routes only on `block.scheme`;
  `jm2-wave` and `jbb-hyp` never blend.
- **`migration.test.js`** — a legacy save loads via `migrateState`, is
  backfilled, and migration is idempotent.
- **`focus-generator.test.js`** — focus sliders reshape volume, the split
  generator's region allocation, core/optional tiers, and carryover.
- **`render-smoke.test.js`** — renders every view in jsdom for a default and a
  bodybuilding program. jsdom needs Node >= 20, so this file **self-skips on
  Node < 20**; the engine suites still cover Node 18.
- **`persistence.test.js`** — starts `server.js` and round-trips
  `GET`/`POST /api/state` over real HTTP against a temp `IRONWAVE_DB` file.

### Harnesses (how tests reach the app's globals)

- **`test/load-app.js`** — concatenates the three scripts and compiles them in
  the current realm (an IIFE via `runInThisContext`, browser globals passed as
  parameters, `boot()` stripped). Returns the engine surface plus `S`/`V`
  setters. Use this for any pure-engine test (no DOM needed). Realm matters:
  compiling in-realm is what lets `deepStrictEqual` compare returned objects.
- **`test/load-dom.js`** — loads the app into a real jsdom window for view/render
  tests (needs Node >= 20).
- When a feature adds a new top-level engine/generator function, **add it to the
  export shim** in the relevant harness or tests cannot reach it.

### Conventions

- Deterministic and no network: stub `fetch`, point the server at a temp
  `IRONWAVE_DB`, never touch a real `database.json`. Seed anything time-based.
- Test the engine heavily, the UI lightly (smoke only).
- `docs/pending-future-work.md` lists which upcoming features will force test
  updates (e.g. sport-aware scheduling introduces clock dependence that breaks
  the date-independent golden master). Budget the test change with the feature.

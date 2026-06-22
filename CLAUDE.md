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

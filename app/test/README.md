# Tests

Automated tests for IRONWAVE. No build step: plain Node's built-in test runner
(`node:test`), run from the `app/` directory.

```sh
npm test          # runs test/*.test.js
```

**CI runs this on every push and pull request, on Node 18 and 20, and `main` is
branch-protected on the `check (18)` / `check (20)` checks** — a red test blocks
merge. Run `npm test` before you push.

## Suites

- **`golden-master.test.js`** — snapshots every block/week/day/slot's
  `resolveSlot` output for the default Powerbuilding program (uncalibrated +
  calibrated) and asserts it never changes. The automated form of the "default
  users stay byte-identical" contract. Expected output is committed in
  `golden-master.json`; when an engine change is **intentional**, regenerate and
  review the diff:
  ```sh
  UPDATE_GOLDEN=1 node --test test/golden-master.test.js
  ```
- **`engine.test.js`** — pure math: `e1rm`/`weightFor`, `roundLoad`,
  `amrapAdjust` (the +10-rep cap and below-standard hold), `plateMath`,
  `warmupSets`, `readinessScore`, `seedLandmarks`, and the `prescribeMain` /
  `jbb-hyp` per-week ramps.
- **`scheme-isolation.test.js`** — `schemeFor` routes only on `block.scheme`;
  `jm2-wave` and `jbb-hyp` never blend.
- **`migration.test.js`** — a legacy save loads through `migrateState`, is
  backfilled, and `migrateState` is idempotent.
- **`focus-generator.test.js`** — focus sliders reshape accessory volume, the
  split generator's region allocation, core/optional time tiers, and carryover.
- **`render-smoke.test.js`** — renders every view in jsdom for a default and a
  bodybuilding program. jsdom needs Node >= 20, so this file **self-skips on
  Node < 20** (the engine suites still cover Node 18).
- **`persistence.test.js`** — starts `server.js` as a child process and
  round-trips `GET`/`POST /api/state` over real HTTP against a temp
  `IRONWAVE_DB` file (never touches a real `database.json`).

## Harnesses

- **`load-app.js`** — concatenates `data.js` + `engine.js` + `app.js` and
  compiles them in the **current realm** (an IIFE via `runInThisContext`,
  browser globals passed in as parameters, the trailing `boot()` stripped).
  Returns the engine surface (`makeProgram`, `resolveSlot`, `defaultState`, the
  focus/generator helpers, key constants) plus `S` / `V` getters/setters so a
  test can install program state and call the engine directly. Compiling
  in-realm is what lets `node:test`'s `deepStrictEqual` compare returned objects
  by structure rather than failing a cross-realm prototype check.
- **`load-dom.js`** — loads the app into a real jsdom window (`#app` /
  `#modal-root` / `#toast-root`, `boot()` stripped, network stubbed) for the
  render smoke test. Requires Node >= 20.

When a feature adds a new top-level engine/generator function, add it to the
relevant harness's export shim or tests cannot reach it.

## Conventions

- Deterministic and offline: stub `fetch`, point the server at a temp
  `IRONWAVE_DB`, seed anything time-based. Test the engine heavily, the UI
  lightly. A red check should be rare and meaningful.

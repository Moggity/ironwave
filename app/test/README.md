# Tests

Automated tests for the IRONWAVE engine. No build step: plain Node's built-in
test runner (`node:test`), run from the `app/` directory.

```sh
npm test          # runs test/*.test.js
```

## How the harness works

The app ships as three plain browser scripts that share one global scope
(`data.js`, `engine.js`, `app.js`). `test/load-app.js` reproduces that by
concatenating the sources and running them once in a `vm` context, with a tiny
`document`/`fetch` stub for the few load-time DOM references and the trailing
`boot()` call stripped so nothing renders or hits the network. It returns the
engine surface (`makeProgram`, `resolveSlot`, `defaultState`, ...) plus an `S`
getter/setter so a test can install program state and resolve slots directly.

## Golden master (`golden-master.test.js`)

Snapshots every block/week/day/slot's `resolveSlot` output for the default
Powerbuilding program, both uncalibrated (no 1RMs yet) and calibrated (fixed
1RMs), and asserts it never changes. This is the automated form of the
"default users stay byte-identical" contract.

The expected output lives in `golden-master.json`. When a change to the engine
is **intentional**, regenerate it and review the diff before committing:

```sh
UPDATE_GOLDEN=1 node --test test/golden-master.test.js
```

A failing run with no intended engine change means a regression: the default
routine moved when it should not have.

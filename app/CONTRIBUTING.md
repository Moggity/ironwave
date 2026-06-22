# Contributing to IRONWAVE

This is a small, self-hosted project. The notes below keep changes safe and
the history readable.

## Project shape

- **Frontend:** vanilla HTML/CSS/JS, no build step. `index.html` loads
  `data.js`, `engine.js`, `app.js` as plain `<script>` tags sharing one global
  scope (order matters: data, then engine, then app).
- **Backend:** `server.js`, a thin Express layer that serves the static files
  and persists state to `database.json` via `GET`/`POST /api/state`.
- **The training brain lives in `engine.js`.** Prescription schemes
  (`jm2-wave`, `jbb-hyp`) are registered there and never mix. Treat changes to
  prescription math as high-impact and verify the per-week output before and
  after.

## Running locally

```bash
npm install
npm start          # http://localhost:3000
```

`database.json` is created automatically on first run and is git-ignored. It
holds real training data, so never commit it.

## Branching

- `main` is always runnable.
- Work on `feat/<short-name>`, `fix/<short-name>`, or `docs/<short-name>`.
- The original engineer used git branching as a safety net for risky changes
  (async state, storage migration, launcher). Keep that habit: branch before
  anything that touches persistence or the engine.

## Commit messages

Conventional Commits, imperative mood:

```
feat: add weekly autoregulation feedback step
fix(engine): stop accessory RPE from exceeding the cap
docs: explain calibration state in the README
chore: pin Node engine to >=18
```

Keep the subject under ~72 chars. Explain the *why* in the body when it is not
obvious.

## Style

- No em dashes in any athlete-facing string (notes, toasts, labels, banners).
  This is a hard rule for user-visible copy. Code comments are exempt.
- Two-space indent, LF line endings, except `.bat` files which must stay CRLF.
  `.editorconfig` and `.gitattributes` enforce this; do not fight them.

## Before opening a pull request

1. Run `npm test` (from `app/`) and make sure it is green. CI runs the same
   suite on every PR on Node 18 and 20, and `main` is branch-protected on those
   checks, so a red test blocks merge. If you changed engine output on purpose,
   regenerate the golden master (`UPDATE_GOLDEN=1 node --test
   test/golden-master.test.js`) and review the diff. See `test/README.md`.
2. `npm start` and click through onboarding, a workout, and a week preview.
3. If you touched the engine, confirm the per-week RPE/set ramp still matches
   intent for both a calibrated and an uncalibrated lift.
4. Update `CHANGELOG.md` with a short entry.

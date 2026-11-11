# Beginner app changelog

## Package 1: scaffold
- Skeleton for the beginner app: bare `index.html`, empty `BEGINNER_CONFIG`, `BEGINNER_EXERCISES`, `Coach`, `Store`, `UI`, test harnesses, `scripts/assemble-beginner.js`, and a `beginner` CI job on Node 18 and 20.

## Package 2: exercise data
- 42 beginner exercises with equipment keys, form cues and placeholder media, plus the five goals (Bigger arms, Bigger chest, Legs and glutes, Look fit, Look strong) with `beginnerGoalFocus`, where a skipped goal means Look fit.

## Package 3: store
- Versioned state with idempotent migration, memory and IndexedDB adapters, a serialised write-through session (every call resolves after the write; failed writes roll back), and one-file export and import.
- Package 3 review fixes: migration never loses a set (extra open workouts are closed, duplicate ids made unique), frozen state, memo slot, import summary, export needs a time, hardened IndexedDB adapter (strict durability, reconnect, write timeout).

## Package 4: coach part 1
- `Coach` silent math and Pick logic: effort mapping, next-target pre-fill (reps, raise, drop, long gap, easy-set correction, reps-only), set count, new bests, suggested six with ticks, equipment exclusion and in-place refill; all thresholds in `BEGINNER_CONFIG.coach`.
- Review fixes: a drop never raises the weight, a zero or missing increment neither raises nor drops, goal and default focus values moved to config.

## Package 3b: store follow-ups
- Timeout no longer rejects a commit already under way, duplicate-id renaming is linear, negative zero is normalised in times and memo, and goal keys come from `BEGINNER_GOALS`.

## Package 5: screens
- The four screens (goal, pick, lift with rest timer, done) plus export and import, rendered from state by one path, with a silent strings table (`strings.js`), mobile-first light and dark styles, and the `ui` config section (rest length, stale-workout limit, units regions).
- Harnesses load `strings.js`, ignore reserved words in the top-level name scan and fall back to the default folder for files a custom folder lacks; the assemble script copies `strings.js`.

## Package 6: web release

- Installable and offline: `manifest.json`, PNG icons in `icons/`, and `sw.js`, a cache-first
  service worker whose cache name carries a content hash written by `assemble-beginner.js`
  (it also injects the precache file list). Only `beginner-` caches are ever deleted.
- `boot.js` replaces the inline boot: `beginnerBoot(env)` runs by itself only for a real
  script tag, registers the worker after the first render (web only) and asks for
  persistent storage once. `index.html` now has a strict Content-Security-Policy (all
  `'self'`), theme-color, apple-touch-icon and noindex.
- `pages.yml` gains one step that assembles the beginner app and copies the assembled
  folder to `_site/${BEGINNER_DIR}` (variable `BEGINNER_PAGES_DIR`, default `beginner`),
  plus the `beginner/**` and assemble-script triggers. Existing lines are unchanged.
- Store-open failure now shows a retry button (and the newer-version text when the saved
  data is from a newer app) instead of a dead end.
- Fixes: a typed lb weight is rounded to two decimals; a logged weight never exceeds
  `maxWeightKg`. `styles.css` constrains `img` and `video`.

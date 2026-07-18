# Volume-landmark derivation note (B1, Gate 4 review sheet)

Date: 2026-07-18. Branch: the landmark-seed migration (legal report item 6,
SS1 methodology, roundtable Station B step B1). This is the one-page
before/after the roundtable plan promises the owner at Gate 4.

## What changed and why

The app used to ship a competitor's published per-muscle volume grid as its
seed values (the old `data.js` comment named the source). That table is now
retired. `VOLUME_LANDMARKS` is the OUTPUT of our own coarse parametric model
of two muscle traits, written in `app/data.js` (`LANDMARK_TRAITS`):

- **need** - the direct weekly sets where growth reliably starts, set by
  muscle size AND how much the big compounds already cover it. Classes:
  high 10, moderate 8, low 6, covered 0 (covered = trained indirectly every
  week by the main lifts: glutes, abs, low back - the coverage weights
  already live in `SYNERGIST_COVERAGE`).
- **recovery** - how wide the productive window stretches above MEV before
  recoverable capacity runs out. Classes: fast +14, medium +12, slow +10
  (axially/systemically fatiguing work is slow; heavy indirect volume from
  pressing also narrows the window, which is why triceps read slow).

From the traits: **MEV = need, MV = 0.6 x MEV, MRV = MEV + recovery span**,
everything snapped to a 2-set grid. The outputs sit inside the consensus
dose-response reading across public sources (a handful of weekly sets
maintains; roughly 8-12 is a solid growth default; past ~20-25 returns
diminish for most) - referenced, never reproduced.

## Before / after, per muscle (MV / MEV / MRV, weekly working sets)

| Muscle | Old seed | New derived | Why it moved |
|---|---|---|---|
| Chest | 8 / 10 / 22 | 6 / 10 / 22 | high need; medium recovery (pressing is locally costly); MV now model-derived |
| Vertical pull | 8 / 10 / 25 | 6 / 10 / 24 | high need; fast recovery (back tolerates volume) |
| Horizontal pull | 8 / 10 / 25 | 6 / 10 / 24 | same class as vertical pull |
| Upper back | 8 / 10 / 25 | 6 / 10 / 24 | same class |
| Quad | 6 / 8 / 20 | 4 / 8 / 18 | moderate need; slow recovery (squatting is systemically expensive) |
| Hamstring | 4 / 6 / 20 | 4 / 6 / 16 | low need (hinges cover much of it); slow recovery (axial cost) |
| Glute | 0 / 0 / 16 | 0 / 0 / 14 | covered by squats/hinges; fast recovery |
| Bicep | 4 / 8 / 26 | 4 / 8 / 22 | moderate need (rows do not cover it); fast recovery |
| Tricep | 4 / 6 / 18 | 4 / 6 / 16 | low need + narrow window: heavy indirect work from all pressing |
| Shoulder (side delt) | 6 / 8 / 26 | 4 / 8 / 22 | moderate need; fast recovery |
| Calf | 6 / 8 / 20 | 4 / 8 / 20 | moderate need; medium recovery |
| Abs | 0 / 0 / 25 | 0 / 0 / 14 | covered by bracing on every compound; ceiling now conservative by construction |
| Low back | 0 / 0 / 12 | 0 / 0 / 10 | covered; slow recovery (erectors) |

Every row differs from the retired triple, and
`app/test/landmark-divergence.test.js` asserts that on every build, plus that
each value is reproducible from the trait tables (a hand-tweaked number that
bypasses the model fails CI) and that everything stays inside the consensus
bounds. That test is the automated proof promised at Gate 4 and demanded by
the paywall-cynic report (CYN4).

## What the owner is confirming (Gate 4)

1. The new numbers are defensible training guidance you would stand behind
   in an interview - they are systematically slightly more conservative than
   the old seed (every MRV is equal or lower; no MEV moved).
2. They are demonstrably NOT the competitor's table - the divergence test
   proves it automatically from now on.

## What existing athletes feel

- **Nothing mid-week and nothing retroactive.** An athlete's evolved
  `profile.landmarks` copy is never migrated; only fresh seeds and the
  `VOLUME_LANDMARKS` fallbacks use the new values.
- **The seed matters less than it used to** (SS1 step 3): the block-end
  recalibration now moves a landmark 2 sets instead of 1 when the evidence
  is strong (at least 6 scoring sets for the muscle that block AND a peak
  week that actually trained within 2 sets of the current ceiling -
  `Engine.landmarkStep`). Logged data dominates the prior within about two
  mesos either way.
- **Default Powerbuilding output is byte-identical.** The golden master was
  regenerated deliberately and did not move: the seed feeds the bodybuilding
  volume machinery (status bars, autoreg caps, split volume), not the
  default slot prescriptions. The full suite (490 tests) is green.

## Mechanics kept unchanged

`EXPERIENCE_FACTOR` (0.65 / 0.85 / 1.0) still scales the seed by training
age; `Engine.seedLandmarks` keeps its floors (MEV 0 preserved, MRV always
above MEV). The muscle key set is unchanged, so every consumer keys on the
same rows as before.

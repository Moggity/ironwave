# Beginner app changelog

## Package 1: scaffold
- Skeleton for the beginner app: bare `index.html`, empty `BEGINNER_CONFIG`, `BEGINNER_EXERCISES`, `Coach`, `Store`, `UI`, test harnesses, `scripts/assemble-beginner.js`, and a `beginner` CI job on Node 18 and 20.

## Package 4: coach part 1
- `Coach` silent math and Pick logic: effort mapping, next-target pre-fill (reps, raise, drop, long gap, easy-set correction, reps-only), set count, new bests, suggested six with ticks, equipment exclusion and in-place refill; all thresholds in `BEGINNER_CONFIG.coach`.

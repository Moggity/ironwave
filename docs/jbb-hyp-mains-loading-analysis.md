# jbb-hyp main-lift loading: analysis notes (decision parked)

Status: **deferred by owner decision** (2026-07-14, feedback round 6). The owner
will first test the current behavior in the app; this doc records what the code
does today, what the simulation found, and the two candidate fixes, so the
decision can be picked up later without re-deriving anything. The owner also
flagged that we may be talking about different things, so treat the numbers
below as a description of the code, to be validated against what the app
actually shows in real use.

## What the code does today

`jbb-hyp.main()` (engine.js) prices its straight work sets with the Juggernaut
wave percentages, shifted by a small weekly bump:

```
weight = WM * (WAVES[wave].acc.pct + JBB_HYP.dPct[idx])
       = WM * (0.60 + [-0.025, 0, 0.025, 0.05][week])   // 10s wave
```

with `WM ~= 0.9 * e1RM`, and displays `JBB_HYP.rpe = [7, 8, 8, 9]`, i.e. RIR
caps of 3 / 2 / 2 / 1. Set counts climb per `JBB_HYP.mainSets` (e.g. 3-4-5-4+AMRAP
in meso 1), week 4 appends an AMRAP at `real.amrap.pct`, week 5 deloads.

## What the simulation found

Method: build full programs via `makeProgram`, resolve every block/week/day/slot
through `resolveSlot` with seeded anchors, and compute each prescribed set's
implied reps-in-reserve with inverse Epley:
`impliedRIR = 30 * (e1RM / weight - 1) - reps` (the same identity `Engine.e1rm`
uses). The harness lives in `test/prescription-sanity.test.js`.

Result for jbb-hyp mains (10s and 8s waves, intermediate, calibrated):

| week | prescribed | % of e1RM | shown | implied RIR |
|---|---|---|---|---|
| 1 | 10 reps | ~50-54% | 3 RIR | ~15-20 |
| 2 | 10 reps | ~53-55% | 2 RIR | ~14-16 |
| 3 | 8-10 reps | ~57-63% | 2 RIR | ~10-12 |
| 4 | 8-10 reps | ~57-64% | 1 RIR | ~9-12 |

Per the reference book (Israetel 2020, Scientific Principles of Hypertrophy
Training): working sets count as stimulating only within ~5-0 RIR (p.55-60);
sets far above that at moderate loads are junk volume (p.108-109); a meso
should descend roughly RIR 4 -> 1 across weeks (p.92-93). By that standard the
jbb-hyp main straight sets are far outside the effective window all meso, on
every track that runs hypertrophy blocks (bodybuilding AND the default
powerbuilding).

Why it is this way: the percentages were inherited from the 2012 Juggernaut
Method wave tables, a strength methodology that deliberately runs submaximal
volume weeks and drives progression through the week-4 AMRAP plus working-max
adjustment. That logic is sound for `jm2-wave` (kept verbatim, exempted from
the sanity test as source-faithful). Borrowed into the ascending-volume
hypertrophy scheme and displayed against tight RIR caps, it under-doses the
mains while the accessories (priced via `weightFor` off the e1RM) land
correctly.

Caveat on the math: Epley is least accurate at high rep counts and the athlete
autoregulates by feel (the caps read "tope en N RIR", a ceiling not a target).
The gap is too large for either caveat to close (a 10-rep set at ~52% e1RM is
nowhere near 3 RIR for any rep-max formula), but this is exactly what the
owner's in-app testing should confirm or refute.

## The two candidate fixes

**Option A, re-anchor the weights (engine change).** Price main straight sets
the way accessories and (since 1.9.0) secondaries are priced:

```js
const wt = Engine.weightFor(wmE / 0.9, W.standard, JBB_HYP.rpe[idx], rounding);
```

- 10s wave week 1 moves from 57.5% WM to ~77.5% WM (~70% e1RM), roughly a
  +35% jump on prescribed weight. Weeks 2-4 similar magnitude.
- Keep: AMRAP at `real.amrap.pct` (the WM-progression driver), the deload, the
  calibration fallback, set counts, reps, displayed RIR.
- `JBB_HYP.dPct` becomes dead and can be removed.
- **Moves the golden master** (the default powerbuilding program contains three
  jbb-hyp blocks whose mains are snapshotted): regenerate deliberately with
  `UPDATE_GOLDEN=1 node --test test/golden-master.test.js` and review that only
  calibrated-scenario main weights on the hypertrophy blocks changed.
- Follow-on effects to communicate in the changelog: in-flight hypertrophy
  blocks see week-1/2 mains rise substantially; week-4 straight sets (~81% WM)
  become heavier than the AMRAP weight (75-80% WM), which is coherent (the
  AMRAP is a rep-max test at the book's percentage) but will look odd unless
  said out loud.

**Option B, display-only honesty (UI change).** Keep the Juggernaut-heritage
submaximal loading but stop showing tight RIR caps on jbb-hyp main straight
sets (show the percentage or nothing). No golden-master change, no loading
change; the stimulus stays sub-book but the UI stops overstating proximity.

## How to resume this

1. Owner tests in-app and decides A or B (or something else).
2. `test/prescription-sanity.test.js` already contains the assertion machinery;
   the mains are exempted by one line in `assertRirCoherence`:
   `if (rs.isMain) return; // TODO(owner): mains pending re-anchor decision`.
   For option A, delete that line and the test enforces mains forever.
3. For option A follow the golden-master regeneration flow above; for option B
   touch only the render path (`setTargetLabel` / scheme line) for jbb-hyp
   mains and leave the engine alone.

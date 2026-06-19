# Technical Design Document: Dynamic Routine Adaptation Engine

**Status:** Planning / design only. No engine code is changed by this document.
**Branch:** `Onboarding-improvements`
**Author:** drafted with Claude Code
**Reference text:** `Scientific_Principles_of_Hypertrophy_Training_2020.pdf` (Renaissance Periodization, Israetel/Hoffmann et al., 2020), cited inline as `(pNN)`.

---

## 0. Context and hard constraints

IRONWAVE today is intentionally static. `makeProgram()` always instantiates the single
`PROGRAM_TEMPLATES.powerbuilding` template; `resolveSlot()` routes every slot through the
block's declared scheme (`jm2-wave` for strength, `jbb-hyp` for hypertrophy) and nothing
else. There is no methodology choice in onboarding, no time awareness, and no per-muscle
volume control.

This design adds three capabilities without disturbing that core:

1. A **training-track** choice in onboarding (Powerlifting / Powerbuilding / Bodybuilding).
2. A **time budget** (unlimited or a per-session minute cap) with a dynamic mitigation loop.
3. A **bodybuilding muscle-specialization** system (six 0-7 sliders) that reallocates volume.

### Non-negotiable constraints carried from the brainstorm and the codebase

- **C1 Byte-identical legacy path.** A user who picks Powerbuilding + unlimited time + no
  sport must generate a routine *exactly* identical to today's. This is enforced by making
  every new transform a **no-op at its default inputs** (see §6).
- **C2 Schemes never mix.** `jm2-wave` and `jbb-hyp` stay self-contained. All new logic
  runs in the resolver layer *around* the scheme output, never inside it, exactly as the
  existing `weekMod` autoregulation already does (`applySetDelta` in `app.js`).
- **C3 Working max is never written by this system.** Volume reallocation, time mitigation,
  and pruning only add/remove/resize *sets* and *exercises*. The AMRAP/calibration paths
  that own `P().wm` are untouched.
- **C4 Vanilla JS, no build step.** There is no TypeScript compiler and no bundler. "Type
  schema" below is delivered as the real `database.json` state shape plus JSDoc typedefs,
  with TS interfaces given only as documentation (§5).
- **C5 Backward-compatible persistence.** New fields get defaults in `defaultState()` and
  are backfilled in `migrateState()`, so old `database.json` files and exported backups
  load unchanged. The state version `v` stays `1`.

---

## 1. Hypertrophy Alignment Analysis

How the proposed 0-7 slider system and paired-swap logic line up with the book, and where
they need adjusting.

### 1.1 The slider scale vs. volume landmarks

The book's entire volume model is the landmark ladder: **MV → MEV → MAV → MRV** (p61-62).
Practical takeaways for an average intermediate: productive weekly volume is roughly
**2-12 sets per muscle per session across 2-4 sessions** (p119), you **start a mesocycle near
MEV and add sets toward MRV** then deload (p62, p122), and **MV maintains muscle but does not
grow it** (p61, p277).

The slider should therefore not be an abstract "intensity knob"; it should map to a target
**weekly set count for that muscle, bounded by its landmarks**. Proposed mapping (per muscle):

| Slider | Meaning | Target weekly volume |
|---|---|---|
| 0 | De-prioritize / maintain only | **MV** (floor, ~minimum maintenance sets) |
| 1-2 | Reduced | between MV and MEV |
| **3 (default)** | **Balanced baseline** | **current program's volume (≈MEV start → MAV)** |
| 4-6 | Emphasized | scaled toward MRV |
| 7 | Specialized | **MRV** (ceiling) |

This makes slider `3` the identity point, which is exactly what C1 needs: at all-3s the
target equals what the current program already prescribes, so the transform is a no-op.

### 1.2 Conflict: "a 0 completely deletes that muscle group"

This **conflicts with the book.** RP's de-prioritization method is explicit: when you
specialize, you "train the rest of their muscles **at MV**" to free recovery capacity, which
"maintains the others" (p359). MV is a real, **non-zero** floor (figure example ~4 sets/week
for an advanced lifter, p345); the book never recommends dropping a muscle to literal zero as
a maintenance strategy. Going *below* MV causes muscle **loss** (p61).

**Recommendation:** Slider `0` should default to **MV (maintain)**, not deletion. Keep the
muscle in the routine at minimal volume (heavier, low-set work; the book prefers the
"5-10 rep range" for maintenance, p277). If the product still wants a true "remove it"
option (the summer-body user who refuses to train legs at all), make it an **explicit second
action** ("Remove entirely") with an honest warning that the muscle will *detrain and lose
size* (book-supported), rather than silently equating slider 0 with deletion.

### 1.3 Conflict / simplification: the paired-swap map

The proposed pairs are **Chest⇔Legs, Back⇔Glutes, Arms⇔Calves**. These are **not**
physiologically grounded pairs in the book. They are neither agonist/antagonist nor
synergist relationships; Chest and Legs share no recovery pathway. The book reallocates
volume against a **total recovery budget** (advanced lifters have a large MV→MEV gap, so
holding most muscles at MV frees capacity to push 1-2 muscles MEV→MRV, p345, p359). It does
**not** prescribe 1:1 structural trades.

**Recommendation:** Replace the fixed pairs with a **normalized weekly-set budget**:

1. Each muscle has landmark bounds `[MV, MRV]` and a baseline (slider 3) target.
2. Slider values become weights `w_m`. Convert to target sets by interpolating each muscle
   between its own MV and MRV by `slider/7`, then **clamp to [MV, MRV]**.
3. Optionally hold the **total weekly working sets** near the program's baseline total
   (recovery conservation): if the summed targets exceed the baseline budget, scale the
   *above-baseline* muscles down proportionally; the freed sets from de-prioritized muscles
   are what fund the emphasized ones.

This handles the "summer body" case gracefully: upper sliders to 7 push Chest/Back/Arms
toward MRV; lower sliders to 0 drop Legs/Glutes/Calves to MV; the recovery budget balances
because the de-prioritized lower body is now cheap. No arbitrary Chest-for-Legs swap is
needed, and every muscle stays inside its physiological bounds.

> If product strongly prefers the paired UX for simplicity, the pairs can be kept **purely as
> a UI affordance** (moving one slider nudges its partner) while the *math underneath* is the
> budget model above. The pairs must not be the physiological model.

### 1.4 The 0/7 safety guardrail

The brainstorm says imbalanced training "can cause injuries" and should run "1 mesocycle
(up to 2 months) max." Against the book:

- **Injury from imbalance: not directly supported.** The book attributes injury risk to
  **rapid increases in volume** ("Rapid increases in volume have been reliably demonstrated to
  cause increases in injury risk," p352) and to technique/load, not to de-emphasizing a muscle.
- **Muscle loss below MV: supported** (p61). A `0` that goes below MV will shrink the muscle.
- **Time-boxing specialization: well supported.** RP says switch priorities "every couple
  mesos" (p359) and runs specialization over a block of 1-2+ mesocycles (p282, p359), with
  accumulation phases of **4-8 weeks** (p345). The brainstorm's "1 mesocycle, up to ~2 months"
  is squarely in this range. **Keep it.**

**Recommendation — reframe the warning to what the book actually says:**

- Cranking a slider to **7** = a large, fast volume jump → "increased injury and overuse risk;
  ease into this volume." (book-supported, p352)
- Dropping a slider to **0** = below maintenance → "this muscle will lose size over time."
  (book-supported, p61)
- Keep the **"run for one mesocycle, ~2 months max, then rebalance"** time-box (p359).
- A general structural-balance/joint-stress note is fine as soft advice, but should not be
  presented as the primary, book-backed risk.

### 1.5 Net alignment verdict

| Brainstorm rule | Verdict | Action |
|---|---|---|
| Slider 0-7, default 3 = balanced | Aligned | Map to MV..MRV with 3 = current baseline |
| Slider 0 = delete muscle | **Conflict** | Default 0 → MV; deletion is an explicit, warned opt-in |
| Fixed pairs Chest⇔Legs etc. | **Not physiological** | Use recovery-budget reallocation; pairs at most a UI nicety |
| 7 overloads a muscle | Aligned | Clamp to MRV; warn about rapid-volume injury risk |
| "Imbalance causes injury" | **Partly unsupported** | Lead with rapid-volume risk + below-MV muscle loss |
| 1 meso / 2 months max | **Aligned** | Keep, matches "switch every couple mesos" (p359) |
| De-prioritized muscles fund emphasized ones | Aligned | This is exactly the MV-frees-recovery model (p345, p359) |

---

## 2. The Time-Cap Mathematical Formula

### 2.1 Variables and "eyeballed" constants

Per the brainstorm, with book cross-checks:

| Symbol | Meaning | Default | Source |
|---|---|---|---|
| `S_e(w)` | working sets for exercise `e` in week `w` | from scheme | engine (`jbb-hyp`/`jm2-wave`) |
| `R_e` | reps per set for `e` | from scheme | engine |
| `t_exec` | execution seconds **per rep** | 12 main / 6 accessory | brainstorm "1-2 min / 10 reps" = 6-12 s/rep; book "3-9 s/rep" (p65) overlaps at 6-9 |
| `rest_e` | rest seconds after each set | 120 main/secondary, 90 accessory | brainstorm 2 min main; book 30 s-4 min, longer for compounds (p69, p121) |
| `W_e` | warmup time for `e` (mains only) | sum of `Engine.warmupSets` × ~45 s | existing warmup generator |
| `O` | fixed per-session overhead (setup, transitions) | 180 s | eyeballed |

`t_exec` is intentionally per-rep so that high-rep hypertrophy sets cost more than low-rep
strength sets, matching the book's tempo guidance (3-9 s/rep controlled, p65, p120). The
brainstorm's "1-2 minutes per 10 reps" is the same thing expressed per-10-reps and gives the
6-12 s/rep envelope; compounds sit at the slow end, isolation at the fast end.

### 2.2 Per-exercise time

```
time(e, w) = S_e(w) · ( R_e · t_exec_e  +  rest_e )  +  W_e
```

- `S_e(w) · R_e · t_exec_e` = total execution time (scales with reps and the week's set count).
- `S_e(w) · rest_e` = total rest time (one rest charged per set; the final set's "rest" is the
  transition to the next exercise, which is a reasonable simplification).
- `W_e` = warmup, applied only to main/secondary barbell lifts (accessories warm up trivially).

### 2.3 Per-session time

```
T(day, w) = O  +  Σ_{e in day}  time(e, w)
```

This is the quantity to predict and compare against the cap. Note `T` is a **function of the
week index `w`**, because `S_e(w)` climbs across a hypertrophy mesocycle (`JBB_HYP.mainSets`,
`accSets`). This is the formal statement of the brainstorm's "accumulation problem": a routine
calibrated in Week 1 silently overflows by Week 3-4.

### 2.4 Worked example (the accumulation problem, numerically)

Hypertrophy 1, 10s wave, a squat day. Main reps = 10 (`W.standard`), accessory reps = 12.

**Week 1 (calibration, mains 3 sets, accessories 2 sets):**
- Squat: `3 · (10·12 + 120) + W` = `3 · 240 + ~270` = `720 + 270` = **990 s** (~16.5 min)
- Leg ext (acc): `2 · (12·6 + 90)` = `2 · 162` = **324 s** (~5.4 min)
- Ham curl (acc): `2 · 162` = **324 s**
- Abs (acc): `2 · 162` = **324 s**
- Overhead `O` = 180 s
- **T ≈ 990+324+324+324+180 = 2142 s ≈ 36 min** ✅ under a 60-min cap.

**Week 3 (build, mains 5 sets, accessories 4 sets):**
- Squat: `5 · 240 + 270` = **1470 s** (~24.5 min)
- Each accessory: `4 · 162` = **648 s** (~10.8 min) × 3 = 1944 s
- Overhead 180 s
- **T ≈ 1470+1944+180 = 3594 s ≈ 60 min** — right at the cap, accessories now dominate.

**Committed athlete, 8 main sets, 2.5-min rests, slow tempo (`t_exec`=12, `rest`=150):**
- Squat alone: `8 · (10·12 + 150) + 270` = `8 · 270 + 270` = **2430 s ≈ 40.5 min**, and with a
  longer warmup ramp and 3-min rests it climbs toward the brainstorm's ~50-min figure. The
  main lift alone can consume most of a 60-min cap.

The formula reproduces both the Week-1-looks-fine illusion and the late-meso overflow, which
is exactly what the mitigation loop (§3.3) exists to absorb.

### 2.5 Predictive use

Because `T(day, w)` is closed-form over the scheme's set tables, the app can **pre-compute the
whole block's time curve at program creation** (like `weekVolume` already does for the
timeline) and warn the athlete up front: "By Week 4 this day is projected at 72 min vs your
60-min cap; the app will compress rest and trim coherent accessories to fit." This is a
better UX than silently mutating Week 4 when they get there.

---

## 3. State Machine / Pipeline Architecture

### 3.1 Where each concern lives

```
ONBOARDING  ─────────────►  PROGRAM CREATION  ─────────────►  PER-SESSION RESOLUTION
(track, time, sliders)      (pick template, store config)     (build → reallocate → fit time → render)
```

The scheme math (`jm2-wave`/`jbb-hyp`) is **never** modified. Everything new is a post-pass in
the resolver, mirroring how `weekMod` already wraps scheme output via `applySetDelta`.

### 3.2 Resolution pipeline (the ordered stages)

For a given day and week `w`:

```
1. BASE          For each slot, call the block scheme → sets[] (unchanged engine output).
2. FOCUS         (bodybuilding track only) Apply muscle-specialization volume reallocation:
                   - resize per-muscle set counts toward each slider's MV..MRV target
                   - if a muscle is at slider 0 "remove", drop its isolation slots
                   - if a muscle is specialized (toward MRV), add/extend its slots
                 At default sliders (all 3) this stage is a no-op.
3. TIME CHECK    (custom time mode only) Compute T(day, w) via §2.
                   if T <= cap: done.
4. MITIGATE      else, in order, recomputing T after each step:
                   a. Compress rest (main 120→90 s, accessory 90→60 s).
                   b. Prune coherent accessories (see §4), lowest training-priority first,
                      never below a muscle's MV, never a main/secondary, never the last
                      direct slot of a specialized muscle.
                   c. If still over after all coherent prunes: surface a soft notice
                      ("still ~N min over; consider a longer session or splitting the day").
5. RENDER        Hand the final sets[] to the existing session/preview UI.
```

### 3.3 The pivotal ordering question (asked explicitly in the brief)

**Time is checked AFTER slider volume adjustments, never before.** Rationale:

- The sliders express the athlete's **growth intent** (what they came to train). Time is a
  **physical constraint** on realizing that intent. You decide *what* the ideal session is,
  then *fit* it to the clock. Checking time first would cap volume before knowing the
  athlete's priorities and could trim the very muscle they specialized.
- Pruning in stage 4 is **priority-aware**: it reads the slider values produced in stage 2,
  so it preferentially trims de-prioritized / coherently-redundant work and protects
  specialized muscles. That is only possible if FOCUS runs before TIME.
- This matches the book's hierarchy: volume allocation is the primary programming decision
  (Ch.2 Overload); fitting it into available time is downstream session management (Ch.3
  Fatigue Management, session ordering p160-164).

### 3.4 Determinism and idempotency

Stages 2-4 are pure functions of `(scheme output, config, week)`. They are recomputed on every
render (like `resolveSlot` today) rather than persisted into the day, so:

- editing a slider or the cap takes effect immediately and reversibly,
- nothing about the engine's working-max / AMRAP state is touched (C3),
- at default config the pipeline collapses to stage 1 + stage 5 = today's behavior (C1).

---

## 4. Coherence Mapping Schema

Goal: let the pruner know which accessories are **safe to drop** because the day's main lift
already delivers indirect volume to that muscle. Grounded in the book: compounds train
synergists, and adding isolation for an already-covered synergist is "junk volume" unless the
compound work is reduced (squats already hit glutes/adductors/erectors, p29-30; presses hit
triceps/front delts, p159-160; rows hit back/rear delts/forearms, p159 — the book notably does
*not* credit rows with biceps).

### 4.1 Data structure

A static table keyed by the main/secondary lift's movement or id, listing the movement
categories it already trains and how strongly. Lives in `data.js` next to `MOVEMENTS`.

```js
// Movement categories a compound already trains indirectly, with a coverage weight 0..1
// (1 = fully covers that muscle's stimulus for the day; 0.5 = partial, isolation still useful).
const SYNERGIST_COVERAGE = {
  'squat':    { quad: 1.0, glute: 0.7, lowback: 0.5, ham: 0.3 },
  'deadlift': { ham: 0.8, glute: 0.8, lowback: 1.0, upperback: 0.4 },
  'bench':    { chest: 1.0, tricep: 0.7, shoulder: 0.5 },   // shoulder = front delt
  'press':    { shoulder: 1.0, tricep: 0.7 },
  'hpull':    { upperback: 1.0, hpull: 1.0, shoulder: 0.3 }, // rear delt; NOT bicep (p159)
  'vpull':    { vpull: 1.0, upperback: 0.6, bicep: 0.5 },    // chin/pulldown does hit biceps
};
```

### 4.2 Prune-candidate scoring

For each accessory slot on a day, compute a **prune score**; higher = safer to remove first:

```
pruneScore(acc, day) =
    coverage(day.main, acc.movement)          // how redundant given the main (0..1)
  + (3 - slider[muscleOf(acc.movement)]) / 7   // how de-prioritized (negative if specialized)
  - protectedPenalty(acc)                       // large negative if it is a muscle's last
                                                //   direct slot, or muscle is at/under MV
```

The pruner removes the highest-scoring accessory, recomputes `T`, and repeats. Hard rules
override the score:

- **Never** prune a `main` or `secondary` slot (those carry the wave math and the WM).
- **Never** drop a muscle below its **MV** (book floor, p61/p359).
- **Never** remove the **last direct isolation** slot of a muscle whose slider ≥ 4 (specialized).
- Prefer removing an accessory whose muscle has `coverage ≥ 0.7` from the day's main (the
  book's "you already got it from squats" case, p30).

> Worked example from the brief: a Quads accessory (leg extension) following a heavy Squat
> main has `coverage('squat','quad') = 1.0` → top prune candidate, and removing it costs the
> quads little because the squat already drove them near their per-session ceiling. Exactly the
> intended behavior, and now it is book-justified rather than ad hoc.

### 4.3 Why a table and not inference

The movement taxonomy in `MOVEMENTS` is rich enough to infer some coverage, but synergist
relationships are not derivable from category labels alone (a row and a curl are both "pull"
but only one is redundant with the other). A small explicit table is auditable, matches the
book's specific claims, and is trivial to extend when new mains are added.

---

## 5. Database & Type Schema Updates

### 5.1 Reality check on "TypeScript interfaces"

IRONWAVE has **no TypeScript and no build step** (C4). The source of truth is the
`database.json` blob shaped by `defaultState()` in `app.js`. The honest deliverable is:
(a) the new state fields with defaults, (b) JSDoc typedefs that the existing vanilla JS can
use for editor hints, and (c) TS interfaces purely as documentation. All three are below.

### 5.2 New state fields (additive, version stays `v: 1`)

Added to `profile` (persists across programs) and `program` (per-cycle), so re-creating a
program keeps the athlete's preferences:

```js
// in defaultState().profile
training: {
  track: 'powerbuilding',          // 'powerlifting' | 'powerbuilding' | 'bodybuilding'
  timeMode: 'unlimited',           // 'unlimited' | 'custom'
  timeCapMin: null,                // number (minutes) when timeMode === 'custom'
  otherSports: false,              // gates out of the pure-default path when true
  muscleFocus: {                   // bodybuilding sliders, 0..7, default 3 = balanced
    arms: 3, chest: 3, back: 3, glutes: 3, legs: 3, calves: 3,
  },
},
```

`program` stores a **snapshot** of the config used to build it (so editing profile later does
not silently rewrite an in-flight cycle), plus the chosen template id:

```js
// in makeProgram() return
template: tpl.id,                  // 'powerbuilding' | 'powerlifting' | 'bodybuilding'
trainingConfig: { ...snapshot of profile.training at creation time... },
```

### 5.3 Migration (backward compatibility, C5)

`migrateState(s)` backfills, mirroring the existing defensive defaults block:

```js
// inside migrateState, additive and idempotent
const t = s.profile.training = s.profile.training || {};
t.track      = t.track      || 'powerbuilding';
t.timeMode   = t.timeMode   || 'unlimited';
if (t.timeCapMin === undefined) t.timeCapMin = null;
if (t.otherSports === undefined) t.otherSports = false;
t.muscleFocus = Object.assign({ arms:3, chest:3, back:3, glutes:3, legs:3, calves:3 },
                              t.muscleFocus || {});
if (s.program && !s.program.trainingConfig) {
  // legacy programs predate tracks: stamp them as the powerbuilding default
  s.program.trainingConfig = { track:'powerbuilding', timeMode:'unlimited',
    timeCapMin:null, otherSports:false,
    muscleFocus:{ arms:3, chest:3, back:3, glutes:3, legs:3, calves:3 } };
}
```

Any old `database.json` or exported backup loads as a Powerbuilding / unlimited / all-3s
athlete, which by C1 generates identically to today. Export/import is unaffected (version
unchanged).

### 5.4 Slider → movement-category mapping

The six product sliders aggregate the engine's finer `MOVEMENTS` categories:

```js
const SLIDER_MOVEMENTS = {
  arms:   ['bicep', 'tricep'],
  chest:  ['chest'],
  back:   ['vpull', 'hpull', 'upperback'],
  glutes: ['glute'],
  legs:   ['quad', 'ham'],
  calves: ['calf'],
};
// lowback and abs are not on a slider; they track their parent compounds / stay at baseline.
```

### 5.5 Per-muscle volume landmarks

A static table of `[MV, MEV, MRV]` weekly sets per movement category, seeded from the book's
ranges (p119, p345; tuned per category). Slider targets interpolate within these bounds (§1.1).

```js
// weekly working-set landmarks per movement category (intermediate baseline)
const VOLUME_LANDMARKS = {
  chest:  { mv: 4, mev: 8,  mrv: 22 },
  back:   { mv: 6, mev: 10, mrv: 25 },
  quad:   { mv: 6, mev: 8,  mrv: 20 },
  ham:    { mv: 3, mev: 6,  mrv: 16 },
  glute:  { mv: 0, mev: 4,  mrv: 16 },   // heavily trained by squats/deadlifts indirectly
  calf:   { mv: 6, mev: 8,  mrv: 20 },
  bicep:  { mv: 4, mev: 8,  mrv: 20 },
  tricep: { mv: 4, mev: 8,  mrv: 20 },
  shoulder:{ mv: 6, mev: 8, mrv: 22 },
  // ... abs, upperback, lowback as needed
};
```

> These numbers are a starting point consistent with the book's published ranges; they are
> data, not logic, so they can be tuned without touching the pipeline. They should be reviewed
> against the RP per-muscle tables (which live outside the read chapters) before shipping.

### 5.6 TypeScript interfaces (documentation only)

```ts
type Track = 'powerlifting' | 'powerbuilding' | 'bodybuilding';
type TimeMode = 'unlimited' | 'custom';

interface MuscleFocus {           // each 0..7, 3 = balanced default
  arms: number; chest: number; back: number;
  glutes: number; legs: number; calves: number;
}
interface TrainingConfig {
  track: Track;
  timeMode: TimeMode;
  timeCapMin: number | null;      // minutes; required iff timeMode === 'custom'
  otherSports: boolean;
  muscleFocus: MuscleFocus;
}
interface VolumeLandmark { mv: number; mev: number; mrv: number; }   // weekly sets
interface SynergistCoverage { [movement: string]: number; }          // 0..1 per covered muscle
```

---

## 6. Backward-compatibility proof (C1)

The default path must equal today's output. Each new stage is a guarded no-op at defaults:

| Stage | Default input | Behavior at default |
|---|---|---|
| Template select | `track = 'powerbuilding'`, `otherSports = false` | picks the existing `powerbuilding` template |
| FOCUS reallocation | all sliders = 3 | target = baseline for every muscle → set counts unchanged |
| TIME check | `timeMode = 'unlimited'` | stage skipped entirely → no rest compression, no pruning |
| Pipeline | above all true | collapses to `BASE → RENDER`, i.e. `resolveSlot` as written today |

A regression guard in the test harness should assert that, for `track=powerbuilding`,
`timeMode=unlimited`, all sliders 3, the resolved `sets[]` for every (block, week, day, slot)
is **deeply equal** to the current engine output. This is the contract that lets us ship the
new engine without risking existing users' programs.

---

## 7. Onboarding flow changes (summary)

The current 3-step flow (name/bodyweight → days/week → maxes) gains a **track gate** and a
**time question**, with a conditional **slider step** for bodybuilding:

```
Step 0  Name + bodyweight                                  (unchanged)
Step 1  Training days per week                             (unchanged)
Step 2  Primary goal:  Powerlifting | Powerbuilding | Bodybuilding   (NEW)
Step 3  Time per session:  As much as necessary | Enter minutes      (NEW)
Step 3b (bodybuilding only) Muscle focus: 6 sliders 0-7, default 3,   (NEW)
        with the 0/7 warning + "1 meso / ~2 months max" note (§1.4)
Step 4  Maxes (1RMs)                                       (unchanged)
```

Choosing Powerbuilding + "As much as necessary" + (no sliders shown) reproduces the exact
current onboarding result, satisfying C1 at the UX layer too.

---

## 8. Open questions for product

1. **Slider 0 semantics:** default to MV (recommended, §1.2) or allow true removal behind a
   warning? Affects whether de-prioritized muscles ever fully disappear from a day.
2. **Total-volume conservation:** should emphasizing muscles be funded *only* by de-emphasized
   ones (fixed recovery budget), or may total weekly sets rise when time allows? The book
   favors a bounded recovery budget for advanced lifters (p345).
3. **Powerlifting track scope:** is it just a different `PROGRAM_TEMPLATES` block ratio (more
   `jm2-wave`, less `jbb-hyp`), or does it need its own scheme? Recommend the former first.
4. **Time cap granularity:** one cap for all days, or per-day caps (leg day naturally longer)?
5. **`VOLUME_LANDMARKS` numbers:** confirm against the RP per-muscle tables before shipping;
   the values in §5.5 are book-consistent estimates, not transcribed from a single table.

---

## 9. Implementation sequencing (when approved)

1. State + migration (§5) behind defaults; add the regression guard (§6). No behavior change.
2. Onboarding steps (§7), writing config only. Still no engine change for default users.
3. `SLIDER_MOVEMENTS`, `VOLUME_LANDMARKS`, `SYNERGIST_COVERAGE` data tables (§4, §5).
4. FOCUS reallocation pass in the resolver (bodybuilding only), gated by slider != 3.
5. Time estimator `T(day, w)` (§2) + block-level projection in the dashboard/preview.
6. MITIGATE loop (rest compression → coherent pruning) (§3.3, §4).
7. Powerlifting template (§8.3) last.

Each step is independently shippable and a no-op for default users until the one that
introduces its UI.

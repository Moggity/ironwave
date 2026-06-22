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

How the proposed muscle-focus slider system and paired-swap logic line up with the book, and
where they need adjusting.

> **Revision 2 (confirmed with product):** the slider scale is **0-6** (default 3, the true
> center), slider **0 = full removal** of that muscle's direct work behind a warning (injury
> accommodation and personal choice are valid reasons), the **paired-swap map is dropped** in
> favor of the recovery-budget model below, and the **"other sports" feature is deferred** to
> its own branch (see §10). Per-muscle landmark numbers are now sourced (§5.5).

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
| 0 | Remove (warned) | **none** (direct work removed; see §1.2) |
| 1 | Maintain | ≈ **MV** (maintenance floor) |
| 2 | Reduced | between MV and baseline |
| **3 (default)** | **Balanced baseline** | **current program's volume (≈MEV start → MAV)** |
| 4 | Emphasized | between baseline and MRV |
| 5 | High | approaching MRV |
| 6 | Specialized | ≈ **MRV** (ceiling) |

The scale is **symmetric about 3**: three steps down (3→0) and three up (3→6), with 0 as the
explicit "remove" endpoint. Slider `3` is the **identity point**, which is exactly what C1
needs: at all-3s the target equals what the current program already prescribes, so the
transform is a no-op. Endpoints are tied to each muscle's *real* landmarks (§5.5), so "6"
literally means "train this muscle at its MRV" and "1" means "just maintain it."

### 1.2 Slider 0 = full removal, behind a warning (confirmed)

The book's own de-prioritization method is to hold a muscle at **MV** (maintenance), not zero
(p359), and going below MV causes muscle **loss** (p61). However, product has confirmed that
**slider 0 fully removes** the muscle's direct work, for two legitimate reasons the book does
not cover: (a) lifters who simply will not train a body part, and (b) **injury** that makes
the movement physically impossible. Forcing a maintenance dose on an injured user is worse
than honoring the removal.

**Design:** slider `0` removes that muscle's direct (isolation) work and shows a clear,
**non-blocking** warning before it takes effect:

> "Removing Legs means no direct leg training. Over a full block this leads to size and
> strength loss there, and large imbalances can stress your joints. If you're working around
> an injury or this is a deliberate choice, that's fine. Plan to rebalance within ~2 months."

Slider `1` is the **maintain** option (≈MV) for users who want to keep the muscle minimally.
Removal applies to direct work; a compound that also trains the removed muscle (e.g. squats
for an injured-knee user) can be swapped out or removed via the existing per-slot Swap control.
The "rebalance within ~2 months" guidance is the book's specialization time-box (p359, §1.4).

### 1.3 Conflict / simplification: the paired-swap map

The proposed pairs are **Chest⇔Legs, Back⇔Glutes, Arms⇔Calves**. These are **not**
physiologically grounded pairs in the book. They are neither agonist/antagonist nor
synergist relationships; Chest and Legs share no recovery pathway. The book reallocates
volume against a **total recovery budget** (advanced lifters have a large MV→MEV gap, so
holding most muscles at MV frees capacity to push 1-2 muscles MEV→MRV, p345, p359). It does
**not** prescribe 1:1 structural trades.

**Recommendation:** Replace the fixed pairs with a **normalized weekly-set budget**:

1. Each muscle has landmark bounds `[MV, MRV]` and a baseline (slider 3) target.
2. Slider values map to target sets piecewise on the symmetric 0-6 scale: `0` = remove,
   `1` ≈ MV, `3` = baseline, `6` ≈ MRV, linear between those anchors; then **clamp to [MV, MRV]**.
3. Optionally hold the **total weekly working sets** near the program's baseline total
   (recovery conservation): if the summed targets exceed the baseline budget, scale the
   *above-baseline* muscles down proportionally; the freed sets from de-prioritized muscles
   are what fund the emphasized ones.

This handles the "summer body" case gracefully: upper sliders to 6 push Chest/Back/Arms
toward MRV; lower sliders to 0 remove Legs/Glutes (and Calves toward 1/MV); the recovery
budget balances because the de-prioritized lower body is now cheap or gone. No arbitrary
Chest-for-Legs swap is needed, and every retained muscle stays inside its physiological bounds.

> If product strongly prefers the paired UX for simplicity, the pairs can be kept **purely as
> a UI affordance** (moving one slider nudges its partner) while the *math underneath* is the
> budget model above. The pairs must not be the physiological model.

### 1.4 The 0/6 safety guardrail

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

- Cranking a slider to **6** = a large, fast volume jump → "increased injury and overuse risk;
  ease into this volume." (book-supported, p352)
- Dropping a slider to **0** = removal → "this muscle will lose size and strength; large
  imbalances can stress joints." (muscle loss is book-supported, p61; see §1.2 warning copy)
- Keep the **"run for one mesocycle, ~2 months max, then rebalance"** time-box (p359).
- A general structural-balance/joint-stress note is fine as soft advice, but should not be
  presented as the primary, book-backed risk.

### 1.5 Net alignment verdict

| Brainstorm rule | Verdict | Action (confirmed) |
|---|---|---|
| Slider scale, default 3 = balanced | Aligned (now **0-6**) | Symmetric about 3; endpoints = MV (1) and MRV (6); 3 = current baseline |
| Slider 0 = delete muscle | **Confirmed by product** | 0 = full removal behind a warning; slider 1 = maintain (MV) for the softer option |
| Fixed pairs Chest⇔Legs etc. | **Dropped** | Recovery-budget reallocation instead; pairs not used even as UI |
| 6 overloads a muscle | Aligned | Clamp to MRV; warn about rapid-volume injury risk |
| "Imbalance causes injury" | **Partly unsupported** | Lead with rapid-volume risk + muscle loss; imbalance as soft note |
| 1 meso / 2 months max | **Aligned** | Keep, matches "switch every couple mesos" (p359) |
| De-prioritized muscles fund emphasized ones | Aligned | The MV-frees-recovery model (p345, p359) |

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
| `U_e` | per-exercise setup/transition for `e` | by equipment: bb 120 / db,kb 70 / cb 40 / mc,bd 20 / bw 10 s | eyeballed, equipment-aware |
| `O` | fixed per-session overhead (arrive, change, water) | 180 s | eyeballed |

`t_exec` is intentionally per-rep so that high-rep hypertrophy sets cost more than low-rep
strength sets, matching the book's tempo guidance (3-9 s/rep controlled, p65, p120). The
brainstorm's "1-2 minutes per 10 reps" is the same thing expressed per-10-reps and gives the
6-12 s/rep envelope; compounds sit at the slow end, isolation at the fast end.

### 2.2 Per-exercise time

```
time(e, w) = U_e  +  S_e(w) · ( R_e · t_exec_e  +  rest_e )  +  W_e
```

- `U_e` = per-exercise setup/transition: walk to the station, load/grab the implement, adjust
  the machine, take a feeler set. Keyed by `exercise.equipment` so a barbell (plate-loading +
  warmup) costs real time while a machine is a pin and a seat. This is what makes *adding* an
  exercise cost time, and what differentiates a barbell add from a machine add in the pickers.
- `S_e(w) · R_e · t_exec_e` = total execution time (scales with reps and the week's set count).
- `S_e(w) · rest_e` = total rest time (one rest charged per set; the final set's "rest" is the
  transition to the next exercise, which is a reasonable simplification).
- `W_e` = warmup, applied only to main/secondary barbell lifts (accessory warmup is folded into
  `U_e`).

### 2.3 Per-session time

```
T(day, w) = O  +  Σ_{e in day}  time(e, w)        (each time(e,w) now carries its own U_e)
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
  muscleFocus: {                   // bodybuilding sliders, 0..6, default 3 = balanced
    arms: 3, chest: 3, back: 3, shoulders: 3, glutes: 3, legs: 3, calves: 3,
  },
},
experience: 'intermediate',        // 'beginner' | 'intermediate' | 'advanced' (seeds landmarks)
trainingAge: { startedTs: null, blocksCompleted: 0 },  // grows; drives MEV drift over time
landmarks: { /* per movement category, see 5.6 - seeded from VOLUME_LANDMARKS, then evolves */ },
// NOTE: `otherSports` and weekday-scheduling are intentionally NOT here. The
// sport-aware scheduling feature is deferred to its own branch (see §10).
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
const F0 = { arms:3, chest:3, back:3, shoulders:3, glutes:3, legs:3, calves:3 };
t.muscleFocus = Object.assign({}, F0, t.muscleFocus || {});  // backfills `shoulders` on old saves
s.profile.experience = s.profile.experience || 'intermediate';
s.profile.trainingAge = s.profile.trainingAge || { startedTs: s.program?.startDate || null, blocksCompleted: 0 };
// landmarks are seeded lazily (next program creation) or here from VOLUME_LANDMARKS * factor:
if (!s.profile.landmarks) s.profile.landmarks = seedLandmarks(s.profile.experience);
if (s.program && !s.program.trainingConfig) {
  // legacy programs predate tracks: stamp them as the powerbuilding default
  s.program.trainingConfig = { track:'powerbuilding', timeMode:'unlimited',
    timeCapMin:null, muscleFocus: Object.assign({}, F0) };
}
```

Any old `database.json` or exported backup loads as a Powerbuilding / unlimited / all-3s
athlete, which by C1 generates identically to today. Export/import is unaffected (version
unchanged).

### 5.4 Slider → movement-category mapping

The six product sliders aggregate the engine's finer `MOVEMENTS` categories:

```js
const SLIDER_MOVEMENTS = {
  arms:      ['bicep', 'tricep'],
  chest:     ['chest'],
  back:      ['vpull', 'hpull', 'upperback'],
  shoulders: ['shoulder'],          // 7th slider added: side delts are a top aesthetic muscle
  glutes:    ['glute'],
  legs:      ['quad', 'ham'],
  calves:    ['calf'],
};
// lowback, abs, forearms are NOT on a slider; they stay at baseline and ride parent compounds.
```

### 5.5 Per-muscle volume landmarks (sourced)

Weekly working-set landmarks per movement category. **Source: Renaissance Periodization's
published per-muscle "Training Tips for Hypertrophy" article series (rpstrength.com, ~2017-19),
the classic landmark grid -- EXTERNAL to the attached 2020 book**, which only teaches the
method, not these constants. Values target intermediate-to-advanced lifters and are starting
points to individualize. They are *data, not logic*, so they tune without touching the
pipeline. `mev`/`mrv` drive the slider endpoints (§1.1). Mapped to IRONWAVE `MOVEMENTS`:

```js
// weekly working-set landmarks (RP classic grid)
const VOLUME_LANDMARKS = {
  chest:    { mv: 8, mev: 10, mrv: 22 },
  // RP gives one "Back" landmark; applied across vpull + hpull + upperback
  vpull:    { mv: 8, mev: 10, mrv: 25 },
  hpull:    { mv: 8, mev: 10, mrv: 25 },
  upperback:{ mv: 8, mev: 10, mrv: 25 },
  quad:     { mv: 6, mev: 8,  mrv: 20 },
  ham:      { mv: 4, mev: 6,  mrv: 20 },
  glute:    { mv: 0, mev: 0,  mrv: 16 },   // MEV 0: squats/deadlifts cover it indirectly (RP)
  bicep:    { mv: 4, mev: 8,  mrv: 26 },
  tricep:   { mv: 4, mev: 6,  mrv: 18 },
  shoulder: { mv: 6, mev: 8,  mrv: 26 },   // side delts (main aesthetic head)
  calf:     { mv: 6, mev: 8,  mrv: 20 },
  abs:      { mv: 0, mev: 0,  mrv: 25 },   // MEV 0: covered by bracing on compounds (RP)
  lowback:  { mv: 0, mev: 0,  mrv: 12 },   // covered by squats/deadlifts; rarely direct
};
```

**Confidence / caveats (read before shipping):**
- WebFetch was **blocked (403) for rpstrength.com and all non-GitHub domains** here, so numbers
  came from search-result snippets quoting RP, cross-checked against two consolidated
  reproductions. **Chest (10/22) and Back (10/25) are directly quoted, high-confidence;** the
  rest match the canonical republished grid (consistent across sources) but were not read from
  the live RP page. **Traps, Abs, Forearms are lower-confidence.**
- **A second, divergent RP dataset exists:** the current **RP Hypertrophy App / Help Center**
  uses revised, generally lower, range-based numbers (e.g. Chest ~MEV 4-6 / MRV 16-24). **Decision:
  use the classic grid above** (it is the verifiable, publicly republished dataset; the App
  numbers could not be confirmed here). See §8.2.
- RP's delt granularity is finer than `MOVEMENTS`: front/side/rear delts were collapsed into
  the single `shoulder` category (side-delt numbers used). The single RP "Back" landmark was
  applied across `vpull`/`hpull`/`upperback`. Revisit if a finer taxonomy is wanted.

> **The static grid above is only a SEED.** It is *not* what the engine reads at runtime.
> At program creation it is copied (scaled by experience) into the athlete's own
> `profile.landmarks`, and from then on the athlete's stored, evolving landmarks are used. See §5.6.

### 5.6 Per-athlete, evolving volume landmarks (the important part)

The book is explicit that volume landmarks are **individual and shift with training age**:
MEV rises as you advance, the MV→MEV gap widens for advanced lifters (p345), and your true MRV
is found **empirically** by adding sets until recovery/performance breaks down, not read from a
chart (Set Progression Algorithm p99, MEV stimulus estimator p96-97). So landmarks must be
**stored per athlete and must evolve**, not be fixed constants.

**Storage.** `profile.landmarks[movement] = { mv, mev, mrv }` (same keys as `VOLUME_LANDMARKS`),
plus `profile.experience` and `profile.trainingAge`. These persist across programs (they are a
property of the lifter, not a cycle).

**Seeding (at program creation).** Copy `VOLUME_LANDMARKS` into `profile.landmarks`, scaled by
the onboarding experience answer, because the sourced grid is an intermediate/advanced baseline:

```js
const EXPERIENCE_FACTOR = { beginner: 0.65, intermediate: 0.85, advanced: 1.0 };
// landmarks[m] = round(VOLUME_LANDMARKS[m] * factor), with mev >= mv+1 etc. enforced
```
If `profile.landmarks` already exists (returning athlete), it is kept, not reseeded.

**Evolution (the "ages up" requirement).** A `recalibrateLandmarks()` pass runs **once per
completed accumulation block** (hooked where `advanceWeek()` increments `pointer.block`), using
signals the app *already logs* — the same inputs RP's estimator uses:

| RP signal (book) | IRONWAVE source already present |
|---|---|
| Performance rising / holding | logged sets vs target + `Engine.bestE1RM` trend across the block (`S.sessions`, `S.records`) |
| Recovery / soreness | per-muscle check-in sliders (`S.checkins`) at the peak week + `S.readinessLog` trend |
| Reached MRV (can't recover) | readiness trending down + soreness high + performance falling *before* the peak week |

Per muscle trained in the block (mirrors the Set Progression Algorithm, p99):

```
tolerated well  (recovery OK AND performance not falling at peak volume)
                  -> mrv += 1 (cap), mev += 0.5 drift            // you adapted; you can do more
under-recovered (readiness down OR high soreness OR perf fell early)
                  -> mrv -= 1 (floor)                            // back off; you overreached
otherwise         -> hold
trainingAge.blocksCompleted += 1; small MEV upward drift with accumulated blocks (training age)
```

**Safety / rate-limiting.** Changes are capped at roughly **+/-1-2 sets per muscle per block**
and clamped to sane bounds, because the book warns that *rapid* volume increases drive injury
risk (p352). Landmarks drift; they do not jump. (This is the same caution behind the 0/6 slider
warning in §1.4.)

**Scope and C1 (critical).** Landmarks feed **only** the bodybuilding-track slider reallocation,
and only the *endpoints* (1 = MV, 6 = MRV) and interpolation. They do **not** change the
Powerbuilding/Powerlifting scheme output, and they do **not** move the slider-3 baseline (which
stays anchored to the scheme, §1.1). Therefore evolving landmarks **cannot** alter a default
user's routine, and cannot even alter an all-3s bodybuilding user's routine — C1 is preserved.
Evolution only changes *how much* an emphasized (4-6) or maintained (1) muscle gets, for users
who actually moved a slider.

### 5.7 TypeScript interfaces (documentation only)

```ts
type Track = 'powerlifting' | 'powerbuilding' | 'bodybuilding';
type TimeMode = 'unlimited' | 'custom';
type Experience = 'beginner' | 'intermediate' | 'advanced';

interface MuscleFocus {           // each 0..6, 3 = balanced default; 0 = remove, 6 = MRV
  arms: number; chest: number; back: number; shoulders: number;
  glutes: number; legs: number; calves: number;
}
interface TrainingConfig {
  track: Track;
  timeMode: TimeMode;
  timeCapMin: number | null;      // minutes; required iff timeMode === 'custom'
  muscleFocus: MuscleFocus;       // (no otherSports: sport scheduling deferred, §10)
}
interface VolumeLandmark { mv: number; mev: number; mrv: number; }   // weekly sets, per athlete
interface TrainingAge { startedTs: number | null; blocksCompleted: number; }
// profile.landmarks: Record<movement, VolumeLandmark>  -- seeded then evolved (§5.6)
// profile.experience: Experience                       -- seeds the landmarks
interface SynergistCoverage { [movement: string]: number; }          // 0..1 per covered muscle
```

---

## 6. Backward-compatibility proof (C1)

The default path must equal today's output. Each new stage is a guarded no-op at defaults:

| Stage | Default input | Behavior at default |
|---|---|---|
| Template select | `track = 'powerbuilding'` | picks the existing `powerbuilding` template |
| FOCUS reallocation | all sliders = 3 | target = baseline for every muscle → set counts unchanged |
| Landmark evolution | any | only feeds slider endpoints (≠3) on the bodybuilding track; never touches scheme output or the slider-3 baseline (§5.6) |
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
Step 1  Training days per week                             (unchanged this branch; see §10)
Step 2  Primary goal:  Powerlifting | Powerbuilding | Bodybuilding   (NEW)
Step 2b Experience:  Beginner | Intermediate | Advanced              (NEW; seeds landmarks, §5.6)
Step 3  Time per session:  As much as necessary | Enter minutes      (NEW)
Step 3b (bodybuilding only) Muscle focus: 7 sliders 0-6, default 3,  (NEW)
        Arms / Chest / Back / Shoulders / Glutes / Legs / Calves
        warning fires at 0 (remove) and 6 (rapid-volume/overuse) + "~2 months max" note (§1.4)
Step 4  Maxes (1RMs)                                       (unchanged)
```
(No "other sports" question this branch; sport-aware scheduling is deferred, §10.)
The experience answer only seeds the starting landmarks; from there they evolve from logged
performance and recovery (§5.6), so an honest-but-imperfect pick self-corrects within a block.

Choosing Powerbuilding + "As much as necessary" + (no sliders shown) reproduces the exact
current onboarding result, satisfying C1 at the UX layer too.

---

## 8. Open questions for product

All blocking decisions are now resolved. Remaining items are tuning, safe to adjust later.

1. ~~Slider 0 semantics~~ **RESOLVED:** 0 = full removal behind a warning; slider 1 = maintain
   (MV) for the softer option (§1.2).
2. ~~Landmark dataset~~ **RESOLVED: classic RP grid** (§5.5). Chosen for verifiability: the
   classic numbers are publicly republished and cross-checked (chest/back directly quoted);
   the RP App numbers sit behind the paid app and could not be verified here. Revisit only if
   confirmed RP App values become available.
3. ~~Total-volume conservation~~ **DECIDED: bounded recovery budget (zero-sum reallocation).**
   Emphasizing a muscle is funded by de-emphasizing others; total weekly sets stay near the
   program baseline, each muscle clamped to [MV, MRV]. This is the book's recovery logic for
   advanced lifters (p345) and the safe default. (A future "let total rise when time allows"
   mode can be added, but only when the time-cap system can absorb it.)
4. ~~Powerlifting track scope~~ **DECIDED: a different `PROGRAM_TEMPLATES` block ratio** (more
   `jm2-wave`, fewer `jbb-hyp`), no new scheme. Reuses the proven engine; lowest risk.
5. **Time cap granularity (tuning):** one cap for all days, or per-day caps (leg day naturally
   longer)? Default to one cap; per-day is a later refinement.
6. ~~7th slider for shoulders~~ **RESOLVED:** added a **Shoulders** slider (side delts, MRV ~26).
7. ~~Landmark evolution cadence~~ **RESOLVED: per accumulation block, +/-1-set MRV step**, MEV
   drifting +0.5/block with training age, all clamped and rate-limited (§5.6).
8. **Experience seeding (tuning):** `EXPERIENCE_FACTOR` 0.65 / 0.85 / 1.0. Low stakes since
   landmarks self-correct from logged data within a block; can be retuned anytime.

---

## 9. Implementation sequencing (IMPLEMENTED on branch Onboarding-improvements)

Status: all steps below are implemented, each as its own tested commit. Default
users (Powerbuilding, unlimited time, balanced sliders) remain byte-identical;
every new behavior is gated. FOCUS shipped as per-accessory landmark-bounded
scaling (mains/secondaries untouched); the full cross-muscle zero-sum budget
remains a documented refinement.


1. State + migration (§5) behind defaults, including per-athlete `landmarks`/`experience`/
   `trainingAge` seeding; add the regression guard (§6). No behavior change.
2. Onboarding steps (§7: track, experience, time, 7 sliders), writing config only. No engine
   change for default users.
3. `SLIDER_MOVEMENTS`, `VOLUME_LANDMARKS` (seed), `SYNERGIST_COVERAGE` data tables (§4, §5).
4. FOCUS reallocation pass in the resolver (bodybuilding only), gated by slider != 3, reading
   the athlete's stored landmarks.
5. `recalibrateLandmarks()` evolution pass at block boundaries (§5.6), reusing existing
   session/check-in/readiness signals.
6. Time estimator `T(day, w)` (§2) + block-level projection in the dashboard/preview.
7. MITIGATE loop (rest compression → coherent pruning) (§3.3, §4).
8. Powerlifting template (§8.4) last.

Each step is independently shippable and a no-op for default users until the one that
introduces its UI.

---

## 10. Deferred epic: sport-aware scheduling (separate branch)

Out of scope for this branch by decision. Captured here so it is not lost. This is a distinct
subsystem, not a tweak, and warrants its own design pass + branch (e.g. `feat/sport-scheduling`).

**Goal:** avoid injury from stacking training fatigue against an athlete's sport. Real example:
soccer (forward) every Friday loads the lower body hard, so the builder should keep heavy lower
-body sessions off **Thursday and Saturday** (the days flanking game day).

**What it requires (why it is its own effort):**
1. **Sport → muscle-fatigue dataset.** Identify common sports (soccer, basketball, running,
   cycling, climbing, tennis, swimming, martial arts, ...) and, per sport, which muscle groups
   they fatigue and how hard. This is research + a data table, comparable in effort to the
   volume-landmark sourcing.
2. **Calendar-aware day placement.** Replace "how many days per week" with **"pick which days
   you train"** (Mon-Sun selection), store actual weekdays, and place sessions so high lower
   -body (or sport-overlapping) fatigue does not land adjacent to game day. This is a
   constraint-placement problem, not a count.
3. **Named days.** Days are currently fixed `DAY_TEMPLATES` keyed by *count* and rendered as
   "Day 1". Sport scheduling needs **weekday-labeled days** ("Monday - Lower", etc.), a
   real change to how days are stored and shown across dashboard, workout, preview, and history.

**Interaction with this branch:** the time-cap and muscle-focus systems are independent of
scheduling and ship first; sport scheduling layers on later by constraining which day each
session lands on, without changing how a session's volume or time is computed.

---

## 11. Pending / future work (next branch)

Captured from the build and edge-case testing on `Onboarding-improvements`. None
block the current feature set; they are enhancements and polish.

### Larger items
- **Sport-aware scheduling** (the §10 epic): sport->muscle-fatigue dataset, "pick
  which weekdays" instead of a day count, calendar placement to avoid stacking
  fatigue around game day, and named/dated days instead of "Day 1".
- **Full cross-muscle zero-sum weekly budget.** FOCUS currently adds exercises up
  to each muscle's landmark budget (refill) and de-emphasizes by set count; a
  strict global conservation (total weekly sets held constant, redistributed
  proportionally) is not enforced. The per-muscle landmark clamp bounds it for now.
- **Carryover graduation.** The block-end carryover drops an optional accessory
  that is never trained; the inverse (an optional consistently completed gets
  promoted into core / its volume nudged up) is not implemented.

### Polish / smaller
- **Extra-main-dose spacing.** A muscle at 6 gets a second main exposure half a
  week out, but on a 6-day where a second exposure already exists it can land
  adjacent (days 3 and 4). Tighten the spacing search.
- **Leftover select on an emphasized muscle.** An emphasized muscle that also has
  an empty template select slot (e.g. an emphasized-legs day's "Select calf")
  shows the select prompt alongside its auto-filled work. Fill or hide it.
- **Per-day time caps** (open question 8.5): one cap for all days vs a longer cap
  for naturally-longer days (leg day).
- **Budget-aware swap/select.** The Add button shows remaining time and per-add
  cost; the per-candidate cost is not yet shown inside the swap/select list.
- **Check-in references removed muscles.** `checkinGroupsForDay` reads slots
  structurally, so a muscle set to 0 can still surface a check-in slider.
- **Onboarding asks for a deadlift 1RM on the bodybuilding track** even though the
  deadlift is dropped there; could skip it.
- **Onboarding time estimate is bodybuilding-only.** Powerbuilding/powerlifting
  athletes who set a cap get no onboarding estimate (they have no slider step);
  a per-track estimate on the time step could be added.

### Tuning (open questions, safe to revisit anytime)
- Landmark evolution step/cadence (8.7), experience seed factors (8.8), and the
  classic-vs-RP-App landmark dataset (8.2).

### Process
- Real-browser QA pass (the engine is harness-verified; UI verified via
  screenshots) and opening the PR for review.

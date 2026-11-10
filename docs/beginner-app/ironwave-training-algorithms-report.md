# Ironwave Training Algorithms Report

Nov 10, 2026 · @Martin Arocha

## Summary

Ironwave builds a fixed, periodized plan from two prescription schemes, then adjusts that plan from logged training on three timescales: every set, every week and every block.

- **Two schemes that never mix.** `jm2-wave` is Juggernaut Method 2.0 for strength blocks: volume falls and intensity rises. `jbb-hyp` is ascending-volume hypertrophy: sets climb each week from a minimum effective dose toward the most the athlete can recover from.
- **Every block is 5 weeks.** Calibration, two build weeks, a peak week that ends in an AMRAP (as many reps as possible) set, then a deload.
- **Main lifts are loaded from a working max**, set at 90% of 1RM. Reps beyond the standard on the week-4 AMRAP are what raise it.
- **Accessories are loaded from an estimated 1RM**, calculated from recent logged sets with the Epley formula plus reps in reserve.
- **The Bodybuilding track adds an adaptive layer**: a split generator driven by seven muscle-focus sliders, per-muscle volume autoregulation against volume landmarks, fatigue-sized deloads, early deloads and intensity techniques. This layer is switched off for Powerbuilding and Powerlifting.
- **The math is well tested.** The suite of 209 tests passes on the current code, including a snapshot test that locks every prescription of the default program.

&#91;embedded content: adaptation loops · 3 timescales\]

The plan on top is generated once. The three loops below change it using the signals the athlete logs. The weekly per-muscle loop and the deload sizing run on the Bodybuilding track only.

## How the app is organized

Ironwave is a self-hosted powerbuilding web app written in plain Node and vanilla JavaScript with no build step. Three scripts share one global scope, and each has a clear job.

| File | Role | What lives there |
| --- | --- | --- |
| `data.js` | Pure data, no logic | Exercise list, Juggernaut wave tables, program and day templates, hypertrophy set tables, volume landmarks, time model, split-generator tables |
| `engine.js` | Pure, stateless math | The `Engine` object: load prescription, 1RM estimates, working-max progression, readiness, autoregulation, deload sizing, intensity techniques |
| `app.js` | Everything stateful | Program creation, the bodybuilding split generator, slot resolution, weekly advance, landmark recalibration, time-cap fitting, all screens |

`server.js` only saves and loads state to `database.json`. It has no training logic.

The folder holds two copies of the app. This report covers the current one in `ironwave/app` (version 1.1.11). The `app/` folder at the top level is an older v1.0.0 snapshot with a smaller engine.

A workout is produced by walking a tree: program, then blocks, then weeks, then days, then slots. Each block is 5 weeks long. Each day holds slots of four kinds: `main` (a competition-style barbell lift), `secondary` (lighter volume work on a main lift), `acc` (an accessory with a default exercise), and `select` (an empty accessory slot the athlete fills).

## What the algorithms take as input

Everything the algorithms use comes from onboarding, the pre-session check-in, or the sets the athlete logs. Weights are in kg throughout.

| Input | Collected | What it drives |
| --- | --- | --- |
| 1RM for squat, bench, deadlift, military press (optional) | Onboarding | Working max = 90% of 1RM, rounded to 1.25 kg. Left blank, the lift starts with a calibration ramp |
| Experience: beginner, intermediate, advanced | Onboarding | Scale of the volume landmarks (0.65, 0.85, 1.0), how hard the calibration top set is, which intensity techniques are suggested |
| Track: Powerbuilding, Bodybuilding, Powerlifting | Onboarding | The block sequence, and whether the adaptive bodybuilding layer is on |
| Days per week: 3 to 6 | Onboarding | Which day template or generated split is used |
| Macrocycle length and goal archetype (optional) | Onboarding | Number of blocks, and each block's nutrition phase |
| Muscle focus sliders, 0 to 6, for 7 muscle groups | Onboarding, Bodybuilding only | Training frequency per muscle, the split, accessory set counts |
| Time cap in minutes (optional) | Onboarding | Which accessories are core and which are marked optional |
| Weight, reps, reps in reserve, optional pump rating (1 to 3) | Every logged set | Estimated 1RM, working-max changes, per-muscle performance signal |
| Sleep hours, per-muscle freshness sliders (1 to 5) | Pre-session check-in | Readiness score, per-muscle recovery signal |
| Session difficulty rating, 5 to 10 | End of session | Readiness score |
| Week feel, 1 to 5 | End of week | One-week modifier for the next week |
| Phase: lean gain, maintenance, cut, minicut | Phase screen | Whether the autoregulator may add volume |
| Load increment, bar weight, plate inventory | Profile | Rounding of every prescribed weight, plate breakdown, warmups |

Intensity is stored as RPE and shown as RIR (reps in reserve). The two are the same number flipped: RIR = 10 − RPE.

## How the plan is generated

The plan is built once at onboarding by `makeProgram` and stays fixed for the cycle, apart from the adjustments described later.

### Blocks and the macrocycle

Each track is a fixed sequence of 5-week blocks. Each block names its scheme and its wave (the rep target for the main lift).

| Track | Block sequence (wave) | Scheme mix |
| --- | --- | --- |
| Powerbuilding (default) | Hypertrophy 10s, 8s, 8s, then Strength 5s, 3s | 3 hypertrophy, 2 strength |
| Bodybuilding | Hypertrophy 10s, 8s, 8s, 10s, 8s | All hypertrophy |
| Powerlifting | Hypertrophy 8s, then Strength 5s, 5s, 3s, 3s | 1 hypertrophy, 4 strength |

- **Default length is 25 weeks** (5 blocks of 5 weeks). The test date defaults to the start date plus that length.
- **Custom length**: the block count is the chosen weeks divided by 5, rounded, and kept between 2 and 12. The track's block pattern is repeated to fill it.
- **Meso index**: each block is numbered by its position among blocks of the same scheme. Hypertrophy block 1 is meso 1, block 2 is meso 2, and so on. Later mesos start and peak at higher volume.
- **Phase per block**: hypertrophy blocks default to lean gain, strength to maintenance, and the last strength block to peak. A Bodybuilding goal archetype overrides this with its own cycle.

| Goal archetype | Length | Phase cycle, repeated across blocks |
| --- | --- | --- |
| Serious muscle macro | Track default | Lean gain, lean gain, minicut, gain, gain, cut |
| Look good (recomp) | 18 weeks | Lean gain, lean gain, cut |
| Look lean ASAP | 12 weeks | Minicut, cut, maintenance |

### The five weeks of a block

| Week | Type | Purpose |
| --- | --- | --- |
| 1 | Intro / calibration | Lighter loads, or feeler sets when no max is known |
| 2 | Accumulation | Build volume |
| 3 | Intensification | Heavier (strength) or more sets (hypertrophy) |
| 4 | Realization | Peak week, ends with the AMRAP that tests the working max |
| 5 | Deload | Light loads and reduced volume |

### Days: fixed templates

Powerbuilding and Powerlifting use hand-written day templates for 3, 4, 5 or 6 days per week. A day is typically one main lift, sometimes a secondary lift, two or three accessories with a default exercise, and one or two empty slots the athlete fills by muscle group.

### Days: the Bodybuilding split generator

On the Bodybuilding track, `generateBodybuildingDays` builds the week from the seven focus sliders (arms, chest, back, shoulders, glutes, legs, calves). If it cannot produce a full week, the app falls back to fixed bodybuilding templates.

1. **Slider to frequency.** Slider 0 removes the muscle. Sliders 1 and 2 train it once a week, 3 and 4 twice, 5 and 6 three times.
2. **Split days between upper and lower.** Upper days = total days × (sum of upper sliders ÷ sum of all sliders), rounded. A region with any trained muscle always gets at least one day.
3. **Give each day a lead muscle.** Leads rotate among muscles big enough to anchor a day (chest, back, legs, shoulders, and glutes when trained twice or more). The muscle that has led the fewest days goes next, with the higher slider winning ties.
4. **Spread the remaining frequency.** Each muscle's leftover weekly sessions are placed as accessories on the least-loaded days of its region, never twice on the same day when avoidable.
5. **Build the slots.** A chest, shoulder or leg day opens with bench, military press or squat. The first appearance is a main lift with full wave math, later appearances are secondary volume work. Back and glute days open with lat pulldown or hip thrust. Then one accessory per other muscle on that day, one extra for a lead at slider 5 or 6, padded to at least 3 slots.
6. **Pick accessories by muscle head.** Each pick prefers an unused exercise that hits a region of the muscle not yet covered that week, such as upper chest after mid chest.
7. **Order the week.** Upper and lower days are interleaved so the smaller group is spread out, then a final pass separates two days that share a lead muscle.

The deadlift is removed from Bodybuilding programs entirely, and a slider at 0 also removes that muscle's main lift.

### How focus sliders change set counts

After the scheme prescribes an accessory, the slider for its muscle rescales the working sets. This applies to accessories only. Main and secondary lifts are never scaled.

| Slider | Sets vs the scheme baseline |
| --- | --- |
| 0 | Exercise removed |
| 1 | 50% |
| 2 | 75% |
| 3 to 6 | 100% |

Emphasis (sliders 4 to 6) is delivered through extra frequency and extra exercises, not bigger set counts. The result is never below 1 set and never above a per-session cap of half the muscle's weekly MRV.

## How sets, reps and loads are prescribed

Every slot is resolved by the block's scheme. Main and secondary lifts are a percentage of working max (WM). Accessories are back-calculated from estimated 1RM. Every weight is rounded to the load increment of the equipment used.

### Starting point: working max and calibration

- **Working max** = 1RM × 0.9, rounded to the nearest 1.25 kg.
- **No max entered**: the lift gets a calibration ramp of 3 weightless feeler sets. Reps descend by 2 per set from the scheme's rep target (never below 3) at RIR 4, 3, then 2. A beginner's top set stops at RIR 3.
- **After calibration**: for a main or secondary lift, WM is set to 90% of the best estimated 1RM from the logged feeler sets. If a WM already exists it is only replaced when the new figure differs by more than 5%. An accessory simply uses its logged sets from the next session on.

### Scheme 1: Juggernaut wave (`jm2-wave`, strength blocks)

Volume falls and intensity rises across the block. Percentages are of working max.

| Wave | Week 1 intro | Week 2 accumulation | Week 3 intensification | Week 4 realization |
| --- | --- | --- | --- | --- |
| 10s | 5×10 at 57.5% | 5×10 at 60% | 3×10 at 67.5% | AMRAP at 75% |
| 8s | 5×8 at 62.5% | 5×8 at 65% | 3×8 at 72.5% | AMRAP at 80% |
| 5s | 6×5 at 67.5% | 6×5 at 70% | 4×5 at 77.5% | AMRAP at 85% |
| 3s | 7×3 at 72.5% | 7×3 at 75% | 5×3 at 82.5% | AMRAP at 90% |

- **Effort targets**: week 1 is RPE 7. Week 2 is RPE 7 with the last set at 8. Week 3 is RPE 8 with the last set at 9. The AMRAP is all-out.
- **Ramp sets**: weeks 3 and 4 open with a few low-rep build-up sets, starting at 50 to 70% and climbing toward the working weight.
- **Deload (week 5)**: 3 sets of 5 at 40%, 50% and 60%.
- **Secondary lifts**: 3×3 at 70% in strength blocks. The percentage steps by 2.5 points a week, from −2.5 in week 1 to +5 in week 4, always at RPE 7. Deload is 5 reps at 40% and at 50%.
- **Accessories**: 3×8 in strength blocks. The target RPE is 6 in week 1, 7 in week 2 and 7.5 in weeks 3 and 4. The weight is whatever the estimated 1RM says will hit those reps at that RPE. Deload is 2 sets at RPE 6.

### Scheme 2: Ascending-volume hypertrophy (`jbb-hyp`, hypertrophy blocks)

Reps stay at the wave's standard (10 for the 10s wave, 8 for the 8s). Load creeps up 2.5 points a week while set counts climb, and each later meso runs more sets than the one before.

| Work week | Main-lift load | Main RPE | Secondary load (sets of 5) | Accessory RPE (sets of 12) |
| --- | --- | --- | --- | --- |
| 1 | Base % − 2.5 | 7 | 60% | 7 |
| 2 | Base % | 8 | 62.5% | 7.5 |
| 3 | Base % + 2.5 | 8 | 65% | 8 |
| 4 | Base % + 5, then AMRAP | 9 | 67.5% | 9 |

Base % is the wave's accumulation percentage: 60% for 10s, 65% for 8s. The week-4 AMRAP uses the wave's realization percentage (75% or 80%).

Sets per exercise in weeks 1, 2, 3 and 4:

| Meso | Main lift | Secondary lift | Accessory |
| --- | --- | --- | --- |
| 1 | 3, 4, 5, 4 + AMRAP | 3, 4, 5, 5 | 2, 3, 4, 5 |
| 2 | 3, 4, 5, 5 + AMRAP | 3, 4, 5, 6 | 3, 4, 5, 6 |
| 3 and later | 4, 5, 6, 5 + AMRAP | 4, 5, 6, 6 | 3, 5, 6, 7 |

- **Deload (week 5)**: main lift 3×5 at 40%, 50%, 60%. Secondary 2×5 at 45%. Accessories 2×12 at RPE 6.
- **The table has three rows.** A fourth or fifth hypertrophy block reuses the meso 3 numbers, so volume stops climbing block over block after meso 3.

### How the working max progresses

The week-4 AMRAP is the progression test. The "standard" is the wave's rep number.

```latex
WM_{new} = WM + \min(reps - standard,\ 10) \times increment
```

- **Increment per extra rep**: 2.5 kg for squat and deadlift, 1.25 kg for bench and military press.
- **Cap**: at most 10 extra reps count, so one AMRAP adds at most 25 kg (lower body) or 12.5 kg (upper body).
- **At or below standard**: working max is held. It never goes down from an AMRAP.
- **Swapped lift**: if the athlete swapped the main lift for a variation, the AMRAP is logged but the base lift's working max does not move.

### How accessories progress

Accessories have no working max. Each session the app takes the best estimated 1RM from the last 8 logged sets of that exercise within 120 days, then solves for the weight that gives the target reps at the target RPE. Lifting more weight or more reps raises the estimate, and the next prescription follows.

### The order adjustments are applied to an accessory

On the Bodybuilding track each accessory passes through these steps in order. On other tracks only steps 1 and 3 can apply.

1. The scheme prescribes sets, reps and weight.
2. On a deload week, the fatigue-sized deload plan adds or removes a set and may lower RPE by 1.
3. The week-feel modifier adds or removes a set.
4. The focus slider rescales the set count.
5. The per-muscle autoregulation offset adds or removes up to 2 sets.
6. If that muscle is on a per-muscle deload, sets are halved and RPE drops by 1. Otherwise the opted-in intensity technique is attached to the last working set.

Set changes only ever add or remove plain working sets. AMRAP, ramp and calibration sets are never touched, and at least one working set always remains.

## How the plan adapts to fatigue and recovery

Five mechanisms adjust the plan. The readiness score and the week-feel modifier run on every track. Volume autoregulation, deload sizing and landmark evolution only change prescriptions on the Bodybuilding track.

### Readiness score (0 to 30)

Readiness is a composite shown on the dashboard and logged at each check-in, session and skip. It does not change a prescription directly. Its trend acts as a brake in the mechanisms below.

| Component | Points | How it is calculated |
| --- | --- | --- |
| Sleep | 0 to 8 | Hours (capped at 9) ÷ 9 × 8. Default 7.5 h |
| Muscle freshness | 0 to 10 | Average check-in slider (1 to 5) ÷ 5 × 10. Default 6 |
| Last session | 0 to 7 | (10 − difficulty rating) × 1.4. Default 4 |
| RPE accuracy | 0 to 3 | 3 − 2 × average gap between logged and target RPE |
| Consistency | 0 to 2.1 | 0.7 per session in the last 7 days, up to 3 sessions |
| Penalties | subtracted | Skipped workout: +2 per skip, max 6, fading 0.5 a day. Reordered exercises: +0.3, max 2, fading 0.3 a day |

**Trending down** means the last 7 days average more than 5% below the athlete's own baseline (days 8 to 28). It needs at least 10 logged scores and 3 baseline scores, so missing data never triggers it.

A separate rule covers short sleep: under 6 hours, the last set of each non-main exercise is flagged as optional for that session.

### Week-feel modifier (all tracks)

When the athlete completes a week and the next one is a work week (2, 3 or 4), a 1 to 5 slider sets a one-week modifier. It never changes the working max.

| Answer | Main and secondary load | Main-lift sets | Accessory sets |
| --- | --- | --- | --- |
| 1 Too tough | × 0.95 | 1 fewer than the lower of this week and next | 1 fewer than the lower of this week and next |
| 2 A bit much | No change | No change | 1 fewer |
| 3 As planned | No change | No change | No change |
| 4 Felt strong | No change | No change | 1 more |
| 5 Too easy | × 1.05 | No change | 1 more |

If readiness is trending down, a 4 is treated as a 3, and a 5 keeps the extra set but loses the 5% load increase. The brake only ever reduces what the athlete asked for.

### Volume landmarks

Each muscle has three weekly set landmarks: MV (maintenance volume), MEV (minimum effective volume) and MRV (maximum recoverable volume). They are seeded from the Renaissance Periodization published grid, multiplied by the experience factor.

| Muscle | MV | MEV | MRV |
| --- | --- | --- | --- |
| Chest | 8 | 10 | 22 |
| Back (vertical pull, horizontal pull, upper back, each) | 8 | 10 | 25 |
| Quads | 6 | 8 | 20 |
| Hamstrings | 4 | 6 | 20 |
| Glutes | 0 | 0 | 16 |
| Biceps | 4 | 8 | 26 |
| Triceps | 4 | 6 | 18 |
| Shoulders | 6 | 8 | 26 |
| Calves | 6 | 8 | 20 |
| Abs | 0 | 0 | 25 |
| Lower back | 0 | 0 | 12 |

These are the advanced values (factor 1.0). Intermediates start at 85% and beginners at 65%.

Weekly sets per muscle are counted from the resolved week. Direct work counts in full. Big compounds credit the muscles they train by a coverage fraction: a squat set counts 1.0 for quads, 0.7 for glutes, 0.5 for lower back and 0.3 for hamstrings. The count is then classed as below maintenance, maintenance, productive (MEV to MRV) or over MRV.

### Weekly volume autoregulation (Bodybuilding)

At each week advance, every muscle with a logged session gets an add, hold or cut decision from `Engine.autoregVolume`. The signals are recovery (the check-in slider for that muscle group, 1 to 5, default 3) and performance (average logged reps at least 1 above target is up, at least 1 below is down).

Rules are checked in this order, and the first match wins:

1. Reps are down, or recovery is 2 or lower: cut 1 set.
2. The athlete is in a cut or minicut: hold. In a deficit the cut threshold also rises to recovery 3 or lower.
3. Weekly sets are below MEV: add up to 2 sets.
4. Weekly sets are at MRV: hold.
5. Recovery is 4 or higher and reps held or rose: add 1 set.
6. Otherwise: hold.

Each decision moves that muscle's running offset by 1, and the offset is kept between −2 and +2 sets. The offset is applied to each accessory for that muscle, capped at half the weekly MRV per session, and is never added on a deload week. It resets to 0 at the end of every block so the next block ramps up again from a low base.

### Deloads (Bodybuilding sizing)

Every block ends with the scheduled week-5 deload on every track. On the Bodybuilding track the deload is also sized to fatigue, using how many muscles are "near MRV" (over it, or at 90% or more).

| Deload | Trigger | Effect on accessories and secondary lifts |
| --- | --- | --- |
| Deep | 3 or more muscles near MRV, or 2 or more with readiness trending down | 1 fewer set and RPE lowered by 1 |
| Light | Muscles trained, none near MRV, readiness not trending down | 1 more set |
| Standard | Anything else | Scheme deload unchanged |

- **Early deload**: in week 2 or 3, the same deep-deload trigger shows a "deload now" suggestion. Accepting turns the current week into the deload and ends the block when that week is completed. The remaining weeks are skipped.
- **Per-muscle deload**: the athlete can deload a single muscle from the volume screen. Its accessories run at half the sets and 1 RPE lower until the block ends, and skip their intensity technique.
- **Overreach warning**: shown when 2 or more muscles are strictly over MRV, or 1 is over while readiness is trending down.
- **Minicut nudge**: shown when 3 or more muscles are near MRV.

### What happens at the end of a block

1. **Landmarks evolve.** For each muscle with at least 3 logged working sets, the app averages logged RPE minus target RPE. At most +0.5 with stable readiness raises MRV by 1 set, up to 140% of the seed. At +1.0 or more, or with readiness trending down, MRV drops by 1 set. MEV rises by 1 when the gap between MEV and MRV exceeds 12.
2. **Skipped optional work is dropped.** An accessory flagged optional at least twice in the block and never trained is removed from the routine.
3. **Autoregulation resets.** Per-muscle offsets go to 0, and deload plans and per-muscle deloads are cleared.
4. **Accessories rotate.** Athlete swaps and added exercises are cleared. On the Bodybuilding track each default accessory rotates to the next exercise in its muscle's pool, again preferring an uncovered muscle head.

## Supporting calculations

### Estimated 1RM

The app uses the Epley formula, with reps in reserve added to the reps performed. A set logged without an RPE is treated as RPE 8.

```latex
e1RM = weight \times \left(1 + \frac{reps + RIR}{30}\right), \qquad RIR = 10 - RPE
```

The same formula run backwards gives the weight for a target, which is how accessories are loaded:

```latex
weight = \frac{e1RM}{1 + (reps + RIR) / 30}
```

### Rounding, warmups and plates

- **Rounding**: every weight is rounded to the nearest increment for that exercise's equipment (2.5 kg by default).
- **Warmups**: bar × 10, then 40% × 5, 60% × 3, 80% × 2 and 90% × 1 of the top set. Steps that duplicate the previous weight or reach the top weight are skipped.
- **Plate math**: the per-side load is filled greedily from the heaviest plate down, limited by the pairs in the athlete's inventory. The app reports the closest achievable weight.
- **Tonnage**: the sum of weight × reps over completed sets, including the mini-sets of an intensity technique.

### Session time estimate and the time cap

Session length is estimated from a simple time model.

| Element | Main lift | Secondary lift | Accessory |
| --- | --- | --- | --- |
| Seconds per rep | 12 | 10 | 6 |
| Rest after each set (s) | 210 | 180 | 120 |
| Compressed rest (s) | 150 | 135 | 90 |

- **Fixed costs**: 180 s per session, plus setup per exercise by equipment (barbell 120 s, dumbbell or kettlebell 70 s, cable 40 s, machine or band 20 s, bodyweight 10 s), plus 90 s per warmup set on a plate-loaded main lift.
- **Supersets**: members share one rest per round, so each set is charged the rest divided by the group size.

When the athlete has a time cap, each day is split into core and optional work:

1. Main and secondary lifts are always core and are never cut.
2. Accessories are ranked. Those for an emphasized muscle (slider 4 or more) are kept first. Next come the ones least covered by that day's main lifts, with de-emphasized muscles ranked later. Exercises the athlete added by hand go last.
3. Accessories are added to core in that order while the estimate stays under the cap. From the first one that does not fit, everything else is marked optional.

Optional work is still shown and can be trained. It feeds the block-end rule that drops accessories skipped all block.

### Intensity techniques (Bodybuilding, opt-in)

The athlete tags an exercise with a technique. It is attached to the last working set of that accessory and needs a real weight, so calibration sets are left alone.

| Technique | What is added after the working set | Pause between mini-sets (s) |
| --- | --- | --- |
| Drop set | 2 drops, each 20% lighter, same rep target | 15 |
| Myo-reps | 3 mini-sets of 5 reps at the same weight | 18 |
| Rest-pause | 2 bursts of 3 reps at the same weight | 20 |
| Lengthened partials | 1 burst of 6 partial reps at the same weight | 6 |

The timeline also suggests when to use a technique. This is advice only and does not change the prescription.

- **Week 4**: drop set.
- **Week 3**: myo-reps from the second meso on (from the first for advanced lifters), and not during a cut or minicut.
- **Weeks 1, 2 and 5**: none. Beginners are never given a suggestion.

### Per-head landmarks

For a muscle with several heads, such as upper and mid chest, the muscle's landmarks are split evenly across its heads. Per-head MEV is at least 2 sets and per-head MRV at least 2 above that. The exercise pickers use this to flag a region that is already at its limit for the week.

## Worked examples

These numbers were produced by running the app's own engine, with 2.5 kg rounding.

### A squat through the first hypertrophy block

The athlete enters a 140 kg squat 1RM. Working max = 140 × 0.9 = 126 kg, rounded to 126.25 kg. The first block is Hypertrophy 1 on the 10s wave, meso 1.

| Week | Prescription | Target |
| --- | --- | --- |
| 1 | 3 × 10 at 72.5 kg | RPE 7 |
| 2 | 4 × 10 at 75 kg | RPE 8 |
| 3 | 5 × 10 at 80 kg | RPE 8 |
| 4 | 4 × 10 at 82.5 kg, then AMRAP at 95 kg | RPE 9, then all-out |
| 5 | 5 reps at 50, 62.5 and 75 kg | Deload |

On the week-4 AMRAP the athlete gets 13 reps against a standard of 10. That is 3 extra reps × 2.5 kg = +7.5 kg, so the working max becomes 133.75 kg for the next block.

### Loading an accessory from a logged set

The athlete logs a lat pulldown at 100 kg × 8 with 2 reps in reserve (RPE 8).

- Estimated 1RM = 100 × (1 + (8 + 2) ÷ 30) = 133.3 kg.
- Week 1 target is 12 reps at RPE 7 (3 in reserve): 133.3 ÷ (1 + 15 ÷ 30) = 88.9 kg, prescribed as 90 kg.
- Week 4 target is 12 reps at RPE 9: 133.3 ÷ (1 + 13 ÷ 30) = 93.0 kg, prescribed as 92.5 kg.

### A week-feel answer

The athlete finishes week 2 of that block and is about to start week 3, planned as squat 5 × 10 at 80 kg and 4 sets per accessory. Week 2 had 4 squat sets and 3 accessory sets.

| Answer | Squat next week | Accessory sets next week |
| --- | --- | --- |
| 1 Too tough | 3 × 10 at 75 kg | 2 |
| 3 As planned | 5 × 10 at 80 kg | 4 |
| 5 Too easy | 5 × 10 at 82.5 kg | 5 |

### A readiness score

Sleep 7 h, average freshness slider 4, last session rated 7, logged RPE 0.5 above target, 3 sessions in the last week, no penalties.

6.2 (sleep) + 8.0 (freshness) + 4.2 (last session) + 2.0 (RPE accuracy) + 2.1 (consistency) = 22.5 out of 30.

### A volume autoregulation decision

An intermediate's chest landmarks are seeded at MV 7, MEV 9, MRV 19. This week the plan has 12 chest sets, the chest check-in slider was 4 and reps matched the targets. Rules 1 to 4 do not apply, rule 5 does: add 1 set, for 13 next week.

## Observations and possible issues

These are things I noticed while reading the code. None of them break the tests. The first two affect what an athlete is prescribed.

- **Planned phases do not reach the autoregulator.** Volume autoregulation reads the profile phase, which is set from the first block at onboarding and then only changes when the athlete edits it by hand. A goal archetype can schedule a cut or minicut block, but the app does not switch the profile phase when that block starts, so volume can keep climbing during a planned deficit.
- **Time-cap fitting uses normal rest, the timer uses compressed rest.** The core and optional split is always estimated with the full rest table. A time-capped athlete's in-session rest timer counts down the compressed table. Sessions will tend to finish under the estimate, and some accessories may be marked optional that would have fit. The code comments describe compressing rest before pruning, which the code does not do.
- **Readiness never changes a prescription by itself.** It only acts through its trend, as a brake. Injuries ticked at check-in are saved but no algorithm reads them.
- **Hypertrophy volume plateaus after meso 3.** The set table has three rows, so Bodybuilding blocks 4 and 5 repeat block 3's set counts. Any further progression there comes from the working max and the autoregulator.
- **Two stale comments in `engine.js`.** `bestE1RM` is described as using the top of the last 5 sets but uses the last 8. `autoregVolume` is described as recommend-only, but its output is applied to prescriptions through `updateAutoreg`.
- **Version numbers disagree.** `data.js` reports 1.1.11 while `package.json` says 1.0.0.
- **Recovery defaults quietly to neutral.** A muscle with no check-in slider gets recovery 3, which can never trigger an add above MEV. Athletes who skip the freshness sliders will see volume rise to MEV and then hold.

## Where each algorithm lives

All paths are inside `ironwave/app`.

| Algorithm | File | Function or table |
| --- | --- | --- |
| Program and block creation | `app.js` | `makeProgram`, `extendBlocks`, `stampMesoIdx`, `applyArchetypePhases` |
| Bodybuilding split generator | `app.js` | `generateBodybuildingDays`, `pickAccessory`, `spaceSameMuscle` |
| Slot resolution (the choke point) | `app.js` | `resolveSlot`, `applySetDelta` |
| Juggernaut wave prescription | `engine.js` | `prescribeMain`, `prescribeSecondary`, `prescribeAccessory` |
| Hypertrophy prescription | `engine.js` | `Engine.schemes['jbb-hyp']` |
| Wave and set tables | `data.js` | `WAVES`, `DELOAD_SETS`, `JBB_HYP`, `ACC_SCHEMES`, `SECONDARY_SCHEMES` |
| Calibration | `engine.js` | `calibrationRamp`, `recalibratedWM` |
| Working-max progression | `engine.js`, `app.js` | `amrapAdjust`, `defaultIncrement`, applied in `donePerf` |
| Estimated 1RM | `engine.js` | `e1rm`, `weightFor`, `bestE1RM` |
| Readiness | `engine.js`, `app.js` | `readinessScore`, `computeReadiness`, `readinessTrendingDown` |
| Week-feel modifier | `app.js` | `computeWeekMod` |
| Focus sliders | `app.js`, `data.js` | `focusForAccessory`, `bbLiftRemoval`, `FOCUS_FACTOR`, `SPLIT_FREQ` |
| Volume landmarks and status | `engine.js`, `data.js` | `seedLandmarks`, `volumeStatus`, `headLandmark`, `VOLUME_LANDMARKS` |
| Weekly volume count | `app.js` | `weeklyVolumeByMuscle`, `SYNERGIST_COVERAGE` |
| Volume autoregulation | `engine.js`, `app.js` | `autoregVolume`, `updateAutoreg`, `muscleSignal`, `autoregForAccessory` |
| Deload sizing and early deload | `engine.js`, `app.js` | `deloadDepth`, `earlyDeloadAdvised`, `overreaching`, `fatigueSaturated`, `acceptEarlyDeload` |
| Week advance and block end | `app.js` | `advanceWeek`, `endBlock`, `recalibrateLandmarks`, `carryoverOptionalDrops` |
| Session time and time cap | `app.js`, `data.js` | `estimateSessionSec`, `resolveDayEntries`, `prunePriority`, `TIME_MODEL` |
| Intensity techniques | `engine.js`, `app.js` | `buildDropSet`, `buildMyoReps`, `buildRestPause`, `buildPartials`, `scheduledTech`, `applyTechnique` |
| Warmups, plates, tonnage | `engine.js` | `warmupSets`, `plateMath`, `tonnage` |

Design background is in `ironwave/docs/dynamic-routine-engine-design.md`, and planned work is in `ironwave/docs/pending-future-work.md`. The tests are in `ironwave/app/test` and run with `npm test`.

# Pending / future work (next branches)

Current as of the end of the `Onboarding-improvements` branch. None of these
block what shipped; they are enhancements, tuning, and known rough edges. Group
them into focused branches rather than one large one (see the retrospective).

## Larger features (each its own branch)

- **Sport-aware scheduling** (the long-deferred epic): a sport -> muscle-fatigue
  dataset, "pick which weekdays you train" instead of a day count, calendar
  placement so high-fatigue sessions avoid game day, and named/dated days.
- **e1RM-driven hypertrophy anchors.** Today a bodybuilding day's working-max
  anchor stays a barbell compound (bench/squat/press) because the wave/AMRAP
  weights are percentages of that lift's max. To let a day default to a DB or
  machine compound *with correct weights*, anchors would need an e1RM-based
  prescription path instead of barbell percentages. Would make the bodybuilding
  default fully non-barbell, barbell as a swap.
- **Full cross-muscle zero-sum weekly volume budget.** The split generator now
  handles frequency, and de-emphasis scales sets, but total weekly sets are not
  strictly conserved/redistributed across muscles. Bounded today by per-muscle
  landmark clamps.
- **Carryover graduation.** The block-end carryover drops an optional accessory
  never trained; the inverse (an optional consistently completed gets promoted
  into core / nudged up) is not built.

## Split-generator tuning

- **Balanced multi-day over-allocates lower.** On a balanced 6-day the point
  ratio rounds to 3 upper / 3 lower, and since Legs is the only lower muscle that
  can anchor a day, you get 3 leg-led days. Options: weight region days by muscle
  count as well as points, or add a secondary lower anchor.
- **Lower region themes only around Legs.** Glutes and calves never lead a day
  (no compound lead). Consider a glute-led day (hip thrust) when glutes is high.
- **Same-muscle day spacing.** When a muscle leads two days, they can land close
  together; add a spacing pass so repeated focus days are separated for recovery.

## Polish / smaller

- **Per-day time caps** (one global cap vs a longer cap for a naturally longer
  day such as legs).
- **Budget-aware swap/select list:** the Add button shows remaining time and
  per-add cost; the per-candidate cost is not yet shown inside the swap list.
- **Check-in references removed muscles:** `checkinGroupsForDay` reads slots
  structurally, so a muscle set to 0 could still surface a check-in slider.
- **Onboarding still asks for a deadlift 1RM on the bodybuilding track**, even
  though the bodybuilding generator never uses the deadlift; could skip it.
- **Onboarding time estimate is bodybuilding-only** (it lives on the slider
  step); powerbuilding/powerlifting athletes with a time cap get no onboarding
  estimate. Could add one on the time step for all tracks.

## Tuning (safe to revisit anytime)

- Landmark evolution step/cadence, experience seed factors (0.65 / 0.85 / 1.0),
  and the classic-vs-RP-App landmark dataset.
- The `SPLIT_FREQ` map (3->2x, 4->2x, 5-6->3x) and `TIME_MODEL` constants.

## Process

- Real-browser QA pass (the engine is harness-verified; UI verified via
  screenshots).
- After merge, delete the branch and start the next item on its own branch.

## Resolved on this branch (no longer pending)

- Strength-philosophy leak in bodybuilding (Good-Mornings lead, deadlift day) ->
  dedicated templates + frequency generator.
- Sliders not affecting the split shape -> frequency-driven generator.
- Silent time trimming -> Core/Optional tiers.
- Empty days, select-slot leftovers, the chest/shoulder pressing-accessory bug,
  generous time estimates, and the Day-title vs theme display.

# IRONWAVE: Sports Science Audit Report

Compiled 2026-07-18. Persona: PhD exercise scientist and practicing S&C /
physique coach, evidence-based-community adjacent, auditing the training
engine for scientific defensibility before it becomes a paid product.
Consultation #7 of the launch call sheet in `docs/pending-future-work.md`.
Briefed on the legal report (Domain G health claims, landmark item 6), the
athlete simulation, the intake QA findings F1-F8, and the marketing claims.

**Premise, per the owner's directive:** the PWA is the prototype; the product
is native store apps where the PAID tier is the automated coach. T1 decision
receipts will expose the coach's reasoning verbatim, so every number and every
sentence audited here is future paid-product surface. This report audits
against that bar, not against "good enough for a hobby app."

**The one-paragraph verdict.** The engine is more defensible than most shipped
commercial coaches: a faithful implementation of a published wave method, a
hypertrophy layer built on consensus concepts (volume landmarks, RIR effort,
ascending volume, autoregulated deloads) with authored, deliberately simple
mappings, and a repeated preference for honesty over theater
(trend-vs-own-baseline readiness, "hold and recover", the calibration
explainer). A hostile evidence-based reviewer lands real hits in exactly four
places: the seeded RP landmark grid (already scheduled to move), copy that
states contested mechanisms as fact ("resensitize", the minicut framing), one
internal inconsistency in the H4 calibration path, and a landmark-evolution
rule that inflates MRV without evidence. All fixable cheaply; nothing here
requires product timidity.

---

## 1. Prescription math: what holds and what needs a hedge

### 1.1 The wave tables and AMRAP progression (jm2-wave)

`WAVES` (`data.js`): 10s at 5x10 @60% building to an AMRAP at 75%; 8s
5x8 @65% / 80%; 5s 6x5 @70% / 85%; 3s 7x3 @75% / 90%; deload 40/50/60 x5
(`DELOAD_SETS`). `Engine.amrapAdjust` raises the working max by
min(reps over standard, 10) x increment (2.5 kg lower / 1.25 kg upper,
`defaultIncrement`). This is a published, decade-tested method; percent-based
waves with an AMRAP-calibrated training max are standard practice and nobody
credible will attack the numbers. Two defensibility notes:

- **The rep-driven bump can outrun the evidence on high-rep waves.** A 100 kg
  WM athlete who hits 20 reps at 75% on the 10s wave gets +25 kg by formula,
  while the Epley read of that same set implies a WM near 112. The formula is
  the method; keep it. But the paid coach should cross-check: when the
  formula bump exceeds the e1RM-implied WM (0.9 x `e1rm` of the AMRAP set) by
  more than ~5%, offer an athlete-confirmed smaller raise, mirroring the H2
  below-standard reset (`program.belowStd`). Same judgment, both directions.
  (SS3)
- `recalibratedWM` snapping to 0.9 x e1RM on >5% deviation after calibration
  is sound and consistent with the working-max definition in `xd.wm_note`.

### 1.2 e1RM math and its validity zone

`Engine.e1rm` is Epley extended with RIR (total reps = reps + RIR). The code
comments correctly state the known limitation: the linear 1/30 slope degrades
past roughly 10 total reps, and the design already leans on that fact in two
good places: `anchorE1RM` prefers records within 4 reps of the prescription
target, and `calibrationRamp` descends reps toward a moderate top set. Two
consistency failures against the engine's own stated rationale:

1. **The H4 accessory calibration ramp calibrates at the TOP of the band.**
   `jbb-hyp.accessory` with a rep range calls
   `Engine.calibrationRamp(range[1], experience)` (`engine.js`), so an abs or
   calf band of [12, 20] calibrates on a 20/18/16-rep ramp whose top set sits
   ~18 total reps deep into Epley's worst zone, and then prescribes at
   `range[0]` = 12. That contradicts the calibration design comment verbatim
   ("a moderate top set estimates e1RM more accurately than a high-rep one").
   Calibrate at `range[0]` (or the band midpoint). Bodybuilding-only. (SS2)
2. **High-rep bands price through Epley at 15-22 total reps.** `weightFor(e1,
   20, ...)` for calves/abs is a formula extrapolation, not an estimate. The
   4-rep `anchorE1RM` window softens this only if a rep-matched record exists.
   For targets above ~12 reps, narrow the anchor window (prefer within 2
   reps) and fall back to the calibration ramp rather than a far conversion.
   Bodybuilding-only. (SS10)

Also minor: `doubleProgression` receives the equipment ROUNDING as its weight
increment (`jbb-hyp.accessory` passes `rounding` into the `inc` slot),
conflating "smallest plate step" with "sensible progression jump"; pass the
exercise's loading increment (dbIncrement / machineStep) instead. (SS11)

### 1.3 Calibration ramp, RIR display, implied effort

`calibrationRamp` (RIR 4/3/2 descending reps, beginners capped at RIR 3) is
exactly how a coach finds a training weight, and gating beginners away from
RIR 2 on a guessed load is correct and defensible. RIR-first display with RPE
stored (`rpeToRir`, H1's toggle) matches the modern literature's finding that
RIR anchors effort reports better than felt exertion for novices. `impliedRpe`
deriving displayed effort from the anchor instead of parroting the weekly ramp
is exactly the honesty a reviewer probes for (a set 3 reps from failure must
not claim 1 RIR); keep that contract wherever new prescriptions land.

### 1.4 The hypertrophy scheme (jbb-hyp)

`JBB_HYP`: sets climb across the meso (accessories 2-3-4-5 in meso 0 up to
3-5-6-7 in meso 2), effort tightens RPE 7 to 9 (RIR 3 to 1), deload halves.
Ascending volume from a MEV-ish start to an MRV-ish peak sits squarely inside
the consensus dose-response reading (growth rises with weekly hard sets with
diminishing returns; sets at 0-3 RIR are the effective ones). The specific set
counts are authored opinion, plausible, and personalized by the autoreg layer.
The week-4 AMRAP on hypertrophy mains is unusual for a physique program but
defensible as the WM calibration event, and H4's `mainE1RM` rep-PR top set
already handles the non-barbell case. Secondary work priced off e1RM to a real
RIR ramp (the `wmE / 0.9` fix) closed the old "20 RIR volume work" hole;
verified in code.

### 1.5 Meet prep: attempts and taper (H6)

`Engine.attempts` at 91/97/102% of the athlete's own e1RM matches standard
attempt-selection practice (an opener you can triple, a near-certain second, a
small PR third). The `jm2-peak` taper (week 1: 70x3 / 80x2 / 88x1 / 91x1 of
implied max; meet week: 60x3 / 70x1; accessories dropped) matches taper
consensus: cut volume roughly half or more, keep intensity, keep skill, 1-3
weeks. Two copy hedges: attempts must always read as suggestions from the
athlete's own data (the `meet.rest_hint` copy already says this), and because
e1RM from rep work overestimates true 1RM for some athletes, the meet-day
screen should keep the "adjust to the day" framing forever.

### 1.6 Warmups, rest, time model

`warmupSets` (bar x10, 40x5, 60x3, 80x2, 90x1) is a textbook ladder.
`TIME_MODEL.restSec` (210/180/120 s main/secondary/accessory; tight
150/135/90) sits inside the evidence (2+ min benefits compound work; shorter
rest is acceptable for isolation, and the "tight" table is honestly labeled a
compression, not a claim of equivalence). No findings.

### 1.7 Frequency, synergists, SFR, heads

- `SPLIT_FREQ` (slider 3 = 2x/week, 5-6 = 3x) matches the frequency
  literature's consensus: weekly volume dominates, 2x is a safe default with a
  small edge over 1x at matched volume. Defensible.
- `SYNERGIST_COVERAGE` fractional counting is a genuine strength; whether
  compounds count toward synergists is contested, and fractions are the
  defensible middle ground. One value is generous: `deadlift: { ham: 0.8 }`.
  Recent work on deadlift-trained hamstring growth suggests conventional
  pulls stimulate hamstrings modestly (RDLs are the real hip-hinge stimulus,
  and those are tagged separately in `EX_META`). Suggest 0.4-0.5. (SS9)
- The SFR 1-3 scale and head taxonomy (`EX_META`) are exactly the right
  altitude: a coarse, authored, three-level opinion is defensible where a
  1-10 precision scale would be indefensible pseudo-quantification. The
  stretch flags track the lengthened-position literature sensibly. Keep the
  scale coarse forever; resist any future "SFR 7.5" creep.
- `repRangeFor` (+2 reps for SFR-3 picks, +2 on odd mesos) is authored and
  reasonable; rep-range variation across mesos has weak direct evidence but
  costs nothing and aids adherence. Fine.

## 2. The autoregulation and fatigue model: coherent, with two leaks

The loop architecture is sound and convergent by construction: volume autoreg
owns sets (`autoregVolume` -> `volAdj`, clamped to +/-2, landmark-capped),
double progression owns reps, the deload resets `volAdj` so each meso re-ramps
from MEV. The signal taxonomy (recovery 1-5, performance -1/0/+1, pump
advisory) is deliberately simpler than any competitor's, which is both the
legal cover and scientifically honest: coarse inputs deserve coarse outputs.

- `autoregVolume` thresholds (add needs recovery >= 4 and performance >= 0;
  cut on recovery <= 2 or reps down; a deficit shifts both one notch
  conservative) are defensible coaching heuristics, and the direction-safe
  clamping with honest "clamped" reasons is exactly what receipts need.
- `readinessScore` (0-30: sleep 0-8, soreness sliders 0-10, session strain
  0-7, RPE accuracy 0-3, streak 0-2.1, minus skip penalty) is an authored
  composite, which is fine, but two components are not readiness: RPE
  accuracy is a data-quality signal and streak is adherence. Bundling them is
  survivable only because the app never surfaces the absolute number without
  context (`readinessContext` compares against the athlete's own 28-day
  baseline; `readinessTrendingDown` uses a 5% margin). Keep that discipline
  as a hard rule: the score is a trend instrument, never an absolute claim,
  and no copy may ever say the app "measures recovery" (wearable marketing
  language with real FTC history behind it).
- `fatigueSaturated` (3+ muscles at/near MRV), `overreaching` (2+ strictly
  over, or 1+ with readiness sliding), `deloadDepth` (deep = -1 set and +1
  RIR; light = +1 set), `earlyDeloadAdvised`: internally consistent, brake-
  biased (light deloads require positive evidence, missing data never
  triggers anything, `readinessTrendingDown` refuses to fire under 10 logs).
  This "never punish missing data" stance is a defensibility asset; state it
  in the methodology page (owner task). One honesty note: deload SIZING and
  TIMING by fatigue is common practice with thin direct evidence; copy should
  say "standard practice" energy, not "research shows."
- **Leak 1: `recalibrateLandmarks` inflates MRV without evidence.** At block
  end, mean (actual - target) RPE <= 0.5 raises MRV by 1 (ceiling 1.4x seed).
  But an athlete who trained NOWHERE NEAR their MRV all block (deficit hold,
  low sliders, time cap) still gets +1 MRV for on-target RPEs. Over a long
  macro the athlete's "own" landmark drifts up on autopilot, and the volume
  screen then anchors advice to a number no evidence produced. Gate the raise
  on the block's peak achieved weekly sets landing within ~2 sets of current
  MRV; the back-off branch can stay as is (asymmetric caution is fine). (SS6)
- **Leak 2: the two whole-body layers still stack.** `computeWeekMod` (the
  week-feel slider; value 5 adds a set AND +5% load) layers on top of
  per-muscle autoreg rather than being replaced by it, the known Cluster E
  open item. The governor brakes the down side; the up side lets a
  self-reported "too easy" add 5% to every main including a 3s wave. Bounded
  and athlete-initiated, so not dangerous, but E-completion should fold
  week-feel into the per-muscle signal instead of a global percent bump. No
  new note; this re-affirms the existing Cluster E "still open" scope.

## 3. Terminology and copy: the medical boundary (with legal Domain G)

Ruling principle: describe TRAINING decisions in training language, attribute
feelings to the athlete's own reports, and never name a clinical state.
Audit of `i18n/en.js` (es.js must mirror every fix):

- **Good, keep:** "Readiness" (standard S&C term, and it is presented vs own
  baseline); "Recovery feel" for the slider average (it is a feeling, said
  so); "Overreaching" (a legitimate non-clinical training term; the copy
  wisely never says "overtraining syndrome"); the deload and hold-and-recover
  copy; the below-standard AMRAP copy; `ob.focus_removed`'s honest "expect to
  lose some size and strength"; the lean-asap warning copy.
- **Fix: "rehab" is clinical vocabulary.** `ci.injury_q` asks "Are you
  currently rehabbing any injuries?" Rehabilitation is a licensed-profession
  activity; asking about rehab and then modifying loads positions the app
  inside injury management (legal R10 / Apple 1.4.1 territory). Reword to
  training language ("Any aches or pains you are training around?") and add
  one standing stop-on-pain line near the easing strip. The easing behavior
  itself (AMRAP off, -10%, +1 RIR, swap offered) is fine; describe it as
  caution, never as treatment. (SS4)
- **Fix: "resensitize" stated as fact.** `vol.minicut_body`,
  `vol.early_deload_body`, `vol.deload_deep_body` state resensitization as a
  mechanism. It is a contested hypothesis, and a hostile reviewer quotes
  exactly this. Reword to outcome language: "start the next block fresh,
  building from your minimum effective volume again." (SS5)
- **Fix: the minicut is framed as a fatigue treatment.** `vol.minicut_*` say
  fatigue is piling up therefore a deficit "would shed fatigue." Backwards
  as written: a deficit REDUCES recovery capacity (the app's own
  `autoregVolume` deficit branch says so). The defensible framing, which is
  also the actual practice: high accumulated fatigue makes the coming weeks
  low-productivity for building, so they are a cheap WINDOW for a short
  fat-loss phase timed with the deload. The deload sheds the fatigue; the
  minicut coincides. Reword; the `fatigueSaturated` trigger can stay. (SS5)
- **Phase copy** (`phase.*_desc`) is accurate and modest; "No calorie or
  macro tracking" (`phase.bw_note`) is a boundary worth keeping in copy
  forever. Sleep under 6h flagging risky sets optional is conservative load
  management, correctly worded.
- **Marketing guardrail:** the marketing analysis prices the coach in the
  "coach replacement" band. Positioning is fine; the WORDS "replaces a
  coach" must never appear in store copy, and no claim may outrun this
  report: the app prescribes and autoregulates training; it does not measure
  recovery, prevent injury, or improve health markers.

## 4. The defensibility bar for T1 decision receipts

Receipts are the paid product's voice and my audit's enforcement surface.
Every receipt must pass four rules (make them the T1 acceptance criteria):

1. **Data first:** cite the athlete's own logged fact ("AMRAP 14 vs standard
   10", "check-in recovery 2 of 5").
2. **Rule second, owned:** state the app's rule as the app's rule ("working
   max +5 kg, 1.25 per rep over"), never as "science says."
3. **Hedged mechanism or none:** "typically", "tends to"; no physiology
   lectures inside a receipt.
4. **Never diagnostic:** no receipt names a bodily state as fact. "Your
   check-ins report low recovery, holding volume" passes; "you are
   under-recovered" fails; "you are overtrained/injured" is banned outright.

The existing `reasonKey` strings (`vol.rec_*`) mostly pass already;
`vol.rec_under_recovered` ("Still under-recovered, back off") should become
report-attributed ("Your check-ins say you are still beat up, back off") when
T1 lands. (SS7)

## 5. Landmark seed migration: the derivation methodology (legal item 6)

The deliverable an engineer can implement. Goal: retire the verbatim RP grid
in `VOLUME_LANDMARKS` for values that are OURS by construction, while keeping
seeded behavior sane. Method, in order:

1. **Derive from a parametric model, not a copied table.** Landmarks become
   the OUTPUT of a small documented function of muscle traits: each muscle
   gets a size/recovery class (small isolated / large / indirectly-covered,
   the coverage already encoded in `SYNERGIST_COVERAGE`). Then: MEV in
   {0, 6, 8, 10} by class (0 only for heavily-covered muscles: glutes, abs,
   lowback, the rows the current grid zeroes for the same stated reason);
   MV = round(MEV x 0.6); MRV = MEV + span, span in {10, 12, 14} by recovery
   class. Snap to a 2-set grid. This lands every value inside the consensus
   dose-response reading (a handful of weekly sets maintains; roughly 8-12
   is a solid growth default; past ~20-25 returns diminish for most) without
   any row reproducing the RP triple.
2. **Blend, then verify divergence.** Cross-check each generated row against
   ranges published across multiple public sources (RP's public tips, Helms's
   guidance, Schoenfeld-line dose-response reviews) so no value is an
   outlier; assert in a test that no muscle's (mv, mev, mrv) triple equals
   the old seed. Keep the derivation note private (references, not
   reproductions).
3. **Make the seed matter less.** With SS6's evidence gate in place, allow
   the recalibration step +/-2 per block when the signal is strong (>= 6
   scoring sets and peak volume near the landmark) so athlete data dominates
   the prior within two mesos. The seed then only needs to be reasonable,
   which the coarse model guarantees.
4. **Mechanics:** `EXPERIENCE_FACTOR` stays (beginners genuinely grow on
   less; 0.65/0.85/1.0 is defensible authored scaling); `seedLandmarks`
   keeps its floors. Existing athletes' evolved `profile.landmarks` are NOT
   migrated; only fresh seeds and the `VOLUME_LANDMARKS` fallbacks change.
   The one audited change that deliberately moves the golden master;
   regenerate and review per protocol. (SS1)

## 6. Gaps a credible S&C coach would still flag

- **Beginners run an intermediate engine.** Experience scales landmarks,
  calibration RIR, and technique gating, but a true novice on `jm2-wave`
  progresses only via the monthly AMRAP, when novices can progress
  session-to-session. Not wrong, just slow; a future novice mode (add load
  when all sets hit at or under target effort) would serve the under-1-year
  segment better. Roadmap-level, not launch-blocking.
- **No age or sex inputs.** Fine for v1 IF stated as a design choice:
  sex-based programming differences with solid evidence are few (females
  typically tolerate slightly more volume and recover faster between sets;
  cycle-based programming has weak evidence and is correctly ABSENT), and
  masters athletes mostly need the recovery-responsive machinery the app
  already has. Feed these as briefing points to the athlete-panel personas
  (call sheet entry 8); if the panel surfaces real friction, the fix is an
  experience-style scalar, not a parallel program.
- **F6 stands as the one intake gate I would not ship without.** A beginner
  choosing lean-asap gets a banner (`goal.lean-asap_warn`) and nothing else.
  An aggressive deficit for a novice is the one intake combination with a
  plausible harm story a journalist can write. `Engine.coach` exists for
  exactly this; add a confirm-to-continue gate, not a silent block. (SS8)
- **Receipts for the injury easing.** When T1 lands, the -10%/no-AMRAP
  easing's receipt must follow section 4's rules; it is the most
  medical-adjacent decision the app makes.
- The specialization-split degeneracies (F7/F8: zero recovery days for the
  lone muscle, one exercise repeated 16 times) are real coaching failures,
  already correctly scoped in Cluster C / IQ7-IQ8; I second their priority.

## 7. Challenge ledger

1. **Minicut copy states a backwards mechanism** ("deficit sheds fatigue").
   Challenge to shipped copy; reframe per section 3. Owner decides wording.
2. **`recalibrateLandmarks` raises MRV without volume evidence.** Challenge
   to shipped behavior; gate on peak achieved sets near MRV (SS6).
3. **F6 banner-only ruling.** The intake QA re-affirmed it as a known gap; I
   escalate it to a confirm-gate via `Engine.coach` (SS8).
4. **H4 calibration at `range[1]`** contradicts the engine's own e1RM
   rationale; challenge to shipped behavior (SS2).
5. **AMRAP WM bumps unchecked by e1RM.** Book-faithful, but the paid coach
   should offer the smaller e1RM-implied raise when the formula overshoots
   (SS3). Fidelity purists may object; make it athlete-confirmed, never
   automatic.
6. **Marketing's "coach replacement" band language** must not leak into store
   copy as a claim; guardrail, not a rewrite of the pricing ruling.

## Owner tasks (non-coding)

- [SS-OT1] Approve the receipts language rules (section 4) as T1 acceptance
  criteria, and the copy reframes in SS4/SS5 (wording is an owner voice
  call).
- [SS-OT2] Decide challenge 5: advisory e1RM cross-check on WM raises
  (recommended) vs pure book formula.
- [SS-OT3] Decide challenge 3: confirm-gate for beginner + lean-asap.
- [SS-OT4] Commission a short public "how the coach decides" methodology page
  for launch (waves, landmarks, autoreg signals, what the app does NOT
  measure); it is the cheapest credibility asset with reviewers and creators,
  and this report plus the private derivation note are its source material.
- [SS-OT5] Brief the athlete-panel personas (call sheet 8) with section 6's
  female/masters questions so the panel tests the science, not just the UI.

## Engineer notes

- **SS1. Landmark derivation (rides the "Landmark seed migration" branch;
  MOVES the golden master).** Implement section 5: parametric generation of
  `VOLUME_LANDMARKS` from muscle classes, 2-set grid snapping, a test
  asserting no row equals the old seed triple, private derivation note.
  Regenerate the golden master deliberately and review the diff; update
  `seedLandmarks` tests. Keep `EXPERIENCE_FACTOR` unchanged.
- **SS2. Calibrate rep-range accessories at the band bottom (rides Cluster
  C / H4 follow-up; golden master untouched).** In `jbb-hyp.accessory`,
  change the uncalibrated branch from `calibrationRamp(range[1])` to
  `calibrationRamp(range[0])` so the calibration top set stays inside
  Epley's validity zone and matches the prescription anchor. Bodybuilding
  rep-range path only; extend `h4.test.js`.
- **SS3. e1RM cross-check on WM raises (rides T1 + the H2 `belowStd`
  pattern; golden master untouched).** After an AMRAP, compute the
  e1RM-implied WM (0.9 x `Engine.e1rm` of the logged AMRAP set); when the
  `amrapAdjust` formula raise exceeds it by >5%, offer an athlete-confirmed
  smaller raise (toast + confirm, mirroring the below-standard reset). Engine
  helper is pure and unit-tested; no change to `amrapAdjust` itself unless
  the owner rules otherwise (SS-OT2).
- **SS4. Injury copy scrub (rides the legal-scrub branch; golden master
  untouched).** Reword `ci.injury_q` away from "rehabbing" to
  training-around language; add a stop-on-pain line near the
  `session.injury_eased` strip. Both catalogs; no behavior change.
- **SS5. Deload/minicut mechanism copy (rides the legal-scrub branch; golden
  master untouched).** Replace "resensitize/resensitizes" in `vol.*` and
  `deload.*` strings with outcome language, and reframe `vol.minicut_*` as a
  fat-loss window timed with the deload (section 3). Both catalogs;
  triggers and logic unchanged.
- **SS6. Evidence-gated landmark raises (NEW small branch, or with Cluster E
  completion; golden master untouched).** In `recalibrateLandmarks`, only
  take the MRV +1 branch when the block's peak achieved weekly sets for that
  muscle (from `weeklyVolumeByMuscle`-equivalent history or `landmarkLog`
  deltas) came within 2 sets of the current MRV; back-off branch unchanged.
  Unit-test with seeded sessions at low and near-MRV volumes.
- **SS7. Receipts language contract (rides T1; golden master untouched).**
  Encode section 4's four rules in the T1 slice: a doc comment at the
  receipt-emitter, report-attributed rewording of `vol.rec_under_recovered`,
  and a lint-style test that receipt strings avoid a banned-vocabulary list
  (diagnose, treat, overtrained, injury advice verbs).
- **SS8. Beginner + aggressive-deficit gate (rides Epic I5 /
  `Engine.coach`; golden master untouched).** Add `coach.checkGoal(archetype,
  experience)` returning a confirm-level issue for beginner + lean-asap;
  onboarding shows a confirm-to-continue (not a silent block), defaulting the
  highlight to recomp. Extend `master-coach.test.js` and re-run the intake-QA
  battery per protocol.
- **SS9. Synergist tuning (rides the Tuning list; golden master untouched,
  bodybuilding volume attribution shifts).** Lower
  `SYNERGIST_COVERAGE.deadlift.ham` from 0.8 to ~0.5; review glute 0.8 at
  the same time (0.7 is defensible). Affects the volume dashboard and
  autoreg counting only; adjust cluster tests with intent.
- **SS10. Narrow high-rep anchors (rides H4 follow-up; golden master
  untouched).** For prescription targets above 12 reps, tighten
  `anchorE1RM`'s near-window from 4 to 2 reps (parameterize the window by
  target) so 15-20 rep bands never price off a low-rep record through a long
  Epley extrapolation; fall back to the calibration ramp when no near record
  exists. Bodybuilding rep-range path only.
- **SS11. Decouple double-progression increment from rounding (rides H4
  follow-up; golden master untouched).** `jbb-hyp.accessory` currently
  passes the equipment rounding as `doubleProgression`'s `inc`; pass the
  exercise's loading increment (dbIncrement / machineStep / rounding as last
  resort) so a weight jump is a progression decision, not a plate-math
  artifact.

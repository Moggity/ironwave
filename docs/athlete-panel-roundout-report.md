# Athlete panel round-out (launch consultation #8)

Date: 2026-07-18. Call sheet entry 8. This report completes the athlete
panel started in `docs/athlete-feedback-simulation.md` (athletes 1-2, the
two 20+ year veterans, 2026-07-15) with three more simulated athletes the
launch plan cannot afford to guess about: a woman entering powerlifting
(segment S3 in `docs/marketing-analysis.md`, the sport's fastest-growing
demographic), a Latin American Spanish speaker running the app entirely
against the shipped `es.js` catalog, and an accessibility-constrained
lifter (low vision + screen reader + tremor) evaluated against the actual
markup the Capacitor wrap will ship.

Method: each persona walked the app end to end in the house per-stage
praise/criticism format, grounded in code (functions, tables, i18n keys
cited; prescriptions verified by running the real engine at the persona's
numbers). Panelist 3 was briefed with the female-athlete questions the
sports-science audit (`docs/sports-science-audit-report.md`, consultation
7) wrote for this panel. Frame per the owner directive: the launched
product is native Android/iOS store apps, free logger tier (Epic L), paid
automated-coach tier; conclusions aim there.

Verdict in one line: all three would pay for the coach, and all three
found the same product law from different directions. The engine's core
is excellent and its failures live at the edges where the implicit
default athlete ends: absolute-scale defaults assume a 100 kg man's
loads, label paths assume English, and feedback channels assume a
sighted, steady-handed user. The coach tier's credibility fails at the
margins first, and the margins are exactly where growth lives.

### Athlete 3: "R", 31, 63 kg, entering powerlifting (segment S3)

I am 31, about 63 kg, two years of general gym training, now serious about
powerlifting. Squat 85, bench 45, deadlift 110, press 30. I train at a
commercial gym with one rack row of 20 kg bars, a couple of 15 kg bars, and
plates down to 1.25 kg. I have used Strong (fine logger, zero coaching) and
Boostcamp (programs, no brain). I would pay coach money, the same bands the
marketing doc prices, for software that programs my numbers as competently as
it clearly programs a 120 kg man's. I do not want a women's mode. I want the
defaults to stop assuming I am not here.

#### Onboarding (powerlifting track)

**Praise.**

- The powerlifting flow (`TRACK_SPEC.powerlifting.obSteps`) is short and
  serious: goal, days, meet date, experience, time, maxes. The meet step
  planning backward from my date (`Engine.coach.meetBlockPlan`) is exactly
  what I switched away from Strong to get.
- Nothing about the flow condescends. No pink accents, no "girl gains"
  copy, no softened language. `i18n/en.js` reads the same to me as to
  anyone, and after years of bro-coded apps that neutrality is a feature.
- "Leave blank to calibrate in week 1" (`ob.maxes_sub`) is honest, and the
  calibration explainer (`calib.info_*`) is the best plain-language
  description of a training max I have seen in an app.
- The bodyweight bounds (`coach.bounds.bodyweightKg` 25..300) never brush
  me, and the outlier guard compares against MY history, not a table of
  male standards. The whole engine is self-referential; that is the right
  architecture for an app with no sex input.

**Criticism.**

- **The 1RM floor is the empty men's bar.** `coach.bounds.oneRmKg` is
  [20, 500]. My press is 30 so I pass, but I verified the edge: a friend
  with a genuine 17.5 kg press gets `val.max_range`, "that 1RM does not
  look right." It looks fine; she exists. Sub-20 kg press and bench 1RMs
  are common among smaller novice women. The floor is a typo detector that
  classifies real athletes as typos, and the blank-and-calibrate fallback
  is a workaround, not an answer.
- Bodyweight is required (`val.bw_required`) with no stated reason. I do
  not mind, weight classes matter to me, but tell me why you are asking.
- The experience step asks how long I have "trained seriously." Two years
  of general gym is not two years under the barbell lifts; I picked
  intermediate and got RIR 2 calibration top sets on lifts I am still
  learning. One clarifying line would route people like me correctly.

#### Equipment and the small-load problem (the core of my review)

I ran my actual maxes through `prescribeMain` (read-only, against
`app/engine.js`). This is where the app stops being built for me.

**Praise.**

- Plate math with pair counting, per-lift loading profiles, the lb/kg skin,
  the "closest loadable" honesty: the gym-floor layer is genuinely superior
  to everything I have used.
- A per-lift AMRAP increment already exists (`xd.inc_label`, "halve it if
  progress stalls"), so the machinery for small-load tuning is half built.

**Criticism.**

- **My press wave is physically impossible, and the app never says so.**
  Press WM 27 kg on the 4-day split (press is a full main, Day 3 of
  `DAY_TEMPLATES[4]`): the 10s wave prescribes 15 kg x10 x5, the deload
  prescribes 10 / 12.5 / 15 kg. Every one of those is below the default
  20 kg bar (`UNIT_EQUIP_DEFAULTS.kg.barWeight`). `plateMath` silently
  "achieves" 20 kg for all of them. So my prescribed 60% easy week is
  actually 74% of my working max, ten-rep sets at my ceiling, and my
  deload does not exist. The realization ramp collapses too: 12.5x5,
  15x3, 20x1, then the AMRAP at 20. Four different prescriptions, one
  weight. For a light lifter the plate floor silently converts easy weeks
  into max-effort weeks, and no surface flags it.
- **A 15 kg bar is not a first-class choice.** Bar weight is one global
  free-number input in Settings (`S.profile.barWeight`); onboarding never
  asks. The per-exercise "light bar" mode defaults to 10 kg. With a 15 kg
  bar plus 1.25 rounding my press wave becomes loadable and the weeks
  differentiate again. The fix is one question at onboarding, not a
  feature.
- **Default rounding erases my progression.** At 2.5 kg rounding my bench
  3s intro and accumulation weeks are identical (30 kg both), 5s likewise
  (27.5 both), and a +1.25 kg WM bump often rounds to the same bar load.
  2.5 kg on a 30 kg press is an 8% jump. The 1.25 preset exists
  (`UNIT_PRESETS`) but nothing ever suggests it, and there is no 0.5 kg
  microplate preset even though `PLATE_COLORS` already knows 0.5s.
- Warmups vanish at my numbers: `warmupSets(20, 20, 2.5)` returns [] for
  my heaviest press day (top set equals the bar), and my bench ladder
  collapses to bar x10, 25x2, 30x1, losing the mid-rep steps.
- The AMRAP increments are absolute (1.25 kg/rep upper), so a 12-rep bench
  AMRAP hands me +8.75 kg on a 40.5 WM, a 21% jump. The sports-science
  SS3 e1RM cross-check protects light lifters disproportionately; I
  co-sign it as an S3 priority, not just a fidelity nicety.

#### Training weeks: calibration, AMRAPs, check-ins

**Praise.**

- RIR-first display with plain descriptions, the mid-session
  re-prescription, the below-standard reset offer after two missed AMRAPs
  (`perf.wm_reset_msg`), and the injury easing strip (AMRAP off, -10%,
  +1 RIR) all read like coaching, not logging.
- Check-in sliders keyed to lift patterns fit the powerlifting track fine.

**Criticism.**

- **AMRAP safety copy assumes you have done this before.** `note.amrap`
  says only "every rep over moves your working max up." I had never taken
  a barbell set to true failure before this app asked me to. Nothing says
  stop when form breaks, nothing about benching AMRAPs without a spotter.
  Proposed copy, first AMRAP only: "As many quality reps as you have.
  Stop when your form breaks or the bar slows to a grind, not at failure.
  No spotter on bench? Stop one clean rep short."
- "Are you currently rehabbing any injuries?" (`ci.injury_q`): SS4 already
  covers the wording; I just confirm it reads clinical to a newcomer too.

#### Meet prep (H6)

**Praise.** Attempts from my own e1RM, a real two-week taper, warmups to
the opener. This is the paid-tier feature that would keep me subscribed
through a water cut.

**Criticism.**

- **My third attempt is not a PR.** `Engine.attempts(45)` at 2.5 rounding
  returns 40 / 42.5 / 45 for bench: the "reach" third equals the 1RM I
  typed in. 1.02 x 45 rounds down onto my own max. At small absolute
  loads the 91/97/102 spread collapses into the rounding grid, and the
  attempts round on my GYM equipment setting (`L.totalInc`), not the
  2.5 kg competition grid.
- The taper is degenerate at my bench: `jm2-peak` week 1 emits 40x1, 40x1,
  the 88% single and the opener single identical after rounding.
- No weight class anywhere. I am 63.0 kg sitting on an IPF class boundary;
  the app asks my bodyweight at onboarding and then never connects it to
  the one context where it decides my competitive result.

#### The female-athlete briefing (sports-science audit, section 6)

Asked directly: is "no sex input" defensible as framed? **Yes, and do not
add one.** The engine anchors everything to my own data: my e1RM, my AMRAP
reps, my landmarks, my readiness baseline. A sex toggle would buy little
(the audit is right that well-evidenced programming differences are few)
and would cost the neutrality I praised. But the audit's framing needs one
sharpening: the engine is sex-blind, the DEFAULTS are not. The 20 kg bar,
the 20 kg 1RM floor, 2.5 kg rounding, absolute per-rep increments: every
place an absolute number was chosen, it was chosen at male scale, and that
is where "unisex" quietly stops being true. Fix the absolute-scale layer
and the no-sex-input design is fully defensible; say so on the SS-OT4
methodology page. Landmark and rest-period sex differences: leave to the
autoreg loop and per-athlete evolution, which is already the mechanism.

#### Subscribe or churn

I would subscribe for: meet planning plus taper, receipts (T1) explaining
WM moves in my own numbers, and prescriptions that respect a 45 kg bench.
I would churn, inside the 14-day trial, the first time the paid coach
prescribes 15 kg on a bar it knows weighs 20, or hands me a third attempt
I have already lifted. And note for T1: receipts amplify engine output. A
receipt proudly explaining "+8.75 kg working max" on a 40 kg bench reads
absurd; small-load correctness is a prerequisite for receipt credibility,
not a polish item. The free logger (Epic L) is table stakes against
Strong; the small-load layer is what makes the PAID tier defensible to
the fastest-growing demographic in the sport.

#### What must change, ranked

1. Below-bar prescription guard: never silently load the empty bar over a
   lighter prescription; warn and offer a lighter bar or lift swap.
2. Bar weight and smallest-plate question at onboarding; 15 kg bar as a
   preset choice, 0.5 kg microplates in the presets.
3. Coach rule: low entered maxes suggest 1.25 kg rounding and flag the
   press/bench collapse before week 1, not after I quit.
4. Attempts on the 2.5 kg comp grid, third attempt never at or below the
   current max; dedupe the taper ladder; add an optional weight class
   field to the meet step.
5. Lower the 1RM floor (about 10 kg) with a soft confirm below 20.
6. First-AMRAP safety copy (form breakdown, spotter line).
7. Co-sign SS3 (e1RM cross-check on WM raises) as an S3 protection.

### Athlete 4: "R", 27, Mexico City, bodybuilding track, runs the app in Spanish

Soy R. Entreno 5 días en un Smart Fit de la CDMX, intermedio, celular en
es-MX. Vengo de Hevy (en español, decente) y de RP Hypertrophy (inglés,
caro y me daba flojera leerlo). Corrí IRONWAVE completo en español contra
el catálogo real de `app/i18n/es.js`: onboarding, sliders, una semana de
sesiones, volumen semanal, finishers, biblioteca, ajustes. Mi vara: si
leo una pantalla y suena a coach, la recomiendo en el grupo de WhatsApp
del gym; si suena a Google Translate, no.

#### Onboarding (zero to program)

**Praise.** The flow reads like a person, not a translation.
`ob.days_pick` "Elige un ritmo que puedas mantener semana tras semana"
(pick a pace you can keep) is how a coach talks. `session.calibration_hint`
"calcula el peso a ojo y ve subiendo" (eyeball the weight and work up):
"a ojo" is real gym-floor Spanish, nobody translates like that by
accident. The lean-asap warning (`goal.lean-asap_warn`) is honest and in
tuteo throughout; not one usted, not one vosotros in 1,900 lines. RP
never bothered with Spanish; Hevy's is flatter than this.

**Criticism.**
- `ob.welcome` "Bienvenido a" is masculine. Half my gym is women. Propose
  "Te damos la bienvenida a" (standard neutral fix). Same for
  `goal.recomp` "Verse bien, estar sano": propose "Verse bien, con salud".
- `track.bodybuilding` "Musculación". Nobody in Mexico says musculación;
  that is a Spain gym-sign word ("sala de musculación"). Here you "haces
  pesas" or "eres fisicoculturista". The serious goal already says
  "Fisicoculturismo" (`goal.serious-macro`), so the track card reads like
  a different country wrote it. Owner call per the README, so I flag it
  as a challenge, not a bug.

#### Dashboard, timeline, weekly volume

**Praise.** The volume screen is the best Spanish coaching copy I have
seen in an app. `vol.rec_below_mev` "Bajo el MEV, ve metiendo volumen"
(below MEV, start feeding volume in), `vol.rec_perf_down` "Las reps van
cayendo, afloja" (reps are dropping, ease off): "afloja" and "ve
metiendo" are native, imperative, short. `vol.footer_landmarks` explains
MEV/MRV better in Spanish than RP does in English. `deload.advise_body`
"Adelanta la descarga y empieza el próximo bloque fresco" sells the
early deload the way my coach would.

**Criticism.**
- Landmark terminology drifts: `vol.intro` says "umbrales de volumen",
  `vol.rec_no_landmark` "Aún sin umbral", but `fe.next_block` says "Tus
  máximos y referencias se conservan" and `set.dev_tier_note` says
  "gráficos de referencia". Pick one word (I vote "umbrales") or the
  athlete thinks they are two features.
- `phase.peak_desc` "hacia una competición" while every meet string says
  "competencia" (`ob.meet_title` "Fecha de competencia", `meet.title`
  "Día de competencia"). "Competición" is the Spain word. Propose "hacia
  una competencia o una fecha de fotos".
- `day.pump` is "Bombeo". The README's own rule says pump stays pump
  ("pump (not bombeo)"), and `ob.days_5` plus `perf.pump` already say
  "pump". A generated pump day titled "Bombeo" made me laugh out loud,
  and not in the good way. Propose 'day.pump': 'Pump'.

#### The session (logging, finishers, timer)

**Praise.** `pump.3` "Brutal" is the correct translation of "Skin
splitting"; a literal one would have been ridiculous. `rpe.10` "No podía
hacer ni una rep más" and the whole RIR ladder read native. The finisher
explainers (`tech.info_drop`, `tech.info_myo`) keep drop set / myo-reps
in English exactly like we say them, and "pausa-descanso" for rest-pause
is the right false-friend dodge. `sr.10` "La sesión más dura de tu vida"
lands. Superset UX is the best I have used, in any language.

**Criticism.**
- The one place the superset UX breaks character: linking two exercises
  toasts raw English, "Linked into a superset" / "Superset link removed"
  (`app.js` `toggleSuperset`, line 1466, literal strings not routed
  through `t()`). Propose keys `workout.ss_linked` "Superserie armada" /
  `workout.ss_unlinked` "Superserie deshecha".
- `cue.larsen-press_0` "Empuja con las piernas estiradas y los pies
  planos, sin usar las piernas" contradicts itself (push with your legs,
  without using your legs). The English source means press while keeping
  the legs straight. Propose "Haz el press con las piernas estiradas y
  los pies apoyados, sin empujar con ellas."
- `cue.kroc-row_0` "Usa remo con mancuerna pesada a reps altas" is
  clunky. Propose "Rema pesado con mancuerna, a reps altas."
- "Canillas" (shins) in the squat and deadlift cues is southern-cone; in
  Mexico we say "espinillas". Understood, but it pings as not-from-here.
  Fine for a pan-LatAm catalog; noted for the register verdict.

#### Exercise library and search

**Praise.** 148+ names translated with real judgment: `exn.skullcrusher`
"Press francés", `exn.chinup` "Dominadas supinas", `exn.good-mornings`
"Buenos días" (yes, that is its name), `exn.lat-pulldown` "Polea al
pecho", loanwords kept where we keep them (face pull, hip thrust, curl,
pec deck, muscle-up). Search matching both languages means "sentadilla"
and "squat" both work. Better coverage than Hevy's Spanish library.

**Criticism.**
- Search is accent-sensitive: typing "extension" (as everyone types on a
  phone) does not find "Extensión de piernas"; `exMatches` (`app.js:264`)
  does a plain `includes`. Needs diacritic folding.
- No synonym aliases: I typed "jalón" (what 100% of CDMX calls the lat
  pulldown) and got nothing; "lagartijas" (pushups in MX) also nothing,
  "desplante" (lunge in MX) nothing. The README chose "polea al pecho"
  over "jalón"; fine as the display name, but search must accept the
  street name or the display-name debate is academic.
- `exn.donkey-calf-raise` "Elevación de pantorrillas tipo burro" got a
  giggle. Propose "Elevación de pantorrillas donkey".

#### Settings, tiers, and the paywall-adjacent copy

**Praise.** `set.units_hint`, the iOS storage warning (`set.data_note`),
and `tier.locked_note` "Esto es parte del plan Coach" are clear and not
condescending. The error screen (`err.body`) telling me my data is safe,
in Spanish, builds exactly the trust a paid coach app needs.

**Criticism.** History rows and one debug corner still leak (inventory
below). And T1 will add the largest wave of athlete-facing strings yet
(decision receipts); if those arrive as afterthought translations, the
paid tier's flagship feature will be the worst-written screen in the
Spanish app. Receipts must be authored in es.js at the same time as
en.js, in this catalog's register, with SS7's language contract applied
to the Spanish too (own-data first, hedged mechanisms, no diagnosis).

#### English-leak inventory (a Spanish run hits these)

1. History view: every row shows the raw stored block label
   ("Hypertrophy 2 · S6 D3"): `vHistory`, `app.js:5147`, uses
   `blockOf(s.b)?.label` instead of `blockDisplayLabel(...)`. One-line
   fix, highest-visibility leak in the app.
2. Superset link/unlink toasts: literal English, `app.js:1466`.
3. "Meet taper" block label: `makeProgram` stores it verbatim
   (`app.js:528`) and `blockDisplayLabel` only translates
   Hypertrophy/Strength N, so meet-plan users see English on the
   timeline, toasts, and check-in header. Needs a labelKey or a regex
   branch. (Powerlifting path; I did not hit it, V's successors will.)
4. `index.html:2` hardcodes `<html lang="en">` and nothing updates
   `document.documentElement.lang` on language resolve: screen readers
   and iOS text services treat the Spanish UI as English. `index.html:16`
   tab title is English too (also contains an em dash).
5. Settings > Debug chime buttons and descriptions: `CHIME_CONFIGS`
   labels/descs render untranslated (`app.js:6190`). Debug-adjacent but
   athlete-tappable; low priority, decide deliberately.
6. `manifest.json` description is English (PWA install sheet).
7. Allowed by convention but worth knowing: the render catch-all at
   `app.js:1715` and console output stay English.

Not leaks: dates and tonnage go through `I18N.dateLocale()` correctly;
`fmtDate` gave me "vie, 18 jul" as it should.

#### Register verdict

This is genuinely Latin American Spanish, not Spain Spanish wearing a
sombrero. Piso not suelo, agregar not añadir (one slip: `se.add_day`
"Añadir día" violates the catalog's own rule; propose "Agregar día"),
pantorrillas, femorales, "al 100", tuteo everywhere, and the loanword
policy (pump, drop set, AMRAP, RIR) matches how we actually talk. The
720 cues are the strongest part: consistent verbs (aprieta, empuja el
piso, baja con control), correct anatomy, and gems like "atornilla los
pies al piso". It is pan-LatAm neutral rather than deep es-MX (canillas,
zancada, flexiones instead of espinillas, desplante, lagartijas), which
is the right commercial call for one catalog; fix findability with
search aliases, not renames. Two Spain-isms escaped ("Añadir",
"competición"), one owner call I dispute ("Musculación"). Grade: the
best Spanish training app I have used; two notches above Hevy, and RP
does not even compete. I would show it off at the gym today.

#### What must change before charging LatAm users money (ranked)

1. Fix the history block-label leak (`app.js:5147`); it is on screen
   every single day of a paid subscription.
2. T1 receipts authored natively in Spanish, same PR as English, with
   the SS7 language contract enforced on both catalogs. The paid tier
   lives or dies on this copy.
3. Accent-insensitive search plus an alias list (jalón, lagartijas,
   desplante, dominadas supinas); free-tier loggers hit search first
   (Epic L1/L2 reuse these pickers).
4. Superset toasts and "Meet taper" through `t()`; set
   `document.documentElement.lang`.
5. The five copy fixes: "Agregar día", "competencia", 'day.pump' =
   'Pump', "Te damos la bienvenida a", landmark word unified.
6. Owner decision on "Musculación" before the ES store listing locks
   its keyword set; the listing and the app must use the same word.

### Athlete 5: "R", 45, low vision + essential tremor, bodybuilding track

I am 45, twenty-plus years under a bar. I read my phone at 200% system font
scale when my eyes cooperate and run VoiceOver when they do not. My right
hand has an essential tremor: small targets, swipes, and drags fail me one
attempt in three, worse chalked and at heart rate 150 between squat sets. I
self-host IRONWAVE today and would pay for the coach tier; I am also the
user Apple's reviewers imagine when they test a paid app with VoiceOver on.
The store product is this same web UI in a Capacitor WebView (release
engineering R4), so what I hit below IS the shipped app's accessibility.
And every lifter is me sometimes: sweaty hands, phone flat on a bench, eyes
on the bar. Fixing my problems fixes mid-set logging for everyone.

#### The end-to-end attempt

**Onboarding.** Real credit first: this app uses actual elements. I counted:
157 `onclick` handlers sit on real `<button>`s against two divs and one `<i>`
(node scan of app.js). Units, language, and experience are `<select>`s and
buttons. The weekday rows even carry `role="checkbox" aria-checked`
(vOnboarding, app.js:1938), which tells me someone thought about me once.
But the role sits on a div with no `tabindex` (keyboard and switch users
cannot reach it), every `<label>` in the flow (`ob-name`, `ob-bw`,
app.js:1920-1923, and the whole Settings sheet) is a bare sibling with no
`for=` (VoiceOver reads my bodyweight field as a nameless "text field"),
and the segmented unit buttons mark selection by class `on` only, no
`aria-pressed`. Annoying, not blocking: the flow is linear, Continue is a
big honest button, and nothing pre-selects, which protects a tremor hand
from fat-fingering past a decision. That last one is real assistive design.

**Text scaling: the first wall.** `index.html:10` ships
`user-scalable=no` and `styles.css:32` pins `html { font-size: 16px }`.
Every size in the sheet is rem, which would be perfect, except rem
resolves against that hard-coded root: my 200% OS font scale does nothing,
pinch zoom is disabled, and iOS WKWebView ignores Dynamic Type for web
content unless the app opts in. The UI/UX report flagged this (3.9, 4.10)
and deferred the decision to Capacitor time. I am telling you the
decision: a paid coach app I cannot enlarge is a refund. The rem plumbing
means the fix is one root variable away.

**Dashboard and timeline.** The readiness hero at 4.6rem and the big day
numerals are exactly right for low vision; numbers-as-content is my
favorite thing about this app. The macro timeline is the opposite: every
week is an `<i>` with an `onclick` (timelineHTML bar(), app.js:2460-2462),
`min-width: 3px` (styles.css:139), no role, no name, no keyboard path.
Twenty-five weeks means twenty-five sliver targets my tremor cannot hit
and my screen reader cannot see; the week preview behind them is closed to
me. The deload hatch and outlined current week are good color-independent
signals (keep them), and the plan editor is the counterexample: real
↑/↓/✕ buttons with aria-labels (app.js:2590-2592). The same hands built
both surfaces; hold the timeline to the plan editor's standard.

**Workout overview.** Swap and info are labeled icon buttons
(app.js:3387-3389). Remove, though, is swipe-left only (exSwipeDown,
app.js:3495-3531): the `ex-remove` button does carry
`aria-label="Remove <name>"` (app.js:3394) so VoiceOver can find it, but a
tremor hand cannot make a clean 46px horizontal drag; my wobble reads as
vertical and the gesture cancels (app.js:3514). Reorder is worse: the ⠿
grip is a bare `<span>` with `onpointerdown` (app.js:3352, 3441), pointer
drag only, no role, no keyboard or SR path. Superset members got ▲/▼
buttons (app.js:3379); solo exercises got nothing.

**Check-in.** Real `<input type="range">` sliders: correct choice, and the
value words (GREAT/SORE) are text not color. But `cd_slider` calls full
`render()` on every input (app.js:3686), so one arrow-key press rebuilds
the DOM and destroys the focused slider; a keyboard or SR user can adjust
each slider exactly once. The sleep slider does it right with a targeted
`textContent` update (cd_sleep, app.js:3683-3685); copy that pattern. No
range carries an accessible name; the question lives in a sibling `.q` div.

**The session: where I would live, and where it breaks.** Praise first,
because the bones are excellent: set rows are real buttons whose label IS
the state ("Performance" vs "100 kg x 8 · 2 RIR", setRowHTML app.js:4032),
the perf modal steppers are 64x64px (`.pm`, styles.css:367), set-number
circles 44px, `touch-action: manipulation` everywhere (styles.css:30), the
reserved two-line `.rpe-desc` keeps DONE from shifting under my thumb, the
weight field is a real `type="number"` input I can type into instead of
stepping, and the ghost-tap guard (app.js:4801) is honest-to-god tremor
protection someone built without calling it accessibility. This is the best
motor surface in the app.

Then the two structural failures land. First: the stepper buttons are bare
− and ＋ glyphs with no aria-label and no tie to their `.lbl` div
(renderPerfModal, app.js:4491-4515), so VoiceOver announces three
identical "minus, button / plus, button" pairs for weight, reps, and RIR,
and the targeted `textContent` updates (pmR, pmEffort) are silent. I
cannot log a set by ear. Second: `donePerf()` ends in `closePerf();
render()` (app.js:4768), and `render()` is `$app.innerHTML = ...`
(app.js:1710). Focus, and my screen reader's reading position, is thrown
to the top of the document after EVERY logged set; a 20-set session means
20 full re-crawls of the page. This one behavior is what makes the app
unusable eyes-free.

**Feedback channels: the paid tier is silent.** Every consequence the
coach tier sells arrives as a toast: working max up (app.js:4723), below
standard, calibration applied. `toast()` appends a plain div with no
`role="status"` or `aria-live` (app.js:373-397); the node scan found zero
aria-live regions in the entire app. A blind subscriber never hears the
"+7.5 kg working max" moment the other athletes praised. The rest timer is
multi-channel done right for everyone else (chime + vibration + system
notification, app.js:4323-4332), but its countdown and done state are
`textContent` swaps on a non-live div (restTick), and its -15s/+30s
buttons are ~30px tall (styles.css:286) against the 44px standard used
everywhere else.

**Modals.** `modalShell` (app.js:4806-4814) has no `role="dialog"` or
`aria-modal`, no focus move-in or return, no Escape handling (no keydown
listener exists in app.js), and a bare ✕ close button; VoiceOver wanders
the covered page freely. The MSTACK design is actually perfect for fixing
this once, centrally, and R4 already routes Android back through it.

**Visual details.** `--text-faint` (#5d6680 on #060a17, styles.css:13) is
about 3.4:1 and used at 0.68-0.8rem for exactly what I squint at under gym
lights: removal reasons, drop-set detail, RIR hints. The UI/UX report
already ordered the fix (its item 7); I am seconding it as a low-vision
user, not a WCAG box. `:focus-visible` styles are absent (the sheet's only
focus style is the stepper input, styles.css:476). Emoji icons mostly ride
next to text labels (tab bar, pump buttons), which saves them for SR, but
naked ones remain: the ⓘ on liftCardHTML (app.js:4056) is unlabeled while
its calibration twin (app.js:2519) is labeled, and 🩹 reads as "adhesive
bandage" mid-sentence. `prefers-reduced-motion` is globally honored
(styles.css:593); keep that gate through the identity motion system.

#### Severity: blocking vs annoying

Blocking (I cannot operate the app, or the paid tier is materially
degraded): full-render focus loss after every logged set; zero live
regions, so all coach feedback is inaudible; no text scaling path at 200%;
modals without dialog semantics or focus management; check-in sliders
destroyed per keystroke; unlabeled perf-modal steppers. Annoying (I work
around it, resentfully): swipe-only remove and drag-only reorder (SR path
exists for remove; motor path does not); timeline week previews
unreachable; sub-AA faint text; ~30px rest-timer and icon buttons;
unlabeled ⓘ/✕; missing `for=` on labels; no `aria-pressed` on segments;
no `:focus-visible`.

#### Born accessible: doctrine for Epic L, T1, and R4

Retrofitting semantics costs 10x building with them. These surfaces are not
written yet, so write the rule into their acceptance criteria now:

- **One announcer, one focus contract, built before L3.** Ship a single
  `announce(msg, assertive)` helper backed by a persistent `aria-live`
  region in index.html, and route `toast()`/`toastAction()` through it.
  Give `showModal`/`closeModal` dialog semantics, focus-in, focus-return,
  and Escape in `modalShell` once; every present and future modal inherits
  it. Epic L's logger home, routine CRUD, and detachment card then get
  accessibility by construction, and render-smoke can assert it.
- **T1 receipts must be announceable and persistent, not toasts.** The
  receipts contract says no silent decisions on the coach tier; a
  visual-only toast IS a silent decision for a blind subscriber, and AN3
  counts receipt exposure, so an unperceived receipt corrupts the metric.
  Receipts render into a real card surface plus the announcer; add
  "announceable" to the T1 acceptance list alongside SS7's language rules.
- **R4 owns the WebView a11y bridge as a named deliverable:** resolve
  `user-scalable` as "zoom returns OR an in-app text-size setting ships in
  the same build" (a store gate, not a preference); map iOS Dynamic Type
  and Android fontScale onto the rem root; verify Android WebView textZoom
  does not double-scale; keep reduced-motion; treat the identity report's
  haptics (4.8) as an a11y channel, not garnish. And pull the VoiceOver
  logging-loop pass (UI report item 22) from P2 to the L3 boundary;
  testing the loop after the shell ships is testing the retrofit.

#### Ranked must-fix list for the store build

1. Targeted-update or focus-restoring render for the session view: logging
   a set must not move focus (start: donePerf updates the one set row).
2. The announcer + live-region layer; toasts and rest-timer done state
   route through it (blocks T1; do first).
3. Dialog semantics + focus trap/return + Escape in modalShell/MSTACK
   (pairs with R4's Android back-button work).
4. Text-size path: drop `user-scalable=no` on web now; R4 decides the
   native bridge per the doctrine above.
5. Label pass on the logging loop: aria-labels on pm steppers, `for=` on
   field labels, names on check-in ranges, `aria-pressed` on segments, the
   unlabeled ⓘ/✕ emoji buttons.
6. Non-gesture equivalents: a Remove affordance without swiping (overflow
   or edit mode) and ↑/↓ reorder on all ex-cards (pattern exists twice).
7. Fix cd_slider to targeted updates like cd_sleep.
8. Timeline bars become buttons with week labels, or a labeled week list
   fallback; contrast/floor pass rides UI report item 7; `:focus-visible`
   styles ride the same CSS pass.

Do this and I buy the subscription on day one, and I will tell the
r/weightroom thread that the coach app works with VoiceOver, which no
incumbent can claim. Skip it and this is a very good spreadsheet I used to
be able to read.

## Cross-panel synthesis

Three independent walks converged on four findings, which is what makes
them load-bearing rather than taste:

1. **T1 decision receipts are named by all three as the paid tier's
   hinge, each adding a precondition.** Panelist 3: receipts amplify
   engine output, so small-load correctness gates receipt credibility (a
   receipt celebrating "+8.75 kg working max" on a 40 kg bench reads
   absurd). Panelist 4: receipts are the largest athlete-facing string
   wave since onboarding and must be authored natively in `es.js` in the
   same PR as `en.js`, with the SS7 language lint running on both
   catalogs. Panelist 5: a visual-only toast IS a silent decision for a
   blind subscriber and corrupts AN3's receipt-exposure metric; receipts
   must persist on a card surface and route through an announcer. T1's
   acceptance criteria grow by all three.
2. **Epic L inherits panel requirements at birth.** The free logger's
   pickers and search are the same code the es-MX persona found
   accent-sensitive and alias-blind (`exMatches`); the logger home,
   routine CRUD, and detachment card are unbuilt surfaces that must be
   born accessible (announcer + modal contract as L3 prerequisites)
   rather than retrofitted.
3. **The neutrality the app already has is a moat; the defaults betray
   it.** Panelist 3 endorses the engine's no-sex-input, self-referential
   design and opposes a sex toggle, but every absolute constant (20 kg
   bar, 20 kg 1RM floor, 2.5 kg rounding, absolute AMRAP increments) was
   chosen at male scale. Fix the absolute-scale layer and state the
   rationale on the public methodology page, and "unisex by
   architecture" becomes a defensible, marketable claim.
4. **Two claims no incumbent can make are within reach:** "the best
   Spanish training app" (panelist 4 says the register is already two
   notches above Hevy; the leak sweep is small) and "the coach app that
   works with VoiceOver" (panelist 5: the bones are unusually good; the
   blockers are one render pattern, one live region, one modal shell,
   and one viewport line). Both are cheap relative to their store-listing
   value, and both compound the privacy-forward positioning ASO already
   holds.

## Challenge ledger (owner decisions)

1. **1RM floor** (FPL4): lowering the 20 kg floor to ~10 kg with a
   soft confirm loosens an intake-QA F3 ruling. Panel says the current
   floor misclassifies real small athletes as typos.
2. **No-sex-input framing**: panel endorses keeping the engine
   sex-blind; the methodology page (SS owner task 4) must state the
   self-referential rationale AND commit to fixing the male-scale
   absolute defaults. Approve that framing.
3. **Meet weight class**: input-only display on the meet step vs
   class-aware coaching (bodyweight-trend-to-class advice). Ambition
   call.
4. **"Musculación"** (`track.bodybuilding`): reads Spain-Spanish to a
   Mexican ear; the serious-goal card already says "Fisicoculturismo".
   Keep, rename, or use the loanword "Bodybuilding". Must be ruled
   before the ES store listing locks its keyword set; app and listing
   must match.
5. **Pan-LatAm vocabulary policy**: ratify aliases-not-renames (display
   names stay pan-LatAm neutral; search accepts jalón, lagartijas,
   desplante) so future translators have a standing rule.
6. **ES listing honesty**: the "fully in Spanish" store claim gates on
   the leak-sweep PR (ESM1-ESM4) landing first.
7. **Text scaling as a store gate**: "OS text scaling works OR an
   in-app text-size setting ships in the same store build" becomes a
   hard submission gate, not a deferred preference (sharpens the UI/UX
   report's open decision and lands in R4's scope).
8. **T1 receipts channel**: persistent card + announcer, not toasts
   (amends T1's acceptance criteria before the beta gate; also protects
   AN3's exposure metric).
9. **VoiceOver logging-loop pass timing**: pull from the UI report's P2
   (item 22) to the Epic L3 boundary so the new shell is tested as
   built, not retrofitted.
10. **SS3 escalation**: the advisory e1RM cross-check on WM raises is
    co-signed by panelist 3 as an S3-segment protection, adding weight
    to the pending "yes".

## Owner tasks

- [ ] Rule on the challenge ledger above; items 4, 6, and 7 block store
      listing and submission work, item 8 blocks the T1 beta gate.
- [ ] Approve the first-AMRAP safety copy (FPL8) and the Spanish copy
      fixes (ESM5-ESM6) at the next copy review.
- [ ] Extend the planned public methodology page with the "engine is
      sex-blind, defaults were not, and here is what we fixed" section
      (pairs with sports-science owner task 4).
- [ ] When the ES store listing is drafted, source its vocabulary from
      the ruled catalog (item 4) and its claims from the shipped leak
      sweep (item 6).

## Engineer notes

Panelist 3 (small-load correctness, FPL series):

- **FPL1 - below-bar guard.** When a prescribed barbell load rounds
  below the configured bar weight, never silently load the empty bar:
  an `Engine.coach` rule flags the collapse and the session/plate view
  warns, offering the lighter-bar setting or a lift swap. Rides Epic I5
  (master coach). Golden master untouched (display-side annotation).
- **FPL2 - equipment micro-step at onboarding.** Ask bar weight and
  smallest plate; 15 kg bar as a preset choice; a 0.5 kg microplate row
  in the plate presets and 0.5 in `UNIT_PRESETS` rounding. NEW small
  branch. Golden master untouched.
- **FPL3 - low-max coach rule.** Any main 1RM under ~50 kg suggests
  1.25 kg rounding at program creation and surfaces the wave-collapse
  warning before week 1. Rides Epic I5. Golden master untouched.
- **FPL4 - 1RM floor.** Lower `coach.bounds.oneRmKg` floor to ~10 kg
  with a confirm-level issue (not an error) for 10-20 kg; reword
  `val.max_range`. Rides Epic I5; owner decision 1. Golden master
  untouched.
- **FPL5 - competition-grid attempts.** `Engine.attempts` rounds on the
  2.5 kg competition grid regardless of gym rounding; the third attempt
  is never at or below the entered/current max; optional weight-class
  field on the meet step. Rides H6 follow-up. Golden master untouched.
- **FPL6 - taper ladder dedupe.** Merge `jm2-peak` week-1 singles that
  rounding collapses into identical loads. Rides H6 follow-up. Golden
  master untouched.
- **FPL7 - warmup floor.** `warmupSets` emits at least a bar ramp when
  the top set sits at or within one step of the bar, instead of
  returning nothing. NEW small. Golden master untouched (warmups are
  not in the resolveSlot snapshot).
- **FPL8 - first-AMRAP safety copy.** One-time explainer before the
  athlete's first AMRAP: stop on form breakdown or a grinding bar; no
  spotter on bench means stop one clean rep short. Both catalogs. Rides
  the legal-scrub copy branch with SS4/SS5. Golden master untouched.
- **FPL9 - intake copy clarifiers.** A one-line "why we ask" under the
  onboarding bodyweight field; experience-step wording clarified toward
  barbell training age. Both catalogs. NEW tiny. Golden master
  untouched.

Panelist 4 (Spanish product, ESM series):

- **ESM1 - history block-label leak.** `vHistory` renders the raw
  stored block label; route it through `blockDisplayLabel()`
  (app.js:5147). Highest-visibility leak in the app. Rides the i18n
  leak sweep (new i18n queue item 6). Golden master untouched.
- **ESM2 - superset toasts.** Replace the literal English link/unlink
  toasts (app.js:1466) with `t()` keys `workout.ss_linked` /
  `workout.ss_unlinked` ("Superserie armada" / "Superserie deshecha").
  Rides the leak sweep. Golden master untouched.
- **ESM3 - meet-taper label.** The stored "Meet taper" block label
  never translates (app.js:528 + `blockDisplayLabel`); add a labelKey
  or regex branch. Rides the leak sweep. Golden master untouched.
- **ESM4 - document language.** Set `document.documentElement.lang`
  (and a localized tab title) when the language resolves; `index.html`
  hardcodes `lang="en"`, which mislabels the app for screen readers and
  iOS text services. Rides the leak sweep; pairs with the ACC series.
  Golden master untouched.
- **ESM5 - catalog copy fixes.** `se.add_day` to "Agregar día",
  `phase.peak_desc` to "competencia", `day.pump` to "Pump" (the
  README's own rule), `ob.welcome` to "Te damos la bienvenida a",
  `goal.recomp` to "Verse bien, con salud", landmark word unified on
  "umbrales" (`fe.next_block`, `set.dev_tier_note`). Copy-only PR.
  Golden master untouched.
- **ESM6 - cue fixes.** Rewrite the self-contradicting
  `cue.larsen-press_0`, polish `cue.kroc-row_0`, owner ruling on the
  canillas/espinillas register per challenge 5. Completes the
  native-speaker pass the i18n phase-5 note asked for. Golden master
  untouched.
- **ESM7 - search folding + aliases.** Diacritic-insensitive matching
  in `exMatches` (app.js:264) plus a small per-exercise Spanish alias
  list (jalón, lagartijas, desplante, dominadas supinas). Rides Epic L
  (L1/L2 reuse these pickers). Golden master untouched.
- **ESM8 - T1 in Spanish.** Receipt strings authored in `es.js` in the
  same PR as `en.js`, in the shipped catalog's register, with the SS7
  banned-vocabulary lint extended to the Spanish catalog. Rides T1.
  Golden master untouched.
- **ESM9 - debug chime strings.** Key the `CHIME_CONFIGS` labels/descs
  (app.js:6190) or explicitly rule debug-adjacent strings English. Low
  priority. Golden master untouched.

Panelist 5 (accessibility, ACC series):

- **ACC1 - the announcer.** One `announce(msg, assertive)` helper
  backed by a persistent `aria-live` region in `index.html`; route
  `toast()`/`toastAction()` and the rest-timer done state through it.
  NEW; a prerequisite for T1's announceable receipts, so it lands
  before T1. Golden master untouched.
- **ACC2 - the modal contract.** `role="dialog"`, `aria-modal`,
  focus-in, focus-return, Escape, and a labeled close button in
  `modalShell`/MSTACK, once, centrally; every present and future modal
  inherits it. Startable now; pairs with R4's Android back-button
  routing. Golden master untouched.
- **ACC3 - logging keeps focus.** `donePerf`/`skipSet` update the
  affected set row in place (or restore focus) instead of full
  `render()`; `cd_slider` copies `cd_sleep`'s targeted-update pattern
  so arrow keys stop destroying the focused slider. NEW; the single
  biggest eyes-free blocker. Golden master untouched.
- **ACC4 - text scaling.** Drop `user-scalable=no` on web now; R4 maps
  iOS Dynamic Type / Android fontScale onto the rem root or ships an
  in-app text-size setting in the same store build (challenge 7 makes
  this a submission gate). Rides R4. Golden master untouched.
- **ACC5 - label pass on the logging loop.** aria-labels on the
  perf-modal steppers and rest-timer buttons, `for=` on field labels,
  accessible names on check-in ranges, `aria-pressed` on segmented
  controls, the unlabeled info and close glyph buttons. Rides the UI
  report's icon/aria audit (its item 10) or lands now. Golden master
  untouched.
- **ACC6 - non-gesture equivalents.** A visible Remove affordance that
  does not require the swipe, and up/down reorder buttons on all
  exercise cards (the pattern already exists in the plan editor and
  superset members); keyboard reachability for the weekday
  role="checkbox" rows. NEW. Golden master untouched.
- **ACC7 - timeline weeks.** Timeline week bars become real buttons
  with week labels, or the preview gains a labeled week-list fallback;
  hold the timeline to the plan editor's standard. Rides the UI
  report's data-viz pass (its item 13). Golden master untouched.
- **ACC8 - contrast and focus visibility.** Lift `--text-faint` and
  the 0.78rem floor per the UI report's P0 item 7 (seconded here as
  low-vision-blocking, not box-ticking) and add `:focus-visible` styles
  in the same CSS pass. Rides that item. Golden master untouched.

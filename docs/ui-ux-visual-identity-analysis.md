# IRONWAVE: UI/UX and Visual Identity Analysis

Compiled 2026-07-16. Persona: senior product designer specialized in fitness and
training apps (logger and coach categories), briefed on `docs/marketing-analysis.md`
(v2) and the full prototype (`app/styles.css`, `app/index.html`, `app/app.js`
rendering layer, `docs/hidden-ui.md` copy rules).

**Framing, binding on everything below:** this is not a critique of the prototype
as if it were the product. The prototype is the *engine test rig*. The question
answered here is: **what should the shipped product look, feel, and move like to
win with this specific audience**, and what is the ordered work list to get there.
Every instruction is tagged **[HUMAN]** (design/asset/judgment work the owner does
or commissions), **[CLAUDE]** (code work delegable to Claude in this repo), or
**[HUMAN → CLAUDE]** (human produces the asset/decision, Claude integrates it).

---

## 1. The design brief the marketing report implies

The marketing analysis is unusually prescriptive about visual identity, even
though it never says "design." Extracting the constraints:

1. **The buyer is paywall-cynical, evidence-based, and allergic to fluff.**
   Spreadsheet users, JuggernautAI/RP churners, r/weightroom readers. The copy
   pass already nailed the voice ("state the fact; the athlete supplies the
   motivation"). **The visual identity must be the same voice in pixels:**
   dense, honest, precise, zero decoration that doesn't carry information.
   Anything that reads "consumer wellness app" or "gamified habit toy" burns
   trust with this cohort before the engine gets a chance to speak.
2. **The product straddles two bands.** The free tier competes with Hevy and
   Strong — two of the most polished apps in the entire fitness category, both
   with 4.9-star craft moats. The paid tier must *feel* like a $35/mo coach at
   $12.99. Translation: the logger surfaces need **tracker-grade polish**
   (table stakes), and the coach surfaces need **visible intelligence** — the
   prescription, the wave, the autoregulation must be *seen*, not just computed.
3. **Three growth loops are literally visual assets:** share cards (Instagram
   Stories pixels ARE the ad), PR celebrations (the ratings-prompt moment), and
   the onboarding program reveal (where ~50% of day-0 conversions happen).
   These three moments deserve a disproportionate share of the design budget.
4. **Apple featuring requires overshooting on feel.** The report is explicit: a
   Capacitor app must exceed native polish expectations to clear editorial. That
   means micro-interaction quality, haptics, and motion are not nice-to-haves;
   they are a named distribution requirement.
5. **The audience is 60-75% male 22-40, but the fastest-growing cohort is women
   entering powerlifting.** The aesthetic target is **"serious lifter,"
   gender-neutral**: not supplement-brand aggro (skulls, grunge, red-black rage),
   not soft wellness (pastels, rounded blobs, affirmations). Think platform
   chalk, knurling, and graph paper — the shared visual culture of everyone who
   actually trains, regardless of gender.
6. **A rename is coming (Phase 0, trademark).** The identity system must be
   built so the name is a swappable layer: motifs derived from the *method*
   (waves, plates, bars, progression) survive a rename; motifs derived from the
   word "IRONWAVE" may not. Build method-first, name it later.
7. **Gym context is the physical spec:** low light, OLED phones, chalked/sweaty
   thumbs, phone on the floor or a bench 60cm from the eyes, 15-second glances
   between sets, one-handed use, sometimes no signal. Dark-first, huge numerals,
   fat targets, instant feedback. The prototype already understands this; the
   product must keep it as gospel.

---

## 2. Audit: what is already right (keep, and protect)

Credit where due — several prototype decisions are *product-grade* and should be
carried forward as explicit design principles, not accidents:

- **Dark-first is correct and should become the brand, not just a theme.** For
  the gym context (and OLED battery) dark is functionally right, and the
  marketing doc already lists "dark iPhone-first UI" as carried-over product
  value. Recommendation below is to *own* dark rather than plan a light mode.
- **The big-numeral instinct.** Readiness at 4.6rem, stepper values at 3rem,
  e1RM milestones at 1.9rem. Numbers are this product's actual content; the
  hierarchy already knows it. The type system below formalizes this.
- **Genuine touch craft**, rare in prototypes: `touch-action: manipulation` on
  all controls (kills double-tap zoom delay for rapid +/- taps), 44px minimum
  targets on steppers and day-nav, safe-area insets, `100dvh`, sticky rest
  timer, `tabular-nums` on the clock, and the reserved two-line `.rpe-desc` so
  the modal never reflows under the athlete's thumb mid-tap. These are the
  details Apple editors look for. Keep every one.
- **State is never color alone.** Checkmarks in `.wd-box`, texture weaves on
  deload bars, outline + shadow on the current week. This is both accessible
  and glare-proof. Elevate it to a written rule.
- **`prefers-reduced-motion` is already respected globally.** Keep this as a
  hard gate on everything the motion system adds.
- **Bottom-sheet modals with sticky headers** — the correct native pattern for
  one-handed logging. The animation curve needs upgrading, not the pattern.
- **The copy voice.** "No fluff, no pep talk" is a differentiator against every
  competitor that yells LET'S CRUSH IT. The visual system below is designed to
  match it.
- **The timeline already draws the brand.** The wave-periodization bar chart
  (`.timeline`, `.tl-bars`) is an undulating intensity wave. That shape is the
  most ownable visual asset the product has — see section 4.1.

---

## 3. Audit: what marks it as a prototype (the gaps)

Ordered roughly by how loudly each one says "not a real product" to a store
browser or an Apple editor:

1. **Emoji and unicode glyphs as the entire icon system.** `🏋 🗂 ☰ ▥ 🗑 ⇄ ⛓ ⓘ
   📈 ⚙ ✓ › ⤼ ○ ●` — tab bar, actions, status marks, everything. Emoji render
   differently per OS and OS *version*, mix color and monochrome unpredictably,
   have wildly inconsistent visual weight, and carry zero brand. This is the
   single highest-visibility fix in the entire list.
2. **The palette is competent but unowned.** Near-black navy + electric blue
   (#4b8df8) is the default "dark dashboard" look — and blue is the color of
   the tracker band it must price *above*. Worse, there are semantic
   collisions: **red means both AMRAP (a highlight, the best moment in a
   session) and delete/danger**; **amber means five different things**
   (warning, finisher, injury, "optional" tag, early deload). A stranger cannot
   learn the color language because it contradicts itself.
3. **Zero typographic identity.** Pure system stack. Safe, fast, native — and
   anonymous. Weights 600/700/800 and letter-spacings are sprinkled ad hoc with
   no scale. The wordmark is `letter-spacing: .14em` on a system font.
4. **No designed moments.** Logging a set (the interaction performed hundreds
   of times a week) is a background-color swap. Hitting a PR — the moment the
   entire ratings-and-share growth strategy hangs on — currently *has no
   surface at all*. The rest timer finishing is a fill-color change. The
   program reveal (the paywall moment) is a plain render.
5. **No identity assets.** PNG app icons only, no splash, no wordmark lockup,
   placeholder emoji where exercise media is missing, no empty states.
6. **Contrast debt.** `--text-faint` (#5d6680 on #060a17) is used at 0.68-0.8rem
   sizes — below WCAG AA for text that small. Icon-button labels at 0.72rem are
   both low-contrast and tiny. Gym glare makes this worse, not better.
7. **Token sprawl.** One `--radius` token but literal radii of 7, 8, 9, 10, 12,
   14, 16, 18, 22, 999 across the sheet; ~15 hex colors hardcoded in `app.js`
   chart code (`trendChartHTML`, `BIG_LIFTS`, `BLOCK_COLORS`) that bypass the
   CSS variables entirely. A re-skin today would require hunting through JS.
8. **No haptics, no sound.** On-device feedback channels are unopened
   (Capacitor exposes both). For a logging app used mid-set, haptic
   confirmation is worth more than any visual.
9. **`user-scalable=no` and a fixed 16px root.** Defensible for an app-like
   PWA, but it opts out of accessibility zoom with no Dynamic Type
   compensation. Needs a deliberate decision at Capacitor time, not an
   inherited default.

---

## 4. The target visual identity system

### 4.1 Brand core: the Wave is the mark

The product's method *is* a picture: intensity undulating across weeks, rising
wave by wave, dipping to deload, cresting at the peak. The prototype's own
timeline draws it every day. No competitor owns this shape — Hevy owns a social
feed, Strong owns a checkmark-simplicity, Juggernaut owns a strongman skull-and
-shield energy. **An abstracted intensity wave (3-5 ascending bars or a stepped
waveform) should be the logo mark, the loading state, the share-card watermark,
the splash animation, and the PR-celebration explosion.** It is method-derived,
so it survives the Phase 0 rename regardless of what the name becomes.

- **[HUMAN]** Commission or design the mark: a geometric wave/steps form that
  reads at 60px (store icon grid) and at 24px (in-app). Two lockups: mark-only
  and mark+wordmark. Deliver as SVG.
- **[HUMAN]** Validation gates before accepting any mark: legible at 48px on a
  dark and a light background; distinguishable from Hevy/Strong/Boostcamp/
  JuggernautAI/Alpha Progression icons in a screenshot of an actual App Store
  search-results page (do this test literally: screenshot the "workout tracker"
  results, drop the candidate in, squint).

### 4.2 Color

**Keep the dark graphite base** (the current `--bg` #060a17 family is good;
consider warming it 1-2 points toward neutral graphite so photography and skin
tones sit better on it). The decision to make is the **accent identity**. Three
credible directions, with a recommendation:

| Direction | Identity | Pros | Risks |
|---|---|---|---|
| **A. Forge** — molten ember/orange (#f4772e-ish) on graphite | Iron, heat, effort | Ownable in a blue-saturated tracker shelf; gender-neutral; energetic without aggro; pairs beautifully with dark; the wave rendered as heat is a striking mark | Adjacent to warning-amber (semantic remap required); Boostcamp uses warm tones; red-black adjacency must be avoided (keep it orange, never red) |
| **B. Voltage** — evolve current blue into an electric cyan→indigo duotone gradient | Precision, data, night gym | Lowest migration cost; still reads "tech/coach" | Sits in Hevy/Strong color space; hardest to own; gradients age fast if overused |
| **C. Signal** — near-monochrome graphite/white + one acid accent (volt or chartreuse) used surgically | Austere, expert, "the spreadsheet grew up" | Most premium and most aligned with the no-fluff voice; accent scarcity = hierarchy for free | Volt is Nike-adjacent; collides with success-green unless success is remapped; can read cold/unfriendly to S3 if the photography/motion doesn't warm it |

**Recommendation: A (Forge), decided jointly with the rename** — the name and
the accent are one branding decision. **[HUMAN]** makes this call; it is taste
plus trademark-adjacent, not derivable.

**Non-negotiable regardless of direction — the semantic layer separates from the
brand layer:**

- One brand accent (interactive elements, selection, links, the wordmark).
- `success` (set done, PR confirmed): green family, kept.
- `warning` (caution, injury, over-cap): amber — and **only** warning.
- `danger` (destructive actions only): red — and **only** destructive.
- `amrap` / `effort`: a **new dedicated hue** (the brand accent itself is a good
  candidate: the AMRAP set is the hero set — mark it with the brand color, not
  with danger-red).
- `finisher` (drop sets, myo-reps, rest-pause): its own hue or a shape-only
  treatment (the existing chip outline), divorced from warning-amber.
- Phase colors for the macro timeline (hypertrophy/strength/peak/bridge) become
  a tokenized mini-palette designed to sit together, not four unrelated hexes.
- Every chart color in `app.js` moves into this token set.

### 4.3 Typography

**Two-tier system — the cheap, high-identity move:**

- **UI/body: keep the native system stack** (SF on iOS, Roboto on Android).
  This is deliberate: native type is an Apple-featuring signal, free, and
  perfect for dense controls. Do not replace it.
- **Display/numerals: one bundled display face** for hero numbers (weights,
  reps, e1RM, readiness, timer), section titles, and the wordmark. Numbers are
  the product; give them a face. Requirements: OFL or licensed for app
  embedding, **true tabular figures**, condensed-to-normal width range, heavy
  weights that stay crisp on OLED black. Strong OFL candidates: **Archivo**
  (Expanded for wordmark, SemiCondensed for data), **Barlow Semi Condensed**,
  **Space Grotesk**, **IBM Plex Sans Condensed**. Bundle the woff2 locally —
  offline-first means no font CDN, ever.
- **Discipline:** a written type scale (display-xl 4.5rem / display 3rem /
  title 1.45rem / body 1rem / label 0.85rem / caption 0.78rem — floor, nothing
  below 0.78rem) and max three weights per face. Kill the ad hoc 0.66-0.74rem
  micro-labels; they fail both contrast and glance-ability.

- **[HUMAN]** Pick the display face (taste call; print the top-3 candidates as
  a mock session screen and read them from 60cm on a phone in a dim room).
- **[CLAUDE]** Everything else: bundle, scale tokens, application across views.

### 4.4 Shape, space, and surface

- **Radius scale, three steps:** `--r-sm` (chips, tags, ~8px), `--r-md` (cards,
  inputs, buttons, ~12-14px), `--r-full` (pills, set-number circles). Replace
  all ten current literals. The current 14px card feel is right — friendly but
  not blobby; keep it as `--r-md`.
- **One signature shape rule:** the left accent border on cards (already used
  for lift cards, supersets, optional) is a good, ownable structural motif —
  formalize it as *the* way a card declares its category, and never use it
  decoratively.
- **Spacing scale** (4/8/12/16/24/32) as tokens; the sheet is already close.
- **Surface elevation:** 3 levels only (bg, card, card-2, as today) plus one
  overlay. Resist adding more; dark UIs die by a thousand grays.
- **Density stance:** this audience *wants* density (they came from
  spreadsheets). Do not air the layouts out to wellness-app whitespace; instead
  make density legible with the type scale and alignment. Numbers that can be
  compared must be vertically aligned and tabular.

### 4.5 Iconography

Replace every emoji/unicode glyph with a **single custom-drawn or
custom-curated SVG set**:

- Spec: 24×24 grid, 1.75-2px stroke, consistent join style (decide round vs
  squared once — squared suits the Forge/Signal directions), monochrome,
  `currentColor`, optical corrections at 20px.
- **Pragmatic path (recommended):** license an OFL stroke set (Lucide or
  Phosphor) as the base for the ~25 utility icons (chevrons, info, swap, trash,
  link, search, settings, close, plus/minus, warning, check, calendar, share,
  play, drag-grip, timer), and **hand-draw only the ~8 brand-critical icons**:
  the 4-5 tab-bar icons (dashboard, train, history, program, more), PR/trophy,
  plate/barbell, the wave mark itself. Tab bar icons are stared at daily; they
  carry the brand; stock ones leak genericness.
- **[HUMAN]** The hand-drawn eight, and the round-vs-squared call. (This is the
  "icon svg files" work the owner flagged as theirs.)
- **[CLAUDE]** Vendor the base set, build an inline-SVG sprite + `<use>` helper
  (no runtime fetch, no icon font), replace all emoji call sites in `app.js`,
  and audit `aria-label`s on every icon-only button while doing it.

### 4.6 Data visualization

The charts are coach-tier evidence — they must look like instruments, not
decorations:

- Tokenized chart palette (per 4.2), consistent stroke weights, and one grid
  style shared by sparkline, trend, band, and volume bars.
- Keep the texture-weave language for deloads (it is excellent); extend the
  "texture means modified prescription" rule everywhere (calibration, injury-
  capped sets).
- The volume landmark bar (MEV/MRV) is the paid tier's most persuasive single
  graphic — give it a design pass worthy of a screenshot: labeled landmarks,
  the athlete's position animated on change, status color from the semantic set.
- Big-number stat tiles (e1RM, tonnage, streak) get the display face and a
  shared tile component — these are exactly what gets screenshotted into
  Reddit threads. Design them to be screenshot-flattering.
- **[CLAUDE]** all of it, against **[HUMAN]**-approved palette.

### 4.7 Motion system (and the Rive / Jitter / Spine mapping)

**Principles first:** fast (120-250ms; nothing over 400ms except celebrations),
standard easing tokens (`--ease-out`, `--ease-spring`), motion only as feedback
or explanation (never ambient), everything behind the existing
`prefers-reduced-motion` gate, and a hard budget: **one celebration per
session-event, zero looping animation on screens where the athlete rests.**

**Tier 1 — CSS/JS micro-interactions (no new dependencies) [CLAUDE]:**

- Set completion: checkmark stroke-draw in the set circle + 1.02 scale pop +
  150ms green sweep. The single most-repeated interaction in the app deserves
  the best 200ms in the app.
- Rest timer: subtle pulse on the last 5 seconds; completed state springs
  rather than snaps.
- Stepper value nudge (exists) — retune with the easing tokens.
- Toast: spring-in, not linear slide.
- View transitions: 120ms crossfade + 8px slide on tab change (currently an
  instant re-render, which reads as a glitch).
- Button/chip press states: consistent 0.97 scale + brightness, everywhere.
- Card list entrance: 30ms stagger on first render of a view, capped at 6 items.

**Tier 2 — Rive (vendored runtime, canvas) [HUMAN authors → CLAUDE integrates]:**

Rive is the right tool for exactly four in-app moments — state-machine driven,
tiny files, works in a plain `<canvas>` with a locally vendored JS runtime (keeps
the no-build, offline-first constraints):

1. **PR celebration** — THE business-critical animation (it is the ratings
   prompt trigger and the share-card trigger). Spec: bar bends under load →
   lockout → the wave mark surges through; inputs for PR type (weight/rep/e1RM);
   ≤250KB; ends in a still that composites into the share card. Sequence in
   code: animation → haptic burst → share CTA → (max once per session) rating
   prompt.
2. **Onboarding program reveal** — the paywall moment. The quiz answers visibly
   *assemble* the athlete's actual wave timeline (bars rise into their real
   program). This is "visible intelligence" — the coach showing its work at the
   exact second the buy decision happens.
3. **Splash/logo** — the wave mark drawing itself, <1.5s, skippable by being
   done before the app is.
4. **Empty states** (history, progress, library-no-results) — one shared
   subtle piece, not four bespoke ones.

Explicitly **not** Rive: set completion and timer (too frequent — must be
zero-latency CSS), charts (must be data-true, not canned).

**Jitter — marketing motion only [HUMAN]:** App Store preview video (30s), 
screenshot-panel motion, launch-page hero, share-card motion templates for the
brand's own social posts, creator-partnership ad cuts. Jitter output is video/
Lottie for *out-of-app* surfaces; keep it out of the runtime.

**Spine — recommendation: skip for launch, revisit post-revenue.** The only
credible in-app use is a skeletal-animated exercise-demo library (consistent
style, tiny files, no licensing tangles — genuinely attractive vs the current
video-clip approach in `docs/exercise-media.md`). But it is 4-8 weeks of
animation labor for ~150 exercises and its absence blocks nothing at launch. A
mascot/character is the other classic Spine use and it is **wrong for this
audience** — evidence-based lifters read mascots as juvenile, and the endorser
research in the marketing report says credibility comes from expertise signals.
Decision gate: revisit Spine for exercise demos when MRR funds it (Phase 4).

### 4.8 Haptics and sound [CLAUDE, at Capacitor time; flag-gated no-ops on web]

- Light impact: set logged, stepper tick at rep boundaries.
- Success notification: PR, session complete.
- Warning: destructive confirm opening.
- Rigid double-tap: rest timer complete (works pocketed — this is the one place
  haptics beat every pixel).
- Sound: a single optional timer chime, default off, buried in settings. This
  audience trains with music/podcasts; respect the audio channel.

### 4.9 Photography / illustration stance

- **No stock gym photography** in-app (instantly cheapens; also every
  competitor's mistake). The app's imagery *is* its data visualization.
- Exercise media stays real video clips (current plan) — form demonstration
  needs truth, not style.
- Marketing surfaces (store, landing): real training environments, chalk and
  steel, mixed-gender lifters actually lifting heavy, no posing. **[HUMAN]**
  sources or shoots; this is also the S3-cohort inclusivity lever — who appears
  in the screenshots matters more than any color choice.

### 4.10 Accessibility contract (product-grade, written down)

- AA contrast for all text; lift `--text-faint` to ~#7a84a0 or restrict it to
  ≥0.85rem sizes. Audit every sub-0.8rem usage.
- 0.78rem floor on any text (see type scale); icon-button labels move to it.
- `:focus-visible` styles (keyboard/switch access — currently absent).
- Keep the color+shape state rule; keep reduced-motion; keep 44px targets.
- Decide `user-scalable` deliberately at Capacitor time and compensate with an
  in-app text-size setting if zoom stays disabled.
- VoiceOver pass on the logging loop (the flow a blind lifter would actually
  run mid-set) before store submission.

---

## 5. The five signature moments, ranked by business value

Where the polish budget goes, in order. Everything else ships "clean and quiet."

1. **PR celebration** — powers ratings velocity AND share-card reach, the two
   proven loops. Rive + haptics + share CTA + rating prompt. (§4.7)
2. **Onboarding program reveal** — the day-0 paywall moment (~50% of paid
   conversions). Staged one-question-per-screen quiz (already the plan) ending
   in the wave assembling into *their* program. (§4.7)
3. **Share cards** — pixels that leave the app are the ad. Template system:
   1080×1920 (Stories, with safe zones for IG UI) + 1080×1080 (feed); three
   types: PR card, session summary, meso/volume milestone; dark brand canvas,
   display-face numerals, wave watermark, small wordmark, **no UI chrome** —
   they must look like a poster, not a screenshot. **[HUMAN]** designs the
   Figma templates → **[CLAUDE]** renders them in-app via canvas + Web Share API.
4. **Set completion** — the most frequent interaction. The 200ms CSS moment +
   light haptic. (§4.7 Tier 1)
5. **Rest timer** — the most *watched* surface. In-app polish now (pulse,
   spring, done-state); Live Activity / Dynamic Island is a post-revenue native
   target (Capacitor can't reach it; noted for the Watch-app phase).

---

## 6. Store presence (the identity's first paying job)

- **App icon:** the wave mark alone on the graphite field. Test at 60px against
  the real search-results shelf (§4.1). **[HUMAN]** design → **[CLAUDE]** wires
  the full export set (iOS sizes, adaptive Android, maskable PWA manifest).
- **Screenshot set:** 6-8 panels, benefit-led captions in the product voice
  ("The program adapts to your AMRAP", not "TRAIN SMARTER"), device frames on
  brand canvas, EN + ES from day one (localized store pages are already the
  plan). **[HUMAN]** layout → **[CLAUDE]** stages the in-app states worth
  shooting (a filled dashboard, a mid-session log, the volume screen, the
  timeline).
- **Preview video:** 30s in Jitter — quiz → reveal → log a set → AMRAP → the
  wave adjusts next week → PR card. That sequence *is* the pitch. **[HUMAN]**.

---

## 7. Master instruction list

Phases align with the marketing plan (P0 legal/identity → P1 productize →
P2 beta/launch → P3+ compound). Within a phase, order matters.

### P0 — Identity decisions (with the rename, ~M1)

| # | Owner | Instruction |
|---|---|---|
| 1 | HUMAN | Decide the accent direction (Forge / Voltage / Signal, §4.2) together with the new name. Run the store-shelf squint test on both. |
| 2 | HUMAN | Commission/design the wave mark + wordmark lockups (SVG), validated per §4.1 gates. |
| 3 | HUMAN | Pick the display typeface from the OFL shortlist (§4.3); verify tabular figures and app-embedding license. |
| 4 | HUMAN | Write the one-page brand sheet: accent + semantic palette values, type scale, radius/spacing scale, icon style (round/squared), motion principles. (Claude can draft it from this doc for sign-off.) |
| 5 | CLAUDE | **Tokenization refactor, zero visual change:** rebuild `styles.css` on the full token layer (semantic colors incl. `--amrap`/`--finisher`, radius scale, spacing scale, type scale, easing/duration tokens); move every hardcoded chart/plate/block hex in `app.js` into the same tokens. After this, the P0 re-skin is a one-file swap. Golden master untouched (CSS only). |
| 6 | CLAUDE | Fix the semantic collisions on the current palette immediately (AMRAP off danger-red; finisher off warning-amber) so the language is coherent even before the re-skin. |
| 7 | CLAUDE | Contrast + floor pass: lift `--text-faint` usage per §4.10, raise all sub-0.78rem text, add `:focus-visible` styles. |

### P1 — Core craft (productization months, M1-3)

| # | Owner | Instruction |
|---|---|---|
| 8 | CLAUDE | Apply the signed-off brand sheet: swap token values, bundle the display font (local woff2), apply the type scale across all views. |
| 9 | HUMAN | Hand-draw the 8 brand-critical icons (tab bar set, PR, plate/barbell, wave); approve the vendored utility set (Lucide/Phosphor). |
| 10 | CLAUDE | Inline-SVG sprite system; replace every emoji/unicode icon call site; `aria-label` audit on icon-only buttons in the same pass. |
| 11 | CLAUDE | Tier-1 micro-interactions (§4.7): set-completion moment, timer pulse/spring, view crossfade, press states, toast spring, list stagger. All behind reduced-motion. |
| 12 | CLAUDE | Empty states (static first) + skeleton pattern for any async surface. |
| 13 | CLAUDE | Data-viz pass (§4.6): tokenized chart palette, volume-landmark bar redesign, stat-tile component with display-face numerals. |
| 14 | CLAUDE | Haptics layer via Capacitor plugin, flag-gated no-op on plain web (§4.8). |
| 15 | HUMAN | App icon finals; CLAUDE wires manifest/touch/adaptive/maskable set + static splash. |
| 16 | CLAUDE | Share-card renderer: canvas compositor for the three card types + Web Share API + save-to-photos fallback, driven by HUMAN's Figma templates (item 18). |

### P2 — Signature moments (beta window, M3-4)

| # | Owner | Instruction |
|---|---|---|
| 17 | HUMAN | Author in Rive: PR celebration (spec §4.7: typed inputs, ≤250KB, composites into the share card) and the onboarding program reveal. |
| 18 | HUMAN | Design the share-card Figma templates (2 formats × 3 types, §5.3) with real Stories safe zones. |
| 19 | CLAUDE | Vendor the Rive runtime locally; integrate both pieces; sequence PR moment → haptic → share CTA → once-per-session rating prompt; wire the reveal into the staged quiz onboarding. |
| 20 | CLAUDE | Stage onboarding one-question-per-screen with progress affordance and the reveal choreography (the marketing plan's conversion pattern, owned as product). |
| 21 | HUMAN | Rive splash + shared empty-state piece (lower priority; static fallbacks already shipped in P1). |
| 22 | CLAUDE | VoiceOver pass on the logging loop; text-size setting if zoom stays disabled (§4.10). |

### P3 — Store & marketing (launch runway, M4+)

| # | Owner | Instruction |
|---|---|---|
| 23 | HUMAN | Jitter: 30s preview video (§6 sequence), screenshot motion, landing-page hero, creator-partnership ad cut templates. |
| 24 | HUMAN | Screenshot set design (EN + ES); CLAUDE stages the app states to capture. |
| 25 | HUMAN | Marketing photography sourcing per §4.9 (mixed-gender, real training, no posing). |
| 26 | HUMAN | Post-revenue decision gate: Spine exercise-demo library vs continued video (§4.7). |

### Standing rules (from now on, every PR)

- No new emoji/unicode icons; sprite only.
- No hex colors outside the token layer (CSS or JS).
- No animation outside the duration/easing tokens; reduced-motion always.
- No text below 0.78rem; no text-faint below 0.85rem.
- New states declare themselves with color + shape/texture, never color alone.
- Celebration budget: one per session event, none ambient.
- The copy rules in `docs/hidden-ui.md` apply to any string a design adds
  (including inside share cards and Rive text layers): no fluff, no em dashes.

---

## 8. Anti-patterns (decided now so they never get relitigated)

1. **No mascot.** Wrong audience, wrong credibility signal (§4.7).
2. **No gamification theater** — no XP, badges-for-showing-up, streak-shaming.
   PRs and completed mesocycles are the only celebrated events; they are *real*.
3. **No light theme at launch.** Dark is the brand and the context. Revisit
   only if store reviews demand it; a contrast bump solves sunlight, a theme
   does not.
4. **No stock-photo UI, no pastel wellness drift, no skull-and-grunge drift.**
   The lane is "instrument, not lifestyle."
5. **No looping/ambient animation** on rest or logging screens (battery, and
   the athlete is mid-set).
6. **No icon fonts, no CDN fonts, no CDN runtimes.** Everything vendored;
   offline-first is a sales feature.
7. **No screenshot-style share cards.** Posters, not UI captures.

---

## 9. Open decisions the owner must make (summary of HUMAN calls)

1. Name + accent direction (one decision, §4.2) — everything downstream waits
   on it; the tokenization (item 5) does not, start that now.
2. Display typeface (§4.3).
3. Icon join style + the hand-drawn eight (§4.5).
4. Wave mark design/commission (§4.1).
5. Share-card templates, Rive pieces, Jitter assets (P2/P3 tables).
6. `user-scalable` policy at Capacitor time (§4.10).
7. Spine gate, post-revenue (§4.7).

**The one-sentence version:** keep the prototype's touch craft and honest voice,
replace its borrowed skin (emoji icons, default-blue, system-only type) with an
identity built on the one shape no competitor can claim — the wave the engine
already draws — and spend the motion budget almost entirely on the four moments
the business model actually runs through: the reveal, the PR, the share card,
and the set tap.

# IRONWAVE: Free vs Coach Tier Usage Analysis (and the engineering pass)

Compiled 2026-07-17, on owner directive ("hard stop") after Epic L surfaced
that the free logger was strategy without software. Inputs: the monetization
report's free/coach boundary (`docs/monetization-operations-report.md` §2),
Epic L (`docs/pending-future-work.md`), the marketing report's tier ruling,
and the full rendering layer of `app.js`.

Three deliverables in one:

1. **A usage analysis** of who does what in each tier, hour by hour and week
   by week, and the design that makes the paid tier *worth* $79.99/yr
   (section 1-4).
2. **A complete engineering pass**: every surface in the app mapped to a
   tier, a gate mechanism, and a status (section 5).
3. **The tier debug harness** — SHIPPED with this doc: a Settings toggle
   that previews free/coach today, before any billing exists (section 6),
   plus the engineer handoff it opens (section 7).

---

## 1. The two athletes (usage analysis)

### The free user's week (as it will exist after Epic L)

| Moment | What they do | What they get |
|---|---|---|
| Gym, day 1 | Open logger home, start a routine or empty session | Fast set logging, rest timer, plate math, warmup calc |
| Mid-session | Log a heavy set | PR detection, celebration, a share card for Stories |
| Home | Browse history, e1RM trend per lift | A perfect memory of their training |
| Week 4 | Look at the e1RM chart | A line that goes where it goes; nobody comments |
| Meso ??? | There is no meso | Structure is theirs to invent, like their spreadsheet |

The free tier is **a perfect memory**. It answers "what did I do?" flawlessly
and never answers "what should I do?" That is Hevy/Strong parity — exactly
what the distribution strategy needs, and nothing more.

### The coach user's week

| Moment | What they do | What they get |
|---|---|---|
| Gym, day 1 | Open today's session | Exact prescriptions: sets, reps, load, RIR, warmups, rest |
| Pre-session | 30-second check-in | Readiness silently tunes the day; injury flags ease a lift |
| Top set | Hit the AMRAP | The working max self-corrects; next week's numbers move |
| Week boundary | Nothing (it is automatic) | Volume autoregulation nudges per-muscle sets toward MRV |
| Week 4-5 | Feel beat up | The deload arrives sized to accumulated fatigue, sometimes early |
| Block end | Nothing | Landmarks recalibrate; the next meso re-ramps from MEV |
| Macro scale | Glance at the timeline | Phases, waves, a meet taper planned backward from a date |

The coach tier is **judgment**. Every week it makes decisions the free user
must make alone, and the athlete's only job is to train and tell the truth.

## 2. What makes $79.99/yr worth it: sell decisions, not data

Count the decisions the coach makes for one athlete in one year (4 sessions/
week, bodybuilding track): roughly **2,000+ per-set prescriptions** (load,
reps, effort target, each re-derived from current state), **~50 working-max
corrections** from AMRAPs, **~350 per-muscle weekly volume calls**
(add/hold/cut across 7 muscles), **8-10 deload timing/depth rulings**, **4-6
landmark recalibrations**, phase modulation all year, injury easings on
demand, and for a competitor, a taper and three attempts per lift. Against
$79.99 that is a fraction of a cent per decision; against the market it is a
quarter of JuggernautAI ($349) or RP ($299) for the same job, and two weeks
of one human coaching session ($60-150).

That is the pitch. The product problem is that today **most of those
decisions are invisible.** The engine works silently: the AMRAP moves the
working max but nobody says so; autoreg nudges sets but the athlete just
sees a number; the deload deepens without explanation. A free-trial user
cannot value what they cannot see, and a subscriber cannot renew on math
they never noticed.

**The worth-it design therefore has one central mechanic: decision
receipts.** Every consequential engine decision leaves a short, visible,
athlete-facing trace at the moment it lands:

- "Bench working max +2.5 kg. Your AMRAP beat target by 3 reps."
- "Side delts +1 set this week. Recovered fast, performance up."
- "Deload deepened. Two muscles sat at MRV and recovery slid."
- "Squat eased today. You flagged the left knee."

The plumbing half-exists: `noteKey`/`noteParams` on prescribed sets,
`reasonKey` on `autoregVolume`, the amber early-deload language. What is
missing is the systematic rule — **no silent decisions on the coach tier**
— and the surfaces that show receipts at session time and week boundaries
(engineer item T1, section 7). This is also what makes the 14-day trial
work: the differentiator must *visibly fire* at least twice inside it
(first AMRAP receipt in session one; the week-boundary adjustment around
day 7).

Design principles, binding:

1. **Sell decisions, not data.** Data (logging, history, e1RM, PRs) is free
   forever. Judgment (prescriptions, adjustments, timing) is the product.
2. **No silent decisions on the coach tier** (receipts, above).
3. **Never nerf free to sell coach.** The free tier competes with Hevy on
   its own terms; a crippled logger is the marketing report's "worst
   quadrant" and stays rejected.
4. **The free tier shows its own ceiling honestly.** The organic upgrade
   moment is a *true* observation on the athlete's own data, not a nag
   (section 3).
5. **Data never gates.** Records, sessions, and exports are one shared
   layer; a lapsed subscriber loses prescriptions, never history.

## 3. Upgrade moments (how a free user meets the coach)

Ranked by honesty and expected conversion, all frequency-capped, none
interruptive:

1. **The reveal (day 0):** the quiz → generated program → paywall with
   "continue free" (ruled in the marketing report; M4).
2. **The plateau card (the strongest post-day-0 moment):** when a free
   user's e1RM trend on a big lift is flat or down across ~6+ weeks of real
   logging, one card states the fact: "Bench e1RM flat for 7 weeks. This is
   the point where programming changes something." Shown at most once per
   ~5 weeks, dismissible, computed from `e1rmTrend` on their own data
   (T2). It is true, it is their data, and it is exactly the moment a
   spreadsheet lifter starts shopping for a program.
3. **Locked-surface taps:** the free user taps Volume/Program/Meet out of
   curiosity and meets the honest lock card (shipped in the debug slice) —
   which in production becomes the M4 paywall with the feature's one-line
   value statement.
4. **Post-PR footer:** after a PR celebration, a single quiet line ("The
   coach would plan the next attempt"), never a modal — the celebration is
   the free user's moment, do not tax it.

## 4. What the coach tier must NEVER lose to the free tier

The competitive worry runs the other way too: if the free logger is great,
why pay? The answer must stay structural, not artificial: the coach tier's
value compounds with time-in-app (working maxes converge, landmarks evolve,
receipts accumulate into a visible track record: "this block, the coach
moved your bench 4 kg"). A block-end **coach report card** (extends the H3
macro report with the receipts ledger) makes the compounding explicit at
exactly the moment a subscriber questions renewal. That is T3.

## 5. The complete engineering pass: every surface, tiered

Legend — **Gate**: how the tier boundary is enforced. `screen` =
`coachLockView` replaces the view; `modal` = lock card inside the modal;
`element` = one section gated inside a mixed view; `generation` = the
paywall sits where the coach object is created (M4); `prescription` = the
L4 degraded rendering (program stops prescribing); `n/a` = free, no gate.
**Status**: SHIPPED (this debug slice) / L (Epic L) / M (monetization
slices) / T (this doc's handoff).

| Surface (fn) | Tier | Gate | Status |
|---|---|---|---|
| Onboarding quiz (`vOnboarding`) | Free (front door) | generation at reveal | M4 |
| Program generation (`makeProgram`, `doNewProgram`) | Coach | generation | M4 |
| Dashboard (`vDashboard`) | Mixed → logger home when free | L3 rebuild; banner today | SHIPPED banner, L3 |
| Workout overview (`vWorkout`) | Mixed: day structure free, targets coach | prescription | L1/L4 |
| Session logging (`vSession`, perf modal) | **Free core**; targets/receipts coach | prescription | L1/L4 |
| Check-in (`vCheckin`) | Free collection; adaptations coach | prescription (silent downstream) | L4 |
| Rest timer | Free; prescription-seeded durations coach | element | L4 |
| Warmup calc, plate math | Free | n/a | done |
| History (`vHistory`), summary (`vSummary`) | Free | n/a | done |
| Exercise library + detail (`vExercises`) | Free | n/a | done |
| Progress (`vProgress`): e1RM overlay, PR feed, pump/recovery | Free | n/a | done |
| Progress: landmark band (MEV..MRV) | Coach | element | **SHIPPED** |
| Macro report (`vReport`, `macroReportHTML`) | Coach (program artifact) | screen | T3 (gate with report card) |
| My Program (`vProgram`: timeline, blocks, WMs, template export/import) | Coach | screen | **SHIPPED** |
| Split editor / focus editor / plan editor | Coach | indirect (behind `vProgram`) | SHIPPED indirect; direct check at L5 |
| Weekly volume (`openVolumeDashboard`) | Coach | modal | **SHIPPED** |
| Phase & bodyweight (`openPhase`) | Coach | modal | **SHIPPED** |
| Meet day (`vMeet`) | Coach | screen | **SHIPPED** |
| Swap/add pickers | Both (routine editing when free) | context | L2 |
| Share cards, PR celebration (future) | Free by design | n/a | identity/ASO items |
| Settings (`vSettings`) | Free + debug tier toggle | n/a | **SHIPPED** |
| Data export/import | Free, forever | n/a | done |
| Records/sessions data layer | Shared, never gated | none by principle | done |

Boundary law (restated from the monetization report, enforced by this map):
`engine.js`, `resolveSlot`, and the golden master never learn billing
exists. Every gate above is a rendering/generation decision.

## 6. The tier debug harness (SHIPPED 2026-07-17)

What the owner asked for: a way to walk both tiers today, in the prototype,
long before billing. What shipped (v1.17.0):

- **`S.debugTier`** (`'coach' | 'free'`), additive, backfilled to `'coach'`
  in `migrateState`, persisted like any state — so a preview survives
  reload and shows up in exports.
- **`hasCoach()`** — the ONE entitlement seam, exactly where M1 will later
  install the billing adapter without touching call sites.
- **Settings > Debug: tier preview** — a two-button segment (Coach/Free)
  under the existing debug-chime section, with a toast confirming the
  switch. Both catalogs, house copy rules.
- **The gates that exist today** (see SHIPPED rows above): My Program, Meet
  day, Weekly volume, Phase screen, the Progress landmark band — each
  renders an honest lock card in free mode — plus a dashboard banner naming
  the preview state.
- **What free mode does NOT yet simulate:** the logger home and
  prescription-less session (that is Epic L itself; until L1/L3 land, free
  mode still shows the program-driven workout flow). The banner exists so
  nobody mistakes the preview for the finished free tier.
- **Tests** (`test/tier-debug.test.js`): migration backfill + idempotence,
  the seam flipping, coach surfaces locking while free surfaces survive,
  and the coach default rendering byte-identically (the toggle is inert
  until used). Golden master untouched — all changes are rendering-level.

**Standing rules from here (every future PR):**

1. Any new coach surface checks `hasCoach()` and adds a lock-mode test.
2. Epic L's L5 boundary checklist executes through this toggle; the
   render-smoke suite should eventually run once in free mode.
3. M1 replaces `hasCoach()`'s body only. If a change requires touching
   call sites, the seam has been broken — stop and re-read this doc.

## 7. Engineer handoff (T1-T3; joins L and M in pending-future-work)

- **T1. Decision receipts (the worth-it engine).** A systematic pass over
  the engine's consequential decisions — AMRAP → WM change, autoreg
  add/hold/cut (has `reasonKey` already), deload timing/depth, injury
  easing, double-progression rep/load moves — surfacing each as a short
  athlete-facing receipt at session time or the week boundary. Reuses the
  `noteKey`/`noteParams` + i18n pattern; receipts render on the session
  card and a small week-boundary digest. Coach tier only; default path
  byte-identical when receipts are absent (golden-master-safe: display
  layer only). Copy per house rules; both catalogs.
- **T2. Plateau card on free data.** A pure engine helper (seeded,
  unit-tested) reading `e1rmTrend` for a flat/declining ≥6-week big-lift
  trend; one dismissible card, capped to once per ~5 weeks
  (`S.flags.plateauShownTs`), shown only in free mode (`!hasCoach()`).
  The card's CTA is the M4 paywall when billing exists; under the debug
  harness it points at the tier preview note.
- **T3. Coach report card.** Extend `macroReportHTML` with the receipts
  ledger ("what the coach changed this block and why, and what it moved"):
  counts of WM corrections, volume adjustments, deloads called, with the
  e1RM deltas already computed there. Gate `vReport` behind `hasCoach()`
  when it lands (the map above marks it Coach).

Sequencing: T1 before the September beta (it is what trial users must
see); T2 with Epic L's L3 (needs a free mode to show in); T3 with the
first block-end any beta cohort reaches.

## 8. Owner decisions

1. Ratify the surface map (section 5) as the binding boundary — it
   operationalizes the monetization report's §2 including the four gray
   zones (analytics band = coach, check-in collection = free, timer
   defaults = free, macro report = coach).
2. Approve the receipts principle ("no silent decisions on the coach
   tier") and its copy tone — receipts are athlete-facing strings, so
   they are also a voice decision.
3. Approve the plateau card's existence and cadence (it is the one place
   free users are ever sold to on their own data; the cap and the
   dismissal must stay sacred).
4. Walk the app in free preview (Settings > Debug: tier preview) and mark
   anything that feels wrongly locked or wrongly free — the map is code
   now, so disagreements are one-line fixes today and contract disputes
   later.

**The one-sentence version:** free is a perfect memory and coach is
judgment; make every act of judgment visible as a receipt so the trial can
prove what $79.99 buys, let the free user meet the coach only through
honest moments on their own data, and keep the whole boundary behind one
`hasCoach()` seam that the Settings debug toggle already flips today.

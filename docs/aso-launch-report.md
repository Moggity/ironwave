# IRONWAVE: ASO Launch Report (App Store Optimization)

Compiled 2026-07-16. Persona: ASO / store-growth specialist for subscription
fitness apps, briefed on `docs/marketing-analysis.md` (v2, the binding GTM
plan), `docs/ui-ux-visual-identity-analysis.md` (the identity system this
report's conversion assets depend on), `docs/legal-compliance-report.md`
(keyword constraints), and the prototype.

**Consultation #1 of the launch call sheet** in `docs/pending-future-work.md`.

**Premise, same as the sibling reports:** the PWA is the prototype; the market
product is the store-distributed app launching October-equivalent with both
tiers live. ASO work starts *now* anyway, because its two most valuable inputs
(the name and the ratings engine) have long lead times and are being decided in
Phase 0 and built in Phase 1 respectively. Sections 1-2 are the education the
owner asked for; 3-8 are the plan; 9 is the engineer-agent handoff.

---

## 1. What ASO actually is (the education)

ASO is SEO for the app stores, with three differences that change everything:

1. **The search page is tiny.** One to three results are visible above the
   fold, and 65-70% of all store downloads start at that search box (SOURCED
   in the marketing report). Rank 1-3 on a term is a business; rank 15 is
   nothing. That is why the strategy targets small terms we can own rather
   than big terms we cannot.
2. **Conversion feeds rank.** Both stores promote listings that convert
   impressions into installs. Your icon, screenshots, rating stars, and first
   description lines are therefore not "marketing polish", they are ranking
   inputs. A bad screenshot set suppresses your keyword rank.
3. **Reputation compounds.** Ratings count and velocity gate everything:
   moving 3.5 to 4.5 stars lifts listing conversion 30-35% (SOURCED), which
   lifts rank, which lifts installs, which (with prompts at the right moments)
   lifts ratings again. Strong's 4.9-star moat IS its business. This flywheel
   is the single most valuable asset ASO builds, and it cannot be bought or
   rushed, only started early.

So ASO decomposes into four workstreams: **keywords** (be findable),
**conversion assets** (turn a viewer into an installer), **ratings** (the
compounding moat), and **iteration** (measure, test, refresh). A solo
developer can run all four in a few hours a week once the plumbing exists.

## 2. How the two stores actually rank you (mechanics)

The stores index different things. Getting this wrong wastes the tiny keyword
real estate you have.

**Apple App Store:**

- **App name** (30 chars) is the heaviest-weighted field. Format convention:
  `BRAND: keyword phrase` (e.g. how "Hevy: Workout Tracker Gym Log" spends
  every character).
- **Subtitle** (30 chars): second-heaviest. Do not repeat words from the name;
  each word is indexed once, repetition is pure waste.
- **Hidden keyword field** (100 chars): comma-separated, no spaces after
  commas, no need for plurals (singular covers both), never repeat anything
  already in name/subtitle. Apple combines fields into phrases for you.
- **The long description is NOT indexed** on Apple. It exists purely to
  convert humans (only the first ~3 lines show before "more").
- Also indexed: IAP display names (name your subscription products with
  keywords in mind, e.g. "Coach Plan"), and in-app events.
- Ratings (count, average, velocity), install conversion rate, and retention
  feed the ranking model.

**Google Play:**

- **Title** (30 chars) and **short description** (80 chars) are the heavy
  fields.
- **The long description IS indexed.** Target terms should each appear
  naturally 2-4 times across it. Keyword stuffing is penalized; write for
  humans, audit for coverage.
- No hidden keyword field.
- **Android vitals** (crash rate, ANR) are a ranking input: a janky wrapper
  build directly suppresses visibility. This makes the platform engineer's
  work (call sheet #2) an ASO dependency.
- Review *text* influences discovery; responding to reviews is visible and
  weighted in user decisions.

**Both stores:** localized listings are indexed per-locale (our ES listing is
a second, much less competitive keyword universe), and both offer built-in
A/B testing (Apple Product Page Optimization; Play store listing
experiments), which we use post-launch, one hypothesis at a time.

## 3. The keyword battlefield for this product

From the marketing teardown: head terms are owned, the long tail is winnable.
Tiered map, to be validated with a real keyword tool before metadata is
locked (section 8, owner task):

- **Tier 0, do not chase:** "workout tracker", "gym log", "workout planner",
  "fitness". Strong/Hevy/Jefit own these with years of ratings velocity. We
  still *include* some of these words where they fit naturally (they appear
  inside longer phrases we do win), but the plan never depends on ranking for
  them.
- **Tier 1, the winnable identity terms:** "powerbuilding" (tiny volume, near
  zero competition, and it IS the product; we should own this word outright),
  "powerlifting program", "hypertrophy program", "hypertrophy tracker",
  "strength program", "powerlifting log". Moderate volume, weak incumbents,
  exact buyer intent.
- **Tier 2, method terms (small but perfectly qualified):** "wave
  periodization", "RPE training", "RIR", "autoregulation", "periodization
  app", "meet prep". Whoever searches these is our S1 buyer by definition.
  **Legal constraint (binding, from the legal report): zero "Juggernaut",
  zero "RP"/"Renaissance", and treat "5/3/1" as radioactive** — Wendler has
  a documented history of clearing "5/3/1" apps out of the stores; the
  generic phrasing "wave progression" / "percentage based program" captures
  the same intent without the mark.
- **Tier 3, utility trojan horses (the sleeper opportunity):** "plate
  calculator", "one rep max calculator" / "1RM calculator", "RPE calculator",
  "rest timer". Real search volume, weak competition, and **the app already
  contains all four features**. These terms go in the keyword field / Play
  long description and one screenshot; they harvest installs from lifters who
  wanted a utility and discover a coach. This is the cheapest acquisition
  wedge available to us.
- **Spanish universe:** "rutina de gimnasio", "powerlifting", "programa de
  fuerza", "hipertrofia", "press banca" adjacent terms. Dramatically less
  competitive (ESTIMATED in the marketing report); the ES listing is not a
  translation chore, it is a second ranking surface. Terms must follow the
  LatAm register rules in `docs/hidden-ui.md` (the copy pass already
  established which gym terms stay English).

**The name decision is an ASO decision.** Phase 0's rename (legal) chooses the
brand half of the 30-character name field; ASO chooses the other half. The
title formula to hold the rename to: a short, clearable brand (≤ 12 chars
ideal) leaving ≥ 15 chars for `: Powerbuilding Coach` or `: Strength +
Hypertrophy` style keyword payload. A beautiful 25-character brand name
silently costs us the strongest keyword slot in the store.

## 4. The ratings engine (the moat, and the API reality)

The mechanics constrain the design more than people expect:

- **iOS (`SKStoreReviewController` via Capacitor):** you may *ask the system*
  to prompt at most 3 times per user per 365 days, Apple decides whether the
  dialog actually shows, and the app cannot know if it did. Conclusion: the
  trigger moments must be so well-chosen that 3 chances are enough.
- **Android (In-App Review API):** similar quota philosophy, similarly
  opaque.
- **The chosen moments (aligned with the marketing report's rule "prompt at
  PR moments; never interrupt a set"):**
  1. a PR was just logged AND the session summary screen is showing (never
     mid-session, never while the rest timer runs),
  2. a mesocycle/block just completed with the athlete's numbers up,
  3. floor gates for both: ≥ 8-10 completed sessions, ≥ 14 days since
     install, ≥ 60 days since the last prompt attempt, and never after a
     session the athlete rated as feeling bad.
- **Review responses are part of the system:** on Play they are public and
  indexed-adjacent; on both stores an answered 2-star review that turns into
  a 4-star edit is worth more than a new 5-star. Budget ~30 min/week from
  launch (this folds into the support persona's remit, call sheet #6).
- **What we never do:** incentivized ratings (both stores ban it), prompt on
  first launch, prompt after a crash or a failed session, or a custom "rate
  us" nag dialog in place of the official API (guideline violation on iOS).

Beta reality check: **TestFlight and Play open-testing reviews do not carry
to the public listing.** The September beta builds advocates and bug reports,
not ASO equity; the ratings clock starts at the October launch. This is why
the prompt plumbing must be in the v1.0 build, not a fast-follow.

## 5. Conversion assets (what the searcher sees in 2 seconds)

Priorities in order of measured impact:

1. **Icon.** Decided in the identity report (the wave mark on graphite,
   §4.1/§6 there). ASO addition: it must survive the *shelf test* against the
   actual top-10 "powerlifting program" results, not just look good alone.
2. **Screenshots 1-3 do all the work** (most viewers never swipe past). Order
   for our funnel: (1) the coach claim over the session view ("The program
   adapts to your AMRAP" style, product voice, no hype), (2) the wave/
   timeline visualization (the ownable visual no tracker has), (3) the
   volume-landmark dashboard (the paid tier's evidence). Then: logger polish,
   plate math/rest timer (the Tier-3 utility hook), share card/PR moment.
   Captions carry the message; assume the UI itself is glanced, not read.
3. **Preview video (Apple) autoplays muted:** the first 3 seconds must show
   the reveal or the wave, not a logo card. The identity report already
   assigns this to Jitter (P3 there).
4. **Description:** Apple, first 3 lines = the pitch (the one-sentence coach
   claim + the free-logger promise + no-account/offline honesty, which this
   audience uniquely rewards); the rest converts skeptics with specifics.
   Play version additionally carries the Tier 1-3 keyword coverage naturally.
5. **In-app events (Apple) post-launch:** "New Year, programmed properly"
   style events give a second search surface every season without touching
   the binary.

## 6. Launch sequencing (ASO calendar, aligned to the phased GTM)

- **Now / Phase 0:** hold the rename to the title formula (§3); run the
  keyword validation pass (owner task, §8); check name availability in BOTH
  stores the moment candidates exist (App Store names are unique; a cleared
  trademark with a taken store name is a dead name).
- **Phase 1 (productize):** ratings plumbing + PR detection + share cards
  land in the build (engineer notes, §9); screenshot staging state built;
  store listings drafted EN + ES; App Store Connect / Play Console records
  created early (Play's 12-tester/14-day gate for new personal accounts is
  on the critical path and cannot be compressed later).
- **Phase 2 (September beta):** listings finalized; screenshots shot from the
  staged build; metadata loaded; featuring nomination drafted (files the day
  HealthKit + localization land, per the marketing plan; 2-week to 3-month
  lead time).
- **October launch:** both tiers live; ratings engine on from day one; review
  response cadence starts; keyword rank tracking baselined.
- **October-December:** the entire ASO job is ratings velocity + one listing
  iteration (fix whatever the funnel metrics say is leaking, §8). No paid
  spend (marketing report rule: never buy January, and paid is gated anyway).
- **January:** harvest with whatever rank exists (the marketing report's
  "upside, never the plan"); New-Year in-app event live; seasonal screenshot
  refresh if the December data justified one.
- **February-March:** first Apple PPO / Play experiment (one variable: icon
  or first screenshot), only if impressions volume supports a valid read.

## 7. Post-launch operating loop (the weekly hour)

1. **Rank:** track ~20 target keywords weekly per locale (tool, §8).
2. **Funnel:** App Store Connect + Play Console metrics: impressions →
   product page views → installs. A weak impressions number is a keyword
   problem; weak page→install is an asset problem; diagnose before changing
   anything.
3. **Ratings:** velocity (new ratings/week), average, and prompt-attempt
   counts from our own instrumentation (§9) to estimate prompt→rating yield.
4. **Reviews as roadmap:** tag review complaints; recurring themes feed the
   pending-future-work doc exactly like the athlete-feedback simulation did.
5. **Refresh cadence:** metadata/keyword iteration at most monthly (rank
   needs time to settle); asset A/B one variable at a time with 200-500
   conversions per variant (same discipline the marketing report mandates
   for paywalls).

KPI alignment with the pre-committed gates: the marketing plan's month-6 gate
(≥ 1,000 free weekly actives AND ≥ 4.5 stars) is, in ASO terms, roughly
rank ≤ 5 on "powerbuilding" + two Tier-1 terms, ≥ 4.5 stars on ≥ 100+
ratings, and page→install conversion at or above the fitness-category median.

## 8. Owner tasks (non-code, in order)

1. **Keyword validation pass (before the rename is final):** a month of a
   keyword tool's entry tier (AppTweak / Astro / Sensor Tower / AppFigures,
   any one) to put real volume/difficulty numbers on the §3 tier map, EN and
   ES. A weekend of work; it de-risks the two 30-character decisions that are
   nearly irreversible.
2. **Name availability check in both stores** for every rename candidate,
   alongside the TSDR/EUIPO clearance the legal report already requires.
3. **Store accounts early** (Apple Developer Program, Play Console) — fees
   and identity/D-U-N-S decisions are already itemized in
   `docs/pending-future-work.md` under the iOS App Store build checklist;
   ASO adds only *urgency* (Play's tester gate, name reservation).
4. **Approve the screenshot narrative** (§5 order) once the identity system
   exists to render it.
5. **Set up rank tracking** (same tool as #1, or a cheaper tracker) the week
   of launch, not after.

## 9. Engineer notes (for the dev agents; repo conventions apply)

All items follow the house rules: additive state backfilled in
`migrateState`, athlete-facing strings in BOTH i18n catalogs with no em
dashes, golden master untouched (nothing below touches prescription), new
top-level functions exported through the harness shims, tests extended per
feature. These slot into the **Productization epic** in
`docs/pending-future-work.md` (a derived-branch bullet now references this
section).

- **E1. Real-time PR detection hook.** H3's Progress work already derives a
  PR feed from `S.records`; the ratings and share moments need the *live*
  signal instead: at set-log time (`donePerf`), detect "this set is an e1RM
  or rep PR for this exercise" and expose it as a cheap, pure helper (e.g.
  `Engine.isPr(record, history)`) plus a session-scoped flag on `V`. No new
  persisted state; must be O(history) cheap or memoized per exercise.
- **E2. Store-review prompt plumbing.** A `maybeRequestReview(trigger)`
  gate implementing §4's rules: triggers `pr_session_end` and
  `block_complete`; floor gates (sessions completed ≥ 8, days since install
  ≥ 14, days since last attempt ≥ 60, never mid-session, never with the rest
  timer live, never after a low session rating). Persisted additively as
  `S.review = { attempts: [], installedAt }` (backfilled; `installedAt`
  defaults to first-seen migration time). The actual prompt call goes
  through a thin adapter that uses the Capacitor review plugin when present
  and is a **silent no-op on plain web** (same flag-gating pattern as
  haptics in the identity report). Unit-test the gate logic with seeded
  state; never unit-test the store API itself.
- **E3. Local milestone counters.** The gate in E2 needs "sessions
  completed" and "PRs this session" without any analytics dependency
  (offline-first is a feature): derive from existing logs where possible;
  add counters only if derivation is too hot a path.
- **E4. Screenshot staging state.** A dev-only, deterministic seeded state
  (filled dashboard, mid-session log with a PR, volume screen with
  interesting landmarks, timeline mid-macro) reachable via a query flag or a
  hidden settings tap, excluded from production behavior. Reuse the test
  harness seeding patterns; this is how the owner shoots §5's screenshots in
  both languages without training for eight weeks first.
- **E5. IAP product naming hook (when RevenueCat lands).** Whoever builds
  the subscription slice: product *display names* are indexed on Apple;
  name them with §3 in mind (e.g. "Coach Plan") rather than "Pro Monthly".
  One-line decision, easy to get wrong by default.
- **E6. Keep the prototype noindexed** (`index.html` already carries the
  robots meta; do not remove it when productizing) so the public web copy
  never competes with or dilutes the store listings; the future marketing
  landing page is a separate, indexable property (owner scope).
- **E7. Share cards and PR celebration** are specified in the identity
  report (its items 16-19) and are ASO-adjacent (they feed the ratings
  moment and social reach); no duplicate spec here, just the dependency
  note: **E1 blocks both** the celebration trigger and E2's `pr_session_end`.

**The one-sentence version:** pick a name that leaves room for keywords, own
"powerbuilding" and the utility long tail, ship the ratings plumbing in v1.0
because the flywheel cannot start retroactively, make the first three
screenshots carry the coach claim, and spend one honest hour a week on the
loop forever.

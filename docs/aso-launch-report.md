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

---

## Amendment (2026-07-18): synergy re-pass after consultations 4-6

Commissioned by the owner's synergy re-pass directive in
`docs/pending-future-work.md`. Read against the analytics report (#4), the
privacy report (#5), and the support report (#6). The body above stands
except where amended here. Target unchanged: native store apps, free
standalone logger (Epic L), paid coach.

### What changes

1. **"No account needed" is promoted from hedge to headline (§5.4).** When
   §5 was written, "no-account/offline honesty" was a hope; the privacy
   report's §3.1 ruling (accounts optional, purchases restore with no
   login, sync is the only account feature) made it architecture. It joins
   the first-three-lines pitch, but as ONE line fused with the privacy
   claim, not two: coach claim, free-logger promise, then "No account. No
   signup. Your training data stays on your phone." Three lines, three
   claims, done. The same line is the strongest candidate for Play's
   80-char short description after the keyword payload.
2. **The privacy posture becomes a keyword cluster and a late screenshot,
   not the lead (§3, §5).** Add to the §3 map and the owner's keyword
   validation pass: "offline workout tracker", "no account", "private
   workout log", plus ES equivalents. Expect small volume; the real ASO
   value is conversion-side, because Apple's privacy nutrition label sits
   ON the product page and PD8's answer sheet is what keeps ours short
   ("data not linked to you"). A near-empty label in the fitness category
   is a visible differentiator no competitor copy can fake. Screenshot
   plan: slots 1-3 stay as ruled (the coach claim leads); the privacy
   claim takes a captioned slot in the back half, replacing the generic
   "logger polish" shot.
3. **Screenshot 3's "paid tier's evidence" should be receipts, not the
   volume dashboard (§5.2).** T1 decision receipts now land before the
   September beta and are, per the support report's ledger item 6, the
   product's own answer to "why did my numbers change". "The coach shows
   its work" over a receipts digest is a stronger paid-evidence frame than
   a landmark chart; the volume dashboard moves to slot 4. Hold this as
   the launch order and let the February PPO test challenge it.
4. **The free-tier half of the long description gets concrete (§5.4).**
   Epic L gives the listing real free nouns: freestyle logging (L1),
   routines (L2), history, e1RM trends, plate calculator, 1RM calculator,
   rest timer, export. The Tier-3 trojan-horse terms and the free-logger
   promise are now the same paragraph. TIER-1's macro line ("logging is
   free forever, judgment is the product") is listing-grade copy; reuse
   the voice.
5. **§7's weekly hour merges with the analytics scoreboard.** One shared
   hour (analytics §9), not two: rank + funnel + ratings + the gate
   scoreboard + the support report's five-minute theme tally. The
   reviews-as-roadmap bullet (§7.4) is now operationalized by support §7
   (3+ mentions/month = a `[from-support]` roadmap line); this report
   stops owning it and starts consuming it.
6. **Prompt-yield measurement moves from local counters to AN3.** §7.3
   claimed we would estimate prompt-to-rating yield "from our own
   instrumentation"; E3's on-device counters can gate prompts but the
   owner cannot read them remotely, so as a measurement plan that
   sentence was wrong. AN3's `review_prompt_attempted(trigger)` (already
   in the closed catalog) is the measurement; E3 survives only as E2's
   offline gating input. See E8.
7. **CS4's what's-new discipline is adopted as an ASO surface.** Store
   "what's new" is conversion copy read at scale and (on Play) lightly
   discovery-relevant. Rules from this desk: house voice, EN + ES, name
   user-visible fixes plainly, never keyword-stuff it, and keep it
   consistent with the review replies that cite versions ("Fixed in 1.3")
   because prospects read both. CS4's R9 checklist line is the
   enforcement; no new machinery.
8. **The ratings floor now rises by deflection, not just prompts (§4).**
   The support and monetization plans delete predicted 1-star classes
   before they are written: M5's day-12 reminder (surprise charge), L4's
   detachment card (hostage program), PD4 sync (lost phone, lost log),
   T1 receipts (silent changes), CS1's FAQ (everything else). §4's
   prompt engine is the offense; consultations 4-6 built the defense.
   Budget note: §4's ~30 min/week of review responses now lives inside
   support's twice-weekly review window, not as a separate ASO chore.

### What breaks

1. **E2's `S.review` persistence choice predates the device-scoped
   doctrine and is wrong.** Written 07-16; TB4 (07-17) established that
   entitlement-shaped device state lives in device-scoped storage, never
   in `S`, and PD1's inventory lint now polices every top-level `S` key.
   Review-prompt attempts and install time are device facts, not athlete
   training state: they must not ride export/import or the future sync
   blob (importing someone's state should not inherit their prompt
   quota). E9 relocates it. My own spec, my own miss.
2. **§4's beta paragraph understated the beta cohort's ratings value.**
   "Beta builds advocates, not ASO equity" stands mechanically, but the
   support report's §8 advocate-conversion play (launch-week in-app
   prompt ask to the cohort, quota-respecting) makes the beta cohort the
   ratings engine's day-one fuel. The install clocks make it work: beta
   installs start in September, so by October launch the cohort passes
   E2's 14-day and session floors legitimately, provided the review
   state survives the beta-to-production build transition (E9 makes that
   explicit). No link blasts; the in-app flow only.
3. **"Data never leaves your phone" as quoted in the re-pass agenda is
   not shippable copy.** With analytics opt-in, Sentry crash reports,
   and optional sync, the absolute claim is false and store-review bait;
   an FTC-flavored substantiation problem at worst. The honest, still
   ownable line is scoped: "Your training data stays on your phone
   unless you turn on sync." Anonymous usage stats are opt-in and
   content-free (analytics §6.3), which the listing may say but must not
   round up to "never". Challenge recorded below.

### New synergy

1. **Retention gates are ratings gates.** E2's floors (8+ sessions, 14+
   days) mean only week-2-retained users are ever promptable, so the
   analytics report's new week-4 retention gate is a leading indicator
   of ratings velocity. If retention misses the 20% band, the ratings
   flywheel starves regardless of prompt quality; read them together on
   the scoreboard.
2. **The consent-decline blind spot has a cheap gauge.** Users who
   decline analytics vanish from the funnel; the store consoles' install
   count vs PostHog `first_open` gives the opt-in rate. Track it in the
   weekly hour; if opt-in is low, funnel reads are unrepresentative and
   gate decisions should say so (the analytics report's "no fake
   numbers" scoreboard rule, applied to its own denominator).
3. **E4's staging state serves three masters.** The screenshot state now
   doubles as the preview-video demo state and the beta brief's guided
   tour. Extending it with a receipts-rich week (delta 3) and the
   Settings > Privacy screen (delta 2) makes every new conversion asset
   shootable in both languages; see E10.
4. **ES support makes the ES listing defensible.** §3's second keyword
   universe assumed someone answers ES reviews; support §6 commits to
   it (replies match the review's language). On Play, where review text
   and responses are discovery-adjacent, the ES listing now has an
   operations owner instead of a translation chore.
5. **First-run honesty is testable.** The listing's "first set in under
   a minute, no signup" promise depends on PD2's boolean age gate, AN2's
   skippable consent screen, and L3's logger home with "Start a session"
   primary (analytics §8.2). That sequence is a property, not a vibe;
   E11 pins it in the beta dress rehearsal.

### Challenges to prior rulings (owner decides)

1. **Soften the agenda's privacy phrasing before it reaches any listing
   or screenshot:** "training data stays on your phone unless you turn
   on sync", never "data never leaves your phone". Reasoning in What
   breaks #3. Draft listing copy with PD8's answer sheet open so claims
   and labels are checked against each other in the same sitting.
2. **None against consultations 4-6 otherwise.** The analytics prompt-
   yield event, the privacy label posture, and the support review-window
   ownership all strengthen the original plan; endorsed as amended above.

### Engineer notes (continuing §9's series)

- **E8. Emit `review_prompt_attempted` from E2's gate.** When the E2 gate
  passes and the adapter is invoked, fire the already-cataloged
  `review_prompt_attempted(trigger)` through the AN1 face (permanent
  no-op on web/self-hosted). One line at the E2 call site; no new events,
  no new state. Rides AN3 + the ASO instrumentation slice.
- **E9. Relocate E2's review state to device-scoped storage.** Supersedes
  the `S.review` shape in §9/E2: attempts + installedAt move to the TB4
  device-scoped store (R1 adapter face), excluded from export/import and
  any future sync blob, declared D-class in PD1's `docs/data-inventory.md`
  device-side list. Must survive the TestFlight/Play-track upgrade to the
  production build (never key it to build channel) so the beta cohort is
  promptable at launch. Rides E2 + R1; gate unit tests unchanged in
  spirit, re-seeded against the new store.
- **E10. Extend E4's staging state for the new assets.** Add a seeded
  receipts-rich week (all T1 `kind`s represented) and a populated
  Settings > Privacy state, so the receipts screenshot (delta 3), the
  privacy screenshot (delta 2), and the preview video shoot from one
  deterministic state in both languages. Rides E4, after T1 and PD3 land.
- **E11. Assert the store-build first-run sequence in AN6's rehearsal.**
  Add a checklist assertion (and a render-smoke where feasible) that
  first run is: age gate (PD2 boolean) -> optional analytics opt-in
  (AN2, declinable, non-blocking) -> L3 logger home with "Start a
  session" primary. No consent wall may creep ahead of the first
  loggable set; the listing promise depends on it. Rides AN6 + PD2 + L3;
  new as a check, zero new UI.

**Owner tasks added by this amendment:** extend the §8.1 keyword
validation pass with the privacy/offline cluster (delta 2, EN + ES);
approve the scoped privacy line (challenge 1); approve the revised
screenshot order (deltas 1-4) when the identity system renders it.

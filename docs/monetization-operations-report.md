# IRONWAVE: Monetization Operations Report (paywall, billing, lifecycle)

Compiled 2026-07-16. Persona: subscription monetization / paywall operator for
consumer mobile apps, briefed on `docs/marketing-analysis.md` (v2 — the
strategy is RULED there: notebook free / coach paid, $12.99 mo / $79.99 yr /
$249 lifetime, $59.99 founding-member first-year annual intro, 14-day trial,
IAP-primary at the Small Business 15% rate, web checkout for win-backs only),
`docs/release-engineering-report.md` (the `platform.js` adapter this report's
billing code plugs into), `docs/aso-launch-report.md` (IAP display names are
indexed; refund rates feed ratings), `docs/legal-compliance-report.md`
(auto-renewal disclosures), and the app itself (which features live where).

**Consultation #3 of the launch call sheet** in `docs/pending-future-work.md`.

This report does not relitigate strategy. It answers: how does that ruling
become working software and a running operation? Sections 1 is education,
2-7 are the operating design, 8 is the owner list, 9 is the engineer handoff
(M1-M8), absorbed into `docs/pending-future-work.md` as a derived branch.

---

## 1. How subscription billing actually works (the education)

Five concepts carry everything:

- **Products.** You define purchasable items in App Store Connect / Play
  Console: two auto-renewing subscriptions (monthly, annual) in one
  *subscription group*, plus the lifetime tier as a **non-consumable
  one-time purchase** (lifetime is NOT a subscription; it never renews and
  needs its own handling everywhere). Prices are chosen from the stores'
  price-point tables per country — which is how day-one price localization
  ships without code.
- **Entitlements.** The app never asks "what did they buy?" at feature
  gates; it asks "does this athlete have the *coach* entitlement?" One
  abstraction — `coach` — is granted by monthly OR annual OR lifetime OR an
  active trial. Products change over the years; the entitlement name never
  does.
- **Receipts and the server problem.** The store gives the device a signed
  receipt. Somebody must validate it, track renewals/cancellations/refunds
  that happen OUTSIDE the app (App Store settings, family sharing, billing
  failures), and answer "is the entitlement active *today*?" Doing this
  yourself means running a receipt server. **RevenueCat** is that server as
  a service (free to $2.5K monthly tracked revenue, then ~1%): it validates
  receipts, holds the entitlement truth, unifies iOS/Android/(later) Stripe,
  and gives the metrics dashboard (§7) for free. At solo scale this is not
  a convenience, it is the difference between one integration and three.
- **The lifecycle.** A subscriber is always in exactly one state:
  `trial → active → (renewal…) → billing-retry/grace → expired`, with
  voluntary cancel (auto-renew off, access until period end) and refunds as
  jumps. Two operational facts novices miss: **you do not control refunds**
  (Apple decides; you find out after) and **a large share of churn is
  involuntary** — expired cards, failed payments (the marketing report
  sources 23%+ of churn as recoverable billing error). Enabling the stores'
  **grace period** (access continues while billing retries) is a free,
  one-checkbox retention lift; it is off by default.
- **Intro offers.** The $59.99 founding-member year is not custom code; it
  is a standard **introductory offer** (pay-up-front, one year) configured
  on the annual product. Stores enforce one-per-user automatically. The
  14-day trial is likewise an intro offer on the subscriptions ("free
  trial" type). Configuring these in the console instead of inventing them
  in code is both less work and the only compliant path.

## 2. The free/coach boundary, mapped to actual features

The ruling says "notebook free, coach paid." Operationally that must become
a feature-by-feature list the whole team can point at. Proposed mapping
(gray zones flagged for the owner):

**Free (the genuinely good logger — the distribution asset):**

- Unlimited workout logging, history, session detail, the perf modal, rest
  timer, plate math, warmup calculator, exercise library + custom
  exercises, unit/language settings, share cards, PR celebrations + PR
  feed, e1RM per-exercise trends, HealthKit export, raw-data export
  (loudly free, forever — this audience checks).

**Coach (the paid entitlement — everything no logger has):**

- Program generation (the split generator + templates), wave prescriptions
  and AMRAP-driven working-max autoregulation, volume landmarks + the
  weekly volume dashboard + per-muscle autoregulation, readiness-driven
  adjustments and early-deload intelligence, deload depth, double
  progression / rep ranges, technique scheduling, meet prep + attempt
  planning, phase/energy-balance layer, the macro timeline/planner,
  mid-macro re-spec, custom program template import (H7).

**Gray zones (owner decisions, my recommendation attached):**

1. **Progress analytics beyond per-exercise e1RM** (H3's landmark bands,
   volume trends): recommend COACH (it reads landmark data only the coach
   computes), keeping the PR feed and e1RM lines free.
2. **Creator partner programs** (Phase 3): COACH — they are the paid
   library's content, and the affiliate math assumes it.
3. **Check-ins**: keep the *collection* free (habit + data continuity so a
   later upgrade instantly has history) but the *adaptations* they drive
   are coach. Free users see their answers, not prescriptions from them.
4. **The rest timer's prescribed durations** come from the time model; the
   timer itself is free with sensible defaults, prescription-seeded
   durations are coach. (Cheap to implement at the adapter seam.)

**The engine-purity rule (binding for engineers):** gating happens at the
UI/feature layer and in what gets *generated*, never inside `engine.js`
math or `resolveSlot` behavior for an entitled program. The golden master
and the scheme registry know nothing about billing. A locked athlete keeps
their data; the coach simply stops *prescribing*.

## 3. Trial-expiry behavior (the decision most apps get wrong)

For THIS audience the worst possible outcome is "my program is hostage."
The design:

- During trial: full coach, a quiet day-counter in settings (not a nag).
- **Day 12 of 14: a local notification + in-app note** — "Trial ends in 2
  days. $79.99/yr after, or keep the free logger." The reminder-before-
  charge is the single highest-trust move a subscription app can make with
  paywall-cynical buyers: it measurably cuts refunds and 1-star "forgot to
  cancel" reviews (the marketing report's 70%-higher-refund hard-paywall
  stat is mostly *surprise* — this kills the surprise). Apple now also
  sends its own reminders for longer trials; ours arrives earlier and in
  our voice.
- On expiry WITHOUT purchase (**owner ruling, 2026-07-17 — the logger
  detaches from the coach completely**): a card announces the lapse; the
  NEXT week arrives as a clone of last week's exercises (structure only,
  no prescriptions) so the athlete is not stranded mid-routine; every
  week after that is empty and the athlete logs by hand, Strong-style
  (Epic L's freestyle logging). History and export are untouched. **Nothing
  is deleted, blurred, or held hostage.** If they subscribe later, the
  coach re-engages from stored state.
- Existing self-hosted/prototype users and the owner's own instance: the
  web build never gates (M1) — there is no billing on the self-hosted
  target at all, which also keeps the whole test suite entitlement-free.

## 4. The paywall itself (placement and anatomy)

Placement is ruled (contextual, at coach moments): the onboarding program
reveal is the primary surface (~50% of day-0 conversions in category data),
plus contextual touchpoints when a free user taps a coach feature (volume
dashboard, timeline, generation). Never a dead-end: **"Continue with the
free logger" is always visible, same size, no shame copy.**

Anatomy for this audience (the anti-dark-pattern paywall, which here is
also the highest-converting paywall):

1. The athlete's OWN generated program visible behind/above the sheet —
   they are buying what they can already see (the reveal IS the pitch).
2. Three prices, all visible, annual pre-selected, monthly and lifetime one
   tap away. No hidden tiers, no "most popular" theater beyond the one
   default.
3. Trial terms in plain words next to the button: "14 days free, then
   $79.99/year. Cancel anytime in your App Store settings." (Also the
   legal report's auto-renewal disclosure requirement — one string serves
   both.)
4. The founding-member intro shown as what it is: "First year $59.99,
   founding price, ends [date]" — a real deadline, never a fake countdown.
5. Restore purchases link, terms/privacy links (App Review checks), and
   the free-tier line item list so the boundary is explicit.
6. Copy follows `docs/hidden-ui.md` voice: state facts, no pep talk, no em
   dashes, both catalogs. The paywall is athlete-facing copy like any
   other.

What we never do: preselected add-ons, price-per-day framing ("only
$0.22/day"), fake discounts, exit-intent begging, hiding the monthly
option, or a second paywall after purchase. Each is a conversion trick
that trades against ratings — and ratings are the compounding asset (ASO
report).

## 5. Offline entitlements (the gym problem, specific to us)

The product's premise is "works in a basement gym with no signal." Naive
billing checks break that: entitlement lookups must never block a workout.

- Entitlement state is **cached on device** (additively, via the R1
  storage adapter) with a timestamp; the app trusts the cache for a
  **7-day offline grace window** past expiry before degrading. A lapsed
  subscriber trains today's session; the free-tier degrade happens at home
  on wifi, never mid-set.
- All billing UI (paywall, restore, manage) requires connectivity and says
  so plainly when absent; prescription rendering never does.
- RevenueCat's SDK caches entitlements natively already; M3 wraps it so
  the web target and tests use a stub with the same interface.

## 6. Pricing operations (mechanics of the ruled prices)

- **Configure once, localized everywhere:** pick the nearest store price
  points for $12.99/$79.99/$249 in USD, then review the auto-derived
  prices for the ES/LatAm markets against the marketing report's
  localization lever (stores allow per-country overrides; set MX/AR/CO/CL
  deliberately rather than accepting FX math — this is the +62.3% LTV
  experiment's mechanical half).
- **Small Business Program is an application, not a default.** Enroll
  before launch (owner task); it is the difference between netting 85% and
  70% on every transaction from day one.
- **Lifetime ($249) operational notes:** non-consumable, so it must be
  restorable across devices (RevenueCat handles it under the same `coach`
  entitlement); cap its visibility (a settings/paywall footnote, not a
  hero option) consistent with the ~10%-of-revenue ceiling in the ruling.
- **The price-raise path (decided now, exercised later):** never repriced
  in place. A future raise = new products at the new price for NEW
  cohorts, existing subscribers grandfathered untouched. This is the
  no-backlash mechanism the marketing report's Fitbod lesson demands, and
  it is only painless if the app resolves entitlements (not product ids)
  everywhere — which M1 guarantees.
- **Win-backs (post-launch, staged):** churned-monthly win-back over
  commission-free web checkout is the ruling; operationally that is a
  Stripe + RevenueCat web-billing integration and belongs to the win-back
  phase, not v1.0 (M8 stubs the seam). iOS-native win-back offers (the
  stores' own discounted-reoffer mechanism) are configured in the console
  when the time comes — no code.

## 7. Testing, metrics, and the experiment discipline

- **Sandbox before anything:** StoreKit configuration files let the whole
  purchase/trial/expiry lifecycle run in minutes-long accelerated time on
  the simulator with zero store setup; Play has license-tester accounts.
  Every M-item lands with a sandbox test script, and trial expiry (§3) is
  rehearsed in sandbox before the September beta. TestFlight uses sandbox
  billing automatically (testers never get charged — tell them so).
- **The dashboard is RevenueCat's, the gates are ours.** The pre-committed
  gates from the marketing plan map to: trial-start rate (of paywall
  views), **trial-to-paid ≥ 40%**, **month-1 cancel < 35%**, refund rate
  (watch vs the category's hard-paywall +70% pathology — ours should sit
  well under with §3-§4 in place), involuntary-churn share (grace period
  working?), realized LTV vs the ~$85-110 model.
- **One experiment at a time, 200-500 conversions per variant** (the
  ruling's discipline). At early volume that means the first real A/B
  (annual price $79.99 vs $99.99 on new cohorts) is likely a month-6+
  event; before that, changes ship as sequential cohort comparisons, not
  parallel tests. Resist the dashboard's invitation to run five tests on
  thirty conversions.
- **Analytics events** stay minimal and local-respecting (the analytics
  persona, call sheet #4, owns the schema): `paywall_view` (with source:
  reveal/feature-tap), `trial_start`, and purchase states come from
  RevenueCat webhooks — no duplicate client tracking.

## 8. Owner tasks (human, ordered)

1. **Approve the free/coach boundary** (§2) including the four gray-zone
   calls — this list becomes product law and marketing copy.
2. **Approve the trial-expiry behavior** (§3) — it is a brand decision as
   much as a billing one.
3. App Store Connect: accept Paid Apps agreement, tax + banking forms;
   **apply to the Small Business Program**; create the subscription group,
   both subscriptions, the 14-day trial + $59.99 intro offers, and the
   lifetime non-consumable — with ASO-aware display names ("Coach Plan",
   per the ASO report's E5). Mirror in Play Console.
4. Set the founding-intro END DATE (the paywall shows it; it must be
   real).
5. Review localized price points for the priority ES/LatAm markets.
6. Create the RevenueCat account/project (free tier) and connect both
   stores.
7. Decide the refund stance for support macros (call sheet #6 will build
   them): we never argue with Apple's decision; we DO ask "what broke" in
   the cancel survey.

## 9. Engineer handoff (M1-M8, in dependency order)

House rules: additive state backfilled in `migrateState`, strings in both
catalogs, no em dashes, golden master untouched, engine stays
billing-blind (§2's purity rule), new top-level functions through the
harness shims, every slice sandbox-tested. M1-M2 are pure repo work,
startable now; M3+ ride the productization epic after R2 (the platform
adapter) exists.

- **M1. Entitlement seam.** `Platform.billing` on the R2 adapter exposing
  `hasCoach()`, `state()` (trial/active/grace/expired + expiry), and
  purchase/restore calls. Web/self-hosted implementation returns
  entitled-always (no billing surface at all), so the prototype, the
  owner's instance, and the entire test suite run unchanged. Feature
  gates check the seam, never product ids. Unit tests stub the seam both
  ways and assert the §2 boundary: every coach surface gated, every free
  surface reachable un-entitled.
- **M2. Degraded-mode design (trial expiry).** The §3 behavior:
  un-entitled program stops prescribing (workout view falls back to
  free-logger rendering of the day's exercises without targets), history/
  export untouched, one dashboard line to re-subscribe, resume re-
  prescribes from stored state on re-entitlement. This is mostly a
  rendering fork at `resolveDayEntries`/view level — NOT engine changes.
  Render-smoke tests cover entitled + degraded for both tracks.

  **AMENDMENT (2026-07-16, post-review; supersedes the mechanism above.)**
  An owner review caught this report assuming a free logger that does not
  exist in the codebase. Today `app.js` bounces every view to onboarding
  when no program exists (`if (!P()) return vOnboarding()`), all logging
  flows through `resolveDayEntries` (program slots resolved by the scheme
  registry — the coach), and `S.sessions` entries carry program
  coordinates (`b/w/d`). Only `S.records` (exercise-id keyed) is
  tier-neutral. So "falls back to free-logger rendering" described a
  surface with nothing under it: a never-subscribed free user had NO
  path at all, and a lapsed one had only a bespoke rendering fork.
  The standalone logger is now specified as **Epic L (L1-L5) in
  `docs/pending-future-work.md`**, which must land before M2/M4: M2's
  degradation is rebuilt on it per the §3 owner ruling (announce card,
  one cloned week of exercises, then empty weeks with manual logging),
  and M4's "continue with the free logger" path finally has somewhere
  real to land. L1-L3 are pure repo work with no billing dependency and
  improve the self-hosted prototype too.
- **M3. RevenueCat integration.** The native implementation of M1's seam:
  SDK init, entitlement `coach`, offline cache + the 7-day grace window
  (§5), restore purchases, purchase flows for all three products + intro
  offers. Sandbox test script committed alongside.
- **M4. The paywall surface.** §4's anatomy as a modal/view (identity
  system's tokens once P0 lands), wired to the onboarding reveal and the
  coach-feature touchpoints with a `source` param; "continue free" path
  always present; copy in both catalogs.
- **M5. Trial reminder.** Day-12 local notification through R5's
  notification plumbing + the settings day-counter. One string, both
  catalogs, scheduled at trial start and cancelled on conversion.
- **M6. Settings: subscription section.** Current state, manage/cancel
  deep link to the store's subscription settings, restore purchases, the
  free-vs-coach boundary list (the honesty table), links required by
  review (terms/privacy).
- **M7. Funnel events.** `paywall_view(source)` and `trial_start` through
  whatever the analytics persona lands; RevenueCat webhooks carry the
  rest. Do not build more client tracking than this.
- **M8. Web win-back seam (stub only at launch).** The M1 seam gets a
  third implementation slot (Stripe/RevenueCat web billing) left
  unimplemented behind a flag, so the win-back phase later is additive
  and the entitlement model never needs rework.

**The one-sentence version:** configure the ruled prices as store intro
offers rather than code, gate features behind one `coach` entitlement at
the UI seam while the engine stays billing-blind, cache entitlements so a
dead basement signal never blocks a set, tell the athlete two days before
their trial charges, let an expired trial degrade to a genuinely good free
logger with nothing held hostage, and let RevenueCat count the money while
the pre-committed gates decide what happens next.

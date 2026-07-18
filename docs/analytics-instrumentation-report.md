# IRONWAVE: Analytics and Instrumentation Report (event schema, gates, privacy)

Compiled 2026-07-18. Persona: analytics / instrumentation specialist for
consumer subscription apps, briefed on `docs/marketing-analysis.md` (v2 — the
binding GTM with its pre-committed kill/scale gates), `docs/monetization-
operations-report.md` (M7's funnel events and the RevenueCat ruling),
`docs/release-engineering-report.md` (the `platform.js` adapter this report's
client lands inside; R7's SDK-count doctrine), `docs/aso-launch-report.md`
(the weekly operating loop and E2/E3's local counters),
`docs/tier-usage-analysis.md` (decision receipts, the plateau card, the
free/coach surface map), `docs/legal-compliance-report.md` (consent before
init, health-data handling, privacy labels), and the code (`app/app.js`
session lifecycle, `TRACK_SPEC` in `app/data.js`, `S.records`/`S.sessions`).

**Consultation #4 of the launch call sheet** in `docs/pending-future-work.md`.

**Premise, per the owner's directive:** the PWA is the prototype; the product
is native iOS/Android store apps — free logger, paid coach — launching
October-equivalent. This report designs the measurement system for THAT
product, before launch, so the kill/scale gates are decidable with data
instead of vibes. It plans for changes, not validation: where the prior
plans left the gates unmeasurable or the product uninstrumentable, this
report says so and amends them (section 3 and 8). Sections 1-2 are the
education the owner asked for; 3-9 are the design; 10 is the owner list;
11 is the engineer handoff (AN1-AN6).

---

## 1. What app analytics actually is (the education)

Four different systems all get called "analytics." Confusing them is how
solo developers end up with five dashboards that disagree and no answers:

1. **Store consoles** (App Store Connect, Play Console): impressions,
   product-page views, installs, ratings, and (Play) vitals. This is the
   only place acquisition upstream of the install exists. You do not
   instrument it; you read it.
2. **Revenue analytics** (RevenueCat, already ruled in): trials, converts,
   renewals, cancels, refunds, MRR, realized LTV. The stores tell
   RevenueCat what happened via server notifications; the app is not in
   the loop. Anything money-shaped that you also count client-side WILL
   disagree with it (offline queues, refunds you never see) — which is why
   the monetization report's M7 forbids duplicate client tracking of
   purchases, a rule this report keeps.
3. **Product analytics** (the gap this report fills): what people DO in
   the app — funnels (onboarding step 3 loses 40%), retention cohorts (of
   July's installs, how many logged a session in week 4), feature usage
   (does anyone open the volume dashboard). This is event data the app
   must emit deliberately. Nothing in the current plan collects it, and
   without it three of the four pre-committed gates cannot be evaluated
   (section 3).
4. **Crash/stability** (Sentry, ruled in R7): not behavioral data; never
   mix the two streams.

**The one-source-of-truth rule (binding):** every question has exactly one
system that answers it. Installs and ratings: store consoles. Money and
trial states: RevenueCat. Behavior and retention: product analytics.
Stability: Sentry. The numbers overlap and will never reconcile exactly —
different clocks, queues, and definitions. Do not spend hours reconciling
them; assign ownership and move on. A "sessions" count from PostHog and a
"sessions" count you infer from RevenueCat activity are different facts.

**What events are:** a name plus a small property bag, emitted at a moment
("`session_finished`, sets: 24, duration_min: 62, had_pr: true"), queued on
device, batched to a server, aggregated into funnels and cohorts. The
craft is almost entirely in choosing FEW events with STABLE names and
DISCIPLINED properties. An analytics setup fails by bloat (auto-capture
noise nobody trusts) far more often than by missing an event.

## 2. The stack ruling

**PostHog Cloud EU + RevenueCat webhooks + Sentry + the two store
consoles. Nothing else.**

- **PostHog** (already shortlisted by the marketing report) over
  Firebase/GA: EU data residency out of the box (the legal report's
  consent-and-GDPR posture gets mechanically easier), a free tier
  (~1M events/month) that this app will not exhaust for years at the
  planned scale, funnels + cohort retention + feature flags in one tool,
  a Capacitor-compatible JS SDK, and it is self-hostable later — aligned
  with the product's ownership ethos if the cloud ever chafes. Firebase
  is rejected: it drags in Google Analytics semantics, a larger
  privacy-manifest and data-sharing surface for zero additional value at
  our scale, and its retention tooling is weaker than its reputation.
- **No MMP at launch** (AppsFlyer, Adjust): an attribution platform is
  paid-acquisition machinery and the GTM runs organic/creator for at
  least two quarters. The marketing report already said "no MMP needed at
  zero paid spend"; this report extends it: when the gated paid tests
  start, **Apple Search Ads attribution + Play Install Referrer + per-
  channel promo/offer codes are sufficient** for the $30 cost-per-trial
  gate at test scale. A full MMP is a >$10K/mo-spend problem.
- **Amending R7's SDK doctrine** (release report: "keep total third-party
  SDK count at exactly this one" — Sentry). That line was written before
  the analytics consultation existed; measurement earns the second slot.
  The ceiling is now **exactly three shipped SDKs: Sentry, PostHog,
  RevenueCat** — each with a privacy manifest, each behind an adapter
  face, and the ceiling is a rule, not a starting point. Anything else
  (attribution, A/B vendors, heatmaps, "engagement platforms") needs a
  consultation-grade reason.
- **Auto-capture and session replay: OFF, permanently.** PostHog's
  auto-capture would harvest every DOM click in a vanilla-JS app — an
  unbounded, meaningless, privacy-hostile stream that also swallows the
  free tier. Replay is radioactive for a fitness app (bodyweight, injury
  notes on screen). Explicit events from a closed catalog only (§5).

## 3. The gates, audited (where I challenge the plan)

The marketing report pre-committed kill/scale gates — the right discipline.
But as written, most are not measurable with anything currently planned,
and one whole dimension is missing. The audit:

| Gate (as ruled) | Measurable today? | Fix |
|---|---|---|
| M6: ≥ 1,000 free weekly actives | **No.** M7's two events (`paywall_view`, `trial_start`) cannot count actives; "weekly active" is undefined | AN3 lifecycle events + the §7 definition: a weekly active is an identity that **logged ≥ 1 working set** in the trailing 7 days. Opens ≠ active; a lifter who opens to browse history is not the flywheel |
| M6: rating ≥ 4.5 | Yes (store consoles) | Add prompt-yield instrumentation (`review_prompt_attempted`, riding ASO E2's `S.review` state) so a weak rating count is diagnosable: too few prompts vs prompts that do not convert |
| M9: cost-per-trial ≤ $30 | **No.** Cost needs spend-per-channel attribution; no MMP is planned | §2's ruling: ASA attribution + Play referrer + offer codes at test scale. Until a paid test runs, the gate is vacuously green — say so on the scoreboard rather than displaying a fake number |
| M9: trial-to-paid ≥ 40% | Yes (RevenueCat) | Keep. But add the *leading* indicator: §4's receipt-exposure metric, readable at day 7 of a trial instead of day 14+ |
| M9: month-1 cancel < 35% | Yes (RevenueCat) | Keep |
| M12: MRR ≥ $2K | Yes (RevenueCat) | Keep |

**The missing dimension: there is no retention gate.** The marketing
report's own §11 leads with "retention beats acquisition," then commits
gates only on acquisition and monetization. A free tier can hit 1,000
weekly actives while quietly churning 90% of every cohort by week 4 — the
flywheel (ratings velocity, share cards) would be spinning on sand and no
gate would catch it. **Proposed amendments (owner ratification, §10):**

- **Month-6 addition:** free-cohort **week-4 retention ≥ 20%** (identity
  logged ≥ 1 set in days 22-28 after first session). Category D30 medians
  for fitness sit around 5-10%; a tool people log training in should
  beat the category or the "genuinely good logger" premise is failing.
- **Month-9 addition:** coach-cohort **week-5 arrival ≥ 60%** — of
  subscribers who started a program, the share still logging in week 5,
  i.e. they met their first coached deload. The marketing report calls
  onboarding-to-week-5 "worth more than any campaign"; this makes that
  sentence a number.

These are planning bands like the revenue scenarios — set them, then
recalibrate against the September beta cohort before they become
kill-grade.

## 4. Instrument the hypothesis, not just the funnel

The tier analysis rests the entire monetization design on one causal
claim: **visible decision receipts (T1) are what make the trial convert.**
That is a testable hypothesis, and the trial window is where it gets
tested. If T1 ships without countable receipts, the September beta and
the launch cohort both burn without ever measuring the one thing the
paywall depends on. Coordination requirement (binding on T1, absorbed
into AN3):

- Every receipt surfaced carries a `kind` (wm_change, volume_adjust,
  deload, injury_ease, progression) and increments a per-week counter.
- `week_advanced` reports `receipts_shown` that week; `session_finished`
  reports `receipts_shown` that session (counts only — never the content,
  never the numbers inside them, per §6).
- The read: trialists bucketed by receipts seen in days 0-7 vs their
  trial→paid outcome. If exposure does not separate converts from
  non-converts, the paywall pitch needs rework BEFORE scaling spend —
  that is exactly the kind of decision the gates exist to force.

Same pattern for the free tier's one sales moment: `plateau_card_shown /
dismissed / tapped` (T2) and `lock_view(surface)` (the tier map's lock
cards) tell us which locked surface actually pulls upgrades — data the
M4 paywall's contextual placement should then follow.

## 5. The event schema (the deliverable)

A **closed, versioned catalog** — the client refuses unknown event names
(dev assertion + a unit test that walks the catalog), renames are new
events, and removed events are tombstoned in the catalog file, never
reused. Target: **under 25 events, forever.** Every event carries the
schema version and the app version; nothing else is implicit.

**Client events (PostHog), by lifecycle:**

| Event | Key properties | Why it exists |
|---|---|---|
| `first_open` | — | cohort anchor (install-adjacent) |
| `onboarding_step_completed` | `step` (TRACK_SPEC obSteps id), `track` | THE funnel; steps are already declared data (I2), so the instrumentation cannot drift from the flow |
| `onboarding_abandoned` | `last_step`, `track` | where the quiz leaks |
| `reveal_viewed` | `track` | the pitch moment (marketing: ~50% of day-0 conversions) |
| `paywall_view` | `source` (reveal / lock_surface / plateau_card / settings) | M7, unchanged |
| `paywall_outcome` | `choice` (trial_cta / continue_free / dismissed) | the honest-paywall health check: continue-free must be a real path, and this proves people use it |
| `program_generated` | `track`, `days_per_week`, `macro_weeks` | coach activation |
| `routine_created` | `source` (manual / template) | free activation (L2) |
| `session_started` | `mode` (program / routine / empty) | engagement numerator |
| `session_finished` | `mode`, `sets`, `duration_min`, `had_pr`, `receipts_shown`, `finisher_used` | the workhorse; `finishSession()` in app.js is already a deterministic end moment |
| `session_abandoned` | `sets_logged` | drafts that die; a spike here is a UX bug alarm |
| `week_advanced` | `week_type`, `receipts_shown` | §4's leading indicator |
| `block_completed` | `block_type` | ratings moment (E2) + report-card moment (T3) |
| `checkin_completed` | — (no answers, ever) | habit signal; collection is free-tier per the boundary |
| `pr_logged` | `kind` (e1rm / rep) | share + ratings moments; no lift, no numbers |
| `share_card_created` | `surface` | the Hevy-loop counter |
| `review_prompt_attempted` | `trigger` | prompt-yield estimation (ASO §7) |
| `plateau_card_shown / dismissed / tapped` | — | T2's honesty budget |
| `lock_view` | `surface` | which coach door free users knock on |
| `export_data` | `kind` | the trust feature; also a churn tell |

**Server-side (RevenueCat → PostHog integration, no client code):**
trial started/converted/cancelled, renewal, refund, reactivation.
Purchases are never client-tracked (M7's rule, kept).

**Explicitly NOT tracked:** per-set logging events (`donePerf` fires
dozens of times a session — counts ride on `session_finished` instead),
screen views (funnels above cover the decisions; screen-view noise is
how free tiers die), anything from `engine.js` (the engine stays
analytics-blind exactly as it stays billing-blind), and the entire web/
self-hosted prototype (§6).

## 6. Privacy architecture (binding rules)

The legal report's clean-slate finding is an asset this design preserves:

1. **The prototype ships zero analytics, forever.** `Platform.analytics`
   is a permanent no-op on the web/self-hosted target — the prototype,
   the owner's instance, and the test suite never phone home. Analytics
   exists only in store builds. (Same pattern as billing's M1.)
2. **Consent before init** (legal: ePrivacy covers SDKs, reject as
   prominent as accept). The SDK does not initialize — not "initializes
   and buffers" — until opt-in. Consent state lives in device-scoped
   storage (the TB4 pattern), never in `S`, never in exports. Declining
   costs the athlete nothing and the app says so plainly.
3. **The health-data exclusion rule:** event properties never carry
   training or body content — no weights, no e1RMs, no bodyweight, no
   soreness/readiness answers, no injury flags, no phase (cut/minicut is
   dieting information), no per-lift identities on PR events, no
   HealthKit anything (Apple 5.1.3 bans it from analytics outright).
   Counts, durations, booleans, and enum names of app surfaces only.
   Washington's MHMDA and GDPR Art. 9 both reach "fitness-adjacent"
   inference; the cheapest compliance is data that cannot infer.
   Enforced mechanically: AN6 adds a catalog lint that fails CI on
   banned property keys.
4. **Identity is pseudonymous:** one random install ID (§7); no email,
   no name, no IP retention (PostHog's discard-IP setting on), no
   geolocation beyond the store country, no cross-app anything — which
   also keeps iOS ATT permanently out of the picture (legal already
   counts on this).
5. **Retention: 12 months** then drop; the gates read trailing quarters,
   not ancient history. Privacy labels declare "data not linked to you"
   for analytics — the design above is what makes that label true.

Call-sheet sequencing note: the privacy specialist (consultation #5)
should review THIS schema before the beta — their report inherits a
concrete artifact to audit instead of a hypothetical.

## 7. Identity: decide it now, or pay for it forever

The classic expensive mistake in subscription apps is three systems with
three IDs and no join. The ruling, cheap today and impossible to retrofit:

- At first native launch, mint one **random install ID** (UUID; no device
  fingerprint). It becomes, simultaneously: PostHog `distinct_id`,
  RevenueCat `appUserID`, and the Sentry user id. One identity, three
  planes — the trial funnel (RevenueCat) joins to behavior (PostHog)
  without either system knowing who the human is.
- When Supabase accounts land, **alias** the install ID to the account
  UID (both PostHog and RevenueCat support aliasing) so a phone upgrade
  does not fork the athlete into two cohorts. The account email itself
  never reaches analytics.
- **Definitions (the metrics dictionary, versioned with the schema):**
  *active* = logged ≥ 1 working set that day; *WAU* = active in trailing
  7 days; *activation* = first `session_finished` within 72h of
  `first_open`; *retained week N* = active in days 7N-7N+6 after first
  session; *coach week-5 arrival* per §3. Every dashboard uses these
  words with these meanings; a metric without a dictionary entry does
  not exist.

## 8. Instrumentation-readiness: what the product should change

Where measuring well requires the app to behave differently than today —
suggested as product changes, not analytics wishes:

1. **Onboarding emits per-step, or the funnel is a black box.** I2 made
   the step chain declarative (`TRACK_SPEC.obSteps`); AN3 keys step
   events off those ids so the funnel and the flow cannot drift apart.
   No new UI — but it makes `obSteps` ids a stable public contract:
   renaming a step id is now a breaking change, treat it like one.
2. **Free installs need a fast first set.** Activation (§7) is the
   72-hour first-session metric, and the current front door is a quiz.
   When L3's logger home lands, "Start a session" should be the primary
   action for a free install — the quiz stays reachable as the coach's
   front door (exactly Epic L's framing). If activation lags at beta,
   this CTA hierarchy is the first suspect, and we will have the step
   funnel to prove it.
3. **Abandoned sessions deserve a product answer, not just an event.**
   `V.draft` can die silently today (ephemeral view state). Instrument it
   (AN3) — and if the beta shows a real abandonment rate, add a
   resume-or-discard prompt when a stale draft is found. Strong-class
   loggers all have one; ours is a natural L1 polish.
4. **Receipts must be countable from birth** (§4). T1's acceptance
   criteria gain one line: every receipt increments the session/week
   counters with a `kind`. Zero extra UI; it is the difference between
   a design belief and a measured conversion driver.
5. **The week-boundary digest is the retention surface.** T1's digest +
   R5's local notifications are the natural weekly re-engagement moment
   ("your week, adjusted"). Instrument digest views from day one so the
   later notification decision (M5's sibling) is made on data, not
   dogma about push.

## 9. Dashboards and the operating loop

Four saved views, one scoreboard, merged into the ASO report's weekly
hour (one hour total, not two):

1. **Acquisition → activation:** store impressions → installs (consoles)
   next to `first_open` → onboarding funnel → activation (PostHog).
2. **Trial:** `reveal_viewed` → `paywall_view` → trial start → convert
   (RevenueCat), with the §4 receipt-exposure split.
3. **Retention:** weekly cohorts, free vs coach, with the two §3
   retention gates marked as lines.
4. **Gate scoreboard:** every pre-committed gate, its current value, its
   source of truth, and (for the not-yet-measurable ones) "not testable
   yet" spelled out — a gate silently showing n/a is how gates get
   ignored.

Discipline inherited from the siblings: **one experiment at a time,
200-500 conversions per variant** — PostHog's feature flags are for UI
experiments only; price tests live in store products (monetization §7);
and at beta scale nothing is an A/B, everything is a sequential cohort
comparison, labeled as such.

**The September beta is the instrumentation dress rehearsal.** The
TestFlight/Play-open cohort runs the full pipeline: consent flow, events
arriving, funnels computing, identity joining RevenueCat's sandbox
events, the banned-property lint green. The schema FREEZES at beta;
after that, changes are additive only. An analytics bug discovered at
launch week is a quarter of blind flying.

## 10. Owner tasks (human, ordered)

1. **Create the PostHog org** (Cloud EU region, free tier), one project
   ("production"); turn OFF auto-capture, session replay, and IP storage
   at the project level the day it exists. Add the API key to the build
   secrets, never the repo.
2. **Ratify the schema as law** (§5) and the health-data exclusion rule
   (§6.3) — like the tier map, it is cheaper as code review today than
   as a data-deletion request later.
3. **Ratify the gate amendments** (§3): the WAU definition, the two
   retention gates, and the attribution ruling (ASA + referrer + codes;
   no MMP).
4. **Hand this report to consultation #5** (privacy specialist) as their
   primary audit artifact; their consent-copy and labels work should
   reference the §6 rules by number.
5. **Wire RevenueCat → PostHog** (a console toggle) when the RevenueCat
   project exists (monetization owner task 6).
6. **Adopt the weekly hour:** the ASO loop (§7 there) plus the gate
   scoreboard, together, every week, starting at beta — the habit is the
   analytics stack; the tools are just where it looks.

## 11. Engineer notes (AN1-AN6, for the dev agents)

House rules apply: additive state backfilled in `migrateState` (though
almost nothing here touches `S` — deliberately), athlete-facing strings in
BOTH catalogs with no em dashes (consent copy is athlete-facing), golden
master untouched (nothing here reads or changes prescription), engine
stays analytics-blind, new top-level functions through the harness shims.
These slot into `docs/pending-future-work.md` as a derived branch; AN1 can
start now (pure adapter work), AN2-AN4 ride the productization epic
alongside R4-R7 and M3-M4.

- **AN1. Analytics adapter + event catalog (start with R2).**
  `Platform.analytics` face: `track(event, props)`, `identify(id)`,
  `alias(id)`, `optIn()/optOut()`, `enabled()`. Web/self-hosted: permanent
  no-op (§6.1). The closed catalog ships as a data module (event name →
  allowed props + types); `track()` validates against it and throws in
  dev/tests on unknown events or props. Unit tests walk the catalog; a
  lint-style test fails on banned property keys (`weight`, `kg`, `bw`,
  `e1rm`, `soreness`, `readiness`, `injury`, `phase`, exercise-id-shaped
  values) anywhere in track() call sites — §6.3 made mechanical.
- **AN2. Consent gate (with the legal R7 stack, before beta).** Opt-in
  screen before any SDK init for EU (reject equal prominence), a Settings
  toggle to revoke, device-scoped persistence (TB4 pattern — never in
  `S`, ignored by import/export). No PostHog code loads pre-consent.
- **AN3. Lifecycle + funnel instrumentation.** The §5 client events:
  onboarding steps keyed by `TRACK_SPEC.obSteps` ids (I2 synergy),
  reveal/paywall/outcome (absorbs and supersedes M7's client half),
  session lifecycle on `finishSession()`/draft discard, `week_advanced` +
  receipt counters (coordinate with T1 — its acceptance criteria now
  include countable receipts, §8.4), lock/plateau events (tier T2),
  `review_prompt_attempted` reading ASO E2's `S.review`, share-card hook
  (E7). Each call site is one line against the AN1 face; no logic forks.
- **AN4. Identity join.** Mint + persist the install ID (device-scoped,
  not in `S`), feed it to PostHog, RevenueCat (`appUserID` at M3), and
  Sentry (R7); alias on Supabase account creation. One helper, one test.
- **AN5. Metrics dictionary + dashboards.** `docs/metrics-dictionary.md`
  versioned with the catalog (§7 definitions, gate formulas, source of
  truth per metric); PostHog saved views per §9 (config work, documented
  as a runbook so they are reproducible on a self-hosted PostHog later).
- **AN6. Beta dress-rehearsal checklist (rides R9).** Pre-beta assertions:
  consent flow blocks init, events arrive under the install ID, RevenueCat
  sandbox events join in PostHog, banned-property lint green against the
  packaged build, schema version stamped. Freeze the schema at beta;
  additive-only after.

**The one-sentence version:** give the app one closed catalog of under 25
deliberately chosen events behind a consent-gated adapter that the
prototype never runs, join behavior to money through one pseudonymous ID,
define every metric once in a dictionary, add the retention gates the
plan forgot, count the decision receipts because the whole paywall is a
bet on them, and read it all in one honest hour a week.

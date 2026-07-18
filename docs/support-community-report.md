# IRONWAVE: Support and Community Report (channels, macros, cadence)

Compiled 2026-07-18. Persona: support / community manager for solo-founder
consumer subscription apps, briefed on `docs/aso-launch-report.md` (review
responses feed ASO; reviews-as-roadmap), `docs/monetization-operations-
report.md` (refund stance, the cancel question, trial-expiry behavior),
`docs/marketing-analysis.md` (community load was flagged as a founder time
commitment; the September beta and founding cohort), `docs/release-
engineering-report.md` (the 12-tester Play gate, phased rollouts, the 48h
hotfix lane), `docs/privacy-data-protection-report.md` (PD6, the redacted
diagnostic export, is this report's tooling baseline; support email
retention is ruled there), `docs/tier-usage-analysis.md` (the free/coach
boundary generates the "why is X paid" ticket class), and
`docs/legal-compliance-report.md` (Domain G: support replies are
health-claims surface).

**Consultation #6 of the launch call sheet** in `docs/pending-future-work.md`
— the last launch-critical operator.

**Premise, per the owner's directive:** the PWA is the prototype; the
product is native iOS/Android store apps — free logger, paid coach. Support
for that product starts at the SEPTEMBER BETA, not at launch: the beta
cohort is the first support load and the rehearsal. This report plans for
changes: where the app has no support surface (it has none today) and where
prior plans assumed operations a solo founder cannot sustain, it amends
them (section 9). Sections 1-2 are the education; 3-8 the operating
design; 9 the challenge ledger; 10-11 owner tasks and the engineer
handoff (CS1-CS4).

---

## 1. What solo-founder support actually is (the education)

Support at this scale is not a department; it is a **retention and
ratings mechanism run in two batched windows a day**. Facts that shape
everything below:

- **Support is the other half of ASO.** A responded 2-star review that
  becomes an edited 4-star is worth more than a new 5-star (the ASO
  report's math); review responses are public marketing copy read by
  hundreds of prospects per writer. The ~30 min/week the ASO report
  budgeted for review responses lives inside THIS report's cadence.
- **Deflection beats speed.** The cheapest ticket is the one the product
  answered first. Most of the deflection machinery is already planned by
  the other operators, and this report claims it explicitly: the day-12
  trial reminder kills "surprise charge" tickets (M5); honest lapse
  detachment with a card kills "where did my program go" (L4); decision
  receipts kill "why did my weights change" (T1) — **every receipt is a
  pre-answered ticket**; sync (PD4) kills "I lost my phone, where is my
  log", today's most damaging 1-star class.
- **Volume forecast (planning bands, from category norms at this scale):**
  low hundreds of installs/month organic → roughly 1-3 emails/day and a
  handful of reviews/week by month 3; beta ≈ 20-50 people generating a
  burst in week one, then quiet. This is batchable by one person IF the
  channels are few and the macros exist. It stops being batchable if a
  public community channel is opened prematurely (§3).
- **Support tone is product tone.** The house voice (state facts, no pep
  talk, no em dashes in athlete-facing strings) applies to macros,
  review replies, and FAQ copy — they are athlete-facing strings like
  any other, and the ES catalog commitment extends to them (§6).

## 2. Channel architecture (few, deliberate, in this order)

1. **In-app Help & Support (CS1 — does not exist today, must).** A More
   hub screen: a short bundled FAQ (offline, both catalogs), a contact
   action that composes an email with the PD6 redacted diagnostic and
   app/platform version pre-attached, links to policy/terms, and the
   subscription-management deep link (shared with M6). The contact flow
   states the honest expectation: "One-person team. Replies within 1-2
   business days." Setting the expectation IS the SLA strategy — this
   audience rewards honesty and punishes silence, not slowness.
2. **Email (`support@` on the product domain).** The one inbox; every
   other channel funnels here or to the tracker. No live chat, no
   chatbot, no ticket portal — tooling that assumes a team creates
   promises a solo founder breaks.
3. **Store reviews.** Respond to every 1-3 star review and to 4-5 star
   reviews that ask something, within the twice-weekly review window.
   Never defensive, never boilerplate-only, always name the fix version
   when one shipped ("Fixed in 1.3 — update and it should behave").
4. **Beta channels (September):** TestFlight's built-in feedback for
   iOS; Play open testing has no feedback channel, so the CS1 contact
   flow must be IN the beta build (a reason CS1 rides productization,
   not post-launch polish). A small invite-only Discord for the beta
   cohort only (§9.1).
5. **Reddit/social:** founder-flair participation per the marketing
   plan's cadence — that is marketing; support only monitors for
   bug-shaped threads and routes them to the tracker.

## 3. Support boundaries (what support never does)

- **No coaching, no medical advice — the hard wall.** A training-app
  inbox reliably receives "should I train through this shoulder pain?"
  and "what should I eat on a cut?" Support answers app questions, not
  training questions. The deflection macro (§5, MED-1) restates the
  Domain G posture: not medical advice, see a professional, here is how
  the injury flag eases a lift. This is a liability rule, not a service
  gap — one helpful-sounding "just take it lighter for a week" email is
  a health claim with the founder's name on it. Program-content
  questions from future creator-partner programs route to the partner
  (the 20% affiliate buys that).
- **No privacy exceptions under pressure.** Support never asks for raw
  exports (PD6 exists precisely for this), never asks for passwords,
  and when athletes paste health details unsolicited (they will), the
  reply does not quote them back and the thread ages out on the ruled
  24-month deletion schedule.
- **No billing arguments.** Apple/Google decide IAP refunds; the macro
  points at the store flow, fast and without friction (monetization
  owner task 7 ruled the stance; the ~70%-refund-pathology data says
  fighting refunds farms 1-stars). We DO ask the one question — "what
  broke?" — because a refund with a reason is cheap research.
- **No retention theater.** Cancel/lapse flows get one optional
  micro-survey tap (CS2), never a plea, never a discount ladder. The
  win-back channel (M8) is marketing's, later, and stays out of
  support threads.

## 4. Cadence, SLAs, and triage (sized to one honest person)

- **Two batched windows/day (~30-45 min total), weekdays:** inbox to
  zero using macros; tracker updated. **Review window twice weekly**
  (the ASO 30 min). **Vacation mode:** an auto-reply with the expected
  date and the FAQ link — planned, not apologized for.
- **Severity ladder, aligned with the release report's hotfix lane:**
  - **P0 — athletes cannot train or data is being lost** (crash on
    open, state corruption, billing charging wrong): same-day response,
    hotfix lane target fix-live-in-48h, phased rollout halted if the
    build is the cause. Sentry (R7) should surface these before the
    first email does; if an email beats Sentry, that is itself a bug in
    the monitoring.
  - **P1 — a feature is broken with a workaround** (timer notification
    missing, sync conflict): next release train, macro names the
    workaround.
  - **P2 — confusion, polish, requests:** FAQ/macro answers; recurring
    themes graduate to the roadmap (§7).
- **Triage destination is the existing repo discipline:** bugs become
  issues with the diagnostic attached; the tracker is GitHub, not a
  parallel tool. One label set: `p0/p1/p2`, `beta`, `store-review`,
  `from-support`.

## 5. The macro library (the actual texts, voice-checked)

Written here so launch day is copy-paste, EN now, ES before beta.
Abbreviated bodies; full texts live with the FAQ strings when CS1 lands:

- **BILL-1 refund:** "Purchases and refunds are handled by Apple/Google
  directly, so we cannot issue it ourselves — here is the link and it
  usually takes minutes: [store link]. If something broke and pushed
  you there, tell us what — we fix by what we hear."
- **BILL-2 cancel:** the M6 deep-link path, stated without friction,
  plus the L4 truth: "Your log and history stay yours, free, forever."
- **BILL-3 restore:** store restore-purchases path (M1/M3), one
  paragraph.
- **DATA-1 device transfer/loss:** sync explanation (or, pre-PD4, the
  export/import path), plus "your data never leaves the device unless
  you turn sync on."
- **LAPSE-1 "where did my program go":** the detachment design in plain
  words — cloned week, then manual logging, coach resumes intact on
  re-subscribe.
- **TIER-1 "why is X paid":** the honest boundary line from the tier
  analysis — logging is free forever, judgment is the product — plus
  what the free tier keeps. Never apologize for the paywall; explain it.
- **MED-1 pain/injury/medical (the wall):** "We cannot advise on pain
  or injury — that needs a professional who can see you. The app's
  injury flag can ease a flagged lift's prescriptions in the meantime.
  Please do not train through pain on our say-so; we will never give
  that say-so."
- **COACH-1 training questions:** the app's own explanation surfaces
  (receipts, the volume screen, exercise detail) plus "we do not give
  individual coaching by email — the coach in the app IS our answer,
  and it knows your data; we do not."
- **BUG-1 report intake:** thanks + the two questions (what did you
  expect / what happened) + "the Help screen's Contact button attaches
  the diagnostic that helps us reproduce it."
- **REV-N review-reply skeletons:** 1-2 star (acknowledge, one
  sentence of substance, invite to email, name the fix version when
  real); 3-star feature-ask (roadmap honesty: on it / not planned and
  why); 5-star question (answer, thank, no marketing fluff).

## 6. Spanish support is a launch commitment, not a nice-to-have

The app ships ES, the ASO plan builds an ES listing, so ES reviews and
emails WILL arrive. Rulings: every macro and FAQ string exists in both
languages (the i18n completeness test already enforces catalogs; macros
ride the same rule via CS1); review replies match the review's language;
machine translation polished by the owner is acceptable, silence is not.
If ES volume ever exceeds the founder's capacity, that is the trigger
for the first support contractor — a scale milestone, noted, not
planned.

## 7. Reviews-as-roadmap (closing the loop)

The ASO report ruled reviews get tagged and recurring themes feed
`docs/pending-future-work.md` exactly like the athlete-feedback
simulation did. This report operationalizes it: the weekly hour (ASO §7
+ the gate scoreboard) ends with five minutes of tally — any theme with
3+ independent mentions in a month gets a line in the future-work doc
with a `[from-support]` tag and the count. That threshold keeps the
roadmap owner-driven with user evidence, instead of last-loudest-voice
driven. The same tally covers the CS2 churn reasons and refund "what
broke" answers — three streams, one habit.

## 8. Beta-cohort management (September, the rehearsal)

- **Recruiting:** the release report's owner task (12+ Play testers)
  plus TestFlight invites from the waitlist (marketing Phase 0's
  landing page). Target 20-50; more is load, not signal, at this stage.
- **Structure:** a one-page beta brief (what works, what to hammer on,
  how to report, the sandbox-billing truth from the monetization report
  — "you will not be charged, trial flows are fake-time"), the
  invite-only Discord for the cohort, a weekly digest post from the
  owner (what changed, what is next — the same content as the release
  notes draft, written once).
- **What the beta must exercise for support's sake:** the CS1 contact
  flow end-to-end (diagnostic arrives, readable), the FAQ's top
  answers, the L4 lapse flow in sandbox (support macros LAPSE-1/BILL-2
  get rehearsed against real confusion), and the consent screens'
  comprehension (PD3 — if beta testers ask what the analytics toggle
  does, the copy failed; that is a finding, not a ticket).
- **Advocate conversion:** beta testers who stuck get first crack at
  the founding-member intro at launch (marketing's $59.99 year) and a
  personal thank-you — the first hundred advocates are hand-made. Beta
  reviews do not transfer to the store (ASO reality), so launch week
  includes one direct, quota-respecting ask to the cohort through the
  normal in-app prompt flow, never a link blast.

## 9. The challenge ledger (what this report changes in the plans)

1. **Public Discord at launch: NO** (amends the marketing report's item
   12 and this consultation's own call-sheet remit). A public server
   run by one person while shipping is a dead server, and a dead server
   is public anti-marketing. The beta cohort gets an invite-only
   server; a public community opens when the month-6 gate passes
   (1,000+ weekly actives) or when a genuine volunteer moderator
   emerges from the cohort. Until then, Reddit presence + review
   responses ARE the community program.
2. **Support starts at beta, not launch** — the September cohort is
   real load and the rehearsal; CS1 must be in the beta build, which
   moves it from "polish" to the productization epic.
3. **The app has no help surface at all today** — CS1 creates it. An
   offline FAQ is also the deflection layer the whole cadence depends
   on.
4. **The cancel survey becomes a product micro-survey** (CS2): the
   monetization report wanted "what broke" asked at cancel, but store
   cancellation happens outside the app where we cannot ask. The
   honest place is the L4 detachment card — one optional tap, enum
   reasons, skippable, once. Free-text is deliberately excluded
   (privacy: people paste health details into text boxes).
5. **Two analytics events added pre-beta** (CS3, additive to the AN
   catalog before its freeze): `support_opened(topic)` — measures
   deflection (FAQ views vs contact taps) — and `churn_reason(reason)`
   from CS2. Both content-free enums; the closed-catalog discipline
   holds.
6. **Receipts are support infrastructure** (T1 synergy made explicit):
   the single largest predicted coach-tier ticket class ("why did my
   numbers change") is answered in-product by T1. Support's macro
   COACH-1 points at receipts — one more reason T1 lands before beta.
7. **SLA honesty over SLA theater:** published expectation "1-2
   business days, one-person team" beats a pretended 24/7. The
   ownership-ethos audience respects it; it is also simply true.

## 10. Owner tasks (human, ordered)

1. **Create `support@`** on the product domain (with the Phase 0
   landing page); set up forwarding + the two-window habit. Add
   App Store Connect / Play Console review notifications so reviews
   reach the same inbox.
2. **Approve the macro voice** (§5) and the support boundaries (§3) —
   MED-1 especially is a legal posture, review it against Domain G
   with the attorney pass.
3. **Decide the Discord timing rule** (§9.1) — ratify beta-only now,
   public at the month-6 gate.
4. **Recruit the beta cohort** (merges the release report's 12-tester
   task): waitlist + friends + gym contacts, target 20-50, invite-only
   Discord created at beta start.
5. **Write the beta brief** (one page, §8) when the beta build exists.
6. **Adopt the tally habit** (§7): the weekly hour ends with the
   support/review/churn theme count; 3+ mentions in a month = a
   `[from-support]` roadmap line.
7. **Plan the vacation auto-reply** before it is needed.

## 11. Engineer handoff (CS1-CS4, in dependency order)

House rules apply: athlete-facing strings in BOTH catalogs with no em
dashes, additive state backfilled in `migrateState`, golden master
untouched (nothing here touches prescription), new top-level functions
through the harness shims, tests per slice. CS1 rides the
productization epic and must be in the September beta build; CS2 rides
Epic L's L4; CS3 is a small pre-beta addition to the AN catalog; CS4
rides R9.

- **CS1. Help & Support surface (in the beta build).** A More hub
  screen: bundled FAQ (short, both catalogs — top answers: what is
  free vs coach, cancel/refund paths, device transfer, lapse behavior,
  injury-flag pointer, contact expectations), a Contact action that
  composes email to `support@` with the PD6 redacted diagnostic and
  app/platform/version prefilled (mailto on web target;
  `Platform.share`/native mail composer via the R2 adapter on native),
  the honest SLA line, links to policy and M6's subscription
  management. Render-smoke covers the view in free and coach modes.
- **CS2. Churn micro-survey on the detachment card (with L4).** One
  optional, skippable tap on the lapse card: enum reasons (price /
  not using it / missing feature / switching apps / temporary break),
  no free text, shown once per lapse (`S.flags` timestamp, additive +
  migrated). Emits `churn_reason` via the AN1 face (no-op on
  web/self-hosted as always).
- **CS3. AN catalog additions (before the beta schema freeze).**
  `support_opened(topic: faq | contact | policy | subscription)` fired
  from CS1, and `churn_reason(reason)` from CS2 — both added to the
  closed catalog with the banned-property lint untouched. The
  deflection metric (FAQ opens vs contact taps) joins the AN5 metrics
  dictionary.
- **CS4. Release-notes + known-issues discipline (rides R9).** The R9
  pre-submission checklist gains two lines: store "what's new" written
  in the house voice in EN + ES (it is support copy read at scale),
  and the FAQ reviewed against the release's changes (a stale FAQ
  answer is worse than none). No code; a checklist contract.

**The one-sentence version:** build the help screen before the helpers
are needed, answer every unhappy review like a human who ships, refund
fast and ask what broke, never coach and never diagnose from the inbox,
keep the community small until it can be real, and let receipts, honest
lapse copy, and the day-12 reminder delete the tickets before they are
written.

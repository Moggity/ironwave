# The paywall cynic: a churned RP subscriber pre-writes the reviews (launch consultation #9)

Date: 2026-07-18. Call sheet entry 9, the first of the adversaries worth
simulating. Run against v1.19.0 plus the full commercialization doc set:
`docs/marketing-analysis.md` (v2), `docs/monetization-operations-report.md`
(with the 2026-07-18 amendment), `docs/tier-usage-analysis.md`,
`docs/aso-launch-report.md` (with its amendment),
`docs/support-community-report.md`, `docs/legal-compliance-report.md`, and
`docs/privacy-data-protection-report.md`.

Method. Unlike panels #8 and #12, this persona cannot walk most of the
surface he is attacking: the paywall (M4), receipts (T1), the detachment
card (L4), and the store listing are specs, not code. That is the point.
The specs in those reports are binding copy an engineer will implement
close to verbatim, so this is the last consultation where the words can
be red-teamed before they become screenshots on Reddit. Where shipped
code exists it is cited and was checked directly: the L0 tier-preview
seam (`hasCoach()` at `app.js:281`, `coachLockHTML` at `app.js:289`, the
strings at `app/i18n/en.js:896-903`), and the seeded landmark grid
(`data.js:1404-1424`). Everything else is graded from the docs' own
quoted copy. The deliverable the call sheet asked for is literal: the
1-star reviews are drafted below, before a real one is.

Verdict in one line: the honesty machinery in this plan is real and
better than anything I churned from, and I would still get five reviews
out of it today; every one of the five is preventable, and four of the
five are copy, not code.

### The persona: "u/DeloadAndDeliver", 34, churned RP Hypertrophy subscriber

I paid Renaissance Periodization $24.99 a month on the perpetual promo
for 14 months. I churned over price and over template changes nobody
explained to me. I lift 4 days a week, I mod-adjacent on a powerbuilding
subreddit, and I have a screenshots folder: Fitbod's price hike, every
"free trial" that buried the rebill, every quiz funnel that dead-ended
at a card sheet. RP's Trustpilot is 2.8 and the top complaints are
pricing; I wrote one of them. I do not hate paying for software. I pay
for Boostcamp. I hate being played, and I check. I read the App Store
receipt fine print, I diff free tiers before and after updates, and
when an app claims a methodology I look for whose table it actually is.
You are pitching me a coach at $79.99 a year in a niche where I already
resent $25-35 a month. Convince me, or I will do what I do.

## What I cannot dunk on

Credit where due, because a cynic who only sneers is just noise. These
are the parts of the plan I tried to break and could not, and each one
pre-deletes a 1-star class I have personally written elsewhere.

- **Nothing held hostage, and it is specific.** On lapse the logger
  detaches: a card says so, the next week arrives as a clone of last
  week's exercises, every week after is empty manual logging, history
  and export untouched (monetization §3, owner ruling 2026-07-17;
  Epic L4). "Nothing is deleted, blurred, or held hostage." RP has no
  free tier at all. If this ships as written, the "my program is
  ransomed" review cannot be written about this app.
- **The day-12 reminder exists at all.** "Trial ends in 2 days.
  $79.99/yr after, or keep the free logger" (monetization §3). Most
  apps' trial strategy IS the surprise charge; the category's
  hard-paywall refund pathology (+70%) says so. Telling me before you
  bill me is the single highest-trust move available, and it is in the
  plan on purpose.
- **The banned-tricks list reads like my own posts.** No price-per-day
  framing, no fake countdowns, no fake was/now discounts, no preselected
  add-ons, no exit-intent begging, no hidden monthly, no second paywall
  after purchase, "Continue with the free logger" always visible at the
  same size with no shame copy (monetization §4). And it is auditable:
  `paywall_outcome(continue_free)` is a cataloged event, with the
  amendment's own words that a near-zero continue-free share means the
  rule "is failing in practice regardless of intent."
- **Refunds go to the store, no arguments.** "We never argue with
  Apple's decision; we DO ask 'what broke'" (support §3, BILL-1). No
  retention ladder, no plea, no discount begging on cancel. Correct.
- **Data export is loudly free, forever.** The free/coach boundary puts
  raw export, history, PRs, and e1RM trends permanently on the free
  side with the explicit note "this audience checks" (monetization §2).
  We do.
- **Price raises grandfather.** "Never repriced in place"; a future
  raise is new products for new cohorts (monetization §6). That is the
  exact anti-Fitbod mechanism, named as such.
- **The 7-day offline grace.** A lapsed check never degrades anyone
  mid-set in a basement gym (monetization §5). Nobody in this niche
  builds that; it is the kind of detail that makes me suspect actual
  lifters wrote the spec.
- **Someone already killed the over-claim.** "Data never leaves your
  phone" was proposed and REJECTED in-house as "not shippable copy"
  because analytics opt-in, Sentry, and sync exist; the approved line
  is "your training data stays on your phone unless you turn on sync"
  (ASO amendment, challenge 1). An org that edits its own pitch toward
  the weaker, truer claim before anyone outside made them is rare. I
  checked the caveats (opt-in PostHog, scrubbed Sentry, store billing
  metadata, OS device backups); the scoped line survives them.

## The five reviews I would still write

Each drafted exactly as it would appear, then why the current plan
still permits it, then the tag. This is the report's deliverable: these
reviews exist today in potential form. Delete them while they are still
drafts.

### Review 1 of 5

> ★ "Founding price" bait. The sheet said First year $59.99, founding
> price, ends Sept 30. Nowhere on that sheet did it say year two is
> $79.99. Found out from the renewal email. Cancelled, reported to the
> FTC portal, telling r/powerbuilding.

The monetization report's paywall anatomy (§4.4) requires the founding
offer to show "a real end date, never a fake countdown" — good — but
the spec as written stops there. The renewal price after the intro is
exactly the thing California's AB 2863 negative-option rules require
"clearly and conspicuously *before* consent, captured in the consent
record, and restated in the pre-renewal notice" (legal report §6). The
plain-terms rule ("14 days free, then $79.99/year. Cancel anytime in
your App Store settings.") covers the standard annual, not the intro.
One line closes it: the founding offer never renders without its
renewal price in the same visual unit, e.g. "First year $59.99, then
$79.99/yr. Founding price ends [date]." Same rule in the day-12
reminder if the trialist is on the intro, and M11's sandbox rehearsal
asserts it. **CYN1.**

### Review 2 of 5

> ★ Paid $249 LIFETIME. Switched to a Pixel. App says buy again.
> Support says "your purchase lives with your Apple ID." Then say that
> BEFORE you take $249, not after.

The monetization amendment already caught the mechanism ("what breaks"
1): with accounts optional, a $249 non-consumable does not restore
across stores until M10's cross-store bridge, so all purchase copy must
be store-scoped. But the fix is currently a copy note attached to a
launch-later slice. The exposure is at purchase time, at launch, on the
paywall and in M6: the lifetime line item itself must carry the scope
("Lifetime on this app store's account") from the first build that
sells it, in both catalogs, and the M6 subscription section repeats it.
Either that, or lifetime waits for M10. A $249 one-time purchase from a
no-track-record brand is already the hardest sell on the sheet; it
cannot also carry the plan's only silent asterisk. **CYN2.**

### Review 3 of 5

> ★ "We remind you before the trial ends." No you don't. I never
> allowed notifications (why would a logger need them), didn't open the
> app that week, got charged $79.99 on day 14. The "reminder" was a
> card inside the app I wasn't in.

The amendment is honest about this gap ("what breaks" 3): push is
best-effort because the notification permission is only ever requested
at first rest-timer use, and boot-time permission begging was rightly
rejected. So the guaranteed channel is in-app, which reaches only
athletes who open the app during the window. Residual risk is real:
trial-day-14 charges to someone who lost interest on day 5 is the
classic source of this review. Two cheap hardenings: (a) the final-72h
card renders on every entry surface (dashboard, logger home, session
summary), not one, with a device-scoped seen-marker so it is provably
shown-or-not; (b) an owner decision on the remainder — either accept
it (defensible: the store's own day-11 Apple email also fires) or add
one contextual permission ask at trial START framed as exactly one
future notification ("Want a heads-up 2 days before the trial ends?"),
which is not a boot-time beg and is the one notification this persona
would actually grant. **CYN3.**

### Review 4 of 5 (not a store review; worse)

> [r/powerbuilding, 400 upvotes] "IRONWAVE is RP's landmark table with
> the serial numbers filed off." I diffed the app's volume landmarks
> against the published RP grid. Chest MV 8 / MEV 10 / MRV 22... it's
> the same numbers. The source file literally says SOURCE: Renaissance
> Periodization. They're charging $79.99/yr for a table RP publishes
> for free.

This is the thread I would write, and today every word of it is true:
`data.js:1404` reads "SOURCE: Renaissance Periodization's" directly
above `VOLUME_LANDMARKS`, and the seeded values are the published RP
grid (acknowledged in the legal report as R6 and in the roadmap's
"Migrate off the seeded RP grid"). The landmark-seed migration branch
exists and has a full methodology (sports-science report §5, SS1,
including a divergence test against the old grid). What it does not
have is a deadline. The moment a public beta tester can read the
bundle — and R3's minification is not secrecy, the values are
inspectable regardless — the clone thread is writable, and it lands
on the exact audience segment (S2, "priced out of RP") the app courts
hardest. The migration, or at minimum the divergence of the shipped
values plus the comment scrub (legal-scrub covers the comment), must
land before the September beta, not "sometime before scale." This is
a sequencing challenge, so it goes to the owner ledger. **CYN4.**

### Review 5 of 5

> ★ "Generous free tier" = every second screen is a smug lock card.
> Program: locked. Volume: locked. Phase: locked. Meet day: locked.
> The card says what I can't have and nothing about what I keep. Hevy
> gives me unlimited logging free and never once talks down to me.

Today's shipped lock card is dev-facing and fine as such
(`coachLockHTML`, `app.js:289`; `tier.locked_note` at `en.js:902` even
references the Settings preview toggle, which TB5 hides in store
builds — so this exact string cannot ship as-is anyway). The
production lock surfaces (M4-era) have no copy spec yet beyond
"contextual paywall." The rule this persona needs: every locked
surface names what stays free in the same breath. The support report
already coined the line ("Your log and history stay yours, free,
forever", BILL-2); put it, or its short form, on the lock card
itself, both catalogs, and let L5's boundary checklist assert that no
locked surface renders without a free-tier line. Free-tier tone is
the entire Reddit defense; the lock card is where tone is actually
experienced. **CYN5.**

## The lifetime tier, cross-examined

The persona's next stop after the reviews, because "lifetime" is where
this community's anti-subscription reflex and its cynicism collide.

- **$249 against what?** Against Hevy's $74.99 lifetime it looks
  absurd; against the tier the app actually replaces — JuggernautAI at
  $349.99/yr, RP at $299.99/yr list — it is under one year of the
  incumbent, forever. The paywall never makes this argument (correctly:
  no competitor names on the sheet, and the keyword ban is absolute),
  but the anchoring must still happen structurally: lifetime renders
  as a footnote under the annual (monetization §6 already caps its
  visibility), never beside the monthly where the 19x multiple invites
  the screenshot. Placement is the argument. Ratified as specced; no
  change requested.
- **The multiple is defensible.** ~3.1x annual sits inside the 2.5-4x
  guidance band, and the ~10%-of-revenue cap plus footnote placement
  match. What is NOT yet defensible is selling it before the restore
  story is honest (CYN2 above).
- **"Lifetime of what?"** The one question this persona always asks
  and no doc answers: lifetime means the app's lifetime, and a
  one-person bootstrapped app has a real mortality rate (the marketing
  report's own base rates: 80%+ never pass $1K MRR). The honest
  hedge is not copy on the paywall (nobody writes "if we fold" on a
  price sheet); it is the already-free export and the local-first
  architecture, which mean a dead IRONWAVE still opens and still
  exports. That argument belongs in the FAQ (CS1) under the lifetime
  question, pre-written, so the first Reddit thread asking it gets
  answered with a link instead of a shrug. Folded into CYN5's copy
  pass? No — it is a support artifact: flagged to CS1 in the notes.
  **CYN6.**

## The trial framing, cross-examined

- **14 days is honest only if the coach visibly does something twice.**
  The whole trial design leans on T1 receipts firing at session one
  (first AMRAP receipt) and the week boundary. The 2026-07-18 re-pass
  already promoted T1 to a hard beta-entry gate, co-equal with Epic L:
  "no tester meets the paywall without receipts firing behind it."
  Ratified with enthusiasm; this persona's churn from RP was literally
  "silent template changes nobody explained."
- **The day-12 counter recap must never inflate.** "The coach made 9
  adjustments for you this week" is the best line on the sheet IF the
  number is a real AN3 counter and degrades to plain copy at low
  counts (both already specced). The failure mode is an engineer
  padding the count with trivia (every rounding step counted as a
  "decision") to make the recap impressive. Countable receipt = a T1
  receipt the athlete could have seen, nothing else; add the assertion
  to T1's tests when counters land. This persona diffs marketing
  numbers against UI, and "9 adjustments" backed by 3 visible receipts
  is a worse review than no recap at all. **CYN7.**
- **The trial needs no card up front, and the sheet already says
  cancellation lives in store settings.** Both fine. One nit the docs
  already own: the beta brief's "sandbox-billing truth" line must
  survive into every beta comm, because a beta tester who believes a
  fake-time trial charged them is a P0-shaped support fire.

## The Reddit funnel and the seeding optics

- **The quiz dead-end warning is internalized.** Marketing round 2's
  own words — pointing "the most paywall-cynical buyers in fitness"
  into a quiz that dead-ends at a paywall "farms 1-star 'scam quiz'
  reviews" — and the fix (Continue-free lands on L3's real logger
  home, Epic L blocks M4) is structural, not cosmetic. Ratified.
- **"A quarter of RP for the same job" stays in founder voice.** As an
  internal pricing frame and a founder-flair Reddit comment when asked
  directly, fine and true. On the store listing or in ads, a named
  comparison to a registered mark (Reg. 5495258) from an app whose
  data file still says "SOURCE: Renaissance Periodization" is an
  invitation to both the clone thread (CYN4) and a lawyer letter. The
  ASO keyword ban already covers metadata; extend the same discipline
  to ad creative and listing copy: comparative pricing without naming
  ("under a third of what the big coaching apps charge per year").
  Copy rule, not code. Rides the legal-scrub sweep's spirit; owner
  task below.
- **Beta cohort seeding must stay un-buyable.** The support plan gives
  sticky testers "first crack at the founding-member intro." Fine.
  But the same message thread must never also ask for a rating — the
  stores ban incentivized ratings, and this persona screenshots the
  DM where a discount and a review ask share a paragraph. One process
  rule: review prompts come only from the in-app E2 gate; no beta
  comm, thank-you, or discount message ever contains a rating ask.
  Process note, no code. **CYN8.**

## Cross-checks against shipped code

What a cynic could verify in the repo today, verified:

- `hasCoach()` (`app.js:281`) defaults entitled and the web/self-hosted
  build never gates; the prototype-enforces-nothing ruling (tier §9,
  Ruling A) is true in code. The briefly-added free-mode week-preview
  gate really was reverted.
- The free banner (`app.js:2693`, `tier.free_banner`) and lock cards
  gate exactly the surfaces the tier map names (My Program, Meet,
  Weekly volume, Phase, landmark band) and nothing in the logging loop.
  The free/coach boundary as shipped matches the honesty table's
  free column: logging, history, PRs, e1RM trends all reachable with
  `debugTier = 'free'`.
- `S.debugTier` is inside `S` — acceptable for the debug harness, and
  TB4/TB5 already commit the production entitlement cache to
  device-scoped storage with import ignoring entitlement-shaped
  fields. No change; noted so the persona's "I'll just edit the
  export" post has its answer pre-written (it works today by design,
  and stops working in store builds by design).
- The landmark seed (CYN4) is the one place shipped code contradicts
  the public posture. Nothing else in `data.js`/`engine.js` names a
  competitor in athlete-reachable strings; the remaining mentions are
  comments and the CHANGELOG, which the legal-scrub branch owns.

## Challenge ledger (owner decisions)

1. **Landmark migration timing** (CYN4): the derived-branch list
   sequences the seed migration as a legal item with no date. This
   report argues it gates the September BETA (first inspectable
   public build + the exact S2 audience), not just launch. Accepting
   this reorders the pre-beta work; the SS1 methodology is already
   written, so it is schedulable now.
2. **Day-12 residual gap** (CYN3): accept the in-app-card-only
   remainder (plus Apple's own receipt emails) or add the one
   contextual notification ask at trial start. Monetization rejected
   boot-time asks; a trial-start contextual ask is a different thing,
   but it is still a second permission prompt in the first minute of
   coach ownership. Genuine trade; owner call.
3. **Lifetime at launch vs after M10** (CYN2): sell lifetime from day
   one with store-scoped copy on the price line itself, or hold the
   tier off the paywall until the cross-store bridge exists. The ~10%
   revenue ceiling makes holding it cheaper than it sounds; the
   anti-subscription optics make having it worth real money. Owner
   call; this report only insists the silent version is not an option.
4. **CS2 survey timing** (existing open decision from the synergy
   re-pass): monetization proposed also offering the one-tap churn
   enum at cancelled-not-yet-expired in M6; support ruled card-only.
   This persona sides with monetization: at detachment, weeks after
   the cancel decision, I no longer remember or care why; at cancel I
   am one tap from telling you. Same cap (once per lapse), zero
   pleading. A data point for the open ruling, not a new challenge.
5. **Comparative copy discipline** (the "quarter of RP" line): ratify
   founder-voice-only for named competitor comparisons; listing and ad
   creative use unnamed framing. Cheap to decide now, expensive to
   walk back after a C&D or a clone thread quotes our own ad.

## Owner tasks

- [ ] Rule on challenge 1 (landmark seed diverged before the September
      beta). Blocks the beta invite going to anyone who can read a
      bundle, which is everyone.
- [ ] Rule on challenge 2 (day-12 residual: accept, or one contextual
      trial-start notification ask).
- [ ] Rule on challenge 3 (lifetime at launch with scoped copy, vs
      after M10).
- [ ] Feed challenge 4 (CS2 at cancel time) into the already-open CS2
      timing decision.
- [ ] Ratify challenge 5 (named comparisons in founder voice only).
- [ ] Approve the CYN1 renewal-line rule as an M4 acceptance
      criterion (it is also the AB 2863 compliance line; cheap now,
      litigable later).
- [ ] Confirm with the attorney that the founding-offer consent record
      (price, renewal price, date shown) is captured per AB 2863's
      3-year retention rule when RevenueCat lands (M3).

## Engineer notes

The paywall cynic (CYN series). All display/copy/process; nothing
touches prescription. Golden master untouched throughout.

- **CYN1 - Founding offer never renders without its renewal price.**
  One copy rule in M4: the intro line is always "First year $59.99,
  then $79.99/yr. Founding price ends [date]" (both catalogs; es.js in
  the same PR per the panel-#8 convention). The day-12 reminder shows
  the same pair for intro-offer trialists. M11's sandbox rehearsal
  script asserts the renewal price is visible on the intro sheet.
  Rides M4 + M5 + M11. NEW acceptance criterion, no new slice.
- **CYN2 - Store-scoped lifetime copy at the price line.** If lifetime
  ships before M10, the paywall line item and the M6 subscription
  section both carry the store scope ("on this App Store account");
  purchase-adjacent copy never says or implies cross-device without
  qualification until M10 lands. Rides M4 + M6; M10 unchanged.
- **CYN3 - Final-72h card on every entry surface + seen-marker.** The
  trial-ending card renders on dashboard, logger home, and session
  summary during the last 72h; a device-scoped (TB4-style, never in
  `S`) seen-marker records first display so support and AN3 can
  distinguish "warned and lapsed" from "never saw it". The optional
  trial-start notification ask is challenge 2, not built until ruled.
  Rides M5.
- **CYN4 - Grid divergence gates the beta.** The landmark-seed
  migration branch (SS1 methodology) gains a hard assertion: shipped
  `VOLUME_LANDMARKS` values differ from the published seed grid (the
  divergence test already specced), and the `data.js:1404` SOURCE
  comment goes with the legal-scrub sweep. Sequencing decision is
  challenge 1; the engineering is already specced elsewhere — this
  note only adds the beta-gating test framing. Rides the
  landmark-migration branch + legal-scrub.
- **CYN5 - Lock surfaces always name what stays free.** Production
  (M4-era) lock cards carry a one-line free-tier promise (the BILL-2
  line or its short form) under the coach pitch; L5's executable
  boundary checklist asserts no locked surface renders without it.
  Today's `tier.locked_note` is dev-only and TB5-hidden in store
  builds; leave it. Rides M4 + L5.
- **CYN6 - The "lifetime of what?" FAQ entry.** CS1's bundled FAQ
  answers the app-mortality question honestly: local-first, the app
  keeps working, export is free forever. Pre-written in both
  catalogs so the first Reddit thread gets a link. Rides CS1.
- **CYN7 - Receipt-counter integrity.** A countable "adjustment" in
  the day-12 recap and any paywall copy is exactly a T1 receipt the
  athlete could have seen (AN3 counter), nothing finer-grained; low
  counts fall back to plain copy (already specced). Add the assertion
  to T1's tests when counters land. Rides T1 + M5 + AN3.
- **CYN8 - Review asks never share a message with an incentive.**
  Process rule for the beta and launch comms: rating prompts come
  only from E2's in-app gate; no beta thank-you, founding-offer, or
  win-back message contains a rating ask. Add one line to the R9
  pre-submission checklist and the CS1-era support macros. Rides
  R9 + CS comms. No code.

## What this persona would post if it ships as amended

> Honestly? Grudging respect. Free tier is a real logger, not a demo.
> They tell you the price before AND during, the trial reminder names
> the number, cancel is one deep link with zero begging, and when I
> lapsed the app said "your log is yours, free, forever" and meant it.
> The coach explains every change it makes, which is more than my
> $300/yr app ever did. Still think $12.99/mo is steep. Paid annual.

That review is available. The five above are also available. The
difference is a handful of copy rules, one sequencing decision, and
shipping the honesty that is already on paper.

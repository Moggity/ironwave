# App Review, run adversarially: the store build vs 4.2 and 3.1 (launch consultation #10)

Date: 2026-07-18. Call sheet entry 10, the second adversary. Run against
the PLANNED store build, not the prototype: per the owner's framing, the
launched product is a pair of downloadable native apps (iOS + Android,
Capacitor-wrapped per the release-engineering report) with the free
logger in the free version and the full automated coach behind the paid
subscription. The prototype PWA is the seed, not the subject; where the
store build's spec and the prototype's behavior differ, this report
grades the spec and says so.

Method. Two reviewers are simulated: an Apple App Review reviewer as
primary (the call sheet's brief: guidelines 4.2 minimum functionality
and 3.1 payments, "before submission, not after rejection") and a Google
Play policy reviewer as secondary, because the launched product is both
stores and Play's payments and data policies fail differently from
Apple's. Inputs: `docs/release-engineering-report.md` (R1-R12 + the
2026-07-18 amendment), `docs/monetization-operations-report.md` (M1-M11
+ amendment), `docs/privacy-data-protection-report.md` (PD1-PD8),
`docs/tier-usage-analysis.md`, `docs/aso-launch-report.md`,
`docs/support-community-report.md`, `docs/legal-compliance-report.md`,
the shipped code where it already answers a review question
(`hasCoach()` at `app.js:281`, the L0 lock surfaces, `index.html`'s
viewport), and store policy as of mid-2026, checked against current
sources for the two moving targets: the US external-purchase-link
regime after the Ninth Circuit's December 2025 Epic v. Apple ruling,
and Play's account-deletion web-link requirement in the Data safety
form. Where a plan document has no answer, that absence is itself a
finding: the reviewer only sees what ships, never the roadmap.

Verdict in one line: 4.2 is the risk everyone prepared for and the one
this app will pass; the rejections actually available today are in the
unwritten 3.1 detail work, the accounts-without-deletion coupling, the
Play side of the win-back link, and the fact that nobody has yet
written a single word addressed to the human who approves the build.

### The persona: a reviewer, 40 apps in today's queue

I have reviewed fitness apps for six years. I get six to ten minutes
with yours unless something smells, and then you get my full attention,
which you do not want. I open the app cold with airplane mode on,
because "offline-first" is a marketing word until I see it. I look for
the login wall, the consent wall, the paywall-before-function, the
URL-in-a-box, the subscription sheet that forgets its price, the
account you can create but not delete, the health claim in the
description that the binary cannot back. I do not read your roadmap. I
do not care about your architecture. I care whether the build in front
of me does what the metadata says, charges the way the rules say, and
respects the user the way the rules say. My Play counterpart cares
about the same things plus a form you probably filled in at 2am.
Convince the build, not me.

## What passes on sight

The plans already delete the classic rejection classes, and it is worth
being precise about which, because these are load-bearing and must not
regress at the beta cut line.

- **This is not a URL in a box.** The Capacitor shell loads the bundle
  from a local origin, not a remote URL (release §3); a cold start with
  no network works because nothing needs a server. The 4.2 objection is
  aimed at wrapped websites; a wrapped local app that trains you
  offline is a different animal, and reviewers can tell in the first
  thirty seconds.
- **First open is useful with zero commitment.** R10's first-run chain
  is splash, a 16+ age gate, a DECLINABLE analytics opt-in, then L3's
  logger home with Start-a-session primary — no login wall, no consent
  wall, no purchase before the first loggable set (E11 asserts exactly
  this in AN6's rehearsal). The release amendment's own line is right:
  "the privacy posture is 4.2 armor." An app I can use fully, having
  declined everything, with no account, is the strongest
  minimum-functionality exhibit a reviewer sees all week.
- **No ATT, short labels, three SDKs each with a privacy manifest.**
  Consent-before-init analytics (AN2), no ad tracking, PD8's answer
  sheet keeping the nutrition label and Data safety form transcribed
  from a living inventory instead of improvised. The label conversation
  is usually where wrapped fitness apps bleed; this one is pre-drained.
- **The rate-us discipline is exactly right.** `SKStoreReviewController`
  only, no custom dialog, no incentivized ratings, floor gates on
  sessions/days (ASO §4). Nothing to flag.
- **Cancellation lives in store settings and the app says so plainly**
  (M4's plain-terms line, M6's manage/cancel deep link, "ends [date]"
  vs "renews [date]"). The subscription-hostility rejections are not
  available against this design.
- **Android back button through `MSTACK`** (R4): the single most common
  "feels broken" flag on wrapped Android apps, already designed out.

## The 4.2 session, and where the armor is thinner than the report thinks

The release report treats 4.2 as its headline risk and mitigates well.
Three challenges, because the mitigation list has a timing hole, a
category error, and a missed upgrade.

- **The reviewer sees the build, not the slices.** The 4.2 exhibits are
  R4/R5 deliverables (notifications with the screen off, haptics, share
  sheet, launch/status-bar polish) plus R8 (HealthKit) — and R8 is on
  the amendment's slip-to-launch cut list while R5 is beta critical
  path. Fine for the beta; but the SUBMITTED launch build must carry
  the full exhibit set, and the cut-line ratification should say so
  explicitly: R8 may slip the beta, not the store submission, OR the
  submission notes must not lean on Health export as native value.
  Half-shipped armor is how "we had a plan for 4.2" becomes a 4.2
  rejection with a plan attached. **AR1.**
- **"Polish is review armor" is necessary, not sufficient.** The
  identity-report polish bar makes the app feel native; it does not
  answer "what does this DO that Safari cannot." The answer that does:
  the rest timer. R5's local notification is correctly called the
  strongest 4.2 exhibit, and it can be upgraded into an un-fakeable
  one: an iOS **Live Activity** (lock screen + Dynamic Island countdown
  for the rest timer, and on meet day the attempt clock) and the
  Android equivalent, an ongoing chronometer notification. No wrapped
  website has a Dynamic Island; it is also, independently, the most
  requested gym-floor feature in the category. This needs a small
  custom native module beyond stock Capacitor plugins — real native
  code, budget it as such — so it is a fast-follow after the R4/R5
  wrap, not a launch blocker. But it converts the 4.2 conversation
  from "adequate" to "over in one screenshot". **AR2.**
- **The prototype's viewport contradicts the store build's story.**
  `user-scalable=no` is still shipped web reality (panel #8's ACC4),
  and R4 only records "the deliberate `user-scalable` decision." A
  fitness app that blocks text zoom reads, to a reviewer who checks
  accessibility (Play increasingly does), as web-wrapper laziness. The
  panel already made text scaling a submission gate; this report
  seconds it from the review desk: decide it, do not defer it. Rides
  ACC4/R4, no new note.

## The 3.1 session: the chapter nobody wrote

The release report has no payments-guideline treatment, the
monetization report designs the paywall's honesty but never walks
3.1.2's checklist, and the tier report gates features, not compliance.
The persona's richest seam. Findings:

- **3.1.2's boilerplate is not optional and is not yet anywhere.** An
  auto-renewing subscription requires, in the BINARY and in metadata:
  a functional privacy policy link AND Terms of Use/EULA link (on or
  reachable from the paywall and in App Store Connect's fields), the
  subscription's title, length, and price per unit clearly on the
  purchase sheet, and restore. M4's spec has price/term/cancel and
  "restore link + terms/privacy" — good bones — but nothing binds the
  Connect metadata side, and M6/CS1 link "policy" without naming the
  EULA. One R9 checklist block closes it: paywall shows
  title/price/period/renewal, ToS + privacy links resolve in-app from
  BOTH the paywall and Settings, Connect metadata fields filled, the
  intro offer's post-promo price visible (CYN1, same line item).
  **AR3.**
- **The trial wording has a review-facing rule too.** "14 days free,
  then $79.99/year" satisfies the consumer-law side (CYN1) and ALSO
  3.1.2's disclosure expectation; metadata that says "free" without
  the after-price is a metadata rejection (2.3.7/3.1.2 combo). Fold
  into AR3's checklist: the word "free" never appears in listing or
  paywall copy without the trailing price. Rides AR3.
- **The M8/M9 web win-back link is two different problems on two
  stores, and the docs treat it as one.** Checked against current
  sources: on iOS/US, external purchase links are permitted via the
  StoreKit External Purchase Link entitlement with Apple's disclosure
  sheet, and the commission question is still in motion — the Ninth
  Circuit (Dec 2025) held Apple may charge a cost-based commission
  once the district court approves a fee, nothing collectible until
  then, Supreme Court stay sought May 2026. So M8's "commission-free
  web checkout" business case is jurisdiction-scoped AND time-unstable.
  On Play, it is worse: outside the EEA/user-choice-billing programs,
  steering users from inside the app to a non-Play payment method for
  digital goods violates Play's Payments policy outright — the M9 slot
  on the detachment card is a policy strike on Android in most of the
  world, not a gray area. Required shape: the M9 slot renders only
  when `BUILD_CHANNEL === 'store'` AND platform+storefront is
  eligible (iOS/US via the entitlement + Apple's disclosure sheet;
  Android only inside an enrolled alternative-billing region, which
  at this scale likely means never at launch), and M8's revenue
  math drops the zero-commission assumption. The flag-gated-invisible
  launch posture already specced is correct; this note is what the
  flag must check before it ever flips. **AR4.**
- **Sandbox/receipt hygiene.** M11's lapse-lifecycle rehearsal is
  exactly what prevents the "purchase does not unlock" 2.1 rejection;
  extend its final assertion to run once on TestFlight sandbox before
  first submission, not only in local sandbox. Rides M11; checklist
  line in AR3's block.

## The 5.1 session: one coupling rule and one missing web page

- **Accounts may never out-ship deletion, on either store.** The
  privacy report already names PD5 an Apple 5.1.1(v) review blocker,
  and the release amendment lets PD5 slip the beta only because
  accounts do not ship in the beta. Correct — but leave nothing
  implicit: the coupling is per-BUILD, forever. Any store build
  containing account creation (the Supabase sync epic) contains PD5
  in the same build, and R9 asserts it mechanically ("if the build
  can create an account, it can delete one"). **AR5.**
- **Play wants a WEB deletion path, not just in-app.** Play's Data
  safety form requires, for any app that allows account creation, a
  functional web link where users can request account + data deletion
  (in-app deletion alone does not satisfy the form). PD5 as written
  is in-app + DSR wiring. The fix is small and should ride PD5: one
  static page on the marketing domain ("request deletion of your
  IRONWAVE account") feeding the same support inbox/flow, named in
  the Data safety form. Cheap now, a form-rejection loop later.
  **AR6.**
- **Privacy-manifest aggregation is a build artifact, check it like
  one.** Three SDKs, three manifests, plus Capacitor plugins'
  required-reason API declarations, aggregated by Xcode into the
  privacy report. R9 gains: diff the generated privacy report against
  PD8's answer sheet on every submission; a new plugin that quietly
  adds a required-reason API is exactly the silent class that
  rejects. Rides R9/PD8; checklist line, folded into **AR3**'s block.
- **Sentry consent timing (open decision, reviewer's data point).**
  Pre-consent crash reporting under legitimate interest, disclosed in
  the label, is common and passes review; what rejects is collecting
  ANALYTICS pre-consent while the label says otherwise. From the
  review desk, option B (release report's lean) is the safer label
  story IF the nutrition label declares crash data as collected and
  the scrubbing is real. Attorney still owns the call; this is input,
  not a ruling.

## The 1.4 / 2.x session: claims, notes, and the human in the loop

- **1.4.1 physical harm: the copy scrub is the compliance.** The app
  prescribes training loads; that is fine (category precedent is
  overwhelming), what rejects is diagnostic or medical language. The
  sports-science claim ceiling ("prescribes and autoregulates
  training; never measures recovery, prevents injury, or improves
  health markers") plus the legal-scrub's injury-copy rules (stop-on-
  pain, no "rehabbing") ARE the 1.4.1 defense. One addition: the
  health disclaimer must be findable IN the binary (CS1's Help screen
  is the natural home), not only in the store listing. Rides CS1 +
  legal-scrub; line in AR7's notes file.
- **Nothing is written for the reviewer, and the reviewer is a user
  you onboard exactly once.** The digest of all three ops reports
  confirms: no review-notes template, no demo path, nothing. The app
  needs no demo account (no login), and the trial makes the coach
  reachable in two taps — but the reviewer does not know that until
  told, and a reviewer who cannot find the paid surface reviews the
  free tier against paid-tier metadata and rejects on 2.1 or 2.3.
  Ship `docs/store-review-notes.md`, maintained by R9's checklist,
  first version pre-written: local-first architecture (no server, no
  account — do not look for a login), the two-tap path from first
  open to the coach reveal and trial, where receipts/coach surfaces
  live for screenshot verification, sandbox-trial notes, where the
  health disclaimer and deletion paths are, and the one-line "the
  free tier is fully functional by design" so generosity is not
  mistaken for brokenness. **AR7.**
- **2.3 metadata honesty is already structurally enforced** — the T1
  hard gate means the receipts screenshot exists in-app before any
  tester or reviewer sees it; the scoped privacy line replaced the
  false absolute. Ratified, no note.

## The Play desk, remainder

Covered above where it differs (AR4 steering, AR6 web deletion). The
rest of the Play surface is already handled by the plans and is listed
here so it is not re-litigated: Data safety + health declaration from
PD8's sheet; target-API treadmill calendared (release §4); the
12-tester/14-day gate satisfied by the September beta; Play App
Signing from first upload; phased rollout with halt; vitals wired from
first beta (R7). One addition folded into AR3's checklist: Android
13+'s POST_NOTIFICATIONS runtime permission must be requested by the
same in-context first-timer-use moment R5 already specs — never at
boot — so the notification permission story is identical on both
platforms.

## Challenge ledger (owner decisions)

1. **R8 vs the submission** (AR1): ratify that the beta cut line's
   "R8 may slip" applies to the beta only; the first App Store
   submission either carries HealthKit write-out or strikes Health
   from its native-value story. Either is defensible; drifting into
   review with the gap is not.
2. **M9 on Android** (AR4): outside alternative-billing regions the
   win-back link from inside the app is a Play payments-policy
   violation, not a risk. Ratify: the Android build ships the slot
   permanently dark until Play's programs cover the target regions,
   and M8's business case is re-run with a nonzero-commission iOS
   assumption.
3. **Text scaling** (panel #8 ACC4, seconded): already an owner
   ruling in flight; the review desk adds that it is the one
   accessibility item a store reviewer actually trips over. Decide
   before the wrap branch, not during.
4. **Sentry timing** (existing open decision): review-desk data point
   filed above for option B with an honest label. Attorney's call
   stands.

## Owner tasks

- [ ] Ratify challenge 1 (R8's slip scope: beta-only vs submission).
- [ ] Ratify challenge 2 (M9 dark on Android; M8 economics re-run).
- [ ] Close the text-scaling ruling (challenge 3) before R4 starts.
- [ ] Feed the Sentry data point into the existing attorney question.
- [ ] Approve `docs/store-review-notes.md` as a maintained artifact
      (AR7) and review its first draft before the first submission.
- [ ] When enrolling: Small Business Program (existing task) AND, if
      M8 ever activates on iOS, the External Purchase Link
      entitlement request — a separate application with its own lead
      time.

## Engineer notes

App Review desk (AR series). Everything is store-build/native-shell
side or checklist automation; nothing touches prescription. Golden
master untouched throughout.

- **AR1 - The submission carries the full 4.2 exhibit set.** R9's
  pre-submission checklist gains a named "native value inventory"
  gate: local bundle, R5 screen-off rest-timer notification, haptics,
  share sheet, launch/status-bar polish, and (per challenge 1) either
  R8 Health write-out or its removal from notes/metadata. The
  inventory is asserted against the packaged build, not the repo.
  Rides R9 + R4/R5/R8.
- **AR2 - Live rest timer as native surface (fast-follow).** iOS Live
  Activity (lock screen + Dynamic Island countdown; meet-day attempt
  clock later) and Android ongoing chronometer notification, driven
  by the same `V.restTimer` state through a new `Platform.liveTimer`
  face (web no-op). Requires a small custom native module beyond
  stock plugins — schedule after the R4/R5 wrap ships, as its own
  branch. The strongest possible 4.2 exhibit and a real gym-floor
  feature; do not let it creep into the launch critical path.
- **AR3 - The 3.1.2 compliance block in R9.** One checklist section:
  paywall shows title/price/period + renewal price for the intro
  (CYN1's line); ToS/EULA + privacy links resolve from paywall AND
  Settings inside the binary; Connect metadata privacy/EULA fields
  filled; "free" never appears without the after-price in listing or
  paywall copy; M11's lapse rehearsal runs once on TestFlight sandbox
  pre-submission; Xcode's aggregated privacy report diffs clean
  against PD8's answer sheet; Android requests POST_NOTIFICATIONS at
  first timer use only. Rides R9 + M4 + M6 + M11 + PD8.
- **AR4 - Storefront gating for the M9 slot.** The win-back CTA
  renders only when `BUILD_CHANNEL === 'store'` AND the platform +
  storefront is eligible: iOS US via the External Purchase Link
  entitlement with Apple's disclosure sheet; Android only inside an
  enrolled alternative-billing region (expected: none at launch, the
  slot stays dark). M8's revenue model drops the permanent
  zero-commission assumption (Ninth Cir. Dec 2025 remand). Rides
  M8/M9 + R12.
- **AR5 - Accounts/deletion per-build coupling.** R9 asserts: a build
  that can create an account contains PD5's in-app deletion. Encoded
  as a checklist gate keyed on the sync feature flag, so the Supabase
  epic cannot out-ship PD5 by accident. Rides R9 + PD5 + the Supabase
  epic.
- **AR6 - The web deletion-request page.** PD5 grows one static page
  on the marketing domain (request account + data deletion; feeds the
  support flow; names the app as listed), and its URL lands in Play's
  Data safety form. Required by Play for any account-creating app;
  in-app deletion alone does not satisfy the form. Rides PD5 + PD8.
- **AR7 - `docs/store-review-notes.md`.** A maintained reviewer-facing
  notes file (content per the 2.x session above), refreshed by an R9
  checklist line each submission, first draft written with the wrap
  branch. Includes where the health disclaimer lives in-binary (CS1's
  Help screen — add the disclaimer there if CS1's spec does not
  already carry it). Rides R9 + CS1.

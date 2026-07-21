# The launch line: twelve operators, one table (cooperative re-pass)

Date: 2026-07-18. Owner directive: the twelve launch consultants
(ASO, release engineering, monetization, analytics, privacy, support,
sports science, the athlete panel, the paywall cynic, App Review, the
creator partner, intake QA) sit together ONCE, cooperatively, and turn
the backlog in `docs/pending-future-work.md` into a single line: what
gets built, in what order, with the human's decision and action gates
placed where they actually belong. Every gate is written in plain
English for a decision-maker who does not live in this codebase, and
every gate where the human must DO something reads like instructions
for someone doing it for the first time.

This document is the SEQUENCING overlay. The backlog doc keeps every
slice's full technical detail; this one says when, in what order, and
where the human stands on the line. When the two disagree about
sequence, this document wins; when they disagree about content, the
backlog wins. Engineering agents: pick your next branch from this
line, top to bottom, and read the slice detail in the backlog before
starting.

## What the table agreed (and the three fights it settled)

The twelve did not have to compromise much — the reports were already
cross-referenced — but three genuine conflicts were resolved:

1. **The September beta was carrying double its weight** (release
   engineering's own amendment admitted it). Monetization wanted every
   tester to meet the paywall; release engineering wanted a beta that
   can actually ship in September. The table's compromise, which the
   owner ratifies at Gate 1: a **two-wave beta**. Wave 1 (September)
   tests the logger, the coach, support, analytics, and crash
   reporting with NO paywall — nobody is asked for money. Wave 2
   (early October, same cohort) switches on the paywall, receipts,
   and the sandbox billing rehearsal. The receipts-before-paywall
   rule (T1) is preserved exactly; it just bites in wave 2. If T1 and
   the billing spine land early, the waves can merge back into one.
2. **The volume-table replacement goes first, alone.** The paywall
   cynic, the creator partner, sports science, and legal all
   independently demanded it (it is the one place the shipped app
   still visibly leans on a competitor's published numbers). It is
   also the ONLY planned change that alters the app's default
   training output, which is why it must be its own step with its own
   sign-off (Gate 4) before anything else piles on.
3. **All owner decisions got batched.** Roughly twenty rulings were
   scattered across six challenge ledgers. Scattered decisions are a
   bottleneck disguised as flexibility. They are now three sittings:
   one decision batch (Gate 1), one lawyer letter (Gate 2), one
   paperwork afternoon (Gate 3) — all in the first week, because
   several have multi-week lead times and sit upstream of the beta.

The line below is pseudo-linear: at most two lanes run at once (the
engine lane closes while the platform lane opens), and every lane
funnels through the same gates. Dates assume work starts the week of
2026-07-21 and the beta target stays September.

---

## Station A - This week (Jul 21-27): decisions, lawyer, paperwork

Nothing on the line moves fast until these three gates clear. None of
them involve code.

### GATE 1 (decide, ~90 minutes, one sitting): the decision batch

**RATIFIED (owner, 2026-07-21): all recommendations 1a-1k approved as
written.** Recorded here so engineering agents treat every item below as
settled; the per-item detail stays for reference. Concretely: two-wave
beta yes; the 1b slip list approved; launch without Health export if it
misses the build; text scaling non-negotiable; 1RM floor to 10 kg with a
soft confirm under 20; lifetime sold at launch with store-scoped wording;
exit survey at both moments, once per person; creator deals flat fee +
20% with Feb-Mar timing; competitor pricing in founder voice only;
"Musculación" leads the ES listing; all three coaching-judgment tweaks
(SS3 advisory cross-check, SS6 evidence bar, SS8 beginner confirm-gate)
approved.

You are the tie-breaker on items your consultants already argued both
sides of. For each, the table gives you the context, the
recommendation, and what happens if you skip it. Defaults are safe:
if you rule nothing else, say "take all recommendations" and the line
moves.

- **1a. Two-wave beta (see above).** Recommendation: yes. Skipping it
  means everything money-related becomes a September blocker and the
  beta date is at real risk.
- **1b. What may slip out of the September beta.** The proposal:
  exercise videos (R6), Apple Health export (R8), and account
  deletion (PD5) may arrive at launch instead of beta — the last one
  only because accounts themselves are not in the beta. What may
  NEVER slip: the consent screens, the Help screen, the analytics
  pipeline, and the receipts. Recommendation: approve as proposed.
- **1c. Health export at submission time.** If R8 (Apple Health) also
  misses the LAUNCH build, the App Store submission must stop
  claiming Health integration anywhere. Decide now: hold launch for
  it, or launch without it and strip the claim. Recommendation:
  launch without if it comes to that; add it in the first update.
- **1d. Text size.** The app currently blocks phone-level text
  enlargement. Your accessibility reviewer called it a launch
  blocker, and the store reviewer seconded it. Recommendation: fix it
  (it is scheduled on the line either way); this ruling just makes it
  non-negotiable.
- **1e. How light can a lifter be.** Today the app refuses a max
  under 20 kg, which shuts out real (mostly female and youth)
  athletes. Recommendation: lower the floor to 10 kg with a gentle
  "are you sure" under 20.
- **1f. The lifetime purchase at launch.** The $249 lifetime cannot
  transfer between Apple and Android until account-linking exists
  (a post-launch feature). Options: sell it at launch with plain
  wording that it lives on one store account, or hold it until
  transfer works. Recommendation: sell it with the plain wording;
  the honesty line does the work.
- **1g. The exit-survey moment.** When a subscriber cancels, do we
  ask the one-tap "what made you leave?" question at cancel time
  (memory fresh, support worries it looks like begging) or only
  weeks later when access actually ends (support's original ruling,
  monetization says the answer arrives too late to be true)?
  Recommendation: both moments, same single question, asked at most
  once per person, never a plea.
- **1h. Creator deals.** The influencer offer becomes "flat fee plus
  20% ongoing" instead of percentage-only (the percentage alone is
  worth a few hundred dollars a year to a 50k channel that charges
  four figures per video — nobody signs that). Timing: partner
  videos in February-March, not December. Recommendation: approve
  both.
- **1i. Naming a competitor in marketing.** The internal line "a
  quarter of RP's price" may be said by YOU in interviews and Reddit
  comments, never printed in the store listing or ads.
  Recommendation: approve.
- **1j. Spanish store word.** Whether the Spanish listing leads with
  "Musculación" (and the related search-alias policy). Your Spanish
  reviewer says yes. Recommendation: approve.
- **1k. Three coaching-judgment tweaks** (from the sports-science
  audit: a sanity cross-check before big working-max raises, an
  evidence bar before the app raises a muscle's volume ceiling, and
  a firmer "are you sure" for beginners choosing the aggressive
  fat-loss plan). These change how the coach behaves at the margins.
  Recommendation: approve all three; they make the coach more
  cautious, never more aggressive.

### GATE 2 (do + decide, ~1 hour to write, days for replies): the lawyer letter

One email to your attorney, four questions, plus one commission. In
plain terms, what you are asking and why:

1. **Crash reports before consent.** When the app crashes, may we
   send an anonymous crash report immediately (industry standard,
   scrubbed of personal data), or must we wait until the user has
   opted in to analytics? Engineering leans "immediately"; we need
   the attorney's blessing BEFORE the consent screens' wording is
   written, and those screens are on the beta's critical path. This
   is the single most time-sensitive question in the letter.
2. **The $59.99 founding price.** California law (and good sense)
   requires that anyone buying the discounted first year sees, before
   paying, that year two costs $79.99 — and that we keep a record of
   what they saw for three years. Confirm our planned wording and
   record-keeping satisfy that.
3. **The old PDF in the repository's history.** A copyrighted
   training book was once committed to the code repository and,
   though deleted, remains in its history. The legal report
   recommends scrubbing the history. Confirm, and we will do the
   scrub (it is disruptive for collaborators, which is why it needs
   a deliberate yes).
4. **Name clearance.** Commission the trademark search for the
   launch name (and a backup name) in the fitness category — the
   store listing, the marketing site, and the creator outreach all
   sit behind this.

Commission alongside: the privacy policy, terms of service, and the
health disclaimer ("not medical advice, stop if something hurts").
The app's architecture makes the privacy policy unusually easy — it
mostly describes that data stays on the phone.

### GATE 3 (do, one afternoon + waiting): the store paperwork

All of this has lead time measured in days-to-weeks, none of it can
be done by the engineering agent, and the September clock does not
start until some of it exists. Step by step:

1. **Create a dedicated Apple ID** for the business (an email you
   will control in ten years, not a personal one), turn on
   two-factor.
2. **Decide: enroll as an individual or as a company.** Individual
   shows your legal name as the seller and enrolls in days. Company
   shows a company name but requires a legal entity and a free
   D-U-N-S number that takes 5-30 days to issue. Changing later is
   painful. If you have no entity yet, enroll as individual.
3. **Join the Apple Developer Program** (developer.apple.com, ~$99/
   year, card required). This unlocks TestFlight (the iOS beta
   system) and the App Store.
4. **Create a Google Play Console account** (play.google.com/console,
   one-time ~$25). Note: new personal accounts must run a closed
   test with at least 12 testers for 14 continuous days before
   production access — this is why beta recruiting (Gate 9) cannot
   wait.
5. **Apply to Apple's Small Business Program** (reduces Apple's cut
   from 30% to 15%; it is an application, not automatic; apply once
   the developer account exists).
6. **Accept the paid-apps agreements and fill in tax and banking**
   in both consoles (W-9 or local equivalent, bank account).
7. **Decide how iOS builds get made:** a Mac with Xcode, or Xcode
   Cloud (Apple's cloud build service, no Mac needed day-to-day).
   Recommendation: Xcode Cloud unless you already own a Mac.
8. **Budget ~$300 for used test hardware** when the wrap work starts:
   one older iPhone, one current iPhone, one mid-range Samsung.

---

## Station B - Engine closeout (Jul 21 - mid Aug), one lane

The last training-engine work before the platform push. Order
matters; each is one branch.

- ~~**B1. The volume-table replacement**~~ DONE (2026-07-18): landmark
  seed derived from our own trait model, divergence test green on every
  build, faster recalibration, comment scrub. Golden master regenerated
  deliberately and came back byte-identical (the seed feeds bodybuilding
  volume machinery, not default slot output — the "changes default
  output" expectation did not materialize, which only makes Gate 4
  easier). Review sheet: `docs/landmark-derivation-note.md`. **Gate 4
  is now waiting on the owner.**
- ~~**B2. The wording scrub**~~ DONE (2026-07-18): labels, taglines,
  metadata, comments, README, and the SS4/SS5 copy reframes swept in
  both catalogs; the persisted methodology label migrates on legacy
  saves; grep gate green; golden master byte-identical.
- ~~**B3. Small-load correctness + coach rules**~~ DONE (2026-07-21):
  below-bar guard on the session card, 10 kg floor with the 10-20
  confirm (1e), low-max fine rounding at creation, the equipment
  micro-step on the maxes step, and all three 1k tweaks (SS3 advisory
  e1RM cross-check on AMRAP raises, SS6 evidence-gated MRV raises,
  SS8 beginner + aggressive-deficit confirm gate). Golden master
  untouched; both catalogs.
- **B4. Specialization-split honesty** (IQ6-IQ8: the one-muscle-at-6
  week stops degenerating; intake warns when the math cannot work).

### GATE 4 (approve, ~30 minutes): the new volume numbers

**APPROVED (owner, 2026-07-21)** after reviewing
`docs/landmark-derivation-note.md`: the derived table is ratified as
shipped training guidance and the divergence test stands as the
automated proof. Station B's B1 is fully closed.

After B1, you will get a one-page before/after: the old seeded
volume table next to ours, per muscle, with the reasoning. What you
are confirming, in plain terms: (a) the new numbers are defensible
training guidance you would stand behind in an interview, and (b)
they are demonstrably NOT the competitor's table (an automated test
now proves the difference on every build). Existing athletes'
programs adjust gently at their next block, not mid-week.

---

## Station C - The free logger + accessibility spine (Aug), one lane

This is Epic L, the biggest unstarted piece: the app must become a
genuinely good free workout logger that works with no program, no
account, and no purchase — because the whole business model stands on
"the free thing is real."

- **C1. ACC1-ACC3** (screen-reader announcements, proper dialogs,
  logging that does not lose your place — these come FIRST because
  the logger and the receipts are built on top of them).
- **C2. L1 freestyle logging** (start an empty session, add
  exercises, log; history and records just work).
- **C3. L2 routines** (saved exercise lists, start-from-routine).
- **C4. L3 the program-less home** (first open lands on the logger,
  the coach quiz is a door, not a wall) + ACC4 text scaling per
  ruling 1d.
- **C5. L5 boundary tests** (an automated checklist proving every
  free surface works un-paid and every coach surface is gated).
- **C6. The Spanish leak sweep** (ESM1-ESM9 per rulings 1j).

### GATE 5 (do, ~20 minutes on your phone): drive the free logger

You get a build link. Pretend you are a stranger who downloaded a
workout logger: open it cold, log a made-up session, make a routine,
start from it, check history, turn on Spanish, make the text bigger.
You are answering one question: would YOU keep this app if the coach
did not exist? If anything makes you hesitate, say exactly where —
that hesitation is what a thousand strangers will feel.

---

## Station D - Receipts (late Aug), joins lane with Station E

**D1. T1 decision receipts**: every invisible decision the coach
makes (raising your max after a strong set, adding a recovery week,
easing a lift you flagged) becomes a short visible sentence at the
moment it happens, plus a weekly digest. This is the paid product's
entire visible difference, the thing the trial sells, and the
hard gate before any tester meets the paywall. Built on C1's
announcements, counted honestly (a "coach adjustment" is only
something you could have seen), written in both languages, checked
by an automated tone-lint (athlete's own data first, no medical
language).

### GATE 6 (approve, ~30 minutes): the coach's voice

You get the full list of receipt sentences (English and Spanish).
These sentences ARE the product's personality — read them aloud. You
are checking: do they sound like a calm coach explaining, never like
an app showing off? Is every claim something the athlete's own
logged numbers back up? Strike any sentence you would not say to a
lifter face to face.

---

## Station E - The native wrap + the money plumbing (Aug - early Sep), second lane

The prototype becomes two installable apps. This lane can start as
soon as Gate 3's accounts exist, in parallel with Stations C-D.

- **E1. R2 + R1**: the platform adapter and durable on-device storage
  (the classic wrapped-app data-loss bug, designed out first).
- **E2. R3 + R12**: the release build lane (minified store bundle,
  stripped comments — a legal requirement — build-channel stamp,
  tests run against the exact bytes that ship).
- **E3. R4 + R5**: the actual iOS/Android shells (working back
  button, splash, status bar, rest-timer notifications with the
  screen off) — needs Gate 7's identity assets.
- **E4. R7 + R11 + AN1 + AN2**: crash reporting and the analytics
  pipeline, both strictly behind the consent screens (wording per
  Gate 2's answer), with the hard ceiling of exactly three
  third-party components in the app, ever.
- **E5. R10 + PD1 + PD2 + PD3 + PD6**: first-run flow (age gate,
  declinable analytics question, straight into the logger), local
  "delete everything" button, the redacted diagnostic for support.
- **E6. CS1 + CS3**: the in-app Help screen (FAQ in both languages,
  contact with the diagnostic attached, the honest one-person reply
  time, the health disclaimer lives here) + the two support
  analytics events.
- **E7. M1 + M3**: the billing seam and the store-billing
  integration in sandbox (fake-money) mode, with the 7-day offline
  grace so nobody gets locked out mid-workout in a basement gym.
- **E8. M4 + M5 + M6 + M11**: the paywall (with every honesty rule
  from the cynic's report baked in: renewal price on the founding
  offer, "continue free" at equal size, store-scoped lifetime
  wording per ruling 1f), the day-12 trial reminder, the settings
  subscription page, and the full scripted rehearsal of
  trial-cancel-lapse-resubscribe in sandbox.
- **E9. R9 + AR3**: the automated pre-submission checklist,
  including the payments-compliance block and the reviewer-notes
  file.

### GATE 7 (decide + provide, depends on Gate 2's name search): identity

The apps need their final name, icon, and store listing words. You
approve: the cleared name (or the backup), the icon, the three-line
store pitch (already drafted: the coach claim, the free-logger
promise, "no account - your training data stays on your phone unless
you turn on sync"), and the screenshot set. Nothing here is
technical; it is the shop window, and it is the one part strangers
judge in four seconds.

### GATE 8 (do, ~1 hour): hardware and testers

Buy the ~$300 of used test devices (Gate 3, step 8). Start
recruiting beta testers NOW even though the beta is weeks away: you
need 20-50 real people, of whom at least 12 on Android must keep the
app installed for 14 continuous days (a store rule that cannot be
compressed). Friends, gym contacts, the waitlist. You will send them
one link each (TestFlight for iPhone, a Play link for Android) and
one paragraph of truth: it is a beta, billing is fake-money, here is
how to complain.

---

## Station F - The beta (September)

### GATE 9 (decide, ~1 hour): beta go/no-go

You get a one-page checklist read-out: every wave-1 must-have from
ruling 1b, green or red. Green means: the logger works cold with no
network, consent screens behave, crashes report, support screen
live, Spanish clean, the golden master untouched since Gate 4's
deliberate change. You say go, and wave 1 invites go out. Two weeks
later, the same read-out for wave 2 (paywall + receipts + sandbox
billing rehearsal green) — same yes/no.

### GATE 10 (habit, ~2 hours/week through launch): the operating loop

Not a decision — a routine the support plan already designed, and
the beta is its rehearsal: twice a week, open the review/feedback
window; answer every complaint (never defensively, always naming
the fix version); once a week, tally themes — any theme mentioned
three times becomes a roadmap line. Your consultants' plans all
assume this habit exists; it is the one thing on this line only a
human can do.

---

## Station G - Launch (October)

- **G1-eng. Freeze + submit**: run the full R9 checklist against the
  exact store bundle, fill the store privacy forms from the
  pre-written answer sheet (they are transcription, not decisions),
  attach the reviewer notes, submit both stores, phased rollout on.
- **G2-eng. The launch build carries**: everything from the beta plus
  whatever Gate 1c ruled about Health export.

### GATE 11 (do + approve, ~2 hours): the submission sitting

With the checklist green, you personally: confirm the price sheet
one last time (the founding offer's end date is a real calendar
date you choose here — it is printed on the paywall and must be
honored); answer the age-rating questionnaire (guided, ~10
minutes); answer the export-compliance question ("standard
encryption only" — yes); approve the final screenshots; press
submit in both consoles. Expect 24-48 hours of review, possibly a
rejection with a reason — that is normal; the reviewer-notes file
and this plan's Station E work exist precisely so the reason is
small.

---

## Station H - After launch (Nov onward), in order

- **H1. T2 + T3**: the plateau card for free users (the honest,
  data-driven upsell) and the coach report card.
- **H2. The sync epic** (optional accounts, one encrypted blob,
  nothing readable server-side) — and it may NOT ship in any build
  without in-app account deletion plus the deletion web page (a
  store rule on both sides; the checklist enforces the coupling
  automatically).
- **H3. The creator rail** (CP1-CP6 per ruling 1h): provenance in
  templates, the named-programs shelf, per-creator codes and the
  monthly statement, the share-card credit line. Outreach only
  after Gate 12.
- **H4. Win-back**, iOS-US only, per the store-policy gating the App
  Review pass defined; Android stays dark.
- **H5. Live rest timer on the lock screen** (the strongest "this is
  a real app" feature, first update after launch).
- **H6. R6/R8 if they slipped**, then the long tail: cross-store
  lifetime bridge, sport-aware scheduling, Cluster E's capstone.

### GATE 12 (decide + sign, with attorney): the creator deal sheet

Before any outreach email: you approve the standard deal — flat fee
band ($1,000-1,500 per integration) + 20% ongoing, how long the 20%
runs (attorney drafts options), monthly statement from store data,
the "Structure by X. Coaching by IRONWAVE." label, both sides free
to work with others, and the written promise that if a partnership
ends, athletes keep their programs. One template contract, reused.

### GATE 13 (read, ~30 minutes, month 6): the honest scoreboard

The pre-committed numbers, in plain terms: 1,000+ people using the
free app weekly AND a 4.5-star rating = spend on growth. Under
$1,000/month revenue at month 12 = the honest conversation the
marketing report scheduled. The dashboard exists from launch
(analytics plan AN5); this gate is you actually reading it and
believing it — the numbers were chosen while nobody was emotionally
invested, which is exactly why they bind.

---

## The line, compressed

```
WEEK 1   G1 decisions -> G2 lawyer -> G3 paperwork        [human week]
JUL-AUG  B1 volume table -> G4 -> B2 scrub -> B3-B4       [engine lane]
AUG      C1 a11y -> C2-C4 logger -> G5 -> C5-C6           [logger lane]
         E1-E2 storage/build ->(G7 identity)-> E3 shells   [wrap lane]
LATE AUG D1 receipts -> G6 voice                           [lanes join]
         E4-E6 consent/help -> E7-E8 billing -> E9 checks
SEP      G8 testers/devices -> G9 go -> WAVE 1 -> WAVE 2  [beta]
         G10 weekly loop begins (never ends)
OCT      G11 submit -> LAUNCH (phased)
NOV+     H1..H6 with G12 (creators) and G13 (month-6 read)
```

Engineering agents: one station step per branch, backlog doc for
slice detail, golden master untouched everywhere except B1 (Gate 4),
tests and both language catalogs with every athlete-facing change,
and update this file's station status lines as steps complete — this
is the line the human is watching.

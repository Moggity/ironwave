# The creator partner counteroffer: would a 50K channel take the deal? (launch consultation #11)

Date: 2026-07-18. Call sheet entry 11, the third adversary — though this
one is less an adversary than a counterparty with a lawyer's eye and a
comment section to answer to. The brief: simulate the other side of
marketing's Phase 3 ruling ("two or three permissioned creator program
partnerships signed — their programs ship in-app, 20% recurring
affiliate") and answer honestly whether a 50K-subscriber evidence-based
channel takes it. Target product per the owner's framing: the launched
native iOS/Android app, free logger + paid coach, where partner
programs are the paid library's content (tier gray-zone call 2,
ratified COACH).

Method. The persona negotiates against everything the repo actually
contains: the deal prose in `docs/marketing-analysis.md` (§8, §9, §13),
the tier gating in `docs/tier-usage-analysis.md` (§5, TB3), the
attribution ruling in `docs/analytics-instrumentation-report.md` (§2:
no MMP; ASA + Play referrer + per-channel offer codes), the absence of
any affiliate machinery in `docs/monetization-operations-report.md`,
the support boundary in `docs/support-community-report.md`
("program-content questions... route to the partner (the 20% affiliate
buys that)"), and the shipped H7 template code (`validateTemplate` /
`programFromTemplate`, `app.js` ~5914-6056; `test/h7-twoday.test.js`),
which fixes what a "creator program" can technically BE. Where the
persona's numbers matter they are computed from the repo's own models
(realized ~$2.50-4.00/mo per paying subscriber, net LTV ~$85-110, the
$700-1,500 integration benchmark at $25-45 CPM).

Verdict in one line: yes — this creator signs, because the structure of
the offer is genuinely better than an ad read — but not on 20%
recurring alone, not before the brand-safety scrub, and not without
four things the repo currently has zero lines of: provenance, an
attribution rail, a reporting statement, and a no-rug-pull clause.

### The persona: "Ada", 51K subscribers, exercise-science MSc, sells her own programs

I run a lifting channel that grew on takedowns of bad program apps and
careful reviews of good ones. 51K subs, 20-45K views on a good upload,
two sponsor reads a month at $900-1,400, and the real business: my own
PDF programs at $39 and a small coaching roster. My audience trusts me
because I have burned sponsors on camera when the product was garbage.
That trust is the asset; every deal is priced against the risk of
spending it. When an app pitches me "your program in our app, 20%
recurring," I hear three separate questions: what exactly ships under
my name, how do I verify what you owe me, and what does my comment
section find when they go digging through your app? I diligence all
three before I quote a rate. I have walked away from bigger offers
than this one.

## What makes me lean yes before we talk numbers

- **"Permissioned partnership, not an ad read" is the right shape.**
  An ad read is 90 seconds against my credibility for a flat fee. A
  program that ships under my name inside the app is an asset that
  keeps selling my channel while the app sells itself — the Boostcamp
  loop, and Boostcamp proved lifters follow named programs into an
  app. Marketing's own framing ("they promote it because it is
  theirs") is correct about my incentives.
- **No numbers travel in a template, and that protects MY business.**
  H7's design comment is explicit: templates carry structure only —
  "set math never travels in a file," no working maxes, no
  percentages. So partnering does not open-source my $39 PDFs: the
  in-app version is my split and exercise selection running on
  IRONWAVE's engine, a different product from my static PDF with its
  own progression. That is a funnel, not cannibalization. I checked
  the validator and the tests; it is real.
- **The paywall I would be sending my audience into is defensible.**
  I read the paywall-cynic report the way my commenters would. A free
  logger that is actually free, "continue free" at equal size,
  price-before-charge, no retention begging, export free forever, a
  detachment card instead of a hostage program. If CYN1-CYN8 ship, I
  can defend this promo in my comments, which is the whole question.
- **TB3 accidentally builds my funnel.** Circulated template JSONs
  land as structure, never live programs. So my video can literally
  give away the structure — free users import and SEE my split — and
  the live, autoregulating version is the coach tier my code
  discounts into. Free taste, honest gate, my name on both sides.
  Nobody designed this as a creator funnel; it is one. Keep it.

## The math, since nobody at the app has done my side of it

20% recurring of what, exactly. An annual at $79.99 nets ~$68 after
the small-business cut; 20% is ~$13.60 per attributed subscriber-year.
Run my funnel honestly: a 30K-view integration, 1-3% click through,
half install, the trial gate, the app's own 40% trial-to-paid target —
call it 15-35 attributed paid subscribers from a strong upload, plus a
long tail from the program living in the app. That is $200-500 in
year-one rev share against the $900-1,400 I charge for the same 90
seconds. Even at the app's month-24 base case ($6-18K MRR app-wide),
20% of my attributable cohort is beer money. Marketing's line that a
program partnership "outperforms an ad read at the same price" is
true for the APP; for me the recurring is upside, not payment.

So the pitch as written — 20% recurring, full stop — does not close
with me or anyone at my size who can do division. What closes: the
budget marketing already carries ($3-4K across 2-3 channels) paid as a
flat production fee per channel, PLUS the 20% recurring. The money is
already in the plan; the pitch just has to stop pretending the rev
share is the compensation. Say "flat fee for the integration, rev
share so you care about retention, your program as a standing asset"
and I am listening. **Challenge 1.**

And one internal contradiction to fix before outreach: §13 times
creator content "late December" while the signed debate ledger says
February-March. February-March is right — it agrees with your own
"never buy January" rule and gives the beta cohort time to make the
app worth attaching my name to. **Challenge 2.**

## What ships under my name: the fidelity problem

The template format fixes what "Ada's program" can be: day names,
block sequence, week counts, lift and accessory layout, over the two
registered schemes. The progression — the loading, the autoreg, the
deloads — is IRONWAVE's engine. I am fine with that; the engine's
autoregulation is the reason to be in the app instead of my PDF. My
audience will not be fine discovering it on their own. If a viewer
buys "Ada's program" and week 3 the coach changes the volume, either
that is framed from the start — my structure, the app's coaching,
labeled — or it reads as bait-and-switch under MY name and I take the
damage. Non-negotiable: the app says, on the program and in the
library, "Structure by Ada. Coaching by IRONWAVE." (T1's receipts
help here: when the coach adjusts my program, the receipt names the
coach, not me.)

Which surfaces the real gap: the template schema has NO way to say
who made it. `schemaVersion: 1` carries a free-text `name` and
nothing else — no author, no description, no template identity, no
version. Today "Ada's Upper/Lower" and a random Discord JSON are
indistinguishable in-app. Before any partnership ships, the schema
needs a provenance slice (additive, `schemaVersion: 2`): `author`,
`desc`, `templateId`, `version`, validated and displayed at import,
on My Program, and on the shelf. **CP1.** And there is no shelf: H7
built import/export, but "2-3 named programs in-app" needs an actual
in-app library surface listing bundled partner templates, coach-gated
live, structure-preview free per TB3. **CP2.**

## Show me the money: attribution and reporting

The repo's attribution ruling is honest — no MMP, per-channel offer
codes, Play install referrer — and for my purposes offer codes are
actually fine: a code is store-verified, survives the app's
accounts-optional architecture, and gives my audience a founding-rate
discount, which is a better call-to-action than a bare link anyway.
What does not exist, anywhere, is the other half: nothing in the M
slices builds affiliate tracking, payout, statements, term length, or
a partner-facing number I can check. "20% recurring" with no
specified ledger is a handshake, and I have been stiffed on
handshakes.

The fix is cheap because RevenueCat already sees redemptions and
renewals server-side: (a) one per-creator offer code per store as the
attribution primitive; (b) a monthly partner statement generated from
RevenueCat/store data — redemptions, active subs from my code,
renewals, my 20% — as an ops macro, not a dashboard; (c) if the
analytics catalog ever wants product-side numbers ("programs
generated from template X"), the `template_id`/`source` property must
land before the September schema freeze, because the catalog is
closed and the freeze is real. **CP3.** Contract terms (rev-share
duration per subscriber, payment schedule, audit right) are the
owner-plus-attorney deal sheet, not code. **CP6.**

## The diligence you should assume I will do

My channel exists because I check. Before I attach my name:

- **I will diff your volume landmarks against the published RP grid,**
  because that is literally content my channel makes. Today
  `data.js:1404` says "SOURCE: Renaissance Periodization's" over the
  seeded values. The paywall-cynic report already escalated the
  divergence to a September-beta gate (CYN4); this consultation makes
  it a partnership gate too: no outreach email goes out while the
  grid, the comment, or the third-party names are findable, because
  the first thing an evidence-based creator does with your APK is
  what I just did. **Challenge 3.**
- **I will read your injury and recovery copy** for claims I would
  have to defend. The sports-science claim ceiling and the
  legal-scrub rules cover this; they need to have SHIPPED, not be
  planned.
- **I will test the lapse flow,** because "what happens to my viewers
  who subscribe and later cancel" is a comment-section question with
  my name in it. L4's detachment answers it well. Related contract
  point: if OUR partnership ends, athletes running my program keep
  it. Structurally already true — `programFromTemplate` copies, and
  removing a template from the shelf cannot reach into built
  programs — but true-by-accident is not a clause. Pin it with a
  test and put it in the deal sheet. **CP5.**

## What I want that you have not offered

- **The share-card slot.** The free tier's PR share cards are the
  app's stated viral loop. When the PR happens on my program, the
  card should say so — "PR on Ada's Upper/Lower" — because that line
  is my recurring payment in distribution, it costs one string, and
  it makes me promote harder than the 20% does. Provenance (CP1)
  makes it possible; both catalogs like everything else. **CP4.**
- **The support boundary, rewritten.** The support report routes
  "program-content questions... to the partner (the 20% affiliate
  buys that)." Half right. Methodology questions about my split: yes,
  my community handles those, gladly. But anything about the APP's
  behavior — why the coach changed my volume, billing, bugs — is
  yours, full stop, and the deal sheet says so in both directions. If
  your inbox forwards app questions to my DMs, the partnership dies
  in a month. **Challenge 4** (wording), folded into CP6's deal
  sheet.
- **Non-exclusivity, both ways.** At this fee level you are not
  buying category exclusivity from me, and I am not asking the app to
  carry only my program — a shelf with 2-3 credible names is better
  for all of us than a shelf with one. No engineering; deal sheet.
- **Your gate is my gate.** Marketing spends on creators only after
  the month-6 gate (1,000+ weekly actives, 4.5+ stars). Good —
  because I want the same evidence before I lend the name. Send the
  gate numbers in the outreach email; a pitch that leads with its own
  retention data is one I have never received from an app and would
  remember.

## Would I take the deal?

Flat fee in the $1,000-1,500 range per integration, 20% recurring on
my code's subscribers for the life of each subscription, provenance
and the co-branding line in-app, the share-card credit, a monthly
statement I can check against the store, the RP scrub verifiably done,
no-rug-pull in writing, non-exclusive both ways: **yes**, and I would
pitch the second video (the honest 3-month follow-up, which
outperforms launch videos anyway) before you asked. The deal as
currently written in one line of marketing prose — 20% recurring,
details TBD: **no**, and neither will the other two channels you
want, because we all charge flat rates for a reason and we all read
the same repo you just let me read.

## Challenge ledger (owner decisions)

1. **The pitch is flat + rev share, not rev-share-only** (the §8
   budget already funds it; make the offer say what the budget
   means). Decide the flat band per channel ($1-1.5K default).
2. **Creator timing contradiction:** §13's "late December" vs the
   debate ledger's February-March. Ratify Feb-Mar; it matches "never
   buy January" and the post-beta quality bar.
3. **Brand-safety gate on outreach:** no partnership outreach before
   the landmark divergence + third-party-name scrub are shipped and
   verifiable in the public build (extends CYN4's beta gate to the
   partnership track).
4. **Rev-share term:** per-subscriber lifetime vs first 12/24 months,
   and payment cadence — owner + attorney, in CP6's deal sheet.
5. **Support boundary wording:** replace "the 20% buys that" with the
   two-way routing rule (methodology to creator community as a
   courtesy; app behavior, billing, bugs never leave the app's
   inbox).

## Owner tasks

- [ ] Ratify challenges 1-2 (deal shape and timing) before any
      outreach email exists.
- [ ] Ratify challenge 3 (scrub gates outreach) alongside the
      cynic report's challenge 1 — same underlying work, two gates.
- [ ] Draft the partner deal sheet with the attorney (CP6): flat fee
      + 20% term, statement cadence and audit right, support routing,
      non-exclusivity, no-rug-pull, brand-safety reps, termination
      mechanics (code retired, shelf listing removed, athletes keep
      built programs).
- [ ] Decide the offer-code shape per store (discount depth; the
      founding-rate code is the natural default).
- [ ] Approve the "Structure by X. Coaching by IRONWAVE." co-branding
      line (and its es.js rendering) as the standard label.

## Engineer notes

Creator partnership rail (CP series). All additive; nothing touches
prescription; golden master untouched throughout.

- **CP1 - Template provenance (schemaVersion 2).** Additive optional
  fields on the template JSON: `author` (display string), `desc`,
  `templateId` (stable id), `version` (integer). `validateTemplate`
  accepts v1 and v2 (v1 imports keep working); `programFromTemplate`
  stamps provenance onto the program (additive `program.provenance`,
  backfilled absent in `migrateState`); import modal, My Program, and
  the shelf display "Structure by {author}. Coaching by IRONWAVE."
  via i18n keys in both catalogs. Extend `test/h7-twoday.test.js`
  round-trip + reject battery for v2. Rides H7.
- **CP2 - The named-programs shelf.** A small in-app library surface
  listing bundled partner templates (JSON assets shipped with the
  app, media-manifest pattern; no network needed), reachable from My
  Program / onboarding's template path. Coach tier activates a
  template live (`programFromTemplate` behind `hasCoach()` per TB3);
  free tier renders the structure preview (days/slots read-only) —
  TB3's "structure, never live programs" is the free taste by
  design. Rides H7 + TB3 + M4-era gating; L5's boundary checklist
  gains the shelf row.
- **CP3 - Attribution + statement rail.** Per-creator store offer
  codes (one per store per partner) as the only attribution
  primitive; a monthly partner-statement procedure from
  RevenueCat/store exports (redemptions, active subs, renewals, 20%
  computation) documented as a support-ops macro (CS), not a
  dashboard. If product-side counting is wanted, add
  `template_id`/`source` to the relevant catalog event BEFORE the
  September AN schema freeze; otherwise store-side numbers are the
  ledger of record. Rides M3 + AN3 + CS. No client code beyond the
  catalog property.
- **CP4 - Share-card credit line.** When the active program carries
  `provenance.author`, PR share cards append the "on {author}'s
  {template name}" line (free tier surface, both catalogs, rendered
  only when provenance exists so every current program is
  unchanged). Rides the productization epic's share cards + CP1.
- **CP5 - No-rug-pull pinned.** A test asserting that removing a
  template from the shelf (or a template file disappearing) leaves
  existing built programs fully functional — the copy semantics of
  `programFromTemplate` made contractual. Rides H7 tests; also a
  clause in CP6's deal sheet.
- **CP6 - The partner deal sheet (no code).** Owner + attorney
  artifact per the ledger: flat fee + rev-share term and cadence,
  audit right against store data, two-way support routing, mutual
  non-exclusivity, brand-safety reps (scrub shipped), termination
  mechanics, the co-branding line. Blocks outreach until it exists.

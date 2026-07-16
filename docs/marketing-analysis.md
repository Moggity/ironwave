# IRONWAVE: Marketing Analysis and Go-to-Market Report

Compiled 2026-07-16. Premise agreed with the owner: this analyzes a **hypothetical rebranded product**, as if the Juggernaut-derived methodology were reworked and original-branded so it could legally be sold. The current app is explicitly a non-commercial personal project built on Chad Wesley Smith's Juggernaut Method 2.0; section 4 covers what commercialization would legally require. All benchmark figures come from 2025-2026 web research and are tagged **SOURCED** (appears in a cited report) or **ESTIMATED** (derived or inferred). Full source list in the appendix.

---

## 1. Executive summary (the short answers)

- **Target audience:** intermediate-to-advanced barbell lifters ("powerbuilders"), roughly 60-75% male, aged 22-40, currently training off spreadsheets or paying $25-35/mo for JuggernautAI or RP Hypertrophy. Secondary: hypertrophy trainees priced out of RP's $224-299/yr. Tertiary but fastest-growing: women entering powerlifting (women 21-25 are growing ~13%/yr in IPF-affiliate registrations). A fourth, unconventional segment is real for *this* product: the self-hosted/privacy crowd (r/selfhosted, Hacker News), because IRONWAVE's architecture is something no incumbent can copy.
- **Potential revenue:** the honest planning bands, not the dream. A new fitness app has a ~17% chance of ever passing $1K MRR and ~5% of passing $10K MRR within two years (SOURCED, RevenueCat 2026). Realistic 24-month outcomes for a well-executed indie launch: $1-8K MRR; top decile $10K+. The niche ceiling is visible: Liftosaur (open-source, solo dev) ~$3K/mo; Hevy ~$2M ARR after ~5 years with zero paid marketing; JuggernautAI itself only ~$90K/mo (ESTIMATED); RP $20-30M/yr but on a decade of brand. Section 6 details three monetization scenarios.
- **Ad costs vs revenue:** at category-median funnel performance, paid ads are **underwater**: fitness CPI of $3.70-4.70 divided by a ~3% install-to-paid rate gives a CAC of **$130-190 per paying subscriber**, against a realistic net LTV of ~$35-113 depending on pricing. Paid acquisition only works after proving a top-quartile funnel (cost-per-trial <= $30, trial-to-paid >= 45%). Until then, the efficient channels are organic community distribution and creator integrations (influencer traffic runs 50-70% cheaper per install and retains better).
- **Average MRR:** two readings of the question, both answered. Per subscriber: the health & fitness category median is $7.73/mo list price, but *realized* revenue per paying subscriber is ~$2.50-4.00/mo after annual-plan proration and store fees, with a median realized LTV of $35.64 (SOURCED). Per app: the median new fitness app never reaches $1K MRR; a good year-two outcome is $3-8K MRR.
- **How it is marketable:** four honest differentiators: (1) own-your-data, offline-first, self-hostable - unique in the category and aligned with documented anti-subscription resentment in lifting communities; (2) coach-replacement-grade engine (wave periodization + autoregulated per-muscle volume) at an indie price against a $35/mo incumbent band; (3) sport-day-aware scheduling, which no mainstream lifting app captures; (4) PWA with no app-store toll, enabling web pricing incumbents cannot match.
- **Best platforms, ranked:** (1) YouTube integrations with evidence-based lifting channels ($25-45 CPM, the buyer's trusted medium); (2) Reddit, both organic (r/weightroom, r/Fitness, r/selfhosted) and paid ($0.30-0.80 fitness CPC, cheapest credible reach); (3) Hacker News / GitHub as a launch event (free, unique to this product's architecture); (4) build-in-public X/Twitter; (5) TikTok organic clips; (6) Meta paid - last, gated, and never in January.
- **Female model vs male athlete as flagship:** the evidence says this is the wrong axis. What drives sales for performance products is **expertise and aspirational-identity congruence, not endorser gender or attractiveness**. For a 60-75% male buyer pool, an attractiveness-led female model is the weakest option tested by the literature; a credentialed male athlete-coach is the safe pick; the strongest structure is a hybrid: an expert flagship plus a roster that includes an elite female *lifter* (not a model) to own the fastest-growing segment. At current scale, the cheapest credible "face" is the founder building in public. Section 9 has the full evidence chain.
- **What was missing from the question:** retention economics (they dominate acquisition), trademark clearance before any spend, the product changes marketing requires (billing, optional accounts), pricing psychology (annual-led, lifetime tier), seasonality discipline (never buy January), community as the only durable moat at indie scale, and a legal reserve for app-store takedown friction. Section 10 is the checklist.

---

## 2. Product and positioning audit

What is actually being sold (from the codebase, not aspiration):

**Strengths**

- A genuinely coach-grade engine: five-week wave-periodized strength blocks with AMRAP-driven working-max autoregulation, plus an RP-flavored hypertrophy scheme with per-muscle MEV/MRV volume landmarks, week-over-week volume autoregulation, deload resensitization, and intensity techniques (drop sets, myo-reps, rest-pause). Only two competitors do anything comparable (JuggernautAI, RP Hypertrophy) and both charge ~$35/mo.
- A split generator driven by seven muscle-focus sliders, 1-7 days/week including full-body, and calendar-day scheduling with a per-day "I compete in another sport" flag - the sport flag is a feature no mainstream lifting app captures (the groundwork for sport-aware scheduling).
- Offline-first installable PWA, no accounts, data on device or your own server, JSON export. Dark, iPhone-first UI. English and Spanish.
- Engineering credibility that markets itself to a technical audience: no build step, a 434-test suite, a golden-master contract on prescription math.

**Weaknesses (from a marketer's chair)**

- No billing, no accounts, no attribution: today there is literally nothing to buy and no way to measure a funnel. Any revenue scenario requires product work first.
- Self-host friction: `npm install && npm start` plus a Cloudflare tunnel for HTTPS install is trivial for r/selfhosted and a wall for everyone else.
- No social/community features, no exercise media in the default install, and a single-user data model.
- The methodology is derived from a named commercial product (see section 4); the current name and marketing cannot reference it.

**Positioning statement that survives the evidence:** "The coach-grade powerbuilding engine you own. Periodized strength waves plus science-based hypertrophy autoregulation, offline, private, and priced like a tool instead of a $420/yr subscription."

---

## 3. Target audience

| Segment | Who | Size signal | Willingness to pay | Priority |
|---|---|---|---|---|
| S1: Intermediate powerbuilders | Men 22-40, 2+ years under the bar, spreadsheet/Boostcamp users, JuggernautAI/RP payers and churners | Barbell communities ~72% male (USAPL data, SOURCED); JuggernautAI/RP hold thousands, not millions, of subscribers (ESTIMATED) | Proven at $25-35/mo by incumbents; resentful of it (SOURCED community sentiment) | Primary |
| S2: Hypertrophy trainees priced out of RP | RP-curious lifters who want autoregulated volume without $224-299/yr | RP Trustpilot 2.8 driven by pricing complaints (SOURCED) | $8-15/mo band | Secondary |
| S3: Women entering powerlifting | The fastest-growing lifter cohort: women were ~31% of new IPF-affiliate lifters in 2023; women 21-25 growing ~13.3%/yr vs 7.2% for men (SOURCED) | Compounding, underserved by hardcore apps | Same bands as S1/S2 | Deliberate year-one investment |
| S4: Self-hosters / privacy buyers | r/selfhosted (600K+ members), Hacker News, homelab crowd; overlap with lifters is small in share but huge in absolute numbers and free to reach | Liftosaur reached $36K ARR on this channel alone (SOURCED) | Prefers lifetime/one-time; converts to hosted convenience tiers | Unique wedge |

Demographic note used throughout: general fitness apps skew ~55-60% female, but *strength* app buyers skew the other way; 60-75% male is the working estimate for this product (ESTIMATED from community composition; no incumbent publishes splits).

---

## 4. Legal and IP constraints of the rebrand premise

Research summary, not legal advice.

- **The math is safe; the words are not.** Training methods, percentages, and set/rep schemes are unprotectable processes under 17 U.S.C. § 102(b), *Baker v. Selden* (1879), and, directly on point for fitness, *Bikram's Yoga College v. Evolation Yoga* (9th Cir. 2015): exercise sequences cannot be copyrighted, even as compilations (SOURCED). Reimplementing wave math in `engine.js` infringes nothing. What *would* infringe: shipping the book's prose, cue text, or tables as formatted.
- **Trademark is the real exposure.** No USPTO registration for "Juggernaut Method"/"JuggernautAI" surfaced in web-level searches (not a clearance search), but Juggernaut Training Systems has strong common-law rights and a live competing app. The Jim Wendler precedent is instructive: he cleared third-party "5/3/1" apps out of the stores with cease-and-desist letters; stores comply on cost asymmetry, not merits (SOURCED). Conclusion: zero "Juggernaut" or "RP" in the name, creative, or store keywords; MEV/MRV acronyms are low-risk generic science terms, but "Renaissance Periodization" is a registered mark (Reg. 5495258).
- **De-risking playbook:** rename; reimplement rather than reproduce; cite sports science rather than books; carry a truthful non-affiliation disclaimer; budget for takedown responses; or go the Boostcamp route and license/partner with the author, which is the only path that allows using the methodology names in marketing.

---

## 5. Market size and competitor teardown

- Global fitness app market: ~$12.1-12.9B (2025), ~13.5% CAGR (SOURCED, Grand View/Polaris). The serious-lifting niche is not sized by any analyst; triangulating from known player revenues puts it around **$200-350M/yr globally** (ESTIMATED).
- VCs have largely exited consumer fitness (SOURCED, Crunchbase News): the niche belongs to bootstrappers and creator brands. That is good news for an indie: the competition is disciplined but not capital-flooded.

| App | Monthly | Annual | Free tier | Scale signal |
|---|---|---|---|---|
| JuggernautAI | $34.99 | $349.99 | Trial only | ~$90K/mo revenue, <5K downloads/mo (ESTIMATED, low confidence) |
| RP Hypertrophy | $34.99 (perpetual $24.99 promos) | $299.99 ($224.99 promo) | No | RP overall: $20-30M/yr, ~80% from apps (SOURCED, self-reported) |
| Fitbod | $15.99 | $95.99 | Trial only | Category revenue leader among generators (ESTIMATED) |
| Boostcamp | ~$15 | $59.99 | Yes, generous | 1M+ lifters claimed (SOURCED, self-claim); VC-backed |
| Hevy | ~$9.99 | ~$59.99 | Yes, generous | ~$2M ARR 2024, 2M+ downloads, zero paid marketing (SOURCED) |
| Alpha Progression | $9.99 | ~$70 | Limited + trial | German indie (scale unknown) |
| KeyLifts | $8.99 | $52.99 + $199.99 lifetime | Limited | Sustainable niche 5/3/1 app |
| Strong | $4.99 | $29.99 | Yes, capped | Legacy tracker |
| Liftosaur | free/OSS | donation/sub | Fully free core | $36K ARR solo dev (SOURCED) |

Three pricing bands: **trackers ($3-10)**, **AI generators ($12-16)**, **coach replacements ($25-35)**. IRONWAVE's engine belongs to the third band; its brand equity (none) belongs to the first. That tension defines the whole strategy.

Two market-mood facts that matter more than the size number: (1) "AI coach" is the default premium pitch holding the $30+ band; (2) anti-subscription resentment is loud and documented in exactly the communities that buy these apps: Hevy and Boostcamp built their growth on weaponized generosity (SOURCED).

---

## 6. Monetization scenarios and revenue potential

All scenarios assume the section-4 rebrand. Store fee assumed 15% (small-business tier) where store billing is used; ~3% via web/Stripe.

### Scenario A: Open-core indie (lowest risk, recommended start)

Free, open-source, self-hosted core as the marketing wedge; paid **hosted sync + convenience tier at $39-49/yr, plus a $99-149 lifetime** tier. Web billing only.

- Math at $49/yr: 250 payers = ~$1.0K MRR-equivalent; 1,000 payers = ~$4.1K; 2,500 payers = ~$10.2K.
- 24-month realistic outcome: **$1-5K MRR** (Liftosaur's $3K/mo is the proven floor for a worse-packaged product on the same channels; ESTIMATED band).
- Costs: near-zero media; ~$2-3K legal/brand; opportunity cost is the real spend.

### Scenario B: Standard indie SaaS (the orthodox play)

Closed source, native app-store wrappers, **$14.99/mo / $99.99/yr**, 14-day trial, annual-led hard-ish paywall, $199 lifetime at launch.

- Net LTV per annual subscriber: ~$113 via store, ~$130 via web (ESTIMATED from the ~25% H&F first-renewal rate).
- Requires: accounts, billing infra, attribution, and a five-figure creator budget to have any funnel to measure.
- 12-month realistic outcome: **$3-8K MRR with competent execution and ~$30-60K total spend**; the "8-10K subscribers year one" ambition contradicts published base rates (only 4.6% of new apps ever see $10K MRR; JuggernautAI itself sits at a few thousand subscribers). 24-month good case: **$10-25K MRR** (ESTIMATED).

### Scenario C: Creator-partnered premium (highest ceiling, needs a partner)

License the credibility instead of renting reach: partner with an established evidence-based coach (the Boostcamp/RP pattern), price at **$19.99-24.99/mo**, rev-share 20-30%.

- This is the only scenario with a path past ~$50K MRR, because the $25-35 band is bought on faces and IRONWAVE does not have one.
- It is also the only scenario where the methodology-name problem can invert into an asset (a licensed program is marketable by name).
- Realistic only after Scenario A or B proves retention; no credible coach partners with an app that has no users.

**The "average MRR" answer, stated plainly:** per paying subscriber, expect ~$2.50-4.00/mo realized (category median list price $7.73/mo, median realized LTV $35.64; SOURCED). Per app, the median new fitness app plateaus below $1K MRR; a good outcome for this product is $3-8K MRR at 24 months, and anything past $10K puts it in the top ~5% of all new subscription apps (SOURCED base rates, ESTIMATED application).

---

## 7. Ad costs vs revenue: the CAC/LTV model

The chain, using 2025-2026 sourced benchmarks (US; EU runs 50-75% of these costs):

```
CPI (fitness):        $3.70-4.70 blended ($1.75-4.00 TikTok, $2.00-5.50 Meta)
install -> trial:      ~10-11% median (top 5%: 12-15%)
trial -> paid:         ~37-40% median (top quartile: 51%+)
install -> paid:       ~3-4%
=> CAC per payer:      $130-190 at median performance   [SOURCED inputs, ESTIMATED chain]
Benchmark CAC:         $100-300 for fitness subscription apps [SOURCED]
```

Against Scenario B's ~$113-130 net LTV, **median paid performance loses money on every subscriber**. Payback exists only in the top-quartile funnel: cost-per-trial <= $30 with trial-to-paid >= 45% brings CAC to ~$55-65 and LTV:CAC to ~2:1 in year one, improving with survivor-effect renewals (second-year renewal rates jump to 44-64%).

Practical rules this implies:

1. **Paid ads are a reward for a proven funnel, not a launch strategy.** Turn them on only after organic/creator channels demonstrate the conversion gates above.
2. **Creator integrations beat display math:** influencer-driven installs run 50-70% cheaper and retain better (SOURCED); a 60-90s integration on a 50K-view evidence-based lifting channel costs ~$700-1,500 against $25-45 CPM norms, with 20-25% recurring affiliate codes aligning incentives.
3. **Seasonality discipline:** January CPI spikes to ~$31 on Meta while January cohorts churn worst (the resolutioner paradox, SOURCED). Harvest January organically; buy February-March and the May-June cut season.
4. **Reddit is the sleeper channel:** $0.30-0.80 fitness CPC (SOURCED), the cheapest credible reach to the exact buyer, and the only ad platform whose users are also the organic community target.

Illustrative budget-to-revenue at Scenario B pricing (ESTIMATED): $10K creator spend at $60 effective CAC yields ~165 payers = ~$16K first-year gross; $10K Meta spend at median $150 CAC yields ~65 payers = ~$6.5K. Same money, 2.5x difference; both numbers stay small, which is the honest point: at this scale, distribution must be mostly earned, not bought.

---

## 8. Platform strategy, ranked

1. **YouTube (evidence-based lifting niche): the conversion channel.** The buyer already spends hours with Nippard-style content; integrations price at $25-45 CPM; expertise-context matches the product. Start with 2-3 sub-100K channels, dedicated review > integration > pre-roll.
2. **Reddit: the community channel.** Organic first (r/weightroom program threads, r/Fitness, r/powerbuilding, r/selfhosted for the wedge), paid second ($0.30-0.80 CPC). Rules of engagement: transparent founder flair, value-first posts, never astroturf; lifting subs have long memories.
3. **Hacker News / GitHub: the launch-event channel (unique to this product).** "Show HN: a self-hostable, offline-first powerbuilding coach" is a credible front page; 2K GitHub stars is a permanent, free acquisition asset no competitor can replicate without open-sourcing their moat.
4. **X/Twitter build-in-public: the founder-as-face channel.** Documented pattern: solo-dev apps inflect after building in public (Habit Pixel $0 to $1K MRR in 8 months; SOURCED, self-reported). Weekly numbers + training receipts compound into distribution.
5. **TikTok: the top-of-funnel wildcard.** Cheapest fitness CPI when paid ($1.75-4.00) and organic clips can hit, but the audience skews younger/more casual than the core buyer; use for S3 and S2, not S1.
6. **Meta (IG/FB): the scale channel, last.** $20.70 health CPM and rising; only after funnel proof, only in Feb-Mar/May-Jun windows, and EU-first for the 25-50% cost discount.
7. **Podcast/newsletter sponsorships in strength media:** worth testing at small scale for S1 credibility (BarBend-adjacent, Stronger by Science audience).

Web-first billing threads through all of it: selling through the PWA + Stripe keeps ~97% of revenue vs ~85% through stores, and RP itself steers its best deal through the web (SOURCED). An app-store presence is a month-9+ experiment for ASO reach, not a launch requirement.

---

## 9. Flagship athlete: female model vs male athlete

The question as asked ("would a female influencer model or a man sell more?") turns out to be the wrong axis, and the evidence is unusually consistent about what the right axis is.

**What the buyer pool looks like.** Serious-lifting app buyers are an estimated 60-75% male (barbell communities ~72% male by competition data; SOURCED for communities, ESTIMATED for apps). But the fastest-growing cohort is young women entering powerlifting (SOURCED). So the core is male today and diversifying fast.

**What the endorsement literature says.**

- For performance products, **expertise beats attractiveness** on purchase intent, replicated across the match-up literature (Till & Busler) and fitness-specific studies; attractiveness never leads (SOURCED).
- The strongest replicated effect is **ideal-self congruence**: buyers convert on endorsers who embody who they want to become. A serious male lifter's aspirational self is "a stronger, more muscular me," which an attractiveness-led female model does not represent, however much attention she draws.
- Attention is not conversion: female fitness models on Instagram can carry >60% male "thirst-follow" audiences that engage heavily and buy nothing in this category (SOURCED composition, ESTIMATED conversion gap). Sex appeal in *brand* creative also carries documented backlash risk that an influencer's own account does not (SOURCED).
- No study directly tests male-vs-female flagship faces for strength-app conversion; everything here is triangulation, stated as such.

**What the case studies say.**

- Female-face app businesses succeed brilliantly **selling women's training to women**: EvolveYou (Krissy Cela) + Oner Active exceed $34M/yr combined; Alive (Whitney Simmons) an estimated $0.5-1M+/yr. They are evidence for congruence, not for putting a female model in front of male barbell buyers.
- The inverse case proves the rule: **Bret Contreras**, a male PhD, sells successfully to an almost entirely female audience on expertise. Expertise crosses gender lines; attractiveness-led endorsement generally does not.
- **Sam Sulek** shows raw male reach is not economics either: enormous audience, weak durable brand outcomes (left Hosstile within a year).
- The category templates: RP fronts an expert (Dr. Mike) with a mixed athlete roster; Juggernaut fronts an elite coach (Chad Wesley Smith) similarly.

**Verdict.**

1. If forced to one face: a **credentialed male athlete-coach** converts the current buyer pool best. This is the evidence speaking, not taste.
2. An attractiveness-led female *model* is the weakest tested option for this product: aspirationally incongruent with the core buyer, backlash-prone in brand creative, and its engagement metrics systematically overstate conversion.
3. A female **elite lifter** (not a model) is a strong pick, but as the S3 spearhead within a roster rather than the sole flagship, because S3 is ~25-30% of the pool today.
4. The best *structure* is the hybrid the incumbents use: expert flagship for credibility and pricing power + mixed-gender athlete roster, with the female athlete owning the fastest-growing segment.
5. At the product's actual scale (zero revenue), the correct flagship is **the founder building in public**, plus purchased integrations with evidence-based channels. Retainer-plus-revshare flagship deals are a Scenario C move, made after retention is proven.

**What actually drives sales, condensed:** audience-identity congruence x perceived expertise x reach, in that order of importance. Gender is a proxy variable people argue about because it is visible; congruence is the variable that moves revenue.

---

## 10. What else was missing (the "what am I forgetting" checklist)

1. **Retention beats acquisition, always:** ~35% of annual subscribers cancel auto-renew in month one; first-year annual renewal is only ~25% (SOURCED). A single onboarding/week-5 deload experience improvement is worth more than any ad campaign.
2. **Trademark clearance and a takedown reserve** before a single dollar of brand spend (section 4).
3. **The product changes marketing requires:** billing (Stripe), optional accounts/sync (the paid SKU and the attribution point), a landing page with a demo, and analytics with consent. Today nothing is purchasable.
4. **Pricing psychology:** annual-led paywalls (68% of category subs are annual), a lifetime tier as the anti-subscription statement, launch-cohort grandfathering.
5. **Attribution/analytics:** without an MMP or at least UTM+Stripe linkage, creator spend cannot be evaluated; plan it with the billing work.
6. **Community as the moat:** a Discord/forum where programs and results circulate is the only defensible asset at indie scale; engines can be copied, communities cannot.
7. **Referral loops:** lifting is social; a give-a-month/get-a-month scheme is cheap to build and the category's proven organic multiplier (Hevy's growth was social/viral, not paid).
8. **App-store strategy as a choice, not a default:** PWA-first keeps 97% of revenue and pricing freedom; stores add ASO reach and trust later. Decide deliberately at ~month 9.
9. **Health-claims compliance and liability:** training advice to the public needs disclaimers, and ad platforms restrict health claims; readiness/fatigue language must stay away from medical territory.
10. **Localization as an underpriced lever:** EN/ES already ships; Spanish-language lifting content is dramatically less competitive in every channel above (ESTIMATED).
11. **Seasonality calendar:** organic January, paid Feb-Mar and May-Jun, creative testing in Q1, never Q4 (SOURCED cost patterns).
12. **Support and ops load:** self-hosted users generate GitHub issues, hosted users generate support tickets; budget founder time before scaling either.
13. **Churn-save and win-back flows:** month-1 cancellation is the single biggest leak in the category; exit surveys and pause offers are standard kit.
14. **A kill/scale decision framework:** pre-commit the gates (e.g. cost-per-trial <= $30, trial-to-paid >= 45%, month-12 MRR >= $3K) so the project scales or stops on evidence, not sunk cost.

---

## 11. The debate: textbook CMO vs contrarian operator

Per the owner's request, the plan was stress-tested through a staged three-round exchange between two personas: **Alex Varga** (by-the-book subscription-app CMO) and **Rook** (contrarian growth operator who believes the rulebook is written for funded companies). Both argued from the same research briefs. The rounds are reproduced condensed; the synthesis follows in section 12.

### Round 1: Alex Varga's orthodox plan (condensed)

"The product is strong and the current distribution shape is unmarketable." Alex's plan: full rebrand with trademark clearance; price at $14.99/mo / $99.99/yr (top of the AI-generator band: "we lack the brand equity that holds $30+, but tracker pricing throws away a coach-grade engine"); hard-ish annual-led paywall plus a $199 lifetime tier as the anti-subscription answer. Acquisition: a $500K first-year media model led by creators (40%), with Meta/TikTok paid gated behind funnel proof (cost-per-trial <= $30, trial-to-paid >= 45%), Apple Search Ads, and Reddit; no paid spend into January; scale Feb-Mar and cut season; EU as the efficiency valve. Flagship: "no female-model face; a credentialed male athlete-coach flagship backed by a mixed-gender roster including an elite female powerlifter" on retainer + 20-25% recurring rev-share. Product demands: native app-store wrappers, accounts + cloud sync, subscription infrastructure, and sunsetting the self-hosted distribution ("it cannot cannibalize the paid SKU"). Year-one KPI: 8-10K paying subscribers, $70-85K MRR.

### Round 2: Rook's counter (condensed)

"It's the plan I'd write if a fund had just wired us $2M. Neither of those things is true."

- **The $500K budget is fiction** for a solo dev with zero revenue, and Alex's own math shows median paid acquisition is underwater ($130-190 CAC vs $113 net LTV); the gates he set are top-quartile performance assumed on day one.
- **The year-one KPI contradicts the base rates Alex himself cited:** 4.6% of new apps ever reach $10K MRR, and JuggernautAI itself, with a decade of brand, sits at roughly a few thousand subscribers. "Write the KPI at $3-5K MRR and I'll take you seriously."
- **Sunsetting self-hosted kills the only free distribution the product has.** No incumbent can go open-source or say "your data never leaves your device"; Hevy did 2M+ downloads with zero paid marketing by weaponizing generosity; "Show HN: a self-hostable JuggernautAI-class engine" is a free front page.
- **The app store is a toll booth, not a requirement:** RP sells its best deal through the web; Stripe keeps ~97% vs ~85%; the PWA already exists. Store presence is a month-9 experiment.
- **A hired flagship at this scale is lighting money on fire.** Same read of the endorser evidence, different deal: buy YouTube integrations at $25-45 CPM ($700-2,250 per placement) with 20% affiliate codes instead of retainer + rev-share forever, and make the founder the face; "solo-dev-with-receipts is the aspirational identity of a spreadsheet lifter."
- Counter-plan: open-core (free self-hosted core as the wedge), hosted sync at $39-49/yr + $99-149 lifetime priced as the attack on the $35/mo band ("JuggernautAI charges $420/yr. This is $49, or yours forever, and you can read the code"), Reddit as the only paid channel worth testing, and three this-quarter moves on a $0-10K budget: trademark clearance, open-source launch as the marketing event, and web billing plus 2-3 creator integrations.
- Concessions to Alex: trademark-first is right; January discipline is right; the funnel math itself is right; and accounts/sync eventually become the paid SKU.

### Round 3: Alex's rebuttal and final concessions (condensed)

"A disciplined operator updates on evidence. Here's where you've won, and where you're overcorrecting."

- **Conceded fully: the budget.** "$500K working media for a pre-revenue solo dev was a template number, not a budget. Withdrawn. Media spend scales from revenue, not from hope." The conversion gates stand; the dollar figure attached to them does not.
- **Conceded fully: the year-one KPI.** "You beat me with my own citations." Revised target: **$3-5K MRR at month 12, $10K as the top-decile stretch.**
- **Conceded partially: the flagship deal.** Buy integrations at $25-45 CPM with 20% recurring affiliate codes rather than sign retainer+rev-share liabilities - accepted. But founder-as-face has a demonstrated ceiling (~$1K MRR in the cited build-in-public case), and every app holding a premium price rents credentialed expertise; "ideal-self congruence for our buyer is built on receipts under a barbell, not commit history." Resolution: founder-as-face to ~$5K MRR, credentialed athlete-coach as a revenue-funded upgrade after.
- **Held: the open-source channel converts tinkerers, not subscribers.** Show HN reaches sysadmins; the S1 buyer "is a 28-year-old on Boostcamp who has never run Docker," and Liftosaur's $36K ARR is what that channel converts to. Concession within the hold: sunsetting self-hosted was wrong - keep the open core as the wedge and trust signal ("genuinely uncopyable by RP"), but treat it as the trust layer of the funnel, not the funnel.
- **Held, hard: pricing.** Web-first Stripe billing conceded (97% vs 85% is arithmetic), but $39-49/yr with a $99 lifetime "prices us into the economy where no acquisition channel ever pays back" - the category's $29.65 median annual is exactly what produces its $35.64 median LTV, and a cheap lifetime "sells the renewal compounding once, to our best customers." Answer anti-subscription sentiment with open code, data export, and a premium $199+ lifetime; hold $89-99/yr.

**Joint ground truth both signed:** (1) trademark clearance and full rename is the first dollar spent; (2) paid media is gated, never assumed - no channel scales without cost-per-trial <= $30, and January is never bought; (3) hosted sync on the open core is the paid SKU, web-first billing, offline-first preserved.

**Left unresolved by the debaters:** the exact price point ($39-49 vs $89-99 annual), and whether the face ever graduates from founder to hired athlete-coach. The synthesis below rules on both.

---

## 12. The integral plan (synthesis)

The debate converged on more than it split on. The integral plan adopts the joint ground truth wholesale, rules on the two open fights, and phases Alex's discipline on top of Rook's distribution.

**Ruling 1 - price:** Alex wins on structure, Rook wins on theater. **$89/yr hosted tier** (the economics need it: renewal compounding is the business), with a **$59 founding-member first year** for the launch cohort (Rook's attack pricing, time-boxed so it doesn't set the reference price), a **$199 lifetime** positioned as the premium anti-subscription statement (never $99: cheap lifetimes sell the compounding once), and the **free tier is self-hosting itself** - which resolves the free-vs-paywall dilemma in a way no competitor can copy: the generous free tier and the open-source wedge are the same artifact.

**Ruling 2 - the face:** sequenced, not chosen. Founder-as-face (build in public, training receipts, weekly numbers) from day one at zero cost; purchased integrations with evidence-based YouTube channels as the reach multiplier; a credentialed athlete-coach flagship evaluated only past ~$5K MRR, financed by revenue; an elite female lifter joins the roster with the S3 push. At no stage is model-led brand creative on the table - both debaters and the evidence agree it is the weakest option for this buyer.

### Phase 0 - Legal and identity (month 0-2, ~$2-3K)

1. New name; real USPTO/TSDR clearance; zero "Juggernaut"/"RP" in name, copy, keywords; original coaching text throughout; non-affiliation disclaimer; small takedown-response reserve.
2. Landing page with live demo + email waitlist. Nothing else ships before this phase closes.

### Phase 1 - Distribution before monetization (month 2-5, ~$0-1K)

3. Open-source launch as a marketing event: public repo, Show HN, r/selfhosted, r/weightroom program-review thread, GitHub topic pages. Target: 2K stars, 500 self-host installs - this is the waitlist and the trust layer, not the revenue.
4. Founder build-in-public cadence on X + Reddit: weekly numbers, real training data, engine deep dives.
5. Instrument everything consented: UTM-to-waitlist linkage now, so Phase 2 spend is measurable.

### Phase 2 - Monetization and creator proof (month 5-9, ~$5-8K)

6. Ship Stripe web billing + optional accounts/hosted sync (offline-first preserved; sync is the SKU). Pricing per Ruling 1.
7. Buy 2-3 integrations on sub-100K evidence-based lifting channels ($700-2,250 each at $25-45 CPM) with 20% recurring affiliate codes; run one Reddit ads test ($0.30-0.80 CPC). Measure cost-per-trial against the $30 gate.
8. Open the community space (Discord); ship give-a-month/get-a-month referral.

### Phase 3 - Scale what proved (month 9-18, revenue-funded)

9. Any channel that beat the gates gets budget in the Feb-Mar window and the May-Jun cut season; January is harvested organically with content shipped in December.
10. App-store wrapper experiment (ASO + Apple Search Ads reach vs 15% toll) - decided on data, not defaults.
11. Past $5K MRR: open the Scenario C conversation (credentialed coach partner or athlete-coach flagship), and spearhead S3 with an elite female lifter on the roster.
12. Localized push on the ES build (underpriced channel, already shipped).

### Budget vs expected revenue (24 months, ESTIMATED)

| Phase | Spend | Expected MRR exit |
|---|---|---|
| 0: Legal + identity | $2-3K | $0 |
| 1: Distribution | $0-1K | $0 (2K stars, 500 installs, waitlist) |
| 2: Monetization + creators | $5-8K | $1-3K |
| 3: Scale (revenue-funded) | 30-40% of MRR | $3-8K (top decile: $10K+) |

### KPIs and kill/scale gates

- Phase 1 gate: 2K GitHub stars / 500 installs / 1K waitlist by month 5, or revisit positioning before spending on creators.
- Phase 2 gates: cost-per-trial <= $30; trial(or waitlist)-to-paid >= 40%; month-1 cancel rate < 35%.
- Phase 3 gate: month-12 MRR >= $3K scales the plan; month-12 MRR < $1K triggers the honest conversation about keeping it a beloved open-source project instead (which, given an 80%+ base rate of apps never passing $1K MRR, is the statistically likely and perfectly respectable outcome).

The one-sentence version of the whole plan: **let the open, self-hosted architecture do the free marketing that no incumbent can copy, charge for convenience rather than access, buy credibility by the view instead of by the face, and only spend real money on channels that have already proven they pay back.**

---

## 13. Sources and assumptions appendix

**Method:** five parallel research passes (market/competitors, subscription unit economics, ad costs, endorser-gender evidence, IP) conducted 2026-07-16 against 2025-2026 public sources; figures cross-checked across at least two sources where possible. SOURCED = stated by a cited source. ESTIMATED = derived, triangulated, or inferred; treat as directional.

**Known weak points:** JuggernautAI revenue/download figures are single-source and low confidence; strength-app gender splits are inferred from community composition, not disclosed; EU ad-cost discount is a heuristic; monthly-churn figures for fitness come from unaudited aggregators; several benchmark pages (RevenueCat, WordStream, Business of Apps) block direct fetching and were verified via multiple independent summaries.

**Key sources**

- RevenueCat State of Subscription Apps 2025/2026: https://www.revenuecat.com/state-of-subscription-apps and https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026/
- RevenueCat renewal rates by category: https://www.revenuecat.com/blog/growth/average-subscription-renewal-rates-by-app-category/
- Adapty health & fitness benchmarks: https://adapty.io/blog/health-fitness-app-subscription-benchmarks/
- Airbridge fitness UA metrics: https://www.airbridge.io/blog/cost-per-trial-cost-per-subscription-subscription-app-ua-metrics-fitness-app
- Grand View Research fitness app market: https://www.grandviewresearch.com/industry-analysis/fitness-app-market
- Competitor pricing: https://www.juggernautai.app/pricing ; https://rpstrength.com/pages/hypertrophy-app ; https://www.boostcamp.app/ ; https://help.strongapp.io/article/132-strong-pro ; https://alphaprogression.com/en/subscribe
- RP revenue (founder disclosures): https://www.thecomeup.co/p/how-rp-strength-hit-25m-bootstrapped
- Hevy scale: https://www.starterstory.com/hevy-breakdown ; https://obj.ca/fitness-app-entrepreneur-pumped-by-hevys-progress-to-2m-in-annual-revenue/ ; https://www.revenuecat.com/blog/growth/guillem-ros-hevy-podcast/
- Liftosaur: https://www.starterstory.com/liftosaur-breakdown
- Ad benchmarks: https://www.triplewhale.com/blog/facebook-ads-benchmarks ; https://www.triplewhale.com/blog/tiktok-benchmarks ; https://www.businessofapps.com/ads/cpi/research/cost-per-install/ ; https://adbacklog.com/blog/reddit-ads-benchmarks-per-industry-2025 ; https://www.rocketshiphq.com/meta-cost-benchmarks-mobile-app-installs/
- Influencer rates: https://www.meltwater.com/en/blog/influencer-marketing-costs-rates-pricing ; https://influencermarketinghub.com/influencer-rates/ ; https://sponsorradar.com/insights/youtube-sponsorship-rates-what-brands-should-pay
- Affiliate norms: https://insertaffiliate.com/blog/affiliate-commission-models-subscription-fitness-apps-percentage/
- Endorser research: Till & Busler (attractiveness vs expertise): https://www.researchgate.net/publication/235312446 ; congruence effects: https://www.emerald.com/jpbm/article/34/3/265/1245618 ; fitness endorser credibility: https://pmc.ncbi.nlm.nih.gov/articles/PMC10968593/ ; brand vs influencer sex appeal: https://www.sciencedirect.com/science/article/pii/S0148296325003340
- Audience composition: https://barbend.com/usa-powerlifting-federation-data-study/ ; https://powerliftingindata.com/posts/2024/10/13/growth-by-gender-and-age.html ; https://www.cdc.gov/mmwr/volumes/71/wr/mm7118a6.htm ; https://www.modash.io/find-influencers/fitness/female
- Case studies: https://www.forbes.com/profile/evolveyou/ ; https://www.builtbyfoundry.io/blog/whitney-simmons-alive-app-fitness-creator ; https://bootybybret.com/ ; https://www.stack3d.com/2024/06/sam-sulek-parting-ways-with-hosstile.html ; https://hypeauditor.com/youtube/UC68TLK0mAEzUyHx5x5k-S1Q/
- IP: https://supreme.justia.com/cases/federal/us/101/99/ (Baker v. Selden) ; https://cdn.ca9.uscourts.gov/datastore/opinions/2015/10/08/13-55763.pdf (Bikram) ; https://supreme.justia.com/cases/federal/us/499/340/ (Feist) ; https://www.theironden.com/forum/threads/5-3-1-phone-apps-l-k.11673/ (Wendler C&D) ; https://trademarks.justia.com/874/29/renaissance-87429014.html
- Seasonality/churn: https://digitalyieldgroup.com/blog/health-fitness-apps-the-resolutioner-churn-problem/ ; https://9to5mac.com/2026/05/27/new-report-shows-annual-app-subscribers-rarely-return-after-they-cancel/
- Indie base rates: https://ppc.land/the-app-middle-class-is-dying-and-revenuecats-data-shows-exactly-how-fast/ ; https://www.start.io/blog/report-80-of-mobile-apps-fail-to-earn-1000-month-in-subscription-revenue/ ; https://www.indiehackers.com/post/from-0-to-1k-mrr-in-8-months-bootstrapping-habit-pixel-as-a-solo-dev-53d8687d15

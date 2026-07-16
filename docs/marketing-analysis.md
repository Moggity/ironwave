# IRONWAVE: Marketing Analysis and Go-to-Market Report (v2)

Compiled 2026-07-16, revised same day after owner review. **Corrected premise, binding on everything below:** the current self-hosted PWA is the *prototype stage only* — its shape is not the product. The market product is a **closed commercial app** whose final form (native apps, cloud accounts, store distribution, billing) is a decision *output* of this analysis. Open-source/self-hosted distribution is out of scope. Resource posture: **bootstrapped solo developer** (~$10-30K working capital plus founder time). The central question the owner asked v2 to decide: **what and how to sell** — freemium vs free trial vs hard paywall vs hybrid, subscription vs lifetime, store vs web billing, price points.

All benchmark figures come from 2025-2026 web research (seven research passes) and are tagged **SOURCED** (appears in a cited report) or **ESTIMATED** (derived or inferred). Full source list in the appendix. The v1 of this document anchored on the prototype's architecture and let it bias the strategy; v2 was re-debated and rewritten from the corrected premise.

---

## 1. Executive summary (the short answers)

- **What and how to sell (the v2 ruling, argued in section 6 and the debate):** a **staged hybrid**. Ship a genuinely good free logger tier (unlimited logging, share cards, PR celebrations, HealthKit) as the distribution asset, and sell **the coach** — waves, volume landmarks, autoregulation, split generator, readiness — behind an onboarding paywall with a **14-day trial**. Pricing **$12.99/mo, $79.99/yr, $249 lifetime** (with a $59.99 founding-member first-year annual intro), localized from day one, sold **IAP-primary** (Apple Small Business 15%), web checkout reserved for win-backs. One public launch in the autumn with **both tiers live from v1.0** — beta in September, launch in October — so ratings and keyword rank exist before January without ever retrofitting a paywall onto free users. The full reasoning, including why not a pure hard paywall (10.7% conversion but zero distribution) and why not pure freemium (2.1% conversion, no social graph yet), is in sections 6 and 12.
- **Target audience:** intermediate-to-advanced barbell lifters ("powerbuilders"), roughly 60-75% male, aged 22-40, currently on spreadsheets or paying $25-35/mo for JuggernautAI or RP Hypertrophy. Secondary: hypertrophy trainees priced out of RP. Fastest-growing: women entering powerlifting (women 21-25 growing ~13%/yr in IPF-affiliate registrations).
- **Potential revenue:** honest planning bands. A new fitness app has a ~17% chance of ever passing $1K MRR and ~5% of passing $10K within two years (SOURCED, RevenueCat). With the staged-hybrid model executed well: **$2-5K MRR at month 12, $6-18K at month 24** (ESTIMATED); the niche's visible outcomes are Strong (~$500K/mo, ESTIMATED), Hevy (~$2M ARR at year 5, SOURCED), JuggernautAI (~$90K/mo, ESTIMATED low confidence), RP ($20-30M/yr on a decade of brand, SOURCED).
- **Ad costs vs revenue:** at category-median funnel performance paid ads are underwater — fitness CPI $3.70-4.70 against ~3% install-to-paid means **$130-190 CAC per paying subscriber** vs a net LTV of roughly $85-110 at the recommended pricing. In this niche specifically, *no comparable app grew on paid ads* (SOURCED): Hevy did 2M+ downloads on ~$15K, Strong compounds a 4.9-star ASO moat, Boostcamp rides creator audiences. Paid remains a gated, seasonal, post-proof channel; the working budget goes to creator program partnerships instead.
- **Average MRR:** per paying subscriber, realized revenue is ~$2.50-4.00/mo (category median list $7.73/mo, median realized LTV $35.64; SOURCED). Per app, the median new fitness app never reaches $1K MRR; a good year-two outcome for this product is the $6-18K band above.
- **How it is marketable:** (1) a genuinely coach-grade engine (wave periodization + autoregulated per-muscle volume) in a market whose comparable products cost $25-35/mo; (2) an onboarding that is *already* a personalization quiz (sliders, days, sport flags) — the highest-converting funnel pattern in fitness, owned as real product mechanics; (3) sport-day-aware scheduling no mainstream lifting app captures; (4) offline-first behavior as a premium *feature* (gyms with no signal), inherited from the prototype; (5) EN/ES localization already built — and price localization is the highest-ROI experiment on record (+62.3% LTV, SOURCED).
- **Best platforms, ranked (v2):** (1) the app stores themselves — long-tail ASO, a ratings engine, Apple featuring nomination; (2) YouTube evidence-based lifting channels — as *permissioned program partners* with recurring affiliate terms, not just ad reads; (3) Instagram/TikTok via user-generated share cards (the Hevy loop); (4) Reddit organic + cheap paid tests; (5) TikTok organic; (6) Meta paid, gated and seasonal; (7) strength podcasts/newsletters.
- **Female model vs male athlete flagship:** unchanged by the premise correction, because the evidence is about buyers, not architecture. What drives sales is **expertise and aspirational-identity congruence, not endorser gender or attractiveness**. An attractiveness-led female model is the weakest tested option for this buyer pool; a credentialed male athlete-coach is the safe single pick; the strongest structure is an expert flagship plus a mixed roster where an elite female *lifter* (not a model) spearheads the fastest-growing segment. At bootstrap scale, credibility is bought by the view (creator integrations/partnerships), not signed as a retainer flagship. Section 10.
- **What else was missing:** the productization gap itself (section 2 prices it), retention economics over acquisition, ratings velocity as a compounding asset, trademark clearance before any brand spend, paywall/price A/B discipline (200-500 conversions per variant), refund exposure of hard paywalls, win-back flows, seasonality discipline, and pre-committed kill/scale gates. Section 11.

---

## 2. The prototype-to-market gap

What exists today is a strong engine in a prototype wrapper. Marketing this product does not start with ads; it starts with productization. Costed from the 2025-26 research (SOURCED tool/infra pricing, ESTIMATED effort):

**What exists and carries over as product value**

- The training brain: five-week wave-periodized strength blocks with AMRAP-driven working-max autoregulation; an RP-flavored hypertrophy scheme with per-muscle MEV/MRV volume landmarks, weekly volume autoregulation, deload resensitization, intensity techniques (drop sets, myo-reps, rest-pause); a split generator driven by seven muscle-focus sliders; 1-7 days/week; calendar days with per-day sport flags (a feature no mainstream lifting app captures); readiness scoring; plate math; rest timers.
- An onboarding flow that is already a personalization quiz — the exact pattern (one input per screen, a generated-program reveal) that tops fitness conversion benchmarks.
- Offline-first behavior — reframed from a distribution model into a *premium feature*: the app works in a basement gym with no signal.
- EN/ES i18n, a 434-test engineering base, and a dark iPhone-first UI.

**What must be built to be sellable (the gap)**

| Item | Cost/time (solo dev) | Notes |
|---|---|---|
| Store-ready iOS/Android via Capacitor wrap | 2 weeks-2 person-months + $99/yr Apple + $25 Google | SOURCED effort range. Guideline 4.2 "web wrapper" rejection risk mitigated by local asset bundling (already offline-first), push, haptics, HealthKit, native-feel navigation. Hevy proves JS cross-platform wins this exact niche (React Native). |
| Accounts + cloud sync | Supabase: $0 to ~1K users, $25-100/mo at ~10K | The Express + `database.json` layer maps directly onto Postgres. Sync is also the anti-churn feature (device loss = data loss = 1-star reviews). |
| Subscription infrastructure | RevenueCat free to $2.5K monthly tracked revenue, then ~1% | Apple Small Business Program: 15% commission under $1M/yr. |
| Analytics | PostHog/Firebase free tiers; no MMP needed at zero paid spend | AppsFlyer Zero if paid tests start. |
| Share cards + PR-moment ratings prompt | founder time | The two cheapest proven loops in the niche. |
| HealthKit export (v1), Apple Watch app (v2) | v1 plugin work; v2 needs a small native Swift target | Watch + HealthKit are explicit Apple featuring criteria and table stakes vs Hevy/Strong (SOURCED). Capacitor cannot build watchOS. |

Realistic totals: **~$5-10K cash + 2-4 months of founder time to a sellable store product**, leaving the rest of the $10-30K for brand/legal (~$3K) and creator partnerships (~$3-4K), with a reserve.

---

## 3. Target audience

| Segment | Who | Size signal | Willingness to pay | Priority |
|---|---|---|---|---|
| S1: Intermediate powerbuilders | Men 22-40, 2+ years under the bar, spreadsheet/Boostcamp users, JuggernautAI/RP payers and churners | Barbell communities ~72% male (USAPL data, SOURCED); incumbents hold thousands, not millions, of subscribers (ESTIMATED) | Proven at $25-35/mo by incumbents; resentful of it (SOURCED community sentiment) | Primary |
| S2: Hypertrophy trainees priced out of RP | RP-curious lifters who want autoregulated volume without $224-299/yr | RP Trustpilot 2.8 driven by pricing complaints (SOURCED) | $8-15/mo band | Secondary |
| S3: Women entering powerlifting | The fastest-growing lifter cohort: ~31% of new IPF-affiliate lifters in 2023; women 21-25 growing ~13.3%/yr vs 7.2% for men (SOURCED) | Compounding, underserved by hardcore apps | Same bands as S1/S2 | Deliberate year-one investment |

Demographic note used throughout: general fitness apps skew ~55-60% female, but *strength* app buyers skew the other way; 60-75% male is the working estimate (ESTIMATED from community composition; no incumbent publishes splits). The documented anti-subscription sentiment in lifting communities survives the premise change — not as a distribution strategy, but as buyer psychology every pricing decision must respect (generous free value, honest paywalls, a lifetime option, loud data export).

---

## 4. Legal and IP constraints of the rebrand premise

Research summary, not legal advice. (Unchanged from v1; premise-independent.)

- **The math is safe; the words are not.** Training methods, percentages, and set/rep schemes are unprotectable processes under 17 U.S.C. § 102(b), *Baker v. Selden* (1879), and, directly on point for fitness, *Bikram's Yoga College v. Evolation Yoga* (9th Cir. 2015): exercise sequences cannot be copyrighted, even as compilations (SOURCED). Reimplementing wave math in `engine.js` infringes nothing. What *would* infringe: shipping the book's prose, cue text, or tables as formatted.
- **Trademark is the real exposure.** No USPTO registration for "Juggernaut Method"/"JuggernautAI" surfaced in web-level searches (not a clearance search), but Juggernaut Training Systems has strong common-law rights and a live competing app. The Jim Wendler precedent is instructive: he cleared third-party "5/3/1" apps out of the stores with cease-and-desist letters; stores comply on cost asymmetry, not merits (SOURCED). Conclusion: zero "Juggernaut" or "RP" in the name, creative, or store keywords; MEV/MRV acronyms are low-risk generic science terms, but "Renaissance Periodization" is a registered mark (Reg. 5495258).
- **De-risking playbook:** rename; reimplement rather than reproduce; cite sports science rather than books; carry a truthful non-affiliation disclaimer; budget for takedown responses. The Boostcamp precedent — *permissioned* creator programs with rev-share — is also the lowest-risk way to ship named programs, and v2 promotes it from legal footnote to distribution strategy (section 9).

---

## 5. Market size and competitor teardown

- Global fitness app market: ~$12.1-12.9B (2025), ~13.5% CAGR (SOURCED). The serious-lifting niche is not sized by any analyst; triangulating from known player revenues puts it around **$200-350M/yr globally** (ESTIMATED).
- VCs have largely exited consumer fitness (SOURCED): the niche belongs to bootstrappers and creator brands — disciplined competition, but not capital-flooded.

| App | Monthly | Annual | Free tier | Scale signal |
|---|---|---|---|---|
| JuggernautAI | $34.99 | $349.99 | Trial only | ~$90K/mo revenue (ESTIMATED, low confidence) |
| RP Hypertrophy | $34.99 (perpetual $24.99 promos) | $299.99 ($224.99 promo) | No | RP overall: $20-30M/yr, ~80% from apps (SOURCED, self-reported) |
| Fitbod | $15.99 | $95.99 | Trial only | Category revenue leader among generators (ESTIMATED) |
| Boostcamp | ~$15 | $59.99 | Yes, generous | 1.2M+ lifters claimed; VC-backed; creator-program loop |
| Hevy | $2.99 | $23.99 (+$74.99 lifetime) | Yes — unlimited logging | ~$2M ARR 2024, 2M+ downloads on ~$15K spend (SOURCED) |
| Alpha Progression | $9.99 | ~$70 | Limited + trial | 4.9 stars both stores; program-generator differentiation |
| Strong | $4.99 | $29.99 | Yes, capped (3 routines) | ~3M users; 4.9-star ASO moat (~$500K/mo ESTIMATED) |
| Gravitus | Free + Pro | — | Yes | 300K+ lifters; community loops |
| Caliber | $12-19 | $72 | Yes, free-forever | Coaching upsell model; VC-seeded |

Three pricing bands: **trackers ($3-10)**, **AI generators ($12-16)**, **coach replacements ($25-35)**. IRONWAVE's engine belongs to the third band; its brand equity (none yet) prices like the first. The v2 strategy resolves that tension by *splitting the product across bands*: a free logger competing on generosity, a paid coach tier priced in the generator band.

**The distribution lesson the teardown teaches (SOURCED):** nobody in this niche grew on paid ads. The three loops that repeat: Hevy's social feed + share cards, Boostcamp's named-creator program library, Strong's ratings/ASO compounding. All three run on large *free* user bases — the single most important fact in this report for the monetization decision.

---

## 6. What and how to sell: the monetization decision

The owner's central question. Four candidate models, scored with 2025-26 data:

| Model | Install→paid | Revenue/install (D60) | Distribution leverage | Bootstrapped cash-flow fit | Key risk |
|---|---|---|---|---|---|
| **Hard paywall** (trial only, no free use) | **10.7%** median (SOURCED) | **$3.09** (SOURCED) | None — free users don't exist, so share/ratings/late-conversion loops never fire | Fast cash per install, but installs are the binding constraint | ~70% higher refund rates (SOURCED); zero-review cold start; optimizes yield of a funnel with no input |
| **Freemium** (generous free, paid upsell) | **2.1%** median (SOURCED) | **$0.38** (SOURCED) | Maximum — powers every proven loop in this niche | Slow: months of hosting real users at ~$0 revenue | Only pays if free volume actually compounds (Hevy had a social feed; a solo app starts without one) |
| **Free trial via onboarding paywall** | ~1.78% median all-category; trial→paid 25.5% (≤4d) / 37.4% (5-9d) / 42.5% (17-32d) (SOURCED) | between the two above | Weak-moderate | Good: 82% of trial starts happen day 0 | Trial can end before this product's differentiator (multi-week autoregulation) ever fires |
| **Hybrid** (paywall + real free tier, or freemium + trial) | Between; the 2025-26 convergence pattern among top apps (SOURCED, qualitative) | Between | Tunable | Tunable | Complexity; a *crippled* free tier is the worst quadrant: hard-paywall installs with freemium conversion |

Supporting decisions, model-independent:

- **Subscription vs lifetime:** subscriptions lead; lifetime is a tertiary tier priced at **2.5-4x annual** (SOURCED guidance) to blunt cannibalization — lifetime-dominant apps monetize at roughly a tenth of yearly-dominant ones ($0.24 vs ~$2+ D60 RPI, SOURCED). It exists to answer this community's documented anti-subscription reflex, capped ~10% of revenue.
- **Store IAP vs web billing:** **IAP-primary.** Under the Apple Small Business Program the app nets ~85% via IAP; the measured web link-out penalty (28% native paywall conversion vs 18% web, SOURCED) means naive link-outs lose money below $1M/yr, and the Dec 2025 appeals ruling restored Apple's ability to commission link-outs anyway (SOURCED). Web checkout keeps two jobs: commission-free **win-backs** (~20% of churned monthly subscribers reactivate within a year, SOURCED) and a later quiz-funnel web2app test if paid traffic ever turns on.
- **Price localization ships at launch:** locale pricing is the highest-ROI experiment on record (+62.3% LTV; 20-50% lifts in mispriced markets, SOURCED), and EN/ES already exists — Spain/LatAm pricing is sitting in a strings file.
- **Paywall placement:** in onboarding, at the program reveal — ~50% of paid conversions and 82% of trial starts happen on day 0 (SOURCED). IRONWAVE's onboarding is already the quiz; no marketing theater needed.

**The recommendation** — the ruling from the staged debate (section 12) — is the **coach-and-notebook hybrid, both tiers live from day one**:

- **Free tier = a genuinely good logger:** unlimited logging, share cards, PR celebrations, HealthKit export. It exists to power the niche's three proven growth loops (ratings velocity, share-card reach, late organic conversions) — a *crippled* free tier is the worst quadrant (hard-paywall install volume with freemium conversion) and is explicitly rejected.
- **Paid tier = the coach:** wave periodization, volume landmarks, autoregulation, the split generator, readiness — the things no logger has. Gated by a **14-day trial** (long enough for the autoregulation differentiator to visibly fire once; the 17-32 day band also out-converts shorter trials, 42.5% vs 37.4%).
- **Price: $12.99/mo, $79.99/yr, $249 lifetime**, with a $59.99 founding-member first-year annual intro; localized prices from day one. Rationale in section 13's Ruling 1.
- **Paywall placement:** contextual, at the coach moments (program generation, the reveal after the slider onboarding) — never a quiz that dead-ends at a toll booth for organic, paywall-cynical traffic.
- **Billing: IAP-primary** at the 15% Small Business rate; web checkout for win-backs only; web2app quiz funnels deferred until paid traffic exists.
- **One public launch (October-equivalent), both tiers present from v1.0** — no free-only launch followed by a paywall retrofit (the documented backlash pattern), and no January-dependent plan (a new listing has no rank to harvest the surge with). Sequencing detail in section 13's Ruling 2.

---

## 7. Revenue scenarios under the recommendation

Planning bands (all ESTIMATED from SOURCED base rates), assuming the staged hybrid at $12.99/mo / $79.99/yr / $249 lifetime, IAP-primary at 15%:

| Milestone | Conservative | Base | Stretch (top decile) |
|---|---|---|---|
| Month 6 (logger live, coach tier just on) | $0-500 MRR | $500-1.5K | $3K |
| Month 12 | $1-2K | **$2-5K** | $8-10K |
| Month 24 | $3-6K | **$6-18K** | $25K+ |

Sanity anchors: only 17.3% of new apps ever sustain $1K MRR and 4.6% reach $10K within two years (SOURCED); Strong-class outcomes (~$500K/mo) took years of compounding ratings; Hevy took ~5 years to ~$2M ARR. The **"average MRR"** answer restated: ~$2.50-4.00/mo realized per paying subscriber (SOURCED basis); per app, the median never passes $1K — the bands above assume execution in the top quartile of the niche's playbook.

Unit economics at the recommended pricing (ESTIMATED): blended net LTV per paying subscriber ~$85-110 (annual-weighted mix, 25% first-renewal base rate improving with the niche's higher engagement); free-tier hosting cost ~$0-100/mo below 10K users (Supabase tiers, SOURCED).

---

## 8. CAC vs LTV: when paid advertising makes sense

The chain at 2025-26 benchmarks (US; EU costs run 50-75% of US):

```
CPI (fitness):        $3.70-4.70 blended ($1.75-4.00 TikTok, $2.00-5.50 Meta)
install -> paid:       ~3-4% median (trial funnel)
=> CAC per payer:      $130-190 at median performance   [SOURCED inputs]
Benchmark CAC:         $100-300 for fitness subscription apps [SOURCED]
Net LTV (this model):  ~$85-110 [ESTIMATED]
```

Median paid performance is underwater, and this niche's history says paid was never the growth engine anyway (section 5). Rules retained from v1, unchanged by the premise correction:

1. **Paid is a reward for a proven funnel:** it turns on only when organic/creator channels demonstrate cost-per-trial <= $30 and trial-to-paid >= 40-45%.
2. **Creator spend beats display math:** influencer-driven installs run 50-70% cheaper and retain better (SOURCED); a 60-90s integration on a 50K-view evidence-based channel costs ~$700-1,500 at the $25-45 sponsorship CPM — and a *program partnership* (section 9) outperforms an ad read at the same price.
3. **Seasonality discipline:** never buy January (Meta fitness CPI spikes to ~$31; resolutioner cohorts churn worst — SOURCED). Harvest January organically with a listing that already has ratings and rank; buy February-March and the May-June cut season if the gates pass.
4. **Reddit is the cheapest credible paid test:** $0.30-0.80 fitness CPC (SOURCED) against the exact buyer.

---

## 9. Platform strategy, ranked (v2)

1. **The app stores themselves — the primary channel.** 65-70% of store downloads follow search (SOURCED). Head terms ("workout tracker") are owned by Strong/Hevy/Jefit; the winnable long tail is "powerlifting program," "hypertrophy tracker," "powerbuilding," "wave periodization," "5/3/1 style log." The compounding asset is **ratings velocity**: prompt at PR moments; 3.5→4.5 stars lifts install conversion 30-35% (SOURCED). File the **Apple featuring nomination** (2 weeks-3 months lead) once HealthKit + localization land — both are explicit editorial criteria (SOURCED) — but let nothing *depend* on featuring: Apple's editors favor native polish, and a Capacitor app must overshoot on feel to clear that bar.
2. **YouTube evidence-based lifting channels — as program partners, not ad slots.** The Boostcamp lesson, closed-source edition: pay 2-3 sub-100K channels for *permissioned program partnerships* (their template ships in-app; 20% recurring affiliate; they promote it because it is theirs). Same $3-4K budget as ad reads, structurally better incentives, and the IP-cleanest way to ship named programs.
3. **Instagram/TikTok via share cards — the user-generated loop.** The one Hevy mechanic that works without a social graph: auto-generated PR/volume/streak shareables designed for Stories overlays (SOURCED as Hevy's deliberate loop). Every free user becomes distribution.
4. **Reddit — organic credibility plus the cheapest paid test.** r/weightroom, r/powerbuilding, r/Fitness program threads; transparent founder flair; paid at $0.30-0.80 CPC when testing.
5. **TikTok organic** — top-of-funnel clips for S2/S3; cheapest CPI if paid later.
6. **Meta paid — last, gated, seasonal, EU-first** ($20.70 US health CPM; EU at 50-75% of US cost).
7. **Strength podcasts/newsletters** — small credibility buys in Stronger-by-Science-adjacent media.

---

## 10. Flagship athlete: female model vs male athlete

Unchanged by the premise correction — the evidence concerns buyers, not architecture. Condensed; the full evidence chain and case studies are retained from v1 research.

- **The buyer pool** is an estimated 60-75% male today, with young women entering powerlifting as the fastest-growing cohort (SOURCED community data).
- **The endorsement literature** consistently ranks expertise above attractiveness for purchase intent on performance products, and **ideal-self congruence** (endorsers who embody who the buyer wants to become) above both. Attention is not conversion: female fitness models on Instagram can carry >60% male thirst-follow audiences that engage and do not buy (SOURCED composition; ESTIMATED conversion gap). Sex appeal in brand creative carries documented backlash risk (SOURCED). No study directly tests male-vs-female flagships for strength apps; this is triangulation, stated as such.
- **Case studies:** female-face app businesses win big *selling women's training to women* (EvolveYou $34M+/yr combined with Oner Active); Bret Contreras proves expertise crosses gender lines (male PhD, nearly all-female buyers); Sam Sulek proves raw male reach does not convert to durable brand economics; RP and Juggernaut both use expert flagship + mixed athlete roster.

**Verdict (v2 framing):**

1. If forced to one face: a **credentialed male athlete-coach** converts the current buyer pool best.
2. An attractiveness-led female *model* is the weakest tested option: aspirationally incongruent with the core buyer, backlash-prone, engagement systematically overstating conversion.
3. A female **elite lifter** is a strong roster spearhead for the fastest-growing segment, not the sole flagship while the core skews male.
4. At bootstrap scale, nobody gets signed: credibility is *bought by the view* (creator integrations) and *earned by partnership* (program partners whose names ship in-app). A retainer flagship is a decision for a $10K+ MRR business; the founder's own build-in-public presence is one free lever among several, not the strategy.
5. What actually drives sales: audience-identity congruence x perceived expertise x reach, in that order.

---

## 11. What else was missing (the updated checklist)

1. **The productization gap itself** — priced in section 2; marketing spend before the product is store-ready is wasted.
2. **Retention beats acquisition:** ~29% of monthly subscribers churn before first renewal; ~35% of annual subscribers cancel auto-renew in month one; first-year annual renewal ~25% (SOURCED). Onboarding-to-week-5 experience quality is worth more than any campaign.
3. **Ratings velocity as a compounding asset** — the niche's cheapest moat (Strong's 4.9 is its business). Prompt at PR moments only; never interrupt a set.
4. **Trademark clearance and a takedown reserve** before any brand spend (section 4).
5. **Paywall/price experiment discipline:** 200-500 conversions per variant for a valid test (SOURCED) — at early volumes that means one careful test at a time, not a dashboard of them.
6. **Refund exposure:** hard-paywall configurations carry ~70% higher refund rates (SOURCED); the trial + honest paywall copy is the mitigation.
7. **Win-back flows as first-class:** ~20% of churned monthly subscribers reactivate within a year; 23%+ of churn is recoverable billing error (SOURCED); deliver win-backs over commission-free web checkout.
8. **Price-raise asymmetry:** launching low anchors expectations (Fitbod's hike generated churn complaints, SOURCED community signal); launch at the defensible price with a founding-cohort discount rather than planning to raise later.
9. **Store operations:** review-response cadence, Play's 12-tester/14-day requirement for new personal accounts (SOURCED), screenshot/keyword A/B, seasonal listing refreshes.
10. **Health-claims compliance and liability:** training advice needs disclaimers; readiness/fatigue language stays out of medical territory; ad platforms restrict health claims.
11. **Localization as an underpriced lever:** EN/ES ships already; Spanish-language lifting content and store listings are dramatically less competitive (ESTIMATED), and localized *pricing* is SOURCED as the highest-ROI experiment.
12. **Community and support load:** a Discord and a support inbox are founder time commitments; budget them before scaling installs.
13. **Seasonality calendar:** organic January (with a ranked listing), paid Feb-Mar and May-Jun only if gates pass, creative testing in Q1, never Q4.
14. **Pre-committed kill/scale gates:** cost-per-trial <= $30; trial-to-paid >= 40%; month-12 MRR >= $2K scales the plan, < $1K triggers the honest conversation — against an 80%+ base rate of apps never passing $1K MRR, that outcome is statistically likely and worth deciding about in advance.

---

## 12. The debate, v2: textbook CMO vs contrarian operator

Re-staged from scratch under the corrected premise (closed commercial app, form open, bootstrapped budget, open source banned). Both personas argued from the same seven research briefs. Condensed transcript; synthesis in section 13.

### Round 1: Alex Varga's v2 plan (condensed)

Carrying his v1 concessions forward ($3-5K MRR month-12 KPI, no media war chest, integrations not retainers, trademark first, never buy January), Alex ruled: **quiz-gated hard paywall with a 7-day trial and an escape hatch** — "hard paywalls convert 10.7% vs 2.1% and earn $3.09 vs $0.38 per install by D60; freemium is a distribution engine's monetization model, and we don't have the engine." The product's slider onboarding "is already a quiz — we stage it one question per screen and place the paywall on the program reveal." Pricing $14.99/mo / $99.99/yr / **$299 lifetime** (3x annual per the cannibalization guidance), localization at launch ("EN/ES is free money sitting in a strings file"). **IAP-primary, reversing his own v1 web-first concession**: "the Dec 2025 appeals ruling took the free lunch back, and 28% native vs 18% web link-out conversion means naive link-outs are a self-inflicted wound." Product form: Capacitor wrap + Supabase + RevenueCat + HealthKit v1, Watch v2. Distribution: ASO long tail, PR-moment ratings prompts, share cards, $3-4K of creator integrations, Apple featuring nomination. Launch Nov-Dec to harvest January organically; escape hatch = a capped free logger (3 routines, no engine).

### Round 2: Rook's counter (condensed)

"Your v2 is 10x more honest than v1. Now the cardboard."

- **"You built a hard paywall on top of zero distribution."** Every proven loop in the niche (Hevy's feed + share cards, Boostcamp's creators, Strong's ratings moat) runs on *free* users. "Hard paywall RPI of $3.09 times approximately zero installs is approximately zero dollars." Plus the fine print: ~70% higher refunds, and the retention advantage disappears long-run.
- **"Your escape hatch is a decoy, not a loop."** A 3-routine, no-engine free logger against Hevy free (unlimited logging) and Strong (4.9 stars) gets adopted by nobody — so no share cards in the wild, no PR moments for the ratings prompt, none of the late conversions. "The install volume of a hard paywall with the conversion rate of freemium. The worst quadrant."
- **"The January harvest is a fantasy for a listing born in November."** ASO compounds; a listing with no reviews and no rank harvests crumbs while the surge accrues to incumbents. A sequencing error, fixable.
- **"The quiz-paywall pattern doesn't transfer."** Noom/BetterMe quizzes exist to monetize expensive *paid* traffic in-funnel; pointing organic strength nerds — "the most paywall-cynical buyers in fitness" — into a quiz that dead-ends at a paywall farms 1-star "scam quiz" reviews that poison the ratings engine.
- **"Seven days is the wrong trial for this specific engine."** The differentiator is autoregulation *across weeks*; a 7-day trial ends before the magic fires. The 17-32 day band converts better anyway (42.5% vs 37.4%).
- **Counter-model: "sell the coach, give away the notebook."** Free tier = a genuinely good logger (unlimited logging, share cards, PR celebrations, HealthKit) as the distribution asset; paywall = the brain (waves, landmarks, autoreg, split generator, readiness). $9.99/mo / $59.99/yr / $179 lifetime; 14-day trial; ship the free logger to stores by September with *no paywall* to farm ratings before January; coach tier in November; creator budget converted to Boostcamp-style permissioned program partnerships.
- Conceded to Alex: IAP-primary, lifetime at 3x annual, localization at launch, the quiz-shaped onboarding as *product*, trademark first, the $3-5K MRR target.

### Round 3: Alex's final rebuttal and concessions (condensed)

"Half your hits land. Ledger first, then the fights."

- **Conceded fully: the 7-day trial.** "You caught me optimizing cash flow for a product whose value curve peaks after the trial ends." 14 days, and the benchmark agrees.
- **Conceded fully: the escape hatch.** "'Hard-paywall installs, freemium conversion' is the correct diagnosis of my 3-routine decoy." The free tier becomes a genuinely good logger; "notebook free, coach paid" adopted.
- **Conceded fully: featuring dependence.** The nomination stays filed because it is free; nothing leans on it.
- **Conceded partially: the quiz.** The slider quiz stays as product onboarding with the program reveal; the paywall moves to the coach features, contextual, "not a dead-end door."
- **Held: paywall-free v1.0 is where Rook's model goes soft.** Two-plus revenue-zero months, and retrofitting monetization onto early adopters who anchored on "free app" is the documented backlash pattern — "Fitbod's mere price hike generated durable churn complaints; converting free features to paid is the harsher version, and it detonates inside the exact review base you're farming." Also a schedule reality check: accounts + share cards + two store submissions + Google's 12-testers/14-days gate makes September "not a plan, a hope. October is the honest date — which still beats January."
- **Held: $9.99/$59.99 anchors the product in the tracker band forever.** "Your 'six Hevys' framing concedes my point: you're pricing against the notebook." The coach buyer comparison-shops $349 JuggernautAI and $299 RP, where $99 is the credible-disruptor price; price raises are a one-way door; and a no-name free logger enters the loggers' red ocean where nothing differentiates it — "the coach is the moat; lead with it."
- **Taken from Rook without apology:** permissioned creator program partnerships over ad reads.

**Joint ground truth both signed:** (1) free tier = real logger (unlimited logging, share cards, HealthKit); paywall = the engine (waves, landmarks, autoregulation, split generator); IAP-primary at the 15% tier; web checkout for win-backs only. (2) 14-day trial; lifetime at ~3x annual; localization at launch; trademark first; ASO treated as compounding — January is upside, never the plan. (3) $3-4K to permissioned creator program partnerships with 20% recurring affiliate, timed for February-March.

**Left for the synthesizer:** (1) price — $14.99/$99.99 (coach-band credibility) vs $9.99/$59.99 (volume); (2) launch — paid tier live at v1.0 in October vs free-logger-only September with monetization added in November.

---

## 13. The integral plan, v2 (synthesis)

The v2 debate converged on far more than v1 did: both experts signed the "notebook free, coach paid" hybrid, the 14-day trial, IAP-primary billing, launch localization, lifetime at ~3x annual, and creator program partnerships. Two fights were left open; the rulings:

**Ruling 1 - price: $12.99/mo, $79.99/yr, $249 lifetime, with a $59.99 founding-member first-year annual intro.** Alex is right that price raises are near-irreversible (the Fitbod lesson) and that the coach framing needs clear distance from tracker pricing; Rook is right that a zero-review brand cannot hold a near-$100 sticker on day one. $79.99 sits unmistakably above the tracker band, reads as "a quarter of RP for the same job," and keeps the *upward* A/B path open (test $99.99 on new cohorts once 200-500 conversions per variant exist, grandfathering existing subscribers — the standard no-backlash raise). Rook's aggressive number survives as the time-boxed founding intro, not the anchor.

**Ruling 2 - launch: one launch, October, both tiers live from day one.** Alex wins the bait-and-switch point: a free-only v1.0 that later sprouts a paywall detonates inside the review base it farmed, and his schedule math (store review cycles, Google's 12-tester/14-day gate) makes September a hope, not a plan. Rook wins the substance underneath: the free logger must be genuinely good and present from the first build, and ratings velocity starts at launch — October still gives ~3 months of review farming before January. His September instinct is honored as a **September TestFlight/Play-open-testing beta**, which builds the first hundred advocates without publicly anchoring "free app."

### The phased plan

**Phase 0 - Legal and identity (now to ~M1, ~$3K):** new name, real USPTO/TSDR clearance, zero "Juggernaut"/"RP" anywhere, original coaching copy, non-affiliation disclaimer, landing page + waitlist.

**Phase 1 - Productize (M1-3, ~$1K tooling + founder time):** Capacitor wrap with local assets, push, haptics, HealthKit export; Supabase accounts + sync; RevenueCat; PostHog; share cards; PR-moment ratings prompt; the slider onboarding staged one-question-per-screen with the generated-split reveal; store listings built on long-tail keywords; localized store pages and prices (EN/ES at minimum).

**Phase 2 - Beta, then launch (M3-4):** September-equivalent TestFlight + Play open testing (satisfies the 12-tester/14-day gate); October public launch, both tiers live: free logger (unlimited logging, share cards, PR celebrations, HealthKit) and coach tier (waves, landmarks, autoregulation, split generator, readiness) behind a 14-day trial at $12.99/$79.99/$249 with the $59.99 founding intro. Apple featuring nomination filed the day HealthKit + localization land; nothing depends on it.

**Phase 3 - Compound into January (M4-6, ~$3-4K):** two or three permissioned creator program partnerships signed (their programs ship in-app, 20% recurring affiliate), content timed for late December; ratings engine running; win-back web checkout wired. January is harvested with whatever rank and review base exists — upside, never the plan.

**Phase 4 - Prove and scale (M6-12, revenue-funded):** first price/paywall A-Bs when volume allows (one test at a time; 200-500 conversions per variant); Reddit paid test at $0.30-0.80 CPC in the Feb-Mar window; Meta/TikTok paid only if cost-per-trial <= $30 proves out; Watch app (small Swift target) when revenue funds it; web2app quiz funnel only if paid traffic turns on; ES-market push.

### Budget vs expected outcome (24 months, ESTIMATED)

| Phase | Cash | Exit state |
|---|---|---|
| 0 Legal/identity | ~$3K | Clear mark, brand assets |
| 1-2 Productize + launch | ~$1-2K + 3-4 months founder time | Both tiers live, ratings engine on |
| 3 Creator partnerships | ~$3-4K | 2-3 named programs in-app, affiliate flywheel |
| 4 Prove and scale | 30-40% of MRR | $2-5K MRR month 12; $6-18K month 24 (base case) |

### Kill/scale gates (pre-committed)

- Month 6: >= 1,000 free-tier weekly actives and store rating >= 4.5, or revisit the free tier's generosity before spending on creators.
- Month 9: cost-per-trial <= $30 on any tested channel; trial-to-paid >= 40%; month-1 cancel rate < 35%.
- Month 12: MRR >= $2K scales the plan; < $1K triggers the honest conversation — against the 80%+ base rate of apps never passing $1K MRR, deciding this in advance is the discipline.

**The one-sentence version:** give away a logger good enough to farm the niche's only proven growth loops (ratings, share cards, creator programs), sell the coach that no logger has, price it as a coach and not a tracker, bill through the store at 15%, and let January find a ranked, reviewed listing instead of a ghost.

---

## 14. Sources and assumptions appendix

**Method:** seven research passes conducted 2026-07-16 against 2025-2026 public sources (five in v1: market/competitors, subscription unit economics, ad costs, endorser-gender evidence, IP; two added for v2: monetization-model benchmarks, bootstrapped growth loops + productization costs). Figures cross-checked across at least two sources where possible. SOURCED = stated by a cited source. ESTIMATED = derived, triangulated, or inferred; treat as directional.

**Known weak points:** JuggernautAI and Strong revenue figures are single-source and low confidence; strength-app gender splits are inferred from community composition; EU ad-cost discount is a heuristic; monthly-churn figures come from unaudited aggregators; RevenueCat report pages block direct fetching and were verified via multiple independent summaries; freemium install-volume multipliers are asserted qualitatively across the industry but never quantified.

**Key sources**

- RevenueCat State of Subscription Apps 2025/2026: https://www.revenuecat.com/state-of-subscription-apps and https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026/
- Model benchmarks: https://www.airbridge.io/en/blog/hard-paywall-vs-freemium-2026 ; https://neoads.substack.com/p/hard-paywalls-convert-less-but-earn ; https://www.saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth/
- Paywall/pricing practice: https://www.revenuecat.com/blog/growth/paywall-placement ; https://www.revenuecat.com/blog/growth/lifetime-subscriptions ; https://www.revenuecat.com/blog/growth/price-localization-for-apps ; https://adapty.io/blog/paywall-experiments-playbook/ ; https://adapty.io/blog/health-fitness-app-subscription-benchmarks/
- Web billing post-Epic: https://daringfireball.net/linked/2025/05/15/revenuecat-external-purchase-report ; https://www.macrumors.com/2025/12/11/apple-app-store-fees-external-payment-links/ ; https://superwall.com/blog/initial-data-is-in-app-to-web-conversion-rates-after-the-app-store-ruling ; https://blog.funnelfox.com/web2app-funnel-patterns-2026/
- Niche growth loops: https://www.revenuecat.com/blog/growth/guillem-ros-hevy-podcast/ ; https://subclub.com/episode/cultivating-organic-growth-with-viral-loops-guillem-ros-salvador-hevy ; https://www.hevyapp.com/features/shareable/ ; https://www.boostcamp.app/programs ; https://gravitus.com/
- ASO/featuring/ratings: https://ads.apple.com/app-store ; https://developer.apple.com/app-store/getting-featured/ ; https://developer.apple.com/health-fitness/ ; https://www.appsflyer.com/blog/tips-strategy/app-ratings-reviews/
- Productization: https://capgo.app/blog/how-easy-is-it-to-make-web-app-into-mobile-app-with-capacitor/ ; https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper ; https://www.getmonetizely.com/articles/supabase-vs-firebase-which-baas-pricing-model-actually-saves-you-money ; https://www.revenuecat.com/pricing ; https://developer.apple.com/app-store/small-business-program/ ; https://posthog.com/blog/best-mobile-app-analytics-tools
- Market & competitors: https://www.grandviewresearch.com/industry-analysis/fitness-app-market ; https://www.juggernautai.app/pricing ; https://rpstrength.com/pages/hypertrophy-app ; https://www.thecomeup.co/p/how-rp-strength-hit-25m-bootstrapped ; https://www.starterstory.com/hevy-breakdown ; https://obj.ca/fitness-app-entrepreneur-pumped-by-hevys-progress-to-2m-in-annual-revenue/ ; https://app.sensortower.com/overview/464254577?country=US ; https://alphaprogression.com/en ; https://help.strongapp.io/article/132-strong-pro
- Ad benchmarks: https://www.triplewhale.com/blog/facebook-ads-benchmarks ; https://www.triplewhale.com/blog/tiktok-benchmarks ; https://www.businessofapps.com/ads/cpi/research/cost-per-install/ ; https://adbacklog.com/blog/reddit-ads-benchmarks-per-industry-2025 ; https://www.rocketshiphq.com/meta-cost-benchmarks-mobile-app-installs/ ; https://digitalyieldgroup.com/blog/health-fitness-apps-the-resolutioner-churn-problem/
- Influencer rates & affiliate norms: https://www.meltwater.com/en/blog/influencer-marketing-costs-rates-pricing ; https://sponsorradar.com/insights/youtube-sponsorship-rates-what-brands-should-pay ; https://insertaffiliate.com/blog/affiliate-commission-models-subscription-fitness-apps-percentage/
- Endorser research: Till & Busler https://www.researchgate.net/publication/235312446 ; https://www.emerald.com/jpbm/article/34/3/265/1245618 ; https://pmc.ncbi.nlm.nih.gov/articles/PMC10968593/ ; https://www.sciencedirect.com/science/article/pii/S0148296325003340 ; https://www.modash.io/find-influencers/fitness/female
- Audience composition: https://barbend.com/usa-powerlifting-federation-data-study/ ; https://powerliftingindata.com/posts/2024/10/13/growth-by-gender-and-age.html ; https://www.cdc.gov/mmwr/volumes/71/wr/mm7118a6.htm
- Case studies: https://www.forbes.com/profile/evolveyou/ ; https://bootybybret.com/ ; https://www.stack3d.com/2024/06/sam-sulek-parting-ways-with-hosstile.html
- IP: https://supreme.justia.com/cases/federal/us/101/99/ ; https://cdn.ca9.uscourts.gov/datastore/opinions/2015/10/08/13-55763.pdf ; https://supreme.justia.com/cases/federal/us/499/340/ ; https://www.theironden.com/forum/threads/5-3-1-phone-apps-l-k.11673/ ; https://trademarks.justia.com/874/29/renaissance-87429014.html
- Indie base rates: https://ppc.land/the-app-middle-class-is-dying-and-revenuecats-data-shows-exactly-how-fast/ ; https://www.start.io/blog/report-80-of-mobile-apps-fail-to-earn-1000-month-in-subscription-revenue/

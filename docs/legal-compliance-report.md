# IRONWAVE: Legal Compliance Report

*Prepared 2026-07-16 by the project's legal-manager persona ("Counsel"). This is structured legal research and a remediation program, not legal advice; before launch, a licensed attorney in the relevant jurisdictions should review the launch checklist items marked [ATTORNEY]. Jurisdictional scope per the owner: US + EU + LatAm (Mexico, Brazil).*

**Premise.** The repository today is a private prototype: a self-hosted PWA with no accounts, no billing, no analytics, and no distribution. The product will be a **launched commercial app** (store-distributed, accounts + sync, subscriptions). This report therefore separates *exposure today* (low, because nothing is distributed) from *exposure at launch* (where most risks become live), and is written so that future dev agents can execute the remediation items directly — every finding carries file:line references and acceptance criteria.

**The governing doctrine of this report is minimum viable remediation.** The instinct "we copied a methodology, we must rip it out" is wrong on the law. Training methods are unprotectable; the liability lives in *expression, names, and admissions*. The engine stays. The words change. Section 9 is the precise map.

---

## 1. Executive risk register

Ordered by (exposure at launch x cost to fix late). Severity: how bad if it materializes. Today: exposure while a private prototype. Launch: exposure once sold.

| ID | Issue | Severity | Today | At launch | Minimum fix | Effort |
|---|---|---|---|---|---|---|
| R1 | Copyrighted book PDF committed to the repo (`Scientific_Principles_of_Hypertrophy_Training_2020.pdf`, Israetel/RP, in history since PR #25) | High | Low-Med (private repo = not "distribution," but every clone/collaborator copy is a reproduction) | High if repo ever goes public or is shared | Delete file + purge from git history; keep private notes citing page numbers instead | Small |
| R2 | MIT license on code intended to become a closed commercial product (`app/LICENSE`) | High | Low (few/no outside copies) | High (anyone with a copy may use/sell it, irrevocably) | Replace with proprietary license notice before ANY distribution; audit who has clones | Trivial |
| R3 | Third-party trademarks in athlete-facing strings and metadata ("Juggernaut Method 2.0", "JuggernautAI", methodology labels) | High | Low | High (trademark use in commerce; the Wendler 5/3/1 precedent shows stores fold on takedown demands) | String/label scrub + one-line state migration; zero engine changes (section 9) | Small |
| R4 | Copying admissions in code comments, tests, README ("the 2012 book verbatim", "SOURCE: Renaissance Periodization's", page-number citations) | Medium | Low | Medium-High (discovery gift-wrap in any dispute; comments ship in an unminified JS bundle) | Reword comments to cite concepts and public sports science; minify shipped bundle | Small |
| R5 | Trade-dress admission: "styled after the JuggernautAI app" (README) + Juggernaut-style dark theme framing | Medium | Low | Medium (a look-and-feel claim is weak on the merits but cheap to provoke) | Rewrite README/positioning; keep the theme, drop the comparison; diverge visually over time | Small |
| R6 | `VOLUME_LANDMARKS` ships RP's published per-muscle grid as a seeded dataset (`app/data.js:1373`) | Medium | Low | Medium (a *specific compiled table* is the one data artifact with colorable thin-compilation protection) | Blend/derive own values (already a stated roadmap item, `pending-future-work.md:88`); cite as reference, not reproduction | Medium |
| R7 | No privacy/consumer/platform stack (policy, ToS, disclaimers, consent, labels) | High at launch | None (nothing collected today) | Blocking (stores reject without it; GDPR/CCPA fines possible after) | Launch-gate checklist, section 5-8 | Medium |
| R8 | "IRONWAVE" name unclearead (trademark availability unverified in US/EU classes 9/41/42) | Medium | None | High if it collides (post-launch rename is the most expensive rename) | TSDR + EUIPO knockout search before store submission [ATTORNEY] | Small |
| R9 | Internal design docs derived from the book with inline page citations (`docs/dynamic-routine-engine-design.md` and others) | Low | Low | Low (fine as private working notes; never ship or publish) | Keep private; exclude from any published repo/bundle | Trivial |
| R10 | Health-adjacent language (readiness, sleep flags) drifting toward medical claims | Low-Med | None | Medium (App Review 1.4.1, FTC health-claims exposure) | Copy guardrails + disclaimer, section 8 | Small |

---

## 2. Domain A — Copyright: the book problem and the algorithm non-problem

### A1. The bundled PDF (R1) — the single most concrete issue in the repo

A complete commercial ebook (*Scientific Principles of Hypertrophy Training*, Renaissance Periodization, 2020) is committed at the repository root and has been in git history since PR #25. Every clone reproduces it; pushing the repo anywhere, adding a collaborator, or open-sourcing anything reproduces and distributes it. There is no fair-use theory that covers "the whole book, as a convenience file."

**Remediation (dev-agent ready):**
1. Delete the file in a normal commit (stops all forward distribution).
2. Purge it from history (`git filter-repo --path Scientific_Principles_of_Hypertrophy_Training_2020.pdf --invert-paths`, force-push, collaborators re-clone). History rewrite is disruptive; do it while the collaborator count is ~1, i.e. now. If the repo will *never* be public and never transferred, a documented owner decision to accept history risk is defensible — but the file itself must still go.
3. `docs/dynamic-routine-engine-design.md` cites the book by page (`(pNN)`) — citations are fine and should *stay* (they are references, not reproductions). The doc simply must remain private (R9).

### A2. The training algorithms — the law says keep them (R-none)

This is the owner's central question, and the answer is unusually clean:

- **17 U.S.C. § 102(b)** excludes any "procedure, process, system, method of operation" from copyright. *Baker v. Selden* (1879): a book's copyright covers the *explanation*, not the *system*; practicing the system is not infringement.
- ***Bikram's Yoga College v. Evolation Yoga* (9th Cir. 2015)** applied this to fitness directly: a sequence of exercises is an unprotectable process, ineligible even as a "compilation," and the Copyright Office holds that a "manner or style of exercise is not registrable."
- ***Feist* (1991):** facts and functional data get no protection; compilations only in original selection/arrangement, thinly.

**Consequences for this codebase:**
- The wave percentage tables (`WAVES`, `DELOAD_SETS` in `app/data.js`), the working-max/AMRAP progression math, the MEV/MRV ascending-volume logic, calibration ramps, autoregulation rules — **all of it is unprotectable method. None of it needs to change. Do not touch the engine for legal reasons.**
- What copyright *does* reach: the book's prose, coaching cues, table formatting-as-expression, and arguably one thing in this repo — R6, the seeded `VOLUME_LANDMARKS` grid, because it is a *specific company's compiled dataset* rather than a formula's output. Thin protection, real uncertainty, cheap to moot: blend/derive own values (the roadmap already commits to this, `docs/pending-future-work.md` "Migrate off the seeded RP grid"). Until then the exposure is mitigated by the fact that the grid is one input among many and is recalibrated per athlete at runtime (`recalibrateLandmarks`) — the shipped *behavior* diverges from the printed table almost immediately. Document that argument; it is a good one.

### A3. The admissions problem (R4) — comments are discovery evidence and, here, shipped product

The code narrates its own provenance: `app/engine.js:577` "The 2012 book, verbatim"; `app/README.md:122` "(jm2-wave, the 2012 book verbatim)"; `app/data.js:1398` "Grounded in the book (p29-30, p159-160)"; `app/test/prescription-sanity.test.js:17-19` "it reproduces the 2012 Juggernaut". Two problems: (1) in any dispute these are pre-written plaintiff's exhibits that *overstate* what was actually done (implementing percentages is lawful; "verbatim" invites the wrong reading); (2) this is a no-build vanilla-JS app — **comments ship** to every user unless the commercial build adds minification.

**Remediation:** reword, don't delete meaning. "The 2012 book, verbatim" becomes "classic 3-week wave: descending volume, rising intensity, AMRAP realization"; page citations move to private design docs; test prose describes behavior ("reproduces the published wave percentages" → "runs the fixed wave table"). And the productization branch must add **minification of the shipped bundle** — a performance task that is also legal hygiene.

---

## 3. Domain B — Trademark and trade dress: the scrub map

Methods aren't protectable; **names are**. "Juggernaut Method" / "JuggernautAI" carry strong common-law rights (book in commerce since ~2013; competing app live on the App Store), and the Wendler 5/3/1 history shows the enforcement path is app-store takedowns that stores grant on cost asymmetry, not merits. "RENAISSANCE PERIODIZATION" is a registered mark (Reg. 5495258). MEV/MAV/MRV as acronyms are generic science vocabulary and safe.

### B1. Athlete-facing and store-facing (must fix before launch — these are "use in commerce")

| Location | Current | Fix |
|---|---|---|
| `app/i18n/en.js:842` | `'more.tagline': 'IRONWAVE · Juggernaut Method 2.0 engine'` | `'IRONWAVE · wave periodization engine'` |
| `app/i18n/es.js:845` | `'IRONWAVE · Motor Juggernaut Method 2.0'` | `'IRONWAVE · Motor de periodización por olas'` |
| `app/app.js:5903` + all `methodology:` literals (`app.js:101,534,5844`; `data.js:720,751`) | `'Juggernaut + Bodybuilding'` rendered in UI and **persisted in saves** | New neutral label (e.g. `'Wave Strength + Bodybuilding'`); add a one-line rename in `migrateState` (the backfill pattern at `app/app.js:92-101` already exists); extend `migration.test.js` |
| `app/engine.js:580` | `label: 'Juggernaut 2.0 wave'` | `'3-week strength wave'` — **verified: golden-master.json contains zero "juggernaut", so label renames do not disturb the snapshot contract** |
| `app/manifest.json:4` | "...on the Juggernaut Method 2.0 wave system" | Neutral description |
| `app/package.json` | description + keyword `"juggernaut-method"` | Neutral description; delete the keyword |

### B2. Comments/docs (fix in the same sweep; not "use in commerce" but shipped + discoverable)

`app/data.js:4,670,707,709,763,815`, `app/engine.js:3,140,184,567,606`, `app/styles.css:3`, `app/app.js` comment blocks tagged `[Juggernaut + Bodybuilding]`, `app/data.js:1373` ("SOURCE: Renaissance Periodization's..."). Reword to concept language: "wave periodization tables", "ascending-volume hypertrophy (volume-landmark model)", "secondary volume work (inverted wave pattern)". The `[Juggernaut + Bodybuilding]` comment *tags* are an internal cross-reference system — replace the tag text once, repo-wide, with a neutral tag like `[Wave + BB]` to keep the cross-references intact.

### B3. What deliberately STAYS (the lateral calls)

- **Internal scheme IDs `jm2-wave` and `jbb-hyp`** (`block.scheme`, the scheme registry, `scheme-isolation.test.js`): never displayed to users, persisted in every save, and load-bearing across the golden master and migrations. An internal identifier is not trademark use in commerce; renaming it buys zero legal ground and costs a risky data migration. **Keep.** (`pending-future-work.md:88` already reached the same conclusion: "Internal scheme ids are already neutral... keep that.")
- **The math those schemes run.** Unchanged, per Domain A.
- **`app/CHANGELOG.md` history entries** naming Juggernaut/RP: factual development history, not shipped, not marketing. Keep; just never publish the changelog as store copy.

### B4. Trade dress (R5)

`app/README.md:3` "styled after the JuggernautAI app" and `styles.css:3` "Dark Juggernaut-style UI" are written admissions of intent to imitate look-and-feel. Trade-dress claims over app UIs are hard to win — but the admission does the plaintiff's hardest work for them. **Fix:** rewrite the README for the commercial fork (it is currently the honest hobby-project README, which was correct *for the prototype*); delete the comparison lines; keep the dark theme (a dark fitness UI is generic) and let the rebrand's own visual identity diverge naturally. The truthful non-affiliation disclaimer, where methodology heritage must be mentioned at all (e.g. a docs page), is: *"[NEWNAME] implements wave periodization and volume-landmark concepts as described in publicly available sports science. It is not affiliated with, endorsed by, or derived from any third-party training product."*

### B5. Our own mark (R8)

"IRONWAVE" has never been cleared. Before any store submission: USPTO TSDR + EUIPO/WIPO knockout search in classes 9 (software), 41 (fitness training), 42 (SaaS); App Store name-availability check; have a backup name. [ATTORNEY] for the clearance opinion; filing an application (~$250-350/class US) is cheap insurance and the marketing plan's Phase 0 already budgets it.

---

## 4. Domain C — Software licensing

- **R2, the MIT problem:** `app/LICENSE` grants everyone rights to "use, copy, modify, merge, publish, distribute, sublicense, and/or **sell**" the software. That is the *opposite* of a closed commercial posture, and MIT grants attach to every copy already distributed (irrevocable for those copies). Because the repo is private and collaborators are ~none, exposure today is contained — the grant only reaches people who lawfully obtained a copy. **Fix before anything ships or the repo is ever shared:** replace with a proprietary all-rights-reserved notice (and relicense headers if files carry them — they don't currently). A future open beta or source-available choice can be made later *deliberately*; today's MIT is an accident of the prototype.
- **Dependencies:** production deps are Express (MIT) and its tree; dev dep jsdom (MIT). MIT dependencies impose only notice preservation — compatible with a closed product. Keep a `THIRD-PARTY-NOTICES` file in the commercial build (standard practice; generate with `license-checker`). Cloudflared (tunnel script) is invoked, not bundled — no obligation.
- **Future stack (from the marketing plan):** Capacitor (MIT), Supabase client (MIT), RevenueCat SDK (MIT) — all compatible. No copyleft anywhere in the planned stack.

---

## 5. Domain D — Privacy and data protection (US + EU + LatAm)

*Sections 5-8 are grounded in a dedicated 2025-2026 compliance research pass; sources in the appendix.*

**Today: a genuine clean slate.** The prototype collects nothing — no accounts, no analytics, no server the developer operates for third parties; data lives on the athlete's device or their own machine. There is nothing to remediate *now*, and the architecture is a launch asset: offline-first, on-device-by-default is data-minimization by design, and the existing **Export JSON** feature is a working head start on data-portability rights.

**At launch (accounts + sync + subscriptions + analytics), the full stack becomes mandatory:**

- **GDPR (EU users — the app ships Spanish and English; EU reach is certain).** Training logs alone may be ordinary personal data, but readiness scores, sleep hours, RPE/fatigue trends, and bodyweight-plus-phase data very likely cross into **Art. 9 "data concerning health"** because they are analyzed to assess physical condition (SOURCED reading of EDPB-aligned guidance). The safe posture: treat the synced dataset as Art. 9 and collect **explicit, unbundled consent** (Art. 9(2)(a), per EDPB Guidelines 05/2020) — the cloud-sync opt-in *is* the consent moment; write it that way. Contract necessity (Art. 6(1)(b)) covers account/subscription mechanics but cannot substitute for the Art. 9 condition. Design so raw training data stays on-device where feasible and keep analytics events content-free (feature usage, never lift numbers). Baseline obligations regardless: an Art. 13/14-complete privacy policy; processor agreements with Supabase/RevenueCat/PostHog (all provide standard DPAs + SCCs); data-subject rights within one month, in-app rather than by email (export exists; **deletion must be built** — see also the Apple account-deletion rule in Domain F); 72-hour breach notification; an Art. 27 EU representative may be required for a non-EU publisher [ATTORNEY].
- **ePrivacy/consent:** the consent rule covers mobile SDKs, not just cookies — analytics must not initialize before opt-in for EU users, with reject as prominent as accept (SOURCED). On iOS, avoid cross-app "tracking" entirely and the ATT prompt is never needed — the organic/creator acquisition model makes this easy.
- **US:** CCPA/CPRA applies only above thresholds (~$26.6M global revenue inflation-adjusted for 2025, or 100K+ California consumers, or 50%+ revenue from selling/sharing data — the 100K prong is what eventually catches growing apps). The sleeper risk is **Washington's My Health My Data Act**: no small-business floor, a private right of action, and "consumer health data" defined broadly enough to capture fitness, sleep, and *inferred* data (SOURCED). Nevada and Connecticut have similar statutes. The practical fix is the same consent-forward design as GDPR — separate opt-in for collection and for sharing plus a consumer-health-data privacy policy — which then covers the strictest US states by default.
- **Mexico (LFPDPPP):** a **new law replaced the 2010 statute on 20 March 2025**; INAI was dissolved and enforcement moved to the Ministry of Anticorruption and Good Governance (SOURCED). Minimum for a foreign publisher: Spanish-language privacy notice (full + simplified at point of collection), consent for sensitive data (health data is sensitive), an ARCO-rights channel, security measures; fines scale to 320,000 UMA with sensitive-data multipliers. **Brazil (LGPD):** applies from the first Brazilian user, no revenue threshold; health data is sensitive (specific consent); ANPD Resolution CD/ANPD 2/2022 gives small agents a lighter regime (DPO exemption available) but a Brazil-facing contact channel is expected (SOURCED). For both: the GDPR-grade consent + notice + rights stack, translated (the ES localization covers Mexico's notice; Brazil needs PT).
- **Minors:** the amended COPPA Rule (published 22 April 2025, **full compliance due 22 April 2026**) expanded "personal information," tightened third-party-disclosure consent, and mandates written retention policies (SOURCED). The cleanest path for a strength app: a **16+ age gate** and no child-directed marketing — which simultaneously clears COPPA's triggers and the EU's per-country digital-consent ages (13-16 by member state) without country-by-country gating. Apple overhauled age ratings in July 2025 (4+/9+/13+/16+/18+, with a mandatory medical/wellness question in the new questionnaire); answer the store questionnaires consistently with the 16+ posture.

## 6. Domain E — Consumer and subscription law

The recommended IAP-primary model outsources most mechanics to Apple/Google (they run the billing, renewal notices, cancellation UX, and act as merchant of record for VAT/sales tax — a genuinely large compliance subsidy for a solo publisher). What remains yours:

- **Disclosure at the paywall:** price, renewal period, renewal price after any intro, and cancellation path, stated plainly *in the app's own paywall UI*, not just in the store sheet. This satisfies the overlapping cluster of **California's ARL as amended by AB 2863 (effective 1 July 2025)** — express affirmative consent to the renewal terms, pre-billing notice stating amount and frequency, same-medium click-to-cancel, and 3-year retention of the consent records (SOURCED) — plus other state ARLs and EU pre-contractual information duties.
- **The founding-member intro ($59.99 first year renewing at $79.99)** is a negative-option intro offer: the post-promo price must be disclosed clearly and conspicuously *before* consent, captured in the consent record, and restated in the pre-renewal notice (SOURCED, AB 2863). Apple's renewal emails discharge much of the reminder mechanics for IAP; the paywall disclosure is still yours.
- **FTC "click-to-cancel" (Negative Option Rule):** vacated by the Eighth Circuit on 8 July 2025 on procedural grounds, days before its compliance deadline; as of January 2026 the FTC has moved to restart the rulemaking (ANPRM at OIRA), and **ROSCA, FTC Act §5, and state ARLs govern negative options meanwhile** (SOURCED). Build to the California standard and federal rule churn stays irrelevant.
- **EU right of withdrawal:** 14 days for distance contracts. For digital content the right can be extinguished under CRD Art. 16(m) only with express consent to immediate performance plus acknowledgment of loss — but the pending CJEU case **C-234/25 (Sky Austria)** suggests subscription apps are "digital services," where the withdrawal right runs 14 days regardless with pro-rata payment (SOURCED). Apple's IAP flow handles the mechanics in the store channel; design the web win-back checkout to the stricter digital-services reading. EU Omnibus price-transparency rules govern any "was/now" strike-through of the founding price — show the intro as an intro, not as a discount from a price never charged.
- **The web win-back channel** (the one non-store billing surface in the plan) makes *you* the merchant of record: VAT/OSS or sales-tax registration duties, your own refund policy, your own ARL-grade cancellation flow. Keep it small until it earns its own compliance overhead; Stripe Tax mitigates but does not eliminate this [ATTORNEY when enabled].

## 7. Domain F — Platform compliance

- **Apple 4.2 minimum functionality:** the known Capacitor risk. Mitigations already in the productization plan (local bundling, push, haptics, HealthKit, offline) are exactly what review looks for; ship them in v1.0, not later.
- **Apple 5.1.1 + privacy nutrition labels:** purpose strings for every permission; labels declaring what is collected and whether linked to identity. The on-device-first design keeps the label short — a marketing asset as much as a compliance one.
- **Apple 5.1.3 Health:** if HealthKit ships in v1 (it should, for featuring), its data may not be used for advertising or shared with third parties for anything other than health/fitness purposes, and a privacy policy is mandatory. Keep HealthKit data out of analytics entirely.
- **Apple 5.1.1(v) account deletion:** any app with account creation must offer **in-app account deletion** — build it with the Supabase accounts from day one; retrofitting is a review blocker.
- **Apple 1.4.1 physical harm:** training prescriptions are fine; medical claims are not. See Domain G copy guardrails.
- **Export/encryption:** standard OS-provided crypto and HTTPS are exempt — declare `ITSAppUsesNonExemptEncryption = NO`; only proprietary cryptography would trigger the BIS annual self-classification report (due Feb 1), and France has a separate ANSSI declaration regime for security-type apps that a fitness app does not touch (SOURCED).
- **Google Play:** the Health apps declaration (fitness category), the Data safety form (mirror the Apple labels), Play Billing mandatory for digital subscriptions, easy-cancellation requirements, and the new-personal-account testing gate (12 testers/14 days) already noted in the marketing plan.

## 8. Domain G — Liability, health claims, and terms

- **Disclaimer (ship in onboarding + settings + store description):** not medical advice; consult a physician before starting; stop on pain; user assumes risk of resistance training. This serves three masters at once: Apple 1.4.1, FTC health-claim substantiation exposure, and the civil-liability waiver.
- **Copy guardrails:** the readiness score and sleep flag are *training-load guidance*, and the app's existing framing is already correct ("it's for you, not the algorithm; it never changes your weights") — preserve exactly that posture in all future copy. Never: diagnose, treat, prevent, "improves your health," injury-recovery advice. Watch marketing copy hardest; that is where claims creep.
- **Terms:** Apple's standard EULA suffices for the store build initially; custom ToS become necessary when web accounts/billing exist. Liability waivers: broadly enforceable for *ordinary* negligence in most US states (never for gross negligence; Louisiana, Montana, Virginia, and New York apply heightened scrutiny or bar them), and clickwrap acceptance beats anything passive. Against EU consumers, the Unfair Contract Terms Directive (93/13) voids terms excluding liability for personal injury — rely on disclaimers plus insurance there, and draft every cap severable by jurisdiction [ATTORNEY].
- **Precedent check (reassuring):** the major fitness-app-adjacent litigation is hardware product liability (the Peloton Tread+ recall and injury suits); no reported judgment was found holding a software-only training app liable for programming advice. The risk is real but untested — which argues for the cheap mitigations (disclaimers, screening prompt, non-medical copy), not for product timidity.
- **Insurance:** general/product liability with a tech E&O rider once revenue justifies (~$500-1,500/yr at this scale, ESTIMATED); not a launch blocker, a scale milestone.

## 8H. Domain H — Corporate readiness (brief)

Form the selling entity before revenue (LLC or the owner's local equivalent); decide the App Store seller identity (individual vs organization — organization needs a D-U-N-S number, ~5-30 days lead, already flagged in `docs/pending-future-work.md`'s App Store checklist); banking/tax forms in App Store Connect; if the owner is EU/LatAm-resident, the entity's location drives the GDPR representative and tax questions [OWNER + ATTORNEY]. The store-as-merchant-of-record model keeps cross-border tax exposure minimal until web billing turns on.

---

## 9. The minimum-change doctrine (the lateral map)

The owner's instruction: think laterally; find the smallest change that re-enters the safe area. Here is the complete stays/goes ledger:

| # | Asset | Verdict | Why that is enough |
|---|---|---|---|
| 1 | Wave percentage tables, AMRAP/working-max math, MEV/MRV logic, calibration ramps, autoregulation — **the entire engine** | **STAYS, byte-identical** | Unprotectable process/system (§ 102(b), *Baker*, *Bikram*, *Feist*). The law protects the book's words, not its workout. |
| 2 | Internal scheme IDs `jm2-wave`, `jbb-hyp`; all persisted state shapes | **STAYS** | Not visible to users; not use in commerce; renaming risks saves + test contracts for zero legal gain. |
| 3 | Athlete-facing labels, taglines, `program.methodology` string | **RENAMED** (one string sweep + one `migrateState` line) | Trademark risk lives exactly and only here. Golden master verified clean of these strings — the rename is snapshot-safe. |
| 4 | Store metadata (`manifest.json`, `package.json` description/keywords) | **REWRITTEN** | ASO keywords are textbook "use in commerce"; `juggernaut-method` as a keyword is indefensible. |
| 5 | Code comments/tests narrating book provenance | **REWORDED** (concept language; page cites move to private docs) | Comments are shipped product in a no-build app and discovery exhibits in a dispute. Meaning is preserved; admissions are not. |
| 6 | README | **REWRITTEN for the commercial fork** | It is the single densest concentration of risk: trademark use, "verbatim" admission, trade-dress admission, and "buy the book" all in one file. The prototype README was honest and fine *as a hobby project*; the product needs a product README. |
| 7 | `VOLUME_LANDMARKS` seeded RP grid | **BLENDED/DERIVED over time** (already on the roadmap) | The one dataset with colorable thin-compilation protection. Runtime recalibration already diverges behavior from the printed table; migrating the seed values closes the question. Not launch-blocking; do it before scale. |
| 8 | The book PDF | **DELETED + history purge** | Wholesale reproduction has no defense. Citations to it (private docs) are fine and stay. |
| 9 | MIT license | **REPLACED** with proprietary notice | One file. Must precede any distribution. |
| 10 | Dark theme, UI layout | **STAYS** (drop only the "styled after" language) | Generic dark fitness UI; the risk was the written imitation intent, not the pixels. |
| 11 | Shipped JS bundle | **MINIFIED** in the commercial build | Strips comments (legal hygiene) and is a perf win the store build wants anyway. |

Net effect: **zero behavioral changes, zero engine changes, one tiny state migration, and a few hundred lines of strings/comments.** That is the entire distance to the safe area on IP. The launch-gated compliance stack (sections 5-8) is additive work, not rework.

## 10. Dev-agent handoff: ordered work items

For the future remediation branch(es). Each item lists acceptance criteria; run `cd app && npm test` throughout (CI gates `check (18)` and `check (20)` on every PR).

1. **Purge the PDF (R1).** Delete `Scientific_Principles_of_Hypertrophy_Training_2020.pdf`; owner decision recorded on history rewrite (recommended: `git filter-repo`, force-push, re-clone). AC: file absent; if rewritten, `git log --all --diff-filter=A -- '*.pdf'` empty.
2. **Relicense (R2).** Replace `app/LICENSE` with a proprietary notice; add `THIRD-PARTY-NOTICES` generation to the future store-build branch. AC: no MIT grant text in the repo; README license section consistent.
3. **String/label scrub (R3).** Execute the B1 table exactly; add the `migrateState` rename for `program.methodology` with a case in `test/migration.test.js` (legacy save with the old string loads and displays the new label; migration idempotent). AC: suite green; golden master untouched (verified expectation — investigate any diff as a bug in the sweep, not a snapshot to regenerate).
4. **Comment/test reword (R4 + B2).** Concept language per section 2-A3/3-B2, including the `[Juggernaut + Bodybuilding]` tag swap and `data.js:1373` source line. AC: `grep -riE 'juggernaut|renaissance periodization|israetel' app/ --exclude=CHANGELOG.md` returns zero matches; test prose updated; no behavioral diffs.
5. **README rewrite (R5 + B4).** Product README for the commercial fork; non-affiliation disclaimer text from B4 where heritage is mentioned. AC: same grep gate as item 4 including README.
6. **Landmark seed migration (R6).** Blend/derive own `VOLUME_LANDMARKS` values (roadmap item exists); keep a private derivation note. AC: values differ from the published grid; `seedLandmarks`/`recalibrateLandmarks` tests updated deliberately; golden master regenerated *only* if landmarks feed the snapshot (they do — this is the one item that legitimately moves it; review the diff).
7. **Name clearance (R8).** [ATTORNEY/OWNER] TSDR + EUIPO knockout for the launch name; store-name availability; backup name chosen. Blocking for store submission, not for items 1-6.
8. **Launch compliance stack (R7, R10).** Build per sections 5-8 checklists (privacy policy URL, ToS/EULA, disclaimers, consent flow, nutrition labels/data-safety forms, age gate, subscription disclosures, encryption declaration). Blocking for store submission.
9. **Minified store build (R4 hygiene).** Part of the Capacitor branch. AC: shipped bundle contains no comments.

Sequencing note: items 1-2 are one-commit fixes an agent can ship immediately; 3-5 are one focused branch ("legal-scrub") with the test suite as the safety net; 6 rides the next engine-tuning branch; 7-8 gate the store submission milestone; 9 rides productization.

## 11. Sources

Carried from the IP research pass (full URLs in `docs/marketing-analysis.md` appendix and below):

- *Baker v. Selden*, 101 U.S. 99 (1879) — https://supreme.justia.com/cases/federal/us/101/99/
- *Bikram's Yoga College v. Evolation Yoga*, 803 F.3d 1032 (9th Cir. 2015) — https://cdn.ca9.uscourts.gov/datastore/opinions/2015/10/08/13-55763.pdf
- *Feist Publications v. Rural Telephone*, 499 U.S. 340 (1991) — https://supreme.justia.com/cases/federal/us/499/340/
- 17 U.S.C. § 102(b) — https://www.law.cornell.edu/uscode/text/17/102
- Wendler 5/3/1 third-party-app takedowns — https://www.theironden.com/forum/threads/5-3-1-phone-apps-l-k.11673/
- RENAISSANCE PERIODIZATION registration — https://trademarks.justia.com/874/29/renaissance-87429014.html
- JuggernautAI (live competing product) — https://www.juggernautai.app/
- MIT license text and irrevocability analysis — https://opensource.org/license/mit

From the launch-compliance research pass (2025-2026):

- GDPR Art. 9 / fitness data: https://secureprivacy.ai/blog/gdpr-article-9-special-categories-lawful-processing-and-compliance-guide-2026 ; https://gdprlocal.com/gdpr-for-wearable-technology/ ; SDK consent: https://secureprivacy.ai/blog/gdpr-compliance-mobile-apps ; https://cookieinformation.com/resources/blog/does-gdpr-apply-to-mobile-apps/
- CCPA thresholds: https://cppa.ca.gov/faq.html ; https://www.clym.io/blog/ccpa-applicability-guide
- Washington MHMDA: https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true ; https://iapp.org/resources/article/washington-my-health-my-data-act-overview ; https://www.clarkhill.com/news-events/news/its-here-the-who-what-and-how-of-washingtons-new-my-health-my-data-act-and-its-private-right-of-action/
- Mexico LFPDPPP 2025: https://www.gtlaw.com/en/insights/2025/3/nueva-ley-general-proteccion-de-datos ; https://www.whitecase.com/insight-alert/mexico-enacts-new-data-protection-regime ; https://iapp.org/news/a/new-authority-established-for-personal-data-protection-in-mexico
- Brazil LGPD: https://secureprivacy.ai/blog/lgpd-compliance-requirements ; https://www.legalmondo.com/2025/04/brazil-dpo-requirements-what-foreign-companies-must-do-to-stay-compliant/
- COPPA 2025 amendments: https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule ; https://www.davispolk.com/insights/client-update/ftc-prioritizes-coppa-enforcement-new-compliance-obligations-take-effect ; Apple age ratings: https://developer.apple.com/news/?id=ks775ehf ; EU consent ages: https://gdpr-info.eu/art-8-gdpr/
- California ARL / AB 2863: https://www.dwt.com/insights/2024/10/ab-2863-updates-california-automatic-renewal-law ; https://btlaw.com/en/insights/alerts/2025/california-expands-automatic-renewal-law-new-requirements-now-in-effect
- FTC click-to-cancel vacatur + revival: https://www.lw.com/en/insights/eighth-circuit-vacates-ftc-click-to-cancel-rule-days-before-compliance-deadline ; https://www.crowell.com/en/insights/client-alerts/clicking-all-the-right-boxes-ftc-moves-to-revive-click-to-cancel-rule-following-eighth-circuit-vacatur
- EU withdrawal / Sky Austria C-234/25: https://eur-lex.europa.eu/EN/legal-content/summary/consumer-information-right-of-withdrawal-and-other-consumer-rights.html ; https://www.williamfry.com/knowledge/world-consumer-rights-day-part-2-reshaping-online-subscription-rights-the-sky-austria-case/
- Apple 4.2 / HealthKit / encryption: https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper ; https://developer.apple.com/documentation/healthkit/protecting-user-privacy ; https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations ; https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption
- Google Play health declaration: https://support.google.com/googleplay/android-developer/answer/14738291?hl=en ; https://developer.android.com/health-and-fitness/health-connect/publish
- Liability/waivers: https://www.law.cornell.edu/wex/exculpatory_clause ; UCTD comparison: https://www.cambridge.org/core/journals/german-law-journal/article/policing-consumer-contract-terms-under-us-and-eu-law-a-comparative-analysis-of-the-directive-9313eec-on-unfair-terms-in-consumer-contracts-and-the-restatement-of-consumer-contracts/78EF06068AC89F7DBBEE03A95198B4F4 ; Peloton suits: https://www.forthepeople.com/blog/peloton-injury-lawsuit/

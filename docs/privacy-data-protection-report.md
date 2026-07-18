# IRONWAVE: Privacy and Data Protection Report (architecture, consent, rights)

Compiled 2026-07-18. Persona: privacy / data-protection specialist for
consumer health-adjacent mobile apps, briefed on
`docs/legal-compliance-report.md` (Domain D is the legal research this
report turns into architecture; the obligations are established there and
not re-argued here), `docs/analytics-instrumentation-report.md` (§6 was
written to be audited by this consultation — the audit is section 9),
`docs/monetization-operations-report.md` (billing data flows),
`docs/release-engineering-report.md` (R1 storage, R7 Sentry, the adapter),
`docs/marketing-analysis.md` (accounts + sync as the anti-churn feature),
`docs/tier-usage-analysis.md` (the free/coach boundary), and the code
(`S` in `app/app.js`: profile incl. typed name, bodyweight, phase,
check-ins with sleep hours and injury flags, free-text set notes).

**Consultation #5 of the launch call sheet** in `docs/pending-future-work.md`.

**Premise, per the owner's directive:** the PWA is the prototype; the
product is native iOS/Android store apps — free logger, paid coach. This
report designs the privacy PROGRAM for that product: not "are we allowed
to" (the legal report answered that) but "what do we build so the answer
stays yes at zero marginal effort." It plans for changes: where the prior
plans defaulted into avoidable data exposure, this report amends them
(section 10). Sections 1-2 are the education and the inventory; 3-9 are
the architecture; 10 is the challenge ledger; 11-12 are owner tasks and
the engineer handoff (PD1-PD8).

---

## 1. What a privacy program is (the education)

Privacy work is not a policy document; the policy is the last artifact,
describing decisions already built. The program is six mechanisms:

1. **Inventory** — know every datum you hold, where, and why (section 2).
2. **Minimization** — the only data that cannot leak, be breached,
   subpoenaed, or mislabeled is data you never collected. Architecture
   beats paperwork (section 3).
3. **Lawful basis and consent** — for this app, mostly consent, collected
   at the right moments, unbundled, freely declinable (section 4).
4. **Rights machinery** — export, deletion, rectification, built as
   product features, not support tickets (section 5).
5. **Retention and vendors** — data ages out on a schedule; every third
   party holding it is under contract (sections 6-7).
6. **Incident readiness** — who does what in the 72 hours after something
   goes wrong (section 8).

**Why this app is unusually well-positioned:** the entire coach runs
on-device. `engine.js` needs no server; prescriptions, autoregulation,
and readiness are computed where the data lives. Most fitness apps ship
training data to a backend because their brain lives there. Ours does
not have to — which means the strongest privacy posture available in
this category ("your training data never leaves your phone unless you
turn on sync") is, for us, mostly a matter of not breaking what is
already true. That is a marketing asset (the ownership ethos the athlete
feedback praised), a compliance asset (minimal Art. 9 processing, short
store labels), and a support asset (nothing to breach). The program's
job is to keep it true under productization pressure.

## 2. The data inventory (the living artifact)

Classification of everything the app persists today or the plans add.
**H** = health / health-adjacent (GDPR Art. 9-cautious, MHMDA-covered),
**P** = personal, **T** = training content, **D** = device/technical.

| Data | Class | Today | At launch |
|---|---|---|---|
| Typed name (`S.profile.name`) | P | on device | on device; sync blob if opted in. Make the field explicitly optional at onboarding (PD2) — it is decorative ("Hi, Alex"), and an empty default is minimization for free |
| Bodyweight + trend (`S.bodyweight`, welcome gate) | H | on device | device + opt-in sync blob only |
| Diet phase (cut/minicut/lean-gain) | H (dieting inference) | on device | same |
| Check-ins: soreness, sleep hours, mindset, injury flags | H | on device | same |
| Session ratings, readiness scores | H | on device | same |
| Free-text set notes, custom exercise names | T/P (users write anything, incl. injury details) | on device | same; never in analytics, redacted from diagnostics (PD6) |
| Sessions, records, e1RMs, programs, landmarks | T | on device | same |
| Language, units, settings | D | on device | same |
| Account identity (email) | P | none | Supabase only if account created; never in analytics; not required to use the app (§3) |
| Entitlement state | D | none | RevenueCat + device cache (TB4) |
| Analytics events | D | none | PostHog, pseudonymous, content-free (analytics report §5-6) |
| Crash reports | D | none | Sentry, scrubbed (PD8) |
| HealthKit | H | none | write-only export (§7); never read, never synced, never in analytics |

**Process rule (PD1 makes it mechanical):** every new persisted field
declares its class in `docs/data-inventory.md` in the same PR, and a test
walks top-level `S` keys against the inventory so an undeclared field
fails CI. Privacy debt accrues one innocent field at a time; this is the
lint against it.

## 3. The architecture ruling: on-device by default, accounts optional, sync as an opt-in blob

The productization plan (marketing §2, echoed in the release report's
Supabase note) treats "accounts + cloud sync" as one launch item. This
report splits it into three decisions and rules each:

1. **The app never requires an account.** Purchases restore through the
   store + RevenueCat with no login; the free logger and the coach both
   run fully on-device. An account exists for exactly one feature:
   sync/backup across devices. This is the single highest-leverage
   privacy decision available — it keeps most users at zero server-side
   personal data, keeps the store labels short, keeps CCPA's 100K-
   consumer threshold distant, and removes a login wall from the day-0
   funnel (a conversion win the marketing plan gets for free). The
   anti-churn goal ("device loss = data loss = 1-star reviews") is
   real; it is served by offering sync well, not by mandating accounts.
2. **Sync is opt-in and the opt-in IS the Art. 9 consent moment** (the
   legal report already suggested writing it this way; this report makes
   it binding). The switch says what leaves the device in plain words.
   Declining changes nothing else.
3. **The sync payload is one versioned, opaque state blob, and the
   server never parses training content.** The prototype's shape is
   already right: `database.json` round-trips whole state. Keep exactly
   that on Supabase — one row per user, `state_json`, version, timestamp,
   RLS so a user reads only their row, encrypted in transit and at rest.
   No per-table schema of sessions/bodyweight/soreness on the server,
   because no server feature needs one — the engine is client-side. This
   is what makes deletion trivial (one row), the breach story small
   (ciphertext-at-rest of one column), and a later end-to-end-encryption
   upgrade possible (encrypt the blob client-side before upload; key in
   the platform keychain with a recovery code).
   **On E2EE at launch: recommended NO, deliberately.** It is the
   strongest posture, but client-held keys mean "forgot password" =
   data loss without a recovery-code UX a solo dev must then support
   forever. Ship standard encryption + RLS + the blob shape now; the
   blob shape preserves the E2EE upgrade for when scale justifies it.
   Decide it consciously (owner task 3) rather than inheriting it.
   **Standing rule either way: any future server-side feature that
   wants to read inside the blob (leaderboards, social, web dashboard)
   re-opens this consultation before it is designed.**

**Device-side hardening (rides R1):** the native state file gets iOS
file protection `completeUntilFirstUserAuthentication` (readable for
background writes after first unlock, encrypted when the device is
locked before that); OS device backups may include it (that is the
user's own backup channel — allowed, and disclosed in the policy).

## 4. Consent choreography (the moments, unbundled)

Four independent consents, each at its natural moment, none bundled,
the app fully usable declining all of them. Never a launch-blocking
consent wall — an offline-first native app has no business opening with
a cookie-banner clone:

| Moment | Consent | Mechanics |
|---|---|---|
| First launch, after the age gate | **Analytics opt-in** (AN2) | One screen: "everything runs on your phone; anonymous usage stats help us improve — share them?" Accept and decline visually equal (legal: reject as prominent as accept). Device-scoped, revocable in Settings |
| Account creation (only if the user goes there) | **Sync consent = the Art. 9 moment** | Names the categories in plain words (training log, bodyweight, check-ins incl. sleep and soreness); explicit, unbundled from the account itself where feasible (account with sync off is legal-nicety but honest: create account → sync toggle defaults ON with the consent text on the same screen and is freely off-switchable) |
| First rest-timer use | **Notifications** (R5, already ruled in-context) | OS permission, asked when it is obviously useful, never at boot |
| Never | **ATT / cross-app tracking** | The design has nothing to ask about; keep it that way |

Consent records (what was consented, when, which policy version) are
kept device-side and, for sync consent, server-side with the account —
timestamped, versioned, boring. Withdrawing analytics consent offers
"also delete what was collected" in the same breath (§5).

A **Settings > Privacy** section (sibling of M6's subscription section)
holds all of it: analytics toggle, sync toggle, export, delete, policy
link. One screen, everything true.

## 5. Rights machinery (product features, not tickets)

- **Export (exists, extend):** the raw-JSON export already satisfies
  portability for local data. At launch it must also cover the server
  blob (trivial: it IS the state) and be mentioned in the policy as the
  portability channel. Loudly free forever (the tier analysis already
  locked this).
- **Local erase (missing today — PD1):** a Settings "Delete all data on
  this device" (confirm, then wipe `S` + localStorage/state file and
  restart to onboarding). The prototype cannot currently be reset
  without dev tools; a store app must be. This also serves the
  support macro "start fresh."
- **Account + server deletion (PD5, Apple 5.1.1(v) makes it a review
  blocker):** in-app, self-serve: deletes the Supabase row and account,
  fires the PostHog deletion API for the pseudonymous ID, unlinks the
  RevenueCat alias (purchase records themselves are the store's ledger
  and survive — say so in the flow honestly), keeps local data unless
  the user also chooses local erase. One month GDPR clock; ours runs in
  minutes because of the blob shape.
- **Rectification:** every datum is user-editable in-app already; note
  it in the policy and move on.

## 6. Retention schedule (decided now, enforced by default)

| Store | Retention |
|---|---|
| On-device state | The athlete's, forever, until they erase it |
| Sync blob | While the account lives; deleted with it. Dormant accounts: deletion warning at 24 months idle, delete at 27 (a cron, not a promise) |
| Analytics (PostHog) | 12 months rolling (analytics report §6.5) |
| Crash reports (Sentry) | 90 days (its default; keep) |
| Consent records | Life of the consent + 3 years (the AB 2863-grade standard, applied uniformly) |
| Support email threads | 24 months, then delete (owner habit, in the runbook) |

## 7. Health boundaries

- **HealthKit is WRITE-ONLY at v1** (amends R8, which left direction
  open): the app exports finished workouts TO Apple Health and reads
  nothing back. Write-only needs no read permission, keeps HealthKit
  data out of our stack entirely (Apple 5.1.3 compliance by
  construction), and keeps the nutrition label short. Reading bodyweight
  from Health is a tempting Cluster F feature someday — that is a new
  consultation, not a default.
- **Google side:** Health Connect write-only mirror when Android parity
  is wanted; the Play Health apps declaration answers follow the same
  posture.
- Copy guardrails for readiness/health language stay as ruled in the
  legal report's Domain G; nothing here loosens them.

## 8. Incident readiness (the 72-hour runbook, sized to reality)

Because of §3, the realistic worst cases are small: a Supabase
misconfiguration exposing sync blobs, a vendor breach notice, or a
stolen owner laptop. The runbook (a one-page doc, PD8): detect →
contain (rotate keys, disable sync writes via a server flag) → assess
scope from Supabase logs → notify (GDPR 72h to the DPA if risk; users
if high risk; MHMDA has its own clock) → post-mortem into this doc.
Owner keeps the DPA contact and attorney number IN the runbook. The
best incident plan is §3: one column of mostly-training JSON, no
emails in analytics, no health data in HealthKit scope.

## 9. Audit of the analytics report §6 (the assigned handoff)

Verdict: **endorsed — the design is correct and unusually clean.** Three
tightenings, all absorbed into the AN slices rather than new ones:

1. **Consent withdrawal must offer erasure in the same gesture** (§5
   above): AN2's revoke toggle gains "also delete collected data,"
   wired to PostHog's deletion API. Withdrawal alone only stops future
   processing; users read it as erasure — close the gap honestly.
2. **GeoIP truncation:** beyond discard-IP, set PostHog to country-level
   geolocation only (a project setting; city-level is default-on in
   some configs and is more than the gates need).
3. **Consent records carry the schema version** they were granted
   against (AN2), so a future schema change can decide whether it needs
   re-consent instead of guessing.

One confirmation worth stating: the banned-property lint (AN1) is the
single most valuable privacy control in the whole analytics plan —
it mechanically enforces this report's §2 classifications at the one
boundary where health data could leak into a vendor. Keep it merciless.

## 10. The challenge ledger (what this report changes in the plans)

1. **Accounts are optional, not the product's front door** (amends the
   marketing/productization framing of "accounts + sync" as one unit;
   §3.1). Sync is the feature; login is not.
2. **The sync schema is a blob, not tables** (constrains the Supabase
   epic before it exists; §3.3). The Express layer "maps directly onto
   Postgres" — true, and the correct mapping is one row, not a
   relational mirror of health data.
3. **E2EE decided consciously: no at launch, path preserved** (§3.3).
4. **HealthKit write-only** (amends R8's open scope; §7).
5. **The typed name becomes optional** at onboarding (§2) — the only
   plain-identity field in `S`, collected by default for a greeting.
6. **Local erase is missing** from every prior plan and from the app
   (§5) — a store app without "delete my data on this device" fails
   both review expectations and basic trust.
7. **A 16+ age gate with NO date-of-birth collection** (PD2): one
   neutral confirmation at onboarding. Collecting DOB to prove we do
   not serve children would be self-defeating; the legal report's 16+
   posture is implemented as a boolean, and the store questionnaires
   answer consistently.
8. **Brazil scoping (owner decision):** LGPD applies from the first
   Brazilian user with no threshold, and the app has no PT localization
   or PT privacy notice planned. Do not geo-block; but the policy's PT
   version and the LGPD contact channel should exist BEFORE any
   Brazil-directed marketing, and the marketing plan's ES push does not
   cover Brazil. Cheap now, awkward retroactively.
9. **Support never receives raw state** (PD6): the support persona
   (#6) inherits a redacted diagnostic export (settings, versions,
   counts, error context — no notes, no bodyweight, no check-ins)
   because the honest alternative users invent is emailing their whole
   database, and that must never become the support norm.

## 11. Owner tasks (human, ordered)

1. **Ratify §3** (accounts optional, blob sync, E2EE deferred-but-
   preserved) — it constrains the Supabase epic before any code exists,
   which is the entire point.
2. **Commission the privacy policy + consumer-health-data section**
   from this report's inventory and retention tables (EN + ES; PT with
   the Brazil decision) [ATTORNEY review, already flagged in legal].
3. **Decide Brazil scope** (§10.8) and record it.
4. **Sign the DPAs** (Supabase, PostHog, RevenueCat, Sentry — all offer
   standard DPAs with SCCs) when each account is created; file them
   with the runbook. Confirm the EU-representative question with the
   attorney once the selling entity's location is fixed (legal 8H).
5. **Approve the consent copy** (§4) — athlete-facing strings, house
   voice, both catalogs; the analytics and sync consent screens are the
   two most trust-sensitive strings in the product.
6. **Answer the store forms from §2/§7** (Apple nutrition label, Play
   data safety, Play health declaration, Apple 16+ rating) when
   submitting — PD8 keeps a drafted answer sheet in the repo so the
   forms are transcription, not decisions made in a web form at 2am.
7. **Keep the runbook current** (§8): DPA contact, attorney, vendor
   security pages, key-rotation steps.

## 12. Engineer handoff (PD1-PD8, in dependency order)

House rules apply: additive state backfilled in `migrateState`,
athlete-facing strings in BOTH catalogs with no em dashes, golden master
untouched (nothing here touches prescription), engine stays privacy-
domain-blind (it computes; it never phones), new top-level functions
through the harness shims, tests per slice. PD1 is pure repo work
startable now and useful to the prototype; PD2-PD3 ride the
productization/onboarding surface (re-run the intake-QA battery after
PD2 per its protocol); PD4-PD5 ride the Supabase epic; PD6 anytime;
PD7 rides R8; PD8 rides R9.

- **PD1. Local erase + the living data inventory (start now).**
  Settings > Privacy gains "Delete all data on this device" (typed
  confirm, wipe state + storage via the R1 adapter face when it exists,
  reload to onboarding). Create `docs/data-inventory.md` from §2; add a
  test that every top-level `S` key (post-`migrateState` defaults) has
  an inventory entry, so undeclared persisted data fails CI.
- **PD2. Onboarding minimization + age gate (with productization's
  onboarding work).** The name field becomes explicitly optional
  (skippable, greeting falls back to the existing neutral label); a 16+
  confirmation (boolean, no DOB) joins the welcome step for store
  builds — `TRACK_SPEC.obSteps` declares it, so all tracks inherit it,
  and the intake-QA battery re-runs.
- **PD3. Consent orchestration + Settings > Privacy.** The §4 moments:
  first-run analytics opt-in screen (wires AN2; equal-prominence
  buttons), consent record storage (timestamp + policy/schema version,
  device-scoped, TB4 pattern), the Privacy settings section (toggles,
  export, erase, policy link). Withdrawal offers analytics-data
  deletion (§9.1).
- **PD4. Sync as a consented blob (binding constraints on the Supabase
  epic).** One row per user (`state_json`, version, updated_at), RLS,
  sync toggle default-on AT account creation with the Art. 9 consent
  text on that screen and freely off; no server-side parsing of
  training content; dormant-account deletion job (§6). The client
  reuses the existing whole-state round-trip shape from
  `loadState`/`save`.
- **PD5. Account deletion + DSR wiring (with PD4; Apple review
  blocker).** In-app delete: Supabase row + auth user, PostHog deletion
  API for the install ID, RevenueCat alias cleanup, honest copy about
  store purchase records; export extended to note it covers the blob
  (it already does by shape). Tests: deletion leaves local state
  intact; erase + delete composes.
- **PD6. Redacted diagnostic export (with the support persona's
  tooling).** A second export: app version, platform, settings,
  migration state, counts (sessions, exercises), last error — zero
  training content, zero free text, zero H-class fields from the
  inventory. The inventory doc marks which fields it may include; the
  PD1 test covers the redaction list too.
- **PD7. HealthKit write-only (rides R8).** `Platform.health` exposes
  export only; no read entitlements requested; HealthKit types never
  appear in analytics events or the sync blob (assert in the AN1 lint's
  banned list).
- **PD8. Store-form answer sheet + crash scrubbing + runbook (rides
  R9/R7).** `docs/store-privacy-answers.md` drafted from §2/§7 and kept
  true by PR review (the R9 checklist gains "labels still match the
  inventory"); Sentry configured with PII scrubbing on (no user context
  beyond the install ID, breadcrumbs sanitized — set notes and state
  never attach to events); the §8 runbook as a one-page doc.

**The one-sentence version:** the coach already lives on the athlete's
phone, so keep it there — no required account, sync as one consented
encrypted blob the server never reads, write-only HealthKit, an
inventory with a CI lint so no field leaks quietly, delete buttons that
actually delete, and a privacy policy that is merely a description of
the architecture instead of an apology for it.

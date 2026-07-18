# IRONWAVE: Release Engineering Report (PWA to Android/iOS)

Compiled 2026-07-16. Persona: mobile platform / release engineer for
JS-cross-platform consumer apps, briefed on `docs/marketing-analysis.md` (v2,
which already ruled Capacitor + the phased GTM), `docs/aso-launch-report.md`
(vitals and review cadence are ASO inputs), `docs/legal-compliance-report.md`
(comments must not ship; store forms), `docs/ui-ux-visual-identity-analysis.md`
(haptics, splash, the polish bar), the `docs/pending-future-work.md` iOS
checklist (owner clickwork; this report is its engineering counterpart), and
the actual code (`app/app.js` persistence, `app/sw.js`, `app/server.js`,
`app/manifest.json`, the CI workflow).

**Consultation #2 of the launch call sheet** in `docs/pending-future-work.md`.

Written to be followed by future engineer agents: sections 1-2 are education
and inventory, 3-8 are the architecture and process decisions with rationale,
9 is the owner's (human) list, 10 is the ordered engineering handoff (R1-R9)
that the pending-future-work doc absorbs as derived branches.

---

## 1. What a "release build" even is (the education)

Today the prototype "ships" by copying files: the browser loads `index.html`
and three plain `<script>` tags. A store app cannot work that way. A **release
build** is a sealed, signed, versioned artifact:

- **Sealed:** all code and assets are packaged into one file — an `.aab`
  (Android App Bundle) for Google Play, an `.ipa` for the App Store. Nothing
  is fetched from your server to "be" the app; what you submit is what users
  run.
- **Signed:** the artifact is cryptographically signed with keys that prove
  the publisher's identity. Android uses a **keystore** (a file + passwords
  you generate once); iOS uses **certificates and provisioning profiles**
  issued through the Apple Developer account. Signing is what makes "an
  update" possible: the store only accepts a new version signed by the same
  identity. **Losing signing credentials is losing the ability to update the
  app** (mitigations in §5 — this is the single scariest novice trap).
- **Versioned:** two numbers ride every build. The *marketing version*
  (e.g. 2.1.0, what users see) and a *build number* (`versionCode` on
  Android, `CFBundleVersion` on iOS) that must strictly increase forever —
  stores reject a submission that does not out-number the last one.
- **Reviewed:** submission goes to human/automated review (typically 24-48h,
  sometimes days), then release — immediately, on a schedule, or **phased**
  (iOS: 7-day gradual rollout; Play: staged percentage rollouts you control).
- **Irreversible-ish:** there is **no rollback on iOS** — if a bad build
  ships, the only fix is submitting a *newer* build and waiting out review
  again. Play allows halting a staged rollout but not un-shipping. Release
  engineering is therefore mostly the discipline of never needing a rollback:
  betas, phased rollouts, and a rehearsed hotfix lane (§7).

**Debug vs release:** the debug build is what development uses — unsigned (or
dev-signed), unminified, verbose. The release build is minified (which for us
is also *legal hygiene*: the legal report requires comments not to ship),
signed with the real identity, and built by a repeatable script, never by
hand-zipping files. "It works on my machine" dies here; the release script is
the machine.

## 2. Inventory: what the prototype already gets right, and the real gaps

Reading the code changes this report's difficulty estimate — mostly downward:

**Carries over (better than expected):**

- **Persistence is already local-first.** `app.js` treats `localStorage` as
  the source of truth and `/api/state` (the Express server) as a best-effort
  convenience; `sw.js` deliberately never intercepts `/api/`. The wrapped app
  therefore does NOT need the server at all — there is no "port the backend"
  project, only a storage-durability upgrade (R1, because iOS WKWebView is
  allowed to evict web storage under disk pressure; a store app cannot lose a
  training log to an OS cleanup).
- **Offline-first, local assets.** The whole shell is static files — exactly
  what Capacitor bundles. Apple's "web wrapper" objection (guideline 4.2) is
  aimed at apps that are a URL in a box; ours runs entirely from the bundle.
- **The app already behaves like an app:** standalone display, theme color,
  safe-area insets, `viewport-fit=cover`, a rest-timer notification path,
  version discipline (`APP_VERSION` in `data.js` kept in step with the
  service-worker `CACHE_VERSION`).
- **434 tests and CI on every PR** — the release lane extends this, it does
  not start from zero.

**The real gaps (each becomes an R-item in §10):**

1. Web storage durability on iOS (above).
2. **No build step exists** — fine for dev (and worth protecting as the dev
   experience), but release needs minify/strip + asset packaging (R3).
3. **The service worker is wrong inside a native shell.** Assets are local,
   so shell caching is pointless complexity there (and SW support inside
   WKWebView is restricted anyway). The SW stays for the web/PWA target;
   native skips registration (R2/R4).
4. **Android hardware back button** does nothing today. In a Capacitor app it
   fires an event we must route through the modal stack (`MSTACK`) and view
   history, or the app closes on first back-press — an instant bad review
   (R4).
5. **Rest-timer notifications** use the web Notification API + SW focus
   handling; native needs the Local Notifications plugin (which also works
   with the screen off — a genuine upgrade, and 4.2 evidence) (R5).
6. **Exercise media** is served same-origin from the self-hosted server; the
   store app has no same-origin server. Clips move to a static host/CDN and
   the capped-cache idea moves from the SW into the platform adapter (R6).
7. No crash/ANR visibility (Play *ranks* on vitals; §4) (R7).

## 3. The architecture: one codebase, three targets

**Capacitor** (the marketing report's ruling, endorsed here) is a thin native
shell: a real iOS app whose single screen is a WKWebView, a real Android app
whose single screen is a system WebView, both loading our HTML/JS **from the
app bundle** (a local origin, not a remote URL), plus a **plugin bridge** that
lets our JS call native APIs (haptics, notifications, filesystem, HealthKit,
store review, share sheet). We keep one codebase; the native projects
(`ios/`, `android/`) are generated once, committed to the repo, and edited
rarely.

Targets:

1. **Web/PWA (dev + self-hosted prototype):** unchanged, no build step,
   Express + localStorage, the SW keeps offline. This remains the daily
   development loop and the test rig — protect it.
2. **Android (Play):** Capacitor shell, `.aab` releases.
3. **iOS (App Store):** Capacitor shell, `.ipa` releases. (watchOS cannot be
   built with Capacitor; the Watch app stays the post-revenue native Swift
   target the marketing report already scheduled.)

**The platform adapter is the load-bearing pattern.** One small module (call
it `platform.js`, loaded before `app.js`) that feature-detects the runtime
and exposes a stable surface:

```
Platform.storage   read/write state    web: localStorage (+/api best-effort)
                                       native: Filesystem JSON (durable)
Platform.haptics   impact/success/...  web: no-op    native: Haptics plugin
Platform.notify    rest timer          web: SW path  native: LocalNotifications
Platform.review    maybeRequestReview  web: no-op    native: store review API
Platform.share     share cards         web: Web Share API  native: Share plugin
Platform.media     clip fetch/cache    web: SW cache native: Filesystem cache
```

This is the same flag-gated no-op discipline the identity report set for
haptics and the ASO report set for review prompts (its E2) — those two items
land *inside* this adapter. Everything stays testable in the existing Node
harnesses because each adapter face is a plain object that tests can stub.

**What we deliberately do NOT adopt:** no framework migration, no bundler in
dev, no over-the-air JS update service at launch (§7), no third-party
"app builder" — the fewer moving parts between a green test suite and a
signed artifact, the fewer novel ways to fail review.

## 4. Risk register (what actually goes wrong for apps like this)

| Risk | Reality | Mitigation |
|---|---|---|
| **Apple 4.2 "minimum functionality"** rejection | Aimed at URL-in-a-box apps; reviewers probe for native value | Local bundle (already true), local notifications with screen off (R5), haptics, share sheet, HealthKit export, store review API, launch screen + status-bar polish (R4). The identity report's polish bar is also review armor. |
| **WKWebView storage eviction** (iOS) | OS may purge web storage under disk pressure; the classic Capacitor data-loss bug class | R1: canonical state moves to a Filesystem JSON file (native), localStorage demoted to fast cache. The existing raw-state export stays as the athlete's own backup. |
| **Android WebView fragmentation** | iOS WKWebView is uniform; Android's System WebView varies by device/update state | Set a floor (Capacitor major's minimum, verify at wrap time — recent majors sit around Android 6+/iOS 14+), test matrix (§8), avoid bleeding-edge CSS/JS features without fallback (the codebase is conservative vanilla JS — good). |
| **Keystore/credential loss** | Unrecoverable app identity pre-mitigation | Enroll in **Play App Signing** (Google holds the signing key; we hold only an upload key, which IS recoverable), Apple signing via App Store Connect-managed certificates; all secrets in a password manager + one offline copy (owner task §9). |
| **Play target-API treadmill** | Play requires new apps/updates to target a recent Android API level (rolls forward yearly) | One small maintenance branch per year; calendar it. Missing it silently blocks updates. |
| **Privacy manifests (iOS)** | Apps + third-party SDKs must declare data use in `PrivacyInfo.xcprivacy`; missing/false declarations reject | R7 picks SDKs (crash reporting) partly on manifest hygiene; keep the SDK count near zero. |
| **Play 12-tester/14-day gate** (new personal accounts) | Cannot be compressed; blocks production access | Owner recruits 12+ testers early (§9); the September beta satisfies the clock. |
| **Vitals as ranking** | Crash rate and ANR suppress Play visibility (ASO dependency) | R7 crash reporting from the first beta; a WebView app's ANRs usually come from main-thread storage writes — R1's debounced async writes prevent the class. |
| **Review-time surprise at launch** | 24-48h typical, longer at first submission; rejections restart the clock | Submit the beta build for review *early* (TestFlight external review is a dry run of App Review), keep launch week free of "must ship today" changes. |

## 5. Signing, versioning, artifacts (the policy, decided once)

- **Android:** generate one upload keystore; enroll in Play App Signing
  immediately (before first upload — it is the default and correct choice).
  Artifacts are `.aab`; Play generates device-optimized APKs.
- **iOS:** Xcode-managed automatic signing against the Developer account
  (fine at solo scale; manual profiles are a later problem). Artifacts are
  `.ipa` uploaded to App Store Connect.
- **Versioning:** keep the repo's existing convention as the source of truth:
  `APP_VERSION` in `data.js` is the marketing version (semver), and the
  release script (R3) stamps it into both native projects plus an
  auto-incremented build number. `sw.js` `CACHE_VERSION` stays in step for
  the web target exactly as today. One version, three surfaces, zero manual
  editing.
- **Branching:** the repo's existing discipline holds (one feature per
  branch, protected `main`). Releases are cut from `main` with a tag
  (`v2.1.0`); a hotfix is a branch off the tag, cherry-picked back. No
  long-lived release branches at this scale.

## 6. Build pipeline and CI (dev stays no-build; release gets a lane)

**Principle: the no-build dev loop is a feature.** Nothing below changes how
development or the 434-test suite works. The release lane is additive:

1. **`npm run build:release` (R3):** esbuild (single devDependency, no
   config sprawl) minifies the scripts, strips comments (the legal report's
   requirement), copies the static assets into `dist/`, and stamps versions.
   Critically, CI then **runs the existing harness against the minified
   bundle** — a smoke that catches "minification broke the one global scope"
   before a reviewer does.
2. **`npx cap sync`** copies `dist/` into the committed `ios/` and `android/`
   projects and aligns plugin versions.
3. **Android CI lane:** GitHub Actions (Linux, free tier) builds the signed
   `.aab` on tags, using the upload keystore from encrypted repo secrets.
   Artifact attached to the release; upload to Play is manual at first
   (Console upload), automated later only if cadence justifies it.
4. **iOS lane:** requires macOS. Recommendation for a solo bootstrap:
   **Xcode Cloud** (free tier includes monthly build hours, integrates
   TestFlight distribution) over buying a Mac immediately; a used M-series
   Mac mini is the fallback if Xcode Cloud chafes (owner decision, §9).
5. **Existing CI** (Node 18/20 `npm test`) is untouched and remains the
   merge gate; the release lane runs on tags only, so day-to-day PRs stay
   fast.

**Fastlane, Appflow, and friends:** not at launch. They earn their complexity
at multi-release-per-week cadence; at ours (monthly-ish), Console/Connect
uploads plus the two lanes above are fewer failure modes.

## 7. Release process, cadence, and the OTA question

- **Channels:** internal (owner devices) → **TestFlight + Play open testing**
  (the September beta; also satisfies the 12-tester gate) → production with
  **phased rollout always on** (iOS 7-day phased, Play start at 10-20%).
  Halting a phased rollout is the closest thing to a rollback we get.
- **Cadence:** train, not heroics — a release roughly monthly post-launch;
  ratings-prompt and paywall changes ride normal trains (the marketing
  report's one-experiment-at-a-time rule makes faster shipping pointless
  anyway).
- **Hotfix lane (rehearse once before launch):** branch from the release
  tag, fix, tag, build both artifacts, request expedited review (Apple grants
  it sparingly — do not cry wolf), Play halt-and-replace the rollout.
  Target: fix live within 48h of a P0.
- **Over-the-air JS updates** (Appflow, Capgo, etc. can swap the web bundle
  without store review; Apple tolerates it within limits): **skip at
  launch.** It is a whole parallel release system with its own failure modes
  and review-policy gray zones, solving a problem (urgent shipping) we can
  mostly avoid with phased rollouts and the hotfix lane. Revisit only if
  store review latency actually burns us twice.
- **Definition of done for any release:** suite green on the minified
  bundle, the §8 device pass, store metadata/what's-new in EN + ES, version
  stamps consistent, changelog updated — then tag.

## 8. Device/OS matrix and the pre-submission checklist

**Minimum OS:** whatever the chosen Capacitor major supports (verify at wrap
time; recent majors sit around iOS 14+ / Android 6+). Given the audience
(22-40, smartphone-native), do not spend effort below the framework floor.

**Physical test matrix (small on purpose):** one older iPhone (smallest
supported screen, e.g. an SE class — the 390px-first CSS should degrade
gracefully, verify), one current iPhone (notch/Dynamic Island safe areas),
one mid-range Android (the WebView reality check — a Samsung A-series class
device, not a flagship), one large-screen Android. Emulators/simulators cover
the rest.

**Pre-submission checklist (per release, keep in the repo):** cold start
offline; kill-and-relaunch mid-session (state survives); Android back button
through every modal depth; rest timer fires with screen off; notification
permission asked in context (first timer use, never at boot); safe areas on
notched devices; keyboard does not cover the active input; ES locale
end-to-end; no console errors in the packaged build; privacy labels still
match reality; version numbers bumped.

## 9. Owner tasks (human, mostly accounts and custody)

The `docs/pending-future-work.md` "iOS App Store build" checklist already
itemizes the account work (Apple Developer Program, D-U-N-S decision, Play
Console, agreements, privacy policy URL). This report adds only:

1. **Decide the macOS question:** Xcode Cloud (recommended first) vs a used
   M-series Mac mini. Needed at R4, not before.
2. **Credential custody:** a password manager entry (plus one offline copy)
   holding the Android upload keystore + passwords, Apple account recovery,
   and 2FA backup codes. Do this the day the accounts exist, not the day a
   laptop dies.
3. **Recruit the 12+ Play testers** (Discord/friends) so the 14-day clock
   starts with the September beta, not in launch week.
4. **Enroll in Play App Signing** at first upload (it is a checkbox — the
   point is knowing to leave it checked).
5. Approve the minimum-OS floor and the four physical test devices (buying
   used mid-range hardware is a ~$300 line item, cheaper than one bad-vitals
   month).

## 10. Engineer handoff (R1-R9, in dependency order)

House rules apply throughout: additive state backfilled in `migrateState`,
strings in both catalogs, no em dashes, golden master untouched (nothing here
touches prescription), new top-level functions exported through the harness
shims, tests extended per slice. R1-R3 need no store accounts and can start
now, at prototype stage.

- **R1. Durable storage adapter (start now; the highest-risk gap).**
  Introduce `Platform.storage` with the web implementation extracted from
  today's `loadState`/`save` (behavior byte-identical), then the native
  implementation writing the state JSON via the Capacitor Filesystem plugin
  (documents directory, debounced async writes, atomic write-then-rename),
  with localStorage kept as a fast mirror and migration importing whichever
  copy is newest on first native launch. The existing raw-JSON export stays.
  Persistence tests extend to the adapter seam.
- **R2. Platform adapter skeleton (with R1).** `platform.js` with the §3
  surface, web no-ops/fallbacks for everything, feature-detection via the
  Capacitor global. ASO E2 (review prompts) and the identity report's
  haptics item implement against this surface instead of sprinkling
  platform checks. SW registration in `index.html` becomes
  web-target-only.
- **R3. Release build lane (start now).** esbuild minify/strip into
  `dist/`, version stamping from `APP_VERSION` (data.js stays the source of
  truth; sw.js CACHE_VERSION alignment kept), and a CI job that runs the
  node:test harness against the minified bundle on tags. This also
  satisfies the legal report's comments-must-not-ship requirement early.
- **R4. The wrap branch.** `npx cap init/add`, committed `ios/`/`android/`
  projects, StatusBar/SplashScreen/Keyboard plugins configured to the
  identity system's colors, icons/splash generated from the final mark
  (blocked on identity P0/P1 assets), **Android back button** routed through
  `MSTACK`/view history (close modal → step back → background the app,
  never immediate exit), and the `user-scalable` decision from the identity
  report made deliberately here with the in-app text-size compensation if
  zoom stays off.
- **R5. Local notifications.** Rest-timer completion via the
  LocalNotifications plugin (fires with the screen off), permission
  requested in context on first timer use; web path keeps the current SW
  notification. This is the single strongest 4.2 exhibit.
- **R6. Media pipeline for native.** Clips move to a static host (any CDN or
  object storage; the manifest already keys them), `Platform.media`
  implements the capped cache via Filesystem on native (the SW media cache
  logic is the reference), same emoji fallback. Owner decides the host
  (pennies at this scale).
- **R7. Crash/vitals visibility.** Sentry's Capacitor SDK (self-hostable
  later, aligns with the product ethos; minimal privacy-manifest surface),
  wired from the first beta build; release tags in events; privacy labels
  updated. Keep total third-party SDK count at exactly this one for as long
  as possible.
- **R8. HealthKit export slice.** Workout write-out via a maintained
  Capacitor HealthKit plugin (evaluate at build time; wrap it behind
  `Platform.health` regardless), iOS-only UI affordance, entitlement +
  privacy label updates. Marketing lists HealthKit as a v1 featuring
  criterion, so this rides the wrap epic, not post-launch.
- **R9. Pre-submission automation.** The §8 checklist as a repo doc +
  whatever is scriptable (version-consistency check across data.js/sw.js/
  native projects as a lint-style test; packaged-build console-error smoke
  via the existing jsdom/Playwright tooling).

Sequencing against the GTM: R1-R3 now (prototype stage, pure repo work);
R4-R7 are the Phase 1 productization epic's engineering spine (with ASO E1-E4
riding alongside); R8 lands before the featuring nomination; R9 before the
September beta. The Supabase accounts/sync and RevenueCat work from the
marketing report are SEPARATE epics that plug into `Platform.storage` and the
paywall respectively — this report deliberately keeps the wrap shippable
without them (the app is honest offline-first today; accounts arrive as a
feature, not a prerequisite).

**The one-sentence version:** the prototype is closer to a store app than it
looks (local-first state, offline shell, real tests) — wrap it in Capacitor
behind one platform adapter, move state to durable native files, add the
native value Apple wants to see anyway (notifications, haptics, HealthKit),
build releases with a script instead of hands, guard the signing keys like
the working maxes, and never ship anything the phased rollout cannot catch.

---

## Amendment (2026-07-18): synergy re-pass after consultations 4-6

Commissioned by the owner after the analytics
(`docs/analytics-instrumentation-report.md`), privacy
(`docs/privacy-data-protection-report.md`), and support
(`docs/support-community-report.md`) consultations amended this plan after
the fact. Scope: what changes, what breaks, what new synergy exists. The
original sections stand except where amended here; a future engineer reads
R1-R9 PLUS this section as the true spec.

### What changes

1. **R7's SDK ceiling is three, not one.** The original wording ("keep
   total third-party SDK count at exactly this one") is superseded by the
   analytics report §2. Corrected spec: **exactly three shipped SDKs —
   Sentry, PostHog, RevenueCat — each behind an adapter face, each with a
   privacy-manifest entry, and the ceiling is a rule, not a floor.**
   Anything further (attribution, A/B vendors, heatmaps) needs a
   consultation-grade reason. The §4 privacy-manifest risk row now covers
   three manifests; the R3 lane should fail if a fourth SDK appears in the
   native dependency lockfiles.
2. **R8 narrows to write-only.** Privacy §7/PD7 closes the direction R8
   left open: `Platform.health` exposes workout EXPORT only, no read
   entitlements requested, and HealthKit types join AN1's banned-property
   lint so they can never reach analytics or the sync blob. Reading
   bodyweight back from Health is a future consultation, not a default.
   Health Connect on Android inherits the same posture.
3. **R4's first-run sequence grew, and its front door moved.** Two
   consent-class screens join the wrap scope: the 16+ age gate (PD2,
   boolean, no DOB) and the analytics opt-in (PD3/AN2, equal-prominence
   buttons, no PostHog code loads pre-consent). Store-build order:
   splash, age gate, analytics consent, home. And "home" changed under
   us: Epic L's L3 makes the logger home the free install's landing, with
   the quiz reachable as the coach's front door — the original R4
   implicitly assumed onboarding-first. See R10. The back-button design
   is unchanged but its target set grew (Help, Settings > Privacy, the
   paywall all stack through `MSTACK` as ordinary modals).
4. **R9 absorbed three checklists.** The pre-submission checklist gains:
   PD8's "store privacy labels still match `docs/data-inventory.md`" line
   (answer sheet drafted in-repo), AN6's beta dress-rehearsal assertions
   (consent blocks SDK init, events arrive under the install ID,
   banned-property lint green against the PACKAGED build, schema version
   stamped, schema frozen at beta), and CS4's two lines (what's-new in
   the house voice in EN + ES; FAQ reviewed against the release's
   changes). R9's version-consistency check extends to the analytics
   schema version and the consent policy version.
5. **R1 hardens.** The native state file gets iOS file-protection class
   `completeUntilFirstUserAuthentication` (privacy §3): encrypted before
   first unlock, still writable by our debounced background writes after
   it — which is exactly why the stricter `complete` class is wrong here.
   R1's face also gains an `erase()` operation so PD1's "Delete all data
   on this device" wipes state file + localStorage mirror through one
   seam instead of poking storage directly.
6. **The beta must-include list is now a real dependency graph.** CS1
   must be IN the September beta build (support §9.2) — Play open testing
   has no feedback channel, so CS1 is the beta's only Android feedback
   path. CS1 needs PD6 (redacted diagnostic), PD6 needs PD1's inventory
   to define the redaction list, AN6 needs AN1-AN4 live, CS3's two events
   must land before the schema freeze, and T1 now has three reports
   leaning on it landing pre-beta (tier analysis, analytics §4, support
   §9.6). True beta critical path: R1-R5 + R7, AN1-AN4, PD1-PD3 + PD6,
   CS1 + CS3, M1/M3 sandbox, T1 — materially more than this report's "R9
   before the September beta" framing. See What breaks.
7. **The tags-only lane stands, with two riders.** CS4 makes what's-new
   copy part of the tag ritual (both catalogs), and support's severity
   ladder gives the 48h hotfix lane its trigger: P0 = athletes cannot
   train or data is being lost, and Sentry should page before the first
   email does (support §4). The hotfix rehearsal §7 already required now
   includes the support half: halt the phased rollout, post the
   known-issue FAQ line, macro ready. OTA updates stay skipped; nothing
   in consultations 4-6 weakens that ruling.
8. **The §3 adapter table has grown faces:** `Platform.billing` (M1),
   `Platform.analytics` (AN1, permanent no-op on web/self-hosted),
   `Platform.health` (R8), and `Platform.crash` (R11). Same pattern,
   same rule: every face stubs in the Node harnesses. The §10 Supabase
   note is now constrained by PD4 — accounts optional, sync is one
   consented RLS blob row, and the blob IS R1's state JSON shape, which
   makes "plugs into `Platform.storage`" literal rather than
   aspirational.

### What breaks

- **R7's one-SDK sentence is dead**; do not quote it (delta 1 has the
  corrected wording).
- **R7's "wired from the first beta build" conflicts with
  consent-before-init** unless crash reporting is ruled separately from
  analytics. AN2 blocks PostHog pre-consent; nobody ruled whether Sentry
  waits too. Unresolved — see Challenges.
- **The §8 checklist as printed is stale**; R9's in-repo version becomes
  the source of truth with delta 4's additions.
- **The original beta scope estimate was too small.** Delta 6's graph is
  roughly twice the original framing; the honest risk is September slips
  or cuts scope. Cuts that do NOT break the beta's purpose: R6 (ship
  emoji-fallback-only media), R8 (HealthKit is a launch featuring
  criterion, not a beta rehearsal need), PD5 (blocks App Review, but
  accounts are not in the beta unless the Supabase epic lands, and
  nothing requires that). Cuts that DO break it: the consent screens,
  CS1, the AN pipeline, T1 — those are what the beta exists to rehearse.
- **R4's implicit onboarding-first first-run is invalid** post-Epic L
  (delta 3; mechanics in R10).

### New synergy

- **AN6 + R9 are one artifact.** The dress rehearsal runs against R3's
  minified `dist/` bundle, so the banned-property lint and the i18n
  completeness test catch a leaking property or a missing ES string in
  the exact bytes a reviewer sees.
- **AN4's install ID is Sentry's user id.** With R7's release tags, every
  crash joins to a cohort and a version for free, and PD8's scrubbing
  keeps it pseudonymous.
- **The privacy posture is 4.2 armor.** On-device coach, no account
  wall, no ATT, short nutrition labels (privacy §3) shorten the App
  Review conversation, and L3's logger home makes the app self-evidently
  useful at first open with no purchase or login — the strongest
  minimum-functionality exhibit added since the original risk register.
- **PD6 doubles as crash hygiene.** The redacted diagnostic CS1 attaches
  to support email and the Sentry breadcrumb scrub share one redaction
  list: the PD1 inventory governs both boundaries.
- **CS4's what's-new is the beta digest** (support §8): written once,
  reused as the store note, the weekly cohort post, and the changelog
  line.

### Challenges to prior rulings (owner decides)

1. **Sentry consent timing.** Option A: crash reporting joins the
   analytics opt-in (one screen covers both; decliners become a crash
   blind spot, which at beta scale could be most of the cohort). Option
   B: Sentry runs pre-consent under legitimate interest with PD8
   scrubbing (defensible for pure crash data; the attorney should bless
   it and the consent copy must not imply otherwise). This report leans
   B for the beta — a beta without crash visibility defeats R7's purpose
   — with A as the conservative fallback. The ruling must land before
   AN2's consent copy is written.
2. **Ratify the beta cut line** (What breaks, item 4): R6/R8/PD5 slip to
   launch if September is at risk; the consent screens, CS1, the AN
   pipeline, and T1 never slip.

### New engineer notes (R10-R12)

- **R10. First-run sequencer (rides R4, with PD2/PD3 and Epic L's L3).**
  A small declarative chain for store builds: age gate, then analytics
  consent, then the L3 logger home (quiz reachable as the coach's front
  door). Completion flags are device-scoped (TB4 pattern, never in `S`,
  ignored by import/export); the web/self-hosted target skips the chain
  entirely so the prototype and render-smoke stay untouched. Each step
  is a normal modal through `MSTACK` so R4's back-button routing covers
  it. Render-smoke gains a store-flagged first-run pass.
- **R11. Crash adapter face (rides R7).** Wrap Sentry behind
  `Platform.crash` (init, setRelease, breadcrumb scrub config) instead
  of direct SDK calls, so the challenge-1 ruling is a one-line policy
  change, PD8's scrubbing lives in one place, and web/self-hosted is the
  usual permanent no-op. R3 stamps the release tag from `APP_VERSION`
  at build time.
- **R12. Build-channel flag (rides R3).** The release lane stamps one
  `BUILD_CHANNEL` constant (`dev` / `beta` / `store`) into the bundle.
  Consumers: TB5 (hide `S.debugTier` outside dev), AN1 (no-op outside
  store builds), R10 (chain runs only on beta/store), R11 (Sentry
  environment tag), CS1 (beta feedback copy variant if wanted). One
  constant, one stamp point, instead of five ad hoc detections.

**The one-sentence delta:** the wrap now ships a consent-and-age-gated
first run that lands on the free logger, three SDKs instead of one (each
behind a face the prototype no-ops), write-only HealthKit, a hardened and
erasable state file, and a beta whose real critical path runs through the
analytics pipeline, the help surface, and the receipts — cut media and
HealthKit before you cut any of those.

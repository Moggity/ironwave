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

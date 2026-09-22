# App Store / Play Store Readiness Audit

Audited 2026-09-11 against `app.json`. **Re-checked 2026-09-22:** three of the four
blockers below were cleared on 2026-09-18 by "Set up EAS Build so the app can ship
outside Expo Go" — the per-item sections still explain each one, with a resolution note
where the answer has changed. This is a checklist/report only; nothing here creates
developer accounts or submits anything.

## Summary

**One blocker left: the privacy policy.** Both stores require a hosted privacy policy URL
before a listing can go live, and there is still no privacy policy anywhere in this repo.
Identifiers, the build config and the version scheme are all in place now, so `eas build`
can run.

| Area | Play Store | App Store | Status |
|---|---|---|---|
| Package name / Bundle ID | `com.bookbarber.app` | `com.bookbarber.app` | ✅ Set 2026-09-18 |
| App icon | Present, correct format | Present, correct format | ✅ |
| Adaptive/monochrome icon (Android only) | Present, smaller than recommended | n/a | ⚠️ Works, not ideal |
| Splash screen | Present | Present | ✅ |
| Version / build number scheme | EAS-managed | EAS-managed | ✅ `appVersionSource: remote` |
| Permissions declared vs. used | None used, none declared | None used, none declared | ✅ Consistent |
| Privacy policy URL | Not found | Not found | ❌ Blocker (both require it) |
| EAS build config | `eas.json` present | `eas.json` present | ✅ Added 2026-09-18 |

**Also set on 2026-09-18:** `owner: talha-riazs-team` and
`extra.eas.projectId: 8462f21a-54d1-48af-b926-c96c3b4e9f1a`, both of which an EAS build
needs. Note that `expo.slug` is still `sanwaro`, which is the EAS project's name and not
the store-facing one — `expo.name` ("BookBarber") is what appears on a listing, so this
is cosmetic, but it is the name you will see in the Expo dashboard.

## 1. Bundle identifier / package name

> **Resolved 2026-09-18.** `ios.bundleIdentifier` and `android.package` are both
> `com.bookbarber.app`, and `owner` / `extra.eas.projectId` are set. The reasoning below
> is kept because the "effectively permanent" warning still applies to any future change.

**Missing on both platforms (as audited 2026-09-11).** `app.json`'s `ios` block has only `supportsTablet: true`
— no `bundleIdentifier`. The `android` block has `adaptiveIcon` and
`predictiveBackGestureEnabled` — no `package`. Neither `owner` nor
`extra.eas.projectId` is set either (both needed once an EAS project exists).

This is not a placeholder-vs-real-value question — there's no value at all yet. If you
run `eas build` without setting these, EAS will either prompt interactively (not possible
in an unattended run) or, in some flows, auto-generate a default like
`com.anonymous.saloonbookbarbermobile`, which:
- is *not* the anonymous-`com.anonymous.*` id you'd want on a real store listing, and
- **is effectively permanent** — Android's `applicationId`/iOS's bundle ID can never be
  changed after the first Play Store / App Store submission without publishing as a
  brand-new app listing (losing reviews, install base, and the store URL).

**Recommendation (decision for Talha, not something I set myself):** pick real reverse-
DNS identifiers before the first build, e.g. `com.bookbarber.app` for iOS
`bundleIdentifier` and the same or `com.bookbarber.app` for Android `package` (they don't
have to match but conventionally do). I did not invent or set one — this needs to match
whatever Apple Developer / Google Play Console account and domain Talha actually
controls.

## 2. App icons and splash screens

Checked actual pixel dimensions and PNG color type of every referenced asset:

| File | Size | Alpha channel | Used as |
|---|---|---|---|
| `assets/images/icon.png` | 1024×1024 | **No** (correct — Apple rejects icons with transparency) | `expo.icon` (both platforms' primary icon) |
| `assets/images/android-icon-foreground.png` | 512×512 | Yes (expected — adaptive icon foreground layer) | Android adaptive icon foreground |
| `assets/images/android-icon-background.png` | 512×512 | — | Android adaptive icon background |
| `assets/images/android-icon-monochrome.png` | 432×432 | — | Android 13+ themed icon |
| `assets/images/splash-icon.png` | 1024×1024 | — | Splash screen (via `expo-splash-screen` plugin) |
| `assets/images/favicon.png` | 48×48 | Yes | Web favicon only — no store relevance |

- **Main icon**: correct size (1024×1024) and correct format (no alpha) for both stores.
  No changes needed.
- **Android adaptive icon layers**: Expo's current guidance recommends 1024×1024 source
  images for the adaptive icon foreground/background/monochrome layers (with content
  kept inside a safe-zone circle), scaled down at build time. These are 512×512 (and
  432×432 for monochrome) — smaller than that recommendation. This is **not a hard
  failure** — Expo/Android will still generate all required launcher densities from a
  512×512 source — but the result will be more upscaled than ideal at the largest
  launcher-icon densities. Low priority; only worth revisiting if the Android launcher
  icon looks soft on high-density devices during testing.
- **Splash screen**: present, correct size, configured via the `expo-splash-screen`
  plugin with a white background — no gap found.

## 3. Version / build number scheme

> **Resolved 2026-09-18.** `eas.json` sets `cli.appVersionSource: "remote"` and
> `autoIncrement: true` on the production profile, so EAS holds the build number and
> raises it on every production build. That is why `app.json` still carries no
> `ios.buildNumber` or `android.versionCode` — with remote versioning it should not.

`app.json` has a single top-level `"version": "1.0.0"` — this is the user-facing
marketing version shown in both stores, present and fine as a starting point.

Missing: `ios.buildNumber` and `android.versionCode` — the platform-specific integers
that must increase on every store submission (Apple/Google both reject a resubmission
that doesn't bump these). Since there's no `eas.json`, there's also no
`cli.appVersionSource: "remote"` setting, which is the mechanism EAS uses to
auto-increment these for you on every build. Without either an explicit number in
`app.json` or that remote-auto-increment config, the **first** `eas build` for each
platform will default both to `1` — fine for a first submission, but this needs a
deliberate scheme (manual or remote-auto-increment) before the *second* submission, or
the build will be rejected as a duplicate version.

## 4. Permissions

Checked every dependency in `package.json` and grepped the app for any usage of
camera/location/notification/contacts/microphone APIs:

- **No permission-requiring Expo modules are installed** — no `expo-camera`,
  `expo-location`, `expo-notifications`, `expo-contacts`, `expo-av`, etc. in
  `package.json`.
- **No code in `app/`, `services/`, `providers/`, or `components/` references** any
  camera/location/notification API.
- The in-app "Notifications" screen (`app/notifications.tsx`, wired to the Supabase
  `notifications` table this session) is **in-app/database notifications only** — it has
  nothing to do with OS-level push notifications and requires no permission.

**Conclusion: fully consistent today — nothing requested that isn't used, nothing used
that isn't declared, because nothing permission-gated exists in the app at all.** This
will change the moment push notifications, photo upload (e.g. a profile picture), or
location-based salon search are added — each would need its own Expo module, an
`ios.infoPlist` usage-description string (e.g. `NSCameraUsageDescription`), and (for
Android 13+) a runtime permission request. Worth revisiting this section when any of
those features are built.

## 5. Privacy policy URL

**Not found anywhere in this repo** (`app.json`, `docs/`, `README.md` — no match for
"privacy" in any file). Both the App Store (App Store Connect's "App Privacy" section)
and Play Store (Play Console's "Data safety" + a public privacy policy URL) require one
before a listing can go live, regardless of app content. I did not invent a placeholder
URL — this needs a real, hosted privacy policy page from Talha before either submission
can be started.

## 6. EAS build configuration

> **Resolved 2026-09-18.** `eas.json` exists with `development` (dev client, internal,
> APK), `preview` (internal, APK) and `production` (app-bundle, auto-incrementing)
> profiles, plus an empty `submit.production` block. `cli.version` requires `>= 16.0.0`.
> The draft below is what was proposed here; what shipped is close to it.

**No `eas.json` exists in this repo (as audited 2026-09-11).** Without it, `eas build` cannot run at all — it
needs at minimum a `build` block defining a profile (commonly `development`,
`preview`, `production`) with platform-specific settings (e.g.
`android.buildType`, `ios.simulator`, resource class). Creating one is normally done
interactively via `eas init` + `eas build:configure`, which requires an authenticated
Expo account — out of scope for this read-only audit (and per the ground rules, no
developer accounts were created this session).

**Minimal starting point**, for Talha's/next-session's reference (not applied — this is
documentation, not a change):
```json
{
  "cli": { "version": ">= 12.0.0", "appVersionSource": "remote" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal" },
    "production": {}
  },
  "submit": { "production": {} }
}
```

## What's needed before either store submission can actually start

As re-checked on 2026-09-22, in order:

1. **Host a privacy policy** and add its URL to both App Store Connect and Play Console
   during listing setup. Not an `app.json` field — a store-listing field. This is the
   only remaining hard blocker, and it needs a real hosted page, not a placeholder.
2. **Fill in the store listings themselves**, which this audit never covered because they
   live in the consoles rather than the repo: description, screenshots at the required
   sizes, category, content rating questionnaire, and Play's Data safety form.
3. **Run a production build and install it on a real device.** `eas build` can run now,
   but nothing in this repo proves a store-profile build has been produced and opened.

Done: identifiers, EAS config, version scheme, icons, splash, permissions consistency.

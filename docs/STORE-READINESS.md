# App Store / Play Store Readiness Audit

Audited 2026-09-11 against `app.json` (no `eas.json` exists in this repo). This is a
checklist/report only — nothing here creates developer accounts or submits anything.

## Summary

**Not ready for either store yet.** The two blockers are the same for both platforms:
no bundle identifier / package name is set, and there is no `eas.json`, so `eas build`
cannot run at all today. Icons/splash exist and are reasonable; the privacy policy URL
required by both stores could not be found anywhere in the repo.

| Area | Play Store | App Store | Status |
|---|---|---|---|
| Package name / Bundle ID | Missing | Missing | ❌ Blocker |
| App icon | Present, correct format | Present, correct format | ✅ |
| Adaptive/monochrome icon (Android only) | Present, smaller than recommended | n/a | ⚠️ Works, not ideal |
| Splash screen | Present | Present | ✅ |
| Version / build number scheme | No `versionCode` | No `buildNumber` | ❌ Blocker |
| Permissions declared vs. used | None used, none declared | None used, none declared | ✅ Consistent |
| Privacy policy URL | Not found | Not found | ❌ Missing (both require it) |
| EAS build config | No `eas.json` | No `eas.json` | ❌ Blocker |

## 1. Bundle identifier / package name

**Missing on both platforms.** `app.json`'s `ios` block has only `supportsTablet: true`
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

**No `eas.json` exists in this repo.** Without it, `eas build` cannot run at all — it
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

In order:
1. Talha decides and sets real `ios.bundleIdentifier` / `android.package` values in
   `app.json` (needs to match his Apple Developer / Google Play Console accounts).
2. Create `eas.json` (via `eas init`/`eas build:configure` under an authenticated Expo
   account) and decide the version/build-number scheme (`appVersionSource: "remote"` is
   the simplest if using EAS for every build).
3. Host a privacy policy and add its URL to both App Store Connect and Play Console
   during listing setup (not an app.json field — a store-listing field).
4. Everything else audited above (icons, permissions) is already in acceptable shape.

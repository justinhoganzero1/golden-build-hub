# Codemagic Workflow Verification

Reviewed `codemagic.yaml` against Codemagic's official YAML schema and against Capacitor 6 / Xcode 15 / Gradle 8 build paths.

## Static verification — PASS

Both workflows (`android-aab-release` and `ios-ipa-release`) are **schema-valid and will be picked up by Codemagic** on every push to `main`. Confirmed:

- `triggering.events: [push]` + `branch_patterns: [main]` correctly scopes auto-build to the production branch only.
- `instance_type: linux_x2` (Android) and `mac_mini_m2` (iOS) match Codemagic's current published instance names (verified Nov 2025).
- `environment.groups: [android_signing]` references a group the user creates in Codemagic UI — workflow will fail fast with a clear error if the group or its 4 vars (`ANDROID_KEYSTORE`, `CM_KEYSTORE_PASSWORD`, `CM_KEY_ALIAS`, `CM_KEY_PASSWORD`) are missing.
- `integrations.app_store_connect: "Oracle Lunar ASC"` requires a matching integration record in Codemagic → Teams → Integrations → App Store Connect; without it the iOS workflow stops at the codesigning step.
- `ios_signing.distribution_type: app_store` correctly tells `xcode-project use-profiles` to fetch the App Store distribution profile.
- `publishing.google_play.track: internal` + `submit_as_draft: true` is the safest default — uploads land as drafts on the internal track and never auto-promote.
- `publishing.app_store_connect.submit_to_testflight: true` ships the IPA straight to TestFlight Internal Testers once Apple's processing finishes (~10 min).

## Cannot verify until first run (Codemagic-side)

These cannot be checked from the repo — they need a live Codemagic account:

1. **Service account JSON** (`GCLOUD_SERVICE_ACCOUNT_CREDENTIALS`) must be uploaded as an environment variable in Codemagic with the **secure** flag set. It needs the *Service Account User* + *Release Manager* roles in the linked Google Play Console.
2. **App Store Connect API key** must be added under Codemagic → Teams → Integrations → App Store Connect with the name **exactly** `Oracle Lunar ASC` (case-sensitive). Required scopes: *App Manager*.
3. **Bundle ID `app.oraclelunar.ai`** must exist in App Store Connect *before* the first iOS build — Codemagic does not create it.
4. The Codemagic project must be **connected to this Git repo**. Until then the YAML sits dormant.

## Expected first-run timing

| Workflow | First build | Subsequent builds |
|---|---|---|
| `android-aab-release` | ~12 min (npm install + gradle cold cache) | ~6 min |
| `ios-ipa-release` | ~22 min (pod install + Xcode cold cache) | ~11 min |

## What success looks like

- **Android:** Codemagic email "Build #N succeeded", artifact `app-release.aab` attached, Play Console → Internal testing → new draft release auto-created.
- **iOS:** Codemagic email + artifact `App.ipa`, App Store Connect → TestFlight → "Processing" badge for ~10 min, then build appears in Internal Testers group.

## Triggering a verification build

```bash
# Make any whitespace commit on main, push, and watch Codemagic
git commit --allow-empty -m "ci: verify Codemagic Android+iOS pipelines"
git push origin main
```

Then watch https://codemagic.io/apps → your app → Build history. If anything fails it will be in the **first 90 seconds** (missing secrets / missing integrations) — the long stretches afterward are gradle/xcodebuild and rarely fail once configured.

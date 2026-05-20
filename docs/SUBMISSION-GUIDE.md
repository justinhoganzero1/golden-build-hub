# ORACLE LUNAR — Final Submission Guide

Everything you (the human) must do that **cannot be automated from code**.
Work top-to-bottom. Each step has a clear "Done when…" checkpoint.

---

## A. ANDROID — Google Play Store

### A1. Generate the signing keystore  ⏱ 5 min, **do once, never lose it**
On any Mac/Linux machine (or WSL):
```bash
keytool -genkey -v -keystore oracle-lunar-release.keystore \
  -alias oracle-lunar -keyalg RSA -keysize 2048 -validity 10000
```
Pick strong passwords. **Back up the `.keystore` file in 2 places.** Losing it means you can never publish updates.

Then base64-encode it for Codemagic:
```bash
base64 -i oracle-lunar-release.keystore | pbcopy   # macOS
base64 oracle-lunar-release.keystore | xclip       # Linux
```
**Done when:** you have the `.keystore` file backed up and a base64 string on your clipboard.

### A2. Add Codemagic secrets  ⏱ 3 min
Codemagic → Teams → Environment variables → group **`android_signing`**:
- `ANDROID_KEYSTORE` = base64 string from A1 (mark as secure)
- `CM_KEYSTORE_PASSWORD` = your keystore password
- `CM_KEY_ALIAS` = `oracle-lunar`
- `CM_KEY_PASSWORD` = your key password

**Done when:** all 4 vars show in the `android_signing` group.

### A3. Create Google Play Console listing  ⏱ 30 min, **$25 one-time fee**
1. https://play.google.com/console → Create app
2. Name: `Oracle Lunar`, default language: English (US), Free, App
3. Paste copy from `docs/store-listings.md` into all fields
4. Upload feature graphic, screenshots (see A4)
5. Fill Data Safety form using `docs/play-store-checklist.md` §4
6. Fill Content Rating questionnaire using §1
7. Set up Internal testing track with your email

**Done when:** Play Console shows green checks on all "Set up your app" tasks except "Release".

### A4. Capture phone screenshots  ⏱ 20 min
Use a real Android phone (or Android Studio emulator @ 1080×1920):
1. `/` (home with Become a Member CTA)
2. `/oracle` (Oracle chat with orb)
3. `/photography-hub`
4. `/movie-studio-pro`
5. `/dashboard` (super-app grid)
6. `/media-library` (filled with content)

Save as PNG, drop into Play Console.
**Done when:** ≥2 screenshots uploaded (8 recommended).

### A5. Create Google Play service account (for auto-upload from Codemagic)  ⏱ 10 min
1. Play Console → Setup → API access → Create new service account
2. Grant it "Release manager" access
3. Download JSON key → in Codemagic add as `GCLOUD_SERVICE_ACCOUNT_CREDENTIALS` (file/secure)

**Done when:** Codemagic build can publish to Play "internal" track.

### A6. Push to `main` → Codemagic builds signed AAB → uploads as draft  ⏱ 15 min wait
The `codemagic.yaml` workflow `android-aab-release` runs automatically.
**Done when:** Play Console "Internal testing" shows your AAB as draft.

### A7. Internal test → Closed test → Production
Promote in Play Console. First production review takes 1–7 days.

---

## B. iOS — Apple App Store

### B1. Apple Developer Program enrollment  ⏱ 1–3 days, **$99/year**
https://developer.apple.com/programs/enroll — needs DUNS number for company, or personal Apple ID for individual.
**Done when:** developer account is active.

### B2. Register App ID & create app in App Store Connect  ⏱ 15 min
1. https://developer.apple.com/account/resources/identifiers → New → App IDs
   - Bundle ID: `app.oraclelunar.ai` (explicit)
   - Capabilities: Sign in with Apple, Push Notifications, Camera, Microphone
2. https://appstoreconnect.apple.com → My Apps → New App
   - Bundle ID: select from dropdown
   - SKU: `oracle-lunar-001`
   - Paste copy from `docs/store-listings.md`

**Done when:** app appears in App Store Connect with status "Prepare for Submission".

### B3. Set up Codemagic App Store Connect integration  ⏱ 5 min
1. https://appstoreconnect.apple.com/access/api → generate API key (Admin role)
2. Codemagic → Teams → Integrations → App Store Connect → name it `Oracle Lunar ASC`
3. Upload the .p8 key, paste Issuer ID + Key ID

**Done when:** integration shows "Connected".

### B4. Capture iPhone screenshots  ⏱ 30 min
Use real iPhone 15 Pro Max (6.7") + iPhone 8 Plus (5.5") simulator — Apple requires these exact sizes:
- 6.7": 1290×2796
- 6.5": 1242×2688

Same 6 screens as A4. Drop into App Store Connect.
**Done when:** ≥3 screenshots per device size uploaded.

### B5. Push to `main` → Codemagic builds IPA → uploads to TestFlight  ⏱ 25 min wait
The `ios-ipa-release` workflow runs automatically.
**Done when:** TestFlight email arrives + build appears in App Store Connect.

### B6. Submit for review
App Store Connect → select build → fill App Review Information → Submit.
First review: 24–48 hours typically.

---

## C. POST-LAUNCH — once both stores are live

### C1. Fill the store URLs in code
Edit `src/lib/installRedirect.ts`:
```ts
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=app.oraclelunar.ai";
export const APP_STORE_URL  = "https://apps.apple.com/app/idXXXXXXXXX";
```

### C2. Tick the QA checklist
`docs/play-store-checklist.md` §8 — tick every box before each release.

---

## Honest expectations

| Step | Who | Time | Cost |
|---|---|---|---|
| Android keystore | You | 5 min | free |
| Codemagic secrets | You | 3 min | free tier OK |
| Play Console account | You | 30 min | $25 once |
| Screenshots + listing | You | 50 min | free |
| First Android submission | Google reviewers | 1–7 days | free |
| Apple Developer enrollment | Apple | 1–3 days | $99/yr |
| App Store Connect setup | You | 20 min | free |
| iOS screenshots | You | 30 min | free |
| First iOS submission | Apple reviewers | 1–2 days | free |
| **Total your time** | | **~2.5 hours** | **$124 first year** |

Everything in the **codebase** is already store-ready. The remaining work is account creation, paying fees, capturing screenshots, and clicking Submit — none of which I can do from inside the editor.

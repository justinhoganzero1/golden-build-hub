# Building the Oracle Lunar iPhone app

The iPhone project lives in `ios/` (Capacitor 8, Swift Package Manager, bundle ID `app.oraclelunar.ai`).
Apple only allows iPhone apps to be installed through the App Store or TestFlight, so this needs:

1. An Apple Developer account (US$99/year).
2. A Mac with Xcode.

Steps on the Mac:

```bash
npm install
npm run build
npx cap sync ios
npx cap open ios
```

In Xcode: choose your team under Signing & Capabilities, then Product → Archive → Distribute App → App Store Connect.
Once Apple approves it, put the App Store link in `APP_STORE_URL` in `src/lib/installRedirect.ts` so the website's Install button opens it on iPhones.
Until then, iPhone visitors install the web app from Safari (Share → Add to Home Screen).

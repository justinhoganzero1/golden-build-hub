import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Production Capacitor config — Play Store / App Store ready.
 *
 * Notes for native build:
 *   - `server.url` is intentionally OMITTED. Google Play rejects "thin web wrapper"
 *     apps that just load a remote URL. The native build must bundle the web assets
 *     in `webDir` (`dist`). For local hot-reload during dev, temporarily uncomment
 *     the `server` block (do NOT ship it).
 *   - `cleartext` and `allowMixedContent` are disabled — Play Console flags both
 *     as security warnings and may auto-reject if user-data is present.
 *   - `webContentsDebuggingEnabled` is false in production.
 */
const config: CapacitorConfig = {
  appId: 'app.oraclelunar.ai',
  appName: 'Oracle Lunar',
  webDir: 'dist',

  // For local dev hot-reload only — uncomment, then re-comment before building a release AAB.
  // server: {
  //   url: "https://cac1cf82-5270-45aa-a923-5d8912216beb.lovableproject.com?forceHideBadge=true",
  //   cleartext: true,
  // },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#080808",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#080808",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },

  android: {
    backgroundColor: "#080808",
    // Play Store hardening:
    allowMixedContent: false,        // disallow http resources on https pages
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },

  ios: {
    backgroundColor: "#080808",
    contentInset: "always",
  },
};

export default config;

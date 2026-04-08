import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.solace.ai',
  appName: 'Solace',
  webDir: 'dist',
  server: {
    url: "https://golden-vault-builder.lovable.app?forceHideBadge=true",
    cleartext: true
  },
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
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;

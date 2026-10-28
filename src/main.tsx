import { createRoot } from "react-dom/client";
import { applyGoldTheme, goldThemeOn } from "@/lib/goldTheme";
applyGoldTheme(goldThemeOn());
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary";
import RecoveryMonitor from "./components/RecoveryMonitor";
import "./index.css";
import { installWalletInterceptor } from "./lib/walletInterceptor";

// Any paid AI call that comes back 402 raises the "add $10 and keep going" modal.
installWalletInterceptor();

// A background paid call that runs out of credits (402) must never blank the screen.
window.addEventListener("unhandledrejection", (event) => {
  const msg = String((event.reason as { message?: string })?.message ?? event.reason ?? "");
  if (/402|credits exhausted|add funds/i.test(msg)) {
    event.preventDefault();
    console.warn("Paid AI call declined (out of credits):", msg);
  }
});

// Initialize Capacitor plugins when running as native app
const initNative = async () => {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { StatusBar, Style } = await import("@capacitor/status-bar");
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: "#080808" });

      const { SplashScreen } = await import("@capacitor/splash-screen");
      await SplashScreen.hide();

      const { Keyboard } = await import("@capacitor/keyboard");
      Keyboard.addListener("keyboardWillShow", () => {
        document.body.classList.add("keyboard-open");
      });
      Keyboard.addListener("keyboardWillHide", () => {
        document.body.classList.remove("keyboard-open");
      });

      // Handle Android back button: never walk browser history back to sign-in/logout screens.
      const { App: CapApp } = await import("@capacitor/app");
      CapApp.addListener("backButton", () => {
        const path = window.location.pathname;
        if (path && path !== "/" && path !== "/dashboard") {
          window.location.assign("/dashboard");
        } else {
          CapApp.exitApp();
        }
      });
    }
  } catch {
    // Not running as native app — ignore
  }
};

initNative();

// One-time migration: copy any old "solace-*" localStorage keys to the new
// "oracle-lunar-*" namespace so existing users don't lose their settings.
try {
  if (!localStorage.getItem("oracle-lunar-migrated-v1")) {
    for (let i = 0; i < localStorage.length; i++) {
      const oldKey = localStorage.key(i);
      if (!oldKey || !oldKey.startsWith("solace")) continue;
      const newKey = oldKey.replace(/^solace[_-]?/, "oracle-lunar-").replace(/--/g, "-");
      const val = localStorage.getItem(oldKey);
      if (val !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, val);
      }
    }
    localStorage.setItem("oracle-lunar-migrated-v1", "1");
  }
} catch {}

// Default Oracle name = "Lunar". Users can still rename via Oracle UI.
try {
  const names = JSON.parse(localStorage.getItem("oracle-lunar-agent-names") || "{}");
  if (!names.Oracle || names.Oracle === "Oracle Lunar" || names.Oracle === "Oracle" || names.Oracle === "Peggy" || names.Oracle === "Eric") {
    names.Oracle = "Lunar";
    localStorage.setItem("oracle-lunar-agent-names", JSON.stringify(names));
  }
} catch {}

const root = document.getElementById("root");
if (root) createRoot(root).render(
  <ErrorBoundary pageName="App shell">
    <HelmetProvider><App /><RecoveryMonitor /></HelmetProvider>
  </ErrorBoundary>
);

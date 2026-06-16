import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

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

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

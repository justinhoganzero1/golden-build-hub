import { createRoot } from "react-dom/client";
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

      // Handle Android back button
      const { App: CapApp } = await import("@capacitor/app");
      CapApp.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
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

// Default Oracle name = "Eric" (per user preference). Users can still rename via Oracle UI.
try {
  const names = JSON.parse(localStorage.getItem("solace-agent-names") || "{}");
  if (!names.Oracle) {
    names.Oracle = "Eric";
    localStorage.setItem("solace-agent-names", JSON.stringify(names));
  }
} catch {}

createRoot(document.getElementById("root")!).render(<App />);

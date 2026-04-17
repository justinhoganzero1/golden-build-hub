import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * PWA install hook.
 * - On Android/desktop Chrome/Edge, captures `beforeinstallprompt` so we can
 *   trigger the native install prompt from a button.
 * - On iOS Safari, exposes a flag so the UI can show "Add to Home Screen" instructions.
 */
export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua) && !/crios|fxios/.test(ua);
    setIsIOS(ios);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS-only
      window.navigator.standalone === true;
    setIsStandalone(standalone);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return "unavailable" as const;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return choice.outcome;
  };

  return {
    canInstall: !!deferredPrompt,
    isIOS,
    isStandalone,
    installed,
    install,
  };
};

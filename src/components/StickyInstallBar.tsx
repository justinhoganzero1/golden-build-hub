import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useAuth } from "@/contexts/AuthContext";
import { trackInstallEvent, detectInstallPlatform } from "@/lib/installAnalytics";
import {
  bounceIfNotProduction,
  getNativeStoreUrl,
  hasDirectApk,
  isAndroidDevice,
} from "@/lib/installRedirect";
import ApkDownloadDialog from "@/components/ApkDownloadDialog";

/**
 * Sticky high-conversion install mega-bar.
 * - Top-of-viewport, glowing gold, urgency countdown
 * - Auto-detects platform → shows iOS/Android/Desktop label
 * - Dismissible (sessionStorage), reappears next visit
 */
const StickyInstallBar = () => {
  const { canInstall, isStandalone, install } = usePWAInstall();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(true);
  const [spotsLeft, setSpotsLeft] = useState(47);
  const [apkOpen, setApkOpen] = useState(false);
  const platform = detectInstallPlatform();

  useEffect(() => {
    if (sessionStorage.getItem("oracle-lunar-install-bar-dismissed") !== "1") {
      setDismissed(false);
    }
    // Pseudo-urgency: drops one spot every 90s, floors at 12
    const t = window.setInterval(() => {
      setSpotsLeft((n) => (n > 12 ? n - 1 : n));
    }, 90_000);
    return () => window.clearInterval(t);
  }, []);

  if (dismissed || isStandalone) return null;

  const handleInstall = async () => {
    trackInstallEvent("click", platform);
    // 1) Android + we host a direct .apk → open the safety dialog and let the
    //    user sideload the real native app from our portal.
    if (isAndroidDevice() && hasDirectApk()) {
      setApkOpen(true);
      return;
    }
    // 2) If a real native store listing exists, send the user there — that's the
    //    actual app, not a website shortcut.
    const storeUrl = getNativeStoreUrl();
    if (storeUrl) {
      window.open(storeUrl, "_blank", "noopener,noreferrer");
      return;
    }
    // 3) In Lovable preview / sandbox iframe → PWA install never works.
    //    Send the user straight to the live site so install actually triggers.
    if (bounceIfNotProduction("/")) return;
    if (!user) {
      navigate("/sign-in?redirect=/");
      return;
    }
    const outcome = await install();
    if (outcome === "unavailable") {
      if (platform === "ios") {
        alert("To install on iPhone/iPad:\n\n1. Tap the Share icon in Safari.\n2. Choose 'Add to Home Screen'.\n3. Tap 'Add'.");
      } else if (platform === "android") {
        alert("To install on Android:\n\n1. Open in Chrome.\n2. Tap the ⋮ menu.\n3. Choose 'Install app'.");
      } else {
        document.getElementById("install")?.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const dismiss = () => {
    sessionStorage.setItem("oracle-lunar-install-bar-dismissed", "1");
    setDismissed(true);
  };

  const platformLabel =
    platform === "ios" ? "iPhone & iPad" : platform === "android" ? "Android" : "Desktop";

  return (
    <>
    <ApkDownloadDialog open={apkOpen} onOpenChange={setApkOpen} />
    <div className="sticky top-0 z-50 w-full bg-primary text-primary-foreground shadow-[0_4px_30px_hsl(var(--primary)/0.5)] animate-fade-in" style={{ backgroundImage: "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.8) 50%, hsl(var(--primary)) 100%)" }}>
      <div className="max-w-6xl mx-auto px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 shrink-0 animate-pulse" />
          <p className="text-xs sm:text-sm font-semibold truncate">
            <span className="hidden sm:inline">🎁 Free lifetime access for first 100 users — </span>
            <span className="sm:hidden">🎁 Free lifetime — </span>
            <span className="underline decoration-wavy underline-offset-2">{spotsLeft} spots left</span>
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleInstall}
            className="h-8 px-3 text-xs font-bold bg-background text-primary hover:bg-background/90 shadow-md"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            <span className="hidden xs:inline">Install on </span>
            {platformLabel}
          </Button>
          <button
            onClick={dismiss}
            aria-label="Dismiss install bar"
            className="p-1 rounded-md hover:bg-background/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
    </>
  );
};

export default StickyInstallBar;

import { useEffect, useState } from "react";
import { Download, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { trackInstallEvent, detectInstallPlatform } from "@/lib/installAnalytics";

/**
 * Sticky high-conversion install mega-bar.
 * - Top-of-viewport, glowing gold, urgency countdown
 * - Auto-detects platform → shows iOS/Android/Desktop label
 * - Dismissible (sessionStorage), reappears next visit
 */
const StickyInstallBar = () => {
  const { canInstall, isStandalone, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(true);
  const [spotsLeft, setSpotsLeft] = useState(47);
  const platform = detectInstallPlatform();

  useEffect(() => {
    if (sessionStorage.getItem("solace-install-bar-dismissed") !== "1") {
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
    const outcome = await install();
    if (outcome === "unavailable") {
      document.getElementById("install")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const dismiss = () => {
    sessionStorage.setItem("solace-install-bar-dismissed", "1");
    setDismissed(true);
  };

  const platformLabel =
    platform === "ios" ? "iPhone & iPad" : platform === "android" ? "Android" : "Desktop";

  return (
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
  );
};

export default StickyInstallBar;

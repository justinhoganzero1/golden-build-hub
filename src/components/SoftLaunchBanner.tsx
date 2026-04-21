import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X } from "lucide-react";

const DISMISS_KEY = "oracle-lunar-soft-launch-banner-dismissed-v1";

/**
 * Soft-launch notice: tells visitors we just opened the doors, warns about
 * possible teething problems, and highlights that all tiers have been
 * lowered as a thank-you. Dismissible per browser.
 */
const SoftLaunchBanner = () => {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      className="w-full border-b border-primary/40 bg-gradient-to-r from-primary/20 via-amber-500/15 to-primary/20 text-foreground px-4 py-2 text-sm relative"
      role="status"
      aria-label="Soft launch notice"
    >
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pr-8 text-center">
        <Sparkles className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
        <span className="font-semibold text-primary">We just opened our doors!</span>
        <span className="text-muted-foreground">
          You may notice some teething problems while we polish things — to thank you for your patience,
          <span className="text-foreground font-medium"> every tier is discounted</span> right now.
        </span>
        <Link
          to="/subscribe"
          className="underline font-semibold text-primary hover:opacity-80"
        >
          See lowered pricing
        </Link>
      </div>
      <button
        onClick={handleDismiss}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
        aria-label="Dismiss soft launch notice"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default SoftLaunchBanner;

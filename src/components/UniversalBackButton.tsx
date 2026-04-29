import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

interface UniversalBackButtonProps {
  label?: string;
  /** Override fallback destination when there's no history. Defaults to /dashboard. */
  fallbackPath?: string;
}

/**
 * Universal back button — fixed top-left across the entire app.
 * - Always visible above page content (z-50)
 * - Respects iOS/Android safe-area insets (notch / status bar)
 * - Falls back to dashboard when there is no router history (deep-link, PWA cold-start, share-link)
 * - Hidden on the root index route to avoid a no-op
 */
const UniversalBackButton = ({ label = "Back", fallbackPath = "/dashboard" }: UniversalBackButtonProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Don't render on root — nothing to go back to.
  if (location.pathname === "/" || location.pathname === "") return null;

  const handleBack = () => {
    // window.history.length === 1 means this tab opened directly to this URL.
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallbackPath, { replace: true });
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={label}
      className="holo-card fixed left-3 z-50 flex items-center gap-1.5 px-3 py-2 rounded-full text-primary hover:text-foreground transition-colors active:scale-95"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
    >
      <ArrowLeft className="w-4 h-4" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
};

export default UniversalBackButton;

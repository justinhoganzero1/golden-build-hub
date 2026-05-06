import { Home } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

interface UniversalBackButtonProps {
  label?: string;
  /** Override fallback destination when there's no history. Defaults to /dashboard. */
  fallbackPath?: string;
}

/**
 * Universal user-dashboard button — fixed top-left across the entire app.
 * - Always visible above page content (z-50)
 * - Respects iOS/Android safe-area insets (notch / status bar)
 * - Always routes directly to /dashboard; never uses browser history and never signs out.
 * - Hidden on the root and dashboard routes to avoid a no-op
 */
const UniversalBackButton = ({ label = "USER DASHBOARD", fallbackPath = "/dashboard" }: UniversalBackButtonProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Don't render where it would do nothing.
  if (location.pathname === "/" || location.pathname === "" || location.pathname === fallbackPath) return null;

  const goToUserDashboard = () => {
    navigate(fallbackPath, { replace: false });
  };

  return (
    <button
      type="button"
      onClick={goToUserDashboard}
      aria-label={label}
      className="holo-card fixed left-3 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full text-primary hover:text-foreground transition-colors active:scale-95"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
    >
      <Home className="w-4 h-4" />
      <span className="text-xs font-black uppercase">{label}</span>
    </button>
  );
};

export default UniversalBackButton;

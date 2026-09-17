import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePreviewMode } from "@/hooks/usePreviewMode";

/**
 * Auth lock only — age gate removed.
 *
 * OPEN FRONT DOOR: visitors may BROWSE the whole app without signing in.
 * The moment they try to type or generate, InteractionAuthGate walls them and
 * asks them to join. Only private/money/admin areas below still demand a
 * session up front.
 */
interface RequireAuthProps {
  children: ReactNode;
  freeAccess?: boolean; // deprecated — no feature is free anymore
}

// Routes that hold personal data, money or owner controls: always signed-in only.
const PRIVATE_PREFIXES = [
  "/admin",
  "/owner",
  "/wallet",
  "/profile",
  "/vault",
  "/personal-vault",
  "/inbox",
  "/settings",
  "/media-library",
  "/subscription",
  "/calendar",
];

const RequireAuth = ({ children }: RequireAuthProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isPreview = usePreviewMode();

  // Lovable preview hosts bypass the wall entirely so reviewers see everything.
  if (isPreview) {
    return <>{children}</>;
  }

  const isPrivate = PRIVATE_PREFIXES.some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`),
  );

  if (!isPrivate) {
    // Public browsing: render immediately, no auth spinner, no redirect.
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;

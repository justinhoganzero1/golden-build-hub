import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePreviewMode } from "@/hooks/usePreviewMode";

/**
 * Hard lock: signed-in AND phone-verified.
 * Admin email bypasses phone check.
 * Coin economy = signed-in + phone-verified user is a member.
 */
interface RequireAuthProps {
  children: ReactNode;
  freeAccess?: boolean;
}

const ADMIN_EMAIL = "justinbretthogan@gmail.com";

const RequireAuth = ({ children }: RequireAuthProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isPreview = usePreviewMode();

  if (isPreview) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?redirect=${redirect}`} replace />;
  }

  // Phone verification hard lock — admin bypass
  const isAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
  const phoneVerified = !!(user as any).phone_confirmed_at || !!user.phone;

  if (!isAdmin && !phoneVerified && location.pathname !== "/verify-phone") {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/verify-phone?redirect=${redirect}`} replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;

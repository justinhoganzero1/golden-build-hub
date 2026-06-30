import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePreviewMode } from "@/hooks/usePreviewMode";

/**
 * Auth lock only — age gate removed.
 */
interface RequireAuthProps {
  children: ReactNode;
  freeAccess?: boolean; // deprecated — no feature is free anymore
}

const RequireAuth = ({ children }: RequireAuthProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  // Preview mode bypass disabled — every route now requires a real session.
  const _isPreview = usePreviewMode();
  void _isPreview;

  if (isPreview) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    // First click of anything gated → bounce to sign-in so visitors can
    // either log in or become a member.
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;


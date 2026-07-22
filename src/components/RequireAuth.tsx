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
  const isPreview = usePreviewMode();

  // Lovable preview hosts (*.lovable.app / *.lovableproject.com / *.lovable.dev
  // or ?preview=1) bypass the auth wall so reviewers can see the entire project
  // without signing in. Real end users on oracle-lunar.online still get gated.
  if (isPreview) {
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


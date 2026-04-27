import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * Hard gate for admin-only routes. Non-admins are silently redirected to
 * the regular user dashboard — they should never see admin pages exist.
 */
const RequireAdmin = ({ children }: { children: ReactNode }) => {
  const { isAdmin, loading } = useIsAdmin();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default RequireAdmin;

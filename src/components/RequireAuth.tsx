import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Auth lock only — age gate removed.
 */
interface RequireAuthProps {
  children: ReactNode;
  freeAccess?: boolean;
}

const RequireAuth = ({ children, freeAccess = false }: RequireAuthProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user && !freeAccess) {
    const cleanSearch = new URLSearchParams(location.search);
    cleanSearch.delete("preview");
    cleanSearch.delete("__lovable_token");
    const redirect = `${location.pathname}${cleanSearch.toString() ? `?${cleanSearch.toString()}` : ""}`;
    return <Navigate to={`/sign-in?redirect=${encodeURIComponent(redirect)}`} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;


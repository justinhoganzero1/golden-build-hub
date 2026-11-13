import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { memberPageAccess } from '@/lib/memberPageAccess';
import { pagePlan } from "@/lib/plans";
import { useBirthdayGate } from "@/hooks/useBirthdayGate";

/**
 * Every app page needs a signed-in account. The member's plan then decides the page:
 * - Free: only no-cost pages (Oracle welcome, calendar, library, safety, wallet, account).
 * - Plus and $1 Founders: everything except Pro tools.
 * - Pro and the owner: everything.
 * Locked pages send the member to /membership with the plan they need.
 */
interface RequireAuthProps {
  children: ReactNode;
  freeAccess?: boolean; // deprecated
}

const Spinner = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const RequireAuth = ({ children }: RequireAuthProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { plan, loading: mLoading } = useMembership();
  const birthday = useBirthdayGate();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/sign-in" state={{ from: location }} replace />;
  // Google sign-ups skip the form's birthday question; ask it once here (16+).
  if (birthday.loading) return <Spinner />;
  if (birthday.needed) return <Navigate to="/age-required" state={{ from: location }} replace />;

  const path = location.pathname;
  if (pagePlan(path) === "free") return <>{children}</>;
  if (mLoading) return <Spinner />;
  if (memberPageAccess({ signedIn: true, plan, path }) === 'upgrade') {
    return <Navigate to="/membership" state={{ upgradeFrom: path, plan: pagePlan(path) }} replace />;
  }
  return <>{children}</>;
};

export default RequireAuth;

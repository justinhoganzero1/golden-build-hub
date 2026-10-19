import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useMembership } from "@/hooks/useMembership";
import { memberPageAccess } from '@/lib/memberPageAccess';

/**
 * Full lockdown: every app page needs a signed-in account.
 * - Owner/admin: everything.
 * - Monthly members and trial users: everything.
 * - $1 lifetime Founders (no monthly): only the FOUNDER_ALLOWED pages; anything
 *   else sends them to /membership to upgrade.
 * - No active membership: /membership.
 */
interface RequireAuthProps {
  children: ReactNode;
  freeAccess?: boolean; // deprecated
}

// Always reachable when signed in, so members can pay or manage their account.
const MEMBERSHIP_EXEMPT = [
  "/membership", "/founder-seats", "/wallet", "/profile", "/settings", "/my-account",
  "/terms-of-service", "/privacy-policy",
];

// The part of the app a $1 lifetime Founder can use.
const FOUNDER_ALLOWED = [
  "/", "/dashboard", "/welcome", "/get-started", "/oracle", "/chat-oracle",
  "/free-zone", "/founder-vault", "/my-apps", "/mind-hub", "/crisis-hub",
  "/calendar", "/media-library", "/story-writer", "/read", "/author-dashboard",
];

const match = (list: string[], path: string) =>
  list.some((p) => path === p || (p !== "/" && path.startsWith(`${p}/`)));

const Spinner = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const RequireAuth = ({ children }: RequireAuthProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { membership, exempt, active, loading: mLoading } = useMembership();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/sign-in" state={{ from: location }} replace />;

  const path = location.pathname;
  if (match(MEMBERSHIP_EXEMPT, path)) return <>{children}</>;
  if (mLoading) return <Spinner />;
  if (exempt) return <>{children}</>;
  if (!active) return <Navigate to="/membership" replace />;

  const monthly = !!membership?.monthly_active_until &&
    new Date(membership.monthly_active_until).getTime() > Date.now();
  const founderOnly = !!membership?.founder_number && !monthly;
  if (memberPageAccess({ signedIn: true, owner: exempt, active, founder: founderOnly, monthly, path }) === 'upgrade') {
    return <Navigate to="/membership" state={{ upgradeFrom: path }} replace />;
  }
  return <>{children}</>;
};

export default RequireAuth;

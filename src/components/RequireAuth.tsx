import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePreviewMode } from "@/hooks/usePreviewMode";
import { useMembership } from "@/hooks/useMembership";

/**
 * Auth lock + membership lock.
 *
 * OPEN FRONT DOOR: visitors may BROWSE the whole app without signing in.
 * Signed-in members get a 3-day trial; after it ends (and with no Founder seat
 * or active monthly membership) every feature sends them to /membership.
 */
interface RequireAuthProps {
  children: ReactNode;
  freeAccess?: boolean; // deprecated — no feature is free anymore
}

const PRIVATE_PREFIXES = [
  "/admin", "/owner", "/wallet", "/profile", "/vault", "/personal-vault", "/inbox",
  "/settings", "/media-library", "/subscription", "/calendar",
];

// Always reachable even after the trial ends, so members can pay or manage their account.
const MEMBERSHIP_EXEMPT = ["/membership", "/wallet", "/profile", "/settings", "/terms-of-service", "/privacy-policy"];

const Spinner = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const RequireAuth = ({ children }: RequireAuthProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isPreview = usePreviewMode();
  const { active, loading: mLoading } = useMembership();

  if (isPreview) return <>{children}</>;

  const path = location.pathname;
  const isPrivate = PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  const isExempt = MEMBERSHIP_EXEMPT.some((p) => path === p || path.startsWith(`${p}/`));

  if (user && !isExempt) {
    if (mLoading) return <Spinner />;
    if (!active) return <Navigate to="/membership" replace />;
  }

  if (!isPrivate) return <>{children}</>;
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/sign-in" state={{ from: location }} replace />;
  return <>{children}</>;
};

export default RequireAuth;

import { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Crown, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { isDemoMode } from "@/lib/demoMode";
import DemoGate from "@/components/DemoGate";

const ADMIN_EMAIL = "justinbretthogan@gmail.com";

/**
 * Fort Knox auth gate. Two locks must open in order:
 *  1. App must be INSTALLED (PWA standalone or native). Otherwise the website
 *     is a "plastic display" — DemoGate shows a download wall.
 *  2. User must be SIGNED IN.
 *  3. User must be a PAID MEMBER (any tier above free) OR have an active reward.
 *     Admin bypasses everything.
 */
interface RequireAuthProps {
  children: ReactNode;
  /** When true, allow signed-in users without a paid membership.
   *  Used for the always-free safety net pages: Oracle, Crisis, Safety. */
  freeAccess?: boolean;
}

const RequireAuth = ({ children, freeAccess = false }: RequireAuthProps) => {
  const { user, loading } = useAuth();
  const { effectiveTier, loading: subLoading } = useSubscription();
  const location = useLocation();

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  // Lock 1: must be installed
  if (isDemoMode() && !isAdmin) {
    return <DemoGate>{null}</DemoGate>;
  }

  if (loading || subLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Lock 2: must be signed in
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?redirect=${redirect}`} replace />;
  }

  // Lock 3: must be a paid member (admin + always-free pages bypass)
  const isPaid = effectiveTier && effectiveTier !== "free";
  if (!isAdmin && !freeAccess && !isPaid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full text-center space-y-6 rounded-3xl border border-primary/30 bg-card/80 backdrop-blur p-8 shadow-2xl shadow-primary/10">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Membership required</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              ORACLE LUNAR is members-only. Choose a plan to unlock every feature inside the app.
            </p>
          </div>
          <Link
            to="/subscribe"
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-amber-500 px-5 py-3 text-primary-foreground font-semibold hover:opacity-90"
          >
            <Crown className="w-4 h-4" /> Become a member
          </Link>
          <Link to="/" className="block text-xs text-muted-foreground hover:text-foreground">← Back to home</Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequireAuth;

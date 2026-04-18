import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isDemoMode } from "@/lib/demoMode";
import DemoGate from "@/components/DemoGate";

/**
 * Fort Knox auth gate.
 * 1. In the browser preview (not installed PWA / not native), shows a
 *    "download the app" wall — the website is a plastic display only.
 * 2. In the installed app, anonymous visitors are sent to /sign-in.
 * 3. Signed-in users in the installed app see the real feature.
 */
const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Step 1: web preview = locked dummy
  if (isDemoMode()) {
    return <DemoGate />;
  }

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

  return <>{children}</>;
};

export default RequireAuth;

import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePreviewMode } from "@/hooks/usePreviewMode";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hard lock: signed-in AND phone-verified AND age 16+.
 * Admin email bypasses phone + age checks.
 */
interface RequireAuthProps {
  children: ReactNode;
  freeAccess?: boolean;
}

const ADMIN_EMAIL = "justinbretthogan@gmail.com";

const isAtLeast16 = (dob: string | null | undefined): boolean => {
  if (!dob) return false;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  const cutoff = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());
  return d <= cutoff;
};

const RequireAuth = ({ children }: RequireAuthProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isPreview = usePreviewMode();
  const [ageState, setAgeState] = useState<"loading" | "ok" | "blocked">("loading");

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  useEffect(() => {
    let cancelled = false;
    if (!user || isAdmin) { setAgeState("ok"); return; }
    setAgeState("loading");
    supabase.from("profiles").select("date_of_birth").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setAgeState(isAtLeast16(data?.date_of_birth as any) ? "ok" : "blocked");
      });
    return () => { cancelled = true; };
  }, [user, isAdmin]);

  if (isPreview) return <>{children}</>;

  if (loading || (user && !isAdmin && ageState === "loading")) {
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

  // Phone verification disabled — email/Google sign-in is sufficient.
  // (SMS gateway was unreliable; users were stuck on "can't connect" after entering OTP.)

  // Age gate hard lock — admin bypass
  if (!isAdmin && ageState === "blocked" && location.pathname !== "/age-required") {
    return <Navigate to="/age-required" replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;


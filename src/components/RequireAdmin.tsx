import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const OWNER_EMAIL = "justinbretthogan@gmail.com";

/**
 * Hard gate for admin-only routes (e.g. /owner-dashboard, /admin/*).
 *
 * Three independent checks must ALL pass — any failure silently redirects
 * to /dashboard so non-admins never even see admin pages exist:
 *   1. User is signed in.
 *   2. User's auth email matches the locked owner email.
 *   3. user_roles row with role='admin' exists for this user (DB-authoritative).
 *
 * The email check alone is not trusted (Supabase enforces uniqueness, but
 * defense-in-depth). The DB check alone is not trusted either (the
 * `guard_admin_role_assignment` trigger locks admin to the owner email,
 * but we re-verify here so a misconfigured row can never expose admin UI).
 */
const RequireAdmin = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<"loading" | "ok" | "deny">("loading");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (authLoading) return;
      if (!user) { if (!cancelled) setState("deny"); return; }

      const email = (user.email || "").trim().toLowerCase();
      if (email !== OWNER_EMAIL) { if (!cancelled) setState("deny"); return; }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (cancelled) return;
        setState(!error && !!data ? "ok" : "deny");
      } catch {
        if (!cancelled) setState("deny");
      }
    };
    setState("loading");
    check();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  if (authLoading || state === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === "deny") return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
};

export default RequireAdmin;

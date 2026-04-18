import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_EMAIL = "justinbretthogan@gmail.com";

/**
 * Single source of truth for "is this user an admin?".
 * Checks the user_roles RBAC table (preferred) AND falls back to the
 * hardcoded admin email so the owner never gets locked out even if the
 * role row is missing or RLS hiccups.
 */
export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (authLoading) return;
      if (!user) {
        if (!cancelled) { setIsAdmin(false); setLoading(false); }
        return;
      }
      // Email fallback — instant, never blocked by RLS
      const emailMatch =
        (user.email || "").trim().toLowerCase() === ADMIN_EMAIL;
      if (emailMatch && !cancelled) setIsAdmin(true);

      try {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (!cancelled) setIsAdmin(emailMatch || !!data);
      } catch {
        if (!cancelled) setIsAdmin(emailMatch);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { isAdmin, loading: loading || authLoading };
}

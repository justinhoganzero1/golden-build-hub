import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for "is this user an admin?".
 * Authoritative check: queries the `user_roles` RBAC table via Supabase.
 * Email is NOT trusted — anyone could theoretically sign up with any address.
 * Database RLS (`is_owner()` / `has_role()`) is the ultimate gatekeeper for data;
 * this hook only governs UI visibility.
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
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (!cancelled) {
          setIsAdmin(!error && !!data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) { setIsAdmin(false); setLoading(false); }
      }
    };
    check();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { isAdmin, loading: loading || authLoading };
}

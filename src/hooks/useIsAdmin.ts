import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const OWNER_EMAIL = "justinbretthogan@gmail.com";

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

      const email = (user.email || "").trim().toLowerCase();
      // STRICT: require BOTH locked owner email AND a DB admin role row.
      // Email alone is never trusted. If either check fails, no admin UI.
      if (email !== OWNER_EMAIL) {
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

  // Publish admin status to a window flag so non-React modules
  // (e.g. moderatePrompt) can auto-bypass M-rated guardrails for
  // the owner without every call site needing the hook.
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__oracleAdmin = isAdmin === true;
    return () => { if (typeof window !== "undefined") (window as any).__oracleAdmin = false; };
  }, [isAdmin]);

  return { isAdmin, loading: loading || authLoading };
}

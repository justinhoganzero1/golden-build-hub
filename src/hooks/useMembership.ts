import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Membership {
  kind: "trial" | "founder" | "monthly" | "none";
  trial_ends_at: string;
  founder_number: number | null;
  monthly_active_until: string | null;
}

export function membershipActive(m: Membership | null): boolean {
  if (!m) return false; // Missing membership is not proof of access; account pages remain available.
  const now = Date.now();
  if (m.founder_number) return true;
  if (m.monthly_active_until && new Date(m.monthly_active_until).getTime() > now) return true;
  return new Date(m.trial_ends_at).getTime() > now;
}

export function useMembership() {
  const { user } = useAuth();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [exempt, setExempt] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!user) { setMembership(null); setExempt(false); setLoadedFor(null); return; }
    const [{ data: m }, { data: admin }] = await Promise.all([
      supabase.from("memberships" as any).select("kind,trial_ends_at,founder_number,monthly_active_until").eq("user_id", user.id).maybeSingle(),
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    ]);
    setMembership((m as any) ?? null);
    setExempt(!!admin);
    setLoadedFor(user.id);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const h = () => refresh();
    window.addEventListener("membership:updated", h);
    return () => window.removeEventListener("membership:updated", h);
  }, [refresh]);

  // Still loading until the result belongs to the current user, so a fresh sign-in never sees stale "no membership".
  const loading = loadedFor !== (user?.id ?? null);
  return { membership, exempt, loading, active: exempt || membershipActive(membership), refresh };
}

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { resolvePlan, type PlanId } from "@/lib/plans";
import { setCurrentPlan } from "@/lib/walletPaywall";

export interface Membership {
  kind: "trial" | "founder" | "monthly" | "none";
  trial_ends_at: string;
  founder_number: number | null;
  monthly_active_until: string | null;
  plan: "free" | "plus" | "pro";
  plan_interval: "month" | "year" | null;
  plan_status: string | null;
  plan_active_until: string | null;
  plan_cancel_at_period_end: boolean;
}

/** True for paid members (Plus, Pro, Founder). Free accounts still use the no-cost pages. */
export function membershipActive(m: Membership | null): boolean {
  const plan = resolvePlan(m, false);
  return plan !== "free";
}

export function useMembership() {
  const { user } = useAuth();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [exempt, setExempt] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!user) { setMembership(null); setExempt(false); setLoadedFor(null); return; }
    const [{ data: m }, { data: admin }] = await Promise.all([
      supabase.from("memberships" as any)
        .select("kind,trial_ends_at,founder_number,monthly_active_until,plan,plan_interval,plan_status,plan_active_until,plan_cancel_at_period_end")
        .eq("user_id", user.id).maybeSingle(),
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
  const plan: PlanId = resolvePlan(membership, exempt);
  useEffect(() => { if (!loading) setCurrentPlan(plan); }, [loading, plan]);
  return { membership, exempt, loading, plan, active: plan !== "free", refresh };
}

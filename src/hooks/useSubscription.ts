import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthReady } from "@/hooks/useAuthReady";

export const SUBSCRIPTION_TIERS = {
  free: { name: "Coin Member", productId: null, priceId: null },
  lifetime: { name: "Coin Member", productId: null, priceId: null },
  free_for_life: { name: "Free For Life", productId: null, priceId: null },
} as const;

export function getTierByProductId() {
  return "lifetime";
}

export interface SubscriptionState {
  subscribed: boolean;
  tier: string;
  productId: string | null;
  subscriptionEnd: string | null;
  loading: boolean;
  error: string | null;
  rewardActive: boolean;
  rewardExpiresAt: string | null;
  rewardReason: string | null;
  effectiveTier: string;
  freeForLife: boolean;
}

export function useSubscription() {
  const { user } = useAuth();
  const { isReady } = useAuthReady();
  const [state, setState] = useState<SubscriptionState>({
    subscribed: false,
    tier: "free",
    productId: null,
    subscriptionEnd: null,
    loading: true,
    error: null,
    rewardActive: false,
    rewardExpiresAt: null,
    rewardReason: null,
    effectiveTier: "free",
    freeForLife: false,
  });

  const checkSubscription = useCallback(async () => {
    if (!isReady) return;
    if (!user) {
      setState(prev => ({ ...prev, subscribed: false, tier: "free", effectiveTier: "free", freeForLife: false, loading: false }));
      return;
    }

    try {
      const { data: rewardData } = await supabase
        .from("reward_grants")
        .select("expires_at, reason, reward_type")
        .eq("user_id", user.id)
        .eq("active", true)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(5);

      const rows = (rewardData ?? []) as Array<{ expires_at: string; reason: string | null; reward_type: string | null }>;
      const ffl = rows.find(r => r.reward_type === "free_for_life" || r.reason === "free_for_life");
      const top = rows[0];

      setState({
        subscribed: true,
        tier: ffl ? "free_for_life" : "lifetime",
        productId: null,
        subscriptionEnd: null,
        loading: false,
        error: null,
        rewardActive: rows.length > 0,
        rewardExpiresAt: top?.expires_at || null,
        rewardReason: top?.reason || null,
        effectiveTier: ffl ? "free_for_life" : "lifetime",
        freeForLife: !!ffl,
      });
    } catch (err: any) {
      setState({
        subscribed: true,
        tier: "lifetime",
        productId: null,
        subscriptionEnd: null,
        loading: false,
        error: err.message || "Failed to check coin membership",
        rewardActive: false,
        rewardExpiresAt: null,
        rewardReason: null,
        effectiveTier: "lifetime",
        freeForLife: false,
      });
    }
  }, [user, isReady]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  useEffect(() => {
    if (!isReady || !user) return;
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [isReady, user, checkSubscription]);

  const startCheckout = async (_priceId: string, _mode: "subscription" | "payment" = "payment") => {
    throw new Error("Subscriptions are disabled. Buy coins from the wallet instead.");
  };

  const openPortal = async () => {
    throw new Error("Subscriptions are disabled. Buy coins from the wallet instead.");
  };

  return { ...state, checkSubscription, startCheckout, openPortal };
}

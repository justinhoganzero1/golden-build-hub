import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthReady } from "@/hooks/useAuthReady";

export const SUBSCRIPTION_TIERS = {
  free: { name: "Coin Member", productId: null, priceId: null },
  lifetime: { name: "Coin Member", productId: null, priceId: null },
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
  });

  const checkSubscription = useCallback(async () => {
    if (!isReady) return;
    if (!user) {
      setState(prev => ({ ...prev, subscribed: false, tier: "free", effectiveTier: "free", loading: false }));
      return;
    }

    try {
      const { data: rewardData } = await supabase
        .from("reward_grants")
        .select("expires_at, reason")
        .eq("user_id", user.id)
        .eq("active", true)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setState({
        subscribed: true,
        tier: "lifetime",
        productId: null,
        subscriptionEnd: null,
        loading: false,
        error: null,
        rewardActive: !!rewardData,
        rewardExpiresAt: rewardData?.expires_at || null,
        rewardReason: rewardData?.reason || null,
        effectiveTier: "lifetime",
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

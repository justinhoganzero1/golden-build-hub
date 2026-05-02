import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthReady } from "@/hooks/useAuthReady";

// Map Stripe product IDs to tier names
export const SUBSCRIPTION_TIERS = {
  free: { name: "Free", productId: null, priceId: null },
  starter: { name: "Starter", productId: "prod_ULpbsaMTq3hI4X", priceId: "price_1TN7wPLGip9LWuvpVYd8PYT8" }, // $5/mo USD (LIVE)
  monthly: { name: "Full Access (1 Month)", productId: "prod_ULpcbNhcVQWkWo", priceId: "price_1TN7wnLGip9LWuvpG7yl9cri" }, // $10/mo AUD (LIVE)
  quarterly: { name: "Full Access (3 Months)", productId: "prod_ULpcIx224dRo9u", priceId: "price_1TN7xCLGip9LWuvpvN75YHXV" }, // $20 AUD one-time (LIVE)
  biannual: { name: "Full Access (6 Months)", productId: "prod_ULpcFeJDxdOKpg", priceId: "price_1TN7xVLGip9LWuvpErAiooaU" }, // $40 AUD one-time (LIVE)
  annual: { name: "Full Access (12 Months)", productId: "prod_ULpdmj8JSKneEc", priceId: "price_1TN7xqLGip9LWuvpNKc21d7Z" }, // $80 AUD one-time (LIVE)
  golden: { name: "Golden Heart", productId: "prod_ULpdvXHq8omgek", priceId: "price_1TN7yDLGip9LWuvpk9vjhKtj" }, // $1200/yr USD (LIVE)
  lifetime: { name: "ORACLE LUNAR Lifetime Unlock", productId: "prod_ULpd2N2mCZfoMd", priceId: "price_1TN7ybLGip9LWuvpeExWonbd" }, // $900 one-time USD (LIVE)
} as const;

export function getTierByProductId(productId: string | null): string {
  if (!productId) return "free";
  for (const [key, tier] of Object.entries(SUBSCRIPTION_TIERS)) {
    if (tier.productId === productId) return key;
  }
  return "free";
}

export interface SubscriptionState {
  subscribed: boolean;
  tier: string;
  productId: string | null;
  subscriptionEnd: string | null;
  loading: boolean;
  error: string | null;
  // Reward (free Tier 3 trial) overlay
  rewardActive: boolean;
  rewardExpiresAt: string | null;
  rewardReason: string | null;
  effectiveTier: string;
}

export function useSubscription() {
  const { user } = useAuth();
  const { isReady, accessToken } = useAuthReady();
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
      setState(prev => ({ ...prev, loading: true, error: null }));

      const { data: rewardData } = await supabase
        .from("reward_grants")
        .select("expires_at, reason")
        .eq("user_id", user.id)
        .eq("active", true)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const rewardActive = !!rewardData;

      // COIN ECONOMY: tiers are dead. Anyone signed in is a "member" and can SEE/USE
      // every feature; actual paid AI calls are deducted from their coin balance at the
      // edge-function layer. Do not call Stripe subscription checks here; a Stripe failure
      // must never lock a coin-wallet member out of the app.
      setState({
        subscribed: true,
        tier: "lifetime",
        productId: null,
        subscriptionEnd: null,
        loading: false,
        error: null,
        rewardActive,
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
        error: err.message || "Failed to check subscription",
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

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!isReady || !user) return;
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [isReady, user, checkSubscription]);

  const startCheckout = async (priceId: string, mode: "subscription" | "payment" = "subscription") => {
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId, mode },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      throw new Error(err.message || "Failed to start checkout");
    }
  };

  const openPortal = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      throw new Error(err.message || "Failed to open portal");
    }
  };

  return { ...state, checkSubscription, startCheckout, openPortal };
}

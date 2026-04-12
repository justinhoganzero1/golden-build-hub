import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Map Stripe product IDs to tier names
export const SUBSCRIPTION_TIERS = {
  free: { name: "Free", productId: null, priceId: null },
  starter: { name: "Starter", productId: "prod_UIaLwuzucwDgg9", priceId: "price_1TJzBGLM75X0snyCdM2ikY1r" }, // $5/mo
  monthly: { name: "Full Access (1 Month)", productId: "prod_TzJD6oSTwF8BJ6", priceId: "price_1T1KasLM75X0snyCZxP450ZO" }, // $10/mo AUD
  quarterly: { name: "Full Access (3 Months)", productId: "prod_TzJEnYNZ8WPjGo", priceId: "price_1T1Kc9LM75X0snyC3HMqFPm7" }, // $20 AUD one-time
  biannual: { name: "Full Access (6 Months)", productId: "prod_TzJEfxx8ww6FsQ", priceId: "price_1T1KcPLM75X0snyCq9k8skhN" }, // $40 AUD one-time
  annual: { name: "Full Access (12 Months)", productId: "prod_TzJFsym7iINOgM", priceId: "price_1T1KceLM75X0snyCq9k8skhN" }, // $80 AUD one-time
  golden: { name: "Golden Heart", productId: "prod_TybLpnuJLDhKwt", priceId: "price_1T0e8lLM75X0snyC9PVHfil2" }, // $1200/yr
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
}

export function useSubscription() {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    subscribed: false,
    tier: "free",
    productId: null,
    subscriptionEnd: null,
    loading: true,
    error: null,
  });

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setState(prev => ({ ...prev, subscribed: false, tier: "free", loading: false }));
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const { data, error } = await supabase.functions.invoke("check-subscription");
      
      if (error) throw error;

      const tier = getTierByProductId(data?.product_id);
      setState({
        subscribed: data?.subscribed || false,
        tier,
        productId: data?.product_id || null,
        subscriptionEnd: data?.subscription_end || null,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err.message || "Failed to check subscription",
      }));
    }
  }, [user]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

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

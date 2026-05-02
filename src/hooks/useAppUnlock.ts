import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export type AppKey = "app_wrapper" | "app_maker" | "movie_studio" | "photo_templates";

export const APP_PRICING: Record<AppKey, { label: string; price: string; amountCents: number }> = {
  app_wrapper: { label: "App Wrapper", price: "$5", amountCents: 500 },
  app_maker: { label: "App Maker", price: "$20", amountCents: 2000 },
  // Movie Studio Pro is free for any signed-in user — no one-time fee.
  movie_studio: { label: "Movie Studio Pro", price: "Free", amountCents: 0 },
  photo_templates: { label: "Unlimited Photo Templates", price: "$1", amountCents: 100 },
};

// Coin economy: one-time app unlocks are dead for core creation tools.
// Any signed-in member can open them; paid AI actions charge coins when used.
const FREE_APPS: AppKey[] = ["movie_studio", "app_maker", "app_wrapper"];

/**
 * Returns whether the current user owns a one-time unlock for the given app.
 * Admins automatically pass. Anonymous users always return false.
 * Real Stripe-backed paywall — checks the `app_unlocks` table via has_app_unlock RPC.
 */
export const useAppUnlock = (appKey: AppKey) => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    if (!user) {
      setUnlocked(false);
      setLoading(false);
      return;
    }
    if (isAdmin || FREE_APPS.includes(appKey)) {
      setUnlocked(true);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase.rpc("has_app_unlock", {
        _user_id: user.id,
        _app_key: appKey,
      });
      setUnlocked(!error && !!data);
    } catch {
      setUnlocked(false);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, appKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { unlocked, loading, refresh };
};

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export type AppKey = "app_wrapper" | "app_maker" | "movie_studio";

export const APP_PRICING: Record<AppKey, { label: string; price: string; amountCents: number }> = {
  app_wrapper: { label: "App Wrapper", price: "$5", amountCents: 500 },
  app_maker: { label: "App Maker", price: "$20", amountCents: 2000 },
  movie_studio: { label: "Movie Studio Pro", price: "$1", amountCents: 100 },
};

/**
 * Returns whether the current user owns a one-time unlock for the given app.
 * Admins automatically pass. Anonymous users always return false.
 */
export const useAppUnlock = (appKey: AppKey) => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  // FREE ACCESS MODE: All one-time app unlocks ($1 / $5 / $20 gates) are disabled.
  // Every signed-in user automatically gets full access to gated apps. Anonymous users still gated.
  const refresh = useCallback(async () => {
    setUnlocked(!!user);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { unlocked, loading, refresh };
};

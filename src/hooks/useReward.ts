import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RewardState {
  hasActiveReward: boolean;
  rewardExpiresAt: string | null;
  daysRemaining: number;
  reason: string | null;
  loading: boolean;
}

export function useReward() {
  const { user } = useAuth();
  const [state, setState] = useState<RewardState>({
    hasActiveReward: false,
    rewardExpiresAt: null,
    daysRemaining: 0,
    reason: null,
    loading: true,
  });

  const refresh = useCallback(async () => {
    if (!user) {
      setState({ hasActiveReward: false, rewardExpiresAt: null, daysRemaining: 0, reason: null, loading: false });
      return;
    }
    const { data } = await supabase
      .from("reward_grants")
      .select("expires_at, reason, active")
      .eq("user_id", user.id)
      .eq("active", true)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const expires = new Date(data.expires_at);
      const days = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      setState({
        hasActiveReward: true,
        rewardExpiresAt: data.expires_at,
        daysRemaining: days,
        reason: data.reason,
        loading: false,
      });
    } else {
      setState({ hasActiveReward: false, rewardExpiresAt: null, daysRemaining: 0, reason: null, loading: false });
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  return { ...state, refresh };
}

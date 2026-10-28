// Scans for referrals where the referred friend has had an active paid Stripe
// subscription for 7+ days, then grants the referrer 30 days of Tier 3.
// Triggered manually (or by cron) and also called from check-subscription
// after we confirm a friend is paying.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { requireUser } from "../_shared/requireAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: any) => console.log(`[REFERRAL-REWARDS] ${s}${d ? " " + JSON.stringify(d) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const access = await requireUser(req);
  if (access.response) return access.response;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    // Paid-subscription checks now read the subscriptions table (kept
    // current by payments-webhook) instead of calling Stripe directly.

    // Pull pending referrals (joined but not rewarded)
    const { data: pending, error } = await supabase
      .from("referrals")
      .select("id, referrer_id, referred_email, granted_to_user_id, friend_subscribed_at, status, reward_granted_at")
      .in("status", ["joined", "paid"])
      .eq("referrer_id", access.user.id)
      .is("reward_granted_at", null);
    if (error) throw error;

    log("Pending referrals", { count: pending?.length ?? 0 });
    let rewarded = 0;
    let waiting = 0;

    for (const r of pending ?? []) {
      if (!r.referred_email) continue;

      // Find the friend by email, then check for an active subscription
      const { data: usersPage } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const friend = usersPage?.users?.find(
        (u: any) => (u.email ?? "").toLowerCase() === String(r.referred_email).toLowerCase(),
      );
      if (!friend) continue;
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("stripe_subscription_id, status, current_period_start, created_at")
        .eq("user_id", friend.id)
        .in("status", ["active", "trialing"])
        .limit(1);
      if (!subs || subs.length === 0) continue;

      const sub = subs[0];
      const subscribedAt = new Date(sub.current_period_start ?? sub.created_at);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Mark friend_subscribed_at if not yet recorded
      if (!r.friend_subscribed_at) {
        await supabase
          .from("referrals")
          .update({
            friend_subscribed_at: subscribedAt.toISOString(),
            qualifying_subscription_id: sub.stripe_subscription_id,
            status: "paid",
          })
          .eq("id", r.id);
      }

      if (subscribedAt <= sevenDaysAgo) {
        // 7-day window cleared — grant reward
        const { error: gErr } = await supabase.rpc("grant_referral_reward", { _referral_id: r.id });
        if (!gErr) {
          rewarded++;
          log("Rewarded referrer", { referralId: r.id });
        } else {
          log("Grant error", { referralId: r.id, error: gErr.message });
        }
      } else {
        waiting++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: pending?.length ?? 0, rewarded, waiting }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});

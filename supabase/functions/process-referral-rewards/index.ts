// Scans for referrals where the referred friend has had an active paid Stripe
// subscription for 7+ days, then grants the referrer 30 days of Tier 3.
// Triggered manually (or by cron) and also called from check-subscription
// after we confirm a friend is paying.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: any) => console.log(`[REFERRAL-REWARDS] ${s}${d ? " " + JSON.stringify(d) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY missing");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Pull pending referrals (joined but not rewarded)
    const { data: pending, error } = await supabase
      .from("referrals")
      .select("id, referrer_id, referred_email, granted_to_user_id, friend_subscribed_at, status, reward_granted_at")
      .in("status", ["joined", "paid"])
      .is("reward_granted_at", null);
    if (error) throw error;

    log("Pending referrals", { count: pending?.length ?? 0 });
    let rewarded = 0;
    let waiting = 0;

    for (const r of pending ?? []) {
      if (!r.referred_email) continue;

      // Find a paid Stripe subscription for the friend's email
      const customers = await stripe.customers.list({ email: r.referred_email, limit: 1 });
      if (customers.data.length === 0) continue;
      const subs = await stripe.subscriptions.list({
        customer: customers.data[0].id,
        status: "active",
        limit: 1,
      });
      if (subs.data.length === 0) continue;

      const sub = subs.data[0];
      const subscribedAt = new Date(sub.start_date * 1000);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Mark friend_subscribed_at if not yet recorded
      if (!r.friend_subscribed_at) {
        await supabase
          .from("referrals")
          .update({
            friend_subscribed_at: subscribedAt.toISOString(),
            qualifying_subscription_id: sub.id,
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

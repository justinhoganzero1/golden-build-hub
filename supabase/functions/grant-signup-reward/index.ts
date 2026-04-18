import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");
    const userId = userData.user.id;

    // Optional referral code from request body
    let refCode: string | null = null;
    try {
      const body = await req.json();
      refCode = body?.referralCode ?? null;
    } catch (_) { /* no body is fine */ }

    // 1. Grant the 30-day Tier 3 welcome trial (idempotent)
    const { data: grantId, error: grantErr } = await supabase.rpc("grant_signup_welcome", {
      _user_id: userId,
    });
    if (grantErr) throw grantErr;

    // 2. If referral code present, attach this user as the referred friend
    let attachedReferral: string | null = null;
    if (refCode && userData.user.email) {
      // Find the most recent matching pending referral for this email OR create attribution
      const { data: existing } = await supabase
        .from("referrals")
        .select("id, referrer_id, status")
        .eq("referral_code", refCode)
        .eq("referred_email", userData.user.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing && existing.referrer_id !== userId) {
        await supabase
          .from("referrals")
          .update({ status: "joined", granted_to_user_id: userId })
          .eq("id", existing.id);
        attachedReferral = existing.id;
      } else if (!existing) {
        // Create attribution row even if invite wasn't pre-sent (link click signup)
        const { data: lookupReferrer } = await supabase
          .from("referrals")
          .select("referrer_id")
          .eq("referral_code", refCode)
          .limit(1)
          .maybeSingle();

        if (lookupReferrer?.referrer_id && lookupReferrer.referrer_id !== userId) {
          const { data: newRef } = await supabase
            .from("referrals")
            .insert({
              referrer_id: lookupReferrer.referrer_id,
              referred_email: userData.user.email,
              referral_code: refCode,
              status: "joined",
              granted_to_user_id: userId,
            })
            .select("id")
            .single();
          attachedReferral = newRef?.id ?? null;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, grantId, attachedReferral }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});

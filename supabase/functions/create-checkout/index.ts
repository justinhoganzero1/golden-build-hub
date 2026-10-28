import { statusFor } from "../_shared/errorStatus.ts";
import { safeOrigin } from "../_shared/origin.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { coinPackCents } from "../_shared/paymentValidation.ts";
import { type StripeEnv, createEmbeddedSession } from "../_shared/stripe.ts";

// Coin wallet top-ups via Lovable built-in payments (embedded checkout).
// Members only — visitors must sign up; no anonymous AI credit purchases.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const { coinPackDollars, returnTo, environment } = await req.json();
    if (environment !== "sandbox" && environment !== "live") {
      return new Response(JSON.stringify({ error: "invalid environment" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const env: StripeEnv = environment;
    // Only allow same-origin relative paths back into the app.
    const safeReturn = typeof returnTo === "string" && /^\/[A-Za-z0-9\-_/]*$/.test(returnTo) ? returnTo : "/wallet";
    let walletCents: number;
    try { walletCents = coinPackCents(coinPackDollars); }
    catch { return new Response(JSON.stringify({ error: "invalid coin pack" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
    const dollars = walletCents / 100;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "auth_required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email || user.is_anonymous) return new Response(JSON.stringify({ error: "auth_required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const amountCents = Math.round(dollars * 100);
    const coinsDelivered = (dollars * 5.37).toFixed(2);
    const origin = safeOrigin(req);

    const { clientSecret, sessionId } = await createEmbeddedSession({
      env,
      userId: user.id,
      email: user.email,
      priceData: {
        currency: "usd",
        unit_amount: amountCents,
        name: `${coinsDelivered} ORACLE LUNAR coins`,
        description: "$1 = 5.37 coins. Coins are used for paid AI actions inside the app.",
      },
      returnUrl: `${origin}${safeReturn}?coins=success&session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        purchase_type: "coin_topup",
        user_id: user.id,
        coin_pack_dollars: String(dollars),
        wallet_cents: String(walletCents),
        visitor_multiplier: "1",
        is_anonymous: "false",
      },
    });

    return new Response(JSON.stringify({ clientSecret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: statusFor(error),
    });
  }
});

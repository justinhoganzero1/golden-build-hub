import { statusFor } from "../_shared/errorStatus.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { safeOrigin } from "../_shared/origin.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { coinPackCents } from "../_shared/paymentValidation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const { priceId, mode, coinPackDollars, returnTo } = await req.json();
    // Only allow same-origin relative paths back into the app.
    const safeReturn = typeof returnTo === "string" && /^\/[A-Za-z0-9\-_/]*$/.test(returnTo) ? returnTo : "/wallet";
    if (priceId) return new Response(JSON.stringify({ error: "Use the dedicated product checkout" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    // Anonymous Supabase users have no email — Stripe Checkout will collect it.
    const isAnon = !user.email || (user as any).is_anonymous === true;
    const visitorMultiplier = isAnon ? 3 : 1;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    let customerId: string | undefined;
    if (user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) customerId = customers.data[0].id;
    }

    const origin = safeOrigin(req);

    const isCoinTopup = !priceId;
    // Visitors pay 3× for the same coin pack; signed-up members pay 1×.
    const amountCents = Math.round(dollars * 100 * visitorMultiplier);
    const coinsDelivered = (dollars * 5.37).toFixed(2);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId || !user.email ? undefined : user.email,
      line_items: isCoinTopup
        ? [{
            price_data: {
              currency: "usd",
              unit_amount: amountCents,
              product_data: {
                name: `${coinsDelivered} ORACLE LUNAR coins${isAnon ? " (visitor 3× price)" : ""}`,
                description: isAnon
                  ? "Visitor pricing: 3× the member rate. Sign up free to get the normal price."
                  : "$1 = 5.37 coins. Coins are used for paid AI actions inside the app.",
              },
            },
            quantity: 1,
          }]
        : [{ price: priceId, quantity: 1 }],
      mode: isCoinTopup ? "payment" : (mode || "payment"),
      metadata: isCoinTopup
        ? {
            purchase_type: "coin_topup",
            user_id: user.id,
            coin_pack_dollars: String(dollars),
            wallet_cents: String(walletCents),
            visitor_multiplier: String(visitorMultiplier),
            is_anonymous: String(isAnon),
          }
        : undefined,
      success_url: `${origin}${isCoinTopup ? safeReturn : "/wallet"}?coins=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${isCoinTopup ? safeReturn : "/wallet"}?coins=canceled`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: statusFor(error),
    });
  }
});

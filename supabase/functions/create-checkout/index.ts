import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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
    const { priceId, mode, coinPackDollars } = await req.json();
    const dollars = Number(coinPackDollars ?? 0);
    if (!priceId && (!Number.isFinite(dollars) || dollars <= 0)) {
      throw new Error("coinPackDollars or priceId is required");
    }

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://golden-vault-builder.lovable.app";

    const isCoinTopup = !priceId;
    const amountCents = Math.round(dollars * 100);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: isCoinTopup
        ? [{
            price_data: {
              currency: "usd",
              unit_amount: amountCents,
              product_data: {
                name: `${(dollars * 5.37).toFixed(2)} ORACLE LUNAR coins`,
                description: "$1 = 5.37 coins. Coins are used for paid AI actions inside the app.",
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
            wallet_cents: String(amountCents),
          }
        : undefined,
      success_url: `${origin}/wallet?coins=success`,
      cancel_url: `${origin}/wallet?coins=canceled`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

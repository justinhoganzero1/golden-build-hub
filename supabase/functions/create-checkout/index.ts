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
    if (!user) throw new Error("User not authenticated");

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

    const origin = req.headers.get("origin") || "https://golden-vault-builder.lovable.app";

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
            wallet_cents: String(Math.round(dollars * 100)),
            visitor_multiplier: String(visitorMultiplier),
            is_anonymous: String(isAnon),
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

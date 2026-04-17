import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 10,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let productId = null;
    let priceId = null;
    let subscriptionEnd = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      productId = subscription.items.data[0].price.product;
      priceId = subscription.items.data[0].price.id;
      logStep("Active subscription found", { productId, priceId, subscriptionEnd });
    } else {
      logStep("No active subscription");
    }

    // Check for SOLACE Lifetime Unlock one-time payment ($900)
    const LIFETIME_PRICE_ID = "price_1TN6KvLM75X0snyChMuEU6Eo";
    const LIFETIME_PRODUCT_ID = "prod_ULnwqViVNhjlMp";
    let hasLifetime = false;
    try {
      const charges = await stripe.charges.list({ customer: customerId, limit: 100 });
      for (const ch of charges.data) {
        if (ch.paid && !ch.refunded && ch.status === "succeeded") {
          // Confirm via the related payment intent's invoice/line items if needed; simplest: scan checkout sessions
        }
      }
      const sessions = await stripe.checkout.sessions.list({ customer: customerId, limit: 100 });
      for (const s of sessions.data) {
        if (s.mode === "payment" && s.payment_status === "paid") {
          const items = await stripe.checkout.sessions.listLineItems(s.id, { limit: 10 });
          if (items.data.some(li => li.price?.id === LIFETIME_PRICE_ID || li.price?.product === LIFETIME_PRODUCT_ID)) {
            hasLifetime = true;
            break;
          }
        }
      }
    } catch (e) {
      logStep("Lifetime check error", { error: String(e) });
    }
    logStep("Lifetime status", { hasLifetime });

    return new Response(JSON.stringify({
      subscribed: hasActiveSub || hasLifetime,
      product_id: hasLifetime ? LIFETIME_PRODUCT_ID : productId,
      price_id: hasLifetime ? LIFETIME_PRICE_ID : priceId,
      subscription_end: hasLifetime ? null : subscriptionEnd,
      lifetime: hasLifetime,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

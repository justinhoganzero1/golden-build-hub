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

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const email = typeof claimsData.claims.email === "string" ? claimsData.claims.email : null;
    if (!email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    if (body.admin_count === true) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== "justinbretthogan@gmail.com") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }

      const [{ data: usersPage, error: usersError }, { count: activeTrials, error: trialsError }] = await Promise.all([
        supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        supabase
          .from("reward_grants")
          .select("id", { count: "exact", head: true })
          .eq("active", true)
          .gt("expires_at", new Date().toISOString()),
      ]);

      if (usersError) throw usersError;
      if (trialsError) throw trialsError;

      let paidCount = 0;
      let hasMore = true;
      let startingAfter: string | undefined;
      while (hasMore) {
        const subscriptions = await stripe.subscriptions.list({
          status: "active",
          limit: 100,
          starting_after: startingAfter,
        });
        paidCount += subscriptions.data.length;
        hasMore = subscriptions.has_more;
        startingAfter = subscriptions.data.at(-1)?.id;
      }

      return new Response(JSON.stringify({
        total_users: usersPage.users.length,
        paid_count: paidCount,
        trial_count: activeTrials ?? 0,
        revenue: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customers = await stripe.customers.list({ email, limit: 1 });

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

    // Check for ORACLE LUNAR Lifetime Unlock one-time payment ($900) - LIVE
    const LIFETIME_PRICE_ID = "price_1TN7ybLGip9LWuvpeExWonbd";
    const LIFETIME_PRODUCT_ID = "prod_ULpd2N2mCZfoMd";
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

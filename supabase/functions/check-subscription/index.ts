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

    if (body.admin_count === true || body.admin_users === true) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== "justinbretthogan@gmail.com") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        });
      }

      // Page through ALL auth.users (admin API caps at 1000 per page)
      const allUsers: Array<{ id: string; email?: string; created_at?: string; last_sign_in_at?: string | null }> = [];
      let page = 1;
      while (true) {
        const { data, error } = await supabaseClient.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        allUsers.push(...data.users.map(u => ({
          id: u.id,
          email: u.email ?? "",
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        })));
        if (data.users.length < 1000) break;
        page += 1;
        if (page > 50) break; // safety
      }

      const { count: activeTrials, error: trialsError } = await supabaseClient
        .from("reward_grants")
        .select("id", { count: "exact", head: true })
        .eq("active", true)
        .gt("expires_at", new Date().toISOString());
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

      // "Online" = signed in within the last 5 minutes
      const ONLINE_WINDOW_MS = 5 * 60 * 1000;
      const now = Date.now();
      const enriched = allUsers.map(u => {
        const lastMs = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          online: lastMs > 0 && (now - lastMs) <= ONLINE_WINDOW_MS,
        };
      });

      const onlineCount = enriched.filter(u => u.online).length;

      // Failed signup count (last 30 days)
      const since = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: failedSignups } = await supabaseClient
        .from("signup_failures")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since);

      return new Response(JSON.stringify({
        total_users: enriched.length,
        paid_count: paidCount,
        trial_count: activeTrials ?? 0,
        online_count: onlineCount,
        offline_count: enriched.length - onlineCount,
        failed_signups_30d: failedSignups ?? 0,
        revenue: 0,
        users: body.admin_users === true ? enriched : undefined,
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

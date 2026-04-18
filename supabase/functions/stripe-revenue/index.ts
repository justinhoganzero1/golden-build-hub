// Owner-only Stripe revenue summary.
// Returns gross/net totals, recent payouts, and active subscription count
// pulled directly from the platform Stripe account.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "STRIPE_SECRET_KEY not configured" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Not authenticated" }, 401);

    // Owner check via has_role RPC
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Time windows
    const now = Math.floor(Date.now() / 1000);
    const day = 86400;
    const since30 = now - 30 * day;
    const since7 = now - 7 * day;

    // Pull recent successful charges (last 100) — covers most small platforms
    const charges = await stripe.charges.list({
      limit: 100,
      created: { gte: since30 },
    });

    let gross30 = 0;
    let net30 = 0;
    let fees30 = 0;
    let refunded30 = 0;
    let count30 = 0;
    let gross7 = 0;
    let count7 = 0;
    const currencyTotals: Record<string, number> = {};

    for (const ch of charges.data) {
      if (ch.status !== "succeeded") continue;
      const amount = ch.amount ?? 0;
      const refunded = ch.amount_refunded ?? 0;
      const fee = (ch.application_fee_amount as number | null) ?? 0;
      gross30 += amount;
      refunded30 += refunded;
      fees30 += fee;
      net30 += amount - refunded - fee;
      count30 += 1;
      currencyTotals[ch.currency] = (currencyTotals[ch.currency] ?? 0) + amount;
      if ((ch.created ?? 0) >= since7) {
        gross7 += amount;
        count7 += 1;
      }
    }

    // Current Stripe balance
    const balance = await stripe.balance.retrieve();
    const available = balance.available.reduce((acc, b) => {
      acc[b.currency] = (acc[b.currency] ?? 0) + b.amount;
      return acc;
    }, {} as Record<string, number>);
    const pending = balance.pending.reduce((acc, b) => {
      acc[b.currency] = (acc[b.currency] ?? 0) + b.amount;
      return acc;
    }, {} as Record<string, number>);

    // Active subscriptions count
    const subs = await stripe.subscriptions.list({ status: "active", limit: 100 });

    // Recent payouts
    const payouts = await stripe.payouts.list({ limit: 5 });

    // Recent charges for the table
    const recent = charges.data.slice(0, 10).map((c) => ({
      id: c.id,
      amount: c.amount,
      currency: c.currency,
      created: c.created,
      status: c.status,
      description: c.description ?? c.statement_descriptor ?? null,
      receipt_url: c.receipt_url ?? null,
    }));

    return json({
      gross30Cents: gross30,
      net30Cents: net30,
      fees30Cents: fees30,
      refunded30Cents: refunded30,
      count30,
      gross7Cents: gross7,
      count7,
      currencyTotals,
      activeSubscriptions: subs.data.length,
      availableBalance: available,
      pendingBalance: pending,
      recentCharges: recent,
      recentPayouts: payouts.data.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        arrival_date: p.arrival_date,
        status: p.status,
      })),
      generatedAt: now,
    });
  } catch (e) {
    console.error("[stripe-revenue]", e);
    return json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500
    );
  }
});

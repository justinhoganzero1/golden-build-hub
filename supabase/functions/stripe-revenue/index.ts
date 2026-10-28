// Owner-only revenue summary. Reads billing_transactions and subscriptions
// (both kept current by payments-webhook) instead of calling Stripe directly.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "Not authenticated", detail: userError?.message }, 401);
    }
    const userId = userData.user.id;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const now = Math.floor(Date.now() / 1000);
    const day = 86400;
    const since30iso = new Date((now - 30 * day) * 1000).toISOString();
    const since7iso = new Date((now - 7 * day) * 1000).toISOString();

    const [{ data: txns }, { data: subs }, { data: payoutRows }] = await Promise.all([
      supabase
        .from("billing_transactions")
        .select("id, transaction_type, total_micros, currency, status, created_at")
        .gte("created_at", since30iso)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: false })
        .in("status", ["active", "trialing"]),
      supabase
        .from("payout_requests")
        .select("id, amount_cents, status, processed_at")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    let gross30 = 0;
    let count30 = 0;
    let gross7 = 0;
    let count7 = 0;
    const currencyTotals: Record<string, number> = {};

    for (const t of txns ?? []) {
      if (t.status !== "settled") continue;
      const cents = Math.round((t.total_micros ?? 0) / 10_000);
      gross30 += cents;
      count30 += 1;
      const cur = String(t.currency ?? "aud").toLowerCase();
      currencyTotals[cur] = (currencyTotals[cur] ?? 0) + cents;
      if (t.created_at >= since7iso) {
        gross7 += cents;
        count7 += 1;
      }
    }

    const recent = (txns ?? []).slice(0, 10).map((t) => ({
      id: t.id,
      amount: Math.round((t.total_micros ?? 0) / 10_000),
      currency: String(t.currency ?? "aud").toLowerCase(),
      created: Math.floor(new Date(t.created_at).getTime() / 1000),
      status: t.status,
      description: t.transaction_type,
      receipt_url: null,
    }));

    return json({
      gross30Cents: gross30,
      net30Cents: gross30,
      fees30Cents: 0,
      refunded30Cents: 0,
      count30,
      gross7Cents: gross7,
      count7,
      currencyTotals,
      activeSubscriptions: (subs ?? []).length,
      availableBalance: {},
      pendingBalance: {},
      recentCharges: recent,
      recentPayouts: (payoutRows ?? []).map((p) => ({
        id: p.id,
        amount: p.amount_cents,
        currency: "aud",
        arrival_date: p.processed_at ? Math.floor(new Date(p.processed_at).getTime() / 1000) : null,
        status: p.status,
      })),
      generatedAt: now,
    });
  } catch (e) {
    console.error("[stripe-revenue]", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

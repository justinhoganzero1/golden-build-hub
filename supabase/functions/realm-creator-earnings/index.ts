// =============================================================================
// realm-creator-earnings
// -----------------------------------------------------------------------------
// Returns the calling creator's realm-sales summary plus their Stripe Connect
// available/pending balance and recent payouts. Read-only.
// =============================================================================

import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: claims, error: claimsErr } = await supabaseAuth.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims?.sub) {
      return json({ error: "Not authenticated" }, 401);
    }
    const userId = claims.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Per-realm sales aggregate
    const { data: sales } = await admin
      .from("shop_purchases")
      .select("item_id, amount_cents, creator_payout_cents, platform_fee_cents, status, completed_at, created_at")
      .eq("creator_id", userId)
      .eq("item_kind", "realm");

    const byRealm = new Map<string, {
      realm_id: string;
      sales_count: number;
      gross_cents: number;
      payout_cents: number;
      platform_fee_cents: number;
      last_sale_at: string | null;
    }>();
    let totalGross = 0;
    let totalPayout = 0;
    let totalFee = 0;
    let salesCount = 0;

    for (const s of (sales ?? [])) {
      if (s.status !== "paid" && s.status !== "completed") continue;
      salesCount++;
      totalGross += s.amount_cents ?? 0;
      totalPayout += s.creator_payout_cents ?? 0;
      totalFee += s.platform_fee_cents ?? 0;
      const key = s.item_id as string;
      const cur = byRealm.get(key) ?? {
        realm_id: key, sales_count: 0, gross_cents: 0, payout_cents: 0, platform_fee_cents: 0, last_sale_at: null as string | null,
      };
      cur.sales_count++;
      cur.gross_cents += s.amount_cents ?? 0;
      cur.payout_cents += s.creator_payout_cents ?? 0;
      cur.platform_fee_cents += s.platform_fee_cents ?? 0;
      const ts = s.completed_at ?? s.created_at;
      if (ts && (!cur.last_sale_at || ts > cur.last_sale_at)) cur.last_sale_at = ts;
      byRealm.set(key, cur);
    }

    // Enrich per-realm with titles
    const realmIds = Array.from(byRealm.keys());
    if (realmIds.length) {
      const { data: realms } = await admin
        .from("user_realms")
        .select("id,title,view_count,download_count,shop_price_cents")
        .in("id", realmIds);
      for (const r of (realms ?? [])) {
        const entry = byRealm.get(r.id) as any;
        if (entry) {
          entry.title = r.title;
          entry.view_count = r.view_count;
          entry.download_count = r.download_count;
          entry.shop_price_cents = r.shop_price_cents;
        }
      }
    }

    // Stripe Connect balance + payouts (best-effort)
    let stripe_balance: any = null;
    let payouts: any[] = [];
    let stripe_account_id: string | null = null;

    const { data: connect } = await admin
      .from("connect_accounts")
      .select("stripe_account_id")
      .eq("user_id", userId)
      .maybeSingle();

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (connect?.stripe_account_id && stripeKey) {
      stripe_account_id = connect.stripe_account_id;
      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const bal = await stripe.balance.retrieve({ stripeAccount: connect.stripe_account_id });
        stripe_balance = {
          available: (bal.available ?? []).map((b: any) => ({ amount: b.amount, currency: b.currency })),
          pending: (bal.pending ?? []).map((b: any) => ({ amount: b.amount, currency: b.currency })),
        };
        const po = await stripe.payouts.list({ limit: 10 }, { stripeAccount: connect.stripe_account_id });
        payouts = po.data.map((p: any) => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          arrival_date: p.arrival_date,
          method: p.method,
          created: p.created,
        }));
      } catch (e) {
        console.warn("stripe fetch failed", (e as Error).message);
      }
    }

    return json({
      totals: {
        sales_count: salesCount,
        gross_cents: totalGross,
        payout_cents: totalPayout,
        platform_fee_cents: totalFee,
      },
      per_realm: Array.from(byRealm.values()).sort((a, b) => b.payout_cents - a.payout_cents),
      stripe_account_id,
      stripe_balance,
      payouts,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

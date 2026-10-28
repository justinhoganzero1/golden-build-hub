import { statusFor } from "../_shared/errorStatus.ts";
// =============================================================================
// realm-creator-earnings
// -----------------------------------------------------------------------------
// Returns the calling creator's realm-sales summary plus their Stripe Connect
// available/pending balance and recent payouts. Read-only.
// =============================================================================

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

    // Payouts now run through payout requests (Lovable-managed payments);
    // there is no per-creator Stripe Connect balance anymore.
    let stripe_balance: any = null;
    let payouts: any[] = [];
    let stripe_account_id: string | null = null;

    const { data: payoutRows } = await admin
      .from("payout_requests")
      .select("id, amount_cents, method, status, created_at, processed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    payouts = (payoutRows ?? []).map((p: any) => ({
      id: p.id,
      amount: p.amount_cents,
      currency: "aud",
      status: p.status,
      arrival_date: p.processed_at ? Math.floor(new Date(p.processed_at).getTime() / 1000) : null,
      method: p.method,
      created: Math.floor(new Date(p.created_at).getTime() / 1000),
    }));

    const { data: availableCents } = await admin.rpc("seller_available_balance", { user_uuid: userId });
    stripe_balance = { available: [{ amount: availableCents ?? 0, currency: "aud" }], pending: [] };

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
    return json({ error: (e as Error).message }, statusFor(e));
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

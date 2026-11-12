// Owner-only revenue summary. Reads REAL money only: live-mode Stripe charges,
// subscriptions, balance and payouts. Sandbox/test payments, wallet AI usage,
// free plan credits and the owner's own payments are never counted as revenue.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { createStripeClient } from "../_shared/stripe.ts";

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

const PROTECTED_ROLES = ["admin", "owner"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return json({ error: "Not authenticated" }, 401);
    }

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    // Owner/admin accounts: their own payments are not customer revenue.
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", PROTECTED_ROLES);
    const ownerIds = new Set((roleRows ?? []).map((r: any) => String(r.user_id)));
    const ownerEmails = new Set<string>();
    for (const id of ownerIds) {
      const { data } = await supabase.auth.admin.getUserById(id);
      if (data?.user?.email) ownerEmails.add(data.user.email.toLowerCase());
    }

    const isOwnerPayment = (meta: any, customer: any, email?: string | null) => {
      const ids = [meta?.user_id, meta?.userId, meta?.buyer_id, customer?.metadata?.userId, customer?.metadata?.user_id]
        .filter(Boolean).map(String);
      if (ids.some((id) => ownerIds.has(id))) return true;
      const emails = [email, customer?.email].filter(Boolean).map((e) => String(e).toLowerCase());
      return emails.some((e) => ownerEmails.has(e));
    };

    const stripe = createStripeClient("live");
    const now = Math.floor(Date.now() / 1000);
    const day = 86400;
    const since30 = now - 30 * day;
    const since7 = now - 7 * day;

    const [charges, subs, balance, payouts] = await Promise.all([
      stripe.charges.list({
        created: { gte: since30 },
        limit: 100,
        expand: ["data.customer", "data.balance_transaction"],
      } as any),
      stripe.subscriptions.list({ status: "active", limit: 100, expand: ["data.customer"] } as any),
      stripe.balance.retrieve(),
      stripe.payouts.list({ limit: 5 }),
    ]);

    let gross30 = 0, fees30 = 0, refunded30 = 0, count30 = 0, gross7 = 0, count7 = 0;
    let ownerExcluded = 0;
    const currencyTotals: Record<string, number> = {};
    const recent: any[] = [];

    for (const c of charges.data as any[]) {
      if (!c.livemode || !c.paid || c.status !== "succeeded") continue;
      if (isOwnerPayment(c.metadata, c.customer, c.billing_details?.email ?? c.receipt_email)) {
        ownerExcluded += 1;
        continue;
      }
      const cur = String(c.currency ?? "aud").toLowerCase();
      const fee = typeof c.balance_transaction === "object" && c.balance_transaction ? Number(c.balance_transaction.fee ?? 0) : 0;
      gross30 += c.amount;
      refunded30 += c.amount_refunded ?? 0;
      fees30 += fee;
      count30 += 1;
      currencyTotals[cur] = (currencyTotals[cur] ?? 0) + c.amount;
      if (c.created >= since7) { gross7 += c.amount; count7 += 1; }
      if (recent.length < 10) {
        recent.push({
          id: c.id,
          amount: c.amount,
          currency: cur,
          created: c.created,
          status: c.refunded ? "refunded" : c.status,
          description: c.description ?? null,
          receipt_url: c.receipt_url ?? null,
        });
      }
    }

    const activeSubs = (subs.data as any[]).filter(
      (s) => s.livemode && !isOwnerPayment(s.metadata, s.customer),
    ).length;

    const toMap = (arr: any[] = []) =>
      Object.fromEntries(arr.map((b) => [String(b.currency).toLowerCase(), b.amount]));

    return json({
      gross30Cents: gross30,
      net30Cents: gross30 - refunded30 - fees30,
      fees30Cents: fees30,
      refunded30Cents: refunded30,
      count30,
      gross7Cents: gross7,
      count7,
      currencyTotals,
      activeSubscriptions: activeSubs,
      availableBalance: toMap((balance as any).available),
      pendingBalance: toMap((balance as any).pending),
      recentCharges: recent,
      recentPayouts: (payouts.data as any[]).map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: String(p.currency).toLowerCase(),
        arrival_date: p.arrival_date,
        status: p.status,
      })),
      ownerPaymentsExcluded: ownerExcluded,
      realMoneyOnly: true,
      generatedAt: now,
    });
  } catch (e) {
    console.error("[stripe-revenue]", e);
    return json({ error: "Could not read live Stripe revenue right now" }, 500);
  }
});

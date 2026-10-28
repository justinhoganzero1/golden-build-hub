// Returns a chronological timeline of the current user's billing events,
// built from the subscriptions table and billing_transactions (both kept
// current by payments-webhook). No direct Stripe calls.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false } }
    );
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: corsHeaders });
    const { data: c, error: ce } = await auth.auth.getClaims(token);
    if (ce || !c?.claims?.sub) {
      return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: corsHeaders });
    }
    const userId = c.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const [{ data: subs }, { data: txns }] = await Promise.all([
      admin
        .from("subscriptions")
        .select("stripe_subscription_id, price_id, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("billing_transactions")
        .select("id, transaction_type, total_micros, currency, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const events: any[] = [];
    for (const s of subs ?? []) {
      events.push({
        id: `sub-${s.stripe_subscription_id}`,
        type: "customer.subscription.created",
        kind: s.status === "canceled" ? "canceled" : "created",
        title: s.status === "canceled" ? "Subscription canceled" : "Subscription started",
        detail: `Plan: ${s.price_id} — status: ${s.status}`,
        created: Math.floor(new Date(s.created_at).getTime() / 1000),
        created_iso: s.created_at,
      });
      if (s.cancel_at_period_end && s.current_period_end) {
        events.push({
          id: `sub-cancel-${s.stripe_subscription_id}`,
          type: "customer.subscription.updated",
          kind: "cancel_scheduled",
          title: "Cancellation scheduled",
          detail: `Ends ${new Date(s.current_period_end).toLocaleDateString()}`,
          created: Math.floor(new Date(s.updated_at).getTime() / 1000),
          created_iso: s.updated_at,
        });
      }
    }
    for (const t of txns ?? []) {
      if (t.status !== "settled") continue;
      events.push({
        id: `txn-${t.id}`,
        type: "invoice.paid",
        kind: "renewed",
        title: t.transaction_type === "topup" ? "Coin top-up" : "Payment received",
        detail: `${((t.total_micros ?? 0) / 1_000_000).toFixed(2)} ${String(t.currency ?? "AUD").toUpperCase()}`,
        created: Math.floor(new Date(t.created_at).getTime() / 1000),
        created_iso: t.created_at,
      });
    }
    events.sort((a, b) => b.created - a.created);

    return new Response(
      JSON.stringify({ customer: { id: userId, email: c.claims.email }, events: events.slice(0, 100) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

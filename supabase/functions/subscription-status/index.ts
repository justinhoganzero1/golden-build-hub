// Returns the current user's subscription state from the subscriptions
// table (kept current by payments-webhook). No direct Stripe calls.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_NAMES: Record<string, string> = {
  oracle_monthly: "Oracle Lunar Membership",
  ai_partner_monthly: "AI Partner",
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

    const { data: subs } = await admin
      .from("subscriptions")
      .select("price_id, status, current_period_end, cancel_at_period_end, stripe_customer_id, environment")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(5);

    const now = new Date();
    const isLive = (s: any) =>
      (s.status === "active" || s.status === "trialing") &&
      (!s.current_period_end || new Date(s.current_period_end) > now);
    const active = (subs ?? []).find(isLive);
    const sub = active ?? (subs ?? [])[0];

    let plan: { name: string; amount_cents: number; interval: string | null; product_id: string; price_id: string } | null = null;
    if (sub) {
      plan = {
        name: PLAN_NAMES[sub.price_id] ?? "Oracle Lunar Plan",
        amount_cents: 0,
        interval: "month",
        product_id: sub.price_id,
        price_id: sub.price_id,
      };
    }

    return new Response(
      JSON.stringify({
        subscribed: !!active,
        status: sub?.status ?? null,
        plan,
        current_period_end: sub?.current_period_end ?? null,
        cancel_at_period_end: sub?.cancel_at_period_end ?? false,
        cancel_at: null,
        customer: sub ? { id: sub.stripe_customer_id, email: c.claims.email } : null,
        invoices: [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

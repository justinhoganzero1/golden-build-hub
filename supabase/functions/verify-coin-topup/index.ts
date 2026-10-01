// Confirms a coin top-up directly with Stripe when the buyer returns from
// checkout, and credits the wallet. Works even if the webhook is delayed or
// misconfigured. Idempotent: the same session can never be credited twice.
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "auth_required" }, 401);

    const { sessionId } = await req.json().catch(() => ({}));
    if (typeof sessionId !== "string" || !/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) {
      return json({ error: "invalid session" }, 400);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const s = await stripe.checkout.sessions.retrieve(sessionId);
    const meta = s.metadata ?? {};
    if (meta.purchase_type !== "coin_topup" || meta.user_id !== u.user.id) return json({ error: "not your top-up" }, 403);
    if (s.payment_status !== "paid") return json({ credited: false, status: s.payment_status });

    const walletCents = Math.round(Number(meta.wallet_cents ?? 0));
    const { data, error } = await admin.rpc("billing_credit_stripe_topup", {
      _user_id: u.user.id,
      _stripe_event_id: `verify:${s.id}`,
      _stripe_session_id: s.id,
      _stripe_payment_intent: typeof s.payment_intent === "string" ? s.payment_intent : null,
      _wallet_cents: walletCents,
      _gross_cents: Math.round(Number(s.amount_total ?? 0)),
      _currency: s.currency ?? "usd",
      _metadata: { checkout_mode: s.mode, via: "return_verify" },
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    const { data: bal } = await admin.from("wallet_balances").select("balance_cents").eq("user_id", u.user.id).maybeSingle();
    return json({ credited: true, duplicate: !!row?.duplicate, balance_cents: bal?.balance_cents ?? 0 });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

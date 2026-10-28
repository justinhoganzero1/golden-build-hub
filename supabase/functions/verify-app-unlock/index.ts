import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { APP_PAYMENTS, validateAppPayment } from "../_shared/paymentValidation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APP_KEYS = new Set(Object.keys(APP_PAYMENTS));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { session_id, app_key, environment } = await req.json().catch(() => ({}));
    if (environment !== "sandbox" && environment !== "live") {
      return new Response(JSON.stringify({ error: "invalid environment" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!session_id || !app_key || !APP_KEYS.has(app_key)) {
      return new Response(JSON.stringify({ error: "Missing session_id or app_key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const { data: userData, error: userError } = await anon.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    const stripe = createStripeClient(environment as StripeEnv);
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ unlocked: false, reason: "Payment not completed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    try { validateAppPayment(session, user.id, app_key); }
    catch {
      return new Response(JSON.stringify({ unlocked: false, reason: "User mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    const amount = session.amount_total ?? 0;
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : null;
    const { error: unlockError } = await service.from("app_unlocks").upsert(
      {
        user_id: user.id,
        app_key,
        stripe_session_id: session.id,
        stripe_payment_intent: pi,
        amount_cents: amount,
        currency: session.currency ?? "usd",
      },
      { onConflict: "user_id,app_key" }
    );
    if (unlockError) throw unlockError;

    return new Response(JSON.stringify({ unlocked: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { safeOrigin } from "../_shared/origin.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { type StripeEnv, createEmbeddedSession } from "../_shared/stripe.ts";
import { APP_PAYMENTS } from "../_shared/paymentValidation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// One-time app unlocks via Lovable built-in payments (embedded checkout).
// Prices are server-owned in APP_PAYMENTS (paymentValidation.ts); the
// payments webhook records the unlock in app_unlocks.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { app_key, environment } = await req.json().catch(() => ({}));
    if (environment !== "sandbox" && environment !== "live") {
      return new Response(JSON.stringify({ error: "invalid environment" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const env: StripeEnv = environment;
    const product = app_key && APP_PAYMENTS[app_key as string];
    if (!product) {
      return new Response(JSON.stringify({ error: "Invalid app_key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("Not authenticated");

    // Already unlocked? Short-circuit so user isn't double-charged.
    const service = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    const { data: existing } = await service
      .from("app_unlocks")
      .select("id")
      .eq("user_id", user.id)
      .eq("app_key", app_key)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ already_unlocked: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = safeOrigin(req);
    const { clientSecret, sessionId } = await createEmbeddedSession({
      env,
      userId: user.id,
      email: user.email,
      priceLookupKey: product.price,
      returnUrl: `${origin}/unlock-success?app=${app_key}&session_id={CHECKOUT_SESSION_ID}`,
      metadata: { purchase_type: "app_unlock", app_key, user_id: user.id, label: product.label },
    });

    return new Response(JSON.stringify({ clientSecret }), {
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

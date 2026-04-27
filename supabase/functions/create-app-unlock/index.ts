import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Single source of truth for app unlock pricing.
// Keep client-side AppUnlockGate prices in sync with these.
const APP_PRICES: Record<string, { price: string; label: string; amount_cents: number }> = {
  app_wrapper: { price: "price_1TNjKELGip9LWuvpgfyCXGKE", label: "App Wrapper", amount_cents: 500 },
  app_maker: { price: "price_1TNjPQLGip9LWuvpXeNDys3j", label: "App Maker", amount_cents: 2000 },
  movie_studio: { price: "price_1TNjPoLGip9LWuvpNSihLK7v", label: "Movie Studio Pro", amount_cents: 100 },
  photo_templates: { price: "price_1TQcriLGip9LWuvpKFaAUlKx", label: "Unlimited Photo Templates", amount_cents: 100 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { app_key } = await req.json().catch(() => ({}));
    const product = app_key && APP_PRICES[app_key as string];
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

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2025-08-27.basil",
    });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const origin = req.headers.get("origin") ?? "https://oracle-lunar.online";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: product.price, quantity: 1 }],
      mode: "payment",
      success_url: `${origin}/unlock-success?app=${app_key}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/apps`,
      metadata: { app_key, user_id: user.id, label: product.label },
    });

    return new Response(JSON.stringify({ url: session.url }), {
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

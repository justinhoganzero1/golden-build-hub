import { safeOrigin } from "../_shared/origin.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { type StripeEnv, createEmbeddedSession } from "../_shared/stripe.ts";
import { MOVIE_PAYMENTS } from "../_shared/paymentValidation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Movie render checkout via Lovable built-in payments (embedded checkout).
// Price IDs are the human-readable lookup keys in MOVIE_PAYMENTS
// (paymentValidation.ts); the payments webhook marks the project paid and
// kicks rendering.

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );
    const { data: u } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    const user = u.user;
    if (!user?.email) return json({ error: "unauthorized" }, 401);

    const { project_id, quality_tier, environment } = await req.json();
    if (!project_id || !quality_tier) return json({ error: "project_id and quality_tier required" }, 400);
    if (environment !== "sandbox" && environment !== "live") return json({ error: "invalid environment" }, 400);
    const env: StripeEnv = environment;

    const tier = MOVIE_PAYMENTS[quality_tier];
    if (!tier) return json({ error: `unknown quality_tier: ${quality_tier}` }, 400);

    // Verify project belongs to user
    const { data: project } = await supabase.from("movie_projects")
      .select("id, user_id, title, payment_status").eq("id", project_id).maybeSingle();
    if (!project || project.user_id !== user.id) return json({ error: "project not found" }, 404);
    if (project.payment_status === "paid") return json({ error: "already paid" }, 400);

    const origin = safeOrigin(req);
    const clientSecret = await createEmbeddedSession({
      env,
      userId: user.id,
      email: user.email,
      priceLookupKey: tier.price,
      returnUrl: `${origin}/movie-payment-success?session_id={CHECKOUT_SESSION_ID}&project_id=${project_id}`,
      metadata: { project_id, quality_tier, user_id: user.id },
    });

    // Mark pending
    await supabase.from("movie_projects").update({
      payment_status: "pending",
      quality_tier,
      estimated_cost_cents: tier.amount_cents,
    }).eq("id", project_id);

    return json({ clientSecret, amount_cents: tier.amount_cents, label: tier.label });
  } catch (e) {
    console.error("[movie-checkout]", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

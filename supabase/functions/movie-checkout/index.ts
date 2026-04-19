// Movie Studio Pro — Stripe one-off checkout per quality tier.
// Body: { project_id: string, quality_tier: "sd"|"hd"|"4k"|"8k_ultimate" }
// Returns: { url: string } — redirect user to Stripe Checkout.
// On success, Stripe redirects to /movie-payment-success?session_id=cs_...
// then frontend calls verify-movie-payment to mark project paid + queue rendering.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Stripe price IDs created via stripe-create-product tool
const PRICE_IDS: Record<string, { price: string; amount_cents: number; label: string }> = {
  sd:           { price: "price_1TNob8LGip9LWuvpZsCHHeMU", amount_cents: 900,   label: "SD Quality"  },
  hd:           { price: "price_1TNobXLGip9LWuvp4XFCnQYf", amount_cents: 2900,  label: "HD Quality"  },
  "4k":         { price: "price_1TNobvLGip9LWuvp3hDSZO3I", amount_cents: 7900,  label: "4K Quality"  },
  "8k_ultimate":{ price: "price_1TNocFLGip9LWuvpIhVz42ra", amount_cents: 19900, label: "8K Ultimate" },
};

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

    const { project_id, quality_tier } = await req.json();
    if (!project_id || !quality_tier) return json({ error: "project_id and quality_tier required" }, 400);

    const tier = PRICE_IDS[quality_tier];
    if (!tier) return json({ error: `unknown quality_tier: ${quality_tier}` }, 400);

    // Verify project belongs to user
    const { data: project } = await supabase.from("movie_projects")
      .select("id, user_id, title, payment_status").eq("id", project_id).maybeSingle();
    if (!project || project.user_id !== user.id) return json({ error: "project not found" }, 404);
    if (project.payment_status === "paid") return json({ error: "already paid" }, 400);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    // Find or create customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const origin = req.headers.get("origin") ?? "https://oracle-lunar.online";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: tier.price, quantity: 1 }],
      mode: "payment",
      success_url: `${origin}/movie-payment-success?session_id={CHECKOUT_SESSION_ID}&project_id=${project_id}`,
      cancel_url: `${origin}/movie-studio-pro?cancelled=1`,
      metadata: { project_id, quality_tier, user_id: user.id },
    });

    // Mark pending
    await supabase.from("movie_projects").update({
      stripe_session_id: session.id,
      payment_status: "pending",
      quality_tier,
      estimated_cost_cents: tier.amount_cents,
    }).eq("id", project_id);

    return json({ url: session.url, session_id: session.id, amount_cents: tier.amount_cents, label: tier.label });
  } catch (e) {
    console.error("[movie-checkout]", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

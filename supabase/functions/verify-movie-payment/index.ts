// Verifies a Stripe Checkout session for Movie Studio Pro and, if paid,
// marks the project as paid and triggers script-chunker → render pipeline.
// Body: { session_id: string, project_id: string }
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    if (!user) return json({ error: "unauthorized" }, 401);

    const { session_id, project_id } = await req.json();
    if (!session_id || !project_id) return json({ error: "session_id and project_id required" }, 400);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== "paid") {
      return json({ paid: false, status: session.payment_status });
    }

    const { data: project } = await supabase.from("movie_projects")
      .select("*").eq("id", project_id).maybeSingle();
    if (!project || project.user_id !== user.id) return json({ error: "project not found" }, 404);

    // Idempotent
    if (project.payment_status === "paid") {
      return json({ paid: true, already: true, project_id });
    }

    await supabase.from("movie_projects").update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent: session.payment_intent as string,
      user_paid_cents: session.amount_total ?? 0,
      status: "chunking",
    }).eq("id", project_id);

    // Kick off chunker which will create scenes + queue render jobs
    EdgeRuntime.waitUntil((async () => {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/movie-script-chunker`, {
          method: "POST",
          headers: { "Authorization": auth, "Content-Type": "application/json" },
          body: JSON.stringify({ project_id }),
        });
      } catch (e) { console.error("chunker kick failed", e); }
    })());

    return json({ paid: true, project_id, amount_cents: session.amount_total });
  } catch (e) {
    console.error("[verify-movie-payment]", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

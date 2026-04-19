// Living GIF $4 one-time Stripe checkout
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) =>
  console.log(`[gif-checkout] ${s}${d ? " " + JSON.stringify(d) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const { data: ud, error: ue } = await supa.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (ue || !ud.user?.email) throw new Error("Not authenticated");
    const user = ud.user;

    const body = await req.json().catch(() => ({}));
    const { source_avatar_id, source_image_url, prompt, title } = body ?? {};
    if (!source_image_url || !prompt || String(prompt).trim().length < 4) {
      return new Response(
        JSON.stringify({ error: "source_image_url and prompt (min 4 chars) required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create the pending GIF row
    const { data: gif, error: insErr } = await supa
      .from("living_gifs")
      .insert({
        user_id: user.id,
        source_avatar_id: source_avatar_id ?? null,
        source_image_url,
        prompt: String(prompt).slice(0, 800),
        title: title ? String(title).slice(0, 120) : null,
        amount_paid_cents: 400,
        status: "pending_payment",
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const origin = req.headers.get("origin") ?? "https://oracle-lunar.online";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 400,
            product_data: {
              name: "Living GIF (20s 8K)",
              description: `Custom 20-second 8K animated avatar GIF.`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/living-gif-studio?paid=1&gif_id=${gif.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/living-gif-studio?canceled=1&gif_id=${gif.id}`,
      metadata: { gif_id: gif.id, user_id: user.id, kind: "living_gif" },
    });

    await supa
      .from("living_gifs")
      .update({ stripe_session_id: session.id })
      .eq("id", gif.id);

    log("checkout created", { gif_id: gif.id, session: session.id });
    return new Response(JSON.stringify({ url: session.url, gif_id: gif.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

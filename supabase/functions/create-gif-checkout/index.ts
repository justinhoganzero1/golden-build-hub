import { statusFor } from "../_shared/errorStatus.ts";
import { safeOrigin } from "../_shared/origin.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { type StripeEnv, createEmbeddedSession } from "../_shared/stripe.ts";

// Living GIF $4 one-time checkout via Lovable built-in payments (embedded).
// The payments webhook marks the GIF row paid; generate-living-gif then
// queues generation without needing to talk to Stripe.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) =>
  console.log(`[gif-checkout] ${s}${d ? " " + JSON.stringify(d) : ""}`);

Deno.serve(async (req) => {
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

    // Admin bypass — owner generates GIFs free
    const { data: roleRow } = await supa
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;

    const body = await req.json().catch(() => ({}));
    const { source_avatar_id, source_image_url, prompt, title, environment } = body ?? {};
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
        amount_paid_cents: isAdmin ? 0 : 400,
        status: isAdmin ? "generating" : "pending_payment",
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    // Admin: skip payment entirely, return a marker the client uses to trigger generation
    if (isAdmin) {
      log("admin bypass — free generation", { gif_id: gif.id, user: user.email });
      return new Response(
        JSON.stringify({ admin_bypass: true, gif_id: gif.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    if (environment !== "sandbox" && environment !== "live") throw new Error("invalid environment");
    const env: StripeEnv = environment;

    const origin = safeOrigin(req);
    const { clientSecret, sessionId } = await createEmbeddedSession({
      env,
      userId: user.id,
      email: user.email,
      priceLookupKey: "living_gif_once",
      returnUrl: `${origin}/living-gif-studio?paid=1&gif_id=${gif.id}&session_id={CHECKOUT_SESSION_ID}`,
      metadata: { purchase_type: "living_gif", kind: "living_gif", gif_id: gif.id, user_id: user.id },
    });

    await supa
      .from("living_gifs")
      .update({ stripe_session_id: sessionId })
      .eq("id", gif.id);

    return new Response(
      JSON.stringify({ clientSecret, gif_id: gif.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: statusFor(error),
    });
  }
});

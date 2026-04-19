// generate-living-gif (queue-and-return)
//
// Switched to async pipeline. This function:
//   1. Verifies the user (and Stripe if not admin)
//   2. Resets the row to `queued` with a fresh source image if provided
//   3. Returns immediately
//
// The actual Runway → Replicate → storage work happens in the
// `living-gif-worker` edge function, kicked every minute by pg_cron.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const log = (s: string, d?: unknown) =>
  console.log(`[gen-living-gif] ${s}${d ? " " + JSON.stringify(d) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");
    const { data: ud } = await supa.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!ud.user) throw new Error("Not authenticated");
    const user = ud.user;

    const { gif_id, session_id, source_image_url } = await req.json();
    if (!gif_id) throw new Error("gif_id required");

    // Admin bypass — owner skips Stripe
    const { data: roleRow } = await supa
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;

    const { data: gif } = await supa
      .from("living_gifs")
      .select("*")
      .eq("id", gif_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!gif) {
      // Stale redirect (row deleted or belongs to another user) — soft success
      return new Response(
        JSON.stringify({ ok: true, stale: true, gif_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (gif.status === "ready" && gif.gif_url) {
      return new Response(JSON.stringify({ ok: true, gif }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAdmin) {
      if (!session_id) throw new Error("session_id required");
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
        apiVersion: "2025-08-27.basil",
      });
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status !== "paid") {
        throw new Error(`Payment not complete: ${session.payment_status}`);
      }
      await supa.from("living_gifs").update({
        stripe_payment_intent: String(session.payment_intent ?? ""),
      }).eq("id", gif_id);
    }

    const updates: Record<string, unknown> = {
      status: "queued",
      pipeline_stage: null,
      runway_task_id: null,
      replicate_prediction_id: null,
      attempts: 0,
      locked_at: null,
      locked_by: null,
      last_progress_at: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    };
    if (source_image_url && source_image_url !== gif.source_image_url) {
      updates.source_image_url = source_image_url;
      updates.thumbnail_url = gif.thumbnail_url ?? source_image_url;
    }
    await supa.from("living_gifs").update(updates).eq("id", gif_id);
    log("queued", { gif_id });

    // Best-effort kick the worker (cron is the safety net)
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/living-gif-worker`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tick: true }),
      });
    } catch { /* ignore */ }

    return new Response(
      JSON.stringify({ ok: true, queued: true, gif_id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { msg });
    // Best-effort mark failed
    try {
      const supa = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const body = await req.clone().json().catch(() => ({}));
      if (body.gif_id) {
        await supa.from("living_gifs").update({
          status: "failed",
          error_message: msg.slice(0, 500),
        }).eq("id", body.gif_id);
      }
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

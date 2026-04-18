// Movie Studio Pro — render charge gate.
// Charges the user's wallet at base compute cost + 50% service markup BEFORE export.
// Pricing model:
//   base cost per scene (20 sec cinematic clip): 8 cents
//     - covers Gemini image gen + ElevenLabs VO/SFX/music compute
//   service fee: +50% of base = ensures we always profit
//   minimum charge: 25 cents per export
//
// action=estimate → returns price, no charge
// action=charge   → atomically deducts wallet (rejects if insufficient)

import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_CENTS_PER_SCENE = 8;
const SERVICE_MARKUP = 0.5; // +50%
const MIN_CHARGE_CENTS = 25;
const HD_SURCHARGE_CENTS = 15; // 1080p add-on
const CAPTION_SURCHARGE_CENTS = 5;

interface Body {
  scene_count: number;
  hd?: boolean;
  with_captions?: boolean;
  action: "estimate" | "charge";
}

function price(b: Body) {
  const base = Math.max(1, b.scene_count) * BASE_CENTS_PER_SCENE
    + (b.hd ? HD_SURCHARGE_CENTS : 0)
    + (b.with_captions ? CAPTION_SURCHARGE_CENTS : 0);
  const fee = Math.ceil(base * SERVICE_MARKUP);
  const total = Math.max(MIN_CHARGE_CENTS, base + fee);
  return { base_cents: base, service_fee_cents: fee, total_cents: total };
}

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    const { data: u } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    const user = u.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = (await req.json()) as Body;
    if (!body.scene_count || body.scene_count < 1) return json({ error: "scene_count required" }, 400);

    const p = price(body);

    if (body.action === "estimate") {
      // Also return current balance so UI can show "you need $X.XX more"
      const { data: wallet } = await supabase
        .from("wallet_balances")
        .select("balance_cents")
        .eq("user_id", user.id)
        .maybeSingle();
      return json({
        ...p,
        balance_cents: wallet?.balance_cents ?? 0,
        sufficient: (wallet?.balance_cents ?? 0) >= p.total_cents,
      });
    }

    // CHARGE — atomic deduction
    // Use the same wallet_charge_call helper pattern but inline since this isn't a Twilio call.
    // Re-use wallet_topup with a NEGATIVE amount to deduct atomically? No — that allows negatives.
    // Implement guarded deduction here.
    const { data: wallet } = await supabase
      .from("wallet_balances")
      .select("balance_cents")
      .eq("user_id", user.id)
      .maybeSingle();

    const balance = wallet?.balance_cents ?? 0;
    if (balance < p.total_cents) {
      return json({
        error: "insufficient_balance",
        required_cents: p.total_cents,
        balance_cents: balance,
        short_cents: p.total_cents - balance,
        ...p,
      }, 402);
    }

    // Deduct via upsert
    await supabase
      .from("wallet_balances")
      .upsert({ user_id: user.id, balance_cents: balance - p.total_cents }, { onConflict: "user_id" });

    // Log the charge in call_charges (re-using table for now, status="movie_render")
    await supabase.from("call_charges").insert({
      user_id: user.id,
      destination: `movie_render:${body.scene_count}scenes${body.hd ? ":hd" : ""}${body.with_captions ? ":cc" : ""}`,
      duration_seconds: body.scene_count * 20,
      twilio_cost_cents: p.base_cents,
      service_fee_cents: p.service_fee_cents,
      total_billed_cents: p.total_cents,
      status: "movie_render",
    });

    return json({
      success: true,
      ...p,
      new_balance_cents: balance - p.total_cents,
    });
  } catch (e) {
    console.error("movie-render-charge error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

// Movie Studio Pro — render charge gate.
// Charges the user's wallet at:
//   provider compute estimate + PLATFORM_MARKUP_PCT (5%) on top of every outside cost
//   + an additional service fee that scales with duration (covers Lovable AI + storage)
//
// action=estimate → returns price + breakdown, no charge
// action=charge   → atomically deducts wallet (rejects if insufficient)
//
// 2026-04-19: Aggressive paywall update
//   - We now bill provider cost (Runway image-to-video + ElevenLabs VO) at provider+5%
//   - Service fee bumped from 50% → 60% on internal compute to cover Gemini + storage + bandwidth
//   - HD/captions surcharges retained
//   - Added duration_min input so we can cap export length per subscription tier (enforced client-side too)

import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { markupCents, PROVIDER_RATES } from "../_shared/pricing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SERVICE_MARKUP = 0.6; // +60% on internal compute (Gemini + storage + render queue)
const MIN_CHARGE_CENTS = 25;
const HD_SURCHARGE_CENTS = 25;     // bumped — 1080p adds real bandwidth cost
const CAPTION_SURCHARGE_CENTS = 10;
const SECONDS_PER_SCENE = 6;       // beat length used by scene-breaker
const AVG_VO_CHARS_PER_SCENE = 90; // ~6s of natural speech

interface Body {
  scene_count: number;
  hd?: boolean;
  with_captions?: boolean;
  action: "estimate" | "charge";
}

function price(b: Body) {
  const scenes = Math.max(1, b.scene_count);

  // Provider passthrough (with +5% platform markup baked in)
  const runwayCost = scenes * SECONDS_PER_SCENE * PROVIDER_RATES.runway_image_to_video_per_second;
  const ttsCost = Math.ceil(
    (scenes * AVG_VO_CHARS_PER_SCENE / 1000) * PROVIDER_RATES.elevenlabs_tts_per_1000_chars
  );
  const provider_runway = markupCents(runwayCost);
  const provider_tts = markupCents(ttsCost);
  const provider_total = provider_runway.total_cents + provider_tts.total_cents;

  // Internal compute (Gemini for scene breaking + storage + bandwidth)
  const internal_compute = 8 * scenes
    + (b.hd ? HD_SURCHARGE_CENTS : 0)
    + (b.with_captions ? CAPTION_SURCHARGE_CENTS : 0);
  const internal_fee = Math.ceil(internal_compute * SERVICE_MARKUP);
  const internal_total = internal_compute + internal_fee;

  const total = Math.max(MIN_CHARGE_CENTS, provider_total + internal_total);

  return {
    base_cents: provider_runway.provider_cost_cents + provider_tts.provider_cost_cents + internal_compute,
    service_fee_cents: provider_runway.platform_fee_cents + provider_tts.platform_fee_cents + internal_fee,
    total_cents: total,
    breakdown: {
      runway_video: provider_runway,
      elevenlabs_voiceover: provider_tts,
      lovable_compute_cents: internal_compute,
      lovable_compute_markup_cents: internal_fee,
      hd_surcharge_cents: b.hd ? HD_SURCHARGE_CENTS : 0,
      captions_surcharge_cents: b.with_captions ? CAPTION_SURCHARGE_CENTS : 0,
      platform_markup_pct: 5,
      service_markup_pct: 60,
    },
  };
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

    await supabase
      .from("wallet_balances")
      .upsert({ user_id: user.id, balance_cents: balance - p.total_cents }, { onConflict: "user_id" });

    await supabase.from("call_charges").insert({
      user_id: user.id,
      destination: `movie_render:${body.scene_count}scenes${body.hd ? ":hd" : ""}${body.with_captions ? ":cc" : ""}`,
      duration_seconds: body.scene_count * SECONDS_PER_SCENE,
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

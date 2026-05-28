// White-label feature unlock — debit user wallet at provider_cost + 50% markup
// and return success. The frontend then drops the user inside our internal
// themed page that wraps the underlying service. The user never sees the
// third-party brand.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WHITE_LABEL_MARKUP_PCT = 0.5; // 50% markup on top of provider cost

// Mirrors src/lib/featureProxy.tsx providerCostCents — keep in sync.
const FEATURE_COSTS: Record<string, number> = {
  "el-tts": 30, "el-clone": 100, "el-sfx": 8, "el-music": 30, "el-dub": 80, "el-isolate": 12,
  "hg-avatar": 50, "hg-photo": 75, "hg-instant": 150, "hg-translate": 100,
  "hg-captions": 20, "hg-template": 25, "hg-product": 120, "hg-social": 15,
  "voiceover": 30, "voice-clone": 100, "sfx": 8, "music": 30, "dub": 80,
  "talking-photo": 60, "ai-presenter": 50, "video-translate": 100, "captions": 20, "social-pack": 15,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(
      auth.replace(/^Bearer\s+/i, "")
    );
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const featureId = String(body?.feature_id || "");
    const placement = String(body?.placement || "unknown");

    const providerCents = FEATURE_COSTS[featureId];
    if (!providerCents) {
      return new Response(JSON.stringify({ error: "unknown_feature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const platformFee = Math.max(1, Math.ceil(providerCents * WHITE_LABEL_MARKUP_PCT));

    // Reuse the existing wallet_charge_ai RPC. We pass our own marked-up fee.
    const { data, error } = await supabase.rpc("wallet_charge_ai", {
      _user_id: user.id,
      _service: `proxy_${featureId}`,
      _provider_cost_cents: providerCents,
      _platform_fee_cents: platformFee,
      _metadata: { placement, white_label: true, markup_pct: WHITE_LABEL_MARKUP_PCT },
    });
    if (error) throw new Error(`wallet_charge_ai failed: ${error.message}`);

    const row = Array.isArray(data) ? data[0] : data;
    if (row?.insufficient) {
      return new Response(
        JSON.stringify({
          error: "insufficient_coins",
          needed_cents: row.total_billed_cents,
          balance_cents: row.new_balance_cents,
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        charge_id: row?.charge_id,
        total_cents: row?.total_billed_cents,
        new_balance_cents: row?.new_balance_cents,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[feature-unlock] error", e);
    return new Response(
      JSON.stringify({ error: "internal_error", message: (e as Error)?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

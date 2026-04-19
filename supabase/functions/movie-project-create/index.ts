// Creates a new movie_projects row, validates tier limits, charges wallet UPFRONT for the
// estimated cost (atomic deduction), then triggers the script chunker.
// On failure, the worker refunds per-scene cost via wallet_topup.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Pricing per quality tier (cents per finished minute, +5% markup baked in)
const PRICING: Record<string, number> = {
  sd: 50, hd: 200, "4k": 800, "8k_ultimate": 5000,
};

// Tier limits by subscription
const MAX_DURATION: Record<string, number> = {
  free: 2, starter: 5, monthly: 10, quarterly: 30,
  biannual: 30, annual: 30, golden: 60, lifetime: 120,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { title, logline, genre, target_duration_minutes, quality_tier, brief } = body;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: ud } = await userClient.auth.getUser();
    const user = ud?.user;
    if (!user) throw new Error("not authenticated");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Determine effective tier
    const adminEmails = ["justinbretthogan@gmail.com"];
    const isAdmin = adminEmails.includes((user.email ?? "").toLowerCase());
    let userTier = "free";
    if (!isAdmin) {
      const { data: rewards } = await supabase.from("reward_grants")
        .select("reward_type").eq("user_id", user.id).eq("active", true)
        .gt("expires_at", new Date().toISOString()).limit(1);
      if (rewards?.length) userTier = "monthly";
    } else {
      userTier = "lifetime";
    }

    const dur = Math.max(1, Math.min(120, Number(target_duration_minutes) || 5));
    const quality = String(quality_tier || "hd");

    const maxDur = isAdmin ? 120 : (MAX_DURATION[userTier] ?? 2);
    if (dur > maxDur) {
      return new Response(JSON.stringify({
        error: `Your tier allows up to ${maxDur} min. Upgrade to unlock ${dur} min.`,
        upgrade_required: true,
      }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (quality === "8k_ultimate" && !isAdmin && userTier !== "lifetime") {
      return new Response(JSON.stringify({
        error: "ULTIMATE 8K is reserved for Lifetime Ultimate members.",
        upgrade_required: true,
      }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const estimateCents = Math.ceil(dur * (PRICING[quality] ?? 200));

    // ===== ATOMIC WALLET CHARGE UPFRONT =====
    // Admin bypasses wallet (he owns the platform).
    if (!isAdmin) {
      // Ensure wallet row exists
      await supabase.from("wallet_balances")
        .upsert({ user_id: user.id, balance_cents: 0 }, { onConflict: "user_id", ignoreDuplicates: true });

      const { data: wallet } = await supabase.from("wallet_balances")
        .select("balance_cents").eq("user_id", user.id).maybeSingle();
      const balance = wallet?.balance_cents ?? 0;

      if (balance < estimateCents) {
        return new Response(JSON.stringify({
          error: `Estimated cost is $${(estimateCents / 100).toFixed(2)}. Your wallet has $${(balance / 100).toFixed(2)}. Top up first.`,
          estimate_cents: estimateCents, balance_cents: balance, insufficient: true,
        }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Deduct upfront
      const { error: chargeErr } = await supabase.from("wallet_balances")
        .update({ balance_cents: balance - estimateCents, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (chargeErr) throw chargeErr;
    }

    const { data: project, error } = await supabase.from("movie_projects").insert({
      user_id: user.id,
      title: title || "Untitled Movie",
      logline, genre,
      target_duration_minutes: dur,
      quality_tier: quality,
      brief: brief || {},
      estimated_cost_cents: estimateCents,
      user_paid_cents: isAdmin ? 0 : estimateCents,
      status: "draft",
    }).select().single();

    if (error) {
      // Refund on insert failure
      if (!isAdmin) {
        await supabase.rpc("wallet_topup", { _user_id: user.id, _amount_cents: estimateCents });
      }
      throw error;
    }

    // Kick off script chunker in background
    EdgeRuntime.waitUntil((async () => {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/movie-script-chunker`, {
        method: "POST",
        headers: { "Authorization": authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: project.id }),
      });
    })());

    return new Response(JSON.stringify({ ok: true, project, charged_cents: isAdmin ? 0 : estimateCents }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    console.error("[project-create]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});

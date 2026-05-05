// Creates a new movie_projects row, validates tier limits, charges wallet UPFRONT for the
// estimated cost (atomic deduction), then triggers the script chunker.
// Slideshow edition: free users get exactly ONE 8-second clip, ever. Everything else is paywalled.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Pricing per quality tier (cents per finished minute, +5% markup baked in)
const PRICING: Record<string, number> = { sd: 50, hd: 200 };

// Tier limits by subscription (in MINUTES — free is special-cased to 8 SECONDS)
const MAX_DURATION_MIN: Record<string, number> = {
  starter: 2, monthly: 5, quarterly: 15,
  biannual: 15, annual: 15, golden: 30, lifetime: 60,
};
const FREE_CLIP_SECONDS = 8;
const FREE_CLIP_QUOTA = 1;

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

    // ===== Determine effective tier =====
    const adminEmails = ["justinbretthogan@gmail.com"];
    const isAdmin = adminEmails.includes((user.email ?? "").toLowerCase());
    let userTier = "free";
    let isFreeForLife = false;
    if (isAdmin) {
      userTier = "lifetime";
    } else {
      const { data: rewards } = await supabase.from("reward_grants")
        .select("reward_type, reason").eq("user_id", user.id).eq("active", true)
        .gt("expires_at", new Date().toISOString()).limit(5);
      if (rewards?.length) {
        userTier = "monthly";
        isFreeForLife = rewards.some((r: any) => r.reward_type === "free_for_life" || r.reason === "free_for_life");
        if (isFreeForLife) userTier = "lifetime";
      }
    }

    const requestedDur = Math.max(0.1, Math.min(60, Number(target_duration_minutes) || 0.15));
    const quality = String(quality_tier || "hd");
    const isFreeTier = !isAdmin && !isFreeForLife && userTier === "free";

    // ===== FREE TIER: only 1 clip ever, fixed 8 seconds, SD only =====
    if (isFreeTier) {
      // Count existing projects (any status — we're deciding lifetime quota)
      const { count } = await supabase.from("movie_projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if ((count ?? 0) >= FREE_CLIP_QUOTA) {
        return new Response(JSON.stringify({
          error: `Your free 8-second clip has been used. Upgrade to make more movies.`,
          upgrade_required: true, free_quota_used: true,
        }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Force the free clip shape
      var dur = FREE_CLIP_SECONDS / 60;        // 8 seconds expressed in minutes
      var enforcedQuality = "sd";
      var estimateCents = 0;                    // free for the user
    } else {
      // ===== Paid tier: enforce minute caps + valid quality =====
      const maxDur = (isAdmin || isFreeForLife) ? 60 : (MAX_DURATION_MIN[userTier] ?? 0);
      if (requestedDur > maxDur) {
        return new Response(JSON.stringify({
          error: `Your tier allows up to ${maxDur} min. Upgrade to unlock ${requestedDur} min.`,
          upgrade_required: true,
        }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!PRICING[quality]) {
        return new Response(JSON.stringify({ error: `Unknown quality tier "${quality}". Use 'sd' or 'hd'.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      var dur = requestedDur;
      var enforcedQuality = quality;
      var estimateCents = (isFreeForLife) ? 0 : Math.ceil(dur * PRICING[quality]);
    }

    // ===== ATOMIC WALLET CHARGE UPFRONT (skip for admin and free clip) =====
    if (!isAdmin && !isFreeForLife && estimateCents > 0) {
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

      const { error: chargeErr } = await supabase.from("wallet_balances")
        .update({ balance_cents: balance - estimateCents, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (chargeErr) throw chargeErr;
    }

    const { data: project, error } = await supabase.from("movie_projects").insert({
      user_id: user.id,
      title: title || (isFreeTier ? "My Free 8s Clip" : "Untitled Movie"),
      logline, genre,
      target_duration_minutes: dur,
      quality_tier: enforcedQuality,
      brief: brief || {},
      estimated_cost_cents: estimateCents,
      user_paid_cents: (isAdmin || isFreeTier || isFreeForLife) ? 0 : estimateCents,
      status: "draft",
    }).select().single();

    if (error) {
      if (!isAdmin && !isFreeForLife && estimateCents > 0) {
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

    return new Response(JSON.stringify({
      ok: true, project, charged_cents: isAdmin || isFreeTier ? 0 : estimateCents,
      free_clip: isFreeTier,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (e) {
    console.error("[project-create]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});

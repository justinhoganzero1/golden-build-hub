import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { chargeAI, getUserFromRequest, InsufficientCoinsError, insufficientCoinsResponse } from "../_shared/wallet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ABSOLUTE_BLOCK: RegExp[] = [
  /\b(child|kid|minor|underage|teen|preteen|loli|shota|toddler|baby)\b.{0,40}\b(nude|naked|sex|sexual|erotic|porn|nsfw|topless|undress|strip|lingerie|provocative|seductive)\b/i,
  /\b(nude|naked|sex|sexual|erotic|porn|nsfw|topless|undress|strip)\b.{0,40}\b(child|kid|minor|underage|teen|preteen|loli|shota|toddler|baby)\b/i,
  /\b(bestiality|zoophilia)\b/i,
  /\b(how to)\b.{0,30}\b(kill myself|commit suicide|hang myself|overdose|end my life)\b/i,
  /\b(how to|build|make|construct)\b.{0,30}\b(bomb|explosive|ied|pipe bomb|nerve agent|sarin|ricin|anthrax)\b/i,
];
const M_RATED = /\b(nude|naked|nsfw|explicit|sexual|erotic|xxx|porn|hentai|topless|lingerie|underwear|seductive|provocative|undress|strip|fetish|orgasm|masturbat)\b/i;

const IMAGE_MODELS: Record<string, { model: string; cost: number }> = {
  fast:    { model: "google/gemini-3.1-flash-image-preview", cost: 1 },
  premium: { model: "google/gemini-3-pro-image-preview",     cost: 3 },
};

const FLASH = "google/gemini-3.1-flash-image-preview";
const PRO   = "google/gemini-3-pro-image-preview";

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Sign up required to generate images." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      prompt,
      ownerBypass,
      inputImage,
      tier,
      maxAttempts: rawMaxAttempts,
      modelChain: rawModelChain,
      useCache = true,
      libraryFallback = true,
    } = body;

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const pat of ABSOLUTE_BLOCK) {
      if (pat.test(prompt)) {
        return new Response(JSON.stringify({
          error: "This content is not allowed under Google Play and global safety rules.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    if (!ownerBypass && M_RATED.test(prompt)) {
      return new Response(JSON.stringify({ error: "Content must be M-rated. Explicit descriptions are not allowed." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auto-pick tier
    const chosenTier: "fast" | "premium" =
      tier === "premium" ? "premium" :
      tier === "fast"    ? "fast"    :
      (prompt.length > 220 || /logo|brand|hero|poster|cinematic|8k|magazine cover|product shot/i.test(prompt))
        ? "premium" : "fast";
    const { model: defaultModel, cost: IMAGE_GEN_COST_CENTS } = IMAGE_MODELS[chosenTier];

    // Build configurable model chain (default: chosen tier first, then alternate, then flash)
    // maxAttempts caps total attempts across all models (1 attempt = one HTTP call).
    const maxAttempts = Math.min(Math.max(parseInt(rawMaxAttempts) || 9, 1), 100);
    let modelChain: string[] = Array.isArray(rawModelChain) && rawModelChain.length > 0
      ? rawModelChain.filter((m: any) => typeof m === "string" && m.length > 0)
      : (chosenTier === "premium" ? [PRO, FLASH, FLASH] : [FLASH, PRO, FLASH]);
    // Repeat the chain to fill maxAttempts so order stays controllable.
    const fullChain: string[] = [];
    for (let i = 0; i < maxAttempts; i++) fullChain.push(modelChain[i % modelChain.length]);

    // ── Service-role admin client for cache + job log (bypasses RLS) ──
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const promptHash = await sha256(prompt);

    // ── Cache: reuse a previous successful generation for the same user+prompt ──
    if (useCache) {
      const { data: cached } = await admin
        .from("image_generation_jobs")
        .select("id, result_url, last_model")
        .eq("user_id", user.id)
        .eq("prompt_hash", promptHash)
        .eq("status", "completed")
        .not("result_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cached?.result_url) {
        return new Response(JSON.stringify({
          text: "",
          images: [{ image_url: { url: cached.result_url } }],
          tier: chosenTier,
          model: cached.last_model || defaultModel,
          cost_cents: 0,
          cached: true,
          job_id: cached.id,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ── Create persistent job row ──
    const { data: job } = await admin
      .from("image_generation_jobs")
      .insert({
        user_id: user.id,
        prompt,
        prompt_hash: promptHash,
        tier: chosenTier,
        model_chain: fullChain,
        max_attempts: maxAttempts,
        status: "running",
      })
      .select("id")
      .single();
    const jobId = job?.id;

    try {
      await chargeAI(user.id, "image_gen", IMAGE_GEN_COST_CENTS, { has_input_image: !!inputImage, tier: chosenTier });
    } catch (e) {
      if (e instanceof InsufficientCoinsError) {
        if (jobId) await admin.from("image_generation_jobs").update({ status: "failed", error: "insufficient_credits", attempts: 0, completed_at: new Date().toISOString() }).eq("id", jobId);
        return insufficientCoinsResponse(e, corsHeaders);
      }
      throw e;
    }

    const userContent: any = inputImage
      ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: inputImage } }]
      : prompt;

    let lastStatus = 0;
    let lastBody = "";
    let usedModel = defaultModel;
    let images: any[] = [];
    let textOut = "";
    let succeeded = false;
    let attemptsDone = 0;

    for (let i = 0; i < fullChain.length; i++) {
      const model = fullChain[i];
      attemptsDone++;
      try {
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: userContent }],
            modalities: ["image", "text"],
          }),
        });
        if (response.ok) {
          const data = await response.json();
          textOut = data.choices?.[0]?.message?.content || "";
          images = data.choices?.[0]?.message?.images || [];
          const hasImage = Array.isArray(images) && images.length > 0
            && (images[0]?.image_url?.url || images[0]?.url || typeof images[0] === "string");
          if (hasImage) {
            usedModel = model;
            succeeded = true;
            break;
          }
          lastStatus = 502;
          lastBody = "no image in response";
        } else {
          lastStatus = response.status;
          lastBody = await response.text().catch(() => "");
          if (response.status === 402) break; // credits exhausted
        }
      } catch (err) {
        lastStatus = 0;
        lastBody = err instanceof Error ? err.message : String(err);
      }
      // Exponential backoff capped at 5s; live status update for long jobs.
      const delay = Math.min(400 * Math.pow(2, Math.min(i, 4)), 5000);
      if (jobId && (i % 3 === 2)) {
        await admin.from("image_generation_jobs").update({ attempts: attemptsDone, last_model: model, error: lastBody?.slice(0, 500) }).eq("id", jobId);
      }
      await sleep(delay);
    }

    if (succeeded) {
      const resultUrl = images[0]?.image_url?.url || images[0]?.url || (typeof images[0] === "string" ? images[0] : null);
      if (jobId) {
        await admin.from("image_generation_jobs").update({
          status: "completed",
          attempts: attemptsDone,
          last_model: usedModel,
          result_url: resultUrl,
          completed_at: new Date().toISOString(),
        }).eq("id", jobId);
      }
      return new Response(JSON.stringify({
        text: textOut, images, tier: chosenTier, model: usedModel,
        cost_cents: IMAGE_GEN_COST_CENTS, attempts: attemptsDone, job_id: jobId,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (lastStatus === 402) {
      if (jobId) await admin.from("image_generation_jobs").update({ status: "failed", attempts: attemptsDone, error: "insufficient_credits", completed_at: new Date().toISOString() }).eq("id", jobId);
      return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Library fallback: serve most recent successful image variant ──
    if (libraryFallback) {
      // Try a previous job for the same prompt (any status) first.
      const { data: priorJob } = await admin
        .from("image_generation_jobs")
        .select("id, result_url, last_model")
        .eq("user_id", user.id)
        .eq("prompt_hash", promptHash)
        .eq("status", "completed")
        .not("result_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let fallbackUrl = priorJob?.result_url || null;
      // Otherwise, the user's most recent image from their media library.
      if (!fallbackUrl) {
        const { data: media } = await admin
          .from("user_media")
          .select("url")
          .eq("user_id", user.id)
          .eq("media_type", "image")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        fallbackUrl = media?.url || null;
      }
      if (fallbackUrl) {
        if (jobId) await admin.from("image_generation_jobs").update({
          status: "failed_with_fallback",
          attempts: attemptsDone,
          fallback_used: true,
          result_url: fallbackUrl,
          error: lastBody?.slice(0, 500),
          completed_at: new Date().toISOString(),
        }).eq("id", jobId);
        return new Response(JSON.stringify({
          text: "Showing your most recent saved image while generation recovers.",
          images: [{ image_url: { url: fallbackUrl } }],
          tier: chosenTier,
          model: usedModel,
          cost_cents: 0,
          fallback: true,
          job_id: jobId,
          attempts: attemptsDone,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (jobId) await admin.from("image_generation_jobs").update({
      status: "failed", attempts: attemptsDone, error: lastBody?.slice(0, 500), completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    console.error("Image gen exhausted all fallbacks:", lastStatus, lastBody);
    return new Response(JSON.stringify({ error: "Image generation failed after all fallbacks", detail: lastBody, job_id: jobId }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("image-gen error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

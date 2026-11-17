import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { trialDecision, releaseTrial, paywallResponse, isTrialBlocked } from "../_shared/freeTrial.ts";
import { chargeAI, getUserFromRequest, InsufficientCoinsError, insufficientCoinsResponse } from "../_shared/wallet.ts";
import { OWNER_EMAIL } from "../_shared/requireAuth.ts";
import { wantsTextInImage, parseJsonLoose, cleanTexts, exactTextInstruction, textsMatch } from "./textCheck.ts";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const TEXT_CHECK_MODEL = "google/gemini-3.8-flash";
const TEXT_CHECK_COST_CENTS = 1;

async function askChecker(key: string, content: unknown): Promise<string> {
  const r = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: TEXT_CHECK_MODEL, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) throw new Error(`checker ${r.status}`);
  const d = await r.json();
  return String(d?.choices?.[0]?.message?.content || "");
}

/** Proofreads the words the user wants drawn in the picture (spelling, grammar, punctuation). */
async function proofreadWantedText(key: string, prompt: string): Promise<string[]> {
  const raw = await askChecker(key, `You are a careful proofreader using Australian English. From the picture request below, list the exact words that should be written INSIDE the picture (titles, captions, signs, labels, slogans, names on cards). Correct any spelling, grammar and punctuation mistakes. Keep people's names and brand names as written. If the request does not say which words to show, return an empty list — never invent wording. Reply with JSON only: {"texts": ["..."]}\n\nRequest: ${prompt.slice(0, 2000)}`);
  return cleanTexts(parseJsonLoose<{ texts?: unknown }>(raw)?.texts);
}

/** Reads back every word visible in a generated picture. */
async function readTextInImage(key: string, imageUrl: string): Promise<string[]> {
  const raw = await askChecker(key, [
    { type: "text", text: 'Read every word written in this picture exactly as it is spelled, letter for letter, including mistakes. Reply with JSON only: {"found": ["..."]}' },
    { type: "image_url", image_url: { url: imageUrl } },
  ]);
  return cleanTexts(parseJsonLoose<{ found?: unknown }>(raw)?.found);
}


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

async function ensureLibraryImage(admin: any, opts: {
  userId: string;
  prompt: string;
  promptHash: string;
  url: string;
  jobId?: string | null;
  model?: string | null;
  fallback?: boolean;
}): Promise<string | null> {
  if (!opts.url || opts.fallback) return null;
  try {
    const { data: existing } = await admin
      .from("user_media")
      .select("id")
      .eq("user_id", opts.userId)
      .eq("media_type", "image")
      .eq("source_page", "oracle-image")
      .contains("metadata", { prompt_hash: opts.promptHash })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) return existing.id;

    const cleanTitle = opts.prompt.replace(/\s+/g, " ").trim().slice(0, 60) || "Oracle image";
    const { data, error } = await admin
      .from("user_media")
      .insert({
        user_id: opts.userId,
        media_type: "image",
        title: `Image: ${cleanTitle}`,
        url: opts.url,
        source_page: "oracle-image",
        metadata: {
          kind: "image",
          prompt: opts.prompt,
          prompt_hash: opts.promptHash,
          image_generation_job_id: opts.jobId || null,
          model: opts.model || null,
          saved_by: "image-gen-server",
        },
        is_public: false,
      })
      .select("id")
      .single();
    if (error) {
      console.error("image-gen library save failed:", error.message);
      return null;
    }
    return data?.id || null;
  } catch (err) {
    console.error("image-gen library save unexpected:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Sign up required to generate images." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The M-rated bypass is derived server-side from the authenticated user's
    // identity. A client-supplied `ownerBypass` flag is ignored entirely.
    const ownerBypass = (user.email || "").toLowerCase().trim() === OWNER_EMAIL;

    const body = await req.json();
    const {
      prompt,
      inputImage,
      inputImages,
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
      (prompt.length > 220 || /logo|brand|hero|poster|cinematic|4k|magazine cover|product shot/i.test(prompt))
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
        const libraryId = await ensureLibraryImage(admin, {
          userId: user.id,
          prompt,
          promptHash,
          url: cached.result_url,
          jobId: cached.id,
          model: cached.last_model || defaultModel,
        });
        return new Response(JSON.stringify({
          text: "",
          images: [{ image_url: { url: cached.result_url } }],
          tier: chosenTier,
          model: cached.last_model || defaultModel,
          cost_cents: 0,
          cached: true,
          job_id: cached.id,
          library_id: libraryId,
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

    // Free plan: card-verified 7-day trial of 3 pictures, then the paywall. Paid plans use the wallet.
    const trial = await trialDecision(admin, user.id, "image", ownerBypass);
    if (isTrialBlocked(trial)) {
      if (jobId) await admin.from("image_generation_jobs").update({ status: "failed", error: trial === "card_required" ? "card_required" : "upgrade_required", attempts: 0, completed_at: new Date().toISOString() }).eq("id", jobId);
      return paywallResponse("image", corsHeaders, trial);
    }
    if (trial === "paid") try {
      await chargeAI(user.id, "image_gen", IMAGE_GEN_COST_CENTS, { has_input_image: !!inputImage, tier: chosenTier });
    } catch (e) {
      if (e instanceof InsufficientCoinsError) {
        if (jobId) await admin.from("image_generation_jobs").update({ status: "failed", error: "insufficient_credits", attempts: 0, completed_at: new Date().toISOString() }).eq("id", jobId);
        return insufficientCoinsResponse(e, corsHeaders);
      }
      throw e;
    }

    // Strip any text/words/names from rendered image (no captions, no speech bubble text, no watermarks)
    const NO_TEXT_SUFFIX =
      " — IMPORTANT: do NOT render any text, letters, words, names, captions, signatures, watermarks, logos, labels, speech bubbles with writing, or written language of any kind anywhere in the image. Speech bubbles, signs, and labels must be empty/blank if present.";
    // Words wanted in the picture are proofread first, then pinned exactly; otherwise no text at all
    // (models scramble unrequested lettering). Trial pictures skip the extra checks to stay free.
    let exactTexts: string[] = [];
    if (trial !== "trial" && wantsTextInImage(prompt)) {
      try {
        if (trial === "paid") await chargeAI(user.id, "image_text_check", TEXT_CHECK_COST_CENTS, { step: "proofread", job_id: jobId });
        exactTexts = await proofreadWantedText(LOVABLE_API_KEY, prompt);
      } catch (e) { console.warn("image-gen proofread skipped:", e instanceof Error ? e.message : e); }
    }
    const cleanPrompt = exactTexts.length
      ? prompt + exactTextInstruction(exactTexts)
      : /no text|no words|no letters|no watermark/i.test(prompt)
        ? prompt
        : prompt + NO_TEXT_SUFFIX;
    // Accept one image (inputImage) or several (inputImages) as visual references.
    const refImages: string[] = Array.isArray(inputImages)
      ? inputImages.filter((u: unknown) => typeof u === "string" && u).slice(0, 4)
      : (inputImage ? [inputImage] : []);
    const userContent: any = refImages.length
      ? [{ type: "text", text: cleanPrompt }, ...refImages.map((u) => ({ type: "image_url", image_url: { url: u } }))]
      : cleanPrompt;

    let lastStatus = 0;
    let lastBody = "";
    let usedModel = defaultModel;
    let images: any[] = [];
    let textOut = "";
    let succeeded = false;
    let attemptsDone = 0;

    for (let i = 0; i < fullChain.length; i++) {
      if (trial === "trial" && i >= 3) break; // keep trial pictures cheap
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

    let textCheck: { checked: boolean; ok?: boolean; expected?: string[]; found?: string[]; fixed?: boolean } = { checked: false };
    if (succeeded && exactTexts.length) {
      const firstUrl = images[0]?.image_url?.url || images[0]?.url || (typeof images[0] === "string" ? images[0] : null);
      try {
        if (firstUrl) {
          if (trial === "paid") await chargeAI(user.id, "image_text_check", TEXT_CHECK_COST_CENTS, { step: "read_back", job_id: jobId });
          let found = await readTextInImage(LOVABLE_API_KEY, firstUrl);
          let ok = textsMatch(exactTexts, found);
          let fixed = false;
          if (!ok) {
            // One correction pass: edit the same picture so only the lettering changes.
            if (trial === "paid") await chargeAI(user.id, "image_gen", IMAGE_GEN_COST_CENTS, { step: "text_fix", job_id: jobId, tier: chosenTier });
            const fr = await fetch(GATEWAY_URL, {
              method: "POST",
              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: usedModel,
                messages: [{ role: "user", content: [
                  { type: "text", text: `Edit this image. Fix the lettering so the only words shown read exactly ${exactTexts.map((t) => `"${t}"`).join(", ")} — correct spelling letter for letter, correct grammar and punctuation, clear legible lettering. Keep everything else in the picture identical.` },
                  { type: "image_url", image_url: { url: firstUrl } },
                ] }],
                modalities: ["image", "text"],
              }),
            });
            if (fr.ok) {
              const fd = await fr.json();
              const fixedImages = fd?.choices?.[0]?.message?.images || [];
              const fixedUrl = fixedImages[0]?.image_url?.url || fixedImages[0]?.url;
              if (fixedUrl) {
                if (trial === "paid") await chargeAI(user.id, "image_text_check", TEXT_CHECK_COST_CENTS, { step: "read_back_fix", job_id: jobId });
                const fixedFound = await readTextInImage(LOVABLE_API_KEY, fixedUrl);
                const fixedOk = textsMatch(exactTexts, fixedFound);
                if (fixedOk || fixedFound.length) { images = fixedImages; found = fixedFound; ok = fixedOk; fixed = true; }
              }
            }
          }
          textCheck = { checked: true, ok, expected: exactTexts, found, fixed };
        }
      } catch (e) {
        console.warn("image-gen text check incomplete:", e instanceof Error ? e.message : e);
        textCheck = { checked: false, expected: exactTexts };
      }
    }

    if (succeeded) {
      const resultUrl = images[0]?.image_url?.url || images[0]?.url || (typeof images[0] === "string" ? images[0] : null);
      const libraryId = resultUrl ? await ensureLibraryImage(admin, {
        userId: user.id,
        prompt,
        promptHash,
        url: resultUrl,
        jobId,
        model: usedModel,
      }) : null;
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
        library_id: libraryId, text_check: textCheck,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (trial === "trial") await releaseTrial(admin, user.id, "image");

    const creditsExhausted = lastStatus === 402;
    if (creditsExhausted && jobId) {
      await admin.from("image_generation_jobs").update({ status: "failed", attempts: attemptsDone, error: "insufficient_credits", completed_at: new Date().toISOString() }).eq("id", jobId);
    }

    // ── Library fallback: serve most recent successful image variant (also on 402) ──
    if (libraryFallback || creditsExhausted) {
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
      let fallbackLibraryId: string | null = null;
      if (fallbackUrl) {
        fallbackLibraryId = await ensureLibraryImage(admin, {
          userId: user.id,
          prompt,
          promptHash,
          url: fallbackUrl,
          jobId: priorJob?.id,
          model: priorJob?.last_model || usedModel,
        });
      }
      // Otherwise, the user's most recent image from their media library.
      if (!fallbackUrl) {
        const { data: media } = await admin
          .from("user_media")
          .select("id, url")
          .eq("user_id", user.id)
          .eq("media_type", "image")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        fallbackUrl = media?.url || null;
        fallbackLibraryId = media?.id || null;
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
          library_id: fallbackLibraryId,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (jobId) await admin.from("image_generation_jobs").update({
      status: "failed", attempts: attemptsDone, error: lastBody?.slice(0, 500), completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    console.error("Image gen exhausted all fallbacks:", lastStatus, lastBody);
    if (creditsExhausted) {
      return new Response(JSON.stringify({
        error: "AI credits exhausted. Please try again later or top up credits.",
        code: "credits_exhausted",
        fallback: true,
        images: [],
        job_id: jobId,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
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

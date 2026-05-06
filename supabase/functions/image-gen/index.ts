import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

// Multi-agent image router (same Lovable AI Gateway, different specialist):
//   - "fast"    → google/gemini-3.1-flash-image-preview (Nano Banana 2) ~1¢/image
//   - "premium" → google/gemini-3-pro-image-preview                     ~3¢/image
const IMAGE_MODELS: Record<string, { model: string; cost: number }> = {
  fast:    { model: "google/gemini-3.1-flash-image-preview", cost: 1 },
  premium: { model: "google/gemini-3-pro-image-preview",     cost: 3 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return new Response(JSON.stringify({ error: "Sign up required to generate images." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt, ownerBypass, inputImage, tier } = await req.json();
    // Auto-pick tier: caller can force "fast"/"premium". Otherwise short prompts → fast, long/brand → premium.
    const chosenTier: "fast" | "premium" =
      tier === "premium" ? "premium" :
      tier === "fast"    ? "fast"    :
      (typeof prompt === "string" && (prompt.length > 220 || /logo|brand|hero|poster|cinematic|8k|magazine cover|product shot/i.test(prompt)))
        ? "premium" : "fast";
    const { model: IMAGE_MODEL, cost: IMAGE_GEN_COST_CENTS } = IMAGE_MODELS[chosenTier];
    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const pat of ABSOLUTE_BLOCK) {
      if (pat.test(prompt)) {
        return new Response(JSON.stringify({
          error: "This content is not allowed under Google Play and global safety rules.",
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    if (!ownerBypass && M_RATED.test(prompt)) {
      return new Response(JSON.stringify({ error: "Content must be M-rated. Explicit descriptions are not allowed." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    try {
      await chargeAI(user.id, "image_gen", IMAGE_GEN_COST_CENTS, { has_input_image: !!inputImage, tier: chosenTier });
    } catch (e) {
      if (e instanceof InsufficientCoinsError) return insufficientCoinsResponse(e, corsHeaders);
      throw e;
    }

    let userContent: any;
    if (inputImage) {
      userContent = [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: inputImage } },
      ];
    } else {
      userContent = prompt;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: userContent }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please wait a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Image gen error:", response.status, t);
      return new Response(JSON.stringify({ error: "Image generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    const images = data.choices?.[0]?.message?.images || [];

    return new Response(JSON.stringify({ text, images }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("image-gen error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

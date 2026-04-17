import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { script, intent, targetDurationSec = 60 } = await req.json();
    const sceneSeconds = 6; // FIXED: every clip is 6 seconds, 8K quality
    if (!script || typeof script !== "string") {
      return new Response(JSON.stringify({ error: "script is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const targetSceneCount = Math.max(2, Math.min(60, Math.round(targetDurationSec / sceneSeconds)));

    const system = `You are a film director + audio designer. Break the user's script and intent into ${targetSceneCount} cinematic scenes for a movie.
Each scene gets ONE 8K photoreal photo, one short caption, and a narration line spoken aloud during the 6-second clip.
Keep visual + character continuity (same characters, outfits, lighting where appropriate).
Photo prompts must be M-rated, vivid, photoreal 8K, with explicit subject + setting + lighting + camera + mood. No nudity / explicit content.
Motion hints: pick one of pan-left, pan-right, zoom-in, zoom-out, ken-burns, static.
ALWAYS set duration_sec to 6.

AUDIO RULES:
- "narration": 1-2 sentences (~12-22 words) that fit naturally in 6 seconds. This is what the audience HEARS during the scene. May be narrator voice-over OR a character speaking — match the moment.
- "speaker": who is talking. Use "narrator" for omniscient narration, or the character name (e.g. "Maya", "the old man"). Be consistent across scenes for the same character.
- "voice_style": pick one of "narrator-male-warm", "narrator-female-warm", "male-young", "male-deep", "female-young", "female-mature", "child", "elder-male", "elder-female", "villain", "hero" — match the speaker's identity consistently across scenes.
- "sfx_hint": 2-6 word ambience description (e.g. "desert wind", "city traffic", "ocean waves") — optional but helpful.`;

    const user = `SCRIPT:\n${script}\n\nUSER INTENT / DIRECTION:\n${intent || "(none)"}\n\nReturn ${targetSceneCount} scenes.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [{
          type: "function",
          function: {
            name: "build_scenes",
            description: "Return the scene breakdown",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                scenes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      caption: { type: "string", description: "Short on-screen caption" },
                      photo_prompt: { type: "string", description: "Photo generation prompt" },
                      motion: { type: "string", enum: ["pan-left", "pan-right", "zoom-in", "zoom-out", "ken-burns", "static"] },
                      duration_sec: { type: "number" },
                      narration: { type: "string", description: "1-2 sentence spoken line for this 6s clip" },
                      speaker: { type: "string", description: "narrator OR character name (consistent across scenes)" },
                      voice_style: { type: "string", enum: ["narrator-male-warm","narrator-female-warm","male-young","male-deep","female-young","female-mature","child","elder-male","elder-female","villain","hero"] },
                      sfx_hint: { type: "string", description: "Short ambience description" },
                    },
                    required: ["caption", "photo_prompt", "motion", "duration_sec", "narration", "speaker", "voice_style"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["title", "scenes"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "build_scenes" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await resp.text();
      console.error("scene-gen err", resp.status, t);
      return new Response(JSON.stringify({ error: "Scene planning failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments ? JSON.parse(call.function.arguments) : null;
    if (!args?.scenes?.length) {
      return new Response(JSON.stringify({ error: "No scenes returned" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("script-to-scenes error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

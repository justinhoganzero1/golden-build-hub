import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { script, intent, targetDurationSec = 60, sceneSeconds = 6 } = await req.json();
    if (!script || typeof script !== "string") {
      return new Response(JSON.stringify({ error: "script is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const targetSceneCount = Math.max(2, Math.min(60, Math.round(targetDurationSec / sceneSeconds)));

    const system = `You are a film director. Break the user's script and intent into ${targetSceneCount} cinematic scenes for a movie.
Each scene gets ONE photo and one short caption. Keep visual continuity (same characters, outfits, lighting where appropriate).
Photo prompts must be M-rated, vivid, photoreal, with explicit subject + setting + lighting + camera + mood. No nudity / explicit content.
Motion hints: pick one of pan-left, pan-right, zoom-in, zoom-out, ken-burns, static.
Durations sum to roughly ${targetDurationSec} seconds.`;

    const user = `SCRIPT:\n${script}\n\nUSER INTENT / DIRECTION:\n${intent || "(none)"}\n\nReturn ${targetSceneCount} scenes.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
                      caption: { type: "string", description: "1-sentence on-screen caption / narration" },
                      photo_prompt: { type: "string", description: "Photo generation prompt" },
                      motion: { type: "string", enum: ["pan-left", "pan-right", "zoom-in", "zoom-out", "ken-burns", "static"] },
                      duration_sec: { type: "number" },
                    },
                    required: ["caption", "photo_prompt", "motion", "duration_sec"],
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

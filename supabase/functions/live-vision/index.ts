import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image, mode } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({ error: "image is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = mode === "text"
      ? "You are an OCR expert. Extract and return ALL text visible in this image. Format it clearly. If no text is found, say 'No text detected.'"
      : mode === "objects"
      ? "You are a computer vision expert. List every distinct object you can identify in this image. Be specific and detailed. Format as a numbered list."
      : mode === "parking"
      ? "You are a driving assistant looking for parking. Scan the image for: empty parking spaces, parking signs, time limits, parking restrictions, parking meters, loading zones, no-parking signs, accessible spots. Be VERY concise (max 2 short sentences). If you spot an empty space, say so directly. If parking is restricted, warn clearly. If nothing relevant is visible, just say 'No parking visible.'"
      : mode === "driving"
      ? "You are a driving co-pilot watching the road. Be VERY concise (max 1-2 short sentences). Only mention things the driver MUST know: hazards, pedestrians, red lights, stop signs, lane changes, turns, exits, road signs with text, sudden obstacles. If the road is clear and uneventful, just say 'Road clear.' Never describe scenery, sky, or unimportant details."
      : "You are an AI scene analyst. Describe what you see in this image in detail. Include: objects, people, text, colors, setting, mood, and any notable details. Be concise but thorough.";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [
            { type: "text", text: mode === "text" ? "Read all text in this image." : mode === "objects" ? "Identify all objects." : "Analyze this scene." },
            { type: "image_url", image_url: { url: image } },
          ]},
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please wait." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Vision error:", response.status, t);
      return new Response(JSON.stringify({ error: "Vision analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "No analysis available.";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("live-vision error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

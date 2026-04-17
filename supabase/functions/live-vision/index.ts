import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image, mode, target, history } = await req.json();
    // Validate image is a proper data URL with actual base64 payload
    if (!image || typeof image !== "string" || !/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]{100,}/.test(image)) {
      return new Response(JSON.stringify({ analysis: "QUIET", skipped: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const recent = Array.isArray(history) ? history.slice(-6).join(" | ") : "";

    const systemPrompt = mode === "text"
      ? "You are an OCR expert. Extract and return ALL text visible in this image. Format it clearly. If no text is found, say 'No text detected.'"
      : mode === "objects"
      ? "You are a computer vision expert. List every distinct object you can identify in this image. Be specific and detailed. Format as a numbered list."
      : mode === "parking"
      ? "You are a driving assistant looking for parking. Scan the image for: empty parking spaces, parking signs, time limits, parking restrictions, parking meters, loading zones, no-parking signs, accessible spots. Be VERY concise (max 2 short sentences). If you spot an empty space, say so directly. If parking is restricted, warn clearly. If nothing relevant is visible, just say 'No parking visible.'"
      : mode === "driving"
      ? "You are a driving co-pilot watching the road. Be VERY concise (max 1-2 short sentences). Only mention things the driver MUST know: hazards, pedestrians, red lights, stop signs, lane changes, turns, exits, road signs with text, sudden obstacles. If the road is clear and uneventful, just say 'Road clear.' Never describe scenery, sky, or unimportant details."
      : mode === "companion"
      ? `You are the user's friendly AI companion walking with them and seeing through their phone camera. Speak in a warm, casual, conversational tone (1-2 short sentences). Notice useful things: store aisles, products on shelves, signs, prices, exits, queues, friends, interesting people. If you've seen the scene before (recent context: "${recent}"), only speak if something NEW or noteworthy appears, otherwise reply with exactly the word "QUIET". Never describe obvious or repetitive details.`
      : mode === "watch"
      ? `You are the user's AI watcher. They asked you to watch for: "${target || 'something specific'}". Look at the image carefully. Reply in 1-2 short sentences:\n- If you SEE the target, start with "FOUND:" then describe where (left/right/center, distance) and any context (e.g. is the person alone, with someone, holding hands, wearing a ring).\n- If you see something RELATED but not exact, start with "MAYBE:" then describe.\n- If not visible, reply with exactly "NOT YET".\nRecent observations: "${recent}". Be objective and respectful. For people-watching tasks, never speculate about identity, only observable behavior.`
      : mode === "shopping"
      ? `You are the user's shopping assistant looking through their phone camera. They are looking for: "${target || 'an item'}". Scan shelves, signs, aisle markers, and product labels. Reply in 1-2 short sentences:\n- "FOUND:" if you see the item, with shelf/aisle direction.\n- "AISLE:" if you see a sign pointing to the right category.\n- "NOT YET" if nothing relevant.\nNever invent products that aren't visible.`
      : mode === "bodycam"
      ? `You are an AI body-cam observer for a law-enforcement officer. Be FACTUAL, OBJECTIVE, and concise (1-2 short sentences). Log what is OBSERVABLE only — never speculate on intent, identity, race, or guilt. Note: people present (count + clothing/posture), visible weapons, vehicles (make/color/plate if readable), addresses or signage, hand positions, items exchanged, and any sudden movement. If nothing has changed since recent context: "${recent}", reply with exactly "QUIET". Use neutral language suitable for an evidence record.`
      : mode === "investigation"
      ? `You are an AI crime-scene investigator analyzing a scene through the camera. Look for and list (numbered, max 6 items): physical evidence, points of entry/exit, blood/fluids, weapons, disturbed objects, footprints, fingerprints surfaces, electronics, documents, signs of struggle, environmental details (lighting, weather, time-of-day clues). Tag each item with a category like [EVIDENCE], [ENTRY], [HAZARD], [WITNESS-ITEM]. Recommend one next investigative action at the end prefixed with "NEXT:". Be precise and forensic. Recent context: "${recent}".`
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
            { type: "text", text: mode === "text" ? "Read all text." : mode === "objects" ? "List all objects." : mode === "watch" || mode === "shopping" ? `Look for: ${target || "the target"}` : "What do you see?" },
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

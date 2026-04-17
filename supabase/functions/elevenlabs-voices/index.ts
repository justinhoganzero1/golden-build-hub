const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ElevenLabs API key not configured", voices: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100", {
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("ElevenLabs voices error:", err);
      return new Response(JSON.stringify({ error: "Failed to load voices", details: err, voices: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const voices = (data.voices || []).map((v: Record<string, unknown>) => {
      const labels = (v.labels || {}) as Record<string, string>;
      return {
        id: v.voice_id,
        name: v.name,
        category: v.category || "premade",
        gender: labels.gender || "neutral",
        accent: labels.accent || "",
        age: labels.age || "",
        description: labels.description || labels.descriptive || "",
        use_case: labels.use_case || "",
        preview_url: v.preview_url || null,
      };
    });

    return new Response(JSON.stringify({ voices }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("voices error:", error);
    return new Response(JSON.stringify({ error: "Internal server error", voices: [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

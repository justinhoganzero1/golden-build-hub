const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: "ElevenLabs API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { text, voiceId, settings, modelId } = body || {};
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default to "Bill" — old, deep, trustworthy documentary narrator
    // (Ancient Aliens-style: gravelly, mysterious, authoritative)
    const selectedVoice = voiceId || "pqHfZKP75CvOlQylNhV4";
    // Multilingual v2 = highest quality, most natural human prosody
    const selectedModel = modelId || settings?.model_id || "eleven_multilingual_v2";
    const normalizedText = text.replace(/\s{3,}/g, "  ").trim();

    // Tuned for cinematic documentary narration — slow, weighty, mysterious
    const voice_settings = {
      stability: settings?.stability ?? 0.78,          // very steady, deliberate
      similarity_boost: settings?.similarity_boost ?? 0.92,
      style: settings?.style ?? 0.35,                  // dramatic gravitas
      use_speaker_boost: settings?.use_speaker_boost ?? true,
      speed: settings?.speed ?? 0.78,                  // slow, weighty pacing
    };

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}/stream?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: normalizedText.substring(0, 5000),
          model_id: selectedModel,
          voice_settings,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("ElevenLabs error:", err);
      return new Response(JSON.stringify({ error: "TTS generation failed", details: err }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!response.body) {
      return new Response(JSON.stringify({ error: "No audio stream" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("TTS error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

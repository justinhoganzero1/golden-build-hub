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
      // Graceful fallback signal — client will use browser TTS instead of crashing
      return new Response(
        JSON.stringify({ error: "TTS_UNAVAILABLE", fallback: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const { text, voiceId, settings, modelId } = body || {};
    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "TEXT_REQUIRED", fallback: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default to "Sarah" — most popular/downloaded female voice on ElevenLabs
    // (warm, professional, soft American accent)
    const selectedVoice = voiceId || "EXAVITQu4vr4xnSDxMaL";
    const selectedModel = modelId || settings?.model_id || "eleven_multilingual_v2";
    const normalizedText = text.replace(/\s{3,}/g, "  ").trim();

    const voice_settings = {
      stability: settings?.stability ?? 0.78,
      similarity_boost: settings?.similarity_boost ?? 0.92,
      style: settings?.style ?? 0.35,
      use_speaker_boost: settings?.use_speaker_boost ?? true,
      speed: settings?.speed ?? 0.78,
    };

    let response: Response;
    try {
      response = await fetch(
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
    } catch (netErr) {
      console.error("ElevenLabs network error:", netErr);
      return new Response(
        JSON.stringify({ error: "NETWORK_ERROR", fallback: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const err = await response.text();
      console.error("ElevenLabs error:", response.status, err);
      // Always return a soft fallback — never crash the client
      return new Response(
        JSON.stringify({ error: "TTS_FAILED", status: response.status, fallback: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.body) {
      return new Response(
        JSON.stringify({ error: "NO_AUDIO", fallback: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", fallback: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

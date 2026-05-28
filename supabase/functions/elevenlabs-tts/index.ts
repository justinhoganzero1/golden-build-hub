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
    const { text, voiceId, settings, modelId, fast, outputFormat } = body || {};
    if (!text || typeof text !== "string") {
      return new Response(
        JSON.stringify({ error: "TEXT_REQUIRED", fallback: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default to "Sarah" — most popular/downloaded female voice on ElevenLabs
    const selectedVoice = voiceId || "EXAVITQu4vr4xnSDxMaL";
    // QUALITY-FIRST: multilingual_v2 sounds human; flash sounds robotic.
    // Only use flash when caller explicitly opts in AND quality isn't critical.
    const selectedModel =
      modelId ||
      settings?.model_id ||
      (fast ? "eleven_turbo_v2_5" : "eleven_multilingual_v2");
    // Higher quality MP3 by default — 128kbps is a tiny bandwidth cost for
    // a massive quality improvement over 32kbps (which sounds compressed/robotic).
    const selectedFormat = outputFormat || "mp3_44100_128";
    // Cadence helper: insert natural micro-pauses so long, flat sentences
    // breathe like a real person. ElevenLabs honours "..." and " — " as pauses.
    const humanize = (raw: string) => {
      let t = raw.replace(/\s{3,}/g, "  ").trim();
      // Soft pause after sentence-ending punctuation when the next char is a capital
      t = t.replace(/([.!?])\s+(?=[A-Z])/g, "$1 ");
      // Add a tiny breath before conjunctions inside long clauses
      t = t.replace(/,\s+(but|and|so|because|though|however)\s/gi, ", $1 ");
      // Tighten double spaces
      t = t.replace(/[ \t]{2,}/g, " ");
      return t;
    };
    const normalizedText = humanize(text);

    // Most natural human-cadence settings:
    //  - stability 0.42  → enough variance for emotion, not jittery
    //  - similarity 0.85 → keeps the voice identity locked in
    //  - style 0.35      → real inflection, no flat "robot read" and no moan
    //  - speed 0.97      → a hair under 1.0 = warmer, more thoughtful pace
    const voice_settings = {
      stability: settings?.stability ?? 0.42,
      similarity_boost: settings?.similarity_boost ?? 0.85,
      style: settings?.style ?? 0.35,
      use_speaker_boost: settings?.use_speaker_boost ?? true,
      speed: settings?.speed ?? 0.97,
    };

    // optimize_streaming_latency=1 keeps low latency but avoids the
    // quality degradation that 2-4 introduce (that's the "robot" sound).
    let response: Response;
    try {
      response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}/stream?output_format=${selectedFormat}&optimize_streaming_latency=1`,
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

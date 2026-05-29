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
      return new Response(
        JSON.stringify({ error: "TTS_UNAVAILABLE", message: "Voice preview is unavailable because the voice service is not configured." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
        JSON.stringify({ error: "TEXT_REQUIRED", message: "Type some text before previewing a voice." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!voiceId || typeof voiceId !== "string") {
      return new Response(
        JSON.stringify({ error: "VOICE_REQUIRED", message: "Select a voice before previewing." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const selectedVoice = voiceId;
    // QUALITY-FIRST: multilingual_v2 sounds human; flash sounds robotic.
    // Only use flash when caller explicitly opts in AND quality isn't critical.
    const selectedModel =
      modelId ||
      settings?.model_id ||
      (fast ? "eleven_turbo_v2_5" : "eleven_multilingual_v2");
    // Higher quality MP3 by default — 128kbps is a tiny bandwidth cost for
    // a massive quality improvement over 32kbps (which sounds compressed/robotic).
    const selectedFormat = outputFormat || "mp3_44100_128";
    // (humanize + voice settings live below)

    // Cadence helper: insert natural micro-pauses so long, flat sentences
    // breathe like a real person. ElevenLabs honours "..." and " — " as pauses.
    const humanize = (raw: string) => {
      let t = raw.replace(/\s{3,}/g, "  ").trim();
      // Soft pause after sentence-ending punctuation when the next char is a capital
      t = t.replace(/([.!?])\s+(?=[A-Z])/g, "$1 ");
      // Add a tiny breath before conjunctions inside long clauses
      t = t.replace(/,\s+(but|and|so|because|though|however|then)\s/gi, ", $1 ");
      // Soften list commas — they read flat without a breath
      t = t.replace(/,\s+/g, ", ");
      // Slight em-dash pause for parentheticals (real speakers pause here)
      t = t.replace(/\s-\s/g, " — ");
      // Lengthen ellipses so the engine actually pauses
      t = t.replace(/\.{3,}/g, "… ");
      // Tighten double spaces
      t = t.replace(/[ \t]{2,}/g, " ");
      return t;
    };
    const normalizedText = humanize(text);

    // Most natural human-cadence settings (tuned again):
    //  - stability 0.38  → looser, more emotional variation (less flat / less robot)
    //  - similarity 0.88 → still locked to the chosen voice identity
    //  - style 0.42      → real inflection, warmer prosody, no monotone read
    //  - speed 0.88      → slower, warmer, more human cadence
    const voice_settings = {
      stability: settings?.stability ?? 0.38,
      similarity_boost: settings?.similarity_boost ?? 0.88,
      style: settings?.style ?? 0.42,
      use_speaker_boost: settings?.use_speaker_boost ?? true,
      speed: settings?.speed ?? 0.88,
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
        JSON.stringify({ error: "NETWORK_ERROR", message: "Voice preview could not reach the voice service." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.ok) {
      const err = await response.text();
      console.error("ElevenLabs error:", response.status, err);
      let message = "Voice preview failed. No fake fallback was played.";
      try {
        const parsed = JSON.parse(err);
        const detail = parsed?.detail;
        message = detail?.message || parsed?.message || message;
      } catch { /* keep generic message */ }
      return new Response(
        JSON.stringify({ error: "TTS_FAILED", status: response.status, message }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!response.body) {
      return new Response(
        JSON.stringify({ error: "NO_AUDIO", message: "Voice preview returned no audio." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      JSON.stringify({ error: "INTERNAL_ERROR", message: "Voice preview failed inside the voice service." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

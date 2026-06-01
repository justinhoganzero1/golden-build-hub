// Clone a voice on ElevenLabs from uploaded audio samples.
// Accepts multipart/form-data: name, description?, files (one or more audio Files).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Voice cloning is not configured.", code: "TTS_UNAVAILABLE" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const inForm = await req.formData();
    const name = String(inForm.get("name") || "").trim();
    const description = String(inForm.get("description") || "").trim();
    const files = inForm.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

    if (!name) {
      return new Response(JSON.stringify({ error: "Name is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (files.length === 0) {
      return new Response(JSON.stringify({ error: "Upload at least one audio sample (30s–3 min works best)." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const totalBytes = files.reduce((n, f) => n + f.size, 0);
    if (totalBytes > 40 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Total samples exceed 40 MB. Use shorter clips." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const outForm = new FormData();
    outForm.append("name", name);
    if (description) outForm.append("description", description);
    for (const f of files) outForm.append("files", f, f.name || "sample.mp3");

    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: outForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("ElevenLabs clone error:", res.status, errText);
      let message = errText || `Clone failed (${res.status})`;
      try {
        const parsed = JSON.parse(errText);
        message = parsed?.detail?.message || parsed?.message || message;
      } catch { /* keep */ }
      const code = res.status === 401 ? "TTS_BILLING" : "CLONE_FAILED";
      return new Response(JSON.stringify({ error: message, code, status: res.status }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    return new Response(JSON.stringify({ voice_id: data.voice_id, name, requires_verification: !!data.requires_verification }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("clone-voice error:", error);
    return new Response(JSON.stringify({ error: String(error instanceof Error ? error.message : error) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

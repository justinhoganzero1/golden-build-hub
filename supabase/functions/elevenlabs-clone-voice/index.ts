import { requireUser, enforceRateLimit } from "../_shared/requireAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Instant Voice Cloning through ElevenLabs.
 * Accepts multipart/form-data: `name`, optional `description`, and one or more
 * `files` audio samples. Returns the new voice_id so the Voice Studio can use
 * it immediately with elevenlabs-tts.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireUser(req);
    if (auth.response) return auth.response;
    const rl = await enforceRateLimit(req, auth.user, "elevenlabs-clone-voice");
    if (rl) return rl;

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) return json({ error: "TTS_UNAVAILABLE" }, 503);

    const inbound = await req.formData();
    const name = String(inbound.get("name") || "").trim();
    const description = String(inbound.get("description") || "").trim();
    const files = inbound.getAll("files").filter((f) => f instanceof File) as File[];

    if (!name || name.length > 120) return json({ error: "A voice name (1-120 chars) is required" }, 400);
    if (files.length === 0) return json({ error: "At least one audio sample is required" }, 400);
    if (files.length > 10) return json({ error: "Maximum 10 samples" }, 400);
    const total = files.reduce((n, f) => n + f.size, 0);
    if (total > 25 * 1024 * 1024) return json({ error: "Samples must total under 25 MB" }, 400);

    const form = new FormData();
    form.append("name", name);
    if (description) form.append("description", description.slice(0, 500));
    form.append("labels", JSON.stringify({ source: "oracle-lunar", owner: auth.user.id }));
    for (const f of files) form.append("files", f, f.name || "sample.mp3");

    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: form,
    });

    const text = await res.text();
    if (!res.ok) {
      console.error("ElevenLabs clone failed", res.status, text);
      return json({ error: "Clone failed", status: res.status, details: text }, res.status);
    }

    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(text); } catch { /* ignore */ }

    return json({ voice_id: parsed.voice_id, name, requires_verification: parsed.requires_verification ?? false });
  } catch (error) {
    console.error("clone-voice error:", error);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});

// Generates a complete YouTube episode with an AI host:
// host persona + appearance prompt, a fully-scripted show broken into
// host pieces-to-camera and B-roll beats, plus ready-to-publish YouTube metadata.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY is not configured" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: ud } = await userClient.auth.getUser();
    if (!ud?.user) return json({ error: "not authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const topic = String(body.topic ?? "").trim();
    const hostStyle = String(body.host_style ?? "warm, energetic explainer host").slice(0, 200);
    const hostGender = String(body.host_gender ?? "any").slice(0, 20);
    const channelName = String(body.channel_name ?? "").slice(0, 100);
    const minutes = Math.min(30, Math.max(1, Number(body.minutes) || 8));
    const source = String(body.source_text ?? "").slice(0, 12000);

    if (!topic && !source) return json({ error: "topic or source_text is required" }, 400);

    const segments = Math.min(16, Math.max(4, Math.round((minutes * 60) / 25)));

    const prompt = `Write a complete, ready-to-record YouTube episode hosted by an AI presenter.

Channel: ${channelName || "an independent creator channel"}
Episode topic: ${topic || "(derive it from the source material)"}
Host persona style: ${hostStyle}
Host gender preference: ${hostGender}
Target runtime: about ${minutes} minutes (${segments} segments)
Source material (optional, use it as the spine if present):
${source || "(none)"}

Rules:
- Invent ONE consistent host: name, on-screen title, personality, and a detailed physical appearance so every shot looks like the same person.
- Alternate: host pieces-to-camera (host on screen) and B-roll beats (host voice over visuals).
- Every segment's "narration" is the exact spoken words — plain text, no stage directions, no markdown, no asterisks.
- Open with a 1-2 sentence hook, ask for like+subscribe early, end with an outro CTA and next-episode teaser.
- "image_prompt" for B-roll must be a rich cinematic photo prompt. For host segments leave image_prompt empty.
- Total spoken words should suit ${minutes} minutes at ~150 words/minute.

Return ONLY valid JSON:
{
  "host": {"name":"","title":"","persona":"","appearance_prompt":"","voice_style":"one of: narrator-male-warm, narrator-female-warm, energetic-male, energetic-female"},
  "show_title": "",
  "segments": [
    {"kind":"host"|"broll","heading":"","narration":"","image_prompt":"","seconds":20}
  ],
  "youtube": {"title":"under 70 chars","description":"400-800 words with timestamps placeholder and CTA","tags":["..."],"thumbnail_prompt":""}
}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: "You are an elite YouTube showrunner and head writer. Output ONLY valid JSON, no code fences." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[youtube-host-show] gateway ${resp.status}: ${text}`);
      return json({ error: "AI request failed", status: resp.status, details: text }, resp.status);
    }

    const data = await resp.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let show: any;
    try {
      show = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) return json({ error: "Could not parse the generated show", raw: cleaned.slice(0, 500) }, 502);
      show = JSON.parse(m[0]);
    }

    if (!Array.isArray(show?.segments) || !show.segments.length) {
      return json({ error: "The generated show had no segments" }, 502);
    }

    return json(show);
  } catch (e) {
    console.error("[youtube-host-show] error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

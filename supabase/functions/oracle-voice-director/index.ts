// Voice-only Oracle director: TTS asks the 22 questions, STT captures answers, and a "free-ramble"
// extraction mode pulls the 22 fields from a single user monologue.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { mode, transcript, partial_brief } = await req.json();
    // mode: "extract_from_ramble" | "next_question"

    if (mode === "extract_from_ramble") {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: "You extract structured movie brief fields from a user's free-form spoken monologue. Output ONLY valid JSON." },
            { role: "user", content: `User monologue:
"""${transcript}"""

Extract as JSON:
{
  "title": "",
  "logline": "",
  "genre": "",
  "tone": "",
  "setting": "",
  "time_period": "",
  "main_characters": [{"name":"","role":"","description":""}],
  "antagonist": "",
  "central_conflict": "",
  "stakes": "",
  "opening_scene": "",
  "ending": "",
  "key_scenes": [],
  "themes": [],
  "visual_style": "",
  "music_mood": "",
  "target_audience": "",
  "duration_minutes": 5,
  "missing_fields": ["list of fields the user did NOT mention"],
  "follow_up_questions": ["1-3 short questions to fill gaps"]
}` },
          ],
        }),
      });
      const j = await r.json();
      const raw = j.choices?.[0]?.message?.content ?? "{}";
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      const extracted = JSON.parse(cleaned);
      return new Response(JSON.stringify({ ok: true, extracted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    if (mode === "next_question") {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a friendly Oracle director conducting a voice interview. Output ONE next question (under 20 words), or {\"done\":true} if the brief is complete." },
            { role: "user", content: `Current brief: ${JSON.stringify(partial_brief ?? {})}\n\nReply JSON: {\"question\":\"...\",\"field\":\"field_name\"} or {\"done\":true}` },
          ],
        }),
      });
      const j = await r.json();
      const raw = j.choices?.[0]?.message?.content ?? "{}";
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
      return new Response(cleaned, {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    throw new Error("unknown mode");
  } catch (e) {
    console.error("[oracle-voice-director]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});

// Ingests a writing sample from the user (email, chat, paste, voice transcript),
// stores it, and updates a rolling per-user style profile using Lovable AI.
// The profile lets the AI later draft outgoing messages in the user's voice.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

interface ProfileUpdate {
  voice_summary: string;
  emotional_register: string;
  formality_score: number;
  warmth_score: number;
  common_phrases: string[];
  signature_quirks: string[];
  preferred_greetings: string[];
  preferred_signoffs: string[];
  emotion_detected: string;
  intent_detected: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "UNAUTHENTICATED" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const content = String(body?.content || "").trim();
    const source = String(body?.source || "paste").slice(0, 32);
    const recipientHint = body?.recipientHint ? String(body.recipientHint).slice(0, 64) : null;

    if (!content || content.length < 8) {
      return new Response(JSON.stringify({ error: "SAMPLE_TOO_SHORT" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (content.length > 8000) {
      return new Response(JSON.stringify({ error: "SAMPLE_TOO_LONG" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Pull the existing profile so the AI updates incrementally, not from scratch
    const { data: existing } = await admin
      .from("user_style_profile")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const prompt = `You are analysing how a single person writes so an AI can later draft messages in their exact voice.

EXISTING PROFILE (may be empty for first sample):
${JSON.stringify(existing ?? {}, null, 2)}

NEW WRITING SAMPLE (source: ${source}${recipientHint ? `, recipient: ${recipientHint}` : ""}):
"""
${content}
"""

Return a JSON object that BLENDS the new sample into the existing profile. Be conservative — only revise scores when the new sample meaningfully shifts them. Keep arrays deduplicated and capped at 12 items each.

Fields (all required):
- voice_summary: 2-3 sentence plain-English description of how they write
- emotional_register: e.g. "warm and supportive", "dry and witty", "direct and brisk"
- formality_score: 0 (very casual) to 1 (very formal)
- warmth_score: 0 (cold/transactional) to 1 (very warm)
- common_phrases: phrases they reach for often
- signature_quirks: distinctive habits (em-dashes, starts with "so", lowercase i, etc.)
- preferred_greetings: openers they use ("hey", "morning!", "hi mate")
- preferred_signoffs: closers ("cheers", "talk soon", "x")
- emotion_detected: dominant emotion in THIS sample only
- intent_detected: what they were trying to do in THIS sample (apologise, plan, vent, thank, request, etc.)`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You return only valid JSON. No prose." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, txt);
      return new Response(JSON.stringify({ error: "AI_FAILED" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: ProfileUpdate;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return new Response(JSON.stringify({ error: "AI_PARSE_FAILED" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cheap deterministic metrics so the profile is grounded in real numbers
    const sentences = content.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    const words = content.split(/\s+/).filter(Boolean);
    const emoji = content.match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu) ?? [];
    const avgSentenceLen = sentences.length ? words.length / sentences.length : words.length;
    const avgWordLen = words.length ? words.join("").length / words.length : 0;
    const emojiRate = words.length ? emoji.length / words.length : 0;
    const exclamationRate = (content.match(/!/g) ?? []).length / Math.max(sentences.length, 1);
    const questionRate = (content.match(/\?/g) ?? []).length / Math.max(sentences.length, 1);

    const newCount = (existing?.sample_count ?? 0) + 1;

    // Insert the raw sample
    await admin.from("user_style_samples").insert({
      user_id: user.id,
      source,
      content,
      recipient_hint: recipientHint,
      emotion_detected: parsed.emotion_detected ?? null,
      intent_detected: parsed.intent_detected ?? null,
    });

    // Upsert profile
    const profileRow = {
      user_id: user.id,
      sample_count: newCount,
      avg_sentence_length: avgSentenceLen,
      avg_word_length: avgWordLen,
      formality_score: parsed.formality_score,
      warmth_score: parsed.warmth_score,
      emoji_rate: emojiRate,
      exclamation_rate: exclamationRate,
      question_rate: questionRate,
      voice_summary: parsed.voice_summary,
      common_phrases: parsed.common_phrases ?? [],
      signature_quirks: parsed.signature_quirks ?? [],
      preferred_greetings: parsed.preferred_greetings ?? [],
      preferred_signoffs: parsed.preferred_signoffs ?? [],
      emotional_register: parsed.emotional_register,
      last_updated: new Date().toISOString(),
    };

    if (existing) {
      await admin.from("user_style_profile").update(profileRow).eq("user_id", user.id);
    } else {
      await admin.from("user_style_profile").insert(profileRow);
    }

    return new Response(
      JSON.stringify({ ok: true, sample_count: newCount, profile: profileRow }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("learn-user-style error:", e);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

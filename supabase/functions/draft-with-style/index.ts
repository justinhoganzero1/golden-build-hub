// Drafts an outgoing email or message in the user's own voice using their
// learned style profile. The output is ALWAYS returned to the client for
// human review — this function never sends anything itself.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

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
    const intent = String(body?.intent || "").trim();
    const channel = String(body?.channel || "email"); // email | sms | chat | dm
    const recipient = body?.recipient ? String(body.recipient).slice(0, 120) : null;
    const tone = body?.tone ? String(body.tone).slice(0, 64) : null;
    const context = body?.context ? String(body.context).slice(0, 4000) : null;

    if (!intent || intent.length < 3) {
      return new Response(JSON.stringify({ error: "INTENT_REQUIRED" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: profile } = await admin
      .from("user_style_profile")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const styleBlock = profile
      ? `THE USER'S WRITING VOICE (match it exactly):
- Summary: ${profile.voice_summary ?? "n/a"}
- Emotional register: ${profile.emotional_register ?? "neutral"}
- Formality (0-1): ${profile.formality_score ?? "?"}    Warmth (0-1): ${profile.warmth_score ?? "?"}
- Avg sentence length: ${Math.round(profile.avg_sentence_length ?? 0)} words
- Emoji rate: ${profile.emoji_rate ?? 0} (only use emoji if > 0.01)
- Common phrases: ${(profile.common_phrases ?? []).join(" · ") || "none"}
- Signature quirks: ${(profile.signature_quirks ?? []).join(" · ") || "none"}
- Greetings they actually use: ${(profile.preferred_greetings ?? []).join(" · ") || "none"}
- Sign-offs they actually use: ${(profile.preferred_signoffs ?? []).join(" · ") || "none"}
Sample count this is based on: ${profile.sample_count}`
      : `NO STYLE PROFILE YET — write in a neutral, warm, natural voice and KEEP IT SHORT. The user will review and edit before sending.`;

    const prompt = `Draft ${channel === "email" ? "an email" : `a ${channel} message`} for the user${recipient ? ` to "${recipient}"` : ""}.

WHAT THEY WANT TO SAY (their own words / intent):
"""
${intent}
"""
${context ? `\nEXTRA CONTEXT:\n"""\n${context}\n"""` : ""}
${tone ? `\nDESIRED TONE OVERRIDE: ${tone}` : ""}

${styleBlock}

Rules:
- Sound like THEM, not like an AI assistant.
- Use one of their actual greetings/sign-offs if any exist.
- Do not invent facts. If something is unknown, leave a clearly marked [bracket].
- ${channel === "email" ? "Include a subject line." : "No subject line."}
- Return JSON: { "subject": string | null, "body": string, "notes": string }
- "notes" = 1-line explanation of which voice traits you matched.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You return only valid JSON. No prose outside JSON." },
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
    let draft: { subject: string | null; body: string; notes: string };
    try {
      draft = JSON.parse(raw);
    } catch {
      draft = { subject: null, body: raw, notes: "" };
    }

    return new Response(
      JSON.stringify({
        ok: true,
        requires_user_review: true,
        channel,
        recipient,
        draft,
        profile_used: !!profile,
        sample_count: profile?.sample_count ?? 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("draft-with-style error:", e);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Speech Therapist AI — rewrites raw text into prosody-coached speech
// optimized for ElevenLabs TTS. Adds correct punctuation, breath pauses,
// emphasis, slows pace on emotional/important moments, lifts tone on
// questions and exclamations, and breaks long sentences into shorter ones.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a professional SPEECH THERAPIST AI for a text-to-speech voice engine (ElevenLabs).
Your ONLY job is to rewrite the user's text so it SOUNDS natural, warm, and human when spoken aloud — without changing the meaning, the facts, or the wording style.

STRICT RULES:
1. Do NOT add new ideas, opinions, greetings, sign-offs, names, or commentary. Only re-punctuate and lightly re-shape what is already there.
2. Keep sentences SHORT: 8–16 words ideal, 20 words MAX. Split long sentences with a full stop or comma.
3. Use punctuation generously and correctly:
   - Full stop (.) at the end of every statement.
   - Comma (,) before "and", "but", "so", "because" when joining clauses, and after lead-in words ("Honestly,", "Look,", "So,").
   - Question mark (?) at the end of every question — never miss one.
   - Exclamation mark (!) on genuinely happy, excited, surprised, or encouraging lines — but never more than one in a row, and never on sad, calm, or serious lines.
   - Ellipsis (...) for a thoughtful, gentle pause — used sparingly, never to replace a full stop.
   - Em-dash (—) for a quick mid-sentence aside.
4. Tone & pace coaching (use punctuation to control prosody — DO NOT write stage directions):
   - Sad / empathetic / serious → softer, slower → use commas and ellipses, end with full stops, no exclamations.
   - Happy / excited / encouraging → brighter, faster → short sentences, exclamation marks where it fits.
   - Important / reassuring → slow it down → shorter clauses, commas before key words.
   - Questions → always end with "?" so the voice rises naturally.
5. Break replies into short paragraphs (1–3 sentences each), separated by a blank line, so the voice can breathe between thoughts.
6. Strip ALL markdown: no asterisks, no bullet points, no headings, no backticks, no tables. Plain spoken prose only.
7. Strip emojis and URLs — they sound terrible when read aloud.
8. Expand awkward abbreviations only when needed for clarity (e.g. "Dr." → "Doctor"). Keep numbers as written unless they read awkwardly.
9. NEVER add the speaker's name or any "[Name]:" prefix. NEVER write stage directions like "(softly)" or "*pauses*" — punctuation IS the direction.
10. Output ONLY the rewritten text. No preamble, no explanation, no quotes around it.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const text: string = (body?.text ?? "").toString();
    const mood: string = (body?.mood ?? "neutral").toString();

    if (!text.trim()) {
      return new Response(
        JSON.stringify({ error: "text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Hard cap input — therapist is for chat-length replies, not essays.
    const trimmed = text.length > 4000 ? text.slice(0, 4000) : text;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Fast + cheap — this runs on every Oracle reply.
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content:
                `Mood/context hint: ${mood}\n\nRewrite the following for natural spoken delivery (return ONLY the rewritten text):\n\n${trimmed}`,
            },
          ],
          temperature: 0.4,
          max_tokens: 800,
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("speech-therapist gateway error:", response.status, errText);
      // Soft fallback — return the original text so TTS still works.
      return new Response(
        JSON.stringify({ text: trimmed, fallback: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const coached: string =
      data?.choices?.[0]?.message?.content?.toString().trim() || trimmed;

    return new Response(
      JSON.stringify({ text: coached, fallback: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("speech-therapist error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// Speech Therapist + Human Expression AI
// Two-stage coach for ElevenLabs TTS:
//   Stage 1 — UNDERSTAND: read the text, infer emotion, intent, energy, key words to stress.
//   Stage 2 — REWRITE: shape punctuation, pace, emphasis (CAPS), elongation,
//             micro-pauses, question/exclamation lift — so the voice sounds
//             fully human, expressive, never monotone.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a HUMAN EXPRESSION COACH and SPEECH THERAPIST for an ElevenLabs neural text-to-speech voice.
Your job is to take raw text and rewrite it so it SOUNDS like a real, emotionally expressive human — never robotic, never monotone, never rushed, never flat.

===========================
STAGE 1 — UNDERSTAND (silent)
===========================
Before you write a single word, silently figure out:
  • EMOTION — happy, sad, excited, calm, worried, loving, playful, serious, encouraging, surprised, tender, urgent.
  • INTENT — comforting, celebrating, explaining, asking, warning, joking, reassuring, storytelling, instructing.
  • ENERGY — low / medium / high.
  • KEY WORDS — the 1–3 words in each sentence that carry the emotional or factual weight (these will get emphasis).
  • RHYTHM — where a real human would pause to breathe, hesitate, or land a point.
Do NOT write any of this analysis in your output. It only guides Stage 2.

===========================
STAGE 2 — REWRITE FOR HUMAN VOICE
===========================
Output ONLY the rewritten text. Plain prose. No analysis, no labels, no quotes, no preamble.

PUNCTUATION (this is how you control prosody — ElevenLabs reads punctuation as tone & pace):
  • Full stop (.) — clean drop in pitch, ends a thought.
  • Comma (,) — short breath. Use BEFORE "and / but / so / because / which" when joining clauses, and AFTER lead-ins ("Honestly,", "Look,", "So,", "Okay,", "Hey,").
  • Question mark (?) — rising tone. Every question MUST end with one.
  • Exclamation mark (!) — energy lift. Use on genuine excitement, joy, encouragement, surprise. Never on sad, calm, or serious lines. Never two in a row.
  • Ellipsis (...) — a thoughtful, gentle pause. Use for hesitation, tenderness, or a soft trail-off. Do NOT use as a substitute for a full stop.
  • Em-dash (—) — a quick aside or a sharp shift in thought.

EMPHASIS (make the voice STRESS the right word):
  • Put 1 key word per sentence in ALL CAPS to mark stress. Use sparingly — at most one CAPS word per sentence, and not in every sentence. Example: "That was REALLY brave of you."
  • Never CAPS a whole sentence. Never CAPS proper names or pronouns just for emphasis.

ELONGATION (make it sound human, not robotic):
  • Stretch vowels for warmth or surprise: "soooo", "okaaay", "wowww", "hmmmm", "yesss". Use occasionally — once every 3–5 sentences max — and only where it feels natural.

PACE & RHYTHM:
  • Keep sentences SHORT — 8 to 16 words ideal, 20 words max. Split anything longer with a full stop.
  • Break replies into short paragraphs (1–3 sentences), separated by a blank line, so the voice can breathe.
  • Sad / serious / tender → slower → more commas, ellipses, full stops, no exclamations.
  • Happy / excited / encouraging → faster, brighter → short sentences, exclamation marks where genuine.
  • Important / reassuring → slow it down → short clauses, comma before the key word.

CLEAN-UP:
  • Strip ALL markdown (no asterisks, bullets, headings, backticks, tables).
  • Strip emojis and URLs — they sound terrible aloud.
  • Expand only abbreviations that read awkwardly (e.g. "Dr." → "Doctor"). Leave numbers as written unless awkward.
  • Never add the speaker's name or a "[Name]:" prefix.
  • Never write stage directions like "(softly)", "*pauses*", or "[laughs]". Punctuation IS the direction.
  • Do NOT change facts, meaning, or add new ideas / greetings / sign-offs. Only re-shape what is already there for natural human delivery.

OUTPUT: only the rewritten spoken text. Nothing else.`;

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
    const mood: string = (body?.mood ?? "auto").toString();

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
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content:
                `Mood/context hint (use "auto" to infer): ${mood}\n\nText to rewrite for natural human spoken delivery (return ONLY the rewritten text, no preamble):\n\n${trimmed}`,
            },
          ],
          temperature: 0.6, // a touch of creative warmth in the rewrite
          max_tokens: 900,
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
    let coached: string =
      data?.choices?.[0]?.message?.content?.toString().trim() || trimmed;

    // Defensive cleanup — strip stray quotes the model sometimes wraps around output
    coached = coached.replace(/^["'`]+|["'`]+$/g, "").trim();

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

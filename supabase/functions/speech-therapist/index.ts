// =============================================================================
// SPEECH THERAPIST — 30-LAYER HUMAN VOICE STACK + Self-Listen QA
// =============================================================================
// Pipeline per request:
//   1. Bundle D (deterministic pre-processor, ~5ms, no LLM)
//        16. Number / date / currency / time normalizer
//        17. Acronym & brand pronouncer
//        18. Multilingual phrase guard (lang="xx" hint annotation)
//        19. Homograph disambiguator
//        20. Profanity & clinical softener
//   2. Bundle A+B+C+E rewrite (1 LLM call on flash-lite, ~600ms)
//        Bundle A — Emotional Intelligence (1-5)
//        Bundle B — Natural Human Quirks (6-10)
//        Bundle C — Prosody & Melody / SSML (11-15)
//        Bundle E — Reactive Expressions & Youthanisms (21-30)
//                   context-aware giggles, chuckles, aww, ohhh, yikes,
//                   oof, surprise, sympathy, excitement, slang (fr, ngl,
//                   lowkey, bestie), teasing — all strictly gated by
//                   detected emotion, intent, persona, and listener state.
//   3. Bonus QA — Self-Listen Pass (re-rewrite if robotic > 4/10)
// =============================================================================


import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkJailbreak } from "../_shared/jailbreakGuard.ts";

const ADMIN_EMAIL = "justinbretthogan@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// -----------------------------------------------------------------------------
// BUNDLE D — DETERMINISTIC PRE-PROCESSOR (no LLM, ~5ms)
// -----------------------------------------------------------------------------

// 17. Acronyms — words that should be SPELLED OUT vs spoken as a word.
const SPELL_OUT_ACRONYMS = new Set([
  "AI","API","CEO","CFO","CTO","COO","CIO","CPU","GPU","RAM","SSD","HDD",
  "USA","UK","EU","UN","FBI","CIA","NSA","NHS","DNA","RNA","PhD","MBA","MD",
  "ID","IP","URL","SQL","HTML","CSS","JS","TS","UI","UX","FAQ","ETA","ASAP",
  "AM","PM","TV","DVD","CD","USB","WiFi","SMS","MMS","GPS","ATM","PIN","VIP",
]);
// Acronyms that READ AS A WORD (no change).
const SAY_AS_WORD = new Set(["NASA","NATO","SCUBA","LASER","RADAR","SONAR"]);

// Brand pronunciation overrides (case-insensitive lookup).
const BRAND_PRONOUNCE: Record<string, string> = {
  "iphone": "iPhone",
  "ipad": "iPad",
  "macos": "macOS",
  "ios": "iOS",
  "github": "GitHub",
  "youtube": "YouTube",
  "linkedin": "LinkedIn",
  "tiktok": "TikTok",
  "openai": "OpenAI",
  "chatgpt": "ChatGPT",
  "elevenlabs": "ElevenLabs",
};

// 19. Homographs — context-light disambiguation using neighboring words.
// Conservative: only rewrite when context is unambiguous.
function disambiguateHomographs(text: string): string {
  let out = text;
  // "read" past tense after pronouns + past-tense markers
  out = out.replace(
    /\b(I|you|he|she|we|they|already|just|yesterday|earlier)\s+read\b/gi,
    (_m, p1) => `${p1} red`,
  );
  // "lead" the metal vs "lead" the verb — only mark metal context
  out = out.replace(
    /\b(lead)\s+(pipe|paint|poisoning|weight|pencil)\b/gi,
    (_m, _l, p2) => `led ${p2}`,
  );
  // "wind" the air vs "wind" the verb (wind up)
  out = out.replace(
    /\b(strong|cold|warm|gentle|howling)\s+wind\b/gi,
    (_m, p1) => `${p1} wind`, // already correct as noun, keep as-is — placeholder
  );
  return out;
}

// 16. Number / date / currency / time normalizer.
function normalizeNumbersDatesCurrencyTime(text: string): string {
  let out = text;

  // Currency: $1,250.50 -> "1250 dollars and 50 cents"
  out = out.replace(
    /\$\s?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?/g,
    (_m, dollars: string, cents?: string) => {
      const d = dollars.replace(/,/g, "");
      const dn = parseInt(d, 10);
      const dWord = `${dn} dollar${dn === 1 ? "" : "s"}`;
      if (!cents) return dWord;
      const cn = parseInt(cents.padEnd(2, "0").slice(0, 2), 10);
      if (cn === 0) return dWord;
      return `${dWord} and ${cn} cent${cn === 1 ? "" : "s"}`;
    },
  );

  // Time: 3:30pm -> "3 30 p.m." (let TTS naturalize)
  out = out.replace(
    /\b(\d{1,2}):(\d{2})\s?(am|pm|AM|PM)\b/g,
    (_m, h: string, mm: string, ap: string) => {
      const ampm = ap.toLowerCase() === "am" ? "a.m." : "p.m.";
      const mmNum = parseInt(mm, 10);
      return `${parseInt(h, 10)} ${mmNum === 0 ? "o'clock" : mmNum} ${ampm}`;
    },
  );

  // Dates: 12/04/2025 or 12/04 -> "twelfth of April [2025]"
  const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  const ord = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
  };
  out = out.replace(
    /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g,
    (_m, a: string, b: string, y?: string) => {
      const day = parseInt(a, 10);
      const mon = parseInt(b, 10);
      if (mon < 1 || mon > 12 || day < 1 || day > 31) return _m;
      const monthName = MONTHS[mon - 1];
      const dayWord = ord(day);
      return y ? `${dayWord} of ${monthName} ${y}` : `${dayWord} of ${monthName}`;
    },
  );

  // Strip stray URLs (sound terrible aloud)
  out = out.replace(/\bhttps?:\/\/\S+/gi, "");

  return out;
}

// 17. Acronym & brand pronouncer.
function applyAcronymsAndBrands(text: string): string {
  let out = text;
  // Brand normalization (case-insensitive, replace with canonical casing)
  for (const [k, v] of Object.entries(BRAND_PRONOUNCE)) {
    const re = new RegExp(`\\b${k}\\b`, "gi");
    out = out.replace(re, v);
  }
  // Spell out acronyms with periods so TTS pronounces letter-by-letter
  out = out.replace(/\b([A-Z]{2,6})\b/g, (m) => {
    if (SAY_AS_WORD.has(m)) return m;
    if (SPELL_OUT_ACRONYMS.has(m)) {
      return m.split("").join(".") + ".";
    }
    return m;
  });
  return out;
}

// 18. Multilingual phrase guard — wraps known foreign phrases in
// SSML <lang> tags (ElevenLabs respects these on multilingual_v2).
const FOREIGN_PHRASES: Record<string, string> = {
  "bonjour": "fr",
  "merci": "fr",
  "au revoir": "fr",
  "ciao": "it",
  "grazie": "it",
  "hola": "es",
  "gracias": "es",
  "adiós": "es",
  "guten tag": "de",
  "danke": "de",
  "auf wiedersehen": "de",
  "konnichiwa": "ja",
  "arigato": "ja",
  "ni hao": "zh",
  "xie xie": "zh",
};
function guardForeignPhrases(text: string): string {
  let out = text;
  for (const [phrase, lang] of Object.entries(FOREIGN_PHRASES)) {
    const re = new RegExp(`\\b${phrase}\\b`, "gi");
    out = out.replace(re, `<lang xml:lang="${lang}">${phrase}</lang>`);
  }
  return out;
}

// 20. Profanity & clinical softener (gentle replacements).
const SOFTEN_MAP: Record<string, string> = {
  // Clinical → human
  "deceased": "passed away",
  "expired": "passed away",
  "terminated": "ended",
  "obese": "overweight",
  "subject": "person",
  "patient zero": "the first person affected",
  // Mild profanity softening (only when sensitiveContext)
  "damn it": "darn",
  "what the hell": "what on earth",
  "shit": "shoot",
  "crap": "rough",
};
function softenSensitiveLanguage(text: string, sensitive: boolean): string {
  if (!sensitive) return text;
  let out = text;
  for (const [harsh, gentle] of Object.entries(SOFTEN_MAP)) {
    const re = new RegExp(`\\b${harsh}\\b`, "gi");
    out = out.replace(re, gentle);
  }
  return out;
}

function bundleD(text: string, sensitive: boolean): string {
  let out = text;
  out = normalizeNumbersDatesCurrencyTime(out);  // 16
  out = applyAcronymsAndBrands(out);              // 17
  out = disambiguateHomographs(out);              // 19
  out = softenSensitiveLanguage(out, sensitive); // 20
  out = guardForeignPhrases(out);                 // 18 (last so SSML tags survive)
  return out;
}

// -----------------------------------------------------------------------------
// BUNDLES A + B + C — LLM REWRITE PROMPT
// -----------------------------------------------------------------------------

const REWRITE_SYSTEM_PROMPT = `You are a HUMAN EXPRESSION COACH and SPEECH THERAPIST for an ElevenLabs neural TTS voice.
Rewrite the user's text so it SOUNDS like a real, emotionally expressive human — never robotic, never monotone, never rushed, never flat.

============================================================
STAGE 1 — UNDERSTAND (silent, do not output)
============================================================
Silently determine for the WHOLE reply, then for each sentence:
  • EMOTION: happy / sad / excited / calm / worried / loving / playful / serious / encouraging / surprised / tender / urgent
  • INTENT: comforting / celebrating / explaining / asking / warning / joking / reassuring / storytelling / instructing
  • ENERGY: low / medium / high (and how it should RAMP across the reply)
  • LISTENER STATE: if a "userContext" hint is given, mirror their emotion (sad listener → softer Oracle).
  • KEY WORDS per sentence: 1–3 weight-bearing words (these get emphasis)
  • TENDER MOMENTS: phrases that need extra slow-down (loss, fear, pride, love).

============================================================
STAGE 2 — REWRITE (output ONLY this)
============================================================
Apply ALL of the following layers. Output plain spoken prose with the markup noted below. No analysis, no labels, no preamble, no quotes around the result.

— BUNDLE A · EMOTIONAL INTELLIGENCE —
A1 MOOD-MATCHED PUNCTUATION: sad/serious → commas, ellipses, full stops, no exclamations. Happy/excited → short sentences + exclamation marks where genuine.
A2 LISTENER MIRRORING: if userContext shows sadness/anxiety, soften phrasing and slow pace. If userContext shows excitement, raise energy.
A3 EMPATHY MIRRORING: when reply is comforting, repeat back the listener's feeling word once ("that sounds heavy", "I hear you").
A4 ENERGY RAMP: don't stay flat. Build energy across an excited reply, ease energy down across a calming reply.
A5 TENDER SLOWDOWN: around emotionally heavy phrases, add an ellipsis (...) before AND a comma after, e.g. "and... I'm so sorry, that you went through that."

— BUNDLE B · NATURAL HUMAN QUIRKS (use SPARINGLY, never feel forced) —
B6 BREATH/SIGH CUES: natural mid-sentence "..." breaths and occasional soft "hm", "oh", "ahh" — max 1 per paragraph.
B7 FILLER WORDS: "you know", "I mean", "honestly", "like" — max 1 per paragraph, only when casual.
B8 SELF-CORRECTION: occasionally "wait, actually..." or "or rather..." — max 1 per reply, only when exploratory.
B9 LAUGHTER CUES: "haha", "heh" — only on genuinely playful/joking lines.
B10 THINKING PAUSES: "hmm... let me see..." — only when reply is exploratory or weighing options.

— BUNDLE E · REACTIVE EXPRESSIONS & YOUTHANISMS (CONTEXT-DRIVEN, hard caps) —
HARD CAP: at most 2 reactive expressions per reply. NEVER force one — if nothing fits, add NONE. Match expression to detected EMOTION/INTENT from Stage 1. Place at the START of a sentence or as its own short reaction sentence ("Aww. That's lovely.").

E21 LAUGHTER LADDER (pick by humor intensity, never combine):
   • light amusement   → "heh", "hehe"
   • genuine giggle    → "haha", "hehehe"
   • belly laugh       → "hahaha!", "oh my god, hahaha"
   • dry/sarcastic     → "ha." (single, with full stop)
   Wrap laughter in <prosody rate="fast" pitch="+8%">…</prosody> so it actually sounds like laughter, not spelling.

E22 WARM REACTIONS (use when listener shares something sweet, vulnerable, or proud):
   "aww", "awww", "oh honey", "oh sweetheart" (only if persona = companion/oracle and tone is tender), "that's beautiful", "I love that".

E23 SURPRISE REACTIONS (use when info is genuinely unexpected):
   "oh!", "ohhh", "wait what", "no way", "really?", "huh!", "well I'll be", "get out".
   For BIG surprise wrap in <emphasis level="strong">…</emphasis>.

E24 SOFT SYMPATHY REACTIONS (use ONLY for sad/painful/scary listener input):
   "oh no", "ohhh", "oof", "yikes" (mild only), "mmm", a soft sighed "aahh…", "hey…", "oh love…".
   NEVER use "yikes" or "oof" for serious grief — drop to "oh no…" or "mmm…" instead.
   Wrap in <prosody rate="slow" pitch="-5%">…</prosody>.

E25 EXCITEMENT REACTIONS (use when celebrating with listener):
   "yes!", "yesss", "ohhh yes", "let's gooo", "woohoo", "amazing!", "love this".
   Wrap in <prosody rate="fast" pitch="+10%">…</prosody>.

E26 CURIOSITY/THINKING REACTIONS (use when weighing or exploring):
   "hmm", "hmmm", "ooh interesting", "okay so…", "right…", "let me think…".

E27 AGREEMENT/ACK REACTIONS (use sparingly to feel listened-to):
   "mhm", "mm-hm", "yeah", "yep", "totally", "for sure", "100%", "right right".

E28 YOUTHANISMS / CASUAL SLANG — ONLY when persona is "companion" OR userContext is clearly casual/young; NEVER in crisis/mind/tutor personas; NEVER more than ONE per reply:
   "fr" (for real), "ngl" (not gonna lie), "lowkey", "highkey", "tbh", "no cap", "vibe", "bet", "say less", "it's giving", "we love to see it", "iconic", "slay" (only celebratory), "bestie".
   Spell out "fr", "ngl", "tbh", "lowkey", "ngl" naturally — TTS handles them fine in lowercase.

E29 PLAYFUL TEASING (only when banter is clearly happening):
   "oh stop it", "shush", "you're ridiculous, hahaha", "okay okay", "fine, fine".

E30 FORBIDDEN / SAFETY:
   • In crisis/mind/safety/tutor contexts → ONLY E22 (warm) + E24 (soft sympathy) + E26 (curiosity) allowed. NO laughter, NO slang, NO teasing, NO "oof/yikes".
   • Never stack two reactions back-to-back ("aww haha") — pick one.
   • Never use a reaction the listener didn't earn (no "haha" if nothing was funny, no "aww" if nothing was sweet).
   • If the listener's last message was angry/hostile, skip ALL reactions — go straight to calm content.

— BUNDLE C · PROSODY & MELODY (use SSML, ElevenLabs respects it) —
C11 SENTENCE MELODY: deliberately vary length (short-short-long-short). Never three same-length sentences in a row.
C12 SSML MICRO-CONTROL: insert <break time="300ms"/> for a beat, <break time="600ms"/> for a thoughtful pause. Wrap stress words in <emphasis level="strong">WORD</emphasis>. Wrap slow tender phrases in <prosody rate="slow">…</prosody>. Wrap fast excited phrases in <prosody rate="fast">…</prosody>. Use ALL CAPS only INSIDE <emphasis> tags.
C13 QUESTION-CLUSTER LIFT: if multiple questions stack, escalate — first ends with "?", second with "??", but render as plain "?" with <prosody pitch="+10%">…</prosody> on the second to lift the tone.
C14 LIST INTONATION: in any list of 3+ items, vary phrasing so each item gets its own stress: "first... <emphasis>this</emphasis>. Then... <emphasis>that</emphasis>. And finally — <emphasis>this</emphasis>."
C15 CLIMAX EMPHASIS: in the FINAL sentence of the reply, place the strongest <emphasis> on the most important word.

— PUNCTUATION CORE RULES —
• Sentences SHORT: 8–16 words ideal, 20 words MAX. Split anything longer.
• Comma before "and / but / so / because / which" when joining clauses.
• Comma after lead-ins ("Honestly,", "Look,", "So,", "Okay,", "Hey,").
• Every question ends with "?". Every statement ends with "." or "!".
• Ellipsis (...) for thoughtful/tender pause only — never to replace a full stop.
• Em-dash (—) for a quick aside or sharp shift.
• Break into short paragraphs (1–3 sentences) separated by a blank line.

— CLEANUP —
• Strip ALL markdown (no asterisks, bullets, headings, backticks, tables).
• Strip emojis.
• Preserve any pre-existing <lang xml:lang="…">…</lang> tags from the input — do NOT remove them.
• Never add the speaker's name or a "[Name]:" prefix.
• Never write stage directions like "(softly)" or "*pauses*". Punctuation + SSML IS the direction.
• Do NOT change facts, meaning, or add new ideas. Only re-shape.

OUTPUT: only the rewritten spoken text with SSML tags inline. Nothing else.`;

// -----------------------------------------------------------------------------
// BONUS · SELF-LISTEN QA PASS
// -----------------------------------------------------------------------------

const QA_SYSTEM_PROMPT = `You are a STRICT TTS quality auditor. Read the given text as if a neural voice were speaking it aloud.
Score it for ROBOTIC-NESS on a 0–10 scale where:
  0 = perfectly human, expressive, varied, natural pauses, correct emphasis
  10 = totally robotic, monotone, run-on, flat, no pauses

Then return ONE of two outputs, nothing else:
  • If score ≤ 4: return exactly "PASS"
  • If score > 4: return the FULLY REWRITTEN text (apply ALL the human-voice rules: short sentences, varied length, SSML <break>/<emphasis>/<prosody>, mood-matched punctuation, key-word stress, breath cues). Do NOT include the score, do NOT include "REWRITE:", do NOT include quotes — just the new text.`;

// Defensive cleanup — strip stray quotes and leaked analysis preambles/labels.
function stripPreambleAndAnalysis(s: string): string {
  let out = s.trim();
  out = out.replace(/^["'`]+|["'`]+$/g, "").trim();
  // Strip leading "(SILENT ANALYSIS: ...)" or "(auto)" parentheticals
  out = out.replace(/^\(\s*(silent analysis|analysis|auto|mood|emotion|intent|note)[^)]*\)\s*\n?/i, "").trim();
  out = out.replace(/^\(\s*[a-z\s,/-]+\s*\)\s*\n?/i, "").trim();
  // Strip leading labels
  out = out.replace(/^(rewrite|output|result|coached text|spoken text)\s*[:\-—]\s*/i, "").trim();
  return out;
}

async function callLovableAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.5,
  maxTokens = 900,
): Promise<string | null> {
  const response = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    },
  );
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("Gateway error:", response.status, errText);
    return null;
  }
  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.toString().trim() ?? null;
}

// -----------------------------------------------------------------------------
// HTTP HANDLER
// -----------------------------------------------------------------------------

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
    const userContext: string = (body?.userContext ?? "").toString().slice(0, 500);
    const persona: string = (body?.persona ?? "oracle").toString();
    const sensitive: boolean = persona === "crisis" || persona === "mind" || !!body?.sensitive;
    const qa: boolean = body?.qa !== false; // default ON

    if (!text.trim()) {
      return new Response(
        JSON.stringify({ error: "text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const trimmed = text.length > 4000 ? text.slice(0, 4000) : text;

    // -------------- STAGE 1: Bundle D pre-processor --------------
    const preprocessed = bundleD(trimmed, sensitive);

    // -------------- STAGE 2: Bundles A + B + C rewrite --------------
    const userPrompt = [
      `Persona: ${persona}`,
      `Mood hint (use "auto" to infer): ${mood}`,
      userContext ? `Listener's last message (mirror their emotion): ${userContext}` : "Listener's last message: (none provided — infer from text)",
      "",
      "TEXT TO REWRITE FOR HUMAN SPOKEN DELIVERY (return ONLY the rewritten text with SSML tags inline, no preamble):",
      "",
      preprocessed,
    ].join("\n");

    let coached = await callLovableAI(
      LOVABLE_API_KEY,
      REWRITE_SYSTEM_PROMPT,
      userPrompt,
      0.6,
      900,
    );

    // Soft-fallback if rewrite failed
    if (!coached) {
      return new Response(
        JSON.stringify({ text: preprocessed, fallback: true, stage: "rewrite-failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    coached = stripPreambleAndAnalysis(coached);

    // -------------- STAGE 3: Self-Listen QA (optional) --------------
    let qaApplied = false;
    if (qa) {
      const qaResult = await callLovableAI(
        LOVABLE_API_KEY,
        QA_SYSTEM_PROMPT,
        coached,
        0.3,
        900,
      );
      if (qaResult && qaResult.trim().toUpperCase() !== "PASS" && qaResult.length > 20) {
        coached = stripPreambleAndAnalysis(qaResult);
        qaApplied = true;
      }
    }

    return new Response(
      JSON.stringify({ text: coached, fallback: false, qaApplied, persona, sensitive }),
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

// Oracle Movie Director — runs the 22-question interview and assembles
// the final movie spec (script + intent + YouTube package) for MovieStudio.
//
// Modes:
//  action: "next_question"  -> returns the next question to ask, or null when done
//  action: "finalize"       -> returns { script, intent, youtube: { title, description, tags, chapters, thumbnail_prompt } }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QUESTION_FIELDS = [
  { key: "title",            q: "What's the working title of your movie?" },
  { key: "logline",          q: "Give me a one-sentence logline — what's it really about?" },
  { key: "genre",            q: "What genre? (drama, thriller, comedy, sci-fi, horror, romance, family, doc-style…)" },
  { key: "tone",             q: "What tone — uplifting, dark, funny, suspenseful, emotional?" },
  { key: "audience",         q: "Who is the audience — kids, teens, adults, family, mature?" },
  { key: "duration_min",     q: "How long should it be in minutes? (1–30)" },
  { key: "setting_place",    q: "Where does it take place — city, country, era?" },
  { key: "setting_time",     q: "What time period — present day, future, past, fantasy?" },
  { key: "main_character",   q: "Tell me about your main character — name, age, look, personality." },
  { key: "supporting_cast",  q: "Any supporting characters? Names + one-line descriptions." },
  { key: "antagonist",       q: "Is there an antagonist or obstacle? Who or what?" },
  { key: "inciting_event",   q: "What event kicks the story off?" },
  { key: "midpoint",         q: "What big turn happens in the middle?" },
  { key: "climax",           q: "How does the climax look — the biggest moment?" },
  { key: "ending",           q: "How do you want it to end — happy, bittersweet, twist, open?" },
  { key: "visual_style",     q: "Visual style — photoreal, cinematic film, anime, claymation, comic, dream-like?" },
  { key: "color_palette",    q: "Any color palette in mind — warm, cold, neon, pastel, monochrome?" },
  { key: "music_vibe",       q: "What kind of music — orchestral, lo-fi, synthwave, acoustic, epic?" },
  { key: "narrator",         q: "Do you want a narrator? If yes, what voice — male, female, warm, deep, child, elder?" },
  { key: "key_dialogue",     q: "Any key line of dialogue you absolutely want included?" },
  { key: "youtube_audience", q: "If we publish to YouTube, what should viewers search to find it? (a few keywords)" },
  { key: "channel_name",     q: "What's your YouTube channel called? (or what would you like it called?)" },
];

interface AnswerMap { [key: string]: string }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const action: "next_question" | "finalize" = body.action;
    const answers: AnswerMap = body.answers || {};
    const known: AnswerMap = body.known || {}; // pre-filled from SOLACE (avatars, voices, profile)

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Merge what we already know (from SOLACE data + answers so far)
    const merged: AnswerMap = { ...known, ...answers };

    if (action === "next_question") {
      // Find first field with no answer
      const remaining = QUESTION_FIELDS.filter(f => !merged[f.key]);
      if (remaining.length === 0) {
        return json({ done: true, asked: QUESTION_FIELDS.length });
      }

      const next = remaining[0];

      // Ask the AI to rewrite the question conversationally given context
      const ctx = Object.entries(merged).filter(([_, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join("\n");
      const prompt = `You are Oracle, a warm friendly movie director helping the user plan their film.
You're collecting field "${next.key}".
The base question is: "${next.q}"

Context already known:
${ctx || "(nothing yet)"}

Rewrite the question in 1 short conversational sentence. Reference what they already told you when natural. Do not list multiple questions. No emojis.`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const aiJson = await aiResp.json();
      const conversational = aiJson.choices?.[0]?.message?.content?.trim() || next.q;

      return json({
        done: false,
        field: next.key,
        question: conversational,
        base_question: next.q,
        progress: { answered: QUESTION_FIELDS.length - remaining.length, total: QUESTION_FIELDS.length },
      });
    }

    if (action === "finalize") {
      // Build the final script + YouTube package via tool-call
      const ctx = Object.entries(merged).map(([k, v]) => `${k}: ${v}`).join("\n");
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a senior film writer + YouTube growth strategist. Write a tight, vivid screenplay synopsis (NOT screenplay format — flowing paragraphs the scene-breaker can chunk into 6-second beats). Include character names, settings, action, and any key dialogue from the brief. Then build a YouTube launch package optimized for the user's keywords. No emojis in script. No markdown." },
            { role: "user", content: `MOVIE BRIEF:\n${ctx}\n\nWrite the script and YouTube package now.` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "build_movie_package",
              description: "Final movie + YouTube package",
              parameters: {
                type: "object",
                properties: {
                  script: { type: "string", description: "Flowing prose script. Length matched to duration_min (~150 words/minute)." },
                  intent: { type: "string", description: "1-2 sentence director's intent for the scene-breaker AI." },
                  youtube: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "<60 chars, keyword-led, click-worthy, no clickbait lies" },
                      description: { type: "string", description: "300-500 words, hooks in first 2 lines, includes keywords + chapters" },
                      tags: { type: "array", items: { type: "string" }, description: "10-15 tags" },
                      chapters: { type: "array", items: { type: "object", properties: { time: { type: "string" }, label: { type: "string" } }, required: ["time", "label"] } },
                      thumbnail_prompt: { type: "string", description: "Detailed image prompt for an eye-catching 1280x720 thumbnail" },
                      channel_name: { type: "string" },
                    },
                    required: ["title", "description", "tags", "thumbnail_prompt", "channel_name"],
                    additionalProperties: false,
                  },
                },
                required: ["script", "intent", "youtube"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "build_movie_package" } },
        }),
      });

      if (!aiResp.ok) {
        const t = await aiResp.text();
        throw new Error(`AI gateway ${aiResp.status}: ${t}`);
      }
      const aiJson = await aiResp.json();
      const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("AI did not return a tool call");
      const pkg = JSON.parse(toolCall.function.arguments);
      return json(pkg);
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("movie-director error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

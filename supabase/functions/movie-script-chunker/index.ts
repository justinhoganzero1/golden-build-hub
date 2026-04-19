// Splits a long-form movie brief into individual scenes + locks character bible.
// Uses Lovable AI Gemini Pro for script + scene breakdown, then writes movie_scenes + movie_character_bible.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { ELEVENLABS_VOICES } from "../_shared/voice-pool.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { project_id } = await req.json();
    if (!project_id) throw new Error("project_id required");

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) throw new Error("not authenticated");

    const { data: project } = await supabase
      .from("movie_projects").select("*").eq("id", project_id).maybeSingle();
    if (!project) throw new Error("project not found");
    if (project.user_id !== userId) throw new Error("forbidden");

    await supabase.from("movie_projects").update({
      status: "chunking", started_at: new Date().toISOString(),
    }).eq("id", project_id);

    // Calculate scene count: ~8 sec per scene avg
    const targetMin = Math.min(120, Math.max(1, project.target_duration_minutes ?? 5));
    const totalScenes = Math.max(3, Math.ceil((targetMin * 60) / 8));

    // 1) Generate full script + character bible + scene breakdown via Gemini Pro
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are an Oscar-winning screenwriter and director. Output ONLY valid JSON. Generate a coherent ${targetMin}-minute movie split into exactly ${totalScenes} numbered scenes. Each scene ~8 seconds. Maintain character & location consistency.`,
          },
          {
            role: "user",
            content: `Create the full breakdown for this movie:

TITLE: ${project.title}
LOGLINE: ${project.logline ?? "(none)"}
GENRE: ${project.genre ?? "drama"}
BRIEF: ${JSON.stringify(project.brief ?? {})}

Return JSON of shape:
{
  "full_script": "...",
  "director_intent": "...",
  "characters": [
    {"name":"...","description":"...","visual_seed":"locked physical description","wardrobe":"...","personality":"...","gender":"male|female|neutral"}
  ],
  "scenes": [
    {
      "scene_number": 1,
      "script_text": "what happens",
      "visual_prompt": "cinematic prompt for video gen — be visually rich",
      "location": "...",
      "time_of_day": "...",
      "mood": "...",
      "duration_seconds": 8,
      "characters": ["name1"],
      "dialogue": [{"character":"name1","line":"..."}]
    }
  ]
}`,
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`AI error ${aiResp.status}: ${t}`);
    }
    const aiData = await aiResp.json();
    const raw = aiData.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // 2) Lock character bible w/ auto-assigned ElevenLabs voices
    const charInserts = (parsed.characters ?? []).map((c: any, i: number) => {
      const pool = ELEVENLABS_VOICES.filter(v => !c.gender || v.gender === c.gender || c.gender === "neutral");
      const voice = pool[i % Math.max(1, pool.length)] ?? ELEVENLABS_VOICES[0];
      return {
        project_id, user_id: userId,
        name: c.name, description: c.description ?? "",
        visual_seed: c.visual_seed ?? "", wardrobe: c.wardrobe ?? "",
        voice_id: voice.id, voice_name: voice.name,
        personality: c.personality ?? "",
      };
    });
    if (charInserts.length) {
      await supabase.from("movie_character_bible").insert(charInserts);
    }

    // 3) Insert scenes
    const sceneInserts = (parsed.scenes ?? []).map((s: any) => ({
      project_id, user_id: userId,
      scene_number: s.scene_number,
      script_text: s.script_text ?? "",
      visual_prompt: s.visual_prompt ?? s.script_text ?? "",
      location: s.location ?? "",
      time_of_day: s.time_of_day ?? "",
      mood: s.mood ?? "",
      duration_seconds: s.duration_seconds ?? 8,
      characters: s.characters ?? [],
      dialogue: s.dialogue ?? [],
      status: "pending",
    }));
    if (sceneInserts.length) {
      await supabase.from("movie_scenes").insert(sceneInserts);
    }

    // 4) Update project with full script + queue render jobs (one video job per scene)
    await supabase.from("movie_projects").update({
      full_script: parsed.full_script ?? "",
      director_intent: parsed.director_intent ?? "",
      total_scenes: sceneInserts.length,
      status: "queued",
    }).eq("id", project_id);

    // Insert scene-render jobs
    const { data: scenes } = await supabase.from("movie_scenes")
      .select("id, scene_number").eq("project_id", project_id).order("scene_number");
    const jobInserts = (scenes ?? []).map((s, i) => ({
      project_id, scene_id: s.id, user_id: userId,
      job_type: "video", priority: 100 + i,
      payload: { scene_number: s.scene_number },
    }));
    if (jobInserts.length) {
      await supabase.from("movie_render_jobs").insert(jobInserts);
    }

    return new Response(JSON.stringify({
      ok: true, project_id,
      total_scenes: sceneInserts.length,
      total_characters: charInserts.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (e) {
    console.error("[script-chunker]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});

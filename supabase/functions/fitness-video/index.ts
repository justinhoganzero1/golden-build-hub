import { corsHeaders } from "npm:@supabase/supabase-js@2.101.0/cors";
import { createClient } from "npm:@supabase/supabase-js@2.101.0";
import { requireUser } from "../_shared/requireAuth.ts";
import { chooseFitnessVideo, isFreshTemplate, makeFitnessTemplate, normalizeExercise } from "../_shared/fitnessVideo.ts";

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  try {
    const body = await req.json();
    const exercise = typeof body.exercise === "string" ? normalizeExercise(body.exercise) : null;
    if (!exercise) return reply({ error: "Please name a simple exercise, without medical or injury advice." }, 400);
    const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !service) return reply({ error: "Video search is unavailable." }, 503);
    const db = createClient(url, service);
    const { data: cached } = await db.from("fitness_video_templates").select("*").eq("exercise_key", exercise).maybeSingle();
    if (cached && isFreshTemplate(cached)) return reply({ template: cached, cached: true });
    const key = Deno.env.get("YOUTUBE_API_KEY");
    if (!key) return reply({ error: "YouTube search is not connected yet." }, 503);
    const searchParams = new URLSearchParams({ key, part: "snippet", q: `${exercise} proper form beginner exercise tutorial`, type: "video", videoEmbeddable: "true", videoSyndicated: "true", safeSearch: "strict", maxResults: "8", relevanceLanguage: "en" });
    const search = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams}`, { signal: AbortSignal.timeout(12000) });
    if (!search.ok) return reply({ error: "YouTube search is unavailable right now.", providerStatus: search.status }, 502);
    const found = await search.json();
    const ids = (found.items || []).map((v: { id?: { videoId?: string } }) => v.id?.videoId).filter(Boolean).join(",");
    if (!ids) return reply({ error: "No suitable exercise demonstration was found." }, 404);
    const detailParams = new URLSearchParams({ key, part: "snippet,status,contentDetails", id: ids });
    const details = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailParams}`, { signal: AbortSignal.timeout(12000) });
    if (!details.ok) return reply({ error: "YouTube could not verify this video.", providerStatus: details.status }, 502);
    const video = chooseFitnessVideo((await details.json()).items || [], exercise);
    if (!video) return reply({ error: "I couldn't find a suitable embeddable demonstration. Try another exercise." }, 404);
    const template = makeFitnessTemplate(video, exercise);
    const { error } = await db.from("fitness_video_templates").upsert(template);
    return reply({ template, cached: false, saved: !error });
  } catch {
    return reply({ error: "Video search couldn't finish. Please try again." }, 503);
  }
});
// YouTube channel auto-builder: generates branding (banner, avatar, about-section) from
// the user's SOLACE profile data. Returns a manifest the user can download or auto-apply
// once GOOGLE_OAUTH credentials are wired.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { channel_name, niche, vibe } = await req.json();

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: ud } = await userClient.auth.getUser();
    if (!ud?.user) throw new Error("not authenticated");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Pull SOLACE context: their movie projects, diary themes
    const { data: projects } = await supabase.from("movie_projects")
      .select("title, genre, logline").eq("user_id", ud.user.id).limit(10);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a YouTube channel brand strategist. Output ONLY valid JSON." },
          { role: "user", content: `Build a complete YouTube channel brand kit.

Channel: ${channel_name}
Niche: ${niche ?? "AI movies"}
Vibe: ${vibe ?? "cinematic"}
Existing movies: ${JSON.stringify(projects ?? [])}

Return JSON:
{
  "channel_name": "...",
  "handle": "@suggested-handle",
  "tagline": "short hook 60-80 chars",
  "about_section": "300-500 word channel description",
  "banner_prompt": "image gen prompt for 2560x1440 banner",
  "avatar_prompt": "image gen prompt for 800x800 logo",
  "playlist_ideas": [{"title":"...","description":"..."}],
  "first_5_video_titles": ["..."],
  "tags": ["..."],
  "upload_schedule": "..."
}` },
        ],
      }),
    });
    if (!aiResp.ok) throw new Error(`AI ${aiResp.status}: ${await aiResp.text()}`);
    const aiJson = await aiResp.json();
    const raw = aiJson.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
    const brand = JSON.parse(cleaned);

    // Generate banner + avatar via Gemini image
    let bannerUrl = "", avatarUrl = "";
    try {
      const [bRes, aRes] = await Promise.all([
        genImage(brand.banner_prompt, "16:9"),
        genImage(brand.avatar_prompt, "1:1"),
      ]);
      bannerUrl = bRes; avatarUrl = aRes;
    } catch (e) { console.warn("[image gen]", e); }

    return new Response(JSON.stringify({
      ok: true,
      brand: { ...brand, banner_url: bannerUrl, avatar_url: avatarUrl },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (e) {
    console.error("[yt-channel-builder]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});

async function genImage(prompt: string, ratio: string): Promise<string> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: `${prompt}, aspect ratio ${ratio}` }],
      modalities: ["image", "text"],
    }),
  });
  const j = await r.json();
  return j?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? "";
}

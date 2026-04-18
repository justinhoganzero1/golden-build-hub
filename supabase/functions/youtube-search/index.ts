// YouTube Data API v3 search proxy.
// Requires YOUTUBE_API_KEY secret. Returns related/similar videos for a query
// so the YouTube Show Studio can suggest clips, references, and shoutouts.
//
// Input:  { query: string, maxResults?: number, type?: "video" | "channel" }
// Output: { items: [{ videoId, title, channelTitle, channelId, thumbnail, url, publishedAt, description }] }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { query, maxResults = 12, type = "video" } = await req.json() as {
      query?: string; maxResults?: number; type?: string;
    };

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: "query required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const YT_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!YT_KEY) {
      return new Response(JSON.stringify({
        error: "YOUTUBE_API_KEY missing",
        hint: "Add a YouTube Data API v3 key in project secrets to enable YouTube search.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const params = new URLSearchParams({
      part: "snippet",
      q: query.slice(0, 200),
      maxResults: String(Math.min(Math.max(maxResults, 1), 25)),
      type,
      safeSearch: "moderate",
      key: YT_KEY,
    });

    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    if (!r.ok) {
      const t = await r.text();
      console.error("YouTube search failed:", r.status, t);
      return new Response(JSON.stringify({ error: `YouTube ${r.status}: ${t}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await r.json();

    const items = (data.items ?? []).map((it: any) => {
      const vid = it.id?.videoId;
      const cid = it.id?.channelId;
      const sn = it.snippet ?? {};
      return {
        videoId: vid ?? null,
        channelId: cid ?? sn.channelId ?? null,
        title: sn.title ?? "",
        channelTitle: sn.channelTitle ?? "",
        thumbnail: sn.thumbnails?.high?.url ?? sn.thumbnails?.medium?.url ?? sn.thumbnails?.default?.url ?? null,
        publishedAt: sn.publishedAt ?? null,
        description: sn.description ?? "",
        url: vid ? `https://www.youtube.com/watch?v=${vid}` : (cid ? `https://www.youtube.com/channel/${cid}` : null),
      };
    }).filter((i: any) => i.url);

    return new Response(JSON.stringify({ items }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("youtube-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

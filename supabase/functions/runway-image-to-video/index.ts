// Runway image-to-video edge function.
// Activates the moment a RUNWAY_API_KEY secret is added.
// Input:  { image_url: string, prompt?: string, duration?: 5 | 10, ratio?: "1280:768" | "768:1280" }
// Output: { video_url: string }  (Runway-hosted MP4)
//
// If RUNWAY_API_KEY is missing, returns a clear 400 with `error: "RUNWAY_API_KEY missing"`
// so the client can prompt the user to add it via the secrets flow.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image_url, prompt = "", duration = 5, ratio = "1280:768" } =
      await req.json() as { image_url?: string; prompt?: string; duration?: 5 | 10; ratio?: string };

    if (!image_url || typeof image_url !== "string") {
      return new Response(JSON.stringify({ error: "image_url required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const RUNWAY_API_KEY = Deno.env.get("RUNWAY_API_KEY");
    if (!RUNWAY_API_KEY) {
      return new Response(JSON.stringify({
        error: "RUNWAY_API_KEY missing",
        hint: "Add a Runway API key in project secrets to enable real image-to-video generation.",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1) Submit task to Runway (Gen-3 / image_to_video)
    const submit = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RUNWAY_API_KEY}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        promptImage: image_url,
        promptText: prompt.slice(0, 480),
        model: "gen3a_turbo",
        duration,
        ratio,
      }),
    });

    if (!submit.ok) {
      const t = await submit.text();
      console.error("Runway submit failed:", submit.status, t);
      return new Response(JSON.stringify({ error: `Runway submit ${submit.status}: ${t}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const submitJson = await submit.json();
    const taskId: string | undefined = submitJson.id;
    if (!taskId) {
      return new Response(JSON.stringify({ error: "No task id from Runway", raw: submitJson }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) Poll for completion (max ~3 min)
    const startedAt = Date.now();
    while (Date.now() - startedAt < 180_000) {
      await new Promise(r => setTimeout(r, 4000));
      const statusResp = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        headers: {
          Authorization: `Bearer ${RUNWAY_API_KEY}`,
          "X-Runway-Version": "2024-11-06",
        },
      });
      if (!statusResp.ok) continue;
      const sj = await statusResp.json();
      if (sj.status === "SUCCEEDED") {
        const url = Array.isArray(sj.output) ? sj.output[0] : sj.output;
        return new Response(JSON.stringify({ video_url: url }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (sj.status === "FAILED" || sj.status === "CANCELLED") {
        return new Response(JSON.stringify({ error: `Runway task ${sj.status}`, detail: sj.failure || sj.failureCode }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    return new Response(JSON.stringify({ error: "Runway task timed out" }),
      { status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("runway-image-to-video error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

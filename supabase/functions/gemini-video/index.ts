// Gemini Video — free image-to-video via Lovable AI Gateway (Veo / Gemini Video).
// Input:  { image_url: string, prompt?: string, duration?: 5 | 10, ratio?: "16:9" | "9:16" }
// Output: { video_url: string }
//
// Uses LOVABLE_API_KEY (auto-provisioned). No external secret required.
// Polls the long-running operation until the MP4 is available.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function fetchAsBase64(url: string): Promise<{ data: string; mime: string }> {
  if (url.startsWith("data:")) {
    const m = url.match(/^data:([^;]+);base64,(.*)$/);
    if (!m) throw new Error("Invalid data URL");
    return { mime: m[1], data: m[2] };
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Image fetch ${r.status}`);
  const mime = r.headers.get("content-type") || "image/png";
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return { mime, data: btoa(bin) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { image_url, prompt = "", duration = 5, ratio = "16:9" } =
      await req.json() as { image_url?: string; prompt?: string; duration?: 5 | 10; ratio?: "16:9" | "9:16" };

    if (!image_url) return json({ error: "image_url required" }, 400);

    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    // Encode source image
    const { data: imgB64, mime } = await fetchAsBase64(image_url);

    // Use Lovable AI Gateway → Gemini Video (Veo). Endpoint mirrors Google's predictLongRunning.
    const submit = await fetch("https://ai.gateway.lovable.dev/v1beta/models/veo-3.0-generate-001:predictLongRunning", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{
          prompt: (prompt || "Cinematic motion, smooth camera movement").slice(0, 480),
          image: { bytesBase64Encoded: imgB64, mimeType: mime },
        }],
        parameters: {
          aspectRatio: ratio,
          durationSeconds: duration,
          personGeneration: "allow_all",
          sampleCount: 1,
        },
      }),
    });

    if (!submit.ok) {
      const t = await submit.text();
      console.error("gemini-video submit failed", submit.status, t);
      if (submit.status === 429) return json({ error: "Rate limit. Try again shortly." }, 429);
      if (submit.status === 402) return json({ error: "AI credits exhausted. Add credits in Lovable → Settings → Workspace → Usage." }, 402);
      return json({ error: `Gemini Video submit ${submit.status}: ${t.slice(0, 300)}` }, 502);
    }
    const sj = await submit.json();
    const opName: string | undefined = sj.name;
    if (!opName) return json({ error: "No operation name from Gemini Video", raw: sj }, 502);

    // Poll for completion (up to ~3 min)
    const start = Date.now();
    while (Date.now() - start < 180_000) {
      await new Promise(r => setTimeout(r, 5000));
      const op = await fetch(`https://ai.gateway.lovable.dev/v1beta/${opName}`, {
        headers: { Authorization: `Bearer ${KEY}` },
      });
      if (!op.ok) continue;
      const oj = await op.json();
      if (oj.done) {
        const vids = oj.response?.generatedVideos || oj.response?.videos || [];
        const first = vids[0];
        const url: string | undefined =
          first?.video?.uri || first?.uri || first?.video?.url || first?.url;
        if (!url) return json({ error: "Gemini Video returned no URL", raw: oj }, 502);
        // The Veo URL requires the API key as a query param to download. Pass it through verbatim
        // — front-end uses it inside <video src=...> which won't work for protected URLs. So we
        // proxy-fetch and return a base64 data URL OR just return the signed URL when public.
        // Simplest: fetch and return as data URL (small clips).
        try {
          const dl = await fetch(url.includes("?") ? `${url}&key=${KEY}` : `${url}?key=${KEY}`);
          if (dl.ok) {
            const buf = new Uint8Array(await dl.arrayBuffer());
            let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
            const dataUrl = `data:video/mp4;base64,${btoa(bin)}`;
            return json({ video_url: dataUrl });
          }
        } catch (_) { /* fall through */ }
        return json({ video_url: url });
      }
      if (oj.error) return json({ error: oj.error.message || "Gemini Video failed" }, 502);
    }
    return json({ error: "Gemini Video timed out" }, 504);
  } catch (e) {
    console.error("gemini-video error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

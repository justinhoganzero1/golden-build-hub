// Oracle Research — web search + AI synthesis to solve any problem.
// Uses Firecrawl search to fetch live results, then Lovable AI to summarize
// into an actionable answer. Returns { answer, sources[] }.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { query, context } = await req.json();
    if (!query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "query required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FIRECRAWL = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE) throw new Error("LOVABLE_API_KEY missing");

    let sources: { url: string; title?: string; description?: string; markdown?: string }[] = [];

    if (FIRECRAWL) {
      try {
        const fr = await fetch("https://api.firecrawl.dev/v2/search", {
          method: "POST",
          headers: { Authorization: `Bearer ${FIRECRAWL}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            query, limit: 5,
            scrapeOptions: { formats: ["markdown"] },
          }),
        });
        const fd = await fr.json().catch(() => ({}));
        const arr = fd?.data || fd?.web?.results || [];
        sources = (Array.isArray(arr) ? arr : []).slice(0, 5).map((s: any) => ({
          url: s.url, title: s.title, description: s.description,
          markdown: (s.markdown || "").slice(0, 4000),
        }));
      } catch (e) { console.warn("firecrawl failed", e); }
    }

    const sourceText = sources.length
      ? sources.map((s, i) => `[${i + 1}] ${s.title || s.url}\n${s.url}\n${s.markdown || s.description || ""}`).join("\n\n---\n\n")
      : "(no live web results — answer from your training knowledge)";

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are the Oracle's research assistant. Solve the user's problem using the live web sources provided. Be concise, actionable, step-by-step. Cite sources as [1], [2] etc." },
          { role: "user", content: `Problem / Question:\n${query}\n\n${context ? `App context:\n${context}\n\n` : ""}Live web sources:\n${sourceText}` },
        ],
      }),
    });
    const ai = await aiRes.json();
    if (!aiRes.ok) throw new Error(ai?.error?.message || "AI failed");
    const answer = ai.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({
      answer,
      sources: sources.map(({ url, title, description }) => ({ url, title, description })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("oracle-research error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

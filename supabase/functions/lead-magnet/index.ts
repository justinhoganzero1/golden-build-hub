import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOOLS: Record<string, { system: string; userTpl: (p: string) => string }> = {
  "ai-name": {
    system: "You are a creative naming expert. Return ONLY 5 brandable names, one per line, no commentary, no numbers.",
    userTpl: (p) => `Generate 5 catchy, brandable names for: ${p}`,
  },
  "logo-idea": {
    system: "You are a brand designer. Return ONLY 3 visual logo concepts, each 1-2 sentences, one per line.",
    userTpl: (p) => `Suggest 3 logo concepts for: ${p}`,
  },
  "horoscope": {
    system: "You are a warm, encouraging cosmic guide. Return a 3-4 sentence personal horoscope. Uplifting, specific, never vague.",
    userTpl: (p) => `Today's horoscope for someone who is: ${p}`,
  },
  "biz-idea": {
    system: "You are a startup advisor. Return ONE concrete business idea (2-3 sentences) tailored to the input. No bullet lists.",
    userTpl: (p) => `Suggest a unique business idea for someone with skills/interests: ${p}`,
  },
  "tagline": {
    system: "You are a copywriter. Return 5 punchy taglines under 10 words each, one per line, no quotes.",
    userTpl: (p) => `Generate 5 taglines for: ${p}`,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { tool, prompt } = await req.json();
    if (!tool || !prompt) return new Response(JSON.stringify({ error: "tool and prompt required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const cfg = TOOLS[tool];
    if (!cfg) return new Response(JSON.stringify({ error: "Unknown tool" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (prompt.length > 500) return new Response(JSON.stringify({ error: "Prompt too long" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: cfg.system },
          { role: "user", content: cfg.userTpl(prompt) },
        ],
      }),
    });
    if (!r.ok) {
      if (r.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (r.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`gateway ${r.status}`);
    }
    const data = await r.json();
    const result = data.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("lead-magnet error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

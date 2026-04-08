import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, content } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let systemPrompt = "";

    if (type === "investment") {
      systemPrompt = `You are an AI investment analyst. Analyze the following investment offer and provide:
1. A legitimacy score from 0-100 (0 = likely spam/scam, 100 = highly legitimate)
2. Brief analysis notes (2-3 sentences max)
3. Whether this appears to be a real investment inquiry

Respond in JSON format: {"score": number, "notes": "string", "is_legitimate": boolean}

Be skeptical of vague offers, unrealistic amounts, or spam-like language. Look for specific details, professional tone, and realistic investment terms.`;
    } else if (type === "comment") {
      systemPrompt = `You are an AI content moderator. Analyze the following comment for:
1. Appropriateness (no hate speech, harassment, spam, or inappropriate content)
2. Whether it should be approved, flagged for review, or rejected

Respond in JSON format: {"approved": boolean, "notes": "string"}

Be permissive of constructive feedback, praise, and genuine questions. Reject spam, hate speech, harassment, and obviously inappropriate content.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: "Could not parse AI response" };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Moderation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

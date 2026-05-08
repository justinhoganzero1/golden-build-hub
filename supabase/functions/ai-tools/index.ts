import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkJailbreak } from "../_shared/jailbreakGuard.ts";

const ADMIN_EMAIL = "justinbretthogan@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, prompt, model: modelOverride, maxTokens } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // 🛡️ JAILBREAK GUARD
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    let userId: string | null = null;
    let userEmail: string | null = null;
    if (token && SUPABASE_URL && SERVICE_KEY) {
      try {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
        const { data } = await admin.auth.getUser(token);
        userId = data?.user?.id ?? null;
        userEmail = data?.user?.email ?? null;
      } catch (_) { /* ignore */ }
    }
    const guard = await checkJailbreak({
      userId, userEmail,
      isOwner: userEmail?.toLowerCase() === ADMIN_EMAIL,
      message: prompt,
    });
    if (guard.blocked) {
      return new Response(JSON.stringify({
        result: guard.message,
        security: { warning_number: guard.warningNumber, account_deleted: guard.deleted },
      }), {
        status: guard.deleted ? 410 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompts: Record<string, string> = {
      "email": "You are an expert email marketing copywriter. Generate professional, engaging email campaigns. Return a JSON object with keys: subject, preheader, body (as HTML), cta_text.",
      "social": "You are a social media expert. Generate engaging social media posts. Return a JSON object with keys: platform, content, hashtags (array), best_time.",
      "ad": "You are an advertising creative director. Generate ad copy. Return a JSON object with keys: headline, body, cta, target_audience.",
      "seo": "You are an SEO expert. Analyze content and provide SEO recommendations. Return a JSON object with keys: title_tag, meta_description, keywords (array), suggestions (array).",
      "assistant": "You are a highly capable personal assistant AI. Help the user with tasks, planning, organization, and productivity. Be concise and actionable.",
    };

    const systemPrompt = systemPrompts[type] || systemPrompts["assistant"];
    const wantJson = ["email", "social", "ad", "seo"].includes(type);

    const body: any = {
      model: modelOverride || "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    };
    if (typeof maxTokens === "number" && maxTokens > 0) {
      body.max_tokens = maxTokens;
    }

    if (wantJson) {
      body.messages[0].content += "\n\nIMPORTANT: Return ONLY valid JSON, no markdown code fences.";
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI tools error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";

    // Try to parse JSON if expected
    if (wantJson) {
      try {
        content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify({ result: parsed }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        // Return raw text if JSON parsing fails
      }
    }

    return new Response(JSON.stringify({ result: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-tools error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

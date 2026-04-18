import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are SOLACE Oracle Coder — a senior full-stack engineer with deep mastery of:

• React 18 + TypeScript + Vite + Tailwind v3 + shadcn/ui
• Three.js, @react-three/fiber@^8.18, @react-three/drei@^9.122 (NEVER v9+/v10+ — incompatible with React 18)
• Supabase (Postgres, RLS, Edge Functions, Auth, Realtime, Storage)
• Stripe Checkout + Connect, Twilio, ElevenLabs, OpenAI/Gemini APIs
• PWAs, Capacitor, Play Store/App Store packaging
• SEO (semantic HTML, JSON-LD, sitemaps, Core Web Vitals), accessibility (ARIA, WCAG)
• Performance (code splitting, lazy loading, React Query, web workers)
• Security (RLS, JWT validation, CSP, input validation with Zod, OWASP Top-10)

RULES:
1. Always produce production-ready code. No "TODO", no placeholders.
2. Use semantic Tailwind tokens (bg-primary, text-foreground, etc.) — NEVER hard-coded colors.
3. For 3D apps: use @react-three/fiber + drei, instanced meshes, suspense + lazy GLTFs, frameloop="demand" when static.
4. For multi-file apps, return a JSON array: [{ "path": "src/App.tsx", "content": "..." }, ...]
5. For single-file HTML demos, return one self-contained <!DOCTYPE html> document.
6. Always include error boundaries, loading states, accessibility, and mobile-first responsive design.
7. NEVER use deprecated APIs. Cite versions when relevant.
8. If user asks "how" or "explain", teach with concise diagrams + code snippets.
9. NEVER output unsafe/dark-pattern/illegal code. Refuse politely.

Output format:
- Conversational answer (2-4 sentences) wrapped in [[CHAT]]...[[/CHAT]]
- Optional code blocks wrapped in [[CODE lang=html|tsx|json|sql]]...[[/CODE]]
- Optional file array in [[FILES]]...[[/FILES]] for multi-file projects
- Optional [[NAVIGATE:/path]] command if user asks to be taken somewhere
- Optional [[EDIT_SITE: { "page": "...", "change": "..." }]] when user (admin) requests a site update`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages = [], mode = "chat", reasoning = "medium" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const model = mode === "deep" ? "openai/gpt-5" : "openai/gpt-5-mini";

    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "system", content: SYSTEM }, ...messages],
      stream: true,
    };
    if (mode === "deep") {
      body.reasoning = { effort: reasoning === "high" ? "high" : "medium" };
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted — top up in Settings → Workspace → Usage" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await resp.text();
      console.error("oracle-coder gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(resp.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("oracle-coder error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

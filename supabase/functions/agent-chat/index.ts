// Multi-agent chat: streams from Lovable AI Gateway. Picks model by agent id.
// Two agents: "nova" (GPT-5.5, sharp/analytical) and "lyra" (Gemini 3.5 Flash, warm/creative).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkJailbreak, latestUserMessage } from "../_shared/jailbreakGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "justinbretthogan@gmail.com";
const FREE_DAILY_LIMIT = 25;

type AgentId = "nova" | "lyra";

const AGENTS: Record<AgentId, {
  model: string; system: string; name: string;
  byokEndpoint: string; byokModel: string; keyColumn: "openai_key" | "gemini_key"; providerName: string;
}> = {
  nova: {
    name: "Nova",
    model: "openai/gpt-5.5",
    // When the user brings their own OpenAI key, we call OpenAI directly with a widely-available model.
    byokEndpoint: "https://api.openai.com/v1/chat/completions",
    byokModel: "gpt-4o-mini",
    keyColumn: "openai_key",
    providerName: "OpenAI",
    system: `You are Nova, an AI agent inside Oracle Lunar. You run on OpenAI GPT models.
Personality: sharp, precise, analytical, calm and confident. You are the "thinker" — great at reasoning, code, structured analysis, planning, careful writing.
Style: clear, well-structured answers. Use markdown headings and lists when it helps. Never waffle. If uncertain, say so and give your best estimate with a confidence level.
Never pretend to be ChatGPT — you are "Nova inside Oracle Lunar".
Never break character. Never generate images/audio/video (tell the user to open Photography Hub / Voice Studio / Media Library).`,
  },
  lyra: {
    name: "Lyra",
    model: "google/gemini-3.5-flash",
    // Gemini exposes an OpenAI-compatible endpoint; users bring their own Google AI Studio key.
    byokEndpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    byokModel: "gemini-2.5-flash",
    keyColumn: "gemini_key",
    providerName: "Google Gemini",
    system: `You are Lyra, an AI agent inside Oracle Lunar. You run on Google Gemini models.
Personality: warm, fast, curious, creative and playful. You are the "muse" — great at brainstorming, storytelling, quick ideas, emotional tone, wide-open exploration.
Style: friendly and conversational, light markdown, uses vivid language. Short paragraphs, keep the energy up.
Never pretend to be Bard or Google Assistant — you are "Lyra inside Oracle Lunar".
Never break character. Never generate images/audio/video directly — point users to Photography Hub / Voice Studio / Media Library.`,
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { agent, messages } = await req.json();
    if (!agent || !(agent in AGENTS)) {
      return new Response(JSON.stringify({ error: "Unknown agent" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    let userId: string | null = null;
    let userEmail: string | null = null;

    if (token && SUPABASE_URL && SERVICE_KEY) {
      try {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
        const { data: userData } = await admin.auth.getUser(token);
        userId = userData?.user?.id ?? null;
        userEmail = userData?.user?.email ?? null;

        if (userId) {
          const isAdmin = userEmail?.toLowerCase() === ADMIN_EMAIL;
          let serverSubscribed = false;
          try {
            const { data: grantRows } = await admin
              .from("reward_grants")
              .select("reward_type, reason, expires_at, active")
              .eq("user_id", userId)
              .eq("active", true)
              .gt("expires_at", new Date().toISOString())
              .limit(5);
            serverSubscribed = !!(grantRows || []).some((g: any) =>
              ["free_for_life", "unlimited_ai", "lifetime", "tier3_trial"].includes(g.reward_type) ||
              g.reason === "free_for_life"
            );
          } catch (_) { /* fall through */ }

          if (!isAdmin && !serverSubscribed) {
            const { data: rpcData, error: rpcErr } = await admin.rpc("increment_oracle_usage", {
              _user_id: userId,
              _limit: FREE_DAILY_LIMIT,
            });
            if (!rpcErr && rpcData && rpcData.length > 0) {
              const row = rpcData[0] as { new_count: number; over_limit: boolean; daily_limit: number };
              if (row.over_limit) {
                return new Response(JSON.stringify({
                  error: "free_limit_reached",
                  message: `Daily free agent limit reached (${FREE_DAILY_LIMIT}). Upgrade for unlimited chat.`,
                }), {
                  status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            }
          }
        }
      } catch (e) {
        console.warn("Auth check skipped:", e);
      }
    }

    // Jailbreak guard on latest user message
    const lastMsg = latestUserMessage(messages);
    const guard = await checkJailbreak({
      userId, userEmail,
      isOwner: userEmail?.toLowerCase() === ADMIN_EMAIL,
      message: lastMsg,
    });
    if (guard.blocked) {
      return new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", content: guard.message } }],
        security: { warning_number: guard.warningNumber, account_deleted: guard.deleted },
      }), {
        status: guard.deleted ? 410 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cfg = AGENTS[agent as AgentId];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        stream: true,
        messages: [
          { role: "system", content: cfg.system },
          ...messages.slice(-20),
        ],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await resp.text().catch(() => "");
      console.error("agent-chat gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: `AI provider error (${resp.status})` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(resp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("agent-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

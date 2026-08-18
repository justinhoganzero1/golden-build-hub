// Multi-agent chat: streams from Lovable AI Gateway. Picks model by agent id.
// Two agents: "nova" (GPT-5.5, sharp/analytical) and "lyra" (Gemini 3.5 Flash, warm/creative).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkJailbreak, latestUserMessage } from "../_shared/jailbreakGuard.ts";
import { chargeAI, InsufficientCoinsError, insufficientCoinsResponse } from "../_shared/wallet.ts";
import { PROVIDER_RATES } from "../_shared/pricing.ts";


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
    // Hard auth gate: never touch the paid gateway for anonymous callers.
    const auth = await requireUser(req);
    if (auth.response) return auth.response;
    const authedUser = auth.user;

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

    const rateLimited = await enforceRateLimit(req, authedUser, "agent-chat", { limit: 30, windowSeconds: 60 });
    if (rateLimited) return rateLimited;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let userId: string | null = authedUser.id;
    let userEmail: string | null = authedUser.email;
    let userKey: string | null = null;

    const cfg = AGENTS[agent as AgentId];

    if (SUPABASE_URL && SERVICE_KEY) {

      try {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
        const { data: userData } = await admin.auth.getUser(token);
        userId = userData?.user?.id ?? null;
        userEmail = userData?.user?.email ?? null;

        if (userId) {
          // Look up this user's own provider key.
          const { data: keyRow } = await admin
            .from("user_ai_keys")
            .select(cfg.keyColumn)
            .eq("user_id", userId)
            .maybeSingle();
          const raw = (keyRow as any)?.[cfg.keyColumn];
          if (typeof raw === "string" && raw.trim().length > 10) userKey = raw.trim();

          // Only enforce free-daily-limit when falling back to Lovable Gateway (your credits).
          // When user brings their own key, they pay their provider directly — no gating.
          if (!userKey) {
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
                    message: `Daily free agent limit reached (${FREE_DAILY_LIMIT}). Add your own ${cfg.providerName} API key in Agent Settings for unlimited use on your own account.`,
                  }), {
                    status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
                  });
                }
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

    // Route the request: user's own key → direct provider; otherwise → Lovable Gateway.
    const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

    const callProvider = (useByok: boolean) => fetch(
      useByok ? cfg.byokEndpoint : GATEWAY,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${useByok ? userKey : LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: useByok ? cfg.byokModel : cfg.model,
          stream: true,
          messages: [
            { role: "system", content: cfg.system },
            ...messages.slice(-20),
          ],
        }),
      },
    );

    let usedByok = !!userKey;
    let resp = await callProvider(usedByok);

    // BYOK key exhausted / rate limited / rejected → transparently fall back to the
    // gateway. The fallback runs on PLATFORM credit, so it must be billed to the
    // user's wallet — otherwise a deliberately-broken BYOK key buys free compute.
    if (usedByok && !resp.ok && [401, 402, 403, 429].includes(resp.status)) {
      const detail = await resp.text().catch(() => "");
      console.warn("BYOK key failed, falling back to gateway:", resp.status, detail.slice(0, 120).replace(/[A-Za-z0-9_-]{20,}/g, "[redacted]"));

      if (userId) {
        try {
          await chargeAI(userId, "agent-chat", PROVIDER_RATES.lovable_ai_gemini_flash_per_call, {
            provider: "lovable-ai",
            model: cfg.model,
            reason: "byok_fallback",
          });
        } catch (billErr) {
          if (billErr instanceof InsufficientCoinsError) return insufficientCoinsResponse(billErr, corsHeaders);
          console.error("agent-chat fallback billing error:", billErr);
        }
      }

      usedByok = false;
      resp = await callProvider(false);
    }


    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (resp.status === 401 || resp.status === 403) {
        return new Response(JSON.stringify({
          error: userKey
            ? `Your ${cfg.providerName} API key was rejected. Please re-check it in Agent Settings.`
            : "AI credits exhausted."
        }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

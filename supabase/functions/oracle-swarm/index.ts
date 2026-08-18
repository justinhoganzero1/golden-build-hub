// Oracle Swarm — runs a bounded swarm of specialist AI agents on one objective,
// then a lead synthesizer merges their findings into a single build plan/report.
// Billed per agent through the two-phase wallet (authorize -> settle) and the
// final report is saved into the caller's own media library.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser, enforceRateLimit } from "../_shared/requireAuth.ts";
import { authorizeAI, settleAI, cancelAI, InsufficientCoinsError } from "../_shared/wallet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Provider cost estimate per agent pass, in cents. The wallet adds the platform
// margin on top — users always pay 100% of provider cost plus the margin floor.
const AGENT_COST_CENTS = 2;
const MIN_AGENTS = 3;
const MAX_AGENTS = 12;

const ROLES = [
  { key: "architect", title: "Architect", brief: "Break the objective into a concrete build plan: components, data, and order of work." },
  { key: "builder", title: "Builder", brief: "Write the actual content/assets/copy or step-by-step build output the user asked for." },
  { key: "critic", title: "Critic", brief: "Attack the plan: find flaws, missing pieces, and risky assumptions. Be blunt." },
  { key: "researcher", title: "Researcher", brief: "Supply facts, references, market context and comparable examples." },
  { key: "designer", title: "Designer", brief: "Define the visual/UX direction: layout, tone, colour, motion, typography." },
  { key: "monetizer", title: "Monetizer", brief: "Define pricing, upsells, conversion path and revenue per user." },
  { key: "marketer", title: "Marketer", brief: "Write the launch angle, hooks, headlines and distribution plan." },
  { key: "qa", title: "QA", brief: "List the exact tests and acceptance checks that prove this works end to end." },
  { key: "security", title: "Security", brief: "Identify abuse, privacy, payment-bypass and data-exposure risks plus mitigations." },
  { key: "growth", title: "Growth", brief: "Find the loops that get this in front of thousands of people fast." },
  { key: "editor", title: "Editor", brief: "Tighten everything: remove filler, fix structure, make it publishable." },
  { key: "operator", title: "Operator", brief: "Define who does what next, with a timeline and the first 3 actions." },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callAgent(role: { title: string; brief: string }, objective: string, context: string, key: string) {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: `You are the ${role.title} agent inside the Oracle Lunar swarm. ${role.brief} Answer only from your role's angle. Be specific and useful — no preamble, no disclaimers. Max 400 words, markdown bullets.`,
        },
        { role: "user", content: `Objective:\n${objective}\n\n${context ? `Context:\n${context}` : ""}` },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { title: role.title, ok: false, content: data?.error?.message || `agent failed (${res.status})`, status: res.status };
  }
  return { title: role.title, ok: true, content: data?.choices?.[0]?.message?.content || "", status: 200 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let transactionId: string | null = null;
  try {
    const auth = await requireUser(req);
    if (auth.response) return auth.response;
    const rl = await enforceRateLimit(req, auth.user, "oracle-swarm");
    if (rl) return rl;

    const body = await req.json().catch(() => ({}));
    const objective = typeof body.objective === "string" ? body.objective.trim() : "";
    const context = typeof body.context === "string" ? body.context.slice(0, 4000) : "";
    const requested = Number(body.agents);
    const agentCount = Math.min(MAX_AGENTS, Math.max(MIN_AGENTS, Number.isFinite(requested) ? Math.round(requested) : 5));

    if (!objective) return json({ error: "objective required" }, 400);

    const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE) return json({ error: "AI gateway not configured" }, 500);

    // +1 for the lead synthesizer pass.
    const passes = agentCount + 1;
    const requestKey = `swarm:${auth.user.id}:${body.requestKey || crypto.randomUUID()}`;

    try {
      const authz = await authorizeAI(
        auth.user.id,
        requestKey,
        "oracle-swarm",
        "lovable",
        MODEL,
        AGENT_COST_CENTS * passes,
        { agents: agentCount, objective: objective.slice(0, 200) },
      );
      transactionId = authz.transaction_id;
      if (authz.duplicate) {
        return json({ error: "This swarm run was already submitted.", code: "duplicate" }, 409);
      }
    } catch (e) {
      if (e instanceof InsufficientCoinsError) {
        return json(
          { error: "Not enough coins for this swarm.", code: "insufficient_funds", needed_cents: e.needed_cents, balance_cents: e.balance_cents },
          402,
        );
      }
      throw e;
    }

    const roles = ROLES.slice(0, agentCount);
    const results = await Promise.all(roles.map((r) => callAgent(r, objective, context, LOVABLE)));
    const okResults = results.filter((r) => r.ok && r.content);

    if (okResults.length === 0) {
      const blocked = results.find((r) => r.status === 402 || r.status === 429);
      await cancelAI(transactionId!, "swarm_all_agents_failed").catch(() => {});
      transactionId = null;
      return json({ error: blocked?.content || "All swarm agents failed.", code: "swarm_failed" }, blocked?.status || 502);
    }

    const digest = okResults.map((r) => `## ${r.title}\n${r.content}`).join("\n\n");
    const leadRes = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are the Oracle, lead of the swarm. Merge your agents' reports into ONE decisive deliverable for the user: a short verdict, the finished build/plan, then 'Next actions' as a numbered list the Oracle can execute itself. Resolve contradictions — do not list them. Markdown.",
          },
          { role: "user", content: `Objective:\n${objective}\n\nAgent reports:\n${digest}` },
        ],
      }),
    });
    const leadData = await leadRes.json().catch(() => ({}));
    const synthesis = leadRes.ok ? leadData?.choices?.[0]?.message?.content || digest : digest;

    // Settle for the passes that actually ran (successful agents + lead pass).
    const actualPasses = okResults.length + (leadRes.ok ? 1 : 0);
    let billed = 0;
    try {
      const settled = await settleAI(
        transactionId!,
        AGENT_COST_CENTS * actualPasses,
        undefined,
        [{ unit_type: "request", quantity: actualPasses }],
        { agents_ran: okResults.length, agents_failed: results.length - okResults.length },
      );
      billed = settled.total_billed_cents;
    } finally {
      transactionId = null;
    }

    // Save the deliverable into the caller's own library.
    let libraryId: string | null = null;
    try {
      const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
        auth: { persistSession: false },
      });
      const { data } = await svc.rpc("save_library_item_for_user", {
        _user_id: auth.user.id,
        _media_type: "document",
        _title: `Swarm: ${objective.slice(0, 60)}`,
        _url: `data:text/markdown;base64,${btoa(unescape(encodeURIComponent(synthesis)))}`,
        _source_page: "/oracle",
        _thumbnail_url: null,
        _metadata: { kind: "swarm_report", agents: okResults.map((r) => r.title), objective },
        _is_public: false,
      });
      libraryId = typeof data === "string" ? data : data?.[0] ?? null;
    } catch (e) {
      console.warn("swarm library save failed", e);
    }

    return json({
      synthesis,
      agents: results.map((r) => ({ title: r.title, ok: r.ok, content: r.content })),
      billed_cents: billed,
      library_id: libraryId,
    });
  } catch (e) {
    if (transactionId) await cancelAI(transactionId, "swarm_error").catch(() => {});
    console.error("oracle-swarm error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

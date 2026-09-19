// Oracle Council — every AI agent in Oracle Lunar answers the same question,
// they read each other's answers, debate, and the Oracle delivers one final
// best answer. Replaces the separate Nova / Lyra / Companion / Tutor tabs.
//
// Flow:
//   round 1  — each council member answers independently (parallel)
//   round 2  — each member critiques the others and revises (parallel)
//   verdict  — the Oracle merges everything into one answer in her own voice
//
// Billed through the two-phase wallet like every other AI path.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser, enforceRateLimit } from "../_shared/requireAuth.ts";
import { authorizeAI, settleAI, cancelAI, InsufficientCoinsError } from "../_shared/wallet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const FAST_MODEL = "google/gemini-3.6-flash";
const DEEP_MODEL = "openai/gpt-5.5";

// Provider cost estimate per model pass, in cents. The wallet adds the
// platform margin on top so the user always covers 100% of cost + margin.
const PASS_COST_CENTS = 1;

type Member = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  model: string;
  role: string;
};

const COUNCIL: Member[] = [
  {
    id: "nova",
    name: "Nova",
    emoji: "🧠",
    color: "#38bdf8",
    model: DEEP_MODEL,
    role:
      "the analyst. Sharp, precise, logical. You care about facts, reasoning, structure, code correctness and whether the plan actually works. You call out flawed logic bluntly but politely.",
  },
  {
    id: "lyra",
    name: "Lyra",
    emoji: "✨",
    color: "#f59e0b",
    model: FAST_MODEL,
    role:
      "the muse. Fast, warm, creative, lateral. You find the angle nobody else saw, the simpler idea, the better story, the more human way to say it.",
  },
  {
    id: "sage",
    name: "Sage",
    emoji: "📚",
    color: "#34d399",
    model: FAST_MODEL,
    role:
      "the teacher. You make the answer understandable and actionable: plain words, steps in order, what to do first, what the person needs to know to not get stuck.",
  },
  {
    id: "companion",
    name: "Kai",
    emoji: "💛",
    color: "#f472b6",
    model: FAST_MODEL,
    role:
      "the companion. You listen for what the person actually needs emotionally — pressure, worry, excitement — and make sure the answer treats them like a friend, not a ticket.",
  },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callModel(model: string, system: string, user: string, key: string) {
  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false as const,
        status: res.status,
        content: data?.message || data?.error?.message || `failed (${res.status})`,
      };
    }
    return {
      ok: true as const,
      status: 200,
      content: (data?.choices?.[0]?.message?.content as string) || "",
    };
  } catch (e) {
    return { ok: false as const, status: 0, content: e instanceof Error ? e.message : "network error" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let transactionId: string | null = null;
  try {
    const auth = await requireUser(req);
    if (auth.response) return auth.response;
    const rl = await enforceRateLimit(req, auth.user, "oracle-council", { limit: 12, windowSeconds: 60 });
    if (rl) return rl;

    const body = await req.json().catch(() => ({}));
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 6000) : "";
    const history = typeof body.history === "string" ? body.history.slice(0, 4000) : "";
    const oracleName = typeof body.oracleName === "string" && body.oracleName.trim()
      ? body.oracleName.trim().slice(0, 40)
      : "Oracle";
    const debate = body.debate !== false; // round 2 on by default

    if (!question) return json({ error: "question is required" }, 400);

    const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE) return json({ error: "AI gateway not configured" }, 500);

    const passes = COUNCIL.length * (debate ? 2 : 1) + 1; // members (+debate) + verdict
    const requestKey = `council:${auth.user.id}:${body.requestKey || crypto.randomUUID()}`;

    try {
      const authz = await authorizeAI(
        auth.user.id,
        requestKey,
        "oracle-council",
        "lovable",
        FAST_MODEL,
        PASS_COST_CENTS * passes,
        { members: COUNCIL.length, debate, question: question.slice(0, 200) },
      );
      transactionId = authz.transaction_id;
      if (authz.duplicate) return json({ error: "duplicate_request" }, 409);
    } catch (e) {
      if (e instanceof InsufficientCoinsError) {
        return json(
          {
            error: "insufficient_coins",
            message: "You need a little more credit for the full council to meet.",
            needed_cents: e.needed_cents,
            balance_cents: e.balance_cents,
          },
          402,
        );
      }
      throw e;
    }

    const context = `${history ? `Recent conversation:\n${history}\n\n` : ""}The person asks:\n${question}`;

    const baseRules = `You are part of the Oracle Council inside Oracle Lunar, an AI companion app.
Answer the person's question from your own angle. Be specific and useful — no praise, no preamble, no restating the question.
Max 220 words. Plain markdown. Never mention that you are one of several agents.`;

    // ── Round 1: independent answers ──
    const round1 = await Promise.all(
      COUNCIL.map((m) =>
        callModel(
          m.model,
          `${baseRules}\n\nYou are ${m.name}, ${m.role}`,
          context,
          LOVABLE,
        ).then((r) => ({ member: m, ...r })),
      ),
    );

    const answered = round1.filter((r) => r.ok && r.content.trim());
    if (answered.length === 0) {
      const blocked = round1.find((r) => r.status === 402 || r.status === 403 || r.status === 429);
      await cancelAI(transactionId!, "council_all_members_failed").catch(() => {});
      transactionId = null;
      if (blocked?.status === 402) {
        return json({ error: "insufficient_coins", message: "Add a little credit to keep the council running." }, 402);
      }
      return json({ error: "council_failed", message: "The council could not reach the AI service. Try again." }, 502);
    }

    const transcript1 = answered
      .map((r) => `### ${r.member.name}\n${r.content.trim()}`)
      .join("\n\n");

    // ── Round 2: they read each other and revise ──
    let round2: { member: Member; content: string }[] = [];
    if (debate && answered.length > 1) {
      const revised = await Promise.all(
        answered.map((r) =>
          callModel(
            r.member.model,
            `You are ${r.member.name}, ${r.member.role}
You have now read what the rest of the Oracle Council said. Respond with two short parts, in markdown:
**Where they're wrong or thin:** one or two sharp points (name the member).
**My revised take:** your improved answer to the person, incorporating anything the others got right.
Max 180 words total. No praise, no preamble.`,
            `${context}\n\nThe council's first answers:\n${transcript1}\n\nYour own first answer was:\n${r.content.trim()}`,
            LOVABLE,
          ).then((x) => ({ member: r.member, ok: x.ok, content: x.content })),
        ),
      );
      round2 = revised.filter((r) => r.ok && r.content.trim()).map((r) => ({ member: r.member, content: r.content.trim() }));
    }

    const debateDigest = round2.length
      ? `\n\nThe council then debated:\n${round2.map((r) => `### ${r.member.name}\n${r.content}`).join("\n\n")}`
      : "";

    // ── Verdict: the Oracle speaks as one voice ──
    const verdict = await callModel(
      DEEP_MODEL,
      `You are ${oracleName}, the Oracle of Oracle Lunar — the person's AI best friend.
Your council of specialists has answered and debated the person's question. Deliver the single best final answer.
Rules:
- Speak in your own warm first-person voice, directly to the person. Never mention a council, agents, members, rounds or this process.
- Take the strongest point from each, resolve their disagreements, drop everything weak or repeated.
- Be concrete and actionable. Use short paragraphs and markdown lists where they help.
- If the council disagreed on something that genuinely matters, say plainly which way you'd go and why.`,
      `${context}\n\nThe council's answers:\n${transcript1}${debateDigest}`,
      LOVABLE,
    );

    const actualPasses = answered.length + round2.length + (verdict.ok ? 1 : 0);
    let billed = 0;
    try {
      const settled = await settleAI(
        transactionId!,
        PASS_COST_CENTS * actualPasses,
        undefined,
        [{ unit_type: "request", quantity: actualPasses }],
        { members_ran: answered.length, debated: round2.length },
      );
      billed = settled.total_billed_cents;
    } finally {
      transactionId = null;
    }

    const fallback = answered[0]?.content?.trim() || "";

    return json({
      answer: verdict.ok && verdict.content.trim() ? verdict.content.trim() : fallback,
      panel: answered.map((r) => {
        const rev = round2.find((x) => x.member.id === r.member.id);
        return {
          id: r.member.id,
          name: r.member.name,
          emoji: r.member.emoji,
          color: r.member.color,
          answer: r.content.trim(),
          rebuttal: rev?.content || "",
        };
      }),
      debated: round2.length > 0,
      billed_cents: billed,
    });
  } catch (e) {
    if (transactionId) await cancelAI(transactionId, "council_error").catch(() => {});
    console.error("oracle-council error", e);
    return json({ error: "council_error", message: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

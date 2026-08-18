// Oracle Verify Swarm — quality gate that runs AFTER Oracle has answered.
//
// Oracle streams its first answer instantly (so the user is never left waiting),
// then this function runs a small swarm in the background that independently
// re-answers, fact-checks and critiques that draft, and a judge merges the best
// of all of it into a single improved answer. The client only replaces the
// visible answer when the judge says the improvement is material, so the user
// always ends up with the best answer rather than the first one.
//
// Billed through the two-phase wallet like every other AI path.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser, enforceRateLimit } from "../_shared/requireAuth.ts";
import { authorizeAI, settleAI, cancelAI, InsufficientCoinsError } from "../_shared/wallet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-3.6-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Provider cost estimate per pass, in cents. The wallet adds the platform
// margin on top, so the user always covers 100% of cost plus the margin floor.
const PASS_COST_CENTS = 1;
const MIN_CHECKERS = 2;
const MAX_CHECKERS = 5;

const CHECKERS = [
  {
    title: "Independent answerer",
    brief:
      "Ignore the draft. Answer the user's question yourself, as well as you possibly can. Be concrete and complete.",
  },
  {
    title: "Fact checker",
    brief:
      "Check the draft for anything false, outdated, invented, or unsupported. List each problem and the correction. If it is all sound, say so in one line.",
  },
  {
    title: "Completeness critic",
    brief:
      "Find what the draft leaves out: missing steps, unanswered parts of the question, ignored constraints, obvious follow-ups the user will need.",
  },
  {
    title: "Clarity editor",
    brief:
      "Rewrite guidance: how to make the draft shorter, clearer and easier to act on without losing substance. Point at specific sentences.",
  },
  {
    title: "App expert",
    brief:
      "You know Oracle Lunar's features. Check the draft names the right screens, buttons and flows, and add the exact in-app path the user should take.",
  },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callModel(system: string, user: string, key: string) {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false as const, status: res.status, content: data?.message || data?.error?.message || `failed (${res.status})` };
  }
  return { ok: true as const, status: 200, content: (data?.choices?.[0]?.message?.content as string) || "" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let transactionId: string | null = null;
  try {
    const auth = await requireUser(req);
    if (auth.response) return auth.response;
    const rl = await enforceRateLimit(req, auth.user, "oracle-verify-swarm");
    if (rl) return rl;

    const body = await req.json().catch(() => ({}));
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 6000) : "";
    const draft = typeof body.draft === "string" ? body.draft.trim().slice(0, 12000) : "";
    const history = typeof body.history === "string" ? body.history.slice(0, 4000) : "";
    const requested = Number(body.checkers);
    const checkerCount = Math.min(
      MAX_CHECKERS,
      Math.max(MIN_CHECKERS, Number.isFinite(requested) ? Math.round(requested) : 3),
    );

    if (!question || !draft) return json({ error: "question and draft are required" }, 400);

    const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE) return json({ error: "AI gateway not configured" }, 500);

    const passes = checkerCount + 1; // checkers + judge
    const requestKey = `verify:${auth.user.id}:${body.requestKey || crypto.randomUUID()}`;

    try {
      const authz = await authorizeAI(
        auth.user.id,
        requestKey,
        "oracle-verify-swarm",
        "lovable",
        MODEL,
        PASS_COST_CENTS * passes,
        { checkers: checkerCount, question: question.slice(0, 200) },
      );
      transactionId = authz.transaction_id;
      // A duplicate means this exact answer is already being verified — the
      // caller should just keep the draft rather than pay twice.
      if (authz.duplicate) return json({ improved: false, reason: "duplicate" });
    } catch (e) {
      if (e instanceof InsufficientCoinsError) {
        // Verification is a bonus pass, never a blocker: the user keeps the
        // draft answer and is told why it was not upgraded.
        return json(
          {
            improved: false,
            reason: "insufficient_funds",
            needed_cents: e.needed_cents,
            balance_cents: e.balance_cents,
          },
          200,
        );
      }
      throw e;
    }

    const context = `User question:\n${question}\n\n${history ? `Recent conversation:\n${history}\n\n` : ""}Oracle's draft answer:\n${draft}`;

    const checkers = CHECKERS.slice(0, checkerCount);
    const results = await Promise.all(
      checkers.map((c) =>
        callModel(
          `You are the ${c.title} in Oracle Lunar's answer-verification swarm. ${c.brief} No preamble, no praise, max 300 words, markdown bullets.`,
          context,
          LOVABLE,
        ).then((r) => ({ title: c.title, ...r })),
      ),
    );
    const okResults = results.filter((r) => r.ok && r.content);

    if (okResults.length === 0) {
      const blocked = results.find((r) => r.status === 402 || r.status === 403 || r.status === 429);
      await cancelAI(transactionId!, "verify_all_checkers_failed").catch(() => {});
      transactionId = null;
      // Never fail the chat over verification — the draft still stands.
      return json({ improved: false, reason: blocked ? "gateway_blocked" : "checkers_failed", detail: blocked?.content });
    }

    const digest = okResults.map((r) => `## ${r.title}\n${r.content}`).join("\n\n");
    const judge = await callModel(
      `You are the Oracle's judge. You are given a user question, the Oracle's draft answer, and reports from verification agents.
Produce the single best possible final answer.
Rules:
- Keep the Oracle's warm first-person voice. Never mention agents, verification, drafts or this process.
- Fix every factual error the checkers found. Fill the gaps they named. Cut the filler.
- If the draft was already the best answer, return it essentially unchanged.
Respond with STRICT JSON only, no code fences:
{"final":"<the full final answer in markdown>","improved":<true|false>,"materially_better":<true|false>,"changes":["<short change note>"],"confidence":<0-1>}
"materially_better" is true ONLY when a user would get a meaningfully better outcome from the new answer.`,
      `${context}\n\nVerification reports:\n${digest}`,
      LOVABLE,
    );

    let final = draft;
    let improved = false;
    let materiallyBetter = false;
    let changes: string[] = [];
    let confidence = 0;
    if (judge.ok && judge.content) {
      const raw = judge.content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.final === "string" && parsed.final.trim()) {
          final = parsed.final.trim();
          improved = !!parsed.improved && final !== draft;
          materiallyBetter = !!parsed.materially_better && improved;
          changes = Array.isArray(parsed.changes) ? parsed.changes.slice(0, 6).map(String) : [];
          confidence = Number(parsed.confidence) || 0;
        }
      } catch {
        // Malformed judge output must never corrupt the answer the user sees.
        final = draft;
      }
    }

    const actualPasses = okResults.length + (judge.ok ? 1 : 0);
    let billed = 0;
    try {
      const settled = await settleAI(
        transactionId!,
        PASS_COST_CENTS * actualPasses,
        undefined,
        [{ unit_type: "request", quantity: actualPasses }],
        { checkers_ran: okResults.length, improved, materially_better: materiallyBetter },
      );
      billed = settled.total_billed_cents;
    } finally {
      transactionId = null;
    }

    return json({
      final,
      improved,
      materially_better: materiallyBetter,
      changes,
      confidence,
      checkers_ran: okResults.length,
      billed_cents: billed,
    });
  } catch (e) {
    if (transactionId) await cancelAI(transactionId, "verify_error").catch(() => {});
    console.error("oracle-verify-swarm error", e);
    return json({ improved: false, reason: "error", detail: e instanceof Error ? e.message : "Unknown error" }, 200);
  }
});

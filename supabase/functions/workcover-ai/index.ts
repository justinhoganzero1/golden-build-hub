// Worker Assist Reimagined: AI help for case managers on fictional showcase cases.
// Every AI answer is advice for a human reviewer, never a decision.
import { corsHeaders } from "npm:@supabase/supabase-js@2.99.3/cors";
import { generateResponse, GatewayError } from "npm:@lovable.dev/ai-gateway@0.1.9";
import { z } from "npm:zod@3.25.76";
import { requireUser } from "../_shared/requireAuth.ts";
import { authorizeAI, settleAI, cancelAI, InsufficientCoinsError, insufficientCoinsResponse } from "../_shared/wallet.ts";
import { PROVIDER_RATES } from "../_shared/pricing.ts";

const MODEL = "openai/gpt-6-astra" as const;
const ACTIONS = ["summary", "letter", "rtw_plan", "document", "ask", "plain_english", "explain_alert", "triage"] as const;

const bodySchema = z.object({
  action: z.enum(ACTIONS),
  case_data: z.record(z.unknown()).optional(),
  text: z.string().max(20000).optional(),
  request_key: z.string().uuid(),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BASE = `You are the AI assistant inside "Worker Assist Reimagined", a showcase case-management app for Queensland workers' compensation case managers.
Rules:
- All case records are fictional demo data. Never claim to access official WorkCover systems.
- You support humans. Never make a final decision on liability, payments, or fraud. Suspicious patterns are "items to review", never accusations.
- Be warm, plain-English (Year 8 reading level for worker-facing text), accurate and concise. Use short headings and bullet points in Markdown.
- If information is missing, write [TO CONFIRM] rather than inventing it.
- Reference the Workers' Compensation and Rehabilitation Act 2003 (Qld) only in general terms, and suggest the case manager confirm any legal detail.`;

const TASKS: Record<(typeof ACTIONS)[number], string> = {
  summary: "Write a one-screen case summary: situation, current capacity, open tasks, risks, and the three best next actions for the case manager this week.",
  letter: "Draft a friendly, clear letter from the case manager to the injured worker updating them on their claim and next steps. Plain English. Sign off as '[Case manager name]'. Use the extra instructions if given.",
  rtw_plan: "Create a suggested return-to-work plan with week-by-week graded duties and hours, matched to the medical capacity on record, with check-in points and who is responsible. Mark it as a draft for the treating doctor and employer to agree.",
  document: "The text is an uploaded document (medical certificate, invoice, report or email). Extract the key facts as a table (document type, dates, provider, capacity/restrictions, amounts), then list anything inconsistent with the case record and what to check.",
  ask: "Answer the case manager's question about this case using only the case record. If the record can't answer it, say what to find out.",
  plain_english: "Rewrite the text in plain, kind English an injured worker would understand. Keep all facts. Then add a 3-bullet 'What this means for you'.",
  explain_alert: "Explain the evidence alert in the text: why it was raised, innocent explanations to rule out first, the exact checks to do, and how to talk to the worker respectfully. Stress this is not proof of wrongdoing.",
  triage: "Triage this case: rate urgency (Low/Medium/High) with reasons, the psychosocial and return-to-work risk flags, and the single most important action today.",
};

function outputText(res: unknown): string {
  const r = res as { output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
  if (typeof r.output_text === "string" && r.output_text) return r.output_text;
  const parts: string[] = [];
  for (const item of r.output ?? []) {
    if (item.type !== "message") continue;
    for (const c of item.content ?? []) if (c.type === "output_text" && c.text) parts.push(c.text);
  }
  return parts.join("\n").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireUser(req);
  if (auth.response) return auth.response;
  const userId = auth.user!.id;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid request" }, 400);
  const { action, case_data, text, request_key } = parsed.data;
  if (["document", "plain_english", "explain_alert", "ask"].includes(action) && !text?.trim()) {
    return json({ error: "Please add some text first." }, 400);
  }

  const cost = PROVIDER_RATES.lovable_ai_gpt5_per_call;
  let hold: { transaction_id: string } | null = null;
  try {
    hold = await authorizeAI(userId, `workcover-ai:${request_key}`, "workcover-ai", "lovable-ai", MODEL, cost, { action });
  } catch (e) {
    if (e instanceof InsufficientCoinsError) return insufficientCoinsResponse(e, corsHeaders);
    console.error("workcover-ai authorize failed", e);
    return json({ error: "Billing is unavailable right now. You were not charged." }, 503);
  }

  try {
    const input = `TASK: ${TASKS[action]}\n\nCASE RECORD (fictional demo):\n${JSON.stringify(case_data ?? {}, null, 2)}\n\nTEXT / INSTRUCTIONS:\n${text ?? "(none)"}`;
    const res = await generateResponse({ model: MODEL, instructions: BASE, input });
    const answer = outputText(res);
    if (!answer) throw new Error("empty_answer");
    const settled = await settleAI(hold.transaction_id, cost, (res as { id?: string }).id, [{ unit_type: "request", quantity: 1 }], { action });
    return json({ answer, model: MODEL, billed_cents: settled.total_billed_cents });
  } catch (e) {
    await cancelAI(hold.transaction_id, "provider_failed").catch((err) => console.error("cancel failed", err));
    console.error("workcover-ai failed", e instanceof GatewayError ? { code: e.code, status: e.httpStatus } : e);
    if (e instanceof GatewayError && e.httpStatus === 429) return json({ error: "AI is busy. Please try again in a minute. You were not charged." }, 429);
    if (e instanceof GatewayError && e.httpStatus === 402) return json({ error: "AI credits are used up. You were not charged." }, 402);
    return json({ error: "The AI couldn't finish that. You were not charged." }, 502);
  }
});

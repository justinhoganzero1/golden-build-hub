// Shared helpers for the Oracle Racing controller modules.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { generateResponse, GatewayError } from "npm:@lovable.dev/ai-gateway@0.1.9";

export const AI_MODEL = "openai/gpt-6-astra" as const;

/** Read every row of a query in pages (the database returns at most 1,000 at a time). */
export async function fetchAll<T = any>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>, max = 200_000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

export function outputText(res: unknown): string {
  const r = res as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (typeof r.output_text === "string" && r.output_text) return r.output_text;
  const parts: string[] = [];
  for (const item of r.output ?? []) for (const c of item.content ?? []) if (c.type === "output_text" && c.text) parts.push(c.text);
  return parts.join("");
}

/** One AI call (owner-only racing features). Throws a readable message on failure; never retried automatically. */
export async function askAI(instructions: string, content: any[], effort: "low" | "medium" = "low"): Promise<string> {
  try {
    const res = await (generateResponse as any)({ model: AI_MODEL, instructions, input: [{ role: "user", content }], reasoning: { effort } }, { maxRetries: 0 });
    const text = outputText(res);
    if (!text) throw new Error("The AI returned nothing");
    return text;
  } catch (e) {
    const msg = e instanceof GatewayError ? `${e.code}: ${e.message}` : (e as Error).message;
    throw new Error(`AI analysis failed (${msg.slice(0, 160)})`);
  }
}

export function parseJsonObject(text: string): any | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

export async function audit(sb: SupabaseClient, actor: string, action: string, detail: Record<string, unknown>) {
  await sb.from("racing_audit_log").insert({ actor, action, detail });
}

export async function markProvider(sb: SupabaseClient, id: string, ok: boolean, error?: string) {
  const now = new Date().toISOString();
  await sb.from("racing_providers").update(ok
    ? { status: "connected", last_success_at: now, last_checked_at: now, last_error: null, updated_at: now }
    : { status: "error", last_checked_at: now, last_error: (error ?? "").slice(0, 500), updated_at: now }).eq("id", id);
}

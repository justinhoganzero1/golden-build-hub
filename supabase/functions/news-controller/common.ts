import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";
import { generateResponse, GatewayError } from "npm:@lovable.dev/ai-gateway@0.1.9";
import { NO_REPEAT_RULE } from "../_shared/noRepeat.ts";

export const AI_MODEL = "openai/gpt-6-astra" as const;
export const USER_AGENT = "OracleLunarNewsBot/1.0 (+https://oraclelunar.com)";

export function db(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Ordinary public web request with a timeout and an honest bot name. */
export async function fetchText(url: string, ms = 12_000, maxBytes = 2_000_000): Promise<{ ok: boolean; status: number; text: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5" }, redirect: "follow", signal: ctrl.signal });
    const text = (await r.text()).slice(0, maxBytes);
    return { ok: r.ok, status: r.status, text };
  } catch (e) {
    return { ok: false, status: 0, text: (e as Error).name === "AbortError" ? "timed out" : (e as Error).message };
  } finally { clearTimeout(timer); }
}

const robotsCache = new Map<string, string | null>();
/** robots.txt for a host (null = none published, which allows everything). */
export async function robotsFor(url: string): Promise<string | null> {
  const origin = new URL(url).origin;
  if (robotsCache.has(origin)) return robotsCache.get(origin)!;
  const r = await fetchText(`${origin}/robots.txt`, 6000, 200_000);
  const body = r.ok && !/<html/i.test(r.text.slice(0, 300)) ? r.text : null;
  robotsCache.set(origin, body);
  return body;
}

export async function startRun(sb: SupabaseClient, step: string, trigger: string) {
  await sb.from("news_runs").update({ status: "failed", error: "Stopped before finishing (server time limit reached)", finished_at: new Date().toISOString() })
    .eq("status", "running").lt("started_at", new Date(Date.now() - 10 * 60_000).toISOString());
  const { data } = await sb.from("news_runs").insert({ step, trigger, status: "running" }).select("id").single();
  return data?.id as string | undefined;
}
export async function finishRun(sb: SupabaseClient, id: string | undefined, status: "ok" | "partial" | "failed" | "skipped", detail: Record<string, unknown>, error?: string) {
  if (!id) return;
  await sb.from("news_runs").update({ status, detail, error: error ?? null, finished_at: new Date().toISOString() }).eq("id", id);
}

function outputText(res: unknown): string {
  const r = res as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (typeof r.output_text === "string" && r.output_text) return r.output_text;
  const parts: string[] = [];
  for (const item of r.output ?? []) for (const c of item.content ?? []) if (c.type === "output_text" && c.text) parts.push(c.text);
  return parts.join("");
}

/** One owner-funded AI call through the existing gateway. Never retried automatically. */
export async function askAI(instructions: string, prompt: string, effort: "low" | "medium" = "low"): Promise<string> {
  try {
    const res = await (generateResponse as any)({
      model: AI_MODEL,
      instructions: `${instructions}\n\n${NO_REPEAT_RULE}`,
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      reasoning: { effort },
    }, { maxRetries: 0 });
    const text = outputText(res);
    if (!text) throw new Error("The AI returned nothing");
    return text;
  } catch (e) {
    const msg = e instanceof GatewayError ? `${e.code}: ${e.message}` : (e as Error).message;
    throw new Error(`AI step failed (${msg.slice(0, 160)})`);
  }
}

export function parseJson(text: string): any | null {
  const m = text.match(/[\[{][\s\S]*[\]}]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

export function hoursSince(iso: string | null | undefined, now = Date.now()): number {
  if (!iso) return 999;
  return Math.max(0, (now - new Date(iso).getTime()) / 3600_000);
}

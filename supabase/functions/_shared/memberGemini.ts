// Members' AI runs on their own Google Gemini key (checked during setup).
// Never falls back to the platform's AI credits or the member's wallet: if the
// key fails, AI pauses and the member is asked to fix it.
import { CONSENT_VERSION, GEMINI_PROBLEM_MESSAGES, geminiProblemFrom, type GeminiKeyProblem } from "./geminiConsent.ts";

export const GEMINI_CHAT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
/** Google's always-current aliases, so model upgrades never break members' keys. */
export const MEMBER_GEMINI_MODELS = { fast: "gemini-flash-lite-latest", smart: "gemini-flash-latest" } as const;

// deno-lint-ignore no-explicit-any
type Admin = any;

export type MemberGemini = { key: string | null; verified: boolean };

export async function loadMemberGemini(admin: Admin, userId: string): Promise<MemberGemini> {
  const [{ data: keyRow }, { data: setup }] = await Promise.all([
    admin.from("user_ai_keys").select("gemini_key").eq("user_id", userId).maybeSingle(),
    admin.from("member_ai_setup").select("gemini_verified_at, consent_version").eq("user_id", userId).maybeSingle(),
  ]);
  const raw = typeof keyRow?.gemini_key === "string" ? keyRow.gemini_key.trim() : "";
  return {
    key: raw.length > 10 ? raw : null,
    verified: !!setup?.gemini_verified_at && setup?.consent_version === CONSENT_VERSION,
  };
}

export async function memberHasPaidPlan(admin: Admin, userId: string): Promise<boolean> {
  const { data: plan } = await admin.rpc("member_plan", { _user_id: userId });
  return !!plan && plan !== "free";
}

export async function markGeminiProblem(admin: Admin, userId: string, problem: GeminiKeyProblem) {
  // "unavailable" is Google's side, not the member's key — don't flag the key.
  if (problem === "unavailable") return;
  await admin.from("member_ai_setup").upsert(
    { user_id: userId, key_status: "failed", key_problem: problem, key_problem_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
}

export async function clearGeminiProblem(admin: Admin, userId: string) {
  await admin.from("member_ai_setup").update({ key_status: "ok", key_problem: null, updated_at: new Date().toISOString() })
    .eq("user_id", userId).eq("key_status", "failed");
}

/** Member hasn't finished key setup yet. */
export function geminiKeyRequiredResponse(cors: Record<string, string>): Response {
  return new Response(JSON.stringify({
    error: "gemini_key_required",
    message: "Connect your own Google Gemini key to use Oracle's AI.",
    fix_path: "/ai-key-setup",
  }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
}

/** Member's key was refused by Google — pause and ask them to fix it. */
export function geminiProblemResponse(problem: GeminiKeyProblem, cors: Record<string, string>): Response {
  return new Response(JSON.stringify({
    error: "gemini_key_problem",
    reason: problem,
    message: GEMINI_PROBLEM_MESSAGES[problem],
    fix_path: "/ai-key-setup?fix=1",
  }), { status: problem === "unavailable" ? 503 : 402, headers: { ...cors, "Content-Type": "application/json" } });
}

/** Calls Google with the member's key. On a refusal returns the problem instead of the reply. */
export async function callMemberGemini(
  key: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; response: Response } | { ok: false; problem: GeminiKeyProblem }> {
  let resp: Response;
  try {
    resp = await fetch(GEMINI_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (_) {
    return { ok: false, problem: "unavailable" };
  }
  if (resp.ok) return { ok: true, response: resp };
  const text = await resp.text().catch(() => "");
  console.warn("member gemini refused:", resp.status, text.slice(0, 200).replace(/AIza[0-9A-Za-z_-]+/g, "[key]"));
  return { ok: false, problem: geminiProblemFrom(resp.status, text) };
}

// Pop-ups raised by any server reply, wherever it came from (raw fetch or
// supabase.functions.invoke): the free-trial card check, and the member's own
// Google Gemini key (not connected yet, or refused by Google).
export const CARD_REQUIRED_EVENT = "trial:card-required";
export const GEMINI_KEY_EVENT = "gemini:key";

export type GeminiKeyDetail = { kind: "required" | "problem"; reason?: string; message?: string };

const lastFired: Record<string, number> = {};
function fire(name: string, detail: unknown) {
  const now = Date.now();
  if (now - (lastFired[name] || 0) < 4000) return;
  lastFired[name] = now;
  try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch { /* non-browser */ }
}

/**
 * Raises the right pop-up for a server reply body. Returns true when handled,
 * so callers skip the wallet top-up modal and their own error toast.
 */
export function handleAccessReply(body: any): boolean {
  const err = body?.error;
  if (err === "card_required") {
    fire(CARD_REQUIRED_EVENT, { message: body?.message });
    return true;
  }
  if (err === "gemini_key_required") {
    fire(GEMINI_KEY_EVENT, { kind: "required", message: body?.message } satisfies GeminiKeyDetail);
    return true;
  }
  if (err === "gemini_key_problem") {
    // Google not answering is Google's side, not the member's key — no alarm.
    if (body?.reason === "unavailable") return false;
    fire(GEMINI_KEY_EVENT, { kind: "problem", reason: body?.reason, message: body?.message } satisfies GeminiKeyDetail);
    return true;
  }
  return false;
}
